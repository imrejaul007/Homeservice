/**
 * Bundle Transformer Utility
 *
 * Transforms backend bundle data to match frontend expectations
 * Handles field name mapping, type conversions, and default values
 */

import { IBundle, IBundleService } from '../models/bundle.model';

export interface TransformedBundle {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  description: string;
  shortDescription: string;
  services: TransformedBundleService[];
  originalTotalPrice: number;
  bundlePrice: number;
  discountPercent: number;
  savings: number;
  images: string[];
  thumbnail?: string;
  categoryId: string;
  categoryName: string;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  averageRating: number;
  reviewCount: number;
  duration: number;
  durationUnit: 'minutes' | 'hours' | 'days';
  validityDays: number;
  maxBookings: number;
  bookingsUsed: number;
  isActive: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  tags: string[];
  terms?: string;
  cancellationPolicy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransformedBundleService {
  serviceId: string;
  name: string;
  serviceName?: string;
  description: string;
  originalPrice: number;
  discountedPrice: number;
  quantity: number;
  duration: number;
  categoryName: string;
}

/**
 * Convert ObjectId or string to string
 */
function toStringId(value: any): string {
  if (!value) return '';
  if (typeof value === 'object' && value._bsontype === 'ObjectId') return value.toString();
  if (typeof value === 'object' && value.$oid) return value.$oid;
  if (typeof value === 'object' && value._id) return toStringId(value._id);
  return String(value);
}

/**
 * Convert Date or string to ISO string
 */
function toIsoString(value: any): string | undefined {
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
function transformService(service: IBundleService | any): TransformedBundleService {
  const serviceId = service.serviceId;
  const populatedService = service.serviceId && typeof service.serviceId === 'object'
    ? service.serviceId
    : service;

  return {
    serviceId: toStringId(serviceId),
    name: populatedService?.name || service.serviceName || '',
    serviceName: populatedService?.name || service.serviceName || '',
    description: service.description || populatedService?.description || '',
    originalPrice: service.originalPrice || 0,
    discountedPrice: service.originalPrice
      ? Math.round(service.originalPrice * (1 - (service.bundleSavings || 0) / 100))
      : service.originalPrice || 0,
    quantity: service.quantity || 1,
    duration: populatedService?.duration || service.duration || 60,
    categoryName: populatedService?.category?.name || service.categoryName || '',
  };
}

/**
 * Transform a complete bundle from backend format to frontend format
 */
export function transformBundle(bundle: any): TransformedBundle {
  if (!bundle) return bundle as any;

  const services = (bundle.services || []).map((s: any) => transformService(s));

  // Calculate total duration from services
  const totalDuration = services.reduce((sum: number, s: TransformedBundleService) => sum + s.duration, 0);

  // Determine duration unit
  let durationUnit: 'minutes' | 'hours' | 'days' = 'hours';
  if (totalDuration >= 480) {
    durationUnit = 'days';
  } else if (totalDuration >= 60) {
    durationUnit = 'hours';
  }

  // Handle images (single image or array)
  const images = bundle.images || (bundle.image ? [bundle.image] : []);

  // Calculate validity period
  const validFrom = bundle.validFrom ? new Date(bundle.validFrom) : new Date();
  const validUntil = bundle.validUntil ? new Date(bundle.validUntil) : new Date();
  const validityDays = Math.ceil((validUntil.getTime() - validFrom.getTime()) / (1000 * 60 * 60 * 24));

  // Get provider info
  const provider = bundle.providerId;
  const providerName = provider?.businessName
    || `${provider?.firstName || ''} ${provider?.lastName || ''}`.trim()
    || 'Unknown Provider';

  return {
    id: toStringId(bundle._id),
    _id: toStringId(bundle._id),
    name: bundle.name || '',
    slug: bundle.slug || generateSlug(bundle.name || ''),
    description: bundle.description || '',
    shortDescription: bundle.description?.substring(0, 150) || bundle.description || '',
    services,
    originalTotalPrice: bundle.originalPrice || 0,
    bundlePrice: bundle.bundlePrice || 0,
    discountPercent: bundle.savingsPercentage || 0,
    savings: bundle.savingsAmount || (bundle.originalPrice - bundle.bundlePrice) || 0,
    images,
    thumbnail: images[0],
    categoryId: toStringId(bundle.categoryId),
    categoryName: (bundle.categoryId as any)?.name || '',
    providerId: toStringId(provider),
    providerName,
    providerAvatar: provider?.profileImage || provider?.avatar,
    averageRating: bundle.rating?.average || 0,
    reviewCount: bundle.rating?.count || 0,
    duration: totalDuration,
    durationUnit,
    validityDays,
    maxBookings: bundle.maxRedemptions || 0,
    bookingsUsed: bundle.redemptionsUsed || bundle.bookingCount || 0,
    isActive: bundle.isActive ?? true,
    isFeatured: bundle.isFeatured ?? false,
    isPopular: (bundle.bookingCount || 0) > 10,
    tags: bundle.tags || [],
    terms: bundle.terms,
    cancellationPolicy: bundle.cancellationPolicy,
    createdAt: toIsoString(bundle.createdAt) || '',
    updatedAt: toIsoString(bundle.updatedAt) || '',
  };
}

/**
 * Transform a list of bundles
 */
export function transformBundleList(bundles: any[]): TransformedBundle[] {
  return bundles.map((bundle) => transformBundle(bundle));
}

export default {
  transformBundle,
  transformBundleList,
};
