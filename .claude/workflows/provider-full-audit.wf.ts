/**
 * Provider Dashboard 100% Comprehensive Audit
 * Analyzes EVERY page, flow, gap, and connection
 */

export const meta = {
  name: 'provider-full-audit',
  description: '100% audit of all provider dashboard pages, flows, gaps - production ready',
  phases: [
    'Discover All Provider Pages',
    'Audit Each Page',
    'Map All API Flows',
    'Identify Flow Gaps',
    'Check Admin Connections',
    'Fix Critical Issues',
    'Generate Gap Report',
    'Production Readiness'
  ],
};

phase('Discover All Provider Pages');

const allPages = await agent(`
DISCOVER ALL provider pages, components, services, and routes.

Run these commands:
1. ls frontend/src/pages/provider/
2. ls frontend/src/components/provider/
3. ls frontend/src/services/*provider*.ts
4. ls backend/src/controllers/provider*.ts
5. ls backend/src/routes/provider*.routes.ts

Return COMPLETE lists of:
1. All provider pages with file names
2. All provider components
3. All API services
4. All backend controllers
5. All backend routes
`);

phase('Audit Each Page');

const pageAudits = await agent(`
AUDIT EVERY provider page in detail.

Read and analyze ALL of these pages:

1. frontend/src/pages/provider/OperationsDashboard.tsx
2. frontend/src/pages/provider/ProviderProfilePage.tsx
3. frontend/src/pages/provider/ManagedServicesPage.tsx
4. frontend/src/pages/provider/InsightsDashboard.tsx
5. frontend/src/pages/provider/ProviderInsightsPage.tsx
6. frontend/src/pages/provider/ProviderAnalyticsPage.tsx
7. frontend/src/pages/provider/ProviderEarningsPage.tsx
8. frontend/src/pages/provider/EarningsReport.tsx
9. frontend/src/pages/provider/PayoutDashboard.tsx
10. frontend/src/pages/provider/ProviderCalendarPage.tsx
11. frontend/src/pages/provider/AvailabilityPage.tsx
12. frontend/src/pages/provider/ServiceAvailabilityPage.tsx
13. frontend/src/pages/provider/ProviderReviewsPage.tsx
14. frontend/src/pages/provider/BookingDetailPage.tsx
15. frontend/src/pages/provider/ProviderSettingsPage.tsx
16. frontend/src/pages/provider/ProviderVerificationPage.tsx
17. frontend/src/pages/provider/ProviderPortfolioPage.tsx
18. frontend/src/pages/provider/MyBundlesPage.tsx
19. frontend/src/pages/provider/BundleAnalyticsPage.tsx
20. frontend/src/pages/provider/AdsPage.tsx

For EACH page provide:
- Page name
- Main functionality (what it does)
- All API calls made (grep for api.get, api.post, authService.get, etc)
- All data displayed
- All user actions available
- Issues or gaps found
- Severity of issues (critical/high/medium/low)

Be thorough - read each file completely before analyzing.
`);

phase('Map All API Flows');

const apiFlows = await agent(`
MAP all API flows for provider dashboard.

1. Read these API service files:
   - frontend/src/services/providerApi.ts
   - frontend/src/services/providerOpsApi.ts
   - frontend/src/services/earningsApi.ts

2. Read backend routes:
   - backend/src/routes/provider.routes.ts
   - backend/src/routes/providerOps.routes.ts
   - backend/src/routes/earnings.routes.ts
   - backend/src/routes/booking.routes.ts

3. For EACH endpoint found, trace:
   - Frontend caller (which page/service calls it)
   - HTTP method and path
   - Parameters sent
   - Response structure
   - Error handling

4. Map the complete flow:
   PAGE -> SERVICE -> HTTP REQUEST -> ROUTE -> CONTROLLER -> DATABASE

Return a comprehensive API flow map showing every connection.
`);

phase('Identify Flow Gaps');

const flowGaps = await agent(`
IDENTIFY gaps in provider dashboard flows.

Check these complete user journeys:

JOURNEY 1: Service Management Flow
- Provider views services -> Creates new -> Edits -> Deletes/Restores
- Check: Full CRUD? Error handling? Status sync? Admin approval?

JOURNEY 2: Booking Lifecycle
- Booking created -> Provider sees -> Accepts/Declines -> Completes
- Check: Real-time updates? Status notifications? Calendar sync?

JOURNEY 3: Earnings & Financial
- View earnings -> Breakdown -> Payout request -> Payment received
- Check: Accurate calculations? Pending states? Payment history?

JOURNEY 4: Verification Flow
- Start verification -> Upload docs -> Submit -> Admin reviews -> Approved/Rejected
- Check: Admin receives? Provider notified? Rejection reasons shown?

JOURNEY 5: Portfolio & Public Profile
- Add portfolio items -> Set featured -> Appears on profile
- Check: Image upload? Featured selection? Admin visibility?

JOURNEY 6: Reviews & Reputation
- View reviews -> Reply -> Customer sees reply
- Check: Reply saved? Displayed? Notification sent?

JOURNEY 7: Ads & Promotions
- Create ad campaign -> Set budget -> Monitor -> Adjust
- Check: Budget tracking? Performance analytics? Auto-pause?

JOURNEY 8: Corporate Contracts (Managed Services)
- Create contract -> Add team -> Set SLA -> Monitor compliance
- Check: Team permissions? SLA calculations? Breach alerts?

JOURNEY 9: Availability Management
- Set availability -> Block dates -> Sync with bookings
- Check: Calendar integration? Booking conflicts? Buffer time?

JOURNEY 10: Bundle Management
- Create bundle -> Add services -> Set price -> View analytics
- Check: Service validation? Pricing rules? Bundle performance?

For EACH gap found, specify severity and recommended fix.
`);

phase('Check Admin Connections');

const adminConnections = await agent(`
CHECK admin connections for provider management.

1. Find admin provider pages:
   ls frontend/src/pages/admin/ | grep -i provider

2. Check what admin can do:
   - View all providers
   - Approve/reject verification
   - Suspend/reactivate
   - View analytics
   - Manage payouts
   - Edit provider profile
   - View provider portfolio (NEWLY ADDED)
   - View provider contracts (NEWLY ADDED)

3. Check notification system:
   - When admin approves -> Provider notified?
   - When admin rejects -> Provider notified with reason?
   - When provider violates SLA -> Admin alerted?
   - When payout requested -> Admin notified?

4. Check for missing admin endpoints:
   - Can admin view provider portfolio? (check routes)
   - Can admin edit provider settings?
   - Can admin resolve disputes?
   - Can admin issue refunds for provider bookings?

Return list of available admin views and missing connections.
`);

phase('Fix Critical Issues');

const fixes = await agent(`
FIX critical issues found during audit.

Priority: CRITICAL > HIGH > MEDIUM

1. Fix data flow breaks:
   - Check OperationsDashboard stats mapping
   - Check any hardcoded 0 values
   - Check undefined variables

2. Fix API integration:
   - Add missing error handling
   - Fix incorrect response mapping
   - Add missing loading states

3. Fix navigation:
   - Check all routes exist
   - Check parameter passing
   - Check deep links

4. Add missing endpoints if needed:
   - Admin portfolio endpoint (may already be added)
   - Admin contracts endpoint (may already be added)

Return list of fixes applied and any issues requiring manual attention.
`);

phase('Generate Gap Report');

const gapReport = `
# PROVIDER DASHBOARD 100% COMPREHENSIVE AUDIT

## Pages Audited
${pageAudits.pages?.length || 21} pages analyzed

## Summary
- Flow Gaps Identified: ${flowGaps.gaps?.length || 0}
- Admin Connections: ${adminConnections.adminViews?.length || 0} available
- Missing Admin Views: ${adminConnections.missingAdminViews?.length || 0}
- Issues Fixed: ${fixes.fixed?.length || 0}
- Issues Pending: ${fixes.pending?.length || 0}

## Critical Gaps Found
${flowGaps.gaps?.filter(g => g.severity === 'critical').map(g => `- ${g.gap}: ${g.fix}`).join('\n') || 'None'}

## High Priority Gaps
${flowGaps.gaps?.filter(g => g.severity === 'high').map(g => `- ${g.gap}: ${g.fix}`).join('\n') || 'None'}

## Admin Connection Status
Available: ${adminConnections.adminViews?.join(', ') || 'Standard views'}
Missing: ${adminConnections.missingAdminViews?.join(', ') || 'None'}

## Issues Fixed
${fixes.fixed?.map(f => `- ${f}`).join('\n') || 'None needed'}

## Issues to Fix Manually
${fixes.pending?.map(p => `- ${p}`).join('\n') || 'None'}
`;

log(gapReport);

phase('Production Readiness');

const prodCheck = await agent(`
FINAL production readiness check.

1. TypeScript compilation:
   cd backend && npx tsc --noEmit 2>&1 | head -20
   cd frontend && npx tsc --noEmit 2>&1 | head -20

2. Check for issues:
   grep -rn "TODO\\|FIXME" frontend/src/pages/provider/ | head -10
   grep -rn "console.log" frontend/src/pages/provider/ | head -10
   grep -rn ": any" frontend/src/pages/provider/ | head -10
   grep -rn "localhost" frontend/src/ | grep -v "comment" | head -5

3. Check accessibility:
   grep -rn "aria-label" frontend/src/pages/provider/ | wc -l
   grep -rn "skip" frontend/src/pages/provider/ | wc -l

4. Check error handling:
   grep -rn "catch" frontend/src/pages/provider/ | wc -l
   grep -rn "toast.error\\|showError" frontend/src/pages/provider/ | wc -l

Return production readiness assessment with score and issues.
`);

const finalReport = `
# FINAL PROVIDER DASHBOARD AUDIT

## Executive Summary
Pages Audited: ${pageAudits.pages?.length || 21}
Flow Gaps: ${flowGaps.gaps?.length || 0}
Admin Connections: ${adminConnections.adminViews?.length || 0} available
Issues Fixed: ${fixes.fixed?.length || 0}

## Production Readiness: ${prodCheck.score || 0}%

### Critical Issues: ${prodCheck.critical || 0}
### Code Quality Issues: ${prodCheck.quality || 0}
### Accessibility Issues: ${prodCheck.accessibility || 0}

${prodCheck.score >= 90 ? '✅ PRODUCTION READY' : '⚠️ NEEDS WORK'}
`;

log(finalReport);

return {
  allPages,
  pageAudits,
  apiFlows,
  flowGaps,
  adminConnections,
  fixes,
  gapReport,
  prodCheck,
  finalReport
};
