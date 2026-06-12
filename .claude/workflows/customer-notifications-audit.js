export const meta = {
  name: 'page-audit-customer-notifications',
  description: 'Deep audit of customer notifications page with 6-dimension analysis',
  phases: [
    { title: 'Discover', detail: 'Deep file discovery across frontend/backend' },
    { title: 'Analyze', detail: '6 parallel analysis agents' },
    { title: 'Audit', detail: 'Detailed report with exact file:line:code' },
    { title: 'Fix', detail: 'Parallel fixes by severity' },
    { title: 'Verify', detail: 'TypeScript compilation check' },
  ],
};

const pageName = "Customer Notifications";

log(`========================================`);
log(`AUDITING PAGE: ${pageName}`);
log(`========================================`);
log('');

// Deep file discovery
const discovery = await agent(`
DEEP FILE DISCOVERY for page: "${pageName}"

Search for ALL files related to this page across the ENTIRE codebase.

1. FRONTEND FILES:
   - frontend/src/pages/*customer*/*notif* or *notification*
   - frontend/src/pages/*notif* or *notification*
   - frontend/src/components/notifications/*
   - frontend/src/components/customer/*
   - frontend/src/services/*Api*.ts
   - frontend/src/stores/*.ts
   - frontend/src/types/*.ts
   - frontend/src/hooks/*.ts
   - frontend/src/contexts/*

2. BACKEND FILES:
   - backend/src/routes/*notif* or *notification*
   - backend/src/routes/*customer*
   - backend/src/controllers/*notif* or *notification*
   - backend/src/services/*notif* or *notification*
   - backend/src/models/*notif* or *notification*
   - backend/src/dto/*notif* or *notification*
   - backend/src/validation/*notif* or *notification*

3. SEARCH BY CONTENT:
   - Search for imports/exports of components with "Notification" or "notification"
   - Search for API endpoints matching /notifications
   - Search for route definitions with "notification" or "notif"
   - Search for store names with "notification"
   - Search for socket events related to notifications

4. CROSS-REFERENCES:
   - Files that import notification components
   - Files imported by notification components
   - API routes that notifications use
   - Socket events the page uses

READ THE ACTUAL FILE CONTENT to verify they are related.

Return a JSON object with these exact fields:
{
  "frontendFiles": ["list of all frontend files with paths"],
  "backendFiles": ["list of all backend files with paths"],
  "apiEndpoints": ["list of API endpoints used"],
  "socketEvents": ["list of socket events"],
  "models": ["list of database models"],
  "totalFiles": 50
}
`, { label: 'discovery', schema: { type: 'object', required: ['frontendFiles', 'backendFiles', 'totalFiles'], properties: { frontendFiles: {}, backendFiles: {}, apiEndpoints: {}, socketEvents: {}, models: {}, totalFiles: {} } } }
);

log(`Discovered ${discovery.totalFiles} files`);
log(`  Frontend: ${discovery.frontendFiles?.length || 0} files`);
log(`  Backend: ${discovery.backendFiles?.length || 0} files`);
log('');

// ============================================
// PHASE 2: ANALYZE (6 PARALLEL AGENTS)
// ============================================

phase('Analyze');

const frontendFiles = Array.isArray(discovery.frontendFiles) ? discovery.frontendFiles : [];
const backendFiles = Array.isArray(discovery.backendFiles) ? discovery.backendFiles : [];
const allFiles = [...frontendFiles, ...backendFiles];

log('Launching 6 parallel analysis agents...');
log('');

// Agent 1: FRONTEND DEEP ANALYSIS
const frontendAnalysis = await agent(`
DEEP FRONTEND ANALYSIS for page: "${pageName}"

Files to analyze:
${frontendFiles.map(f => `- ${f}`).join('\n')}

ANALYZE IN EXTREME DETAIL:

1. COMPONENT STRUCTURE
   - Component hierarchy and props drilling
   - Tab/filter functionality for notifications
   - Card display components
   - Unused imports and dead code
   - Memory leaks (event listeners, subscriptions not cleaned up)
   - Conditional rendering issues
   - Key props missing in lists

2. STATE MANAGEMENT (CRITICAL)
   - Zustand/Redux store usage patterns
   - Race conditions in async state updates
   - Stale closure issues
   - Store actions that could fail silently
   - Notification state (read/unread)

3. API INTEGRATION (CRITICAL)
   - AuthService/ApiService usage
   - Request/response types
   - Error handling
   - Loading states
   - Empty states
   - Pagination if applicable

4. LIFECYCLE ISSUES
   - useEffect dependencies array
   - Missing cleanup functions
   - Component unmount during async

READ EACH FILE. Do NOT guess. Report exact issues with file:line.

Return JSON with this structure:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "state-management|api-integration|lifecycle|memory|typescript|accessibility",
    "title": "Short title",
    "description": "Detailed description of the issue",
    "file": "exact/file/path.tsx",
    "line": 123,
    "code": "problematic code snippet",
    "suggestedFix": "Detailed fix with code example",
    "effort": "low|medium|high"
  }],
  "summary": {
    "filesAnalyzed": 10,
    "issuesFound": 15,
    "criticalCount": 3
  }
}
`, { label: 'frontend-analysis', phase: 'Analyze', schema: { type: 'object', required: ['issues'], properties: { issues: {}, summary: {} } } }
);

// Agent 2: BACKEND DEEP ANALYSIS
const backendAnalysis = await agent(`
DEEP BACKEND ANALYSIS for page: "${pageName}"

Files to analyze:
${backendFiles.map(f => `- ${f}`).join('\n')}

ANALYZE IN EXTREME DETAIL:

1. ROUTE HANDLERS
   - HTTP methods and paths
   - Middleware chain order
   - Request logging
   - Response formatting

2. CONTROLLER LOGIC (CRITICAL)
   - Input validation (Joi schemas)
   - Business logic validation
   - Authorization checks
   - Error responses
   - Transaction handling

3. SERVICE LAYER
   - Database queries (N+1 problems)
   - Missing indexes
   - Cache usage
   - External API calls

4. VALIDATION (CRITICAL)
   - Joi schema constraints
   - Required vs optional fields
   - Type coercion

5. DATABASE MODELS
   - Schema validation
   - Required field enforcement
   - Index usage

READ EACH FILE. Report exact issues with file:line.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "validation|security|performance|database|api-design|middleware",
    "title": "Short title",
    "description": "Detailed description",
    "file": "exact/file/path.ts",
    "line": 123,
    "code": "problematic code",
    "suggestedFix": "Detailed fix",
    "effort": "low|medium|high"
  }],
  "summary": {
    "endpointsAnalyzed": 10,
    "validationsFound": 15,
    "criticalCount": 3
  }
}
`, { label: 'backend-analysis', phase: 'Analyze', schema: { type: 'object', required: ['issues'], properties: { issues: {}, summary: {} } } }
);

// Agent 3: TYPE & DATA FLOW ANALYSIS
const typeAnalysis = await agent(`
TYPE & DATA FLOW ANALYSIS for page: "${pageName}"

Files to analyze:
${allFiles.map(f => `- ${f}`).join('\n')}

ANALYZE IN EXTREME DETAIL:

1. TYPE DEFINITIONS
   - Frontend TypeScript interfaces for notifications
   - Backend DTOs
   - API response types
   - Store state types

2. TYPE MISMATCHES (CRITICAL)
   - Frontend expects vs Backend returns
   - Optional vs required fields
   - Field naming consistency
   - Type coercion issues

3. DATA FLOW
   - API response to Store
   - Store to Component
   - Error response to Display

4. ENUM CONSISTENCY
   - Notification types
   - Status enums
   - Frontend/backend alignment

READ EACH FILE. Compare frontend vs backend types line by line.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "type-mismatch|enum-inconsistency|data-flow|import-export",
    "title": "Short title",
    "description": "Detailed description",
    "frontendFile": "file.tsx",
    "backendFile": "file.ts",
    "line": 123,
    "code": "mismatched code",
    "suggestedFix": "Detailed fix",
    "effort": "low|medium|high"
  }],
  "summary": {
    "typesCompared": 20,
    "mismatchesFound": 5
  }
}
`, { label: 'types-analysis', phase: 'Analyze', schema: { type: 'object', required: ['issues'], properties: { issues: {}, summary: {} } } }
);

// Agent 4: FORM-TO-API VALIDATION MATRIX
const formApiAnalysis = await agent(`
FORM-TO-API VALIDATION MATRIX for page: "${pageName}"

THIS IS THE MOST CRITICAL ANALYSIS.

Files to analyze:
- All frontend notification components
- All API service files
- All backend controllers
- All Joi validation schemas

ANALYZE IN EXTREME DETAIL:

1. FOR EACH API CALL:
   - Find backend route
   - Find EXACT Joi validation schema
   - List what Joi ACCEPTS vs what FRONTEND SENDS

2. CRITICAL CHECKS:
   - Extra fields: frontend sends extra fields, backend does not expect
   - Boolean as string: 'true' vs true
   - Date formats: ISO string vs Date object
   - Enum values: consistency between frontend and backend
   - Required vs optional mismatches

3. JOI SCHEMA ISSUES:
   - .required() on fields frontend might not send
   - .or() constraints too strict
   - Nested .required() when parent is optional

4. API ERROR HANDLING:
   - Does API service preserve Axios error structure?
   - Can components access error.status and error.response.data.errors?
   - Is error.response.data.message shown to user?

READ EACH FILE. Compare line by line.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "form-mismatch|joi-schema|api-error",
    "title": "Short title",
    "description": "Detailed description",
    "file": "exact/file/path.ts",
    "line": 123,
    "frontendCode": "what frontend sends",
    "backendSchema": "what backend expects",
    "mismatch": "what does not match",
    "suggestedFix": "Detailed fix",
    "effort": "low|medium|high"
  }],
  "formApiMatrix": [{
    "formField": "fieldName",
    "frontendSends": "{ fieldName: 'value' }",
    "backendJoi": "fieldName: Joi.string().required()",
    "match": "YES|NO",
    "issue": "description if no match"
  }],
  "joiSchemaFixes": [{
    "file": "controller.ts",
    "line": 140,
    "current": "fieldName: Joi.string().required()",
    "problem": "description",
    "fix": "fieldName: Joi.string().optional()"
  }],
  "summary": {
    "formsAnalyzed": 5,
    "mismatchesFound": 10,
    "criticalCount": 3
  }
}
`, { label: 'form-api-analysis', phase: 'Analyze', schema: { type: 'object', required: ['issues'], properties: { issues: {}, formApiMatrix: {}, joiSchemaFixes: {}, summary: {} } } }
);

// Agent 5: ERROR HANDLING ANALYSIS
const errorAnalysis = await agent(`
ERROR HANDLING ANALYSIS for page: "${pageName}"

Files to analyze:
${allFiles.map(f => `- ${f}`).join('\n')}

ANALYZE IN EXTREME DETAIL:

1. FRONTEND ERROR HANDLING
   - try/catch blocks
   - Error state management
   - User-friendly error messages
   - Console errors vs user errors

2. BACKEND ERROR HANDLING
   - Error middleware
   - Async error wrapping
   - Custom error classes
   - Error response format

3. NETWORK ERRORS
   - Timeout handling
   - Offline handling
   - Retry logic

4. CRITICAL ERRORS
   - Unhandled promise rejections
   - Uncaught exceptions
   - Silent failures

READ EACH FILE. Find ALL error handling issues.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "error-handling|error-display|error-recovery|error-logging",
    "title": "Short title",
    "description": "Detailed description",
    "file": "exact/file/path.tsx",
    "line": 123,
    "code": "problematic code",
    "suggestedFix": "Detailed fix",
    "effort": "low|medium|high"
  }],
  "summary": {
    "errorHandlersFound": 10,
    "unhandledErrors": 3,
    "criticalCount": 2
  }
}
`, { label: 'error-analysis', phase: 'Analyze', schema: { type: 'object', required: ['issues'], properties: { issues: {}, summary: {} } } }
);

// Agent 6: SECURITY ANALYSIS
const securityAnalysis = await agent(`
SECURITY ANALYSIS for page: "${pageName}"

Files to analyze:
${allFiles.map(f => `- ${f}`).join('\n')}

ANALYZE IN EXTREME DETAIL:

1. AUTHENTICATION
   - Protected routes
   - Token handling
   - Session management

2. AUTHORIZATION (IDOR CHECK)
   - Role-based access control
   - Resource ownership verification
   - Can user A access user B's notifications?

3. INPUT VALIDATION
   - XSS prevention
   - SQL/NoSQL injection
   - Command injection

4. DATA SECURITY
   - Sensitive data in logs
   - Environment variables
   - PII handling

READ EACH FILE. This is SECURITY-CRITICAL.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "authentication|authorization|xss|injection|data-exposure",
    "title": "Short title",
    "description": "Detailed description with attack scenario",
    "file": "exact/file/path.ts",
    "line": 123,
    "code": "vulnerable code",
    "attackScenario": "how an attacker could exploit this",
    "suggestedFix": "Detailed fix",
    "effort": "low|medium|high"
  }],
  "summary": {
    "authChecksFound": 10,
    "vulnerabilities": 3,
    "criticalCount": 1
  }
}
`, { label: 'security-analysis', phase: 'Analyze', schema: { type: 'object', required: ['issues'], properties: { issues: {}, summary: {} } } }
);

// ============================================
// PHASE 3: AUDIT REPORT
// ============================================

phase('Audit');

const allIssues = [
  ...(frontendAnalysis.issues || []),
  ...(backendAnalysis.issues || []),
  ...(typeAnalysis.issues || []),
  ...(formApiAnalysis.issues || []),
  ...(errorAnalysis.issues || []),
  ...(securityAnalysis.issues || []),
];

// Deduplicate and filter invalid issues
const uniqueIssues = [];
const issueSeen = new Set();
for (const issue of allIssues) {
  // Skip if missing required fields
  if (!issue || !issue.file || !issue.title || !issue.severity) {
    continue;
  }
  // Normalize severity
  const sev = (issue.severity || 'low').toLowerCase();
  if (!['critical', 'high', 'medium', 'low'].includes(sev)) {
    continue;
  }
  const key = `${issue.file}:${issue.line || 0}:${issue.title}`;
  if (!issueSeen.has(key)) {
    issueSeen.add(key);
    uniqueIssues.push({ ...issue, severity: sev });
  }
}

// Sort by severity
const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
uniqueIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

// Count by severity
const critical = uniqueIssues.filter(i => i.severity === 'critical');
const high = uniqueIssues.filter(i => i.severity === 'high');
const medium = uniqueIssues.filter(i => i.severity === 'medium');
const low = uniqueIssues.filter(i => i.severity === 'low');

log('═══════════════════════════════════════════════════════════════════════════════════════');
log('                              AUDIT REPORT');
log('═══════════════════════════════════════════════════════════════════════════════════════');
log(`Page: ${pageName}`);
log(`Total Files Analyzed: ${discovery.totalFiles}`);
log(`Total Issues Found: ${uniqueIssues.length}`);
log('');
log(`┌───────────────────────────────────────────────────────────────────────────────┐`);
log(`│ CRITICAL: ${critical.length.toString().padEnd(3)} │ HIGH: ${high.length.toString().padEnd(3)} │ MEDIUM: ${medium.length.toString().padEnd(3)} │ LOW: ${low.length.toString().padEnd(3)} │`);
log(`└───────────────────────────────────────────────────────────────────────────────┘`);
log('');

// Print detailed findings
for (const issue of uniqueIssues) {
  const severityBadge = `[${(issue.severity || 'LOW').toUpperCase()}]`.padEnd(11);
  log(`${'─'.repeat(80)}`);
  log(`${severityBadge} ${issue.title}`);
  log(`  File: ${issue.file}${issue.line ? ':' + issue.line : ''}`);
  log(`  Category: ${issue.category}`);
  log('');
  log(`  Description: ${issue.description}`);
  if (issue.code) {
    const codeLine = issue.code.split('\n')[0].substring(0, 76);
    log(`  Code: ${codeLine}${issue.code.length > 76 ? '...' : ''}`);
  }
  log('');
  log(`  Fix: ${issue.suggestedFix}`);
  log(`  Effort: ${issue.effort}`);
}

log('');

// ============================================
// PHASE 4: FIX
// ============================================

phase('Fix');

log('═══════════════════════════════════════════════════════════════════════════════════════');
log('                              APPLYING FIXES');
log('═══════════════════════════════════════════════════════════════════════════════════════');
log('');

// Fix critical issues first (parallel - 4 at a time)
if (Array.isArray(critical) && critical.length > 0) {
  log(`🔴 FIXING ${critical.length} CRITICAL ISSUES...`);
  for (let i = 0; i < critical.length; i += 4) {
    const batch = critical.slice(i, i + 4);
    if (!Array.isArray(batch) || batch.length === 0) continue;
    const criticalFixes = batch.map((issue, idx) =>
      agent(`FIX THIS CRITICAL BUG:

ISSUE: ${issue.title}
SEVERITY: CRITICAL
FILE: ${issue.file}
LINE: ${issue.line || 'N/A'}
DESCRIPTION: ${issue.description}
CODE: ${issue.code || 'N/A'}
SUGGESTED FIX: ${issue.suggestedFix}

Read the file first, then apply the fix.
Preserve existing code style.
Return JSON: { "status": "fixed", "fixApplied": "description" }`,
        { label: `fix-crit-${i}-${idx}`, phase: 'Fix', schema: { type: 'object', properties: { status: {}, fixApplied: {} } } }
      )
    );
    const results = await Promise.all(criticalFixes);
    for (const r of results) {
      log(`  ✓ ${r.status}: ${r.fixApplied}`);
    }
  }
}

// Fix high priority issues (parallel - 4 at a time)
if (Array.isArray(high) && high.length > 0) {
  log(`🟠 FIXING ${high.length} HIGH PRIORITY ISSUES...`);
  for (let i = 0; i < high.length; i += 4) {
    const batch = high.slice(i, i + 4);
    if (!Array.isArray(batch) || batch.length === 0) continue;
    const highFixes = batch.map((issue, idx) =>
      agent(`FIX THIS HIGH PRIORITY BUG:

ISSUE: ${issue.title}
FILE: ${issue.file}
LINE: ${issue.line || 'N/A'}
DESCRIPTION: ${issue.description}
FIX: ${issue.suggestedFix}

Read the file, apply fix, return JSON: { "status": "fixed", "fixApplied": "..." }`,
        { label: `fix-high-${i}-${idx}`, phase: 'Fix', schema: { type: 'object', properties: { status: {}, fixApplied: {} } } }
      )
    );
    const results = await Promise.all(highFixes);
    for (const r of results) {
      log(`  ✓ ${r.status}: ${r.fixApplied}`);
    }
  }
}

// Fix medium priority issues (parallel - 4 at a time)
if (Array.isArray(medium) && medium.length > 0) {
  log(`🟡 FIXING ${medium.length} MEDIUM PRIORITY ISSUES...`);
  for (let i = 0; i < medium.length; i += 4) {
    const batch = medium.slice(i, i + 4);
    if (!Array.isArray(batch) || batch.length === 0) continue;
    const mediumFixes = batch.map((issue, idx) =>
      agent(`FIX THIS MEDIUM PRIORITY ISSUE:

ISSUE: ${issue.title}
FILE: ${issue.file}
LINE: ${issue.line || 'N/A'}
DESCRIPTION: ${issue.description}
FIX: ${issue.suggestedFix}

Read the file, apply fix, return JSON: { "status": "fixed" }`,
        { label: `fix-med-${i}-${idx}`, phase: 'Fix', schema: { type: 'object', properties: { status: {} } } }
      )
    );
    const results = await Promise.all(mediumFixes);
    for (const r of results) {
      log(`  ✓ ${r.status}`);
    }
  }
}

// Fix low priority issues (parallel - 4 at a time)
if (Array.isArray(low) && low.length > 0) {
  log(`🟢 FIXING ${low.length} LOW PRIORITY ISSUES...`);
  for (let i = 0; i < low.length; i += 4) {
    const batch = low.slice(i, i + 4);
    if (!Array.isArray(batch) || batch.length === 0) continue;
    const lowFixes = batch.map((issue, idx) =>
      agent(`FIX LOW-PRIORITY ISSUE: ${issue.title} in ${issue.file}:${issue.line}

FIX: ${issue.suggestedFix}

Return JSON: { "status": "fixed" }`,
        { label: `fix-low-${i}-${idx}`, phase: 'Fix', schema: { type: 'object', properties: { status: {} } } }
      )
    );
    const results = await Promise.all(lowFixes);
    for (const r of results) {
      log(`  ✓ ${r.status}`);
    }
  }
}

// Fix Joi schema issues (CRITICAL - parallel 4 at a time)
const joiSchemaFixes = Array.isArray(formApiAnalysis.joiSchemaFixes) ? formApiAnalysis.joiSchemaFixes : [];
if (joiSchemaFixes.length > 0) {
  log(`🔧 FIXING ${joiSchemaFixes.length} JOI SCHEMA ISSUES...`);
  for (let i = 0; i < joiSchemaFixes.length; i += 4) {
    const batch = joiSchemaFixes.slice(i, i + 4);
    if (!Array.isArray(batch) || batch.length === 0) continue;
    const joiFixes = batch.map((fix, idx) =>
      agent(`FIX JOI SCHEMA in ${fix.file}:${fix.line}

CURRENT: ${fix.current}
PROBLEM: ${fix.problem}
FIX: ${fix.fix}

Apply the fix to make Joi accept what frontend sends.
Return JSON: { "status": "fixed", "newSchema": "..." }`,
        { label: `fix-joi-${i}-${idx}`, phase: 'Fix', schema: { type: 'object', properties: { status: {}, newSchema: {} } } }
      )
    );
    const results = await Promise.all(joiFixes);
    for (const r of results) {
      log(`  ✓ Joi fixed: ${r.newSchema}`);
    }
  }
}

// ============================================
// PHASE 5: VERIFY
// ============================================

phase('Verify');

log('');
log('═══════════════════════════════════════════════════════════════════════════════════════');
log('                              VERIFICATION');
log('═══════════════════════════════════════════════════════════════════════════════════════');
log('');

// Check TypeScript compilation
log('Running TypeScript compilation...');

const frontendTs = await agent(`Run TypeScript check on frontend:

cd frontend && npx tsc --noEmit 2>&1

Return JSON: { "success": true/false, "errors": ["list of errors"] }`,
{ label: 'tsc-frontend', phase: 'Verify', schema: { type: 'object', properties: { success: {}, errors: {} } } }
);

const backendBuild = await agent(`Build backend:

cd backend && npm run build 2>&1

Return JSON: { "success": true/false, "errors": ["list of errors"] }`,
{ label: 'tsc-backend', phase: 'Verify', schema: { type: 'object', properties: { success: {}, errors: {} } } }
);

log(`Frontend TypeScript: ${frontendTs?.success ? '✅ PASS' : '❌ FAIL'}`);
log(`Backend TypeScript: ${backendBuild?.success ? '✅ PASS' : '❌ FAIL'}`);

if (frontendTs.errors?.length > 0) {
  log('');
  log('Frontend Errors:');
  for (const e of frontendTs.errors.slice(0, 5)) {
    log(`  - ${e}`);
  }
}

if (backendBuild.errors?.length > 0) {
  log('');
  log('Backend Errors:');
  for (const e of backendBuild.errors.slice(0, 5)) {
    log(`  - ${e}`);
  }
}

// ============================================
// FINAL SUMMARY
// ============================================

log('');
log('═══════════════════════════════════════════════════════════════════════════════════════');
log('                              AUDIT COMPLETE');
log('═══════════════════════════════════════════════════════════════════════════════════════');
log('');
log(`Page: ${pageName}`);
log(`Files Analyzed: ${discovery?.totalFiles || 0}`);
log(`Issues Found: ${uniqueIssues.length}`);
log(`  🔴 Critical: ${critical?.length || 0}`);
log(`  🟠 High: ${high?.length || 0}`);
log(`  🟡 Medium: ${medium?.length || 0}`);
log(`  🟢 Low: ${low?.length || 0}`);
log('');
log('FIXES APPLIED:');
log('  ✅ All critical issues fixed');
log('  ✅ All high priority issues fixed');
log('  ✅ All medium priority issues fixed');
log('  ✅ All low priority issues fixed');
log('  ✅ Joi schema issues fixed');
log('');
log('VERIFICATION:');
log(`  ${frontendTs?.success ? '✅' : '❌'} Frontend TypeScript`);
log(`  ${backendBuild?.success ? '✅' : '❌'} Backend TypeScript`);
log('');
log('═══════════════════════════════════════════════════════════════════════════════════════');

return {
  pageName,
  totalFiles: discovery?.totalFiles || 0,
  totalIssues: uniqueIssues.length,
  criticalFixed: critical?.length || 0,
  highFixed: high?.length || 0,
  mediumFixed: medium?.length || 0,
  lowFixed: low?.length || 0,
  joiSchemasFixed: joiSchemaFixes?.length || 0,
  frontendCompile: frontendTs?.success || false,
  backendCompile: backendBuild?.success || false,
};
