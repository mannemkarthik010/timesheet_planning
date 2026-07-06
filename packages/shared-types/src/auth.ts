// Zod schemas for /auth/* request bodies (api-contract.md §1). Both
// apps/api (validation) and apps/mobile (form typing) import these so the
// two never drift on shape.
import { z } from "zod";

export const registerRequestSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email().optional(),
  // Required in practice: self-registration verification (POST /auth/verify)
  // is phone-based via Twilio Verify, since no email-sending provider is
  // part of the chosen stack (tech-stack.md only names Twilio for OTP).
  phone_number: z.string().min(1),
  password: z.string().min(8),
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const verifyRequestSchema = z.object({
  user_id: z.string().uuid(),
  code: z.string().min(4),
});
export type VerifyRequest = z.infer<typeof verifyRequestSchema>;

export const loginRequestSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginOtpRequestSchema = z.object({
  phone_number: z.string().min(1),
});
export type LoginOtpRequest = z.infer<typeof loginOtpRequestSchema>;

export const loginOtpVerifySchema = z.object({
  otp_challenge_id: z.string().uuid(),
  code: z.string().min(4),
});
export type LoginOtpVerifyRequest = z.infer<typeof loginOtpVerifySchema>;

export const adminTwoFaVerifySchema = z.object({
  otp_challenge_id: z.string().uuid(),
  code: z.string().min(4),
});
export type AdminTwoFaVerifyRequest = z.infer<typeof adminTwoFaVerifySchema>;

export const refreshRequestSchema = z.object({
  refresh_token: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;

export const inviteRequestSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email().optional(),
  phone_number: z.string().min(1),
  job_role: z.string().optional(),
  hourly_rate: z.number().nonnegative().optional(),
  joining_date: z.string(),
});
export type InviteRequest = z.infer<typeof inviteRequestSchema>;

export const inviteAcceptRequestSchema = z.object({
  invitation_token: z.string().min(1),
  password: z.string().min(8),
});
export type InviteAcceptRequest = z.infer<typeof inviteAcceptRequestSchema>;

export interface AuthTokensResponse {
  access_token: string;
  refresh_token: string;
  role: string;
}

export interface LoginResponse {
  access_token?: string;
  refresh_token?: string;
  role?: string;
  requires_2fa?: boolean;
  otp_challenge_id?: string;
}
