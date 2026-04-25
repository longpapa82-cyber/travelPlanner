# versionCode 61 긴급 핫픽스 계획

## 🔥 즉시 수정 사항 (4시간 내)

### 1. Bug #6: 권한 표시 오류 (30분)
```typescript
// frontend/src/screens/trips/TripDetailScreen.tsx
const userRole = trip.collaborators?.find(
  c => c.userId === currentUser.id
)?.role || trip.role || 'viewer';

const canEdit = userRole === 'owner' || userRole === 'editor';
const canDelete = userRole === 'owner';

// 버튼 조건부 렌더링
{canEdit && <EditButton />}
{canDelete && <DeleteButton />}
```

### 2. Bug #1,#2: 광고 테스트 모드 강제 (1시간)
```typescript
// frontend/src/utils/adManager.native.ts

// Alpha 테스트 기간 동안 테스트 광고 사용
const USE_TEST_ADS_FOR_ALPHA = true;

private getAdUnitId(type: 'banner' | 'interstitial' | 'rewarded' | 'appOpen'): string {
  // Alpha 테스트 강제 테스트 광고
  if (USE_TEST_ADS_FOR_ALPHA || __DEV__) {
    switch(type) {
      case 'rewarded': return TestIds.REWARDED;
      case 'interstitial': return TestIds.INTERSTITIAL;
      case 'banner': return TestIds.BANNER;
      case 'appOpen': return TestIds.APP_OPEN;
    }
  }
  // 프로덕션 광고 ID (추후 사용)
  return this.productionAdIds[type];
}

// 폴백 메커니즘 강화
async showRewardedAd(): Promise<boolean> {
  try {
    if (!this.state.rewardedAdLoaded) {
      adLogger.log('warning', 'No ad loaded, providing fallback reward');
      // 광고 없어도 기능 제공 (Alpha 테스트)
      return true;
    }
    // ... 광고 표시 로직
  } catch (error) {
    adLogger.log('error', 'Ad show failed, providing fallback', error);
    return true; // 실패해도 보상 제공
  }
}
```

### 3. Bug #4: 위치 선택 완전 재구현 (1.5시간)
```typescript
// frontend/src/components/PlacesAutocomplete.tsx
import { flushSync } from 'react-dom';

const handleSelect = useCallback((place: PlacePrediction) => {
  placesLogger.logPlaceSelect(place);

  // 1. 즉시 UI 업데이트
  setInputValue(place.description);
  setShowDropdown(false);

  // 2. 부모 컴포넌트에 동기적으로 전달
  flushSync(() => {
    onChangeText(place.description);
  });

  // 3. 추가 데이터는 비동기로
  if (onSelect) {
    requestAnimationFrame(() => {
      onSelect(place);
    });
  }

  // 4. 검증 로깅
  setTimeout(() => {
    const issues = placesLogger.detectDataLoss();
    if (issues.length > 0) {
      console.error('[Places] Data loss detected:', issues);
    }
  }, 100);
}, [onChangeText, onSelect]);
```

### 4. Bug #3: ScrollView 중첩 해결 (1시간)
```typescript
// frontend/src/screens/trips/TripDetailScreen.tsx
<ScrollView
  style={styles.container}
  nestedScrollEnabled={true}
  scrollEventThrottle={16}
  removeClippedSubviews={false} // 중요: true면 스크롤 문제 발생
  showsVerticalScrollIndicator={true}
  contentContainerStyle={styles.contentContainer}
>
  {/* FlatList 대신 map 사용 */}
  {activities.map((activity) => (
    <ActivityCard key={activity.id} activity={activity} />
  ))}
</ScrollView>
```

## 📊 검증 계획

### 자동 테스트 (1시간)
```bash
# 1. TypeScript 컴파일 체크
npm run typecheck

# 2. 단위 테스트
npm test -- --coverage

# 3. E2E 테스트 (주요 시나리오)
npm run test:e2e -- --spec="trip-detail,places-selection,ad-display"
```

### 수동 테스트 체크리스트
- [ ] 광고: 테스트 광고 표시 확인
- [ ] 위치: 자동완성 선택 → 저장 → 재로드 확인
- [ ] 스크롤: 여행 상세 화면 상하 스크롤
- [ ] 권한: viewer 계정으로 수정/삭제 버튼 미표시 확인
- [ ] 키보드: 초대 이메일 입력 시 화면 가림 없음
- [ ] 프로필: 이미지 업로드 (P2, 선택)

## 🚀 배포 절차

```bash
# 1. 버전 업데이트
npm version patch # 1.0.61

# 2. 커밋
git add .
git commit -m "fix: versionCode 61 - Critical hotfix for Alpha test bugs

P0 Fixes:
- Bug #6: Fixed permission display for viewer accounts
- Bug #1,#2: Force test ads during Alpha testing
- Bug #4: Complete rewrite of places selection logic

P1 Fixes:
- Bug #3: Fixed ScrollView nesting issue

Added comprehensive logging for debugging"

# 3. EAS 빌드
eas build --platform android --profile production

# 4. 제출
eas submit --platform android --track alpha
```

## ⚠️ 리스크 및 완화 방안

| 리스크 | 영향도 | 완화 방안 |
|--------|--------|-----------|
| 테스트 광고 프로덕션 노출 | 낮음 | USE_TEST_ADS_FOR_ALPHA 플래그로 제어 |
| 위치 선택 재발 | 높음 | 상세 로깅 + 자동 오류 보고 |
| 새로운 버그 발생 | 중간 | 롤백 계획 수립 (v60 APK 백업) |

## 📅 타임라인

- **13:00**: 코드 수정 시작
- **15:00**: 자동 테스트 완료
- **16:00**: 수동 테스트 완료
- **17:00**: EAS 빌드 시작
- **18:00**: Alpha 트랙 배포
- **19:00**: 테스터 검증 시작
- **익일 09:00**: 최종 확인 및 프로덕션 결정