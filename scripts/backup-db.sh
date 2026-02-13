#!/bin/bash
set -euo pipefail

# PostgreSQL backup script for TravelPlanner
# Usage: ./scripts/backup-db.sh [backup_dir]
# Cron:  0 3 * * * cd /app/travelplanner && ./scripts/backup-db.sh

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/travelplanner_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=14

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup..."

# Dump database via Docker Compose (works with both dev and prod)
docker compose exec -T postgres pg_dump \
  -U "${DB_USERNAME:-postgres}" \
  -d "${DB_DATABASE:-travelplanner}" \
  --no-owner \
  --no-privileges \
  --format=custom \
  | gzip > "$BACKUP_FILE"

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup created: $BACKUP_FILE ($FILESIZE)"

# Remove backups older than retention period
DELETED=$(find "$BACKUP_DIR" -name "travelplanner_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date)] Cleaned up $DELETED old backups (>${RETENTION_DAYS} days)"
fi

echo "[$(date)] Backup complete."
