#!/bin/bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres}"
DATABASE_NAME="${RESTORE_DB:-half_the_price_restored}"
PG_HOST="${PGHOST:-localhost}"
PG_PORT="${PGPORT:-5432}"
PG_USER="${PGUSER:-htp}"

# Find the latest backup if file not specified
if [ -z "${1:-}" ]; then
  echo "No backup file specified. Finding the latest backup in $BACKUP_DIR..."
  BACKUP_FILE=$(ls -t "$BACKUP_DIR"/db_*.backup 2>/dev/null | head -n 1 || true)
  if [ -z "$BACKUP_FILE" ]; then
    echo "Error: No backup files found in $BACKUP_DIR"
    exit 1
  fi
else
  BACKUP_FILE="$1"
fi

echo "=== [$(date)] Starting Database Restore Drill ==="
echo "Target Database: $DATABASE_NAME"
echo "Backup File:     $BACKUP_FILE"

# Drop target database if it exists (for clean restore)
echo "Recreating target database $DATABASE_NAME..."
PGPASSWORD="${PGPASSWORD:-htp_dev_password}" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres -c "DROP DATABASE IF EXISTS $DATABASE_NAME;"
PGPASSWORD="${PGPASSWORD:-htp_dev_password}" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d postgres -c "CREATE DATABASE $DATABASE_NAME;"

# Run pg_restore
echo "Running pg_restore..."
PGPASSWORD="${PGPASSWORD:-htp_dev_password}" pg_restore -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$DATABASE_NAME" -v "$BACKUP_FILE"

echo "=== [$(date)] Restore Completed Successfully ==="
