import mongoose from 'mongoose';
import Booking from '../models/booking.model';

export const BOOKING_ATTRIBUTION_SOURCES = [
  'organic',
  'search',
  'profile',
  'ad',
  'direct',
  'repeat',
] as const;

export type BookingAttributionSource = (typeof BOOKING_ATTRIBUTION_SOURCES)[number];

export interface BookingAttribution {
  source: BookingAttributionSource;
  adCampaignId?: mongoose.Types.ObjectId;
  referrer?: string;
}

export interface ResolveAttributionInput {
  customerId: string;
  providerId: string;
  metadata?: {
    bookingSource?: string;
    adCampaignId?: string;
    referrer?: string;
  };
  referrer?: string;
  isGuest?: boolean;
}

const LEGACY_SOURCE_MAP: Record<string, BookingAttributionSource> = {
  search: 'search',
  profile: 'profile',
  ad: 'ad',
  direct: 'direct',
  repeat: 'repeat',
  organic: 'organic',
  recommendation: 'organic',
};

function isSearchReferrer(referrer: string): boolean {
  try {
    const host = new URL(referrer).hostname.toLowerCase();
    return /google\.|bing\.|yahoo\.|duckduckgo\.|baidu\.|yandex\./.test(host);
  } catch {
    return false;
  }
}

export function mapLegacyBookingSource(
  bookingSource?: string,
): BookingAttributionSource | undefined {
  if (!bookingSource) return undefined;
  return LEGACY_SOURCE_MAP[bookingSource.toLowerCase()];
}

/**
 * Resolve effective attribution source for analytics queries on stored bookings.
 * Prefers attribution.source; falls back to legacy metadata.bookingSource.
 */
export function resolveStoredAttributionSource(booking: {
  attribution?: { source?: string };
  metadata?: { bookingSource?: string };
}): BookingAttributionSource {
  if (booking.attribution?.source) {
    return booking.attribution.source as BookingAttributionSource;
  }
  const mapped = mapLegacyBookingSource(booking.metadata?.bookingSource);
  return mapped ?? 'organic';
}

export async function isRepeatCustomer(
  customerId: string,
  providerId: string,
): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(customerId) || !mongoose.Types.ObjectId.isValid(providerId)) {
    return false;
  }

  const existing = await Booking.exists({
    customerId: new mongoose.Types.ObjectId(customerId),
    providerId: new mongoose.Types.ObjectId(providerId),
    status: 'completed',
    deletedAt: { $exists: false },
  });

  return Boolean(existing);
}

export async function resolveBookingAttribution(
  input: ResolveAttributionInput,
): Promise<BookingAttribution> {
  const referrer = input.referrer || input.metadata?.referrer;

  if (input.metadata?.adCampaignId && mongoose.Types.ObjectId.isValid(input.metadata.adCampaignId)) {
    return {
      source: 'ad',
      adCampaignId: new mongoose.Types.ObjectId(input.metadata.adCampaignId),
      referrer,
    };
  }

  if (!input.isGuest) {
    const repeat = await isRepeatCustomer(input.customerId, input.providerId);
    if (repeat) {
      return { source: 'repeat', referrer };
    }
  }

  const explicit = mapLegacyBookingSource(input.metadata?.bookingSource);
  if (explicit) {
    return { source: explicit, referrer };
  }

  if (referrer) {
    if (isSearchReferrer(referrer)) {
      return { source: 'search', referrer };
    }
    return { source: 'organic', referrer };
  }

  return { source: 'direct' };
}

export function buildAdAttributedBookingFilter(providerId: mongoose.Types.ObjectId) {
  return {
    providerId,
    status: 'completed',
    $or: [
      { 'attribution.source': 'ad' },
      { 'attribution.adCampaignId': { $exists: true, $ne: null } },
    ],
  };
}
