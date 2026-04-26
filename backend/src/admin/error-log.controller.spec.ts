/**
 * V187 P1-A — error_logs ingestion smoke test.
 *
 * Pins the V187 P0-A intent: the frontend's reportError pipeline must
 * NOT silently drop. V186 reported "오류 로그 0건" (zero rows) while users
 * were experiencing payment failures and trip-creation failures, which
 * meant every other fix's effectiveness was unmeasurable.
 *
 * The two failure modes V187 closed:
 *
 *   1. The IGNORED_PATTERNS list contained 'network error', 'timeout of',
 *      'authentication required', and other patterns that masked real
 *      signals. V187 pruned these to only legitimate business-rule noise
 *      (paywall/quota/cancellation).
 *
 *   2. The frontend api.ts catch block was `.catch(() => {})` — a silent
 *      fire-and-forget. V187 added an AsyncStorage queue + console warn
 *      so failed reports persist for the next online drain instead of
 *      evaporating.
 *
 * This test pins #1 — the server-side filter contract. The frontend
 * queue is exercised in the existing api.test.ts integration suite.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ErrorLogController } from './admin.controller';
import { AdminService } from './admin.service';

describe('ErrorLogController — V187 P1-A ingestion smoke', () => {
  let controller: ErrorLogController;
  let adminService: { createErrorLog: jest.Mock };

  beforeEach(async () => {
    adminService = { createErrorLog: jest.fn().mockResolvedValue({ id: 'log-1' }) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ErrorLogController],
      providers: [{ provide: AdminService, useValue: adminService }],
    }).compile();
    controller = module.get(ErrorLogController);
  });

  const buildReq = () => ({
    user: { userId: 'user-1', email: 'test@example.com' },
    headers: { 'user-agent': 'Mozilla/5.0 (iPhone)' },
  });

  // V187 P0-A: these legacy IGNORED_PATTERNS are gone. Asserting they
  // now persist proves the silent-drop window is closed.
  it.each([
    'Network error: timeout',
    'timeout of 10000ms exceeded',
    'API 504 Gateway Timeout',
    'authentication required',
    'invalid credentials',
    'ThrottlerException: Too Many Requests',
  ])(
    'persists previously-dropped pattern: %s',
    async (errorMessage) => {
      await controller.createErrorLog(buildReq() as any, {
        errorMessage,
        screen: '/api/subscription/preflight',
        severity: 'warning',
      } as any);
      expect(adminService.createErrorLog).toHaveBeenCalledWith(
        expect.objectContaining({ errorMessage }),
      );
    },
  );

  // The remaining true business-rule outcomes still filter out — they
  // are noise (user-initiated cancel, AI quota), not signals.
  it.each([
    'Monthly AI generation limit reached',
    'PaywallError: insufficient quota',
    'AbortError: trip creation cancelled',
    'request cancelled by user',
  ])(
    'still filters legitimate noise pattern: %s',
    async (errorMessage) => {
      const result = await controller.createErrorLog(buildReq() as any, {
        errorMessage,
        screen: '/some/screen',
      } as any);
      expect(result).toEqual({ filtered: true });
      expect(adminService.createErrorLog).not.toHaveBeenCalled();
    },
  );

  it('forwards V174 expanded payload (errorName, routeName, breadcrumbs, httpStatus, deviceModel)', async () => {
    await controller.createErrorLog(buildReq() as any, {
      errorMessage: 'Subscription preflight failed',
      severity: 'error',
      errorName: 'SubscriptionError',
      routeName: 'PaywallModal',
      breadcrumbs: [{ category: 'subscription', message: 'paywall.preflight' }],
      httpStatus: 500,
      deviceModel: 'iPhone 15',
    } as any);

    expect(adminService.createErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        errorName: 'SubscriptionError',
        routeName: 'PaywallModal',
        breadcrumbs: [{ category: 'subscription', message: 'paywall.preflight' }],
        httpStatus: 500,
        deviceModel: 'iPhone 15',
        userId: 'user-1',
        userEmail: 'test@example.com',
      }),
    );
  });
});
