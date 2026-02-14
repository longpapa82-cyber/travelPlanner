#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────
# Preflight check: verify all services are running before E2E tests
# Usage: bash tests/scripts/preflight.sh
# ────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

check() {
  local name="$1"
  local cmd="$2"
  if eval "$cmd" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✅ ${name}${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}❌ ${name}${NC}"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "🔍 TravelPlanner E2E Preflight Check"
echo "─────────────────────────────────────"

# 1. PostgreSQL
check "PostgreSQL (port 5432)" "pg_isready -h localhost -p 5432 -q || nc -z localhost 5432"

# 2. Redis
check "Redis (port 6379)" "redis-cli -h localhost -p 6379 ping 2>/dev/null | grep -q PONG || nc -z localhost 6379"

# 3. Backend health
check "Backend health (localhost:3001/api/health)" "curl -sf http://localhost:3001/api/health"

# 4. Frontend serving
check "Frontend (localhost:8081)" "curl -sf -o /dev/null http://localhost:8081"

echo ""
echo "─────────────────────────────────────"
echo -e "  Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Some services are not running. Start them before running E2E tests:${NC}"
  echo "  1. PostgreSQL: brew services start postgresql"
  echo "  2. Redis:      brew services start redis"
  echo "  3. Backend:    cd backend && npm run start:dev"
  echo "  4. Frontend:   cd frontend && npx expo start --web --port 8081"
  echo ""
  exit 1
fi

echo -e "${GREEN}🚀 All services ready — safe to run E2E tests!${NC}"
echo ""
