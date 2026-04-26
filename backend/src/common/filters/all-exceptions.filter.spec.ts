import { Test } from '@nestjs/testing';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { DataSource } from 'typeorm';
import { ErrorLog } from '../../admin/entities/error-log.entity';
import * as Sentry from '@sentry/nestjs';

// Mock Sentry
jest.mock('@sentry/nestjs', () => ({
  captureException: jest.fn(),
}));

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockDataSource: jest.Mocked<DataSource>;
  let mockRepository: any;
  let mockHost: ArgumentsHost;
  let mockResponse: any;
  let mockRequest: any;

  beforeEach(() => {
    // Setup mocks
    mockRepository = {
      save: jest.fn().mockResolvedValue({}),
    };

    mockDataSource = {
      isInitialized: true,
      getRepository: jest.fn().mockReturnValue(mockRepository),
    } as any;

    mockRequest = {
      url: '/api/auth/register',
      path: '/api/auth/register',
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0',
      },
    };

    mockResponse = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;

    // Mock HttpAdapterHost properly for BaseExceptionFilter
    const mockHttpAdapter = {
      reply: jest.fn(),
      getRequestUrl: jest.fn().mockReturnValue('/test'),
    };

    const httpAdapterHost = {
      httpAdapter: mockHttpAdapter,
    };

    filter = new AllExceptionsFilter(httpAdapterHost as any);
    filter.setDataSource(mockDataSource);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('shouldLogError', () => {
    it('should log ThrottlerException (429)', () => {
      const exception = new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Too Many Requests',
          severity: 'warning',
          platform: 'web',
          screen: 'POST /api/auth/register',
        }),
      );
    });

    it('should log 401 errors on auth endpoints', () => {
      const exception = new HttpException(
        'Unauthorized',
        HttpStatus.UNAUTHORIZED,
      );
      mockRequest.path = '/api/auth/login';

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Unauthorized',
          severity: 'warning',
        }),
      );
    });

    it('should log 400 validation errors on auth endpoints', () => {
      const exception = new HttpException(
        { message: ['Email is required', 'Password is too short'] },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Email is required; Password is too short',
          severity: 'warning',
        }),
      );
    });

    it('should NOT log 404 errors on truly non-sensitive endpoints', () => {
      // V187 P0-A: /trips and /subscription 4xx are now logged (V186 #3
      // RCA — manual trip failures were silently dropped, producing the
      // "0 error_logs while users report failures" pattern). Use a path
      // that intentionally has no diagnostic value.
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);
      mockRequest.path = '/api/announcements/abc';

      filter.catch(exception, mockHost);

      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    // V187 P0-A: trip / subscription / users-me 4xx must reach error_logs.
    // The previous behavior masked V186's "구독 결제 오류 + 오류 로그 0건"
    // and "수동 여행 생성 실패 + 오류 로그 0건" symptoms.
    it('should log 4xx errors on /trips paths (V187 P0-A)', () => {
      const exception = new HttpException(
        'Validation failed',
        HttpStatus.BAD_REQUEST,
      );
      mockRequest.path = '/api/trips/create-async';

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should log 4xx errors on /subscription paths (V187 P0-A)', () => {
      const exception = new HttpException(
        'already_subscribed',
        HttpStatus.CONFLICT,
      );
      mockRequest.path = '/api/subscription/preflight';

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should always log 5xx errors', () => {
      const exception = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockRequest.path = '/api/anything';

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Internal Server Error',
          severity: 'error',
        }),
      );
      expect(Sentry.captureException).toHaveBeenCalled();
    });

    it('should log admin access attempts (403)', () => {
      const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);
      mockRequest.path = '/api/admin/dashboard';

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Forbidden',
          severity: 'warning',
          screen: 'POST /api/admin/dashboard',
        }),
      );
    });

    it('does NOT log 4xx subscription/paywall errors (V112 Wave 1 policy)', () => {
      // 402/403/400 on /subscription are business rules (paywall, quota).
      // They pollute error_logs and swamp real problems, so the filter only
      // records /subscription failures when they are 5xx server faults.
      const exception = new HttpException(
        'Payment Required',
        HttpStatus.PAYMENT_REQUIRED,
      );
      mockRequest.path = '/api/subscription/checkout';

      filter.catch(exception, mockHost);

      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('logs 5xx subscription errors (real server faults)', () => {
      const exception = new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      mockRequest.path = '/api/subscription/checkout';

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Internal Server Error',
          severity: 'error',
        }),
      );
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limiting for error logs', async () => {
      // Set limit to a small number for testing
      (AllExceptionsFilter as any).MAX_ERROR_LOGS_PER_MINUTE = 2;

      const exception = new HttpException(
        'Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );

      // First two should be logged
      filter.catch(exception, mockHost);
      filter.catch(exception, mockHost);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);

      // Third should be rate limited
      filter.catch(exception, mockHost);
      expect(mockRepository.save).toHaveBeenCalledTimes(2);
    });
  });

  describe('response formatting', () => {
    it('should format error response correctly', () => {
      const exception = new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 429,
        error: 'HttpException',
        message: ['요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'],
        timestamp: expect.any(String),
        path: '/api/auth/register',
      });
    });
  });
});
