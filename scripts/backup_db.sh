#!/bin/bash

# Backup Script for Clinic-OS
# Usage: ./scripts/backup_db.sh [local|production]

ENV=$1
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="backups"

mkdir -p "$BACKUP_DIR"

if [ "$ENV" == "local" ]; then
    echo "📦 Backing up LOCAL database..."
    
    # access valid local db path
    DB_PATH=$(find .wrangler/state/v3/d1 -name "*.sqlite" | head -n 1)
    
    if [ -z "$DB_PATH" ]; then
        echo "❌ No local database found in .wrangler/state/v3/d1"
        exit 1
    fi
    
    DEST="$BACKUP_DIR/local_backup_$DATE.sqlite"
    cp "$DB_PATH" "$DEST"
    echo "✅ Backup saved to $DEST"
    
elif [ "$ENV" == "production" ]; then
    echo "📦 Backing up PRODUCTION database..."
    DEST="$BACKUP_DIR/prod_backup_$DATE.sql"
    
    # Assuming 'clinic-os-prod' is the binding name. Update if different.
    # Check wrangler.toml for binding name.
    # We use 'DB' binding usually but for export we need the database name.
    # Assuming 'clinic-os-db' is the remote name.
    
    npx wrangler d1 export clinic-os-db --remote --output="$DEST"
    
    if [ $? -eq 0 ]; then
        echo "✅ Backup saved to $DEST"
    else
        echo "❌ Backup failed"
        exit 1
    fi
    
else
    echo "Usage: $0 [local|production]"
    exit 1
fi
