import { Module } from '@nestjs/common';
import { ExportsService } from './exports.service.js';
import { ExportsController } from './exports.controller.js';
import { ExportsProcessor } from './exports.processor.js';

@Module({
  imports: [],
  controllers: [ExportsController],
  providers: [ExportsService, ExportsProcessor],
  exports: [ExportsService],
})
export class ExportsModule {}
