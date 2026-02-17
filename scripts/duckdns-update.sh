#!/bin/bash
# =============================================================================
# DuckDNS IP Update Script
# =============================================================================
# Updates DuckDNS subdomain with current server IP.
# Run via cron every 5 minutes:
#   */5 * * * * /path/to/duckdns-update.sh >> /var/log/duckdns.log 2>&1
#
# Required environment variables (set in .env or pass directly):
#   DUCKDNS_TOKEN  — Your DuckDNS API token
#   DUCKDNS_DOMAIN — Subdomain only (e.g., "travelplanner" not "travelplanner.duckdns.org")
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Load from project .env if available
if [ -f "$PROJECT_DIR/.env" ]; then
  source "$PROJECT_DIR/.env"
fi

DUCKDNS_TOKEN="${DUCKDNS_TOKEN:-}"
DUCKDNS_DOMAIN="${DUCKDNS_DOMAIN:-}"

if [ -z "$DUCKDNS_TOKEN" ] || [ -z "$DUCKDNS_DOMAIN" ]; then
  echo "$(date): ERROR — DUCKDNS_TOKEN and DUCKDNS_DOMAIN must be set"
  exit 1
fi

RESULT=$(curl -s "https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=")

if [ "$RESULT" = "OK" ]; then
  echo "$(date): DuckDNS update OK for ${DUCKDNS_DOMAIN}.duckdns.org"
else
  echo "$(date): DuckDNS update FAILED — response: $RESULT"
fi
