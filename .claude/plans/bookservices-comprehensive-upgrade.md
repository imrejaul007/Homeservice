# BookServicesPage Comprehensive Upgrade Plan

## Overview

Upgrade the `BookServicesPage` (`frontend/src/pages/customer/BookServicesPage.tsx`) from a basic "12 services" grid into a production-ready browsing experience with **7 features**:

1. **Reuse Shared ServiceCard** + Comparison Integration
2. **Pagination** (proper page navigation, not just 12 results)
3. **Filters** (Price range, Min rating, Category chips, Sort)
4. **Quick View Modal** (lazy-loaded service details)
5. **Map View** (reuse LazyMapView from SearchPage)
6. **Sort Dropdown** (Most Popular, Price, Rating, Newest)
7. **Saved Searches** (localStorage-backed)

All features will be implemented in sequence, with user approval after each. We will keep the production-ready code quality (NILIN tokens, accessibility, focus states, motion-reduce support) established in the prior audit.

---

## Architecture: Reuse What's Built

### Already-Built Components We'll Reuse
- `frontend/src/components/customer/ServiceCard.tsx` — has comparison, favorite, accessibility built in
- `frontend/src/components/search/LazyMapView.tsx` — Map view (Leaflet, OSM tiles)
- `frontend/src/components/search/ComparisonBar.tsx` — Floating comparison bar
- `frontend/src/components/search/ServiceComparisonModal.tsx` — Comparison modal
- `frontend/src/components/search/MapSearchCard.tsx` — Map popup card
- `frontend/src/components/common/Modal.tsx` — Radix UI modal with NILIN design
- `frontend/src/components/common/CardSkeleton.tsx` — Loading skeleton
- `frontend/src/stores/comparisonStore.ts` — Cross-page comparison state

### Components to Extract/Reuse from SearchPage
- `getPageNumbers()` logic → `src/hooks/usePagination.ts`
- Category chip row pattern → already in SearchPage, will inline
- Sort dropdown pattern → already in SearchPage, will inline

### Components We'll Build New
- `frontend/src/components/customer/ServiceQuickViewModal.tsx` — Quick view modal
- `frontend/src/components/customer/FilterPanel.tsx` — Inline filter chips/sort/price/rating
- `frontend/src/components/customer/Pagination.tsx` — Reusable pagination
- `frontend/src/stores/savedSearchStore.ts` — Saved searches (localStorage)
- `frontend/src/hooks/useServiceDetail.ts` — Service detail cache + fetch

---

## Implementation Order (with Approximate Time)

| # | Feature | Time | Risk |
|---|---------|------|------|
| 1 | Reuse ServiceCard + add ComparisonBar | 1h | Low |
| 2 | Add Map View toggle | 1.5h | Low |
| 3 | Add Pagination | 2h | Medium |
| 4 | Add Sort Dropdown | 0.5h | Low |
| 5 | Add Filters (Category chips, Price, Rating) | 3h | Medium |
| 6 | Add Quick View Modal | 2h | Low |
| 7 | Add Saved Searches | 2h | Low |
| **Total** | | **~12h** | |

---

## Feature 1: Reuse Shared ServiceCard + Add ComparisonBar

### What
Replace the inline `ServiceCardInline` component with the shared `ServiceCard` from `components/customer/ServiceCard.tsx`. The shared component already has:
- Compare checkbox integration
- Favorite button with optimistic updates
- Full accessibility (aria-label, aria-pressed, focus-visible)
- NILIN brand tokens
- Quick view support hooks

Then mount `<ComparisonBar />` on the page so users see the floating comparison tray.

### Files to Modify
- `frontend/src/pages/customer/BookServicesPage.tsx`:
  - Remove the inline `ServiceCardInline` component (lines 75-336, ~260 lines)
  - Remove related imports: `Heart`, `Star`, `Clock`, `MapPin`, `Zap`, `TrendingUp`, `Filter`, `Grid3X3`, `Sparkles`, `favoritesApi`, `useAuthStore`
  - Import the shared `ServiceCard` from `../../components/customer/ServiceCard`
  - Replace `<ServiceCardInline ... />` with `<ServiceCard ... />` in the grid (lines ~660-690)
  - Add `import ComparisonBar from '../search/ComparisonBar'` and mount before `<Footer />`
  - Remove the `handleToggleFavorite` logic (now in shared component)
  - Keep `handleBookNow` (still needed)

### Verification
- [ ] Cards show compare checkbox in bottom-right
- [ ] Selecting 2 services shows the floating ComparisonBar
- [ ] Clicking ComparisonBar opens the comparison modal
- [ ] Selecting same services on SearchPage (or vice versa) works (cross-page via localStorage)
- [ ] No TypeScript errors

---

## Feature 2: Add Map View Toggle

### What
Add a "Grid / Map" view toggle in the services section header. Map view uses the existing `LazyMapView` component from the prior session.

### Files to Modify
- `frontend/src/pages/customer/BookServicesPage.tsx`:
  - Add `viewMode` state: `useState<'grid' | 'map'>('grid')`
  - Import `LayoutGrid` and `Map as MapIcon` from `lucide-react`
  - Import `LazyMapView` from `../../components/search/LazyMapView`
  - Add toggle buttons in the services section header (next to "Popular Services" title)
  - Conditionally render `<LazyMapView>` or the grid based on `viewMode`

### Verification
- [ ] Toggle button switches between grid and map
- [ ] Map shows service markers (services with `location.coordinates`)
- [ ] Map popups show correct service details
- [ ] Compare checkbox works in map popups
- [ ] Map gracefully shows empty state when no coordinates

---

## Feature 3: Add Pagination

### What
Replace the hardcoded `page: 1, limit: 12` with proper URL-driven pagination. Add a reusable `Pagination` component and reuse the `getPageNumbers()` logic from SearchPage.

### Backend
- The `searchServices` endpoint already returns `pagination` metadata (page, limit, total, pages, hasNext, hasPrev).
- The `getPopularServices` endpoint does **NOT** return pagination metadata — this is a known limitation.
- **Decision**: For "popular" mode, we'll use `searchServices` with `sortBy: 'popularity'` to get pagination support. This requires updating the fetch logic.

### Files to Create
- `frontend/src/components/common/Pagination.tsx`:
  - Reusable component with prev/next + numbered page buttons + ellipsis
  - Props: `currentPage`, `totalPages`, `onPageChange`
  - Uses NILIN tokens, focus-visible states
  - ARIA: `aria-current="page"`, `aria-label="Previous page"`, `aria-label="Next page"`

### Files to Modify
- `frontend/src/pages/customer/BookServicesPage.tsx`:
  - Add `pagination` state: `{ page, limit, total, pages }`
  - Read `page` from URL params (similar to SearchPage)
  - Update `fetchPopularServices` to:
    - Use `searchApi.searchServices({ sortBy: 'popularity', page, limit: 12 })` for both modes
    - Read `response.data.pagination` and update state
  - Add `handlePageChange` callback that updates URL `page` param
  - Render `<Pagination>` below the grid (only when `pagination.pages > 1`)
  - Extract `getPageNumbers()` helper to `usePagination` hook or inline

### Verification
- [ ] Page navigation works (next/prev/numbered)
- [ ] URL updates with `?page=2` and reflects on share
- [ ] Pagination ellipsis shows correctly (1 ... 5 6 7 ... 20)
- [ ] Reset to page 1 when search query changes
- [ ] Smooth scroll to top on page change

---

## Feature 4: Add Sort Dropdown

### What
Add a sort dropdown in the services section header. Options: Most Popular (default), Price: Low→High, Price: High→Low, Highest Rated, Newest.

### Files to Modify
- `frontend/src/pages/customer/BookServicesPage.tsx`:
  - Add `sortBy` URL param (already supported by backend)
  - Add a `<select>` dropdown in services section header (right side)
  - Options match the SearchPage pattern (lines 568-578)

### Backend
- Already supported. `sortBy: 'popularity' | 'price' | 'price_desc' | 'rating' | 'newest' | 'distance'`
- For non-search mode, default to `popularity`

### Verification
- [ ] Selecting "Price: Low→High" sorts ascending
- [ ] Selecting "Highest Rated" sorts by rating desc
- [ ] Sort selection persists in URL
- [ ] Sort applies on page change

---

## Feature 5: Add Filters (Category Chips, Price, Rating)

### What
Add filter UI inline to the services section (visible when not on the search mode):
- **Category chips row** (horizontal scroll, like SearchPage)
- **Price range** (inline range slider OR "Min" + "Max" inputs)
- **Min rating** (5 button chips: 1+, 2+, 3+, 4+, 4.5+)

### Files to Create
- `frontend/src/components/customer/FilterBar.tsx`:
  - Compound component: `<FilterBar>`, `<FilterBar.CategoryChips>`, `<FilterBar.SortDropdown>`, `<FilterBar.PriceRange>`, `<FilterBar.RatingFilter>`
  - Or simpler: just a single `FilterBar` with all sub-filters inside
  - Manages its own state, calls back to parent with applied filters
  - Mobile: shows a "Filters" button that opens a `BottomSheet` with the filters
  - Desktop: shows inline

- `frontend/src/components/customer/PriceRangeSlider.tsx`:
  - Dual-handle range slider (or two inputs for min/max)
  - Uses `searchApi.getSearchFilters()` to get dynamic max
  - Step: 500 (AED currency)

- `frontend/src/components/customer/RatingFilter.tsx`:
  - 5 buttons: 1+, 2+, 3+, 4+, 4.5+
  - Toggle off when same rating clicked
  - Active state in `bg-nilin-coral`

### Files to Modify
- `frontend/src/pages/customer/BookServicesPage.tsx`:
  - Add filter state (priceRange, minRating, sortBy) — could use URL params
  - Add category chips row above services section
  - Add filter controls in services section header
  - Update fetch to include filters
  - Reset to page 1 when filter changes

### Backend
- All filters already supported by `searchServices` endpoint
- `getSearchFilters` returns dynamic price range limits

### Verification
- [ ] Category chips filter by category
- [ ] Price range slider filters by min/max price
- [ ] Min rating filter works
- [ ] Filters combine (e.g., category + price + rating)
- [ ] Filter changes reset to page 1
- [ ] Active filter chips show as removable pills
- [ ] Mobile: filters accessible via BottomSheet

---

## Feature 6: Add Quick View Modal

### What
Add a "Quick View" modal that shows service details without navigating away. Triggered by an eye icon button on the card (visible on hover).

### Files to Create
- `frontend/src/components/customer/ServiceQuickViewModal.tsx`:
  - Uses `Modal` component (size="xl" or custom max-w-2xl)
  - Props: `service: Service | null`, `open: boolean`, `onClose: () => void`
  - Lazy-fetches `getServiceById` when opened (uses `useServiceDetail` cache hook)
  - Shows loading skeleton while fetching
  - Renders: image carousel, category, title, rating, duration, location, provider, description, included items, price, Book CTA
  - Mobile: full-screen bottom sheet variant
  - Desktop: centered modal with image carousel
  - Accessibility: focus trap (built into Modal), aria-labels, keyboard navigation
  - Image carousel: use existing `HeroCarousel` pattern or build a simple stateful carousel

- `frontend/src/hooks/useServiceDetail.ts`:
  - In-memory Map cache for service details (session-level)
  - Returns `{ data, loading, error, refetch }`
  - Auto-fetches when `serviceId` changes
  - Caches result so subsequent opens are instant

- `frontend/src/components/customer/ServiceImageCarousel.tsx` (or inline in QuickView):
  - Simple carousel for `service.images[]`
  - Prev/Next buttons
  - Dots indicator
  - Keyboard navigation (left/right arrows)

### Files to Modify
- `frontend/src/components/customer/ServiceCard.tsx` (shared):
  - Add `onQuickView?: (service: Service) => void` prop
  - Add eye icon button on hover overlay (or always visible in top-left corner)
  - aria-label: "Quick view of {service.name}"

- `frontend/src/pages/customer/BookServicesPage.tsx`:
  - Add `quickViewService` state
  - Mount `<ServiceQuickViewModal>` at page level
  - Pass `onQuickView={(s) => setQuickViewService(s)}` to `ServiceCard`

### Verification
- [ ] Eye icon button visible on card hover
- [ ] Clicking opens modal with full service details
- [ ] Image carousel works (prev/next)
- [ ] Lazy-loads (shows skeleton on first open, instant on subsequent)
- [ ] Book CTA in modal navigates to booking
- [ ] Modal closes on backdrop click, ESC, or close button
- [ ] Focus trapped in modal (Tab cycles within)

---

## Feature 7: Add Saved Searches

### What
Allow users to save their current search (with filters) and re-apply it later. Store in localStorage (Zustand persist pattern).

### Files to Create
- `frontend/src/stores/savedSearchStore.ts`:
  - Zustand store with `persist` middleware (localStorage key: `nilin-book-saved-searches`)
  - Max 20 saved searches
  - Per-search shape: `{ id, name, query, filters: { category, priceRange, minRating, sortBy }, createdAt }`
  - Methods: `addSearch`, `removeSearch`, `applySearch(id)` (returns SavedSearch object for caller to apply)
  - Pattern: same as `comparisonStore.ts`

### Files to Modify
- `frontend/src/pages/customer/BookServicesPage.tsx`:
  - Add "Save this search" button in the controls row
  - Add saved searches display section (below controls, above results) — shows as pills
  - Each pill is clickable (loads search) and has an X (deletes)
  - Show count of saved searches
  - Show empty state when no saves

### UX Flow
1. User searches "haircut" with category "Hair" and price max 200
2. Clicks "Save this search" (Bookmark icon) → name defaults to "haircut · Hair"
3. Search appears as a pill below the controls
4. User can click the pill to re-apply, or X to delete
5. Save persists in localStorage across sessions

### Verification
- [ ] Save button creates a pill
- [ ] Clicking pill restores all filters
- [ ] X button removes the pill
- [ ] Saves persist across page refreshes
- [ ] Saves persist across browser tabs
- [ ] Max 20 saves enforced (oldest removed first)
- [ ] Duplicate saves (same query+filters) are deduplicated

---

## Cross-Cutting Concerns

### Type Compatibility
- `ServiceCard` uses `Service` from `types/service`
- SearchPage uses `Service` from `types/search`
- These types are similar but may have minor differences
- Will need to verify or add a type adapter

### State Management
- Pagination state → URL params (like SearchPage)
- Filter state → URL params (like SearchPage)
- View mode (grid/map) → Local state (not URL)
- Quick view open/close → Local state
- Saved searches → localStorage (Zustand persist)

### Accessibility (Recurring Standards)
- All interactive elements: `focus-visible:ring-2 focus-visible:ring-nilin-coral`
- All icon-only buttons: `aria-label` with action context
- All toggles: `aria-pressed`
- All modals: focus trap, ESC to close, `role="dialog"`
- All images: `alt` text
- Reduced motion: `motion-reduce:transition-none` on all hover effects

### Performance
- Lazy-load modal content (don't fetch service details on page load)
- Image carousel: lazy-load off-screen images
- Pagination: scroll to top on change
- ServiceCard list: virtualize if >50 results (not needed for 12 per page)

### Testing Checklist (Per Feature)
- [ ] Mobile viewport (320px, 375px, 768px)
- [ ] Tablet viewport (768px, 1024px)
- [ ] Desktop viewport (1280px+)
- [ ] Empty state
- [ ] Loading state
- [ ] Error state
- [ ] Keyboard navigation
- [ ] Screen reader announcements
- [ ] Reduced motion preference

---

## File Summary

### New Files (6)
1. `frontend/src/components/common/Pagination.tsx` — Reusable pagination
2. `frontend/src/components/customer/ServiceQuickViewModal.tsx` — Quick view
3. `frontend/src/components/customer/FilterBar.tsx` — Filter controls
4. `frontend/src/components/customer/PriceRangeSlider.tsx` — Price range slider
5. `frontend/src/components/customer/RatingFilter.tsx` — Rating filter chips
6. `frontend/src/hooks/useServiceDetail.ts` — Service detail cache
7. `frontend/src/stores/savedSearchStore.ts` — Saved searches

### Modified Files (2)
1. `frontend/src/components/customer/ServiceCard.tsx` — Add onQuickView prop + eye button
2. `frontend/src/pages/customer/BookServicesPage.tsx` — Major refactor

### Total Lines Changed
- BookServicesPage.tsx: -260 lines (removing inline ServiceCardInline) + ~150 lines new (filtering, pagination, saved searches) = net -110
- New files: ~600 lines total
- ServiceCard.tsx: +20 lines (eye button + onQuickView prop)

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| `Service` type mismatch (service vs search) | Medium | Verify types early; add adapter if needed |
| `getPopularServices` doesn't return pagination | High | Switch to `searchServices({ sortBy: 'popularity' })` for both modes |
| Modal breaks on small screens | Low | Test mobile + tablet viewports; use BottomSheet on mobile |
| Service detail API has different shape than search | Low | Add `getServiceById` projection tests; fallback gracefully |
| Saved search URL state is too long | Low | Save only essential fields, not full filter state |
| Performance with pagination | Low | SearchPage already handles 12 per page fine |

---

## Implementation Cadence

Each feature will be implemented as a separate, atomic change:
1. Read context (existing code, related files)
2. Plan the change (2-5 minutes of thinking)
3. Implement
4. Verify (TypeScript, no console errors)
5. Quick smoke test (mental walkthrough of user flow)

After each feature, we'll briefly confirm before moving to the next. This allows course-correction and avoids "too many changes at once" risk.

---

## What Stays Out of Scope (For Now)

These are documented as "deferred" — they may come in a future phase:

- **Recently Viewed** — Already exists as `RecentlyViewed.tsx` but is not integrated into BookServicesPage. Could be added as a "Recently Viewed" carousel at the top.
- **Recommendations** — Personalized recommendations based on user history.
- **Trending This Week** — Date-filtered trending services.
- **New Arrivals** — Services sorted by `isNew` or `createdAt`.
- **Near You** — Geo-sorted services based on user location.
- **Service Bundles** — Showing bundle discounts on individual service cards.
- **Bulk Select** — Multi-select mode for bulk actions (favorite, add to cart, compare).
- **Quick View from Map Popup** — Reuse ServiceQuickViewModal in MapSearchCard.

These can be added incrementally as future enhancements.

---

## Final Deliverable

A production-ready BookServicesPage that:
- Shows 12 services per page with full pagination
- Allows filtering by category, price, rating
- Supports sort by 5 criteria
- Includes a Map view for geographic browsing
- Has a Quick View modal for fast service preview
- Allows saving and re-applying searches
- Has a cross-page comparison feature
- Maintains NILIN brand consistency, accessibility, and performance
