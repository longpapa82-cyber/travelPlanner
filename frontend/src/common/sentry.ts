/**
 * Sentry 제거됨 — 호출처 호환을 위한 no-op 스텁.
 *
 * Sentry SDK 의존을 완전히 제거했지만, 다른 모듈들이 아래 함수를
 * import해 호출하므로 시그니처는 그대로 유지한다. 모든 본문은 no-op이다.
 */

export function isSentryInitialized(): boolean {
  return false;
}

export function initSentry(): void {
  // no-op: Sentry 제거됨
}

/**
 * V169 (F5): Generic breadcrumb helper for subscription state transitions.
 * no-op: Sentry 제거됨.
 */
export function addBreadcrumb(_args: {
  category: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}): void {
  // no-op: Sentry 제거됨
}

/**
 * Record a breadcrumb when an API call exceeds a slow threshold.
 * no-op: Sentry 제거됨.
 */
export function recordSlowApiCall(
  _url: string,
  _method: string,
  _durationMs: number,
  _statusCode?: number,
): void {
  // no-op: Sentry 제거됨
}
