import {
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/nestjs';
import { DataSource } from 'typeorm';
import { ErrorLog } from '../../admin/entities/error-log.entity';
import { detectPlatform } from '../utils/platform-detector';

/**
 * Global exception filter that:
 * - Converts unhandled exceptions to consistent JSON responses
 * - Reports 5xx errors and unknown exceptions to Sentry
 * - Persists 5xx errors to ErrorLog table for admin dashboard
 * - Logs all errors with request context
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private dataSource?: DataSource;
  private errorLogCount = 0;
  private errorLogWindowStart = Date.now();
  private static readonly MAX_ERROR_LOGS_PER_MINUTE = 100;

  setDataSource(ds: DataSource): void {
    this.dataSource = ds;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string | string[];
    let error: string;
    // V112 Wave 5: discriminated error code + auxiliary fields (resumeToken,
    // user) must survive the filter so the frontend can branch on them.
    // See auth-error-codes.ts and AuthContext.login for consumers.
    let code: string | undefined;
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const body = exceptionResponse as {
          message?: string | string[];
          code?: string;
          [key: string]: unknown;
        };
        message = body.message || exception.message;
        code = body.code;
        // Preserve any non-standard keys (resumeToken, user, ...) so V112
        // structured error payloads pass through unchanged.
        const {
          message: _m,
          code: _c,
          statusCode: _s,
          error: _e,
          ...rest
        } = body;
        extra = rest;
      }
      error = exception.name;

      // Only report 5xx to Sentry
      if (status >= 500) {
        Sentry.captureException(exception, {
          extra: { path: request.url, method: request.method },
        });
      }
    } else {
      // Unknown/unhandled exceptions → 500
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
      error = 'InternalServerError';

      // Always report unknown exceptions to Sentry
      Sentry.captureException(exception, {
        extra: { path: request.url, method: request.method },
      });

      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    // Determine if this error should be logged
    const shouldLogError = this.shouldLogError(status, request.path, error);

    // Persist important errors to ErrorLog (fire-and-forget, rate-limited)
    const now = Date.now();
    if (now - this.errorLogWindowStart > 60_000) {
      this.errorLogCount = 0;
      this.errorLogWindowStart = now;
    }
    if (
      shouldLogError &&
      this.dataSource?.isInitialized &&
      this.errorLogCount < AllExceptionsFilter.MAX_ERROR_LOGS_PER_MINUTE
    ) {
      this.errorLogCount++;
      // Extract meaningful error message for logging
      let errorMessage: string;
      if (typeof message === 'string') {
        errorMessage = message;
      } else if (Array.isArray(message)) {
        errorMessage = message.join('; ');
      } else if (exception instanceof Error) {
        errorMessage = exception.message;
      } else {
        errorMessage = 'Unknown error';
      }

      // V174 (P1): real context instead of hardcoded placeholders.
      // Previously `userId`/`userEmail` stayed null and `platform` was
      // always `'web'` regardless of the real caller — so error logs
      // could not be joined against users or filtered per-platform.
      const jwtUser = (request as any).user as
        | { userId?: string; email?: string }
        | undefined;
      const ua = request.headers['user-agent'];

      this.dataSource
        .getRepository(ErrorLog)
        .save({
          userId: jwtUser?.userId,
          userEmail: jwtUser?.email,
          errorMessage: errorMessage.slice(0, 500),
          errorName:
            exception instanceof Error
              ? exception.name?.slice(0, 100)
              : undefined,
          stackTrace: exception instanceof Error ? exception.stack : undefined,
          severity: this.getSeverity(status),
          platform: detectPlatform(ua),
          screen: `${request.method} ${request.path}`.slice(0, 200),
          routeName:
            `${request.method} ${request.route?.path ?? request.path}`.slice(
              0,
              150,
            ),
          httpStatus: status,
          userAgent: ua?.slice(0, 500),
          isResolved: false,
        })
        .catch((err) => {
          // V176: elevate from warn to error so SRE dashboards page on
          // diagnostic-data loss. Include the inbound stack snippet so the
          // failure can be traced to the originating request without
          // round-tripping back to the (now broken) error_logs table.
          this.logger.error(
            `[ErrorLogPersist] failed: ${err.message} (origin=${request.method} ${request.path})`,
          );
        });
    }

    // Don't override if response already sent
    if (response.headersSent) return;

    const userFriendlyMessage = this.toUserFriendlyMessage(message);

    response.status(status).json({
      statusCode: status,
      error,
      message: Array.isArray(userFriendlyMessage)
        ? userFriendlyMessage
        : [userFriendlyMessage],
      ...(code ? { code } : {}),
      ...extra,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }

  /**
   * Expected-flow error names that should never be persisted to ErrorLog.
   * These represent user-initiated or business-rule outcomes (paywall,
   * cancellation, explicit validation failures), not operational faults.
   * Logging them pollutes the admin error dashboard and triggers false
   * alerts on legitimate cancellation paths.
   */
  private static readonly EXPECTED_ERROR_NAMES = new Set<string>([
    'PaywallError',
    'QuotaExceededError',
    'AbortError',
    'CancelledError',
    'CancelledException',
    'RequestCancelledException',
  ]);

  /**
   * Determines if an error should be logged to the database.
   * Logs:
   * - All 5xx errors (server errors) — except expected cancellation/abort
   * - 429 (rate limiting/throttler)
   * - 401/403 on sensitive endpoints (auth, admin)
   * - 400 on auth endpoints (validation failures)
   */
  private shouldLogError(status: number, path: string, error: string): boolean {
    // Never log expected-flow errors regardless of status
    if (AllExceptionsFilter.EXPECTED_ERROR_NAMES.has(error)) return false;

    // Always log 5xx errors
    if (status >= 500) return true;

    // Log rate limiting (ThrottlerException)
    if (status === 429) return true;

    // Log auth-related failures
    const authPaths = [
      '/auth/register',
      '/auth/login',
      '/auth/verify-email',
      '/auth/reset-password',
    ];
    if (authPaths.some((p) => path.includes(p))) {
      // Log auth failures (401, 403) and validation errors (400)
      if ([400, 401, 403].includes(status)) return true;
    }

    // Log admin access attempts
    if (path.includes('/admin') && [401, 403].includes(status)) return true;

    // V187 P0-A: Diagnostic infrastructure recovery.
    // V186 reported "error_logs 0건" while subscription/trip flows were failing.
    // The previous filter only logged 5xx; the actual UX-blocking failures were
    // 400/422 (DTO validation, business-rule rejection) and 401 (token expiry mid-flow).
    // Without these, all client-side regressions become invisible.
    if (path.includes('/subscription')) {
      if ([400, 401, 403, 404, 409, 422].includes(status) || status >= 500)
        return true;
    }

    // Manual trip creation, AI quota, places coordinate failures all surface as
    // 4xx but were silently dropped. Logging these closes V186 #3 black hole.
    if (path.includes('/trips')) {
      if ([400, 401, 403, 404, 409, 422].includes(status) || status >= 500)
        return true;
    }

    // Account deletion failures (FK cascade, transaction rollback) must be visible
    // to detect V186 #4 "withdraw shows complete but logout-only" regression.
    if (
      path.match(/\/users\/(me|profile)/) &&
      [400, 401, 403, 409, 500].includes(status)
    )
      return true;

    return false;
  }

  /**
   * Maps HTTP status codes to severity levels for error logs.
   * Fatal is reserved for truly catastrophic conditions (out-of-memory,
   * DB pool exhaustion); plain 5xx are error; rate-limit and 4xx are warn.
   */
  private static readonly MESSAGE_MAP: Record<string, string> = {
    // Rate limiting
    'throttlerexception: too many requests':
      '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    'too many requests': '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    // Auth
    'incorrect password': '비밀번호가 올바르지 않습니다.',
    'invalid credentials': '이메일 또는 비밀번호가 올바르지 않습니다.',
    unauthorized: '인증이 필요합니다. 다시 로그인해주세요.',
    'authentication required': '인증이 필요합니다. 다시 로그인해주세요.',
    forbidden: '접근 권한이 없습니다.',
    'admin access required': '관리자 권한이 필요합니다.',
    'user not found': '사용자를 찾을 수 없습니다.',
    'refresh token revoked': '세션이 만료되었습니다. 다시 로그인해주세요.',
    'invalid refresh token': '세션이 만료되었습니다. 다시 로그인해주세요.',
    'account has been deleted': '삭제된 계정입니다.',
    'invalid or expired oauth code':
      '소셜 로그인에 실패했습니다. 다시 시도해주세요.',
    'invalid google id token':
      'Google 로그인에 실패했습니다. 다시 시도해주세요.',
    'invalid or expired token': '유효하지 않거나 만료된 인증 정보입니다.',
    'invalid or expired resume token':
      '인증 정보가 만료되었습니다. 다시 시도해주세요.',
    'premium subscription required': '프리미엄 구독이 필요합니다.',
    // 2FA
    '2fa is already enabled': '이미 2단계 인증이 활성화되어 있습니다.',
    'setup 2fa first': '먼저 2단계 인증을 설정해주세요.',
    'invalid 2fa code': '유효하지 않은 인증 코드입니다.',
    '2fa is not enabled': '2단계 인증이 활성화되지 않았습니다.',
    // Trips
    'trip not found': '여행을 찾을 수 없습니다.',
    'itinerary not found': '일정을 찾을 수 없습니다.',
    'only the trip owner can delete this trip':
      '여행 소유자만 삭제할 수 있습니다.',
    'only the trip owner or editors can modify this trip':
      '여행 소유자 또는 편집자만 수정할 수 있습니다.',
    'cannot modify completed trips. completed trips are read-only.':
      '완료된 여행은 수정할 수 없습니다.',
    'only trip owner can add collaborators':
      '여행 소유자만 협력자를 추가할 수 있습니다.',
    'only trip owner can remove collaborators':
      '여행 소유자만 협력자를 제거할 수 있습니다.',
    'cannot add yourself as a collaborator':
      '자신을 협력자로 추가할 수 없습니다.',
    'user not found with this email':
      '해당 이메일로 사용자를 찾을 수 없습니다.',
    'collaborator not found': '협력자를 찾을 수 없습니다.',
    'you are not a collaborator of this trip': '이 여행의 협력자가 아닙니다.',
    'only trip owner can update roles':
      '여행 소유자만 역할을 변경할 수 있습니다.',
    // Expenses
    'expense not found': '경비를 찾을 수 없습니다.',
    'you do not have access to this trip': '이 여행에 접근할 수 없습니다.',
    'no split found for this user on this expense':
      '이 경비에 대한 정산 내역을 찾을 수 없습니다.',
    'this split is already settled': '이미 정산이 완료되었습니다.',
    // Social
    'cannot follow yourself': '자신을 팔로우할 수 없습니다.',
    'cannot like a private trip': '비공개 여행에 좋아요를 할 수 없습니다.',
    // Files
    'file is not a valid image': '유효하지 않은 이미지 파일입니다.',
    'image processing failed': '이미지 처리에 실패했습니다.',
    // Share
    'invalid share token format': '유효하지 않은 공유 링크입니다.',
    // General
    'an unexpected error occurred':
      '예기치 않은 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  };

  private toUserFriendlyMessage(msg: string | string[]): string | string[] {
    const convert = (s: string): string => {
      const lower = s.toLowerCase().trim();
      return AllExceptionsFilter.MESSAGE_MAP[lower] || s;
    };
    if (Array.isArray(msg)) {
      return msg.map(convert);
    }
    return convert(msg);
  }

  private getSeverity(status: number): 'error' | 'warning' | 'fatal' {
    if (status >= 500) return 'error';
    if (status === 429) return 'warning'; // Rate limiting
    return 'warning'; // Other 4xx errors
  }
}
