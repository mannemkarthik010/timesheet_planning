import { Injectable, Logger } from "@nestjs/common";
import { OtpProvider } from "./otp-provider.interface";

// Used only when TWILIO_ACCOUNT_SID isn't configured (local dev without
// Twilio credentials, and the test suite) — never in production, where
// AuthModule wires TwilioOtpProvider instead (see auth.module.ts). Fixed
// code is deliberately the obvious "000000" so it's never mistaken for a
// working code path in a real deployment.
@Injectable()
export class FakeOtpProvider implements OtpProvider {
  private static readonly FIXED_CODE = "000000";
  private readonly logger = new Logger(FakeOtpProvider.name);

  async startVerification(phoneNumber: string): Promise<void> {
    this.logger.warn(
      `FakeOtpProvider active (no Twilio credentials configured) — verification code for ${phoneNumber} is ${FakeOtpProvider.FIXED_CODE}`,
    );
  }

  async checkVerification(_phoneNumber: string, code: string): Promise<boolean> {
    return code === FakeOtpProvider.FIXED_CODE;
  }
}
