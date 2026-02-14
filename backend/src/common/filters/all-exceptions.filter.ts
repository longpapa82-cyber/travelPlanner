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

/**
 * Global exception filter that:
 * - Converts unhandled exceptions to consistent JSON responses
 * - Reports 5xx errors and unknown exceptions to Sentry
 * - Logs all errors with request context
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
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
