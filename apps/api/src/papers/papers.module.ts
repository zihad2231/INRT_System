import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PapersController } from './papers.controller.js';
import { PapersService } from './papers.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PapersController],
  providers: [PapersService],
})
export class PapersModule {}
