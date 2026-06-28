# Backend TODO Tracker

This file lists all `TODO` comments in the backend codebase, organized by priority.

---

## High Priority

_None._

---

## Medium Priority

### 1. Provider analytics email — notification integration (RESOLVED)
- **File:** `backend/src/jobs/providerAnalyticsEmail.job.ts`
- **Status:** COMPLETED - The provider analytics digest email job is now fully wired to `notificationService.sendEmail()`.
- **Implementation:** HTML email template is implemented with branded design, stats grid, upcoming bookings, and CTA button.

---

## Low Priority

### 2. Tenant-config coordinate lookup
- **File:** `backend/src/services/provider.service.ts:158`
- **Comment:** `// TODO: Replace with tenant config lookup when multi-tenant coordinates are implemented`
- **Description:** Currently using a hard-coded coordinate lookup. Should be replaced with a tenant-aware config lookup once multi-tenant coordinates are supported.
- **Action:** Replace the temporary coordinate resolution with a tenant-config-driven implementation when the multi-tenant coordinates feature lands.

---

## Notes
- Generated from a codebase-wide scan on 2026-06-18.
- If you add a new `TODO` comment, please append it to this file in the appropriate priority section.
