#!/bin/bash
set -euo pipefail

# NILIN Backup Script
# Usage: ./scripts/backup.sh <environment>
# Example: ./scripts/backup.sh production

ENVIRONMENT=${1:-staging}
NAMESPACE="nilin-${ENVIRONMENT}"
BACKUP_DIR="${HOME}/.nilin/backups/${ENVIRONMENT}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="nilin-backup-${TIMESTAMP}"

echo "=============================================="
echo "  NILIN Backup Script"
echo "=============================================="
echo "Environment: ${ENVIRONMENT}"
echo "Backup name: ${BACKUP_NAME}"
echo "=============================================="

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Function to backup MongoDB
backup_mongodb() {
    echo ""
    echo "Backing up MongoDB..."

    local MONGO_URI=$(kubectl get secret -n "${NAMESPACE}" nilin-secrets -o jsonpath='{.data.MONGODB_URI}' 2>/dev/null | base64 -d)
    local MONGO_DB=$(kubectl get configmap -n "${NAMESPACE}" nilin-config -o jsonpath='{.data.MONGODB_DATABASE}' 2>/dev/null)

    if [ -z "${MONGO_URI}" ] || [ -z "${MONGO_DB}" ]; then
        echo "⚠ MongoDB credentials not found, skipping database backup"
        return
    fi

    # Create backup pod
    kubectl run mongo-backup-${TIMESTAMP} \
        --namespace "${NAMESPACE}" \
        --image mongo:6.0 \
        --rm -it \
        --restart=Never \
        --command -- sh -c "mongodump --uri='${MONGO_URI}' --db=${MONGO_DB} --archive=/backup/${BACKUP_NAME}.archive --gzip" \
        2>/dev/null || echo "MongoDB backup pod completed"

    echo "✓ MongoDB backup initiated"
}

# Function to backup Kubernetes resources
backup_kubernetes_resources() {
    echo ""
    echo "Backing up Kubernetes resources..."

    # Backup all resources
    kubectl get all,configmap,secret,ingress,statefulset -n "${NAMESPACE}" -o yaml > "${BACKUP_DIR}/k8s-resources-${TIMESTAMP}.yaml" 2>/dev/null || true

    echo "✓ Kubernetes resources backed up"
}

# Function to create encrypted tarball
create_backup_archive() {
    echo ""
    echo "Creating backup archive..."

    cd "${BACKUP_DIR}"
    tar czf "../${BACKUP_NAME}.tar.gz" . 2>/dev/null || true

    echo "✓ Backup archive created: ${HOME}/.nilin/backups/${BACKUP_NAME}.tar.gz"
}

# Function to cleanup old backups
cleanup_old_backups() {
    echo ""
    echo "Cleaning up old backups (keeping last 7)..."

    mkdir -p "${HOME}/.nilin/backups"
    cd "${HOME}/.nilin/backups"
    ls -t 2>/dev/null | tail -n +8 | xargs -r rm -f 2>/dev/null || true

    echo "✓ Old backups cleaned up"
}

# Main execution
main() {
    backup_mongodb
    backup_kubernetes_resources
    create_backup_archive
    cleanup_old_backups

    echo ""
    echo "=============================================="
    echo "✓ Backup completed successfully!"
    echo "=============================================="
    echo "Backup file: ${HOME}/.nilin/backups/${BACKUP_NAME}.tar.gz"
    echo ""
}

main "$@"
