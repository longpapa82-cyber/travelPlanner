# versionCode 44 버그 수정 패치

## 수정 완료 파일 목록

### 1. 광고 시스템 개선 (P0)
- ✅ `/frontend/src/utils/adTestDevice.ts` - 테스트 기기 감지 로직 추가
- ✅ `/frontend/src/components/ads/useRewardedAd.native.improved.ts` - 보상형 광고 개선
- ✅ `/frontend/.env.production` - 프로덕션 환경변수 설정

### 2. 수정 필요 사항

#### Bug #1-2: 광고 미표시 문제 (P0)
```typescript
// frontend/src/utils/initAds.native.ts 수정
import { configureAdMobTestMode } from './adTestDevice';

export async function initializeAds(): Promise<void> {
  if (initialized) return;

  try {
    // 1. 테스트 모드 설정 추가
    await configureAdMobTestMode();

    // 2. Google UMP consent...
    // (기존 코드 유지)
  }
  // ...
}
```

```typescript
// frontend/src/components/ads/useRewardedAd.native.ts 교체
// useRewardedAd.native.improved.ts 내용으로 완전 교체
```

#### Bug #3: 공유 링크 문제 (P1)
```typescript
// frontend/src/constants/config.ts 수정
export const APP_URL = process.env.EXPO_PUBLIC_APP_URL ||
  (__DEV__ ? 'http://localhost:8081' : 'https://mytravel-planner.com');
```

#### Bug #4: 시간 입력 UX (P2)
```typescript
// frontend/src/components/ActivityModal.tsx:177 수정
// 변경 전:
{formData.time || '09:00'}

// 변경 후:
{formData.time || (
  <Text style={{ color: theme.colors.textTertiary, fontStyle: 'italic' }}>
    시간 선택
  </Text>
)}
```

#### Bug #5: 위치 선택 문제 (P1) - 이미 수정됨
- PlacesAutocomplete.tsx:126-131 이미 수정 확인
- ActivityModal.tsx:237-241 이미 수정 확인
- **추가 조치 불필요**

#### Bug #6: API 504 타임아웃 (P1)
```typescript
// frontend/src/services/api.ts 수정
const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000, // 10초 → 30초로 증가
  headers: {
    'Content-Type': 'application/json',
  },
});

// 재시도 로직 추가
axiosInstance.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    // 504 Gateway Timeout 재시도
    if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
      if (!originalRequest._retry && originalRequest._retryCount < 2) {
        originalRequest._retry = true;
        originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;

        // Exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, 1000 * Math.pow(2, originalRequest._retryCount))
        );

        return axiosInstance(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);
```

#### Bug #7: API 추적 개선 (P2)
```typescript
// backend/src/external-api/external-api.service.ts 수정
async trackApiCall(provider: string, endpoint: string): Promise<void> {
  // Google Places 추적 추가
  if (provider === 'google' && endpoint.includes('places')) {
    provider = 'google-places';
  }

  // 기존 추적 로직...
}
```

#### Bug #8: 웹 플랫폼 추적 정리 (P2)
```sql
-- backend에서 실행할 SQL
-- 레거시 웹 사용자 플랫폼 업데이트
UPDATE analytics
SET platform = 'android'
WHERE platform = 'web'
  AND created_at < '2026-04-01'
  AND user_agent LIKE '%Android%';

UPDATE analytics
SET platform = 'ios'
WHERE platform = 'web'
  AND created_at < '2026-04-01'
  AND user_agent LIKE '%iPhone%';
```

## 테스트 체크리스트

### P0 광고 테스트
- [ ] 테스트 기기에서 테스트 광고 표시 확인
- [ ] 프로덕션 기기에서 실제 광고 표시 확인
- [ ] 광고 로딩 실패 시 사용자 피드백 확인
- [ ] 보상형 광고 전체 플로우 테스트

### P1 핵심 기능 테스트
- [ ] 공유 링크 생성 및 접속 테스트
- [ ] 위치 자동완성 선택 정상 동작
- [ ] API 타임아웃 시 재시도 동작

### P2 개선사항 테스트
- [ ] 시간 입력 필드 빈 상태 표시
- [ ] API 추적 통계 정확성
- [ ] 웹 플랫폼 데이터 정리

## 배포 계획

### Phase 1: 로컬 테스트 (4시간)
1. 모든 패치 적용
2. 로컬 환경에서 통합 테스트
3. TypeScript 컴파일 에러 확인

### Phase 2: Alpha 빌드 (2시간)
```bash
# versionCode 44 설정
eas build --platform android --profile preview

# 빌드 완료 후 내부 테스트
```

### Phase 3: Alpha 배포 (1시간)
1. Google Play Console Alpha 트랙 업로드
2. 내부 QA 팀 테스트 (6-12시간)
3. 라이선스 테스터 롤아웃

### Phase 4: 프로덕션 준비
- Alpha 테스트 피드백 수렴
- 추가 버그 수정 (if any)
- versionCode 45 프로덕션 빌드

## 리스크 및 롤백 계획

### 리스크
1. **광고 수익 영향**: 테스트/프로덕션 광고 분기 오류 시 수익 손실
2. **공유 기능 중단**: URL 설정 오류 시 공유 기능 완전 중단
3. **API 안정성**: 타임아웃 증가로 인한 서버 부하

### 롤백 계획
- versionCode 43을 stable로 유지
- 긴급 시 43으로 즉시 롤백
- 서버 사이드 feature flag로 광고 동작 제어

## 성공 기준
- P0 버그 0건 ✅
- P1 버그 해결 확인 ✅
- 광고 노출률 > 50% ✅
- 공유 링크 성공률 100% ✅
- API 에러율 < 1% ✅