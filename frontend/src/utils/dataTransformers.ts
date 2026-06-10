/**
 * Data Transformation Utilities
 *
 * Provides consistent field name mapping between backend and frontend
 * to prevent data format mismatch bugs.
 */

// ============================================
// BOOKING DATA TRANSFORMATIONS
// ============================================

/**
 * Booking field name mapping (Backend → Frontend)
 *
 * Backend often uses:
 * - _id (MongoDB ObjectId as string)
 * - serviceId (reference field)
 * - scheduledDate (Date object)
 *
 * Frontend expects:
 * - _id or id
 * - service?._id or serviceId
 * - scheduledDate as string (YYYY-MM-DD)
 */
export interface BackendBooking {
  _id?: string | { $oid: string };
  id?: string;
  serviceId?: string | { _id: string };
  service?: {
    _id?: string;
    name?: string;
    price?: { amount: number; currency?: string } | number;
    duration?: number;
  };
  scheduledDate?: Date | string;
  scheduledTime?: string;
  pricing?: {
    totalAmount?: number;
    total?: number;
    tax?: number;
    taxes?: number;
  };
  // ... other fields
}

/**
 * Transform booking dates to consistent format
 */
export function transformBookingDates(booking: Record<string, unknown>): Record<string, unknown> {
  const result = { ...booking };

  // Transform scheduledDate to YYYY-MM-DD string
  if (result.scheduledDate instanceof Date) {
    result.scheduledDate = result.scheduledDate.toISOString().split('T')[0];
  } else if (typeof result.scheduledDate === 'string') {
    // Already a string, ensure it's in YYYY-MM-DD format
    const date = new Date(result.scheduledDate);
    if (!isNaN(date.getTime())) {
      result.scheduledDate = date.toISOString().split('T')[0];
    }
  }

  return result;
}

// ============================================
// SERVICE/PACKAGE FIELD MAPPING
// ============================================

/**
 * Service field name mapping (Backend → Frontend)
 *
 * Backend fields: serviceId, serviceName, originalPrice, duration
 * Frontend fields: _id, name, price, duration
 *
 * This is a common source of bugs - always use this transformer
 * when receiving service data from backend.
 */
export interface BackendService {
  serviceId?: string | { _id: string };
  serviceName?: string;
  originalPrice?: number;
  price?: { amount: number; currency?: string } | number;
  duration?: number;
  // ... other fields
}

export interface FrontendService {
  _id: string;
  name: string;
  price: number;
  duration: number;
}

/**
 * Transform a single service from backend format to frontend format
 */
export function transformService(service: BackendService): FrontendService {
  // Extract service ID
  let _id = '';
  if (service.serviceId) {
    if (typeof service.serviceId === 'object' && '_id' in service.serviceId) {
      _id = (service.serviceId as { _id: string })._id;
    } else {
      _id = String(service.serviceId);
    }
  }

  // Extract name
  const name = service.serviceName || '';

  // Extract price - handle both { amount } and number formats
  let price = 0;
  if (typeof service.price === 'object' && service.price !== null && 'amount' in service.price) {
    price = (service.price as { amount: number }).amount;
  } else if (typeof service.price === 'number') {
    price = service.price;
  } else if (typeof service.originalPrice === 'number') {
    price = service.originalPrice;
  }

  // Extract duration with fallback
  const duration = service.duration || 60;

  return { _id, name, price, duration };
}

/**
 * Transform an array of services
 */
export function transformServices(services: BackendService[]): FrontendService[] {
  return services.map(transformService);
}

// ============================================
// COORDINATE TRANSFORMATIONS
// ============================================

/**
 * Frontend coordinate format: { lat, lng }
 */
export interface FrontendCoords {
  lat: number;
  lng: number;
}

/**
 * Backend GeoJSON format: [lng, lat]
 */
export type BackendGeoJSON = [number, number];

/**
 * Transform frontend coordinates to backend GeoJSON format
 */
export function toBackendCoords(coords: FrontendCoords): BackendGeoJSON {
  return [coords.lng, coords.lat];
}

/**
 * Transform backend GeoJSON coordinates to frontend format
 */
export function fromBackendCoords(coords: BackendGeoJSON | undefined): FrontendCoords | undefined {
  if (!coords || !Array.isArray(coords) || coords.length < 2) {
    return undefined;
  }
  return { lng: coords[0], lat: coords[1] };
}

// ============================================
// ID TRANSFORMATIONS
// ============================================

/**
 * Convert MongoDB ObjectId to string
 * Handles various formats: { $oid: "..." }, plain string, etc.
 */
export function toStringId(value: unknown): string {
  if (!value) return '';

  if (typeof value === 'string') return value;

  if (typeof value === 'object') {
    // Handle { $oid: "..." } format
    if ('$oid' in value) {
      return (value as { $oid: string }).$oid;
    }
    // Handle { _id: string | { $oid: string } } format
    if ('_id' in value) {
      return toStringId((value as { _id: unknown })._id);
    }
    // Handle { toString: () => string } (BSON ObjectId)
    if ('toString' in value) {
      return (value as { toString: () => string }).toString();
    }
  }

  return String(value);
}

/**
 * Ensure ID is available in both _id and id fields
 */
export function normalizeId<T extends Record<string, unknown>>(obj: T): T & { id: string } {
  const _id = toStringId(obj._id);
  return { ...obj, id: _id || toStringId(obj.id) };
}

// ============================================
// PRICE TRANSFORMATIONS
// ============================================

/**
 * Normalize price value to number
 * Handles { amount: number; currency?: string } and plain number formats
 */
export function normalizePrice(price: { amount: number; currency?: string } | number | undefined): number {
  if (!price) return 0;
  if (typeof price === 'number') return price;
  if (typeof price === 'object' && 'amount' in price) {
    return (price as { amount: number }).amount;
  }
  return 0;
}

/**
 * Format price for display
 */
export function formatDisplayPrice(amount: number, currency: string = 'AED'): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ============================================
// DATE TRANSFORMATIONS
// ============================================

/**
 * Convert value to ISO date string (YYYY-MM-DD)
 */
export function toISODateString(value: Date | string | unknown): string {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
    // Check if already in YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
  }
  return '';
}

/**
 * Convert value to Date object
 */
export function toDate(value: Date | string | unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

// ============================================
// API RESPONSE HANDLING
// ============================================

/**
 * Extract data from API response, handling various nested formats
 *
 * Backend may return:
 * - { success: true, data: T }
 * - { success: true, data: { items: T } }
 * - T directly
 *
 * This utility handles all cases
 */
export function extractApiData<T>(response: unknown, options?: {
  path?: string;           // Dot-notation path to data (e.g., 'data.items')
  defaultValue?: T;
}): T {
  const { path = 'data', defaultValue = undefined as T } = options || {};

  if (!response || typeof response !== 'object') {
    return defaultValue;
  }

  const data = (response as Record<string, unknown>);

  // If no path specified, try common patterns
  if (path === 'data') {
    // Check for { success, data }
    if ('success' in data && 'data' in data) {
      const nested = data.data as Record<string, unknown>;
      if (nested && typeof nested === 'object') {
        return (path.split('.').reduce((obj: unknown, key) => {
          if (obj && typeof obj === 'object') {
            return (obj as Record<string, unknown>)[key];
          }
          return undefined;
        }, data.data) as T) || defaultValue;
      }
      return data.data as T || defaultValue;
    }
    // Direct data without wrapper
    return data.data as T || defaultValue;
  }

  // Navigate to specified path
  const value = path.split('.').reduce((obj: unknown, key) => {
    if (obj && typeof obj === 'object') {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);

  return (value as T) || defaultValue;
}

// ============================================
// EXPORTS
// ============================================

export default {
  // Booking
  transformBookingDates,

  // Service
  transformService,
  transformServices,

  // Coordinates
  toBackendCoords,
  fromBackendCoords,

  // ID
  toStringId,
  normalizeId,

  // Price
  normalizePrice,
  formatDisplayPrice,

  // Date
  toISODateString,
  toDate,

  // API
  extractApiData,
};
