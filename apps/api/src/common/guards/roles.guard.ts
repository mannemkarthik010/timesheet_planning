import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtAccessPayload, UserRole } from "@timesheet/shared-types";
import { ROLES_KEY } from "../decorators/roles.decorator";

// Primary RBAC enforcement point (data-model.md §3.3: "NestJS guards check
// role + resource ownership on every request"). Must run after
// JwtAuthGuard, which populates request.user from the access token.
//
// Also re-checks the mandatory-admin-2FA invariant at the guard layer,
// not just at token-issuance time: AuthService only ever issues an admin
// token with otp_verified=true (see auth.service.ts), but a route
// guarded with @Roles('admin') rejecting otp_verified=false tokens
// outright means that invariant doesn't rely solely on every future
// code path in AuthService getting it right.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtAccessPayload | undefined = request.user;
    if (!user) {
      throw new ForbiddenException("Authentication required.");
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `This action requires one of the following roles: ${requiredRoles.join(", ")}.`,
      );
    }

    if (user.role === UserRole.ADMIN && !user.otp_verified) {
      throw new ForbiddenException("Admin session has not completed mandatory 2FA.");
    }

    return true;
  }
}
