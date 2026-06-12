/**
 * Admin Dashboard Page Audit Workflow
 */

export const meta = {
  name: 'page-audit-admin-dashboard',
  description: 'Deep audit of Admin Dashboard page',
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

Search for ALL files related to Admin Dashboard:

1. FRONTEND FILES:
   - frontend/src/pages/*admin*
   - frontend/src/pages/*dashboard*
   - frontend/src/components/**/*admin*
   - frontend/src/components/**/*dashboard*
   - frontend/src/components/**/*chart*
   - frontend/src/services/*admin*.ts
   - frontend/src/stores/*.ts
   - frontend/src/types/*.ts

2. BACKEND FILES:
   - backend/src/routes/*admin*.ts
   - backend/src/routes/*dashboard*.ts
   - backend/src/routes/*analytics*.ts
   - backend/src/controllers/*admin*.ts
   - backend/src/controllers/*dashboard*.ts
   - backend/src/services/*admin*.ts
   - backend/src/models/*booking*.ts

READ THE ACTUAL FILE CONTENT to verify they are related.

Return JSON:
{
  "frontendFiles": ["list of frontend files"],
  "backendFiles": ["list of backend files"],
  "apiEndpoints": ["list of API endpoints"],
  "models": ["list of models"],
  "totalFiles": 50
}
`, { label: 'discovery', schema: { type: 'object', properties: { frontendFiles: { type: 'array', items: { type: 'string' } }, backendFiles: { type: 'array', items: { type: 'string' } }, apiEndpoints: { type: 'array', items: { type: 'string' } }, models: { type: 'array', items: { type: 'string' } }, totalFiles: { type: 'number' } }, required: ['frontendFiles', 'backendFiles', 'totalFiles'] } });

log(`Discovered ${discovery.totalFiles} files`);

phase('Analyze');

const frontendFiles = discovery.frontendFiles || [];
const backendFiles = discovery.backendFiles || [];
const allFiles = [...frontendFiles, ...backendFiles];

const [frontendAnalysis, backendAnalysis, typeAnalysis, formApiAnalysis] = await Promise.all([
  agent(`
DEEP FRONTEND ANALYSIS for page: "${pageName}"
Files: ${frontendFiles.map(f => `- ${f}`).join('\n')}

ANALYZE: Component structure, state management, API integration, charts, TypeScript issues.
READ EACH FILE. Report exact issues with file:line.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "state-management|api-integration|typescript",
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
Files: ${backendFiles.map(f => `- ${f}`).join('\n')}

ANALYZE: Route handlers, controller logic, validation, security.
READ EACH FILE. Report exact issues with file:line.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "validation|security|performance|database",
    "title": "Short title",
    "description": "Detailed description",
    "file": "exact/file/path.ts",
    "line": 123,
    "code": "problematic code",
    "suggestedFix": "Detailed fix",
    "effort": "low|medium|high"
  }],
  "summary": { "endpointsAnalyzed": 10, "issuesFound": 15, "criticalCount": 3 }
}
`, { label: 'backend-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }),

  agent(`
TYPE & DATA FLOW ANALYSIS for page: "${pageName}"
Files: ${allFiles.map(f => `- ${f}`).join('\n')}

ANALYZE: Type mismatches, data flow, enum consistency.
READ EACH FILE. Compare frontend vs backend types.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "type-mismatch|data-flow",
    "title": "Short title",
    "description": "Detailed description",
    "file": "exact/file/path.ts",
    "line": 123,
    "suggestedFix": "Detailed fix",
    "effort": "low|medium|high"
  }],
  "summary": { "typesCompared": 20, "mismatchesFound": 5 }
}
`, { label: 'types-analysis', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' }, summary: { type: 'object' } }, required: ['issues'] } }),

  agent(`
FORM-TO-API VALIDATION MATRIX for page: "${pageName}"
Files: ${allFiles.map(f => `- ${f}`).join('\n')}

ANALYZE: Form fields vs API expectations, Joi validation.
READ EACH FILE. Compare line by line.

Return JSON:
{
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "form-mismatch|joi-schema",
    "title": "Short title",
    "description": "Detailed description",
    "file": "exact/file/path.ts",
    "line": 123,
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

const uniqueIssues = [];
const seen = new Set();
for (const issue of allIssues) {
  const key = `${issue.file}:${issue.line || 0}:${issue.title}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueIssues.push(issue);
  }
}

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
uniqueIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

const critical = uniqueIssues.filter(i => i.severity === 'critical');
const high = uniqueIssues.filter(i => i.severity === 'high');
const medium = uniqueIssues.filter(i => i.severity === 'medium');
const low = uniqueIssues.filter(i => i.severity === 'low');

log('═══════════════════════════════════════════════════════════════');
log('  AUDIT REPORT - Admin Dashboard');
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
FIX: ${issue.suggestedFix}
Return JSON: { "status": "fixed" }`,
    { label: `fix-${issue.file.split('/').pop()}`, phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } } } })
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
