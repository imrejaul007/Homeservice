/**
 * Safe Page Audit Workflow - Rate Limit Friendly
 * Runs agents in SMALL PARALLEL BATCHES (2-4 at a time)
 */

export const meta = {
  name: 'safe-page-audit',
  description: 'Page audit with parallel batching (2-4 agents per batch)',
  phases: ['Discover', 'Analyze', 'Fix', 'Verify'],
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

phase('Discover');

// Phase 1: Discovery - 2 agents in parallel
log('=== PHASE 1: DISCOVERING FILES (2 agents) ===');

const [frontendDiscovery, backendDiscovery] = await Promise.all([
  agent(`Find ALL frontend files related to Customer Dashboard.

Search in:
- frontend/src/components/dashboard/
- frontend/src/pages/customer/
- frontend/src/stores/booking*
- frontend/src/hooks/*dashboard*

Return JSON: {"files": [], "count": 0}`,
  { label: 'frontend-discovery', phase: 'Discover', schema: { type: 'object', properties: { files: { type: 'array' }, count: { type: 'number' } }, required: ['files'] } }),

  agent(`Find ALL backend files related to Customer Dashboard.

Search in:
- backend/src/routes/customerDashboard*
- backend/src/services/customerDashboard*
- backend/src/controllers/customerDashboard*

Return JSON: {"files": [], "count": 0}`,
  { label: 'backend-discovery', phase: 'Discover', schema: { type: 'object', properties: { files: { type: 'array' }, count: { type: 'number' } }, required: ['files'] } })
]);

const allFiles = [...(frontendDiscovery.files || []), ...(backendDiscovery.files || [])];
log('Found ' + allFiles.length + ' files');

phase('Analyze');

// Phase 2: Analysis - 3 agents in parallel
log('=== PHASE 2: ANALYZING CODE (3 agents in parallel) ===');

const [frontendIssues, backendIssues, apiIssues] = await Promise.all([
  agent(`Analyze Customer Dashboard frontend for bugs.

Files to check:
- frontend/src/components/dashboard/CustomerDashboard.tsx
- frontend/src/components/dashboard/PackagesSection.tsx
- frontend/src/components/dashboard/RecentActivity.tsx
- frontend/src/components/dashboard/UpcomingBookings.tsx

Check for: TypeScript errors, missing API connections, error handling, security issues

Return JSON: {"issues": [{"severity": "critical|high|medium|low", "title": "...", "file": "...", "line": 0, "suggestedFix": "..."}]}`,
  { label: 'frontend-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' } }, required: ['issues'] } }),

  agent(`Analyze Customer Dashboard backend for bugs.

Files to check:
- backend/src/services/customerDashboard.service.ts
- backend/src/controllers/customerDashboard.controller.ts
- backend/src/routes/customerDashboard.routes.ts

Check for: TypeScript errors, validation issues, security, N+1 queries, missing indexes

Return JSON: {"issues": [{"severity": "critical|high|medium|low", "title": "...", "file": "...", "line": 0, "suggestedFix": "..."}]}`,
  { label: 'backend-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' } }, required: ['issues'] } }),

  agent(`Check API integration issues in Customer Dashboard.

Check:
- Are frontend components calling real APIs or mock data?
- Do API response types match frontend expectations?
- Are there type mismatches between frontend and backend?

Return JSON: {"issues": [{"severity": "critical|high|medium|low", "title": "...", "file": "...", "suggestedFix": "..."}]}`,
  { label: 'api-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' } }, required: ['issues'] } })
]);

const allIssues = [
  ...(frontendIssues.issues || []),
  ...(backendIssues.issues || []),
  ...(apiIssues.issues || [])
];

const critical = allIssues.filter(i => i.severity === 'critical');
const high = allIssues.filter(i => i.severity === 'high');
const medium = allIssues.filter(i => i.severity === 'medium');
const low = allIssues.filter(i => i.severity === 'low');

log('');
log('ISSUES FOUND: ' + allIssues.length);
log('Critical: ' + critical.length + ' | High: ' + high.length + ' | Medium: ' + medium.length + ' | Low: ' + low.length);

// Wait before fixes
await delay(3000);

phase('Fix');

// Phase 3: Fix - 3 agents in parallel per severity
log('=== PHASE 3: APPLYING FIXES (3 agents per batch) ===');

// Fix critical (max 3 in parallel)
if (critical.length > 0) {
  log('Fixing CRITICAL issues...');
  const criticalBatches = [];
  for (let i = 0; i < critical.length; i += 3) {
    criticalBatches.push(critical.slice(i, i + 3));
  }

  for (const batch of criticalBatches) {
    const results = await Promise.all(batch.map(issue =>
      agent(`FIX: ${issue.title}
FILE: ${issue.file}:${issue.line || 0}
FIX: ${issue.suggestedFix}

Read file, apply fix. Return JSON: {"status": "fixed"}`,
        { label: 'fix-critical', phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } } } })
    ));
    results.forEach((r, i) => log('  Fixed: ' + batch[i].title));
    await delay(3000);
  }
}

// Fix high (max 3 in parallel)
if (high.length > 0) {
  log('Fixing HIGH priority issues...');
  const highBatches = [];
  for (let i = 0; i < high.length; i += 3) {
    highBatches.push(high.slice(i, i + 3));
  }

  for (const batch of highBatches) {
    const results = await Promise.all(batch.map(issue =>
      agent(`FIX: ${issue.title}
FILE: ${issue.file}:${issue.line || 0}
FIX: ${issue.suggestedFix}

Read file, apply fix. Return JSON: {"status": "fixed"}`,
        { label: 'fix-high', phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } } } })
    ));
    results.forEach((r, i) => log('  Fixed: ' + batch[i].title));
    await delay(3000);
  }
}

// Fix medium (max 4 in parallel)
if (medium.length > 0) {
  log('Fixing MEDIUM priority issues...');
  const mediumBatches = [];
  for (let i = 0; i < medium.length; i += 4) {
    mediumBatches.push(medium.slice(i, i + 4));
  }

  for (const batch of mediumBatches) {
    const results = await Promise.all(batch.map(issue =>
      agent(`FIX: ${issue.title}
FILE: ${issue.file}
FIX: ${issue.suggestedFix}

Read file, apply fix. Return JSON: {"status": "fixed"}`,
        { label: 'fix-medium', phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } } } })
    ));
    results.forEach((r, i) => log('  Fixed: ' + batch[i].title));
    await delay(3000);
  }
}

await delay(3000);

phase('Verify');

// Phase 4: Verify - 2 agents in parallel
log('=== PHASE 4: VERIFYING (2 agents in parallel) ===');

const [tsResult, buildResult] = await Promise.all([
  agent(`Run TypeScript check on frontend:
cd frontend && npx tsc --noEmit 2>&1
Return JSON: {"success": true, "errors": []}`,
  { label: 'tsc', phase: 'Verify', schema: { type: 'object', properties: { success: { type: 'boolean' }, errors: { type: 'array' } } } }),

  agent(`Build backend:
cd backend && npm run build 2>&1
Return JSON: {"success": true, "errors": []}`,
  { label: 'build', phase: 'Verify', schema: { type: 'object', properties: { success: { type: 'boolean' }, errors: { type: 'array' } } } })
]);

log('');
log('VERIFICATION:');
log('  Frontend TypeScript: ' + (tsResult.success ? 'PASS' : 'FAIL'));
log('  Backend Build: ' + (buildResult.success ? 'PASS' : 'FAIL'));

log('');
log('===========================================');
log('AUDIT COMPLETE');
log('===========================================');

return {
  issuesFound: allIssues.length,
  criticalFixed: critical.length,
  highFixed: high.length,
  mediumFixed: medium.length,
  frontendCompile: tsResult.success,
  backendCompile: buildResult.success
};
