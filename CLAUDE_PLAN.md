# Bundle Integration Fix Plan

## Context

After comprehensive audit of the codebase (frontend + backend), we identified 6 critical gaps between the frontend bundle UI and backend implementation:

| Issue | Frontend Expects | Backend Provides |
|-------|-------------------|------------------|
| Missing endpoints | 6 API calls | Only basic CRUD |
| Field mismatch | `id`, `shortDescription`, `images[]` | `_id`, `description`, `image` |
| No duration | Time slot calculation | Bundle services lack duration |
| No time in booking | `scheduledTime` sent | Ignored in bookBundle() |
| Reschedule bug | Provider ID | Uses booking ID |
| Status filter | `isActive` (active/inactive) | `status` (pending/approved/rejected) |

---

## Current Architecture

### Frontend Files
- `MyBundlesPage.tsx` - Provider bundle management (1197 lines)
- `ServicePackages.tsx` - Bundle card component (707 lines)
- `RescheduleModal.tsx` - Date/time selection (259 lines)
- `bundleApi.ts` - API service (432 lines)
- `bookingStore.ts` - Zustand store (1138 lines)

### Backend Files
- `bundle.model.ts` - Mongoose schema (466 lines)
- `bundle.routes.ts` - Routes (505 lines)
- `bundleSales.service.ts` - Business logic (555 lines)
- `booking.controller.ts` - Dual-path Bundle/Service lookup (1537 lines)

---

## Implementation Phases

### Phase 1: Backend Changes

#### Step 1.1: Add Missing Routes

**File:** `backend/src/routes/bundle.routes.ts`

Add 6 new endpoints after existing routes:

1. `GET /api/bundles/my` - Provider's own bundles with pagination
2. `GET /api/bundles/featured` - Featured bundles for homepage
3. `GET /api/bundles/popular` - Popular bundles by booking count
4. `GET /api/bundles/category/:categoryId` - Bundles by category
5. `GET /api/bundles/:id/availability` - Available time slots
6. `GET /api/bundles/slug/:slug` - Bundle by SEO slug

#### Step 1.2: Add Duration Field to Bundle Model

**File:** `backend/src/models/bundle.model.ts`

```typescript
// IBundleService interface - add duration
duration?: number;  // minutes for time slot calculation

// bundleServiceSchema - add field
duration: { type: Number, min: 0, default: 60 }
```

#### Step 1.3: Fix Bundle Booking Time

**Files:**
- `backend/src/routes/bundle.routes.ts` - Add `scheduledTime` to validation
- `backend/src/services/bundleSales.service.ts` - Use `scheduledTime` in booking creation

#### Step 1.4: Create Bundle Transformer

**File:** `backend/src/utils/bundleTransformer.ts` (NEW)

Transform backend data to frontend format:
- `_id` → `id`
- `description` → `shortDescription`
- `image` → `images[]`
- `serviceName` → `name`
- `originalPrice` → `discountedPrice` (with calculation)
- ObjectId → string conversion
- Date → ISO string conversion

#### Step 1.5: Create Migration Script

**File:** `backend/src/scripts/migrateBundleServiceDuration.ts` (NEW)

Add default duration (60 min) to existing bundle services.

---

### Phase 2: Frontend Changes

#### Step 2.1: Create Frontend Transformer

**File:** `frontend/src/utils/bundleTransformer.ts` (NEW)

Mirror backend transformer for response normalization.

#### Step 2.2: Update bundleApi.ts

**File:** `frontend/src/services/bundleApi.ts`

- Import and use transformer in all methods
- Transform request payloads (frontend → backend format)
- Transform response data (backend → frontend format)
- Map status filters (`active` → `isActive=true`)

#### Step 2.3: Fix RescheduleModal Bug

**File:** `frontend/src/components/booking/RescheduleModal.tsx`

Change from:
```typescript
await getAvailableSlots(booking._id, { date, duration, days });
```

To:
```typescript
const providerId = booking.providerId || booking.provider?._id;
await getAvailableSlots(providerId, { date, duration, days });
```

Update `TrackingData` interface to include `providerId` and `duration`.

---

## Files Summary

| File | Action | Lines |
|------|--------|-------|
| `backend/src/routes/bundle.routes.ts` | Add 6 routes, fix time | +200 |
| `backend/src/models/bundle.model.ts` | Add duration field | +10 |
| `backend/src/services/bundleSales.service.ts` | Use scheduledTime | +10 |
| `backend/src/utils/bundleTransformer.ts` | NEW | ~150 |
| `backend/src/scripts/migrateBundleServiceDuration.ts` | NEW | ~80 |
| `frontend/src/utils/bundleTransformer.ts` | NEW | ~180 |
| `frontend/src/services/bundleApi.ts` | Use transformer | +50 |
| `frontend/src/components/booking/RescheduleModal.tsx` | Fix providerId | +15 |

---

## Breaking Changes

1. **API Response Format** - Transformed fields (any code accessing `_id` directly)
2. **Duration Field** - Migration sets default 60 min
3. **Bundle Booking Time** - `scheduledTime` now used (existing bookings unaffected)

---

## Rollout Order

1. Deploy backend changes
2. Run migration script
3. Verify endpoints via curl
4. Deploy frontend changes
5. Test complete bundle flow
6. Monitor for errors

---

## Verification Checklist

After implementation, verify:
- [x] `GET /api/bundles/my` returns provider's bundles
- [x] `GET /api/bundles/featured` returns featured bundles
- [x] `GET /api/bundles/popular` returns popular bundles
- [x] `GET /api/bundles/:id/availability` returns slots
- [x] Bundle cards display correct field mappings
- [x] Bundle booking uses scheduledTime
- [x] RescheduleModal fetches slots correctly
- [x] Status filter works (active/inactive)

---

## ✅ IMPLEMENTATION COMPLETED

All tasks completed on June 6, 2026 (Session 5).

**Summary:**
- New files created: 3 (backend transformer, frontend transformer, migration script)
- Files modified: 5 (bundle routes, bundle model, bundle service, bundleApi, RescheduleModal)
- New endpoints added: 6
- Fields added to schema: 1 (duration)
- Components fixed: 1 (RescheduleModal)

**Next Step:** Run migration script to add duration to existing bundle services:
```bash
cd backend && npx ts-node src/scripts/migrateBundleServiceDuration.ts
```