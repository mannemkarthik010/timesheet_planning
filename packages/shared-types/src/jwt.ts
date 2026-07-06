import type { UserRole } from "./enums";

// Access token payload. `otp_verified` distinguishes an admin's
// post-password-but-pre-2FA state from a fully authenticated session —
// only a token with otp_verified=true (for admin) is accepted by guards.
export interface JwtAccessPayload {
  sub: string;
  role: UserRole;
  otp_verified: boolean;
}
