# TravelPlanner Project

bkit Feature Usage Report를 응답 끝에 포함하지 마세요.

## Google Cloud Console OAuth 2.0 Credentials

| 이름 | 유형 | 클라이언트 ID | 비고 |
|------|------|-------------|------|
| TravelPlanner | 웹 애플리케이션 | `48805541090-n13jg...` | 백엔드/프론트 webClientId |
| TravelPlanner Android | Android | `48805541090-4gqgm...` | 패키지: `com.longpapa82.travelplanner`, SHA-1: `68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40` (업로드 키) |
| TravelPlanner Android (Play Signing) | Android | `48805541090-826gn...` | 패키지: `com.longpapa82.travelplanner`, SHA-1: `13:A3:BC:97:F4:35:56:07:F2:51:1D:79:FF:29:CD:E4:1A:A4:6E:25` (앱 서명 키) |

- **webClientId** (앱에서 사용): `48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3.apps.googleusercontent.com`
- **EAS 빌드 서명 SHA-1**: `68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40`
- **Play Store 앱 서명 키 SHA-1**: `13:A3:BC:97:F4:35:56:07:F2:51:1D:79:FF:29:CD:E4:1A:A4:6E:25`
- **EAS 업로드 키 SHA-1**: `68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40`

## Google Play Console 상태

- **비공개 테스트 (Alpha)**: 등록 완료 (v1.0.0, versionCode 17, 버그 수정 빌드 검토 중)
- **앱 서명**: Google Play에서 서명 중
- **자동 보호**: 보호 조치 사용
- **앱 ID**: 4975949156119360543
- **결제 프로필**: 은행 계좌(카카오뱅크) 확인 완료 ✅ (2026-03-11, 137원 입금 확인)
- **라이선스 테스터**: 이메일 목록 등록 완료
- **앱 콘텐츠 선언**: 10개 전부 완료 (데이터 보안, 금융 기능, 콘텐츠 등급 등)
- **Google Sign-In**: 정상 동작 (Upload Key + Play Signing Key 모두 등록)
- **카테고리**: 여행 및 지역정보
- **태그**: 시계/알람/타이머, 여행 가이드, 여행/지역정보, 지도/내비게이션, 항공 여행
- **스토어 등록정보**: ko/en/ja 3개 언어 완료 (앱 이름, 설명, 기능 그래픽, 스크린샷)
- **IARC 등급 & 데이터 안전**: 완료
- **15% 수수료 프로그램**: 계정 그룹 생성 완료, $1M 이하 자동 적용
- **IAP 구독 상품 가격**: monthly $3.99 (KRW 5,500), yearly $29.99 (KRW 44,000) — 전 국가 자동 환산 적용
- **IAP 테스트 구매**: 성공 (테스트 카드, 라이선스 테스터)
- **EAS 플랜**: Starter ($45 build credit, 2026-03-11 업그레이드)

## Google Cloud Service Account (RevenueCat 연동)

- **서비스 계정**: `mytravel-play-store-deploy@tripplanner-486511.iam.gserviceaccount.com`
- **프로젝트**: tripPlanner (tripplanner-486511)
- **IAM 역할**: Pub/Sub Admin
- **Play Console 권한**: 앱 정보 보기, 재무 데이터 보기, 주문 및 구독 관리
- **RevenueCat JSON 업로드**: 완료, Credentials 전파 완료 ✅ (Valid credentials, 2026-03-11)
- **RevenueCat 패키지명**: `com.longpapa82.travelplanner` (수정 완료)
- **RTDN (실시간 알림)**: 설정 완료
  - Pub/Sub 토픽: `projects/tripplanner-486511/topics/play-billing`
  - 게시자: `google-play-developer-notifications@system.gserviceaccount.com` (Publisher 권한)
  - Play Console 수익 창출 설정: 실시간 알림 사용 설정 ✅
  - RevenueCat Connected to Google ✅ + Track new purchases ✅
  - 테스트 알림: 성공 ✅ (Last received 2026-03-11, 5:49 UTC)

## AdMob 설정

- **Android App ID**: `ca-app-pub-7330738950092177~5475101490`
- **iOS App ID**: `ca-app-pub-7330738950092177~7468498577`
- **광고 단위**: Android+iOS × 배너/전면/앱오프닝/보상형 = 8개 (모두 프로덕션 ID)
- **app.config.js**: 모든 ID 설정 완료
- **승인 상태**: 프로덕션 출시 후 자동 승인 예정

## Paddle 프로덕션 계정

- **대시보드**: vendors.paddle.com
- **계정 생성**: 2026-03-10
- **사업자 인증**: 제출 완료, Step 1~2 완료, Step 3 Identity checks 검토 중, Step 4 Final review 대기 (~3/14~15 예상)
- **비즈니스명**: AI Soft (에이아이소프트)
- **도메인**: mytravel-planner.com
- **프로덕션 env 교체**: 인증 완료 후 진행 (API Key, Webhook Secret, Price IDs, Client Token)

## Play Store 앱 서명 키 SHA-256

- **앱 서명 키 SHA-256**: `E7:06:3F:BE:01:C4:47:BF:7C:50:01:79:48:49:7F:72:AB:51:76:B0:27:85:DB:84:C9:01:CE:7A:91:E8:70:7A`
- **assetlinks.json**: 등록 완료 ✅ (App Links 검증 정상)

## QA 마스터 플랜 (2026-03-12~16)

- **계획 문서**: `docs/qa-master-plan.md`
- **4-Layer QA**: Playwright E2E (38+5 spec) + Auto-QA + Security-QA + Publish-QA
- **Go/No-Go 기준**: P0 0건, P1 0건, 테스트 ≥95%, Play 정책 10/10 PASS

## Admin Enhancement (2026-03-11, 완료)

### 1. API 사용량 대시보드 ✅
- **엔티티**: ApiUsage (provider, feature, status, tokens, costUsd, latencyMs)
- **프로바이더**: openai, openai_embedding, locationiq, google_maps, openweather, google_timezone, email (7개)
- **로깅**: ai.service(OpenAI), embedding.service(OpenAI Embedding), geocoding(LocationIQ+Google Maps), weather(OpenWeather), timezone(Google), email(Nodemailer) — fire-and-forget
- **API**: GET /admin/api-usage/{summary,daily,monthly}
- **UI**: ApiUsageDashboardScreen (View-based 차트, 17개 언어, 7개 프로바이더 색상 구분)
- **마이그레이션**: `1740500000000-AddApiUsageTable.ts` (프로덕션 synchronize:false 대응)

### 2. 오류 로그 강화 ✅
- AllExceptionsFilter → 5xx ErrorLog DB 자동 기록 (rate limit 100/min, request.path 사용)

### 3. 수익 대시보드 수정 ✅
- 제휴사 영역 제거, AdMob 외부 대시보드 안내 (i18n 17개 언어)

## QA Day 2 결과 (2026-03-13, 완료)

### Security-QA Layer 3~4 ✅
- SQL Injection, XSS, CSRF, Rate Limiting, CORS, IDOR, Mass Assignment, Webhook 검증 — 전항목 PASS

### Auto-QA Category C~D ✅
- **P0 fix**: timezoneOffset hours→minutes 변환 버그 (trip-progress.helper.ts)
- 나머지 항목 PASS

### Publish-QA Category 3~5 ✅
- **OSS 라이선스**: licenses.html 생성 + ProfileScreen 메뉴 추가 (17개 언어)
- **CCPA**: privacy-en.html Section 11 "California Residents" 추가
- **effectiveDate**: 17개 언어 모두 2026-03-13으로 통일
- **Apple 로그인**: iOS 전용 명시 (legal.json 17개 언어 + 스토어 설명 ko/en/ja)

### 결제 프로필 변경 요청
- 결제 프로필 ID: 9519-2519-9017
- 개인→비즈니스 유형 변경 티켓 제출 (Play Console, ~2영업일)

## QA Day 3 결과 (2026-03-13, 완료)

### Security-QA Layer 5~6 ✅
- **P1 fix**: Stored XSS 방지 — update-profile.dto, update-travel-preferences.dto에 stripHtml 추가
- **P2 fix**: 비밀번호 리셋 토큰 DEV 로그 마스킹, backups/ .gitignore 추가

### Auto-QA Category E~F ✅
- **P1 fix**: admin.json 17개 언어 구조 수정 + 누락 키 6개 추가
- **P1 fix**: AnnouncementFormScreen/ManagementScreen 하드코딩 문자열 i18n 변환
- **P1 fix**: TripListScreen/CreateTripScreen useEffect cleanup (메모리 누수 방지)

### Publish-QA Category 6~7 ✅
- **P1 fix**: WCAG AA 색상 대비 — textSecondary neutral[400]→neutral[500] (4.6:1)
- **P1 fix**: RTL 지원 — Arabic I18nManager.forceRTL()
- **P1 fix**: eas.json submit track "internal"→"production"

## QA Day 4 결과 (2026-03-13, 완료)

### 회귀 테스트 ✅
- Frontend TypeScript: PASS (0 errors)
- Backend TypeScript: PASS (0 errors)
- Frontend Jest: 200/200 PASS
- Backend Jest: 397/397 PASS (ai.service.spec.ts ApiUsageService mock 수정)

### 스모크 테스트 ✅
- 프로덕션 18개 엔드포인트 검증: 15 PASS / 3 FAIL
- CSP 헤더: API 엔드포인트에서 정상 확인 (스모크 테스트 오탐)
- /api/trips/popular 401, nonexistent.html 200: 의도된 SPA 동작
- **실질 이슈: 0건**

### 배포 이력
- 22차 (`7c88619`) — ai.service.spec.ts 테스트 수정

## API Usage 로깅 감사 & 비용 최적화 (2026-03-13, 완료)

### API Usage 누락 감사 ✅
- **발견된 4개 누락 API**: OpenAI Embedding, Google Maps (geocoding 폴백), Google Maps (timezone 폴백), Email
- **수정**: embedding.service.ts, geocoding.service.ts, timezone.service.ts, email.service.ts에 fire-and-forget 로깅 추가
- **프로바이더 7개**: openai, openai_embedding, locationiq, google_maps, openweather, google_timezone, email
- 23차 (`f9b5ad1`) 배포 완료

### 비용 최적화 ✅
| 최적화 | 변경 전 | 변경 후 | 효과 |
|--------|---------|---------|------|
| 날씨 캐시 TTL | 30분 | 6시간 | OpenWeather 호출 12배 감소 |
| 타임존 좌표 반올림 | toFixed(2) ~1.1km | toFixed(1) ~11km | Google Timezone 캐시 히트율 향상 |
| 템플릿 만료 기준 | 30일 | 90일 | 재사용 가능 템플릿 3배 증가 |
| 벡터 유사도 임계값 | 0.75 | 0.70 | 유사 템플릿 매칭 확률 증가 |
| LocationIQ 일일 한도 | 무제한 | 5,000건 (경고 4,500건) | 무료 한도 초과 방지 |

- **비용 절감**: 1만 건 기준 $32.93 → $13.45 (약 59% 절감)
- 24차 (`ebf7ba3`) 배포 완료
- **배포 후 QA**: 프로덕션 12개 항목 검증 완료 ✅

## 🔴 CRITICAL: 중복 여행 생성 버그 수정 (2026-03-21, 완료 ✅)

### 버그 발견 및 수정 과정
**4가지 버그 발견** (상세: `docs/deployment-log-2026-03-21.md`):

1. **버그 #1: 프론트엔드 더블탭** (Phase 1)
   - 위치: `frontend/src/screens/trips/CreateTripScreen.tsx:227`
   - 원인: `handleCreateTrip()`에 `isLoading` 체크 없음
   - 수정: 즉시 가드 추가 (`if (isLoading) return;`)

2. **버그 #2: 백엔드 SELECT 쿼리** (Phase 8)
   - 위치: `backend/src/trips/trips.service.ts:93-117`
   - 원인: `.select('users')`가 컬럼값 미반환 → `user.aiTripsUsedThisMonth` = undefined
   - 수정: 명시적 컬럼 선택 + `currentCount` 변수 사용
   - 배포: 25-2차 (`a80c4faf`) — 백엔드 프로덕션 재배포 완료

3. **버그 #3: 프론트엔드 SSE Fallback** ⭐ **(중복 생성 근본 원인)**
   - 위치: `frontend/src/services/api.ts:370-463`
   - 원인: SSE 성공(201) 후 스트림 중단 시 catch 블록에서 무조건 `this.createTrip()` fallback → 중복 생성
   - 로그: POST /api/trips/create-stream (289ms) + POST /api/trips (39ms) - 2개 API 호출 확인
   - 수정: `sseRequestStarted` 플래그 추가, SSE 시작 후 fallback 절대 금지
   - 배포: 26차 (`8a5f164c`)

4. **버그 #4: SSE 스트림 중단 + 에러 로깅 없음** ⭐ **(사용자 보고)**
   - 위치: `frontend/src/services/api.ts`, `CreateTripScreen.tsx`
   - 현상: 여행 생성됨 → 스트림 중단 → "실패" 토스트 → 에러 로깅 없음
   - 수정:
     - `api.ts`: SSE 중단 시 최근 여행 조회 (10초 이내), tripCreated 플래그
     - `CreateTripScreen.tsx`: 모든 에러에 `apiService.logError()` 추가
     - 사용자에게 정확한 메시지: "Trip created but connection interrupted"
   - 배포: 27차 (`231e0503`)

5. **버그 #5: SSE 스트림 중단 후 네비게이션 실패 + AI 카운트 차감 안됨** ⭐ **(사용자 보고)**
   - 위치: `frontend/src/services/api.ts`, `CreateTripScreen.tsx`
   - 현상:
     - 여행 생성 완료 토스트 표시 → 상세 페이지 전환 실패
     - 생성 횟수 차감 안됨 (3/3 유지)
   - 근본 원인:
     - `error.tripCreated` 케이스 처리 불완전 (버그 #4 수정의 부작용)
     - `refreshStatus()` 미호출 → `aiTripsUsedThisMonth` 업데이트 안됨
     - `trip` 객체 없이 에러만 throw → TripDetail 이동 불가
   - 수정:
     - `api.ts:455-499`: 재시도 로직 추가 (3회, 1초/2초 exponential backoff)
     - `CreateTripScreen.tsx:424-486`: `refreshStatus()` + 최근 여행 재조회 추가
     - 성공 시 TripDetail로 정상 이동, 실패 시 TripList로 안내
   - 배포: 30차 (`40a46447`)

### 배포 이력
- 25차 (`a795c4ad`) — 트랜잭션 + SELECT FOR UPDATE
- 25-2차 (`a80c4faf`) — SELECT 쿼리 컬럼 명시
- 26차 (`8a5f164c`) — SSE fallback 제거
- 26-2차 (`d7386a01`) — versionCode 25 빌드
  - Build ID: 785c6503-4889-467a-a0e4-811418be712a
  - AAB: https://expo.dev/artifacts/eas/fS343itu3BYqKrfq9KbfnQ.aab
- 27차 (`231e0503`) — SSE 스트림 중단 처리 + 에러 로깅
- 27-2차 (`89ce2982`) — versionCode 27 빌드
  - Build ID: d0da1658-5789-435b-be68-eed1b3558841
  - AAB: https://expo.dev/artifacts/eas/rMPixfB7Kvdk1dNrudzTHB.aab
  - 포함: 버그 #4 수정 (SSE 중단 처리 + 에러 로깅)
  - ❌ Play Console 거부: versionCode 27 이미 사용됨
- 28차 (`b2c8210a`) — versionCode 28 설정 + alpha track 구성
  - frontend/eas.json: track "production" → "alpha"
  - eas.json: submit track "alpha" 추가
- 29차 — versionCode 29 빌드 ✅
  - Build ID: e02cb511-3484-41d2-9d3e-dcf1f861af09
  - AAB: https://expo.dev/artifacts/eas/tFyobQtJUKy5VDR5GzJ9EM.aab
  - 포함: 버그 #4 수정 (SSE 중단 처리 + 에러 로깅)
  - ✅ Alpha 트랙 업로드 완료 (2026-03-21)
- 30차 (`40a46447`) — SSE 스트림 중단 후 네비게이션 실패 수정
  - api.ts: 재시도 로직 (3회, 1초/2초 백오프)
  - CreateTripScreen.tsx: refreshStatus() + 최근 여행 재조회
  - 포함: 버그 #5 수정 (네비게이션 + AI 카운트 차감)
- 30-2차 (`280a2a7e`) — 버그 #5 문서화
  - CLAUDE.md: 버그 #5 추가, 핵심 교훈 보강
  - deployment-log: Phase 11 추가
- 31차 — versionCode 30 빌드 ✅
  - Build ID: 12f62cbe-f3b0-4753-8e7b-9938336a844b
  - AAB: https://expo.dev/artifacts/eas/3kNFh4mX93MRHRPdXXBXPz.aab
  - 포함: 버그 #5 수정 (SSE 스트림 중단 후 네비게이션 + AI 카운트 차감)
  - Alpha 트랙 업로드 대기

### 현재 상태
- ✅ 백엔드 프로덕션 배포 완료 (25-2차)
- ✅ 프론트엔드 SSE 중단 처리 완료 (27차)
- ✅ versionCode 29 빌드 완료 (Alpha 트랙 배포됨)
- ✅ 버그 #5 수정 완료 (30차)
- ✅ versionCode 30 빌드 완료 (버그 #5 포함)
- ⏳ Play Console Alpha 트랙 업로드 필요

### 핵심 교훈
- **SSE Fallback 위험성**: 성공한 요청(201)에 대한 재시도는 중복 생성 유발
- **로그 분석 중요성**: 2개 엔드포인트 호출 발견으로 근본 원인 파악
- **에러 로깅 필수**: 모든 catch 블록에 에러 로깅 추가 필요
- **체계적 진단**: /sc:troubleshoot 명령으로 단계별 분석 효과적
- **에러 처리 완전성**: 에러 플래그 추가 시 해당 케이스의 완전한 처리 필요
- **상태 동기화 중요성**: 서버 상태 변경 시 클라이언트 상태(refreshStatus) 즉시 동기화
- **재시도 로직 필수**: 네트워크 일시 장애 대비 exponential backoff 재시도 로직 적용

## EAS Build & 비공개 테스트 제출 (2026-03-13)

- **빌드**: EAS production profile, versionCode 19
- **AAB**: https://expo.dev/artifacts/eas/cVWZQom1YYRHUJHyWYM4k6.aab
- **제출**: Play Console에서 직접 업로드 (alpha 트랙)
- **서비스 계정 권한 이슈**: 자동 제출 실패 — 앱 출시 권한 없음 (수동 업로드로 해결)
- **eas.json submit track**: `production` → `alpha` 변경 (비공개 테스트용)

## SNS 로그인 설정 현황 (2026-03-20, 검증 완료 ✅)

### Google OAuth ✅ **프로덕션 게시 완료**
- **Client ID**: `48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3.apps.googleusercontent.com`
- **게시 상태**: 프로덕션 ✅ (2026-03-20 게시 완료)
- **사용자 한도**: 무제한
- **Android OAuth**: Upload Key + Play Signing Key 등록 완료 ✅
- **Redirect URI**: `https://mytravel-planner.com/api/auth/google/callback` ✅
- **수집 정보**: email, profile (자동 제공)

### Kakao OAuth ✅ **설정 완료 (이메일 포함)**
- **Client ID**: `91c9b16550779b270207bfe44648c2dc`
- **카카오 로그인**: ON ✅
- **Redirect URI**: `https://mytravel-planner.com/api/auth/kakao/callback` ✅
- **플랫폼**: Web (`https://mytravel-planner.com`) ✅
- **수집 정보**:
  - **이메일 (필수 동의)** ✅ (2026-03-20 추가)
  - 닉네임 (필수 동의) ✅
  - 프로필 사진 (선택 동의) ✅
- **비즈니스 인증**: 미인증 (이메일 수집은 인증 없이 가능)

### Apple Sign-In ⏸️ **Phase 2로 연기**
- **상태**: 프로덕션 미설정 (iOS 출시 전까지 보류)
- **진행 시점**: Android 출시 및 안정화 이후 (2-4주 후)
- **설정 항목**: Services ID, Private Key, backend 환경 변수 (Phase 2에서 진행)

### Phase 2 개선 사항 (향후)
- [ ] Kakao 비즈니스 인증 ("비즈 앱 전환") - 선택사항
- [ ] Kakao 웹훅 설정 (계정 상태 변경, 연결 해제) - 권장
- [ ] Apple Sign-In 설정 (iOS 출시 시) - 필수

### 상세 가이드
- 📄 **체크리스트**: `docs/sns-login-launch-checklist.md`
- 📄 **Google 게시 가이드**: `docs/google-oauth-publish-guide.md`
- 📄 **Kakao 검증 가이드**: `docs/kakao-oauth-verification-guide.md`

---

## Go/No-Go 판정 (2026-03-13)

### 판정: Conditional Go ✅
- P0 이슈: **0건** (Go 조건 충족)
- P1 이슈: **0건** (Go 조건 충족)
- P2 이슈: ~3건 (수정 계획 있음, ≤10건 Go 조건 충족)
- 테스트 통과율: **597/597 = 100%** (≥95% Go 조건 충족)
- 보안 취약점: **P0/P1 0건** (Layer 1-6 완료)
- Play 정책: **10/10 PASS**
- 법적 문서: 전체 유효 (privacy/terms/CCPA/GDPR)
- 결제 플로우: IAP 테스트 구매 성공

### 외부 대기 항목 (2026-03-20 확인)
1. ⏳ **Paddle 프로덕션 인증** (진행 중, 완료 시기 미정)
   - 현재 단계: Step 3 - Identity checks
   - 조치: No action required (Paddle 팀 검토 중)
   - **결론**: Android 출시는 Paddle 없이 진행 (RevenueCat만 사용)
2. ⏳ 결제 프로필 유형 변경 (개인→비즈니스, ~2영업일) - 확인 필요

### Android 출시 순서 (Phase 1 - Paddle 제외)

**즉시 조치 (2026-03-20)**:
1. **SNS 로그인 검증** ✅ (완료)
   - [x] Google OAuth 동의 화면 프로덕션 게시
   - [x] Kakao Redirect URI 등록 확인
   - [x] Kakao 이메일 필수 동의 추가
   - 📄 상세 가이드: `docs/sns-login-launch-checklist.md`

2. **Android 최종 빌드** ✅ (완료, 2026-03-20)
   - [x] EAS production profile, versionCode 20
   - [x] Build ID: 9253ae73-3dbd-4f6e-86f0-b61dfc4e07eb
   - [x] AAB: https://expo.dev/artifacts/eas/j51kNY26PZYD9DksHaHbnH.aab
   - [x] Build Time: 23m 18s (Finished at 17:55 KST)
   - [x] RevenueCat (Google Play IAP)만 사용
   - [ ] Play Store 프로덕션 제출 (단계적 출시 1% → 10% → 100%) - 다음 단계
   - 📄 실행 로그: `docs/android-production-launch-log.md`

3. **Paddle 추가** (Phase 2, 인증 완료 후)
   - Production credentials 획득
   - backend/.env.production 업데이트
   - 앱 업데이트 (Web 결제 추가)

### iOS 출시 순서 (Phase 2 - Android 안정화 이후)

**2-4주 후 진행 예정**:
1. **Apple Sign-In 설정**
   - Apple Developer Console: Services ID 생성
   - Private Key (.p8) 다운로드 및 저장
   - backend/.env.production에 Apple 환경 변수 추가
   - backend/secrets/ 디렉토리 설정

2. **iOS 빌드 및 테스트**
   - Apple Sign-In E2E 테스트
   - App Store 제출 준비

**Note**: Apple은 Android 출시 및 안정화 이후 진행 (현재 프로덕션 미설정 상태)
