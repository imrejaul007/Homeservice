export const meta = {
  name: 'fix-compare-modal-all-issues',
  description: 'Fix all 106 root causes in the compare modal feature, then re-audit with all 11 skills',
  phases: [
    { title: 'Phase 1: Fix HIGH/CRITICAL' },
    { title: 'Phase 2: Fix MEDIUM' },
    { title: 'Phase 3: Fix LOW/nice-to-have' },
    { title: 'Phase 4: Re-audit with all 11 skills' },
    { title: 'Phase 5: Fix remaining issues' },
  ],
};

const SCRATCH = 'C:/Users/user/OneDrive/Desktop/rez-v5/Homeservice/frontend';

// ============================================================
// PHASE 1: HIGH/CRITICAL FIXES (6 agents)
// ============================================================
phase('Phase 1: Fix HIGH/CRITICAL');

const t1 = agent(`Add missing design-system tokens to the NILIN tailwind config.

Read: ${SCRATCH}/tailwind.config.js

Add these missing tokens (do NOT modify existing values):
1. In borderRadius: add 'nilin': '12px', 'nilin-lg': '16px', 'nilin-sm': '8px'
2. In boxShadow: add 'nilin-warm-lg': '0 8px 30px rgba(212, 168, 154, 0.18)'

Return a brief summary of what you added.`, {label: 'fix:tailwind-tokens', phase: 'Phase 1'});

const t2 = agent(`Fix the ComparisonBar component.

Read: ${SCRATCH}/src/components/search/ComparisonBar.tsx

Apply ALL of these fixes:
1. Replace 'rounded-2xl' with 'rounded-xl'
2. Replace 'shadow-2xl' with 'shadow-nilin-warm'
3. Change 'Compare Now' button 'rounded-full' to 'rounded-lg'
4. Add focus-visible ring to Compare Now: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-nilin-charcoal'
5. Add focus-visible ring to Trash2 and pill X buttons: same pattern with ring-white
6. Change 'text-white/60' to 'text-white/80'
7. Add 'aria-hidden="true"' to GitCompare icon, Trash2 icon, pill X icons (keep aria-label on buttons)
8. Wrap count span in aria-live="polite"
9. Add title={title} to the shortTitle span
10. Hide bar when modal open - wrap conditionally:
    {items.length >= 2 && !isModalOpen && <div className="fixed bottom-4 ...">...bar content...</div>}
    <ServiceComparisonModal open={isModalOpen} onOpenChange={setIsModalOpen} />
11. Hide scrollbar on pills: add 'scrollbar-width-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
12. Add 'flex-shrink-0' to Compare Now button
13. Add aria-label={\`Compare \${items.length} services\`} to Compare Now button
14. Add sr-only h2: '<h2 className="sr-only">Service comparison bar</h2>'

Return a brief summary.`, {label: 'fix:ComparisonBar-high', phase: 'Phase 1'});

const t3 = agent(`Fix the ServiceComparisonModal component - all HIGH and CRITICAL issues.

Read: ${SCRATCH}/src/components/search/ServiceComparisonModal.tsx

Apply ALL of these fixes:

1. REMOVE dead imports: Remove 'usePriceConversion, formatPrice' from imports, remove 'const { convert, format, currency } = usePriceConversion();' line

2. Fix modal width: Change size="xl" to size="lg" and add className="max-w-5xl" to Modal

3. Fix nested scroll: Change wrapper div to: 'overflow-x-auto overflow-y-auto max-h-[60vh] -mx-6 px-6 pb-2'

4. Fix action row scrolls away: Move Details/Book Now buttons OUT of the grid and into Modal's footer prop

5. Fix header card height: Change card to 'bg-nilin-muted rounded-xl p-3 border border-nilin-border min-h-[200px] flex flex-col', badge container: 'mt-auto'

6. Fix image not keyboard accessible: Replace clickable div with button with proper aria-label and focus-visible ring

7. Fix title not keyboard accessible: Convert h3 to button with proper aria-label and focus-visible ring, add font-serif

8. Fix remove X too small: Change 'p-1 w-3.5 h-3.5' to 'p-2 w-4 h-4 min-w-[44px] min-h-[44px] flex items-center justify-center'. Add e.stopPropagation()

9. Fix remove X contrast: Change 'text-nilin-warmGray' to 'text-nilin-charcoal/60' and hover to 'hover:text-nilin-error hover:bg-nilin-blush'

10. Add focus-visible ring to ALL buttons

11. Fix badge contrast: Change 'text-white' on coral to 'text-nilin-charcoal'

12. Fix metric labels contrast: Change 'text-nilin-warmGray' to 'text-nilin-charcoal/70', add 'font-bold'

13. Fix modal stays open with 1 item: Add useEffect to auto-close when services.length < 2

14. Fix header row alignment: Replace empty <div /> with '<div className="flex items-center text-xs font-bold text-nilin-charcoal/50 uppercase tracking-wide p-3">Compare</div>'

15. Fix image fallback: When no image, render placeholder div with Award icon

16. Fix price conversion: Import usePriceConversion, create convertedServices useMemo that converts all prices to AED using convert(), use convertedServices in buildComparison

Return a brief summary.`, {label: 'fix:SCM-high-critical', phase: 'Phase 1'});

const t4 = agent(`Fix the compare checkbox on ServiceCard.

Read: ${SCRATCH}/src/components/customer/ServiceCard.tsx

Apply:
1. Change 'text-transparent' to 'text-nilin-warmGray/40' on checkbox unchecked state
2. Add focus-visible ring: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-1'
3. Add 'transition-all duration-200' to checkbox button
4. When isInComparison is true, add 'scale-110' to the check icon

Return a brief summary.`, {label: 'fix:ServiceCard-high', phase: 'Phase 1'});

const t5 = agent(`Fix comparisonService for price conversion.

Read: ${SCRATCH}/src/services/comparisonService.ts

Update getPrice to handle the new shape where price may be { amount, currency, type }:
const amount = (s as any).pricing?.currentPrice ?? (typeof s.price === 'number' ? s.price : (s.price as any)?.amount ?? null);

Return a brief summary.`, {label: 'fix:comparisonService', phase: 'Phase 1'});

const t6 = agent(`Fix Modal component for comparison.

Read: ${SCRATCH}/src/components/common/Modal.tsx

Apply:
1. Add '2xl' size: in sizeStyles add '2xl: "max-w-3xl",'
2. Replace 'border-[#E8E4E0]' with 'border-nilin-border' in two places
3. Add 'aria-hidden="true"' to the X icon in ModalClose
4. Add focus-visible to ModalClose: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2'
5. Change description text from 'text-nilin-warmGray' to 'text-nilin-charcoal/70'

Return a brief summary.`, {label: 'fix:Modal', phase: 'Phase 1'});

const phase1Results = await Promise.all([t1, t2, t3, t4, t5, t6]);
log(`Phase 1: ${phase1Results.filter(Boolean).length}/6 agents completed`);

// ============================================================
// PHASE 2: MEDIUM FIXES (2 agents)
// ============================================================
phase('Phase 2: Fix MEDIUM');

const t7 = agent(`Fix ServiceComparisonModal MEDIUM priority issues.

Read: ${SCRATCH}/src/components/search/ServiceComparisonModal.tsx

Apply ALL:
1. Best badge hierarchy: when wins 3+ metrics show "Top Pick" badge, else individual badges
2. Dynamic description: \`Comparing \${services.length} services side-by-side - best price, rating, duration and distance highlighted\`
3. Metric label alignment: add p-3 and min-h-[48px] flex items-center
4. Metric label font: change 'text-xs' to 'text-sm', 'font-semibold' to 'font-bold'
5. Provider row alignment: add p-3 and min-h-[48px] flex items-center
6. Action buttons mobile: change 'flex gap-2' to 'flex flex-col sm:flex-row gap-2'
7. Action buttons shadow: add 'shadow-nilin' to Details, 'shadow-nilin-warm' to Book Now
8. Metric label cells: add scope="row"
9. Best badge aria: aria-label={\`Best in \${label}\`}
10. Remove X hover: change 'hover:bg-white' to 'hover:bg-nilin-blush'
11. Remove X overlap title: add 'pr-8' to title button
12. Action row visual: add 'border-t border-nilin-border/50 pt-3'
13. Empty spacer: replace with '<div aria-hidden="true" />'
14. Grid role: add role="table"
15. Metric cells: add 'min-h-[2.5rem]'
16. Scrollbar hiding: add 'scrollbar-width-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
17. Metric rows stagger animation: animate-fade-in-up with staggered delays
18. Metric separator: add 'border-b border-nilin-border/30'
19. Header cards hover: add 'hover:shadow-nilin-warm transition-shadow'
20. Remove button transition: add 'transition-all duration-200'
21. Badge transition: add 'transition-all duration-300'
22. Aria hidden on decorative icons: Star, Clock, MapPin, Award, Check

Return a brief summary.`, {label: 'fix:SCM-medium', phase: 'Phase 2'});

const t8 = agent(`Fix ComparisonBar MEDIUM priority issues.

Read: ${SCRATCH}/src/components/search/ComparisonBar.tsx

Apply:
1. Add "up to 4" indicator text next to count
2. Add backdrop blur: 'backdrop-blur-sm shadow-nilin-warm'
3. Add pulse to Compare Now when at capacity (items.length === 4)
4. Pill transition: 'transition-all duration-200'
5. Pill X touch target: 'min-w-[44px] min-h-[44px] flex items-center justify-center'

Return a brief summary.`, {label: 'fix:ComparisonBar-medium', phase: 'Phase 2'});

const phase2Results = await Promise.all([t7, t8]);
log(`Phase 2: ${phase2Results.filter(Boolean).length}/2 agents completed`);

// ============================================================
// PHASE 3: LOW/NICE-TO-HAVE (4 agents)
// ============================================================
phase('Phase 3: Fix LOW/nice-to-have');

const t9 = agent(`Final polish for ServiceComparisonModal.

Read: ${SCRATCH}/src/components/search/ServiceComparisonModal.tsx

Apply:
1. All decorative icons: add aria-hidden="true" to Star, Clock, MapPin, Award, Check
2. Image placeholder Award icon: aria-hidden="true"
3. Scroll containers: add 'scroll-smooth'
4. Grid wrapper: add 'animate-fade-in'

Return a brief summary.`, {label: 'fix:SCM-polish', phase: 'Phase 3'});

const t10 = agent(`Final polish for ComparisonBar.

Read: ${SCRATCH}/src/components/search/ComparisonBar.tsx

Apply:
1. Compare Now at capacity: conditional glow class
2. GitCompare icon: add 'drop-shadow-sm'
3. Bar container: add 'border border-white/10'
4. Count text: 'font-bold text-base'

Return a brief summary.`, {label: 'fix:ComparisonBar-polish', phase: 'Phase 3'});

const t11 = agent(`Final polish for ServiceCard.

Read: ${SCRATCH}/src/components/customer/ServiceCard.tsx

Apply:
1. Verify compare checkbox transition-all duration-200 present
2. Confirm check icon strokeWidth={3} is set

Return a brief summary.`, {label: 'fix:ServiceCard-polish', phase: 'Phase 3'});

const t12 = agent(`Final polish for Modal.

Read: ${SCRATCH}/src/components/common/Modal.tsx

Apply:
1. Modal overlay backdrop-blur-sm - already present, verify
2. Scale animation on open/close - already present, verify
3. Add 'scroll-smooth' to modal body
4. Add 'focus-within:ring-2 focus-within:ring-nilin-coral/20' to ModalContent

Return a brief summary.`, {label: 'fix:Modal-polish', phase: 'Phase 3'});

const phase3Results = await Promise.all([t9, t10, t11, t12]);
log(`Phase 3: ${phase3Results.filter(Boolean).length}/4 agents completed`);

// ============================================================
// PHASE 4: RE-AUDIT WITH ALL 11 SKILLS
// ============================================================
phase('Phase 4: Re-audit with all 11 skills');

const auditPrompt = `You are auditing the NILIN Homeservice compare modal feature AFTER fixes were applied.

Read these files thoroughly:
1. ${SCRATCH}/src/components/search/ServiceComparisonModal.tsx
2. ${SCRATCH}/src/components/search/ComparisonBar.tsx
3. ${SCRATCH}/src/components/common/Modal.tsx
4. ${SCRATCH}/src/components/customer/ServiceCard.tsx
5. ${SCRATCH}/src/services/comparisonService.ts
6. ${SCRATCH}/tailwind.config.js

Check for:
1. All HIGH/CRITICAL issues from original audit are fixed
2. No new bugs introduced by the fixes
3. Accessibility (keyboard nav, ARIA, contrast, focus rings)
4. Design token consistency
5. Scroll behavior works end-to-end
6. Production readiness

For EACH file, report: what was fixed correctly, any remaining issues, any new issues introduced.
Give an overall production readiness score (1-10) for the entire comparison feature.

Return a text summary of your findings. Be specific about what works and what does not.`;

// Launch all 11 audit agents in parallel
const audit1 = agent(auditPrompt + '\n\nFocus: Production UI craft, polish, dead code', {label: 'audit:impeccable', phase: 'Phase 4'});
const audit2 = agent(auditPrompt + '\n\nFocus: Layout rhythm, visual hierarchy, grid alignment', {label: 'audit:design-taste', phase: 'Phase 4'});
const audit3 = agent(auditPrompt + '\n\nFocus: NILIN brand consistency, color tokens, premium polish', {label: 'audit:high-end-visual', phase: 'Phase 4'});
const audit4 = agent(auditPrompt + '\n\nFocus: Click targets, z-index, animations, transitions', {label: 'audit:emil-design-eng', phase: 'Phase 4'});
const audit5 = agent(auditPrompt + '\n\nFocus: WCAG accessibility, keyboard nav, screen readers, ARIA', {label: 'audit:a11y-review', phase: 'Phase 4'});
const audit6 = agent(auditPrompt + '\n\nFocus: Design tokens consistency, brandkit adherence', {label: 'audit:brandkit', phase: 'Phase 4'});
const audit7 = agent(auditPrompt + '\n\nFocus: Top 5 highest-impact remaining polish issues', {label: 'audit:polish-focus', phase: 'Phase 4'});
const audit8 = agent(auditPrompt + '\n\nFocus: Backend integration, API routes, data freshness, localStorage', {label: 'audit:backend-flow', phase: 'Phase 4'});
const audit9 = agent(auditPrompt + '\n\nFocus: Error states, edge cases, null handling, loading states', {label: 'audit:error-handling', phase: 'Phase 4'});
const audit10 = agent(auditPrompt + '\n\nFocus: Missing features, functionality gaps, user flows', {label: 'audit:functionality', phase: 'Phase 4'});
const audit11 = agent(auditPrompt + '\n\nFocus: Edge cases, test scenarios, browser quirks', {label: 'audit:testing', phase: 'Phase 4'});

const auditResults = await Promise.all([audit1, audit2, audit3, audit4, audit5, audit6, audit7, audit8, audit9, audit10, audit11]);
log(`Phase 4: ${auditResults.filter(Boolean).length}/11 audit agents completed`);

// ============================================================
// PHASE 5: FIX REMAINING ISSUES
// ============================================================
phase('Phase 5: Fix remaining issues from re-audit');

const validAudits = auditResults.filter(Boolean);
const allFindings = validAudits.join('\n\n---\n\n');
log('=== ALL AUDIT FINDINGS ===');
log(allFindings.slice(0, 5000));

// Count how many issues are mentioned as remaining
const remainingCount = (allFindings.match(/remaining|not fixed|still broken|issue|problem|bug|error/i) || []).length;
log(`Mentions of remaining issues: ${remainingCount}`);

if (remainingCount > 0) {
  const finalFix = agent(`After reviewing the re-audit findings below, fix ALL remaining issues.

AUDIT FINDINGS:
${allFindings}

Files to fix:
- ${SCRATCH}/src/components/search/ServiceComparisonModal.tsx
- ${SCRATCH}/src/components/search/ComparisonBar.tsx
- ${SCRATCH}/src/components/common/Modal.tsx
- ${SCRATCH}/src/components/customer/ServiceCard.tsx
- ${SCRATCH}/src/services/comparisonService.ts
- ${SCRATCH}/tailwind.config.js

Read each file, identify remaining issues, and apply fixes.
Return a summary of all fixes applied.`, {label: 'fix:final-remaining', phase: 'Phase 5'});

  const finalResult = await finalFix;
  log(`Phase 5 result: ${finalResult}`);
}

return {
  phase1: phase1Results.filter(Boolean).length + '/6',
  phase2: phase2Results.filter(Boolean).length + '/2',
  phase3: phase3Results.filter(Boolean).length + '/4',
  phase4: auditResults.filter(Boolean).length + '/11',
  phase5: remainingCount > 0 ? 'fixes applied' : 'no remaining issues',
  allFindings: allFindings.slice(0, 3000),
};
