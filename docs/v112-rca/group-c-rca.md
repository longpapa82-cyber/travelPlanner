# V112 Group C RCA — UX/회귀 (4건)

**Date**: 2026-04-14
**Status**: RCA 완료

---

## #4 — 코치마크 좌표 4회차 재발 (CRITICAL 구조적 결함)

### Definitive root cause

`createTripRef`가 붙은 View가 `Animated.View`의 `transform: translateY: slideAnim` 내부에 있고, **`useNativeDriver: true`** 사용 중. Native driver는 변환을 UI 스레드에서 처리하며 **JS shadow tree를 절대 업데이트 안 함**. `measureInWindow`는 JS shadow tree를 읽으므로 버튼의 **시작 위치**(translateY=50, pre-animation offset)를 반환함 — 사용자가 실제로 보는 위치가 아님. Android에서는 네이티브 transform이 JS 레이아웃을 원래 `translateY: 50` 위치에 영원히 남김 → after-animation 측정도 정확히 50px 틀림.

### Why V109/V110/V111 all failed

| Version | 시도 | 실패 이유 |
|---|---|---|
| **V109** (padding 8→12, gap 16→24) | 증상을 "sizing miss"로 오진 | Padding이 고정 50px 수직 오프셋 에러를 보상할 수 없음 — spot이 "틀리지만 더 큰" 것처럼 보일 뿐 |
| **V110** (timer-based remeasure) | 측정 *타이밍* 조정 | JS shadow tree는 native-driven transform을 **절대** 반영 안 함 → 리타이밍이 구조적으로 무효. 어떤 디바이스에서 맞아 보였던 것은 `slideAnim` 시작값이 작았거나 RN이 순간적으로 업데이트된 레이아웃을 캐시해서 |
| **V111** (`animationDone` + rAF + 1500ms fallback + `measureInWindow`) | `.start()` 콜백 대기 후 measureInWindow | `.start()`는 **네이티브** 애니메이션 완료 시 발화 — `useNativeDriver: true`는 JS 레이아웃이 transform에 의해 **변이된 적 없음**. 더 기다리는 것, rAF, fallback 모두 도움 안 됨. 읽는 숫자가 구조적으로 stale |

**Secondary flaw**: `useEffect`가 `isFocused`, locale, 화면 회전, 버튼의 `onLayout`에 의존하지 않음 → 초기 측정 후 어떤 re-render도 stale 값을 유지

### Proper fix

1. **측정 대상 ancestor에서 native driver transform 제거**. 셋 중 하나:
   - (a) `createTripRef` 감싼 wrapper의 `translateY` 제거, `opacity`만 애니메이션
   - (b) 해당 timing에 `useNativeDriver: false` 설정 → JS shadow tree가 최종 translate 수신
   - (c) ref를 `Animated.View` **외부**의 sibling plain View에 붙이기 (예: `styles.heroActions` 를 plain View로 렌더링, 애니메이션은 텍스트 content만 감쌈)

2. **`onLayout` 이벤트로 측정** (imperative `measureInWindow` 아닌). `onLayout`은 매 committed layout (회전, font-scale, re-render 포함) 후 발화 + parent-relative 좌표. `onLayout` 콜백 안에서 `InteractionManager.runAfterInteractions(...)` 로 window coords 변환. 이 패턴을 `react-native-copilot`, `rn-tourguide`가 사용.

3. **`useIsFocused`, `useWindowDimensions`, orientation 변경에 re-measure** 등록. 홈 복귀나 회전이 stale spotlight를 안 남김.

4. **1500ms fallback 삭제** — 실제 문제를 가리고 느린 디바이스를 race.

### How to test

- Fresh install on **Android 10, 13, 14** + Android Go 디바이스 (느린 시작 애니메이션)
- System font scale 1.3x / 0.85x — height drift 노출
- Portrait → landscape 회전 with coachmark visible
- Translucent vs opaque StatusBar (`android:windowTranslucentStatus`) — measureInWindow 뷰포트 좌표 일관성 확인
- Cold start + "Don't keep activities" Developer Option — 레이아웃 race 강제
- Spotlight rect가 AI 여행 계획 만들기 버튼을 pixel-for-pixel 덮는지 스크린샷 diff로 3개 breakpoint 검증

### Files
- `frontend/src/screens/main/HomeScreen.tsx` (137-166, 204-234, 289-316 — ref/measure/animation interaction)
- `frontend/src/components/tutorial/CoachMark.tsx` (컴포넌트 자체는 정상)

---

## #5 — 수동 생성 시 폼 미초기화 (자동은 초기화되는 듯 보임)

### Root cause

`CreateTripScreen.tsx:670-707`의 form-reset 로직이 `navigation.addListener('focus', ...)` 에 등록되어 있음. React Navigation의 `focus` 이벤트는 **초기 마운트에서 발화 안 함** (re-focus 시에만) → tab switch로 돌아오는 경우 focus 이벤트가 뜨긴 함.

비대칭 증상의 진짜 원인:
- **AI 모드**: 사용자가 보통 플로우 완료 → interstitial ad → `navigation.reset('Home')` (line 492) → 화면 unmount → refocus 시 focus reset
- **Manual 모드**: `navigation.navigate('TripDetail', ...)` → back stack 유지 → 사용자가 back으로 돌아오면 focus 이벤트 발화하지만 시점에 따라 reset 전에 이미 사용자가 이전 값을 봄

**더 깊은 원인**: `:144-148`의 `useEffect`가 `if (isAiLimitReached && planningMode === 'ai') setPlanningMode('manual')` — `aiTripsRemaining`이 비동기 hydrate 되므로 focus reset 후 **뒤늦은 re-render** 에서 자동으로 manual로 전환 → 사용자는 stale state가 남은 manual 모드에 고착.

### Evidence
- `CreateTripScreen.tsx:144-148` (auto-switch effect)
- `CreateTripScreen.tsx:670-707` (focus-only reset, 초기 마운트에서 reset 없음)
- `CreateTripScreen.tsx:89` (`useState('ai')` default)

### Fix direction

(a) Reset 로직을 helper로 추출 → 초기 mount `useEffect(() => { resetForm(); }, [])` **AND** focus listener 양쪽에서 호출
(b) 또는 `useFocusEffect(useCallback(...))` 사용 — 초기 focus에서도 발화
(c) Auto-switch-to-manual effect를 `planningMode` dep로 가드 — deliberate reset을 override 못하게

---

## #9 — 키보드 1분 지연 + 스크롤 지연

### Root cause

CreateTripScreen은 **2,134 줄 monolith + 32+ hooks**, `<ImageBackground>` 히어로가 원격 1200px JPEG 로드 (`getHeroImageUrl('createTrip', {width: 1200})` at `:737`) 를 단일 non-virtualized `<ScrollView>` 안에 포함. 매 키스트로크/스크롤마다 전체 트리가 reconcile:

1. **비메모화**: `POPULAR_DESTINATIONS = getPopularDestinations(t)`, `DURATION_OPTIONS`, `TRAVELER_OPTIONS` 가 매 렌더 재계산 (`:163-173`), 자식 `.map()` 리스트가 `React.memo`/`useMemo` 없이 재빌드
2. **함수 ID churn**: `handleSelectDestination`, `handleSelectDuration`, `toggleInterest`, `formatDateForDisplay`, `calculateDuration` 이 매 렌더 재생성 → 자식 memoization 무효화
3. **`createStyles(theme, isDark)` 매 렌더 실행** (`:721`) → 매 키스트로크마다 새 StyleSheet 객체
4. **무거운 히어로 이미지**: `<ImageBackground>`가 1200px JPEG를 JS/UI 스레드에서 디코드. 포커스 시 이미지 네트워크 fetch + 디코드가 bridge를 블로킹하는 동안 키보드가 올라오려고 시도. "1분 키보드 지연"과 완벽히 일치 — Android의 `windowSoftInput` 조정이 이미지 레이아웃 reflow와 경쟁
5. **`apiService.getProfile()` 가 매 mount마다 발화** (`:177`), `usePremium` status refresh가 input 중 전체 트리 re-render 트리거
6. **PlacesAutocomplete**: `searchPlaces` (`PlacesAutocomplete.tsx:58`) 에 debounce 있으나 keystroke path의 `clearTimeout` 확인 안 됨 — 매 입력 변경이 async cache lookup + state update 스케줄

### Evidence
- `CreateTripScreen.tsx:88-212` (32 hooks, 비메모화)
- `CreateTripScreen.tsx:721` (createStyles inline)
- `CreateTripScreen.tsx:735-737` (1200px ImageBackground)
- `CreateTripScreen.tsx:163-173` (재계산 배열)
- `PlacesAutocomplete.tsx:41-90`

### Fix direction

(a) `createStyles` 를 `useMemo([theme, isDark])` 로 감싸기
(b) `useMemo` for `POPULAR_DESTINATIONS`/`DURATION_OPTIONS`/`TRAVELER_OPTIONS` keyed on `[t]`
(c) 모든 핸들러 `useCallback`
(d) 히어로 이미지 `width: 600` 으로 줄이고 lazy decode, 또는 `<Image>` + absolute child로 교체
(e) 폼 섹션을 `React.memo` 자식 컴포넌트로 분할 (HeroSection, DestinationSection, DateSection, BudgetSection, PreferencesSection)
(f) Profile prefill을 one-shot `useFocusEffect` with stale guard로 이동
(g) `app.config.js` 에 `softwareKeyboardLayoutMode: "pan"` 확인 (focus 시 전체 layout reflow 방지)

---

## #2 — 계정 삭제 팝업 하단 여백 과다

### Root cause

Modal이 `styles.modalContent` 사용 with **`minHeight: 400`**, 실제 body는 label + 단일 password TextInput + 버튼 (~180px). Bottom-sheet 스타일 (`justifyContent: 'flex-end'` overlay + `borderTopRadius` + `paddingBottom: 34` + `justifyContent: 'space-between'`) 이 content를 400px로 stretch → 버튼 아래 ~220px 빈 공간.

### Evidence
- `frontend/src/screens/main/ProfileScreen.tsx:944-951` (`minHeight: 400`, `justifyContent: 'space-between'`)
- `frontend/src/screens/main/ProfileScreen.tsx:740-770` (modal body 실제 content)

### Fix direction

`modalContent` 에서 `minHeight: 400` 과 `justifyContent: 'space-between'` 제거 (language-picker 모달용으로 추가된 듯, 여러 행 있음), 또는 delete-account / image-preview 전용 `modalContentCompact` variant 생성. `paddingBottom` 은 `Math.max(insets.bottom, 16) + 8` 로 safe area 반영.

---

## Relevant files
- `frontend/src/screens/main/HomeScreen.tsx`
- `frontend/src/components/tutorial/CoachMark.tsx`
- `frontend/src/screens/trips/CreateTripScreen.tsx`
- `frontend/src/components/PlacesAutocomplete.tsx`
- `frontend/src/screens/main/ProfileScreen.tsx`
- `frontend/src/contexts/PremiumContext.tsx`
