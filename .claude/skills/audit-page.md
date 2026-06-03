# Page Audit & Fix Command

## Triggers

- `/audit-page`
- `/pageaudit`
- `/auditpage`

## Description

Launches a comprehensive multi-agent audit of any page including:
- Frontend code analysis
- Backend API verification
- Cross-page connections
- Data mismatch detection
- Automatic fix implementation

## Usage

```
/audit-page
```

Then provide the screenshot or describe the page to audit.

## How It Works

### Step 1: Analyze
Launches 5 parallel sub-agents:
1. **Frontend** - Component analysis, API calls, state
2. **Backend** - Routes, controllers, models
3. **Connections** - Cross-page data flow, sockets
4. **Integrity** - Type mismatches, missing fields
5. **Screenshot** - UI/UX comparison (if image provided)

### Step 2: Gap Analysis
- 404 errors
- Data mismatches
- Broken connections
- Missing features

### Step 3: Plan
Creates `PAGE_AUDIT_REPORT.md` with:
- Priority-ranked issues
- Specific code changes
- Files to modify

### Step 4: Fix
- Implements critical fixes automatically
- Verifies TypeScript compiles
- Reports remaining work

## Arguments

This skill takes no arguments. When invoked:
1. Ask user to provide screenshot or page description
2. Identify the relevant files
3. Launch parallel audit agents
4. Create plan and implement fixes

## Output Files

- `PAGE_AUDIT_REPORT.md` - Detailed audit findings
- `IMPLEMENTATION_PLAN.md` - Actionable fix plan

## Example Flow

```
User: /audit-page
Assistant: Please share a screenshot or describe the page you want to audit.
User: [shares screenshot of AdminDashboard]
Assistant: [launches 5 parallel agents]
         [analyzes frontend, backend, connections]
         [creates report and plan]
         [implements fixes]
```

## Notes

- Works for admin, provider, customer pages
- Analyzes both frontend and backend
- Checks socket connections
- Verifies data consistency across pages
- Prioritizes production-ready implementation
