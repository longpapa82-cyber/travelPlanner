# Bug #3: 여행 상세 화면 간헐적 스크롤 불가 문제 해결

## 문제 설명
- **증상**: 여행 계획 상세 화면(TripDetailScreen)에서 간헐적으로 상/하 스크롤이 불가능해짐
- **영향**: 사용자가 일정을 볼 수 없어 핵심 UX 손상
- **발생 빈도**: 간헐적 (특정 조건에서 재현)
- **플랫폼**: 주로 Android

## 근본 원인 분석

### 1. GestureHandlerRootView 중첩
- TripDetailScreen에 불필요한 GestureHandlerRootView가 있어 제스처 컨텍스트 중첩
- RootNavigator와 TripDetailScreen 양쪽에 존재하여 충돌 발생

### 2. DraggableFlatList 제스처 충돌
- 각 ItineraryDayCard마다 DraggableFlatList 존재 (다수의 pan responder)
- `scrollEnabled={false}`에도 불구하고 제스처 핸들러는 활성 상태
- Pan responder가 ScrollView의 터치 이벤트를 가로챔

### 3. Android 플랫폼 특성
- Android는 iOS와 달리 중첩된 스크롤뷰 처리가 약함
- 제스처 우선순위 처리 방식이 다름

## 해결 방법

### 1. GestureHandlerRootView 정리
```tsx
// TripDetailScreen.tsx - 제거
- import { GestureHandlerRootView } from 'react-native-gesture-handler';
- const RootWrapper = Platform.OS === 'web' ? View : GestureHandlerRootView;
- <RootWrapper style={{ flex: 1 }}>

// RootNavigator.tsx - 앱 루트에만 유지
+ <GestureHandlerRootView style={{ flex: 1 }}>
+   {NavigationContent}
+ </GestureHandlerRootView>
```

### 2. DraggableFlatList 조건부 렌더링
```tsx
// ItineraryDayCard.tsx
// 편집 모드에서만 DraggableFlatList 사용, 그 외에는 정적 렌더링
{(Platform.OS === 'web' || tripStatus === 'completed' || userRole === 'viewer') ? (
  // 정적 렌더링
) : (
  // DraggableFlatList with activationDistance={20}
)}
```

### 3. ScrollView 최적화
```tsx
<ScrollView
  ref={scrollViewRef}
  nestedScrollEnabled={true}           // Android 중첩 스크롤 지원
  scrollEventThrottle={16}              // 스크롤 이벤트 최적화
  removeClippedSubviews={Platform.OS === 'android'} // Android 성능
  keyboardShouldPersistTaps="handled"  // 키보드 터치 처리
  overScrollMode="always"               // Android overscroll
  bounces={true}                        // iOS 바운스 효과
  scrollEnabled={true}                  // 명시적 활성화
>
```

### 4. 스크롤 복구 메커니즘
```tsx
// 탭 전환 시 스크롤 강제 복구
onPress={() => {
  setActiveTab('itinerary');
  scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  setTimeout(() => scrollViewRef.current?.scrollTo({ y: 1, animated: false }), 10);
}}
```

## 테스트 체크리스트
- [x] 여행 상세 화면 진입/나가기 10회 반복
- [x] 각 탭 전환 시 스크롤 정상 동작
- [x] DraggableFlatList 드래그 앤 드롭 기능 정상
- [x] 키보드 열고 닫기 후 스크롤 정상
- [x] 다양한 일정 개수(0개, 5개, 20개+)에서 테스트
- [x] Android/iOS 플랫폼별 테스트

## 예방 조치
1. **GestureHandlerRootView는 앱 전체에 단 하나만** - 중첩 금지
2. **DraggableFlatList는 꼭 필요한 경우에만** - 읽기 모드에서는 정적 렌더링
3. **ScrollView 중첩 최소화** - 필요시 nestedScrollEnabled 명시
4. **제스처 충돌 시 activationDistance 조정** - 기본값보다 높게 설정

## 관련 파일
- `/frontend/src/screens/trips/TripDetailScreen.tsx`
- `/frontend/src/screens/trips/ItineraryDayCard.tsx`
- `/frontend/src/navigation/RootNavigator.tsx`

## 커밋
- Commit: `00d151af` - fix: Bug #3 - 여행 상세 화면 간헐적 스크롤 불가 문제 해결