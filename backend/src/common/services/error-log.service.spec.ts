import { persistErrorLog, ErrorLogService } from './error-log.service';
import { DataSource } from 'typeorm';

describe('persistErrorLog', () => {
  const makeDataSource = (saveImpl: jest.Mock, initialized = true) =>
    ({
      isInitialized: initialized,
      getRepository: jest.fn().mockReturnValue({ save: saveImpl }),
    }) as unknown as DataSource;

  it('returns false when dataSource is undefined', async () => {
    const ok = await persistErrorLog(undefined, {
      error: new Error('x'),
      source: 'test',
    });
    expect(ok).toBe(false);
  });

  it('returns false when dataSource is not initialized', async () => {
    const save = jest.fn();
    const ok = await persistErrorLog(makeDataSource(save, false), {
      error: new Error('x'),
      source: 'test',
    });
    expect(ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('persists an Error with name/message/stack and defaults severity to error', async () => {
    const save = jest.fn().mockResolvedValue({});
    const err = new TypeError('boom');
    const ok = await persistErrorLog(makeDataSource(save), {
      error: err,
      source: 'Cron test',
      routeName: 'cron:test',
      userId: 'u1',
    });
    expect(ok).toBe(true);
    const saved = save.mock.calls[0][0];
    expect(saved.errorName).toBe('TypeError');
    expect(saved.errorMessage).toBe('boom');
    expect(saved.stackTrace).toBeDefined();
    expect(saved.severity).toBe('error');
    expect(saved.screen).toBe('Cron test');
    expect(saved.routeName).toBe('cron:test');
    expect(saved.userId).toBe('u1');
    expect(saved.isResolved).toBe(false);
  });

  it('honors an explicit severity (fatal)', async () => {
    const save = jest.fn().mockResolvedValue({});
    await persistErrorLog(makeDataSource(save), {
      error: new Error('x'),
      source: 'process.uncaughtException',
      severity: 'fatal',
    });
    expect(save.mock.calls[0][0].severity).toBe('fatal');
  });

  it('handles non-Error values (string) without throwing', async () => {
    const save = jest.fn().mockResolvedValue({});
    const ok = await persistErrorLog(makeDataSource(save), {
      error: 'plain string failure',
      source: 'test',
    });
    expect(ok).toBe(true);
    expect(save.mock.calls[0][0].errorMessage).toBe('plain string failure');
    expect(save.mock.calls[0][0].errorName).toBeUndefined();
  });

  it('never throws when the underlying save fails (best-effort)', async () => {
    const save = jest.fn().mockRejectedValue(new Error('db down'));
    const ok = await persistErrorLog(makeDataSource(save), {
      error: new Error('x'),
      source: 'test',
    });
    expect(ok).toBe(false);
  });

  it('truncates oversized message/screen/routeName to column limits', async () => {
    const save = jest.fn().mockResolvedValue({});
    await persistErrorLog(makeDataSource(save), {
      error: new Error('m'.repeat(900)),
      source: 's'.repeat(300),
      routeName: 'r'.repeat(300),
    });
    const saved = save.mock.calls[0][0];
    expect(saved.errorMessage.length).toBe(500);
    expect(saved.screen.length).toBe(200);
    expect(saved.routeName.length).toBe(150);
  });
});

describe('ErrorLogService', () => {
  it('delegates to persistErrorLog via the injected dataSource', async () => {
    const save = jest.fn().mockResolvedValue({});
    const ds = {
      isInitialized: true,
      getRepository: jest.fn().mockReturnValue({ save }),
    } as unknown as DataSource;
    const service = new ErrorLogService(ds);
    const ok = await service.record({ error: new Error('x'), source: 'svc' });
    expect(ok).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
  });
});
