# Saved Addresses Integration Plan

## Problem Statement
Users must manually enter their address every time they book a service, even if they have saved addresses. We need to integrate saved addresses into the booking flow.

## What Already Exists
- ✅ Backend: Address CRUD endpoints in `/customers/addresses`
- ✅ Backend: Addresses stored in `CustomerProfile.addresses` array
- ✅ Frontend: `AddressesPage.tsx` - full CRUD for addresses
- ✅ Frontend API: `customerApi.getAddresses()` ready to use
- ✅ Route: `/customer/addresses` is wired up

## What Needs to Be Built

### Phase 1: Create Reusable Components

#### 1. `SavedAddressSelector` Component
**Location:** `frontend/src/components/booking/ui/SavedAddressSelector.tsx`

Card-based address selection matching existing UI patterns.

#### 2. `AddressForm` Component
**Location:** `frontend/src/components/booking/ui/AddressForm.tsx`

Extracted address input form (currently inline in BookingFormWizard).

### Phase 2: Integrate into BookingFormWizard

**Location:** `frontend/src/components/booking/BookingFormWizard.tsx`

1. Add state for saved addresses
2. Load addresses on mount (authenticated users only)
3. Show saved address selector when `locationType === 'at_home'`
4. Wire up address selection to populate form
5. Add "Save address" checkbox option

## File Changes Summary

| File | Action |
|------|--------|
| `frontend/src/components/booking/ui/SavedAddressSelector.tsx` | CREATE |
| `frontend/src/components/booking/ui/AddressForm.tsx` | CREATE |
| `frontend/src/components/booking/BookingFormWizard.tsx` | MODIFY |

## Implementation Order

1. Create `SavedAddressSelector` component
2. Create `AddressForm` component
3. Integrate into `BookingFormWizard`
4. Test the complete flow

## UI Design

```
┌─────────────────────────────────────────────┐
│  📍 Select a saved address                 │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ 🏠 Home (Default)              ●        │ │
│ │ Marina Plaza, Dubai Marina, Dubai        │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ 💼 Work                         ○       │ │
│ │ Business Bay, Downtown, Dubai           │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ○ Enter a new address                       │
└─────────────────────────────────────────────┘
```
