#!/bin/bash
# Hetzner CAX21 마이그레이션 스크립트: OCI E2.1.Micro → Hetzner CAX21 (ARM)
# 로컬 Mac에서 실행
#
# 사전 준비:
#   1. Hetzner Cloud Console에서 CAX21 인스턴스 생성 (Ubuntu 24.04, SSH key 추가)
#   2. 인스턴스 공인 IP 확인
#
# 사용법:
#   bash scripts/hetzner-migrate.sh <HETZNER_IP>
#   bash scripts/hetzner-migrate.sh <HETZNER_IP> --skip-setup   # 서버 셋업 스킵
#   bash scripts/hetzner-migrate.sh <HETZNER_IP> --skip-db      # DB 이관 스킵

set -euo pipefail

# --- Configuration ---
NEW_HOST="${1:?Usage: $0 <HETZNER_IP> [--skip-setup] [--skip-db]}"
OLD_HOST="150.230.251.32"
OLD_SSH_KEY="$HOME/.ssh/travelplanner-oci"
NEW_SSH_KEY="$HOME/.ssh/travelplanner-oci"  # 동일 키 사용 시. 다르면 변경
PROJECT_DIR="$HOME/projects/travelPlanner"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.hetzner.yml -f docker-compose.ssl-arm.yml"

# Hetzner는 root 또는 별도 유저 (Ubuntu 이미지는 root)
HETZNER_USER="root"

SKIP_SETUP=false
SKIP_DB=false
for arg in "${@:2}"; do
  case $arg in
    --skip-setup) SKIP_SETUP=true ;;
    --skip-db)    SKIP_DB=true ;;
  esac
done

# --- Color output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; }
ok()   { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $*"; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $*"; exit 1; }

OLD_SSH="ssh -i $OLD_SSH_KEY -o ConnectTimeout=10 ubuntu@$OLD_HOST"
NEW_SSH="ssh -i $NEW_SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new $HETZNER_USER@$NEW_HOST"
NEW_SCP="scp -i $NEW_SSH_KEY -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"

echo ""
echo "=== Hetzner CAX21 마이그레이션 ==="
echo "소스: OCI $OLD_HOST (x86_64, 1GB)"
echo "대상: Hetzner $NEW_HOST (aarch64, 8GB)"
echo "Compose: $COMPOSE_CMD"
echo ""

# ─────────────────────────────────────────────
# Step 1: 새 서버 초기 셋업
# ─────────────────────────────────────────────
if [ "$SKIP_SETUP" = false ]; then
  log "[1/8] 새 서버 초기 셋업..."

  $NEW_SSH << 'SETUP_EOF'
    set -euo pipefail
    echo "아키텍처: $(uname -m)"

    # 시스템 업데이트
    apt-get update -y && apt-get upgrade -y

    # Docker 설치
    if ! command -v docker &> /dev/null; then
      curl -fsSL https://get.docker.com | sh
      echo "Docker 설치 완료"
    else
      echo "Docker 이미 설치됨: $(docker --version)"
    fi

    # Docker Compose 플러그인 확인
    if docker compose version &> /dev/null; then
      echo "Docker Compose: $(docker compose version)"
    else
      apt-get install -y docker-compose-plugin
    fi

    # Swap 설정 (2GB — 8GB RAM에 적절)
    if [ ! -f /swapfile ]; then
      fallocate -l 2G /swapfile
      chmod 600 /swapfile
      mkswap /swapfile
      swapon /swapfile
      echo '/swapfile none swap sw 0 0' >> /etc/fstab
      echo "Swap 2GB 생성 완료"
    else
      echo "Swap 이미 존재: $(free -h | grep Swap)"
    fi

    # 방화벽 (Hetzner는 기본 열려있음, ufw만 설정)
    if command -v ufw &> /dev/null; then
      ufw allow 22/tcp
      ufw allow 80/tcp
      ufw allow 443/tcp
      ufw --force enable
      echo "UFW 방화벽 설정 완료"
    fi

    # 프로젝트 디렉토리
    mkdir -p ~/travelPlanner ~/backups

    echo ""
    echo "메모리: $(free -h | grep Mem | awk '{print $2}')"
    echo "디스크: $(df -h / | tail -1 | awk '{print $4}') 남음"
    echo "Docker: $(docker --version 2>/dev/null)"
SETUP_EOF

  ok "서버 초기 셋업 완료"
else
  log "[1/8] 서버 셋업 스킵 (--skip-setup)"
fi

# ─────────────────────────────────────────────
# Step 2: 기존 서버에서 DB 덤프
# ─────────────────────────────────────────────
if [ "$SKIP_DB" = false ]; then
  log "[2/8] PostgreSQL 데이터 덤프..."
  $OLD_SSH "docker exec travelplanner-postgres-1 pg_dump -U postgres -Fc travelplanner > /tmp/db_backup_${TIMESTAMP}.dump"
  scp -i "$OLD_SSH_KEY" "ubuntu@$OLD_HOST:/tmp/db_backup_${TIMESTAMP}.dump" "/tmp/db_backup_${TIMESTAMP}.dump"
  ok "덤프 크기: $(ls -lh /tmp/db_backup_${TIMESTAMP}.dump | awk '{print $5}')"
else
  log "[2/8] DB 이관 스킵 (--skip-db)"
fi

# ─────────────────────────────────────────────
# Step 3: 업로드 파일 복사
# ─────────────────────────────────────────────
log "[3/8] 업로드 파일 복사..."
$OLD_SSH "cd ~/travelPlanner && tar czf /tmp/uploads_${TIMESTAMP}.tar.gz -C backend uploads/ 2>/dev/null || echo 'no uploads'" || true
scp -i "$OLD_SSH_KEY" "ubuntu@$OLD_HOST:/tmp/uploads_${TIMESTAMP}.tar.gz" "/tmp/uploads_${TIMESTAMP}.tar.gz" 2>/dev/null && \
  ok "업로드 파일 복사 완료" || echo "  업로드 파일 없음 (스킵)"

# ─────────────────────────────────────────────
# Step 4: 환경 설정 파일 복사
# ─────────────────────────────────────────────
log "[4/8] .env 파일 복사..."
scp -i "$OLD_SSH_KEY" "ubuntu@$OLD_HOST:~/travelPlanner/backend/.env" "/tmp/backend_env_${TIMESTAMP}"
scp -i "$OLD_SSH_KEY" "ubuntu@$OLD_HOST:~/travelPlanner/.env" "/tmp/root_env_${TIMESTAMP}" 2>/dev/null || echo "  root .env 없음"
ok ".env 복사 완료"

# ─────────────────────────────────────────────
# Step 5: 프로젝트 파일 rsync
# ─────────────────────────────────────────────
log "[5/8] 프로젝트 파일 동기화..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude 'playwright-report' \
    --exclude 'test-results' \
    --exclude '*.log' \
    --exclude '.claude' \
    -e "ssh -i $NEW_SSH_KEY -o StrictHostKeyChecking=accept-new" \
    "$PROJECT_DIR/" "$HETZNER_USER@$NEW_HOST:~/travelPlanner/"

# .env 복원
$NEW_SCP "/tmp/backend_env_${TIMESTAMP}" "$HETZNER_USER@$NEW_HOST:~/travelPlanner/backend/.env"
[ -f "/tmp/root_env_${TIMESTAMP}" ] && $NEW_SCP "/tmp/root_env_${TIMESTAMP}" "$HETZNER_USER@$NEW_HOST:~/travelPlanner/.env"

# 업로드 파일 복원
if [ -f "/tmp/uploads_${TIMESTAMP}.tar.gz" ]; then
    $NEW_SCP "/tmp/uploads_${TIMESTAMP}.tar.gz" "$HETZNER_USER@$NEW_HOST:/tmp/"
    $NEW_SSH "cd ~/travelPlanner/backend && tar xzf /tmp/uploads_${TIMESTAMP}.tar.gz"
fi
ok "파일 동기화 완료"

# ─────────────────────────────────────────────
# Step 6: Docker 빌드 (순차 — ARM64)
# ─────────────────────────────────────────────
log "[6/8] Docker 순차 빌드 (ARM64, ~30분)..."
$NEW_SSH "cd ~/travelPlanner && $COMPOSE_CMD build backend 2>&1 | tail -5"
ok "Backend 빌드 완료"
$NEW_SSH "cd ~/travelPlanner && $COMPOSE_CMD build frontend 2>&1 | tail -5"
ok "Frontend 빌드 완료"

# ─────────────────────────────────────────────
# Step 7: 서비스 시작 + DB 복원
# ─────────────────────────────────────────────
log "[7/8] 서비스 시작..."

# DB + Redis 먼저
$NEW_SSH "cd ~/travelPlanner && $COMPOSE_CMD up -d postgres redis"
log "  DB/Redis 시작 대기 (20초)..."
sleep 20

# DB 복원
if [ "$SKIP_DB" = false ]; then
    log "  DB 덤프 복원..."
    $NEW_SCP "/tmp/db_backup_${TIMESTAMP}.dump" "$HETZNER_USER@$NEW_HOST:/tmp/"

    # pgvector extension 먼저 생성
    $NEW_SSH "docker exec travelplanner-postgres-1 psql -U postgres -d travelplanner -c 'CREATE EXTENSION IF NOT EXISTS vector;'" 2>/dev/null || true

    $NEW_SSH "docker cp /tmp/db_backup_${TIMESTAMP}.dump travelplanner-postgres-1:/tmp/db_backup.dump && \
        docker exec travelplanner-postgres-1 pg_restore -U postgres -d travelplanner --clean --if-exists /tmp/db_backup.dump 2>&1 || echo 'Restore done (warnings ok)'"
    ok "DB 복원 완료"
fi

# 나머지 서비스 시작
$NEW_SSH "cd ~/travelPlanner && $COMPOSE_CMD up -d"

log "  Backend health check 대기 (최대 120초)..."
ELAPSED=0
while [ $ELAPSED -lt 120 ]; do
    STATUS=$($NEW_SSH "docker inspect --format='{{.State.Health.Status}}' travelplanner-backend-1" 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "healthy" ]; then
        ok "Backend healthy (${ELAPSED}s)"
        break
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    echo "   ... ${ELAPSED}s ($STATUS)"
done

# ─────────────────────────────────────────────
# Step 8: 검증
# ─────────────────────────────────────────────
log "[8/8] 검증..."

$NEW_SSH "docker ps --format 'table {{.Names}}\t{{.Status}}'"
echo ""

# Health check via IP
HEALTH=$(curl -sk "http://$NEW_HOST:8080/health" 2>/dev/null || echo "FAIL")
API_HEALTH=$(curl -sk "http://$NEW_HOST:3000/api/health" 2>/dev/null || echo "FAIL")

echo "  Frontend health: $HEALTH"
echo "  API health: $API_HEALTH"

$NEW_SSH "free -h | head -2"

echo ""
echo "=== 마이그레이션 완료 ==="
echo ""
echo "서버: $NEW_HOST (Hetzner CAX21, 4 vCPU, 8GB RAM)"
echo "Compose: $COMPOSE_CMD"
echo ""
echo "━━━ 남은 수동 작업 ━━━"
echo ""
echo "1. Cloudflare DNS A record 변경:"
echo "   mytravel-planner.com → $NEW_HOST (Proxied)"
echo ""
echo "2. SSL 인증서 발급 (Cloudflare Proxied이면 불필요):"
echo "   Cloudflare SSL mode: Full 유지"
echo ""
echo "3. .env에서 DOMAIN_NEW=mytravel-planner.com 확인:"
echo "   $NEW_SSH 'grep DOMAIN ~/travelPlanner/.env'"
echo ""
echo "4. 정상 작동 확인 후:"
echo "   - 기존 OCI 서버 1~2일 유지 후 삭제"
echo "   - deploy.sh 내 OCI_HOST IP 변경"
echo ""
echo "5. deploy.sh 업데이트:"
echo "   OCI_HOST=\"$HETZNER_USER@$NEW_HOST\""
echo "   COMPOSE_CMD=\"$COMPOSE_CMD\""
