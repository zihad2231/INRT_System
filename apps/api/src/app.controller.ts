import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): { status: string; service: string } {
    return this.appService.getHealth();
  }

  @Get('health/ready')
  async getReadiness(): Promise<{ status: 'ready' | 'not_ready'; database: 'connected' | 'disconnected' }> {
    try {
      await this.appService.checkDatabase();
      return { status: 'ready', database: 'connected' };
    } catch {
      return { status: 'not_ready', database: 'disconnected' };
    }
  }
}
