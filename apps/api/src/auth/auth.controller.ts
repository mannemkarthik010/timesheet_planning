import {
  Body,
  Controller,
  ForbiddenException,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request } from "express";
import {
  adminTwoFaVerifySchema,
  inviteAcceptRequestSchema,
  inviteRequestSchema,
  loginOtpRequestSchema,
  loginOtpVerifySchema,
  refreshRequestSchema,
  registerRequestSchema,
  UserRole,
  verifyRequestSchema,
  type AdminTwoFaVerifyRequest,
  type InviteAcceptRequest,
  type InviteRequest,
  type LoginOtpRequest,
  type LoginOtpVerifyRequest,
  type RefreshRequest,
  type RegisterRequest,
  type VerifyRequest,
} from "@timesheet/shared-types";
import { AuthService } from "./auth.service";
import { UserEntity } from "./entities/user.entity";
import { ZodValidationPipe } from "../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { JwtAccessPayload } from "@timesheet/shared-types";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(@Body(new ZodValidationPipe(registerRequestSchema)) dto: RegisterRequest) {
    return this.authService.register(dto);
  }

  @Post("verify")
  @HttpCode(200)
  verify(@Body(new ZodValidationPipe(verifyRequestSchema)) dto: VerifyRequest) {
    return this.authService.verify(dto);
  }

  @Post("login")
  @HttpCode(200)
  @UseGuards(AuthGuard("local"))
  login(@Req() req: Request & { user: UserEntity }) {
    return this.authService.login(req.user);
  }

  @Post("login/otp/request")
  @HttpCode(200)
  requestLoginOtp(@Body(new ZodValidationPipe(loginOtpRequestSchema)) dto: LoginOtpRequest) {
    return this.authService.requestLoginOtp(dto.phone_number);
  }

  @Post("login/otp/verify")
  @HttpCode(200)
  verifyLoginOtp(@Body(new ZodValidationPipe(loginOtpVerifySchema)) dto: LoginOtpVerifyRequest) {
    return this.authService.verifyLoginOtp(dto.otp_challenge_id, dto.code);
  }

  @Post("admin/2fa/verify")
  @HttpCode(200)
  verifyAdminTwoFactor(
    @Body(new ZodValidationPipe(adminTwoFaVerifySchema)) dto: AdminTwoFaVerifyRequest,
  ) {
    return this.authService.verifyAdminTwoFactor(dto.otp_challenge_id, dto.code);
  }

  @Post("refresh")
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(refreshRequestSchema)) dto: RefreshRequest) {
    return this.authService.refresh(dto.refresh_token);
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Body(new ZodValidationPipe(refreshRequestSchema)) dto: RefreshRequest) {
    await this.authService.logout(dto.refresh_token);
    return { success: true };
  }

  // [admin]-only per api-contract.md §1. The role check is inline here
  // for now; it moves onto the reusable RolesGuard once that lands (see
  // common/guards), matching data-model.md §3.3's "NestJS guards are the
  // primary enforcement point at the API layer."
  @Post("invite")
  @UseGuards(JwtAuthGuard)
  invite(
    @Body(new ZodValidationPipe(inviteRequestSchema)) dto: InviteRequest,
    @CurrentUser() currentUser: JwtAccessPayload,
  ) {
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException("This action requires the admin role.");
    }
    return this.authService.invite(dto, currentUser.sub);
  }

  @Post("invite/accept")
  @HttpCode(200)
  acceptInvite(@Body(new ZodValidationPipe(inviteAcceptRequestSchema)) dto: InviteAcceptRequest) {
    return this.authService.acceptInvite(dto.invitation_token, dto.password);
  }
}
