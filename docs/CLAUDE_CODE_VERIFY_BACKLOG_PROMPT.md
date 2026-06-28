# Claude Code Prompt — Verify Backlog & Update REMAINING_IMPLEMENTATION_BACKLOG.md

Copy everything inside the **prompt block** below and paste it into Claude Code.

---

## PROMPT (copy from here)

```
You are auditing the NILIN Home Service monorepo at the workspace root to verify whether all implementation backlog items have been completed, then updating the backlog document to reflect the truth.

## Your mission

1. **Verify** every item listed in `REMAINING_IMPLEMENTATION_BACKLOG.md` against the actual codebase (do not trust the markdown — prove each claim with file paths and grep/search evidence).
2. **Discover** any NEW gaps not listed in the file (TODOs, mock fallbacks, 503 routes, frontend calls with no backend route).
3. **Update** `REMAINING_IMPLEMENTATION_BACKLOG.md` in place so it accurately reflects what is DONE vs what is STILL LEFT.
4. **Do not** implement fixes in this pass — verification and documentation only (unless an item is trivially wrong in the doc and you need a one-line correction).

## Exclusions (do not audit or list)

- Environment variables and `.env` setup
- Third-party account provisioning (Stripe dashboard, etc.)
- Automated tests, E2E tests, Playwright, unit test coverage
- Git commits unless I explicitly ask

---

## Verification methodology (follow in order)

### Step 1 — Read the backlog

Read these files first:
- `REMAINING_IMPLEMENTATION_BACKLOG.md` (source of truth to update)
- `WORK_DONE_2026-06-25.md` (context on what was claimed done)

### Step 2 — P0 critical gaps (must verify with backend route + frontend caller)

For each item, confirm BOTH sides exist and paths match:

| Item | Frontend | Backend to find |
|------|----------|-----------------|
| Saved providers | `frontend/src/components/customer/SavedProvidersQuickBook.tsx` | `GET /customer/saved-providers` OR redirect to `/favorites` |
| Recurring subscriptions | `frontend/src/components/customer/RecurringBookingSetup.tsx` | `GET/POST /customer/subscriptions` or equivalent |
| Provider digest email | `backend/src/jobs/providerAnalyticsEmail.job.ts` | Must call `notification.service` or email transport — no bare TODO |

Search:
```bash
rg "saved-providers|customer/subscriptions" backend/src frontend/src
rg "TODO.*notification|providerAnalyticsEmail" backend/src/jobs
```

### Step 3 — Feature flags

Read `backend/src/routes/app.routes.ts` — record actual values of:
- `chatWithProvider`
- `realTimeTracking`

If enabled, verify UI entry points exist on booking detail pages.

### Step 4 — Admin widgets (Section 11 reference list)

Verify `backend/src/routes/adminWidget.routes.ts` and `adminWidget.controller.ts` export handlers for EVERY route listed in Section 11 of the backlog. For each route, confirm:
- Route is mounted (check `backend/src/routes/index.ts`)
- Controller function exists and returns real data (not empty stub, not Math.random)

Routes to spot-check:
`fake-booking-detection`, `provider-abuse`, `customer-abuse`, `providers/risk`, `revenue-by-city`, `reconciliation`, `commissions/reports`, `tax-reports`, `refunds/analytics`, `suspensions`, `appeals`, `background-checks`, `verification-queue`, `incidents`, `supply-demand`, `provider-utilization`, `geographic/performance`, `onboarding-funnel`, `funnel-dropoff`, `customer-journey`, `vip/segment`, `forecasting`, `provider-pl`, `unit-economics`, `weather-impact`, `training-academy`, `saas/magic-number`, `safe-search`, `reports/templates`, `churn/predictions`, `automation/winback`

### Step 5 — Automation platform

Verify:
- `backend/src/routes/automationApi.routes.ts` — endpoints match `frontend/src/services/automationApi.ts`
- `backend/src/routes/automation.routes.ts` — no `notImplemented()` / 503 for welcome, winback, status, review-request, referral
- `backend/src/routes/automationAdmin.routes.ts` — uses `AutomationLog` model, NO `Math.random()` for logs
- `backend/src/models/automationLog.model.ts` exists

Search:
```bash
rg "notImplemented|FEATURE_NOT_AVAILABLE|Math\.random" backend/src/routes/automation
```

### Step 6 — Hero slides admin UI

Verify:
- `backend/src/routes/hero.admin.routes.ts` mounted
- `frontend/src/pages/admin/HeroSlideManager.tsx` exists
- Route in `frontend/src/App.tsx` (e.g. `/admin/hero-slides`)
- Link in `frontend/src/components/admin/AdminNav.tsx`

### Step 7 — Mock / placeholder data sweep

Run these searches and inspect hits (ignore `frontend/src/test/` and vitest mocks):

```bash
rg -i "getMock|MOCK_|mock data|generateMock|Math\.random\(\)" frontend/src --glob "!**/*.test.*" --glob "!**/test/**"
rg "not yet implemented|TODO|FIXME" backend/src frontend/src --glob "!**/node_modules/**"
```

For each real hit (not test files), classify: FIXED / STILL OPEN / INTENTIONAL (e.g. decorative UI).

Pay special attention to:
- `CustomerHealthScore.tsx` — `generateHealthScoreData`
- `ReferralShare.tsx` — `FRIEND_AVATARS`
- `ServiceBundles.tsx`, `PermissionManager.tsx`, `OnboardingChecklist.tsx`, `EquipmentRental.tsx`

### Step 8 — Email & SMS

Check:
- `providerAnalyticsEmail.job.ts` — email actually sent?
- `platformEmailTransport.service.ts` — SES/SendGrid still stubbed?
- `platformSmsTransport.service.ts` — non-Twilio providers?

### Step 9 — Export & reporting

- `analytics.routes.ts` — PDF export still stub?
- `CustomReports.tsx` — uses `/admin/reports/scheduled`?
- Scheduled report job — does cron actually email reports?

### Step 10 — UI routes & technical debt

Verify:
- `bookingApi.ts` — any imports from components? (`rg "from.*bookingApi" frontend/src`)
- `components/dashboard/CustomerDashboard.tsx` — still exists?
- `pages/CustomerDashboard.tsx` — deleted?
- OpenAPI: `backend/src/docs/openapi.yaml` exists and is non-empty
- Deployment: `docs/DEPLOYMENT.md` exists

### Step 11 — TypeScript compile check

Run:
```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

Record pass/fail in the updated backlog.

---

## How to update REMAINING_IMPLEMENTATION_BACKLOG.md

Rewrite the file with this structure (keep it manager-readable):

1. **Header** — set `Last verified:` to today's date (YYYY-MM-DD)
2. **Executive Summary** — counts: items verified done, items still open, launch readiness verdict
3. **Verification Results Table** — every backlog item with columns:
   - Item | Priority | Status (DONE / OPEN / PARTIAL) | Evidence (file:line or route path) | Notes
4. **Sections 1–10** — only include items that are **still OPEN or PARTIAL**. Move completed items to Section 11.
5. **Section 11 — Completed (Reference)** — expanded list of everything verified done, with evidence paths
6. **New findings** — anything discovered in Step 7 not in the original backlog
7. **Suggested next steps** — ordered by priority, only for OPEN items
8. **Verdict table** — update answers based on audit

### Status definitions

- **DONE** — backend route + frontend wired, no mock fallback, no TODO blocking the feature
- **PARTIAL** — API exists but UI missing, or UI exists but API stub, or feature flag off
- **OPEN** — not implemented or broken path (frontend 404)

### Writing rules

- Be precise. Cite `path/to/file.ts` and route paths.
- Do not claim "done" without grep or file read evidence.
- If I implemented something under a different path/name, document the actual path.
- Keep the file under ~400 lines unless many new findings require more.
- Do not create additional markdown files unless I ask — only update `REMAINING_IMPLEMENTATION_BACKLOG.md`.

---

## Deliverables

When finished, reply with:

1. **Summary** — 5–10 bullets: what was verified done, what is still open, launch ready Y/N
2. **Counts** — DONE / PARTIAL / OPEN / NEW findings
3. **Confirmation** — "Updated `REMAINING_IMPLEMENTATION_BACKLOG.md`" with date in header
4. **Top 3 blockers** — if any P0 items remain

Do not stop at analysis only — you must write the updated markdown file.
```

---

## END PROMPT

---

## Optional follow-up prompts

### After verification — implement remaining P0 only

```
Read the updated REMAINING_IMPLEMENTATION_BACKLOG.md Section 1 (Critical Gaps). Implement every OPEN P0 item only. After each fix, re-run backend and frontend tsc --noEmit. Then update the backlog again marking those items DONE with evidence.
```

### After verification — enable feature flags

```
Read REMAINING_IMPLEMENTATION_BACKLOG.md Section 2. If chatWithProvider and realTimeTracking are still false, implement the minimum wiring to enable them safely (flag + UI entry points + verify socket/chat routes). Update the backlog when done.
```

### Quick re-verify only (no file edit)

```
Run a 10-minute spot-check of REMAINING_IMPLEMENTATION_BACKLOG.md Section 1 and Section 6 only. Report DONE/OPEN for each row with grep evidence. Do not edit any files.
```

---

## Tips for Claude Code

- Run searches in **parallel** where possible (backend routes + frontend services together).
- Prefer `rg` over reading entire large files.
- If the repo path differs, use workspace root: `Homeservice/` or full path on your machine.
- If `tsc` fails, note failures in the backlog under a new "Build status" row but still complete the audit.

---

*Created for post-implementation verification after the 2026-06-25 production-readiness pass.*
