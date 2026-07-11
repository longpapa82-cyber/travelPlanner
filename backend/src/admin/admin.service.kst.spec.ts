/**
 * Pins the KST "today" boundary for admin stats. The backend container runs UTC,
 * so before this fix `today.setHours(0,0,0,0)` counted from UTC midnight
 * (= 09:00 KST), leaking yesterday's KST rows into "오늘" between 00:00–09:00 KST.
 * These tests assert the boundary handed to the query builder is KST midnight.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Trip } from '../trips/entities/trip.entity';
import { ErrorLog } from './entities/error-log.entity';
import { kstMidnightUtc } from '../common/kst';

/**
 * A chainable createQueryBuilder stub that records the parameters passed to
 * `.where(...)` / `.setParameters(...)` so tests can inspect the KST boundary.
 */
function makeQueryBuilder(capturedParams: Record<string, unknown>) {
  const qb: any = {};
  const chain = () => qb;
  qb.select = chain;
  qb.addSelect = chain;
  qb.groupBy = chain;
  qb.addGroupBy = chain;
  qb.orderBy = chain;
  qb.limit = chain;
  qb.where = (_clause: string, params?: Record<string, unknown>) => {
    Object.assign(capturedParams, params);
    return qb;
  };
  qb.andWhere = qb.where;
  qb.setParameters = (params: Record<string, unknown>) => {
    Object.assign(capturedParams, params);
    return qb;
  };
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  qb.getRawOne = jest.fn().mockResolvedValue({ count: '0' });
  return qb;
}

describe('AdminService — KST today boundary', () => {
  let service: AdminService;
  let capturedParams: Record<string, unknown>;

  const mockUserRepo = () => ({
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => makeQueryBuilder(capturedParams)),
  });
  const mockErrorRepo = () => ({
    createQueryBuilder: jest.fn(() => makeQueryBuilder(capturedParams)),
  });
  const mockTripRepo = () => ({
    createQueryBuilder: jest.fn(() => makeQueryBuilder(capturedParams)),
  });

  beforeEach(async () => {
    capturedParams = {};
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: getRepositoryToken(Trip), useFactory: mockTripRepo },
        { provide: getRepositoryToken(ErrorLog), useFactory: mockErrorRepo },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  // 2026-07-11T15:30:00Z === 2026-07-12 00:30 KST. The KST day already rolled to
  // the 12th; a UTC boundary would still say the 11th.
  const koreanMorning = new Date('2026-07-11T15:30:00Z');
  // 2026-07-11T02:00:00Z === 2026-07-11 11:00 KST.
  const koreanAfternoon = new Date('2026-07-11T02:00:00Z');

  describe('getUserStats', () => {
    it('uses KST midnight as the "today" boundary (Korean morning)', async () => {
      await service.getUserStats(koreanMorning);
      expect((capturedParams.today as Date).toISOString()).toBe(
        kstMidnightUtc(koreanMorning).toISOString(),
      );
      // Concretely: KST midnight of 07-12 is 07-11T15:00:00Z.
      expect((capturedParams.today as Date).toISOString()).toBe(
        '2026-07-11T15:00:00.000Z',
      );
    });

    it('rolls the boundary forward one KST day vs a Korean-afternoon call', async () => {
      await service.getUserStats(koreanMorning);
      const morningBoundary = capturedParams.today as Date;
      capturedParams = {};
      // Re-wire repos to the fresh capture object.
      (service as any).userRepository.createQueryBuilder = jest.fn(() =>
        makeQueryBuilder(capturedParams),
      );
      await service.getUserStats(koreanAfternoon);
      const afternoonBoundary = capturedParams.today as Date;
      expect(morningBoundary.getTime() - afternoonBoundary.getTime()).toBe(
        24 * 60 * 60 * 1000,
      );
    });
  });

  describe('getErrorLogStats', () => {
    it('uses KST midnight as the "todayErrors" boundary', async () => {
      await service.getErrorLogStats(koreanMorning);
      expect((capturedParams.today as Date).toISOString()).toBe(
        '2026-07-11T15:00:00.000Z',
      );
    });
  });
});
