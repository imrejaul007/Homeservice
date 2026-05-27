#!/bin/bash
set -euo pipefail

# NILIN Deployment Script
# Usage: ./scripts/deploy.sh <environment> [version]
# Example: ./scripts/deploy.sh staging v1.2.3
# Example: ./scripts/deploy.sh production

ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}
NAMESPACE="nilin-${ENVIRONMENT}"

echo "=============================================="
echo "  NILIN Deployment Script"
echo "=============================================="
echo "Environment: ${ENVIRONMENT}"
echo "Version: ${VERSION}"
echo "Namespace: ${NAMESPACE}"
echo "=============================================="

# Check prerequisites
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed. Aborting."; exit 1; }
command -v kustomize >/dev/null 2>&1 || { echo "kustomize is required but not installed. Aborting."; exit 1; }

# Validate environment
validate_environment() {
    case $ENVIRONMENT in
        staging|production)
            echo "✓ Environment validated"
            ;;
        *)
            echo "✗ Invalid environment: $ENVIRONMENT"
            echo "Valid options: staging, production"
            exit 1
            ;;
    esac
}

# Pre-deployment checks
pre_deployment_checks() {
    echo ""
    echo "Running pre-deployment checks..."

    # Check cluster connectivity
    if ! kubectl cluster-info >/dev/null 2>&1; then
        echo "✗ Cannot connect to Kubernetes cluster"
        exit 1
    fi
    echo "✓ Cluster connectivity"

    # Check namespace exists
    if ! kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
        echo "Creating namespace ${NAMESPACE}..."
        kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
    fi
    echo "✓ Namespace ready"
}

# Deploy application
deploy_application() {
    echo ""
    echo "Deploying application..."

    # Use kustomize to build and apply
    kustomize build "k8s/overlays/${ENVIRONMENT}" | \
        sed "s|image: nilin/api:latest|image: nilin/api:${VERSION}|g" | \
        sed "s|image: nilin/frontend:latest|image: nilin/frontend:${VERSION}|g" | \
        kubectl apply -f -

    echo "✓ Application deployed"
}

# Wait for rollout
wait_for_rollout() {
    echo ""
    echo "Waiting for rollout to complete..."

    echo "Waiting for API deployment..."
    kubectl rollout status deployment/nilin-api -n "${NAMESPACE}" --timeout=600s || true
    echo "✓ API deployment complete"

    echo "Waiting for worker deployment..."
    kubectl rollout status deployment/nilin-worker -n "${NAMESPACE}" --timeout=600s || true
    echo "✓ Worker deployment complete"

    echo "Waiting for frontend deployment..."
    kubectl rollout status deployment/nilin-frontend -n "${NAMESPACE}" --timeout=600s || true
    echo "✓ Frontend deployment complete"
}

# Health check
health_check() {
    echo ""
    echo "Running health checks..."

    local INGRESS_HOST=$(kubectl get ingress -n "${NAMESPACE}" nilin-ingress -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || \
                       kubectl get ingress -n "${NAMESPACE}" nilin-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || \
                       echo "localhost")

    echo "Checking API health at ${INGRESS_HOST}..."
    for i in {1..5}; do
        if curl -sf "https://${INGRESS_HOST}/api/health" >/dev/null 2>&1 || \
           curl -sf "http://${INGRESS_HOST}/api/health" >/dev/null 2>&1; then
            echo "✓ API health check passed"
            return 0
        fi
        if [ $i -lt 5 ]; then
            echo "Retry ${i}/5..."
            sleep 5
        fi
    done
    echo "⚠ API health check did not pass (may need more time)"
}

# Main execution
main() {
    validate_environment
    pre_deployment_checks
    deploy_application
    wait_for_rollout
    health_check

    echo ""
    echo "=============================================="
    echo "✓ Deployment completed successfully!"
    echo "=============================================="
    echo ""
    echo "Useful commands:"
    echo "  View logs: kubectl logs -n ${NAMESPACE} -l app=nilin-api -f"
    echo "  View pods: kubectl get pods -n ${NAMESPACE}"
    echo "  Rollback: kubectl rollout undo deployment/nilin-api -n ${NAMESPACE}"
}

main "$@"
