# NILIN Deployment Guide

## Overview

This guide covers deploying NILIN to various hosting platforms (Kubernetes, Render, Vercel) for staging and production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
- [Backend Deployment (Render)](#backend-deployment-render)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Health Check Verification](#health-check-verification)
- [Rollback Procedures](#rollback-procedures)

---

## Prerequisites

### Required Tools

**For all deployments:**
- Git
- Node.js >= 18.x
- npm >= 9.x

**For Kubernetes:**
- kubectl >= 1.24
- kustomize >= 4.5
- docker >= 20.10
- helm >= 3.10

**For Render:**
- Render account with appropriate permissions
- PostgreSQL addon (optional, defaults to MongoDB)

**For Vercel:**
- Vercel account
- Vercel CLI (`npm i -g vercel`)

---

## Environment Variables

### Required Environment Variables

Create a `.env` file based on `.env.example` and configure these variables:

#### Core Application

```bash
# Application Environment
NODE_ENV=production
API_VERSION=v1
APP_NAME=NILIN API

# Frontend URL (for email links, redirects)
FRONTEND_URL=https://your-frontend-url.vercel.app
API_BASE_URL=https://your-backend-url.onrender.com
```

#### Database (MongoDB)

```bash
# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/nilin
MONGODB_DB_NAME=nilin

# MongoDB Connection Pool (optional)
MONGODB_MIN_POOL_SIZE=5
MONGODB_MAX_POOL_SIZE=50
MONGODB_CONNECT_TIMEOUT_MS=30000
MONGODB_SERVER_SELECTION_TIMEOUT_MS=30000
```

#### Authentication & Security

```bash
# JWT Configuration (REQUIRED in production)
JWT_ACCESS_SECRET=your-32-char-minimum-access-secret-key
JWT_REFRESH_SECRET=your-32-char-minimum-refresh-secret-key
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# Session Configuration
SESSION_SECRET=your-session-secret
SESSION_TIMEOUT=2592000000  # 30 days in ms
SESSION_REFRESH_THRESHOLD=300000  # 5 minutes

# Encryption Key (32 characters)
ENCRYPTION_KEY=your-32-character-encryption-key

# CSRF Configuration
CSRF_COOKIE_NAME=csrf_token
CSRF_HEADER_NAME=x-csrf-token
CSRF_SAME_SITE=strict
```

#### Rate Limiting

```bash
# Global Rate Limits
RATE_LIMIT_MAX_REQUESTS=500
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes

# API Key Rate Limits (if using API keys)
API_KEY_RATE_LIMIT=1000
API_KEY_RATE_LIMIT_WINDOW=900000
```

#### Redis (Caching & Sessions)

```bash
# Redis Connection
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
REDIS_URL=rediss://user:password@host:port
REDIS_SESSION_ENABLED=true
```

#### Payment Gateway (Stripe)

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

#### Email (SendGrid)

```bash
# SendGrid Configuration
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM_EMAIL=noreply@nilin.app
SENDGRID_FROM_NAME=NILIN

# Alternative email provider
EMAIL_PROVIDER=sendgrid
```

#### SMS (Twilio)

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=xxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890
```

#### CAPTCHA

```bash
# CAPTCHA Configuration (hcaptcha recommended)
CAPTCHA_ENABLED=true
CAPTCHA_PROVIDER=hcaptcha
HCAPTCHA_SITE_KEY=xxx
HCAPTCHA_SECRET_KEY=xxx
RECAPTCHA_SITE_KEY=xxx
RECAPTCHA_SECRET_KEY=xxx
```

#### File Storage (Cloudinary)

```bash
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
CLOUDINARY_FOLDER=nilin
```

#### AI Services (Optional)

```bash
# AI Provider Configuration
AI_PROVIDER=none  # Options: none, openai, anthropic
OPENAI_API_KEY=xxx
OPENAI_MODEL=gpt-3.5-turbo
ANTHROPIC_API_KEY=xxx
ANTHROPIC_MODEL=claude-3-haiku
```

#### Monitoring & Observability

```bash
# Sentry Error Tracking
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_TRACES_SAMPLE_RATE=0.1

# Prometheus Metrics
METRICS_ENABLED=true
METRICS_EXPORT_INTERVAL_MS=60000
PROMETHEUS_PORT=9090

# Alerts
ALERTS_ENABLED=true
ALERT_WEBHOOK_URL=https://hooks.slack.com/xxx
```

#### Infrastructure

```bash
# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://admin.your-domain.com

# Proxy Configuration
TRUST_PROXY_COUNT=1

# Cluster Mode (for production with multiple cores)
CLUSTER_MODE=false

# Compression
COMPRESSION_LEVEL=6
# Compression threshold (bytes) - responses larger than this will be compressed
COMPRESSION_THRESHOLD=1024

# Keep-alive
KEEP_ALIVE_TIMEOUT=65000

# Graceful Shutdown
GRACEFUL_SHUTDOWN_TIMEOUT=10000
```

---

## Database Setup

### MongoDB Setup

1. **Create MongoDB Atlas Cluster** (or use self-hosted):

   ```bash
   # Using MongoDB Atlas CLI
   mongocli atlas clusters create --provider AWS --region us-east-1 --members 3 --tier M10
   ```

2. **Create Database User**:

   ```bash
   mongocli atlas dbusers create --username nilin_app --password --database admin
   ```

3. **Configure IP Whitelist** (for production):

   ```bash
   # Allow Render/Railway IP ranges or 0.0.0.0/0 for development
   mongocli atlas accessLists create --cidrEntry 0.0.0.0/0
   ```

4. **Run Migrations** (if applicable):

   ```bash
   cd backend
   npm run migrate
   # or
   npx ts-node src/scripts/migrate.ts
   ```

5. **Seed Initial Data** (optional):

   ```bash
   npm run seed
   # or
   npx ts-node src/seeders/run.ts
   ```

### Connection String Format

```
# Standard connection
mongodb+srv://username:password@cluster.mongodb.net/nilin

# With options
mongodb+srv://username:password@cluster.mongodb.net/nilin?retryWrites=true&w=majority&maxPoolSize=50
```

---

## Frontend Deployment (Vercel)

### Quick Deploy

1. **Connect Repository**:

   ```bash
   # Install Vercel CLI
   npm i -g vercel

   # Login
   vercel login

   # Deploy
   cd frontend
   vercel
   ```

2. **Configure Environment Variables** in Vercel Dashboard:

   - `VITE_API_URL` = Your backend URL
   - `VITE_APP_NAME` = NILIN
   - `VITE_STRIPE_PUBLISHABLE_KEY` = pk_live_xxx

3. **Custom Domain** (optional):

   ```bash
   vercel domains add your-domain.com
   vercel certs issue your-domain.com
   ```

### Vercel Configuration (vercel.json)

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/client",
  "framework": "vite",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "https://your-backend.onrender.com/api/$1" }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "https://your-domain.com" }
      ]
    }
  ]
}
```

### Deploy from GitHub

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your repository
3. Set root directory: `frontend`
4. Configure environment variables
5. Click Deploy

---

## Backend Deployment (Render)

### Quick Deploy

1. **Create Render Account** at [render.com](https://render.com)

2. **Create Web Service**:

   - Click "New +" > "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Root Directory**: `backend`
     - **Build Command**: `npm run build`
     - **Start Command**: `npm start`

3. **Configure Environment Variables**:

   Add all required variables from [Environment Variables](#environment-variables) section.

4. **Set Instance Type**: Starter (for staging) or Starter+ (for production)

### Using render.yaml

Create `render.yaml` in root directory:

```yaml
services:
  - type: web
    name: nilin-api
    env: node
    region: oregon
    plan: starter
    rootDir: backend
    buildCommand: npm run build
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      - key: JWT_ACCESS_SECRET
        sync: false
      - key: JWT_REFRESH_SECRET
        sync: false
      # Add other env vars...

# Background Worker (optional)
  - type: worker
    name: nilin-worker
    env: node
    region: oregon
    plan: starter
    rootDir: backend
    buildCommand: npm run build
    startCommand: npm run worker
    envVars:
      - key: NODE_ENV
        value: production
      - key: MONGODB_URI
        sync: false
      # Add worker-specific env vars...
```

### Deploy with CLI

```bash
# Install Render CLI
npm install -g @render/create-render

# Login
render login

# Deploy
cd backend
render deploy --name nilin-api
```

---

## Kubernetes Deployment

### Infrastructure Requirements

- Kubernetes cluster (1.24+)
- Ingress controller (nginx-ingress or traefik)
- cert-manager for TLS
- Metrics server (for HPA)
- MongoDB cluster or managed instance
- Redis cluster or managed instance
- S3-compatible storage (for backups)

### Directory Structure

```
k8s/
├── base/                    # Base configurations
│   ├── namespace.yaml
│   ├── api-deployment.yaml
│   ├── worker-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── services.yaml
│   ├── ingress.yaml
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

### Deploy Steps

#### 1. Configure Secrets

```bash
kubectl create secret generic nilin-secrets \
  --from-literal=MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net" \
  --from-literal=REDIS_HOST="redis.example.com" \
  --from-literal=REDIS_PORT="6379" \
  --from-literal=JWT_ACCESS_SECRET="your-jwt-access-secret" \
  --from-literal=JWT_REFRESH_SECRET="your-jwt-refresh-secret" \
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

#### 2. Build and Push Images

```bash
# Build API image
docker build -t nilin/api:v1.0.0 -t nilin/api:latest -f backend/Dockerfile .
docker push nilin/api:v1.0.0

# Build Frontend image
docker build -t nilin/frontend:v1.0.0 -t nilin/frontend:latest -f frontend/Dockerfile .
docker push nilin/frontend:v1.0.0
```

#### 3. Deploy to Staging

```bash
# Deploy using kustomize
kubectl apply -k k8s/overlays/staging

# Or using deploy script
./scripts/deploy.sh staging v1.0.0

# Verify deployment
kubectl get pods -n nilin-staging
kubectl logs -n nilin-staging -l app=nilin-api -f
```

#### 4. Test Staging

```bash
# Run smoke tests
curl https://staging.nilin.app/api/health
curl https://staging.nilin.app/api/v1/services

# Run integration tests
npm run test:integration -- --env=staging
```

#### 5. Deploy to Production

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

### Kubernetes Resources

#### API Deployment

```yaml
spec:
  replicas: 3  # 2 for staging
  template:
    spec:
      containers:
        - name: api
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
```

#### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nilin-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nilin-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Compression Configuration

### Overview

The NILIN application uses response compression at multiple layers to optimize bandwidth usage and improve response times.

### Backend Compression (Express)

The backend uses the `compression` middleware with configurable settings:

**Location:** `backend/src/app.ts` (lines 114-129)

```typescript
app.use(compression({
  filter: (req, res) => {
    // Skip compression for requests with this header
    if (req.headers['x-no-compression']) {
      return false;
    }
    const fallback = compression.filter(req, res);
    return fallback;
  },
  level: parseInt(process.env.COMPRESSION_LEVEL || '6'), // 0-9
  threshold: 1024, // Only compress > 1KB responses
  chunkSize: 16 * 1024, // 16KB chunks
  windowBits: 15,
}));
```

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `COMPRESSION_LEVEL` | 6 | Compression level 0-9 (0=none, 9=max) |
| `COMPRESSION_THRESHOLD` | 1024 | Minimum response size to compress (bytes) |

**Compression Levels:**
- `0`: No compression (disable)
- `1-3`: Fast compression, lower ratio
- `4-6`: Balanced (recommended)
- `7-9`: Maximum compression, slower

### Frontend Compression (Nginx)

The frontend nginx configuration enables gzip compression:

**Location:** `frontend/nginx.conf` (lines 7-12)

```nginx
# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied expired no-cache no-store private auth;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;
```

**Compression Types Enabled:**
- `text/plain`, `text/css`
- `text/xml`, `application/json`
- `application/javascript`, `application/x-javascript`
- `application/xml`, `image/svg+xml`

### Testing Compression

#### Backend Compression Test

```bash
# Test with compression (gzip)
curl -H "Accept-Encoding: gzip" -I https://api.nilin.app/api/health

# Expected headers:
# Content-Encoding: gzip
# Vary: Accept-Encoding

# Test without compression
curl -H "Accept-Encoding: identity" -I https://api.nilin.app/api/health

# Expected: No Content-Encoding header

# Skip compression header
curl -H "x-no-compression: true" -I https://api.nilin.app/api/health

# Expected: No Content-Encoding header
```

#### Frontend Compression Test

```bash
# Test nginx compression
curl -H "Accept-Encoding: gzip" -I https://your-frontend.vercel.app/

# Verify Content-Encoding header is present
```

#### Automated Verification Script

```bash
# Test compression on all endpoints
curl -s -D - -o /dev/null -H "Accept-Encoding: gzip" https://api.nilin.app/api/health | grep -i content-encoding
curl -s -D - -o /dev/null -H "Accept-Encoding: gzip" https://api.nilin.app/api/v1/services | grep -i content-encoding
```

### Troubleshooting

#### Compression Not Working

1. **Check Content-Encoding header:**
   ```bash
   curl -I -H "Accept-Encoding: gzip" https://api.nilin.app/api/health
   ```

2. **Verify middleware order:** Compression should be before routes in `app.ts`

3. **Check response size:** Responses < 1KB are not compressed by default

4. **Check for bypass header:**
   ```bash
   # This should NOT be compressed
   curl -H "x-no-compression: true" -I https://api.nilin.app/api/health
   ```

#### High CPU Usage from Compression

If compression causes high CPU load:

1. **Reduce compression level:**
   ```bash
   COMPRESSION_LEVEL=3
   ```

2. **Increase threshold:**
   ```bash
   COMPRESSION_THRESHOLD=4096  # Only compress larger responses
   ```

3. **Disable for specific endpoints** (use `x-no-compression` header)

#### Memory Issues

- `chunkSize: 16 * 1024` controls memory per compressed stream
- Higher chunk sizes use more memory but improve throughput

### Performance Recommendations

#### CPU vs Bandwidth Tradeoff

| Compression Level | CPU Usage | Bandwidth Savings | Best For |
|-------------------|-----------|-------------------|----------|
| 0-1 | Minimal | None | High-traffic, CPU-constrained |
| 4-6 | Moderate | 60-70% | Balanced (recommended) |
| 7-9 | High | 70-80% | Low-traffic, bandwidth-constrained |

#### CDN Recommendations

For production deployments, consider:

1. **Cloudflare:** Automatic gzip/brotli at edge, free tier available
2. **AWS CloudFront:** Gzip + brotli support, integration with AWS services
3. **Vercel Edge:** Built-in compression, no configuration needed
4. **Akamai:** Advanced compression with real-time optimization

#### Edge Compression

If using a CDN, consider enabling edge compression:

```nginx
# Cloudflare (automatic)
# No configuration needed - Cloudflare handles gzip/brotli

# AWS CloudFront
# Behavior settings:
# - Compress objects automatically: Yes
# - Viewer protocol policy: Redirect HTTP to HTTPS
```

#### Brotli Support

Brotli provides 15-20% better compression than gzip. To enable:

```nginx
# In nginx.conf (if building custom)
load_module modules/ngx_http_brotli_filter_module.so;
load_module modules/ngx_http_brotli_static_module.so;

brotli on;
brotli_types text/plain text/css application/json application/javascript;
brotli_comp_level 6;
```

---

## Health Check Verification

### Backend Health Checks

```bash
# Basic health check
curl https://api.nilin.app/health

# Expected response:
{
  "status": "healthy",
  "service": "NILIN API",
  "timestamp": "2026-06-25T00:00:00.000Z",
  "uptime": 3600.5,
  "environment": "production",
  "version": "v1"
}
```

### Readiness & Liveness Probes

```bash
# Liveness probe (is the pod running?)
curl https://api.nilin.app/health/live

# Readiness probe (is the pod ready to serve traffic?)
curl https://api.nilin.app/health/ready
```

### Database Connection Check

```bash
curl https://api.nilin.app/api/test

# Should return:
{
  "success": true,
  "message": "Backend API is connected and working!",
  "timestamp": "2026-06-25T00:00:00.000Z",
  "api_version": "v1"
}
```

### Frontend Health Check

1. Visit your Vercel/Render URL
2. Verify the page loads without errors
3. Check browser console for any API errors
4. Test key user flows (login, search, booking)

---

## Rollback Procedures

### Kubernetes Rollback

```bash
# View rollout history
kubectl rollout history deployment/nilin-api -n nilin-production

# Rollback to previous version
kubectl rollout undo deployment/nilin-api -n nilin-production

# Rollback to specific revision
kubectl rollout undo deployment/nilin-api -n nilin-production --to-revision=2

# Monitor rollback
kubectl rollout status deployment/nilin-api -n nilin-production -w
```

### Vercel Rollback

```bash
# View deployments
vercel list

# Rollback to previous deployment
vercel rollback [deployment-url]
```

### Render Rollback

1. Go to Render Dashboard
2. Select your service
3. Click "Deploys" tab
4. Click "Previous" or select a specific deploy
5. Click "Redeploy"

### Database Rollback

```bash
# Using mongodump backup
mongorestore --uri="mongodb+srv://user:pass@cluster.mongodb.net" \
  --nsInclude="nilin.*" \
  --dir=/path/to/backup
```

---

## CI/CD Pipeline

### GitHub Actions (Example)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Deploy to Render
        run: |
          curl -X POST https://api.render.com/v1/services/${{ secrets.RENDER_SERVICE_ID }}/deploys \
            -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}"
```

---

## Troubleshooting

### Common Issues

#### Pod Not Starting

```bash
# Check pod events
kubectl describe pod <pod-name> -n nilin-production

# Check logs
kubectl logs <pod-name> -n nilin-production --previous
```

#### Database Connection Issues

```bash
# Test MongoDB connection
mongosh "mongodb+srv://user:pass@cluster.mongodb.net/nilin" --eval "db.runCommand({ping:1})"
```

#### High Memory Usage

```bash
# Check resource usage
kubectl top pods -n nilin-production

# Adjust resource limits in deployment
kubectl edit deployment nilin-api -n nilin-production
```

---

## Security Checklist

- [ ] All secrets stored securely (not in code)
- [ ] TLS certificates configured and auto-renewing
- [ ] CORS configured for specific domains only
- [ ] Rate limiting enabled on API endpoints
- [ ] Input validation on all endpoints
- [ ] SQL/NoSQL injection prevention
- [ ] XSS protection headers
- [ ] CSRF tokens enabled
- [ ] 2FA enabled for admin accounts
- [ ] Audit logging enabled
- [ ] Regular security updates

---

## Performance Checklist

- [ ] CDN configured for static assets
- [ ] Image optimization in place
- [ ] Redis caching enabled
- [ ] Database connection pooling configured
- [x] Compression enabled (gzip/brotli)
- [ ] HTTP/2 or HTTP/3 enabled
- [ ] HPA configured for auto-scaling
- [ ] Resource limits set appropriately
- [ ] Pod disruption budget configured

---

## Disaster Recovery

### RTO (Recovery Time Objective): 1 hour
### RPO (Recovery Point Objective): 24 hours

### Recovery Procedures

1. **Database Recovery**:
   ```bash
   ./scripts/restore.sh production /path/to/latest/backup.tar.gz
   ```

2. **Full Cluster Recovery**:
   ```bash
   kubectl create namespace nilin-production
   kubectl apply -f backups/k8s-resources-*.yaml
   kubectl scale deployment/nilin-api --replicas=3 -n nilin-production
   ```

---

## Support

For deployment issues, contact:
- Email: devops@nilin.app
- Slack: #platform-support
