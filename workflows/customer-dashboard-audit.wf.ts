/**
 * Customer Dashboard Page Audit Workflow
 * Comprehensive audit with 6 parallel analysis agents
 */

export const meta = {
  name: 'customer-dashboard-audit',
  description: 'Deep page audit of Customer Dashboard',
  phases: [
    { title: 'Discover', detail: 'File discovery' },
    { title: 'Analyze', detail: '6 parallel analysis agents' },
    { title: 'Audit', detail: 'Detailed report' },
    { title: 'Fix', detail: 'Parallel fixes' },
    { title: 'Verify', detail: 'TypeScript check' },
  ],
};

phase('Discover');

const pageName = args;

log('========================================');
log('AUDITING: Customer Dashboard');
log('========================================');
log('');

const discovery = await agent('DEEP FILE DISCOVERY for Customer Dashboard page\n\nFind ALL files related to customer dashboard including:\n- frontend/src/pages/*dashboard*\n- frontend/src/pages/*customer*\n- frontend/src/components/customer/*\n- frontend/src/components/layout/*\n- frontend/src/services/*\n- frontend/src/stores/*\n- frontend/src/types/*\n- frontend/src/hooks/*\n- backend/src/routes/*booking*\n- backend/src/routes/*review*\n- backend/src/routes/*message*\n- backend/src/controllers/*\n- backend/src/services/*\n- backend/src/models/*\n- backend/src/middleware/*auth*\n\nREAD actual content to verify relevance. Return JSON with frontendFiles, backendFiles, apiEndpoints, socketEvents, models, totalFiles.',
{ label: 'discovery', schema: { type: 'object', properties: { frontendFiles: { type: 'array' }, backendFiles: { type: 'array' }, apiEndpoints: { type: 'array' }, socketEvents: { type: 'array' }, models: { type: 'array' }, totalFiles: { type: 'number' } }, required: ['frontendFiles', 'backendFiles', 'totalFiles'] } }
);

log('Discovered ' + discovery.totalFiles + ' files');
log('Frontend: ' + (discovery.frontendFiles?.length || 0) + ' files');
log('Backend: ' + (discovery.backendFiles?.length || 0) + ' files');
log('');

const frontendFiles = discovery.frontendFiles || [];
const backendFiles = discovery.backendFiles || [];
const allFiles = [...frontendFiles, ...backendFiles];

phase('Analyze');

log('Launching 6 parallel analysis agents...');
log('');

const frontendAnalysis = await agent('DEEP FRONTEND ANALYSIS for Customer Dashboard\n\nFiles:\n' + frontendFiles.join('\n') + '\n\nAnalyze:\n1. Component structure (props drilling, unused imports, memory leaks)\n2. State management (Zustand patterns, race conditions, stale closures)\n3. Data fetching (API calls, error handling, loading states)\n4. Lifecycle (useEffect deps, cleanup, unmount during async)\n5. Accessibility (ARIA, keyboard nav)\n\nREAD EACH FILE. Report exact issues with file:line.\n\nReturn JSON: { issues: [{ severity, category, title, description, file, line, code, suggestedFix, effort }], summary: { filesAnalyzed, issuesFound, criticalCount } }',
{ label: 'frontend', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }
);

const backendAnalysis = await agent('DEEP BACKEND ANALYSIS for Customer Dashboard\n\nFiles:\n' + backendFiles.join('\n') + '\n\nAnalyze:\n1. Route handlers (HTTP methods, middleware, logging)\n2. Controller logic (validation, auth checks, error responses)\n3. Service layer (N+1 queries, indexes, cache)\n4. Database models (schema validation, consistency)\n5. Security (injection, IDOR, rate limiting)\n\nREAD EACH FILE. Report exact issues with file:line.\n\nReturn JSON: { issues: [{ severity, category, title, description, file, line, code, suggestedFix, effort }], summary: { endpointsAnalyzed, validationsFound, criticalCount } }',
{ label: 'backend', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }
);

const typeAnalysis = await agent('TYPE & DATA FLOW ANALYSIS for Customer Dashboard\n\nFiles:\n' + allFiles.join('\n') + '\n\nAnalyze:\n1. Type definitions (interfaces, DTOs, response types)\n2. Type mismatches (frontend vs backend field names, optional vs required)\n3. Data flow (API response to Store to Component)\n4. Enum consistency (status values, user roles)\n\nREAD EACH FILE. Compare frontend vs backend types line by line.\n\nReturn JSON: { issues: [{ severity, category, title, description, frontendFile, backendFile, line, code, suggestedFix, effort }], summary: { typesCompared, mismatchesFound } }',
{ label: 'types', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }
);

const realtimeAnalysis = await agent('REAL-TIME & LIVE DATA ANALYSIS for Customer Dashboard\n\nFiles:\n' + allFiles.join('\n') + '\n\nAnalyze:\n1. Socket events (connection, listeners, cleanup)\n2. Live data handling (new bookings, status updates, messages)\n3. Polling fallbacks (interval cleanup)\n4. Notifications (toast, badges, counters)\n\nREAD EACH FILE. Find socket usage patterns.\n\nReturn JSON: { issues: [{ severity, category, title, description, file, line, code, suggestedFix, effort }], summary: { socketEventsFound, issuesFound } }',
{ label: 'realtime', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }
);

const errorAnalysis = await agent('ERROR HANDLING ANALYSIS for Customer Dashboard\n\nFiles:\n' + allFiles.join('\n') + '\n\nAnalyze:\n1. Frontend error handling (try/catch, error boundaries)\n2. Backend error handling (middleware, async wrapping)\n3. Network errors (timeout, offline, retry)\n4. Critical errors (unhandled rejections, silent failures)\n\nREAD EACH FILE. Find ALL error handling issues.\n\nReturn JSON: { issues: [{ severity, category, title, description, file, line, code, suggestedFix, effort }], summary: { errorHandlersFound, unhandledErrors, criticalCount } }',
{ label: 'errors', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }
);

const securityAnalysis = await agent('SECURITY ANALYSIS for Customer Dashboard\n\nFiles:\n' + allFiles.join('\n') + '\n\nAnalyze:\n1. Authentication (protected routes, token handling)\n2. Authorization (RBAC, resource ownership, IDOR)\n3. Input validation (XSS, injection, traversal)\n4. Data security (sensitive data in logs, PII)\n\nREAD EACH FILE. SECURITY-CRITICAL.\n\nReturn JSON: { issues: [{ severity, category, title, description, file, line, code, attackScenario, suggestedFix, effort }], summary: { authChecksFound, vulnerabilities, criticalCount } }',
{ label: 'security', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }
);

phase('Audit');

const allIssues = [
  ...(frontendAnalysis.issues || []),
  ...(backendAnalysis.issues || []),
  ...(typeAnalysis.issues || []),
  ...(realtimeAnalysis.issues || []),
  ...(errorAnalysis.issues || []),
  ...(securityAnalysis.issues || []),
];

// Deduplicate
const uniqueIssues = [];
const seen = new Set();
for (const issue of allIssues) {
  const key = issue.file + ':' + (issue.line || 0) + ':' + issue.title;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueIssues.push(issue);
  }
}

// Sort by severity
const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
uniqueIssues.sort(function(a, b) { return severityOrder[a.severity] - severityOrder[b.severity]; });

const critical = uniqueIssues.filter(function(i) { return i.severity === 'critical'; });
const high = uniqueIssues.filter(function(i) { return i.severity === 'high'; });
const medium = uniqueIssues.filter(function(i) { return i.severity === 'medium'; });
const low = uniqueIssues.filter(function(i) { return i.severity === 'low'; });

log('================================================================================');
log('                              AUDIT REPORT');
log('================================================================================');
log('Page: Customer Dashboard');
log('Files Analyzed: ' + discovery.totalFiles);
log('Issues Found: ' + uniqueIssues.length);
log('');
log('CRITICAL: ' + critical.length + ' | HIGH: ' + high.length + ' | MEDIUM: ' + medium.length + ' | LOW: ' + low.length);
log('');

for (var i = 0; i < uniqueIssues.length; i++) {
  var issue = uniqueIssues[i];
  log('------------------------------------------------------------------------------');
  log('[' + issue.severity.toUpperCase() + '] ' + issue.title);
  log('  File: ' + issue.file + (issue.line ? ':' + issue.line : ''));
  log('  Category: ' + issue.category);
  log('');
  log('  ' + issue.description);
  if (issue.code) {
    var codeLine = issue.code.split('\n')[0].substring(0, 76);
    log('  Code: ' + codeLine);
  }
  log('');
  log('  Fix: ' + issue.suggestedFix);
  log('  Effort: ' + issue.effort);
}

log('');

phase('Fix');

log('================================================================================');
log('                              APPLYING FIXES');
log('================================================================================');
log('');

if (critical.length > 0) {
  log('FIXING ' + critical.length + ' CRITICAL ISSUES...');
  var criticalFixes = critical.map(function(issue) {
    return agent('FIX CRITICAL BUG:\n\nISSUE: ' + issue.title + '\nFILE: ' + issue.file + '\nLINE: ' + (issue.line || 'N/A') + '\nDESCRIPTION: ' + issue.description + '\nCODE: ' + (issue.code || 'N/A') + '\nFIX: ' + issue.suggestedFix + '\n\nRead file, apply fix, return JSON: { "status": "fixed", "fixApplied": "description" }',
    { label: 'fix-critical', phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' }, fixApplied: { type: 'string' } } } }
    );
  });
  var results = await Promise.all(criticalFixes);
  for (var j = 0; j < results.length; j++) {
    log('  [OK] ' + results[j].status);
  }
}

if (high.length > 0) {
  log('FIXING ' + high.length + ' HIGH PRIORITY ISSUES...');
  var highFixes = high.map(function(issue) {
    return agent('FIX HIGH PRIORITY BUG:\n\nISSUE: ' + issue.title + '\nFILE: ' + issue.file + '\nLINE: ' + (issue.line || 'N/A') + '\nDESCRIPTION: ' + issue.description + '\nFIX: ' + issue.suggestedFix + '\n\nRead file, apply fix, return JSON: { "status": "fixed", "fixApplied": "..." }',
    { label: 'fix-high', phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' }, fixApplied: { type: 'string' } } } }
    );
  });
  var highResults = await Promise.all(highFixes);
  for (var k = 0; k < highResults.length; k++) {
    log('  [OK] ' + highResults[k].status);
  }
}

if (medium.length > 0) {
  log('FIXING ' + medium.length + ' MEDIUM PRIORITY ISSUES...');
  var mediumByFile = new Map();
  for (var m = 0; m < medium.length; m++) {
    var issue = medium[m];
    var existing = mediumByFile.get(issue.file) || [];
    existing.push(issue);
    mediumByFile.set(issue.file, existing);
  }

  var mediumFixes = [];
  mediumByFile.forEach(function(issues, file) {
    mediumFixes.push(agent('FIX ISSUES IN: ' + file + '\n\n' + issues.map(function(iss, idx) { return 'ISSUE ' + (idx+1) + ': ' + iss.title + '\nLINE: ' + (iss.line || 'N/A') + '\nDESCRIPTION: ' + iss.description + '\nFIX: ' + iss.suggestedFix; }).join('\n\n') + '\n\nRead file, apply ALL fixes, return JSON: { "status": "fixed", "fixesApplied": [...] }',
    { label: 'fix-medium', phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' }, fixesApplied: { type: 'array' } } } }
    ));
  });
  var medResults = await Promise.all(mediumFixes);
  for (var n = 0; n < medResults.length; n++) {
    log('  [OK] ' + medResults[n].status);
  }
}

if (low.length > 0) {
  log('FIXING ' + low.length + ' LOW PRIORITY ISSUES...');
  var lowByFile = new Map();
  for (var p = 0; p < low.length; p++) {
    var lowIssue = low[p];
    var lowExisting = lowByFile.get(lowIssue.file) || [];
    lowExisting.push(lowIssue);
    lowByFile.set(lowIssue.file, lowExisting);
  }

  var lowFixes = [];
  lowByFile.forEach(function(issues, file) {
    lowFixes.push(agent('FIX LOW-PRIORITY ISSUES IN: ' + file + '\n\n' + issues.map(function(iss, idx) { return (idx+1) + '. ' + iss.title + ': ' + iss.suggestedFix; }).join('\n') + '\n\nRead file, apply fixes, return JSON: { "status": "fixed" }',
    { label: 'fix-low', phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } } } }
    ));
  });
  var lowResults = await Promise.all(lowFixes);
  for (var q = 0; q < lowResults.length; q++) {
    log('  [OK] ' + lowResults[q].status);
  }
}

phase('Verify');

log('');
log('================================================================================');
log('                              VERIFICATION');
log('================================================================================');
log('');

log('Running TypeScript compilation...');

var frontendTs = await agent('Run: cd frontend && npx tsc --noEmit\nReturn JSON: { "success": true/false, "errors": [] }',
{ label: 'tsc-fe', phase: 'Verify', schema: { type: 'object', properties: { success: { type: 'boolean' }, errors: { type: 'array' } } } }
);

var backendBuild = await agent('Run: cd backend && npm run build\nReturn JSON: { "success": true/false, "errors": [] }',
{ label: 'tsc-be', phase: 'Verify', schema: { type: 'object', properties: { success: { type: 'boolean' }, errors: { type: 'array' } } } }
);

log('Frontend TypeScript: ' + (frontendTs.success ? 'PASS' : 'FAIL'));
log('Backend TypeScript: ' + (backendBuild.success ? 'PASS' : 'FAIL'));

if (frontendTs.errors && frontendTs.errors.length > 0) {
  log('Frontend Errors:');
  for (var r = 0; r < Math.min(5, frontendTs.errors.length); r++) {
    log('  - ' + frontendTs.errors[r]);
  }
}

if (backendBuild.errors && backendBuild.errors.length > 0) {
  log('Backend Errors:');
  for (var s = 0; s < Math.min(5, backendBuild.errors.length); s++) {
    log('  - ' + backendBuild.errors[s]);
  }
}

log('');
log('================================================================================');
log('                              AUDIT COMPLETE');
log('================================================================================');
log('');
log('Page: Customer Dashboard');
log('Files Analyzed: ' + discovery.totalFiles);
log('Issues Found: ' + uniqueIssues.length);
log('  Critical: ' + critical.length);
log('  High: ' + high.length);
log('  Medium: ' + medium.length);
log('  Low: ' + low.length);
log('');
log('VERIFICATION:');
log('  Frontend TypeScript: ' + (frontendTs.success ? 'PASS' : 'FAIL'));
log('  Backend TypeScript: ' + (backendBuild.success ? 'PASS' : 'FAIL'));
log('================================================================================');

return {
  pageName: 'Customer Dashboard',
  totalFiles: discovery.totalFiles,
  totalIssues: uniqueIssues.length,
  criticalFixed: critical.length,
  highFixed: high.length,
  mediumFixed: medium.length,
  lowFixed: low.length,
  frontendCompile: frontendTs.success,
  backendCompile: backendBuild.success,
};
