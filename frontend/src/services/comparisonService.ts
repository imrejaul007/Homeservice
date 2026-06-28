import type { Service } from '../types/search';
import { useLocationStore } from '../stores/locationStore';

export interface ComparisonMetric {
  key: 'price' | 'rating' | 'duration' | 'distance';
  label: string;
  bestId?: string;
  format: (service: Service) => string | number | null;
}

export interface ComparisonResult {
  services: Service[];
  metrics: ComparisonMetric[];
}

/**
 * Get the best service for a given metric (lowest price, highest rating, etc.)
 */
function getBest<T>(
  services: Service[],
  extractor: (s: Service) => number | null,
  mode: 'min' | 'max'
): string | undefined {
  let best: { id: string; value: number } | null = null;

  for (const service of services) {
    const value = extractor(service);
    if (value == null) continue;
    if (best == null) {
      best = { id: service._id, value };
    } else if (mode === 'min' && value < best.value) {
      best = { id: service._id, value };
    } else if (mode === 'max' && value > best.value) {
      best = { id: service._id, value };
    }
  }

  return best?.id;
}

/**
 * Extract a numeric price from a Service (handles multiple shapes)
 */
function getPrice(s: Service): number | null {
  const amount =
    (s as any).pricing?.currentPrice ??
    (typeof s.price === 'number' ? s.price : (s.price as any)?.amount ?? null);
  return typeof amount === 'number' && amount > 0 ? amount : null;
}

/**
 * Extract a numeric rating from a Service
 */
function getRating(s: Service): number | null {
  if (typeof s.rating === 'number') return s.rating > 0 ? s.rating : null;
  return s.rating?.average > 0 ? s.rating.average : null;
}

/**
 * Calculate Haversine distance between two points
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Extract service coordinates from various possible locations in the service object
 */
function getServiceCoordinates(service: Service): { latitude: number; longitude: number } | null {
  // Try different possible locations for coordinates
  const locations = [
    // Direct location field (GeoJSON format object)
    (service as any).location?.coordinates,
    // Direct location coordinates array
    (service as any).location?.coordinates?.coordinates,
    // Provider coordinates
    (service as any).provider?.locationInfo?.primaryAddress?.coordinates,
    (service as any).provider?.locationInfo?.primaryAddress?.coordinates?.coordinates,
    // Provider profile coordinates
    (service as any).providerProfile?.locationInfo?.primaryAddress?.coordinates,
    (service as any).providerProfile?.locationInfo?.primaryAddress?.coordinates?.coordinates,
    // Address coordinates
    (service as any).address?.coordinates,
  ];

  for (const coords of locations) {
    if (coords?.coordinates && Array.isArray(coords.coordinates) && coords.coordinates.length >= 2) {
      // GeoJSON object: { type: 'Point', coordinates: [lng, lat] }
      return {
        longitude: coords.coordinates[0],
        latitude: coords.coordinates[1]
      };
    }
    if (coords && Array.isArray(coords) && coords.length >= 2) {
      // GeoJSON format: [longitude, latitude]
      return {
        longitude: coords[0],
        latitude: coords[1]
      };
    }
  }

  return null;
}

/**
 * Get distance from user to service, calculating client-side if needed
 */
function getServiceDistance(service: Service): number | null {
  // First check if distance is already calculated (from geo-search)
  if (typeof (service as any).distance === 'number') {
    return (service as any).distance;
  }

  // Try to calculate distance from user's current location
  try {
    const locationStore = useLocationStore.getState();
    const userCoords = locationStore.currentLocation?.coordinates;

    if (userCoords) {
      const serviceCoords = getServiceCoordinates(service);
      if (serviceCoords) {
        return calculateDistance(
          userCoords.latitude,
          userCoords.longitude,
          serviceCoords.latitude,
          serviceCoords.longitude
        );
      }
    }
  } catch {
    // Location store not available or no user location
  }

  return null;
}

/**
 * Build a comparison result with metrics and best-of badges
 */
export function buildComparison(services: Service[]): ComparisonResult {
  if (services.length < 2) {
    return { services, metrics: [] };
  }

  const metrics: ComparisonMetric[] = [
    {
      key: 'price',
      label: 'Price',
      bestId: getBest(services, getPrice, 'min'),
      format: (s) => {
        const price = getPrice(s);
        if (price == null) return '—';
        const currency = (typeof s.price === 'object' && s.price?.currency) || 'AED';
        return `${currency} ${price.toLocaleString()}`;
      },
    },
    {
      key: 'rating',
      label: 'Rating',
      bestId: getBest(services, getRating, 'max'),
      format: (s) => {
        const rating = getRating(s);
        if (rating == null) return '—';
        return `${rating.toFixed(1)} ★`;
      },
    },
    {
      key: 'duration',
      label: 'Duration',
      bestId: getBest(
        services,
        (s) => (typeof s.duration === 'number' && s.duration > 0 ? s.duration : null),
        'min'
      ),
      format: (s) => (s.duration ? `${s.duration} min` : '—'),
    },
    {
      key: 'distance',
      label: 'Distance',
      bestId: getBest(services, getServiceDistance, 'min'),
      format: (s) => {
        const distance = getServiceDistance(s);
        if (distance == null) return '—';
        return `${distance.toFixed(1)} km`;
      },
    },
  ];

  return { services, metrics };
}

/**
 * Check if a service is the "best" in any category
 */
export function isServiceBestIn(serviceId: string, comparison: ComparisonResult): string[] {
  return comparison.metrics
    .filter((m) => m.bestId === serviceId)
    .map((m) => m.label);
}
