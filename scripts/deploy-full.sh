#!/usr/bin/env bash
set -euo pipefail

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
SSH_CMD="ssh -i $OCI_KEY $OCI_HOST"
COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.micro.yml -f docker-compose.ssl-micro.yml"

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

  # Restart
  echo "[5/5] Restarting services..."
  if [ "$BUILD_BACKEND" = true ]; then
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d backend"
    echo "   Waiting for backend health check..."
    sleep 15
  fi
  if [ "$BUILD_FRONTEND" = true ]; then
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d frontend"
  fi
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

  # Step 5: Restart services (--no-build to use pre-built images)
  echo "[5/5] Restarting services..."
  if [ "$BUILD_BACKEND" = true ]; then
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build backend"
    echo "   Waiting for backend health check..."
    sleep 15
  fi
  if [ "$BUILD_FRONTEND" = true ]; then
    $SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD up -d --no-build frontend"
  fi
fi

# Verify
echo ""
$SSH_CMD "cd $REMOTE_DIR && $COMPOSE_CMD ps --format 'table {{.Name}}\t{{.Status}}'"

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
MINUTES=$((ELAPSED / 60))
SECONDS=$((ELAPSED % 60))

echo ""
echo "=== Deploy Complete (${MINUTES}m ${SECONDS}s) ==="
echo "URL: https://mytravelplanner.duckdns.org"
