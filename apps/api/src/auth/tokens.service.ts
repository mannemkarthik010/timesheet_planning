import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectRepository } from "@nestjs/typeorm";
import { JwtService } from "@nestjs/jwt";
import { Repository } from "typeorm";
import { randomUUID, createHash } from "crypto";
import { JwtAccessPayload } from "@timesheet/shared-types";
import { RefreshTokenEntity } from "./entities/refresh-token.entity";
import { UserEntity } from "./entities/user.entity";

export interface IssuedTokens {
  access_token: string;
  refresh_token: string;
}

// api-contract.md §1/§12 — access tokens are short-lived (~15 min);
// refresh_token TTL differs by role (admin vs employee session timeout).
// The per-role TTL ultimately belongs to restaurant_settings
// (admin_session_timeout_minutes / employee_session_timeout_minutes) —
// wiring that dynamic lookup is deferred until the settings module
// exists; for now it falls back to JWT_REFRESH_TTL_*_MINUTES env config,
// which mirrors the same default values (15 / 60).
@Injectable()
export class TokensService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokens: Repository<RefreshTokenEntity>,
  ) {}

  signAccessToken(user: UserEntity, otpVerified: boolean): string {
    const payload: JwtAccessPayload = { sub: user.id, role: user.role, otp_verified: otpVerified };
    return this.jwt.sign(payload, {
      secret: this.config.get<string>("jwt.accessSecret"),
      expiresIn: this.config.get<string>("jwt.accessTtl"),
    });
  }

  async issueTokens(
    user: UserEntity,
    otpVerified: boolean,
    meta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<IssuedTokens> {
    const access_token = this.signAccessToken(user, otpVerified);
    const refresh_token = await this.createRefreshToken(user, meta);
    return { access_token, refresh_token };
  }

  private async createRefreshToken(
    user: UserEntity,
    meta: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<string> {
    const raw = `${randomUUID()}${randomUUID()}`;
    const ttlMinutes =
      user.role === "admin"
        ? this.config.get<number>("jwt.refreshTtlAdminMinutes")!
        : this.config.get<number>("jwt.refreshTtlEmployeeMinutes")!;

    await this.refreshTokens.insert({
      user_id: user.id,
      token_hash: this.hash(raw),
      expires_at: new Date(Date.now() + ttlMinutes * 60_000),
      ip_address: meta.ipAddress ?? null,
      user_agent: meta.userAgent ?? null,
    });

    return raw;
  }

  hash(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }

  async findValidRefreshToken(rawToken: string): Promise<RefreshTokenEntity | null> {
    const tokenHash = this.hash(rawToken);
    const record = await this.refreshTokens.findOne({ where: { token_hash: tokenHash } });
    if (!record || record.revoked_at || record.expires_at < new Date()) {
      return null;
    }
    return record;
  }

  async revoke(record: RefreshTokenEntity): Promise<void> {
    await this.refreshTokens.update(record.id, { revoked_at: new Date() });
  }
}
