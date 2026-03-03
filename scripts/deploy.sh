#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# Zero-Downtime Production Deploy for MyTravel
#
# Strategy: Local Mac build → image transfer → force-recreate services
# nginx auto-recovers via Docker DNS resolver (resolver 127.0.0.11 valid=10s)
#
# Usage:
#   ./scripts/deploy.sh                    # Full deploy (backend + frontend)
#   ./scripts/deploy.sh --backend-only     # Backend only
#   ./scripts/deploy.sh --frontend-only    # Frontend only
#   ./scripts/deploy.sh --dry-run          # Build + transfer only (no restart)
#   ./scripts/deploy.sh --rollback         # Instant rollback to previous images
#   ./scripts/deploy.sh --remote-build     # Build on server (no local Docker needed)
#
# Prerequisites:
#   - Docker + BuildKit on local Mac (unless --remote-build)
#   - SSH access to OCI server
#   - Docker Compose stack running on OCI
###############################################################################

# --- Server Target ---
# Default: hetzner (CAX21 8GB ARM, Helsinki)
# Set DEPLOY_TARGET=oci to deploy to old OCI micro (1GB, Seoul) — kept as fallback
DEPLOY_TARGET="${DEPLOY_TARGET:-hetzner}"

# --- Configuration ---
if [ "$DEPLOY_TARGET" = "hetzner" ]; then
  OCI_HOST="${HETZNER_HOST:-root@46.62.201.127}"
  OCI_KEY="$HOME/.ssh/travelplanner-oci"
  COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.hetzner.yml -f docker-compose.ssl-arm.yml"
else
  OCI_HOST="ubuntu@150.230.251.32"
  OCI_KEY="$HOME/.ssh/travelplanner-oci"
  COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.micro.yml -f docker-compose.ssl-micro.yml"
fi
REMOTE_DIR="~/travelPlanner"
DOMAIN="mytravel-planner.com"
SSH_CMD="ssh -i $OCI_KEY -o ConnectTimeout=10 -o ServerAliveInterval=30 $OCI_HOST"
SCP_CMD="scp -i $OCI_KEY -o ConnectTimeout=10"
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
REMOTE_BUILD=false

for arg in "$@"; do
  case $arg in
    --frontend-only) BUILD_BACKEND=false ;;
    --backend-only)  BUILD_FRONTEND=false ;;
    --dry-run)       DRY_RUN=true ;;
    --rollback)      ROLLBACK=true ;;
    --remote-build)  REMOTE_BUILD=true ;;
    -h|--help)
      echo "Usage: ./scripts/deploy.sh [options]"
      echo "  --backend-only   Deploy backend only"
      echo "  --frontend-only  Deploy frontend only"
      echo "  --dry-run        Build and transfer only (no restart)"
      echo "  --rollback       Instant rollback to previous images"
      echo "  --remote-build   Build on server instead of locally"
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

  # Wait briefly for nginx to re-resolve DNS (resolver TTL = 10s)
  sleep 12

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

# Save deploy state to remote server (for rollback)
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

  verify_deployment || true

  END_TIME=$(date +%s)
  ELAPSED=$((END_TIME - START_TIME))
  ok "=== Rollback Complete (${ELAPSED}s) ==="
  exit 0
fi

###############################################################################
# Main Deploy Flow
###############################################################################
log "=== Production Deploy ==="
log "Backend: $BUILD_BACKEND | Frontend: $BUILD_FRONTEND | Remote-build: $REMOTE_BUILD | Dry-run: $DRY_RUN"
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
log "[2/6] Syncing source files..."
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
ok "Source synced"

if [ "$REMOTE_BUILD" = true ]; then
  # --- Remote build path (for when local Docker is unavailable) ---
  log "[3/6] Building on remote server (sequential to avoid OOM)..."
  if [ "$BUILD_BACKEND" = true ]; then
    log "  Building backend..."
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD build backend" >> "$DEPLOY_LOG" 2>&1
    ok "Backend built"
  fi
  if [ "$BUILD_FRONTEND" = true ]; then
    log "  Building frontend..."
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD build frontend" >> "$DEPLOY_LOG" 2>&1
    ok "Frontend built"
  fi
  log "[4/6] Skipped (remote build)"
else
  # --- Local build path (recommended: fast Mac build + transfer) ---
  # [3] Build images locally with BuildKit (parallel)
  log "[3/6] Building Docker images locally (BuildKit)..."
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
fi

# [5] Restart services
if [ "$DRY_RUN" = true ]; then
  log "[5/6] Dry-run mode — skipping service restart"
  log "[6/6] Skipped"
else
  log "[5/6] Restarting services..."

  DEPLOY_FAILED=false

  # Backend first (more critical, longer startup)
  if [ "$BUILD_BACKEND" = true ]; then
    log "  Restarting backend..."
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build --force-recreate backend" >> "$DEPLOY_LOG" 2>&1
    if ! wait_healthy backend 120; then
      err "Backend failed — triggering rollback"
      DEPLOY_FAILED=true
    fi
  fi

  # Frontend (only if backend succeeded)
  if [ "$BUILD_FRONTEND" = true ] && [ "$DEPLOY_FAILED" = false ]; then
    log "  Restarting frontend..."
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build --force-recreate frontend" >> "$DEPLOY_LOG" 2>&1
    if ! wait_healthy frontend 60; then
      err "Frontend failed — triggering rollback"
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
    err "Auto-rollback complete"
    exit 1
  fi

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
