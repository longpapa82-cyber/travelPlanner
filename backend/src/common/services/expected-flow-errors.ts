/**
 * E05 (GPT 감사): 예상 업무 결과(사용자 취소·결제 한도·요청 중단 등)를 운영 실패와
 * 구분해 error_logs에서 제외하는 정책의 '단일 정본'.
 *
 * 배경: 과거엔 제외 목록이 둘로 갈라져 드리프트했다 — 전역 필터는 `error.name`
 * 집합(EXPECTED_ERROR_NAMES)으로, 클라 수집 컨트롤러는 `errorMessage` substring
 * 집합(IGNORED_PATTERNS)으로 각각 판별해, 같은 업무 결과가 경로에 따라 수집되거나
 * 사라졌다. 여기로 통일해 두 경로가 같은 근거를 참조한다.
 *
 * 두 축을 모두 제공한다. 필터는 신뢰할 수 있는 `error.name`이 있으니 이름 집합을,
 * 클라 리포트는 이름이 유실될 수 있어 메시지 substring을 쓴다 — 정의는 한 곳.
 */

/** 예상-흐름 오류의 정규 클래스명(대소문자 구분, error.name과 정확 매칭). */
export const EXPECTED_FLOW_ERROR_NAMES: ReadonlySet<string> = new Set([
  'PaywallError',
  'QuotaExceededError',
  'AbortError',
  'CancelledError',
  'CancelledException',
  'RequestCancelledException',
]);

/**
 * 메시지 substring 패턴(소문자). 이름이 유실된 클라 리포트용. 위 이름들의 소문자
 * 형태 + 사람이 읽는 취소/한도 문구를 포함한다.
 */
export const EXPECTED_FLOW_MESSAGE_PATTERNS: readonly string[] = [
  'monthly ai generation limit',
  'ai 생성 제한',
  'trip creation cancelled',
  '여행 생성 취소',
  'paywallerror',
  'quotaexceedederror',
  'aborterror',
  'cancellederror',
  'cancelledexception',
  'requestcancelledexception',
  'request cancelled',
];

/** 이름 기준 판별(전역 필터 경로). */
export function isExpectedFlowErrorName(name: string | undefined): boolean {
  return !!name && EXPECTED_FLOW_ERROR_NAMES.has(name);
}

/** 메시지 substring 기준 판별(클라 수집 경로). 대소문자 무시. */
export function isExpectedFlowErrorMessage(
  message: string | undefined,
): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return EXPECTED_FLOW_MESSAGE_PATTERNS.some((p) => m.includes(p));
}
