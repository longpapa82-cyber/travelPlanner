# TravelPlanner 상용 서비스 QA 마스터 플랜

> **작성일**: 2026-03-12
> **목표**: Google Play Store 프로덕션 출시 전 유료/상용 서비스 수준의 품질 보증
> **대상 버전**: v1.0.0 (versionCode 17+)

---

## 목차

1. [QA 전략 개요](#1-qa-전략-개요)
2. [Stream 1: Playwright E2E 테스트](#2-stream-1-playwright-e2e-테스트)
3. [Stream 2: Auto-QA 자동 검수](#3-stream-2-auto-qa-자동-검수)
4. [Stream 3: Security-QA 보안 검수](#4-stream-3-security-qa-보안-검수)
5. [Stream 4: Publish-QA 스토어 규정 검수](#5-stream-4-publish-qa-스토어-규정-검수)
6. [실행 일정 및 우선순위](#6-실행-일정-및-우선순위)
7. [Go/No-Go 판정 기준](#7-gono-go-판정-기준)

---

## 1. QA 전략 개요

### 1.1 4-Layer QA 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Go/No-Go 판정                              │
├─────────────┬──────────────┬──────────────┬─────────────────┤
│  Stream 1   │  Stream 2    │  Stream 3    │   Stream 4      │
│ Playwright  │  Auto-QA     │ Security-QA  │  Publish-QA     │
│ E2E 테스트   │  자동 검수    │  보안 검수    │  스토어 규정     │
├─────────────┼──────────────┼──────────────┼─────────────────┤
│ 기능 정합성  │ 코드 품질     │ 취약점 탐지   │ 정책 준수       │
│ UX 흐름     │ 런타임 버그   │ 인증/인가    │ 메타데이터      │
│ 크로스브라우저│ 회귀 테스트   │ 데이터 보호   │ 법적 준수       │
│ 성능 지표    │ 엣지 케이스   │ API 보안     │ 결제 규정       │
│ 접근성      │ i18n 검증    │ 인프라 보안   │ 콘텐츠 등급     │
└─────────────┴──────────────┴──────────────┴─────────────────┘
```

### 1.2 심각도 분류

| 등급 | 정의 | 출시 영향 |
|------|------|----------|
| **P0 — Blocker** | 앱 크래시, 데이터 유실, 결제 오류, 보안 취약점 | 반드시 수정 후 출시 |
| **P1 — Critical** | 핵심 기능 장애, UX 심각 저해, 정책 위반 가능성 | 수정 강력 권고 |
| **P2 — Major** | 부가 기능 오류, 성능 저하, 일부 언어 깨짐 | 출시 후 1주 내 수정 |
| **P3 — Minor** | UI 미세 조정, 개선 제안 | 백로그 등록 |

### 1.3 테스트 환경

| 환경 | URL/설정 | 용도 |
|------|----------|------|
| **Local** | localhost:3000 + localhost:19006 | 개발 단위 테스트 |
| **Staging** | Hetzner (46.62.201.127) | E2E + Auto-QA |
| **Production** | mytravel-planner.com | Smoke + Publish-QA |
| **기기** | Android (Play Store 비공개 테스트) | 네이티브 IAP 검증 |

---

## 2. Stream 1: Playwright E2E 테스트

### 2.1 목표
기존 38개 E2E spec + 10개 smoke test를 **유료 서비스 기준**으로 강화하여, 사용자가 결제하고 사용하는 모든 흐름이 정상 동작함을 보증

### 2.2 테스트 매트릭스

#### Phase A: Critical Path (P0) — 반드시 통과

| # | 테스트 시나리오 | 기존 spec | 검증 항목 | 예상 시간 |
|---|----------------|-----------|----------|----------|
| A1 | **회원가입 → 이메일 인증 → 로그인** | 01-onboarding | 이메일 인증 플로우, 에러 메시지, 리다이렉트 | 3min |
| A2 | **소셜 로그인 (Google/Kakao/Apple)** | 15-sns-auth | OAuth 리다이렉트, 계정 연동, 토큰 발급 | 5min |
| A3 | **AI 여행 생성 (무료 3회 제한)** | 03-trip-creation | 도시 검색, AI 생성, 3회 초과 시 페이월 | 8min |
| A4 | **프리미엄 구독 플로우** | 20-business | RevenueCat IAP, 구독 후 광고 제거, 무제한 AI | 5min |
| A5 | **여행 상세 → 일정 → 활동 CRUD** | 04, 05 | 활동 추가/수정/삭제/순서변경, 날씨/시간대 표시 | 5min |
| A6 | **결제 후 기능 해제 확인** | 신규 | 프리미엄 배지, 광고 미노출, AI 제한 해제 | 3min |
| A7 | **구독 해지 → 무료 전환** | 신규 | 구독 관리 URL, 해지 후 광고 복원, AI 제한 복원 | 3min |

#### Phase B: User Journey (P1) — 강력 권고

| # | 테스트 시나리오 | 기존 spec | 검증 항목 |
|---|----------------|-----------|----------|
| B1 | **신규 사용자 온보딩 전체 흐름** | 10-user-journey-new | 튜토리얼 → 첫 여행 생성 → 공유 |
| B2 | **재방문 사용자 흐름** | 11-user-journey-returning | 자동 로그인 → 기존 여행 편집 → 새 여행 |
| B3 | **여행 라이프사이클** | 12-trip-lifecycle | 생성 → 편집 → 협업 → 완료 → 삭제 |
| B4 | **협업 기능** | 21-collaborator | 초대 → 수락 → 공동 편집 → 탈퇴 |
| B5 | **프로필 편집 + 2FA** | 06, 22-two-factor | 닉네임, 프로필 사진, 2FA 활성화/로그인 |
| B6 | **여행 복제 + GDPR 내보내기** | 25-trip-duplicate | 여행 복제, 개인정보 JSON 내보내기 |
| B7 | **공지사항 시스템** | 27-announcements | 알림 벨, 목록, 상세, 읽음 처리 |
| B8 | **이미지 업로드** | 24-image-upload | 프로필/여행 이미지 업로드, 리사이즈 |

#### Phase C: Cross-cutting (P1~P2)

| # | 테스트 시나리오 | 기존 spec | 검증 항목 |
|---|----------------|-----------|----------|
| C1 | **17개 언어 i18n** | 07-share-i18n | 모든 화면 번역 누락 없음, RTL (ar) 레이아웃 |
| C2 | **반응형 + 에러 처리** | 08-responsive | 모바일/태블릿/데스크톱 레이아웃, 네트워크 에러 |
| C3 | **접근성 (a11y)** | 13-accessibility | axe-core 스캔, 명암비, 키보드 내비게이션 |
| C4 | **비주얼 리그레션** | 14-visual-regression | 스크린샷 비교, 주요 화면 UI 깨짐 |
| C5 | **네트워크 조건** | 18-network-conditions | 느린 3G, 오프라인 → 온라인 복구 |
| C6 | **데이터 무결성** | 19-data-integrity | 동시 수정 충돌, 트랜잭션 정합성 |
| C7 | **Auth 엣지 케이스** | 16-auth-edge | 만료 토큰, 동시 로그인, 비밀번호 재설정 |
| C8 | **날씨/시간대 외부 API** | 17-weather-timezone | OpenWeather/Google Timezone 응답 검증 |

#### Phase D: Performance & Destructive (P2)

| # | 테스트 시나리오 | 기존 spec | 검증 항목 |
|---|----------------|-----------|----------|
| D1 | **성능 스트레스 테스트** | 09-destructive | 100개 여행 로딩, 메모리 누수, API 지연 |
| D2 | **계정 삭제 (파괴적)** | 09-destructive | 완전 삭제, 관련 데이터 cascade, 재가입 |
| D3 | **Response Envelope 형식** | 26-response-envelope | 모든 API 응답 표준 형식 준수 |
| D4 | **OAuth 리다이렉트 딥링크** | 28-oauth-redirect | 앱→웹→앱 딥링크 체인 |

#### Phase E: Production Smoke (출시 직전)

| # | 테스트 시나리오 | spec | 합격 기준 |
|---|----------------|------|----------|
| E1 | **API Health** | smoke/health | 200 OK, < 500ms |
| E2 | **Auth Endpoints** | smoke/auth | 로그인/회원가입 엔드포인트 응답 |
| E3 | **Landing Pages** | smoke/landing | ko/en/ja 페이지 200 OK |
| E4 | **Legal Pages** | smoke/legal | 개인정보/이용약관 링크 유효 |
| E5 | **Core Web Vitals** | smoke/performance | LCP < 2.5s, FCP < 1.8s, CLS < 0.1 |
| E6 | **반응형 뷰포트** | smoke/responsive | 3개 뷰포트 깨짐 없음 |
| E7 | **SEO** | smoke/seo | sitemap.xml, hreflang 17개, 메타태그 |
| E8 | **GDPR Export** | smoke/gdpr | /users/me/export 엔드포인트 접근 가능 |
| E9 | **404 Page** | smoke/404 | 커스텀 404 페이지 |
| E10 | **Static Assets** | smoke/static-assets | favicon, manifest.json, robots.txt |

### 2.3 신규 추가 필요 테스트 (기존 38개에 보완)

| # | 신규 spec 제안 | 우선순위 | 이유 |
|---|---------------|---------|------|
| N1 | `29-premium-lifecycle.spec.ts` | P0 | 구독→해지→재구독 전체 라이프사이클 (유료 서비스 핵심) |
| N2 | `30-ad-display.spec.ts` | P1 | 무료 사용자 광고 표시, 프리미엄 광고 제거 검증 |
| N3 | `31-free-tier-limits.spec.ts` | P0 | AI 3회 제한 → 페이월 → 구독 → 제한 해제 |
| N4 | `32-admin-dashboard.spec.ts` | P2 | 관리자 대시보드 전체 기능 (API 사용량, 에러 로그 등) |
| N5 | `smoke/subscription.spec.ts` | P0 | 프로덕션 구독 API 엔드포인트 상태 확인 |

### 2.4 실행 명령어

```bash
# Phase A: P0 Critical Path (로컬)
npm run test:p0

# Phase B~D: 전체 테스트 (8 워커 병렬)
npm run test:parallel

# Phase C: 크로스브라우저 (Chrome + Firefox + Safari)
npm run test:cross-browser

# Phase E: 프로덕션 Smoke
npm run test:prod

# 리포트 확인
npm run test:report
```

### 2.5 합격 기준

| 항목 | 기준 |
|------|------|
| P0 테스트 통과율 | **100%** (0 실패 허용) |
| 전체 테스트 통과율 | **≥ 95%** (flaky 허용 한도 5%) |
| 크로스브라우저 | 3개 브라우저 모두 주요 흐름 통과 |
| 프로덕션 Smoke | **100%** (10/10 통과) |
| Core Web Vitals | LCP < 2.5s, FCP < 1.8s, CLS < 0.1 |

---

## 3. Stream 2: Auto-QA 자동 검수

### 3.1 목표
auto-qa 에이전트를 활용하여 코드 레벨에서 **런타임 버그, 로직 오류, 엣지 케이스, 회귀 결함**을 자동 탐지하고 수정

### 3.2 검수 범위

#### Category A: 인증/인가 흐름 (P0)

| # | 검수 항목 | 대상 파일 | 검증 내용 |
|---|----------|----------|----------|
| A1 | JWT 토큰 라이프사이클 | auth.service.ts, jwt.strategy.ts | 15분 만료, refresh 일회용, Redis jti 검증 |
| A2 | 소셜 로그인 콜백 | google.strategy.ts, kakao.strategy.ts | OAuth 토큰 교환, 계정 생성/연동, 에러 처리 |
| A3 | 2FA 활성화/검증 | auth.controller.ts, auth.service.ts | TOTP 생성, QR코드, 복구 코드, 로그인 시 검증 |
| A4 | 계정 잠금 | auth.service.ts | 5회 실패 → 잠금, 잠금 해제 조건 |
| A5 | 비밀번호 재설정 | auth.service.ts | 토큰 생성, 만료, 재사용 방지 |

#### Category B: 결제/구독 시스템 (P0)

| # | 검수 항목 | 대상 파일 | 검증 내용 |
|---|----------|----------|----------|
| B1 | RevenueCat 웹훅 처리 | subscription.service.ts | 이벤트 타입별 처리 (INITIAL_PURCHASE, RENEWAL, CANCELLATION 등) |
| B2 | Paddle 웹훅 처리 | subscription.controller.ts | unmarshal async/await, 서명 검증, 이벤트 라우팅 |
| B3 | 프리미엄 상태 동기화 | PremiumContext.tsx | localPremiumOverride, RevenueCat SDK 상태, 서버 동기화 |
| B4 | AI 사용량 제한 | ai.service.ts, PremiumContext.tsx | 무료 3회/월 카운팅, 프리미엄 무제한, 월초 리셋 |
| B5 | 광고 표시 로직 | AdBanner, PremiumContext | 무료→광고 표시, 프리미엄→즉시 제거, 로그아웃 깜빡임 방지 |
| B6 | 구독 관리 URL | SubscriptionScreen.tsx | Play Store 구독 관리 딥링크 (패키지명 포함) |

#### Category C: 핵심 비즈니스 로직 (P1)

| # | 검수 항목 | 대상 파일 | 검증 내용 |
|---|----------|----------|----------|
| C1 | AI 여행 생성 | ai.service.ts | OpenAI 호출, JSON 파싱, 실패 시 재시도, circuit breaker |
| C2 | 지오코딩 4단계 캐시 | geocoding.service.ts | 메모리→Redis→DB→API 순서, 캐시 무효화 |
| C3 | 여행 CRUD | trips.service.ts | 생성, 수정, 삭제 cascade, 소유자 권한 검증 |
| C4 | 협업자 관리 | collaborator 로직 | 초대, 수락, 편집 권한, 탈퇴 (DELETE /trips/:id/leave) |
| C5 | 비용 분할 | expenses.service.ts | 금액 계산, 통화 처리, 분할 정합성 |

#### Category D: 외부 API 연동 (P1)

| # | 검수 항목 | 대상 파일 | 검증 내용 |
|---|----------|----------|----------|
| D1 | OpenAI 장애 대응 | ai.service.ts | 타임아웃, 재시도 (3회), circuit breaker 동작 |
| D2 | LocationIQ 폴백 | geocoding.service.ts | LocationIQ 실패 시 Google Maps 폴백 |
| D3 | OpenWeather 응답 | weather 관련 | 날씨 데이터 파싱, 단위 변환 |
| D4 | Google Timezone | timezone 관련 | 시간대 변환 정확성, formatDate 버그 재발 방지 |

#### Category E: 관리자 기능 (P2)

| # | 검수 항목 | 대상 파일 | 검증 내용 |
|---|----------|----------|----------|
| E1 | AdminGuard 권한 검증 | admin.guard.ts | 비관리자 접근 차단, 이메일 목록 검증 |
| E2 | API 사용량 대시보드 | api-usage.service.ts | fire-and-forget 로깅, 집계 정확성 |
| E3 | 에러 로그 수집 | error-log.service.ts | 5xx 자동 기록, rate limit 100/min |
| E4 | 공지사항 CRUD | announcement.service.ts | 발행/철회, 읽음 처리, 2분 폴링 |
| E5 | 감사 로그 | audit.service.ts | 30일 보존, 관리자 행동 기록 |

#### Category F: i18n & UI (P2)

| # | 검수 항목 | 대상 | 검증 내용 |
|---|----------|------|----------|
| F1 | 17개 언어 번역 키 누락 | locales/*.json | 모든 네임스페이스 × 17개 언어 키 존재 확인 |
| F2 | 아랍어 RTL 레이아웃 | 전체 화면 | RTL 방향, 아이콘 미러링, 텍스트 정렬 |
| F3 | 날짜/시간/통화 포맷 | 각 화면 | 로케일별 올바른 포맷 (예: 미국 MM/DD, 한국 YYYY.MM.DD) |
| F4 | 긴 텍스트 오버플로 | 버튼, 레이블 | 독일어/러시아어 등 긴 텍스트 UI 깨짐 |

### 3.3 실행 방법

```
# Claude Code에서 auto-qa 에이전트 실행
# 각 Category별 순차 또는 병렬 실행

1. 인증/결제 (P0): auto-qa → auth + subscription 모듈 집중 검수
2. 비즈니스 로직 (P1): auto-qa → trips + ai + geocoding 검수
3. 외부 API (P1): auto-qa → 외부 API 연동부 장애 시나리오 검수
4. 관리자/i18n (P2): auto-qa → admin + i18n 검수
```

### 3.4 합격 기준

| 항목 | 기준 |
|------|------|
| P0 이슈 | **0건** (발견 즉시 수정) |
| P1 이슈 | **0건** (출시 전 수정) |
| P2 이슈 | **≤ 5건** (출시 후 1주 내 수정 계획 수립) |
| 회귀 결함 | **0건** (이전 QA에서 수정된 항목 재발 없음) |

---

## 4. Stream 3: Security-QA 보안 검수

### 4.1 목표
OWASP Top 10 기준으로 **유료 서비스에 적합한 보안 수준** 검증. 특히 결제 정보, 개인정보, 인증 시스템 집중 감사

### 4.2 보안 검수 체크리스트

#### Layer 1: 인증/인가 보안 (P0 — Critical)

| # | 검수 항목 | OWASP | 검증 방법 | 대상 파일 |
|---|----------|-------|----------|----------|
| 1.1 | **JWT 토큰 보안** | A07 | 서명 알고리즘 검증, 만료 시간 적정성, 비밀키 강도 | auth.service.ts, jwt.config.ts |
| 1.2 | **Refresh Token 일회용** | A07 | Redis jti 기반 일회성 검증, 재사용 공격 시뮬레이션 | auth.service.ts |
| 1.3 | **비밀번호 정책** | A07 | bcrypt 라운드 12, 최소 길이/복잡도, dictionary attack 내성 | auth.service.ts |
| 1.4 | **2FA 구현 보안** | A07 | CSPRNG 시크릿 생성, 복구 코드 해싱, 타이밍 공격 방지 | auth.service.ts |
| 1.5 | **계정 잠금 우회** | A07 | 5회 실패 잠금, IP 우회 시도, 분산 brute force 방어 | auth.service.ts |
| 1.6 | **OAuth 상태 파라미터** | A07 | CSRF 방지용 state 검증, redirect_uri 화이트리스트 | google.strategy.ts 등 |
| 1.7 | **세션 고정 공격** | A07 | 로그인 후 토큰 재발급, 세션 ID 회전 | auth.service.ts |

#### Layer 2: 데이터 보호 (P0 — Critical)

| # | 검수 항목 | OWASP | 검증 방법 | 대상 파일 |
|---|----------|-------|----------|----------|
| 2.1 | **PII 노출 방지** | A01 | 9개 `select:false` 컬럼 API 응답 미포함 확인 | user.entity.ts, 모든 컨트롤러 |
| 2.2 | **API 응답 필터링** | A01 | ValidationPipe whitelist, 불필요 필드 제거 | main.ts, DTOs |
| 2.3 | **에러 메시지 정보 노출** | A01 | 5xx 에러 시 스택트레이스 미노출, 일반화된 메시지 | all-exceptions.filter.ts |
| 2.4 | **로그 PII 마스킹** | A09 | 이메일, 전화번호, IP 마스킹 확인 | 로깅 관련 전체 |
| 2.5 | **GDPR 데이터 내보내기** | A01 | 내보내기 데이터에 타인 정보 미포함 | users.controller.ts |
| 2.6 | **파일 업로드 보안** | A08 | 파일 타입 검증, 크기 제한, 경로 순회 방지 | 업로드 관련 |
| 2.7 | **환경변수 노출** | A05 | API 키, 시크릿이 프론트엔드/로그에 노출되지 않음 | .env, app.config.js |

#### Layer 3: API 보안 (P0)

| # | 검수 항목 | OWASP | 검증 방법 |
|---|----------|-------|----------|
| 3.1 | **SQL Injection** | A03 | TypeORM 파라미터 바인딩 확인, raw query 없음 검증 |
| 3.2 | **XSS (Cross-Site Scripting)** | A03 | CSP 헤더, 사용자 입력 이스케이핑, React 자동 방어 확인 |
| 3.3 | **CSRF 방지** | A01 | SameSite 쿠키, Origin 검증, 토큰 기반 인증 |
| 3.4 | **Rate Limiting 검증** | A04 | 로그인 3/min, 회원가입 5/min, 글로벌 10/s 동작 확인 |
| 3.5 | **CORS 설정** | A05 | 화이트리스트 출처만 허용, wildcard 없음 |
| 3.6 | **요청 본문 제한** | A04 | 1MB 제한, 대용량 페이로드 거부 |
| 3.7 | **IDOR (비인가 접근)** | A01 | 타인 여행/프로필 접근 시도, 소유자 검증 |
| 3.8 | **Mass Assignment** | A08 | forbidNonWhitelisted, DTO 화이트리스트 |

#### Layer 4: 결제 보안 (P0)

| # | 검수 항목 | 검증 방법 |
|---|----------|----------|
| 4.1 | **웹훅 서명 검증** | Paddle unmarshal 서명 검증, RevenueCat Bearer 토큰 |
| 4.2 | **구독 상태 조작 방지** | 클라이언트 측 프리미엄 우회 불가, 서버 측 검증 필수 |
| 4.3 | **가격 조작 방지** | 서버 측 가격 ID 검증, 클라이언트 가격 무시 |
| 4.4 | **이중 결제 방지** | 트랜잭션 ID 중복 체크, 멱등성 |
| 4.5 | **환불 처리** | 웹훅 수신 시 프리미엄 해제 |

#### Layer 5: 인프라 보안 (P1)

| # | 검수 항목 | 검증 방법 |
|---|----------|----------|
| 5.1 | **HTTPS 전용** | HSTS preload (1년), HTTP→HTTPS 리다이렉트 |
| 5.2 | **보안 헤더** | CSP, X-Content-Type-Options, X-Frame-Options |
| 5.3 | **Docker 보안** | Non-root 실행, 불필요 포트 미노출 |
| 5.4 | **소스맵 제거** | 프로덕션 빌드에 .map 파일 미포함 |
| 5.5 | **Redis 보안** | volatile-lru, 패스워드 설정, 네트워크 제한 |
| 5.6 | **DB 보안** | 자동 백업, 외부 접근 차단, 암호화된 연결 |
| 5.7 | **Swagger 프로덕션 비활성화** | /api/docs 접근 불가 확인 |
| 5.8 | **프로덕션 시크릿 fail-fast** | 필수 환경변수 누락 시 앱 시작 거부 |

#### Layer 6: 클라이언트 보안 (P1)

| # | 검수 항목 | 검증 방법 |
|---|----------|----------|
| 6.1 | **토큰 안전 저장** | SecureStore (네이티브), httpOnly 쿠키 (웹) |
| 6.2 | **민감 데이터 로깅 방지** | console.log에 토큰/비밀번호 미출력 |
| 6.3 | **딥링크 검증** | travelplanner:// 스키마 하이재킹 방지 |
| 6.4 | **ProGuard/난독화** | Android 릴리스 빌드 난독화 확인 |
| 6.5 | **앱 인증서 Pinning** | SSL Pinning (선택, P2) |

### 4.3 실행 방법

```
# Claude Code에서 security-qa 에이전트 실행
# Layer별 순차 실행 (의존성 있음)

1. Layer 1~2 (인증 + 데이터): 최우선 실행
2. Layer 3~4 (API + 결제): 인증 검증 후 실행
3. Layer 5~6 (인프라 + 클라이언트): 병렬 실행 가능
```

### 4.4 합격 기준

| 항목 | 기준 |
|------|------|
| P0 보안 취약점 | **0건** |
| P1 보안 취약점 | **0건** |
| OWASP Top 10 커버리지 | **10/10 항목 검증 완료** |
| 결제 보안 | 웹훅 서명, 상태 조작, 이중 결제 모두 방어 |
| 침투 테스트 시뮬레이션 | 주요 공격 벡터 5개 이상 시뮬레이션 |

---

## 5. Stream 4: Publish-QA 스토어 규정 검수

### 5.1 목표
Google Play Store 정책 100% 준수 확인. 제출 거부(Rejection) 또는 게시 후 삭제(Takedown) 리스크를 사전 제거

### 5.2 검수 체크리스트

#### Category 1: Google Play 정책 준수 (P0)

| # | 정책 항목 | 검증 내용 | 관련 설정 |
|---|----------|----------|----------|
| 1.1 | **콘텐츠 정책** | 부적절 콘텐츠 없음, AI 생성 콘텐츠 고지 | app.json, store listing |
| 1.2 | **개인정보 처리방침** | 링크 유효, 수집 항목 정확, 연락처 포함 | privacy.html, privacy-en.html |
| 1.3 | **데이터 안전 섹션** | Play Console 선언 ↔ 실제 수집 항목 일치 | Play Console 데이터 안전 |
| 1.4 | **앱 내 구매 정책** | 구독 조건 명시, 해지 방법 안내, 가격 표시 | SubscriptionScreen, PaywallModal |
| 1.5 | **광고 정책** | AdMob 정책 준수, 광고 식별 가능, 오해 유발 없음 | AdBanner 컴포넌트 |
| 1.6 | **권한 정책** | 최소 권한, 사용 목적 설명 | app.json permissions |
| 1.7 | **사기성 행동** | 기만적 UI 없음, 숨겨진 기능 없음 | 전체 앱 |
| 1.8 | **지적 재산** | 제3자 IP 침해 없음, 라이선스 준수 | licenses/ |
| 1.9 | **가족 정책** | 아동 대상 아닌 경우 COPPA 면제 확인 | 콘텐츠 등급 |
| 1.10 | **AI 기능 공개** | AI 여행 생성 기능 투명하게 안내 | 앱 설명, 앱 내 UI |

#### Category 2: 앱 설정 & 메타데이터 (P0)

| # | 검증 항목 | 예상값 | 확인 방법 |
|---|----------|--------|----------|
| 2.1 | **패키지명** | `com.longpapa82.travelplanner` | app.json |
| 2.2 | **versionCode** | 17+ (단조 증가) | app.json + EAS |
| 2.3 | **targetSdkVersion** | 34+ (2024 요구사항) | app.config.js |
| 2.4 | **앱 서명** | Google Play App Signing 활성화 | Play Console |
| 2.5 | **AAB 형식** | APK가 아닌 AAB 제출 | EAS Build 설정 |
| 2.6 | **64-bit 지원** | ARM64 + x86_64 | EAS Build |
| 2.7 | **앱 이름 일관성** | "MyTravel" (앱 내, 스토어, 스플래시) | 전체 |
| 2.8 | **스크린샷/기능 그래픽** | ko/en/ja 3개 언어 | Play Console |
| 2.9 | **스토어 설명** | 정확하고 기만적이지 않음 | Play Console |
| 2.10 | **콘텐츠 등급 (IARC)** | 여행 앱 적합 등급 | Play Console |

#### Category 3: 기술 품질 (P1)

| # | 검증 항목 | 합격 기준 | 검증 방법 |
|---|----------|----------|----------|
| 3.1 | **크래시 프리 비율** | ≥ 99.5% | Sentry 모니터링 |
| 3.2 | **ANR (응답 없음) 비율** | < 0.5% | 프로덕션 모니터링 |
| 3.3 | **콜드 스타트 시간** | < 3초 | 실기기 테스트 |
| 3.4 | **App Links 검증** | assetlinks.json 유효 | /.well-known/assetlinks.json |
| 3.5 | **백 버튼 동작** | 예측 가능한 네비게이션 | 실기기 테스트 |
| 3.6 | **화면 회전** | 세로/가로 대응 또는 세로 고정 | 실기기 테스트 |
| 3.7 | **큰 화면 지원** | 태블릿 레이아웃 깨짐 없음 | 에뮬레이터 |
| 3.8 | **오프라인 처리** | 네트워크 없을 때 크래시 없음 | 비행기 모드 테스트 |
| 3.9 | **메모리 사용량** | < 200MB 일반 사용 | Android Profiler |
| 3.10 | **배터리 사용** | 과도한 백그라운드 작업 없음 | Battery Historian |

#### Category 4: 법적 & 규제 준수 (P0)

| # | 검증 항목 | 상태 | 비고 |
|---|----------|------|------|
| 4.1 | **개인정보 처리방침** | ✅ | privacy.html (ko), privacy-en.html (en) |
| 4.2 | **이용약관** | ✅ | terms.html (ko), terms-en.html (en) |
| 4.3 | **GDPR 준수** | ✅ | 데이터 내보내기, 삭제 권리, 동의 배너 |
| 4.4 | **CCPA 준수** | 확인 필요 | California 사용자 옵트아웃 권리 |
| 4.5 | **COPPA** | ✅ | 아동 대상 아님, 콘텐츠 등급 선언 |
| 4.6 | **제3자 라이선스** | 확인 필요 | licenses/ 디렉토리, OSS 라이선스 표시 |
| 4.7 | **앱 내 구독 약관** | ✅ | PaywallModal 법적 문구 표시 |
| 4.8 | **쿠키 동의 (웹)** | ✅ | GDPRConsentBanner.web.tsx |
| 4.9 | **국가별 규제** | 확인 필요 | 특정 국가 금융/여행 규제 |

#### Category 5: 결제 & 수익화 (P0)

| # | 검증 항목 | 검증 내용 |
|---|----------|----------|
| 5.1 | **구독 가격 명시** | PaywallModal에 월 $3.99 / 연 $29.99 명확히 표시 |
| 5.2 | **무료 체험 조건** | 체험 기간 없으면 미표시 확인 |
| 5.3 | **자동 갱신 안내** | "자동 갱신됩니다" 문구 표시 |
| 5.4 | **해지 방법 안내** | Play Store 구독 관리 링크 제공 |
| 5.5 | **구매 복원** | "구매 복원" 버튼 존재 및 동작 |
| 5.6 | **가격 현지화** | 17개 언어 × 현지 통화 표시 |
| 5.7 | **오해 유발 결제 UI** | 실수 구매 유도 없음, 명확한 CTA |
| 5.8 | **AdMob 정책** | 광고 배치, 빈도, 사용자 경험 |
| 5.9 | **프리미엄 광고 제거** | 구독 후 즉시 광고 미노출 |
| 5.10 | **Grace Period** | 결제 실패 시 유예 기간 처리 |

#### Category 6: 국제화 품질 (P1)

| # | 검증 항목 | 검증 내용 |
|---|----------|----------|
| 6.1 | **스토어 등록정보** | ko/en/ja 3개 언어 등록 확인 |
| 6.2 | **앱 내 17개 언어** | 번역 누락 키 없음 |
| 6.3 | **RTL 레이아웃 (아랍어)** | UI 방향, 아이콘 미러링 |
| 6.4 | **날짜/시간/통화** | 로케일별 올바른 포맷 |
| 6.5 | **문화적 적절성** | 특정 문화권 불쾌 콘텐츠 없음 |

#### Category 7: 리브랜드 검증 (P1)

| # | 검증 항목 | 검증 내용 |
|---|----------|----------|
| 7.1 | **앱 이름 통일** | "MyTravel" — 앱 내, 스토어, 스플래시, 알림 |
| 7.2 | **레거시 이름 잔재** | "TravelPlanner" 텍스트 미노출 (코드 내부는 OK) |
| 7.3 | **아이콘 일관성** | adaptive-icon 66% 패딩 적용 |

### 5.3 실행 방법

```
# publish-qa 에이전트 실행 (frontend/.claude/agents/publish-qa.md)
# 10개 카테고리 순차 검토 → 한국어 보고서 출력

1. Google Play 정책 검토
2. 앱 설정 & 메타데이터 확인
3. 기술 품질 체크
4. 보안 & 인증 (security-qa 결과 참조)
5. 법적/규제 준수
6. 구독 & 수익화
7. 국제화
8. 성능 & 품질
9. 리브랜드 검증
10. 제출 전 최종 체크리스트
```

### 5.4 합격 기준

| 항목 | 기준 |
|------|------|
| P0 Blocker | **0건** (출시 불가 사유 없음) |
| P1 Critical | **0건** (수정 후 제출) |
| Play 정책 10항목 | **전체 PASS** |
| 법적 준수 | 개인정보/이용약관/GDPR/구독약관 전체 유효 |
| 결제 UI | 오해 유발 요소 없음, 해지 방법 명시 |

---

## 6. 실행 일정 및 우선순위

### 6.1 실행 순서 (의존성 기반)

```
Day 1 (3/12)
├── [병렬] Stream 3: Security-QA Layer 1~2 (인증/데이터 보호)
├── [병렬] Stream 2: Auto-QA Category A~B (인증/결제)
└── [병렬] Stream 4: Publish-QA Category 1~2 (정책/메타데이터)

Day 2 (3/13)
├── [병렬] Stream 1: Playwright Phase A (P0 Critical Path 실행)
├── [병렬] Stream 3: Security-QA Layer 3~4 (API/결제 보안)
├── [병렬] Stream 2: Auto-QA Category C~D (비즈니스/외부 API)
└── [병렬] Stream 4: Publish-QA Category 3~5 (기술/법적/결제)

Day 3 (3/14)
├── [병렬] Stream 1: Playwright Phase B~D (전체 테스트)
├── [병렬] Stream 3: Security-QA Layer 5~6 (인프라/클라이언트)
├── [병렬] Stream 2: Auto-QA Category E~F (관리자/i18n)
└── [병렬] Stream 4: Publish-QA Category 6~7 (국제화/리브랜드)

Day 4 (3/15) — Bug Fix Day
├── 발견된 P0/P1 이슈 수정
├── 수정 후 회귀 테스트
└── Stream 1: Playwright Phase E (프로덕션 Smoke)

Day 5 (3/16) — Final Verification
├── 전체 스트림 결과 종합
├── Go/No-Go 판정
└── Play Store 프로덕션 제출 (Go 판정 시)
```

### 6.2 병렬 실행 맵

```
         Day 1        Day 2        Day 3        Day 4      Day 5
Stream 1  ────────    ▓▓▓▓▓▓▓▓    ▓▓▓▓▓▓▓▓    ░░(smoke)   ✓
Stream 2  ▓▓▓▓▓▓▓▓   ▓▓▓▓▓▓▓▓    ▓▓▓▓▓▓▓▓    ────────    ✓
Stream 3  ▓▓▓▓▓▓▓▓   ▓▓▓▓▓▓▓▓    ▓▓▓▓▓▓▓▓    ────────    ✓
Stream 4  ▓▓▓▓▓▓▓▓   ▓▓▓▓▓▓▓▓    ▓▓▓▓▓▓▓▓    ────────    ✓
Bug Fix   ────────    ────────    ────────    ▓▓▓▓▓▓▓▓    ░░
```

---

## 7. Go/No-Go 판정 기준

### 7.1 출시 판정 매트릭스

| 기준 | Go 조건 | No-Go 조건 |
|------|---------|-----------|
| **P0 이슈** | 0건 | 1건 이상 |
| **P1 이슈** | 0건 | 3건 이상 |
| **P2 이슈** | ≤ 10건 (수정 계획 있음) | 10건 초과 (체계적 문제) |
| **Playwright P0 통과율** | 100% | < 100% |
| **전체 테스트 통과율** | ≥ 95% | < 90% |
| **보안 취약점** | P0/P1 0건 | P0 1건 이상 |
| **Play 정책 준수** | 10/10 PASS | 1개 이상 FAIL |
| **법적 문서** | 전체 유효 | 1개 이상 무효/만료 |
| **결제 플로우** | 정상 동작 | 결제 실패 또는 미반영 |
| **Core Web Vitals** | 기준 충족 | LCP > 4s |

### 7.2 판정 결과별 조치

| 판정 | 조치 |
|------|------|
| **Go** | Play Store 프로덕션 제출 + 단계적 출시 (1% → 10% → 100%) |
| **Conditional Go** | P2 이하만 남은 경우, 수정 계획 수립 후 출시 |
| **No-Go** | P0/P1 수정 → 재검수 → 재판정 |

---

## 부록: 기존 테스트 인프라 현황

| 항목 | 수량 | 상태 |
|------|------|------|
| E2E Spec 파일 | 28개 | 작성 완료 |
| Smoke Test | 10개 | 작성 완료 |
| Playwright 프로젝트 | 6개 | 설정 완료 |
| 테스트 사용자 | 15명 | 설정 완료 |
| 신규 작성 필요 Spec | 5개 | 미작성 |
| 총 테스트 시나리오 | ~200+ | — |
