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
