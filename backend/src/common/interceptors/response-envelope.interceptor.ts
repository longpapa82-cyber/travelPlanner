import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface EnvelopeResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Wraps all successful responses in a consistent envelope:
 * { data: <payload>, meta: { timestamp, requestId } }
 *
 * Error responses are already enveloped by AllExceptionsFilter.
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<
  T,
  EnvelopeResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<EnvelopeResponse<T>> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const requestId = request.headers['x-request-id'] as string | undefined;

    const response = context
      .switchToHttp()
      .getResponse<{ headersSent: boolean }>();

    return next.handle().pipe(
      map((data: T) => {
        // Skip envelope for handlers using @Res() that already sent the response
        if (response.headersSent) return data as unknown as EnvelopeResponse<T>;

        return {
          data,
          meta: {
            timestamp: new Date().toISOString(),
            ...(requestId && { requestId }),
          },
        };
      }),
    );
  }
}
