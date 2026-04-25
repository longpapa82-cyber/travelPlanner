# V112 통합 수정 계획 (Phase 2)

**Date**: 2026-04-14
**User-confirmed scope**:
- Q1: #7 표시 개선만 (최소 변경)
- Q2: #1 Proper fix (Dockerfile 재작성 + RootNavigator 정리 + changePassword refresh token revoke)
- Q3: #6 Full fix (Defect A-E 전체 해결)

---

## 📋 파일 단위 수정 매트릭스

### Backend (TypeScript, NestJS)

| File | 수정 내용 | 이슈 | Priority | Est. Lines |
|---|---|---|---|---|
| `backend/src/trips/trips.service.ts` | 쿼터 증가를 AI 성공 후로 이동 + AI catch를 rethrow로 변경 + rollback 보장 | #6-A | **P0** | +20/-10 |
| `backend/src/trips/services/ai.service.ts` | OpenAI streaming `{signal, timeout}` 추가 + 45s per-call timeout + 180s outer budget + 30일 chunking (7일 단위) | #6-B, #6-F | **P0** | +40/-15 |
| `backend/src/trips/jobs.service.ts` | `cancelJob(jobId)` 메서드 추가 + AbortController per-job 관리 + job status `cancelled` | #6-C | **P0** | +30 |
| `backend/src/trips/trips.controller.ts` | `DELETE /trips/jobs/:jobId` 엔드포인트 + signal propagation to tripsService.create | #6-C | **P0** | +25 |
| `backend/src/subscription/subscription.service.ts` | `-1` sentinel 제거, premium에 실제 `aiTripsLimit: 30` 반환 + 공유 상수 + 샌드박스 감지 로직 (isSandbox 필드) | #8, #7 | **P0** | +15/-8 |
| `backend/src/subscription/constants.ts` (신규) | `AI_TRIPS_FREE_LIMIT=3`, `AI_TRIPS_PREMIUM_LIMIT=30` 공유 상수 | #8 | **P0** | +5 |
| `backend/src/users/users.service.ts:221` | changePassword 직후 `refreshTokenService.revokeAllForUser(id)` 호출 | #1 | **P0** | +3 |
| `backend/src/auth/auth.service.ts:54-96` | register 재진입 허용 (미인증 row 재사용) + JWT 발급 금지 + `{pendingVerification: true, email}` 반환 | #3 | **P0** | +25/-10 |
| `backend/src/auth/auth.service.ts:156-212` | login unverified 응답을 401 PENDING_VERIFICATION + resumeToken (verify-email-code 전용) 으로 변경. full token 금지 | #3 | **P0** | +20/-15 |
| `backend/src/auth/auth.service.ts` | register BadRequest를 discriminated error codes 로 교체 (`EMAIL_EXISTS`, `EMAIL_NOT_VERIFIED`, `CONSENT_MISSING`, `WEAK_PASSWORD`) | #10 | P1 | +15/-3 |
| `backend/src/auth/auth.service.ts` (새 Cron) | `@Cron('0 * * * *')` isEmailVerified=false AND createdAt < now-24h DELETE | #3 | P1 | +15 |
| `backend/src/common/filters/all-exceptions.filter.ts` | PaywallError/AbortError/CancelledError 를 error_logs ingestion에서 제외 + severity taxonomy | #10 | P1 | +10 |

### Frontend (TypeScript, React Native)

| File | 수정 내용 | 이슈 | Priority | Est. Lines |
|---|---|---|---|---|
| `frontend/Dockerfile` | `RUN npx expo export --platform web` 라인 제거 → `COPY static-marketing/ /app/dist/` 로 교체 (marketing-only) | #1 | **P0** | ±10 |
| `frontend/static-marketing/` (신규) | landing*.html, privacy.html, terms.html, licenses.html, guides/, faq.html, assetlinks.json, sitemap.xml, robots.txt, ads.txt, app-ads.txt, favicon.ico 만 포함 | #1 | **P0** | N/A (파일 이동) |
| `proxy/nginx.conf` (server) | 기존 `location /` fall-through 에 **app routes 301 redirect** 추가 (방어 심층) | #1 | **P0** | +10 |
| `frontend/src/navigation/RootNavigator.tsx:24-63` | `linking.prefixes` 에서 `'https://mytravel-planner.com'` 제거, `travelplanner://` 만 유지. screens 중 `/share/:token`, `/reset-password?token=...` 만 allowlist | #1 | **P0** | -5 |
| `frontend/src/screens/main/HomeScreen.tsx` | (a) `createTripRef` 감싼 Animated.View 에서 `translateY` 제거 (opacity만 유지), (b) ref를 `Animated.View` 외부의 plain View 에 재부착, (c) `onLayout` + `InteractionManager.runAfterInteractions` + `measureInWindow` 로 측정, (d) `useIsFocused` 에 re-measure 의존성, (e) 1500ms fallback 삭제 | #4 | **P0** | +30/-25 |
| `frontend/src/components/AiQuotaLabel.tsx` (신규) | 단일 source of truth 렌더러. Premium/free 공통 `t('create.aiInfo.remaining', { remaining, total })`. Context에서 `aiTripsLimit`, `aiTripsUsedThisMonth` 만 읽음 | #8 | **P0** | +40 |
| `frontend/src/screens/trips/CreateTripScreen.tsx:1576-1592` | 하드코딩 "프리미엄: 월 30회" 문자열 삭제 + `<AiQuotaLabel />` 사용 | #8 | **P0** | -15 +3 |
| `frontend/src/screens/trips/CreateTripScreen.tsx:459-466, 617, 839` | `aiTripsLimit > 0 ? aiTripsLimit : 3` fallback 제거 (backend `-1` sentinel 제거됨) | #8 | **P0** | -6 |
| `frontend/src/screens/main/ProfileScreen.tsx:482` | `total: 3` 하드코딩 제거, context aiTripsLimit 사용, `!isPremium` 게이트 제거 | #8 | **P0** | -3 +2 |
| `frontend/src/screens/main/ProfileScreen.tsx:944-951` | `modalContent` 에서 `minHeight: 400`, `justifyContent: 'space-between'` 제거. `paddingBottom: Math.max(insets.bottom, 16) + 8` | #2 | **P0** | -3 +3 |
| `frontend/src/screens/main/SubscriptionScreen.tsx:46-49` | `formatDate` 를 `(expiresAt - startedAt) < 24h` 조건에서 `toLocaleString()` 로 변경 + `(테스트 구매)` 배지 | #7 | **P0** | +10/-3 |
| `frontend/src/screens/main/SubscriptionScreen.tsx:54` | `isAdmin && !subscriptionStartedAt` 이면 "관리자 무제한 플랜" 카드 전용 렌더링 | #7 | **P0** | +15 |
| `frontend/src/contexts/PremiumContext.tsx:9, 105-114, 121` | `isPremium = isPremium || isAdmin` + `AI_TRIPS_PREMIUM_LIMIT` 로컬 상수 삭제 (backend response 사용) | #7, #8 | **P0** | -5 +3 |
| `frontend/src/screens/trips/CreateTripScreen.tsx:88-212, 670-707` | (a) `createStyles` `useMemo([theme, isDark])`, (b) `POPULAR_DESTINATIONS` / `DURATION_OPTIONS` / `TRAVELER_OPTIONS` `useMemo([t])`, (c) 모든 handler `useCallback`, (d) 히어로 이미지 1200→600px + `priority="low"`, (e) reset 로직을 `resetForm()` helper 추출 + 초기 mount effect + focus listener 양쪽 호출 + `useFocusEffect` 로 변경 고려, (f) auto-switch-to-manual effect 에 planningMode dep 가드 | #9, #5 | **P0** | +50/-30 |
| `frontend/src/services/api.ts:377-490` | `createTripWithPolling` maxPolls 300→600 (10분) OR job status에서 서버 예산 표기, cancel시 DELETE 호출 | #6-C, #6-D | **P0** | +15/-5 |
| `frontend/src/screens/trips/CreateTripScreen.tsx:314-319, 506-518` | `handleCancelCreation` 에서 DELETE `/trips/jobs/:jobId` 호출 + AbortController 전파 + `resetForm()` 호출 | #6-C, #6-E | **P0** | +20/-5 |
| `frontend/src/services/errorLogger.ts` (또는 해당 위치) | PaywallError / AbortError / QuotaExceededError / CancelledError 제외 | #10 | P1 | +10 |

### i18n (17 언어)

| File | 수정 내용 | 이슈 | Priority | Est. Lines |
|---|---|---|---|---|
| `frontend/src/i18n/locales/*/premium.json` (17개 언어) | `aiWarning` 에 `{{total}}` 슬롯 추가: `"이번 달 AI 여행 {{remaining}}/{{total}}회 남음"` | #8 | P1 | 17 × 1 |
| `frontend/src/i18n/locales/*/subscription.json` | `sandboxBadge`, `adminUnlimitedPlan` 키 추가 (17개 언어) | #7 | P1 | 17 × 2 |

### 신규 Tests (TDD 기준)

| File | 내용 | 이슈 |
|---|---|---|
| `frontend/__tests__/CreateTripScreen.quota.test.tsx` | Premium/free × 여러 used 값 parametrized 스냅샷. "20/30", "3/3" 강제 assertion | #8 |
| `backend/src/trips/trips.service.spec.ts` (기존 확장) | AI throw 시 quota 유지, partial fail no orphan, cancel 시 rollback | #6 |
| `backend/src/trips/trips.controller.spec.ts` (확장) | POST then immediate DELETE → quota unchanged + no orphan + cancelled | #6 |
| `backend/src/auth/auth.service.spec.ts` (확장) | register unverified re-entry allowed + no JWT returned, login unverified 401 | #3 |
| `backend/src/subscription/subscription.service.spec.ts` (확장) | `-1` 없어야 함, sandbox 감지 (`<24h` on yearly) | #7, #8 |

### 제거 / 정리

| Item | 비고 |
|---|---|
| 180+ `image-*.png` 파일 → `docs/test-screenshots/v112/` 로 이동 | 루트 clutter 제거 |
| `testResult.md` 의 `![alt text](image-X.png)` 경로 업데이트 | 이동에 따라 |

---

## 📊 배포 순서 및 의존성

### Build Order (의존성 그래프 기준)

**Wave 1 — Backend Core (병렬 안전)**
1. `backend/src/subscription/constants.ts` (신규)
2. `backend/src/subscription/subscription.service.ts` (-1 sentinel 제거)
3. `backend/src/users/users.service.ts:221` (token revoke)
4. `backend/src/common/filters/all-exceptions.filter.ts` (severity)

**Wave 2 — Backend Auth State Machine** (#3 + #10)
5. `backend/src/auth/auth.service.ts` (register re-entry + login PENDING_VERIFICATION + discriminated errors + cleanup cron)

**Wave 3 — Backend Trip Cancel Infrastructure** (#6 Full fix)
6. `backend/src/trips/jobs.service.ts` (cancelJob 메서드)
7. `backend/src/trips/services/ai.service.ts` (signal/timeout/chunking)
8. `backend/src/trips/trips.service.ts` (쿼터 롤백)
9. `backend/src/trips/trips.controller.ts` (DELETE endpoint)

**Wave 4 — Backend Tests**
10. Backend `npm run build` → 0 errors
11. Backend `npm test` → 기존 pass + 신규 케이스 pass

**Wave 5 — Frontend Infrastructure** (#1)
12. `frontend/Dockerfile` 재작성
13. `frontend/static-marketing/` 디렉토리 생성 (기존 static 파일 이동)
14. `frontend/src/navigation/RootNavigator.tsx` linking.prefixes 정리

**Wave 6 — Frontend Components** (#2, #4, #8)
15. `frontend/src/components/AiQuotaLabel.tsx` (신규)
16. `frontend/src/contexts/PremiumContext.tsx` (isAdmin 포함, 로컬 상수 제거)
17. `frontend/src/screens/main/HomeScreen.tsx` (코치마크 구조 수정)
18. `frontend/src/screens/main/ProfileScreen.tsx` (modal + 20/30)
19. `frontend/src/screens/main/SubscriptionScreen.tsx` (샌드박스 배지 + admin 분기)
20. `frontend/src/screens/trips/CreateTripScreen.tsx` (하드코딩 제거 + memoization + cancel + reset)
21. `frontend/src/services/api.ts` (polling budget + DELETE call)

**Wave 7 — Frontend Tests**
22. `frontend/__tests__/CreateTripScreen.quota.test.tsx` (신규)
23. Frontend `tsc --noEmit` → 0 errors
24. Frontend `jest` → 기존 pass + 신규 pass

**Wave 8 — i18n**
25. 17개 언어 `premium.json` 업데이트
26. 17개 언어 `subscription.json` 업데이트

**Wave 9 — Deployment**
27. Backend rsync → Hetzner VPS → `docker compose build && up -d`
28. Health check
29. `proxy/nginx.conf` 업데이트 (301 redirect 추가) + `nginx -s reload`
30. Frontend container rebuild (static marketing)
31. EAS V113 build → auto-submit Alpha
32. Play Console 수동 release 대기

---

## 🛡️ 롤백 전략

### Backend
- 배포 전 `/root/travelPlanner/backend` 타임스탬프 백업 rsync
- `docker compose.yml` 이미지 태그 유지 → 이전 이미지로 즉시 rollback 가능
- DB 스키마 변경 없음 (기존 필드만 사용) → 롤백 안전

### Frontend web
- `travelplanner-frontend-1` 컨테이너 이미지 이전 태그 유지
- nginx reload 실패 시 `nginx -t` 로 사전 검증

### Mobile app
- V112 빌드는 Alpha 트랙에 draft로 유지 (이전 V112 Alpha 테스터에게 영향 없음)
- V113 발행 후 문제 발견 시 Play Console에서 V112 다시 promote 가능

---

## ⚠️ 위험도 + 완화

| Risk | Severity | Mitigation |
|---|---|---|
| Dockerfile 재작성으로 frontend 빌드 실패 | High | Dockerfile 변경 후 로컬 `docker build` 먼저 검증 |
| nginx config 문법 오류 → 프로덕션 500 | Medium | `nginx -t` + dry-run, 기존 config 백업 유지 |
| `-1` sentinel 제거로 기존 기기 호환성 | Medium | v112 Alpha 테스터는 업데이트 자동 수신, 프로덕션 사용자는 없음 |
| auth register re-entry 로직 edge case | Medium | 기존 verified user 차단 경로는 유지, unverified re-entry만 허용하는 조건 엄격 검증 |
| AbortController signal 파이프라인 leak | Medium | `jobs.service` 에 cleanup, finally 블록 |
| 17개 언어 i18n 동시 업데이트 실수 | Low | JSON schema validation + key presence test |
| 코치마크 수정이 홈 화면 애니메이션 해침 | Low | opacity만 애니메이션, translateY는 초기 위치 50→0 을 layout props 로 표현 |

---

## 🧪 검수 기준 (Phase 4 입력)

**P0 (blocking)**
- TypeScript Backend 0 errors
- TypeScript Frontend 0 errors
- Backend Jest: 기존 pass + 신규 5개 케이스 pass
- Frontend Jest: 기존 pass + CreateTripScreen.quota.test 4개 케이스 pass
- `curl https://mytravel-planner.com/login` → **301** (이전 200)
- `curl https://mytravel-planner.com/home` → **301**
- `curl https://mytravel-planner.com/api/health` → **200**
- `curl https://mytravel-planner.com/landing.html` → **200**

**P1 (should pass)**
- security-qa score ≥ 90/100
- publish-qa Conditional Go
- code-reviewer CRITICAL 0건 HIGH 0건
- comment-analyzer 주요 함수 doc 유지

**P2 (nice to have)**
- 30일 여행 E2E happy path < 180s
- 코치마크 시각 회귀 테스트 통과 (스크린샷 diff)

---

## 📝 문서 업데이트 (Phase 3/4 중 수행)

- `CLAUDE.md` — V112 수정 섹션 추가 (현재 상태, 수정 내역, V113 빌드 정보)
- `docs/v112-rca/self-loop-log.md` (신규) — 셀프루프 각 iteration 기록
- `docs/V113-release-notes.md` (신규) — ko/en/ja 출시 노트
- `docs/V113-alpha-release-guide.md` (신규) — 테스터 검증 체크리스트
- 루트 `image-*.png` → `docs/test-screenshots/v112/` 이동 (Phase 6에서 일괄)
