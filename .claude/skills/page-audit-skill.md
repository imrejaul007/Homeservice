# Page Audit & Auto-Fix Skill

## Description

Comprehensive audit of any page including frontend code, backend API, cross-page connections, and **automatic fix implementation for ALL issues** (critical, high, medium, and low priority).

**No need to prompt "fix all the things" - it fixes everything automatically!**

## Usage

```
/page-audit [page-url-or-path]
```

Examples:
```
/page-audit /packages/6a2292c96511012b7d4e637b
/page-audit /book-package/6a2292c96511012b7d4e637b
/page-audit /admin/providers
/page-audit /customer/dashboard
```

## What This Skill Does

### Phase 1: Discovery & Analysis (Parallel Agents)

Launches 4 parallel agents to comprehensively analyze:

1. **Frontend Agent** - Page component, routes, API calls, state management, click handlers
2. **Backend Agent** - Controllers, routes, services, validation, database models
3. **Connection Agent** - Socket events, auth middleware, data flow
4. **Data Integrity Agent** - Type mismatches, enum inconsistencies, field mappings

### Phase 2: Interaction Testing (Parallel Agents)

For each user action (button, link, form):

1. Identify the action handler
2. Trace what should happen (API → Route → State)
3. Verify the chain is complete

**Common actions tested:**
- "Book Now" / "Book Package" buttons
- "Contact Provider" / "Message" buttons  
- "Add to Compare" / "Compare" buttons
- "Share" / "Print" / "Download" buttons
- "Wishlist" / "Heart" buttons
- Navigation links
- Form submissions

### Phase 3: Auto-Fix ALL Issues (Parallel by Priority)

**Critical Issues** → Fixed first with dedicated agents
**High Priority Issues** → Fixed with dedicated agents
**Medium Priority Issues** → Fixed with dedicated agents
**Low Priority Issues** → Fixed with dedicated agents

All fixes run in parallel, grouped by file for efficiency.

### Fix Categories

- Route mismatches (frontend ↔ backend)
- Missing validation (Joi, ObjectId)
- Security issues (IDOR, injection, auth)
- Performance issues (N+1 queries, pagination)
- Error handling (try-catch, fallbacks)
- Accessibility (ARIA, keyboard nav)
- Missing indexes (MongoDB)
- Socket events (real-time updates)
- Enum inconsistencies
- Database model mismatches (Service vs Bundle)

### Common Fixes Applied

1. **Route fixes** - Add missing routes, fix redirect paths
2. **Data model fixes** - Query correct collection (Bundle vs Service)
3. **API endpoint fixes** - Add missing endpoints, fix controllers
4. **Component fixes** - Add missing components, fix imports
5. **Type fixes** - Align frontend types with backend responses

## Output

1. **Discovery Report** - All components, routes, API calls found
2. **Analysis Report** - Data flow, models, endpoint verification
3. **Fix Report** - All issues found with severity levels
4. **Fixed Files** - All issues automatically fixed
5. **Verification** - TypeScript compilation verified

## Example Output

```
=== PAGE AUDIT REPORT ===
Page: /packages/6a2292c96511012b7d4e637b

=== ROUTES ===
✅ GET /api/packages/:id → customerDashboardController.getPackageById
✅ POST /api/packages/:id/book → customerDashboardController.createBookingFromPackage

=== USER ACTIONS ===
✅ "Book Now" → /book-package/:id (Route exists)
✅ "Contact Provider" → /customer/messages/new (Fixed)
✅ "Wishlist" → /api/wishlist/:id/toggle (Fixed - now supports Bundles)

=== ISSUES FOUND ===
⚠️ FIXED: wishlist controller only checked Service collection
⚠️ FIXED: getPackageById queried Service instead of Bundle
⚠️ FIXED: Contact Provider navigated to wrong route

=== FIXES APPLIED ===
1. wishlist.controller.ts - Added Bundle model support
2. customerDashboard.service.ts - Changed to query Bundle
3. App.tsx - Added /customer/messages/new route
4. NewMessagePage.tsx - Created

=== VERIFICATION ===
✅ TypeScript compiles successfully
✅ All routes registered
✅ All endpoints respond
```

## Requirements

- Node.js project with TypeScript
- Frontend in `frontend/src/`
- Backend in `backend/src/`
- MongoDB connection for data model checking

## Notes

- Skips files in `.claude/worktrees/` unless explicitly needed
- **Fixes ALL severity levels automatically** (critical, high, medium, low)
- Prioritizes production-readiness (handles scale, error cases)
- Preserves existing code (minimize changes)
- TypeScript compilation verified after each fix
- Uses parallel agents for maximum efficiency
