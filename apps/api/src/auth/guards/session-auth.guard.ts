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
    request.user = await this.authService.getSessionUser(
      request.cookies?.[SESSION_COOKIE_NAME],
    );
    return true;
  }
}
