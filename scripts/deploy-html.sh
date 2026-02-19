#!/usr/bin/env bash
set -euo pipefail

# Deploy static HTML/content-only changes to production.
# No Docker rebuild needed — files are volume-mounted into nginx.
#
# Usage: ./scripts/deploy-html.sh

OCI_HOST="ubuntu@150.230.251.32"
OCI_KEY="$HOME/.ssh/travelplanner-oci"
REMOTE_DIR="~/travelPlanner/frontend/public"

echo "=== Static HTML Deploy ==="
echo ""

# Sync all public content files
echo "[1/2] Syncing static files to production..."
rsync -avz -e "ssh -i $OCI_KEY" \
  --include='*.html' \
  --include='*.txt' \
  --include='*.json' \
  --include='*.js' \
  --include='*/' \
  --exclude='*' \
  frontend/public/ "$OCI_HOST:$REMOTE_DIR/"

echo ""
echo "[2/2] Done!"
echo ""
echo "Static files synced. Changes are immediately live."
echo "No Docker rebuild or container restart needed."
echo ""
echo "URL: https://mytravelplanner.duckdns.org"
