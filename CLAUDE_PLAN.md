# Admin Dashboard Implementation Plan

## Context

After analyzing the admin pages, I found that the `AnomalyDashboard.tsx` frontend is fully implemented but has NO corresponding backend routes. The service layer (`anomalyDetection.service.ts`) exists with embedded model and all logic, but the routes and controller are missing entirely.

Also, the previous analysis report incorrectly flagged dispute socket events as disconnected - they ARE actually connected through the event-bus layer. However, some dead code exists that should be cleaned up.

---

## What's Working (Verified)

| Feature | Status | Notes |
|---------|--------|-------|
| All admin pages except AnomalyDashboard | ✅ Working | Verified API calls connect to existing routes |
| Dispute socket events | ✅ Working | Connected via event-bus subscription |
| Provider/Booking/Review socket events | ✅ Working | Properly connected |

## What Needs to be Built

### CRITICAL: AnomalyDashboard Backend (Missing 100%)

The `AnomalyDashboard.tsx` makes 15+ API calls to `/admin/anomalies/*` but no routes exist.

**Files to create:**
1. `backend/src/controllers/anomaly.admin.controller.ts` - Controller with all endpoints
2. `backend/src/routes/anomaly.admin.routes.ts` - Router with all admin routes

**Files to modify:**
1. `backend/src/routes/index.ts` - Register the new routes

**The anomaly service already exists at** `backend/src/services/anomalyDetection.service.ts` with:
- Embedded Anomaly model with full schema
- All CRUD operations
- Detection methods (fraud, booking, payment, behavioral)
- Stats and filtering methods

---

## Implementation Details

### 1. Create Controller (`anomaly.admin.controller.ts`)

```typescript
// Required methods matching frontend API calls:
- getAllAnomalies()      // GET /admin/anomalies
- getAnomalyById()       // GET /admin/anomalies/:id
- getAnomalyStats()      // GET /admin/anomalies/stats
- getSeverityChartData() // GET /admin/anomalies/chart/severity
- getTypeChartData()     // GET /admin/anomalies/chart/type
- updateAnomalyStatus()  // PATCH /admin/anomalies/:id/status
- bulkUpdateStatus()     // POST /admin/anomalies/bulk-update
- runDetection()         // POST /admin/anomalies/detect
- exportAnomalies()      // GET /admin/anomalies/export
```

### 2. Create Routes (`anomaly.admin.routes.ts`)

```typescript
// Pattern: authenticate + requireRole('admin') + rate limiting
router.get('/', anomalyAdminController.getAllAnomalies);
router.get('/stats', anomalyAdminController.getAnomalyStats);
router.get('/chart/severity', anomalyAdminController.getSeverityChartData);
router.get('/chart/type', anomalyAdminController.getTypeChartData);
router.get('/export', anomalyAdminController.exportAnomalies);
router.get('/:id', anomalyAdminController.getAnomalyById);
router.patch('/:id/status', anomalyAdminController.updateAnomalyStatus);
router.post('/bulk-update', anomalyAdminController.bulkUpdateStatus);
router.post('/detect', anomalyAdminController.runDetection);
```

### 3. Register Routes in `index.ts`

```typescript
// Add after other admin routes (~line 239)
import anomalyAdminRoutes from './anomaly.admin.routes';
router.use('/admin/anomalies', anomalyAdminRoutes);
```

---

## Medium Priority Fixes

### 4. Add Rate Limiting to Unprotected Routes

| Route File | Action |
|-----------|--------|
| `automationAdmin.routes.ts` | Add `adminLimiter` |
| `notificationAdmin.routes.ts` | Add `adminLimiter` |
| `customerOps.routes.ts` | Add `adminLimiter` |

### 5. Clean Up Dead Socket Code

The following socket subscriptions exist but are never triggered:
- `booking:reminder` - No backend emits this
- `chat:presence:online/offline` - Presence not implemented
- `notification:read` - No backend emits when notification read

**Recommendation:** Remove dead subscriptions OR implement the missing backend functionality.

---

## Implementation Steps

### Phase 1: Critical (Anomaly Backend)

1. [ ] Create `backend/src/controllers/anomaly.admin.controller.ts`
2. [ ] Create `backend/src/routes/anomaly.admin.routes.ts`
3. [ ] Register routes in `backend/src/routes/index.ts`
4. [ ] Test AnomalyDashboard loads without errors

### Phase 2: Medium (Rate Limiting)

5. [ ] Add `adminLimiter` to `automationAdmin.routes.ts`
6. [ ] Add `adminLimiter` to `notificationAdmin.routes.ts`
7. [ ] Add `adminLimiter` to `customerOps.routes.ts`

### Phase 3: Cleanup (Optional)

8. [ ] Remove or implement dead socket subscriptions

---

## Verification Checklist

After implementation, verify:
- [ ] AnomalyDashboard loads without 404 errors
- [ ] Stats cards display anomaly counts
- [ ] Filter controls work (type, severity, status)
- [ ] Anomaly detail modal opens on click
- [ ] Status update works (mark as resolved/false positive)
- [ ] Export CSV download works
