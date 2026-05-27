#!/bin/bash
set -e

# MongoDB Backup Script
# This script creates compressed backups of the MongoDB database
# and retains only the last 7 days of backups.

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups
MONGODB_URI=${MONGODB_URI:-mongodb://localhost:27017/home_service_marketplace}

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting MongoDB backup..."

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Create backup using mongodump
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating backup: backup_$DATE"
mongodump --uri="$MONGODB_URI" --out="$BACKUP_DIR/backup_$DATE"

# Compress the backup
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Compressing backup..."
tar -czf "$BACKUP_DIR/backup_$DATE.tar.gz" -C "$BACKUP_DIR" "backup_$DATE"

# Remove uncompressed folder to save space
rm -rf "$BACKUP_DIR/backup_$DATE"

# Remove backups older than 7 days
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up backups older than 7 days..."
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

# List remaining backups
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Remaining backups:"
ls -lh $BACKUP_DIR/*.tar.gz 2>/dev/null || echo "No backups found"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completed: $BACKUP_DIR/backup_$DATE.tar.gz"
