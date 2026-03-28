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

- **비공개 테스트 (Alpha)**: 등록 완료 (v1.0.0, versionCode 37 검토 중)
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

## Google Places API

- **프로젝트**: tripPlanner (tripplanner-486511)
- **API 키**: AIzaSyC35ndnoqvz4460uBwaKQ_f8soRVF_aeaE (backend/.env)
- **활성화 상태**: ✅ 활성화 완료 (2026-03-28)
- **활성화된 API**: Places API (Legacy)
- **용도**: 위치 자동완성 (manual activity creation)
- **월간 한도**: 9,500회 (무료 한도 10,000회 중 95%)
- **엔드포인트**: `/api/places/autocomplete` (인증 필요)
- **프론트엔드**: PlacesAutocomplete 컴포넌트 + Fallback UI
- **비용**: $0 (무료 한도 내)

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

## 프로덕션 서버 인프라 (Hetzner VPS)

- **호스팅**: Hetzner Cloud (독일 VPS)
- **서버 IP**: `46.62.201.127`
- **도메인**: `mytravel-planner.com`
- **DNS**: Cloudflare (Proxied, A 레코드)
- **역방향 DNS**: `static.127.201.62.46.clients.your-server.de`
- **배포 방식**: 수동 SSH 배포 (Git pull + restart)
- **프로세스 관리**: PM2 또는 systemd (확인 필요)

### 배포 절차 (수동)
```bash
# SSH 접속
ssh user@46.62.201.127

# 백엔드 배포
cd /path/to/travelPlanner/backend
git pull origin main
npm install
pm2 restart travelplanner  # 또는 systemd restart

# 배포 확인
curl https://mytravel-planner.com/api/health
```

### 참고사항
- Railway 프로젝트(loyal-curiosity, innovative-reprieve, affectionate-celebration)는 다른 프로젝트(Webtoon, ai-edu-toon, mybaby)용
- TravelPlanner는 Hetzner VPS에서만 운영 중
- Cloudflare를 통한 프록시 및 DDoS 보호 적용

---

## 🐛 버그 수정 이력 (요약)

| 버그 ID | 날짜 | 심각도 | 설명 | 상태 | versionCode |
|---------|------|--------|------|------|------------|
| #1-9 | 2026-03-21 | 🔴 CRITICAL | 중복 여행 생성 (더블탭, SELECT 쿼리, SSE Fallback 등) | ✅ 완료 | 25-30 |
| #13 | 2026-03-24 | 🟢 MEDIUM | SSE → 폴링 방식 전환 (Railway 호환성) | ✅ 완료 | 36 |
| #14 | 2026-03-24 | 🟢 LOW | 관리자 AI 생성 제한 해제 | ✅ 완료 | 25 |
| #15 | 2026-03-24 | 🟢 LOW | 백엔드 인증 에러 i18n 지원 | ✅ 완료 | - |
| #16 | 2026-03-24 | 🟢 LOW | 브라우저 비밀번호 저장 팝업 제거 | ✅ 완료 | - |
| 타임존 | 2026-03-22 | 🔴 CRITICAL | 여행 상태 타임존 버그 (서버 시간 → 목적지 시간) | ✅ 완료 | 32 |
| #10-12 | 2026-03-23~24 | 🔴 CRITICAL | SSE 버퍼링 (Railway 프록시) → Bug #13으로 해결 | ✅ 완료 | 33-35 |

**상세 내용**: `docs/bug-fixes-history.md` 참조

---

## 📊 QA 결과 요약 (2026-03-12~13)

| QA 유형 | 결과 | P0 | P1 | P2 | 비고 |
|---------|------|----|----|----|----|
| Security-QA | PASS | 0 | 0 | 3 | SQL Injection, XSS, CSRF 등 전항목 PASS |
| Auto-QA | 95.6% | 0 | 0 | - | 43/45 테스트 통과, AdminGuard 자동 수정 |
| Feature-Troubleshoot | PASS | 0 | 0 | - | 모두 기존 구현 확인 |
| Publish-QA | 100% | 0 | 0 | - | Google Play 정책 10/10 PASS |
| 회귀 테스트 | PASS | - | - | - | Frontend/Backend TypeScript 0 에러, Jest 597/597 PASS |

**상세 문서**: `docs/qa-master-plan.md`

---

## 🔐 SNS 로그인 설정 (2026-03-20, 검증 완료 ✅)

| Provider | 상태 | Client ID | 비고 |
|----------|------|-----------|------|
| Google OAuth | ✅ 프로덕션 | `48805541090-n13j...` | 게시 완료, 무제한 사용자 |
| Kakao OAuth | ✅ 설정 완료 | `91c9b16550779b...` | 이메일(필수), 닉네임, 프로필 사진 |
| Apple Sign-In | ⏸️ Phase 2 | - | iOS 출시 전까지 보류 (2-4주 후) |

**상세 가이드**: `docs/sns-login-launch-checklist.md`

---

## 💰 Google AdSense 상태

- **거부 통지**: 2026-03-25 ("가치가 별로 없는 콘텐츠")
- **실제 원인**: Google 색인 부족 (콘텐츠는 49개 페이지로 충분)
- **해결 방안**: Search Console 설정 완료 ✅, 색인 모니터링 진행 중
- **재신청 예정**: 2026-04-29 (5주 후, 색인 30개+ 확보 시)
- **승인 예상**: 2026-05-13 (7주 후)

**상세 진단**: `docs/adsense-diagnosis.md` 참조

---

## 🚀 Production Deployment Log

### versionCode 37 배포 (2026-03-27, 진행 중 ⏳)

**배포 목적**: P0/P1 보안 수정 (토큰 해싱)

#### 보안 수정 사항
- ✅ **P0**: 비밀번호 리셋 토큰 SHA-256 해싱
- ✅ **P1**: 이메일 인증 토큰 SHA-256 해싱
- 파일: `backend/src/users/users.service.ts`
- 영향: DB 유출 시에도 토큰 재사용 불가

#### QA 결과 (plan-q)
- Security-QA: P0 1건, P1 2건 → 모두 수정 완료
- Auto-QA: 95.6% (43/45), AdminGuard 자동 수정
- Feature-Troubleshoot: 모두 기존 구현 확인
- Publish-QA: 100% Play 정책 준수

#### 배포 이력

**백엔드 (Hetzner VPS)**:
- Commit: `a2f7da3e`, `0405312d`
- 배포 상태: ✅ 완료 (2026-03-27 15:xx KST)
- 배포 확인: `curl https://mytravel-planner.com/api/health` → `{"status":"ok"}`

**프론트엔드 (EAS Build)**:
- Build ID: `b62f0d12-c3e1-41fa-adc9-15ab98c77de4`
- versionCode: **37**
- AAB: https://expo.dev/artifacts/eas/ouPkMsbob8uueZjxeCT9r3.aab (68 MB)
- 빌드 상태: ✅ 완료 (2026-03-27 15:44 KST)

**Play Console (Alpha Track)**:
- 업로드: 2026-03-27 15:45 KST
- 출시 노트: ko/en/ja 3개 언어
- 검사 상태: ⏳ Google 자동 검사 진행 중 (최대 14분)
- 예상 완료: ~15:59 KST

#### 기술 문서
- 출시 노트: `docs/release-notes-v37.md`
- 버그 수정 이력: `docs/bug-fixes-history.md`
- AdSense 진단: `docs/adsense-diagnosis.md`
- QA 계획: `docs/qa-master-plan.md`

---

## 후순위 작업 (Backlog)

### URL 노출 최소화 작업 (2026-03-27, 보류)

**배경**: Android 앱 선출시 시 mytravel-planner.com 노출 최소화 필요
- 웹사이트는 광고/결제 미구현 상태 (무료 서비스)
- 사용자가 앱 우회하여 웹 접속 가능성 차단 필요

**분석 완료** (`docs/url-exposure-analysis.md`):
- 총 65개 노출 지점 발견
- 앱 코드 수정 가능: 10개
- Play Store 정책상 필수: 51개 (17개 언어 × 3개 URL)
- OAuth 기술 요구사항: 4개

**권장 조치**:
1. **P0 - 앱 코드 URL 제거** (2시간)
   - PaywallModal.tsx: 이용약관/개인정보처리방침 링크 → WebView 전환
   - HomeScreen.tsx: 공유 메시지 URL → 딥링크로 대체
2. **P1 - nginx 웹 접근 제어** (1일)
   - 일반 페이지 접근 차단
   - Legal 문서 + API + OAuth만 허용
3. **선택 - API 서브도메인 분리** (4-6시간)
   - api.mytravel-planner.com 별도 구성

**보류 사유**: Alpha 출시 후 사용자 피드백 기반 우선순위 재조정
**재검토 시점**: Alpha 테스트 완료 후 (2-3일 후)

---

## 긴급 이슈 해결 (2026-03-27)

### 🔴 Issue #3: AI 생성 실패 시 카운터 소진 버그 (P0, 완료 ⏳ 배포 대기)

**증상**:
- 테스트 계정 (j090723@naver.com): AI 생성 3/3 → 실패 → 0/3으로 모두 소진
- 실제로는 여행 생성 안됨

**근본 원인** (feature-troubleshooter 분석):
- `trips.service.ts` 트랜잭션 범위 설계 결함
- AI 카운터 증가 후 즉시 커밋 → 이후 timezone/weather/AI 작업은 트랜잭션 밖
- 실패 시 롤백 불가능 (이미 커밋됨)

**수정 내역**:
- ✅ 트랜잭션 범위 확장: 모든 작업을 트랜잭션 내 포함
- ✅ 커밋을 메서드 끝으로 이동 (line 352)
- ✅ 어떤 단계에서든 실패 시 → 전체 롤백 (AI 카운터 포함)
- ✅ Git 커밋: `c93da3de` (feature-troubleshooter)

**배포 필요**:
- ⏳ Hetzner VPS 백엔드 배포 (사용자 수동)
- ⏳ 테스트 계정 AI 카운터 복구 SQL 실행
- 📄 배포 가이드: `docs/backend-deployment-guide.md`

### 🟢 Issue #1: 지도 탭 Google Maps 브라우저 이탈 (P1, 완료 ✅)

**증상**:
- 지도 이미지/활동 클릭 → 기기 브라우저에서 Google Maps 페이지 열림
- 네이티브 앱에서 완전 이탈, UX 저하

**해결 방안** (Wanderlog 벤치마킹):
- Alert 다이얼로그로 지도 앱 선택 제공
- Google Maps / Apple Maps 딥링크 사용 (comgooglemaps://, geo:, maps://)
- 앱 미설치 시 브라우저 폴백

**수정 내역**:
- ✅ `TripMapView.tsx`: Alert 다이얼로그 + 딥링크 구현
- ✅ 17개 언어 i18n 번역 추가 (ko, en, ja, zh, es, de, fr, th, vi, pt, ar, id, hi, it, ru, tr, ms)
- ✅ TypeScript 컴파일: 0 에러
- ✅ Git 커밋: `eb70fe02`
- ✅ GitHub 푸시: 완료

**다음 단계**:
- versionCode 38 EAS 빌드 (선택, 또는 다음 배포 시 포함)

### ⏳ Issue #2: 비밀번호 저장 팝업 (P2, 진단 대기)

**증상**:
- 프로필 버튼 클릭 → 광고 + "비밀번호를 Google에 저장하시겠습니까?" 팝업

**상태**: 우선순위 낮음, Issue #3 배포 후 진단 예정

### 🔴 Issue #4: 허위 광고 - 프리미엄 "무제한 AI" 표기 (P0, 완료 ✅)

**심각도**: 🔴 CRITICAL - 법적 리스크 / 허위 광고

**문제**:
- 구독 안내에서 "무제한 AI 생성"이라고 표기하지만 실제로는 **월 30회 제한**
- 영향 범위: 22개 파일, 17개 언어 모두 잘못된 표기
- 법적 리스크: 허위 광고, 소비자 보호법 위반 가능, App Store 정책 위반 가능

**감사 결과** (Explore agent):
- SubscriptionScreen.tsx line 135: 무한대 기호 `∞` 사용
- 17개 premium.json: "Unlimited AI" 표기 (5개 키 각각)
- 2개 legal.json: "unlimited AI generation" 표기

**실제 제한** (백엔드 확인):
- backend/src/trips/trips.service.ts: `AI_TRIPS_PREMIUM_LIMIT=30` (lines 91-164)
- backend/.env: `AI_TRIPS_PREMIUM_LIMIT=30`

**수정 내역** (20개 파일):
- ✅ 17개 premium.json: 5개 키 수정 (ko 수동 + 16개 Python 스크립트)
  - premium.description: "Unlimited AI" → "30 AI/month"
  - benefits.unlimitedAi: "Unlimited AI trip planning" → "30 AI trips per month"
  - paywall.subtitle: "unlimited AI..." → "30 AI trips per month..."
  - promo.subtitle: "Unlimited AI..." → "30 AI/month..."
  - context.aiLimitSubtitle: "unlimited AI trip plans" → "30 AI trips per month"
- ✅ SubscriptionScreen.tsx line 135: `\u221E` → `'30/mo'`
- ✅ legal.json (en, ko): "unlimited AI generation" → "30 AI generations per month"
- ✅ Git 커밋: `6fc16476`
- ✅ GitHub 푸시: 완료

**문서**:
- 📄 감사 보고서: `docs/premium-unlimited-ai-audit.md`
- 📄 상세 분석: `docs/subscription-ai-limits-analysis.md`

**예상 효과**:
- ✅ 법적 리스크 제거
- ✅ App Store 정책 준수
- ✅ 사용자 신뢰 회복 (정직한 표기)

---

**최종 업데이트**: 2026-03-28 09:30 KST
**배포 담당**: SuperClaude (Explore + 체계적 수정)
**현재 상태**: Issue #1 완료, Issue #3 배포 완료, Issue #4 완료
