/**
 * E04 회귀 테스트 — 오류 로그 큐 재전송의 서버 계약 정합.
 *
 * 배경(2026-10, GPT 감사 E04, 로컬 재현): queueErrorLog가 payload에 로컬 전용
 * 메타 `queuedAt`을 추가하는데, drainErrorLogQueue가 그 객체를 그대로 POST했다.
 * 서버 ValidationPipe는 forbidNonWhitelisted:true라 `property queuedAt should
 * not exist`로 400 거절 → 큐가 영구히 막혀 모든 재전송 실패. 수정: drain 시
 * queuedAt을 분리해 전송하고, 4xx(영구 거절)는 재시도하지 않고 드롭한다.
 */
jest.mock('../../utils/storage', () => ({
  secureStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));
jest.mock('../offlineCache', () => ({
  offlineCache: { get: jest.fn(), set: jest.fn(() => Promise.resolve()) },
}));
jest.mock('../../i18n', () => ({ getCurrentLanguage: jest.fn(() => 'ko') }));

import apiService from '../api';
import { secureStorage } from '../../utils/storage';

const getItem = secureStorage.getItem as jest.Mock;
const setItem = secureStorage.setItem as jest.Mock;
const removeItem = secureStorage.removeItem as jest.Mock;

describe('ApiService error-log queue drain — E04', () => {
  let postSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    postSpy = jest.spyOn(apiService.getInstance(), 'post');
  });
  afterEach(() => postSpy.mockRestore());

  const drain = () => (apiService as any).drainErrorLogQueue();

  it('재전송 시 queuedAt을 분리하고 순수 payload만 POST한다', async () => {
    getItem.mockResolvedValue(
      JSON.stringify([
        { errorMessage: 'boom', screen: 'X', queuedAt: 1700000000000 },
      ]),
    );
    postSpy.mockResolvedValue({ data: {} });

    await drain();

    expect(postSpy).toHaveBeenCalledTimes(1);
    const [, body] = postSpy.mock.calls[0];
    expect(body).toEqual({ errorMessage: 'boom', screen: 'X' });
    expect(body).not.toHaveProperty('queuedAt');
    // 전량 성공 → 큐 제거
    expect(removeItem).toHaveBeenCalled();
  });

  it('400(영구 거절)은 재시도하지 않고 드롭한다 (큐 비움)', async () => {
    getItem.mockResolvedValue(
      JSON.stringify([{ errorMessage: 'bad', queuedAt: 1 }]),
    );
    postSpy.mockRejectedValue({ response: { status: 400 } });

    await drain();

    // 400이면 remaining이 비어 큐를 제거(removeItem), setItem으로 재큐잉하지 않음
    expect(removeItem).toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });

  it('네트워크/5xx 실패는 큐에 보존해 다음 drain을 노린다', async () => {
    getItem.mockResolvedValue(
      JSON.stringify([{ errorMessage: 'later', queuedAt: 2 }]),
    );
    postSpy.mockRejectedValue({ response: { status: 503 } });

    await drain();

    // 5xx는 remaining에 남아 setItem으로 재저장, removeItem은 호출 안 됨
    expect(setItem).toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    const saved = JSON.parse(setItem.mock.calls[0][1]);
    expect(saved).toHaveLength(1);
    expect(saved[0].errorMessage).toBe('later');
  });

  it('빈 큐는 아무 것도 하지 않는다', async () => {
    getItem.mockResolvedValue(null);
    await drain();
    expect(postSpy).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });
});
