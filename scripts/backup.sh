#!/bin/bash
set -e
BACKUP_DIR="/backups/local"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# 1. pg_dump from Docker
docker exec pomagier-db pg_dump -U pomagier pomagier > "$BACKUP_DIR/pomagier_${TIMESTAMP}.sql" 2>/tmp/backup-err.log

# 2. Tar .env + certs
tar -czf "$BACKUP_DIR/config_${TIMESTAMP}.tar.gz" -C /pomagier .env -C /root/certs . 2>/dev/null || true

# 3. Combined archive
cd "$BACKUP_DIR"
tar -czf "pomagier_backup_${TIMESTAMP}.tar.gz" "pomagier_${TIMESTAMP}.sql" "config_${TIMESTAMP}.tar.gz"
rm "pomagier_${TIMESTAMP}.sql" "config_${TIMESTAMP}.tar.gz"

# 4. Clean old local backups
find "$BACKUP_DIR" -name "pomagier_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Local backup: pomagier_backup_${TIMESTAMP}.tar.gz ($(du -h "$BACKUP_DIR/pomagier_backup_${TIMESTAMP}.tar.gz" | cut -f1))"

# 5. Upload to S3 (non-blocking — failure doesn't stop the script)
if [ -f "$BACKUP_DIR/pomagier_backup_${TIMESTAMP}.tar.gz" ]; then
  echo "[$(date)] Uploading to S3..."
  # Upload via API endpoint (handles S3 internally)
  curl -s -X POST http://localhost:3000/api/backup/upload-local \
    -H "Content-Type: application/json" \
    -d "{\"file\":\"pomagier_backup_${TIMESTAMP}.tar.gz\"}" 2>/dev/null || echo "[$(date)] S3 upload failed (non-critical)"
fi

echo "[$(date)] Backup complete."
