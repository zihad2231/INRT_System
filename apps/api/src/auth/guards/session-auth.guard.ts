import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthService, SESSION_COOKIE_NAME } from '../auth.service.js';
import type { AuthenticatedRequest } from '../authenticated-request.js';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7)
      : undefined;
    const token =
      bearerToken ||
      (request.headers['x-session-token'] as string | undefined) ||
      request.cookies?.[SESSION_COOKIE_NAME];

    request.user = await this.authService.getSessionUser(token);
    return true;
  }
}
