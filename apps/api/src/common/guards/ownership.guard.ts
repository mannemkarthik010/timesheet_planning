import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtAccessPayload, UserRole } from "@timesheet/shared-types";
import { OWNERSHIP_KEY } from "../decorators/check-ownership.decorator";

// data-model.md §3.3 defense-in-depth companion to RolesGuard: an admin
// bypasses this check entirely (admins see all employees' data by role),
// but an employee request is only allowed through when the resource's
// owning employee id — read from the route param or body field named by
// @CheckOwnership() — matches the token's own subject. This runs
// regardless of what the client put in the URL/body, so an employee can
// never read/write another employee's row by editing a request.
//
// Routes without @CheckOwnership() are unaffected (this guard is a no-op)
// — it's opt-in per route, applied by each feature module as it's built.
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const paramName = this.reflector.getAllAndOverride<string>(OWNERSHIP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!paramName) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtAccessPayload | undefined = request.user;
    if (!user) {
      throw new ForbiddenException("Authentication required.");
    }

    if (user.role === UserRole.ADMIN) {
      return true;
    }

    const ownerId = request.params?.[paramName] ?? request.body?.[paramName];
    if (ownerId !== user.sub) {
      throw new ForbiddenException("You may only access your own resources.");
    }

    return true;
  }
}
