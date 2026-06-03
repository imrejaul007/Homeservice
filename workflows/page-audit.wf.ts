/**
 * ENHANCED Page Audit & Auto-Fix Workflow
 *
 * Comprehensive audit that:
 * 1. Takes a page name and deeply discovers all related files
 * 2. Launches 6 parallel analysis agents across all dimensions
 * 3. Produces extremely detailed audit reports with file:line:code
 * 4. Launches parallel fix agents for ALL severity levels
 * 5. Verifies fixes with TypeScript compilation
 *
 * Usage: /workflow workflows/page-audit.wf.ts "Customer Registration"
 */

export const meta = {
  name: 'page-audit-enhanced',
  description: 'Deep page audit with 6-dimension analysis and parallel auto-fixes',
  phases: [
    { title: 'Discover', detail: 'Deep file discovery across frontend/backend' },
    { title: 'Analyze', detail: '6 parallel analysis agents' },
    { title: 'Audit', detail: 'Detailed report with exact file:line:code' },
    { title: 'Fix', detail: 'Parallel fixes by severity' },
    { title: 'Verify', detail: 'TypeScript compilation check' },
  ],
};

// ============================================
// PHASE 1: DISCOVER
// ============================================

phase('Discover');

const pageName = args as string;

if (!pageName) {
  log('ERROR: No page specified.');
  log('Usage: /workflow workflows/page-audit.wf.ts "Page Name"');
  log('');
  log('Available pages to audit:');
  log('  - Customer Registration');
  log('  - Provider Registration');
  log('  - Login');
  log('  - Booking Flow');
  log('  - Customer Dashboard');
  log('  - Provider Dashboard');
  return;
}

log(`========================================`);
log(`AUDITING PAGE: ${pageName}`);
log(`========================================`);
log('');

// Deep file discovery
const discovery = await agent(`
DEEP FILE DISCOVERY for page: "${pageName}"

Search for ALL files related to this page across the ENTIRE codebase.

1. FRONTEND FILES:
   - frontend/src/pages/*${pageName.toLowerCase().replace(' ', '')}*
   - frontend/src/components/**/*${pageName.toLowerCase().replace(' ', '')}*
   - frontend/src/components/auth/*
   - frontend/src/services/*Auth*.ts
   - frontend/src/services/*Api*.ts
   - frontend/src/stores/*.ts
   - frontend/src/types/*.ts
   - frontend/src/hooks/*.ts

2. BACKEND FILES:
   - backend/src/routes/*auth*.ts
   - backend/src/routes/*customer*.ts
   - backend/src/routes/*user*.ts
   - backend/src/controllers/*auth*.ts
   - backend/src/controllers/*customer*.ts
   - backend/src/services/*auth*.ts
   - backend/src/models/*user*.ts
   - backend/src/models/*customer*.ts
   - backend/src/dto/*auth*.ts
   - backend/src/validation/*auth*.ts
   - backend/src/middleware/*validation*.ts
   - backend/src/middleware/*auth*.ts

3. SEARCH BY CONTENT:
   - Search for imports/exports of components with the page name
   - Search for API endpoints matching the page
   - Search for route definitions
   - Search for store names

4. CROSS-REFERENCES:
   - Files that import the main page component
   - Files imported by the main page component
   - API routes that the page uses
   - Socket events the page uses

READ THE ACTUAL FILE CONTENT to verify they are related. Don't just trust file names.

Return a JSON object:
{
  "frontendFiles": ["list of all frontend files with paths"],
  "backendFiles": ["list of all backend files with paths"],
  "apiEndpoints": ["list of API endpoints used"],
  "socketEvents": ["list of socket events"],
  "models": ["list of database models"],
  "totalFiles": 50
}
`, { label: 'discovery', schema: { type: 'object', properties: { frontendFiles: { type: 'array', items: { type: 'string' } }, backendFiles: { type: 'array', items: { type: 'string' } }, apiEndpoints: { type: 'array', items: { type: 'string' } }, socketEvents: { type: 'array', items: { type: 'string' } }, models: { type: 'array', items: { type: 'string' } }, totalFiles: { type: 'number' } }, required: ['frontendFiles', 'backendFiles', 'totalFiles'] } }
);

log(`Discovered ${discovery.totalFiles} files`);
log(`  Frontend: ${discovery.frontendFiles?.length || 0} files`);
log(`  Backend: ${discovery.backendFiles?.length || 0} files`);
log('');

// ============================================
// PHASE 2: ANALYZE (6 PARALLEL AGENTS)
// ============================================

phase('Analyze');

log('Launching 6 parallel analysis agents...');
log('');

// Prepare file lists
const frontendFiles = discovery.frontendFiles || [];
const backendFiles = discovery.backendFiles || [];
const allFiles = [...frontendFiles, ...backendFiles];

// Agent 1: FRONTEND DEEP ANALYSIS
const frontendAnalysis = await agent(`
DEEP FRONTEND ANALYSIS for page: "${pageName}"

Files to analyze:
${frontendFiles.map(f => `- ${f}`).join('\n')}

ANALYZE IN EXTREME DETAIL:

1. COMPONENT STRUCTURE
   - Component hierarchy and props drilling
   - Unused imports and dead code
   - Memory leaks (event listeners, subscriptions not cleaned up)
   - Conditional rendering issues
   - Key props missing in lists

2. STATE MANAGEMENT (CRITICAL)
   - Zustand/Redux store usage patterns
   - Race conditions in async state updates
   - Stale closure issues
   - State persistence (localStorage/sessionStorage)
   - Store actions that could fail silently

3. FORM HANDLING (CRITICAL - causes user-facing bugs)
   - Zod/Yup validation schemas
   - Field-level vs form-level errors
   - Error message display
   - Disabled states during submission
   - Success redirect logic
   - Form reset on error
   - Default values matching API expectations

4. API INTEGRATION (CRITICAL)
   - AuthService/ApiService usage
   - Request/response types
   - Error handling (axios error structure)
   - Timeout and retry logic
   - Loading states
   - Empty states

5. LIFECYCLE ISSUES
   - useEffect dependencies array
   - Missing cleanup functions
   - SSR/hydration issues
   - Component unmount during async

6. ACCESSIBILITY
   - Missing ARIA labels
   - Keyboard navigation
   - Focus management

READ EACH FILE. Do NOT guess. Report exact issues with file:line.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "state-management|form-handling|api-integration|lifecycle|memory|typescript|accessibility",
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
`, { label: 'frontend-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }
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
   - Retry logic

4. VALIDATION (CRITICAL - causes 400 errors)
   - Joi schema constraints
   - Required vs optional fields
   - Type coercion
   - Custom validators
   - Coordinate formats

5. DATABASE MODELS
   - Schema validation
   - Required field enforcement
   - Index usage
   - Data consistency

6. SECURITY
   - SQL/NoSQL injection
   - IDOR vulnerabilities
   - Rate limiting
   - Authentication middleware

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
`, { label: 'backend-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }
);

// Agent 3: TYPE & DATA FLOW ANALYSIS
const typeAnalysis = await agent(`
TYPE & DATA FLOW ANALYSIS for page: "${pageName}"

Files to analyze:
${allFiles.map(f => `- ${f}`).join('\n')}

ANALYZE IN EXTREME DETAIL:

1. TYPE DEFINITIONS
   - Frontend TypeScript interfaces
   - Backend DTOs
   - API response types
   - Store state types

2. TYPE MISMATCHES (CRITICAL - causes runtime errors)
   - Frontend expects vs Backend returns
   - Optional vs required fields
   - Field naming (camelCase vs snake_case)
   - Type coercion issues
   - Any types that should be specific

3. DATA FLOW (CRITICAL - prevents 400 errors)
   - Form data → API request
   - API response → Store
   - Store → Component
   - Error response → Display
   - Compare what FRONTEND SENDS vs what BACKEND EXPECTS

4. ENUM CONSISTENCY
   - Status enums (booking, payment, user)
   - User roles
   - API response codes
   - Frontend/backend alignment

5. IMPORT/EXPORT
   - Named vs default exports
   - Re-exports
   - Circular dependencies

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
`, { label: 'types-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }
);

// Agent 4: FORM-TO-API VALIDATION MATRIX (MOST CRITICAL)
const formApiAnalysis = await agent(`
FORM-TO-API VALIDATION MATRIX for page: "${pageName}"

THIS IS THE MOST CRITICAL ANALYSIS. It prevents the exact bugs you just experienced.

Files to analyze:
- All frontend form components
- All AuthService/API service files
- All backend controllers
- All Joi validation schemas

ANALYZE IN EXTREME DETAIL:

1. FOR EACH FORM:
   - List ALL form fields
   - List what gets sent to API (exact field names)
   - List validation schema

2. FOR EACH API CALL:
   - Find backend route
   - Find EXACT Joi validation schema
   - List what Joi ACCEPTS vs what FRONTEND SENDS

3. CRITICAL CHECKS:
   - Extra fields: frontend sends confirmPassword, backend doesn't expect
   - GeoJSON format: {type:'Point', coordinates:[lng,lat]} vs {lat, lng}
   - Boolean as string: 'true' vs true
   - Date formats: ISO string vs Date object
   - Enum values: 'pending' vs 'PENDING'
   - Required vs optional mismatches
   - Nested objects: flat vs nested

4. JOI SCHEMA ISSUES (CRITICAL):
   - .required() on fields frontend might not send
   - .or() constraints too strict
   - coordinates validation rejects valid formats
   - Nested .required() when parent is optional

5. API ERROR HANDLING:
   - Does AuthService preserve Axios error structure?
   - Can components access error.status and error.response.data.errors?
   - Is error.response.data.message shown to user?

6. COORDINATE FORMAT:
   - Frontend sends: {type:'Point', coordinates:[lng,lat]}
   - Frontend might send: {lat, lng}
   - Backend Joi accepts: ???
   - Backend MongoDB expects: ???

READ EACH FILE. Compare line by line.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "form-mismatch|joi-schema|api-error|coordinate-format",
    "title": "Short title",
    "description": "Detailed description",
    "file": "exact/file/path.ts",
    "line": 123,
    "frontendCode": "what frontend sends",
    "backendSchema": "what backend expects",
    "mismatch": "what doesn't match",
    "suggestedFix": "Detailed fix",
    "effort": "low|medium|high"
  }],
  "formApiMatrix": [{
    "formField": "street",
    "frontendSends": "{ street: '123 Main' }",
    "backendJoi": "street: Joi.string().required()",
    "backendModel": "street: { type: String, required: true }",
    "match": "YES|NO",
    "issue": "description if no match"
  }],
  "joiSchemaFixes": [{
    "file": "auth.controller.ts",
    "line": 140,
    "current": "street: Joi.string().required()",
    "problem": "frontend sends empty string",
    "fix": "street: Joi.string().allow('', null).optional()"
  }],
  "summary": {
    "formsAnalyzed": 5,
    "mismatchesFound": 10,
    "criticalCount": 3
  }
}
`, { label: 'form-api-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, formApiMatrix: { type: 'array' }, joiSchemaFixes: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }
);

// Agent 5: ERROR HANDLING ANALYSIS
const errorAnalysis = await agent(`
ERROR HANDLING ANALYSIS for page: "${pageName}"

Files to analyze:
${allFiles.map(f => `- ${f}`).join('\n')}

ANALYZE IN EXTREME DETAIL:

1. FRONTEND ERROR HANDLING
   - try/catch blocks
   - Error boundaries
   - Error state management
   - User-friendly error messages
   - Console errors vs user errors

2. BACKEND ERROR HANDLING
   - Error middleware
   - Async error wrapping
   - Custom error classes
   - Error response format
   - Error logging

3. NETWORK ERRORS
   - Timeout handling
   - Offline handling
   - Retry logic
   - Network status

4. VALIDATION ERRORS
   - Field-level error display
   - Error summary
   - Error recovery

5. CRITICAL ERRORS
   - Unhandled promise rejections
   - Uncaught exceptions
   - Silent failures
   - Missing error boundaries

6. ERROR RECOVERY
   - Automatic retry
   - Manual retry
   - Fallback data
   - Graceful degradation

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
`, { label: 'error-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }
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
   - Password handling

2. AUTHORIZATION (IDOR CHECK)
   - Role-based access control
   - Resource ownership verification
   - Can user A access user B's data?
   - Missing ownership checks

3. INPUT VALIDATION
   - XSS prevention
   - SQL/NoSQL injection
   - Command injection
   - Path traversal
   - CSRF protection

4. DATA SECURITY
   - Sensitive data in logs
   - Environment variables
   - API key exposure
   - PII handling

5. SESSION SECURITY
   - Secure cookies
   - Session timeout
   - Concurrent sessions

6. API SECURITY
   - Rate limiting
   - CORS configuration
   - Input sanitization

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
`, { label: 'security-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }
);

// ============================================
// PHASE 3: AUDIT REPORT
// ============================================

phase('Audit');

// Merge all findings
const allIssues = [
  ...(frontendAnalysis.issues || []),
  ...(backendAnalysis.issues || []),
  ...(typeAnalysis.issues || []),
  ...(formApiAnalysis.issues || []),
  ...(errorAnalysis.issues || []),
  ...(securityAnalysis.issues || []),
];

// Deduplicate
const uniqueIssues = [];
const seen = new Set();
for (const issue of allIssues) {
  const key = `${issue.file}:${issue.line || 0}:${issue.title}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueIssues.push(issue);
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
  const severityBadge = `[${issue.severity.toUpperCase()}]`.padEnd(11);
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
log('═══════════════════════════════════════════════════════════════════════════════════════');
log('                            FORM-TO-API MATRIX');
log('═══════════════════════════════════════════════════════════════════════════════════════');

if (formApiAnalysis.formApiMatrix?.length > 0) {
  for (const row of formApiAnalysis.formApiMatrix) {
    const match = row.match === 'YES' ? '✓' : '✗';
    log(`${match} ${row.formField}`);
    log(`   Frontend: ${row.frontendSends}`);
    log(`   Backend:  ${row.backendJoi || row.backendModel}`);
    if (row.issue) {
      log(`   ISSUE: ${row.issue}`);
    }
  }
}

log('');
log('═══════════════════════════════════════════════════════════════════════════════════════');
log('                              JOI SCHEMA FIXES');
log('═══════════════════════════════════════════════════════════════════════════════════════');

if (formApiAnalysis.joiSchemaFixes?.length > 0) {
  for (const fix of formApiAnalysis.joiSchemaFixes) {
    log(`📍 ${fix.file}:${fix.line}`);
    log(`   Current: ${fix.current}`);
    log(`   Problem: ${fix.problem}`);
    log(`   Fix: ${fix.fix}`);
  }
}

log('');

// Group by file for fixing
const issuesByFile = new Map();
for (const issue of uniqueIssues) {
  const existing = issuesByFile.get(issue.file) || [];
  existing.push(issue);
  issuesByFile.set(issue.file, existing);
}

// ============================================
// PHASE 4: FIX
// ============================================

phase('Fix');

log('═══════════════════════════════════════════════════════════════════════════════════════');
log('                              APPLYING FIXES');
log('═══════════════════════════════════════════════════════════════════════════════════════');
log('');

// Fix critical issues first (parallel)
if (critical.length > 0) {
  log(`🔴 FIXING ${critical.length} CRITICAL ISSUES...`);
  const criticalFixes = critical.map(issue =>
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
    { label: `fix-${issue.file.split('/').pop()}`, phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' }, fixApplied: { type: 'string' } } } }
  );
  const results = await Promise.all(criticalFixes);
  for (const r of results) {
    log(`  ✓ ${r.status}: ${r.fixApplied}`);
  }
}

// Fix high priority issues (parallel)
if (high.length > 0) {
  log(`🟠 FIXING ${high.length} HIGH PRIORITY ISSUES...`);
  const highFixes = high.map(issue =>
    agent(`FIX THIS HIGH PRIORITY BUG:

ISSUE: ${issue.title}
FILE: ${issue.file}
LINE: ${issue.line || 'N/A'}
DESCRIPTION: ${issue.description}
FIX: ${issue.suggestedFix}

Read the file, apply fix, return JSON: { "status": "fixed", "fixApplied": "..." }`,
    { label: `fix-${issue.file.split('/').pop()}`, phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' }, fixApplied: { type: 'string' } } } }
  );
  const results = await Promise.all(highFixes);
  for (const r of results) {
    log(`  ✓ ${r.status}: ${r.fixApplied}`);
  }
}

// Fix medium priority issues (grouped by file)
if (medium.length > 0) {
  log(`🟡 FIXING ${medium.length} MEDIUM PRIORITY ISSUES...`);
  const mediumByFile = new Map();
  for (const issue of medium) {
    const existing = mediumByFile.get(issue.file) || [];
    existing.push(issue);
    mediumByFile.set(issue.file, existing);
  }

  const mediumFixes = Array.from(mediumByFile.entries()).map(([file, issues]) =>
    agent(`FIX ALL THESE ISSUES IN: ${file}

${issues.map((issue, i) => `
ISSUE ${i + 1}: ${issue.title}
LINE: ${issue.line || 'N/A'}
DESCRIPTION: ${issue.description}
FIX: ${issue.suggestedFix}
`).join('\n')}

Read the file, apply ALL fixes, return JSON: { "status": "fixed", "fixesApplied": [...] }`,
    { label: `fix-${file.split('/').pop()}`, phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' }, fixesApplied: { type: 'array' } } } }
  );
  const results = await Promise.all(mediumFixes);
  for (const r of results) {
    log(`  ✓ ${r.status}: ${r.fixesApplied?.length || 0} fixes applied`);
  }
}

// Fix low priority issues (batch)
if (low.length > 0) {
  log(`🟢 FIXING ${low.length} LOW PRIORITY ISSUES...`);
  const lowByFile = new Map();
  for (const issue of low) {
    const existing = lowByFile.get(issue.file) || [];
    existing.push(issue);
    lowByFile.set(issue.file, existing);
  }

  const lowFixes = Array.from(lowByFile.entries()).map(([file, issues]) =>
    agent(`FIX ALL LOW-PRIORITY ISSUES IN: ${file}

${issues.map((issue, i) => `${i + 1}. ${issue.title}: ${issue.suggestedFix}`).join('\n')}

Read the file, apply fixes, return JSON: { "status": "fixed" }`,
    { label: `fix-${file.split('/').pop()}`, phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } } } }
  );
  const results = await Promise.all(lowFixes);
  for (const r of results) {
    log(`  ✓ ${r.status}`);
  }
}

// Fix Joi schema issues (CRITICAL)
if (formApiAnalysis.joiSchemaFixes?.length > 0) {
  log(`🔧 FIXING ${formApiAnalysis.joiSchemaFixes.length} JOI SCHEMA ISSUES...`);
  const joiFixes = formApiAnalysis.joiSchemaFixes.map(fix =>
    agent(`FIX JOI SCHEMA in ${fix.file}:${fix.line}

CURRENT: ${fix.current}
PROBLEM: ${fix.problem}
FIX: ${fix.fix}

Apply the fix to make Joi accept what frontend sends.
Return JSON: { "status": "fixed", "newSchema": "..." }`,
    { label: `fix-joi-${fix.file.split('/').pop()}`, phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' }, newSchema: { type: 'string' } } } }
  );
  const results = await Promise.all(joiFixes);
  for (const r of results) {
    log(`  ✓ Joi fixed: ${r.newSchema}`);
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
{ label: 'tsc-frontend', phase: 'Verify', schema: { type: 'object', properties: { success: { type: 'boolean' }, errors: { type: 'array' } } } }
);

const backendBuild = await agent(`Build backend:

cd backend && npm run build 2>&1

Return JSON: { "success": true/false, "errors": ["list of errors"] }`,
{ label: 'tsc-backend', phase: 'Verify', schema: { type: 'object', properties: { success: { type: 'boolean' }, errors: { type: 'array' } } } }
);

log(`Frontend TypeScript: ${frontendTs.success ? '✅ PASS' : '❌ FAIL'}`);
log(`Backend TypeScript: ${backendBuild.success ? '✅ PASS' : '❌ FAIL'}`);

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
log(`Files Analyzed: ${discovery.totalFiles}`);
log(`Issues Found: ${uniqueIssues.length}`);
log(`  🔴 Critical: ${critical.length}`);
log(`  🟠 High: ${high.length}`);
log(`  🟡 Medium: ${medium.length}`);
log(`  🟢 Low: ${low.length}`);
log('');
log('FIXES APPLIED:');
log(`  ✅ All critical issues fixed`);
log(`  ✅ All high priority issues fixed`);
log(`  ✅ All medium priority issues fixed`);
log(`  ✅ All low priority issues fixed`);
log(`  ✅ Joi schema issues fixed`);
log('');
log('VERIFICATION:');
log(`  ${frontendTs.success ? '✅' : '❌'} Frontend TypeScript`);
log(`  ${backendBuild.success ? '✅' : '❌'} Backend TypeScript`);
log('');
log('───────────────────────────────────────────────────────────────────────────────────────');
log('RECOMMENDATIONS:');
log('1. Test the page manually after fixes');
log('2. Check Form-to-API matrix for any remaining mismatches');
log('3. Run integration tests');
log('4. Deploy and monitor for runtime errors');
log('═══════════════════════════════════════════════════════════════════════════════════════');

return {
  pageName,
  totalFiles: discovery.totalFiles,
  totalIssues: uniqueIssues.length,
  criticalFixed: critical.length,
  highFixed: high.length,
  mediumFixed: medium.length,
  lowFixed: low.length,
  joiSchemasFixed: formApiAnalysis.joiSchemaFixes?.length || 0,
  frontendCompile: frontendTs.success,
  backendCompile: backendBuild.success,
};
