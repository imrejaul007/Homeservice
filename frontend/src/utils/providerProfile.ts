/**
 * Normalize service areas from API (strings or { name, type, value } objects) to display strings.
 */
export function serviceAreasToStrings(areas: unknown): string[] {
  if (!Array.isArray(areas)) return [];
  return areas
    .map((a) => {
      if (typeof a === 'string') return a;
      if (a && typeof a === 'object' && 'name' in a) {
        return String((a as { name?: string }).name ?? '');
      }
      return '';
    })
    .filter(Boolean);
}

export interface ServiceLocationValue {
  label: string;
  type?: string;
  emirate?: string;
  formattedAddress?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  lat: number;
  lng: number;
}

/** Primary service location label from provider profile */
export function getPrimaryServiceLocationLabel(providerProfile: unknown): string {
  const pp = providerProfile as Record<string, unknown> | null;
  if (!pp) return '';

  const areas = serviceAreasToStrings(
    (pp.locationInfo as { serviceAreas?: unknown } | undefined)?.serviceAreas ?? pp.serviceAreas
  );
  if (areas.length > 0) return areas.join(', ');

  const addr = (pp.locationInfo as { primaryAddress?: Record<string, unknown> } | undefined)
    ?.primaryAddress;
  if (!addr) return '';

  const parts = [addr.city, addr.state, addr.country].filter(Boolean);
  return parts.join(', ') || String(addr.street || '');
}

/** Merge API provider profile with existing store data so fields are not wiped */
export function mergeProviderProfile<T extends Record<string, unknown>>(
  existing: T | null,
  incoming: T | null | undefined
): T | null {
  if (!incoming) return existing;
  if (!existing) return incoming;

  return {
    ...existing,
    ...incoming,
    businessInfo: {
      ...(existing.businessInfo as object),
      ...(incoming.businessInfo as object),
    },
    locationInfo: {
      ...(existing.locationInfo as object),
      ...(incoming.locationInfo as object),
    },
    instagramStyleProfile: {
      ...(existing.instagramStyleProfile as object),
      ...(incoming.instagramStyleProfile as object),
    },
    ratings: { ...(existing.ratings as object), ...(incoming.ratings as object) },
    earnings: { ...(existing.earnings as object), ...(incoming.earnings as object) },
    analytics: { ...(existing.analytics as object), ...(incoming.analytics as object) },
  } as T;
}
