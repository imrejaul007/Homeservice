import { api } from './api';
import type { LocationCoordinates, GeocodeResponse, UserLocation, SupportedCity } from '@/types/location.types';

export const SUPPORTED_CITIES: SupportedCity[] = [
  { id: 'dubai', name: 'Dubai', coordinates: { latitude: 25.2048, longitude: 55.2708 }, state: 'Dubai', country: 'UAE' },
  { id: 'abu-dhabi', name: 'Abu Dhabi', coordinates: { latitude: 24.4539, longitude: 54.3773 }, state: 'Abu Dhabi', country: 'UAE' },
  { id: 'sharjah', name: 'Sharjah', coordinates: { latitude: 25.3463, longitude: 55.4209 }, state: 'Sharjah', country: 'UAE' },
  { id: 'ajman', name: 'Ajman', coordinates: { latitude: 25.3488, longitude: 55.4209 }, state: 'Ajman', country: 'UAE' },
  { id: 'riyadh', name: 'Riyadh', coordinates: { latitude: 24.7136, longitude: 46.6753 }, state: 'Riyadh', country: 'Saudi Arabia' },
  { id: 'jeddah', name: 'Jeddah', coordinates: { latitude: 21.4858, longitude: 39.1925 }, state: 'Makkah', country: 'Saudi Arabia' },
];

const DEFAULT_CITY = SUPPORTED_CITIES[0];

class WebLocationService {
  async checkPermissionStatus(): Promise<'granted' | 'denied' | 'prompt' | 'undetermined'> {
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
      const position = await this.getBrowserLocation();
      const coords: LocationCoordinates = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
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

  getCachedLocation(): UserLocation | null {
    try {
      const cached = localStorage.getItem('homeservice_location');
      if (cached) {
        const location = JSON.parse(cached);
        location.lastUpdated = new Date(location.lastUpdated);
        return location;
      }
    } catch {
      // Ignore
    }
    return null;
  }

  cacheLocation(location: UserLocation): void {
    try {
      localStorage.setItem('homeservice_location', JSON.stringify(location));
    } catch {
      // Ignore
    }
  }

  getDefaultCity(): SupportedCity {
    return DEFAULT_CITY;
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
}

export const locationService = new WebLocationService();
export default locationService;
