/**
 * E15 회귀 테스트 — 오류 로그 저장 한도의 심각도별 예산 분리.
 *
 * 배경(2026-10, GPT 감사 E15, 로컬 재현): 과거 필터는 4xx·5xx가 같은 100건/분
 * 단일 카운터를 공유해, 사용자-기인 4xx(401·429) 폭주가 예산을 소진하면 뒤이은
 * 진짜 서버 결함(5xx)이 저장되지 못했다(인증 401 100건 후 500 저장 0회 재현).
 * 수정: 5xx(server)와 4xx(client) 예산을 분리해 4xx 폭주가 5xx 가시성을 막지
 * 못하게 하고, 억제된 건수를 창 종료 시 WARN으로 드러낸다.
 */
import { HttpException, ArgumentsHost } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { DataSource } from 'typeorm';

function makeHost(req: any, res: any): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as any;
}

describe('AllExceptionsFilter — E15 심각도별 저장 예산', () => {
  let filter: AllExceptionsFilter;
  let saved: any[];
  let mockDataSource: jest.Mocked<DataSource>;
  let res: any;

  beforeEach(() => {
    saved = [];
    const mockRepository = {
      save: jest.fn((row: any) => {
        saved.push(row);
        return Promise.resolve(row);
      }),
    };
    mockDataSource = {
      isInitialized: true,
      getRepository: jest.fn().mockReturnValue(mockRepository),
    } as any;
    res = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const httpAdapterHost = {
      httpAdapter: {
        reply: jest.fn(),
        getRequestUrl: jest.fn().mockReturnValue('/t'),
      },
    };
    filter = new AllExceptionsFilter(httpAdapterHost as any);
    filter.setDataSource(mockDataSource);
  });
  afterEach(() => jest.clearAllMocks());

  const fire = (status: number, path: string) => {
    const req = {
      url: path,
      path,
      method: 'POST',
      headers: { 'user-agent': 'UA' },
    };
    filter.catch(new HttpException('x', status), makeHost(req, res));
  };

  it('4xx(401) 폭주가 예산을 소진해도 후속 5xx는 저장된다', () => {
    // 인증 401을 대량 발사(로그 대상 경로) — 과거엔 이게 공유 예산을 소진.
    for (let i = 0; i < 200; i++) fire(401, '/api/auth/login');
    const savedBefore5xx = saved.length;

    // 같은 시간 창에서 5xx 발생 → 반드시 저장돼야 한다(E15 핵심).
    fire(500, '/api/trips/x');

    const server5xx = saved.filter((r) => r.httpStatus >= 500);
    expect(server5xx.length).toBeGreaterThanOrEqual(1);
    // 4xx가 전부는 아니게 억제됐더라도, 5xx는 별도 예산으로 보존됨을 확인.
    expect(saved.length).toBeGreaterThan(savedBefore5xx);
  });

  it('5xx 폭주는 자체 예산 안에서 상한이 적용된다(무제한 아님)', () => {
    for (let i = 0; i < 500; i++) fire(500, '/api/trips/x');
    const server5xx = saved.filter((r) => r.httpStatus >= 500);
    // 상한이 존재해 폭주를 제한하되(저장 수 < 발사 수), 0은 아니어야 한다.
    expect(server5xx.length).toBeGreaterThan(0);
    expect(server5xx.length).toBeLessThan(500);
  });
});
