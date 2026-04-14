import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { JobsService } from './jobs.service';

describe('JobsService', () => {
  let service: JobsService;

  beforeEach(() => {
    // JobsService schedules a 1h setTimeout per created job for cleanup.
    // Fake timers prevent those handles from leaking and holding Jest open.
    jest.useFakeTimers();
    service = new JobsService();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('createJob', () => {
    it('returns a hex jobId and starts in pending status', () => {
      const jobId = service.createJob('user-1');
      expect(jobId).toMatch(/^[0-9a-f]{32}$/);

      const job = service.getJob(jobId);
      expect(job.status).toBe('pending');
      expect(job.userId).toBe('user-1');
      expect(job.abortController).toBeNull();
    });

    it('creates distinct ids for each call', () => {
      const a = service.createJob('user-1');
      const b = service.createJob('user-1');
      expect(a).not.toBe(b);
    });
  });

  describe('attachAbortController', () => {
    it('stores the controller on the job', () => {
      const jobId = service.createJob('user-1');
      const controller = new AbortController();
      service.attachAbortController(jobId, controller);
      expect(service.getJob(jobId).abortController).toBe(controller);
    });

    it('is a no-op for unknown jobIds (does not throw)', () => {
      expect(() =>
        service.attachAbortController('nope', new AbortController()),
      ).not.toThrow();
    });
  });

  describe('cancelJob', () => {
    it('aborts the controller and flips status to cancelled', () => {
      const jobId = service.createJob('user-1');
      const controller = new AbortController();
      service.attachAbortController(jobId, controller);
      service.updateJob(jobId, { status: 'processing' });

      service.cancelJob(jobId, 'user-1');

      expect(controller.signal.aborted).toBe(true);
      const job = service.getJob(jobId);
      expect(job.status).toBe('cancelled');
      expect(job.error).toBe('Cancelled by user');
      expect(job.progress).toEqual({ step: 'cancelled' });
    });

    it('rejects cross-user cancellation with ForbiddenException', () => {
      const jobId = service.createJob('user-owner');
      const controller = new AbortController();
      service.attachAbortController(jobId, controller);

      expect(() => service.cancelJob(jobId, 'user-attacker')).toThrow(
        ForbiddenException,
      );
      expect(controller.signal.aborted).toBe(false);
      expect(service.getJob(jobId).status).toBe('pending');
    });

    it('throws NotFoundException for unknown jobIds', () => {
      expect(() => service.cancelJob('does-not-exist', 'user-1')).toThrow(
        NotFoundException,
      );
    });

    it('is idempotent on already-cancelled jobs', () => {
      const jobId = service.createJob('user-1');
      const controller = new AbortController();
      service.attachAbortController(jobId, controller);

      service.cancelJob(jobId, 'user-1');
      expect(controller.signal.aborted).toBe(true);

      // Second cancel should be a no-op and must not throw.
      expect(() => service.cancelJob(jobId, 'user-1')).not.toThrow();
      expect(service.getJob(jobId).status).toBe('cancelled');
    });

    it('does not overwrite terminal completed/error status', () => {
      const completedId = service.createJob('user-1');
      service.updateJob(completedId, {
        status: 'completed',
        tripId: 'trip-abc',
      });
      service.cancelJob(completedId, 'user-1');
      expect(service.getJob(completedId).status).toBe('completed');

      const erroredId = service.createJob('user-1');
      service.updateJob(erroredId, { status: 'error', error: 'boom' });
      service.cancelJob(erroredId, 'user-1');
      expect(service.getJob(erroredId).status).toBe('error');
    });

    it('handles a job with no attached abort controller', () => {
      const jobId = service.createJob('user-1');
      // No attachAbortController call — controller is null.
      expect(() => service.cancelJob(jobId, 'user-1')).not.toThrow();
      expect(service.getJob(jobId).status).toBe('cancelled');
    });
  });
});
