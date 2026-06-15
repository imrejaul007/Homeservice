# Improve UI Skill

## Purpose
Launch all 11 skills to comprehensively audit and improve any UI component or page.

## When to Use
- User shares a screenshot and asks to improve it
- User says "improve this", "fix the UI", "audit this page"
- User wants full-stack audit (UI + backend)

## Skills Launched

### Frontend/UI (7 skills)
1. `impeccable` - Production UI craft, polish
2. `design-taste` - Layout rhythm, visual hierarchy
3. `high-end-visual` - NILIN brand, premium polish
4. `emil-design-eng` - Click/z-index, animations
5. `a11y-review` - WCAG compliance, accessibility
6. `brandkit` - Design tokens & consistency
7. `polish-focus` - Top 5 premium improvements

### Full-Stack (4 skills)
8. `backend-flow` - API routes, data flow, gaps
9. `error-handling` - 404 errors, data mismatch
10. `functionality` - Missing features, gaps
11. `testing` - Edge cases, error states

## Workflow

### Phase 1: UI Audit (7 parallel agents)
Each skill analyzes the component/page for its specific concerns.

### Phase 2: Full-Stack Audit (4 parallel agents)
Backend flow, error handling, missing functionality, edge cases.

### Phase 3: Apply Fixes
- UI fixes: brand colors, hover states, z-index, animations, accessibility
- Backend fixes: error handling, API integration, loading states

### Phase 4: Verify
- TypeScript errors
- Console.log statements
- Code cleanliness

## Invocation
```
Skill.invoke('improve-ui', { page: 'path/to/file.tsx', description: 'optional focus' })
```

Or simply say:
- "improve this UI"
- "audit this page"
- "fix everything"

## Output
Returns comprehensive summary of:
- All issues found (categorized by skill)
- Fixes applied
- Remaining manual work needed
