import mongoose from 'mongoose';
import { Client } from '@googlemaps/google-maps-services-js';
import axios from 'axios';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';
import { getOrSet } from './cache.service';
import { CACHE_KEYS } from './cache.service';

// Initialize Google Maps client
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY;
const OPENCAGE_BASE_URL = 'https://api.opencagedata.com/geocode/v1/json';
const googleMapsClient = new Client({});

interface Coordinates {
  lat: number;
  lng: number;
}

interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

interface NearbyProvider {
  providerId: string;
  userId: string;
  name: string;
  distance: number; // in kilometers
  rating: number;
  services: number;
}

interface GeoSearchOptions {
  coordinates: Coordinates;
  maxDistance?: number; // in meters
  category?: string;
  minRating?: number;
  limit?: number;
}

// Calculate distance between two points using Haversine formula
export const calculateDistance = (point1: Coordinates, point2: Coordinates): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.lat - point1.lat);
  const dLon = toRad(point2.lng - point1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (deg: number): number => (deg * Math.PI) / 180;

// Find nearby providers
export const findNearbyProviders = async (options: GeoSearchOptions): Promise<NearbyProvider[]> => {
  const {
    coordinates,
    maxDistance = 50000, // 50km default
    category,
    minRating,
    limit = 20,
  } = options;

  const cacheKey = `nearby:${coordinates.lat}:${coordinates.lng}:${maxDistance}:${category}:${minRating}:${limit}`;

  return getOrSet(cacheKey, async () => {
    try {
      // Get all active services with providers
      const pipeline: mongoose.PipelineStage[] = [
        {
          $match: {
            isActive: true,
            ...(category && { category: new mongoose.Types.ObjectId(category) }),
            ...(minRating && { 'rating.average': { $gte: minRating } }),
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'providerId',
            foreignField: '_id',
            as: 'providerUser',
          },
        },
        { $unwind: '$providerUser' },
        {
          $lookup: {
            from: 'providerprofiles',
            localField: 'providerId',
            foreignField: 'userId',
            as: 'profile',
          },
        },
        { $unwind: '$profile' },
        {
          $match: {
            'profile.locationInfo.mobileService': true,
          },
        },
        {
          $project: {
            providerId: 1,
            userId: '$providerUser._id',
            name: { $concat: ['$providerUser.firstName', ' ', '$providerUser.lastName'] },
            title: 1,
            'rating.average': 1,
          },
        },
        { $limit: 100 }, // Get more than needed for filtering
      ];

      const services = await Service.aggregate(pipeline);

      // Calculate distance and filter
      const providersWithDistance: NearbyProvider[] = services
        .map((s: any) => {
          // Extract coordinates from GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
          let providerLng = 0;
          let providerLat = 0;
          const geoCoords = s.profile?.locationInfo?.primaryAddress?.coordinates;
          if (geoCoords?.coordinates && Array.isArray(geoCoords.coordinates)) {
            [providerLng, providerLat] = geoCoords.coordinates;
          } else if (geoCoords?.lat !== undefined && geoCoords?.lng !== undefined) {
            // Handle legacy format (for backwards compatibility during migration)
            providerLat = geoCoords.lat;
            providerLng = geoCoords.lng;
          }

          const distance = calculateDistance(
            coordinates,
            { lat: providerLat, lng: providerLng }
          );

          return {
            providerId: s.providerId?.toString() || '',
            userId: s.userId?.toString() || '',
            name: s.name || '',
            distance,
            rating: s['rating.average'] || 0,
            services: 1,
          };
        })
        .filter((p: NearbyProvider) => p.distance * 1000 <= maxDistance) // Filter by max distance
        .sort((a: NearbyProvider, b: NearbyProvider) => a.distance - b.distance)
        .slice(0, limit);

      return providersWithDistance;
    } catch (error) {
      logger.error('Error finding nearby providers', { error, coordinates });
      return [];
    }
  }, { prefix: CACHE_KEYS.SERVICE, ttl: 300 });
};

// Check if a provider serves a location
export const providerServesLocation = async (
  providerId: string,
  customerLocation: Coordinates,
  serviceRadius: number = 50000 // Default 50km
): Promise<boolean> => {
  try {
    const provider = await ProviderProfile.findOne({ userId: providerId });

    if (!provider || !provider.locationInfo?.primaryAddress?.coordinates) {
      // If mobile service, assume they serve anywhere within radius
      return provider?.locationInfo?.mobileService || false;
    }

    // Extract coordinates from GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
    let providerLat = 0;
    let providerLng = 0;
    const geoCoords = provider.locationInfo.primaryAddress.coordinates as any;
    if (geoCoords?.coordinates && Array.isArray(geoCoords.coordinates)) {
      [providerLng, providerLat] = geoCoords.coordinates;
    } else if (geoCoords?.lat !== undefined && geoCoords?.lng !== undefined) {
      // Handle legacy format (for backwards compatibility during migration)
      providerLat = geoCoords.lat;
      providerLng = geoCoords.lng;
    }
    const distance = calculateDistance(customerLocation, { lat: providerLat, lng: providerLng });

    // Check if within service radius
    const radiusKm = provider.businessInfo?.serviceRadius || 50;
    return distance * 1000 <= serviceRadius && distance * 1000 <= radiusKm * 1000;
  } catch (error) {
    logger.error('Error checking provider service area', { error, providerId });
    return false;
  }
};

// Get provider's service coverage
export const getProviderCoverage = async (providerId: string): Promise<{
  center: Coordinates;
  radius: number; // in km
  estimatedCustomers: number;
}> => {
  try {
    const provider = await ProviderProfile.findOne({ userId: providerId });

    if (!provider || !provider.locationInfo?.primaryAddress?.coordinates) {
      throw ApiError.notFound('Provider location not found', ERROR_CODES.NOT_FOUND);
    }

    // Extract coordinates from GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
    let centerLat = 0;
    let centerLng = 0;
    const centerCoords = provider.locationInfo.primaryAddress.coordinates as any;
    if (centerCoords?.coordinates && Array.isArray(centerCoords.coordinates)) {
      [centerLng, centerLat] = centerCoords.coordinates;
    } else if (centerCoords?.lat !== undefined && centerCoords?.lng !== undefined) {
      // Handle legacy format (for backwards compatibility during migration)
      centerLat = centerCoords.lat;
      centerLng = centerCoords.lng;
    }
    const radius = provider.businessInfo?.serviceRadius || 50;

    // Estimate customers in area (simplified)
    const estimatedCustomers = Math.floor(radius * 100);

    return {
      center: { lat: centerLat, lng: centerLng },
      radius,
      estimatedCustomers,
    };
  } catch (error) {
    logger.error('Error getting provider coverage', { error, providerId });
    throw error;
  }
};

// Estimate arrival time
export const estimateArrivalTime = (
  providerLocation: Coordinates,
  customerLocation: Coordinates,
  averageSpeedKmH: number = 30
): { distance: number; durationMinutes: number } => {
  const distance = calculateDistance(providerLocation, customerLocation);
  const durationMinutes = Math.ceil((distance / averageSpeedKmH) * 60);

  return {
    distance: Math.round(distance * 10) / 10,
    durationMinutes,
  };
};

// Geocode address to coordinates
export const geocodeAddress = async (
  address: string
): Promise<Coordinates | null> => {
  try {
    // Try Google Maps first if API key is available
    if (GOOGLE_MAPS_API_KEY) {
      const response = await googleMapsClient.geocode({
        params: {
          address,
          key: GOOGLE_MAPS_API_KEY,
        },
        timeout: 8000,
      });

      if (response.data.results && response.data.results.length > 0) {
        const location = response.data.results[0].geometry.location;
        logger.debug('Geocoded address using Google Maps', { address, lat: location.lat, lng: location.lng });
        return {
          lat: location.lat,
          lng: location.lng,
        };
      }
    }

    // Fallback to OpenCage if Google Maps is not available or failed
    if (OPENCAGE_API_KEY) {
      const response = await axios.get(OPENCAGE_BASE_URL, {
        params: {
          key: OPENCAGE_API_KEY,
          q: address,
          format: 'json',
          language: 'en',
          limit: 1,
          no_annotations: 1,
        },
        timeout: 8000,
      });

      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        logger.debug('Geocoded address using OpenCage', { address, lat: result.geometry.lat, lng: result.geometry.lng });
        return {
          lat: result.geometry.lat,
          lng: result.geometry.lng,
        };
      }
    }

    logger.warn('No geocoding provider available', { address });
    return null;
  } catch (error) {
    logger.error('Geocoding error', { address, error });
    return null;
  }
};

// Reverse geocode coordinates to address
export const reverseGeocode = async (
  coordinates: Coordinates
): Promise<string | null> => {
  try {
    const { lat, lng } = coordinates;

    // Try Google Maps first if API key is available
    if (GOOGLE_MAPS_API_KEY) {
      const response = await googleMapsClient.reverseGeocode({
        params: {
          latlng: { lat, lng },
          key: GOOGLE_MAPS_API_KEY,
        },
        timeout: 8000,
      });

      if (response.data.results && response.data.results.length > 0) {
        // Get the most specific formatted address
        const result = response.data.results[0];
        logger.debug('Reverse geocoded using Google Maps', { lat, lng, address: result.formatted_address });
        return result.formatted_address;
      }
    }

    // Fallback to OpenCage if Google Maps is not available or failed
    if (OPENCAGE_API_KEY) {
      const response = await axios.get(OPENCAGE_BASE_URL, {
        params: {
          key: OPENCAGE_API_KEY,
          q: `${lat},${lng}`,
          format: 'json',
          language: 'en',
          limit: 1,
          no_annotations: 1,
        },
        timeout: 8000,
      });

      if (response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
        logger.debug('Reverse geocoded using OpenCage', { lat, lng, address: result.formatted });
        return result.formatted;
      }
    }

    logger.warn('No reverse geocoding provider available', { lat, lng });
    return null;
  } catch (error) {
    logger.error('Reverse geocoding error', { coordinates, error });
    return null;
  }
};

export default {
  calculateDistance,
  findNearbyProviders,
  providerServesLocation,
  getProviderCoverage,
  estimateArrivalTime,
  geocodeAddress,
  reverseGeocode,
};
