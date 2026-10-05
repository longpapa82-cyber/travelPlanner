import sanitizeHtml from 'sanitize-html';

/**
 * Strip ALL HTML tags from user input (plain text only).
 * Use as a class-transformer @Transform() callback.
 */
export const stripHtml = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string'
    ? sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    : value;

/**
 * V187 P1-C (Security #3): CRLF / control-character sanitizer for log
 * messages. NestJS Logger.log/warn/error pass strings through to stdout
 * unmodified — a user-controlled value containing `\n[ERROR] fake entry`
 * would inject a forged log line, enabling SOC misdirection during
 * incident response.
 *
 * Replaces CR, LF, NUL, and other ASCII control bytes (0x00-0x1F, except
 * 0x09 tab) with a single space. Output remains human-readable; the
 * structural "one entry per line" log format is preserved. Output is
 * also bounded to maxLen so a megabyte-sized adversarial value cannot
 * blow up log shipping.
 */
/**
 * Stringify a non-string value for log output, mirroring the runtime
 * behaviour of `String(value ?? '')`: null/undefined → '', everything else
 * via String(). Implemented as an explicit helper so the linter does not
 * flag implicit object-to-string coercion (no-base-to-string) while keeping
 * the exact same output (objects still become '[object Object]').
 */
const stringifyForLog = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  return String(value);
};

export const safeForLog = (value: unknown, maxLen = 200): string => {
  const s = typeof value === 'string' ? value : stringifyForLog(value);
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0A-\x1F]/g, ' ').slice(0, maxLen);
};

/**
 * E13 (GPT 감사): PII 마스킹 for error_logs free-text (errorMessage/stackTrace).
 *
 * 배경: 길이 제한·URL query 제거만으로는 메시지·스택 본문에 섞여 들어온 이메일·
 * 토큰이 평문 저장됐다. 저장 경계에서 고신뢰 패턴만 선별 마스킹한다 — 진단 가치를
 * 지키려 과도 마스킹은 피하고(스택의 파일경로·식별자는 보존), 명확한 개인식별/자격
 * 증명 토큰만 가린다.
 *
 * 마스킹 대상(보수적):
 * - 이메일 주소 → `[email]` (로컬파트 첫 글자만 힌트: `a***@***`)
 * - Bearer/JWT 토큰(ey...로 시작하는 3-파트) → `[jwt]`
 * - `token=`, `access_token=`, `refresh_token=`, `password=`, `secret=`, `apikey=`,
 *   `authorization:` 뒤 값 → `[redacted]`
 *
 * 과도 마스킹 방지: 임의 숫자열·UUID·파일경로는 건드리지 않는다(진단 식별자로 필요).
 */
const EMAIL_RE =
  /([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// JWT: 3개의 base64url 파트, 보통 ey 로 시작.
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
// key=value / key: value 형태의 민감 키. 값은 공백/따옴표/& 전까지.
const SECRET_KV_RE =
  /\b(password|passwd|secret|token|access_token|refresh_token|api[-_]?key|authorization|auth)\b\s*[=:]\s*["']?([^\s"'&,}]+)/gi;

export const maskPii = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return value as undefined;
  return value
    .replace(JWT_RE, '[jwt]')
    .replace(SECRET_KV_RE, (_m, key: string) => `${key}=[redacted]`)
    .replace(EMAIL_RE, (_m, first: string) => `${first}***@***`);
};
