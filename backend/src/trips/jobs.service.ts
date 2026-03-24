import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { TripCreationProgress } from './trips.service';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface JobData {
  jobId: string;
  status: JobStatus;
  progress: TripCreationProgress | null;
  tripId: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
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
   * 새 작업 생성
   * @returns jobId - 생성된 작업 ID
   */
  createJob(): string {
    const jobId = randomBytes(16).toString('hex');
    const job: JobData = {
      jobId,
      status: 'pending',
      progress: null,
      tripId: null,
      error: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.jobs.set(jobId, job);
    this.scheduleCleanup(jobId);

    this.logger.log(`Job created: ${jobId}`);
    return jobId;
  }

  /**
   * 작업 상태 업데이트
   * @param jobId - 작업 ID
   * @param updates - 업데이트할 필드
   */
  updateJob(jobId: string, updates: Partial<Omit<JobData, 'jobId' | 'createdAt'>>): void {
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
          updates.status === 'completed' ? `tripId=${updates.tripId}` : `error=${updates.error}`
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
