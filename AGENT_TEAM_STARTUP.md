# Agent Team Startup Prompts

## Quick Start

To start the production readiness loop, run this command in Claude Code:

```
/agent-loop-start
```

Or copy the prompts below into your session.

---

## Step 1: Create Team

```
Create a new agent team called "production-readiness" with these members:
- team-lead: orchestrator (general-purpose agent)
- frontend-auditor: frontend analyst (general-purpose agent)
- backend-auditor: backend analyst (general-purpose agent)
- admin-auditor: admin dashboard analyst (general-purpose agent)
- tester: verification agent (general-purpose agent)

Description: Comprehensive production readiness audit and fix loop for the Homeservice marketplace application.
```

---

## Step 2: Create Tasks

Create these tasks for the team:

### Task 1: Frontend Analysis - Customer & Provider Dashboards

```
Analyze the frontend codebase for production readiness issues.

Directories to analyze:
- frontend/src/pages/customer/
- frontend/src/pages/provider/
- frontend/src/pages/booking/
- frontend/src/components/customer/
- frontend/src/components/provider/
- frontend/src/stores/

For each file, identify and document:
1. User actions that wait for server response (candidates for optimistic UI)
2. Missing optimistic update patterns (state updates inside .then() or after await)
3. Missing error handling/rollback logic
4. Missing toast notifications for failures
5. Loading state issues
6. Form validation gaps
7. Accessibility issues

Output a structured report with:
- File path
- Issue type
- Current code pattern
- Recommended fix
- Estimated effort (small/medium/large)
```

### Task 2: Backend Analysis - API & Services

```
Analyze the backend codebase for production readiness issues.

Directories to analyze:
- backend/src/controllers/
- backend/src/services/
- backend/src/routes/
- backend/src/middleware/
- backend/src/models/

For each file, identify and document:
1. Missing request validation
2. Inconsistent error response formats
3. Missing rate limiting
4. Authorization gaps
5. Performance issues (N+1 queries, missing indexes)
6. Security vulnerabilities
7. Missing error handling

Output a structured report with:
- Endpoint/route
- Issue type
- Current code pattern
- Recommended fix
- Estimated effort (small/medium/large)
```

### Task 3: Admin Dashboard Analysis

```
Analyze the admin dashboard for production readiness issues.

Directories to analyze:
- frontend/src/pages/admin/
- frontend/src/components/admin/
- backend/src/controllers/admin*.ts

For each feature, identify and document:
1. Workflow completeness
2. Approval/rejection logic issues
3. Data consistency problems
4. Bulk operation handling
5. Audit trail gaps
6. Permission enforcement issues

Focus on:
- Provider verification workflow
- Booking management CRUD
- User management CRUD
- Financial operations (payouts, refunds)
- Coupon/Bundle management

Output a structured report with:
- Feature name
- Issue type
- Current behavior
- Recommended fix
- Estimated effort (small/medium/large)
```

### Task 4: Verification & Testing

```
After fixes are implemented, verify the changes work correctly.

Tasks:
1. Run frontend unit tests: cd frontend && npm test
2. Run backend unit tests: cd backend && npm test
3. Run E2E tests: cd frontend && npx playwright test
4. Manual verification of optimistic UI flows
5. Check for console errors
6. Test rollback behavior on errors

Report format:
- Test results summary
- Failed tests with details
- Console errors found
- UX observations
```

---

## Step 3: Team Lead Coordination Prompt

```
You are the Team Lead orchestrating the production readiness loop.

Coordination steps:
1. Assign Task 1 to frontend-auditor
2. Assign Task 2 to backend-auditor
3. Assign Task 3 to admin-auditor
4. Wait for all analysts to complete
5. Consolidate findings into a priority list
6. Assign implementation tasks
7. Assign Task 4 to tester for verification
8. Iterate until all critical issues are resolved

Priority order:
1. Critical/High issues (must fix before launch)
2. Medium issues (should fix soon)
3. Low/Polish issues (nice to have)

Report progress every iteration with:
- Issues found
- Issues fixed
- Remaining issues
- Next steps
```

---

## Iteration Template

For each iteration, the team lead should:

1. **Gather** findings from all auditors
2. **Categorize** issues by severity and type
3. **Prioritize** fixes using the matrix
4. **Assign** implementation to the appropriate agent
5. **Verify** with the tester
6. **Document** what was fixed
7. **Repeat** until criteria are met

### Critical Issues Definition

Issues that are critical (must fix before production):
- Security vulnerabilities
- Data loss scenarios
- Authentication/authorization bypasses
- Payment processing errors
- User data exposure
- Complete UI freezes

### High Priority Issues Definition

Issues that are high priority (should fix soon):
- Missing optimistic UI on frequent actions
- Poor error handling on common flows
- Performance issues on key pages
- Accessibility barriers
- Missing form validation

---

## Success Criteria for Each Iteration

Before marking an iteration complete:

- [ ] All critical issues identified are fixed
- [ ] High priority optimistic UI is implemented
- [ ] Error handling has rollback logic
- [ ] Toasts are shown on failures
- [ ] Tests pass
- [ ] No console errors on tested flows
