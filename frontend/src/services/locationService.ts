import { api } from './api';
import { Capacitor } from '@capacitor/core';
import { Geolocation, type Position } from '@capacitor/geolocation';
import { Preferences } from '@capacitor/preferences';
import type { LocationCoordinates, GeocodeResponse, UserLocation, SupportedCity } from '@/types/location.types';

export const SUPPORTED_CITIES: SupportedCity[] = [
  { id: 'dubai', name: 'Dubai', coordinates: { latitude: 25.2048, longitude: 55.2708 }, state: 'Dubai', country: 'UAE' },
  { id: 'abu-dhabi', name: 'Abu Dhabi', coordinates: { latitude: 24.4539, longitude: 54.3773 }, state: 'Abu Dhabi', country: 'UAE' },
  { id: 'sharjah', name: 'Sharjah', coordinates: { latitude: 25.3463, longitude: 55.4209 }, state: 'Sharjah', country: 'UAE' },
  { id: 'ajman', name: 'Ajman', coordinates: { latitude: 25.3488, longitude: 55.4209 }, state: 'Ajman', country: 'UAE' },
  { id: 'riyadh', name: 'Riyadh', coordinates: { latitude: 24.7136, longitude: 46.6753 }, state: 'Riyadh', country: 'Saudi Arabia' },
  { id: 'jeddah', name: 'Jeddah', coordinates: { latitude: 21.4858, longitude: 39.1925 }, state: 'Makkah', country: 'Saudi Arabia' },
  { id: 'mumbai', name: 'Mumbai', coordinates: { latitude: 19.0760, longitude: 72.8777 }, state: 'Maharashtra', country: 'India' },
  { id: 'delhi', name: 'Delhi', coordinates: { latitude: 28.7041, longitude: 77.1025 }, state: 'Delhi', country: 'India' },
  { id: 'bangalore', name: 'Bangalore', coordinates: { latitude: 12.9716, longitude: 77.5946 }, state: 'Karnataka', country: 'India' },
  { id: 'hyderabad', name: 'Hyderabad', coordinates: { latitude: 17.3850, longitude: 78.4867 }, state: 'Telangana', country: 'India' },
  { id: 'chennai', name: 'Chennai', coordinates: { latitude: 13.0827, longitude: 80.2707 }, state: 'Tamil Nadu', country: 'India' },
];

const DEFAULT_CITY = SUPPORTED_CITIES[0];

const GEOCODED_CITY_ALIASES: Record<string, string> = {
  bengaluru: 'bangalore',
  'bengaluru urban': 'bangalore',
  bombay: 'mumbai',
  madras: 'chennai',
  'new delhi': 'delhi',
};

class WebLocationService {
  private isNative: boolean;

  constructor() {
    this.isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();
  }

  async checkPermissionStatus(): Promise<'granted' | 'denied' | 'prompt' | 'undetermined'> {
    // Use Capacitor geolocation on native
    if (this.isNative) {
      try {
        const permission = await Geolocation.checkPermissions();
        if (permission.location === 'granted') return 'granted';
        if (permission.location === 'denied') return 'denied';
        return 'prompt';
      } catch {
        return 'undetermined';
      }
    }

    // Browser fallback
    if (!navigator.geolocation) {
      return 'undetermined';
    }

    if (!navigator.permissions) {
      return 'undetermined';
    }

    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      return permission.state as 'granted' | 'denied' | 'prompt';
    } catch {
      return 'undetermined';
    }
  }

  async requestLocationPermission(): Promise<boolean> {
    // Use Capacitor geolocation on native
    if (this.isNative) {
      try {
        const permission = await Geolocation.requestPermissions();
        return permission.location === 'granted';
      } catch {
        return false;
      }
    }

    // Browser fallback
    if (!navigator.geolocation) {
      return false;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { timeout: 10000, maximumAge: 0 }
      );
    });
  }

  private async getNativeLocation(): Promise<Position> {
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== 'granted') {
      const requested = await Geolocation.requestPermissions();
      if (requested.location !== 'granted') {
        throw new Error('Location permission denied');
      }
    }

    return await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 15000,
    });
  }

  private getBrowserLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000,
        }
      );
    });
  }

  private async getLocation(): Promise<GeolocationPosition | Position> {
    if (this.isNative) {
      return await this.getNativeLocation();
    }
    return await this.getBrowserLocation();
  }

  private async reverseGeocode(lat: number, lng: number): Promise<GeocodeResponse> {
    try {
      const response = await api.post<GeocodeResponse>('/location/geocode', {
        latitude: lat,
        longitude: lng,
      });
      return response.data;
    } catch {
      return this.fallbackGeocode(lat, lng);
    }
  }

  private fallbackGeocode(lat: number, lng: number): GeocodeResponse {
    const distances = SUPPORTED_CITIES.map((city) => ({
      city,
      distance: this.calculateDistance(lat, lng, city.coordinates.latitude, city.coordinates.longitude),
    }));

    const nearest = distances.reduce((min, d) => (d.distance < min.distance ? d : min));
    const selectedCity = nearest.distance < 100 ? nearest.city : DEFAULT_CITY;

    return {
      formattedAddress: `${selectedCity.name}, ${selectedCity.state}, ${selectedCity.country}`,
      city: selectedCity.name,
      state: selectedCity.state,
      country: selectedCity.country,
    };
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }

  async getCurrentLocation(): Promise<UserLocation | null> {
    try {
      const position = await this.getLocation();

      // Handle both browser and native position formats
      const pos = position as { coords: { latitude: number; longitude: number } };
      const coords: LocationCoordinates = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };

      const address = await this.reverseGeocode(coords.latitude, coords.longitude);

      const userLocation: UserLocation = {
        coordinates: coords,
        address: {
          address: address.formattedAddress,
          city: address.city,
          state: address.state,
          country: address.country,
          postalCode: address.postalCode || '',
          formattedAddress: address.formattedAddress,
        },
        lastUpdated: new Date(),
        source: 'gps',
      };

      return userLocation;
    } catch (error) {
      console.error('Failed to get location:', error);
      return null;
    }
  }

  async getCachedLocation(): Promise<UserLocation | null> {
    try {
      if (this.isNative) {
        const cached = await Preferences.get({ key: 'homeservice_location' });
        if (cached.value) {
          const location = JSON.parse(cached.value) as UserLocation;
          location.lastUpdated = new Date(location.lastUpdated);
          return location;
        }
        return null;
      } else {
        // Browser fallback
        if (typeof window !== 'undefined' && window.localStorage) {
          const cached = localStorage.getItem('homeservice_location');
          if (cached) {
            const location = JSON.parse(cached);
            location.lastUpdated = new Date(location.lastUpdated);
            return location;
          }
        }
        return null;
      }
    } catch {
      return null;
    }
  }

  async cacheLocation(location: UserLocation): Promise<void> {
    try {
      const serialized = JSON.stringify(location);
      if (this.isNative) {
        await Preferences.set({ key: 'homeservice_location', value: serialized });
      } else {
        // Browser fallback
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('homeservice_location', serialized);
        }
      }
    } catch {
      // Ignore
    }
  }

  getDefaultCity(): SupportedCity {
    return DEFAULT_CITY;
  }

  /** Match a geocoded city name to a supported city (e.g. Bengaluru → Bangalore) */
  findSupportedCityByGeocode(cityName: string, country?: string): SupportedCity | null {
    const normalized = cityName.toLowerCase().trim();
    const aliasId = GEOCODED_CITY_ALIASES[normalized];

    if (aliasId) {
      const byAlias = SUPPORTED_CITIES.find((city) => city.id === aliasId);
      if (byAlias) return byAlias;
    }

    const byName = SUPPORTED_CITIES.find(
      (city) =>
        city.name.toLowerCase() === normalized ||
        city.id === normalized.replace(/\s+/g, '-')
    );
    if (byName) return byName;

    if (country) {
      const normalizedCountry = country.toLowerCase().trim();
      const byCountry = SUPPORTED_CITIES.find(
        (city) => city.country.toLowerCase() === normalizedCountry
      );
      if (byCountry) return byCountry;
    }

    return null;
  }

  getDefaultLocation(): UserLocation {
    return {
      coordinates: DEFAULT_CITY.coordinates,
      address: {
        address: DEFAULT_CITY.name,
        city: DEFAULT_CITY.name,
        state: DEFAULT_CITY.state,
        country: DEFAULT_CITY.country,
        formattedAddress: `${DEFAULT_CITY.name}, ${DEFAULT_CITY.state}, ${DEFAULT_CITY.country}`,
      },
      lastUpdated: new Date(),
      source: 'manual',
    };
  }

  /**
   * Geocode an address string to latitude/longitude coordinates
   * Uses Nominatim (OpenStreetMap) free geocoding API
   */
  async geocodeAddress(address: string): Promise<LocationCoordinates | null> {
    try {
      if (!address || address.trim().length === 0) {
        return null;
      }

      const encodedAddress = encodeURIComponent(address.trim());
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NILIN-Homeservice/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('Geocoding API error:', response.status);
        return null;
      }

      const data = await response.json();

      if (data && data.length > 0) {
        const result = data[0];
        return {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
        };
      }

      console.warn('No geocoding results found for:', address);
      return null;
    } catch (error) {
      console.error('Geocoding failed:', error);
      return null;
    }
  }

  /**
   * Reverse geocode coordinates to a human-readable address
   * Uses Nominatim (OpenStreetMap) free reverse geocoding API
   */
  async reverseGeocodeCoordinates(lat: number, lng: number): Promise<GeocodeResponse | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'NILIN-Homeservice/1.0',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn('Reverse geocoding API error:', response.status);
        return null;
      }

      const data = await response.json();

      if (data && data.address) {
        const addr = data.address;
        const city = addr.city || addr.town || addr.village || addr.suburb || addr.locality || '';

        return {
          formattedAddress: data.display_name || `${city}, ${addr.country}`,
          city: city,
          state: addr.state || '',
          country: addr.country || '',
          postalCode: addr.postcode || '',
        };
      }

      return null;
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return null;
    }
  }

  /**
   * Get coordinates for a city name
   * Returns predefined coordinates for supported cities
   */
  getCityCoordinates(cityName: string): LocationCoordinates | null {
    const normalizedCity = cityName.toLowerCase().trim();

    const cityCoords: Record<string, LocationCoordinates> = {
      'dubai': { latitude: 25.2048, longitude: 55.2708 },
      'abu dhabi': { latitude: 24.4539, longitude: 54.3773 },
      'abu-dhabi': { latitude: 24.4539, longitude: 54.3773 },
      'sharjah': { latitude: 25.3463, longitude: 55.4209 },
      'ajman': { latitude: 25.3488, longitude: 55.4209 },
      'riyadh': { latitude: 24.7136, longitude: 46.6753 },
      'jeddah': { latitude: 21.4858, longitude: 39.1925 },
      'mumbai': { latitude: 19.0760, longitude: 72.8777 },
      'delhi': { latitude: 28.7041, longitude: 77.1025 },
      'bangalore': { latitude: 12.9716, longitude: 77.5946 },
      'hyderabad': { latitude: 17.3850, longitude: 78.4867 },
      'chennai': { latitude: 13.0827, longitude: 80.2707 },
    };

    return cityCoords[normalizedCity] || null;
  }

  /**
   * Calculate distance between two coordinates in kilometers
   * Uses Haversine formula
   */
  calculateDistanceFromCoords(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const locationService = new WebLocationService();
export default locationService;
