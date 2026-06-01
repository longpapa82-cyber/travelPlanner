# TravelPlanner Project

bkit Feature Usage Report를 응답 끝에 포함하지 마세요.

## 📍 현재 상태 (2026-05-04 KST)

### 핵심 상태
- **Android**: versionCode 220 — **프로덕션 검토 중** ✅ (177개 국가, 18,405 기기)
- **iOS**: 빌드 번호 2 (1.0.0) — **TestFlight 처리 중** ⏳ (App Store Connect 반영 대기)
- **서버**: https://mytravel-planner.com (Hetzner VPS) — iOS 로그인 수정 backend 배포 완료 ✅
- **브랜치**: `main`
- **Frontend**: TypeScript 0 errors
- **자동 검증**: `npm run validate:static` PASS

### 최근 버전 이력
| 버전 | 날짜 | 핵심 수정 |
|------|------|-----------|
| **iOS 1.0.0 (2) — TestFlight 처리 중** | 2026-05-04 | iOS 로그인 전면 수정 (Apple 네이티브 SDK, Google iosClientId, Kakao 번들 ID 등록) |
| **V220(프로덕션 검토 중)** | 2026-05-03 | OAuth CSRF nonce 보안 강화 + AsyncStorage refresh token 제거 + CSP unsafe-inline 제거 + 17개 언어 법적 문서 업데이트 |
| V217(빌드) | 2026-05-02 | Alpha 트랙 — Kakao providerId 재발급 re-link + 17개 언어 kakaoCancelled + Apple cancel 오류 필터 |
| V215(프로덕션) | 2026-05-01 | ASO 최적화 + Production 전체 출시 (176개 국가) |
| V214 | 2026-04-30 | purchasePackage 직전 RC logIn 추가 → 월간 무한스피너 수정 |

### iOS 로그인 수정 내역 (2026-05-04)
| 항목 | 수정 내용 |
|------|-----------|
| **Apple Sign-In** | 웹 OAuth → 네이티브 `expo-apple-authentication` SDK로 전환. 백엔드 `POST /auth/apple/token` 엔드포인트 추가 (JWKS 검증) |
| **Google Sign-In** | `GoogleSignin.configure()`에 `iosClientId` 추가. 백엔드 `verifyGoogleIdToken` audience 배열에 iOS Client ID 포함 |
| **Kakao Sign-In** | 카카오 개발자 콘솔 → 네이티브 앱 키 → iOS 번들 ID `com.longpapa82.travelplanner` 등록 |
| **eas.json** | `production-ios` 프로파일에 `autoIncrement: true` + `GOOGLE_IOS_CLIENT_ID` 환경변수 추가 |
| **app.json** | `ITSAppUsesNonExemptEncryption: false` 추가 (암호화 질문 자동 처리) |

### 다음 작업 (우선순위 순)
1. **iOS TestFlight 빌드 2 확인** — App Store Connect에서 처리 완료 대기 (처리 시간 최대 30분~1시간)
2. **iOS TestFlight 내부 테스트** — Apple/Google/Kakao/Email 로그인 검증
3. **V220 Android 프로덕션 검토 통과 확인** — 자동 게시 대기
4. **Git commit** — iOS 로그인 수정사항 전체 커밋
5. **iOS App Store 제출** — 테스트 통과 후 심사 제출
6. **초기 리뷰/평점 확보** — 지인 테스터 리뷰 요청
7. **Android 15/16 deprecated API** — `edgeToEdgeEnabled: true` + StatusBar 마이그레이션 (V221)

---

## 🔐 핵심 불변식

> **상세 RCA**: `docs/archive/version-rcas/v174-v210-rca.md`

### 구독/결제
1. **RC logOut on logout**: `AuthContext.logout()`은 반드시 `Purchases.logOut()` dynamic require 호출. 누락 시 phantom 구독.
2. **server isAdmin only**: 프론트엔드 ADMIN_EMAILS fallback 금지. `/auth/me` server `isAdmin` 플래그만 신뢰.
3. **RC SDK userId 추적**: `configuredUserId` 모듈 변수 유지. logOut 시 reset + 새 userId → `Purchases.logIn` 자동 호출.
4. **mount-restore는 server premium gate**: `mount-restore` source는 `subscriptionTier === 'premium'`일 때만 신뢰.
5. **Server tier authoritative for paywall**: RC SDK 신뢰 금지. server tier가 free면 RC가 무엇이든 buy 진행.
6. **결제 성공 → server tier 확인까지 paywall 유지**: `finalizePurchase`는 AWAITED polling. fire-and-forget 금지.
7. **단일 플래그 과부하 금지**: `isAdmin` 플래그가 quota 면제/광고 차단/결제 차단을 동시 게이팅 금지. 각 axis 별도 가드.
8. **TRANSFER 이벤트 처리 필수**: TRANSFER webhook은 null-guard 이전에 early dispatch. `transferred_to` 배열 기반 탐색.
9. **RC webhook 타입별 구조 검증**: TRANSFER에 `app_user_id` 없음. 타입별 페이로드 스키마 RC 공식 문서 확인 필수.
10. **preflight은 dual-source 검증**: (a) DB tier fast path → (b) RC active_entitlements. DB single source 의존 금지.
11. **RC entitlement는 product-agnostic 차단**: 어떤 SKU든 active entitlement → 모든 신규 SKU 차단 (cross-SKU).
12. **DB-RC 불일치는 차단만, reconcile 금지**: "DB free + RC active" → purchase 차단만. DB 강제 overwrite 금지.
13. **결제 차단 메시지는 원인별 분기**: reason enum 3가지 (`already_subscribed`/`rc_entitlement_active`/`verification_unavailable`).
14. **외부 API preflight은 fail-close**: RC API 장애 시 `canPurchase=false`. canPurchase=true 기본값 절대 금지.
15. **탈퇴 시 RC DELETE + $deleted_at 마킹**: `UsersService.remove()`에서 먼저 `$deleted_at` attribute 마킹 후 RC subscriber DELETE. preflightPurchase에서 deleted_at < user.createdAt이면 phantom으로 판정해 통과.
16. **purchasePackage 직전 RC logIn 필수**: `PaywallModal.handlePurchase`에서 `purchasePackage()` 직전 반드시 `Purchases.logIn(userId)`. [V214]

### Android/UI
17. **Android KAV 금지**: `KeyboardAvoidingView behavior="height"` 금지. `enabled={Platform.OS === 'ios'}`.
18. **Animated cleanup 필수**: unmount 시 `stopAnimation()` cleanup useEffect 필수.
19. **useFocusEffect for screen reset**: tab-nested Native Stack에서 `navigation.addListener('focus')` 대신 `useFocusEffect`.
20. **Single source of truth for paired state**: 관련 상태 쌍은 단일 setter로만 업데이트.
21. **Android 키보드 인셋은 manual Keyboard listener**: `Keyboard.addListener('keyboardDidShow/Hide')` → ScrollView paddingBottom 동적 보정.

### 인증/로그아웃
22. **Cross-context logout transaction lock**: AuthContext에 전역 `isLoggingOut` state + ref. 모든 AppState handler 첫 줄 가드. await 후 재차 가드.
23. **In-flight guard는 await 전 set**: `isXxxRef.current = true`는 반드시 `await` 전에 set.
24. **Confirm dialog는 큐 기반**: ConfirmDialogContext 단일 resolveRef 슬롯 금지. queue + sequential drain.
25. **Navigation tree는 user identity(id)에만 반응**: setUser 시 prev/next id 같으면 reference 안정화.
26. **Account termination umbrella lock**: logout/withdrawAccount 모두 동일 lock(`isLoggingOut`) 공유.
27. **Cross-context refresh API는 모두 lock gate**: silentRefresh/refreshUser entry + after-await 두 번 guard.
28. **Foreground network call에는 timeout 가드**: silentRefresh/refreshUser는 5s `Promise.race`. timeout 시 `setUser(null)` 절대 금지.
29. **OAuth re-link (same email + same provider)**: Kakao 재인증 시 새 providerId 발급 → DB의 기존 동일 email+provider 레코드의 providerId를 UPDATE. [V216]
30. **OAuth provider conflict → 409, 절대 500 금지**: 동일 email이 다른 provider로 이미 존재하면 `ConflictException("EMAIL_PROVIDER_CONFLICT:{provider}")` throw. create() 시도 금지 → duplicate key 500 발생. 프론트는 `error.response.data.message`로 파싱해 "이미 Google 계정으로 가입된 이메일" 메시지 표시. [V217]
31. **OAuth 취소는 reportError 제외**: KAKAO_SIGNIN_CANCELLED / GOOGLE_SIGNIN_CANCELLED / APPLE_SIGNIN_CANCELLED는 reportError 전송 금지. [V216]
32. **OAuth CSRF nonce 필수**: OAuth 시작 시 CSPRNG 16-byte nonce 생성 → session 저장(5분 TTL) → state = base64url({nonce, platform}). 콜백에서 nonce 검증 필수. 모바일(ios/android)은 custom scheme 보호로 nonce 검증 면제. [V220]
33. **Refresh token은 AsyncStorage 저장 금지**: 30일 TTL refresh token은 BACKUP_KEYS에서 제외. 15분 access token만 AsyncStorage 백업 허용. [V220]

### 에러/진단
31. **에러 메시지 i18n**: `throw new Error('ERROR_CODE')` + 핸들러에서 코드→i18n 매핑. `error.message` 직접 노출 금지.
32. **Diagnostic data DTO는 permissive**: `IsObject({each:true}) + ArrayMaxSize(N)`. nested DTO + forbidNonWhitelisted 금지.
33. **진단 인프라는 자기 자신을 보호**: reportError 실패 시 AsyncStorage queue(50 FIFO) + drain. silent `.catch(() => {})` 금지.
34. **PII strip before reportError**: url query string 제거 후 전송. `url.split('?')[0]` 패턴.
35. **Production fail-fast for required env**: production에서 필수 env 미설정 시 startup throw.

### 데이터/백엔드
36. **Webhook idempotency는 atomic transaction**: idempotency INSERT 실패 시 fall-through 금지. 5xx throw → RC retry.
37. **Server-side defensive coercion for numeric DB**: INSERT 직전 `Math.floor + clamp(min, max)`.
38. **expo-file-system은 legacy 경로**: `import('expo-file-system/legacy')` 사용.
39. **PII 포함 진단 데이터는 보관 기한 + purge**: error_logs/audit_logs는 Cron purge 필수 (90/30일).

### 법적/콘텐츠
40. **정적 콘텐츠 사실 검증 자동화**: `npm run validate:static` 매 PR마다.
41. **17개 언어 법적 문서 일관성**: 신규 외부 처리자 추가 시 art3 + 국외이전 article 동시 갱신.
42. **법적 문서 자동 검증 CI**: `scripts/validate-legal.py` P0(사업자정보/처리자/ccpa/국외이전) + P1(90일/effectiveDate).

---

## 🔗 빠른 참조

### 배포 절차
```bash
# SSH 접속
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127

# 백엔드 배포
rsync -avz --exclude node_modules backend/src/ root@46.62.201.127:/root/travelPlanner/backend/src/
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 "cd /root/travelPlanner/backend && docker compose build && docker compose up -d"
curl https://mytravel-planner.com/api/health

# AAB 빌드 (versionCode autoIncrement)
eas build --platform android --profile production --local --output ../build-vXXX.aab

# Alpha 제출
eas submit --platform android --profile alpha --path ../build-vXXX.aab

# Production 제출
eas submit --platform android --profile production --path ../build-vXXX.aab
```

### 아카이브
- `docs/archive/version-rcas/v174-v210-rca.md` — V174~V210 버전별 상세 RCA
- `docs/archive/bug-history-2026-04.md` — V49~V112 버그 RCA 인덱스
- `testResult.md` — Alpha 테스트 결과

---

## 인프라/자격증명

- **서버**: `46.62.201.127` | `mytravel-planner.com` | DNS: Cloudflare (Proxied)
- **Google webClientId**: `48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3.apps.googleusercontent.com`
- **패키지명**: `com.longpapa82.travelplanner`
- **EAS 업로드 키 SHA-1**: `68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40`
- **Play Store 앱 서명 키 SHA-1**: `13:A3:BC:97:F4:35:56:07:F2:51:1D:79:FF:29:CD:E4:1A:A4:6E:25`
- **Play 앱 ID**: 4975949156119360543 | IAP: monthly $3.99, yearly $29.99
- **Service Account**: `mytravel-play-store-deploy@tripplanner-486511.iam.gserviceaccount.com`
- **RTDN**: `projects/tripplanner-486511/topics/play-billing`
- **AdMob Android**: `ca-app-pub-7330738950092177~5475101490`
- **Sentry DSN**: `de.sentry.io` (Germany region)

### SNS 로그인
| Provider | 상태 | 비고 |
|----------|------|------|
| Google OAuth | 프로덕션 | 게시 완료 |
| Kakao OAuth | 설정 완료 | 이메일/닉네임/프로필 |
| Apple Sign-In | ✅ 네이티브 SDK 구현 완료 | expo-apple-authentication, POST /auth/apple/token |

### 비용 (10,000건 기준)
| API | 비용 |
|-----|------|
| OpenAI GPT-4o-mini (Prompt Caching) | ~$110 |
| Google Geocoding | $15 |
| OpenWeather/LocationIQ | $0 |
| **합계** | **~$125** (건당 ~17원) |

## 보안 아키텍처
1. **Auth**: JWT 15m + one-time refresh (Redis jti) + bcrypt 12 + CSPRNG 2FA + account lockout
2. **Access**: Rate limiting all auth + AdminGuard + PendingVerificationGuard
3. **Transport**: HSTS preload + CSP (no unsafe-inline, no unsafe-eval) + Referrer-Policy + CORS whitelist
4. **Data**: SELECT FOR UPDATE on password reset, SQL-level share token expiry, stripHtml DTO
5. **OAuth**: CSRF nonce (CSPRNG 16-byte, base64url JSON state, 5분 TTL, session 검증) — V220
6. **Storage**: Refresh token AsyncStorage 저장 제거 (15분 access token만 백업) — V220
7. **Monitoring**: Sentry — 네이티브 크래시, JS 에러, 느린 API (>10s), ANR

## 후속 작업 (낮은 우선순위)
1. **Android 15/16 마이그레이션** (V221):
   - `edgeToEdgeEnabled: true` + StatusBar API 전환
   - `android:screenOrientation="PORTRAIT"` 제한 삭제 (Android 16 폴더블/태블릿 대응)
2. 회원 탈퇴 모달 하단 여백 UX 개선
3. 무중단 배포 체계 (nginx blue-green)
4. npm audit HIGH 7건 (mjml 체인, path-to-regexp, picomatch)
5. CSP style-src unsafe-inline → nonce 기반 전환
6. console.log 정리 (~210건 → `__DEV__` 가드)

---

**최종 업데이트**: 2026-05-04 KST — iOS 로그인 전면 수정 (Apple 네이티브 SDK + Google iosClientId + Kakao 번들 ID). iOS 빌드 1.0.0 (2) TestFlight 처리 중. Android V220 프로덕션 검토 중. 다음: iOS TestFlight 테스트 → App Store 심사 제출 → Git commit.
