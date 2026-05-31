import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Address from '../models/address.model';
import ProviderProfile from '../models/providerProfile.model';
import { resolveBookingLocation, normalizeCityName } from '../utils/bookingLocation.util';
import logger from '../utils/logger';

export interface EnrichLocationResult {
  updated: number;
  skipped: number;
  errors: number;
}

/** Load location context and return an enriched booking location object */
export async function enrichBookingLocation(
  customerId: string | mongoose.Types.ObjectId | undefined,
  providerId: string | mongoose.Types.ObjectId,
  location: unknown,
  locationType?: 'at_home' | 'at_provider' | 'at_hotel'
) {
  const [customer, savedAddress, providerProfile] = await Promise.all([
    customerId ? User.findById(customerId).select('address').lean() : null,
    customerId
      ? Address.findOne({ userId: String(customerId) }).sort({ isDefault: -1, updatedAt: -1 }).lean()
      : null,
    ProviderProfile.findOne({ userId: providerId })
      .select('locationInfo.primaryAddress locationInfo.serviceAreas')
      .lean(),
  ]);

  const loc = (location || {}) as {
    type?: string;
    address?: Record<string, unknown>;
    notes?: string;
  };

  return resolveBookingLocation({
    bookingLocation: loc,
    locationType,
    customerAddress: customer?.address,
    savedAddress: savedAddress || undefined,
    providerPrimaryAddress: providerProfile?.locationInfo?.primaryAddress,
    providerServiceAreaCity: providerProfile?.locationInfo?.serviceAreas?.find(
      (a) => a.type === 'city' && a.name
    )?.name,
  });
}

/** Backfill bookings missing city data from customer, saved address, or provider profile */
export async function backfillBookingLocations(): Promise<EnrichLocationResult> {
  const result: EnrichLocationResult = { updated: 0, skipped: 0, errors: 0 };

  const bookings = await Booking.find({
    $or: [
      { 'location.address.city': { $exists: false } },
      { 'location.address.city': null },
      { 'location.address.city': '' },
      { 'location.address.city': /^unknown$/i },
    ],
  })
    .select('_id customerId providerId location locationType')
    .lean();

  for (const booking of bookings) {
    try {
      const existingCity = normalizeCityName(booking.location?.address?.city);
      if (existingCity) {
        result.skipped++;
        continue;
      }

      const enriched = await enrichBookingLocation(
        booking.customerId,
        booking.providerId,
        booking.location,
        booking.locationType
      );

      await Booking.updateOne(
        { _id: booking._id },
        {
          $set: {
            location: enriched,
          },
        }
      );
      result.updated++;
    } catch (error) {
      result.errors++;
      logger.warn('Failed to enrich booking location', {
        bookingId: booking._id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
