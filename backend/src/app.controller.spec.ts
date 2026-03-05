import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Trip } from './trips/entities/trip.entity';

// Mock the shutdown flag module
jest.mock('./common/lifecycle.service', () => ({
  isShuttingDown: false,
}));

describe('AppController', () => {
  let appController: AppController;

  const mockCacheManager = {
    get: jest.fn().mockResolvedValue('1'),
    set: jest.fn().mockResolvedValue(undefined),
  };

  // Mock Express Response
  const mockRes = () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.redirect = jest.fn().mockReturnValue(res);
    return res;
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
            createQueryBuilder: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              take: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([]),
            }),
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
      const res = mockRes();
      await appController.getHealth(res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          checks: { database: 'up', cache: 'up' },
        }),
      );
    });

    it('should return 503 during shutdown', async () => {
      // Dynamically override the shutdown flag
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const lifecycle = require('./common/lifecycle.service');
      const original = lifecycle.isShuttingDown;
      lifecycle.isShuttingDown = true;

      const res = mockRes();
      await appController.getHealth(res);
      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'shutting_down' }),
      );

      lifecycle.isShuttingDown = original;
    });
  });

  describe('sitemap', () => {
    it('should return valid XML sitemap', async () => {
      const res = mockRes();
      await appController.getSitemap(res);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/xml; charset=utf-8',
      );
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('<?xml version="1.0" encoding="UTF-8"?>'),
      );
    });
  });
});
