import { PipelineStage } from 'mongoose';

/** Default city for UAE marketplace when no location source is available */
export const DEFAULT_BOOKING_CITY = process.env.DEFAULT_BOOKING_CITY || 'Dubai';
export const DEFAULT_BOOKING_COUNTRY = process.env.DEFAULT_BOOKING_COUNTRY || 'AE';

export function normalizeCityName(city?: string | null): string | null {
  if (!city || typeof city !== 'string') return null;
  const trimmed = city.trim();
  if (!trimmed || trimmed.toLowerCase() === 'unknown') return null;
  return trimmed;
}

export interface ResolvedBookingLocation {
  type: 'customer_address' | 'provider_location' | 'hotel';
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number];
    };
  };
  notes?: string;
}

interface LocationSources {
  bookingLocation?: {
    type?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
      coordinates?: { type?: string; coordinates?: [number, number] };
    };
    notes?: string;
  };
  customerAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    coordinates?: { type?: string; coordinates?: [number, number] };
  };
  savedAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    location?: { type?: string; coordinates?: [number, number] };
  };
  providerPrimaryAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    coordinates?: { type?: string; coordinates?: [number, number] };
  };
  providerServiceAreaCity?: string;
  locationType?: 'at_home' | 'at_provider' | 'at_hotel';
}

/** Resolve the best available city/address for a booking from multiple sources */
export function resolveBookingLocation(sources: LocationSources): ResolvedBookingLocation {
  const type =
    (sources.bookingLocation?.type as ResolvedBookingLocation['type']) ||
    (sources.locationType === 'at_provider' ? 'provider_location' : 'customer_address');

  const bookingAddr = sources.bookingLocation?.address;
  const city =
    normalizeCityName(bookingAddr?.city) ||
    normalizeCityName(sources.customerAddress?.city) ||
    normalizeCityName(sources.savedAddress?.city) ||
    normalizeCityName(sources.providerPrimaryAddress?.city) ||
    normalizeCityName(sources.providerServiceAreaCity) ||
    DEFAULT_BOOKING_CITY;

  const street =
    bookingAddr?.street ||
    sources.savedAddress?.street ||
    sources.customerAddress?.street ||
    sources.providerPrimaryAddress?.street ||
    '';

  const state =
    bookingAddr?.state ||
    sources.savedAddress?.state ||
    sources.customerAddress?.state ||
    sources.providerPrimaryAddress?.state ||
    '';

  const zipCode =
    bookingAddr?.zipCode ||
    sources.savedAddress?.zipCode ||
    sources.customerAddress?.zipCode ||
    sources.providerPrimaryAddress?.zipCode ||
    '';

  const country =
    bookingAddr?.country ||
    sources.savedAddress?.country ||
    sources.customerAddress?.country ||
    sources.providerPrimaryAddress?.country ||
    DEFAULT_BOOKING_COUNTRY;

  const coords =
    bookingAddr?.coordinates ||
    sources.savedAddress?.location ||
    sources.customerAddress?.coordinates ||
    sources.providerPrimaryAddress?.coordinates;

  const resolved: ResolvedBookingLocation = {
    type,
    address: { street, city, state, zipCode, country },
    notes: sources.bookingLocation?.notes,
  };

  if (coords?.coordinates?.length === 2) {
    resolved.address.coordinates = {
      type: 'Point',
      coordinates: coords.coordinates,
    };
  }

  return resolved;
}

/** MongoDB $addFields expression to resolve city inside aggregations */
export function resolvedCityAggregationField(defaultCity: string = DEFAULT_BOOKING_CITY) {
  return {
    $let: {
      vars: {
        bookingCity: { $trim: { input: { $ifNull: ['$location.address.city', ''] } } },
        customerCity: { $trim: { input: { $ifNull: ['$customer.address.city', ''] } } },
        addressCity: { $trim: { input: { $ifNull: ['$defaultAddress.city', ''] } } },
        providerCity: {
          $trim: { input: { $ifNull: ['$providerProfile.locationInfo.primaryAddress.city', ''] } },
        },
        serviceAreaCity: {
          $trim: {
            input: { $ifNull: [{ $arrayElemAt: ['$providerProfile.locationInfo.serviceAreas.name', 0] }, ''] },
          },
        },
      },
      in: {
        $switch: {
          branches: [
            { case: { $gt: [{ $strLenCP: '$$bookingCity' }, 0] }, then: '$$bookingCity' },
            { case: { $gt: [{ $strLenCP: '$$customerCity' }, 0] }, then: '$$customerCity' },
            { case: { $gt: [{ $strLenCP: '$$addressCity' }, 0] }, then: '$$addressCity' },
            { case: { $gt: [{ $strLenCP: '$$providerCity' }, 0] }, then: '$$providerCity' },
            { case: { $gt: [{ $strLenCP: '$$serviceAreaCity' }, 0] }, then: '$$serviceAreaCity' },
          ],
          default: defaultCity,
        },
      },
    },
  };
}

export function resolvedRegionAggregationField() {
  return {
    $ifNull: [
      '$location.address.state',
      '$customer.address.state',
      '$defaultAddress.state',
      '$providerProfile.locationInfo.primaryAddress.state',
      'Unknown',
    ],
  };
}

/** Shared lookup stages for geographic aggregations */
export function geographicLookupStages(): PipelineStage[] {
  return [
    {
      $lookup: {
        from: 'users',
        localField: 'customerId',
        foreignField: '_id',
        as: 'customer',
      },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'addresses',
        let: { cid: '$customerId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$userId', { $toString: '$$cid' }] },
            },
          },
          { $sort: { isDefault: -1, updatedAt: -1 } },
          { $limit: 1 },
        ],
        as: 'defaultAddress',
      },
    },
    { $unwind: { path: '$defaultAddress', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'providerprofiles',
        localField: 'providerId',
        foreignField: 'userId',
        as: 'providerProfile',
      },
    },
    { $unwind: { path: '$providerProfile', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        resolvedCity: resolvedCityAggregationField(),
        resolvedRegion: resolvedRegionAggregationField(),
      },
    },
  ];
}
