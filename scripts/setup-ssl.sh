#!/bin/bash
set -euo pipefail

# =============================================================================
# SSL Setup Script for TravelPlanner (DuckDNS + Let's Encrypt)
# =============================================================================
# This script:
#   1. Validates DuckDNS domain is pointing to this server
#   2. Obtains initial Let's Encrypt certificate via certbot
#   3. Switches Docker Compose to SSL mode
#   4. Updates backend .env with HTTPS URLs
#
# Prerequisites:
#   - DuckDNS subdomain created and pointing to this server's IP
#   - Docker and Docker Compose installed
#   - Root .env file with DOMAIN variable set
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

# ---------------------------------------------------------------------------
# 1. Check DOMAIN from root .env
# ---------------------------------------------------------------------------
if [ ! -f .env ]; then
  error ".env file not found. Create one with DOMAIN=your-subdomain.duckdns.org"
fi

source .env
DOMAIN="${DOMAIN:-}"
if [ -z "$DOMAIN" ]; then
  error "DOMAIN not set in .env. Add: DOMAIN=your-subdomain.duckdns.org"
fi

EMAIL="${CERTBOT_EMAIL:-}"
log "Domain: $DOMAIN"

# ---------------------------------------------------------------------------
# 2. Validate DNS resolution
# ---------------------------------------------------------------------------
info "Checking DNS resolution for $DOMAIN..."
RESOLVED_IP=$(dig +short "$DOMAIN" 2>/dev/null | head -1 || true)
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || echo "unknown")

if [ -z "$RESOLVED_IP" ]; then
  error "DNS lookup failed for $DOMAIN. Make sure the DuckDNS subdomain is configured."
fi

if [ "$RESOLVED_IP" != "$SERVER_IP" ]; then
  warn "DNS resolves to $RESOLVED_IP but this server is $SERVER_IP"
  warn "Make sure DuckDNS points to the correct IP before continuing."
  read -p "Continue anyway? (y/N): " -r
  [[ $REPLY =~ ^[Yy]$ ]] || exit 1
else
  log "DNS correctly resolves to $SERVER_IP"
fi

# ---------------------------------------------------------------------------
# 3. Stop existing containers (free port 80 for certbot)
# ---------------------------------------------------------------------------
info "Stopping existing containers to free port 80..."
docker compose -f docker-compose.yml -f docker-compose.micro.yml down 2>/dev/null || true
docker compose -f docker-compose.yml -f docker-compose.micro.yml -f docker-compose.ssl-micro.yml down 2>/dev/null || true

# ---------------------------------------------------------------------------
# 4. Obtain SSL certificate via certbot standalone
# ---------------------------------------------------------------------------
info "Obtaining Let's Encrypt certificate for $DOMAIN..."

# Create named volumes if they don't exist
docker volume create travelplanner_certbot_conf 2>/dev/null || true
docker volume create travelplanner_certbot_www 2>/dev/null || true

CERTBOT_ARGS=(
  certonly
  --standalone
  -d "$DOMAIN"
  --agree-tos
  --non-interactive
  --preferred-challenges http
)

if [ -n "$EMAIL" ]; then
  CERTBOT_ARGS+=(--email "$EMAIL")
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
  warn "No CERTBOT_EMAIL set — registering without email. Set CERTBOT_EMAIL in .env for renewal notices."
fi

docker run --rm \
  -p 80:80 \
  -v travelplanner_certbot_conf:/etc/letsencrypt \
  -v travelplanner_certbot_www:/var/www/certbot \
  certbot/certbot "${CERTBOT_ARGS[@]}"

log "SSL certificate obtained successfully!"

# ---------------------------------------------------------------------------
# 5. Update backend .env.production with HTTPS URLs
# ---------------------------------------------------------------------------
info "Updating backend configuration for HTTPS..."

BACKEND_ENV="backend/.env.production"
if [ -f "$BACKEND_ENV" ]; then
  # Update CORS_ORIGIN
  sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=https://$DOMAIN|" "$BACKEND_ENV"
  # Update FRONTEND_URL
  sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://$DOMAIN|" "$BACKEND_ENV"
  # Update OAuth callbacks
  sed -i "s|^GOOGLE_CALLBACK_URL=.*|GOOGLE_CALLBACK_URL=https://$DOMAIN/api/auth/google/callback|" "$BACKEND_ENV"
  sed -i "s|^KAKAO_CALLBACK_URL=.*|KAKAO_CALLBACK_URL=https://$DOMAIN/api/auth/kakao/callback|" "$BACKEND_ENV"
  log "Backend .env.production updated with HTTPS URLs"
else
  warn "backend/.env.production not found — update URLs manually"
fi

# ---------------------------------------------------------------------------
# 6. Start services in SSL mode
# ---------------------------------------------------------------------------
info "Starting services with SSL..."
docker compose \
  -f docker-compose.yml \
  -f docker-compose.micro.yml \
  -f docker-compose.ssl-micro.yml \
  up -d --build

# ---------------------------------------------------------------------------
# 7. Wait and verify
# ---------------------------------------------------------------------------
info "Waiting for services to start..."
sleep 15

echo ""
echo "============================================="
echo "  SSL Setup Complete!"
echo "============================================="
echo ""
echo "  HTTPS: https://$DOMAIN"
echo "  API:   https://$DOMAIN/api/health"
echo ""
echo "  Docker command (for future restarts):"
echo "  docker compose -f docker-compose.yml \\"
echo "    -f docker-compose.micro.yml \\"
echo "    -f docker-compose.ssl-micro.yml up -d"
echo ""
echo "  Certificate auto-renewal is handled by the"
echo "  certbot container (checks every 12 hours)."
echo "============================================="

# Quick health check
if curl -sf "https://$DOMAIN/api/health" > /dev/null 2>&1; then
  log "HTTPS health check passed!"
elif curl -sf "http://$DOMAIN/api/health" > /dev/null 2>&1; then
  warn "HTTP works but HTTPS not yet — wait a moment and try again"
else
  warn "Health check failed — check logs: docker compose logs proxy"
fi
