# NILIN Home Service Marketplace - Production Deployment Guide

## Prerequisites

Before deploying to production, ensure you have:

1. **Node.js 20 LTS** installed
2. **MongoDB Atlas** cluster (M10 or higher recommended)
3. **Redis** instance (Redis Cloud or self-hosted)
4. **Stripe** account with API keys
5. **Domain name** with SSL certificates
6. **Cloud provider** account (AWS, DigitalOcean, Vercel, Render, etc.)

---

## Environment Variables

### Backend (`backend/.env`)

```bash
# ============================================
# SERVER CONFIGURATION
# ============================================
NODE_ENV=production
PORT=5000
API_URL=https://api.yourdomain.com

# ============================================
# DATABASE (MongoDB)
# ============================================
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/nilin?retryWrites=true&w=majority
MONGODB_DB_NAME=nilin

# ============================================
# REDIS (Queue & Cache)
# ============================================
REDIS_URL=redis://default:password@redis-cloud-instance.redis.cloud:12442
# OR
REDIS_HOST=your-redis-host.com
REDIS_PORT=12442
REDIS_PASSWORD=your-redis-password

# ============================================
# JWT AUTHENTICATION (CRITICAL)
# ============================================
# MUST be set in production - application will fail to start if missing
JWT_ACCESS_SECRET=your-super-secret-access-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# ============================================
# STRIPE PAYMENTS
# ============================================
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx

# ============================================
# EMAIL (Resend)
# ============================================
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
FRONTEND_URL=https://yourdomain.com

# ============================================
# CLOUDINARY (Images)
# ============================================
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=xxxxxxxxxxxxxxxxxxxx
CLOUDINARY_API_SECRET=xxxxxxxxxxxxxxxxxxxx

# ============================================
# SEARCH (Meilisearch)
# ============================================
MEILISEARCH_HOST=https://your-meilisearch-instance.com
MEILISEARCH_API_KEY=your-master-key

# ============================================
# LOCATION (OpenCage)
# ============================================
OPENCAGE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxx

# ============================================
# SENTRY ERROR MONITORING
# ============================================
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
SENTRY_ENVIRONMENT=production

# ============================================
# CORS & SECURITY
# ============================================
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CORS_ORIGIN=https://yourdomain.com

# ============================================
# OPTIONAL: AI SERVICES
# ============================================
# OPENAI_API_KEY=sk-xxxxx
# ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### Frontend (`frontend/.env`)

```bash
# ============================================
# API CONFIGURATION
# ============================================
VITE_API_URL=https://api.yourdomain.com/api
VITE_APP_NAME=NILIN Home Services
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=production

# ============================================
# STRIPE
# ============================================
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxxxxxxxxx

# ============================================
# LOCATION
# ============================================
VITE_OPENCAGE_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_DEFAULT_LOCATION_LAT=25.2048
VITE_DEFAULT_LOCATION_LNG=55.2708
VITE_DEFAULT_LOCATION_NAME=Dubai

# ============================================
# OPTIONAL: SOCKET.IO
# ============================================
VITE_SOCKET_URL=https://api.yourdomain.com
```

---

## Deployment Steps

### Option 1: Docker (Recommended)

```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.yml up -d

# Or build individual containers
docker build -t nilin-backend ./backend
docker build -t nilin-frontend ./frontend
```

### Option 2: Manual Deployment

#### Backend

```bash
cd backend

# Install dependencies
npm ci --production

# Build TypeScript
npm run build

# Start server
npm start
```

#### Frontend

```bash
cd frontend

# Install dependencies
npm ci

# Build for production
npm run build

# Serve with Nginx (see nginx.conf)
```

---

## Health Checks

### Backend Health Endpoint

```
GET /health
GET /health/ready
GET /health/live
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### Frontend Health

The frontend uses Sentry for error monitoring. Configure alert rules in Sentry dashboard.

---

## Monitoring & Alerts

### Recommended Alerts

1. **Error Rate > 1%** - Page load errors
2. **API Latency > 2s** - Slow responses
3. **Failed Bookings > 5%** - Business metric
4. **Payment Failures > 10%** - Revenue impact

### Key Metrics to Track

- Booking conversion rate
- Payment success rate
- Provider response time
- User session duration
- API response times
- Database connection pool usage
- Redis memory usage

---

## Rollback Strategy

### Docker

```bash
# Rollback to previous version
docker-compose down
docker pull nilin-backend:previous-tag
docker-compose up -d
```

### Manual

```bash
# Stop current deployment
pm2 stop nilin-backend

# Restore previous version
git checkout v1.2.3
npm run build
pm2 start ecosystem.config.js
```

---

## Database Backups

### MongoDB Atlas

1. Enable automatic backups in Atlas dashboard
2. Set backup schedule (daily recommended)
3. Test restore procedure quarterly

### Manual Backup

```bash
mongodump --uri="mongodb://username:password@host:27017/nilin" --out=/backup/nilin-$(date +%Y%m%d)
```

---

## Security Checklist

- [ ] JWT secrets are unique and at least 32 characters
- [ ] Stripe webhook secret is configured
- [ ] CORS origins restricted to production domain
- [ ] MongoDB authentication enabled
- [ ] Redis password set
- [ ] HTTPS enforced (redirect HTTP to HTTPS)
- [ ] Rate limiting enabled in production
- [ ] Sensitive logs redacted
- [ ] API rate limits configured
- [ ] Admin accounts use 2FA

---

## Support & Troubleshooting

### Common Issues

**Server won't start:**
- Check JWT secrets are set
- Verify MongoDB connection string
- Check Redis connectivity

**Payments failing:**
- Verify Stripe keys are live keys
- Check webhook endpoint is accessible
- Review Stripe dashboard for error logs

**Search not working:**
- Verify Meilisearch is running
- Check API key permissions
- Rebuild index if needed

### Logs Location

- Backend: `backend/logs/`
- Docker: `docker logs <container-name>`
- Systemd: `journalctl -u nilin-backend`

---

## Version Information

| Component | Version |
|-----------|---------|
| Node.js | 20 LTS |
| React | 18.x |
| MongoDB | 8.x |
| Redis | 7.x |
| Stripe | Latest |
