import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JobStatus } from '@prisma/client';
import { ExportsProcessor } from './exports.processor.js';

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: ExportsProcessor,
  ) {}

  async requestExport(organizationId: string, requestedBy: string, jobType: string, parameters: any) {
    const job = await this.prisma.exportJob.create({
      data: {
        organizationId,
        requestedBy,
        jobType,
        parameters,
        status: JobStatus.PENDING,
      },
    });

    // Process synchronously for immediate download
    await this.processor.processJob(job.id);
    return this.prisma.exportJob.findUnique({ where: { id: job.id } });
  }

  async getMyJobs(organizationId: string, requestedBy: string) {
    return this.prisma.exportJob.findMany({
      where: { organizationId, requestedBy },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }
}
