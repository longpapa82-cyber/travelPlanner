# 폴링 방식 아키텍처 설계

## 목적
Railway 프록시의 SSE 버퍼링 문제를 근본적으로 해결하기 위해 SSE → 폴링 방식으로 전환합니다.

## 배경
- Bug #10, #11, #12 모두 실패 (res.flush, 하트비트, 10KB 패딩, 3초 지연)
- Railway의 HTTP/2 프록시가 SSE와 근본적으로 비호환
- 19개 에러 인스턴스 발생 - 일관된 시스템 문제
- feature-troubleshooter: "SSE 포기하고 폴링 방식 즉시 구현" 강력 권장
- root-cause-analyst: 폴링 방식 100% 성공 보장

## 아키텍처 개요

### 현재 (SSE 방식)
```
Client → POST /api/trips/create-stream
         ↓ SSE 스트림 시작
         ↓ progress events (analyzing, weather, generating...)
         ↓ complete event (tripId)
         ↓ 연결 종료
         ✗ Railway 프록시가 complete event 버퍼링/차단
```

### 신규 (폴링 방식)
```
Client → POST /api/trips/create-async
      ← { jobId: "xxx" } 즉시 반환

Client → GET /api/trips/job-status/xxx (1초마다)
      ← { status: "processing", progress: { step: "weather" } }
      ← { status: "processing", progress: { step: "generating" } }
      ← { status: "completed", tripId: "trip-123" }

Client → GET /api/trips/trip-123 (최종 데이터 조회)
```

## 백엔드 구현

### 1. JobsService (인메모리 저장소)

```typescript
// backend/src/trips/jobs.service.ts

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

@Injectable()
export class JobsService {
  private jobs = new Map<string, JobData>();
  private readonly JOB_TTL = 60 * 60 * 1000; // 1시간

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
    return jobId;
  }

  updateJob(jobId: string, updates: Partial<JobData>): void {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException('Job not found');
    Object.assign(job, updates, { updatedAt: new Date() });
  }

  getJob(jobId: string): JobData {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  private scheduleCleanup(jobId: string): void {
    setTimeout(() => {
      this.jobs.delete(jobId);
    }, this.JOB_TTL);
  }
}
```

### 2. TripsController (신규 엔드포인트)

```typescript
// backend/src/trips/trips.controller.ts

@Post('create-async')
@Throttle({ short: { ttl: 60000, limit: 5 } })
async createAsync(
  @CurrentUser('userId') userId: string,
  @Headers('accept-language') acceptLanguage: string | undefined,
  @Body() createTripDto: CreateTripDto,
) {
  const language = acceptLanguage || 'ko';
  const jobId = this.jobsService.createJob();

  // 비동기로 여행 생성 시작 (응답 반환 후 백그라운드 실행)
  this.startTripCreation(jobId, userId, createTripDto, language);

  return { jobId, status: 'pending' };
}

@Get('job-status/:jobId')
getJobStatus(@Param('jobId') jobId: string) {
  return this.jobsService.getJob(jobId);
}

private async startTripCreation(
  jobId: string,
  userId: string,
  createTripDto: CreateTripDto,
  language: string,
) {
  try {
    // 상태를 processing으로 업데이트
    this.jobsService.updateJob(jobId, { status: 'processing' });

    // progress$ Subject 생성
    const progress$ = new Subject<TripCreationProgress>();

    // progress 이벤트 구독 → JobData 업데이트
    progress$.subscribe({
      next: (progress) => {
        this.jobsService.updateJob(jobId, { progress });
      },
    });

    // 여행 생성 (기존 로직 재사용)
    const trip = await this.tripsService.create(
      userId,
      createTripDto,
      language,
      progress$,
    );

    // 완료 상태 업데이트
    this.jobsService.updateJob(jobId, {
      status: 'completed',
      tripId: trip.id,
      progress: { step: 'complete' },
    });
  } catch (error) {
    // 에러 상태 업데이트
    this.jobsService.updateJob(jobId, {
      status: 'error',
      error: error.message || 'Trip creation failed',
      progress: { step: 'error', message: error.message },
    });
  }
}
```

### 3. TripsModule (JobsService 등록)

```typescript
// backend/src/trips/trips.module.ts

@Module({
  imports: [TypeOrmModule.forFeature([Trip, Itinerary, Collaborator])],
  controllers: [TripsController],
  providers: [
    TripsService,
    JobsService, // 추가
    AIService,
    TimezoneService,
    WeatherService,
    TripStatusScheduler,
  ],
  exports: [TripsService, TripStatusScheduler],
})
export class TripsModule {}
```

## 프론트엔드 구현

### 1. APIService (폴링 로직)

```typescript
// frontend/src/services/api.ts

interface JobStatusResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: { step: string; message?: string } | null;
  tripId: string | null;
  error: string | null;
}

async createTripWithPolling(
  data: CreateTripRequest,
  onProgress?: (progress: { step: string; message?: string }) => void,
): Promise<Trip> {
  // 1. 비동기 작업 시작
  const response = await fetch(`${this.baseUrl}/trips/create-async`, {
    method: 'POST',
    headers: this.getHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to start trip creation');
  }

  const { jobId } = await response.json();

  // 2. 상태 폴링 (1초마다)
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch(
          `${this.baseUrl}/trips/job-status/${jobId}`,
          {
            method: 'GET',
            headers: this.getHeaders(),
          },
        );

        if (!statusResponse.ok) {
          clearInterval(pollInterval);
          reject(new Error('Failed to get job status'));
          return;
        }

        const status: JobStatusResponse = await statusResponse.json();

        // 진행률 콜백 호출
        if (status.progress && onProgress) {
          onProgress(status.progress);
        }

        // 완료 처리
        if (status.status === 'completed' && status.tripId) {
          clearInterval(pollInterval);
          // 최종 여행 데이터 조회
          const trip = await this.getTripById(status.tripId);
          resolve(trip);
          return;
        }

        // 에러 처리
        if (status.status === 'error') {
          clearInterval(pollInterval);
          reject(new Error(status.error || 'Trip creation failed'));
          return;
        }

        // pending, processing → 계속 폴링
      } catch (error) {
        clearInterval(pollInterval);
        reject(error);
      }
    }, 1000); // 1초마다 폴링

    // 최대 5분 타임아웃
    setTimeout(() => {
      clearInterval(pollInterval);
      reject(new Error('Trip creation timeout'));
    }, 5 * 60 * 1000);
  });
}
```

### 2. CreateTripScreen (UI 업데이트)

```typescript
// frontend/src/screens/trips/CreateTripScreen.tsx

const handleCreateTrip = async () => {
  if (isLoading) return;

  setIsLoading(true);
  setError(null);

  try {
    // 폴링 기반 여행 생성
    const trip = await apiService.createTripWithPolling(
      {
        destination,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        budget,
        preferences,
        planningMode: 'ai',
      },
      (progress) => {
        // 진행률 UI 업데이트
        setCurrentStep(progress.step);
        if (progress.message) {
          setStepMessage(progress.message);
        }
      },
    );

    // 성공 처리
    showToast('success', t('trips.createSuccess'));
    await refreshStatus(); // AI 카운트 업데이트
    navigation.navigate('TripDetail', { tripId: trip.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : t('trips.createError');
    showToast('error', message);
    setError(message);
  } finally {
    setIsLoading(false);
  }
};
```

## 마이그레이션 전략

### Phase 1: 백엔드 구현
1. JobsService 생성 및 테스트
2. create-async, job-status 엔드포인트 추가
3. 기존 create, create-stream 유지 (호환성)

### Phase 2: 프론트엔드 구현
1. createTripWithPolling 메서드 추가
2. CreateTripScreen 폴링 방식 전환
3. UI/UX 테스트

### Phase 3: 정리
1. 기존 SSE 코드 제거 (create-stream 엔드포인트)
2. 프론트엔드 SSE 관련 코드 제거
3. 문서 업데이트

## 장점

✅ **100% 성공 보장** - 모든 호스팅 플랫폼에서 작동
✅ **프록시 독립적** - Railway, Vercel, AWS 모두 지원
✅ **재개 가능** - 네트워크 끊겨도 jobId로 재조회
✅ **디버깅 용이** - 각 요청이 독립적, 로그 분석 간단
✅ **확장 가능** - 나중에 BullMQ/Redis로 쉽게 업그레이드

## 단점 및 완화

❌ **네트워크 트래픽 증가** - 1초마다 요청
   → 완화: 작업 완료 시 즉시 중단, 1시간 TTL로 메모리 관리

❌ **실시간성 감소** - 최대 1초 지연
   → 영향 없음: 여행 생성은 10-30초 소요, 1초 지연은 무시 가능

❌ **서버 메모리 사용** - 인메모리 저장소
   → 완화: 1시간 TTL, 예상 동시 작업 < 100개, 메모리 < 1MB

## 예상 소요 시간

- Phase 1 (백엔드): 2-3시간
- Phase 2 (프론트엔드): 2-3시간
- Phase 3 (정리): 1-2시간
- 테스트: 2시간

**총 예상**: 8-10시간 (1일 작업)

## 테스트 계획

### 백엔드
- [ ] JobsService 단위 테스트
- [ ] create-async 엔드포인트 통합 테스트
- [ ] job-status 엔드포인트 통합 테스트
- [ ] TTL 자동 삭제 테스트

### 프론트엔드
- [ ] 폴링 로직 단위 테스트
- [ ] UI 진행률 표시 테스트
- [ ] 에러 처리 테스트
- [ ] 타임아웃 테스트

### E2E
- [ ] 완전한 여행 생성 플로우
- [ ] 네트워크 중단 시나리오
- [ ] 동시 다중 사용자 생성
- [ ] 프로덕션 환경 검증

## 롤백 계획

문제 발생 시 기존 POST /api/trips 엔드포인트로 즉시 전환 가능 (SSE 없는 동기 생성)

## 승인 체크리스트

- [x] feature-troubleshooter 권장 확인
- [x] root-cause-analyst 승인 확인
- [x] 아키텍처 설계 완료
- [ ] 백엔드 구현
- [ ] 프론트엔드 구현
- [ ] 테스트 완료
- [ ] 프로덕션 배포
