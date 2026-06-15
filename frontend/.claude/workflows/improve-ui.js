/**
 * Improve UI & Full-Stack Workflow
 * Usage: /improve-ui [optional description of what to fix]
 *
 * Auto-launches ALL skills for comprehensive improvement:
 *
 * FRONTEND/UI (7 skills):
 * - impeccable: Production UI craft, polish
 * - design-taste: Layout rhythm, visual hierarchy
 * - high-end-visual: NILIN brand, premium polish
 * - emil-design-eng: Click/z-index, animations
 * - a11y-review: WCAG compliance, accessibility
 * - polish-focus: Top 5 premium improvements
 * - brandkit: Design tokens & consistency
 *
 * FULL-STACK (4 skills):
 * - backend-flow: API routes, data flow, gaps
 * - error-handling: 404 errors, data mismatch
 * - functionality: Missing features, gaps
 * - testing: Edge cases, error states
 */

export const meta = {
  name: 'improve-ui',
  description: 'Launch ALL skills: UI polish + backend flow + functionality gaps',
  triggers: ['/improve-ui', '/fix-ui', '/ui-audit', '/fix-all', '/full-audit'],
};

export const script = async (args) => {
  const { page, description } = args;

  log(`🔍 Starting FULL AUDIT for: ${page || 'Current page/component'}`);
  if (description) log(`📝 Focus: ${description}`);

  // ============================================
  // PHASE 1: UI/FRONTEND AUDIT (7 skills)
  // ============================================
  phase('UI Audit (7 skills)');

  const uiAudits = await parallel([
    () => agent(`Read and audit ${page || 'the component'}

Apply 'impeccable' skill:
- Production UI craft standards
- Polish & refinement
- Design system compliance
- Pixel-perfect implementation
- Edge cases, error states

Return: {issues: [], priority_fixes: []}`, { phase: 'UI: Impeccable', label: 'impeccable' }),

    () => agent(`Read and audit ${page || 'the component'}

Apply 'design-taste' skill:
- Layout rhythm & visual hierarchy
- Typography consistency
- Color usage & balance
- Spacing system
- Proportion & rhythm

Return: {design_issues: [], taste_improvements: []}`, { phase: 'UI: Design Taste', label: 'design-taste' }),

    () => agent(`Read and audit ${page || 'the component'}

Apply 'high-end-visual' skill:
- NILIN brand consistency
- Premium visual polish
- Shadow & depth hierarchy
- Gradient application
- Premium animations

Return: {visual_issues: [], brand_violations: []}`, { phase: 'UI: High-End Visual', label: 'high-end-visual' }),

    () => agent(`Read and audit ${page || 'the component'}

Apply 'emil-design-eng' skill:
- Click/z-index issues
- Animation engineering
- Interaction states
- Focus management
- Micro-interactions
- Loading states

Return: {engineering_issues: [], interaction_fixes: []}`, { phase: 'UI: Design Eng', label: 'emil-design-eng' }),

    () => agent(`Read and audit ${page || 'the component'}

Apply 'a11y-review' skill:
- WCAG 2.1 compliance
- Keyboard navigation
- Screen reader support
- Color contrast (4.5:1 minimum)
- Focus indicators
- ARIA labels

Return: {a11y_issues: [], wcag_violations: []}`, { phase: 'UI: Accessibility', label: 'a11y-review' }),

    () => agent(`Read and audit ${page || 'the component'}

Apply 'brandkit' skill:
- Design token consistency
- Color system compliance
- Typography scale
- Spacing tokens
- Border radius

Return: {brand_issues: [], token_fixes: []}`, { phase: 'UI: Brandkit', label: 'brandkit' }),

    () => agent(`Read ${page || 'the component'}

Apply 'polish-focus' skill:
Identify TOP 5 premium improvements:
1. Highest impact visual changes
2. Quick wins for polish
3. Detailing opportunities

Return: {top_5: [], effort_benefit: []}`, { phase: 'UI: Polish Focus', label: 'polish-focus' }),
  ]);

  // ============================================
  // PHASE 2: FULL-STACK/BACKEND AUDIT (4 skills)
  // ============================================
  phase('Full-Stack Audit');

  const fullstackAudits = await parallel([
    () => agent(`Read and audit ${page || 'the component/page'}

Perform 'backend-flow' audit:
- API routes and endpoints
- Data flow from frontend to backend
- Missing API integrations
- Incorrect HTTP methods
- Missing error handling
- Data validation gaps
- Race conditions

Return: {flow_issues: [], missing_integration: []}`, { phase: 'Backend: Flow', label: 'backend-flow' }),

    () => agent(`Read and audit ${page || 'the component/page'}

Perform 'error-handling' audit:
- 404 error handling
- 500 error handling
- Network error handling
- Data mismatch between API responses and UI expectations
- Type mismatches
- Null/undefined handling
- Empty states

Return: {error_issues: [], data_mismatches: []}`, { phase: 'Backend: Error Handling', label: 'error-handling' }),

    () => agent(`Read and audit ${page || 'the component/page'}

Perform 'functionality' audit:
- Missing features compared to requirements
- Gaps in user flow
- Incomplete CRUD operations
- Missing form validations
- Missing confirmations/dialogs
- Missing loading states
- Missing toast notifications
- Missing error messages

Return: {missing_functionality: [], flow_gaps: []}`, { phase: 'Backend: Functionality', label: 'functionality' }),

    () => agent(`Read and audit ${page || 'the component/page'}

Perform 'testing' audit:
- Edge cases not handled
- Boundary conditions
- Empty data scenarios
- Large data scenarios
- Concurrent operations
- Undo/redo missing
- Confirmation dialogs needed

Return: {edge_cases: [], test_scenarios: []}`, { phase: 'Backend: Testing', label: 'testing' }),
  ]);

  // ============================================
  // PHASE 3: APPLY ALL FIXES
  // ============================================
  phase('Applying Fixes');

  const fixesApplied = await parallel([
    () => agent(`Read ${page || 'the component'}

Apply UI fixes:
1. Fix click/z-index issues in dropdowns and modals
2. Ensure proper focus states on all interactive elements
3. Polish hover/active states on cards and buttons
4. Apply brand-consistent colors
5. Fix animation inconsistencies
6. Apply premium polish
7. Fix accessibility issues
8. Add missing ARIA labels

Make actual code changes. Return: {files_modified: [], fixes_summary: []}`),

    () => agent(`Read ${page || 'the component/page'}

Apply backend/full-stack fixes:
1. Add proper error handling (404, 500, network)
2. Fix data mismatch issues
3. Add missing API integrations
4. Fix missing loading states
5. Add toast notifications for errors
6. Fix missing validations
7. Add missing confirmations
8. Handle edge cases

Make actual code changes. Return: {files_modified: [], backend_fixes: []}`),
  ]);

  // ============================================
  // PHASE 4: VERIFY & SUMMARY
  // ============================================
  phase('Verifying');

  const verification = await agent(`Verify the changes:
- No TypeScript errors
- No console.log statements left
- All imports used
- Proper JSX structure
- Error handling in place
- Loading states added

Return: {status: 'pass/fail', remaining_issues: []}`);

  // Compile comprehensive summary
  const summary = await agent(`Create a comprehensive summary markdown of ALL findings and fixes:

Categorize by:
1. UI Issues (impeccable, design-taste, high-end-visual, emil-design-eng)
2. Accessibility Issues (a11y-review)
3. Brand Issues (brandkit)
4. Backend Flow Issues
5. Error Handling Issues
6. Missing Functionality
7. Edge Cases

For each issue, show:
- Issue description
- Severity (Critical/High/Medium/Low)
- Fix applied (or needs manual fix)

Return as formatted markdown.`);

  return {
    // UI Audits (7)
    ui_impeccable: uiAudits[0],
    ui_design_taste: uiAudits[1],
    ui_high_end_visual: uiAudits[2],
    ui_design_eng: uiAudits[3],
    ui_accessibility: uiAudits[4],
    ui_brandkit: uiAudits[5],
    ui_polish_focus: uiAudits[6],

    // Full-stack Audits (4)
    backend_flow: fullstackAudits[0],
    error_handling: fullstackAudits[1],
    functionality: fullstackAudits[2],
    testing: fullstackAudits[3],

    // Fixes
    fixes_applied: fixesApplied,

    // Verification
    verification: verification,

    // Summary
    summary: summary,

    skills_used: [
      // UI (7)
      'impeccable', 'design-taste', 'high-end-visual',
      'emil-design-eng', 'a11y-review', 'brandkit', 'polish-focus',
      // Full-stack (4)
      'backend-flow', 'error-handling', 'functionality', 'testing'
    ],
    total_skills: 11,
    timestamp: new Date().toISOString(),
  };
};
