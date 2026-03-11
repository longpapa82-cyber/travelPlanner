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

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as { message?: string | string[] }).message ||
            exception.message;
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

    // Persist 5xx errors to ErrorLog (fire-and-forget, rate-limited)
    const now = Date.now();
    if (now - this.errorLogWindowStart > 60_000) {
      this.errorLogCount = 0;
      this.errorLogWindowStart = now;
    }
    if (status >= 500 && this.dataSource?.isInitialized && this.errorLogCount < AllExceptionsFilter.MAX_ERROR_LOGS_PER_MINUTE) {
      this.errorLogCount++;
      const errorMessage =
        exception instanceof Error
          ? exception.message
          : typeof message === 'string'
            ? message
            : Array.isArray(message)
              ? message.join('; ')
              : 'Unknown error';

      this.dataSource
        .getRepository(ErrorLog)
        .save({
          errorMessage: errorMessage.slice(0, 500),
          stackTrace:
            exception instanceof Error ? exception.stack : undefined,
          severity: status >= 500 ? 'error' : 'warning',
          platform: 'web',
          screen: `${request.method} ${request.path}`.slice(0, 200),
          userAgent: request.headers['user-agent']?.slice(0, 500),
          isResolved: false,
        })
        .catch((err) => {
          this.logger.warn(`Failed to persist error log: ${err.message}`);
        });
    }

    // Don't override if response already sent
    if (response.headersSent) return;

    response.status(status).json({
      statusCode: status,
      error,
      message: Array.isArray(message) ? message : [message],
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
