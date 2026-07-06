import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@timesheet/shared-types";
import { OwnershipGuard } from "./ownership.guard";

function contextWith(user: unknown, params: Record<string, string> = {}, body: Record<string, unknown> = {}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user, params, body }) }),
  } as unknown as ExecutionContext;
}

describe("OwnershipGuard", () => {
  function makeGuard(paramName: string | undefined) {
    const reflector = { getAllAndOverride: () => paramName } as unknown as Reflector;
    return new OwnershipGuard(reflector);
  }

  it("is a no-op when the route has no @CheckOwnership()", () => {
    const guard = makeGuard(undefined);
    expect(guard.canActivate(contextWith(undefined))).toBe(true);
  });

  it("lets an admin through regardless of the resource's owner", () => {
    const guard = makeGuard("employee_id");
    const context = contextWith(
      { sub: "admin-1", role: UserRole.ADMIN },
      { employee_id: "someone-else" },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows an employee to access their own resource", () => {
    const guard = makeGuard("employee_id");
    const context = contextWith(
      { sub: "emp-1", role: UserRole.EMPLOYEE },
      { employee_id: "emp-1" },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects an employee accessing another employee's resource, even via the body", () => {
    const guard = makeGuard("employee_id");
    const context = contextWith(
      { sub: "emp-1", role: UserRole.EMPLOYEE },
      {},
      { employee_id: "emp-2" },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
