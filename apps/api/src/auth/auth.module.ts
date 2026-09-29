import { Module, Global } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SessionAuthGuard } from './guards/session-auth.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';

@Global()
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, PermissionsGuard],
  exports: [AuthService, SessionAuthGuard, PermissionsGuard],
})
export class AuthModule {}
