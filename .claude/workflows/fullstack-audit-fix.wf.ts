/**
 * Full-Stack Flow Audit & Fix Workflow
 *
 * Combines TDD methodology + Playwright webapp-testing to:
 * 1. Audit frontend→backend API flows
 * 2. Create comprehensive test plan
 * 3. Write integration tests
 * 4. Verify functionality end-to-end
 * 5. Fix issues found
 */

export const meta = {
  name: 'fullstack-audit-fix',
  description: 'Audit frontend-to-backend flows, create test plan, write Playwright tests, verify functionality, and fix issues',
  phases: [
    'Discover API Endpoints',
    'Audit Frontend API Integration',
    'Trace Data Flows',
    'Create Test Plan',
    'Write Playwright Tests',
    'Run Tests & Capture Results',
    'Fix Issues',
    'Verify Fixes'
  ],
};

/**
 * ============================================================
 * PHASE 1: Discover all API endpoints in backend
 * ============================================================
 */
phase('Discover API Endpoints');

const backendRoutes = await agent(`
Discover all API routes/endpoints in the backend.

1. List all route files:
   ls backend/src/routes/*.routes.ts
   ls backend/src/routes/**/*.routes.ts

2. For each route file, extract:
   - Route path (e.g., /api/provider/services)
   - HTTP methods (GET, POST, PUT, DELETE, PATCH)
   - Controller function name
   - What parameters it accepts

3. Find the controller implementations:
   grep -rn "export.*async function" backend/src/controllers/*.ts
   grep -rn "export.*const.*=.*async" backend/src/controllers/*.ts

4. Map routes to their controllers by reading:
   - backend/src/routes/provider.routes.ts
   - backend/src/routes/customer.routes.ts
   - backend/src/routes/booking.routes.ts
   - backend/src/routes/service.routes.ts
   - backend/src/routes/auth.routes.ts
   And any other major route files

5. For each endpoint, identify:
   - Request body schema (what fields)
   - Response schema (what returns)
   - Authentication required?
   - Validation middleware used?

Return a comprehensive API inventory with:
- Endpoint path
- HTTP method
- Handler/controller
- Request params/body
- Response format
- Auth requirement
`, {schema: {
  type: 'object',
  properties: {
    endpoints: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          method: { type: 'string' },
          handler: { type: 'string' },
          requestBody: { type: 'array', items: { type: 'string' } },
          responseFormat: { type: 'string' },
          authRequired: { type: 'boolean' },
          description: { type: 'string' }
        }
      }
    }
  }
}});

/**
 * ============================================================
 * PHASE 2: Audit Frontend API Integration
 * ============================================================
 */
phase('Audit Frontend API Integration');

const frontendApiAudit = await agent(`
Audit how frontend calls these backend APIs.

1. Find all API service files:
   ls frontend/src/services/*.ts
   ls frontend/src/services/api/*.ts
   ls frontend/src/lib/api/*.ts

2. Read each API service file and identify:
   - Which backend endpoints are called
   - What request body/params are sent
   - What response is expected
   - Error handling (try/catch, .catch)
   - Loading states
   - Authentication (tokens, headers)

3. Check for mismatches:
   - Frontend sends fields backend doesn't expect
   - Frontend expects fields backend doesn't send
   - Missing error handling
   - Missing loading states
   - Wrong HTTP method used
   - Wrong URL path

4. Check auth integration:
   - Where is auth token stored?
   - How is it attached to requests?
   - Is token refresh handled?
   - Are protected routes properly guarded?

5. Look for common issues:
   grep -rn "\\.catch(() => {})" frontend/src/
   grep -rn "noerror" frontend/src/
   grep -rn "catch.*err.*console" frontend/src/

Return API integration audit with:
- Endpoints properly integrated
- Endpoints with issues
- Data shape mismatches
- Error handling gaps
`, {schema: {
  type: 'object',
  properties: {
    properIntegrations: { type: 'array', items: { type: 'string' } },
    endpointIssues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          frontend: { type: 'string' },
          backend: { type: 'string' },
          issue: { type: 'string' },
          severity: { type: 'string' }
        }
      }
    },
    dataShapeMismatches: { type: 'array', items: { type: 'string' } },
    errorHandlingGaps: { type: 'array', items: { type: 'string' } }
  }
}});

/**
 * ============================================================
 * PHASE 3: Trace Data Flows
 * ============================================================
 */
phase('Trace Data Flows');

const dataFlowAnalysis = await agent(`
Trace complete data flows from UI → API → Backend → Database → Back.

Focus on these critical user journeys:

JOURNEY 1: Service Discovery & Booking
- frontend/src/pages/SearchPage.tsx or Search*.tsx
- frontend/src/pages/ServiceDetailPage.tsx or ServiceDetail*.tsx
- frontend/src/pages/booking/ProviderAvailabilityPage.tsx
- frontend/src/components/booking/*.tsx
- API: frontend/src/services/booking.service.ts
- Backend: backend/src/controllers/booking.controller.ts

JOURNEY 2: Provider Service Management
- frontend/src/components/provider/ServiceManagement.tsx
- frontend/src/components/provider/AddServiceModal.tsx
- frontend/src/components/provider/EditServiceModal.tsx
- API: frontend/src/services/provider.service.ts
- Backend: backend/src/controllers/provider.controller.ts

JOURNEY 3: User Authentication
- frontend/src/pages/auth/*.tsx
- frontend/src/components/auth/*.tsx
- API: frontend/src/services/auth.service.ts
- Backend: backend/src/controllers/auth.controller.ts

JOURNEY 4: Customer Profile & Wallet
- frontend/src/pages/customer/*.tsx
- API: frontend/src/services/customer.service.ts
- API: frontend/src/services/wallet.service.ts
- Backend: backend/src/controllers/customer.controller.ts
- Backend: backend/src/controllers/wallet.controller.ts

For EACH journey, trace:
1. What user action triggers the flow?
2. What data is collected in the UI?
3. How is data sent to API (shape, validation)?
4. Backend controller receives → validates → processes
5. Database operations performed
6. What response is sent back
7. How frontend handles response
8. How UI updates to reflect change

Look for breaks in the chain:
- Data lost between UI and API
- Data transformed incorrectly
- Missing validations
- Response not handled
- UI not updating after response

Return data flow analysis with breaks identified.
`, {schema: {
  type: 'object',
  properties: {
    journeyAnalysis: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          journey: { type: 'string' },
          steps: { type: 'array', items: { type: 'string' } },
          breaks: { type: 'array', items: { type: 'string' } },
          severity: { type: 'string' }
        }
      }
    }
  }
}});

/**
 * ============================================================
 * PHASE 4: Create Test Plan (TDD Approach)
 * ============================================================
 */
phase('Create Test Plan');

const testPlan = await agent(`
Create a comprehensive test plan based on findings from phases 1-3.

Use TDD principles:
- Tests should verify BEHAVIOR, not implementation
- Test public interfaces (API endpoints, UI interactions)
- Focus on critical paths first

ORGANIZE TESTS BY PRIORITY:

PRIORITY 1: Critical Paths (must work)
- User can register/login
- User can search services
- User can view service details
- User can create booking
- Provider can add/edit service
- Payment flow works

PRIORITY 2: Important Paths (should work)
- User can add to favorites
- User can leave reviews
- Provider can view earnings
- User can update profile
- Notifications work

PRIORITY 3: Edge Cases
- Invalid input handling
- Network error recovery
- Session expiry handling
- Concurrent modification

FOR EACH TEST, SPECIFY:
- Test name (behavior-focused)
- Pre-conditions (what must be true)
- Test action (what user/system does)
- Expected outcome
- API endpoint(s) involved
- Frontend component(s) involved

GROUP TESTS INTO:
1. API Integration Tests (backend only)
2. E2E UI Tests (Playwright, full flow)
3. Contract Tests (frontend ↔ backend agreement)

Return organized test plan ready for implementation.
`, {schema: {
  type: 'object',
  properties: {
    priority1Critical: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          preconditions: { type: 'array', items: { type: 'string' } },
          action: { type: 'string' },
          expectedOutcome: { type: 'string' },
          apiEndpoints: { type: 'array', items: { type: 'string' } },
          components: { type: 'array', items: { type: 'string' } },
          testType: { type: 'string' }
        }
      }
    },
    priority2Important: { type: 'array', items: { type: 'object' } },
    priority3EdgeCases: { type: 'array', items: { type: 'object' } }
  }
}});

/**
 * ============================================================
 * PHASE 5: Write Playwright Tests
 * ============================================================
 */
phase('Write Playwright Tests');

log('Writing Playwright E2E tests based on test plan...');

const playwrightTests = await agent(`
Write Playwright E2E tests for the critical user journeys.

Create test file: frontend/tests/e2e/fullstack-flow.spec.ts

Follow the webapp-testing skill patterns:
- Use sync_playwright() for synchronous scripts
- Always wait for networkidle on dynamic apps
- Use descriptive selectors: text=, role=, CSS selectors
- Take screenshots on failure

TEMPLATE FOR EACH TEST:

import { test, expect } from '@playwright/test';

test.describe('Critical Flows', () => {

  test.beforeEach(async ({ page }) => {
    // Setup: navigate to app, wait for load
    await page.goto(process.env.BASE_URL || 'http://localhost:5173');
    await page.wait_for_load_state('networkidle');
  });

  test('TEST_NAME - BEHAVIOR being tested', async ({ page }) => {
    // 1. ARRANGE: Set up test data/state
    // 2. ACT: Perform the user action
    // 3. ASSERT: Verify the outcome

    // Take screenshot at key points
    await page.screenshot({ path: 'tests/screenshots/TEST_NAME_step1.png' });

    // Use descriptive locators
    await page.getByRole('button', { name: 'Submit' }).click();

    // Wait for response
    await page.wait_for_response(response =>
      response.url().includes('/api/') && response.status() !== 0
    );

    // Assert on UI state
    await expect(page.getByText('Success')).toBeVisible();
  });
});

Write complete tests for:

1. AUTH FLOW:
   - Register new user
   - Login existing user
   - Logout

2. SERVICE DISCOVERY:
   - Search for services
   - Filter by category/price
   - View service details

3. BOOKING FLOW:
   - Select service variant
   - Choose date/time
   - Confirm booking
   - View booking confirmation

4. PROVIDER SERVICE MANAGEMENT:
   - Navigate to provider dashboard
   - Add new service
   - Edit existing service
   - View service analytics

5. ERROR RECOVERY:
   - Network error handling
   - Form validation errors
   - Session expiry

Save tests to: frontend/tests/e2e/fullstack-flow.spec.ts
Also create: frontend/tests/e2e/helpers/test-data.ts (test data fixtures)
`, {schema: {
  type: 'object',
  properties: {
    testFileCreated: { type: 'string' },
    testsWritten: { type: 'number' },
    testCategories: { type: 'array', items: { type: 'string' } }
  }
}});

/**
 * ============================================================
 * PHASE 6: Run Tests & Capture Results
 * ============================================================
 */
phase('Run Tests & Capture Results');

log('Setting up test environment and running tests...');

const testResults = await agent(`
Run the Playwright tests and capture results.

1. First, ensure test environment is ready:
   cd frontend
   npm list @playwright/test || npm install -D @playwright/test
   npx playwright install chromium

2. Check if servers can start using with_server.py:
   python .agents/skills/webapp-testing/scripts/with_server.py --help

3. Start servers:
   python .agents/skills/webapp-testing/scripts/with_server.py \
     --server "cd backend && npm run dev" --port 3000 \
     --server "cd frontend && npm run dev" --port 5173 \
     --timeout 30 \
     -- npx playwright test tests/e2e/fullstack-flow.spec.ts --reporter=list

4. If servers already running:
   npx playwright test tests/e2e/fullstack-flow.spec.ts --reporter=list --headed

5. Capture results:
   - Screenshots of failures
   - Console logs
   - Network requests that failed
   - API response errors

6. Document findings:
   - Which tests passed
   - Which tests failed
   - Why they failed (API error, UI bug, test issue)
   - Screenshots saved

Return test execution results with pass/fail counts and failure details.
`, {schema: {
  type: 'object',
  properties: {
    totalTests: { type: 'number' },
    passed: { type: 'number' },
    failed: { type: 'number' },
    skipped: { type: 'number' },
    failures: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          test: { type: 'string' },
          error: { type: 'string' },
          screenshot: { type: 'string' },
          apiCalls: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
}});

/**
 * ============================================================
 * PHASE 7: Fix Issues
 * ============================================================
 */
phase('Fix Issues');

log('Fixing issues identified in the audit and test runs...');

const fixes = await agent(`
Fix all issues found during audit and testing.

GROUP FIXES BY CATEGORY:

CATEGORY A: API Integration Fixes
- Add missing error handling
- Fix data shape mismatches
- Add loading states
- Fix authentication issues

CATEGORY B: Frontend UI Fixes
- Fix broken navigation
- Add missing states (loading, error, empty)
- Fix data display issues
- Add proper form validation

CATEGORY C: Backend Fixes
- Add missing validations
- Fix incorrect error responses
- Add proper error handling
- Fix data transformation issues

CATEGORY D: Data Flow Fixes
- Fix data passed between components
- Fix state management issues
- Fix response handling

FOLLOW TDD CYCLE FOR EACH FIX:
1. Write test that reproduces the bug
2. Run test → should fail
3. Fix the code
4. Run test → should pass
5. Refactor if needed

PRIORITY ORDER:
1. Fix all tests that are failing due to code bugs
2. Fix critical path issues
3. Fix high priority issues
4. Fix medium priority issues

For each fix:
- Identify root cause
- Implement fix
- Verify fix with test
- Take screenshot of working result

Return list of fixes applied with verification.
`, {schema: {
  type: 'object',
  properties: {
    apiFixes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          issue: { type: 'string' },
          file: { type: 'string' },
          fix: { type: 'string' },
          verified: { type: 'boolean' }
        }
      }
    },
    uiFixes: { type: 'array', items: { type: 'object' } },
    backendFixes: { type: 'array', items: { type: 'object' } },
    dataFlowFixes: { type: 'array', items: { type: 'object' } }
  }
}});

/**
 * ============================================================
 * PHASE 8: Verify Fixes
 * ============================================================
 */
phase('Verify Fixes');

log('Running final verification of all fixes...');

const verification = await agent(`
Final verification that all issues are resolved.

1. RE-RUN ALL TESTS:
   npx playwright test tests/e2e/fullstack-flow.spec.ts --reporter=list

2. RUN TYPESCRIPT COMPILATION:
   cd backend && npx tsc --noEmit
   cd frontend && npx tsc --noEmit

3. RUN LINTING:
   cd frontend && npm run lint
   cd backend && npm run lint

4. MANUAL VERIFICATION (if servers running):
   Test critical flows manually:
   - Register/login
   - Search and book service
   - Provider add service
   - Check error states

5. GENERATE FINAL REPORT:

   ## Audit & Fix Summary

   ### Issues Found
   - Total: X
   - Critical: X
   - High: X
   - Medium: X

   ### Fixes Applied
   - API Integration: X
   - Frontend UI: X
   - Backend: X
   - Data Flow: X

   ### Tests
   - Total: X
   - Passing: X
   - Failing: X

   ### Remaining Issues
   - (if any, explain why and plan)

   ### Recommendations
   - Short term
   - Long term

Return final verification report with all metrics.
`, {schema: {
  type: 'object',
  properties: {
    totalIssuesFound: { type: 'number' },
    issuesFixed: { type: 'number' },
    issuesRemaining: { type: 'number' },
    testsTotal: { type: 'number' },
    testsPassing: { type: 'number' },
    testsFailing: { type: 'number' },
    finalReport: { type: 'string' }
  }
}});

/**
 * ============================================================
 * FINAL OUTPUT
 * ============================================================
 */

log('='.repeat(60));
log('FULL-STACK AUDIT & FIX WORKFLOW COMPLETE');
log('='.repeat(60));

const summary = `
📊 AUDIT SUMMARY
================
API Endpoints Discovered: ${backendRoutes.endpoints?.length || 0}
Frontend API Integrations: ${frontendApiAudit.properIntegrations?.length || 0} proper, ${frontendApiAudit.endpointIssues?.length || 0} with issues
Data Flow Journeys Traced: ${dataFlowAnalysis.journeyAnalysis?.length || 0}

🧪 TEST PLAN
============
Priority 1 (Critical): ${testPlan.priority1Critical?.length || 0} tests
Priority 2 (Important): ${testPlan.priority2Important?.length || 0} tests
Priority 3 (Edge Cases): ${testPlan.priority3EdgeCases?.length || 0} tests
Tests Written: ${playwrightTests.testsWritten || 0}

✅ FIXES APPLIED
===============
API Integration Fixes: ${fixes.apiFixes?.length || 0}
UI Fixes: ${fixes.uiFixes?.length || 0}
Backend Fixes: ${fixes.backendFixes?.length || 0}
Data Flow Fixes: ${fixes.dataFlowFixes?.length || 0}

🎯 VERIFICATION
===============
Tests Total: ${verification.testsTotal || 0}
Tests Passing: ${verification.testsPassing || 0}
Tests Failing: ${verification.testsFailing || 0}
Issues Remaining: ${verification.issuesRemaining || 0}
`;

log(summary);

return {
  apiDiscovery: backendRoutes,
  frontendAudit: frontendApiAudit,
  dataFlows: dataFlowAnalysis,
  testPlan: testPlan,
  playwrightTests: playwrightTests,
  testResults: testResults,
  fixes: fixes,
  verification: verification,
  summary: summary
};
