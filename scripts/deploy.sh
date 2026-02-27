#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# Zero-Downtime Production Deploy for MyTravel
#
# Usage:
#   ./scripts/deploy.sh                    # Full zero-downtime deploy
#   ./scripts/deploy.sh --backend-only     # Backend only
#   ./scripts/deploy.sh --frontend-only    # Frontend only
#   ./scripts/deploy.sh --dry-run          # Build + transfer only (no restart)
#   ./scripts/deploy.sh --rollback         # Instant rollback to previous images
#
# Prerequisites:
#   - Docker + BuildKit on local Mac
#   - SSH access to OCI server
#   - Docker Compose stack running on OCI
###############################################################################

# --- Configuration ---
OCI_HOST="ubuntu@150.230.251.32"
OCI_KEY="$HOME/.ssh/travelplanner-oci"
REMOTE_DIR="~/travelPlanner"
DOMAIN="mytravel-planner.com"
SSH_CMD="ssh -i $OCI_KEY -o ConnectTimeout=10 -o ServerAliveInterval=30 $OCI_HOST"
SCP_CMD="scp -i $OCI_KEY -o ConnectTimeout=10"
COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.micro.yml -f docker-compose.ssl-micro.yml"
DOCKER_NETWORK="travelplanner_travelplanner"
STATE_FILE="deploy-state.json"
LOG_DIR="logs"
DEPLOY_LOG=""

# --- Color output ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $*"; echo "[$(date +%H:%M:%S)] $*" >> "$DEPLOY_LOG" 2>/dev/null || true; }
ok()   { echo -e "${GREEN}[$(date +%H:%M:%S)] ✓${NC} $*"; echo "[$(date +%H:%M:%S)] OK: $*" >> "$DEPLOY_LOG" 2>/dev/null || true; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $*"; echo "[$(date +%H:%M:%S)] WARN: $*" >> "$DEPLOY_LOG" 2>/dev/null || true; }
err()  { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $*"; echo "[$(date +%H:%M:%S)] ERROR: $*" >> "$DEPLOY_LOG" 2>/dev/null || true; }

# --- Parse flags ---
BUILD_FRONTEND=true
BUILD_BACKEND=true
DRY_RUN=false
ROLLBACK=false

for arg in "$@"; do
  case $arg in
    --frontend-only) BUILD_BACKEND=false ;;
    --backend-only)  BUILD_FRONTEND=false ;;
    --dry-run)       DRY_RUN=true ;;
    --rollback)      ROLLBACK=true ;;
    -h|--help)
      echo "Usage: ./scripts/deploy.sh [options]"
      echo "  --backend-only   Deploy backend only"
      echo "  --frontend-only  Deploy frontend only"
      echo "  --dry-run        Build and transfer only (no restart)"
      echo "  --rollback       Instant rollback to previous images"
      exit 0
      ;;
  esac
done

# --- Setup deploy log ---
mkdir -p "$LOG_DIR"
DEPLOY_LOG="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
touch "$DEPLOY_LOG"

START_TIME=$(date +%s)

###############################################################################
# Helper Functions
###############################################################################

# Wait for a Compose service to become healthy
wait_healthy() {
  local SERVICE=$1
  local MAX_WAIT=${2:-120}
  local ELAPSED=0

  log "Waiting for $SERVICE to become healthy (max ${MAX_WAIT}s)..."
  while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS=$($SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD ps $SERVICE --format '{{.Health}}'" 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "healthy" ]; then
      ok "$SERVICE is healthy (${ELAPSED}s)"
      return 0
    fi
    sleep 5
    ELAPSED=$((ELAPSED + 5))
    printf "   ... %ds (%s)\n" "$ELAPSED" "$STATUS"
  done

  err "$SERVICE did not become healthy within ${MAX_WAIT}s"
  return 1
}

# Wait for a standalone container's healthcheck
wait_container_healthy() {
  local CONTAINER=$1
  local MAX_WAIT=${2:-120}
  local ELAPSED=0

  log "Waiting for container $CONTAINER healthcheck (max ${MAX_WAIT}s)..."
  while [ $ELAPSED -lt $MAX_WAIT ]; do
    HEALTH=$($SSH_CMD "docker inspect --format '{{.State.Health.Status}}' $CONTAINER" 2>/dev/null || echo "starting")
    if [ "$HEALTH" = "healthy" ]; then
      ok "Container $CONTAINER is healthy (${ELAPSED}s)"
      return 0
    fi
    if [ "$HEALTH" = "unhealthy" ]; then
      err "Container $CONTAINER is unhealthy"
      $SSH_CMD "docker logs --tail 10 $CONTAINER" 2>/dev/null || true
      return 1
    fi
    sleep 10
    ELAPSED=$((ELAPSED + 10))
    printf "   ... %ds (%s)\n" "$ELAPSED" "$HEALTH"
  done

  err "Container $CONTAINER did not become healthy within ${MAX_WAIT}s"
  return 1
}

# Get internal container IP on the Docker network
get_container_ip() {
  local CONTAINER=$1
  $SSH_CMD "docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $CONTAINER" 2>/dev/null
}

# Update upstreams.conf on the remote server
update_upstream() {
  local FRONTEND_TARGET=$1
  local BACKEND_TARGET=$2
  $SSH_CMD "cat > $REMOTE_DIR/proxy/upstreams.conf << 'UPSTREAM_EOF'
upstream frontend_pool {
    server ${FRONTEND_TARGET};
}

upstream backend_pool {
    server ${BACKEND_TARGET};
}
UPSTREAM_EOF"
}

# Reload nginx without downtime
reload_nginx() {
  local PROXY_CONTAINER
  PROXY_CONTAINER=$($SSH_CMD "docker ps --filter 'name=travelplanner.*proxy' --format '{{.Names}}'" 2>/dev/null | head -1)
  if [ -z "$PROXY_CONTAINER" ]; then
    err "Proxy container not found"
    return 1
  fi
  $SSH_CMD "docker exec $PROXY_CONTAINER nginx -s reload" 2>/dev/null
  ok "Nginx reloaded"
}

# Save deploy state to remote server
save_state() {
  local COMMIT
  COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
  $SSH_CMD "cat > $REMOTE_DIR/$STATE_FILE << STATE_EOF
{
  \"last_deploy\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"backend_image_id\": \"$($SSH_CMD 'docker images travelplanner-backend:latest --format "{{.ID}}"' 2>/dev/null || echo 'unknown')\",
  \"frontend_image_id\": \"$($SSH_CMD 'docker images travelplanner-frontend:latest --format "{{.ID}}"' 2>/dev/null || echo 'unknown')\",
  \"previous_backend_image_id\": \"${PREV_BACKEND_ID:-none}\",
  \"previous_frontend_image_id\": \"${PREV_FRONTEND_ID:-none}\",
  \"deploy_commit\": \"$COMMIT\"
}
STATE_EOF"
}

# Zero-downtime deploy for a single service (blue-green switch)
deploy_service() {
  local SERVICE=$1      # "backend" or "frontend"
  local PORT=$2         # internal port
  local POOL=$3         # upstream pool name
  local MEM_LIMIT=$4    # memory limit for green container

  local GREEN_NAME="${SERVICE}-green"
  local IMAGE="travelplanner-${SERVICE}:latest"
  local HEALTHCHECK_PATH

  if [ "$SERVICE" = "backend" ]; then
    HEALTHCHECK_PATH="/api/health"
  else
    HEALTHCHECK_PATH="/health"
  fi

  log "=== Zero-downtime deploy: $SERVICE ==="

  # Step 1: Start green container
  log "Starting green container: $GREEN_NAME"
  local DOCKER_RUN_CMD="docker run -d --name $GREEN_NAME --network $DOCKER_NETWORK --memory=$MEM_LIMIT"

  if [ "$SERVICE" = "backend" ]; then
    # Backend needs env vars, volumes, and depends on postgres/redis
    DOCKER_RUN_CMD="$DOCKER_RUN_CMD --env-file $REMOTE_DIR/backend/.env"
    DOCKER_RUN_CMD="$DOCKER_RUN_CMD -e DB_HOST=postgres -e REDIS_HOST=redis -e REDIS_PORT=6379"
    DOCKER_RUN_CMD="$DOCKER_RUN_CMD -e NODE_ENV=production -e NODE_OPTIONS=--max-old-space-size=200"
    # Mount uploads volume (get volume name from compose)
    local UPLOADS_VOL
    UPLOADS_VOL=$($SSH_CMD "docker volume ls --format '{{.Name}}' | grep uploads" 2>/dev/null | head -1)
    if [ -n "$UPLOADS_VOL" ]; then
      DOCKER_RUN_CMD="$DOCKER_RUN_CMD -v ${UPLOADS_VOL}:/app/uploads"
    fi
    DOCKER_RUN_CMD="$DOCKER_RUN_CMD --health-cmd='wget --spider -q http://localhost:${PORT}${HEALTHCHECK_PATH} || exit 1'"
    DOCKER_RUN_CMD="$DOCKER_RUN_CMD --health-interval=10s --health-timeout=5s --health-start-period=30s --health-retries=3"
  else
    # Frontend needs static content volume
    DOCKER_RUN_CMD="$DOCKER_RUN_CMD -v $REMOTE_DIR/frontend/public:/static-content:ro"
    DOCKER_RUN_CMD="$DOCKER_RUN_CMD --health-cmd='wget -qO- http://localhost:${PORT}${HEALTHCHECK_PATH} || exit 1'"
    DOCKER_RUN_CMD="$DOCKER_RUN_CMD --health-interval=10s --health-timeout=3s --health-start-period=10s --health-retries=3"
  fi

  DOCKER_RUN_CMD="$DOCKER_RUN_CMD $IMAGE"

  # Remove any leftover green container
  $SSH_CMD "docker rm -f $GREEN_NAME 2>/dev/null || true"
  $SSH_CMD "$DOCKER_RUN_CMD" 2>/dev/null

  # Step 2: Wait for green container to be healthy
  if ! wait_container_healthy "$GREEN_NAME" 120; then
    err "Green container failed healthcheck — aborting $SERVICE deploy"
    $SSH_CMD "docker rm -f $GREEN_NAME 2>/dev/null || true"
    return 1
  fi

  # Step 3: Get green container's internal IP
  local GREEN_IP
  GREEN_IP=$(get_container_ip "$GREEN_NAME")
  if [ -z "$GREEN_IP" ]; then
    err "Could not get IP for $GREEN_NAME"
    $SSH_CMD "docker rm -f $GREEN_NAME 2>/dev/null || true"
    return 1
  fi
  log "Green container IP: $GREEN_IP"

  # Step 4: Switch upstream to green container
  local CURRENT_FRONTEND CURRENT_BACKEND
  if [ "$SERVICE" = "backend" ]; then
    CURRENT_FRONTEND="frontend:8080"
    update_upstream "$CURRENT_FRONTEND" "${GREEN_IP}:${PORT}"
  else
    CURRENT_BACKEND="backend:3000"
    update_upstream "${GREEN_IP}:${PORT}" "$CURRENT_BACKEND"
  fi
  reload_nginx

  # Step 5: Drain connections (wait for in-flight requests)
  log "Draining connections (5s)..."
  sleep 5

  # Step 6: Recreate the Compose service with the new image
  log "Recreating Compose service: $SERVICE"
  $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build --force-recreate $SERVICE" 2>/dev/null

  # Step 7: Wait for Compose service to be healthy
  if ! wait_healthy "$SERVICE" 120; then
    warn "Compose service $SERVICE not healthy — keeping green container as fallback"
    return 1
  fi

  # Step 8: Restore upstream to Compose service name
  if [ "$SERVICE" = "backend" ]; then
    update_upstream "frontend:8080" "backend:3000"
  else
    update_upstream "frontend:8080" "backend:3000"
  fi
  reload_nginx

  # Step 9: Clean up green container
  sleep 2
  $SSH_CMD "docker rm -f $GREEN_NAME 2>/dev/null || true"
  ok "$SERVICE deployed successfully (zero-downtime)"
}

# Verify all containers + HTTP endpoints
verify_deployment() {
  log ""
  log "=== Post-Deploy Verification ==="
  local FAILED=0

  for SVC in postgres redis backend frontend proxy; do
    STATE=$($SSH_CMD "docker inspect travelplanner-${SVC}-1 --format '{{.State.Status}}'" 2>/dev/null || echo "missing")
    if [ "$STATE" = "running" ]; then
      ok "$SVC: running"
    else
      err "$SVC: $STATE"
      FAILED=1
    fi
  done

  # HTTPS health check
  log "Testing HTTPS endpoint..."
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$DOMAIN" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    ok "Site is live (HTTP $HTTP_CODE)"
  else
    warn "Site returned HTTP $HTTP_CODE"
    FAILED=1
  fi

  # API health check
  API_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$DOMAIN/api/health" 2>/dev/null || echo "000")
  if [ "$API_CODE" = "200" ]; then
    ok "API is healthy (HTTP $API_CODE)"
  else
    warn "API returned HTTP $API_CODE"
    FAILED=1
  fi

  return $FAILED
}

###############################################################################
# Rollback
###############################################################################
if [ "$ROLLBACK" = true ]; then
  log "=== Instant Rollback ==="

  # Read previous image IDs from state file
  STATE_JSON=$($SSH_CMD "cat $REMOTE_DIR/$STATE_FILE 2>/dev/null" || echo "{}")

  if [ "$BUILD_BACKEND" = true ]; then
    PREV_ID=$(echo "$STATE_JSON" | grep -o '"previous_backend_image_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    if [ -n "$PREV_ID" ] && [ "$PREV_ID" != "none" ]; then
      log "Rolling back backend to image: $PREV_ID"
      $SSH_CMD "docker tag $PREV_ID travelplanner-backend:latest && cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build --force-recreate backend" 2>/dev/null
      wait_healthy backend 120
    else
      warn "No previous backend image found"
    fi
  fi

  if [ "$BUILD_FRONTEND" = true ]; then
    PREV_ID=$(echo "$STATE_JSON" | grep -o '"previous_frontend_image_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4)
    if [ -n "$PREV_ID" ] && [ "$PREV_ID" != "none" ]; then
      log "Rolling back frontend to image: $PREV_ID"
      $SSH_CMD "docker tag $PREV_ID travelplanner-frontend:latest && cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build --force-recreate frontend" 2>/dev/null
      wait_healthy frontend 60
    else
      warn "No previous frontend image found"
    fi
  fi

  # Restart proxy to pick up any changes
  $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build proxy" 2>/dev/null

  verify_deployment || true

  END_TIME=$(date +%s)
  ELAPSED=$((END_TIME - START_TIME))
  ok "=== Rollback Complete (${ELAPSED}s) ==="
  exit 0
fi

###############################################################################
# Main Deploy Flow
###############################################################################
log "=== Zero-Downtime Production Deploy ==="
log "Backend: $BUILD_BACKEND | Frontend: $BUILD_FRONTEND | Dry-run: $DRY_RUN"
log ""

# [1] Pre-flight: SSH + service check + save current image IDs
log "[1/6] Pre-flight checks..."
$SSH_CMD "echo 'SSH OK'" >/dev/null 2>&1 || { err "SSH connection failed"; exit 1; }
ok "SSH connected"

# Save current image IDs for rollback
PREV_BACKEND_ID=$($SSH_CMD "docker images travelplanner-backend:latest --format '{{.ID}}'" 2>/dev/null || echo "none")
PREV_FRONTEND_ID=$($SSH_CMD "docker images travelplanner-frontend:latest --format '{{.ID}}'" 2>/dev/null || echo "none")
log "Current backend image: $PREV_BACKEND_ID"
log "Current frontend image: $PREV_FRONTEND_ID"

# [2] Sync config files (nginx, compose, etc.)
log "[2/6] Syncing configuration files..."
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
  --exclude='logs' \
  ./ "$OCI_HOST:$REMOTE_DIR/"
ok "Config synced"

# [3] Build images locally with BuildKit (parallel)
log "[3/6] Building Docker images (BuildKit + parallel)..."
export DOCKER_BUILDKIT=1

PIDS=()
if [ "$BUILD_BACKEND" = true ]; then
  log "  Building backend..."
  docker build --platform linux/amd64 -t travelplanner-backend:latest ./backend >> "$DEPLOY_LOG" 2>&1 &
  PIDS+=($!)
fi
if [ "$BUILD_FRONTEND" = true ]; then
  log "  Building frontend..."
  docker build --platform linux/amd64 -t travelplanner-frontend:latest ./frontend >> "$DEPLOY_LOG" 2>&1 &
  PIDS+=($!)
fi

# Wait for all builds to complete
BUILD_FAILED=false
for PID in "${PIDS[@]}"; do
  if ! wait "$PID"; then
    BUILD_FAILED=true
  fi
done

if [ "$BUILD_FAILED" = true ]; then
  err "Docker build failed — check $DEPLOY_LOG"
  exit 1
fi
ok "Images built"

# [4] Transfer images (sequential to avoid OOM on 1GB server)
log "[4/6] Transferring images to OCI (gzip -1 for speed)..."
if [ "$BUILD_BACKEND" = true ]; then
  log "  Transferring backend image..."
  docker save travelplanner-backend:latest | gzip -1 | \
    $SSH_CMD "gunzip | docker load" >> "$DEPLOY_LOG" 2>&1
  ok "Backend image transferred"
fi
if [ "$BUILD_FRONTEND" = true ]; then
  log "  Transferring frontend image..."
  docker save travelplanner-frontend:latest | gzip -1 | \
    $SSH_CMD "gunzip | docker load" >> "$DEPLOY_LOG" 2>&1
  ok "Frontend image transferred"
fi

# [5] Zero-downtime service switch
if [ "$DRY_RUN" = true ]; then
  log "[5/6] Dry-run mode — skipping service restart"
  log "[6/6] Skipped"
else
  log "[5/6] Zero-downtime service switch..."

  DEPLOY_FAILED=false

  # Deploy backend first (more critical, longer startup)
  if [ "$BUILD_BACKEND" = true ]; then
    if ! deploy_service "backend" "3000" "backend_pool" "200m"; then
      err "Backend deploy failed — triggering rollback"
      DEPLOY_FAILED=true
    fi
  fi

  # Deploy frontend (only if backend succeeded)
  if [ "$BUILD_FRONTEND" = true ] && [ "$DEPLOY_FAILED" = false ]; then
    if ! deploy_service "frontend" "8080" "frontend_pool" "64m"; then
      err "Frontend deploy failed — triggering rollback"
      DEPLOY_FAILED=true
    fi
  fi

  # Auto-rollback on failure
  if [ "$DEPLOY_FAILED" = true ]; then
    warn "Deploy failed — attempting auto-rollback..."
    if [ "$BUILD_BACKEND" = true ] && [ "$PREV_BACKEND_ID" != "none" ]; then
      $SSH_CMD "docker tag $PREV_BACKEND_ID travelplanner-backend:latest && cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build --force-recreate backend" 2>/dev/null || true
      wait_healthy backend 120 || true
    fi
    if [ "$BUILD_FRONTEND" = true ] && [ "$PREV_FRONTEND_ID" != "none" ]; then
      $SSH_CMD "docker tag $PREV_FRONTEND_ID travelplanner-frontend:latest && cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build --force-recreate frontend" 2>/dev/null || true
      wait_healthy frontend 60 || true
    fi
    # Restore upstreams
    update_upstream "frontend:8080" "backend:3000"
    reload_nginx || true
    err "Auto-rollback complete"
    exit 1
  fi

  # Restart proxy to ensure it picks up the latest config
  $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build proxy" 2>/dev/null

  # [6] Verify + cleanup
  log "[6/6] Verification + cleanup..."

  if ! verify_deployment; then
    warn "Verification issues detected — check logs"
  fi

  # Save state for future rollbacks
  save_state

  # Cleanup old images (keep last 48h)
  $SSH_CMD "docker image prune -a --filter 'until=48h' -f" >> "$DEPLOY_LOG" 2>/dev/null || true

  # Show container status
  log ""
  $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD ps --format 'table {{.Name}}\t{{.Status}}'"
fi

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS_=$((ELAPSED % 60))

log ""
ok "=== Deploy Complete (${MINUTES}m ${SECONDS_}s) ==="
log "URL: https://$DOMAIN"
log "Log: $DEPLOY_LOG"
