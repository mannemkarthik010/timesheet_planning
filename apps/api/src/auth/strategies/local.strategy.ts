import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-local";
import { loginRequestSchema } from "@timesheet/shared-types";
import { AuthService } from "../auth.service";
import { UserEntity } from "../entities/user.entity";

// tech-stack.md §8 — local (email/password) is one of two Passport
// strategies backing auth, alongside the OTP-based flows.
//
// Guards run before @Body() pipes in Nest's request lifecycle, so a
// ZodValidationPipe on the controller method never actually runs before
// AuthGuard('local') reads req.body — shape validation has to happen
// here instead, against the same loginRequestSchema the DTO type comes
// from (shared-types is still the single source of truth for the shape).
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: "identifier", passwordField: "password" });
  }

  async validate(identifier: string, password: string): Promise<UserEntity> {
    const parsed = loginRequestSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      throw new BadRequestException({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request body failed validation.",
          details: parsed.error.flatten(),
        },
      });
    }

    const user = await this.authService.validatePassword(identifier, password);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials.");
    }
    return user;
  }
}
