#!/bin/bash
# OCI 마이그레이션 스크립트: E2.1.Micro → A1.Flex
# 로컬에서 실행
# 사용법: bash scripts/oci-migrate.sh <NEW_IP>

set -euo pipefail

OLD_HOST="150.230.251.32"
NEW_HOST="${1:?Usage: $0 <NEW_A1_IP>}"
SSH_KEY="$HOME/.ssh/travelplanner-oci"
PROJECT_DIR="$HOME/projects/travelPlanner"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== OCI 마이그레이션: E2.1.Micro → A1.Flex ==="
echo "소스: $OLD_HOST (x86_64)"
echo "대상: $NEW_HOST (aarch64)"
echo ""

# 1. 기존 서버에서 DB 덤프
echo "[1/7] PostgreSQL 데이터 덤프..."
ssh -i "$SSH_KEY" "ubuntu@$OLD_HOST" \
    "docker exec travelplanner-postgres-1 pg_dump -U postgres -Fc travelplanner > /tmp/db_backup_${TIMESTAMP}.dump"

echo "  덤프 파일 로컬로 복사..."
scp -i "$SSH_KEY" "ubuntu@$OLD_HOST:/tmp/db_backup_${TIMESTAMP}.dump" "/tmp/db_backup_${TIMESTAMP}.dump"
echo "  덤프 크기: $(ls -lh /tmp/db_backup_${TIMESTAMP}.dump | awk '{print $5}')"

# 2. 기존 서버에서 업로드 파일 복사
echo "[2/7] 업로드 파일 복사..."
ssh -i "$SSH_KEY" "ubuntu@$OLD_HOST" "cd ~/travelPlanner && tar czf /tmp/uploads_${TIMESTAMP}.tar.gz backend/uploads/ 2>/dev/null || echo 'no uploads'"
scp -i "$SSH_KEY" "ubuntu@$OLD_HOST:/tmp/uploads_${TIMESTAMP}.tar.gz" "/tmp/uploads_${TIMESTAMP}.tar.gz" 2>/dev/null || echo "  업로드 파일 없음 (스킵)"

# 3. 기존 서버에서 .env 복사
echo "[3/7] 환경 설정 파일 복사..."
scp -i "$SSH_KEY" "ubuntu@$OLD_HOST:~/travelPlanner/backend/.env" "/tmp/backend_env_${TIMESTAMP}"
echo "  .env 복사 완료"

# 4. 새 서버 초기 셋업
echo "[4/7] 새 서버 초기 셋업..."
scp -i "$SSH_KEY" "${PROJECT_DIR}/scripts/oci-a1-setup.sh" "ubuntu@$NEW_HOST:/tmp/oci-a1-setup.sh"
ssh -i "$SSH_KEY" "ubuntu@$NEW_HOST" "bash /tmp/oci-a1-setup.sh"

# 5. 프로젝트 파일 rsync (git tracked files only)
echo "[5/7] 프로젝트 파일 동기화..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'dist' \
    --exclude 'playwright-report' \
    --exclude '*.log' \
    -e "ssh -i $SSH_KEY" \
    "$PROJECT_DIR/" "ubuntu@$NEW_HOST:~/travelPlanner/"

# .env 복원
echo "  .env 복원..."
scp -i "$SSH_KEY" "/tmp/backend_env_${TIMESTAMP}" "ubuntu@$NEW_HOST:~/travelPlanner/backend/.env"

# 업로드 파일 복원
if [ -f "/tmp/uploads_${TIMESTAMP}.tar.gz" ]; then
    echo "  업로드 파일 복원..."
    scp -i "$SSH_KEY" "/tmp/uploads_${TIMESTAMP}.tar.gz" "ubuntu@$NEW_HOST:/tmp/"
    ssh -i "$SSH_KEY" "ubuntu@$NEW_HOST" "cd ~/travelPlanner && tar xzf /tmp/uploads_${TIMESTAMP}.tar.gz"
fi

# 6. Docker 빌드 & 시작
echo "[6/7] Docker 빌드 (ARM64)..."
ssh -i "$SSH_KEY" "ubuntu@$NEW_HOST" "cd ~/travelPlanner && \
    docker compose -f docker-compose.yml -f docker-compose.micro.yml -f docker-compose.ssl-micro.yml build --no-cache 2>&1 | tail -20"

echo "  DB + Redis 먼저 시작..."
ssh -i "$SSH_KEY" "ubuntu@$NEW_HOST" "cd ~/travelPlanner && \
    docker compose -f docker-compose.yml -f docker-compose.micro.yml -f docker-compose.ssl-micro.yml up -d postgres redis"

echo "  DB 시작 대기 (15초)..."
sleep 15

# DB 덤프 복원
echo "  DB 덤프 복원..."
scp -i "$SSH_KEY" "/tmp/db_backup_${TIMESTAMP}.dump" "ubuntu@$NEW_HOST:/tmp/"
ssh -i "$SSH_KEY" "ubuntu@$NEW_HOST" "docker cp /tmp/db_backup_${TIMESTAMP}.dump travelplanner-postgres-1:/tmp/db_backup.dump && \
    docker exec travelplanner-postgres-1 pg_restore -U postgres -d travelplanner --clean --if-exists /tmp/db_backup.dump 2>&1 || echo 'Restore done (warnings ok)'"

echo "  나머지 서비스 시작..."
ssh -i "$SSH_KEY" "ubuntu@$NEW_HOST" "cd ~/travelPlanner && \
    docker compose -f docker-compose.yml -f docker-compose.micro.yml -f docker-compose.ssl-micro.yml up -d"

# 7. DuckDNS 업데이트
echo "[7/7] DuckDNS IP 업데이트..."
ssh -i "$SSH_KEY" "ubuntu@$NEW_HOST" "curl -s 'https://www.duckdns.org/update?domains=mytravelplanner&token=\$(grep DUCKDNS /etc/cron.d/duckdns 2>/dev/null | grep -oP \"token=\K[^&]+\" || echo NEED_TOKEN)&ip='"
echo ""
echo "  ⚠️  DuckDNS 토큰은 수동 확인 필요"
echo "  crontab 확인: ssh -i $SSH_KEY ubuntu@$NEW_HOST 'crontab -l'"

echo ""
echo "=== 마이그레이션 완료 ==="
echo "새 서버: $NEW_HOST"
echo ""
echo "확인 명령어:"
echo "  ssh -i $SSH_KEY ubuntu@$NEW_HOST 'docker ps'"
echo "  ssh -i $SSH_KEY ubuntu@$NEW_HOST 'free -h'"
echo "  curl -k https://$NEW_HOST/api/health"
echo ""
echo "⚠️  남은 수동 작업:"
echo "  1. DuckDNS cron 설정 (5분마다)"
echo "  2. Let's Encrypt certbot 설정"
echo "  3. 정상 작동 확인 후 기존 E2.1.Micro 중지"
