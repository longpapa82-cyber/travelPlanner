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
      const exception = new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Too Many Requests',
          severity: 'warning',
          platform: 'web',
          screen: 'POST /api/auth/register',
        })
      );
    });

    it('should log 401 errors on auth endpoints', () => {
      const exception = new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      mockRequest.path = '/api/auth/login';

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Unauthorized',
          severity: 'warning',
        })
      );
    });

    it('should log 400 validation errors on auth endpoints', () => {
      const exception = new HttpException(
        { message: ['Email is required', 'Password is too short'] },
        HttpStatus.BAD_REQUEST
      );

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Email is required; Password is too short',
          severity: 'warning',
        })
      );
    });

    it('should NOT log 404 errors on non-sensitive endpoints', () => {
      const exception = new HttpException('Not Found', HttpStatus.NOT_FOUND);
      mockRequest.path = '/api/trips/123';

      filter.catch(exception, mockHost);

      expect(mockRepository.save).not.toHaveBeenCalled();
    });

    it('should always log 5xx errors', () => {
      const exception = new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
      mockRequest.path = '/api/anything';

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Internal Server Error',
          severity: 'error',
        })
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
        })
      );
    });

    it('should log subscription/payment errors', () => {
      const exception = new HttpException('Payment Required', HttpStatus.PAYMENT_REQUIRED);
      mockRequest.path = '/api/subscription/checkout';

      filter.catch(exception, mockHost);

      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          errorMessage: 'Payment Required',
          severity: 'warning',
        })
      );
    });
  });

  describe('rate limiting', () => {
    it('should respect rate limiting for error logs', async () => {
      // Set limit to a small number for testing
      (AllExceptionsFilter as any).MAX_ERROR_LOGS_PER_MINUTE = 2;

      const exception = new HttpException('Server Error', HttpStatus.INTERNAL_SERVER_ERROR);

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
      const exception = new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 429,
        error: 'HttpException',
        message: ['Too Many Requests'],
        timestamp: expect.any(String),
        path: '/api/auth/register',
      });
    });
  });
});