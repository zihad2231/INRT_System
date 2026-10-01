import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { PapersModule } from './papers/papers.module.js';
import { ResearchModule } from './research/research.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { NoticesModule } from './notices/notices.module.js';
import { MediaModule } from './media/media.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { AssetsModule } from './assets/assets.module.js';
import { AuditModule } from './audit/audit.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ExportsModule } from './exports/exports.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { ComponentsModule } from './components/components.module.js';
import { FinanceModule } from './finance/finance.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        `${process.cwd()}/.env`,
        `${process.cwd()}/../../.env`,
      ],
    }),

    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    TeamsModule,
    ProjectsModule,
    PapersModule,
    ResearchModule,
    TasksModule,
    NoticesModule,
    MediaModule,
    DashboardModule,
    AssetsModule,
    ComponentsModule,
    FinanceModule,
    AuditModule,
    NotificationsModule,
    ExportsModule,
    OrganizationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
