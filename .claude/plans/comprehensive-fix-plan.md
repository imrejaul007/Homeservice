# BookServicesPage Comprehensive Fix Plan

## Overview
All issues from 11 audit agents compiled and prioritized. Fixing in 4 phases.

**Total issues: 230**
- Critical: 24
- Moderate: 81
- Minor: 125

---

## PHASE 1: Critical Fixes (Must Fix Before Launch)

### 1.1 Backend Security (Critical)
**Files:** `backend/src/services/search.service.ts`, `backend/src/controllers/search.controller.ts`

| # | File | Issue | Fix |
|---|------|-------|------|
| C1 | search.service.ts ~1353 | Meilisearch has no tenant isolation — all search results are global | Add `tenantId` to Meilisearch filterableAttributes and apply in all queries |
| C2 | search.service.ts ~1603 | searchServicesWithGeo Meilisearch path missing tenant isolation | Add tenantId filter to geo search |
| C3 | search.service.ts ~1847 | MongoDB fallback doesn't apply `isDeleted` filter | Add `isDeleted: { $ne: true }` to fallbackSearch |
| C4 | search.service.ts ~1944 | reindexAllServices ignores tenant + isDeleted | Add tenant filter + `isDeleted: { $ne: true }` |
| C5 | search.service.ts ~287 | refreshSearchTermsCache missing tenant + isDeleted | Add both filters to Service.find |
| C6 | search.controller.ts ~1240 | trackServiceClick missing tenant context | Add getTenantContext(req) validation |
| C7 | search.service.ts ~688 | geoFallbackSearch missing isDeleted filter | Add to searchQuery |
| C8 | search.service.ts ~1757 | performGeoSearch missing isDeleted filter | Add to searchQuery |
| C9 | search.service.ts ~1319 | Search cache key missing tenantId — cross-tenant hits | Include tenantId in buildSearchCacheKey |
| C10 | search.service.ts ~1409 | Meilisearch filterableAttributes missing tenantId, isDeleted, status | Add to initializeIndexes |
| C11 | search.service.ts ~1572 | getMongoSuggestions missing tenant + isDeleted | Add filters to Service.find |
| C12 | search.service.ts ~1953 | reindexAllServices missing isDeleted | Add filter |

### 1.2 Frontend Critical UX
**Files:** `BookServicesPage.tsx`, `ServiceCard.tsx`, `LazyMapView.tsx`, `Modal.tsx`

| # | File | Issue | Fix |
|---|------|-------|------|
| C13 | BookServicesPage.tsx | No skip-to-content link — keyboard users must tab through all nav | Add `<a href="#services-results" className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-white">Skip to main content</a>` as first element |
| C14 | BookServicesPage.tsx | Services section missing id for skip link target | Add `id="services-results"` to services `<section>` |
| C15 | LazyMapView.tsx | No ErrorBoundary — map error crashes entire page | Wrap LazyMapView in Suspense with error fallback |
| C16 | Modal.tsx | Modal z-50 below NavigationHeader z-100 — header covers modal | Change Modal overlay z-index to `z-[100]` |
| C17 | ComparisonBar.tsx | Bar z-40 below Modal z-50 — bar hidden under modal | Change bar z-index to `z-[60]` |
| C18 | ComparisonBar.tsx | Bar unmounts instantly with no exit animation | Keep bar mounted, use `hidden` class with slide-down animation |
| C19 | ServiceCard.tsx | 3D glow clipped by overflow-hidden parent | Move glow overlay outside overflow-hidden container or remove overflow-hidden from glow zone |
| C20 | ServiceCard.tsx | Favorites silently fail without providerId | Add guard: `if (!currentProviderId) { toast.error('Unable to favorite this service'); return; }` |
| C21 | BookServicesPage.tsx | No AbortController — race conditions on filter changes | Wrap fetchPopularServices with AbortController, abort on new request |
| C22 | BookServicesPage.tsx | Price inputs accept negative values | Add `min={0}` to both inputs, validate min <= max |
| C23 | SearchPage.tsx (referenced) | getPopularServices missing tenant + isDeleted | Add filters to getPopularServices query |
| C24 | search.controller.ts ~1096 | getServiceById missing tenant filter for ProviderProfile lookup | Add tenantId to ProviderProfile.findOne and User.findById |

---

## PHASE 2: High-Priority Moderate Fixes

### 2.1 BookServicesPage UX
**File:** `BookServicesPage.tsx`

| # | Line | Issue | Fix |
|---|------|-------|------|
| M1 | 186 | No timeout handling — API hangs indefinitely | Wrap with AbortController + 15s timeout, show retry UI |
| M2 | 186 | No request cancellation — race conditions | AbortController already added in C21 |
| M3 | 234 | Search input allows XSS characters | Sanitize with `DOMPurify` or escape regex before API call |
| M4 | 243 | Pagination error: page 2 fails → URL shows page 2 but no data | On fetch error for page > 1, auto-rollback to page 1 or show "Showing page 1" message |
| M5 | 438 | Categories hidden during search mode | Show compact category sidebar during search |
| M6 | 468 | Services section missing aria-label | Add `aria-label="Services results"` to section |
| M7 | 552 | Scrollbar hiding uses non-standard CSS | Add webkit prefix: `::-webkit-scrollbar { display: none }` |
| M8 | 586-609 | Price filter pills show 'AED 0' for free vs contact | Check `!service.price` vs `price === 0` and display "Contact for price" |
| M9 | 662 | Loading skeleton missing aria-busy | Add `aria-busy="true"` to skeleton grid container |
| M10 | 670 | Warning emoji in error state not accessible | Replace with `<AlertCircle>` from lucide-react |
| M11 | 720 | Map view has jarring instant switch from grid | Add fade transition between grid/map |
| M12 | 727 | Bottom CTA section visually weak vs hero | Add subtle card styling, increase py |

### 2.2 ServiceCard Polish
**File:** `ServiceCard.tsx`

| # | Line | Issue | Fix |
|---|------|-------|------|
| M13 | 160, 163 | Hardcoded `#EDE5DD` not NILIN token | Replace with `bg-nilin-cream` or add to tailwind config |
| M14 | 167 | Null check comment — remove FIX comment | Delete "// FIX: Added null check" comment |
| M15 | 232 | Compact variant missing aria-label on Book button | Add `aria-label="Book ${displayTitle}"` |
| M16 | 351 | Featured variant Book button missing aria-label | Add `aria-label="Book ${displayTitle}"` |
| M17 | 374 | 3D tilt useTilt3D missing onMouseMove | Verify useTilt3D attaches onMouseMove internally |
| M18 | 388 | Glow clipped by overflow-hidden | Fix from C19 |
| M19 | 463 | Quick view button not focusable via keyboard | Add `group-focus-within:opacity-100` and ensure `tabIndex={0}` on wrapper |
| M20 | 65-71 | prefers-reduced-motion not respected | Add `motion-reduce:transition-none motion-reduce:hover:transform-none` to card |
| M21 | 148 | Price extraction chaining fallbacks — debuggability | Extract to helper: `const extractPrice = (s) => ...` |
| M22 | 152 | Rating count extraction chaining fallbacks | Extract to helper: `const extractRating = (s) => ...` |
| M23 | 116 | Favorites API silently fails without providerId | Fix from C20 |
| M24 | 450 | Compare button aria-label generic | Update to 'Add to comparison' / 'Remove from comparison' |
| M25 | 460 | Compare button z-index conflict with quick view | Ensure proper stacking: compare z-10, quick view z-20 |

### 2.3 ServiceQuickViewModal
**File:** `ServiceQuickViewModal.tsx`

| # | Line | Issue | Fix |
|---|------|-------|------|
| M26 | 36 | Fetch failure silently caught — no user feedback | Add error state + toast.error('Failed to load service details') |
| M27 | 40 | Race condition on rapid service changes | Add AbortController or cleanup in useEffect |
| M28 | 89 | Images array bounds check missing | Add `Math.min(activeImageIndex, images.length - 1)` |
| M29 | 98, 106, 119 | Carousel uses bg-white instead of NILIN token | Replace with `bg-nilin-surface` |
| M30 | 129 | Empty state emoji not aria-hidden | Add `aria-hidden="true"` |
| M31 | 135 | Loading skeleton missing aria-busy | Add `aria-busy={loading}` |
| M32 | 152 | Star icon not aria-hidden | Add `aria-hidden="true"` |
| M33 | 176 | Clock icon not aria-hidden | Add `aria-hidden="true"` |
| M34 | 181 | MapPin icon not aria-hidden | Add `aria-hidden="true"` |
| M35 | 194, 216 | Check icons not aria-hidden | Add `aria-hidden="true"` |
| M36 | 165 | Description has no max-height — long descriptions expand modal | Add `line-clamp-3` or `max-height with overflow` |
| M37 | 209 | Free add-ons show no price vs "+ 0" | Show "Included" for free add-ons |
| M38 | 237 | Price 0 / missing shows "AED 0" | Show "Contact for price" for missing/0 |
| M39 | 254 | "View full details" link has no hover underline | Add `hover:underline` |
| M40 | 160 | Category text color warmGray could contrast better | Upgrade to `text-nilin-charcoal` |
| M41 | 162 | Title size too large for modal on mobile | Use `text-lg md:text-xl` instead of `text-xl md:text-2xl` |
| M42 | 172 | Meta info flex-wrap causes alignment issues | Use grid or consistent spacing |
| M43 | 188 | Section title has colon — inconsistent | Remove colon |
| M44 | 44-45 | Width transition abrupt | Add `transition-all duration-300` |

### 2.4 MapView & Related
**File:** `MapView.tsx`, `LazyMapView.tsx`, `MapSearchCard.tsx`

| # | File | Issue | Fix |
|---|------|-------|------|
| M45 | MapView.tsx 94 | border-nilin-border not defined in NILIN | Replace with `border-nilin-blush/40` |
| M46 | MapView.tsx 108 | border-nilin-border not defined | Replace with `border-nilin-blush/40` |
| M47 | MapView.tsx 168 | z-[1000] too high vs standard scale | Change to `z-[70]` |
| M48 | MapView.tsx 168 | Badge overlaps markers in dense areas | Add z-index separation |
| M49 | LazyMapView.tsx 19 | No error boundary for map render | Add ErrorBoundary inside Suspense |
| M50 | MapSearchCard.tsx 52 | Missing image fallback | Add gradient fallback div |
| M51 | MapSearchCard.tsx 50 | w-64 too narrow for content | Use `w-72` responsive |
| M52 | MapSearchCard.tsx 112 | Duration/price alignment inconsistent | Use `flex-1` for duration |

### 2.5 Pagination & Sort
**Files:** `Pagination.tsx`, `BookServicesPage.tsx`

| # | File | Line | Issue | Fix |
|---|------|------|-------|------|
| M53 | Pagination.tsx | 17-29 | getPageNumbers duplicate ellipsis edge case | Fix algorithm: `[1, '...', current-1, current, current+1, '...', total]` |
| M54 | Pagination.tsx | 86 | Border-transparent causes size jump | Use `border-nilin-blush/30` on inactive |
| M55 | Pagination.tsx | 90 | min-width 40 inconsistent | Use `min-w-[2.5rem]` |
| M56 | Pagination.tsx | 54 | Missing aria-label with page count | Add `aria-label="Pagination, page ${currentPage} of ${totalPages}"` |
| M57 | BookServicesPage.tsx | 186-225 | Pagination error recovery | On page > 1 failure, rollback to page 1 |

### 2.6 Backend Moderate Fixes
**Files:** `search.controller.ts`, `search.validation.ts`

| # | File | Line | Issue | Fix |
|---|------|------|-------|------|
| M58 | search.controller.ts | 260 | getSearchSuggestions MongoDB fallback missing isDeleted | Add filter |
| M59 | search.controller.ts | 282 | Category suggestions missing isDeleted | Add filter |
| M60 | search.controller.ts | 1023 | generateSearchSuggestions missing isDeleted + tenant | Add both |
| M61 | search.validation.ts | 49 | page=100 * limit=50 exceeds Meilisearch 1000 hits | Cap page * limit <= 1000 |

### 2.7 ComparisonBar Polish
**File:** `ComparisonBar.tsx`

| # | Line | Issue | Fix |
|---|------|-------|------|
| M62 | 21 | z-40 below modal z-50 | Change to `z-[60]` |
| M63 | 31 | Pills container missing aria-label | Add `aria-label="Selected services: ${items.length} of 4"` |
| M64 | 40 | Service title pill only has title attr for hover | Add `aria-label={title}` |
| M65 | 38 | Pill hover no visual feedback | Add `hover:bg-white/20` |
| M66 | 44 | Remove button touch target alignment | Use `p-2` instead of `min-w-[44px] min-h-[44px]` |

### 2.8 Navigation & Search
**Files:** `CustomerHubNav.tsx`, `SearchBar.tsx`

| # | File | Line | Issue | Fix |
|---|------|------|-------|------|
| M67 | CustomerHubNav.tsx | 36 | CSS var fallback missing | Add fallback values to var() |
| M68 | CustomerHubNav.tsx | 38 | max-w mismatch with page | Use same max-width token |
| M69 | BookServicesPage.tsx | 234 | Search sanitization | Add DOMPurify or escape regex |
| M70 | BookServicesPage.tsx | 186 | Network vs API error same message | Differentiate: 'No internet' vs 'Server error' |

### 2.9 Filter Panel
**Files:** `BookServicesPage.tsx`

| # | Line | Issue | Fix |
|---|------|-------|------|
| M71 | 468 | Services section label missing | Add `aria-labelledby` or `aria-label` |
| M72 | 536 | Filter button sm:hidden — mobile users can't access | Show filters on all breakpoints |
| M73 | 586 | Price pills AED 0 formatting | Use formatPrice utility |
| M74 | 590 | Remove filter aria-label missing | Add descriptive aria-label |
| M75 | 600 | Rating remove aria-label missing | Add descriptive aria-label |
| M76 | 605 | Clear all filters aria-label | Add `aria-label="Clear all filters"` |
| M77 | 615 | Price range label not associated with inputs | Use fieldset/legend pattern |
| M78 | 640 | Rating label not associated with buttons | Use fieldset/legend pattern |
| M79 | 549 | Category chips scrollbar hidden Chrome | Add webkit prefix |
| M80 | 586 | No active filter count badge | Add count badge to Filters button |

---

## PHASE 3: Minor Polish (Polish Sprint)

### 3.1 NILIN Token Consistency
**Files:** `BookServicesPage.tsx`, `ServiceQuickViewModal.tsx`, `MapView.tsx`

| # | File | Line | Issue | Fix |
|---|------|------|-------|------|
| N1 | BookServicesPage.tsx | 515 | bg-white in view toggle active | Replace with `bg-nilin-surface` |
| N2 | BookServicesPage.tsx | 527 | bg-white in view toggle active | Replace with `bg-nilin-surface` |
| N3 | BookServicesPage.tsx | 427 | bg-white backdrop | Replace with `bg-nilin-surface` |
| N4 | BookServicesPage.tsx | 393 | Clear button bg-gray-100 | Replace with `bg-nilin-muted` |
| N5 | BookServicesPage.tsx | 421 | Quick links bg-gray-100 | Replace with `bg-nilin-muted` |
| N6 | BookServicesPage.tsx | 605 | Clear filters bg-gray-100 | Replace with `bg-nilin-muted` |
| N7 | BookServicesPage.tsx | 436 | Search input bg-gray-50 | Replace with `bg-nilin-cream` |
| N8 | BookServicesPage.tsx | 756 | Bottom CTA bg-gray-900 | Replace with `bg-nilin-charcoal` |
| N9 | BookServicesPage.tsx | 753 | Bottom CTA text-gray-500 | Replace with `text-nilin-warmGray` |
| N10 | ServiceQuickViewModal | 98, 106 | Carousel buttons bg-white | Replace with `bg-nilin-surface/90` |
| N11 | ServiceQuickViewModal | 119 | Carousel dots bg-white | Replace with `bg-nilin-coral` |
| N12 | MapView.tsx | 168 | Badge bg-white/95 | Replace with `bg-nilin-surface/95` |
| N13 | tailwind.config.js | 212 | Safelist includes non-NILIN colors | Remove generic Tailwind gradients from safelist |

### 3.2 Accessibility Pass
**Files:** All components

| # | File | Line | Issue | Fix |
|---|------|------|-------|------|
| N14 | ServiceCard.tsx | 198, 293, 414, 423 | Star icons not aria-hidden | Add `aria-hidden="true"` |
| N15 | ServiceCard.tsx | 284, 414 | TrendingUp icons not aria-hidden | Add `aria-hidden="true"` |
| N16 | ServiceCard.tsx | 329, 335, 499, 505 | Clock/MapPin not aria-hidden | Add `aria-hidden="true"` |
| N17 | BookServicesPage.tsx | 332 | Sparkles icon not aria-hidden | Add `aria-hidden="true"` |
| N18 | BookServicesPage.tsx | 338 | Sparkles icon not aria-hidden | Add `aria-hidden="true"` |
| N19 | BookServicesPage.tsx | 393, 427 | Search icons not aria-hidden | Add `aria-hidden="true"` |
| N20 | BookServicesPage.tsx | 554 | Category chip All aria-label | Add `aria-label="Show all categories"` |
| N21 | BookServicesPage.tsx | 568 | Category chips missing aria-pressed | Add `aria-pressed={activeCategory === cat.slug}` |
| N22 | BookServicesPage.tsx | 643 | Rating chips missing aria-pressed | Add `aria-pressed={minRating === rating}` |
| N23 | BookServicesPage.tsx | 670 | Error emoji not aria-hidden | Add `aria-hidden="true"` |
| N24 | Pagination.tsx | — | Pagination nav aria improvements | Already has aria-current — verify all buttons |
| N25 | ServiceQuickViewModal | — | All decorative icons | Add aria-hidden="true" |
| N26 | ComparisonBar | — | All decorative icons | Add aria-hidden="true"` |
| N27 | MapView | — | All decorative icons | Add aria-hidden="true"` |

### 3.3 Animation & Interaction Polish
**Files:** All components

| # | File | Line | Issue | Fix |
|---|------|------|-------|------|
| N28 | BookServicesPage.tsx | 336-337 | Hero blobs static — add float animation | Add `animate-float-slow` keyframe |
| N29 | BookServicesPage.tsx | 421 | Quick links active scale abrupt | Add `transition-all duration-150` |
| N30 | BookServicesPage.tsx | 593 | Filter X button no press feedback | Add `active:scale-95` |
| N31 | BookServicesPage.tsx | 553 | Category chips scroll fade edges | Add gradient fade indicators |
| N32 | ServiceCard.tsx | 91 | 3D tilt animation motion-safe | Wrap in `motion-safe:` or check prefers-reduced-motion |
| N33 | ServiceCard.tsx | 380 | Default variant card no lift on hover | Add `hover:-translate-y-1 hover:shadow-nilin` |
| N34 | ServiceQuickViewModal | 118 | Carousel dot width transition abrupt | Add `transition-all duration-300` |
| N35 | ServiceQuickViewModal | 97, 105 | Carousel buttons no press feedback | Add `active:scale-95 transition-all` |
| N36 | Pagination.tsx | 89 | Active page button scale punch | Add `scale-105 animate-pulse` or pulse ring |
| N37 | ComparisonBar | 38 | Pill hover feedback | Add `hover:bg-white/20` |
| N38 | MapView.tsx | 168 | Badge above markers | Adjust z-index layering |

### 3.4 Code Cleanliness
**Files:** `BookServicesPage.tsx`, `ServiceCard.tsx`

| # | File | Line | Issue | Fix |
|---|------|------|-------|------|
| N39 | BookServicesPage.tsx | 2 | Unused `Link` import | Remove from react-router-dom import |
| N40 | BookServicesPage.tsx | 305 | JSON.stringify for filter comparison | Extract deep-equal helper or compare fields |
| N41 | BookServicesPage.tsx | 332 | Hero mt-4 vs categories mb-10 spacing | Standardize to `mt-6 mb-10` |
| N42 | BookServicesPage.tsx | 427 | Sort label inconsistent | Use consistent icon + label pattern |
| N43 | BookServicesPage.tsx | 427 | Price suffix '/ service' hardcoded | Extract constant PRICE_SUFFIX |
| N44 | BookServicesPage.tsx | 451 | MAX_CATEGORY_DISPLAY = 12 magic number | Extract constant |
| N45 | BookServicesPage.tsx | 567 | MAX_CATEGORY_CHIPS = 10 magic number | Extract constant |
| N46 | BookServicesPage.tsx | 480 | Showing range calculation fragile | Extract helper: getShowingRange() |
| N47 | BookServicesPage.tsx | 753 | Bottom CTA text weak | Upgrade to `text-nilin-charcoal` |
| N48 | ServiceCard.tsx | 345, 514 | 'by' prefix hardcoded | Extract or use i18n |
| N49 | ServiceCard.tsx | 232 | Compact variant title line-clamp-1 | Consider line-clamp-2 |
| N50 | ServiceCard.tsx | 313 | Featured title line-clamp-2 vs default | Standardize or adjust font sizes |
| N51 | ServiceCard.tsx | 517 | Price '/ service' suffix inconsistent | Remove or standardize |
| N52 | ServiceQuickViewModal | 188 | Section title colon | Remove colon |
| N53 | Pagination.tsx | 51 | No transition on pagination container | Add `transition-all` |
| N54 | MapView.tsx | — | Comment cleanup | Remove FIX comments |

### 3.5 Scrollbar & Mobile
**Files:** `BookServicesPage.tsx`, `ServiceCard.tsx`

| # | File | Line | Issue | Fix |
|---|------|------|-------|------|
| N55 | BookServicesPage.tsx | 549 | Category chips scrollbar Chrome | Add `::-webkit-scrollbar { display: none }` |
| N56 | BookServicesPage.tsx | 436 | Search input scrollbar | Add webkit scrollbar hide |
| N57 | BookServicesPage.tsx | 724 | Map height jump from grid | Use responsive formula or smooth transition |
| N58 | ServiceCard.tsx | 396 | Image zoom scale-110 clips | Use `scale-105` |
| N59 | ServiceCard.tsx | 383 | 3D tilt glow distracting | Reduce glow opacity or disable on dense grids |
| N60 | ServiceCard.tsx | 397 | Badge overlap on card | Consolidate badge positions |

### 3.6 Tailwind Config & Type Safety
**File:** `tailwind.config.js`

| # | Line | Issue | Fix |
|---|------|-------|------|
| N61 | 212 | Safelist includes non-NILIN gradient colors | Remove amber/orange/purple/teal/cyan from safelist — keep only nilin gradients |
| N62 | — | Add `scrollbar-hide` utility if missing | Verify `scrollbarWidth: 'none'` utility exists |
| N63 | — | Verify `animate-float-slow` keyframe exists | Add if missing |
| N64 | — | Verify `animate-shimmer` keyframe exists | Add if missing |

---

## PHASE 4: Nice-to-Have (Deferred)

### 4.1 Additional Features (Low Priority)
These features enhance UX but don't affect launch. Implement post-launch.

| # | Feature | File | Notes |
|---|---------|------|-------|
| F1 | Recently Viewed section | BookServicesPage.tsx | Component exists at RecentlyViewed.tsx |
| F2 | Recommendations section | BookServicesPage.tsx | SmartDiscovery.tsx, recommendationApi.ts exist |
| F3 | New Arrivals section | BookServicesPage.tsx | Use sortBy='newest' + createdAt filter |
| F4 | Trending This Week section | BookServicesPage.tsx | TrendingServices.tsx, trendingApi.ts exist |
| F5 | Near You geo section | BookServicesPage.tsx | Requires geolocation API + distance sort |
| F6 | Service bundles on cards | ServiceCard.tsx | Show discount badges |
| F7 | Bulk select mode | BookServicesPage.tsx | Checkbox mode + batch actions |
| F8 | Infinite scroll option | BookServicesPage.tsx | Toggle vs pagination |
| F9 | Cart / Book All | BookServicesPage.tsx | New cart store + floating cart icon |
| F10 | Compare page route | App.tsx | Create /services/compare page |
| F11 | Map clustering | MapView.tsx | leaflet.markercluster integration |
| F12 | Unsaved changes warning | BookServicesPage.tsx | beforeunload handler |
| F13 | Share search | BookServicesPage.tsx | Web Share API + clipboard |
| F14 | Notify me (inactive services) | ServiceCard.tsx | Backend notification endpoint needed |
| F15 | Mobile BottomSheet filters | BookServicesPage.tsx | AnimatedBottomSheet exists |
| F16 | Responsive map height mobile | MapView.tsx | Use vh units |

### 4.2 Performance Optimizations (Post-Launch)

| # | Optimization | File | Notes |
|---|--------------|-------|-------|
| P1 | Image srcSet / responsive images | ServiceCard.tsx | Lazy load + responsive images |
| P2 | Virtualized grid for 50+ results | BookServicesPage.tsx | react-virtual or windowing |
| P3 | ServiceCard memoization | ServiceCard.tsx | React.memo with custom comparison |
| P4 | Prefetch service details on hover | BookServicesPage.tsx | linkHover prefetch |
| P5 | ServiceWorker caching | — | Workbox for offline support |
| P6 | Core Web Vitals focus | BookServicesPage.tsx | LCP, CLS, FID optimization |

---

## Implementation Checklist (Per Phase)

### Phase 1 Critical
- [ ] C1-C12: Backend tenant + isDeleted fixes
- [ ] C13-C14: Skip link + section id
- [ ] C15-C17: Error boundaries + z-index fixes
- [ ] C18-C19: Animation + glow overflow
- [ ] C20-C22: Favorites guard + AbortController + input validation
- [ ] C23-C24: Backend service endpoints
- [ ] TypeScript compiles clean
- [ ] Smoke test: page loads, filters work, modal opens, map renders

### Phase 2 Moderate
- [ ] M1-M80: All moderate fixes
- [ ] TypeScript clean
- [ ] No console errors
- [ ] Test: filter combinations, pagination, mobile view

### Phase 3 Minor
- [ ] N1-N64: All minor fixes
- [ ] TypeScript clean
- [ ] Polish pass: verify NILIN tokens throughout

### Phase 4 Deferred
- [ ] F1-F16: Features
- [ ] P1-P6: Performance

---

## Files to Modify

### Backend (4 files)
1. `backend/src/services/search.service.ts` — tenant + isDeleted + cache
2. `backend/src/controllers/search.controller.ts` — tenant + isDeleted
3. `backend/src/middleware/validation/search.validation.ts` — Joi limits
4. `backend/src/routes/search.routes.ts` — rate limiting (if added)

### Frontend (15 files)
1. `frontend/src/pages/customer/BookServicesPage.tsx` — main fixes
2. `frontend/src/components/customer/ServiceCard.tsx` — accessibility + polish
3. `frontend/src/components/customer/ServiceQuickViewModal.tsx` — polish + accessibility
4. `frontend/src/components/common/Modal.tsx` — z-index fix
5. `frontend/src/components/common/Pagination.tsx` — polish
6. `frontend/src/components/search/MapView.tsx` — polish
7. `frontend/src/components/search/LazyMapView.tsx` — error boundary
8. `frontend/src/components/search/MapSearchCard.tsx` — polish
9. `frontend/src/components/search/ComparisonBar.tsx` — polish + z-index
10. `frontend/src/components/customer/CustomerHubNav.tsx` — polish
11. `frontend/src/pages/SearchPage.tsx` — backend fixes verification
12. `frontend/src/services/searchApi.ts` — timeout + retry
13. `frontend/tailwind.config.js` — safelist cleanup
14. `frontend/src/stores/savedSearchStore.ts` — if error handling needed
15. `frontend/src/styles/globals.css` — scrollbar utilities, animations

### New Files (0 in Phase 1-3)

---

## Verification Plan

### Unit Tests
- Filter combinations work correctly
- Pagination edge cases (first page, last page, ellipsis)
- Price/rating extraction helpers
- AbortController cancellation
- Toast notifications fire correctly

### Integration Tests
- Backend: tenant isolation verified with multi-tenant test accounts
- Backend: isDeleted services never returned in results
- Frontend: filter → URL sync → fetch → render cycle
- Map: graceful fallback when no coordinates
- Comparison: cross-page state persistence

### E2E Tests (Playwright)
- [ ] Homepage → BookServicesPage → filter → paginate → quick view → book
- [ ] Map view → marker click → popup → details
- [ ] Compare 3 services → comparison bar → modal → comparison page
- [ ] Save search → refresh → pills persist
- [ ] Mobile: filter → sort → view toggle → map
- [ ] Keyboard nav: skip link → filters → cards → book

### Visual Regression
- Hero section matches design spec
- Service cards match design spec
- Map view matches design spec
- Mobile breakpoints at 320px, 375px, 768px, 1024px, 1280px

### Performance
- Lighthouse score > 90 on all metrics
- LCP < 2.5s
- CLS < 0.1
- FID < 100ms
- No layout shift on filter/pagination changes

### Accessibility
- axe-core: 0 violations
- Keyboard-only navigation complete flow
- Screen reader announcements for all dynamic content
- prefers-reduced-motion respected
- Color contrast WCAG AA all text
