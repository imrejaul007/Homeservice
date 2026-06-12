/**
 * Provider Dashboard Page Audit Workflow
 */

export const meta = {
  name: 'page-audit-provider-dashboard',
  description: 'Deep audit of Provider Dashboard page',
  phases: [
    { title: 'Discover', detail: 'Deep file discovery' },
    { title: 'Analyze', detail: '4 parallel analysis agents' },
    { title: 'Audit', detail: 'Detailed report' },
    { title: 'Fix', detail: 'Parallel fixes by severity' },
    { title: 'Verify', detail: 'TypeScript compilation' },
  ],
};

phase('Discover');

const pageName = args;

log(`========================================`);
log(`AUDITING PAGE: ${pageName}`);
log(`========================================`);

const discovery = await agent(`
DEEP FILE DISCOVERY for page: "${pageName}"

Search for ALL files related to Provider Dashboard:

1. FRONTEND FILES:
   - frontend/src/pages/*provider*
   - frontend/src/pages/*dashboard*
   - frontend/src/components/**/*provider*
   - frontend/src/components/**/*dashboard*
   - frontend/src/components/**/*booking*
   - frontend/src/services/*booking*.ts
   - frontend/src/stores/*.ts
   - frontend/src/types/*.ts

2. BACKEND FILES:
   - backend/src/routes/*provider*.ts
   - backend/src/routes/*booking*.ts
   - backend/src/routes/*dashboard*.ts
   - backend/src/controllers/*provider*.ts
   - backend/src/controllers/*booking*.ts
   - backend/src/services/*booking*.ts
   - backend/src/models/*booking*.ts
   - backend/src/models/*provider*.ts

READ THE ACTUAL FILE CONTENT to verify they are related.

Return JSON:
{
  "frontendFiles": ["list of frontend files with paths"],
  "backendFiles": ["list of backend files with paths"],
  "apiEndpoints": ["list of API endpoints used"],
  "models": ["list of database models"],
  "totalFiles": 50
}
`, { label: 'discovery', schema: { type: 'object', properties: { frontendFiles: { type: 'array', items: { type: 'string' } }, backendFiles: { type: 'array', items: { type: 'string' } }, apiEndpoints: { type: 'array', items: { type: 'string' } }, models: { type: 'array', items: { type: 'string' } }, totalFiles: { type: 'number' } }, required: ['frontendFiles', 'backendFiles', 'totalFiles'] } });

log(`Discovered ${discovery.totalFiles} files`);
log(`Frontend: ${discovery.frontendFiles?.length || 0} files`);
log(`Backend: ${discovery.backendFiles?.length || 0} files`);

phase('Analyze');

const frontendFiles = discovery.frontendFiles || [];
const backendFiles = discovery.backendFiles || [];
const allFiles = [...frontendFiles, ...backendFiles];

log('Launching 4 parallel analysis agents...');

const [frontendAnalysis, backendAnalysis, typeAnalysis, formApiAnalysis] = await Promise.all([
  agent(`
DEEP FRONTEND ANALYSIS for page: "${pageName}"
Files to analyze:
${frontendFiles.map(f => `- ${f}`).join('\n')}

ANALYZE IN EXTREME DETAIL:
1. Component structure and hierarchy
2. State management (Zustand/store usage)
3. Form handling and validation
4. API integration (axios/fetch calls)
5. Lifecycle issues
6. TypeScript strict mode compliance

READ EACH FILE. Report exact issues with file:line.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "state-management|form-handling|api-integration|lifecycle|memory|typescript",
    "title": "Short title",
    "description": "Detailed description",
    "file": "exact/file/path.tsx",
    "line": 123,
    "code": "problematic code",
    "suggestedFix": "Detailed fix",
    "effort": "low|medium|high"
  }],
  "summary": { "filesAnalyzed": 10, "issuesFound": 15, "criticalCount": 3 }
}
`, { label: 'frontend-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }),

  agent(`
DEEP BACKEND ANALYSIS for page: "${pageName}"
Files to analyze:
${backendFiles.map(f => `- ${f}`).join('\n')}

ANALYZE IN EXTREME DETAIL:
1. Route handlers and middleware
2. Controller logic and validation
3. Service layer and database queries
4. Joi validation schemas
5. Database models
6. Security checks

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
  "summary": { "endpointsAnalyzed": 10, "validationsFound": 15, "criticalCount": 3 }
}
`, { label: 'backend-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }),

  agent(`
TYPE & DATA FLOW ANALYSIS for page: "${pageName}"
Files to analyze:
${allFiles.map(f => `- ${f}`).join('\n')}

ANALYZE IN EXTREME DETAIL:
1. Type definitions across frontend/backend
2. Type mismatches causing runtime errors
3. Data flow from API to component
4. Enum consistency
5. Field naming inconsistencies

READ EACH FILE. Compare frontend vs backend types.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "type-mismatch|enum-inconsistency|data-flow",
    "title": "Short title",
    "description": "Detailed description",
    "file": "exact/file/path.ts",
    "line": 123,
    "code": "mismatched code",
    "suggestedFix": "Detailed fix",
    "effort": "low|medium|high"
  }],
  "summary": { "typesCompared": 20, "mismatchesFound": 5 }
}
`, { label: 'types-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }),

  agent(`
FORM-TO-API VALIDATION MATRIX for page: "${pageName}"
Files to analyze:
${allFiles.map(f => `- ${f}`).join('\n')}

THIS IS THE MOST CRITICAL ANALYSIS.

ANALYZE IN EXTREME DETAIL:
1. For each form: list fields and what API receives
2. For each API call: find backend route and Joi validation
3. Check for extra fields, format mismatches
4. Coordinate format issues (GeoJSON)

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
    "mismatch": "what doesn't match",
    "suggestedFix": "Detailed fix",
    "effort": "low|medium|high"
  }],
  "formApiMatrix": [],
  "joiSchemaFixes": [],
  "summary": { "formsAnalyzed": 5, "mismatchesFound": 10, "criticalCount": 3 }
}
`, { label: 'form-api-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, formApiMatrix: { type: 'array' }, joiSchemaFixes: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } })
]);

phase('Audit');

const allIssues = [
  ...(frontendAnalysis.issues || []),
  ...(backendAnalysis.issues || []),
  ...(typeAnalysis.issues || []),
  ...(formApiAnalysis.issues || [])
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

const critical = uniqueIssues.filter(i => i.severity === 'critical');
const high = uniqueIssues.filter(i => i.severity === 'high');
const medium = uniqueIssues.filter(i => i.severity === 'medium');
const low = uniqueIssues.filter(i => i.severity === 'low');

log('═══════════════════════════════════════════════════════════════');
log('  AUDIT REPORT - Provider Dashboard');
log('═══════════════════════════════════════════════════════════════');
log(`Total Files: ${discovery.totalFiles} | Issues: ${uniqueIssues.length}`);
log(`Critical: ${critical.length} | High: ${high.length} | Medium: ${medium.length} | Low: ${low.length}`);
log('');

for (const issue of uniqueIssues.slice(0, 20)) {
  const badge = `[${issue.severity.toUpperCase()}]`.padEnd(11);
  log(`${badge} ${issue.title}`);
  log(`  File: ${issue.file}:${issue.line || '?'}`);
  log(`  Fix: ${issue.suggestedFix}`);
  log('');
}

phase('Fix');

if (critical.length > 0) {
  log(`🔴 FIXING ${critical.length} CRITICAL ISSUES...`);
  const results = await Promise.all(critical.map(issue =>
    agent(`FIX CRITICAL BUG: ${issue.title}
FILE: ${issue.file}
LINE: ${issue.line || 'N/A'}
DESC: ${issue.description}
FIX: ${issue.suggestedFix}

Read the file first, apply the fix.
Return JSON: { "status": "fixed", "fixApplied": "..." }`,
    { label: `fix-${issue.file.split('/').pop()}`, phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' }, fixApplied: { type: 'string' } } } })
  ));
  for (const r of results) log(`  ✓ ${r.status}`);
}

if (high.length > 0) {
  log(`🟠 FIXING ${high.length} HIGH PRIORITY ISSUES...`);
  const results = await Promise.all(high.map(issue =>
    agent(`FIX HIGH BUG: ${issue.title}
FILE: ${issue.file}
FIX: ${issue.suggestedFix}
Return JSON: { "status": "fixed" }`,
    { label: `fix-${issue.file.split('/').pop()}`, phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } } } })
  ));
  for (const r of results) log(`  ✓ ${r.status}`);
}

phase('Verify');

log('Running TypeScript check...');
const tsc = await agent(`Run: cd frontend && npx tsc --noEmit 2>&1
Return JSON: { "success": true/false, "errors": [] }`,
{ label: 'tsc', phase: 'Verify', schema: { type: 'object', properties: { success: { type: 'boolean' }, errors: { type: 'array' } } } });

log(`TypeScript: ${tsc.success ? '✅ PASS' : '❌ FAIL'}`);

return {
  pageName,
  totalFiles: discovery.totalFiles,
  totalIssues: uniqueIssues.length,
  critical: critical.length,
  high: high.length,
  medium: medium.length,
  low: low.length,
  tscPass: tsc.success
};
