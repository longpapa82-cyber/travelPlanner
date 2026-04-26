/**
 * V187 P1-C — sanitizer regression tests for log injection / HTML strip.
 *
 * Pins both sanitizers so a future "small refactor" cannot reintroduce
 * the V187 P1-C Security #3 (Logger CRLF injection) hole.
 */

import { stripHtml, safeForLog } from './sanitize';

describe('stripHtml', () => {
  it('removes all HTML tags from a string', () => {
    expect(stripHtml({ value: '<b>hi</b><script>x()</script>' })).toBe('hi');
  });
  it('passes through non-string values unchanged', () => {
    expect(stripHtml({ value: 42 })).toBe(42);
    expect(stripHtml({ value: null })).toBeNull();
  });
});

describe('safeForLog (V187 P1-C Security #3)', () => {
  it('strips CRLF so attacker cannot forge a fake log line', () => {
    const malicious = 'normal-sku\n[ERROR] forged entry';
    expect(safeForLog(malicious)).toBe('normal-sku [ERROR] forged entry');
    // Critical: no \n, no \r in the output.
    expect(safeForLog(malicious)).not.toMatch(/[\r\n]/);
  });

  it('strips ASCII control bytes (NUL, BEL, etc.)', () => {
    const evil = 'sku\x00\x07\x1f-x';
    expect(safeForLog(evil)).toBe('sku   -x');
  });

  it('preserves tab as a non-injecting whitespace', () => {
    expect(safeForLog('a\tb')).toBe('a\tb');
  });

  it('truncates to maxLen', () => {
    expect(safeForLog('x'.repeat(500), 10)).toBe('xxxxxxxxxx');
  });

  it('coerces non-strings safely', () => {
    expect(safeForLog(undefined)).toBe('');
    expect(safeForLog(null)).toBe('');
    expect(safeForLog(42)).toBe('42');
  });
});
