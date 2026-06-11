# NILIN Home Service - Changelog

## June 8, 2026 - Customer Wallet Page Audit & Remediation

### Summary

End-to-end audit and remediation of `/customer/wallet` and connected wallet, referral, loyalty, payment, and cashback systems. Fixed 6 critical bugs including wrong API client, unverified add-money, broken loyalty job contract, and missing routes.

### Key Fixes

- **Wallet API**: `RevenueService` now uses `customerWalletApi` with context-aware hooks
- **Add Money**: Stripe PaymentIntent verification required; simulated mode for dev only
- **Loyalty**: Fixed BullMQ job contract (`job.name` fallback, precomputed points)
- **Navigation**: Added `/customer/transactions` page; fixed broken referral links
- **Cashback**: Wired `earnCashback` on booking completion; status lifecycle fixed
- **Security**: Wallet duplicate-reference guard uses `$elemMatch`; atomic cashback redeem
- **UX**: Mobile layout parity, socket balance updates, BottomNav wallet link restored

### New Files

- `frontend/src/pages/customer/WalletTransactionsPage.tsx`
- `frontend/src/components/wallet/WalletTopUpPayment.tsx`
- `backend/src/migrations/004_wallet_indexes.js`
- `WALLET_AUDIT_REPORT.md`, `WALLET_MONITORING.md`

---

## June 6, 2026 - Package Booking Flow & Per-Service Availability

### Summary

Comprehensive implementation and fixes for the package booking flow including:
- Collection mismatch fixes (Service vs Bundle)
- Data format normalization (frontend ↔ backend)
- Per-service/bundle availability feature
- Provider availability management UI
- Route order fixes
- Database migrations

---

## 1. Collection Mismatch Fixes (CRITICAL)

### Problem
Packages are stored in the **Bundle collection**, but many functions incorrectly queried the **Service collection**, causing 404 errors.

### Files Fixed

#### backend/src/controllers/packageBooking.controller.ts
- Changed `Service.findOne()` to `Bundle.findOne()` for package queries
- Updated `bookPackage`, `previewPackageBooking`, `checkPackageAvailability` functions
- Fixed import: `Service` → `Bundle`

#### backend/src/controllers/packageComparison.controller.ts
- Changed `Service.aggregate()` to `Bundle.aggregate()`
- Updated `comparePackages` and `getRecommendedForComparison` functions

#### backend/src/controllers/customerDashboard.controller.ts
- Updated `createBookingFromPackage` to query Bundle
- Updated `printPackageDetails` to query Bundle
- Added dynamic import for Bundle model

#### backend/src/routes/packages.public.routes.ts
- Changed `Service.aggregate()` to `Bundle.aggregate()` in `getPackageCategories`

---

## 2. Data Format Normalization (Frontend ↔ Backend)

### Problem
Backend returns services with different field names than frontend expects:
- `serviceId` vs `_id`
- `serviceName` vs `name`
- `originalPrice` vs `price`
- `duration` often missing

### Backend Fixes

#### backend/src/services/customerDashboard.service.ts
Added field transformation for services:
```typescript
services: (bundle.services || []).map((s: any) => ({
  ...s,
  duration: s.duration || 60,
  price: s.originalPrice || s.price || 0,
  _id: s.serviceId,
  name: s.serviceName,
})),
```

### Frontend Fixes

#### frontend/src/pages/booking/BookPackagePage.tsx
Added `mapService()` helper function for service normalization.

#### frontend/src/components/booking/PackageBookingWizard.tsx
Added `normalizeService()` with `normalizedServices` memo.

#### frontend/src/pages/PackageDetailPage.tsx
Fixed wizard service mapping with proper field names.

---

## 3. Route Order Fixes

### Problem
Express matches routes in definition order. `/:id` was defined before `/:id/print`.

### Files Fixed

#### backend/src/routes/packages.public.routes.ts
Moved `/:id/print` route BEFORE `/:id`:

#### backend/src/routes/packagePriceCalculator.routes.ts
Reordered routes to put `/:id/*` before `/:id`.

---

## 4. API Request/Response Schema Fixes

### Problem
Backend Joi validation expected different fields than frontend sent.

### Files Fixed

#### backend/src/routes/packages.public.routes.ts
Updated `bookPackageSchema` to match frontend payload with flexible field matching.

#### backend/src/controllers/packageBooking.controller.ts
Updated `packageBookingInputSchema` with flexible field matching.

---

## 5. "Book Now" Button Fix

### Problem
Clicking "Book Now" required date/time selection first.

### File Fixed

#### frontend/src/pages/PackageDetailPage.tsx
Changed to navigate directly to booking page without requiring pre-selection.

---

## 6. Provider Availability Schedule Fix

### Problem
Provider schedule had only 2 large time slots (3h, 5h blocks) instead of individual 30-minute slots.

### Migration Script Created

#### backend/src/scripts/fix-provider-schedule.ts
Replaces large blocks with individual 30-minute slots (148 slots per week).

---

## 7. Per-Service Availability Feature (NEW)

### Overview
Providers can now set different availability for each service or package/bundle.

### Backend API - New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/availability/service/schedules` | Get all service schedules |
| GET | `/api/availability/service/:serviceId/schedule` | Get schedule for service |
| PUT | `/api/availability/service/:serviceId/schedule` | Update schedule for service |
| POST | `/api/availability/service/:serviceId/copy-global` | Copy global to service |

### Frontend - New Files

| File | Description |
|-------|-------------|
| `frontend/src/services/serviceAvailabilityApi.ts` | API service for service availability |
| `frontend/src/components/booking/ServiceAvailabilityManager.tsx` | Component for editing service schedule |
| `frontend/src/pages/provider/ServiceAvailabilityPage.tsx` | Full page for managing availability |

### Provider Dashboard Navigation
- **Hours** → `/provider/availability` (global working hours)
- **Services** → `/provider/service-availability` (per-service availability)

---

## 8. View Pro Modal Redesign

### File: frontend/src/components/dashboard/ViewProModal.tsx

### Improvements
- Larger modal (max-w-4xl)
- Beautiful gradient header with purple-to-pink accent
- Search bar for filtering professionals
- Category filters (Hair, Nails, Skincare, Massage, Makeup)
- Enhanced professional cards with tier badges
- Larger avatars with glow effects
- Verified badge positioning
- Changed `Gem` icon to `UserCircle` for professional look

---

## 9. PDF Service Fixes

### File: backend/src/services/pdf.service.ts

Fixed TypeScript errors with nullish coalescing:
```typescript
const savingsPct = data.pricing.savingsPercentage ?? 0;
const savingsAmt = data.pricing.savings ?? 0;
```

---

## Database Migrations

### Scripts Created

| Script | Purpose |
|--------|---------|
| `backend/src/scripts/fix-provider-schedule.ts` | Fix large time slot blocks |
| `backend/src/scripts/setup-provider-availability.ts` | Set default working hours |

### Usage
```bash
cd backend
npx ts-node src/scripts/fix-provider-schedule.ts
```

---

## CLAUDE.md Updates

### New Sections Added
1. Collection Mismatch Bug - Bundle vs Service
2. Data Format Mismatch - Frontend ↔ Backend field differences
3. Route Order Issues - Express router matching
4. Provider Availability - Time slot structure
5. API Schema Mismatches - Request/response validation
6. Migration Template - MongoDB fixes
7. Quick Debug Commands - Direct DB queries

---

## Workflow Created

### workflows/booking-flow-audit.wf.ts

Comprehensive audit workflow with 8 phases:
- Discover, RouteAnalysis, APICheck, DataMapping
- DatabaseCheck, AvailabilityCheck, FixIssues, Report

---

## Testing Checklist

- [ ] Package detail page loads correctly
- [ ] "Book Now" button navigates to booking page
- [ ] "Book Entire Package" opens wizard
- [ ] Service names/prices display correctly
- [ ] Provider availability shows time slots
- [ ] Backend `/api/packages/:id/print` returns PDF
- [ ] Per-service availability page at `/provider/service-availability`
- [ ] Global schedule can be copied to service
- [ ] Provider dashboard shows both availability links

---

## Rollback Instructions

Revert and rebuild:
```bash
cd backend && npm run build
```

---

# Chat System Fixes & UI Improvements - June 6, 2026

## Summary

Comprehensive fixes for the chat messaging system, including API payload issues, floating chatbot widget implementation, and UI polish.

---

## 1. Chat System Fixes

### 1.1 NewMessagePage.tsx - Multiple Bug Fixes

**File:** `frontend/src/pages/customer/NewMessagePage.tsx`

#### Bug 1: sendMessage() received raw string instead of object
**Error:** `Unexpected token '"', ""Hi! I'm i"... is not valid JSON`

```typescript
// Before (broken)
await chatApi.sendMessage(roomId, message);

// After (fixed)
await chatApi.sendMessage(roomId, {
  receiverId: providerId!,
  content: message,
  type: 'text'
});
```

#### Bug 2: rooms.find is not a function
**Error:** `TypeError: rooms.find is not a function`

```typescript
// Before (broken)
const rooms = await chatApi.getChatRooms();
const existingRoom = rooms.find(...);

// After (fixed)
const response = await chatApi.getChatRooms();
const rooms = response.rooms || [];
const existingRoom = rooms.find(...);
```

#### Bug 3: Chat room not found (404)
**Error:** `Chat room not found`

```typescript
// Before (broken)
const roomId = existingRoomId || providerId;

// After (fixed)
let roomId = existingRoomId;
if (!roomId) {
  const { chatRoom } = await chatApi.getOrCreateDirectChat({
    participantId: providerId
  });
  roomId = chatRoom._id;
}
```

---

## 2. API Layer Fixes

### 2.1 Canceled Request Error Logging
**File:** `frontend/src/services/api.ts`

```typescript
// Added check to skip logging canceled requests
if (error.code === 'ERR_CANCELED' || error.message === 'canceled') {
  return Promise.reject(error);
}
```

---

## 3. Floating Chatbot Widget Implementation

### 3.1 New Component: FloatingChatWidget
**File:** `frontend/src/components/chat/FloatingChatWidget.tsx` (NEW)

**Features:**
- Shows floating button after 2-second delay
- Hidden on chat-related pages:
  - `/customer/messages`
  - `/customer/messages/new`
  - `/provider/messages`
  - `/admin/chatbot-builder`
- Only visible to authenticated users

### 3.2 App.tsx Integration
**File:** `frontend/src/App.tsx`

Added import and usage of FloatingChatWidget component.

---

## 4. AutoChatbot UI Improvements

### 4.1 Removed Minimize Functionality
**File:** `frontend/src/components/support/AutoChatbot.tsx`

- Removed `isMinimized` state entirely
- Changed header to have clear "End Chat" button with X icon and text label

### 4.2 Added Hover Tooltip to Floating Button
Added tooltip "Chat with Assistant" appears on hover

### 4.3 Fixed Scrollbar Styling
Added custom `scrollbar-chat` class for branded scrollbar

### 4.4 Added "Talk to a human" Banner
Added banner at top of chat window to connect with real providers

---

## 5. Custom CSS Scrollbar Utilities

**File:** `frontend/src/index.css`

Added custom scrollbar styles:
- `.scrollbar-thin` - Thin scrollbar
- `.scrollbar-hide` - Hide scrollbar
- `.scrollbar-nilin` - NILIN branded scrollbar
- `.scrollbar-chat` - Chat specific scrollbar

---

## 6. Backend TypeScript Compilation Fixes

### 6.1 Bundle Model Field Names
**File:** `backend/src/controllers/booking.controller.ts`

```typescript
// Before (error)
name: bundle.bundleName || bundle.name,
price: bundle.bundlePrice || bundle.basePrice || bundle.discountedPrice,

// After (fixed)
name: bundle.name,
price: bundle.bundlePrice,
```

### 6.2 Missing Return Statement
**File:** `backend/src/routes/offer.routes.ts`

```typescript
// Added missing return statement
if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
  res.status(400).json({ success: false, message: 'Invalid offer ID' });
  return;
}
```

### 6.3 Duplicate $push Property
**File:** `backend/src/services/dispute.service.ts`

```typescript
// Before (error - two $push properties)
{ $push: { evidence: {...} }, $push: { timeline: {...} } }

// After (fixed - merged)
{ $push: { evidence: {...}, timeline: {...} } }
```

---

## 7. Files Changed Summary

| File | Action | Changes |
|------|--------|---------|
| `frontend/src/pages/customer/NewMessagePage.tsx` | Modified | 3 bug fixes |
| `frontend/src/services/api.ts` | Modified | Skip ERR_CANCELED logging |
| `frontend/src/components/chat/FloatingChatWidget.tsx` | Created | New floating chatbot |
| `frontend/src/components/support/AutoChatbot.tsx` | Modified | UI improvements |
| `frontend/src/index.css` | Modified | Added scrollbar utilities |
| `frontend/src/App.tsx` | Modified | Added FloatingChatWidget |
| `backend/src/controllers/booking.controller.ts` | Modified | Fixed Bundle fields |
| `backend/src/routes/offer.routes.ts` | Modified | Added return statement |
| `backend/src/services/dispute.service.ts` | Modified | Merged $push |

---

## Testing Checklist

- [x] Message sending works (proper payload format)
- [x] Existing conversation check works (response.rooms)
- [x] New conversation creation works (getOrCreateDirectChat)
- [x] Floating chatbot appears on non-chat pages
- [x] Floating chatbot hidden on chat pages
- [x] End Chat button closes chat properly
- [x] Scrollbar styled correctly
- [x] Hover tooltip shows on floating button
- [x] "Talk to human" banner works
- [x] Backend TypeScript compiles without errors
- [x] Frontend TypeScript compiles without errors

---

*Generated: June 6, 2026*

---

# Page Audit & AI Chat Integration - June 6, 2026 (Session 5)

## Summary

Conducted page audits on the Package Detail page and Chatbot Builder page. Fixed duration calculation bug, integrated AI chat with IA Agents backend, and connected the frontend chatbot component to the backend.

**Screenshots Analyzed:**
1. **Package Detail Page** - Shows service packages with provider info, ratings, pricing, booking options
2. **Chatbot Builder Page** - Admin interface showing IA Agent management with status badges (Deployed, Testing, Draft, Suspended)

---

## 1. Package Detail Page Audit

### Page: `/packages/:id`

**Files Audited:**

| File | Purpose |
|------|---------|
| `frontend/src/pages/PackageDetailPage.tsx` | Main page component |
| `frontend/src/App.tsx:393-396` | Route definition |
| `backend/src/routes/packages.public.routes.ts` | API route handlers |
| `backend/src/controllers/customerDashboard.controller.ts` | getPackageById controller |
| `backend/src/services/customerDashboard.service.ts` | getPackageById service |
| `backend/src/controllers/wishlist.controller.ts` | Wishlist operations |

### Issues Found & Fixed

#### Issue: Duration Calculation (FIXED)

**File:** `backend/src/services/customerDashboard.service.ts:1560`

**Problem:** Total duration was hardcoded to 60 minutes per service instead of using actual duration values.

```typescript
// Before (INCORRECT)
const totalDuration = (bundle.services || []).reduce((sum: number, s: any) => sum + 60, 0);

// After (FIXED)
const totalDuration = (bundle.services || []).reduce((sum: number, s: any) => sum + (s.duration || 60), 0);
```

---

## 2. Chatbot Builder Page Audit

### Page: `/admin/chatbot-builder`

### Issues Found

#### Issue 1: Duplicate Agent Routes (FIXED)

**Problem:** Agent CRUD routes were defined in BOTH `iaAgent.routes.ts` AND `ai.routes.ts`

| File | Routes | Status |
|------|--------|--------|
| `backend/src/routes/iaAgent.routes.ts` | `/api/ia-agents/*` | Primary (admin CRUD) |
| `backend/src/routes/ai.routes.ts` | Had duplicates | Removed |

---

#### Issue 2: Mock AI Chat (FIXED)

**Problem:** AI chat used hardcoded responses, disconnected from IA Agents.

**Fix:** Updated `ai.controller.ts` to use agent's `instructions` and `knowledgeBase`

---

#### Issue 3: Frontend Not Connected to Backend (FIXED)

**Problem:** `AutoChatbot.tsx` used frontend-side intent analysis with hardcoded responses.

**Fix:** Created `aiChatApi.ts` service and connected to backend.

---

## 3. Files Created

| File | Description |
|------|-------------|
| `frontend/src/services/aiChatApi.ts` | New AI chat API service |

---

## 4. Files Modified

### Backend

| File | Changes |
|------|---------|
| `backend/src/controllers/ai.controller.ts` | AI chat logic with IA Agent integration |
| `backend/src/routes/ai.routes.ts` | Removed duplicates, added available agents endpoint |

### Frontend

| File | Changes |
|------|---------|
| `frontend/src/components/support/AutoChatbot.tsx` | Connected to backend AI API |

---

## 5. API Endpoints

| Endpoint | Method | Status |
|----------|--------|--------|
| `/api/ai/chat` | POST | ✅ Connected |
| `/api/ai/conversations` | GET | ✅ Connected |
| `/api/ai/agents/available` | GET | ✅ NEW |
| `/api/ia-agents/*` | * | ✅ Already worked |

---

## 6. Data Flow

### Before (Disconnected)
```
User Message → AutoChatbot → analyzeIntent() → hardcoded response
```

### After (Connected)
```
User Message → AutoChatbot → aiChatApi.sendMessage() → /api/ai/chat
                                                        ↓
                                                   findBestAgent()
                                                        ↓
                                                   generateAIResponse()
                                                   (uses agent.instructions + knowledgeBase)
```

---

## 7. Summary Statistics

| Metric | Value |
|--------|-------|
| Pages Audited | 2 |
| Backend Files Modified | 2 |
| Frontend Files Created | 1 |
| Frontend Files Modified | 1 |
| TypeScript Errors | 0 |
| Critical Issues Fixed | 3 |
| High Priority Issues Fixed | 2 |

---

## 8. Files Summary

### Created
- `frontend/src/services/aiChatApi.ts`

### Modified Backend
- `backend/src/controllers/ai.controller.ts`
- `backend/src/routes/ai.routes.ts`

### Modified Frontend
- `frontend/src/components/support/AutoChatbot.tsx`

---

## 9. Testing Checklist

- [x] AI chat sends messages to backend
- [x] Responses use agent's instructions
- [x] Knowledge base is searched for relevant info
- [x] Fallback to local responses on API failure
- [x] Conversation continuity
- [x] TypeScript compiles (frontend)
- [x] TypeScript compiles (backend)
- [x] Duplicate routes removed
- [x] New `/agents/available` endpoint works

---

*Generated: June 6, 2026 (Session 5)*
