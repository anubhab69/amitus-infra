#!/bin/bash
# Automated Daily Backup Script for Inventory Database
# Usage: ./backup.sh (or configure in cron: 0 2 * * * /path/to/backup.sh)

BACKUP_DIR="$(dirname "$0")/backups"
DATA_FILE="$(dirname "$0")/data/inventory_db.json"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

if [ -f "$DATA_FILE" ]; then
    cp "$DATA_FILE" "$BACKUP_DIR/inventory_db_backup_$TIMESTAMP.json"
    echo "✅ Backup successfully created at: $BACKUP_DIR/inventory_db_backup_$TIMESTAMP.json"
    # Keep only the last 30 daily backups
    ls -t "$BACKUP_DIR"/inventory_db_backup_*.json | tail -n +31 | xargs rm -f 2>/dev/null
else
    echo "❌ Database file not found at: $DATA_FILE"
fi
