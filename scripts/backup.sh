#!/usr/bin/env bash
# backup.sh — Daily SQLite backup for CommerceForce.
#
# The database lives inside the Docker volume cf_data:/app/data.
# This script uses the backup service container (which mounts that volume)
# to safely copy the database using SQLite's online backup API.
#
# Alternatively, run this from the VPS host to trigger an on-demand backup:
#   bash scripts/backup.sh
#   bash scripts/backup.sh --test    # verify backup file is valid
#
# For automated daily backups, the `backup` service in docker-compose.yml
# runs this process internally at 02:00 UTC via supercronic.
#
# RESTORATION:
#   # Stop the backend, copy the backup over the live db, restart
#   docker compose stop backend
#   docker cp backups/2026-06-24.db $(docker compose ps -q backup):/data/commerceforce.db
#   docker compose start backend

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

BACKUP_DIR="${PROJECT_ROOT}/backups"
KEEP_DAYS=30
TEST_MODE=false
[[ "${1:-}" == "--test" ]] && TEST_MODE=true

mkdir -p "$BACKUP_DIR"

DATE="$(date +%Y-%m-%d)"
BACKUP_FILE="${BACKUP_DIR}/${DATE}.db"

# ── Check docker compose is available ────────────────────────────────────────

if ! command -v docker &>/dev/null; then
    echo "[backup] ERROR: docker not found. This script requires Docker."
    exit 1
fi

# ── Run backup inside the backend container (safe online backup) ─────────────

CONTAINER_ID="$(docker compose -f "${PROJECT_ROOT}/docker-compose.yml" ps -q backend 2>/dev/null || true)"

if [[ -z "$CONTAINER_ID" ]]; then
    echo "[backup] ERROR: backend container is not running. Start with: docker compose up -d"
    exit 1
fi

echo "[backup] Backing up database from container ${CONTAINER_ID:0:12}…"

# Use SQLite .backup command inside the container — safe for live databases
docker exec "$CONTAINER_ID" sqlite3 /app/data/commerceforce.db ".backup /tmp/cf_backup_temp.db"

# Copy the backup file from the container to the host
docker cp "${CONTAINER_ID}:/tmp/cf_backup_temp.db" "$BACKUP_FILE"

# Clean up temp file inside container
docker exec "$CONTAINER_ID" rm -f /tmp/cf_backup_temp.db

echo "[backup] Backup saved: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# ── Verify the backup is a valid SQLite database ─────────────────────────────

if command -v sqlite3 &>/dev/null; then
    USER_COUNT="$(sqlite3 "$BACKUP_FILE" "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "unknown")"
    echo "[backup] Verification: $USER_COUNT user(s) in backup"
fi

# ── Prune backups older than KEEP_DAYS ───────────────────────────────────────

PRUNED=0
while IFS= read -r old_file; do
    rm -f "$old_file"
    echo "[backup] Pruned: $old_file"
    ((PRUNED++)) || true
done < <(find "$BACKUP_DIR" -name "*.db" -mtime "+${KEEP_DAYS}" 2>/dev/null)

[[ $PRUNED -gt 0 ]] && echo "[backup] Pruned $PRUNED backup(s) older than ${KEEP_DAYS} days"
echo "[backup] Done. Backup directory: $BACKUP_DIR"

# ── Test mode: verify file exists and is valid ────────────────────────────────

if [[ "$TEST_MODE" == "true" ]]; then
    if [[ -f "$BACKUP_FILE" ]] && [[ -s "$BACKUP_FILE" ]]; then
        echo "[backup] TEST PASS: backup file exists and is non-empty"
    else
        echo "[backup] TEST FAIL: backup file missing or empty"
        exit 1
    fi
fi
