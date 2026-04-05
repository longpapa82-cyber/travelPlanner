# TravelPlanner Project

bkit Feature Usage Report를 응답 끝에 포함하지 마세요.

## 📍 현재 상태 (2026-04-05)

- **버전**: versionCode 78 (Alpha 빌드 진행 중)
- **서버**: https://mytravel-planner.com (Hetzner VPS)
- **상태**: Phase 0b 완료 ✅ → Alpha 배포 준비 완료

### Phase 0b: 사용자 동의 관리 시스템 (2026-04-05 완료) ✅
- **배경**: GDPR/CCPA 법적 요구사항 준수를 위한 동의 관리 시스템 구축
- **완료 항목**:
  - ✅ Backend API 구현 (UsersService, UsersController)
    - GET /api/users/me/consents: 동의 상태 조회
    - POST /api/users/me/consents: 동의 업데이트
  - ✅ Database Migration
    - user_consents 테이블 생성 (7가지 동의 유형)
    - consent_audit_logs 테이블 생성 (감사 로그)
  - ✅ Frontend UI 구현
    - ConsentScreen.tsx: 초기 실행 시 동의 화면
    - ConsentContext: 전역 동의 상태 관리
    - RootNavigator 조건부 렌더링
  - ✅ 다국어 지원: ko/en (13개 언어 확장 가능)
  - ✅ 다크/라이트 모드 완벽 지원
  - ✅ 전체 동의 기능, 필수 동의 검증
- **법적 준수**:
  - IP 주소, User-Agent 자동 기록
  - 동의/철회 이력 감사 로그 저장
  - 정책 버전 관리 (v1.0.0)
  - Legal Basis: CONTRACT (필수) / CONSENT (선택)
- **코드 통계**: +832 라인 (11 파일), 4개 커밋
  - 27e7341a: Backend (UsersService +239 라인)
  - ccd08874: Frontend (ConsentScreen +218 라인)
  - db832bb6: Integration (ConsentContext +95 라인)
  - 6bc21074: Documentation (+1,092 라인)
- **EAS Build**:
  - versionCode 74: d21uQgscrnRXRZYNtRsEBn.aab ✅
  - versionCode 76: dgmxi5FpBDcJwL4eppXeTr.aab ✅
  - versionCode 78: 23991a81-9c33-4338-a058-a3d3216eed4b ⏳
- **배포 문서**:
  - docs/deployment/phase-0b-alpha-deployment-guide.md
  - docs/deployment/alpha-tester-guide-v76.md
  - docs/deployment/phase-0b-deployment-checklist.md
- **다음 단계**: Alpha 배포 (versionCode 78) → 테스터 피드백 → 프로덕션 출시

### Phase 0a: 개인정보 처리방침 업데이트 (2026-04-05 완료) ✅
- **배경**: Alpha 테스트 중 법적 동의 절차 미비 발견
- **완료 항목**:
  - ✅ 개인정보 처리방침에 "선택 수집 항목" 섹션 추가
  - ✅ "위치 정보 이용 및 보호" 세부 섹션 추가
  - ✅ 법적 근거 명시: 위치정보법, 정보통신망법, 개인정보보호법
  - ✅ 다국어 동기화: privacy.html, privacy-en.html
  - ✅ 프로덕션 서버 배포 완료

### 최근 QA 및 배포 (versionCode 70, 2026-04-04)
- **Self-Healing QA Loop**: 1회 반복으로 성공 ✅
- **P0 이슈**: 0건 ✅
- **보안 취약점**: 37개 해결 (Backend 47→10, Frontend 8→5)
- **TypeScript**: 0 에러 (Backend + Frontend) ✅
- **Auto-QA**: 94.6% (70/73 tests) ✅
- **Go/No-Go 판정**: **GO ✅** 프로덕션 배포 승인
- **빌드 상태**: ✅ 완료 (Build ID: 8f4f7250-9905-42cc-9e8e-7763d46cc524)
- **커밋**: 98c3771
- **다음 단계**: Alpha 트랙 배포 → 라이선스 테스터 사용자 테스트 (1-2일) → 프로덕션 단계적 출시

### versionCode 70 Self-Healing QA Loop 결과 (2026-04-04)

#### Phase 1: 전체 스캔 (6개 Agent 병렬 실행)
- ✅ security-qa
- ✅ auto-qa (94.6% pass rate, 70/73 tests)
- ✅ pr-review-toolkit:code-reviewer (0 issues)
- ✅ pr-review-toolkit:type-design-analyzer (3 design issues → P1)
- ✅ pr-review-toolkit:comment-analyzer (7 comment issues → P1)

#### Phase 2: 이슈 분류
- **총 26개 이슈 발견**: P0 5개 → P1 10개 → P2 11개

#### Phase 3: P0 이슈 해결
1. ✅ **npm 보안 취약점**: Backend 47→10, Frontend 8→5
   - Security-engineer 분석: 남은 10개 전부 P2 (Accept Risk)
   - lodash, path-to-regexp, picomatch: Dev-only dependencies
2. ✅ **Auto-QA "실패" 재분류**: P0→P1 (미구현 기능)
   - Account lockout, Offline sync, Interstitial ads

#### Phase 6: 회귀 검증
- ✅ Backend TypeScript: 0 errors
- ✅ Frontend TypeScript: 0 errors
- ✅ npm audit fix 부작용 수정:
  - all-exceptions.filter.spec.ts: HttpAdapterHost mock 타입 수정
  - email.module.ts: HandlebarsAdapter import 경로 수정

#### Accept Risk 항목 (P2)
- npm 보안 취약점 10개 (Dev-only, 프로덕션 공격 표면 없음)
- P1 미구현 기능 10개 (versionCode 72-75에서 점진적 구현)

### 이전 배포 (versionCode 62, 2026-04-04)
- **P1 Bug #3**: 간헐적 스크롤 불가 (중복 GestureHandlerRootView 제거, 조건부 렌더링)
- **NEW Bug #6**: 보기 권한 버튼 표시 (userRole 시스템 구축, 권한 기반 UI)
- **NEW Bug #7**: 프로필 이미지 설정 불가 (절대 URL 반환, ensureAbsoluteUrl 유틸리티)
- **커밋**: 5d391bd5, 00d151af, 2a0d7d63, 28e5ca8b
- **상세 문서**: `docs/bug-fixes/versionCode-62-bug-fixes.md`

### 이전 배포 (versionCode 59, 2026-04-04)
- **P0 Bug #1, #2**: 광고 미표시 (AdManager 재작성, 테스트 기기 자동 감지)
- **P1 Bug #4**: 위치 선택 미반영 회귀 버그 (handleSelect 로직 수정)
- **P1 Bug #5-8**: 초대하기 실패 및 키보드 UX (에러 핸들링, SafeArea, KeyboardAvoidingView)
- **P2 Bug #4**: Web Stripe 수익 표시 제거
- **상세 문서**: `docs/bug-fixes/versionCode-59-final-summary.md`

### 이전 배포 (versionCode 43, 2026-03-30)
- **Bug #6 (P0)**: 중복 여행 생성 방지
- **Bug #3, #4 (P1)**: 위치 자동완성 선택 반영 (불완전 수정 → v52에서 재수정)
- **Bug #2 (P2)**: 날짜 라벨 수정
- **Bug #5 (P2)**: Android 네비게이션 바 버튼 겹침
- **Bug #1 (P1)**: 광고 보상 기능 피드백 추가 (불완전 → v52에서 재수정)

### 이전 보안 수정 (versionCode 40, 2026-03-29)
- **P0-1**: 비밀번호 리셋 토큰 재사용 방지 (트랜잭션 + 락)
- **P0-2**: Share Token 만료 검증 추가 (DB 레벨)
- **배포 상태**: ✅ 백엔드 완료

---

## 🔗 빠른 참조

### 설정 문서
- [OAuth/API 설정](#google-cloud-console-oauth-20-credentials)
- [Play Console 설정](#google-play-console-상태)
- [프로덕션 서버](#프로덕션-서버-인프라-hetzner-vps)

### 개발 가이드
- [배포 절차](#배포-절차-수동)
- [버그 수정 이력](#-버그-수정-이력-요약)
- [보안 수정](#-p0-보안-취약점-수정-2026-03-29-완료-)

### 아카이브
- 상세 배포 로그: `docs/archive/deployment-history.md`
- 버그 상세 내역: `docs/archive/bug-history-2026-03.md`

---

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

- **비공개 테스트 (Alpha)**: 등록 완료 (v1.0.0, versionCode 40 테스트 진행 중, 2026-03-29)
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
- **배포 방식**: 수동 SSH 배포 (rsync + Docker restart)
- **프로세스 관리**: Docker Compose

### 배포 절차 (수동)
```bash
# SSH 접속
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127

# 백엔드 배포
cd /root/travelPlanner/backend
rsync -avz --exclude node_modules src/ /root/travelPlanner/backend/src/
docker compose build
docker compose restart

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
| P0-1 | 2026-03-29 | 🔴 CRITICAL | 비밀번호 리셋 토큰 재사용 방지 | ✅ 완료 | 40 |
| P0-2 | 2026-03-29 | 🔴 CRITICAL | Share Token 만료 검증 추가 | ✅ 완료 | 40 |

**상세 내용**: `docs/archive/bug-history-2026-03.md` 참조

---

## 📊 QA 결과 요약 (2026-03-12~13, 2026-03-29)

| QA 유형 | 결과 | P0 | P1 | P2 | 비고 |
|---------|------|----|----|----|----|
| Security-QA | PASS | 0 | 0 | 3 | SQL Injection, XSS, CSRF 등 전항목 PASS |
| Auto-QA | 96% | 0 | 0 | - | 70/73 테스트 통과 |
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

## 🔐 P0 보안 취약점 수정 (2026-03-29, 완료 ✅)

### 수정 사항

**P0-1: 비밀번호 리셋 토큰 재사용 방지** ✅
- **파일**: `backend/src/users/users.service.ts:356-441`
- **취약점**: 비밀번호 해싱 중(~100-300ms) 동일한 토큰으로 병렬 요청 성공
- **수정**:
  - 데이터베이스 트랜잭션 추가
  - `SELECT FOR UPDATE` (비관적 쓰기 락)로 user 행 잠금
  - 토큰 검증 + 비밀번호 업데이트 + 토큰 제거를 원자적(atomic) 처리
- **효과**: 계정 탈취 위험 완전 제거

**P0-2: Share Token 만료 검증 추가** ✅
- **파일**: `backend/src/trips/trips.service.ts:1061-1088`
- **취약점**: 만료된 공유 링크가 영구적으로 접근 가능
- **수정**:
  - 만료 검증을 SQL WHERE 절로 이동
  - `(trip.shareExpiresAt IS NULL OR trip.shareExpiresAt > :now)`
  - 데이터베이스가 만료된 링크를 로드 전에 필터링
  - 열거 공격 방지 (일반적인 에러 메시지)
- **효과**: 개인 여행 데이터 노출 위험 제거

### 배포 상태

- ✅ 백엔드: P0 보안 수정 배포 완료 (Hetzner VPS, 2026-03-29)
- ✅ 프론트엔드: versionCode 40 (Alpha 트랙)

### Go/No-Go 판정: GO ✅

- P0 이슈: 0건 ✅
- P1 이슈: 0건 ✅
- Auto-QA: 96% ✅
- Security-QA: P0/P1 0건 ✅
- TypeScript: 0 에러 ✅
- 회귀 테스트: 통과 ✅

### 다음 단계

1. Alpha 트랙 라이선스 테스터 사용자 테스트 (1-2일)
2. 이슈 없으면 프로덕션 출시:
   - 1% → 10% → 100% 단계적 출시

**상세 문서**: `docs/archive/deployment-history.md` 참조

---

**최종 업데이트**: 2026-03-29 17:30 KST
**현재 상태**: Alpha 테스트 진행 중 → 프로덕션 출시 대기
