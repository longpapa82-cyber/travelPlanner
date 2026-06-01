#!/usr/bin/env bash
# ============================================================
# 31일 제한 백엔드 배포 스크립트 (서버 40차)
# 실행 위치: /Users/hoonjaepark/projects/travelPlanner (메인 작업트리)
#
# 검증된 사실:
#   - 서버 39차 코드 == 메인 작업트리의 미커밋 백엔드 변경 (교차검증 완료)
#   - 따라서 메인 작업트리 backend/src/ 를 rsync하면:
#       서버 39차 보존 + 31일 제한 5개 파일만 신규 추가
#   - rsync dry-run으로 실제 전송 대상이 31일 제한 파일 5개뿐임을 확인:
#       is-within-max-duration.validator.ts, trips/constants.ts,
#       trips/trips.service.ts, create-trip.dto.ts, create-trip.dto.spec.ts
#
# ⚠️ 클린 worktree(main 기준)로 배포하면 서버 39차가 롤백되므로 금지.
#    반드시 이 메인 작업트리에서 실행할 것.
# ============================================================
set -euo pipefail
KEY="$HOME/.ssh/travelplanner-oci"
SRV="root@46.62.201.127"
SSH="ssh -i $KEY $SRV"

cd "$(dirname "$0")/.."  # 프로젝트 루트로 이동

echo "[0/4] 사전 점검: 전송 대상이 31일 제한 파일만인지 (dry-run)"
CHANGED=$(rsync -avzn --exclude node_modules -e "ssh -i $KEY" \
  backend/src/ "$SRV:/root/travelPlanner/backend/src/" | grep -E '\.ts$' || true)
echo "$CHANGED"
if echo "$CHANGED" | grep -vqE 'is-within-max-duration|trips/constants.ts|trips/trips.service.ts|create-trip.dto'; then
  echo "⚠️  31일 제한 외 파일이 전송 대상에 포함됨. 검토 후 수동 진행하세요."
  echo "    (서버와 작업트리 백엔드 차이가 예상과 다름)"
  exit 1
fi
echo "  ✅ 전송 대상 = 31일 제한 파일만 확인됨"

echo "[1/4] 백엔드 소스 rsync (메인 작업트리 → 서버)"
rsync -avz --exclude node_modules -e "ssh -i $KEY" \
  backend/src/ "$SRV:/root/travelPlanner/backend/src/"

echo "[2/4] 서버 docker compose build"
$SSH "cd /root/travelPlanner/backend && docker compose build"

echo "[3/4] 서버 컨테이너 재기동"
$SSH "cd /root/travelPlanner/backend && docker compose up -d"

echo "[4/4] 헬스 체크"
$SSH "cd /root/travelPlanner/backend && docker compose ps"
echo "✅ 백엔드 배포 완료 — 31일 제한 발효 (모든 앱 버전에 즉시 적용)"
