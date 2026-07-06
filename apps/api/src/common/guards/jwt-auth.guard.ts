import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

// Thin named wrapper around Passport's jwt strategy (auth/strategies/jwt.strategy.ts)
// so it composes with RolesGuard/OwnershipGuard via a normal
// @UseGuards(JwtAuthGuard, RolesGuard) list, and so every protected
// controller depends on one guard class rather than the 'jwt' string
// literal scattered across the codebase.
@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {}
