#!/bin/bash
# HalfThePrice Database Backup and WAL Archiving Script
# Designed for production k3s with CloudNativePG or standalone PostgreSQL

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgres}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATABASE_NAME="half_the_price"
PG_PORT=${PGPORT:-5432}
PG_USER=${PGUSER:-htp}

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

echo "=== [$(date)] Starting Database Backup ==="

# 1. Perform a logical backup (pg_dump)
echo "Running pg_dump for $DATABASE_NAME..."
pg_dump -h localhost -p "$PG_PORT" -U "$PG_USER" -F c -b -v -f "$BACKUP_DIR/db_${DATABASE_NAME}_${TIMESTAMP}.backup"

# Keep only the last 30 days of logical backups
find "$BACKUP_DIR" -name "db_${DATABASE_NAME}_*.backup" -mtime +30 -delete

echo "Logical backup completed successfully."

# 2. CloudNativePG continuous WAL archiving documentation
# CloudNativePG handles physical backups and PITR automatically using the Barman Cloud engine.
# Example configuration for fly.io or k3s cluster deploying PostgreSQL:
cat << 'EOF' > "$BACKUP_DIR/cnpg-backup-config.yaml"
# CloudNativePG Cluster Backup configuration:
# 
# apiVersion: postgresql.cnpg.io/v1
# kind: Cluster
# metadata:
#   name: htp-postgres
# spec:
#   instances: 3
#   storage:
#     size: 10Gi
#   backup:
#     barmanObjectStore:
#       destinationPath: s3://htp-backups/pg-wal/
#       endpointURL: https://minio.internal:9000
#       s3Credentials:
#         name: s3-creds
#         key: s3-secret
#       wal:
#         compression: gzip
#       retentionPolicy: "30d"
EOF

echo "CloudNativePG template written to $BACKUP_DIR/cnpg-backup-config.yaml"
echo "=== [$(date)] Backup and PITR Configurations Ready ==="
