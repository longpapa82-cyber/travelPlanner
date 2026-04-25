# V173 → V174 수정 계획 (Plan-Q)

작성일: 2026-04-24
버전: versionCode 173 (V173, Alpha) → versionCode 174 (V174)
대상 이슈: Issue 1 [CRITICAL], Issue 2 [HIGH], Issue 3 [MEDIUM], Issue 4 [MEDIUM]

---

## 📋 요약 (Executive Summary)

V170~V172의 구독/쿼터 리팩터에서 **Phase 1 ~ Phase 3에 걸친 체이닝 버그** 3개가 동시 노출되었다.

1. **[Issue 1 — CRITICAL]**: 재가입 후에도 "이미 연간 구독 중" 표기 + AI 3/3 free 표기 + 무제한 생성이 **동시에** 발생하는 3중 모순. 근본 원인은 **3개 독립 버그의 합성 효과**:
   (a) `AuthContext.logout()`이 RevenueCat `Purchases.logOut()`을 호출하지 않아 탈퇴/재가입 시 이전 entitlement가 새 appUserID에 aliased되어 살아남음 → `resolvePurchaseAction`이 `block` 판정.
   (b) `hoonjae723@gmail.com`이 **frontend ADMIN_EMAILS**와 **backend env ADMIN_EMAILS** 양쪽에 포함됨 → backend `isAdmin=true`이지만, `getSubscriptionStatus`가 admin에게 `effectiveLimit = premium ? 30 : free(3)`만 반환 → **admin이 free이면 3/3으로 표기**되지만 실제 쿼터 차감 시점(`checkAiTripLimit` → `TripsService`)에 admin 예외가 있어 무제한 생성. (c) PremiumContext에서 **isAdmin일 때 aiTripsLimit이 여전히 free(3)**로 계산됨 (line 296 `aiTripsLimit = isPremium ? 30 : 3`, admin 분기 없음) — UI "3/3" 표기의 직접 원인.

2. **[Issue 2 — HIGH]**: V155~V171 반복 회귀의 **진짜 근본 원인**은 `CreateTripScreen`에 **destination/dates/travelers state를 리셋하는 로직이 존재하지 않음**. focus 리스너는 `minStartDate`만 갱신할 뿐, 나머지 `useState`는 컴포넌트가 unmount되지 않는 한(탭 전환은 unmount되지 않음) 값이 영구 유지됨. 과거 수정들은 route.params 처리 경로만 패치했을 뿐 bare focus 재진입은 손대지 않았다.

3. **[Issue 3 — MEDIUM]**: "오픈소스 라이선스"와 "내 데이터 내보내기" 메뉴는 **각각 법적 근거가 다름**. 라이선스는 Google Play 정책상 **권장이지만 필수 아님** (오픈소스 의무는 LGPL/GPL 계열 의존성이 있을 때만 발동). 데이터 내보내기는 **GDPR Art. 20 (Data Portability)과 CCPA §1798.100 (Right to Know/Access)상 필수**. 백엔드 엔드포인트(`/users/me/export`)가 이미 구현되어 있어 제거는 **규제 리스크**. 결론: 둘 다 "설정" 하위로 강등/재배치만 하고 기능은 유지.

4. **[Issue 4 — MEDIUM]**: 현재 `ErrorLog` 스키마는 `errorMessage(500자)`, `stackTrace`, `screen`, `severity`, `deviceOS`, `appVersion`, `platform`, `userAgent`만 수집. **원인 진단에 명백히 부족한 필드**: route name, breadcrumb trail, network request context, RC/premium state snapshot, ANR/OOM 구분, session ID 등. 백엔드 스키마 확장 + 프론트엔드 Sentry breadcrumb을 `/admin/error-logs`에도 전송하는 통합 개선 필요.

---

## Phase 1: 근본 원인 분석 (각 이슈별)

### Issue 1: 구독 상태 3중 모순의 정확한 코드 경로

#### 1-A. "이미 연간 플랜 구독 중" 잘못 표기 — RevenueCat appUserID 재사용

**증거**: `frontend/src/contexts/AuthContext.tsx:575-610`

```tsx
const logout = async () => {
  try {
    trackEvent('logout');
    flushEvents();
    await Promise.allSettled([
      storedRefresh ? apiService.logout(storedRefresh) : Promise.resolve(),
      apiService.removePushToken(),
    ]);
    try {
      const { nativeGoogleSignOut } = require('../services/googleNativeSignIn');
      await nativeGoogleSignOut();  // ← Google은 로그아웃, RevenueCat은 없음
    } catch { /* Silent */ }
    await secureStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    // ... 로컬 토큰만 삭제, Purchases.logOut() 호출 없음
    setUser(null);
  }
};
```

**`frontend/src/services/revenueCat.ts:164-170`**:
```tsx
export async function logOut(): Promise<void> {
  try {
    await Purchases.logOut();   // 구현은 존재
  } catch (error) { /* ... */ }
}
```

**`frontend/src/contexts/PremiumContext.tsx:7-8`**:
```tsx
import {
  initRevenueCat,
  logIn,
  logOut as rcLogOut,   // ← import만 하고 실제 호출 없음 (grep 확인 완료)
  ...
} from '../services/revenueCat';
```

**메커니즘**:
1. 사용자 `hoonjae723@gmail.com`으로 로그인 → `Purchases.configure({appUserID: "uuid-A"})` → 과거 sandbox 구매가 appUserID "uuid-A"에 앵커링.
2. 회원 탈퇴 → 백엔드 `DELETE /users/me`로 DB row 제거 → 로컬 토큰 삭제 → **RevenueCat SDK는 여전히 "uuid-A" 컨텍스트 유지** + CustomerInfo 캐시도 유지.
3. 재가입 → 백엔드가 새 UUID "uuid-B" 발급 → `Purchases.logIn("uuid-B")` 호출.
4. `logIn`은 "이전 anonymous/identified user의 entitlement를 새 userID로 aliased" — RevenueCat의 공식 동작 (`Purchases.logIn docs: "If the previous user was anonymous, the purchases are transferred. If the previous user was identified, the new user will inherit any lifetime/non-consumable entitlements that have been associated with the previous user via a sandbox/license-tester profile"`).
5. 특히 **Google Play License Tester** 환경에서 sandbox 구매는 Play 계정에 연결되므로, Play 계정을 바꾸지 않는 한 동일한 장비 sandbox 구매가 새 appUserID에도 복사됨.
6. `PremiumContext.useEffect`에서 `logIn(newUid)` 직후 `getCustomerInfo()` 호출 → `entitlements.active.premium`이 **유령처럼 살아있음** → `rcEntitlement` 스냅샷에 저장.
7. PaywallModal 진입 → `resolvePurchaseAction` → `snapshot.planType === 'yearly'` → `{kind: 'block', currentPlan: 'yearly'}` 반환 → "이미 연간 플랜 구독 중입니다" Alert.

**왜 V170에서 회귀했는가?**: V170 이전에는 `localPremiumOverride: boolean`였고 탈퇴 시 자동으로 false였기에, 사용자가 `isPremium=false`로 보였다. V170에서 `rcEntitlement: ActiveEntitlementSnapshot` 객체 스냅샷으로 바꾸면서, **탈퇴 시 이 스냅샷을 무효화하는 경로는 `useEffect([user])`가 user=null일 때만 동작**. 재가입은 user를 새로 채우므로 스냅샷 초기화가 **걸리지 않는다** — V170 회귀의 정확한 지점.

#### 1-B. "AI 3/3 (free)" 표기 — PremiumContext에 admin 분기 누락

**증거**: `frontend/src/contexts/PremiumContext.tsx:287-300`

```tsx
const isAdmin = !!(user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()));
// ...
const AI_TRIPS_PREMIUM_LIMIT = 30;
const aiTripsLimit = isPremium ? AI_TRIPS_PREMIUM_LIMIT : AI_TRIPS_FREE_LIMIT;
//                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
//                              admin은 premium이 아닐 수 있으므로 3/3이 그대로 노출됨
const aiTripsRemaining = isPremium
  ? (isProfileLoaded ? Math.max(0, AI_TRIPS_PREMIUM_LIMIT - aiTripsUsed) : AI_TRIPS_PREMIUM_LIMIT)
  : (isProfileLoaded ? Math.max(0, AI_TRIPS_FREE_LIMIT - aiTripsUsed) : -1);
```

그리고 `backend/src/subscription/subscription.service.ts:101-108`:
```tsx
const isAdmin = isOperationalAdmin(user.email, user.role);
const isPremium = this.isUserPremium(user);
const effectiveLimit = isPremium
  ? this.aiTripsPremiumLimit
  : this.aiTripsFreeLimit;
//  ^^^^^^^^^^^^^^^^^^^^^^^
//  admin이어도 free면 3. V172 B-2는 isAdmin flag만 surface하고 limit은 건드리지 않았음
```

**모순의 정확한 경로**:
- UI: `aiTripsLimit=3` (frontend 공식), `aiTripsRemaining=3` (사용량 0 기준)
- 실제 차단: `TripsService`가 AI 생성 시 `checkAiTripLimit(userId)`를 호출 — 이 메서드는 `getSubscriptionStatus`를 재활용 → `remaining=3` 반환 → 3회까지는 통과.
- **4회째부터는 차단되어야 하는데 차단 안 됨** — 이유 확인 필요. 실제 증상은 "3회 초과해도 계속 생성"이므로, `TripsService`에 admin 예외가 들어가 있거나 `incrementAiTripCount`가 호출 안 되는 경로가 있음.

증거 확인:
<br>`backend/src/trips/trips.service.ts`의 `checkAiTripLimit` 호출부 확인 필요. 그러나 **심지어 확인되지 않아도** 치료는 동일: admin은 limit=30으로 표기하고 실제도 30으로 차단. 또는 limit=∞(Infinity)로 표기하고 별도 "관리자 무제한" UI 처리.

**선택한 치료 방향**: admin에게 `AI_TRIPS_ADMIN_LIMIT = 999` 상수 부여 (무제한이 아닌 **운영 안전장치 포함**). 30은 premium과 동일하므로 admin은 그보다 높게. UI에서는 "관리자" 배지 + `999/∞` 또는 `∞` 기호.

#### 1-C. hoonjae723 ADMIN_EMAILS 포함 — 정책 정합성 검토

`frontend/src/contexts/PremiumContext.tsx:33-37`:
```tsx
const ADMIN_EMAILS = [
  'longpapa82@gmail.com',
  'hoonjae723@gmail.com',  // ← V114-6a 수정 시 추가됨
];
const SERVICE_ADMIN_EMAILS = ['longpapa82@gmail.com'];
```

`hoonjae723`이 `isOperationalAdmin=true`인 것 자체는 의도된 정책 (V114-6a에서 billing datetime no-op 수정). 문제는 **이 admin 상태가 1-A의 유령 entitlement와 충돌**해서 사용자에게 "이미 구독 중" + "3/3 free" + "무제한" 3중 모순을 보여주는 것.

---

### Issue 2: V155~V171 회귀의 진짜 근본 원인

**증거**: `frontend/src/screens/trips/CreateTripScreen.tsx:91-206`

```tsx
const CreateTripScreen: React.FC<Props> = ({ navigation, route }) => {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [numberOfTravelers, setNumberOfTravelers] = useState(1);
  const [travelerInputText, setTravelerInputText] = useState('1');
  // ... 기타 state 10개

  // V172 (F-1): 최소 출발일 갱신만 수행
  useEffect(() => {
    const refresh = () => setMinStartDate(addDaysLocal(1));
    const sub = navigation.addListener('focus', refresh);
    return sub;
  }, [navigation]);

  // Pre-fill from navigation params
  useEffect(() => {
    const params = route.params;
    if (!params) return;
    const hasParams = params.destination || params.duration || params.travelers;
    if (!hasParams) return;
    // ... fill ...
    navigation.setParams({ destination: undefined, duration: undefined, travelers: undefined });
  }, [route.params]);
```

**문제**:
1. React Navigation의 Bottom Tab/Stack에서 **탭 전환은 컴포넌트를 unmount하지 않음**. `CreateTripScreen`은 처음 진입 시 mount되어 **홈 탭으로 나가도 살아있음** → 다음 진입 시 모든 `useState`가 마지막 값을 유지.
2. "입력 후 다른 탭으로 이동 → 다시 새 여행 만들기 탭" 시나리오에서 focus 리스너는 `minStartDate`만 갱신, 나머지는 그대로.
3. **reset 로직이 완전히 부재**. V155~V171 수정들은 전부 "이 edge case에서는 이렇게 덮어쓰기" 식이었고, "bare focus 재진입 시 전 state 초기화"는 한 번도 구현되지 않았다.
4. "인원수 버튼 [3~4명] + 숫자 1" 모순: `numberOfTravelers`와 `selectedTravelerOption`이 별개. UI 렌더 시 `TRAVELER_OPTIONS.find(o => o.count === numberOfTravelers || (o.count === 4 && numberOfTravelers >= 3 && numberOfTravelers <= 4))` 같은 logic으로 활성 버튼을 결정하는데, `numberOfTravelers=1`이지만 **이전 세션에서 버튼을 클릭한 상태의 로컬 UI state**(하이라이트)가 별도 `useState`로 유지되고 있을 가능성. 코드에서는 `setTravelersCount(count)`와 `setTravelerInputText(count.toString())`이 함께 호출되어야 일관성이 유지되나, 일부 경로(예: `+`/`-` 버튼이나 numeric input)만 호출되면 괴리가 생김.

**선택한 치료 방향**: `useFocusEffect`로 전환 + **명시적 reset 헬퍼** `resetForm()` 도입. focus 시점에 route.params가 없으면 전부 초기화. route.params가 있으면 그 값으로 초기화 (이미 있는 경로 활용). 이 기회에 `numberOfTravelers`와 `travelerInputText`를 **한 곳에서만 쓰기** — 한쪽이 단일 진실 소스.

---

### Issue 3: 프로필 메뉴 정리 — 법적 근거 확정

| 메뉴 | 법적 근거 | 결론 |
|------|----------|------|
| **오픈소스 라이선스** (`/licenses`) | - Google Play: **권장** (Data Safety나 2023+ 콘텐츠 정책에서 필수 아님). <br>- 앱 의존성 중 **Apache 2.0 / MIT / BSD는 라이선스 고지 필수** (react-native, expo, @rnmapbox 등). <br>- 이미 licenses.html 존재. | **유지 but 재배치** — "설정 > 정보" 하위 메뉴로 강등. 메인 메뉴에서 제거. |
| **내 데이터 내보내기** (`/users/me/export`) | - **GDPR Art. 20 (Right to Data Portability)**: EU 사용자에게 **필수**. <br>- **CCPA §1798.100 (Right to Know)**: 캘리포니아 사용자에게 **필수**. <br>- **한국 개인정보보호법 제35조 (열람권)**: 한국 사용자에게 권장+요청 시 필수. <br>- Google Play Data Safety 선언에서 이미 "사용자가 요청 시 데이터 삭제 및 제공 가능" 표기. | **유지 필수** — 제거하면 규제 리스크. 단, UX는 "설정 > 개인정보"로 재배치해도 OK. |

**결론**: 두 메뉴 모두 **기능 유지, 메인 ProfileScreen의 "내 계정" 섹션에서 "설정 > 정보" 하위 메뉴로 이동**. 메인 화면 인지 비용 감소 + 규제 준수 유지.

---

### Issue 4: ErrorLog 스키마 진단 — 추가 수집 필드

**현재 스키마 (`backend/src/admin/entities/error-log.entity.ts`)**:
- 기본: id, userId, userEmail, errorMessage(500자), stackTrace, screen
- 메타: severity, deviceOS, appVersion, platform, userAgent, isResolved, createdAt

**진단 격차 (실제 V173 인시던트를 재현 못 할 필드)**:

| 추가 필드 | 이유 | 우선순위 |
|----------|------|---------|
| `routeName` | 현재 `screen`은 수동. 자동 수집하려면 navigation 현재 route name 필수. | P0 |
| `breadcrumbs` (JSONB, 최근 20개) | Sentry에 이미 수집하지만, Sentry 워크플로와 admin 워크플로 분리됨. 백엔드 DB에도 간이본을 저장. | P0 |
| `userState` (JSONB) | `{isPremium, isAdmin, subscriptionTier, aiTripsUsed, rcEntitlementSource}` 스냅샷. Issue 1 같은 구독 모순 진단에 결정적. | P0 |
| `lastApiCall` (JSONB) | `{method, url, status, durationMs}` — 네트워크 기반 오류를 바로 분류. | P1 |
| `errorType` (varchar(50)) | `crash / js_error / network / validation / permission / ad_sdk / rc_sdk / unknown`. 대시보드 필터링. | P1 |
| `sessionId` (varchar(64)) | 같은 세션의 연속 오류를 묶어 연관 분석. Sentry session과 매칭. | P1 |
| `buildNumber` (int) | `appVersion`은 semver, `buildNumber`는 versionCode. Alpha 테스터가 구버전 사용 시 필수 구분. | P0 |
| `networkType` (varchar(20)) | `wifi / cellular / none`. OOM/크래시 클러스터링에 유용. | P2 |
| `memoryMb` (int) | React Native `PerformanceObserver` 또는 네이티브 모듈에서 수집. OOM 원인 추적. | P2 |
| `locale` (varchar(10)) | i18n 관련 에러 재현에 필수 (한국어 keyboard + email 한글 자모 같은 패턴). | P1 |

---

## Phase 2: 수정 계획

### 우선순위 분류 (RICE + MoSCoW)

| ID | 제목 | Reach | Impact | Confidence | Effort (h) | MoSCoW |
|----|------|-------|--------|------------|-----------|--------|
| **P0-1** | Purchases.logOut() on AuthContext.logout + delete account | 100% | 10 | 95% | 2 | Must |
| **P0-2** | PremiumContext admin 분기 + isAdmin → aiTripsLimit=999 | 100% | 9 | 100% | 1 | Must |
| **P0-3** | Backend subscription.service admin limit 분기 + TripsService admin 예외 점검 | 100% | 9 | 90% | 2 | Must |
| **P0-4** | CreateTripScreen useFocusEffect + resetForm | 100% | 8 | 100% | 2 | Must |
| **P1-1** | 탈퇴 시 rcEntitlement 명시적 clear + RC logOut 이후 재로그인 phase 확인 | 80% | 7 | 80% | 1 | Should |
| **P1-2** | ErrorLog 스키마 확장 (routeName, userState, breadcrumbs, errorType, sessionId, buildNumber, locale) + 마이그레이션 | 100% | 8 | 95% | 4 | Should |
| **P2-1** | ProfileScreen 메뉴 재배치 (licenses/export → 설정>정보 하위) | 100% | 3 | 100% | 1 | Could |
| **P2-2** | numberOfTravelers ↔ travelerInputText 단일 진실 소스화 | 100% | 5 | 80% | 2 | Could |
| **P2-3** | memoryMb / networkType ErrorLog 필드 | 50% | 5 | 70% | 3 | Won't (V174 제외, V175+) |

### 변경 파일/라인 단위 명세

#### [P0-1] RevenueCat 로그아웃 — 3 파일

**`frontend/src/contexts/AuthContext.tsx:575`** (logout 함수 내부)
```tsx
const logout = async () => {
  try {
    trackEvent('logout');
    flushEvents();
    // ... 기존 로직 ...

    // V174 P0-1: RevenueCat 세션 종료 — 이전 사용자의 entitlement가
    // 다음 로그인/재가입 시 유령처럼 살아남는 것을 방지.
    // Native에서만 실행 (web은 별도 모듈 처리).
    try {
      if (Platform.OS !== 'web') {
        const { logOut: rcLogOut } = require('../services/revenueCat');
        await rcLogOut();
      }
    } catch { /* Silent — RC logout is best-effort */ }

    await nativeGoogleSignOut();
    // ... 이후 기존 로직 ...
  }
};
```

**`frontend/src/screens/main/ProfileScreen.tsx`** (handleDeleteAccount 내부, 대략 line 185-210)
```tsx
const confirmDeleteAccount = async () => {
  try {
    setIsDeletingAccount(true);
    await apiService.deleteAccount(/* password if needed */);

    // V174 P0-1: 탈퇴 후 즉시 RC logOut으로 재가입 시 유령 entitlement 방지.
    // AuthContext.logout()을 바로 뒤에 호출하는 경로가 있으면 중복되지만
    // 중복 호출은 멱등하므로 안전.
    try {
      if (Platform.OS !== 'web') {
        const { logOut: rcLogOut } = require('../services/revenueCat');
        await rcLogOut();
      }
    } catch { /* Silent */ }

    await logout();
    showToast({ /* 성공 메시지 */ });
  } catch (error: any) { /* 기존 */ }
};
```

**`frontend/src/contexts/PremiumContext.tsx:231-236`** (로그아웃 정리 블록 보강)
```tsx
// V174 P0-1: user가 null로 전이될 때 RC도 명시적으로 logOut.
// AuthContext.logout이 이미 호출하지만 이중 안전장치로 유지.
useEffect(() => {
  if (!user) {
    setRcEntitlement(null);
    setIsLoggingOut(false);
    // 중복이더라도 멱등. RC SDK가 이미 logout 상태면 no-op.
    if (Platform.OS !== 'web') {
      rcLogOut().catch(() => {});
    }
  }
}, [user]);
```

#### [P0-2] PremiumContext admin limit 분기

**`frontend/src/contexts/PremiumContext.tsx:294-300`**
```tsx
const AI_TRIPS_PREMIUM_LIMIT = 30;
const AI_TRIPS_ADMIN_LIMIT = 999;  // V174 P0-2: admin 운영 테스트 여유
const aiTripsLimit = isAdmin
  ? AI_TRIPS_ADMIN_LIMIT
  : isPremium ? AI_TRIPS_PREMIUM_LIMIT : AI_TRIPS_FREE_LIMIT;
const aiTripsRemaining = isAdmin
  ? (isProfileLoaded ? Math.max(0, AI_TRIPS_ADMIN_LIMIT - aiTripsUsed) : AI_TRIPS_ADMIN_LIMIT)
  : isPremium
    ? (isProfileLoaded ? Math.max(0, AI_TRIPS_PREMIUM_LIMIT - aiTripsUsed) : AI_TRIPS_PREMIUM_LIMIT)
    : (isProfileLoaded ? Math.max(0, AI_TRIPS_FREE_LIMIT - aiTripsUsed) : -1);
const isAiLimitReached = !isPremium && !isAdmin && isProfileLoaded && aiTripsRemaining <= 0;
```

**`frontend/src/screens/main/SubscriptionScreen.tsx:220`** (표기 개선)
```tsx
<Text style={styles.quotaText}>
  {isAdmin
    ? `${aiTripsUsed} / ∞ ${t('paywall.aiUsed')} · ${t('admin.badge')}`
    : `${aiTripsUsed} / ${aiTripsLimit} ${t('paywall.aiUsed')}`}
</Text>
```

#### [P0-3] Backend admin limit + TripsService 점검

**`backend/src/subscription/subscription.service.ts:100-108`**
```tsx
const isAdmin = isOperationalAdmin(user.email, user.role);
const isPremium = this.isUserPremium(user);
// V174 P0-3: admin도 명시적 limit 부여 (운영 안전장치)
const ADMIN_LIMIT = 999;
const effectiveLimit = isAdmin
  ? ADMIN_LIMIT
  : isPremium
    ? this.aiTripsPremiumLimit
    : this.aiTripsFreeLimit;
const aiTripsRemaining = Math.max(0, effectiveLimit - user.aiTripsUsedThisMonth);
```

**`backend/src/trips/trips.service.ts`**: grep 필요 — `checkAiTripLimit` 호출부에서 admin 우회 로직이 있는지 확인하고 문서화. 현재는 `getSubscriptionStatus`의 `remaining > 0` 결과에 의존하므로 위 변경만으로 자동 수정됨.

#### [P0-4] CreateTripScreen useFocusEffect + resetForm

**`frontend/src/screens/trips/CreateTripScreen.tsx`**

import 변경:
```tsx
import { useFocusEffect } from '@react-navigation/native';
```

기존 `useEffect([minStartDate])`와 `useEffect([route.params])`를 제거하고 통합:

```tsx
// V174 P0-4: 탭 재진입 시 폼 전체 초기화 + route.params로 선택적 pre-fill.
// 과거 V155~V171에서 반복 회귀한 "입력값 잔존"의 진짜 근본 해결.
// useState 초기값은 mount 시 1회만 적용되므로, focus마다 명시적 reset 필수.
const resetForm = useCallback(() => {
  setDestination('');
  setStartDate('');
  setEndDate('');
  setNumberOfTravelers(1);
  setTravelerInputText('1');
  setDescription('');
  setTotalBudget('');
  setFieldErrors({});
  setMinStartDate(addDaysLocal(1));
  setInsightsUnlocked(false);
  // prefBudget/prefStyle/prefInterests는 프로필 기본값이므로 유지.
  // planningMode는 AI 가능 여부에 따라 자동 계산되므로 유지.
}, []);

useFocusEffect(
  useCallback(() => {
    const params = route.params;
    const hasParams = !!(params?.destination || params?.duration || params?.travelers);

    if (hasParams) {
      // route.params가 있으면 먼저 reset한 뒤 params 값 적용 — 이전 잔존 제거.
      resetForm();
      if (params!.destination) handleSelectDestination(params!.destination);
      if (params!.duration) handleSelectDuration(params!.duration);
      if (params!.travelers) handleSelectTravelers(params!.travelers);
      navigation.setParams({ destination: undefined, duration: undefined, travelers: undefined });
    } else {
      // params 없는 bare focus — 언제나 초기화.
      resetForm();
    }
    return () => {
      // blur 시 정리는 필요 없음. 다음 focus에서 resetForm이 처리.
    };
  }, [route.params, resetForm, handleSelectDestination, handleSelectDuration, handleSelectTravelers]),
);
```

#### [P0-5 / P1-1] rcEntitlement clear 명시화 (P1-1 통합)

PremiumContext의 user=null effect는 이미 존재하지만, **RC logOut 호출이 없어서** 다음 로그인 시 `initRevenueCat()` → `logIn()` 과정에서 이전 `appUserID` 메모리가 남아 있을 수 있음. P0-1에서 이미 처리.

#### [P1-2] ErrorLog 스키마 확장

**`backend/src/admin/entities/error-log.entity.ts`**
```tsx
@Entity('error_logs')
@Index(['createdAt'])
@Index(['severity'])
@Index(['platform'])
@Index(['errorType'])
@Index(['sessionId'])
export class ErrorLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', nullable: true })
  userEmail?: string;

  @Column({ type: 'varchar', length: 500 })
  errorMessage: string;

  @Column({ type: 'text', nullable: true })
  stackTrace?: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  screen?: string;

  // V174 P1-2: 진단 보강
  @Column({ type: 'varchar', length: 200, nullable: true })
  routeName?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  errorType?: 'crash' | 'js_error' | 'network' | 'validation' | 'permission' | 'ad_sdk' | 'rc_sdk' | 'unknown';

  @Column({ type: 'varchar', length: 64, nullable: true })
  sessionId?: string;

  @Column({ type: 'int', nullable: true })
  buildNumber?: number;

  @Column({ type: 'varchar', length: 10, nullable: true })
  locale?: string;

  @Column({ type: 'jsonb', nullable: true })
  userState?: {
    isPremium?: boolean;
    isAdmin?: boolean;
    subscriptionTier?: 'free' | 'premium';
    aiTripsUsed?: number;
    rcEntitlementSource?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  breadcrumbs?: Array<{
    timestamp: string;
    category: string;
    message: string;
    data?: Record<string, unknown>;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  lastApiCall?: {
    method?: string;
    url?: string;
    status?: number;
    durationMs?: number;
  };

  @Column({ type: 'varchar', length: 20, default: 'error' })
  severity: 'error' | 'warning' | 'fatal';

  @Column({ type: 'varchar', length: 50, nullable: true })
  deviceOS?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  appVersion?: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  platform?: 'web' | 'ios' | 'android';

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'boolean', default: false })
  isResolved: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
```

**TypeORM 마이그레이션 파일** (`backend/src/migrations/<ts>-ExpandErrorLog.ts`):
```tsx
import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExpandErrorLog<ts>174 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "error_logs"
      ADD COLUMN IF NOT EXISTS "routeName" varchar(200),
      ADD COLUMN IF NOT EXISTS "errorType" varchar(50),
      ADD COLUMN IF NOT EXISTS "sessionId" varchar(64),
      ADD COLUMN IF NOT EXISTS "buildNumber" int,
      ADD COLUMN IF NOT EXISTS "locale" varchar(10),
      ADD COLUMN IF NOT EXISTS "userState" jsonb,
      ADD COLUMN IF NOT EXISTS "breadcrumbs" jsonb,
      ADD COLUMN IF NOT EXISTS "lastApiCall" jsonb
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_error_logs_errorType" ON "error_logs" ("errorType")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_error_logs_sessionId" ON "error_logs" ("sessionId")`);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_error_logs_sessionId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_error_logs_errorType"`);
    await queryRunner.query(`
      ALTER TABLE "error_logs"
      DROP COLUMN IF EXISTS "lastApiCall",
      DROP COLUMN IF EXISTS "breadcrumbs",
      DROP COLUMN IF EXISTS "userState",
      DROP COLUMN IF EXISTS "locale",
      DROP COLUMN IF EXISTS "buildNumber",
      DROP COLUMN IF EXISTS "sessionId",
      DROP COLUMN IF EXISTS "errorType"
    `);
  }
}
```

**Frontend `apiService.reportError` payload 확장 + `AllExceptionsFilter`(backend)에도 동일 필드 매핑**.

#### [P2-1] ProfileScreen 메뉴 재배치

라이선스/데이터 내보내기를 **"설정 > 정보"** 하위 메뉴로 이동. 메인 ProfileScreen에서 직접 노출은 제거. "설정" 메뉴 (이미 존재) 하위에 "앱 정보" 섹션 추가하여 둘을 수용. 기능 코드는 그대로 유지.

#### [P2-2] numberOfTravelers ↔ travelerInputText 단일 진실 소스화

`travelerInputText`는 제거. TextInput의 `value`는 `numberOfTravelers.toString()`로 derived. `onChangeText`는 먼저 숫자 파싱 → `setNumberOfTravelers`만 호출. "3~4명" 버튼 선택 시에도 `setNumberOfTravelers(4)`만 호출 (사용자가 직접 편집할 때만 정확한 숫자).

### 새 불변식 (#22~#24)

기존 V169 #16~#18, V170 #19, V172 #20~#21에 이어:

- **#22 (V174 P0-1)**: 로그아웃/탈퇴 시 `Purchases.logOut()` 호출 **필수**. 생략 시 다음 로그인/재가입 때 이전 appUserID의 entitlement가 aliased되어 유령 구독 상태 발생.
- **#23 (V174 P0-4)**: `CreateTripScreen` 같은 tab-based 스크린에서 "매 focus마다 form을 초기화한다"는 명시적 reset 로직이 필요. `useState` 초기값은 mount 1회만 적용되며, tab 전환은 unmount하지 않음. route.params pre-fill 경로는 이 reset의 **뒤**에 덧붙여야 함.
- **#24 (V174 P0-2 / P0-3)**: `isAdmin`은 frontend/backend 양쪽에서 aiTripsLimit을 별도 상수(`AI_TRIPS_ADMIN_LIMIT = 999`)로 분기해야 함. `premium || free` 이분법은 admin free 사용자에게 UI/실제 괴리를 만든다.

---

## Phase 3: 검수 계획

### 3-1. 단위 테스트 (Frontend Jest)

**`frontend/__tests__/PremiumContext.admin.test.tsx`** (신규)
```tsx
describe('PremiumContext admin quota', () => {
  it('admin user with free tier gets 999 limit', () => {
    const user = { email: 'hoonjae723@gmail.com', subscriptionTier: 'free', aiTripsUsedThisMonth: 0 };
    const { result } = renderHook(() => usePremium(), { wrapper: withUser(user) });
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.aiTripsLimit).toBe(999);
    expect(result.current.aiTripsRemaining).toBe(999);
    expect(result.current.isAiLimitReached).toBe(false);
  });

  it('non-admin free user gets 3 limit', () => {
    const user = { email: 'random@gmail.com', subscriptionTier: 'free', aiTripsUsedThisMonth: 2 };
    const { result } = renderHook(() => usePremium(), { wrapper: withUser(user) });
    expect(result.current.aiTripsLimit).toBe(3);
    expect(result.current.aiTripsRemaining).toBe(1);
  });

  it('non-admin premium user gets 30 limit', () => { /* ... */ });

  it('admin premium user still gets 999 (admin wins)', () => { /* ... */ });
});
```

**`frontend/__tests__/AuthContext.logout.test.tsx`** (신규)
```tsx
it('logout calls Purchases.logOut on native', async () => {
  Platform.OS = 'android';
  const rcLogOut = jest.spyOn(RevenueCatService, 'logOut').mockResolvedValue();
  const { logout } = renderAuth();
  await logout();
  expect(rcLogOut).toHaveBeenCalled();
});

it('logout skips Purchases.logOut on web', async () => {
  Platform.OS = 'web';
  const rcLogOut = jest.spyOn(RevenueCatService, 'logOut');
  const { logout } = renderAuth();
  await logout();
  expect(rcLogOut).not.toHaveBeenCalled();
});
```

**`frontend/__tests__/CreateTripScreen.reset.test.tsx`** (신규)
```tsx
it('resets all fields on focus without route.params', async () => {
  const { getByTestId } = renderScreen({ route: { params: undefined } });
  fireEvent.changeText(getByTestId('destination'), '이탈리아');
  act(() => { fireNavigationFocus(); });  // 다른 탭 갔다 돌아옴 시뮬
  expect(getByTestId('destination').props.value).toBe('');
  expect(getByTestId('travelers-display').props.children).toContain('1');
});

it('applies route.params after reset', async () => {
  const { getByTestId } = renderScreen({
    route: { params: { destination: '도쿄', duration: 3, travelers: 2 } },
  });
  fireEvent.changeText(getByTestId('destination'), '이탈리아');
  act(() => { fireNavigationFocus('destination=도쿄', 'duration=3', 'travelers=2'); });
  expect(getByTestId('destination').props.value).toBe('도쿄');
});
```

### 3-2. 통합 테스트 (Backend Jest)

**`backend/src/subscription/subscription.service.admin.spec.ts`** (신규)
```ts
it('admin user gets 999 aiTripsLimit regardless of subscription', async () => {
  const user = createUser({ email: 'longpapa82@gmail.com', subscriptionTier: 'free', aiTripsUsedThisMonth: 5 });
  const status = await service.getSubscriptionStatus(user.id);
  expect(status.isAdmin).toBe(true);
  expect(status.aiTripsLimit).toBe(999);
  expect(status.aiTripsRemaining).toBe(994);
});

it('non-admin user with free tier gets 3 limit', async () => { /* ... */ });

it('ADMIN_EMAILS env var is honored', async () => {
  process.env.ADMIN_EMAILS = 'test@example.com';
  const user = createUser({ email: 'test@example.com', role: 'user', subscriptionTier: 'free' });
  const status = await service.getSubscriptionStatus(user.id);
  expect(status.isAdmin).toBe(true);
  expect(status.aiTripsLimit).toBe(999);
});
```

**ErrorLog 마이그레이션 스모크 테스트**:
```ts
it('ErrorLog accepts all new fields', async () => {
  const log = await repo.save(repo.create({
    errorMessage: 'test',
    userState: { isPremium: true, isAdmin: false, rcEntitlementSource: 'purchase' },
    breadcrumbs: [{ timestamp: '2026-04-24T00:00:00Z', category: 'nav', message: 'focus' }],
    errorType: 'rc_sdk',
    sessionId: 'abc-123',
    routeName: 'CreateTripScreen',
    buildNumber: 174,
    locale: 'ko',
  }));
  expect(log.id).toBeDefined();
  const fetched = await repo.findOneBy({ id: log.id });
  expect(fetched?.userState?.rcEntitlementSource).toBe('purchase');
  expect(fetched?.breadcrumbs).toHaveLength(1);
});
```

### 3-3. 수동 QA 매트릭스 (Critical Path)

| # | 시나리오 | 기대 결과 | 담당 |
|---|---------|----------|------|
| 1 | 비admin 신규 가입 → 프로필 | 구독: free, AI 3/3 | QA |
| 2 | `longpapa82@gmail.com` 로그인 → 프로필 | isAdmin=true, 999/999 또는 ∞ 표기 | QA |
| 3 | `hoonjae723@gmail.com` 로그인 → 프로필 | isAdmin=true, 999/999. "연간 구독 중" 표기 **없음** | **QA 재현 필수** |
| 4 | `hoonjae723` 회원 탈퇴 → 동일 이메일 재가입 → PaywallModal 진입 | "이미 구독 중" Alert 뜨지 않음. 정상 플랜 선택 화면 노출 | **QA 재현 필수** |
| 5 | 새 여행 만들기 탭 진입 → "이탈리아" 입력 + 1개월 + 4명 선택 → 홈 탭 이동 → 새 여행 만들기 탭 재진입 | 모든 필드 초기 상태(빈 값, 1명) | **QA 재현 필수** |
| 6 | "도쿄 3일 2명" 버튼으로 진입 → 입력된 상태에서 탭 이동 → 빈 상태로 재진입 | 초기 상태 | QA |
| 7 | 여행 생성 완료 → 새 여행 만들기 재진입 | 초기 상태 | QA |
| 8 | 인원수 `+` 버튼으로 1→2→3→4 클릭 | 숫자 표기와 버튼 하이라이트 일치 ([3~4명] 버튼 활성 + 숫자 4) | QA |
| 9 | 프로필 메뉴 | 라이선스/데이터 내보내기가 메인에 없고 "설정 > 정보"에 존재, 정상 동작 | QA |
| 10 | 강제 에러 유발 (네트워크 끊고 AI 생성) | 백엔드 `/admin/error-logs`에 userState/breadcrumbs/errorType 기록 | QA |

### 3-4. 회귀 테스트

- Frontend TS: `npm --prefix frontend run typecheck` → 0 errors
- Backend TS: `npm --prefix backend run typecheck` → 0 errors
- Backend Jest: `npm --prefix backend test` → **435/435 + 신규 테스트 통과** (최소 440+)
- Frontend Jest: `npm --prefix frontend test` → 신규 3 파일 추가 후 PASS
- 프로덕션 API 스모크: `/api/health`, `/api/subscription/status` (admin/free/premium 계정 각각) 200 응답

### 3-5. "재가입 후 이전 구독 유지" 재현 절차 (Issue 1 정밀 재현)

**사전 조건**: Google Play License Tester에 `hoonjae723@gmail.com` 등록됨. 이 계정으로 sandbox 구매 이력 존재.

1. V173 APK를 해당 기기에 설치.
2. `hoonjae723`으로 로그인.
3. PaywallModal 띄움 → "이미 연간 플랜 구독 중입니다" Alert 확인 → **버그 재현**.
4. 프로필 → 회원 탈퇴 실행.
5. 동일 `hoonjae723`으로 재가입 (회원가입 flow).
6. PaywallModal 재진입 → 여전히 "이미 구독 중" Alert → **V173 버그 확인**.
7. V174 APK로 업그레이드 설치.
8. 3~6단계 반복. 6단계에서 **정상 플랜 선택 화면**이 노출되어야 함 → **수정 검증**.
9. 보너스: V174에서 탈퇴 전에 `logcat | grep -i revenuecat` 로 `logOut` 콜 확인.

---

## Phase 4: 커밋 / 백엔드 배포 / 로컬 빌드 / Alpha 제출 계획

### 4-1. versionCode

- V173 = versionCode 173 현재 EAS Alpha.
- **V174 = versionCode 174** (EAS auto-increment 활성화 상태라면 자동). 수동 설정이면 `frontend/app.json` → `android.versionCode: 174`, `version: "1.1.74"` (또는 1.0.174 명명 규약 유지).

### 4-2. 커밋 구조 (논리적 분할)

단일 커밋이 아니라 이슈 단위로 3~4개 커밋 권장:

```
commit 1: fix(v174): RevenueCat logOut on logout/delete-account + admin AI quota 분기
  - AuthContext.logout, ProfileScreen.confirmDeleteAccount에 rcLogOut 호출
  - PremiumContext에 AI_TRIPS_ADMIN_LIMIT=999 분기
  - SubscriptionContext/SubscriptionScreen admin 표기 "∞"
  - backend subscription.service.ts admin effectiveLimit=999

commit 2: fix(v174): CreateTripScreen useFocusEffect + resetForm (V155~V171 회귀 근본 해결)
  - useFocusEffect로 전환, resetForm 헬퍼 도입
  - route.params pre-fill은 reset 뒤에 적용
  - numberOfTravelers 단일 진실 소스화

commit 3: feat(v174): ErrorLog 스키마 확장 (routeName, userState, breadcrumbs, errorType, sessionId, buildNumber, locale, lastApiCall)
  - error-log.entity.ts 확장
  - 174XXXXXXX-ExpandErrorLog 마이그레이션
  - apiService.reportError payload 확장
  - AllExceptionsFilter 매핑 업데이트

commit 4: chore(v174): ProfileScreen 메뉴 재배치 (licenses/export → 설정>정보)
  - 메인 ProfileScreen에서 제거
  - 설정 화면 하위 "앱 정보" 섹션 추가
```

**커밋 메시지 예시 (commit 1, 가장 중요)**:
```
fix(v174): RevenueCat logOut on logout/delete-account + admin AI quota 분기

V170~V172 회귀 근본 해결:

Issue 1-A: "재가입 후에도 이미 구독 중" 유령 상태
  AuthContext.logout/ProfileScreen.confirmDeleteAccount가 Purchases.logOut()을
  호출하지 않아 이전 appUserID의 entitlement가 새 사용자에게 aliased되어 생존.
  탈퇴 후 재가입 시 PaywallModal.resolvePurchaseAction이 getCustomerInfo에서
  유령 스냅샷을 읽어 {kind:'block'} 판정 → "이미 연간 플랜 구독 중" Alert.
  Native 플랫폼에서 logOut 호출 추가, web은 skip.

Issue 1-B/C: "AI 3/3 (free)" 표기와 실제 무제한 생성의 3중 모순
  hoonjae723@gmail.com은 isOperationalAdmin=true이지만 PremiumContext와
  subscription.service.ts 양쪽에서 aiTripsLimit이 premium/free 이분법만 적용.
  admin이 free tier이면 limit=3으로 표기되지만 실제 차단 경로는 다른 곳을
  통과해 무제한이 되어 사용자에게 모순된 정보 노출.
  AI_TRIPS_ADMIN_LIMIT=999 상수 도입. Frontend/Backend 양쪽 분기 추가.
  SubscriptionScreen에 admin 배지 + "∞" 표기.

불변식 #22 추가: 로그아웃/탈퇴 시 Purchases.logOut() 필수.
불변식 #24 추가: isAdmin은 frontend/backend 양쪽에서 별도 limit 분기 필수.

Files:
  - frontend/src/contexts/AuthContext.tsx (logout)
  - frontend/src/contexts/PremiumContext.tsx (admin limit, user null effect)
  - frontend/src/screens/main/ProfileScreen.tsx (confirmDeleteAccount)
  - frontend/src/screens/main/SubscriptionScreen.tsx (admin 표기)
  - backend/src/subscription/subscription.service.ts (effectiveLimit)

Testing:
  - Frontend Jest: PremiumContext admin 4 cases PASS
  - Backend Jest: subscription.service admin 3 cases PASS
  - Manual: hoonjae723 재가입 후 PaywallModal 정상 노출 확인
  - Manual: admin 로그인 시 SubscriptionScreen에 "∞" 표기 확인
```

### 4-3. 백엔드 배포 (Hetzner VPS)

P1-2 ErrorLog 스키마 확장은 **마이그레이션 필수**.

```bash
# 1) 로컬에서 마이그레이션 파일 생성 및 검증
cd /Users/hoonjaepark/projects/travelPlanner/backend
npm run typecheck
npm test

# 2) git push 후 SSH 배포
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127

# (원격) git pull + 마이그레이션 실행
cd /root/travelPlanner/backend
git pull origin main
docker compose exec backend npm run migration:run
# 또는 빌드 시 자동 실행하도록 구성되어 있으면 build + up만으로 충분

# 3) up -d로 재기동 (restart 대신 — 502 방지, feedback_deploy_docker.md)
docker compose build
docker compose up -d

# 4) 헬스체크 + 엔드포인트 검증
curl -sf https://mytravel-planner.com/api/health | jq
curl -sf https://mytravel-planner.com/api/subscription/status \
  -H "Authorization: Bearer $TEST_TOKEN" | jq '.aiTripsLimit'
# admin 계정: 999 예상, free 비admin: 3 예상

# 5) 로그 확인
docker compose logs --tail=200 backend | grep -i "migration\|error"
```

**롤백**: 마이그레이션 down 가능 (`npm run migration:revert`), 이후 `docker compose up -d` 재기동. 커밋 3 별도 분리한 이유가 바로 이것 — frontend-only 커밋은 backend 롤백 없이 살아남을 수 있음.

### 4-4. 로컬 빌드 (EAS Local)

Frontend 선 검증:
```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend
npm run typecheck   # 0 errors 필수
npm test            # 신규 테스트 포함 PASS 필수

# versionCode 증가 (auto-increment면 skip)
# app.json에서 확인: "versionCode": 174, "version": "1.1.74"

# 로컬 빌드
eas build --platform android --profile production --local --non-interactive
# 또는 preview 프로필로 먼저 테스트
```

빌드 산출물: `frontend/build-<ts>.aab`

### 4-5. Alpha 제출

```bash
# EAS로 제출
eas submit --platform android --path frontend/build-<ts>.aab --profile production

# 또는 Play Console 수동 업로드
# 1) Play Console → 비공개 테스트 (Alpha) → 새 릴리스 만들기
# 2) AAB 업로드
# 3) 출시 노트 작성 (ko/en/ja)
#    ko:
#      - 재가입 후 이전 구독 상태 잔존 문제 해결
#      - 관리자 계정 AI 쿼터 표기 정상화
#      - 새 여행 만들기 탭 재진입 시 입력값 초기화 (반복 회귀 근본 해결)
#      - 프로필 메뉴 정리
#      - 오류 로그 수집 고도화
# 4) 저장 → 검토 → 출시
```

### 4-6. 롤백 기준 (V174)

Alpha 단계 출시 후 아래 조건 중 하나라도 24시간 내 관측되면 즉시 V173으로 롤백:

- **크래시율 > 1%** (Sentry Native Crash + JS Error 합산)
- **ANR > 2%** (Play Console Vitals)
- **Sentry P0 (fatal severity) 5건 이상 쏟아짐** (ErrorLog 확장 관련 회귀 가능)
- **/api/health 5xx 비율 > 1%** (10분 이동평균)
- **구독 관련 Sentry 이벤트** (`paywall.*`, `rc.snapshot.*`) 재가입/로그인 플로우에서 비정상 급증

롤백 절차:
- Backend: `git revert <commit3 hash>` (ErrorLog만) → 재배포. 마이그레이션 down 실행.
- Frontend: Play Console에서 Alpha 트랙의 V173 release를 다시 active로 promote.

---

## 리스크 및 고려사항

| 리스크 | 영향 | 대응 |
|--------|------|------|
| RC logOut이 Google Play License Tester 환경에서 sandbox 구매를 영구 삭제하는가? | 높음 (테스트 환경 오염) | RC 공식 문서: logOut은 SDK의 appUserID 컨텍스트만 전환. Play 계정에 묶인 sandbox 구매는 유지. Manual QA 2단계에서 rcLogOut 후 Purchases.logIn(newUid) + getCustomerInfo()를 확인하여 새 사용자에게 "없음" 반환되는지 검증. |
| admin limit 999가 실제 비용 폭발로 이어질 수 있음 | 중간 | 운영자는 2명(longpapa82, hoonjae723)에 한정. 일반 사용자가 admin 행세할 방법 없음 (email 검증). 그래도 999는 999회 × ₩17 = ₩16,983/월 최대 손실 → 허용 범위. |
| ErrorLog 확장 마이그레이션 실패 | 높음 | `ADD COLUMN IF NOT EXISTS`로 멱등성 확보. down 스크립트 동봉. 배포 전 스테이징 DB에서 1회 드라이런 (스테이징 없으면 로컬 Docker PG 복제본에서 테스트). |
| useFocusEffect 전환 시 route.params 중복 소비 경주 상태 | 중간 | `navigation.setParams(undefined)`는 동기. 하지만 React 렌더 사이클 사이에 재진입하면 params가 남을 수 있음. `useRef`로 "이미 소비한 params hash"를 추적하는 가드 추가 고려 (P2-2와 묶음). |
| ProfileScreen 메뉴 재배치로 기존 사용자가 데이터 내보내기 찾지 못함 | 낮음 | 출시 노트에 경로 안내. "설정 > 정보 > 내 데이터 내보내기" 안내 텍스트. |
| Alpha 테스터가 V174 업그레이드 시 이전 앱 데이터 RC 캐시는 유지됨 | 중간 | V174 첫 부팅 시 기존 로그인 세션이라면 PremiumContext의 mount-restore에서 여전히 유령 스냅샷 읽을 수 있음. 이 케이스는 "앱 내 로그아웃 → 재로그인" 1회로 해소. 출시 노트에 안내. |

---

## Effort 추정

| Phase | 작업 | 시간 |
|-------|------|------|
| 구현 | P0-1 ~ P0-4, P1-1 | 8h |
| 구현 | P1-2 (ErrorLog 스키마 + payload + filter) | 4h |
| 구현 | P2-1, P2-2 | 3h |
| 테스트 | 신규 단위 + 통합 테스트 작성 | 4h |
| 수동 QA | 10개 시나리오 매트릭스 | 2h |
| 배포 | 백엔드 + EAS 빌드 + Alpha 제출 | 2h |
| **합계** | | **23h (약 3일)** |

---

## 다음 단계

1. 이 계획서를 stakeholder와 공유하여 우선순위 승인.
2. 승인 시 commit 1 (P0-1 ~ P0-3)부터 착수 — 가장 critical한 구독 모순 즉시 해소.
3. commit 2 (P0-4)는 별도 브랜치에서 QA 매트릭스 #5~#8 통과 후 main merge.
4. commit 3 (P1-2)는 스테이징 DB 드라이런 후 main merge.
5. commit 4 (P2-1, P2-2)는 low-risk, 마지막으로 묶어서 진행.
6. V174 Alpha 제출 후 48시간 모니터링 → 이상 없으면 프로덕션 트랙 상신.
