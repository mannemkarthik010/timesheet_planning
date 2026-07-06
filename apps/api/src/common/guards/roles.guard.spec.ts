import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@timesheet/shared-types";
import { RolesGuard } from "./roles.guard";
import { ROLES_KEY } from "../decorators/roles.decorator";

function contextWithUser(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe("RolesGuard", () => {
  function makeGuard(requiredRoles: UserRole[] | undefined) {
    const reflector = { getAllAndOverride: () => requiredRoles } as unknown as Reflector;
    return new RolesGuard(reflector);
  }

  it("allows the request through when the route declares no @Roles()", () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(contextWithUser(undefined))).toBe(true);
  });

  it("rejects an employee token on an admin-only route", () => {
    const guard = makeGuard([UserRole.ADMIN]);
    const context = contextWithUser({ sub: "u1", role: UserRole.EMPLOYEE, otp_verified: true });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("allows an admin token with otp_verified=true on an admin-only route", () => {
    const guard = makeGuard([UserRole.ADMIN]);
    const context = contextWithUser({ sub: "u1", role: UserRole.ADMIN, otp_verified: true });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects an admin token that hasn't completed 2FA, even on an admin-only route", () => {
    const guard = makeGuard([UserRole.ADMIN]);
    const context = contextWithUser({ sub: "u1", role: UserRole.ADMIN, otp_verified: false });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it("rejects when there is no authenticated user at all", () => {
    const guard = makeGuard([UserRole.ADMIN]);
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(ForbiddenException);
  });
});
