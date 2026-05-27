#!/bin/bash
set -euo pipefail

# NILIN Restore Script
# Usage: ./scripts/restore.sh <environment> <backup-file>
# Example: ./scripts/restore.sh production /path/to/backup.tar.gz

ENVIRONMENT=${1:?Usage: $0 <environment> <backup-file>}
BACKUP_FILE=${2:?Usage: $0 <environment> <backup-file>}
NAMESPACE="nilin-${ENVIRONMENT}"
TEMP_DIR=$(mktemp -d)

echo "=============================================="
echo "  NILIN Restore Script"
echo "=============================================="
echo "Environment: ${ENVIRONMENT}"
echo "Backup file: ${BACKUP_FILE}"
echo "Namespace: ${NAMESPACE}"
echo "=============================================="

# Validate backup file
if [ ! -f "${BACKUP_FILE}" ]; then
    echo "✗ Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Confirmation prompt
echo ""
read -p "⚠ This will restore from backup to ${ENVIRONMENT}. Continue? (yes/no): " CONFIRM
if [ "${CONFIRM}" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

# Extract backup
echo ""
echo "Extracting backup..."
tar xzf "${BACKUP_FILE}" -C "${TEMP_DIR}"

# Restore MongoDB
restore_mongodb() {
    echo ""
    echo "Restoring MongoDB..."

    local ARCHIVE=$(find "${TEMP_DIR}" -name "*.archive.gz" -o -name "*.archive" | head -1)
    if [ -z "${ARCHIVE}" ]; then
        echo "⚠ No MongoDB archive found, skipping"
        return
    fi

    local MONGO_URI=$(kubectl get secret -n "${NAMESPACE}" nilin-secrets -o jsonpath='{.data.MONGODB_URI}' | base64 -d)
    local MONGO_DB=$(kubectl get configmap -n "${NAMESPACE}" nilin-config -o jsonpath='{.data.MONGODB_DATABASE}')

    # Create restore pod
    kubectl run mongo-restore \
        --namespace "${NAMESPACE}" \
        --image mongo:6.0 \
        --rm -it \
        --restart=Never \
        --command -- sh -c "mongorestore --uri='${MONGO_URI}' --db=${MONGO_DB} --drop --archive=${ARCHIVE} --gzip"

    echo "✓ MongoDB restored"
}

# Restore Kubernetes resources
restore_kubernetes_resources() {
    echo ""
    echo "Restoring Kubernetes resources..."

    local K8S_YAML=$(find "${TEMP_DIR}" -name "k8s-resources-*.yaml" | head -1)
    if [ -z "${K8S_YAML}" ]; then
        echo "⚠ No Kubernetes resources found, skipping"
        return
    fi

    # Only restore ConfigMaps and Secrets (not deployments/services)
    kubectl apply -f "${K8S_YAML}" --namespace "${NAMESPACE}" \
        -l 'app notin (nilin-api,nilin-worker,nilin-frontend)'

    echo "✓ Kubernetes resources restored"
}

# Cleanup
cleanup() {
    echo ""
    echo "Cleaning up..."
    rm -rf "${TEMP_DIR}"
    echo "✓ Cleanup completed"
}

# Main execution
main() {
    restore_mongodb
    restore_kubernetes_resources
    cleanup

    echo ""
    echo "=============================================="
    echo "✓ Restore completed successfully!"
    echo "=============================================="
    echo "⚠ You may need to restart deployments:"
    echo "  kubectl rollout restart deployment/nilin-api -n ${NAMESPACE}"
    echo "  kubectl rollout restart deployment/nilin-worker -n ${NAMESPACE}"
}

main "$@"
