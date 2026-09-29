import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth(): { status: string; service: string } {
    return { status: 'ok', service: 'intellinova-api' };
  }

  async checkDatabase(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1`;
  }
}
