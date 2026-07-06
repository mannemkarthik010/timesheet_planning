import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { TokensService } from "./tokens.service";
import { UserEntity } from "./entities/user.entity";
import { RefreshTokenEntity } from "./entities/refresh-token.entity";
import { AuditLogEntity } from "../database/entities/audit-log.entity";
import { AuditLogService } from "../database/audit-log.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";
import { OTP_PROVIDER } from "./otp/otp-provider.interface";
import { TwilioOtpProvider } from "./otp/twilio-otp.provider";
import { FakeOtpProvider } from "./otp/fake-otp.provider";
import { OtpChallengeStore } from "./otp/otp-challenge.store";

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity, AuditLogEntity]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("jwt.accessSecret"),
        signOptions: { expiresIn: config.get<string>("jwt.accessTtl") },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokensService,
    AuditLogService,
    OtpChallengeStore,
    JwtStrategy,
    LocalStrategy,
    {
      provide: OTP_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get<string>("twilio.accountSid")
          ? new TwilioOtpProvider(config)
          : new FakeOtpProvider(),
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
