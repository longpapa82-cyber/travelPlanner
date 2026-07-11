/**
 * Pins the KST "today"/MTD boundaries for API-usage stats. Container runs UTC, so
 * before this fix the today/month-to-date windows keyed off UTC midnight
 * (= 09:00 KST) and rolled 9h late in Korea. Asserts KST anchoring.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiUsageService } from './api-usage.service';
import { ApiUsage } from './entities/api-usage.entity';
import { kstMidnightUtc, kstMonthStartUtc } from '../common/kst';

function makeQueryBuilder(capturedParams: Record<string, unknown>) {
  const qb: any = {};
  const chain = () => qb;
  qb.select = chain;
  qb.addSelect = chain;
  qb.groupBy = chain;
  qb.addGroupBy = chain;
  qb.orderBy = chain;
  qb.where = (_clause: string, params?: Record<string, unknown>) => {
    Object.assign(capturedParams, params);
    return qb;
  };
  qb.andWhere = qb.where;
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  qb.getRawOne = jest.fn().mockResolvedValue({ total: '0', errors: '0' });
  return qb;
}

describe('ApiUsageService — KST today/MTD boundary', () => {
  let service: ApiUsageService;
  let capturedParams: Record<string, unknown>;

  const mockRepo = () => ({
    createQueryBuilder: jest.fn(() => makeQueryBuilder(capturedParams)),
  });

  beforeEach(async () => {
    capturedParams = {};
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiUsageService,
        { provide: getRepositoryToken(ApiUsage), useFactory: mockRepo },
      ],
    }).compile();
    service = module.get(ApiUsageService);
  });

  it('anchors today/MTD to KST during the Korean morning (day already rolled)', async () => {
    // 2026-07-01T00:30:00Z === 2026-07-01 09:30 KST → KST day is July 1, month 7.
    // But 2026-06-30T20:00:00Z === 2026-07-01 05:00 KST → still July 1 in KST
    // while the UTC date is still June 30. This is the boundary the fix targets.
    const now = new Date('2026-06-30T20:00:00Z');
    await service.getApiUsageSummary(now);

    // todayStart = KST midnight of 07-01 = 06-30T15:00:00Z.
    expect((capturedParams.todayStart as Date).toISOString()).toBe(
      kstMidnightUtc(now).toISOString(),
    );
    expect((capturedParams.todayStart as Date).toISOString()).toBe(
      '2026-06-30T15:00:00.000Z',
    );

    // mtdStart = first of the KST month (July 1 KST) = 06-30T15:00:00Z, NOT
    // July 1 UTC (which a naive local-month boundary would produce).
    expect((capturedParams.mtdStart as Date).toISOString()).toBe(
      kstMonthStartUtc(now).toISOString(),
    );
    expect((capturedParams.mtdStart as Date).toISOString()).toBe(
      '2026-06-30T15:00:00.000Z',
    );
  });

  it('keeps today/MTD on the previous KST day during Korean afternoon', async () => {
    // 2026-07-11T02:00:00Z === 2026-07-11 11:00 KST → today = 07-11 KST midnight.
    const now = new Date('2026-07-11T02:00:00Z');
    await service.getApiUsageSummary(now);
    expect((capturedParams.todayStart as Date).toISOString()).toBe(
      '2026-07-10T15:00:00.000Z',
    );
    // MTD start = July 1 KST midnight = 06-30T15:00:00Z.
    expect((capturedParams.mtdStart as Date).toISOString()).toBe(
      '2026-06-30T15:00:00.000Z',
    );
  });
});
