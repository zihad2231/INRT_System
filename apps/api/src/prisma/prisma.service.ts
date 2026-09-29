import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    // Keep the API process available for liveness/readiness checks when the DB
    // is temporarily unavailable. Prisma connects lazily on the first query.
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
