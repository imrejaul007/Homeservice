import type { Service } from '../types/search';

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
      bestId: getBest(
        services,
        (s) => (typeof (s as any).distance === 'number' ? (s as any).distance : null),
        'min'
      ),
      format: (s) => {
        const d = (s as any).distance;
        if (typeof d !== 'number') return '—';
        return `${d.toFixed(1)} km`;
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
