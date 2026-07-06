import { SetMetadata } from "@nestjs/common";

export const OWNERSHIP_KEY = "ownership_param";

// api-contract.md conventions: "an [employee] endpoint scoped to a
// resource always restricts to employee_id = current_user.id regardless
// of what's in the URL/body." `paramName` names the route param or body
// field that carries the owning employee's id (defaults to
// `employee_id`, the field name data-model.md uses almost everywhere).
export const CheckOwnership = (paramName = "employee_id") =>
  SetMetadata(OWNERSHIP_KEY, paramName);
