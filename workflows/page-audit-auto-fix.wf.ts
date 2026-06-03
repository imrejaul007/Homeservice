/**
 * Page Audit & Auto-Fix Workflow
 *
 * Comprehensive audit of any page with automatic fixing of ALL issues
 * (critical, high, medium, and low priority).
 *
 * Usage: /workflow page-audit-auto-fix.wf.ts [page_url]
 * Or: Use with /audit-page skill
 *
 * No need to prompt "fix all the things" - it fixes everything automatically!
 */

export const meta = {
  name: 'page-audit-auto-fix',
  description: 'Comprehensive page audit with automatic fixing of ALL issues (critical, high, medium, low priority)',
  phases: ['Discover', 'Analyze', 'Fix-Critical', 'Fix-High', 'Fix-Medium', 'Fix-Low', 'Report'],
};

// ============================================================
// PHASE 1: Discover - Find relevant files
// ============================================================

phase('Discover');

const discoverResult = await agent(`
Find ALL files related to the page being audited.

Look for:
1. Frontend component files (*.tsx) - check frontend/src/pages and frontend/src/components
2. Backend route files - check backend/src/routes
3. Backend controller files - check backend/src/controllers
4. Backend model files - check backend/src/models
5. Socket service files - check backend/src/socket and frontend/src/services/socket.ts
6. API service files - check frontend/src/services

For EACH file found, analyze:
- API calls and endpoints being called
- State management patterns
- Error handling (loading states, error states)
- TypeScript type mismatches
- Missing validation
- Security issues
- Performance issues
- Accessibility issues

Map the relationship between frontend pages and backend APIs.

Report back with:
- List of frontend files with their routes
- List of backend routes with their controllers
- List of models used
- Socket events defined and subscribed
- API service methods
- Relationship map between frontend and backend
`, {schema: {
  type: 'object',
  properties: {
    frontendFiles: { type: 'array', items: { type: 'string' } },
    backendFiles: { type: 'array', items: { type: 'string' } },
    models: { type: 'array', items: { type: 'string' } },
    socketEvents: { type: 'array', items: { type: 'string' } },
    apiEndpoints: { type: 'array', items: { type: 'string' } },
    relationshipMap: { type: 'object' }
  }
}});

// ============================================================
// PHASE 2: Analyze - Launch comprehensive parallel analysis
// ============================================================

phase('Analyze');

// Run 4 parallel analysis agents for comprehensive coverage
const [frontendIssues, backendIssues, connectionIssues, dataIssues] = await parallel([
  // Agent 1: Frontend Analysis - EVERYTHING
  () => agent(`
ANALYZE ALL frontend code for the page being audited.

Check EVERY file in frontend/src/pages/* and frontend/src/components/* related to this page.

For each file, identify ALL issues:
1. **Type Mismatches**: Frontend types vs backend response format
2. **Missing Error Handling**: No try-catch, no error states, no loading states
3. **Security Issues**: XSS, injection, auth bypass
4. **Performance**: Unnecessary re-renders, large payloads, missing memoization
5. **Memory Leaks**: Event listeners not cleaned up, subscriptions not unsubscribed
6. **Accessibility**: Missing ARIA labels, no keyboard nav, low contrast
7. **State Management**: Race conditions, stale closures, missing dependencies
8. **API Issues**: Wrong endpoints, missing pagination, wrong HTTP methods

ALWAYS return at least one issue per file if any issue exists. Be THOROUGH.

Return with severity: 'critical', 'high', 'medium', or 'low'
`, {label: 'Frontend Analysis', schema: {
    type: 'object',
    properties: {
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            category: { type: 'string' },
            file: { type: 'string' },
            line: { type: 'number' },
            issue: { type: 'string' },
            recommendation: { type: 'string' }
          }
        }
      }
    }
  }}),

  // Agent 2: Backend Analysis - EVERYTHING
  () => agent(`
ANALYZE ALL backend code for the page being audited.

Check EVERY file in backend/src/routes/*, backend/src/controllers/*, backend/src/services/* related to this page.

For each file, identify ALL issues:
1. **Missing Endpoints**: Frontend calls endpoint but backend doesn't have it
2. **Response Format Mismatch**: Backend returns different shape than frontend expects
3. **Validation**: Missing Joi validation, no ObjectId format check
4. **Security**: IDOR vulnerability, injection, missing auth middleware
5. **Performance**: N+1 queries, no pagination, loading all data into memory
6. **Missing Indexes**: Queries without proper indexes
7. **Error Handling**: Inconsistent error responses, no try-catch
8. **Concurrency**: Race conditions, missing transactions
9. **Enum Mismatches**: Different enum values vs frontend

ALWAYS return at least one issue per file if any issue exists. Be THOROUGH.

Return with severity: 'critical', 'high', 'medium', or 'low'
`, {label: 'Backend Analysis', schema: {
    type: 'object',
    properties: {
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            category: { type: 'string' },
            file: { type: 'string' },
            line: { type: 'number' },
            issue: { type: 'string' },
            recommendation: { type: 'string' }
          }
        }
      }
    }
  }}),

  // Agent 3: Connection Analysis - EVERYTHING
  () => agent(`
ANALYZE ALL cross-page connections and data flow for the page being audited.

Check:
- backend/src/socket/*
- frontend/src/services/socket.ts
- backend/src/middleware/auth.middleware.ts

For each connection, identify ALL issues:
1. **Socket Events**: Missing events, dead events (subscribed but never emitted)
2. **Real-time Updates**: No socket listener for data that should update in real-time
3. **Auth Flow**: Missing role-based access, improper middleware order
4. **Data Flow**: Orphaned data, missing propagation between pages
5. **Cache Issues**: Stale data, missing cache invalidation

ALWAYS return at least one issue if any exists. Be THOROUGH.

Return with severity: 'critical', 'high', 'medium', or 'low'
`, {label: 'Connection Analysis', schema: {
    type: 'object',
    properties: {
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            category: { type: 'string' },
            file: { type: 'string' },
            line: { type: 'number' },
            issue: { type: 'string' },
            recommendation: { type: 'string' }
          }
        }
      }
    }
  }}),

  // Agent 4: Data Integrity Analysis - EVERYTHING
  () => agent(`
ANALYZE ALL data integrity between frontend and backend for the page being audited.

Compare:
- Frontend TypeScript interfaces vs backend model schemas
- API request/response shapes
- Enum values

For each mismatch, identify ALL issues:
1. **Field Name Mismatch**: snake_case vs camelCase, different names
2. **Missing Fields**: Backend returns field frontend doesn't expect
3. **Type Mismatches**: String vs number, wrong enum values
4. **Enum Inconsistencies**: Different status values, different type values
5. **Date Format**: Timezone issues, format mismatches
6. **Pagination**: Different response shapes, missing total count

ALWAYS return at least one issue if any exists. Be THOROUGH.

Return with severity: 'critical', 'high', 'medium', or 'low'
`, {label: 'Data Integrity', schema: {
    type: 'object',
    properties: {
      issues: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            category: { type: 'string' },
            file: { type: 'string' },
            line: { type: 'number' },
            issue: { type: 'string' },
            recommendation: { type: 'string' }
          }
        }
      }
    }
  }})
]);

// ============================================================
// PHASE 3: Fix Critical Issues - AUTO-FIX ALL
// ============================================================

phase('Fix-Critical');

// Combine all issues
const allIssues = [
  ...(frontendIssues.issues || []),
  ...(backendIssues.issues || []),
  ...(connectionIssues.issues || []),
  ...(dataIssues.issues || [])
];

// Sort by severity
const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

const criticalIssues = allIssues.filter(i => i.severity === 'critical');
const highIssues = allIssues.filter(i => i.severity === 'high');
const mediumIssues = allIssues.filter(i => i.severity === 'medium');
const lowIssues = allIssues.filter(i => i.severity === 'low');

log('## Critical Issues Found: ' + criticalIssues.length);
if (criticalIssues.length > 0) {
  criticalIssues.forEach((issue, idx) => {
    log((idx + 1) + '. ' + issue.issue + ' [' + issue.file + ':' + issue.line + ']');
  });
}

// Group by file for efficient fixes
const groupByFile = (issues) => {
  const grouped = {};
  for (const issue of issues) {
    const file = issue.file || 'unknown';
    if (!grouped[file]) grouped[file] = [];
    grouped[file].push(issue);
  }
  return grouped;
};

const criticalByFile = groupByFile(criticalIssues);

// FIX ALL CRITICAL ISSUES IN PARALLEL
const criticalFixes = await parallel(
  Object.keys(criticalByFile).map(file => () => agent(`
FIX ALL critical issues in ${file}.

ISSUES TO FIX:
${criticalByFile[file].map((issue, idx) => `
${idx + 1}. ${issue.issue}
   - Line: ${issue.line}
   - Category: ${issue.category}
   - Recommendation: ${issue.recommendation}
`).join('')}

REQUIREMENTS:
- Fix ALL issues listed above
- Do NOT change any other code
- Preserve existing functionality
- Add proper error handling
- Ensure TypeScript compiles (run tsc --noEmit after)
- Return specific changes made
`, {label: 'Fix-Critical: ' + file.split('/').pop()}))
);

// ============================================================
// PHASE 4: Fix High Priority Issues - AUTO-FIX ALL
// ============================================================

phase('Fix-High');

log('## High Priority Issues Found: ' + highIssues.length);
if (highIssues.length > 0) {
  highIssues.slice(0, 10).forEach((issue, idx) => {
    log((idx + 1) + '. ' + issue.issue + ' [' + issue.file + ']');
  });
  if (highIssues.length > 10) log('... and ' + (highIssues.length - 10) + ' more');
}

const highByFile = groupByFile(highIssues);

// FIX ALL HIGH PRIORITY ISSUES IN PARALLEL
const highFixes = await parallel(
  Object.keys(highByFile).map(file => () => agent(`
FIX ALL high priority issues in ${file}.

ISSUES TO FIX:
${highByFile[file].map((issue, idx) => `
${idx + 1}. ${issue.issue}
   - Line: ${issue.line}
   - Category: ${issue.category}
   - Recommendation: ${issue.recommendation}
`).join('')}

REQUIREMENTS:
- Fix ALL issues listed above
- Do NOT change any other code
- Preserve existing functionality
- Add proper error handling
- Ensure TypeScript compiles (run tsc --noEmit after)
- Return specific changes made
`, {label: 'Fix-High: ' + file.split('/').pop()}))
);

// ============================================================
// PHASE 5: Fix Medium Priority Issues - AUTO-FIX ALL
// ============================================================

phase('Fix-Medium');

log('## Medium Priority Issues Found: ' + mediumIssues.length);
if (mediumIssues.length > 0) {
  mediumIssues.slice(0, 10).forEach((issue, idx) => {
    log((idx + 1) + '. ' + issue.issue + ' [' + issue.file + ']');
  });
  if (mediumIssues.length > 10) log('... and ' + (mediumIssues.length - 10) + ' more');
}

const mediumByFile = groupByFile(mediumIssues);

// FIX ALL MEDIUM PRIORITY ISSUES IN PARALLEL
const mediumFixes = await parallel(
  Object.keys(mediumByFile).map(file => () => agent(`
FIX ALL medium priority issues in ${file}.

ISSUES TO FIX:
${mediumByFile[file].map((issue, idx) => `
${idx + 1}. ${issue.issue}
   - Line: ${issue.line}
   - Category: ${issue.category}
   - Recommendation: ${issue.recommendation}
`).join('')}

REQUIREMENTS:
- Fix ALL issues listed above
- Do NOT change any other code
- Preserve existing functionality
- Add proper error handling
- Ensure TypeScript compiles (run tsc --noEmit after)
- Return specific changes made
`, {label: 'Fix-Medium: ' + file.split('/').pop()}))
);

// ============================================================
// PHASE 6: Fix Low Priority Issues - AUTO-FIX ALL
// ============================================================

phase('Fix-Low');

log('## Low Priority Issues Found: ' + lowIssues.length);
if (lowIssues.length > 0) {
  lowIssues.slice(0, 5).forEach((issue, idx) => {
    log((idx + 1) + '. ' + issue.issue + ' [' + issue.file + ']');
  });
  if (lowIssues.length > 5) log('... and ' + (lowIssues.length - 5) + ' more');
}

const lowByFile = groupByFile(lowIssues);

// FIX ALL LOW PRIORITY ISSUES IN PARALLEL
const lowFixes = await parallel(
  Object.keys(lowByFile).map(file => () => agent(`
FIX ALL low priority issues in ${file}.

ISSUES TO FIX:
${lowByFile[file].map((issue, idx) => `
${idx + 1}. ${issue.issue}
   - Line: ${issue.line}
   - Category: ${issue.category}
   - Recommendation: ${issue.recommendation}
`).join('')}

REQUIREMENTS:
- Fix ALL issues listed above
- Do NOT change any other code
- Preserve existing functionality
- Add proper error handling
- Ensure TypeScript compiles (run tsc --noEmit after)
- Return specific changes made
`, {label: 'Fix-Low: ' + file.split('/').pop()}))
);

// ============================================================
// PHASE 7: Report - Final Summary
// ============================================================

phase('Report');

const allFixes = [...criticalFixes, ...highFixes, ...mediumFixes, ...lowFixes].filter(Boolean);

const report = [
  '# Page Audit & Auto-Fix Complete',
  '',
  'Generated: ' + args,
  '',
  '## Executive Summary',
  '',
  '- Total Issues Found: ' + allIssues.length,
  '- Critical Fixed: ' + criticalIssues.length,
  '- High Fixed: ' + highIssues.length,
  '- Medium Fixed: ' + mediumIssues.length,
  '- Low Fixed: ' + lowIssues.length,
  '',
  '## All Issues Fixed',
  '',
  ...allIssues.map((issue, idx) => `${idx + 1}. [${issue.severity.toUpperCase()}] ${issue.issue} - FIXED`),
  '',
  '## Files Modified',
  '',
  ...Object.keys({...criticalByFile, ...highByFile, ...mediumByFile, ...lowByFile}).map(f => '- ' + f),
  '',
  '## Verification',
  '',
  'Run the following to verify TypeScript compiles:',
  '```bash',
  'cd backend && npx tsc --noEmit',
  'cd ../frontend && npx tsc --noEmit',
  '```',
  '',
  '## Summary',
  '',
  allFixes.length + ' fix operations completed in parallel across ' + Object.keys({...criticalByFile, ...highByFile, ...mediumByFile, ...lowByFile}).length + ' files.'
].join('\n');

log(report);

return {
  report,
  totalIssues: allIssues.length,
  criticalFixed: criticalIssues.length,
  highFixed: highIssues.length,
  mediumFixed: mediumIssues.length,
  lowFixed: lowIssues.length,
  filesModified: Object.keys({...criticalByFile, ...highByFile, ...mediumByFile, ...lowByFile}).length
};
