# NILIN Mobile Audit Report

## Audit Date: 2026-05-14

---

## Executive Summary

| Category | Status | Priority |
|---------|--------|----------|
| Mobile UX | GOOD - Foundation solid | Medium |
| React Performance | NEEDS WORK | **Critical** |
| Backend Mobile | PARTIAL - Good foundation | Medium |

**Overall Assessment:** App is ~75% production-ready. Key fixes needed for performance and UX polish.

---

## Critical Issues Found

### 1. React Performance (CRITICAL)

#### No Zustand Selectors
**Issue:** All components use destructuring from stores, causing full re-renders.

```typescript
// BAD - re-renders on ANY store change
const { user, logout } = useAuthStore();

// GOOD - only re-renders when user changes
const user = useAuthStore(state => state.user);
```

**Affected:** 30+ components including NavigationHeader, BookingList, ServiceCard

#### No Component Memoization
**Issue:** ServiceCard, BookingCard, BookingList re-render on every parent update.

**Fix needed:** Wrap in `React.memo()`

#### No List Virtualization
**Issue:** Booking lists render all items even when paginated.

**Fix needed:** Install `react-window` for long lists

---

### 2. Mobile UX (HIGH)

#### Missing Bottom Navigation
**Issue:** Users must reach top of screen for all navigation.

**Fix needed:** Create BottomNav component with Home, Search, Bookings, Profile tabs

#### No Safe Area Handling
**Issue:** Content may overlap notch/home indicator on iPhone X+.

**Fix needed:** Add `pb-safe` padding to fixed elements

#### Form Input Optimization
**Issue:** Missing `inputmode`, `autocomplete`, `autocapitalize` attributes.

**Fix needed:** Update all form inputs for mobile keyboards

---

### 3. Image Optimization (MEDIUM)

#### Missing Lazy Loading
**Issue:** Most images don't use `loading="lazy"`.

**Fix needed:** Add to ServiceCard, HomePage, CategoryCards

#### No Responsive Images
**Issue:** No `srcSet` for mobile-sized images.

**Fix needed:** Add responsive srcSet to image components

---

### 4. Backend Mobile (MEDIUM)

#### Missing FCM Integration
**Issue:** Notification service exists but FCM not implemented.

**Fix needed:** Create `src/services/fcm.service.ts`

#### Missing Device Registration
**Issue:** No endpoint to register push tokens.

**Fix needed:** Create `POST /api/devices/register`

---

## Recommendations (Priority Order)

### Week 1: Critical Performance Fixes

1. [ ] Add Zustand selectors to all components
2. [ ] Wrap ServiceCard in React.memo
3. [ ] Wrap BookingCard in React.memo
4. [ ] Add list virtualization for BookingList

### Week 2: Mobile UX

5. [ ] Create BottomNav component
6. [ ] Add safe area handling CSS
7. [ ] Optimize form inputs
8. [ ] Add image lazy loading

### Week 3: Backend Mobile

9. [ ] Create FCM service
10. [ ] Create device registration endpoint
11. [ ] Add app version endpoint
12. [ ] Create sync endpoints

### Week 4: Polish

13. [ ] Performance optimization
14. [ ] Security hardening
15. [ ] Play Store prep

---

## Files to Modify

### Performance Critical
- `src/stores/authStore.ts` - Add selectors
- `src/stores/bookingStore.ts` - Add selectors
- `src/components/customer/ServiceCard.tsx` - Add React.memo
- `src/components/booking/BookingCard.tsx` - Add React.memo
- `src/components/booking/BookingList.tsx` - Add virtualization

### Mobile UX
- `src/components/layout/BottomNav.tsx` - NEW
- `src/index.css` - Add safe area classes
- `src/components/common/Input.tsx` - Optimize inputs
- `src/components/customer/ServiceCard.tsx` - Lazy images

### Backend
- `src/services/fcm.service.ts` - NEW
- `src/routes/device.routes.ts` - NEW
- `src/routes/app.routes.ts` - NEW
