import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Trip } from './trips/entities/trip.entity';

describe('AppController', () => {
  let appController: AppController;

  const mockCacheManager = {
    get: jest.fn().mockResolvedValue('1'),
    set: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getRepositoryToken(Trip),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            query: jest.fn().mockResolvedValue([{ '1': 1 }]),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      const result = await appController.getHealth();
      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('checks');
      expect(result.checks.database).toBe('up');
      expect(result.checks.cache).toBe('up');
    });
  });

  describe('sitemap', () => {
    it('should return valid XML sitemap', async () => {
      const result = await appController.getSitemap();
      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<urlset');
      expect(result).toContain('<loc>');
    });
  });
});
