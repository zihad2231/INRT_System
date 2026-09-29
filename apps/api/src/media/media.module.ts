import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MediaController } from './media.controller.js';
import { ImageBbService } from './imagebb.service.js';
import { OrganizationLogoService } from './organization-logo.service.js';

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [ImageBbService, OrganizationLogoService],
})
export class MediaModule {}
