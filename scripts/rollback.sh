#!/bin/bash
set -euo pipefail

# NILIN Rollback Script
# Usage: ./scripts/rollback.sh <environment> [deployment]
# Example: ./scripts/rollback.sh production api
# Example: ./scripts/rollback.sh staging

ENVIRONMENT=${1:-staging}
DEPLOYMENT=${2:-all}
NAMESPACE="nilin-${ENVIRONMENT}"

echo "=============================================="
echo "  NILIN Rollback Script"
echo "=============================================="
echo "Environment: ${ENVIRONMENT}"
echo "Deployment: ${DEPLOYMENT}"
echo "Namespace: ${NAMESPACE}"
echo "=============================================="

# Function to rollback a deployment
rollback_deployment() {
    local deploy=$1
    echo ""
    echo "Rolling back ${deploy}..."

    # Get revision history
    echo "Revision history:"
    kubectl rollout history deployment/nilin-${deploy} -n "${NAMESPACE}"

    # Perform rollback
    echo "Performing rollback..."
    kubectl rollout undo deployment/nilin-${deploy} -n "${NAMESPACE}"

    # Wait for rollout
    echo "Waiting for rollout to complete..."
    kubectl rollout status deployment/nilin-${deploy} -n "${NAMESPACE}" --timeout=300s

    echo "✓ ${deploy} rolled back successfully"
}

# Validate environment
validate_environment() {
    case $ENVIRONMENT in
        staging|production)
            echo "✓ Environment validated"
            ;;
        *)
            echo "✗ Invalid environment: $ENVIRONMENT"
            exit 1
            ;;
    esac
}

# Check namespace exists
check_namespace() {
    if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
        echo "✗ Namespace ${NAMESPACE} does not exist"
        exit 1
    fi
    echo "✓ Namespace exists"
}

# Main execution
main() {
    validate_environment
    check_namespace

    case $DEPLOYMENT in
        all)
            rollback_deployment "api"
            rollback_deployment "worker"
            rollback_deployment "frontend"
            ;;
        api|worker|frontend)
            rollback_deployment "$DEPLOYMENT"
            ;;
        *)
            echo "✗ Invalid deployment: $DEPLOYMENT"
            echo "Valid options: all, api, worker, frontend"
            exit 1
            ;;
    esac

    echo ""
    echo "✓ Rollback completed successfully!"
}

main "$@"
