# Map View & Service Comparison Implementation Plan

## Overview

Implement two features for the SearchPage that were deferred in the prior improve-ui audit:
1. **Map View** - Toggle to view search results on a map using OpenStreetMap (Leaflet) - no API key required, works with the existing OpenCage key for geocoding addresses.
2. **Service Comparison** - Side-by-side comparison modal allowing users to compare 2-4 services before booking.

---

## Architecture Decision: OpenStreetMap (Leaflet) over Mapbox/Google Maps

**Why OpenStreetMap + Leaflet:**
- ✅ **Zero API key required** for tile rendering (uses public OSM tiles)
- ✅ **Free forever** - no quota limits, no billing concerns
- ✅ **Already have geocoding** via OpenCage API key (user-provided) for address-to-coordinate conversion
- ✅ **Existing data** - service coordinates already stored in `Service.location.coordinates` (GeoJSON [lng, lat] format)
- ✅ **Lighter bundle** (~40KB gzipped) compared to Google Maps SDK
- ✅ **Mature library** (Leaflet 1.9.x) with great React integration via `react-leaflet`

**Reuse existing location services:**
- `frontend/src/services/locationService.ts` - Already uses Nominatim (also OSM) as fallback
- `frontend/src/services/geolocationApi.ts` - Backend OpenCage proxy via `/location/search`
- `backend/src/services/location.service.ts` - `calculateDistance()`, `findNearbyProviders()`
- `useLocationStore` - User's current location already accessible

---

## Feature 1: Map View

### User Experience

Add a third option to the view toggle: `Services | Providers | Map`. When clicked, displays services AND providers as markers on a map.

**Layout** (desktop):
```
┌─────────────────────────────────────────────┐
│  SearchPage Header + Filters                │
├─────────────────────────────────────────────┤
│   [Services][Providers][Map]    Sort ▼     │  ← Updated toggle
├──────────────────┬──────────────────────────┤
│                  │                          │
│   List of        │      MAP                 │
│   Results        │      📍📍📍              │
│   (scrollable)   │      📍                  │
│                  │                          │
│                  │                          │
└──────────────────┴──────────────────────────┘
```

On mobile, map goes full-screen with a bottom drawer for list.

### Technical Implementation

**1.1 Install dependencies**
```bash
cd frontend
npm install leaflet react-leaflet @types/leaflet
```

**1.2 New Component: `MapView.tsx`**
- Path: `frontend/src/components/search/MapView.tsx`
- Uses `react-leaflet`'s `MapContainer`, `TileLayer`, `Marker`, `Popup`
- Custom NILIN-branded marker icons (using coral/rose colors)
- Map auto-fits bounds to show all result markers
- User location marker (if granted)
- Click marker → popup with service/provider summary card + "View" button

**1.3 New Component: `MapSearchCard.tsx`**
- Path: `frontend/src/components/search/MapSearchCard.tsx`
- Lightweight card used in map popups (different from full `ServiceCard`)
- Shows: image, title, rating, price, distance, "View Details" + "Book Now" buttons
- "Compare" checkbox for service comparison (Feature 2)

**1.4 New Hook: `useMapBounds`**
- Path: `frontend/src/hooks/useMapBounds.ts`
- Calculates bounds from array of coordinates
- Auto-zoom logic based on result density

**1.5 Provider Type Extension**
- Add `coordinates` field to `SearchProvider` type
- Backend's `processSearchResults` already returns provider coordinates via `getUser` join (just need to expose in response)

**1.6 Update `SearchPage.tsx`**
- Add `viewMode = 'services' | 'providers' | 'map'` (extended union)
- When `viewMode === 'map'`:
  - Render `MapView` component instead of grid
  - Pass filtered services + providers as markers
  - List results in left sidebar (desktop) or bottom sheet (mobile)
- Add "Map" button to view toggle with `Map` icon from lucide-react

### Files Modified/Created

| File | Type | Purpose |
|------|------|---------|
| `frontend/package.json` | Modify | Add `leaflet`, `react-leaflet`, `@types/leaflet` |
| `frontend/src/components/search/MapView.tsx` | **Create** | Map rendering with markers/popups |
| `frontend/src/components/search/MapSearchCard.tsx` | **Create** | Compact card for map popups |
| `frontend/src/hooks/useMapBounds.ts` | **Create** | Map bounds calculation |
| `frontend/src/types/search.ts` | Modify | Add `coordinates` to `SearchProvider` |
| `frontend/src/pages/SearchPage.tsx` | Modify | Add `map` view mode + MapView integration |
| `frontend/src/index.css` | Modify | Import Leaflet CSS |
| `backend/src/controllers/search.controller.ts` | Modify | Include provider coordinates in response |
| `frontend/src/lib/mapIcons.ts` | **Create** | Custom NILIN marker icons |

### Backend Change Detail

The `searchProviders` endpoint needs to include `coordinates` from `ProviderProfile.locationInfo`:

```typescript
// In processSearchResults or formattedProviders mapping
location: provider.locationInfo?.primaryAddress ? {
  city: provider.locationInfo.primaryAddress.city,
  state: provider.locationInfo.primaryAddress.state,
  coordinates: provider.locationInfo?.coordinates?.coordinates  // [lng, lat] GeoJSON
} : null,
```

### Geocoding for Services Without Coordinates

Some services may not have `location.coordinates` set. Strategy:
- **Option A** (chosen): Fall back to provider's coordinates from `User` or `ProviderProfile.locationInfo.coordinates`
- **Option B**: Use OpenCage to geocode the service's `address.city` → approximate marker (skipped, adds API calls)

We'll use Option A as it's free and reuses existing data.

---

## Feature 2: Service Comparison

### User Experience

Users select 2-4 services via checkboxes on `ServiceCard`. When 2+ are selected, a floating "Compare (N)" bar appears at the bottom. Clicking it opens a comparison modal with side-by-side feature matrix.

**Comparison Modal Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Compare Services                                    [X]   │
├──────────────┬──────────────┬──────────────┬───────────────┤
│  Service A   │  Service B   │  Service C   │ Service D     │
│  [image]     │  [image]     │  [image]     │ [image]       │
│  Title       │  Title       │  Title       │ Title         │
├──────────────┼──────────────┼──────────────┼───────────────┤
│  ⭐ 4.8     │  ⭐ 4.5     │  ⭐ 4.9     │  ⭐ 4.3        │
│  AED 150     │  AED 200     │  AED 180     │ AED 130        │
│  60 min      │  90 min      │  75 min      │ 45 min         │
│  2.5 km      │  5.1 km      │  1.2 km      │ 8.7 km         │
│  [Book Now]  │  [Book Now]  │  [Book Now]  │ [Book Now]    │
└──────────────┴──────────────┴──────────────┴───────────────┘
```

"Best" badges (lowest price, highest rating, shortest distance) highlighted in coral.

### Technical Implementation

**2.1 State Management: `useComparisonStore`**
- Path: `frontend/src/stores/comparisonStore.ts`
- Uses Zustand (already used in codebase for `authStore`, `locationStore`)
- Persists to localStorage so users don't lose selection on refresh
- Max 4 services (with toast warning when trying to add 5th)

```typescript
interface ComparisonState {
  selectedServiceIds: string[];
  addService: (id: string, service: Service) => void;
  removeService: (id: string) => void;
  clearAll: () => void;
  isSelected: (id: string) => boolean;
  canAdd: boolean; // selectedServiceIds.length < 4
}
```

**2.2 Update `ServiceCard.tsx`**
- Add `onCompareToggle?: (serviceId: string) => void` and `isInComparison?: boolean` props
- Add comparison checkbox overlay (top-right corner of card)
- When `isInComparison`, show filled check icon
- Always show checkbox, but only on `default` and `featured` variants

**2.3 New Component: `ComparisonBar.tsx`**
- Path: `frontend/src/components/search/ComparisonBar.tsx`
- Fixed bottom bar, only visible when `selectedServiceIds.length >= 2`
- Shows: count, "Compare Now" button, "Clear" button
- Slides up with animation when first item added

**2.4 New Component: `ServiceComparisonModal.tsx`**
- Path: `frontend/src/components/search/ServiceComparisonModal.tsx`
- Uses existing `Modal` component pattern
- Responsive grid: 1 col on mobile, 2-4 cols on desktop
- Fetches full service data via `searchApi.getServiceById()` (or uses existing data)
- Computes "best" values for each metric
- "Best Price" / "Best Rating" / "Closest" badges in coral
- "Book Now" CTA per service

**2.5 New Service: `comparisonService.ts`**
- Path: `frontend/src/services/comparisonService.ts`
- Pure functions to compute comparison metrics:
  - `findBestValue(services, 'price')` - lowest price
  - `findBestValue(services, 'rating')` - highest rating
  - `findBestValue(services, 'distance')` - shortest distance
  - `getComparisonMetrics(services)` - returns all metrics + bests

**2.6 URL Sharing**
- Support `?compare=id1,id2,id3` URL param
- `SearchPage` reads URL, syncs to `comparisonStore` on mount
- Useful for sharing comparison with others

### Files Modified/Created

| File | Type | Purpose |
|------|------|---------|
| `frontend/src/stores/comparisonStore.ts` | **Create** | Zustand store for selected services |
| `frontend/src/components/search/ComparisonBar.tsx` | **Create** | Floating bottom action bar |
| `frontend/src/components/search/ServiceComparisonModal.tsx` | **Create** | Side-by-side comparison modal |
| `frontend/src/services/comparisonService.ts` | **Create** | Compute best values, metrics |
| `frontend/src/components/customer/ServiceCard.tsx` | Modify | Add comparison checkbox |
| `frontend/src/pages/SearchPage.tsx` | Modify | Integrate comparison state, bar, modal |
| `frontend/src/components/search/MapSearchCard.tsx` | Modify | Add comparison checkbox (from Feature 1) |

---

## Integration: Map + Comparison

Map popups will include a "Compare" checkbox so users can build their comparison list while browsing the map. The `ComparisonBar` and `ServiceComparisonModal` work the same regardless of where items were added.

---

## Implementation Order

1. **Backend: Provider coordinates in search response** (1 file, ~20 lines)
2. **Frontend: Install dependencies** (1 npm command)
3. **Frontend: Map icons utility** (small, isolated)
4. **Frontend: MapView + MapSearchCard components** (core of Feature 1)
5. **Frontend: Update SearchPage with map view mode** (integration)
6. **Frontend: Comparison store** (Zustand)
7. **Frontend: Update ServiceCard with comparison checkbox** (small)
8. **Frontend: ComparisonBar component** (small)
9. **Frontend: comparisonService utility** (pure functions)
10. **Frontend: ServiceComparisonModal component** (largest)
11. **Frontend: Integrate comparison in SearchPage** (final wiring)
12. **Polish: URL sharing, animations, accessibility**

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Leaflet CSS not loaded (broken map) | Import in `index.css` entry; test on first load |
| Bundle size impact (~40KB) | Lazy-load MapView with `React.lazy()` (only when `viewMode === 'map'`) |
| Provider coordinates missing | Fallback to service coordinates; hide map marker if both missing |
| Comparison performance with 4 services + images | Use small thumbnails, lazy-load full images on modal open |
| localStorage quota with many IDs | Cap at 4 services; IDs are short (MongoDB ObjectIds) |
| Mobile map UX (touch interactions) | Use Leaflet's default touch handlers, test on mobile viewport |

---

## Testing Checklist

### Map View
- [ ] Map renders tiles in all view modes (services, providers, both)
- [ ] Markers show correct locations for all services with coordinates
- [ ] Click marker → popup opens with correct service info
- [ ] "View Details" button navigates to service page
- [ ] "Book Now" button initiates booking
- [ ] Map auto-fits bounds to show all markers
- [ ] User location marker shows if permission granted
- [ ] Map gracefully handles services without coordinates
- [ ] Mobile: bottom drawer list scrolls, map doesn't break
- [ ] Accessibility: keyboard navigation works on map controls

### Service Comparison
- [ ] Can select 2-4 services via checkboxes
- [ ] Toast warning when trying to add 5th
- [ ] ComparisonBar appears when 2+ selected
- [ ] "Compare Now" opens modal
- [ ] Modal shows all selected services
- [ ] "Best" badges show on lowest price, highest rating, shortest distance
- [ ] "Book Now" works from comparison modal
- [ ] Removing a service updates the bar/modal
- [ ] Clear all works
- [ ] Selection persists across page refresh (localStorage)
- [ ] URL `?compare=id1,id2` works for sharing
- [ ] Mobile: modal scrolls horizontally if needed

---

## Estimated Effort

- **Map View**: ~6-8 hours (component creation + integration + testing)
- **Service Comparison**: ~4-6 hours (store + UI + metrics logic)
- **Total**: ~10-14 hours

Both features can be implemented in parallel by different developers.
