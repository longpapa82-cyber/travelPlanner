#!/usr/bin/env bash
# Container Watchdog — monitors critical containers and auto-recovers
# Install via crontab: */3 * * * * /home/ubuntu/travelPlanner/scripts/container-watchdog.sh >> /var/log/watchdog.log 2>&1
#
# Handles the "Created but never started" edge case that restart policies miss.

set -uo pipefail

PROJECT_DIR="/home/ubuntu/travelPlanner"
COMPOSE_CMD="docker compose -f docker-compose.yml -f docker-compose.micro.yml -f docker-compose.ssl-micro.yml"
CRITICAL_SERVICES="postgres redis backend frontend proxy"
LOG_PREFIX="[watchdog $(date '+%Y-%m-%d %H:%M:%S')]"

cd "$PROJECT_DIR" || exit 1

RECOVERED=0

for SVC in $CRITICAL_SERVICES; do
  CONTAINER="travelplanner-${SVC}-1"
  STATE=$(docker inspect "$CONTAINER" --format '{{.State.Status}}' 2>/dev/null || echo "missing")

  case "$STATE" in
    running)
      # Container is running — check health if applicable
      HEALTH=$(docker inspect "$CONTAINER" --format '{{.State.Health.Status}}' 2>/dev/null || echo "none")
      if [ "$HEALTH" = "unhealthy" ]; then
        echo "$LOG_PREFIX $SVC: unhealthy — restarting"
        $COMPOSE_CMD restart "$SVC"
        RECOVERED=1
      fi
      ;;
    created|exited|dead)
      # Container exists but not running — start it
      echo "$LOG_PREFIX $SVC: state=$STATE — starting"
      $COMPOSE_CMD up -d "$SVC"
      RECOVERED=1
      ;;
    missing)
      echo "$LOG_PREFIX $SVC: container missing — recreating"
      $COMPOSE_CMD up -d "$SVC"
      RECOVERED=1
      ;;
  esac
done

# If any service was recovered, verify the site after 10s
if [ $RECOVERED -eq 1 ]; then
  sleep 10
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:80 2>/dev/null || echo "000")
  echo "$LOG_PREFIX Recovery check: HTTP $HTTP_CODE"
fi
