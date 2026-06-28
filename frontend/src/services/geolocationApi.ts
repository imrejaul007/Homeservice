import { api } from './api';

// ============================================
// Geolocation Types
// ============================================

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  coordinates: Coordinates;
  formattedAddress?: string;
}

export interface NearbyService {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  priceUnit: string;
  images: string[];
  thumbnail?: string;
  categoryId: string;
  categoryName: string;
  providerId: string;
  providerName: string;
  providerAvatar?: string;
  rating: number;
  reviewCount: number;
  distance: number;
  coordinates: Coordinates;
  isAvailable: boolean;
  estimatedArrival?: number;
}

export interface NearbyProvider {
  id: string;
  name: string;
  avatar?: string;
  bio?: string;
  services: string[];
  categories: string[];
  rating: number;
  reviewCount: number;
  totalBookings: number;
  distance: number;
  coordinates: Coordinates;
  isVerified: boolean;
  isOnline: boolean;
  responseTime?: number;
}

export interface LocationSearchFilters {
  lat: number;
  lng: number;
  radius?: number;
  categoryId?: string;
  serviceId?: string;
  minRating?: number;
  maxPrice?: number;
  minPrice?: number;
  availability?: {
    date: string;
    startTime?: string;
    endTime?: string;
  };
  sortBy?: 'distance' | 'rating' | 'price' | 'popularity';
  sortOrder?: 'asc' | 'desc';
}

export interface LocationSearchResult {
  services: NearbyService[];
  providers: NearbyProvider[];
  totalServices: number;
  totalProviders: number;
  bounds: {
    northEast: Coordinates;
    southWest: Coordinates;
  };
  center: Coordinates;
  radius: number;
}

export interface SavedLocation {
  id: string;
  name: string;
  type: 'home' | 'work' | 'other';
  address: Address;
  isDefault: boolean;
  instructions?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocationStats {
  totalSearches: number;
  popularAreas: Array<{
    name: string;
    coordinates: Coordinates;
    searchCount: number;
  }>;
  averageSearchRadius: number;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    searchCount: number;
  }>;
}

// ============================================
// Geolocation API Service
// ============================================

export interface GeolocationApi {
  /**
   * Get nearby services within a radius
   */
  getNearbyServices: (
    lat: number,
    lng: number,
    radius?: number,
    options?: {
      categoryId?: string;
      minRating?: number;
      maxPrice?: number;
      limit?: number;
    }
  ) => Promise<{
    services: NearbyService[];
    total: number;
    center: Coordinates;
    radius: number;
  }>;

  /**
   * Get nearby providers within a radius
   */
  getNearbyProviders: (
    lat: number,
    lng: number,
    radius?: number,
    options?: {
      categoryId?: string;
      minRating?: number;
      online?: boolean;
      limit?: number;
    }
  ) => Promise<{
    providers: NearbyProvider[];
    total: number;
    center: Coordinates;
    radius: number;
  }>;

  /**
   * Search by location with multiple filters
   */
  searchByLocation: (filters: LocationSearchFilters) => Promise<LocationSearchResult>;

  /**
   * Get current user location (requires permission)
   */
  getCurrentLocation: () => Promise<Coordinates>;

  /**
   * Reverse geocode coordinates to address
   */
  reverseGeocode: (lat: number, lng: number) => Promise<Address>;

  /**
   * Forward geocode address to coordinates
   */
  geocode: (address: string) => Promise<Address & { confidence: number }>;

  /**
   * Get user's saved locations
   */
  getSavedLocations: () => Promise<SavedLocation[]>;

  /**
   * Save a location
   */
  saveLocation: (data: {
    name: string;
    type: SavedLocation['type'];
    address: Omit<Address, 'coordinates'> & { lat: number; lng: number };
    instructions?: string;
    isDefault?: boolean;
  }) => Promise<SavedLocation>;

  /**
   * Update a saved location
   */
  updateSavedLocation: (
    id: string,
    data: Partial<{
      name: string;
      type: SavedLocation['type'];
      instructions: string;
      isDefault: boolean;
    }>
  ) => Promise<SavedLocation>;

  /**
   * Delete a saved location
   */
  deleteSavedLocation: (id: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Get location statistics
   */
  getLocationStats: () => Promise<LocationStats>;

  /**
   * Calculate distance between two points
   */
  calculateDistance: (
    from: Coordinates,
    to: Coordinates,
    unit?: 'km' | 'mi'
  ) => Promise<{
    distance: number;
    unit: 'km' | 'mi';
    duration?: number;
    durationUnit?: string;
  }>;

  /**
   * Get estimated arrival time for a service
   */
  getEstimatedArrival: (
    serviceId: string,
    destination: Coordinates
  ) => Promise<{
    arrivalTime: number;
    arrivalMinutes: number;
    distance: number;
    unit: string;
  }>;

  /**
   * Set default saved location
   */
  setDefaultLocation: (id: string) => Promise<{
    success: boolean;
    defaultLocation: SavedLocation;
  }>;
}

export const geolocationApi: GeolocationApi = {
  /**
   * Get nearby services within a radius
   * @param lat - Latitude
   * @param lng - Longitude
   * @param radius - Search radius in km (default: 10)
   * @param options - Additional filter options
   */
  getNearbyServices: async (lat, lng, radius = 10, options = {}) => {
    const response = await api.get('/nearby/services', {
      params: { lat, lng, radius, ...options },
    });
    const data = response.data.data;
    const metadata = data?.metadata;
    return {
      services: data?.services || [],
      total: metadata?.pagination?.total ?? data?.services?.length ?? 0,
      center: metadata?.location || { lat, lng },
      radius: metadata?.radius ?? radius,
    };
  },

  /**
   * Get nearby providers within a radius
   * @param lat - Latitude
   * @param lng - Longitude
   * @param radius - Search radius in km (default: 10)
   * @param options - Additional filter options
   */
  getNearbyProviders: async (lat, lng, radius = 10, options = {}) => {
    const { online, ...rest } = options as { online?: boolean; categoryId?: string; minRating?: number; limit?: number };
    const response = await api.get('/nearby/providers', {
      params: {
        lat,
        lng,
        radius,
        availableOnly: online,
        ...rest,
      },
    });
    const data = response.data.data;
    const metadata = data?.metadata;
    return {
      providers: data?.providers || [],
      total: metadata?.pagination?.total ?? data?.providers?.length ?? 0,
      center: metadata?.location || { lat, lng },
      radius: metadata?.radius ?? radius,
    };
  },

  /**
   * Search by location with multiple filters
   * @param filters - Location search filters including coordinates and optional filters
   */
  searchByLocation: async (filters: LocationSearchFilters) => {
    const { lat, lng, radius = 10, categoryId, minRating, maxPrice, minPrice, sortBy, limit = 20 } = filters;
    const priceRange = minPrice != null && maxPrice != null ? `${minPrice}-${maxPrice}` : undefined;

    const [servicesRes, providersRes] = await Promise.all([
      api.get('/nearby/services', {
        params: { lat, lng, radius, categoryId, minRating, priceRange, limit },
      }),
      api.get('/nearby/providers', {
        params: { lat, lng, radius, categoryId, minRating, limit },
      }),
    ]);

    const services = servicesRes.data.data?.services || [];
    const providers = providersRes.data.data?.providers || [];

    return {
      services,
      providers,
      totalServices: services.length,
      totalProviders: providers.length,
      bounds: {
        northEast: { lat: lat + 0.05, lng: lng + 0.05 },
        southWest: { lat: lat - 0.05, lng: lng - 0.05 },
      },
      center: { lat, lng },
      radius,
      sortBy,
    } as LocationSearchResult;
  },

  /**
   * Get current user location using browser Geolocation API
   */
  getCurrentLocation: () => {
    return new Promise<Coordinates>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(new Error(error.message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  },

  /**
   * Reverse geocode coordinates to address
   * @param lat - Latitude
   * @param lng - Longitude
   */
  reverseGeocode: async (lat: number, lng: number) => {
    const response = await api.post('/location/geocode', { latitude: lat, longitude: lng });
    const data = response.data;
    return {
      street: '',
      city: data.city || 'Unknown',
      state: data.state || '',
      postalCode: data.postalCode || '',
      country: data.country || '',
      coordinates: { lat, lng },
      formattedAddress: data.formattedAddress,
    };
  },

  geocode: async (address: string) => {
    const response = await api.get('/location/search', { params: { q: address, limit: 1 } });
    const result = response.data.results?.[0];
    if (!result) {
      throw new Error('Address not found');
    }
    return {
      street: result.street || '',
      city: result.city || '',
      state: result.state || '',
      postalCode: result.zipCode || '',
      country: result.country || '',
      coordinates: { lat: result.lat, lng: result.lng },
      formattedAddress: result.formattedAddress || result.label,
      confidence: 1,
    };
  },

  getSavedLocations: async () => {
    const response = await api.get('/customers/addresses', { params: { limit: 50 } });
    const addresses = response.data.data?.addresses || [];
    return addresses.map((addr: any) => ({
      id: addr._id,
      name: addr.label,
      type: (addr.type || 'other') as SavedLocation['type'],
      address: {
        street: addr.street,
        city: addr.city,
        state: addr.state || '',
        postalCode: addr.zipCode || '',
        country: addr.country || '',
        coordinates: addr.coordinates || { lat: 0, lng: 0 },
        formattedAddress: `${addr.street}, ${addr.city}`,
      },
      isDefault: Boolean(addr.isDefault),
      instructions: addr.instructions,
      createdAt: addr.createdAt,
      updatedAt: addr.updatedAt,
    }));
  },

  saveLocation: async (data) => {
    const response = await api.post('/customers/addresses', {
      label: data.name,
      street: data.address.street,
      city: data.address.city,
      state: data.address.state,
      country: data.address.country,
      zipCode: data.address.postalCode,
      coordinates: { lat: data.address.lat, lng: data.address.lng },
      isDefault: data.isDefault,
    });
    const addr = response.data.data;
    return {
      id: addr._id,
      name: addr.label,
      type: data.type,
      address: {
        street: addr.street,
        city: addr.city,
        state: addr.state || '',
        postalCode: addr.zipCode || '',
        country: addr.country || '',
        coordinates: addr.coordinates,
      },
      isDefault: Boolean(addr.isDefault),
      instructions: data.instructions,
      createdAt: addr.createdAt,
      updatedAt: addr.updatedAt,
    };
  },

  updateSavedLocation: async (id: string, data) => {
    const response = await api.patch(`/customers/addresses/${id}`, {
      label: data.name,
      isDefault: data.isDefault,
    });
    const addr = response.data.data;
    return {
      id: addr._id,
      name: addr.label,
      type: (data.type || 'other') as SavedLocation['type'],
      address: {
        street: addr.street,
        city: addr.city,
        state: addr.state || '',
        postalCode: addr.zipCode || '',
        country: addr.country || '',
        coordinates: addr.coordinates,
      },
      isDefault: Boolean(addr.isDefault),
      instructions: data.instructions,
      createdAt: addr.createdAt,
      updatedAt: addr.updatedAt,
    };
  },

  deleteSavedLocation: async (id: string) => {
    const response = await api.delete(`/customers/addresses/${id}`);
    return response.data;
  },

  getLocationStats: async () => {
    return {
      totalSearches: 0,
      popularAreas: [],
      averageSearchRadius: 10,
      topCategories: [],
    };
  },

  calculateDistance: async (from, to, unit = 'km') => {
    const R = unit === 'mi' ? 3958.8 : 6371;
    const dLat = ((to.lat - from.lat) * Math.PI) / 180;
    const dLng = ((to.lng - from.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((from.lat * Math.PI) / 180) *
        Math.cos((to.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return { distance: Math.round(distance * 100) / 100, unit };
  },

  getEstimatedArrival: async (_serviceId: string, destination: Coordinates) => {
    return {
      arrivalTime: Date.now() + 30 * 60 * 1000,
      arrivalMinutes: 30,
      distance: 5,
      unit: 'km',
      destination,
    };
  },

  setDefaultLocation: async (id: string) => {
    const response = await api.patch(`/customers/addresses/${id}`, { isDefault: true });
    const addr = response.data.data;
    return {
      success: true,
      defaultLocation: {
        id: addr._id,
        name: addr.label,
        type: 'other' as const,
        address: {
          street: addr.street,
          city: addr.city,
          state: addr.state || '',
          postalCode: addr.zipCode || '',
          country: addr.country || '',
          coordinates: addr.coordinates,
        },
        isDefault: true,
        createdAt: addr.createdAt,
        updatedAt: addr.updatedAt,
      },
    };
  },
};

export default geolocationApi;
