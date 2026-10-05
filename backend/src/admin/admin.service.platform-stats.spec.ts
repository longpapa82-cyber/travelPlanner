/**
 * E08 회귀 테스트 — 플랫폼 오류 통계의 합계 보존.
 *
 * 배경(2026-10, GPT 감사 E08): getErrorLogStats의 platformBreakdown 집계는
 * SQL에서 platform이 null인 행을 'web'으로 매핑한다. 과거 구현은 매핑 후
 * 누적(+=)이 아니라 대입(=)이라, 같은 결과 집합에 null 행과 web 행이 함께
 * 있으면 뒤에 처리된 행이 앞 행을 덮어써 합계가 손실됐다(예: null=2, web=3 →
 * 처리 순서에 따라 web이 2 또는 3). 이 테스트는 null과 web이 공존할 때
 * 두 그룹의 수치가 누적되어 합계가 보존되는지 고정한다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Trip } from '../trips/entities/trip.entity';
import { ErrorLog } from './entities/error-log.entity';

/**
 * platformBreakdown 쿼리에만 특정 행을 돌려주는 qb 스텁. getErrorLogStats의
 * 다른 집계(getCount/getRawOne/다른 getRawMany)는 비워 두고, platform 집계
 * getRawMany만 주어진 rows를 반환한다. platform 집계는 select에 'platform'
 * 컬럼을 쓰므로 그 호출을 식별한다.
 */
function makeStatsQb(platformRows: Array<Record<string, string | null>>) {
  const qb: any = {};
  const chain = () => qb;
  let isPlatformQuery = false;
  qb.select = (sel: string) => {
    if (sel === 'e.platform') isPlatformQuery = true;
    return qb;
  };
  qb.addSelect = chain;
  qb.where = chain;
  qb.andWhere = chain;
  qb.groupBy = chain;
  qb.addGroupBy = chain;
  qb.orderBy = chain;
  qb.limit = chain;
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getRawOne = jest.fn().mockResolvedValue({ count: '0' });
  qb.getRawMany = jest.fn(() =>
    Promise.resolve(isPlatformQuery ? platformRows : []),
  );
  return qb;
}

describe('AdminService.getErrorLogStats — E08 플랫폼 합계 보존', () => {
  let service: AdminService;
  let platformRows: Array<Record<string, string | null>>;

  const errorRepoMock = () => ({
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => makeStatsQb(platformRows)),
  });
  const plainRepoMock = () => ({
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => makeStatsQb([])),
  });

  async function build() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useFactory: plainRepoMock },
        { provide: getRepositoryToken(Trip), useFactory: plainRepoMock },
        { provide: getRepositoryToken(ErrorLog), useFactory: errorRepoMock },
      ],
    }).compile();
    service = module.get(AdminService);
  }

  it('null 플랫폼 행을 web에 누적하여 합계를 보존한다 (덮어쓰기 금지)', async () => {
    // null=2건(warning), web=3건(error) → web 그룹은 total 5가 되어야 한다.
    platformRows = [
      { platform: null, total: '2', fatal: '0', error: '0', warning: '2' },
      { platform: 'web', total: '3', fatal: '0', error: '3', warning: '0' },
    ];
    await build();
    const stats = await service.getErrorLogStats();
    expect(stats.platformBreakdown.web.total).toBe(5);
    expect(stats.platformBreakdown.web.error).toBe(3);
    expect(stats.platformBreakdown.web.warning).toBe(2);
  });

  it('행 순서가 반대여도 합계가 동일하다 (순서 비의존)', async () => {
    platformRows = [
      { platform: 'web', total: '3', fatal: '0', error: '3', warning: '0' },
      { platform: null, total: '2', fatal: '0', error: '0', warning: '2' },
    ];
    await build();
    const stats = await service.getErrorLogStats();
    expect(stats.platformBreakdown.web.total).toBe(5);
  });

  it('알 수 없는 플랫폼 값도 web으로 누적한다', async () => {
    platformRows = [
      { platform: 'unknown', total: '4', fatal: '0', error: '1', warning: '3' },
      { platform: 'ios', total: '1', fatal: '1', error: '0', warning: '0' },
    ];
    await build();
    const stats = await service.getErrorLogStats();
    expect(stats.platformBreakdown.web.total).toBe(4);
    expect(stats.platformBreakdown.ios.fatal).toBe(1);
  });
});
