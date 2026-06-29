import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ErrorLog } from '../../admin/entities/error-log.entity';

/**
 * Centralized error-log persistence.
 *
 * Background: error_logs rows were only ever written by AllExceptionsFilter,
 * which sees HTTP request/response exceptions exclusively. Anything outside a
 * request context — process-level crashes (uncaughtException/unhandledRejection),
 * scheduled cron jobs, async AI generation that outlives its request, webhook
 * internals, push delivery — could fail with nothing but a syslog line, leaving
 * the admin error dashboard blind (the recurring "error_logs 0건 while users
 * fail" black hole). This service gives every code path one consistent way to
 * land a row in error_logs.
 *
 * The core writer is a plain function (`persistErrorLog`) so callers without a
 * DI context (the exception filter, which receives DataSource via a setter, and
 * the process-level handlers wired in main.ts) can use the exact same path as
 * DI-injected callers (cron, services) going through ErrorLogService.
 */

export interface ErrorLogContext {
  error: unknown;
  /** Logical source, stored in `screen` (e.g. "Cron tripStatusUpdate"). */
  source: string;
  severity?: 'error' | 'warning' | 'fatal';
  userId?: string;
  userEmail?: string;
  /** Stored in `routeName` for grouping (e.g. "cron:trip-status"). */
  routeName?: string;
  httpStatus?: number;
  platform?: 'web' | 'ios' | 'android';
}

function extractMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

/**
 * Persist a single error_logs row. Best-effort and never throws — a failure to
 * record diagnostics must not cascade into the caller's flow. Returns true on
 * success so callers/tests can assert behavior.
 */
export async function persistErrorLog(
  dataSource: DataSource | undefined,
  ctx: ErrorLogContext,
): Promise<boolean> {
  if (!dataSource?.isInitialized) return false;
  try {
    const err = ctx.error;
    await dataSource.getRepository(ErrorLog).save({
      userId: ctx.userId,
      userEmail: ctx.userEmail,
      errorMessage: extractMessage(err).slice(0, 500),
      errorName: err instanceof Error ? err.name?.slice(0, 100) : undefined,
      stackTrace: err instanceof Error ? err.stack : undefined,
      severity: ctx.severity ?? 'error',
      platform: ctx.platform,
      screen: ctx.source.slice(0, 200),
      routeName: (ctx.routeName ?? ctx.source).slice(0, 150),
      httpStatus: ctx.httpStatus,
      isResolved: false,
    });
    return true;
  } catch {
    // Swallow: diagnostics persistence must never break the caller. The
    // failure is surfaced via the static logger so it is at least in syslog.
    persistErrorLog.logger.error(
      `[ErrorLogPersist] failed to record error from ${ctx.source}`,
    );
    return false;
  }
}
persistErrorLog.logger = new Logger('ErrorLogPersist');

@Injectable()
export class ErrorLogService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Record an error to error_logs. Best-effort, never throws. Use from any
   * background/non-HTTP path (cron, async jobs, webhook internals, push).
   */
  async record(ctx: ErrorLogContext): Promise<boolean> {
    return persistErrorLog(this.dataSource, ctx);
  }
}

@Global()
@Module({
  providers: [ErrorLogService],
  exports: [ErrorLogService],
})
export class ErrorLogModule {}
