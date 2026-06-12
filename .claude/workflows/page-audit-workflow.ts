/**
 * Page Audit & Auto-Fix Workflow
 *
 * Comprehensive analysis and automatic fixing of any page.
 * Given a page path, it will:
 * 1. Discover all frontend components, routes, API calls
 * 2. Analyze backend endpoints, controllers, services, models
 * 3. Test all user interactions
 * 4. Detect and fix all issues (404s, broken routes, data mismatches)
 */

export const meta = {
  name: 'page-audit',
  description: 'Comprehensive audit and auto-fix for any page - discovers, analyzes, and fixes all issues',
  author: 'Claude',
  version: '1.0.0',
  phases: [
    { name: 'discovery', description: 'Discover page components, routes, API calls' },
    { name: 'analysis', description: 'Analyze backend endpoints and data models' },
    { name: 'testing', description: 'Test all user interactions' },
    { name: 'fixing', description: 'Fix all detected issues' },
    { name: 'verification', description: 'Verify all fixes work correctly' },
  ],
};

interface PageAuditArgs {
  pagePath: string;
  screenshotPath?: string;
}

export async function pageAuditWorkflow(args: PageAuditArgs) {
  const { pagePath } = args;

  console.log(`\n🔍 Starting Page Audit for: ${pagePath}\n`);

  // ============================================================
  // PHASE 1: DISCOVERY - Find all related components and routes
  // ============================================================
  console.log('📋 Phase 1: Discovery...');

  // Extract page identifier from path
  const pathParts = pagePath.split('/').filter(Boolean);
  const pageId = pathParts[pathParts.length - 1];
  const basePath = '/' + pathParts.slice(0, -1).join('/');

  // Launch parallel discovery agents
  const [frontendDiscovery, backendDiscovery, routeAnalysis] = await Promise.all([
    // Agent 1: Frontend Discovery
    agent({
      prompt: `Analyze the page at path: ${pagePath}

Find and document:
1. The main page component file
2. All child components used
3. All API calls made
4. All button/navigation handlers
5. All state management used
6. All modals/dialogs

Search in: frontend/src/pages/, frontend/src/components/
Report the full file paths and key functions found.`,
      subagent_type: 'Explore',
    }),

    // Agent 2: Backend Discovery
    agent({
      prompt: `Analyze backend endpoints related to: ${pagePath}

For the page "${pagePath}", find:
1. All API endpoints called by the frontend
2. Route definitions in routes/
3. Controller functions
4. Service layer functions
5. Database models used

Search in: backend/src/routes/, backend/src/controllers/, backend/src/services/, backend/src/models/
Report all endpoints, their handlers, and the data models used.`,
      subagent_type: 'Explore',
    }),

    // Agent 3: Route Analysis
    agent({
      prompt: `Analyze routes in App.tsx related to: ${pagePath}

Find:
1. Route definition for this path
2. Any related routes (booking, compare, etc.)
3. Lazy import statements
4. Route parameters
5. Protected route middleware (AdminRoute, CustomerRoute, ProviderRoute)

Search in: frontend/src/App.tsx
Report all route definitions, their components, and middleware.`,
      subagent_type: 'Explore',
    }),
  ]);

  console.log('✅ Discovery complete\n');

  // ============================================================
  // PHASE 2: ANALYSIS - Verify data flow and endpoints
  // ============================================================
  console.log('🔬 Phase 2: Analysis...');

  const [dataFlowAnalysis, modelAnalysis] = await Promise.all([
    // Agent 4: Data Flow Analysis
    agent({
      prompt: `Trace data flow for page: ${pagePath}

Verify:
1. Frontend API calls match backend endpoints
2. Response types match frontend expectations
3. Data transformations are correct
4. Error handling is in place

Check: frontend/src/services/ for API clients
Check: backend/src/controllers/ for endpoint handlers
Report any mismatches between frontend types and backend responses.`,
      subagent_type: 'Explore',
    }),

    // Agent 5: Model Analysis
    agent({
      prompt: `Analyze database models for page: ${pagePath}

Find:
1. Which collection models are queried (Service, Bundle, etc.)
2. Data model field mappings
3. Any mismatches between frontend expectations and DB schema

Check: backend/src/models/
Report if packages come from Bundle or Service collection and why.`,
      subagent_type: 'Explore',
    }),
  ]);

  console.log('✅ Analysis complete\n');

  // ============================================================
  // PHASE 3: TESTING - Test all user actions
  // ============================================================
  console.log('🧪 Phase 3: Testing...');

  const interactionTesting = await agent({
    prompt: `Test all user interactions for page: ${pagePath}

For each button/link/action, verify:
1. What it should do (navigate, API call, state change)
2. Where it points (route, endpoint, handler)
3. If it actually works

Common actions to check:
- "Book Now" / "Book Package" buttons
- "Contact Provider" / "Message" buttons
- "Add to Compare" / "Compare" buttons
- "Share" / "Print" / "Download" buttons
- "Wishlist" / "Heart" buttons
- Navigation links
- Form submissions

Use the page component found to trace all click handlers.
Report which actions work and which don't.`,
    subagent_type: 'Explore',
  });

  console.log('✅ Testing complete\n');

  // ============================================================
  // PHASE 4: FIXING - Fix all detected issues
  // ============================================================
  console.log('🔧 Phase 4: Fixing issues...\n');

  // Launch parallel fix agents for different issue categories

  const criticalFixes = await agent({
    prompt: `Fix CRITICAL issues for page: ${pagePath}

Critical issues include:
- 404 errors on page load
- Missing route definitions
- Database model mismatches (Service vs Bundle)
- Authentication bypasses

Based on the analysis:
1. Fix any routes that don't exist
2. Fix any data model mismatches
3. Fix any authentication issues
4. Add any missing endpoints

Make the minimal changes needed to fix these issues.
Report what was fixed.`,
    subagent_type: 'claude',
  });

  const routeFixes = await agent({
    prompt: `Fix ROUTE issues for page: ${pagePath}

Fix:
1. Broken navigation routes
2. Wrong redirect paths
3. Missing route definitions in App.tsx
4. Incorrect lazy imports

Common fixes:
- /messages/:id → /customer/messages/new?providerId=xxx
- Missing /customer/messages/new route
- Missing NewMessagePage component

Make all routes work correctly.
Report what was fixed.`,
    subagent_type: 'claude',
  });

  const endpointFixes = await agent({
    prompt: `Fix ENDPOINT issues for page: ${pagePath}

Fix:
1. API calls to non-existent endpoints
2. Wrong HTTP methods
3. Missing request/response types
4. Controller functions querying wrong collection

Common fixes:
- Wishlist checking Service instead of Bundle
- getPackageById querying Service instead of Bundle
- Reviews checking Service instead of Bundle

Make all API endpoints work correctly.
Report what was fixed.`,
    subagent_type: 'claude',
  });

  const componentFixes = await agent({
    prompt: `Fix COMPONENT issues for page: ${pagePath}

Fix:
1. Missing components
2. Wrong imports
3. Type mismatches
4. Export errors

Check:
- All imports resolve correctly
- All lazy() calls are valid
- All exports exist

Make all components import and export correctly.
Report what was fixed.`,
    subagent_type: 'claude',
  });

  console.log('✅ Fixing complete\n');

  // ============================================================
  // PHASE 5: VERIFICATION - Verify all fixes
  // ============================================================
  console.log('✅ Phase 5: Verification...\n');

  const verification = await agent({
    prompt: `Verify fixes for page: ${pagePath}

After all fixes:
1. Run TypeScript compilation check
2. Verify all routes are registered
3. Verify all endpoints exist
4. Verify data flows correctly

Run: npx tsc --noEmit -p backend/tsconfig.json
Run: npx tsc --noEmit -p frontend/tsconfig.json

Check:
- frontend/src/App.tsx has all routes
- backend/src/routes/index.ts has all routes
- All imports are correct

Report final status: All fixes verified or issues remaining.`,
    subagent_type: 'claude',
  });

  // ============================================================
  // FINAL REPORT
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 PAGE AUDIT COMPLETE');
  console.log('='.repeat(60) + '\n');

  return {
    pagePath,
    discovery: {
      frontend: frontendDiscovery.summary,
      backend: backendDiscovery.summary,
      routes: routeAnalysis.summary,
    },
    analysis: {
      dataFlow: dataFlowAnalysis.summary,
      models: modelAnalysis.summary,
    },
    testing: interactionTesting.summary,
    fixes: {
      critical: criticalFixes.summary,
      routes: routeFixes.summary,
      endpoints: endpointFixes.summary,
      components: componentFixes.summary,
    },
    verification: verification.summary,
    status: 'Complete',
  };
}

export default pageAuditWorkflow;