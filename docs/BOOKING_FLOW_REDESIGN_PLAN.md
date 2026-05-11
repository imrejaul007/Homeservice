# Booking Flow Redesign Implementation Plan

## Overview

Redesign the booking wizard by **modifying existing files** to match the new NILIN UI mockups. This approach minimizes code duplication and maintains a single source of truth.

---

## Approach: Modify Existing Files

| What | Approach | Risk |
|------|----------|------|
| Backend schema | Add optional fields with defaults | **Safe** - backward compatible |
| BookingFormWizard.tsx | Modify steps & UI | **Safe** - development environment |
| New UI components | Create only what doesn't exist | **Required** - DateCarousel, etc. don't exist |

**Why this is safe:**
- Backend: New fields have defaults, existing bookings unaffected
- Frontend: We're in development, can test thoroughly before deploy
- Only create new files for components that genuinely don't exist

---

## New vs Current Flow

| Step | Current | New |
|------|---------|-----|
| 1 | Service Details | **Date & Time** (new DateCarousel + TimeSlotGrid) |
| 2 | Date & Time | **Service Details** (Location, Duration, Preference) |
| 3 | Contact Info | **Payment** (method selection + summary) |
| 4 | Confirmation | **Confirmation** (updated design) |

---

## Phase 1: Backend Changes (Modify Existing)

### 1.1 booking.model.ts - Add 4 new fields

```typescript
// Add to IBooking interface
locationType: 'at_home' | 'hotel';
professionalPreference: 'male' | 'female' | 'no_preference';
selectedDuration: number;
paymentMethod: 'apple_pay' | 'credit_card' | 'cash';

// Add to schema
locationType: {
  type: String,
  enum: ['at_home', 'hotel'],
  default: 'at_home'
},
professionalPreference: {
  type: String,
  enum: ['male', 'female', 'no_preference'],
  default: 'no_preference'
},
selectedDuration: {
  type: Number,
  min: 15,
  max: 480
},
paymentMethod: {
  type: String,
  enum: ['apple_pay', 'credit_card', 'cash'],
  default: 'credit_card'
}
```

### 1.2 service.model.ts - Add durationOptions

```typescript
durationOptions: {
  type: [{
    duration: Number,
    price: Number,
    label: String
  }],
  default: []
}
```

### 1.3 booking.controller.ts - Accept new fields

Update `createBooking` to accept and validate new fields.

---

## Phase 2: Frontend - New UI Components

Create in `frontend/src/components/booking/ui/`:

| Component | Purpose |
|-----------|---------|
| DateCarousel.tsx | Horizontal scrollable date picker |
| TimeSlotGrid.tsx | Grid of time slot buttons |
| LocationTypeSelector.tsx | At home / Hotel toggle |
| DurationSelector.tsx | Duration option cards |
| ProfessionalPreference.tsx | Male/Female/No preference |
| PaymentMethodSelector.tsx | Apple Pay / Credit Card |
| BookingSummaryCard.tsx | Booking summary display |
| TrustBadge.tsx | "Verified by NILIN" badge |

---

## Phase 3: Modify BookingFormWizard.tsx

1. Update FormData interface with new fields
2. Update steps array (reorder steps)
3. Replace step rendering to use new components

---

## Phase 4: Update Supporting Files

- bookingStore.ts - Add duration options state
- BookingService.ts - Update CreateBookingData interface

---

## Files Summary

### Backend - MODIFY (3 files)
- `backend/src/models/booking.model.ts`
- `backend/src/models/service.model.ts`
- `backend/src/controllers/booking.controller.ts`

### Frontend - MODIFY (3 files)
- `frontend/src/components/booking/BookingFormWizard.tsx`
- `frontend/src/stores/bookingStore.ts`
- `frontend/src/services/BookingService.ts`

### Frontend - CREATE (8 files)
- `frontend/src/components/booking/ui/DateCarousel.tsx`
- `frontend/src/components/booking/ui/TimeSlotGrid.tsx`
- `frontend/src/components/booking/ui/LocationTypeSelector.tsx`
- `frontend/src/components/booking/ui/DurationSelector.tsx`
- `frontend/src/components/booking/ui/ProfessionalPreference.tsx`
- `frontend/src/components/booking/ui/PaymentMethodSelector.tsx`
- `frontend/src/components/booking/ui/BookingSummaryCard.tsx`
- `frontend/src/components/booking/ui/TrustBadge.tsx`

---

## Styling (NILIN Theme)

- **Primary button**: `bg-[#8B9B7C] hover:bg-[#7A8A6B] text-white`
- **Selected state**: `bg-[#8B9B7C]/10 border-[#8B9B7C] border-2`
- **Cards**: `bg-white rounded-2xl shadow-sm p-4`
- **Trust badge**: `bg-[#8B9B7C]/10 text-[#8B9B7C]`
