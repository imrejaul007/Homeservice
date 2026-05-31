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
    const response = await api.get('/geo/nearby/services', {
      params: { lat, lng, radius, ...options },
    });
    return response.data.data;
  },

  /**
   * Get nearby providers within a radius
   * @param lat - Latitude
   * @param lng - Longitude
   * @param radius - Search radius in km (default: 10)
   * @param options - Additional filter options
   */
  getNearbyProviders: async (lat, lng, radius = 10, options = {}) => {
    const response = await api.get('/geo/nearby/providers', {
      params: { lat, lng, radius, ...options },
    });
    return response.data.data;
  },

  /**
   * Search by location with multiple filters
   * @param filters - Location search filters including coordinates and optional filters
   */
  searchByLocation: async (filters: LocationSearchFilters) => {
    const response = await api.post('/geo/search', filters);
    return response.data.data;
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
    const response = await api.get('/geo/reverse', { params: { lat, lng } });
    return response.data.data;
  },

  /**
   * Forward geocode address to coordinates
   * @param address - Address string to geocode
   */
  geocode: async (address: string) => {
    const response = await api.get('/geo/geocode', { params: { address } });
    return response.data.data;
  },

  /**
   * Get user's saved locations
   */
  getSavedLocations: async () => {
    const response = await api.get('/geo/locations');
    return response.data.data;
  },

  /**
   * Save a new location
   * @param data - Location data including name, type, and address
   */
  saveLocation: async (data) => {
    const response = await api.post('/geo/locations', data);
    return response.data.data;
  },

  /**
   * Update a saved location
   * @param id - Location ID
   * @param data - Fields to update
   */
  updateSavedLocation: async (id: string, data) => {
    const response = await api.patch(`/geo/locations/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete a saved location
   * @param id - Location ID to delete
   */
  deleteSavedLocation: async (id: string) => {
    const response = await api.delete(`/geo/locations/${id}`);
    return response.data;
  },

  /**
   * Get location search statistics
   */
  getLocationStats: async () => {
    const response = await api.get('/geo/stats');
    return response.data.data;
  },

  /**
   * Calculate distance between two coordinates
   * @param from - Starting coordinates
   * @param to - Ending coordinates
   * @param unit - Distance unit (km or mi)
   */
  calculateDistance: async (
    from: Coordinates,
    to: Coordinates,
    unit: 'km' | 'mi' = 'km'
  ) => {
    const response = await api.post('/geo/distance', { from, to, unit });
    return response.data.data;
  },

  /**
   * Get estimated arrival time for a service
   * @param serviceId - Service ID
   * @param destination - Destination coordinates
   */
  getEstimatedArrival: async (serviceId: string, destination: Coordinates) => {
    const response = await api.get(`/geo/services/${serviceId}/arrival`, {
      params: destination,
    });
    return response.data.data;
  },

  /**
   * Set a location as the default
   * @param id - Location ID
   */
  setDefaultLocation: async (id: string) => {
    const response = await api.post(`/geo/locations/${id}/default`);
    return response.data.data;
  },
};

export default geolocationApi;
