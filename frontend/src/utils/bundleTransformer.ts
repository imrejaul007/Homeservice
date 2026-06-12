/**
 * Bundle Transformer Utility (Frontend)
 *
 * Transforms backend bundle responses to match frontend type expectations
 * Mirrors the backend transformer for consistent data normalization
 */

import type { Bundle, BundleListItem, BundleService } from '../services/bundleApi';

// Backend bundle response type (before transformation)
interface BackendBundle {
  _id: string | { $oid: string };
  id?: string;
  name: string;
  slug?: string;
  description: string;
  shortDescription?: string;
  services: BackendBundleService[];
  originalPrice: number;
  bundlePrice: number;
  savingsAmount: number;
  savingsPercentage: number;
  image?: string;
  images?: string[];
  categoryId?: string | { _id: string; name: string };
  category?: { name: string };
  providerId?: string | { _id: string; firstName: string; lastName: string; businessName?: string; profileImage?: string; avatar?: string };
  provider?: { firstName: string; lastName: string; businessName?: string; profileImage?: string; avatar?: string };
  rating?: { average: number; count: number };
  redemptionsUsed?: number;
  bookingCount?: number;
  maxRedemptions?: number;
  isActive?: boolean;
  isFeatured?: boolean;
  validFrom?: string | Date;
  validUntil?: string | Date;
  tags?: string[];
  terms?: string;
  cancellationPolicy?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

interface BackendBundleService {
  serviceId: string | { $oid: string } | { _id: string; name: string; images?: string[]; description?: string; duration?: number };
  serviceName?: string;
  quantity?: number;
  originalPrice?: number;
  description?: string;
  duration?: number;
}

/**
 * Convert ObjectId or string to string
 */
function toStringId(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'object' && value !== null) {
    if ((value as { $oid?: string }).$oid) return (value as { $oid: string }).$oid;
    if ('_bsontype' in value) return (value as { toString: () => string }).toString();
    if ('_id' in value) return toStringId((value as { _id: unknown })._id);
  }
  return String(value);
}

/**
 * Convert Date or string to ISO string
 */
function toIsoString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return String(value);
}

/**
 * Generate slug from bundle name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Transform a single bundle service
 */
function transformService(service: BackendBundleService): BundleService {
  // Handle different serviceId formats: string, ObjectId, or populated object
  const serviceIdValue = service.serviceId;
  let serviceId: string | { $oid: string } | { _id: string };
  let populatedService: { _id?: string; name?: string; description?: string; duration?: number } | null = null;

  if (typeof serviceIdValue === 'object' && serviceIdValue !== null && !('$oid' in serviceIdValue)) {
    // Populated service object
    serviceId = (serviceIdValue as { _id: string })._id;
    populatedService = serviceIdValue as { _id: string; name?: string; description?: string; duration?: number };
  } else {
    serviceId = serviceIdValue;
  }

  return {
    serviceId: toStringId(serviceId),
    serviceName: populatedService?.name || service.serviceName || '',
    name: populatedService?.name || service.serviceName || '',
    description: service.description || populatedService?.description || '',
    originalPrice: service.originalPrice || 0,
    discountedPrice: service.originalPrice || 0,
    quantity: service.quantity || 1,
    duration: populatedService?.duration || service.duration || 60,
    categoryName: '',
  } as BundleService;
}

/**
 * Transform a complete bundle from backend format to frontend format
 */
export function transformBundle(bundle: BackendBundle): Bundle {
  if (!bundle) return bundle as unknown as Bundle;

  const services = (bundle.services || []).map((s) => transformService(s));

  // Calculate total duration from services
  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

  // Determine duration unit
  let durationUnit: 'minutes' | 'hours' | 'days' = 'hours';
  if (totalDuration >= 480) {
    durationUnit = 'days';
  } else if (totalDuration >= 60) {
    durationUnit = 'hours';
  }

  // Handle images (single image or array)
  const images = bundle.images || (bundle.image ? [bundle.image] : []);

  // Handle category
  let categoryId = '';
  let categoryName = '';
  if (typeof bundle.categoryId === 'object' && bundle.categoryId) {
    categoryId = toStringId((bundle.categoryId as { _id?: unknown })._id);
    categoryName = (bundle.categoryId as { name?: string }).name || '';
  } else {
    categoryId = toStringId(bundle.categoryId);
  }
  if (!categoryName && bundle.category) {
    categoryName = (bundle.category as { name?: string }).name || '';
  }

  // Handle provider
  let providerId = '';
  let providerName = '';
  let providerAvatar = '';

  if (typeof bundle.providerId === 'object' && bundle.providerId) {
    const provider = bundle.providerId as { _id?: unknown; firstName?: string; lastName?: string; businessName?: string; profileImage?: string; avatar?: string };
    providerId = toStringId(provider._id);
    providerName = provider.businessName || `${provider.firstName || ''} ${provider.lastName || ''}`.trim();
    providerAvatar = provider.profileImage || provider.avatar;
  } else {
    providerId = toStringId(bundle.providerId);
  }
  if (!providerName && bundle.provider) {
    const provider = bundle.provider as { firstName?: string; lastName?: string; businessName?: string; profileImage?: string; avatar?: string };
    providerName = provider.businessName || `${provider.firstName || ''} ${provider.lastName || ''}`.trim();
    providerAvatar = provider.profileImage || provider.avatar;
  }

  // Calculate validity period
  let validityDays = 30;
  if (bundle.validFrom && bundle.validUntil) {
    const validFrom = new Date(bundle.validFrom);
    const validUntil = new Date(bundle.validUntil);
    validityDays = Math.ceil((validUntil.getTime() - validFrom.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    id: toStringId(bundle._id),
    name: bundle.name || '',
    slug: bundle.slug || generateSlug(bundle.name || ''),
    description: bundle.description || '',
    shortDescription: bundle.shortDescription || bundle.description?.substring(0, 150) || '',
    services,
    originalTotalPrice: bundle.originalPrice || 0,
    bundlePrice: bundle.bundlePrice || 0,
    discountPercent: bundle.savingsPercentage || 0,
    savings: bundle.savingsAmount || (bundle.originalPrice - bundle.bundlePrice) || 0,
    images,
    thumbnail: images[0],
    categoryId,
    categoryName,
    providerId,
    providerName: providerName || 'Unknown Provider',
    providerAvatar,
    averageRating: bundle.rating?.average || 0,
    reviewCount: bundle.rating?.count || 0,
    duration: totalDuration,
    durationUnit,
    validityDays,
    maxBookings: bundle.maxRedemptions || 0,
    bookingsUsed: bundle.redemptionsUsed || bundle.bookingCount || 0,
    isActive: bundle.isActive ?? true,
    isFeatured: bundle.isFeatured ?? false,
    isPopular: (bundle.bookingCount || bundle.redemptionsUsed || 0) > 10,
    tags: bundle.tags || [],
    terms: bundle.terms,
    cancellationPolicy: bundle.cancellationPolicy,
    createdAt: toIsoString(bundle.createdAt) || '',
    updatedAt: toIsoString(bundle.updatedAt) || '',
  };
}

/**
 * Transform a list item (lighter version for listing)
 */
export function transformBundleListItem(bundle: BackendBundle): BundleListItem {
  const images = bundle.images || (bundle.image ? [bundle.image] : []);

  let categoryName = '';
  if (typeof bundle.categoryId === 'object' && bundle.categoryId) {
    categoryName = (bundle.categoryId as { name?: string }).name || '';
  }
  if (!categoryName && bundle.category) {
    categoryName = (bundle.category as { name?: string }).name || '';
  }

  let providerName = '';
  if (typeof bundle.providerId === 'object' && bundle.providerId) {
    const provider = bundle.providerId as { firstName?: string; lastName?: string; businessName?: string };
    providerName = provider.businessName || `${provider.firstName || ''} ${provider.lastName || ''}`.trim();
  }
  if (!providerName && bundle.provider) {
    const provider = bundle.provider as { firstName?: string; lastName?: string; businessName?: string };
    providerName = provider.businessName || `${provider.firstName || ''} ${provider.lastName || ''}`.trim();
  }

  const services = (bundle.services || []).map((s) => transformService(s));
  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);

  let durationUnit: 'minutes' | 'hours' | 'days' = 'hours';
  if (totalDuration >= 480) durationUnit = 'days';
  else if (totalDuration >= 60) durationUnit = 'hours';

  return {
    id: toStringId(bundle._id),
    name: bundle.name || '',
    slug: bundle.slug || generateSlug(bundle.name || ''),
    shortDescription: bundle.shortDescription || bundle.description?.substring(0, 150) || '',
    images,
    thumbnail: images[0],
    categoryName,
    providerName: providerName || 'Unknown Provider',
    originalTotalPrice: bundle.originalPrice || 0,
    bundlePrice: bundle.bundlePrice || 0,
    discountPercent: bundle.savingsPercentage || 0,
    averageRating: bundle.rating?.average || 0,
    reviewCount: bundle.rating?.count || 0,
    duration: totalDuration,
    durationUnit,
    validityDays: 30,
    isActive: bundle.isActive ?? true,
    isFeatured: bundle.isFeatured ?? false,
    isPopular: (bundle.bookingCount || bundle.redemptionsUsed || 0) > 10,
  };
}

/**
 * Transform a list of bundles
 */
export function transformBundleList(bundles: BackendBundle[]): Bundle[] {
  return bundles.map((bundle) => transformBundle(bundle));
}

/**
 * Transform a list of bundle list items
 */
export function transformBundleListItems(bundles: BackendBundle[]): BundleListItem[] {
  return bundles.map((bundle) => transformBundleListItem(bundle));
}

export default {
  transformBundle,
  transformBundleList,
  transformBundleListItem,
  transformBundleListItems,
};
