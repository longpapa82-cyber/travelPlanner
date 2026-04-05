# Bug #4: 초대 알림 네비게이션 실패 수정

## 문제 설명
- **증상**: 초대 알림을 터치하면 "길을 잃었어요" 화면으로 이동
- **영향**: 보기 전용/편집 가능 초대 모두 동일한 문제 발생
- **심각도**: P1 - HIGH

## 근본 원인 분석

### 가능한 원인들
1. **알림 타입 불일치**: 백엔드에서 `COLLABORATOR_INVITE` (대문자)로 전송하지만 프론트엔드에서 `collaborator_invite` (소문자)로 비교
2. **tripId 누락**: 알림 데이터에 tripId가 없거나 잘못된 값
3. **권한 문제**: 초대받은 사용자가 여행을 볼 권한이 없는 경우

### 실제 원인
- 백엔드와 프론트엔드 간 알림 타입 형식 불일치 가능성이 가장 높음
- 초대 알림 생성 시 tripId는 정상적으로 포함됨 (백엔드 코드 확인)

## 수정 내용

### 1. NotificationsScreen.tsx
```typescript
// Before
if (tripTypes.includes(item.type) && item.data?.tripId) {

// After
const normalizedType = item.type?.toLowerCase();
if (tripTypes.includes(normalizedType) && item.data?.tripId) {
```

**변경사항**:
- 알림 타입을 소문자로 정규화하여 비교
- 상세한 디버그 로그 추가
- tripId 유효성 검증 강화
- 에러 시 사용자에게 토스트 메시지 표시

### 2. TripDetailScreen.tsx
```typescript
// 추가된 디버그 로그
console.log('[TripDetailScreen] Component mounted with params:', {
  fullParams: route.params,
  tripId: tripId,
  hasTripId: !!tripId,
  typeOfTripId: typeof tripId,
});

// API 에러 시 상세 로그
console.error('[TripDetailScreen] Failed to fetch trip - Full error:', {
  message: error.message,
  status: error.response?.status,
  data: error.response?.data,
  tripId: tripId,
});
```

**변경사항**:
- 컴포넌트 마운트 시 파라미터 로깅
- API 성공/실패 시 상세 정보 로깅
- 에러 메시지를 백엔드 응답에서 가져오도록 개선

## 검증 방법

### 개발자 테스트
1. 콘솔 로그를 통해 알림 데이터 확인
   - `type` 필드의 정확한 값
   - `data.tripId` 존재 여부
2. 네트워크 탭에서 API 응답 확인
   - `/api/trips/{tripId}` 호출 시 응답 코드
   - 에러 메시지 내용

### 사용자 테스트
1. 다른 사용자를 여행에 초대
2. 초대받은 사용자가 알림을 확인
3. 알림 터치 시 여행 상세 화면 정상 표시 확인
4. 편집자/뷰어 권한 모두 테스트

## 향후 개선 사항

### 백엔드 개선
1. Collaborator 엔티티에 `status` 필드 추가 (pending/accepted/rejected)
2. 초대 수락 프로세스 구현
3. 알림 타입을 일관된 형식으로 통일 (snake_case)

### 프론트엔드 개선
1. 알림 타입을 enum으로 관리하여 타입 안정성 향상
2. 네비게이션 실패 시 fallback UI 제공
3. 오프라인 모드 지원

## 관련 파일
- `/frontend/src/screens/main/NotificationsScreen.tsx`
- `/frontend/src/screens/trips/TripDetailScreen.tsx`
- `/backend/src/trips/trips.service.ts` (초대 알림 생성)
- `/backend/src/trips/entities/collaborator.entity.ts` (협업자 모델)

## 커밋
- Hash: 58b55537
- Message: "fix: Bug #4 - Fix invitation notification navigation failure"