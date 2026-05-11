# FIX PLAN - Production Readiness

**Created:** May 11, 2026  
**Priority:** HIGH → MEDIUM → LOW

---

## Phase 1: Critical Fixes (Do First)

### 1.1 Missing Environment Variables

| Variable | Where | Action |
|----------|-------|--------|
| `RESEND_API_KEY` | backend/.env | Get from resend.com and add |
| Production JWT secrets | backend/.env | Already generated, just need to ensure they match |
| Production STRIPE_WEBHOOK_SECRET | backend/.env | Already have local, need production one |

### 1.2 Missing Features

#### A. Email - Resend API
**Status:** Configured but `RESEND_API_KEY` missing
**Fix:**
```bash
# Get from https://resend.com/api-keys
# Add to backend/.env:
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

#### B. Stripe Webhook (Production)
**Status:** Local webhook secret exists, need production
**Fix:** In Render, after backend deploy:
```bash
stripe listen --forward-to your-app.onrender.com/api/payments/webhook
# Or set up in Stripe Dashboard > Webhooks
```

---

## Phase 2: Code Cleanup

### 2.1 Delete Backup Files
```bash
# Already deleted:
# - backend/src/controllers/availability.controller.ts.backup
# - backend/src/routes/auth.routes.ts.backup-pre-service-refactor
# - backend/src/routes/booking.routes.ts.backup-pre-service-refactor
```

### 2.2 Consolidate Duplicate Controllers

**Issue:** Both `auth.controller.ts` and `auth.controller.refactored.ts` exist

**Files to consolidate:**
```
backend/src/controllers/
├── auth.controller.ts                  ← DELETE (old)
├── auth.controller.refactored.ts       ← KEEP (rename to auth.controller.ts)
├── booking.controller.ts               ← DELETE (old)
└── booking.controller.refactored.ts    ← KEEP (rename to booking.controller.ts)
```

**After consolidation:**
1. Copy content from `*.refactored.ts` to main file
2. Delete the `.refactored.ts` version
3. Update imports in routes

### 2.3 Fix TODO Comments

```typescript
// backend/src/controllers/admin.controller.ts
// Line: TODO: Use for audit logging
// Line: TODO: Send approval email
// Line: TODO: Send rejection email
```

```typescript
// frontend/src/components/search/SearchResults.tsx
// Line: TODO: Implement navigation to provider profile
// Line: TODO: Implement favorite functionality
// Line: TODO: Show toast notification
```

---

## Phase 3: Security Hardening

### 3.1 Add XSS Protection (Frontend)
```bash
npm install dompurify
```

### 3.2 Add Security Headers
Update `backend/src/app.ts`:
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "https://api.stripe.com"],
    },
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));
```

### 3.3 Remove Sensitive Data from Logs
Update `backend/src/utils/logger.ts` to redact sensitive fields.

---

## Phase 4: Missing Features Implementation

### 4.1 Payment - Refund Flow (HIGH)
```typescript
// backend/src/services/payment.service.ts (new file)
- createRefund()
- getRefundStatus()
- calculateRefundAmount()
```

### 4.2 Push Notifications (MEDIUM)
```typescript
// Option 1: Firebase Cloud Messaging
npm install firebase-admin firebase/messaging

// Option 2: OneSignal
npm install onesignal-node-client
```

### 4.3 SMS Notifications (MEDIUM)
```typescript
// backend/src/services/sms.service.ts (new file)
- sendSMS()
- verifyPhone()
```
**Already configured:** Twilio in .env (not integrated)

### 4.4 Real-time Updates (MEDIUM)
```bash
npm install socket.io
```
```typescript
// backend/src/socket/index.ts (new file)
- bookingStatusUpdate
- newBookingNotification
- chatMessage
```

### 4.5 Dark Mode (LOW)
```bash
# Use Tailwind CSS dark mode
# Update tailwind.config.js
```

---

## Phase 5: Production Optimizations

### 5.1 Add Error Tracking
```bash
npm install @sentry/node @sentry/react
```

### 5.2 Add Performance Monitoring
```bash
npm install express-actuator
```
Add `/actuator/health` endpoint for Render health checks.

### 5.3 SEO Enhancements
```bash
# frontend/public/
- robots.txt
- sitemap.xml
- favicon.ico
```

### 5.4 Bundle Optimization
```typescript
// frontend/vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
      },
    },
  },
}
```

---

## Phase 6: Testing

### 6.1 Unit Tests
```bash
# Backend
npm run test

# Frontend
npm run test
```

### 6.2 Integration Tests
```bash
npm run test:integration
```

### 6.3 E2E Tests
```bash
npm run test:e2e
```

---

## Phase 7: Deployment Checklist

### Pre-Deploy
- [ ] All Phase 1 items completed
- [ ] All Phase 2 items completed
- [ ] All critical TODOs fixed
- [ ] Test suite passes

### Deploy Backend
- [ ] Push to GitHub
- [ ] Create Render Web Service
- [ ] Add all environment variables
- [ ] Deploy succeeds
- [ ] Health check passes: `https://your-api.onrender.com/health`

### Deploy Frontend
- [ ] Update `VITE_API_URL` to production backend URL
- [ ] Push to GitHub
- [ ] Create Render Static Site
- [ ] Deploy succeeds
- [ ] Test at frontend URL

### Post-Deploy
- [ ] Update `CLIENT_URL` in backend to frontend URL
- [ ] Test complete booking flow
- [ ] Configure Stripe production webhooks
- [ ] Verify emails sending (Resend)
- [ ] Check all API endpoints

---

## Execution Order

```
Week 1: Phase 1-3 (Critical)
├── Day 1: Add RESEND_API_KEY, Stripe prod webhook
├── Day 2: Code cleanup (consolidate controllers)
└── Day 3: Security hardening, fix TODOs

Week 2: Phase 4 (Features)
├── Day 1: Refund flow
├── Day 2: Push notifications OR dark mode
└── Day 3: Real-time updates OR SMS

Week 3: Phase 5-7 (Polish)
├── Day 1: Error tracking, SEO, optimizations
├── Day 2: Testing
└── Day 3: Deploy & verify
```

---

## Files to Modify

### Backend
| File | Action |
|------|--------|
| `backend/.env` | Add RESEND_API_KEY |
| `backend/src/app.ts` | Security headers, Socket.io |
| `backend/src/controllers/auth.controller.ts` | Consolidate |
| `backend/src/controllers/booking.controller.ts` | Consolidate |
| `backend/src/services/payment.service.ts` | Create (refund) |
| `backend/src/services/sms.service.ts` | Create (SMS) |
| `backend/src/services/notification.service.ts` | Create (push) |
| `backend/src/socket/index.ts` | Create (realtime) |

### Frontend
| File | Action |
|------|--------|
| `frontend/.env` | Add VITE_API_URL for prod |
| `frontend/package.json` | Add dompurify, sentry |
| `frontend/src/components/search/SearchResults.tsx` | Fix TODOs |
| `frontend/tailwind.config.js` | Add dark mode |
| `frontend/src/App.tsx` | Error boundary |
| `frontend/public/` | Add robots.txt, sitemap |

### Docs
| File | Action |
|------|--------|
| `docs/FIX_PLAN.md` | This file |
| `docs/PROJECT_AUDIT_REPORT.md` | Already created |
| `docs/PROJECT_CONTEXT_FOR_AI.md` | Already created |

---

*End of Fix Plan*
