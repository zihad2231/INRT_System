import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ResearchController } from './research.controller.js';
import { ResearchService } from './research.service.js';

@Module({
  imports: [AuthModule],
  controllers: [ResearchController],
  providers: [ResearchService],
})
export class ResearchModule {}
