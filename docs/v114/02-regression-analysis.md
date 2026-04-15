# V114 회귀 원인 분석

작성일: 2026-04-15
대상: V109~V114에서 6회 이상 재발한 이슈의 근본 원인 추적
목적: Phase 1 RCA에서 영구 수정 스펙 수립을 위한 pre-work

---

## 1. 코치마크 좌표 어긋남 — 6번째 회귀

### 수정 이력 (커밋 추적)

| 시점 | 커밋 | 접근 | 결과 |
|---|---|---|---|
| 최초 구현 | `f68eec13` — V77 튜토리얼 도입 | CoachMark + 웰컴 모달 | — |
| 1차 | `fe8cb6e6` | 웹 데스크톱 containerOffset | 웹만 해결, 모바일 회귀 |
| 2차 | `553c7e94` | CreateTrip 화면 위 겹침 | 겹침만 해결 |
| 3차 | V109 P1-1 | SPOT_PADDING 8→12, TOOLTIP_GAP 16→24 | 여백만 넓힘, 좌표 안 맞음 |
| 4차 | V110 재수정 | onLayout 타이밍 | 다시 어긋남 |
| 5차 | V111 `4cb7ba55` | animationDone + rAF 측정 | 타이밍 해결, 좌표는 여전 |
| **6차 (현재)** | V114에서 **여전히 어긋남** | — | — |

### 공통 패턴 (근본 원인 후보)

모든 수정이 **"측정 시점"만 만졌고 "측정 결과를 어떻게 변환하는지"는 건드리지 않았음**.

```
createTripRef.measureInWindow((x, y, w, h) => {
  setCreateTripLayout({ x, y, width: w, height: h });
});
```

↓ 그대로 Modal 안으로 전달 ↓

```
<Modal transparent>
  <View style={{ top: y, left: x, width: w, height: h }} />
</Modal>
```

### 근본 가설 3가지

#### 가설 A (★유력): Modal 좌표계 vs measureInWindow 좌표계 불일치
- `measureInWindow`는 **앱 root window 기준 뷰포트 좌표**
- React Native Android의 Modal은 기본적으로 **새로운 Window 루트**를 띄움
- 이 Window는 status bar / navigation bar / status inset을 포함한 전체 화면 기준
- 반면 HomeScreen은 SafeAreaView 안에 있어 **status bar 높이만큼 아래로 밀려 있음**
- → Modal 안에서 `top: y`는 status bar 높이만큼 **위로 어긋나 보임**

**증거**:
- 이미지 183에서 박스가 항상 "버튼보다 약간 위에" 위치함 (사용자 보고)
- V111 수정이 "rAF + animationDone"으로 타이밍은 잡았지만 사용자는 여전히 어긋난다고 보고

#### 가설 B: ScrollView offset
- createTripRef가 ScrollView 안 Animated.View 안에 있음
- HomeScreen 스크롤 오프셋이 measureInWindow에는 반영되지만, Modal이 다시 뜰 때 스크롤 상태가 변할 수 있음
- **기각 가능성**: 사용자는 첫 설치 직후 홈 진입 시 스크롤 없이 발생. 기각 우선.

#### 가설 C: Entrance animation의 opacity/translate가 최종 레이아웃과 다름
- HomeScreen의 heroActions가 `Animated.View`에 `translateY` 애니메이션
- measureInWindow가 애니메이션 종료 후에도 transform 적용된 좌표를 리턴할 수 있음
- V111 `animationDone` 플래그로 "애니메이션 끝난 뒤 측정"을 의도했으나, `Animated.timing` callback이 interrupt 시 호출 안 되는 버그 있음
- V111 커밋에서 주석으로 "safety fallback timer" 언급 — 이 fallback이 실제 호출되고 있는지 미검증

### Phase 1 RCA에서 확정할 것
- [ ] 안드로이드 Modal이 새 Window 루트에서 렌더링되는지 RN 문서 확인
- [ ] `statusBarTranslucent` prop 설정 여부 확인
- [ ] `useSafeAreaInsets().top` 값을 y에서 빼거나 더해야 하는지 실기기 로그로 검증
- [ ] 위 3가지 중 하나라도 hit 하면 그게 6회 회귀의 근본 원인

---

## 2. "1/3 하드코딩" — 5번째 회귀

### 수정 이력

| 시점 | 접근 | 결과 |
|---|---|---|
| V107 | 구독 횟수 로직 조정 | 부분 해결 |
| V109 P0-1 | `getProfile()` 후행 호출로 subscriptionTier/aiTripsUsedThisMonth 완전 로드 | 해결처럼 보였음 |
| V110 | 동일 증상 재발 | — |
| V111 | — | 여전 |
| **V112/V114** | **수동 생성 진입 시 2/3 → 1/3 튐** | **현재 이슈** |

### 근본 가설

#### 가설 A (★유력): 프론트엔드 어딘가에 **실제로 "1/3" 텍스트가 리터럴로 박혀 있음**
- 사용자가 "하드코딩된 것처럼" 라고 3회 이상 진술
- `AuthContext.refreshProfile`이 수동 진입 시에는 안 불리고, **다른 컴포넌트가 로컬 state로 1/3을 띄우고 있을 가능성**
- 예: `"이번 달 AI 자동 생성 {X}/3회 남음"` 문구에서 `{X}`가 0이 되면 "0/3"이지만, initial state가 `1`이면 "1/3"이 flash됨
- 또는 `TripsLimitBadge`의 default prop이 `{used: 2, limit: 3}`으로 기본값이 박혀 있을 가능성

#### 가설 B: 수동 생성 화면 진입 시 `useEffect`가 profile refetch 안 해서 stale state
- V109 `AuthContext` 수정은 **로그인 경로만** 건드렸음
- 수동 진입은 이미 로그인된 사용자의 state를 재사용하는데, 여기서 aiTripsUsedThisMonth가 stale

### Phase 1에서 확정할 것
- [ ] `grep -r "1/3" frontend/src/` 로 문자열 리터럴 전수 확인
- [ ] CreateTripScreen → ManualTripForm 렌더링 경로에서 AI 카운터 prop 전달 체인 추적
- [ ] default prop 하드코딩 확인

---

## 3. "개인정보 처리방침 (필수) 중복 + 필수/선택 양쪽 존재" — 신규

### 관찰
- `(필수)` 텍스트와 "필수" 아이콘이 중복
- 필수 블록과 선택 블록 양쪽에 "개인정보 처리방침"이 있음

### 근본 가설

#### 가설 A (★유력): V111 이전에 필수/선택 구조 변경 시 마이그레이션 누락
- `19d7af08` 커밋 ("ConsentScreen 전면 재설계") 에서 구조를 바꿨는데, 17개 언어 i18n 중 일부에만 반영
- i18n consent.json의 items 배열이 옛 구조(선택에 privacy 포함)와 새 구조(필수에 privacy) 둘 다 들고 있을 가능성

### Phase 1에서 확정할 것
- [ ] `frontend/src/locales/*/consent.json` 에서 "개인정보" 또는 "privacy" 라벨 전수 스캔
- [ ] ConsentScreen.tsx 에서 필수/선택 배열을 i18n에서 읽는지, 하드코딩인지 확인

---

## 4. "[건너뛰기] 버튼" — 2+ 회귀

### 근본 가설
- `CoachMark.tsx:138-139`의 dismissBtn 는 `t('coach.dismiss')`
- "건너뛰기"는 tutorial.json의 `coach.dismiss` 키
- 이전 삭제 요청이 **i18n 값만 공백으로 바꾸고** 버튼 JSX는 유지했을 수 있음
- 또는 커밋이 전혀 없었음 (가장 가능성 높음: 매번 "다음 버전에서"로 미뤘음)

### Phase 1에서 확정할 것
- [ ] `git log -S "coach.dismiss"` 로 변경 이력 추적
- [ ] 삭제 시 i18n 키도 함께 제거 (17개 언어)

---

## 5. 공통 회귀 원인 — "왜 매번 같은 버그가 돌아오는가"

### 패턴 1: Test harness 부재
- 14건 이슈 중 **시각적 회귀 테스트**가 있는 항목 0건
- Jest test는 로직만 검증, 레이아웃은 검증 안 함
- 새 버전에서 관련 파일을 건드리면 바로 regression

### 패턴 2: 증상 기반 수정, RCA 생략
- 대부분 커밋 메시지가 "X 버그 수정"
- **왜 발생했는지, 어디서 회귀 가능한지** 언급 없음
- 다음 개발자가 같은 실수 반복

### 패턴 3: i18n + UI 분리 부재
- 문구 변경 요청 시 i18n만 건드리고 렌더링 컴포넌트는 그대로
- 또는 i18n 17개 언어 중 일부만 업데이트

### 해결 전략 (Phase 11에서 구현)
1. **Visual regression harness**: Playwright screenshot baseline
2. **Regression test suite**: V109~V114 이슈 14건 각각에 대한 회귀 테스트
3. **PR 체크리스트**: "이 수정이 V1XX 이슈 Y와 연관 있나?" 항목
4. **i18n 검증 스크립트**: 키 누락/중복 자동 감지

---

## 결론

**코치마크 좌표 이슈는 가설 A (Modal statusBarTranslucent + safe area offset)** 가 6회 회귀의 유력한 근본 원인.
**1/3 하드코딩 이슈는 문자열 리터럴 또는 default prop** 이 유력.
**나머지 이슈는 각 Phase 1에서 grep 기반 증거 수집** 후 확정.

Phase 1에서 이 가설들을 실증하고 수정 스펙을 Gate 1 문서에 기록한다.
