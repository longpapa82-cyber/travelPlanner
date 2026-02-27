#!/usr/bin/env bash
set -euo pipefail

# DEPRECATED: Use ./scripts/deploy.sh instead (zero-downtime deploy + BuildKit + auto-rollback)
echo "⚠️  WARNING: deploy-full.sh is deprecated. Use ./scripts/deploy.sh instead."
echo "   New script features: zero-downtime blue-green, BuildKit cache, auto-rollback"
echo ""

# Full deployment: Build Docker images locally, transfer to OCI, restart services.
# Local Mac build is 5-10x faster than building on the 1GB RAM OCI micro instance.
#
# Usage:
#   ./scripts/deploy-full.sh                  # Build locally + transfer (recommended)
#   ./scripts/deploy-full.sh --frontend-only  # Frontend only
#   ./scripts/deploy-full.sh --backend-only   # Backend only
#   ./scripts/deploy-full.sh --skip-build     # Rsync + build on remote (old method)

OCI_HOST="ubuntu@150.230.251.32"
OCI_KEY="$HOME/.ssh/travelplanner-oci"
REMOTE_DIR="~/travelPlanner"
SSH_CMD="ssh -i $OCI_KEY -o ConnectTimeout=10 -o ServerAliveInterval=30 $OCI_HOST"
COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.micro.yml -f docker-compose.ssl-micro.yml"

# Wait for a container to become healthy (polls every 5s, up to MAX_WAIT)
wait_healthy() {
  local SERVICE=$1
  local MAX_WAIT=${2:-120}
  local ELAPSED=0

  echo "   Waiting for $SERVICE to become healthy (max ${MAX_WAIT}s)..."
  while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS=$($SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD ps $SERVICE --format '{{.Health}}'" 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "healthy" ]; then
      echo "   $SERVICE is healthy (${ELAPSED}s)"
      return 0
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    printf "   ... %ds (%s)\n" "$ELAPSED" "$STATUS"
  done

  echo "   ERROR: $SERVICE did not become healthy within ${MAX_WAIT}s"
  return 1
}

# Verify all critical containers are running (not Created/Exited)
verify_containers() {
  echo ""
  echo "=== Post-Deploy Verification ==="
  local FAILED=0

  for SVC in postgres redis backend frontend proxy; do
    STATE=$($SSH_CMD "docker inspect travelplanner-${SVC}-1 --format '{{.State.Status}}'" 2>/dev/null || echo "missing")
    if [ "$STATE" = "running" ]; then
      echo "   $SVC: running"
    else
      echo "   ERROR: $SVC is '$STATE' — attempting restart..."
      $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d $SVC" 2>/dev/null
      sleep 5
      STATE=$($SSH_CMD "docker inspect travelplanner-${SVC}-1 --format '{{.State.Status}}'" 2>/dev/null || echo "missing")
      if [ "$STATE" = "running" ]; then
        echo "   $SVC: recovered"
      else
        echo "   CRITICAL: $SVC failed to start (state: $STATE)"
        FAILED=1
      fi
    fi
  done

  if [ $FAILED -eq 1 ]; then
    echo ""
    echo "WARNING: Some containers failed to start. Check logs:"
    echo "  ssh -i $OCI_KEY $OCI_HOST \"cd $REMOTE_DIR && $COMPOSE_CMD logs --tail 30\""
    return 1
  fi

  # Final HTTP check
  echo ""
  echo "   Testing HTTPS endpoint..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://mytravel-planner.com 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "   Site is live (HTTP $HTTP_CODE)"
  else
    echo "   WARNING: Site returned HTTP $HTTP_CODE"
    return 1
  fi
  return 0
}

# Parse flags
BUILD_FRONTEND=true
BUILD_BACKEND=true
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --frontend-only) BUILD_BACKEND=false ;;
    --backend-only)  BUILD_FRONTEND=false ;;
    --skip-build)    SKIP_BUILD=true ;;
  esac
done

START_TIME=$(date +%s)

echo "=== Full Production Deploy ==="
echo ""

# Step 1: Sync source files (excluding .env and node_modules)
echo "[1/5] Syncing source files to OCI..."
rsync -az --delete \
  -e "ssh -i $OCI_KEY" \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='.env.production' \
  --exclude='.expo' \
  --exclude='dist' \
  --exclude='uploads' \
  --exclude='backups' \
  --exclude='playwright-report' \
  --exclude='test-results' \
  --exclude='.git' \
  ./ "$OCI_HOST:$REMOTE_DIR/"
echo "   Source synced."

if [ "$SKIP_BUILD" = true ]; then
  echo "[2/5] Skipping local build (--skip-build)."
  echo "[3/5] Skipping image transfer."

  # Build on remote instead
  echo "[4/5] Building on remote..."
  if [ "$BUILD_FRONTEND" = true ]; then
    echo "   Building frontend on remote (slow on micro instance)..."
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD build frontend"
  fi
  if [ "$BUILD_BACKEND" = true ]; then
    echo "   Building backend on remote..."
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD build backend"
  fi

  # Restart (sequential: backend → wait healthy → frontend → proxy)
  echo "[5/5] Restarting services..."
  if [ "$BUILD_BACKEND" = true ]; then
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d backend"
    wait_healthy backend 120
  fi
  if [ "$BUILD_FRONTEND" = true ]; then
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d frontend"
    wait_healthy frontend 60
  fi
  $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d proxy"
else
  # Step 2: Build images locally (fast on Mac)
  echo "[2/5] Building Docker images locally (linux/amd64)..."
  if [ "$BUILD_FRONTEND" = true ]; then
    echo "   Building frontend image..."
    docker build --platform linux/amd64 -t travelplanner-frontend:latest ./frontend
  fi
  if [ "$BUILD_BACKEND" = true ]; then
    echo "   Building backend image..."
    docker build --platform linux/amd64 -t travelplanner-backend:latest ./backend
  fi
  echo "   Build complete."

  # Step 3: Save, compress, and transfer images via SSH pipe
  echo "[3/5] Transferring images to OCI (compressed)..."
  if [ "$BUILD_FRONTEND" = true ]; then
    echo "   Transferring frontend image..."
    docker save travelplanner-frontend:latest | gzip | \
      $SSH_CMD "gunzip | docker load"
  fi
  if [ "$BUILD_BACKEND" = true ]; then
    echo "   Transferring backend image..."
    docker save travelplanner-backend:latest | gzip | \
      $SSH_CMD "gunzip | docker load"
  fi
  echo "   Transfer complete."

  # Step 4: No tagging needed — compose uses explicit image names
  echo "[4/5] Images ready."

  # Step 5: Restart services (sequential: backend → wait healthy → frontend → proxy)
  echo "[5/5] Restarting services..."
  if [ "$BUILD_BACKEND" = true ]; then
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build backend"
    wait_healthy backend 120
  fi
  if [ "$BUILD_FRONTEND" = true ]; then
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build frontend"
    wait_healthy frontend 60
  fi
  $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build proxy"
fi

# Verify all containers + HTTP endpoint
verify_containers

echo ""
$SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD ps --format 'table {{.Name}}\t{{.Status}}'"

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS_=$((ELAPSED % 60))

echo ""
echo "=== Deploy Complete (${MINUTES}m ${SECONDS_}s) ==="
echo "URL: https://mytravel-planner.com"
