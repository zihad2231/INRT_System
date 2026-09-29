import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../authenticated-request.js';
import { REQUIRED_PERMISSIONS } from './require-permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (request.user?.roles?.some((r) => ['SUPER_ADMIN', 'ADMIN'].includes(r))) {
      return true;
    }
    const granted = new Set(request.user?.permissions ?? []);
    if (required.every((permission) => granted.has(permission))) return true;

    throw new ForbiddenException({
      code: 'INSUFFICIENT_PERMISSION',
      message: 'You do not have permission to perform this action.',
    });
  }
}
