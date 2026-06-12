/**
 * Page Audit Workflow - 4 agents at a time
 */
export const meta = {
  name: 'page-audit',
  description: 'Comprehensive page audit with 4 parallel agents',
  phases: ['Discover', 'Analyze', 'Fix Critical', 'Fix High', 'Fix Medium', 'Fix Low', 'Report'],
};

const pageName = args || 'Customer Dashboard';
log('========================================');
log('AUDITING: ' + pageName);
log('Running 4 agents at a time');
log('========================================');

// ============================================
// PHASE 1: DISCOVER - Find files for the page
// ============================================
phase('Discover');

const discoveryPrompts = [
  'Find frontend React/TSX component files for: ' + pageName + '. Search frontend/src for pages, components. Return array of file paths.',
  'Find backend controller and route files for: ' + pageName + '. Search backend/src/controllers and backend/src/routes. Return array of file paths.',
  'Find service and model files related to: ' + pageName + '. Search backend/src/services and backend/src/models. Return array of file paths.',
  'Find socket events and middleware for: ' + pageName + '. Search backend/src/socket and backend/src/middleware. Return array of file paths.'
];

const discoveryResults = await parallel(discoveryPrompts.map((p, i) => () =>
  agent(p, {label: 'discover-' + i, schema: {type: 'object', properties: {files: {type: 'array', items: {type: 'string'}}}}})
));

const allFiles = discoveryResults
  .filter(Boolean)
  .flatMap(r => r?.files || [])
  .filter((v, i, a) => a.indexOf(v) === i); // dedupe

log('Found ' + allFiles.length + ' total files');
log('Files: ' + allFiles.slice(0, 10).join(', ') + (allFiles.length > 10 ? '...' : ''));

// ============================================
// PHASE 2: ANALYZE - Find issues in batches of 4
// ============================================
phase('Analyze');

const analysisPrompts = allFiles.map((file, i) =>
  'Analyze file: ' + file + '\nFind ALL issues: bugs, type mismatches, missing validation, security issues, performance problems, error handling gaps. ' +
  'Return issues array with: severity (critical/high/medium/low), title, file, description, line (if known).'
);

const BATCH_SIZE = 4;
const analysisResults = [];

for (let i = 0; i < analysisPrompts.length; i += BATCH_SIZE) {
  const batch = analysisPrompts.slice(i, i + BATCH_SIZE);
  log('Analyzing batch ' + (Math.floor(i/BATCH_SIZE) + 1) + '/' + Math.ceil(analysisPrompts.length/BATCH_SIZE));

  const batchResults = await parallel(batch.map((p, j) => () =>
    agent(p, {label: 'analyze-' + (i + j), schema: {
      type: 'object',
      properties: {issues: {type: 'array', items: {
        type: 'object',
        properties: {
          severity: {type: 'string'},
          title: {type: 'string'},
          file: {type: 'string'},
          description: {type: 'string'},
          line: {type: 'number'}
        }
      }}}
    }})
  ));

  analysisResults.push(...batchResults);
}

const allIssues = analysisResults
  .filter(Boolean)
  .flatMap(r => r?.issues || []);

log('========================================');
log('ISSUES FOUND: ' + allIssues.length);
const severityCounts = {critical: 0, high: 0, medium: 0, low: 0};
allIssues.forEach(i => { if (severityCounts[i.severity] !== undefined) severityCounts[i.severity]++; });
log('Critical: ' + severityCounts.critical + ', High: ' + severityCounts.high + ', Medium: ' + severityCounts.medium + ', Low: ' + severityCounts.low);
log('========================================');

// ============================================
// PHASE 3: FIX CRITICAL - 4 at a time
// ============================================
phase('Fix Critical');
const criticalIssues = allIssues.filter(i => i.severity === 'critical');
log('Fixing ' + criticalIssues.length + ' critical issues...');

for (let i = 0; i < criticalIssues.length; i += BATCH_SIZE) {
  const batch = criticalIssues.slice(i, i + BATCH_SIZE);
  if (batch.length === 0) break;
  log('Critical batch ' + (Math.floor(i/BATCH_SIZE) + 1) + '/' + Math.ceil(criticalIssues.length/BATCH_SIZE));

  await parallel(batch.map((issue, j) => () =>
    agent('FIX CRITICAL: ' + issue.title + '\nFile: ' + issue.file + '\nDescription: ' + issue.description + '\n' +
          'Apply the fix completely. Return what you changed.', {label: 'fix-critical-' + (i + j)})
  ));
}

// ============================================
// PHASE 4: FIX HIGH - 4 at a time
// ============================================
phase('Fix High');
const highIssues = allIssues.filter(i => i.severity === 'high');
log('Fixing ' + highIssues.length + ' high priority issues...');

for (let i = 0; i < highIssues.length; i += BATCH_SIZE) {
  const batch = highIssues.slice(i, i + BATCH_SIZE);
  if (batch.length === 0) break;
  log('High batch ' + (Math.floor(i/BATCH_SIZE) + 1) + '/' + Math.ceil(highIssues.length/BATCH_SIZE));

  await parallel(batch.map((issue, j) => () =>
    agent('FIX HIGH: ' + issue.title + '\nFile: ' + issue.file + '\nDescription: ' + issue.description + '\n' +
          'Apply the fix completely. Return what you changed.', {label: 'fix-high-' + (i + j)})
  ));
}

// ============================================
// PHASE 5: FIX MEDIUM - 4 at a time
// ============================================
phase('Fix Medium');
const mediumIssues = allIssues.filter(i => i.severity === 'medium');
log('Fixing ' + mediumIssues.length + ' medium priority issues...');

for (let i = 0; i < mediumIssues.length; i += BATCH_SIZE) {
  const batch = mediumIssues.slice(i, i + BATCH_SIZE);
  if (batch.length === 0) break;
  log('Medium batch ' + (Math.floor(i/BATCH_SIZE) + 1) + '/' + Math.ceil(mediumIssues.length/BATCH_SIZE));

  await parallel(batch.map((issue, j) => () =>
    agent('FIX MEDIUM: ' + issue.title + '\nFile: ' + issue.file + '\nDescription: ' + issue.description + '\n' +
          'Apply the fix completely. Return what you changed.', {label: 'fix-medium-' + (i + j)})
  ));
}

// ============================================
// PHASE 6: FIX LOW - 4 at a time
// ============================================
phase('Fix Low');
const lowIssues = allIssues.filter(i => i.severity === 'low');
log('Fixing ' + lowIssues.length + ' low priority issues...');

for (let i = 0; i < lowIssues.length; i += BATCH_SIZE) {
  const batch = lowIssues.slice(i, i + BATCH_SIZE);
  if (batch.length === 0) break;
  log('Low batch ' + (Math.floor(i/BATCH_SIZE) + 1) + '/' + Math.ceil(lowIssues.length/BATCH_SIZE));

  await parallel(batch.map((issue, j) => () =>
    agent('FIX LOW: ' + issue.title + '\nFile: ' + issue.file + '\nDescription: ' + issue.description + '\n' +
          'Apply the fix completely. Return what you changed.', {label: 'fix-low-' + (i + j)})
  ));
}

// ============================================
// PHASE 7: REPORT
// ============================================
phase('Report');
log('========================================');
log('AUDIT COMPLETE');
log('Page: ' + pageName);
log('Total Issues: ' + allIssues.length);
log('Fixed - Critical: ' + criticalIssues.length);
log('Fixed - High: ' + highIssues.length);
log('Fixed - Medium: ' + mediumIssues.length);
log('Fixed - Low: ' + lowIssues.length);
log('========================================');

return {
  page: pageName,
  totalIssues: allIssues.length,
  critical: criticalIssues.length,
  high: highIssues.length,
  medium: mediumIssues.length,
  low: lowIssues.length,
  files: allFiles
};
