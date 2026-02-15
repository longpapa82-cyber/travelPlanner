import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT Auth Guard
 *
 * JWT 인증이 있으면 user를 추출하지만,
 * 인증이 없어도 요청을 허용합니다.
 *
 * 사용 사례:
 * - 로그인/비로그인 사용자 모두 접근 가능한 엔드포인트
 * - 익명 추적 (예: 제휴 링크 클릭)
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  /**
   * handleRequest 오버라이드
   *
   * @param err - Passport 에러
   * @param user - 인증된 사용자 (없을 수 있음)
   * @param info - 추가 정보
   * @param context - 실행 컨텍스트
   * @returns user 또는 null (에러를 throw하지 않음)
   */
  handleRequest<TUser = any>(
    _err: any,
    user: any,
    _info: any,
    _context: ExecutionContext,
  ): TUser {
    // 에러가 있어도 무시하고 null 반환 (요청 계속 진행)
    // 사용자가 있으면 사용자 반환, 없으면 null
    return (user || null) as TUser;
  }
}
