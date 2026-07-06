import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@timesheet/shared-types";

export const ROLES_KEY = "roles";

// api-contract.md tags every endpoint [employee], [admin], or
// [employee|admin]. @Roles(...) is how a controller method declares which
// of those it is; RolesGuard reads this via ROLES_KEY.
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
