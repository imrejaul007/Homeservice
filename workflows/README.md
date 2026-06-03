# Page Audit Workflow

## Quick Start

To audit any page, run this command in Claude Code:

```
!workflow "page-audit.wf.ts"
```

Then describe the page you want to audit (or share a screenshot).

## What It Does

1. **Discovers** all related files (frontend, backend, models, sockets)
2. **Analyzes** in parallel:
   - Frontend: API calls, state, errors, accessibility
   - Backend: routes, controllers, security
   - Connections: socket events, data flow
   - Integrity: type mismatches, missing fields
3. **Creates** a detailed audit report
4. **Fixes** critical issues automatically

## Files Generated

- `PAGE_AUDIT_REPORT.md` - Detailed findings

## Manual Launch

```javascript
// From Claude Code:
/workflow page-audit.wf.ts
```

Or copy the workflow script path and pass to the Workflow tool.
