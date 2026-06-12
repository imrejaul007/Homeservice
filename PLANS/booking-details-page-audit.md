# Booking Details Page Audit & Implementation Plan

**Date:** 2026-06-12
**Page:** `http://localhost:3000/customer/bookings/:id`
**Status:** Planning

---

## Executive Summary

The booking details page has **4 critical issues** that need fixing before production:

| Priority | Issue | Impact | Fix Complexity |
|----------|-------|--------|---------------|
| 🔴 P0 | "AED 1.41" price bug | Data integrity | Database fix + validation |
| 🔴 P0 | Inconsistent price formatting | Display bugs | 1 utility function change |
| 🟡 P1 | Duplicate timeline logic | Maintenance burden | Component refactor |
| 🟢 P2 | Route param naming inconsistency | Minor confusion | Route alias |

---

## Issue 1: "AED 1.41" Price Bug (CRITICAL)

### Root Cause Analysis

The backend `calculatePricing()` in `booking.service.ts:3305-3395` reads `service.price.amount` from the database. If the Service document has `price.amount: 1.41` instead of `price.amount: 141.00`, the booking will store the wrong value.

**Data Flow:**
```
Service Model (source)
    └── price.amount: 1.41  ← WRONG VALUE
            ↓
    calculatePricing() reads this value
            ↓
    basePrice: 1.41
    tax: 0.07 (5% of 1.41)
    totalAmount: 1.48  ← Stored in booking
```

### Investigation Steps

1. **Check the specific booking's service:**
   ```javascript
   db.bookings.findOne({ bookingNumber: "RZ-20260612-1610" })
   // Look at serviceId field
   ```

2. **Check the Service document:**
   ```javascript
   db.services.findOne({ _id: <serviceId from booking> }, { name: 1, price: 1 })
   ```

3. **Fix the Service price:**
   ```javascript
   db.services.updateOne(
     { _id: <serviceId> },
     { $set: { "price.amount": 141.00 } }
   )
   ```

### Prevention: Add Price Validation

**File:** `backend/src/services/booking.service.ts:3316-3323`

Add sanity check that rejects bookings with suspiciously low prices:
```typescript
// After line 3320
const MIN_PRICE = 1;  // AED
const MAX_PRICE = 100000;  // AED
if (basePrice < MIN_PRICE || basePrice > MAX_PRICE) {
  throw new ApiError(400, `Service price out of reasonable range: ${basePrice} ${currency}`);
}
```

---

## Issue 2: Inconsistent Price Formatting (CRITICAL)

### Current State

| File | Line | Method | Status |
|------|------|--------|--------|
| `BookingDetailPage.tsx` | 385 | Raw string concatenation | ❌ BROKEN |
| `BookingDetail.tsx` | 590-616 | Inline Intl.NumberFormat | ✅ Works |
| `lib/utils.ts` | 8-13 | `formatPrice()` utility | ❌ UNUSED |

### Problem Details

**BookingDetailPage.tsx:385** (BROKEN):
```tsx
<div className="text-2xl font-bold text-nilin-coral">
  {currentBooking.pricing.currency || 'AED'} {currentBooking.pricing.totalAmount}
</div>
```
- Displays `1.41` as `AED 1.41` instead of `AED 1.41`
- No locale formatting (1,000 becomes "1000" not "1,000.00")
- No decimal handling for edge cases

**BookingDetail.tsx:590** (WORKS but inconsistent):
```tsx
{new Intl.NumberFormat(locale, { style: 'currency', currency: currentBooking.pricing.currency })
  .format(currentBooking.pricing.basePrice)}
```

### Implementation Plan

#### Step 2.1: Create Shared Price Formatting Utility

**File:** `frontend/src/utils/formatting.ts` (already exists, will enhance)

Add these exports:
```typescript
/**
 * Format price with proper locale and currency
 * Uses en-AE locale for AED, falls back to en-US
 */
export function formatBookingPrice(
  amount: number,
  currency: string = 'AED'
): string {
  const locale = currency === 'AED' ? 'en-AE' : 'en-US';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format price with custom options
 */
export function formatBookingPriceWithOptions(
  amount: number,
  options: {
    currency?: string;
    showSymbol?: boolean;
    decimals?: number;
    locale?: string;
  } = {}
): string {
  const {
    currency = 'AED',
    showSymbol = true,
    decimals = 2,
    locale = currency === 'AED' ? 'en-AE' : 'en-US'
  } = options;

  return new Intl.NumberFormat(locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: showSymbol ? currency : undefined,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}
```

#### Step 2.2: Update BookingDetailPage.tsx

**File:** `frontend/src/pages/booking/BookingDetailPage.tsx`

**Changes:**
1. **Add import** at top of file:
   ```typescript
   import { formatBookingPrice } from '../../utils/formatting';
   ```

2. **Fix line 385** - Total amount display:
   ```tsx
   // BEFORE (line 385)
   {currentBooking.pricing.currency || 'AED'} {currentBooking.pricing.totalAmount}
   
   // AFTER
   {formatBookingPrice(currentBooking.pricing.totalAmount, currentBooking.pricing.currency || 'AED')}
   ```

3. **Check for other price displays** in the same file - search for:
   - `pricing.totalAmount`
   - `pricing.basePrice`
   - `pricing.subtotal`
   - `pricing.tax`

#### Step 2.3: Verify BookingDetail.tsx consistency

**File:** `frontend/src/components/booking/BookingDetail.tsx`

Check if it already uses a utility or should migrate to `formatBookingPrice()`:
- Lines 590, 598, 606, 611, 616 use inline `Intl.NumberFormat`
- Consider updating to use shared utility for maintainability

#### Step 2.4: Update utils/index.ts exports

**File:** `frontend/src/utils/index.ts`

Add exports so components can import from one place:
```typescript
export * from './formatting';  // Already exists
// Ensure formatBookingPrice is exported
```

---

## Issue 3: Duplicate Timeline Logic (MEDIUM)

### Current State

| Component | File | Timeline Source | Lines |
|-----------|------|-----------------|-------|
| `BookingDetailPage` | `BookingDetailPage.tsx` | Status timestamps (confirmedAt, startedAt, etc.) | 180-241 |
| `BookingDetail` | `BookingDetail.tsx` | `statusHistory` array | 664-698 |

### Problem

Two different components build timelines differently:
- `BookingDetailPage` uses individual timestamp fields
- `BookingDetail` uses the `statusHistory` array

If the backend adds a new status type, both components need updating.

### Implementation Plan

#### Step 3.1: Create Unified Timeline Utility

**File:** `frontend/src/utils/timeline.ts` (new file)

```typescript
import { Booking } from '../types/booking.types';

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: Date;
  status: string;
  actor?: {
    name: string;
    type: 'customer' | 'provider' | 'system';
  };
  icon?: string;
}

/**
 * Build timeline events from booking data
 * Uses statusHistory as primary source, falls back to timestamp fields
 */
export function buildBookingTimeline(booking: Booking): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  
  // 1. Booking Created (always first)
  events.push({
    id: 'created',
    title: 'Booking Created',
    description: `Booking #${booking.bookingNumber}`,
    timestamp: new Date(booking.createdAt),
    status: 'created',
    actor: { name: 'Customer', type: 'customer' },
    icon: '📋'
  });

  // 2. Use statusHistory if available
  if (booking.statusHistory && booking.statusHistory.length > 0) {
    for (const history of booking.statusHistory) {
      events.push({
        id: history.status,
        title: formatStatusTitle(history.status),
        description: history.notes,
        timestamp: new Date(history.timestamp),
        status: history.status,
        actor: history.updatedBy ? {
          name: history.updatedBy,
          type: determineActorType(history)
        } : undefined,
        icon: getStatusIcon(history.status)
      });
    }
  } else {
    // Fallback: Use individual timestamp fields
    if (booking.confirmedAt) {
      events.push({
        id: 'confirmed',
        title: 'Booking Confirmed',
        timestamp: new Date(booking.confirmedAt),
        status: 'confirmed',
        icon: '✅'
      });
    }
    if (booking.startedAt) {
      events.push({
        id: 'in_progress',
        title: 'Service Started',
        timestamp: new Date(booking.startedAt),
        status: 'in_progress',
        icon: '🔧'
      });
    }
    if (booking.completedAt) {
      events.push({
        id: 'completed',
        title: 'Service Completed',
        timestamp: new Date(booking.completedAt),
        status: 'completed',
        icon: '🎉'
      });
    }
    if (booking.cancelledAt) {
      events.push({
        id: 'cancelled',
        title: 'Booking Cancelled',
        description: booking.cancellationReason,
        timestamp: new Date(booking.cancelledAt),
        status: 'cancelled',
        icon: '❌'
      });
    }
  }

  // Sort by timestamp
  return events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function formatStatusTitle(status: string): string {
  const titles: Record<string, string> = {
    pending: 'Pending Confirmation',
    confirmed: 'Confirmed',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    disputed: 'Disputed'
  };
  return titles[status] || status;
}

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    pending: '⏳',
    confirmed: '✅',
    in_progress: '🔧',
    completed: '🎉',
    cancelled: '❌',
    disputed: '⚠️'
  };
  return icons[status] || '📋';
}

function determineActorType(history: any): 'customer' | 'provider' | 'system' {
  // Determine from updatedBy field or context
  return 'system';
}
```

#### Step 3.2: Update BookingDetailPage.tsx

**File:** `frontend/src/pages/booking/BookingDetailPage.tsx`

**Changes:**

1. **Add import:**
   ```typescript
   import { buildBookingTimeline } from '../../utils/timeline';
   ```

2. **Replace getTimelineEvents function** (lines 180-241):
   ```typescript
   // BEFORE
   const getTimelineEvents = (): TimelineEvent[] => { ... }
   
   // AFTER - delegate to utility
   const timelineEvents = useMemo(() => {
     return buildBookingTimeline(currentBooking);
   }, [currentBooking]);
   ```

3. **Update Timeline component usage** (line 394):
   ```tsx
   // BEFORE
   <Timeline events={getTimelineEvents()} />
   
   // AFTER
   <Timeline events={timelineEvents} />
   ```

#### Step 3.3: Update BookingDetail.tsx

**File:** `frontend/src/components/booking/BookingDetail.tsx`

**Changes:**

1. **Add import:**
   ```typescript
   import { buildBookingTimeline } from '../../utils/timeline';
   ```

2. **Replace status history rendering** (lines 664-698) with utility:
   ```typescript
   const timelineEvents = useMemo(() => {
     return buildBookingTimeline(currentBooking);
   }, [currentBooking]);
   
   // Render using the same Timeline component
   ```

---

## Issue 4: Route Parameter Naming (LOW)

### Current State

- **URL:** `/customer/bookings/:id`
- **Component:** `useParams<{ bookingId: string }>()` expects `bookingId`
- **Route definition:** Need to verify route config

### Implementation Plan

**File:** `frontend/src/App.tsx` (or wherever routes are defined)

Check route definition:
```tsx
// Option A: Keep :id, update component to use { id: bookingId }
<Route path="/customer/bookings/:id" element={<BookingDetailPage />} />

// Option B: Change route to :bookingId
<Route path="/customer/bookings/:bookingId" element={<BookingDetailPage />} />
```

**Recommendation:** Option A - rename in component to match URL param:
```typescript
// In BookingDetailPage.tsx line 34
// BEFORE
const { bookingId } = useParams<{ bookingId: string }>();

// AFTER
const { id: bookingId } = useParams<{ id: string }>();
```

---

## Implementation Order

```
Phase 1: Critical Fixes (Do First)
├── 1.1 Investigate "AED 1.41" - Check database
├── 1.2 Fix service price in database
├── 1.3 Add price validation in backend (prevent future bad data)
│
Phase 2: Price Formatting (Do Second)
├── 2.1 Add formatBookingPrice() to formatting.ts
├── 2.2 Update BookingDetailPage.tsx to use utility
├── 2.3 Verify BookingDetail.tsx consistency
│
Phase 3: Timeline Unification (Do Third)
├── 3.1 Create timeline.ts utility
├── 3.2 Update BookingDetailPage.tsx
├── 3.3 Update BookingDetail.tsx
│
Phase 4: Minor Fixes (Do Last)
└── 4.1 Fix route param naming
```

---

## Testing Checklist

After each phase, verify:

### Phase 1: Database Fix
- [ ] Query booking shows correct service.price.amount
- [ ] New bookings with same service have correct price
- [ ] Existing bookings with wrong price are identifiable

### Phase 2: Price Formatting
- [ ] Total amount displays correctly (e.g., "AED 1,410.00")
- [ ] Base price, subtotal, tax all formatted
- [ ] No "AED 1.41" displays anywhere
- [ ] Works with different currencies (USD, EUR)

### Phase 3: Timeline Unification
- [ ] Timeline shows all status changes in order
- [ ] Timestamps display in local timezone
- [ ] Icons and titles match status
- [ ] Both page and component use same timeline

### Phase 4: Route Param
- [ ] Navigation to booking works
- [ ] Deep links work
- [ ] No console warnings about missing params

---

## Files to Modify

| File | Change Type | Lines |
|------|-------------|-------|
| `backend/src/services/booking.service.ts` | Add validation | 3316-3323 |
| `frontend/src/utils/formatting.ts` | Add functions | New |
| `frontend/src/utils/timeline.ts` | New file | - |
| `frontend/src/pages/booking/BookingDetailPage.tsx` | Update | 34, 385 |
| `frontend/src/components/booking/BookingDetail.tsx` | Update | Timeline section |
| `frontend/src/App.tsx` (or routes) | Verify/update | Route param |

---

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|------------|------------|
| Database price fix | Medium | Use read-first, update with validation |
| Backend validation | Low | Only affects new bookings |
| Frontend formatting | Low | Uses existing Intl API |
| Timeline utility | Medium | Existing components still work during transition |

---

## Rollback Plan

If issues occur:

1. **Database fix:** Restore previous `price.amount` value
2. **Frontend formatting:** Revert to inline `Intl.NumberFormat` (existing pattern in BookingDetail.tsx works)
3. **Timeline utility:** Revert to component-specific logic (both patterns exist)

---

## Sign-off Checklist

Before marking complete:

- [ ] All price displays use `formatBookingPrice()`
- [ ] Timeline is consistent across components
- [ ] No console errors on the page
- [ ] Responsive on mobile (test at 375px width)
- [ ] Real-time updates still work (socket connection)
- [ ] All actions (cancel, reschedule) still functional