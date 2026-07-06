import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Twilio from "twilio";
import { OtpProvider } from "./otp-provider.interface";

// tech-stack.md §5 / PROJECT.md — Twilio Verify backs both self-
// registration phone verification and mandatory admin 2FA. Verify keeps
// pending-code state on Twilio's side keyed by phone number, so this
// class holds no OTP state itself.
@Injectable()
export class TwilioOtpProvider implements OtpProvider {
  private readonly client: ReturnType<typeof Twilio>;
  private readonly verifyServiceSid: string;

  constructor(config: ConfigService) {
    this.client = Twilio(
      config.get<string>("twilio.accountSid"),
      config.get<string>("twilio.authToken"),
    );
    this.verifyServiceSid = config.get<string>("twilio.verifyServiceSid")!;
  }

  async startVerification(phoneNumber: string): Promise<void> {
    await this.client.verify.v2
      .services(this.verifyServiceSid)
      .verifications.create({ to: phoneNumber, channel: "sms" });
  }

  async checkVerification(phoneNumber: string, code: string): Promise<boolean> {
    const check = await this.client.verify.v2
      .services(this.verifyServiceSid)
      .verificationChecks.create({ to: phoneNumber, code });
    return check.status === "approved";
  }
}
