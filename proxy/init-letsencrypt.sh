#!/bin/bash
# Initialize Let's Encrypt certificates for TravelPlanner
#
# Usage: ./init-letsencrypt.sh <domain> <email>
# Example: ./init-letsencrypt.sh travelplanner.app admin@travelplanner.app

set -e

DOMAIN=${1:?"Usage: $0 <domain> <email>"}
EMAIL=${2:?"Usage: $0 <domain> <email>"}
COMPOSE_FILE="../docker-compose.prod.yml"

echo "=== TravelPlanner SSL Setup ==="
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

# Create required directories
mkdir -p ../certbot/conf ../certbot/www

# Check if certificates already exist
if [ -d "../certbot/conf/live/$DOMAIN" ]; then
  echo "Certificates already exist for $DOMAIN"
  echo "To renew, run: docker compose -f $COMPOSE_FILE run certbot renew"
  exit 0
fi

# Start nginx without SSL first (for ACME challenge)
echo "Starting nginx for certificate challenge..."
DOMAIN=$DOMAIN docker compose -f $COMPOSE_FILE up -d proxy

# Request certificate
echo "Requesting Let's Encrypt certificate..."
docker compose -f $COMPOSE_FILE run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

echo ""
echo "=== Certificate obtained successfully! ==="
echo "Restarting nginx with SSL..."
DOMAIN=$DOMAIN docker compose -f $COMPOSE_FILE restart proxy

echo "Done! Your site is now available at https://$DOMAIN"
