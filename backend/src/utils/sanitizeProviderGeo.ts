/** Default Dubai coordinates [longitude, latitude] */
export const DEFAULT_DUBAI_COORDS: [number, number] = [55.2708, 25.2048];

function isValidGeoPoint(coords: unknown): coords is { type: 'Point'; coordinates: [number, number] } {
  if (!coords || typeof coords !== 'object') return false;
  const c = coords as { type?: string; coordinates?: unknown; lat?: number; lng?: number };
  if (c.lat !== undefined && c.lng !== undefined) return false;
  return (
    c.type === 'Point' &&
    Array.isArray(c.coordinates) &&
    c.coordinates.length === 2 &&
    typeof c.coordinates[0] === 'number' &&
    typeof c.coordinates[1] === 'number' &&
    !Number.isNaN(c.coordinates[0]) &&
    !Number.isNaN(c.coordinates[1])
  );
}

/**
 * Ensures locationInfo.primaryAddress.coordinates is valid GeoJSON or removed.
 * Prevents MongoDB 2dsphere index errors on save.
 */
export function sanitizeProviderGeo(profile: {
  locationInfo?: {
    primaryAddress?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      coordinates?: unknown;
    };
    mobileService?: boolean;
  };
  markModified?: (path: string) => void;
}): void {
  const primaryAddress = profile.locationInfo?.primaryAddress;
  if (!primaryAddress) return;

  const coords = primaryAddress.coordinates as
    | { type?: string; coordinates?: number[]; lat?: number; lng?: number }
    | undefined;

  if (!coords) return;

  // Legacy { lat, lng } format
  if (coords.lat !== undefined && coords.lng !== undefined) {
    primaryAddress.coordinates = {
      type: 'Point',
      coordinates: [coords.lng, coords.lat],
    };
    profile.markModified?.('locationInfo');
    return;
  }

  if (isValidGeoPoint(coords)) {
    return;
  }

  const hasAddressFields = Boolean(
    primaryAddress.street &&
      primaryAddress.city &&
      primaryAddress.state &&
      primaryAddress.zipCode
  );
  const country = primaryAddress.country || 'AE';
  const mobileService = profile.locationInfo?.mobileService !== false;

  if (hasAddressFields || (country === 'AE' && mobileService)) {
    primaryAddress.coordinates = {
      type: 'Point',
      coordinates: DEFAULT_DUBAI_COORDS,
    };
    ensurePrimaryAddressFields(primaryAddress);
  } else {
    delete primaryAddress.coordinates;
  }

  profile.markModified?.('locationInfo');
}

/** Fill required address lines when only coordinates / country exist */
function ensurePrimaryAddressFields(
  primaryAddress: NonNullable<Parameters<typeof sanitizeProviderGeo>[0]['locationInfo']>['primaryAddress']
): void {
  if (!primaryAddress) return;
  const label = primaryAddress.city || primaryAddress.street || 'Dubai';
  if (!primaryAddress.street) primaryAddress.street = label;
  if (!primaryAddress.city) primaryAddress.city = label;
  if (!primaryAddress.state) primaryAddress.state = primaryAddress.city || 'Dubai';
  if (!primaryAddress.zipCode) primaryAddress.zipCode = '00000';
  if (!primaryAddress.country) primaryAddress.country = 'AE';
}

export interface ServiceAddressFields {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/**
 * Build a complete service address from provider profile (service model requires all fields).
 */
export function buildServiceAddressFromProvider(providerProfile: {
  locationInfo?: {
    primaryAddress?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
    serviceAreas?: Array<{ name?: string; value?: string | number } | string>;
  };
  businessInfo?: { businessName?: string };
}): ServiceAddressFields {
  const addr = providerProfile.locationInfo?.primaryAddress || {};
  const areas = providerProfile.locationInfo?.serviceAreas || [];
  const firstArea = areas[0];
  const areaLabel =
    typeof firstArea === 'string'
      ? firstArea
      : String(firstArea?.name || firstArea?.value || '');

  const fallback =
    areaLabel ||
    addr.city ||
    addr.street ||
    providerProfile.businessInfo?.businessName ||
    'Dubai';

  return {
    street: addr.street || fallback,
    city: addr.city || areaLabel || fallback,
    state: addr.state || addr.city || areaLabel || fallback,
    zipCode: addr.zipCode || '00000',
    country: addr.country || 'AE',
  };
}

/**
 * Maps frontend string service areas to schema objects.
 */
export function normalizeServiceAreas(
  areas: unknown
): Array<{ name: string; type: 'city' | 'zipcode' | 'radius'; value: string | number; additionalFee: number }> {
  if (!Array.isArray(areas)) return [];

  return areas
    .map((area) => {
      if (typeof area === 'string') {
        return {
          name: area,
          type: 'city' as const,
          value: area,
          additionalFee: 0,
        };
      }
      if (area && typeof area === 'object' && 'name' in area) {
        const a = area as { name: string; type?: string; value?: string | number; additionalFee?: number };
        return {
          name: a.name,
          type: (a.type === 'zipcode' || a.type === 'radius' ? a.type : 'city') as 'city' | 'zipcode' | 'radius',
          value: a.value ?? a.name,
          additionalFee: a.additionalFee ?? 0,
        };
      }
      return null;
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
}
