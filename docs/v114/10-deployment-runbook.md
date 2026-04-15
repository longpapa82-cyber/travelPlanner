# V115 배포 러너북 (Phase 12 — Gate 0~11 통과 후에만)

작성일: 2026-04-15
대상: V115 (versionCode 115)
환경: Hetzner VPS (46.62.201.127) + Play Console Alpha

---

## ⚠️ 사전 차단 확인

배포는 **모든 게이트가 통과해야만** 진행한다:

```
Gate 0: Phase 0 탐색               ✅ docs/v114/00-02 존재
Gate 1: Phase 1 RCA + 승인          ✅ 03-rca-and-plan.md + 사용자 승인
Gate 2: Backend 수정 완료           ✅ TS 0 errors, Jest 429/429
Gate 3: Frontend 수정 완료          ✅ TS 0 errors, Jest 204/204
Gate 4: 웹 로그인 차단 검증         ✅ WebAppRedirectScreen 적용
Gate 5: auto-qa P0 0건              ⏸️  06-qa-auto-review.md 검토 필요
Gate 6: Playwright 6/6 pass         ⏸️  실기기 검증 필요 (수동 smoke로 대체)
Gate 7: Security CRITICAL 0건       ⏸️  07-security-audit.md 검토 필요
Gate 8: final-qa debug 완료         ⏸️  잔여 이슈 점검
Gate 9: Play Store checklist        ⏸️  08-play-store-checklist.md Phase 12에서 수행
Gate 10: Code review CRITICAL 0건    ⏸️  08-code-review.md 검토 필요
Gate 11: Regression harness         ⏸️  09-regression-harness.md 문서화 완료
```

**Gate 5/7/10의 에이전트 리포트를 먼저 읽고, CRITICAL 0건을 확인한 뒤** 이 러너북을 실행한다.

---

## Pre-Deploy (D-1)

### 1. 백업
```bash
# 프로덕션 DB 덤프
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && docker compose exec -T postgres \
    pg_dump -U postgres travelplanner > /root/backups/travelplanner-$(date +%Y%m%d-%H%M%S).sql"

# Redis snapshot
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && docker compose exec -T redis \
    sh -c 'redis-cli -a \$REDISCLI_AUTH BGSAVE && sleep 2 && cp /data/dump.rdb /data/dump-$(date +%Y%m%d-%H%M%S).rdb'"

# 현재 Docker image 태그 기록 (rollback용)
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "docker images | grep travelplanner > /root/backups/image-tags-$(date +%Y%m%d-%H%M%S).txt"
```

### 2. 빌드 파이프라인 검증 (로컬)
```bash
cd /Users/hoonjaepark/projects/travelPlanner/backend
npx tsc --noEmit && npx jest --silent

cd ../frontend
npx tsc --noEmit && npx jest --silent
```

둘 다 통과하면 진행. 하나라도 실패하면 Phase 2/3로 되돌아간다.

---

## Deploy (D-day)

### Step 1: Backend 롤링 배포 (~5분)

```bash
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 << 'REMOTE'
set -euo pipefail

cd /root/travelPlanner

# 소스 동기화 (node_modules 제외)
# (실제로는 rsync는 로컬에서 원격으로 밀어야 함 — 아래는 원격 pull 버전)
git fetch origin main
git reset --hard origin/main

# 백엔드 빌드 + 롤링 up
cd backend
docker compose build backend
docker compose up -d backend

# 헬스 체크 (5회 연속 200 확인)
for i in {1..10}; do
  sleep 3
  if curl -sf https://mytravel-planner.com/api/health | grep -q '"status":"ok"'; then
    echo "[$i] healthy"
    break
  fi
  echo "[$i] waiting..."
done

# V115 신규 엔드포인트 smoke test
echo "=== /api/version ==="
curl -s https://mytravel-planner.com/api/version | jq .

echo "=== /api/health ==="
curl -s https://mytravel-planner.com/api/health | jq .
REMOTE
```

**검증 체크**:
- [ ] `/api/health` → `{"status":"ok"}`
- [ ] `/api/version` → `{"apiVersion":"1.0.0","minAppVersionCode":100,"recommendedAppVersionCode":115,...}`
- [ ] `/api/auth/forgot-password` smoke (무효 이메일로 200 OK — enumeration 방지 확인)

### Step 2: 프론트 웹 재배포 (동시)

```bash
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 << 'REMOTE'
cd /root/travelPlanner
docker compose build frontend
docker compose up -d frontend

sleep 5
curl -sI https://mytravel-planner.com/ | head -5
REMOTE
```

**검증**:
- [ ] `https://mytravel-planner.com/` → WebAppRedirectScreen 텍스트 "MyTravel은 모바일 앱에서" 보임
- [ ] `https://mytravel-planner.com/landing.html` → 정적 랜딩 (nginx 직접 서빙) 정상
- [ ] `https://mytravel-planner.com/guides/tokyo` → 정적 가이드 정상
- [ ] `https://mytravel-planner.com/privacy.html` → 개인정보 처리방침 정상
- [ ] `https://mytravel-planner.com/login` → **로그인 폼 없음**, WebAppRedirectScreen
- [ ] `https://mytravel-planner.com/reset-password?token=test` → WebAppRedirectScreen (앱 다운로드 안내)

### Step 3: EAS Build + Play Console

```bash
cd /Users/hoonjaepark/projects/travelPlanner/frontend

# Check versionCode before build (should auto-increment to 115)
grep -n "versionCode" app.config.js || grep "versionCode" app.json

# Build + auto-submit to Alpha
eas build --platform android --profile production --auto-submit --non-interactive
```

**검증**:
- [ ] EAS 빌드 완료
- [ ] Play Console Alpha 트랙에 versionCode 115 업로드 확인
- [ ] Pre-launch Report 자동 실행 대기 (~30분)

---

## Post-Deploy (D+0 ~ D+1)

### Alpha 테스터 검증 (1시간)

**필수 14개 시나리오 (재현-based 검증)**:

| # | 시나리오 | 기대 결과 |
|---|---|---|
| V114-1 | 비번 찾기 → 메일 링크 → 앱 전환 | 앱이 /app/reset 인텐트로 열림, reset 화면 정상 |
| V114-1b | 메일 링크 없이 브라우저로 직접 접근 | WebAppRedirectScreen → Play Store 버튼 |
| V114-2a | 신규 설치 → 홈 첫 진입 → 코치마크 | 박스가 AI 버튼을 정확히 감쌈 |
| V114-2b | 코치마크 툴팁 | "건너뛰기" 버튼 없음, "다음"만 |
| V114-3 | Profile → 계정 삭제 → 팝업 | 흰 공백 최소, 컨텐츠 크기만 |
| V114-4a | 신규 설치 → ConsentScreen | 버튼 하단 여백 적정 |
| V114-4b | ConsentScreen 필수 블록 | "개인정보 처리방침" (필수 아이콘만) |
| V114-4c | ConsentScreen 선택 블록 | 개인정보 처리방침 없음, 마케팅만 |
| V114-5 | 수동 생성 진입 | AI 카운터 표기 일관 |
| V114-6a | longpapa82 로그인 → 구독 | 다음 결제일 "시간까지" 표시 |
| V114-6b | hoonjae723 로그인 → 홈 | `X/30회 남음` 형식 |
| V114-7 | 관리자 error_logs | quota/cancel 관련 노이즈 제거됨 |
| V114-8 | 미인증 계정 재가입 | 2-way 다이얼로그 표시 |
| V114-9 | 구버전 앱 (versionCode 90) → V115 backend | /api/version 체크로 force update 모달 |

### 모니터링 (1시간)

```bash
# Backend 로그 스트림
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && docker compose logs -f backend --tail=100"

# 5xx 비율 확인
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 \
  "cd /root/travelPlanner/backend && docker compose exec -T postgres psql -U postgres -d travelplanner -c \
  \"SELECT severity, COUNT(*) FROM error_logs WHERE \\\"createdAt\\\" > NOW() - INTERVAL '1 hour' GROUP BY severity;\""
```

**Rollback 트리거**:
- 5xx 비율 > 0.5%
- Crash report 5건+
- V114 이슈 중 하나라도 재현

---

## Rollback (비상 시)

### Backend
```bash
ssh -i ~/.ssh/travelplanner-oci root@46.62.201.127 << 'REMOTE'
cd /root/travelPlanner
git log --oneline -10  # 이전 commit 확인
git reset --hard <이전-commit-sha>

cd backend
docker compose build backend
docker compose up -d backend

# DB rollback (필요 시)
docker compose exec -T postgres psql -U postgres travelplanner < /root/backups/travelplanner-YYYYMMDD-HHMMSS.sql
REMOTE
```

### Frontend (Play Console)
- Play Console → 비공개 테스트 → 이전 versionCode 114 버전으로 즉시 롤백 가능
- Alpha 트랙이라 프로덕션 영향 없음 — 최소 피해

---

## Post-Mortem 템플릿 (배포 후 1일)

```markdown
# V115 배포 후기 (2026-04-XX)

## 결과
- 배포 시각:
- 롤백 여부:
- Alpha 검증 결과: 14/14 pass / X fail

## 회귀
- V114 이슈 중 재발: 없음 / X건

## 새 이슈
- ...

## 교훈
- ...
```

---

## Gate 12 통과 기준

1. Alpha 14 시나리오 중 13건 이상 pass
2. 배포 후 1시간 모니터링에서 5xx <0.5%, crash 0건
3. /api/version 체크로 구버전 앱 호환성 확인
4. 롤백 없이 안정

**이 조건이 갖춰지면 V115를 프로덕션 단계로 승격한다.**
