#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# Deploy Health Monitor — Run alongside deploy.sh to track uptime
#
# Usage:
#   ./scripts/deploy-monitor.sh              # Monitor until Ctrl+C
#   ./scripts/deploy-monitor.sh --duration 120  # Monitor for 120 seconds
#   ./scripts/deploy-monitor.sh --interval 0.5  # Check every 0.5s
#
# Run in a separate terminal during deployment to verify zero-downtime.
###############################################################################

DOMAIN="mytravel-planner.com"
INTERVAL=1
DURATION=0  # 0 = infinite
ENDPOINT="https://$DOMAIN/api/health"

for arg in "$@"; do
  case $arg in
    --duration)  shift; DURATION=${1:-0}; shift ;;
    --interval)  shift; INTERVAL=${1:-1}; shift ;;
    --endpoint)  shift; ENDPOINT=${1:-$ENDPOINT}; shift ;;
    -h|--help)
      echo "Usage: ./scripts/deploy-monitor.sh [--duration N] [--interval N] [--endpoint URL]"
      exit 0
      ;;
  esac
done

# Counters
TOTAL=0
SUCCESS=0
FAIL=0
START_TIME=$(date +%s)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Deploy Monitor Summary"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local END_TIME
  END_TIME=$(date +%s)
  local ELAPSED=$((END_TIME - START_TIME))

  if [ $TOTAL -gt 0 ]; then
    local UPTIME_PCT
    UPTIME_PCT=$(echo "scale=1; $SUCCESS * 100 / $TOTAL" | bc 2>/dev/null || echo "N/A")
    echo "  Total checks:   $TOTAL"
    echo "  Successful:     $SUCCESS"
    echo "  Failed:         $FAIL"
    echo "  Uptime:         ${UPTIME_PCT}%"
    echo "  Duration:       ${ELAPSED}s"
    echo "  Interval:       ${INTERVAL}s"

    if [ "$FAIL" -eq 0 ]; then
      echo -e "  Result:         ${GREEN}ZERO DOWNTIME ✓${NC}"
    else
      echo -e "  Result:         ${RED}DOWNTIME DETECTED (${FAIL} failures)${NC}"
    fi
  else
    echo "  No checks performed"
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 0
}

trap cleanup INT TERM

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploy Health Monitor"
echo "  Endpoint: $ENDPOINT"
echo "  Interval: ${INTERVAL}s"
[ "$DURATION" -gt 0 ] && echo "  Duration: ${DURATION}s"
echo "  Press Ctrl+C to stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

while true; do
  TOTAL=$((TOTAL + 1))

  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$ENDPOINT" 2>/dev/null || echo "000")
  TIMESTAMP=$(date +%H:%M:%S)

  if [ "$HTTP_CODE" = "200" ]; then
    SUCCESS=$((SUCCESS + 1))
    echo -e "${GREEN}[${TIMESTAMP}] HTTP ${HTTP_CODE} ✓${NC}"
  else
    FAIL=$((FAIL + 1))
    echo -e "${RED}[${TIMESTAMP}] HTTP ${HTTP_CODE} ✗${NC}  (check #${TOTAL})"
  fi

  # Check duration limit
  if [ "$DURATION" -gt 0 ]; then
    ELAPSED=$(( $(date +%s) - START_TIME ))
    if [ "$ELAPSED" -ge "$DURATION" ]; then
      cleanup
    fi
  fi

  sleep "$INTERVAL"
done
