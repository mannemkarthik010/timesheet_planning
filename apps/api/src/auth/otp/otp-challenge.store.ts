import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

export type OtpChallengePurpose = "admin_2fa" | "login_otp";

export interface OtpChallenge {
  id: string;
  userId: string;
  phoneNumber: string;
  purpose: OtpChallengePurpose;
  expiresAt: number;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

// Twilio Verify tracks pending codes by phone number, not by an opaque
// challenge id — but api-contract.md's login/2FA endpoints are keyed on
// `otp_challenge_id`. This in-memory store bridges the two. It's process-
// local, which is a real limitation for a multi-instance deployment (a
// challenge created on one instance won't be found by another) — fine for
// this single-small-restaurant deployment target per PROJECT.md, but
// flagged here since the Redis connection this app already has (BullMQ)
// would be the natural place to move this if the API ever runs more than
// one instance.
@Injectable()
export class OtpChallengeStore {
  private readonly challenges = new Map<string, OtpChallenge>();

  create(userId: string, phoneNumber: string, purpose: OtpChallengePurpose): OtpChallenge {
    this.sweep();
    const challenge: OtpChallenge = {
      id: randomUUID(),
      userId,
      phoneNumber,
      purpose,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    };
    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  consume(challengeId: string, purpose: OtpChallengePurpose): OtpChallenge | undefined {
    const challenge = this.challenges.get(challengeId);
    if (!challenge || challenge.purpose !== purpose || challenge.expiresAt < Date.now()) {
      return undefined;
    }
    this.challenges.delete(challengeId);
    return challenge;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, challenge] of this.challenges) {
      if (challenge.expiresAt < now) this.challenges.delete(id);
    }
  }
}
