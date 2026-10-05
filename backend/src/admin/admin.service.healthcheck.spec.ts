/**
 * E16 회귀 테스트 — error_logs healthcheck의 부분 수집 장애 탐지.
 *
 * 배경(2026-10, GPT 감사 E16): 24시간 총행수만 보던 healthcheck는 '한쪽 경로만'
 * 죽은 장애를 놓쳤다 — 서버 필터는 계속 쓰는데 클라 리포트(POST /error-logs)가
 * 100% 실패하면 총합은 0이 아니라 정상처럼 보였다. 이제 클라 기여분을 분리 집계해
 * server>0·client=0이면 WARN한다.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { Trip } from '../trips/entities/trip.entity';
import { ErrorLog } from './entities/error-log.entity';

/**
 * error_logs qb 스텁: andWhere에 클라 판별 절(platform IN ... / ApiInterceptor)이
 * 들어온 쿼리는 clientCount를, 아니면 total을 반환한다.
 */
function makeHealthQb(total: number, client: number) {
  const qb: any = {};
  let isClientQuery = false;
  qb.where = () => qb;
  qb.andWhere = (clause: string) => {
    if (typeof clause === 'string' && clause.includes('ApiInterceptor')) {
      isClientQuery = true;
    }
    return qb;
  };
  qb.getCount = jest.fn(() => Promise.resolve(isClientQuery ? client : total));
  return qb;
}

describe('AdminService.checkErrorLogsHealthcheck — E16 부분 장애 탐지', () => {
  let service: AdminService;
  let warnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let total = 0;
  let client = 0;

  const errRepo = () => ({
    createQueryBuilder: jest.fn(() => makeHealthQb(total, client)),
  });
  const plain = () => ({
    createQueryBuilder: jest.fn(() => makeHealthQb(0, 0)),
  });

  async function build() {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(User), useFactory: plain },
        { provide: getRepositoryToken(Trip), useFactory: plain },
        { provide: getRepositoryToken(ErrorLog), useFactory: errRepo },
      ],
    }).compile();
    service = module.get(AdminService);
    warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => {});
    logSpy = jest
      .spyOn((service as any).logger, 'log')
      .mockImplementation(() => {});
  }
  afterEach(() => jest.restoreAllMocks());

  it('server 행은 있고 client 리포트가 0이면 한쪽-장애 WARN', async () => {
    total = 10;
    client = 0;
    await build();
    await service.checkErrorLogsHealthcheck();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('one-sided client-reporting outage'),
    );
  });

  it('server·client 둘 다 있으면 정상 LOG (WARN 없음)', async () => {
    total = 10;
    client = 4;
    await build();
    await service.checkErrorLogsHealthcheck();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('server=6, client=4'),
    );
  });

  it('총합 0이면 기존 silent-failure WARN 유지', async () => {
    total = 0;
    client = 0;
    await build();
    await service.checkErrorLogsHealthcheck();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('0 entries in the last 24h'),
    );
  });
});
