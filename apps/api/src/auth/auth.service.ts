import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { randomBytes, createHash } from "crypto";
import {
  AuditActionType,
  LoginResponse,
  RegisterRequest,
  RegistrationSource,
  UserRole,
  VerifyRequest,
} from "@timesheet/shared-types";
import { UserEntity } from "./entities/user.entity";
import { TokensService, IssuedTokens } from "./tokens.service";
import { OTP_PROVIDER, OtpProvider } from "./otp/otp-provider.interface";
import { OtpChallengeStore } from "./otp/otp-challenge.store";
import { AuditLogService } from "../database/audit-log.service";

const BCRYPT_ROUNDS = 12;
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity) private readonly users: Repository<UserEntity>,
    private readonly tokens: TokensService,
    @Inject(OTP_PROVIDER) private readonly otp: OtpProvider,
    private readonly otpChallenges: OtpChallengeStore,
    private readonly dataSource: DataSource,
    private readonly auditLog: AuditLogService,
  ) {}

  // POST /auth/register — api-contract.md §1.
  async register(dto: RegisterRequest): Promise<{ user_id: string; is_verified: boolean; next_step: string }> {
    const existing = await this.users.findOne({
      where: [{ email: dto.email ?? undefined }, { phone_number: dto.phone_number }],
    });
    if (existing) {
      throw new ConflictException("An account with this email or phone number already exists.");
    }

    const user = this.users.create({
      full_name: dto.full_name,
      email: dto.email ?? null,
      phone_number: dto.phone_number,
      password_hash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      registration_source: RegistrationSource.SELF_REGISTERED,
      role: UserRole.EMPLOYEE,
    });
    const saved = await this.users.save(user);

    await this.otp.startVerification(saved.phone_number!);

    return { user_id: saved.id, is_verified: false, next_step: "verify_otp" };
  }

  // POST /auth/verify — decision recorded in this scaffold: verification
  // channel is phone SMS via Twilio Verify (see packages/shared-types/src/auth.ts).
  async verify(dto: VerifyRequest): Promise<{ verified: boolean }> {
    const user = await this.users.findOne({ where: { id: dto.user_id } });
    if (!user || !user.phone_number) {
      throw new NotFoundException("User not found.");
    }
    const approved = await this.otp.checkVerification(user.phone_number, dto.code);
    if (!approved) {
      throw new BadRequestException("Invalid or expired verification code.");
    }
    await this.users.update(user.id, { is_verified: true });
    return { verified: true };
  }

  // Used by LocalStrategy. `identifier` may be an email or phone number.
  async validatePassword(identifier: string, password: string): Promise<UserEntity | null> {
    const user = await this.users.findOne({
      where: [{ email: identifier }, { phone_number: identifier }],
    });
    if (!user || !user.password_hash) return null;
    const matches = await bcrypt.compare(password, user.password_hash);
    return matches ? user : null;
  }

  // POST /auth/login — admin always branches into the mandatory 2FA step
  // (PROJECT.md non-negotiable rule: mandatory 2FA for admin); tokens are
  // only ever issued for an admin after POST /auth/admin/2fa/verify.
  async login(user: UserEntity): Promise<LoginResponse> {
    if (user.role === UserRole.ADMIN) {
      if (!user.phone_number) {
        throw new BadRequestException("Admin account has no phone number on file for 2FA.");
      }
      const challenge = this.otpChallenges.create(user.id, user.phone_number, "admin_2fa");
      await this.otp.startVerification(user.phone_number);
      return { requires_2fa: true, otp_challenge_id: challenge.id };
    }

    const issued = await this.tokens.issueTokens(user, true);
    await this.users.update(user.id, { last_login_at: new Date() });
    return { ...issued, role: user.role };
  }

  // POST /auth/admin/2fa/verify
  async verifyAdminTwoFactor(otpChallengeId: string, code: string): Promise<IssuedTokens & { role: UserRole }> {
    const challenge = this.otpChallenges.consume(otpChallengeId, "admin_2fa");
    if (!challenge) {
      throw new BadRequestException("This 2FA challenge is invalid or has expired.");
    }
    const approved = await this.otp.checkVerification(challenge.phoneNumber, code);
    if (!approved) {
      throw new BadRequestException("Invalid verification code.");
    }
    const user = await this.users.findOneOrFail({ where: { id: challenge.userId } });
    const issued = await this.tokens.issueTokens(user, true);
    await this.users.update(user.id, { last_login_at: new Date() });
    return { ...issued, role: user.role };
  }

  // POST /auth/login/otp/request — employee phone-OTP login alternative.
  async requestLoginOtp(phoneNumber: string): Promise<{ otp_challenge_id: string }> {
    const user = await this.users.findOne({ where: { phone_number: phoneNumber } });
    if (!user) {
      throw new NotFoundException("No account found for this phone number.");
    }
    const challenge = this.otpChallenges.create(user.id, phoneNumber, "login_otp");
    await this.otp.startVerification(phoneNumber);
    return { otp_challenge_id: challenge.id };
  }

  // POST /auth/login/otp/verify
  async verifyLoginOtp(otpChallengeId: string, code: string): Promise<IssuedTokens & { role: UserRole }> {
    const challenge = this.otpChallenges.consume(otpChallengeId, "login_otp");
    if (!challenge) {
      throw new BadRequestException("This OTP challenge is invalid or has expired.");
    }
    const approved = await this.otp.checkVerification(challenge.phoneNumber, code);
    if (!approved) {
      throw new BadRequestException("Invalid verification code.");
    }
    const user = await this.users.findOneOrFail({ where: { id: challenge.userId } });
    const issued = await this.tokens.issueTokens(user, true);
    await this.users.update(user.id, { last_login_at: new Date() });
    return { ...issued, role: user.role };
  }

  // POST /auth/refresh — rotates the refresh token (revoke old, issue new).
  async refresh(rawRefreshToken: string): Promise<IssuedTokens> {
    const record = await this.tokens.findValidRefreshToken(rawRefreshToken);
    if (!record) {
      throw new UnauthorizedException("Refresh token is invalid, expired, or already used.");
    }
    const user = await this.users.findOneOrFail({ where: { id: record.user_id } });
    await this.tokens.revoke(record);
    return this.tokens.issueTokens(user, true);
  }

  // POST /auth/logout
  async logout(rawRefreshToken: string): Promise<void> {
    const record = await this.tokens.findValidRefreshToken(rawRefreshToken);
    if (record) {
      await this.tokens.revoke(record);
    }
  }

  // POST /auth/invite — admin-invited provisioning path (api-contract.md §1).
  async invite(
    dto: { full_name: string; email?: string; phone_number: string; job_role?: string; hourly_rate?: number; joining_date: string },
    invitedByUserId: string,
  ): Promise<{ user_id: string; invitation_token: string }> {
    const existing = await this.users.findOne({
      where: [{ email: dto.email ?? undefined }, { phone_number: dto.phone_number }],
    });
    if (existing) {
      throw new ConflictException("An account with this email or phone number already exists.");
    }

    const invitationToken = randomBytes(32).toString("hex");

    // api-contract.md §1: "writes an audit_logs row (action_type:
    // employee_invited)" — same transaction as the user row, per
    // PROJECT.md's audit-logging rule.
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const user = queryRunner.manager.getRepository(UserEntity).create({
        full_name: dto.full_name,
        email: dto.email ?? null,
        phone_number: dto.phone_number,
        registration_source: RegistrationSource.ADMIN_INVITED,
        role: UserRole.EMPLOYEE,
        invited_by_user_id: invitedByUserId,
        invitation_token_hash: this.hashInvitationToken(invitationToken),
        invitation_expires_at: new Date(Date.now() + INVITATION_TTL_MS),
      });
      const saved = await queryRunner.manager.getRepository(UserEntity).save(user);

      await this.auditLog.record(queryRunner, {
        actorUserId: invitedByUserId,
        actionType: AuditActionType.EMPLOYEE_INVITED,
        entityType: "user",
        entityId: saved.id,
        newValue: { ...saved, password_hash: undefined },
      });

      await queryRunner.commitTransaction();

      // employee_profiles row creation belongs to the Employee Profiles
      // feature module (api-contract.md §2), not yet built — see
      // PROJECT.md scope note: "don't build feature endpoints yet."
      return { user_id: saved.id, invitation_token: invitationToken };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // POST /auth/invite/accept
  async acceptInvite(invitationToken: string, password: string): Promise<IssuedTokens> {
    const tokenHash = this.hashInvitationToken(invitationToken);
    const user = await this.users.findOne({ where: { invitation_token_hash: tokenHash } });
    if (!user || !user.invitation_expires_at || user.invitation_expires_at < new Date()) {
      throw new BadRequestException("Invitation is invalid or has expired.");
    }
    await this.users.update(user.id, {
      password_hash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      is_verified: true,
      invitation_token_hash: null,
      invitation_expires_at: null,
    });
    return this.tokens.issueTokens(user, true);
  }

  private hashInvitationToken(raw: string): string {
    return createHash("sha256").update(raw).digest("hex");
  }
}
