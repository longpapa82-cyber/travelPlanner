import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { TripCreationProgress } from './trips.service';

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'error'
  | 'cancelled';

export interface JobData {
  jobId: string;
  status: JobStatus;
  progress: TripCreationProgress | null;
  tripId: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  // V112 fix #4: owner and abort controller for user-initiated cancel.
  // `userId` is set on createJob and checked in cancelJob to stop one user
  // from killing another user's job. `abortController` is set by
  // startTripCreation after it wires the controller into tripsService.create().
  userId: string | null;
  abortController: AbortController | null;
}

/**
 * JobsService - 인메모리 작업 저장소
 *
 * SSE의 Railway 프록시 버퍼링 문제를 해결하기 위해 폴링 방식 사용.
 * 비동기 여행 생성 작업의 상태를 추적하고 클라이언트가 폴링할 수 있도록 제공.
 *
 * 특징:
 * - 인메모리 저장 (Redis 불필요)
 * - 1시간 TTL 자동 정리
 * - 간단하고 빠른 구현
 * - 나중에 BullMQ/Redis로 쉽게 업그레이드 가능
 */
@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private jobs = new Map<string, JobData>();

  // 작업 TTL: 1시간 후 자동 삭제
  private readonly JOB_TTL = 60 * 60 * 1000;

  /**
   * Create a new job owned by `userId`. The owner is used later by
   * `cancelJob` to reject cross-user cancellation attempts.
   */
  createJob(userId: string): string {
    const jobId = randomBytes(16).toString('hex');
    const job: JobData = {
      jobId,
      status: 'pending',
      progress: null,
      tripId: null,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId,
      abortController: null,
    };

    this.jobs.set(jobId, job);
    this.scheduleCleanup(jobId);

    this.logger.log(`Job created: ${jobId} (user ${userId})`);
    return jobId;
  }

  /**
   * Attach an AbortController to an existing job so it can be cancelled later.
   * Called by `startTripCreation` once the controller has been wired into
   * tripsService.create(). Separated from createJob because the controller
   * only exists in the worker path, not in the controller entry.
   */
  attachAbortController(jobId: string, controller: AbortController): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    job.abortController = controller;
  }

  /**
   * Cancel a running job.
   *
   * Contract:
   * - Returns silently if the job already finished (completed/error/cancelled).
   *   This keeps cancellation idempotent — a retried DELETE should not 500.
   * - Throws `NotFoundException` if the jobId is unknown.
   * - Throws `ForbiddenException` if the caller is not the owner.
   * - Otherwise: calls `abortController.abort()` (which propagates to OpenAI
   *   SDK + the DB transaction catch path) and flips status to 'cancelled'.
   */
  cancelJob(jobId: string, userId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new NotFoundException(`Job not found: ${jobId}`);
    }
    if (job.userId && job.userId !== userId) {
      this.logger.warn(
        `User ${userId} attempted to cancel job ${jobId} owned by ${job.userId}`,
      );
      throw new ForbiddenException('Cannot cancel another user’s job');
    }

    // Idempotent: no-op on terminal states.
    if (
      job.status === 'completed' ||
      job.status === 'error' ||
      job.status === 'cancelled'
    ) {
      return;
    }

    if (job.abortController && !job.abortController.signal.aborted) {
      job.abortController.abort();
    }

    job.status = 'cancelled';
    job.error = 'Cancelled by user';
    job.progress = { step: 'cancelled' };
    job.updatedAt = new Date();

    this.logger.log(`Job ${jobId} cancelled by user ${userId}`);
  }

  /**
   * 작업 상태 업데이트
   * @param jobId - 작업 ID
   * @param updates - 업데이트할 필드
   */
  updateJob(
    jobId: string,
    updates: Partial<Omit<JobData, 'jobId' | 'createdAt'>>,
  ): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.logger.warn(`Job not found for update: ${jobId}`);
      throw new NotFoundException(`Job not found: ${jobId}`);
    }

    Object.assign(job, updates, { updatedAt: new Date() });

    // 로그 레벨 조정: completed/error만 로그
    if (updates.status === 'completed' || updates.status === 'error') {
      this.logger.log(
        `Job ${jobId} ${updates.status}: ${
          updates.status === 'completed'
            ? `tripId=${updates.tripId}`
            : `error=${updates.error}`
        }`,
      );
    }
  }

  /**
   * 작업 조회
   * @param jobId - 작업 ID
   * @returns JobData - 작업 데이터
   */
  getJob(jobId: string): JobData {
    const job = this.jobs.get(jobId);
    if (!job) {
      this.logger.warn(`Job not found: ${jobId}`);
      throw new NotFoundException(`Job not found: ${jobId}`);
    }
    return job;
  }

  /**
   * 작업 TTL 후 자동 삭제 스케줄링
   * @param jobId - 작업 ID
   */
  private scheduleCleanup(jobId: string): void {
    setTimeout(() => {
      const deleted = this.jobs.delete(jobId);
      if (deleted) {
        this.logger.log(`Job cleaned up after TTL: ${jobId}`);
      }
    }, this.JOB_TTL);
  }

  /**
   * 현재 활성 작업 수 (디버깅/모니터링용)
   */
  getActiveJobsCount(): number {
    return this.jobs.size;
  }

  /**
   * 모든 작업 조회 (디버깅/관리자용)
   */
  getAllJobs(): JobData[] {
    return Array.from(this.jobs.values());
  }
}
