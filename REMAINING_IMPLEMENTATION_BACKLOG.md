# NILIN Home Service — Remaining Implementation Backlog

**Last verified:** 2026-06-27 (tenth full-stack audit + multi-batch fix pass)  
**Excludes:** Environment variables, third-party account setup, automated/E2E testing  
**Companion docs:** `docs/DEPLOYMENT.md`, `backend/src/docs/openapi.yaml`

---

## Executive Summary

Tenth audit + fix pass: **~139 issues identified; ~120+ addressed** across customer, provider, admin, auth, booking, chat, and performance layers.

### Build status

| Package | `npx tsc --noEmit` |
|---------|-------------------|
| Frontend | **PASS** |
| Backend | **PASS** (after TS fixes 2026-06-27) |

### Codebase health

| Check | Result |
|-------|--------|
| `not yet implemented` | **0 matches** |
| `TODO` / `FIXME` | **0 matches** |
| `getMock` / `MOCK_*` | **0 matches** |
| Mock payment `4242` in src | **0** (e2e test card only) |
| Two-arg `toast.error` misuse | **0** |
| Unrouted customer/admin nav links | **0** (all wired) |

**Status: production-ready pending env setup + manual QA.**

---

## What Was Fixed (2026-06-27)

### Customer
- Routes: AI assistant, GDPR, privacy settings, dispute detail
- My Claims → dispute detail flow
- GDPR API history/consent alignment
- Stripe payment methods via `/payments/methods`
- Analytics wired to `/customers/stats` + `/customers/analytics`
- CustomerHealthScore on dashboard + analytics
- Toast/error handling standardized

### Provider
- Verification upload flow, managed contracts auth
- Notification deep-links, bundle pagination
- Hub nav, verification guard, draft auto-save
- Settings PATCH alignment, calendar socket refresh

### Admin
- 17 missing routes registered
- Booking cancel/refund/export, global search auth
- Widget read-only guards, PermissionManager read-only
- Demo routes gated, churn/report API paths fixed

### Auth & Security
- Token refresh parsing, production CORS
- Provider registration payload + captcha
- Track booking email verification + PII reduction
- Login 2FA step, sessionId header

### Booking & Public
- PaymentPage route, wallet/coupon checkout
- BookServicePage cleanup, status label alignment
- Public page error handling, Demo gate

### Performance
- Lazy ProviderDashboard, scroll-behavior fix
- HomePage CTA placement, React Query dashboard
- Lazy home sections, toast deduplication

---

## Remaining Optional Items (P3)

| Item | Notes |
|------|-------|
| OpenAPI sync | Update `openapi.yaml` for new admin/booking routes |
| Widget mutation APIs | Implement PATCH handlers or keep read-only UI |
| Backend sub-admin roles | Align `super_admin`/`moderator` with User model |
| HomePage BFF endpoint | Single `/home/feed` to replace waterfall |
| E2E test suite | Not in scope for code backlog |
| Native FCM manifest | App store only |

---

## Launch Checklist

1. Set `VITE_API_URL`, `ALLOWED_ORIGINS`, `JWT_*`, `STRIPE_*` per `docs/DEPLOYMENT.md`
2. Set `VITE_ENFORCE_EMAIL_VERIFICATION=true` if required
3. Disable demo routes in production (auto-gated)
4. Run manual smoke test: login → book → pay → track → wallet → provider accept
5. Run admin smoke test: bookings, disputes, payouts

---

## How to Re-run Audit

```bash
rg -i "not yet implemented|getMock|MOCK_|TODO|FIXME" frontend/src backend/src --glob "!**/*.test.*"
cd backend && npx tsc --noEmit && cd ../frontend && npx tsc --noEmit
```
