export const OTP_PROVIDER = Symbol("OTP_PROVIDER");

export interface OtpProvider {
  startVerification(phoneNumber: string): Promise<void>;
  checkVerification(phoneNumber: string, code: string): Promise<boolean>;
}
