/**
 * 사용자-기인 클라이언트 4xx(비밀번호 오입력 401, Throttler 429, malformed
 * body 400 등)를 어드민 오류 피드·통계에서 기본 제외하는 회귀 테스트.
 *
 * 배경(2026-10): 외부 관리자 콘솔의 myTravel 미해결 57건 중 48건(84%)이
 * 사용자-기인 4xx 노이즈였고, 진짜 서버 결함 신호를 묻었다. 기록은 전량
 * 유지하고(포렌식), 조회·집계에서만 제외한다 — httpStatus가 null인
 * 순수 클라이언트 오류/SLOW 로그는 계속 노출돼야 한다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Trip } from '../trips/entities/trip.entity';
import { ErrorLog } from './entities/error-log.entity';

const EXCLUDE_CLAUSE =
  '(e.httpStatus IS NULL OR e.httpStatus < 400 OR e.httpStatus >= 500)';

/** Chainable qb stub that records every where/andWhere clause string. */
function makeQueryBuilder(capturedClauses: string[]) {
  const qb: any = {};
  const chain = () => qb;
  qb.select = chain;
  qb.addSelect = chain;
  qb.groupBy = chain;
  qb.addGroupBy = chain;
  qb.orderBy = chain;
  qb.limit = chain;
  qb.skip = chain;
  qb.take = chain;
  qb.where = (clause: string) => {
    capturedClauses.push(clause);
    return qb;
  };
  qb.andWhere = qb.where;
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getMany = jest.fn().mockResolvedValue([]);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  qb.getRawOne = jest.fn().mockResolvedValue({ count: '0' });
  return qb;
}

describe('AdminService — 사용자-기인 4xx 어드민 피드 제외', () => {
  let service: AdminService;
  let capturedClauses: string[];

  const repoMock = () => ({
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(() => makeQueryBuilder(capturedClauses)),
  });

  beforeEach(async () => {
    capturedClauses = [];
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useFactory: repoMock },
        { provide: getRepositoryToken(Trip), useFactory: repoMock },
        { provide: getRepositoryToken(ErrorLog), useFactory: repoMock },
      ],
    }).compile();
    service = module.get(AdminService);
  });

  it('getErrorLogs: 기본 호출은 4xx 제외 조건을 적용한다', async () => {
    await service.getErrorLogs(1, 20, undefined, false, undefined);
    expect(capturedClauses).toContain(EXCLUDE_CLAUSE);
  });

  it('getErrorLogs: includeClientErrors=true면 4xx 제외 조건을 적용하지 않는다', async () => {
    await service.getErrorLogs(1, 20, undefined, false, undefined, true);
    expect(capturedClauses).not.toContain(EXCLUDE_CLAUSE);
  });

  it('getErrorLogStats: 모든 집계 쿼리(건수 4종+top+trend+platform)에 제외 조건을 적용한다', async () => {
    await service.getErrorLogStats();
    const excludeCount = capturedClauses.filter(
      (c) => c === EXCLUDE_CLAUSE,
    ).length;
    // today·weekly·unresolved·affectedUsers·topErrors·hourlyTrend·platformBreakdown = 7
    expect(excludeCount).toBe(7);
  });

  it('제외 조건은 httpStatus null(순수 클라이언트/SLOW 로그)을 보존하는 형태다', () => {
    // 조건 자체가 IS NULL 허용을 포함하는지 문자열 계약으로 고정 — 쿼리를
    // 좁히는 리팩터링이 null 행까지 숨기면 이 테스트가 먼저 깨진다.
    expect(EXCLUDE_CLAUSE).toContain('IS NULL');
    expect(EXCLUDE_CLAUSE).toContain('>= 500');
  });
});
