# Page Audit & Auto-Fix Skill

## Usage

```
/page-audit [page-path]
```

Examples:
```
/page-audit /packages/6a2292c96511012b7d4e637b
/page-audit /book-package/6a2292c96511012b7d4e637b
/page-audit /admin/providers
```

## Description

Comprehensive audit of any page including:
- Frontend components and routes
- Backend API endpoints, controllers, services
- Database models and data flow
- All user interactions (buttons, links, forms)

**Automatically fixes ALL issues found** (critical, high, medium, low priority)

## What Gets Audited

### 1. Discovery Phase
- Page component file
- All child components
- All API calls
- All button handlers
- All routes in App.tsx

### 2. Analysis Phase  
- Backend endpoints called
- Route definitions
- Controller functions
- Service layer
- Database models

### 3. Testing Phase
- Every button/action tested
- Navigation verified
- API calls traced
- Data flow checked

### 4. Fix Phase (Parallel)
- **Critical**: 404 errors, missing routes, auth issues
- **High**: Broken buttons, missing endpoints
- **Medium**: Type mismatches, error handling
- **Low**: UI inconsistencies

### 5. Verification
- TypeScript compilation check
- All routes verified
- All endpoints respond

## Common Fixes Applied

1. **Route fixes** - Add missing routes, fix paths
2. **Data model fixes** - Bundle vs Service collection
3. **API fixes** - Controllers querying wrong collection
4. **Component fixes** - Imports, exports, types
5. **Button fixes** - Link to correct routes/endpoints

## Example Report

```
=== PAGE AUDIT ===
Page: /packages/6a2292c96511012b7d4e637b

=== FOUND FILES ===
frontend/src/pages/PackageDetailPage.tsx
frontend/src/components/booking/PackageBookingWizard.tsx
backend/src/controllers/customerDashboard.controller.ts

=== ROUTES ===
✅ GET /api/packages/:id
✅ POST /api/packages/:id/book
✅ POST /api/packages/:id/toggle-wishlist

=== ISSUES ===
⚠️ wishlist queries Service instead of Bundle
⚠️ Contact Provider → wrong route

=== FIXES APPLIED ===
1. wishlist.controller.ts - Added Bundle support
2. App.tsx - Added /customer/messages/new route
3. PackageDetailPage.tsx - Fixed navigation

=== VERIFICATION ===
✅ TypeScript compiles
✅ All routes work
```
