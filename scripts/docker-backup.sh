#!/bin/sh
# Runs inside the backup container. Mounts: cf_data:/data:ro, cf_backups:/backups
set -e
DATE=$(date +%Y-%m-%d)
BACKUP_FILE="/backups/${DATE}.db"
sqlite3 /data/commerceforce.db ".backup ${BACKUP_FILE}"
echo "[backup] Written: ${BACKUP_FILE} ($(du -sh "$BACKUP_FILE" | cut -f1))"
find /backups -name "*.db" -mtime +30 -delete
echo "[backup] Done."
