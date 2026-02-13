#!/bin/bash
set -euo pipefail

# PostgreSQL restore script for TravelPlanner
# Usage: ./scripts/restore-db.sh <backup_file>

if [ $# -eq 0 ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lh ./backups/travelplanner_*.sql.gz 2>/dev/null || echo "  No backups found in ./backups/"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "WARNING: This will overwrite the current database!"
echo "Backup: $BACKUP_FILE"
read -r -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo "[$(date)] Restoring database from $BACKUP_FILE..."

# Drop and recreate
docker compose exec -T postgres psql \
  -U "${DB_USERNAME:-postgres}" \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB_DATABASE:-travelplanner}' AND pid <> pg_backend_pid();" 2>/dev/null || true

docker compose exec -T postgres dropdb \
  -U "${DB_USERNAME:-postgres}" \
  --if-exists "${DB_DATABASE:-travelplanner}"

docker compose exec -T postgres createdb \
  -U "${DB_USERNAME:-postgres}" \
  "${DB_DATABASE:-travelplanner}"

# Restore
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres pg_restore \
  -U "${DB_USERNAME:-postgres}" \
  -d "${DB_DATABASE:-travelplanner}" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists 2>/dev/null || true

echo "[$(date)] Restore complete. Restart backend to apply migrations if needed:"
echo "  docker compose restart backend"
