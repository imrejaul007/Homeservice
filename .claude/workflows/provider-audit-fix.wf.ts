/**
 * Provider Dashboard Audit & Fix Workflow
 *
 * Based on the comprehensive audit report, this workflow:
 * 1. Verifies the issues found
 * 2. Creates fixes for each issue
 * 3. Tests the fixes
 * 4. Documents the changes
 */

export const meta = {
  name: 'provider-audit-fix',
  description: 'Fix provider dashboard issues identified in the audit - data flow breaks, missing features, and code quality',
  phases: [
    'Verify Issues',
    'Fix OperationsDashboard Stats',
    'Fix ServiceManagement Errors',
    'Add Admin Portfolio Endpoint',
    'Add Admin Contracts Endpoint',
    'Add Audit Logging',
    'Verify Fixes',
    'Generate Fix Report'
  ],
};

/**
 * ============================================================
 * PHASE 1: Verify Issues Found in Audit
 * ============================================================
 */
phase('Verify Issues');

const verificationResults = await agent(`
Verify the issues identified in the audit report.

ISSUE 1: OperationsDashboard stats mapping
Read: frontend/src/pages/provider/OperationsDashboard.tsx
Check lines 40-54 where stats are mapped
Verify: totalEarnings, pendingPayout, responseRate, acceptanceRate are all set to 0

ISSUE 2: Undefined error variable
Read: frontend/src/components/provider/ServiceManagement.tsx
Search for "error" usage at line 1430
Check if error variable is defined in scope

ISSUE 3: Missing admin portfolio endpoint
Read: backend/src/routes/providerOps.routes.ts
Search for "portfolio" endpoint
Verify: No /portfolio route exists

ISSUE 4: Missing admin contracts endpoint
Read: backend/src/routes/providerOps.routes.ts
Search for "managed-contract" endpoint
Verify: No managed-contract route exists

Return verification results with:
- Each issue confirmed or not
- Line numbers where issues exist
- Current code snippets
`);

/**
 * ============================================================
 * PHASE 2: Fix OperationsDashboard Stats Mapping
 * ============================================================
 */
phase('Fix OperationsDashboard Stats');

log('Fixing OperationsDashboard stats mapping...');

const operationsDashboardFix = await agent(`
Fix the OperationsDashboard stats mapping issue.

FILE: frontend/src/pages/provider/OperationsDashboard.tsx

CURRENT PROBLEM (lines 40-54):
- totalEarnings is hardcoded to 0
- pendingPayout is hardcoded to 0
- responseRate is hardcoded to 0
- acceptanceRate is hardcoded to 0

THE FIX:
1. First, READ the backend endpoint to understand what data it returns
   Read: backend/src/controllers/providerOps.controller.ts (getDashboardStats function)
   Or grep: grep -n "getDashboardStats" backend/src/controllers/providerOps.controller.ts

2. If the backend returns this data, map it correctly
3. If the backend doesn't return this data, either:
   a) Add it to the backend (preferred)
   b) Show "Data unavailable" placeholder

Show the current code and proposed fix before implementing.
`);

/**
 * ============================================================
 * PHASE 3: Fix ServiceManagement Errors
 * ============================================================
 */
phase('Fix ServiceManagement Errors');

log('Fixing ServiceManagement error handling...');

const serviceManagementFix = await agent(`
Fix issues in ServiceManagement.tsx

ISSUE: Line 1430 uses 'error' variable that's not defined

1. READ the file around line 1430
   page.goto('file://' + __dirname + '/index.html');
   await page.waitForLoadState('networkidle');

2. Find where 'error' variable is used in the aria-live region

3. FIX OPTIONS:
   a) Remove the {error} reference if it's not needed
   b) Define 'error' state variable
   c) Use a different variable name

Also check for other potential runtime errors:
- Missing state initializations
- Undefined variable references
- Missing null checks

Return the fix with before/after code comparison.
`);

/**
 * ============================================================
 * PHASE 4: Add Admin Portfolio Endpoint
 * ============================================================
 */
phase('Add Admin Portfolio Endpoint');

log('Adding admin endpoint for viewing provider portfolios...');

const adminPortfolioEndpoint = await agent(`
Add admin endpoint to view any provider's portfolio.

FILE: backend/src/routes/providerOps.routes.ts

1. First, read the current file to understand the structure

2. Add these routes:
   GET /provider/ops/providers/:providerId/portfolio
   - Returns all portfolio items for a specific provider
   - Admin only

3. Also need to update the controller:
   FILE: backend/src/controllers/providerOps.controller.ts

   Add function: getProviderPortfolio
   - Query ProviderProfile model for portfolio items
   - Filter by userId matching providerId
   - Return portfolio array

4. Check if ProviderProfile model has portfolio field:
   grep -n "portfolio" backend/src/models/providerProfile.model.ts

5. Implement the endpoint and controller function

Return the new code with explanation.
`);

/**
 * ============================================================
 * PHASE 5: Add Admin Contracts Endpoint
 * ============================================================
 */
phase('Add Admin Contracts Endpoint');

log('Adding admin endpoint for viewing provider contracts...');

const adminContractsEndpoint = await agent(`
Add admin endpoint to view any provider's managed contracts.

FILE: backend/src/routes/providerOps.routes.ts

1. First, check if ManagedContract model exists:
   find backend/src -name "*managedContract*" -o -name "*managed*contract*"

2. If model exists, add:
   GET /provider/ops/providers/:providerId/contracts
   - Returns all managed contracts for a provider
   - Admin only

3. If model doesn't exist, create:
   backend/src/models/managedContract.model.ts (if needed)

4. Add controller function: getProviderContracts
   - Query ManagedContract by providerId
   - Return contracts array with metrics

Return the implementation details.
`);

/**
 * ============================================================
 * PHASE 6: Add Audit Logging
 * ============================================================
 */
phase('Add Audit Logging');

log('Adding audit logging for sensitive provider operations...');

const auditLogging = await agent(`
Add audit logging for provider operations that need tracking.

1. Check existing audit service:
   ls backend/src/services/*audit*.ts
   Read: backend/src/services/activityAuditLog.service.ts

2. Add audit log entries for:
   - Service cloning (when a service is cloned)
   - Bulk operations (activate/deactivate/delete)
   - Contract changes (create/update/terminate)
   - Profile visibility toggles

3. In provider.controller.ts, find cloneService function:
   grep -n "cloneService" backend/src/controllers/provider.controller.ts

4. Add audit log call:
   await activityAuditLogService.log({
     action: 'SERVICE_CLONED',
     providerId: req.user._id,
     resourceId: newService._id,
     metadata: { originalServiceId: serviceId }
   });

5. Also add to bulk operations in provider.controller.ts

Return the audit logging code to add.
`);

/**
 * ============================================================
 * PHASE 7: Verify Fixes
 * ============================================================
 */
phase('Verify Fixes');

log('Verifying all fixes work correctly...');

const verification = await agent(`
Verify the fixes by running TypeScript compilation and checking for errors.

1. RUN TYPESCRIPT COMPILATION:
   cd backend && npx tsc --noEmit 2>&1 | head -50

2. FRONTEND TYPESCRIPT:
   cd frontend && npx tsc --noEmit 2>&1 | head -50

3. CHECK FOR RUNTIME ERRORS:
   - Review the fixed OperationsDashboard
   - Review the fixed ServiceManagement

4. TEST THE NEW ENDPOINTS (if possible):
   - GET /api/provider/ops/providers/:id/portfolio
   - GET /api/provider/ops/providers/:id/contracts

Return verification results.
`);

/**
 * ============================================================
 * PHASE 8: Generate Fix Report
 * ============================================================
 */
phase('Generate Fix Report');

const fixReport = `
# Provider Dashboard Audit - Fix Report

**Date:** 2026-06-18
**Status:** ${verificationResults.issuesConfirmed > 0 ? 'ISSUES FOUND & FIXED' : 'NO ISSUES FOUND'}

## Issues Verified

| Issue | Status | Fix Applied |
|-------|--------|-------------|
| OperationsDashboard stats = 0 | ${operationsDashboardFix.fixed ? '✅ FIXED' : '⏳ PENDING'} | Stats mapped correctly |
| ServiceManagement error undefined | ${serviceManagementFix.fixed ? '✅ FIXED' : '⏳ PENDING'} | Variable defined or removed |
| Admin portfolio endpoint missing | ${adminPortfolioEndpoint.added ? '✅ ADDED' : '⏳ PENDING'} | New GET endpoint |
| Admin contracts endpoint missing | ${adminContractsEndpoint.added ? '✅ ADDED' : '⏳ PENDING'} | New GET endpoint |
| Audit logging for clones | ${auditLogging.added ? '✅ ADDED' : '⏳ PENDING'} | Audit entries added |

## Changes Made

### Files Modified:
${operationsDashboardFix.filesModified || 'None'}
${serviceManagementFix.filesModified || ''}
${adminPortfolioEndpoint.filesModified || ''}
${adminContractsEndpoint.filesModified || ''}
${auditLogging.filesModified || ''}

### New Files Created:
${adminPortfolioEndpoint.newFiles || 'None'}
${adminContractsEndpoint.newFiles || ''}

## Verification Results

TypeScript Compilation: ${verification.compilationSuccess ? '✅ PASSED' : '❌ FAILED'}
${verification.errors?.length > 0 ? 'Errors: ' + verification.errors.join(', ') : ''}

## Next Steps

### Immediate (Do Now):
1. Test the new admin portfolio endpoint
2. Test the new admin contracts endpoint
3. Verify OperationsDashboard displays correct stats

### Short Term (This Week):
1. Add frontend admin pages to view portfolio/contracts
2. Add notifications when providers clone services
3. Implement contract expiration alerts

### Long Term (This Month):
1. Full admin provider management dashboard
2. Real-time audit log viewer
3. Automated anomaly detection for provider behavior

---

*Report generated from audit workflow*
`;

log(fixReport);

return {
  verification: verificationResults,
  operationsDashboardFix: operationsDashboardFix,
  serviceManagementFix: serviceManagementFix,
  adminPortfolioEndpoint: adminPortfolioEndpoint,
  adminContractsEndpoint: adminContractsEndpoint,
  auditLogging: auditLogging,
  finalReport: fixReport
};
