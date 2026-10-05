/**
 * E03 회귀 테스트 — create-error-log DTO의 stackTrace 타입 계약.
 *
 * 배경(2026-10, GPT 감사 E03, 로컬 재현): 백엔드 전역 필터(all-exceptions.filter)는
 * 에러 응답의 message를 '배열'로 반환한다. 프론트 5xx 자동 보고 인터셉터는 그
 * 값을 stackTrace에 그대로 넣는데, DTO는 @IsString()이라 배열이면 400으로
 * 거절됐다 → 5xx의 클라이언트 측 기기·앱버전 맥락이 유실. 생산자(배열 가능)와
 * 수집자(문자열만) 계약 불일치. 서버사이드 수정: DTO가 배열 stackTrace를
 * 받아 개행으로 합친 문자열로 정규화한다(문자열 클라이언트는 하위호환 유지).
 */
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateErrorLogDto } from './create-error-log.dto';

async function validateDto(input: Record<string, unknown>) {
  const dto = plainToInstance(CreateErrorLogDto, input);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('CreateErrorLogDto — E03 stackTrace 타입 계약', () => {
  it('문자열 stackTrace는 그대로 통과한다 (하위호환)', async () => {
    const { dto, errors } = await validateDto({
      errorMessage: 'boom',
      stackTrace: 'Error: boom\n  at x',
    });
    expect(errors).toHaveLength(0);
    expect(dto.stackTrace).toBe('Error: boom\n  at x');
  });

  it('배열 stackTrace(필터의 message 배열)를 개행 문자열로 정규화해 통과시킨다', async () => {
    const { dto, errors } = await validateDto({
      errorMessage: '[API 500] POST /trips',
      stackTrace: ['field must not be empty', 'value is invalid'],
    });
    expect(errors).toHaveLength(0);
    expect(typeof dto.stackTrace).toBe('string');
    expect(dto.stackTrace).toBe('field must not be empty\nvalue is invalid');
  });

  it('stackTrace 없음(선택 필드)도 통과한다', async () => {
    const { errors } = await validateDto({ errorMessage: 'boom' });
    expect(errors).toHaveLength(0);
  });

  it('errorMessage 누락은 여전히 거절한다 (필수 계약 유지)', async () => {
    const { errors } = await validateDto({ stackTrace: 'x' });
    expect(errors.length).toBeGreaterThan(0);
  });
});
