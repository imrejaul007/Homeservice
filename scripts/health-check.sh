#!/bin/bash
# NILIN Health Check Script
# Usage: ./scripts/health-check.sh

set -e

API_URL="${API_URL:-http://localhost:3001}"
BACKEND_URL="${BACKEND_URL:-http://localhost:3001}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 NILIN Health Check"
echo "======================"

check_service() {
    local name=$1
    local url=$2

    echo -n "Checking $name... "
    if curl -s -f -o /dev/null -w "%{http_code}" "$url" | grep -q "200\|201"; then
        echo -e "${GREEN}✓ OK${NC}"
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        return 1
    fi
}

# Check Backend Health Endpoint
echo -n "Backend Health... "
HEALTH=$(curl -s "$BACKEND_URL/health" 2>/dev/null || echo "{}")
if echo "$HEALTH" | grep -q '"status"'; then
    STATUS=$(echo "$HEALTH" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
    if [ "$STATUS" = "healthy" ]; then
        echo -e "${GREEN}✓ HEALTHY${NC}"
    elif [ "$STATUS" = "degraded" ]; then
        echo -e "${YELLOW}⚠ DEGRADED${NC}"
    else
        echo -e "${RED}✗ DOWN${NC}"
    fi
else
    echo -e "${RED}✗ UNREACHABLE${NC}"
fi

# Check Database
echo -n "Database... "
DB_STATUS=$(echo "$HEALTH" | grep -o '"database":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
if [ "$DB_STATUS" = "up" ]; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ $DB_STATUS${NC}"
fi

# Check Redis
echo -n "Redis Cache... "
REDIS_STATUS=$(echo "$HEALTH" | grep -o '"redis":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
if [ "$REDIS_STATUS" = "up" ]; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${YELLOW}⚠ $REDIS_STATUS${NC}"
fi

# Check Circuit Breakers
echo -n "Circuit Breakers... "
CB_OPEN=$(echo "$HEALTH" | grep -o '"openCircuits":[0-9]*' | cut -d':' -f2 || echo "0")
if [ "$CB_OPEN" = "0" ]; then
    echo -e "${GREEN}✓ All Closed${NC}"
else
    echo -e "${RED}✗ $CB_OPEN Open${NC}"
fi

echo ""
echo "======================"
echo "Health check complete"
