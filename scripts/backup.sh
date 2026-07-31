#!/bin/bash
set -euo pipefail
BACKUP_DIR="/backups/local"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y-%m-%d_%H%M)
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# 1. pg_dump from Docker — exclude sessions table (contains live JWT tokens)
docker exec pomagier-db pg_dump -U pomagier --exclude-table=sessions pomagier > "$BACKUP_DIR/pomagier_${TIMESTAMP}.sql" 2>/tmp/backup-err.log

# 2. Tar certs ONLY (NOT .env — secrets should be in secret manager, not backups)
tar -czf "$BACKUP_DIR/config_${TIMESTAMP}.tar.gz" -C /root/certs . 2>/dev/null || true

# 3. Combined archive
cd "$BACKUP_DIR"
tar -czf "pomagier_backup_${TIMESTAMP}.tar.gz" "pomagier_${TIMESTAMP}.sql" "config_${TIMESTAMP}.tar.gz"
rm "pomagier_${TIMESTAMP}.sql" "config_${TIMESTAMP}.tar.gz"

# 4. Encrypt the archive if encryption key is set
if [ -n "$ENCRYPTION_KEY" ]; then
  echo "[$(date)] Encrypting backup with AES-256..."
  gpg --batch --yes --passphrase "$ENCRYPTION_KEY" --cipher-algo AES256 \
    --symmetric "pomagier_backup_${TIMESTAMP}.tar.gz"
  rm "pomagier_backup_${TIMESTAMP}.tar.gz"
  FINAL_FILE="pomagier_backup_${TIMESTAMP}.tar.gz.gpg"
  echo "[$(date)] Encrypted backup: $FINAL_FILE"
else
  echo "[$(date)] WARNING: BACKUP_ENCRYPTION_KEY not set — backup is NOT encrypted"
  FINAL_FILE="pomagier_backup_${TIMESTAMP}.tar.gz"
fi

# 5. Clean old local backups (both encrypted and unencrypted)
find "$BACKUP_DIR" -name "pomagier_backup_*.tar.gz*" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Local backup: $FINAL_FILE ($(du -h "$BACKUP_DIR/$FINAL_FILE" | cut -f1))"

# 6. Upload to S3 (non-blocking — failure doesn't stop the script)
if [ -f "$BACKUP_DIR/$FINAL_FILE" ]; then
  echo "[$(date)] Uploading to S3..."
  curl -s -X POST http://localhost:3000/api/backup/upload-local \
    -H "Content-Type: application/json" \
    -d "{\"file\":\"$FINAL_FILE\"}" 2>/dev/null || echo "[$(date)] S3 upload failed (non-critical)"
fi

echo "[$(date)] Backup complete."
