# TravelPlanner Project

bkit Feature Usage Report를 응답 끝에 포함하지 마세요.

## 📍 현재 상태 (2026-04-18) — V139 프로덕션 출시 진행 중

### 핵심 상태
- **버전**: V139 (Play Console Alpha 트랙 versionCode 139)
- **서버**: https://mytravel-planner.com (Hetzner VPS) — V139 배포 완료
- **브랜치**: `main`
- **Frontend**: TypeScript 0 errors, Jest **204/204** active (14/14 active suites, ActivityModal 2 skipped)
- **Backend**: TypeScript 0 errors, Jest **435/435** (23/23 suites)
- **Play Console**: Alpha 트랙 versionCode 139, 프로덕션 출시 준비 중

### V116~V137 Alpha 테스트 수정 이력

| 버전 | 날짜 | 주요 수정 |
|------|------|----------|
| V124 | 04-17 | admin quota, keyboard ANR, badge color, permission settings (5건) |
| V122 | 04-17 | ANR, consent, payment, photo permission (10건) |
| V120 | 04-17 | CreateTripScreen 크래시, 카카오 로그인, 동의 상세 모달 (12건) |
| V132 | 04-18 | onboarding bg, 회원 탈퇴, consent JIT, card clipping (4건) |
| V134 | 04-18 | 웹 허위정보 제거, 키보드 가림, JIT 권한, 법적 문서 갱신 (4건) |
| V136 | 04-18 | 탈퇴 모달 jitter 근본 해결, JIT 권한 완전 전환 (2건) |

### V136 핵심 수정 (V137 빌드)

| ID | 근본 원인 | 수정 |
|---|---|---|
| **탈퇴 모달 jitter** | KAV(behavior='height') + ScrollView(flex:1) 조합이 Android 키보드 해제 시 높이 재계산 jitter | Pressable overlay + Keyboard.dismiss() 패턴으로 전환 |
| **JIT 권한 6버전 재발** | ConsentScreen에서 OS 권한(알림/사진)을 앱 동의와 묶어서 요청 | OS 권한 요청 완전 제거 → JIT 패턴 (기능 사용 시점에 요청) |
| **사진 권한 불필요 팝업** | `requestMediaLibraryPermissionsAsync()` 무조건 호출 | get→request 2단계 (최초 1회만 OS 팝업) |
| **알림 상태 불일치** | 정적 Alert만 표시, 실제 OS 권한 미확인 | `getPermissionsAsync()` 기반 3분기 (granted/undetermined/denied) |

### V137 핵심 불변식 (V115 불변식 11건 유지 + 추가)

12. **OS 권한과 앱 동의 분리 원칙**: ConsentScreen에서는 앱 내 동의(consent)만 처리. OS 런타임 권한(알림, 사진, 위치)은 해당 기능 최초 사용 시점(JIT)에만 요청. ConsentScreen.tsx에 `requestPermissionsAsync()` 호출 금지.

### ⏭️ 프로덕션 출시 후 후속 작업

1. **회원 탈퇴 모달 하단 여백**: 키보드 없을 때 모달 하단 빈 공간 노출 (기능 사용 가능, UX 개선 필요). `ProfileScreen.tsx` modalOverlay paddingBottom과 modalContent paddingBottom 조합 재조정 필요.
2. **무중단 배포 체계**: nginx blue-green 또는 rolling update 구축
3. **스테이징 환경**: 프로덕션과 동일한 테스트 환경 구축
4. **npm audit HIGH 7건**: mjml 체인 (LiquidJS, lodash), path-to-regexp, picomatch
5. **CSP unsafe-inline**: nonce 기반 전환 (AdSense/GTM 연동 고려)
6. **register() 이메일 열거**: 응답 통일 또는 CAPTCHA 도입
7. **Sentry 프론트엔드 크래시 수집**: Android native crash 포착용
8. **sitemap.xml 영문 가이드 추가**: SEO 개선

### 상세 로그
- V115 이전 이력: `docs/archive/claude-md-history-pre-v112.md`
- V114 14 이슈: `docs/v114/00-inventory.md`

---

## 🔗 빠른 참조

- [OAuth/API 설정](#google-cloud-console-oauth-20-credentials)
- [Play Console 상태](#google-play-console-상태)
- [프로덕션 서버](#프로덕션-서버-인프라-hetzner-vps)
- [배포 절차](#배포-절차-수동)
- [버그 수정 이력 요약](#-버그-수정-이력-요약)

**아카이브**:
- `docs/archive/claude-md-history-pre-v112.md` — V111 및 이전 버전 이력
- `docs/archive/deployment-history.md` — 상세 배포 로그
- `docs/archive/bug-history-2026-03.md` — 초기 버그 상세

---

## Google Cloud Console OAuth 2.0 Credentials

| 이름 | 유형 | 클라이언트 ID | 비고 |
|------|------|-------------|------|
| TravelPlanner | 웹 | `48805541090-n13jg...` | 백엔드/프론트 webClientId |
| TravelPlanner Android | Android | `48805541090-4gqgm...` | 업로드 키 SHA-1 |
| TravelPlanner Android (Play Signing) | Android | `48805541090-826gn...` | 앱 서명 키 SHA-1 |

- **webClientId**: `48805541090-n13jgirv7mqcg6qu4bpfa854oinle6j3.apps.googleusercontent.com`
- **EAS 업로드 키 SHA-1**: `68:5E:08:16:83:BC:4E:30:64:62:D1:3D:31:5E:D8:81:D4:EB:D7:40`
- **Play Store 앱 서명 키 SHA-1**: `13:A3:BC:97:F4:35:56:07:F2:51:1D:79:FF:29:CD:E4:1A:A4:6E:25`
- **Play Store 앱 서명 키 SHA-256**: `E7:06:3F:BE:01:C4:47:BF:7C:50:01:79:48:49:7F:72:AB:51:76:B0:27:85:DB:84:C9:01:CE:7A:91:E8:70:7A`
- **패키지명**: `com.longpapa82.travelplanner`
- **assetlinks.json**: 등록 완료 (App Links 검증 정상)

## Google Play Console 상태

- **트랙**: 비공개 테스트 (Alpha) 진행 중, versionCode 137
- **앱 ID**: 4975949156119360543
- **결제 프로필**: 카카오뱅크 계좌 확인 완료 (2026-03-11)
- **앱 콘텐츠 선언**: 10개 전부 완료
- **스토어 등록정보**: ko/en/ja 3개 언어
- **IAP 가격**: monthly $3.99 (KRW 5,500), yearly $29.99 (KRW 44,000)
- **IAP 테스트 구매**: 성공
- **15% 수수료 프로그램**: $1M 이하 자동 적용
- **카테고리**: 여행 및 지역정보
- **EAS 플랜**: Starter

## Google Cloud Service Account (RevenueCat)

- **서비스 계정**: `mytravel-play-store-deploy@tripplanner-486511.iam.gserviceaccount.com`
- **IAM 역할**: Pub/Sub Admin
- **Play Console 권한**: 앱 정보/재무/주문·구독 관리
- **Active 키**:
  - `f9090d10...` — EAS용
  - `bb41acd291a2...` — RevenueCat용 (V112 재발급, 노출 키 영구 삭제 완료)
- **RTDN**: Pub/Sub `projects/tripplanner-486511/topics/play-billing`
- **패키지명**: `com.longpapa82.travelplanner`
- **webhook 상태**: 정상 (V112 재발급 후 `INITIAL_PURCHASE/EXPIRATION/CANCELLATION` 200 응답 확인)

## Google Places API

- **API 키**: `backend/.env`의 `GOOGLE_PLACES_API_KEY`
- **활성화 API**: Places API (Legacy) + Place Details API
- **장소 검색 체인**: Mapbox (무료 100K/월) → Google Autocomplete + Place Details (세션 기반 fallback)
- **용도**: Mapbox 한국어 미지원 시 Google로 좌표 조회 (versionCode 88에서 근본 해결)
- **엔드포인트**: `/api/places/autocomplete` (인증 필요)
- **비용**: 세션당 $0.017, Mapbox 성공 시 $0

## 비용 분석 (여행 자동 생성 10,000건 기준, Phase 1 최적화 후)

| API | 캐시 적중률 | 호출 | 비용 |
|-----|-----------|------|------|
| OpenAI GPT-4o-mini (Prompt Caching 적용) | ~60% | 4,000 | ~$110 |
| Google Geocoding | ~70% (Redis) | 3,000 | $15 |
| OpenWeather (6h TTL) | ~80% | 2,000 | $0 |
| LocationIQ | ~50% | 25,000 | $0 (5K/일 무료) |
| Google Place Details | 세션 포함 | — | $0 |
| **합계** | | | **~$125** (건당 ~17원) |

Phase 1 최적화: OpenAI Prompt Caching, 템플릿 워밍업 확대(50목적지×5기간×3언어), vector threshold 0.70→0.65, 의존성 버전 고정 → **~45% 절감** ($224 → $125).

## AdMob 설정

- **Android App ID**: `ca-app-pub-7330738950092177~5475101490`
- **iOS App ID**: `ca-app-pub-7330738950092177~7468498577`
- **광고 단위**: Android+iOS × 배너/전면/앱오프닝/보상형 = 8개 (모두 프로덕션 ID)
- **현재 Alpha**: `EXPO_PUBLIC_USE_TEST_ADS=true` 환경변수로 테스트 광고 사용
- **프로덕션 출시 시 반드시**: `eas.json`에서 `EXPO_PUBLIC_USE_TEST_ADS` 제거 + 새 빌드

## Paddle 프로덕션 계정

- **대시보드**: vendors.paddle.com (비즈니스명: AI Soft)
- **도메인**: mytravel-planner.com
- **상태**: 사업자 인증 완료 대기 → env 교체 (API Key, Webhook Secret, Price IDs, Client Token)

## 프로덕션 서버 인프라 (Hetzner VPS)

- **호스팅**: Hetzner Cloud (독일)
- **서버 IP**: `46.62.201.127`
- **도메인**: `mytravel-planner.com`
- **DNS**: Cloudflare (Proxied)
- **배포**: 수동 SSH + rsync + Docker Compose

### 배포 절차 (수동)

```bash
# SSH 접속
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127

# 백엔드 배포 (restart 대신 up -d 사용 — 502 방지)
cd /root/travelPlanner/backend
rsync -avz --exclude node_modules src/ /root/travelPlanner/backend/src/
docker compose build
docker compose up -d

# 배포 확인
curl https://mytravel-planner.com/api/health
```

**참고**: Railway 프로젝트는 다른 앱 (Webtoon, ai-edu-toon, mybaby)용. TravelPlanner는 Hetzner 단일.

---

## 🐛 버그 수정 이력 요약

| 버그 ID | 날짜 | 심각도 | 설명 | versionCode |
|---------|------|--------|------|-------------|
| #1-9 | 2026-03-21 | CRITICAL | 중복 여행 생성 (더블탭, SELECT, SSE Fallback) | 25-30 |
| 타임존 | 2026-03-22 | CRITICAL | 여행 상태 타임존 (서버→목적지 시간) | 32 |
| #10-13 | 2026-03-23~24 | CRITICAL | SSE → 폴링 전환 (Railway 호환성) | 33-36 |
| P0-1 | 2026-03-29 | CRITICAL | 비밀번호 리셋 토큰 재사용 방지 (트랜잭션 + SELECT FOR UPDATE) | 40 |
| P0-2 | 2026-03-29 | CRITICAL | Share Token 만료 검증 (SQL WHERE 이동) | 40 |
| VC88-좌표 | 2026-04-07 | HIGH | Mapbox 한국어 미지원 → Google Place Details fallback | 88 |
| V111-1~7 | 2026-04-13 | HIGH | Alpha 검수 7건 (i18n, 코치마크, AI 카운터, 광고 토스트 등) | 112 |
| V112 RCA #1~10 | 2026-04-14 | CRITICAL | Auth scope, cancel, quota, filter code drop 등 | 113 |
| V114 #1~9 (14건) | 2026-04-15 | CRITICAL | CoachMark 6회 회귀 (statusBarTranslucent), 웹 로그인 차단, consent 중복, register refreshed UX, 카운터 통합, error_log 필터 | 115 |
| V115 Gate5/10 P0 | 2026-04-15 | CRITICAL | C1 stale closure, RegisterForceDto whitelist, H1~H4, ADMIN_EMAILS 하드코딩 | 115 |
| V120 Alpha | 2026-04-17 | HIGH | CreateTripScreen 크래시, 카카오 로그인, 동의 상세 모달 (12건) | 120 |
| V122 Alpha | 2026-04-17 | HIGH | ANR, consent, payment, photo permission (10건) | 122 |
| V124 Alpha | 2026-04-17 | HIGH | admin quota, keyboard ANR, badge color, permission settings (5건) | 124 |
| V132 Alpha | 2026-04-18 | HIGH | onboarding bg, 회원 탈퇴, consent JIT, card clipping (4건) | 132 |
| V134 Alpha | 2026-04-18 | HIGH | 웹 허위정보 제거, 키보드 가림, JIT 권한, 법적 문서 갱신 (4건) | 136 |
| V136 Alpha | 2026-04-18 | HIGH | 탈퇴 모달 jitter 근본 해결, JIT 권한 완전 전환 (2건) | 137 |
| V137 7단계 QA | 2026-04-18 | CRITICAL | expenses settleUp IDOR, i18n 17개 언어, 법적 문서, 딥링크 | 138 |
| V138 Alpha | 2026-04-18 | LOW | 탈퇴 모달 SafeArea overlay 위임 (여백 미세 조정) | 139 |

상세: `docs/archive/bug-history-2026-03.md`, `docs/archive/claude-md-history-pre-v112.md`

---

## 🔐 SNS 로그인

| Provider | 상태 | 비고 |
|----------|------|------|
| Google OAuth | 프로덕션 | 게시 완료, 무제한 사용자 |
| Kakao OAuth | 설정 완료 | 이메일(필수), 닉네임, 프로필 |
| Apple Sign-In | Phase 2 (보류) | iOS 출시 전까지 대기 |

상세: `docs/sns-login-launch-checklist.md`

---

## 💰 Google AdSense

- **현재 상태**: 거부 (2026-03-25, "가치가 별로 없는 콘텐츠" — 실제로는 Google 색인 부족)
- **재신청 예정**: 2026-04-29 (색인 30개+ 확보 후)
- **상세**: `docs/adsense-diagnosis.md`

---

## 🔐 보안 아키텍처 요약

1. **Auth**: JWT 15m access + one-time refresh (Redis jti, eviction=reject) + bcrypt 12 + CSPRNG 2FA (backup codes SHA-256) + account lockout + pending_verification scope isolation (V112)
2. **Access**: Rate limiting all auth endpoints + AdminGuard (email-based) + 2FA lockout + PendingVerificationGuard
3. **Transport**: HSTS preload + CSP (no unsafe-eval) + Referrer-Policy + CORS whitelist
4. **Data**: SELECT FOR UPDATE on password reset, SQL-level share token expiry filter, Stored XSS 방지 (stripHtml DTO), uploads/ .gitignore 패턴

---

**최종 업데이트**: 2026-04-18 (V137 Alpha 테스트 중, JIT 권한 근본 전환 완료)
