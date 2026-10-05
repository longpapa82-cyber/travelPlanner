/**
 * E13 회귀 테스트 — error_logs free-text의 PII 마스킹.
 * 명확한 개인식별/자격증명만 가리고, 진단에 필요한 식별자(UUID·파일경로·숫자)는
 * 보존하는 균형을 고정한다.
 */
import { maskPii } from './sanitize';

describe('maskPii — E13 민감정보 선별 마스킹', () => {
  it('이메일을 마스킹하되 첫 글자 힌트는 남긴다', () => {
    expect(maskPii('login failed for alice@example.com')).toBe(
      'login failed for a***@***',
    );
  });

  it('JWT(ey...) 토큰을 마스킹한다', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc_DEF-123';
    expect(maskPii(`Authorization header ${jwt} rejected`)).toContain('[jwt]');
    expect(maskPii(`x ${jwt}`)).not.toContain('eyJhbGci');
  });

  it('key=value 형태의 자격증명을 redact한다', () => {
    expect(maskPii('url?token=abc123secret&x=1')).toContain('token=[redacted]');
    expect(maskPii('password=hunter2')).toBe('password=[redacted]');
    expect(maskPii('refresh_token: zzz999')).toContain(
      'refresh_token=[redacted]',
    );
  });

  it('진단 식별자는 보존한다 (과도 마스킹 방지)', () => {
    // UUID·파일경로·일반 숫자열·상태코드는 그대로.
    const s =
      'TripNotFound id=550e8400-e29b-41d4-a716-446655440000 at trips.service.ts:642 status=404';
    expect(maskPii(s)).toBe(s);
  });

  it('비문자열/빈값은 그대로 통과', () => {
    expect(maskPii(undefined)).toBeUndefined();
    expect(maskPii('')).toBe('');
    expect(maskPii('no secrets here, just an error')).toBe(
      'no secrets here, just an error',
    );
  });

  it('여러 PII가 섞여도 각각 마스킹한다', () => {
    const r = maskPii('user bob@test.io token=xyz failed');
    expect(r).toContain('b***@***');
    expect(r).toContain('token=[redacted]');
    expect(r).not.toContain('bob@test.io');
    expect(r).not.toContain('xyz');
  });
});
