#!/bin/bash
set -euo pipefail

# =============================================================================
# DuckDNS Quick Setup Guide + Registration Helper
# =============================================================================
# This script helps you register a DuckDNS subdomain and configure it.
#
# Steps:
#   1. Open https://www.duckdns.org in your browser
#   2. Log in with Google, GitHub, Twitter, or Reddit
#   3. Create a subdomain (e.g., "travelplanner" → travelplanner.duckdns.org)
#   4. Copy your token from the DuckDNS dashboard
#   5. Run this script with your token and subdomain
#
# Usage:
#   ./scripts/setup-duckdns.sh <subdomain> <token>
#   Example: ./scripts/setup-duckdns.sh travelplanner abc123-def456-...
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ $# -lt 2 ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  DuckDNS Setup for MyTravel"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "  Step 1: Go to https://www.duckdns.org"
  echo "  Step 2: Log in (Google / GitHub / etc.)"
  echo "  Step 3: Create subdomain (e.g., 'travelplanner')"
  echo "  Step 4: Copy your token from the dashboard"
  echo "  Step 5: Run this script:"
  echo ""
  echo "  Usage: $0 <subdomain> <token>"
  echo "  Example: $0 travelplanner abc123-def456-ghi789"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  exit 1
fi

SUBDOMAIN="$1"
TOKEN="$2"
DOMAIN="${SUBDOMAIN}.duckdns.org"

# ---------------------------------------------------------------------------
# 1. Update DuckDNS IP
# ---------------------------------------------------------------------------
info "Updating DuckDNS: $DOMAIN → this server's IP..."
RESULT=$(curl -s "https://www.duckdns.org/update?domains=${SUBDOMAIN}&token=${TOKEN}&ip=")

if [ "$RESULT" != "OK" ]; then
  error "DuckDNS update failed. Check your token and subdomain. Response: $RESULT"
fi
log "DuckDNS updated successfully!"

# ---------------------------------------------------------------------------
# 2. Verify DNS resolution
# ---------------------------------------------------------------------------
info "Waiting for DNS propagation (up to 30s)..."
for i in $(seq 1 6); do
  RESOLVED=$(dig +short "$DOMAIN" 2>/dev/null | head -1 || true)
  if [ -n "$RESOLVED" ]; then
    log "DNS resolves: $DOMAIN → $RESOLVED"
    break
  fi
  sleep 5
done

SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "unknown")
info "This server's IP: $SERVER_IP"

# ---------------------------------------------------------------------------
# 3. Update project .env
# ---------------------------------------------------------------------------
ENV_FILE="$PROJECT_DIR/.env"

# Add or update DOMAIN
if grep -q "^DOMAIN=" "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^DOMAIN=.*|DOMAIN=$DOMAIN|" "$ENV_FILE"
else
  echo "DOMAIN=$DOMAIN" >> "$ENV_FILE"
fi

# Add DuckDNS credentials
if grep -q "^DUCKDNS_TOKEN=" "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^DUCKDNS_TOKEN=.*|DUCKDNS_TOKEN=$TOKEN|" "$ENV_FILE"
else
  echo "DUCKDNS_TOKEN=$TOKEN" >> "$ENV_FILE"
fi

if grep -q "^DUCKDNS_DOMAIN=" "$ENV_FILE" 2>/dev/null; then
  sed -i "s|^DUCKDNS_DOMAIN=.*|DUCKDNS_DOMAIN=$SUBDOMAIN|" "$ENV_FILE"
else
  echo "DUCKDNS_DOMAIN=$SUBDOMAIN" >> "$ENV_FILE"
fi

log "Updated .env with DOMAIN=$DOMAIN"

# ---------------------------------------------------------------------------
# 4. Setup cron for DuckDNS IP updates
# ---------------------------------------------------------------------------
CRON_SCRIPT="$SCRIPT_DIR/duckdns-update.sh"
chmod +x "$CRON_SCRIPT"

# Add cron job if not already present
CRON_LINE="*/5 * * * * $CRON_SCRIPT >> /var/log/duckdns.log 2>&1"
if ! crontab -l 2>/dev/null | grep -q "duckdns-update.sh"; then
  (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
  log "Added DuckDNS cron job (every 5 minutes)"
else
  warn "DuckDNS cron job already exists"
fi

# ---------------------------------------------------------------------------
# 5. Done — next steps
# ---------------------------------------------------------------------------
echo ""
echo "============================================="
echo "  DuckDNS Setup Complete!"
echo "============================================="
echo ""
echo "  Domain: $DOMAIN"
echo "  IP:     $SERVER_IP"
echo ""
echo "  Next step — run SSL setup:"
echo "  ./scripts/setup-ssl.sh"
echo ""
echo "============================================="
