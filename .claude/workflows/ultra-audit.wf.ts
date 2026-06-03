/**
 * Ultra-Thorough Page Audit Workflow
 *
 * This workflow addresses the gaps in the previous approach by:
 * 1. Finding anti-patterns via grep (catches what static reading misses)
 * 2. Tracing actual data flow between components
 * 3. Checking navigation chains
 * 4. Testing API integration patterns
 * 5. Finding mock data, error swallowing, race conditions
 * 6. Verifying prop passing chains
 * 7. Actually running TypeScript compiler
 * 8. Checking for visual/UX issues in code
 *
 * Improvements over previous workflow:
 * - Uses grep to find dangerous patterns (not just reading files)
 * - Traces data flow through component chains
 * - Checks navigation chains end-to-end
 * - Validates API integration
 * - Runs actual TypeScript compilation
 * - Deep dives on ALL key components completely
 */

export const meta = {
  name: 'ultra-audit',
  description: 'Ultra-thorough audit combining grep pattern search, data flow tracing, navigation analysis, and runtime verification',
  phases: ['Grep Anti-Patterns', 'Data Flow Analysis', 'Navigation Chain Check', 'API Integration Check', 'TypeScript Compilation', 'Component Deep Dive', 'Compile Report'],
};

phase('Grep Anti-Patterns');

// ============================================================
// STEP 1: Find dangerous patterns that indicate bugs
// This catches things static reading misses
// ============================================================

const antiPatternsFound = await agent(`
Run these grep searches across the entire codebase to find dangerous patterns:

1. MOCK DATA patterns:
   grep -rn "generateMock" --include="*.tsx" --include="*.ts"
   grep -rn "MOCK_DATA|mockData|hardcoded.*\\[" --include="*.tsx"
   grep -rn "const.*=.*\\[" --include="*.tsx" | grep -v "import|interface|type"

2. ERROR SWALLOWING patterns:
   grep -rn "\\.catch\\(() => {})" --include="*.ts" --include="*.tsx"
   grep -rn "catch.*\\n.*\\}" --include="*.ts" --include="*.tsx"
   grep -rn "console\\.log" --include="*.ts" --include="*.tsx" | grep -v "logger\\."

3. RACE CONDITIONS:
   grep -rn "setTimeout.*fetch|setTimeout.*api" --include="*.tsx"
   grep -rn "useEffect.*\\[\\]" --include="*.tsx" | grep -v "// no deps"

4. MEMORY LEAKS:
   grep -rn "useEffect" --include="*.tsx" | grep -v "return.*cleanup"

5. MISSING CLEANUP:
   grep -rn "socket.*on|addEventListener" --include="*.tsx" | grep -v "return.*off|return.*remove"

6. HARDCODED VALUES:
   grep -rn "'admin@|\"admin@\"" --include="*.tsx" --include="*.ts"
   grep -rn "localhost:3000|127.0.0.1" --include="*.ts" --include="*.tsx"

7. ANY TYPES IN PRODUCTION:
   grep -rn ": any|as any|<any>" --include="*.tsx" | grep -v "Error|unknown"

8. PROP CHAIN BREAKS:
   grep -rn "onClick.*={.*}" --include="*.tsx" | grep -v "onClick={() =>"

9. MISSING LOADING STATES:
   grep -rn "if (loading)" --include="*.tsx" | grep -v "return.*Loading|spinner"

10. NAVIGATION ISSUES:
    grep -rn "navigate\\(" --include="*.tsx" | grep -v "import.*navigate"
    grep -rn "to=/" --include="*.tsx" | grep -v "Link|NavLink"

For each pattern found, note:
- File path and line number
- The actual code snippet
- Why it's dangerous
- Suggested fix

Return a categorized list of all findings.
`, {schema: {
  type: 'object',
  properties: {
    mockDataIssues: { type: 'array', items: { type: 'string' } },
    errorSwallowingIssues: { type: 'array', items: { type: 'string' } },
    raceConditionIssues: { type: 'array', items: { type: 'string' } },
    memoryLeakIssues: { type: 'array', items: { type: 'string' } },
    hardcodedValueIssues: { type: 'array', items: { type: 'string' } },
    anyTypeIssues: { type: 'array', items: { type: 'string' } },
    propChainIssues: { type: 'array', items: { type: 'string' } },
    navigationIssues: { type: 'array', items: { type: 'string' } },
    missingLoadingIssues: { type: 'array', items: { type: 'string' } }
  }
}});

phase('Data Flow Analysis');

// ============================================================
// STEP 2: Trace actual data flow through components
// This catches prop chain breaks and missing data passing
// ============================================================

const dataFlowIssues = await agent(`
Analyze data flow between components by reading interconnected files.

For CUSTOMER FLOW (if exists):
Read these files and trace how data moves:
- frontend/src/pages/customer/SearchPage.tsx
- frontend/src/pages/customer/ServiceDetailPage.tsx
- frontend/src/pages/customer/BookServicePage.tsx
- frontend/src/components/customer/ServiceCard.tsx
- frontend/src/components/customer/ServiceVariants.tsx
- frontend/src/components/customer/BookingFormWizard.tsx

For PROVIDER FLOW (if exists):
Read these files and trace how data moves:
- frontend/src/pages/provider/ManagedServicesPage.tsx
- frontend/src/components/provider/ServiceManagement.tsx
- frontend/src/components/provider/AddServiceModal.tsx
- frontend/src/components/provider/EditServiceModal.tsx

For each file, check:
1. What props does it receive?
2. What state does it manage?
3. What does it pass to children?
4. What API calls does it make?
5. What does it do with the response?

Look for:
- Props passed but not used
- State set but never read
- API responses not saved to state
- Data transformations missing
- Variant data not passed to booking

Return specific data flow gaps with file paths and line numbers.
`, {phase: 'Data Flow Analysis', schema: {
  type: 'object',
  properties: {
    customerFlowGaps: { type: 'array', items: { type: 'string' } },
    providerFlowGaps: { type: 'array', items: { type: 'string' } },
    missingDataPassing: { type: 'array', items: { type: 'string' } },
    stateNotUsed: { type: 'array', items: { type: 'string' } }
  }
}});

phase('Navigation Chain Check');

// ============================================================
// STEP 3: Check navigation chains
// This catches buttons that go to wrong pages
// ============================================================

const navigationIssues = await agent(`
Check all navigation chains in the application.

1. Find ALL buttons that navigate:
   grep -rn "navigate\\(" --include="*.tsx"
   grep -rn "to=" --include="*.tsx" | grep "Link|NavLink"
   grep -rn "href=" --include="*.tsx"

2. For each navigation found, verify:
   - Does the target page exist?
   - Is the path correct?
   - Is data passed via state/navigate params?
   - Are required params missing?

3. Common navigation bugs to find:
   - Button goes to detail page instead of booking
   - Link path has typo
   - Missing :id in path
   - Wrong route (e.g., /search instead of /book)
   - Data not passed in state

4. Check ROUTING configuration:
   - Read frontend/src/App.tsx or routes.ts
   - Verify all routes exist
   - Check for conflicting routes

Return navigation issues with:
- File path and line number
- Current navigation target
- What it should be
- Required data not passed
`, {phase: 'Navigation Chain Check', schema: {
  type: 'object',
  properties: {
    wrongNavigationTargets: { type: 'array', items: { type: 'string' } },
    missingDataInNavigation: { type: 'array', items: { type: 'string' } },
    routeConflicts: { type: 'array', items: { type: 'string' } },
    nonExistentRoutes: { type: 'array', items: { type: 'string' } }
  }
}});

phase('API Integration Check');

// ============================================================
// STEP 4: Check API integration patterns
// This catches API calls that don't handle errors/loading
// ============================================================

const apiIssues = await agent(`
Check API integration patterns in all services and components.

1. Find all API service files:
   ls frontend/src/services/*.ts
   ls frontend/src/services/api/*.ts

2. For each API call found, verify:
   - Is there a loading state?
   - Is there an error state?
   - Is error shown to user?
   - Is data validated before use?
   - Are required fields checked?

3. Common API bugs to find:
   - .catch() without user feedback
   - No loading indicator
   - 401/403 not handled (redirect to login)
   - Response not checked for success
   - Required fields missing in response
   - Type errors from API response

4. Check backend controllers for:
   - Missing validation
   - Error responses not sent
   - Missing auth checks
   - IDOR vulnerabilities

Return API issues with file paths and line numbers.
`, {phase: 'API Integration Check', schema: {
  type: 'object',
  properties: {
    missingLoadingStates: { type: 'array', items: { type: 'string' } },
    errorNotShownToUser: { type: 'array', items: { type: 'string' } },
    apiResponseTypeIssues: { type: 'array', items: { type: 'string' } },
    missingAuthChecks: { type: 'array', items: { type: 'string' } }
  }
}});

phase('TypeScript Compilation');

// ============================================================
// STEP 5: Actually run TypeScript compilation
// This catches type errors that cause runtime bugs
// ============================================================

const tsCompilation = await agent(`
Run TypeScript compilation in both backend and frontend.

Commands:
1. cd backend && npx tsc --noEmit 2>&1
2. cd frontend && npx tsc --noEmit 2>&1

For EACH error found:
1. Read the file and line number
2. Understand what the error means
3. Determine if it's a real bug or just a type warning
4. Fix it

Common TypeScript errors that cause bugs:
- Property does not exist on type (data not validated)
- Argument not assignable (wrong types passed)
- Cannot find name (import missing)
- Promise result not used (missing await)
- Object possibly undefined (missing null check)

Return:
- All TypeScript errors
- Which ones are actual bugs
- What fixes are needed
`, {phase: 'TypeScript Compilation', schema: {
  type: 'object',
  properties: {
    backendErrors: { type: 'array', items: { type: 'string' } },
    frontendErrors: { type: 'array', items: { type: 'string' } },
    actualBugs: { type: 'array', items: { type: 'string' } }
  }
}});

phase('Component Deep Dive');

// ============================================================
// STEP 6: Deep dive on key components
// Check the most critical components for all issues
// ============================================================

const componentDeepDive = await agent(`
Deep dive analysis of the most critical components.

Read and analyze COMPLETELY (not just parts):

CUSTOMER COMPONENTS (if exist):
1. frontend/src/components/customer/ServiceCard.tsx - Full analysis
2. frontend/src/components/customer/ServiceVariants.tsx - Full analysis
3. frontend/src/components/customer/BookingFormWizard.tsx - Full analysis
4. frontend/src/pages/customer/BookServicePage.tsx - Full analysis

PROVIDER COMPONENTS:
1. frontend/src/components/provider/ServiceManagement.tsx
2. frontend/src/components/provider/AddServiceModal.tsx
3. frontend/src/components/provider/EditServiceModal.tsx
4. frontend/src/components/provider/CalendarView.tsx
5. frontend/src/components/provider/ProviderAvailabilityWidget.tsx

ADMIN COMPONENTS:
1. frontend/src/components/admin/VerificationQueue.tsx
2. frontend/src/components/admin/ServiceApprovalPanel.tsx
3. frontend/src/components/admin/ProviderListPanel.tsx
4. frontend/src/components/admin/AdminTable.tsx

For EACH component, do a complete analysis:

1. PROPS:
   - What props does it receive?
   - Are all props used?
   - Are there optional props that should be required?
   - Are prop types correct?

2. STATE:
   - What state does it manage?
   - Is state initialized correctly?
   - Is state updated properly?
   - Is state cleaned up?

3. EFFECTS:
   - What side effects does it have?
   - Are effects cleaned up?
   - Are dependencies correct?
   - Are there infinite loops?

4. RENDER:
   - What does it render?
   - Are there conditional render issues?
   - Are keys correct for lists?
   - Are null/undefined handled?

5. HANDLERS:
   - What event handlers does it have?
   - Are handlers memoized?
   - Do handlers have proper error handling?
   - Are handlers removed on unmount?

6. API CALLS:
   - What API calls does it make?
   - Are errors handled?
   - Is loading state shown?
   - Is data validated?

Return COMPLETE list of all issues found in each component.
`, {phase: 'Component Deep Dive', schema: {
  type: 'object',
  properties: {
    customerComponentIssues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          component: { type: 'string' },
          file: { type: 'string' },
          severity: { type: 'string' },
          issue: { type: 'string' },
          line: { type: 'number' },
          fix: { type: 'string' }
        }
      }
    },
    providerComponentIssues: { type: 'array', items: { type: 'object' } },
    adminComponentIssues: { type: 'array', items: { type: 'object' } }
  }
}});

phase('Compile Report');

// ============================================================
// STEP 7: Compile all issues and deduplicate
// ============================================================

// Combine all issues from all phases
const allIssues = [
  ...(antiPatternsFound.mockDataIssues || []).map(function(i) { return {...i, category: 'mockData', severity: 'high'}; }),
  ...(antiPatternsFound.errorSwallowingIssues || []).map(function(i) { return {...i, category: 'errorSwallowing', severity: 'high'}; }),
  ...(antiPatternsFound.raceConditionIssues || []).map(function(i) { return {...i, category: 'raceCondition', severity: 'critical'}; }),
  ...(antiPatternsFound.memoryLeakIssues || []).map(function(i) { return {...i, category: 'memoryLeak', severity: 'high'}; }),
  ...(antiPatternsFound.hardcodedValueIssues || []).map(function(i) { return {...i, category: 'hardcoded', severity: 'medium'}; }),
  ...(antiPatternsFound.anyTypeIssues || []).map(function(i) { return {...i, category: 'anyType', severity: 'medium'}; }),
  ...(antiPatternsFound.navigationIssues || []).map(function(i) { return {...i, category: 'navigation', severity: 'critical'}; }),
  ...(dataFlowIssues.customerFlowGaps || []).map(function(i) { return {...i, category: 'dataFlow', severity: 'high'}; }),
  ...(navigationIssues.wrongNavigationTargets || []).map(function(i) { return {...i, category: 'navigation', severity: 'critical'}; }),
  ...(apiIssues.missingLoadingStates || []).map(function(i) { return {...i, category: 'api', severity: 'medium'}; }),
  ...(apiIssues.errorNotShownToUser || []).map(function(i) { return {...i, category: 'api', severity: 'high'}; }),
  ...(componentDeepDive.customerComponentIssues || []).map(function(i) { return {...i, category: 'component'}; }),
  ...(componentDeepDive.providerComponentIssues || []).map(function(i) { return {...i, category: 'component'}; }),
  ...(componentDeepDive.adminComponentIssues || []).map(function(i) { return {...i, category: 'component'}; })
];

// Filter out duplicates and create unique issues
var uniqueIssues = [];
var seen = {};
for (var i = 0; i < allIssues.length; i++) {
  var issue = allIssues[i];
  var key = (issue.file || '') + (issue.line || 0) + (issue.category || '');
  if (!seen[key]) {
    seen[key] = true;
    uniqueIssues.push(issue);
  }
}

// Categorize by severity
var bySeverity = {
  critical: [],
  high: [],
  medium: [],
  low: []
};
for (var j = 0; j < uniqueIssues.length; j++) {
  var sev = uniqueIssues[j].severity || 'low';
  if (sev === 'critical') bySeverity.critical.push(uniqueIssues[j]);
  else if (sev === 'high') bySeverity.high.push(uniqueIssues[j]);
  else if (sev === 'medium') bySeverity.medium.push(uniqueIssues[j]);
  else bySeverity.low.push(uniqueIssues[j]);
}

// Generate report
var report = [
  '# Ultra-Thorough Audit Report',
  '',
  '## Summary',
  '- Total Unique Issues Found: ' + uniqueIssues.length,
  '- Critical: ' + bySeverity.critical.length,
  '- High: ' + bySeverity.high.length,
  '- Medium: ' + bySeverity.medium.length,
  '- Low: ' + bySeverity.low.length,
  '',
  '## Anti-Patterns Found (Grep Search)',
  '- Mock Data Issues: ' + (antiPatternsFound.mockDataIssues?.length || 0),
  '- Error Swallowing: ' + (antiPatternsFound.errorSwallowingIssues?.length || 0),
  '- Race Conditions: ' + (antiPatternsFound.raceConditionIssues?.length || 0),
  '- Memory Leaks: ' + (antiPatternsFound.memoryLeakIssues?.length || 0),
  '- Hardcoded Values: ' + (antiPatternsFound.hardcodedValueIssues?.length || 0),
  '',
  '## Navigation Issues',
  '- Wrong Targets: ' + (navigationIssues.wrongNavigationTargets?.length || 0),
  '- Missing Data: ' + (navigationIssues.missingDataInNavigation?.length || 0),
  '',
  '## Data Flow Issues',
  '- Customer Flow Gaps: ' + (dataFlowIssues.customerFlowGaps?.length || 0),
  '- Provider Flow Gaps: ' + (dataFlowIssues.providerFlowGaps?.length || 0),
  '',
  '## Component Deep Dive',
  '- Customer Components: ' + (componentDeepDive.customerComponentIssues?.length || 0),
  '- Provider Components: ' + (componentDeepDive.providerComponentIssues?.length || 0),
  '- Admin Components: ' + (componentDeepDive.adminComponentIssues?.length || 0),
  '',
  '## Critical Issues',
  bySeverity.critical.map(function(i) {
    return '- ' + (i.file || '') + ':' + (i.line || 0) + ' - ' + (i.issue || '');
  }).join('\n'),
  '',
  '## High Priority Issues',
  bySeverity.high.map(function(i) {
    return '- ' + (i.file || '') + ':' + (i.line || 0) + ' - ' + (i.issue || '');
  }).join('\n'),
  '',
  '## All Issues Ready for Fixing',
  uniqueIssues.length + ' issues collected and deduplicated.'
].join('\n');

log(report);

return {
  report: report,
  totalIssues: uniqueIssues.length,
  bySeverity: bySeverity,
  allIssues: uniqueIssues
};