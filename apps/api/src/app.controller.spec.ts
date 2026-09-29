import { Test, TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;
  const service = { getHealth: vi.fn(), checkDatabase: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    service.getHealth.mockReturnValue({ status: 'ok', service: 'intellinova-api' });
    service.checkDatabase.mockResolvedValue(undefined);
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: service }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('returns the service health payload', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        service: 'intellinova-api',
      });
    });
  });

  describe('readiness', () => {
    it('reports ready when the database check succeeds', async () => {
      await expect(appController.getReadiness()).resolves.toEqual({
        status: 'ready',
        database: 'connected',
      });
    });

    it('reports not ready when the database check fails', async () => {
      service.checkDatabase.mockRejectedValue(new Error('database unavailable'));

      await expect(appController.getReadiness()).resolves.toEqual({
        status: 'not_ready',
        database: 'disconnected',
      });
    });
  });
});
