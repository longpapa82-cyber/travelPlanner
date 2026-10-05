/**
 * E05 회귀 테스트 — 예상-흐름 오류 제외 정책의 단일 정본.
 * 이름 축과 메시지 축이 같은 개념 집합을 커버하는지(드리프트 방지) 고정한다.
 */
import {
  EXPECTED_FLOW_ERROR_NAMES,
  isExpectedFlowErrorName,
  isExpectedFlowErrorMessage,
} from './expected-flow-errors';

describe('expected-flow-errors — E05 통일 제외 정책', () => {
  it('정규 클래스명은 이름 축에서 제외 대상이다', () => {
    for (const name of EXPECTED_FLOW_ERROR_NAMES) {
      expect(isExpectedFlowErrorName(name)).toBe(true);
    }
  });

  it('이름 축은 정확 매칭이며 미지의 이름은 제외하지 않는다', () => {
    expect(isExpectedFlowErrorName('TypeError')).toBe(false);
    expect(isExpectedFlowErrorName('InternalServerError')).toBe(false);
    expect(isExpectedFlowErrorName(undefined)).toBe(false);
  });

  it('메시지 축은 모든 정규 이름의 소문자 형태를 포함한다 (두 축 정합)', () => {
    for (const name of EXPECTED_FLOW_ERROR_NAMES) {
      expect(isExpectedFlowErrorMessage(`boom: ${name} happened`)).toBe(true);
    }
  });

  it('메시지 축은 사람이 읽는 취소·한도 문구도 잡는다', () => {
    expect(isExpectedFlowErrorMessage('여행 생성 취소됨')).toBe(true);
    expect(
      isExpectedFlowErrorMessage('Monthly AI generation limit reached'),
    ).toBe(true);
    expect(isExpectedFlowErrorMessage('request cancelled by user')).toBe(true);
  });

  it('일반 운영 실패 메시지는 제외하지 않는다', () => {
    expect(isExpectedFlowErrorMessage('Database connection refused')).toBe(
      false,
    );
    expect(isExpectedFlowErrorMessage('Unterminated string in JSON')).toBe(
      false,
    );
    expect(isExpectedFlowErrorMessage(undefined)).toBe(false);
  });
});
