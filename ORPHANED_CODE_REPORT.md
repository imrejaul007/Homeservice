# ORPHANED CODE REPORT

## Code Usage Score: 42/100

---

## ORPHANED PAGES (Not Linked)

| Page | Route | Status |
|------|-------|--------|
| `LandingPage.tsx` | `/landing` | Only direct URL |
| `BeautyServices.tsx` | None | Orphaned |
| `PrivacySettings.tsx` | `/privacy-settings` | No navigation |
| `LaunchDashboard.tsx` | None | Orphaned |
| `AnalyticsDashboard.tsx` | None | Orphaned |
| `CustomerManagement.tsx` | None | Orphaned |
| `FraudReport.tsx` | None | Orphaned |
| `RefundManagement.tsx` | None | Orphaned |
| `PermissionManager.tsx` | None | Orphaned |
| `AIAssistantPage.tsx` | None | Orphaned |
| `DisputeCenter.tsx` | Both places | Duplicated |

---

## ORPHANED COMPONENTS

| Category | Count |
|----------|-------|
| Mobile tier (`aaa/`, `elite/`, `Premium*`) | ~30 |
| SuperApp features | ~8 |
| AI components | ~6 |
| Other unused | ~15 |

---

## ORPHANED BACKEND SERVICES (~50)

| Category | Count |
|----------|-------|
| AI services unused | 3 |
| Fraud/Abuse detection | 8 |
| Payment/Monetization | 12 |
| Marketing | 6 |
| Need consolidation | 5 pairs |

---

## DUPLICATE CODE

| Duplicate 1 | Duplicate 2 |
|-------------|-------------|
| `circuitBreaker.ts` | `circuitBreaker.service.ts` |
| `tax.service.ts` | `taxService.ts` |
| `churnPrediction.service.ts` | `ai/churnPrediction.service.ts` |
| `fraudDetection.service.ts` | `ai/fraudDetection.service.ts` |
| `TrustBadge.tsx` (3x) | Keep only `product/TrustBadge` |

---

## RECOMMENDATIONS

### Delete Immediately
1. Mobile tier components (no premium tiers implemented)
2. SuperApp components (features never built)
3. AI components not connected to UI
4. Duplicate TrustBadge implementations

### Investigate Before Delete
1. Admin pages (may need navigation exposure)
2. Landing page (may be for SEO)
3. Automation routes with TODO comments

### Consolidate
1. Churn prediction services
2. Fraud detection services
3. Tax service naming

---

## ESTIMATED WASTE
- **Dead code:** 58% of codebase
- **Bundle size impact:** ~35% unused code bundled
