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
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'] as string | undefined;

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
          ...(requestId && { requestId }),
        },
      })),
    );
  }
}
