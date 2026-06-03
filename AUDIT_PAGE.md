# Quick Page Audit Prompt

## One-Click Audit

Copy and paste this into Claude Code:

```
/workflow workflows/page-audit.wf.ts
```

Then paste the screenshot or describe the page when asked.

---

## What Gets Audited

### 1. Frontend Analysis
- API calls and endpoints
- State management
- Error handling
- Loading states
- TypeScript types
- Accessibility
- Memory leaks

### 2. Backend Analysis
- Missing endpoints (404s)
- Response format
- Validation
- Security (IDOR, injection)
- Rate limiting
- Database queries

### 3. Cross-Connections
- Socket events (emitted vs subscribed)
- Data flow between pages
- Real-time updates
- Auth/role permissions

### 4. Data Integrity
- Type mismatches
- Field name inconsistencies
- Enum/status differences
- Pagination format
- Date/time handling

---

## What You Get

1. **Audit Report** - Issues ranked by severity
2. **Auto-Fixes** - Critical issues fixed automatically
3. **Remaining Work** - List of issues to address manually

---

## Example

```
You: /workflow workflows/page-audit.wf.ts

Claude: Please share a screenshot or describe the page you want to audit.

You: [paste screenshot of Provider Dashboard]

Claude: [launches 5 parallel agents]
       [analyzes code and connections]
       [creates detailed report]
       [fixes critical issues]
       [shows remaining work]
```

---

## Output Format

```
## Audit Results

- Critical Issues: 2 (fixed)
- High Issues: 5 (in plan)
- Medium Issues: 8 (in plan)
- Low Issues: 12 (documented)

## Fixed Issues
✅ Orphaned JSX at line 1172
✅ Missing 'suspended' status type

## Remaining Work
- Add pagination UI
- Implement WebSocket subscription
- Add rate limiting to endpoint
```

---

## Tips

1. **For best results**, share a screenshot AND describe the page
2. **For specific sections**, mention "focus on the analytics tab"
3. **For cross-page flow**, mention which other pages should connect
4. **For real-time issues**, mention what should update live

---

## Customization

Edit `workflows/page-audit.wf.ts` to:
- Add custom audit rules
- Focus on specific areas
- Change severity thresholds
- Add auto-fix patterns
