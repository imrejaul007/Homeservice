export const meta = {
  name: 'wallet-page-audit',
  description: 'Deep audit of /customer/wallet page - 3 agents at a time',
  phases: [
    { title: 'Discover', detail: 'File discovery' },
    { title: 'Analyze', detail: 'Parallel analysis (3 at a time)' },
    { title: 'Audit', detail: 'Report' },
    { title: 'Fix', detail: 'Fixes by severity' },
    { title: 'Verify', detail: 'TypeScript check' },
  ],
};

phase('Discover');

var pageName = args;
log('========================================');
log('AUDITING: ' + pageName);
log('========================================');

var discovery = await agent(
'DISCOVER FILES for wallet page\n\n' +
'Find ALL files:\n' +
'FRONTEND:\n' +
'- frontend/src/pages/customer/WalletPage.tsx\n' +
'- frontend/src/components/wallet/*\n' +
'- frontend/src/components/marketplace/WalletBalance.tsx\n' +
'- frontend/src/services/walletApi.ts\n' +
'- frontend/src/services/loyaltyApi.ts\n' +
'BACKEND:\n' +
'- backend/src/routes/wallet.routes.ts\n' +
'- backend/src/controllers/wallet.controller.ts\n' +
'- backend/src/services/wallet.service.ts\n' +
'- backend/src/models/wallet.model.ts\n\n' +
'Return: { frontendFiles: [], backendFiles: [], totalFiles: 0 }',
{ label: 'discovery', schema: { type: 'object', properties: { frontendFiles: { type: 'array' }, backendFiles: { type: 'array' }, totalFiles: { type: 'number' } }, required: ['frontendFiles', 'backendFiles', 'totalFiles'] } }
);

log('Found: ' + discovery.totalFiles + ' files');
log('Frontend: ' + (discovery.frontendFiles || []).length);
log('Backend: ' + (discovery.backendFiles || []).length);
log('');

phase('Analyze');

var frontendFiles = discovery.frontendFiles || [];
var backendFiles = discovery.backendFiles || [];
var allFiles = frontendFiles.concat(backendFiles);

log('Running 3 analysis agents in parallel...');

// Run 3 agents at a time
var batch1 = await agent(
'FRONTEND ANALYSIS for wallet page\n\n' +
'Files:\n' + frontendFiles.join('\n') + '\n\n' +
'Analyze:\n' +
'1. State management - Zustand/redux usage\n' +
'2. API calls - error handling, types\n' +
'3. Props drilling, unused imports\n' +
'4. useEffect dependencies\n' +
'5. Accessibility\n\n' +
'READ FILES. Return JSON: { issues: [{ severity: "critical|high|medium|low", title: "string", description: "string", file: "path", line: 123, suggestedFix: "string", effort: "low|medium|high" }] }',
{ label: 'frontend', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' } }, required: ['issues'] } }
);

var batch2 = await agent(
'BACKEND ANALYSIS for wallet page\n\n' +
'Files:\n' + backendFiles.join('\n') + '\n\n' +
'Analyze:\n' +
'1. Controllers - validation (Joi), error responses\n' +
'2. Routes - HTTP methods, middleware\n' +
'3. Services - database queries, indexes\n' +
'4. Models - schema validation\n' +
'5. Security - IDOR, injection, auth\n\n' +
'READ FILES. Return JSON: { issues: [{ severity: "critical|high|medium|low", title: "string", description: "string", file: "path", line: 123, suggestedFix: "string", effort: "low|medium|high" }] }',
{ label: 'backend', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' } }, required: ['issues'] } }
);

var batch3 = await agent(
'TYPE + ERROR + SECURITY ANALYSIS for wallet page\n\n' +
'Files:\n' + allFiles.join('\n') + '\n\n' +
'Analyze:\n' +
'1. TYPE: Frontend vs backend type mismatches\n' +
'2. ERROR: try/catch, error handling, user messages\n' +
'3. SECURITY: IDOR, XSS, injection, auth checks\n\n' +
'READ FILES. Return JSON: { issues: [{ severity: "critical|high|medium|low", title: "string", description: "string", file: "path", line: 123, suggestedFix: "string", effort: "low|medium|high" }] }',
{ label: 'types-security', phase: 'Analyze', schema: { type: 'object', properties: { issues: { type: 'array' } }, required: ['issues'] } }
);

phase('Audit');

var allIssues = []
  .concat(batch1.issues || [])
  .concat(batch2.issues || [])
  .concat(batch3.issues || []);

var uniqueIssues = [];
var seen = new Set();
for (var i = 0; i < allIssues.length; i++) {
  var issue = allIssues[i];
  if (!issue || !issue.file) continue;
  var key = issue.file + ':' + (issue.line || 0) + ':' + issue.title;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueIssues.push(issue);
  }
}

var severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
uniqueIssues.sort(function(a, b) { return severityOrder[a.severity] - severityOrder[b.severity]; });

var critical = uniqueIssues.filter(function(i) { return i.severity === 'critical'; });
var high = uniqueIssues.filter(function(i) { return i.severity === 'high'; });
var medium = uniqueIssues.filter(function(i) { return i.severity === 'medium'; });
var low = uniqueIssues.filter(function(i) { return i.severity === 'low'; });

log('================================================================================');
log('                              AUDIT REPORT');
log('================================================================================');
log('Files Analyzed: ' + discovery.totalFiles);
log('Issues Found: ' + uniqueIssues.length);
log('| CRITICAL: ' + critical.length + ' | HIGH: ' + high.length + ' | MEDIUM: ' + medium.length + ' | LOW: ' + low.length + ' |');
log('');

for (var j = 0; j < uniqueIssues.length; j++) {
  var iss = uniqueIssues[j];
  if (!iss.file) continue;
  log('-'.repeat(80));
  log('[' + (iss.severity || '?').toUpperCase() + '] ' + (iss.title || 'Untitled'));
  log('  File: ' + iss.file + (iss.line ? ':' + iss.line : ''));
  log('  Fix: ' + (iss.suggestedFix || 'No fix'));
}

log('');

phase('Fix');

log('================================================================================');
log('                              APPLYING FIXES');
log('================================================================================');
log('');

function getFileName(file) {
  if (!file) return 'unknown';
  try { return file.split('/').pop(); } catch(e) { return 'unknown'; }
}

var criticalWithFile = critical.filter(function(i) { return i && i.file; });
var highWithFile = high.filter(function(i) { return i && i.file; });
var mediumWithFile = medium.filter(function(i) { return i && i.file; });
var lowWithFile = low.filter(function(i) { return i && i.file; });

// Fix critical issues - 3 at a time
if (criticalWithFile.length > 0) {
  log('FIXING ' + criticalWithFile.length + ' CRITICAL ISSUES (3 at a time)...');
  for (var ci = 0; ci < criticalWithFile.length; ci += 3) {
    var batch = [];
    for (var cj = 0; cj < 3 && ci + cj < criticalWithFile.length; cj++) {
      var crit = criticalWithFile[ci + cj];
      batch.push(agent(
        'FIX:\nISSUE: ' + (crit.title || '') + '\nFILE: ' + crit.file + '\nLINE: ' + (crit.line || 'N/A') + '\nDESC: ' + (crit.description || '') + '\nFIX: ' + (crit.suggestedFix || '') + '\n\nRead file, apply fix. Return: { "status": "fixed", "fixApplied": "desc" }',
        { label: 'fix-crit-' + ci, phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' }, fixApplied: { type: 'string' } }, required: ['status'] } }
      ));
    }
    var results = await Promise.all(batch);
    for (var cr = 0; cr < results.length; cr++) {
      log('  DONE: ' + (results[cr].status || '?'));
    }
  }
}

// Fix high priority - 3 at a time
if (highWithFile.length > 0) {
  log('FIXING ' + highWithFile.length + ' HIGH ISSUES (3 at a time)...');
  for (var hi = 0; hi < highWithFile.length; hi += 3) {
    var batch = [];
    for (var hj = 0; hj < 3 && hi + hj < highWithFile.length; hj++) {
      var h = highWithFile[hi + hj];
      batch.push(agent(
        'FIX:\nISSUE: ' + (h.title || '') + '\nFILE: ' + h.file + '\nLINE: ' + (h.line || 'N/A') + '\nFIX: ' + (h.suggestedFix || '') + '\n\nReturn: { "status": "fixed" }',
        { label: 'fix-high-' + hi, phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } }
      ));
    }
    var results = await Promise.all(batch);
    for (var hr = 0; hr < results.length; hr++) {
      log('  DONE: ' + (results[hr].status || '?'));
    }
  }
}

// Fix medium - grouped by file
if (mediumWithFile.length > 0) {
  log('FIXING ' + mediumWithFile.length + ' MEDIUM ISSUES...');
  var medByFile = {};
  for (var mi = 0; mi < mediumWithFile.length; mi++) {
    var m = mediumWithFile[mi];
    var f = m.file;
    if (!medByFile[f]) medByFile[f] = [];
    medByFile[f].push(m);
  }
  var medFiles = Object.keys(medByFile);
  for (var mf = 0; mf < medFiles.length; mf++) {
    var file = medFiles[mf];
    var issues = medByFile[file];
    var text = issues.map(function(iss, idx) {
      return (idx + 1) + '. ' + (iss.title || '') + ' - ' + (iss.suggestedFix || '');
    }).join('\n');
    var result = await agent(
      'FIX ALL IN: ' + file + '\n\n' + text + '\n\nReturn: { "status": "fixed" }',
      { label: 'fix-med-' + mf, phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } }
    );
    log('  DONE: ' + file + ' - ' + (result.status || '?'));
  }
}

// Fix low - grouped by file
if (lowWithFile.length > 0) {
  log('FIXING ' + lowWithFile.length + ' LOW ISSUES...');
  var lowByFile = {};
  for (var li = 0; li < lowWithFile.length; li++) {
    var lo = lowWithFile[li];
    var f = lo.file;
    if (!lowByFile[f]) lowByFile[f] = [];
    lowByFile[f].push(lo);
  }
  var lowFiles = Object.keys(lowByFile);
  for (var lf = 0; lf < lowFiles.length; lf++) {
    var file = lowFiles[lf];
    var issues = lowByFile[file];
    var text = issues.map(function(iss, idx) {
      return (idx + 1) + '. ' + (iss.title || '') + ' - ' + (iss.suggestedFix || '');
    }).join('\n');
    var result = await agent(
      'FIX ALL IN: ' + file + '\n\n' + text + '\n\nReturn: { "status": "fixed" }',
      { label: 'fix-low-' + lf, phase: 'Fix', schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] } }
    );
    log('  DONE: ' + file);
  }
}

phase('Verify');

log('');
log('================================================================================');
log('                              VERIFICATION');
log('================================================================================');

var frontendTs = await agent(
'Run: cd frontend && npx tsc --noEmit\n\nReturn: { "success": true, "errors": [] }',
{ label: 'tsc-fe', phase: 'Verify', schema: { type: 'object', properties: { success: { type: 'boolean' }, errors: { type: 'array' } }, required: ['success'] } }
);

var backendTs = await agent(
'Run: cd backend && npm run build\n\nReturn: { "success": true, "errors": [] }',
{ label: 'tsc-be', phase: 'Verify', schema: { type: 'object', properties: { success: { type: 'boolean' }, errors: { type: 'array' } }, required: ['success'] } }
);

log('Frontend TypeScript: ' + (frontendTs.success ? 'PASS' : 'FAIL'));
log('Backend TypeScript: ' + (backendTs.success ? 'PASS' : 'FAIL'));

log('');
log('================================================================================');
log('                              COMPLETE');
log('================================================================================');
log('Page: ' + pageName);
log('Files: ' + discovery.totalFiles);
log('Issues: ' + uniqueIssues.length + ' (C:' + critical.length + ' H:' + high.length + ' M:' + medium.length + ' L:' + low.length + ')');
log('================================================================================');
