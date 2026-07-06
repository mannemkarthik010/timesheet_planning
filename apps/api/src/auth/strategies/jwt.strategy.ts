import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JwtAccessPayload } from "@timesheet/shared-types";

// Validates the short-lived access token on every request. The returned
// value becomes `req.user` — RolesGuard/OwnershipGuard (common/guards)
// read `role`/`sub`/`otp_verified` from it.
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("jwt.accessSecret"),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<JwtAccessPayload> {
    return payload;
  }
}
