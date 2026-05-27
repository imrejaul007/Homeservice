#!/bin/bash
# NILIN Cache Clear Script
# Usage: ./scripts/cache-clear.sh [--pattern PATTERN]

set -e

REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
PATTERN="${1:-*}"

echo "🗑️ Clearing Redis cache..."
echo "Pattern: $PATTERN"
echo "Redis URL: $REDIS_URL"

# Connect to Redis and clear matching keys
redis-cli -u "$REDIS_URL" KEYS "$PATTERN" | while read key; do
    if [ -n "$key" ]; then
        echo "Deleting: $key"
        redis-cli -u "$REDIS_URL" DEL "$key"
    fi
done

# Flush metrics cache
echo "Flushing metrics cache..."
redis-cli -u "$REDIS_URL" DEL "metrics:*"

# Flush analytics cache
echo "Flushing analytics cache..."
redis-cli -u "$REDIS_URL" DEL "analytics:*"

# Flush session cache
echo "Flushing session cache..."
redis-cli -u "$REDIS_URL" DEL "sessions:*"

echo "✅ Cache cleared"
