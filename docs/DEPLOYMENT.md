# NILIN Deployment Guide

## Overview

This guide covers deploying NILIN to Kubernetes clusters for staging and production environments.

## Prerequisites

### Required Tools
- kubectl >= 1.24
- kustomize >= 4.5
- docker >= 20.10
- helm >= 3.10

### Infrastructure Requirements
- Kubernetes cluster (1.24+)
- Ingress controller (nginx-ingress or traefik)
- cert-manager for TLS
- Metrics server (for HPA)
- MongoDB cluster or managed instance
- Redis cluster or managed instance
- S3-compatible storage (for backups)

## Environment Structure

```
k8s/
├── base/                    # Base configurations
│   ├── namespace.yaml
│   ├── api-deployment.yaml
│   ├── worker-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── services.yaml
│   ├── ingress.yaml
│   ├── redis-deployment.yaml
│   ├── redis-service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── api-hpa.yaml
│   ├── worker-hpa.yaml
│   └── kustomization.yaml
└── overlays/
    ├── staging/
    │   └── kustomization.yaml
    └── production/
        └── kustomization.yaml
```

## Deployment Steps

### 1. Configure Secrets

Create production secrets file:

```bash
kubectl create secret generic nilin-secrets \
  --from-literal=MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net" \
  --from-literal=REDIS_HOST="redis.example.com" \
  --from-literal=REDIS_PORT="6379" \
  --from-literal=JWT_SECRET="your-jwt-secret" \
  --from-literal=ENCRYPTION_KEY="your-32-char-encryption-key" \
  --from-literal=STRIPE_SECRET_KEY="sk_live_xxx" \
  --from-literal=STRIPE_WEBHOOK_SECRET="whsec_xxx" \
  --from-literal=AWS_ACCESS_KEY_ID="xxx" \
  --from-literal=AWS_SECRET_ACCESS_KEY="xxx" \
  --from-literal=SENDGRID_API_KEY="SG.xxx" \
  --from-literal=TWILIO_ACCOUNT_SID="xxx" \
  --from-literal=TWILIO_AUTH_TOKEN="xxx" \
  --from-literal=TWILIO_PHONE_NUMBER="+xxx" \
  --namespace=nilin-production \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 2. Deploy to Staging

```bash
# Build and push images
docker build -t nilin/api:v1.0.0 -t nilin/api:latest .
docker push nilin/api:v1.0.0

# Deploy to staging
./scripts/deploy.sh staging v1.0.0

# Verify deployment
kubectl get pods -n nilin-staging
kubectl logs -n nilin-staging -l app=nilin-api -f
```

### 3. Test Staging

```bash
# Run smoke tests
curl https://staging.nilin.app/api/health
curl https://staging.nilin.app/api/v1/services

# Run integration tests
npm run test:integration -- --env=staging
```

### 4. Deploy to Production

```bash
# Tag for production
docker tag nilin/api:v1.0.0 nilin/api:prod-v1.0.0
docker push nilin/api:prod-v1.0.0

# Run backup before production deploy
./scripts/backup.sh production

# Deploy to production
./scripts/deploy.sh production v1.0.0

# Monitor rollout
kubectl rollout status deployment/nilin-api -n nilin-production -w
```

## Kubernetes Resources

### API Deployment
- Replicas: 3 (production), 2 (staging)
- Resources: 500m CPU, 512Mi memory (requests)
- Limits: 1000m CPU, 1Gi memory
- HPA: scales 2-10 replicas based on CPU/memory

### Worker Deployment
- Replicas: 2 (production), 1 (staging)
- Resources: 250m CPU, 256Mi memory (requests)
- Limits: 500m CPU, 512Mi memory
- HPA: scales 1-5 replicas based on queue depth

### Frontend Deployment
- Replicas: 3 (production), 2 (staging)
- Resources: 100m CPU, 128Mi memory (requests)
- Limits: 250m CPU, 256Mi memory
- HPA: scales 2-10 replicas based on CPU

## Monitoring

### View Metrics
```bash
# Prometheus metrics
kubectl port-forward -n monitoring svc/prometheus 9090:9090

# Grafana dashboards
kubectl port-forward -n monitoring svc/grafana 3000:3000
```

### Key Dashboards
- API Performance: request rate, latency, error rate
- Worker Queue: job throughput, processing time, backlog
- Database: connection pool, query latency, replication lag
- Redis: memory usage, hit rate, connection count

## Troubleshooting

### Check Pod Logs
```bash
kubectl logs -n nilin-production -l app=nilin-api --tail=100 -f
kubectl logs -n nilin-production -l app=nilin-worker --tail=100 -f
```

### Check Events
```bash
kubectl get events -n nilin-production --sort-by='.lastTimestamp'
```

### Debug Running Pod
```bash
kubectl exec -it -n nilin-production deploy/nilin-api -- sh
```

### Restart Deployment
```bash
kubectl rollout restart deployment/nilin-api -n nilin-production
```

### Rollback
```bash
# View rollout history
kubectl rollout history deployment/nilin-api -n nilin-production

# Rollback to previous version
./scripts/rollback.sh production api
```

## Backup and Restore

### Create Backup
```bash
./scripts/backup.sh production
```

### Restore from Backup
```bash
./scripts/restore.sh production /path/to/backup.tar.gz
```

## Security Checklist

- [ ] All secrets stored in Kubernetes Secrets (not in config files)
- [ ] TLS certificates configured and auto-renewing
- [ ] Network policies restrict pod-to-pod communication
- [ ] RBAC properly configured for all service accounts
- [ ] Container images scanned for vulnerabilities
- [ ] Pod security policies/enforcement enabled
- [ ] Audit logging enabled for all namespaces
- [ ] Rate limiting configured on API gateway
- [ ] WAF rules configured for production traffic

## Performance Checklist

- [ ] HPA configured for all deployments
- [ ] Resource limits set appropriately
- [ ] Pod disruption budget configured
- [ ] Horizontal pod autoscaling tuned
- [ ] Redis caching enabled and configured
- [ ] Database connection pooling configured
- [ ] CDN configured for static assets
- [ ] Image optimization in place

## Disaster Recovery

### RTO (Recovery Time Objective): 1 hour
### RPO (Recovery Point Objective): 24 hours

### Recovery Procedures

1. **Database Recovery**
```bash
./scripts/restore.sh production /path/to/latest/backup.tar.gz
```

2. **Full Cluster Recovery**
```bash
# Recreate namespace
kubectl create namespace nilin-production

# Restore resources
kubectl apply -f backups/k8s-resources-*.yaml

# Scale up services
kubectl scale deployment/nilin-api --replicas=3 -n nilin-production
```

## CI/CD Pipeline

See `.github/workflows/deploy.yml` for automated deployment pipeline.

### Pipeline Stages
1. Build and test
2. Security scan
3. Push to registry
4. Deploy to staging
5. Integration tests
6. Deploy to production
7. Smoke tests
8. Notify on success/failure
