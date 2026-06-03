# Admin Real-Time Updates Implementation Plan

## Executive Summary

This plan addresses gaps in the real-time update system where admin actions don't propagate to affected users (providers and customers). The implementation will ensure that when an admin approves/rejects/suspends a provider, updates a service, or takes action on bookings/users, the affected users receive immediate updates via Socket.IO without requiring page refresh.

---

## Phase 1: Backend Socket Event Completeness

### 1.1 Add Missing Socket Events (Backend)

**Files to modify:**
- `backend/src/socket/index.ts` - Add new event types and emit methods

**New Event Types (ServerToClientEvents interface):**
```typescript
// User status events (for both customers and providers)
'user:status_changed': (data: { userId: string; status: 'active' | 'suspended' | 'banned'; reason?: string }) => void;
'user:account_locked': (data: { userId: string; reason: string; until?: Date }) => void;

// Booking status events (for customers)
'booking:admin_updated': (data: { bookingId: string; bookingNumber: string; status: string; updatedBy: string }) => void;

// Service status events - already defined but need verification
'service:status_changed': (data: { serviceId: string; status: string; providerId: string }) => void;

// Batch operation completion
'services:batch_completed': (data: { affectedCount: number; action: string }) => void;

// Review visible to provider/customer
'review:visible': (data: { reviewId: string; rating: number; visible: boolean }) => void;
```

**New Emit Methods (SocketServer class):**
```typescript
emitUserStatusChanged(userId: string, status: string, reason?: string): boolean
emitBookingAdminUpdated(bookingId: string, bookingNumber: string, status: string, updatedBy: string): boolean
emitServicesBatchCompleted(providerIds: string[], count: number, action: string): void
emitReviewVisible(customerId: string, reviewId: string, rating: number, visible: boolean): boolean
```

### 1.2 Add Socket Emitters to providerOpsService

**File to modify:** `backend/src/services/providerOps.service.ts`

**Current State:** Only emits `provider:approved` via socket in `approveProvider()`

**Add socket emissions to:**
- `rejectProvider()` - Add `emitProviderRejected()`
- `suspendProvider()` - Add `emitProviderSuspended()`
- `reactivateProvider()` - Add new `emitProviderReactivated()` + event
- `verifyKycDocument()` - Add `emitDocumentVerified()`

### 1.3 Add Socket Emitters to admin.controller.ts

**File to modify:** `backend/src/controllers/admin.controller.ts`

**Add socket emissions to:**
- `updateBookingStatus()` - Add `emitBookingAdminUpdated()` to affected customer/provider
- `batchServiceAction()` - Add `emitServicesBatchCompleted()` to all affected providers
- `updateUserStatus()` - Add `emitUserStatusChanged()` to the affected user

### 1.4 Add to event-bus (Optional Enhancement)

**File to modify:** `backend/src/event-bus/index.ts`

Add subscriptions for platform events that need socket forwarding (lower priority - can be deferred).

---

## Phase 2: Frontend Socket Hooks

### 2.1 Add New Socket Hooks

**File to modify:** `frontend/src/hooks/useSocket.ts`

**Add new hooks:**
```typescript
// For user account status updates (customers and providers)
export function useUserStatus() {
  // Subscribes to:
  // - user:status_changed
  // - user:account_locked
}

// For booking status updates (customers)
export function useBookingAdminUpdates() {
  // Subscribes to:
  // - booking:admin_updated
}

// For batch service operations (providers)
export function useServiceBatchUpdates() {
  // Subscribes to:
  // - services:batch_completed
}

// For review visibility (customers and providers)
export function useReviewVisibility() {
  // Subscribes to:
  // - review:visible
}
```

### 2.2 Add Socket Service Subscribers

**File to modify:** `frontend/src/services/socket.ts`

**Add subscriber methods:**
```typescript
onUserStatusChanged(callback)
onBookingAdminUpdated(callback)
onServicesBatchCompleted(callback)
onReviewVisible(callback)
```

---

## Phase 3: Dashboard Integration

### 3.1 Provider Dashboard Integration

**File to modify:** `frontend/src/components/dashboard/ProviderDashboard.tsx`

**Current State:** Already uses `useProviderStatus()` hook for approval/rejection/suspension

**Enhancements:**
1. Verify `useProviderStatus()` covers all provider status events
2. Add `useServiceStatus()` hook subscription for service approval/rejection
3. Add `useReviewVisibility()` for when reviews become visible
4. Add UI toast notifications when events are received

### 3.2 Customer Dashboard Integration

**File to modify:** `frontend/src/components/dashboard/CustomerDashboard.tsx`

**Current State:** No socket subscriptions

**Add:**
1. `useUserStatus()` hook to detect account suspension/ban
2. `useBookingAdminUpdates()` hook for booking status changes from admin
3. `useReviewVisibility()` for new reviews appearing

### 3.3 Customer Bookings Page Enhancement

**File to modify:** `frontend/src/pages/booking/CustomerBookingsPage.tsx`

**Add:**
1. Socket subscription for `booking:admin_updated`
2. Auto-refresh booking list when admin updates booking status
3. Toast notification showing the update

---

## Phase 4: API Response Standardization

### 4.1 Create Unified Error Handler

**New file:** `frontend/src/services/errors.ts`

```typescript
export class ServiceError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public fieldErrors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export function handleApiError(error: unknown, operation: string): never {
  // Standardized error handling
}
```

### 4.2 Update API Services

**Files to update (priority order):**

1. `frontend/src/services/customerOpsApi.ts` - Remove duplicate ApiResponse, use centralized error handling
2. `frontend/src/services/adminCategoryApi.ts` - Add error handling
3. `frontend/src/services/adminReviewApi.ts` - Add error handling
4. `frontend/src/services/adminCouponApi.ts` - Add error handling

---

## Implementation Order

### Sprint 1: Backend Completeness (Day 1)
1. Add new socket event types and emit methods in `socket/index.ts`
2. Add socket emissions to `providerOps.service.ts`
3. Add socket emissions to `admin.controller.ts` for booking and user status updates

### Sprint 2: Frontend Hooks (Day 2)
1. Add new socket hooks in `useSocket.ts`
2. Add subscriber methods in `socket.ts`
3. Test socket events with manual emit

### Sprint 3: Dashboard Integration (Day 3)
1. Integrate hooks into Provider Dashboard
2. Integrate hooks into Customer Dashboard
3. Integrate hooks into Customer Bookings Page
4. Add toast notifications for real-time events

### Sprint 4: API Standardization (Day 4)
1. Create centralized error handler
2. Update customerOpsApi with proper error handling
3. Update other admin APIs

---

## Files to Modify

### Backend Files (7 files)
| File | Changes |
|------|---------|
| `backend/src/socket/index.ts` | Add 4 new event types, 4 new emit methods |
| `backend/src/services/providerOps.service.ts` | Add socket emissions for reject, suspend, reactivate, verifyKyc |
| `backend/src/controllers/admin.controller.ts` | Add socket emissions for booking status, batch actions, user status |

### Frontend Files (7 files)
| File | Changes |
|------|---------|
| `frontend/src/hooks/useSocket.ts` | Add 4 new hooks |
| `frontend/src/services/socket.ts` | Add 4 new subscriber methods |
| `frontend/src/components/dashboard/ProviderDashboard.tsx` | Add service status and review visibility hooks |
| `frontend/src/components/dashboard/CustomerDashboard.tsx` | Add user status and booking update hooks |
| `frontend/src/pages/booking/CustomerBookingsPage.tsx` | Add booking admin update hook |
| `frontend/src/services/errors.ts` | New file - error handling |
| `frontend/src/services/customerOpsApi.ts` | Use centralized error handling |

---

## Testing Plan

### Manual Testing Checklist

**Backend:**
- [ ] Approve provider → Provider receives socket event, dashboard updates
- [ ] Reject provider → Provider receives socket event with reason
- [ ] Suspend provider → Provider receives socket event, account locked
- [ ] Update booking status as admin → Customer receives socket event
- [ ] Batch approve services → All affected providers receive events
- [ ] Suspend customer → Customer receives socket event

**Frontend:**
- [ ] Provider Dashboard shows real-time updates without refresh
- [ ] Customer Dashboard shows account status changes
- [ ] Customer Bookings page shows admin booking updates
- [ ] Toast notifications appear for all events

---

## Rollback Plan

If issues arise:
1. Revert `socket/index.ts` event type changes first (affects both client/server)
2. Revert providerOps.service.ts socket calls
3. Revert admin.controller.ts socket calls
4. Revert frontend hook additions

All changes are additive - no existing functionality should break.

---

## Success Metrics

- [ ] Admin approves provider → Provider dashboard updates within 2 seconds
- [ ] Admin cancels booking → Customer bookings list updates within 2 seconds
- [ ] Admin suspends user → User sees toast notification, UI updates
- [ ] All socket connections stable with no memory leaks
- [ ] No console errors in browser during real-time updates
