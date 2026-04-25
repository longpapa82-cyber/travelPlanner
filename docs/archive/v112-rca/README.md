# V112 RCA & Fix Plan — Session Resume Guide

**Created**: 2026-04-14
**Status**: Phase 1-2 완료, Phase 3 대기 중

---

## 새 세션 시작 시 할 일

새 Claude Code 세션에서 다음 한 줄만 말씀하시면 됩니다:

> **"docs/v112-rca/fix-plan.md 의 Wave 1부터 V112 수정을 시작해줘. 셀프루프 최대 10회, 검수 완료 후 자동 배포."**

이 디렉토리의 문서들이 완전한 컨텍스트를 제공합니다.

---

## 문서 구조

| 파일 | 내용 |
|---|---|
| `group-a-rca.md` | #1 웹우회, #7 연간날짜, #3 미인증가입 — 보안/결제 RCA |
| `group-b-rca.md` | #6 30일무한로딩, #8 20/30 4회재발, #10 오류로그 — 핵심기능 RCA |
| `group-c-rca.md` | #4 코치마크 4회재발, #5 폼미초기화, #9 키보드지연, #2 팝업여백 — UX RCA |
| `fix-plan.md` | **통합 수정 계획** — 파일/라인 단위 매트릭스, build order (Wave 1-9), 롤백 전략, 검수 기준 |
| `README.md` | 이 파일 — 세션 재개 가이드 |

---

## 확정된 수정 범위 (사용자 승인 완료)

- **Q1**: #7 (연간 날짜 동일) → **표시 개선만** (샌드박스 감지 + admin 분기)
- **Q2**: #1 (웹 우회) → **Proper fix** (Dockerfile 재작성 + RootNavigator 정리 + changePassword token revoke + nginx allowlist)
- **Q3**: #6 (30일 무한로딩) → **Full fix** (Defect A-E 전체 해결, 쿼터 롤백 + OpenAI signal/timeout + 백엔드 cancel 엔드포인트 + 30일 chunking + 폼 초기화)

---

## 핵심 발견 요약 (다시 읽지 않아도 되는 것들)

1. **#8 20/30이 4버전 동안 재발한 진짜 원인**: `frontend/src/screens/trips/CreateTripScreen.tsx:1580` 의 하드코딩 마케팅 문자열 `"프리미엄: 월 30회 AI 자동 생성 가능"`. 이전 수정은 데이터 파이프라인(AuthContext/webhook)만 건드렸고 JSX의 `if (isPremium || isAdmin)` 단락을 아무도 못 봄.

2. **#4 코치마크가 4버전 동안 재발한 진짜 원인**: `createTripRef`가 `Animated.View` 안의 `transform: translateY` + `useNativeDriver: true`에 있음. Native driver는 JS shadow tree를 절대 업데이트 안 해서 `measureInWindow`가 구조적으로 stale 값 반환. **타이밍 조정으로 못 고침** — 구조 변경 필요.

3. **#6 데이터 무결성 문제**: `backend/src/trips/trips.service.ts:142-151` 가 AI 실행 **전**에 쿼터 차감 + 라인 356-375의 silent fallback이 실패해도 커밋 → 사용자가 실패한 요청에 쿼터 지불.

4. **#1 웹 우회의 진짜 원인**: `frontend/Dockerfile:~30` 의 `RUN npx expo export --platform web` 이 전체 앱을 웹에 배포. nginx `location /` fall-through로 `/login`, `/home`, `/trips` 등 모든 앱 라우트 접근 가능.

5. **#7 은 버그가 아님**: Google Play 라이선스 테스터 샌드박스가 yearly 구독을 30분 주기로 가속 갱신. 프로덕션 실결제는 정상. 표시만 개선.

---

## Build Order 요약 (자세한 내용은 fix-plan.md)

- **Wave 1**: Backend Core (subscription constants, users token revoke, all-exceptions filter)
- **Wave 2**: Backend Auth state machine (#3, #10)
- **Wave 3**: Backend Trip cancel infrastructure (#6 Full fix)
- **Wave 4**: Backend tests (tsc + jest)
- **Wave 5**: Frontend Dockerfile + nginx + RootNavigator (#1)
- **Wave 6**: Frontend components (AiQuotaLabel, HomeScreen, CreateTripScreen, ProfileScreen, SubscriptionScreen, PremiumContext)
- **Wave 7**: Frontend tests
- **Wave 8**: i18n 17개 언어
- **Wave 9**: 배포 (Backend rsync → nginx reload → EAS V113 빌드)

---

## Phase 4 검수 (Phase 3 후 자동 실행)

6-Layer QA 병렬:
- L1 auto-qa-reviewer
- L2 security-qa
- L3 final-qa-debugger
- L4 pr-test-analyzer + publish (Google Play 정책)
- L5 typescript-reviewer + code-reviewer
- L6 webapp-testing / e2e-runner

---

## Phase 5 셀프루프

- 최대 10회 (사용자 승인)
- 종료 조건: P0 0건 + P1 0건 + 회귀 0건
- 각 루프 `docs/v112-rca/self-loop-log.md` 에 기록

---

## Phase 6 배포 (자동)

1. Backend rsync → Hetzner VPS (`ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127`)
2. `docker compose build && up -d`
3. Health check
4. nginx reload
5. EAS `--platform android --profile production --auto-submit --non-interactive`
6. Play Console Alpha draft 확인 (사용자 수동 release)
7. `image-*.png` 180개 → `docs/test-screenshots/v112/` 이동
8. `testResult.md` 경로 업데이트
9. 최종 커밋 + push

---

## 현재 상태 (2026-04-14)

- **브랜치**: main
- **최신 커밋**: `0c4eced6 docs: 세션 작업 타임라인 전체 정리`
- **미커밋**: 없음 (RCA 문서는 이 커밋에 포함)
- **다음 세션**: 위 한 줄 명령으로 시작 가능
