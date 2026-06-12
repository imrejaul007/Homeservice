export const meta = {
  name: 'packages-page-audit',
  description: 'Audit /packages page - subscription plans and pricing',
  phases: [
    { title: 'Discover', detail: 'Find packages page files' },
    { title: 'Analyze', detail: '4 parallel analysis' },
    { title: 'Audit', detail: 'Detailed report' },
    { title: 'Fix', detail: 'Fix by severity' },
    { title: 'Verify', detail: 'TypeScript check' },
  ],
};

phase('Discover');

log('========================================');
log('AUDITING: /packages (Subscription Plans)');
log('========================================');

const discovery = await agent('DISCOVER files for /packages page.\n\nSearch for:\n1. frontend/src/pages/*package* or *pricing*\n2. frontend/src/components/*package* or *pricing*\n3. backend routes/controllers for pricing/packages\n4. Any Plan/Subscription components\n\nReturn JSON with frontendFiles array, backendFiles array, apiEndpoints array',
{ label: 'discovery', schema: { type: 'object', properties: { frontendFiles: { type: 'array' }, backendFiles: { type: 'array' }, apiEndpoints: { type: 'array' } }, required: ['frontendFiles', 'backendFiles'] } }
);

log('Found ' + (discovery.frontendFiles ? discovery.frontendFiles.length : 0) + ' frontend, ' + (discovery.backendFiles ? discovery.backendFiles.length : 0) + ' backend files');

const frontendFiles = discovery.frontendFiles || [];
const backendFiles = discovery.backendFiles || [];
const allFiles = frontendFiles.concat(backendFiles);

phase('Analyze');

// Batch 1: Frontend + Backend (2 agents)
log('Running analysis batch 1 (2 agents)...');

const batch1 = await Promise.all([
  agent('ANALYZE FRONTEND for /packages page.\n\nFiles:\n' + frontendFiles.join('\n') + '\n\nCheck: components, API calls, state, types, errors.\nReturn JSON: { "issues": [{ "severity": "critical|high|medium|low", "title": "string", "file": "path", "line": 1, "suggestedFix": "string", "description": "string" }] }',
  { label: 'frontend', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' } }, required: ['issues'] } }
]);

const batch2 = await Promise.all([
  agent('ANALYZE BACKEND for /packages page.\n\nFiles:\n' + backendFiles.join('\n') + '\n\nCheck: controllers, validation, API endpoints, security.\nReturn JSON: { "issues": [{ "severity": "critical|high|medium|low", "title": "string", "file": "path", "line": 1, "suggestedFix": "string", "description": "string" }] }',
  { label: 'backend', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' } }, required: ['issues'] } }
]);

const batch3 = await Promise.all([
  agent('TYPE ANALYSIS for /packages page.\n\nFiles:\n' + allFiles.slice(0, 10).join('\n') + '\n\nCompare frontend types vs backend DTOs for Plan/Subscription.\nReturn JSON: { "issues": [{ "severity": "critical|high|medium|low", "title": "string", "file": "path", "line": 1, "suggestedFix": "string" }] }',
  { label: 'types', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' } }, required: ['issues'] } }
]);

const batch4 = await Promise.all([
  agent('ERROR & SECURITY for /packages page.\n\nFiles:\n' + allFiles.slice(0, 10).join('\n') + '\n\nCheck: error handling, auth, validation.\nReturn JSON: { "issues": [{ "severity": "critical|high|medium|low", "title": "string", "file": "path", "line": 1, "suggestedFix": "string" }] }',
  { label: 'error-security', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' } }, required: ['issues'] } }
]);

// Merge all issues
const allIssues = []
  .concat(batch1[0].issues || [])
  .concat(batch2[0].issues || [])
  .concat(batch3[0].issues || [])
  .concat(batch4[0].issues || []);

const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
allIssues.sort(function(a, b) { return (severityOrder[a.severity] || 4) - (severityOrder[b.severity] || 4); });

const critical = allIssues.filter(function(i) { return i.severity === 'critical'; });
const high = allIssues.filter(function(i) { return i.severity === 'high'; });
const medium = allIssues.filter(function(i) { return i.severity === 'medium'; });
const low = allIssues.filter(function(i) { return i.severity === 'low'; });

phase('Audit');

log('========================================');
log('AUDIT REPORT');
log('========================================');
log('Issues: ' + allIssues.length + ' (Critical:' + critical.length + ' High:' + high.length + ' Medium:' + medium.length + ' Low:' + low.length + ')');
log('');

for (var i = 0; i < Math.min(allIssues.length, 20); i++) {
  var issue = allIssues[i];
  log('[' + (issue.severity || '?').toUpperCase() + '] ' + (issue.title || 'Untitled'));
  log('  File: ' + (issue.file || 'unknown') + ':' + (issue.line || '?'));
  log('');
}

phase('Fix');

log('========================================');
log('APPLYING FIXES');
log('========================================');

if (critical.length > 0) {
  log('Fixing ' + critical.length + ' CRITICAL issues...');
  for (var i = 0; i < critical.length; i++) {
    var issue = critical[i];
    await agent('FIX: ' + (issue.title || '') + '\nFile: ' + (issue.file || '') + '\nLine: ' + (issue.line || 'N/A') + '\nFix: ' + (issue.suggestedFix || ''),
      { label: 'fix-crit', phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } }
    );
  }
}

if (high.length > 0) {
  log('Fixing ' + high.length + ' HIGH issues...');
  for (var i = 0; i < high.length; i++) {
    var issue = high[i];
    await agent('FIX: ' + (issue.title || '') + '\nFile: ' + (issue.file || '') + '\nFix: ' + (issue.suggestedFix || ''),
      { label: 'fix-high', phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } }
    );
  }
}

if (medium.length > 0) {
  log('Fixing ' + medium.length + ' MEDIUM issues...');
  for (var i = 0; i < medium.length; i++) {
    var issue = medium[i];
    await agent('FIX: ' + (issue.title || '') + '\nFile: ' + (issue.file || '') + '\nFix: ' + (issue.suggestedFix || ''),
      { label: 'fix-med', phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } }
    );
  }
}

if (low.length > 0) {
  log('Fixing ' + low.length + ' LOW issues...');
  for (var i = 0; i < low.length; i++) {
    var issue = low[i];
    await agent('FIX: ' + (issue.title || '') + '\nFile: ' + (issue.file || '') + '\nFix: ' + (issue.suggestedFix || ''),
      { label: 'fix-low', phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } }
    );
  }
}

phase('Verify');

log('========================================');
log('VERIFICATION');
log('========================================');

const tsFrontend = await agent('Run: cd frontend && npx tsc --noEmit\nReturn JSON: { "success": true, "errors": [] }',
{ label: 'tsc-fe', phase: 'Verify', schema: { type: 'object', properties: { success: { type: 'boolean' }, errors: { type: 'array' } }, required: ['success'] } }
);

const tsBackend = await agent('Run: cd backend && npx tsc --noEmit\nReturn JSON: { "success": true, "errors": [] }',
{ label: 'tsc-be', phase: 'Verify', schema: { type: 'object', properties: { success: { type: 'boolean' }, errors: { type: 'array' } }, required: ['success'] } }
);

log('Frontend: ' + (tsFrontend.success ? 'PASS' : 'FAIL'));
log('Backend: ' + (tsBackend.success ? 'PASS' : 'FAIL'));

return {
  page: '/packages',
  issues: allIssues.length,
  critical: critical.length,
  high: high.length,
  medium: medium.length,
  low: low.length,
  frontendPass: tsFrontend.success,
  backendPass: tsBackend.success
};
