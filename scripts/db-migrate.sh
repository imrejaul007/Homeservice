#!/bin/bash
# NILIN Database Migration Script
# Usage: ./scripts/db-migrate.sh [up|down|status]

set -e

MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/nilin}"
MIGRATION_DIR="${MIGRATION_DIR:-./migrations}"

ACTION="${1:-up}"

echo "🔄 Running migrations..."
echo "Action: $ACTION"
echo "Directory: $MIGRATION_DIR"

case "$ACTION" in
    up)
        echo "Running forward migrations..."
        for migration in "$MIGRATION_DIR"/*.js; do
            if [ -f "$migration" ]; then
                echo "  Applying: $(basename "$migration")"
                node "$migration"
            fi
        done
        ;;
    down)
        echo "Rolling back migrations..."
        for migration in $(ls -r "$MIGRATION_DIR"/*.js); do
            if [ -f "$migration" ]; then
                echo "  Rolling back: $(basename "$migration")"
                node "$migration" --rollback
            fi
        done
        ;;
    status)
        echo "Migration status:"
        mongo "$MONGODB_URI" --quiet --eval "db.migrations.find().forEach(printjson)"
        ;;
    *)
        echo "Usage: $0 [up|down|status]"
        exit 1
        ;;
esac

echo "✅ Migrations complete"
