import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService, SESSION_COOKIE_NAME, SESSION_TTL_MS } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';
import type { AuthenticatedRequest } from './authenticated-request.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(loginDto.identifier, loginDto.password);
    response.cookie(SESSION_COOKIE_NAME, result.token, this.cookieOptions());

    return { success: true, data: { token: result.token, user: result.user, expiresAt: result.expiresAt } };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(request.cookies?.[SESSION_COOKIE_NAME]);
    response.clearCookie(SESSION_COOKIE_NAME, this.cookieOptions(false));

    return { success: true, data: { loggedOut: true } };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  async me(@Req() request: AuthenticatedRequest) {
    return { success: true, data: { user: request.user } };
  }

  private cookieOptions(includeLifetime = true): CookieOptions {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/',
      ...(includeLifetime ? { maxAge: SESSION_TTL_MS } : {}),
    };
  }
}
