import mongoose, { Types } from 'mongoose';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import cacheService, { CACHE_KEYS } from './cache.service';

// ============================================
// Geolocation Service - Location-based Search & Analytics
// ============================================

// Coordinates interface
export interface Coordinates {
  lat: number;
  lng: number;
}

// GeoJSON point
export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

// Nearby service interface
export interface NearbyService {
  serviceId: string;
  serviceName: string;
  categoryId?: string;
  categoryName?: string;
  providerId: string;
  providerName: string;
  providerRating: number;
  providerReviewCount: number;
  price: number;
  currency: string;
  distance: number; // in km
  coordinates: Coordinates;
  images?: string[];
  duration?: number;
  isAvailable?: boolean;
}

// Nearby provider interface
export interface NearbyProvider {
  providerId: string;
  providerName: string;
  businessName?: string;
  rating: number;
  reviewCount: number;
  distance: number;
  coordinates: Coordinates;
  services: Array<{
    serviceId: string;
    serviceName: string;
    price: number;
  }>;
  isVerified: boolean;
  isTopRated: boolean;
  avatar?: string;
}

// Service area interface
export interface ServiceArea {
  providerId: string;
  center: Coordinates;
  radius: number; // in km
  coveredAreas: string[];
  estimatedCustomers: number;
}

// Search filters
export interface GeoSearchFilters {
  coordinates: Coordinates;
  radius?: number; // in km
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy?: 'distance' | 'rating' | 'price' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Travel time estimate
export interface TravelTimeEstimate {
  distance: number; // km
  durationMinutes: number;
  trafficMultiplier?: number;
  estimatedArrival?: Date;
}

export class GeolocationService {
  // ============================================
  // Distance Calculation
  // ============================================

  /**
   * Calculate distance between two points using Haversine formula
   */
  calculateDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLng = this.toRad(point2.lng - point1.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.lat)) *
        Math.cos(this.toRad(point2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  /**
   * Calculate travel time estimate
   */
  estimateTravelTime(
    from: Coordinates,
    to: Coordinates,
    options: {
      averageSpeedKmH?: number;
      trafficMultiplier?: number;
      departureTime?: Date;
    } = {}
  ): TravelTimeEstimate {
    const { averageSpeedKmH = 30, trafficMultiplier = 1.2, departureTime } = options;

    const distance = this.calculateDistance(from, to);
    let durationMinutes = Math.ceil((distance / averageSpeedKmH) * 60);

    // Apply traffic multiplier for rush hours
    if (departureTime) {
      const hour = departureTime.getHours();
      // Rush hour traffic (7-9 AM and 5-7 PM)
      if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
        durationMinutes = Math.ceil(durationMinutes * trafficMultiplier);
      }
    } else {
      durationMinutes = Math.ceil(durationMinutes * 1.1); // Default 10% buffer
    }

    const result: TravelTimeEstimate = {
      distance: Math.round(distance * 100) / 100,
      durationMinutes,
      trafficMultiplier,
    };

    if (departureTime) {
      result.estimatedArrival = new Date(departureTime.getTime() + durationMinutes * 60 * 1000);
    }

    return result;
  }

  // ============================================
  // Find Nearby Services
  // ============================================

  /**
   * Find services near a location
   */
  async findNearbyServices(filters: GeoSearchFilters): Promise<{
    services: NearbyService[];
    total: number;
    hasMore: boolean;
  }> {
    const {
      coordinates,
      radius = 50, // 50km default
      categoryId,
      minPrice,
      maxPrice,
      minRating,
      sortBy = 'distance',
      sortOrder = 'asc',
      limit = 20,
      offset = 0,
    } = filters;

    const cacheKey = `nearby:services:${coordinates.lat}:${coordinates.lng}:${radius}:${categoryId || 'all'}:${sortBy}:${limit}:${offset}`;
    const ttl = 300; // 5 minutes

    return cacheService.getOrSet(cacheKey, async () => {
      // Build aggregation pipeline
      const pipeline: mongoose.PipelineStage[] = [
        // Match active services
        {
          $match: {
            isActive: true,
            ...(categoryId && { category: new Types.ObjectId(categoryId) }),
            ...(minPrice && { 'pricing.basePrice': { $gte: minPrice } }),
            ...(maxPrice && { 'pricing.basePrice': { $lte: maxPrice } }),
          },
        },

        // Lookup provider info
        {
          $lookup: {
            from: 'users',
            localField: 'provider',
            foreignField: '_id',
            as: 'providerUser',
          },
        },
        { $unwind: { path: '$providerUser', preserveNullAndEmptyArrays: true } },

        // Lookup provider profile
        {
          $lookup: {
            from: 'providerprofiles',
            localField: 'provider',
            foreignField: 'userId',
            as: 'providerProfile',
          },
        },
        { $unwind: { path: '$providerProfile', preserveNullAndEmptyArrays: true } },

        // Lookup category
        {
          $lookup: {
            from: 'servicecategories',
            localField: 'category',
            foreignField: '_id',
            as: 'categoryInfo',
          },
        },
        { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },

        // Filter by rating if specified
        ...(minRating
          ? [{ $match: { 'providerProfile.rating.average': { $gte: minRating } } }]
          : []),

        // Calculate distance (approximation using GeoJSON or manual calculation)
        {
          $addFields: {
            providerCoords: {
              $ifNull: [
                '$providerProfile.locationInfo.primaryAddress.coordinates.coordinates',
                [0, 0],
              ],
            },
          },
        },
      ];

      let services = await Service.aggregate(pipeline);

      // Filter and calculate distances in JavaScript
      const providerLocations = new Map<string, { lat: number; lng: number }>();

      // Get unique provider locations
      const providerIds = [...new Set(services.map((s: any) => s.provider?.toString()).filter(Boolean))] as string[];
      if (providerIds.length > 0) {
        const profiles = await ProviderProfile.find({
          userId: { $in: providerIds },
        }).select('userId locationInfo.primaryAddress.coordinates');

        profiles.forEach((p: any) => {
          const coords = p.locationInfo?.primaryAddress?.coordinates;
          if (coords?.coordinates && Array.isArray(coords.coordinates)) {
            providerLocations.set(p.userId.toString(), {
              lng: coords.coordinates[0],
              lat: coords.coordinates[1],
            });
          } else if (coords?.lat !== undefined && coords?.lng !== undefined) {
            providerLocations.set(p.userId.toString(), {
              lat: coords.lat,
              lng: coords.lng,
            });
          }
        });
      }

      // Filter by radius and calculate distance
      services = services
        .map((s: any) => {
          const providerLoc = providerLocations.get(s.provider?.toString());
          if (!providerLoc) return null;

          const distance = this.calculateDistance(coordinates, {
            lat: providerLoc.lat,
            lng: providerLoc.lng,
          });

          if (distance > radius) return null;

          return {
            ...s,
            calculatedDistance: distance,
          };
        })
        .filter((s: any) => s !== null);

      // Sort results
      services.sort((a: any, b: any) => {
        let comparison = 0;

        switch (sortBy) {
          case 'distance':
            comparison = a.calculatedDistance - b.calculatedDistance;
            break;
          case 'rating':
            comparison =
              (b.providerProfile?.rating?.average || 0) -
              (a.providerProfile?.rating?.average || 0);
            break;
          case 'price':
            comparison =
              (a.pricing?.basePrice || 0) - (b.pricing?.basePrice || 0);
            break;
          case 'popularity':
            comparison =
              (b.searchMetadata?.bookingCount || 0) -
              (a.searchMetadata?.bookingCount || 0);
            break;
        }

        return sortOrder === 'desc' ? -comparison : comparison;
      });

      const total = services.length;
      const paginatedServices = services.slice(offset, offset + limit);

      // Transform to output format
      const transformedServices: NearbyService[] = paginatedServices.map((s: any) => {
        const providerLoc = providerLocations.get(s.provider?.toString());
        const providerUser = s.providerUser || {};

        return {
          serviceId: s._id.toString(),
          serviceName: s.title || s.name,
          categoryId: s.category?.toString(),
          categoryName: s.categoryInfo?.name,
          providerId: s.provider?.toString(),
          providerName: `${providerUser.firstName || ''} ${providerUser.lastName || ''}`.trim(),
          providerRating: s.providerProfile?.rating?.average || 0,
          providerReviewCount: s.providerProfile?.rating?.count || 0,
          price: s.pricing?.basePrice || 0,
          currency: s.pricing?.currency || 'AED',
          distance: Math.round((s.calculatedDistance || 0) * 10) / 10,
          coordinates: providerLoc || { lat: 0, lng: 0 },
          images: s.images,
          duration: s.duration?.min || s.duration,
          isAvailable: true,
        };
      });

      return {
        services: transformedServices,
        total,
        hasMore: offset + limit < total,
      };
    }, { prefix: CACHE_KEYS.SERVICE, ttl });
  }

  /**
   * Find nearby providers
   */
  async findNearbyProviders(
    coordinates: Coordinates,
    options: {
      radius?: number;
      categoryId?: string;
      minRating?: number;
      verifiedOnly?: boolean;
      limit?: number;
    } = {}
  ): Promise<NearbyProvider[]> {
    const { radius = 50, categoryId, minRating, verifiedOnly, limit = 20 } = options;

    const cacheKey = `nearby:providers:${coordinates.lat}:${coordinates.lng}:${radius}:${categoryId || 'all'}:${minRating}:${verifiedOnly}:${limit}`;
    const ttl = 300;

    return cacheService.getOrSet(cacheKey, async () => {
      // Build base query
      const profileQuery: any = {
        'locationInfo.mobileService': true,
      };

      if (minRating) {
        profileQuery['rating.average'] = { $gte: minRating };
      }

      if (verifiedOnly) {
        profileQuery.verificationStatus = 'approved';
      }

      const profiles = await ProviderProfile.find(profileQuery)
        .select('userId businessInfo rating locationInfo verificationStatus')
        .limit(100);

      // Calculate distances and filter
      const providersWithDistance: Array<{
        profile: any;
        distance: number;
      }> = profiles
        .map((p: any) => {
          const coords = p.locationInfo?.primaryAddress?.coordinates;
          let lat = 0,
            lng = 0;

          if (coords?.coordinates && Array.isArray(coords.coordinates)) {
            lng = coords.coordinates[0];
            lat = coords.coordinates[1];
          } else if (coords?.lat !== undefined) {
            lat = coords.lat;
            lng = coords.lng;
          }

          const distance = this.calculateDistance(coordinates, { lat, lng });

          return { profile: p, distance };
        })
        .filter((p) => p.distance <= radius)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);

      // Get user details and services
      const userIds = providersWithDistance.map((p) => p.profile.userId);
      const users = await mongoose.model('User').find({ _id: { $in: userIds } }).select('firstName lastName avatar');

      const userMap = new Map<string, any>();
      users.forEach((u: any) => userMap.set(u._id.toString(), u));

      // Get services per provider
      const serviceQuery: any = { isActive: true, provider: { $in: userIds } };
      if (categoryId) {
        serviceQuery.category = new Types.ObjectId(categoryId);
      }

      const services = await Service.find(serviceQuery)
        .select('provider title pricing.basePrice')
        .limit(50);

      const servicesByProvider = new Map<string, any[]>();
      services.forEach((s: any) => {
        const pid = s.provider.toString();
        if (!servicesByProvider.has(pid)) {
          servicesByProvider.set(pid, []);
        }
        servicesByProvider.get(pid)!.push({
          serviceId: s._id.toString(),
          serviceName: s.title,
          price: s.pricing?.basePrice || 0,
        });
      });

      return providersWithDistance.map(({ profile, distance }) => {
        const user = userMap.get(profile.userId.toString()) || {};
        const providerServices = servicesByProvider.get(profile.userId.toString()) || [];

        return {
          providerId: profile.userId.toString(),
          providerName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          businessName: profile.businessInfo?.businessName,
          rating: profile.rating?.average || 0,
          reviewCount: profile.rating?.count || 0,
          distance: Math.round(distance * 10) / 10,
          coordinates: { lat: 0, lng: 0 }, // Simplified
          services: providerServices.slice(0, 5),
          isVerified: profile.verificationStatus === 'approved',
          isTopRated: profile.isTopRated || false,
          avatar: user.avatar,
        };
      });
    }, { prefix: CACHE_KEYS.SERVICE, ttl });
  }

  // ============================================
  // Service Area Matching
  // ============================================

  /**
   * Check if provider serves a location
   */
  async providerServesLocation(
    providerId: string,
    customerLocation: Coordinates,
    options: {
      serviceRadius?: number; // km
    } = {}
  ): Promise<{
    servesLocation: boolean;
    distance: number;
    estimatedTravelTime: number;
    reason?: string;
  }> {
    const profile = await ProviderProfile.findOne({ userId: providerId });

    if (!profile) {
      return {
        servesLocation: false,
        distance: 0,
        estimatedTravelTime: 0,
        reason: 'Provider not found',
      };
    }

    // Mobile providers serve anywhere
    if (profile.locationInfo?.mobileService) {
      return {
        servesLocation: true,
        distance: 0,
        estimatedTravelTime: 0,
      };
    }

    // Get provider coordinates
    const coords = profile.locationInfo?.primaryAddress?.coordinates;
    let providerLat = 0,
      providerLng = 0;

    if (coords?.coordinates && Array.isArray(coords.coordinates)) {
      providerLng = coords.coordinates[0];
      providerLat = coords.coordinates[1];
    }

    const distance = this.calculateDistance(customerLocation, { lat: providerLat, lng: providerLng });

    // Get service radius
    const serviceRadius = options.serviceRadius || profile.businessInfo?.serviceRadius || 50;

    if (distance > serviceRadius) {
      return {
        servesLocation: false,
        distance: Math.round(distance * 10) / 10,
        estimatedTravelTime: Math.ceil((distance / 30) * 60), // 30 km/h average
        reason: `Provider does not service this area (${Math.round(distance)}km away, max ${serviceRadius}km)`,
      };
    }

    return {
      servesLocation: true,
      distance: Math.round(distance * 10) / 10,
      estimatedTravelTime: Math.ceil((distance / 30) * 60),
    };
  }

  /**
   * Get provider's service area
   */
  async getProviderServiceArea(providerId: string): Promise<ServiceArea | null> {
    const profile = await ProviderProfile.findOne({ userId: providerId });

    if (!profile) {
      return null;
    }

    // Get center coordinates
    const coords = profile.locationInfo?.primaryAddress?.coordinates;
    let centerLat = 0,
      centerLng = 0;

    if (coords?.coordinates && Array.isArray(coords.coordinates)) {
      centerLng = coords.coordinates[0];
      centerLat = coords.coordinates[1];
    }

    const radius = profile.businessInfo?.serviceRadius || 50;

    // Count customers in area (simplified estimation)
    const customersInArea = await Booking.aggregate([
      {
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [centerLng, centerLat],
          },
          distanceField: 'distance',
          maxDistance: radius * 1000,
          spherical: true,
        },
      },
      {
        $group: {
          _id: '$customerId',
        },
      },
    ]);

    return {
      providerId,
      center: { lat: centerLat, lng: centerLng },
      radius,
      coveredAreas: [], // Could be populated with reverse geocoding
      estimatedCustomers: customersInArea.length,
    };
  }

  // ============================================
  // Location-based Search
  // ============================================

  /**
   * Search services by text and location
   */
  async searchServicesByLocation(
    query: string,
    coordinates: Coordinates,
    options: {
      radius?: number;
      categoryId?: string;
      limit?: number;
    } = {}
  ): Promise<NearbyService[]> {
    const { radius = 50, categoryId, limit = 20 } = options;

    // First, text search
    const textSearch = await Service.find({
      $text: { $search: query },
      isActive: true,
      ...(categoryId && { category: new Types.ObjectId(categoryId) }),
    })
      .select('_id provider title pricing category images')
      .limit(100);

    if (textSearch.length === 0) {
      return [];
    }

    // Get provider locations
    const providerIds = textSearch.map((s) => s.provider);
    const profiles = await ProviderProfile.find({
      userId: { $in: providerIds },
    }).select('userId locationInfo rating');

    const providerMap = new Map<string, any>();
    profiles.forEach((p: any) => {
      providerMap.set(p.userId.toString(), p);
    });

    // Filter by distance and transform
    const results: NearbyService[] = [];

    for (const service of textSearch) {
      const profile = providerMap.get(service.provider?.toString());
      if (!profile) continue;

      const coords = profile.locationInfo?.primaryAddress?.coordinates;
      let lat = 0,
        lng = 0;

      if (coords?.coordinates && Array.isArray(coords.coordinates)) {
        lng = coords.coordinates[0];
        lat = coords.coordinates[1];
      } else if (coords?.lat !== undefined) {
        lat = coords.lat;
        lng = coords.lng;
      }

      const distance = this.calculateDistance(coordinates, { lat, lng });

      if (distance <= radius) {
        results.push({
          serviceId: service._id.toString(),
          serviceName: service.name,
          providerId: service.providerId?.toString() || '',
          providerName: '',
          providerRating: profile.rating?.average || 0,
          providerReviewCount: profile.rating?.count || 0,
          price: service.price?.amount || 0,
          currency: service.price?.currency || 'AED',
          distance: Math.round(distance * 10) / 10,
          coordinates: { lat, lng },
          images: service.images,
        });
      }

      if (results.length >= limit) break;
    }

    // Sort by distance
    return results.sort((a, b) => a.distance - b.distance);
  }

  // ============================================
  // Address Geocoding (Stubs)
  // ============================================

  /**
   * Geocode address to coordinates (stub - requires external API)
   */
  async geocodeAddress(address: string): Promise<Coordinates | null> {
    logger.warn('Geocoding not implemented - requires Google Maps API key');
    // In production, integrate with Google Maps Geocoding API
    // or similar service
    return null;
  }

  /**
   * Reverse geocode coordinates to address (stub - requires external API)
   */
  async reverseGeocode(coordinates: Coordinates): Promise<string | null> {
    logger.warn('Reverse geocoding not implemented - requires Google Maps API key');
    // In production, integrate with Google Maps Geocoding API
    // or similar service
    return null;
  }

  /**
   * Get coordinates from various formats
   */
  extractCoordinates(input: any): Coordinates | null {
    if (!input) return null;

    // GeoJSON format
    if (input.coordinates && Array.isArray(input.coordinates)) {
      return {
        lng: input.coordinates[0],
        lat: input.coordinates[1],
      };
    }

    // Direct lat/lng
    if (typeof input.lat === 'number' && typeof input.lng === 'number') {
      return {
        lat: input.lat,
        lng: input.lng,
      };
    }

    // latitude/longitude format
    if (typeof input.latitude === 'number' && typeof input.longitude === 'number') {
      return {
        lat: input.latitude,
        lng: input.longitude,
      };
    }

    return null;
  }
}

// Export singleton instance
export const geolocationService = new GeolocationService();
export default geolocationService;
