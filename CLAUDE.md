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
- **로깅**: ai.service(OpenAI), geocoding(LocationIQ), weather(OpenWeather), timezone(Google) — fire-and-forget
- **API**: GET /admin/api-usage/{summary,daily,monthly}
- **UI**: ApiUsageDashboardScreen (View-based 차트, 17개 언어)
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
