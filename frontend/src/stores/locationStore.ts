import { create } from 'zustand';
import { useEffect } from 'react';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { capacitorStorageAdapter } from '../lib/storageAdapters';
import { locationService, FALLBACK_SUPPORTED_CITIES } from '@/services/locationService';
import type { UserLocation, SupportedCity, LocationState } from '@/types/location.types';

interface LocationStoreState extends LocationState {
  supportedCities: SupportedCity[];
  citiesLoaded: boolean;
  loadSupportedCities: () => Promise<SupportedCity[]>;
  requestLocationPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<UserLocation | null>;
  setSelectedCity: (city: SupportedCity) => void;
  clearError: () => void;
}

type StoreSet = (
  partial: Partial<LocationStoreState> | ((s: LocationStoreState) => Partial<LocationStoreState>),
  replace?: boolean
) => void;
type StoreGet = () => LocationStoreState;

const initialState: LocationState & { supportedCities: SupportedCity[]; citiesLoaded: boolean } = {
  currentLocation: null,
  selectedCity: null,
  isLoading: false,
  error: null,
  permissionStatus: 'undetermined',
  supportedCities: FALLBACK_SUPPORTED_CITIES,
  citiesLoaded: false,
};

export const useLocationStore = create<LocationStoreState>()(
  persist(
    immer((set: StoreSet, get: StoreGet) => ({
      ...initialState,

      loadSupportedCities: async (): Promise<SupportedCity[]> => {
        if (get().citiesLoaded) return get().supportedCities;

        try {
          const cities = await locationService.fetchSupportedCities();
          set(() => ({
            supportedCities: cities.length > 0 ? cities : FALLBACK_SUPPORTED_CITIES,
            citiesLoaded: true,
          }));
          return get().supportedCities;
        } catch {
          set(() => ({ citiesLoaded: true }));
          return get().supportedCities;
        }
      },

      requestLocationPermission: async (): Promise<boolean> => {
        try {
          set((s) => ({ isLoading: true, error: null }));

          const granted = await locationService.requestLocationPermission();

          set(() => ({
            permissionStatus: granted ? 'granted' : 'denied',
            isLoading: false,
          }));

          if (granted) {
            await get().getCurrentLocation();
          }

          return granted;
        } catch {
          set(() => ({
            error: 'Failed to request location permission',
            isLoading: false,
          }));
          return false;
        }
      },

      getCurrentLocation: async (): Promise<UserLocation | null> => {
        try {
          set(() => ({ isLoading: true, error: null }));

          const permission = await locationService.checkPermissionStatus();

          if (permission === 'denied') {
            set(() => ({
              permissionStatus: 'denied',
              isLoading: false,
            }));
            return null;
          }

          if (permission === 'prompt') {
            const granted = await locationService.requestLocationPermission();
            if (!granted) {
              set(() => ({
                permissionStatus: 'denied',
                isLoading: false,
              }));
              return null;
            }
          }

          const location = await locationService.getCurrentLocation();

          if (location) {
            void locationService.cacheLocation(location);
            const matchedCity = locationService.findSupportedCityByGeocode(
              location.address.city,
              location.address.country
            );
            set(() => ({
              currentLocation: location,
              ...(matchedCity ? { selectedCity: matchedCity } : {}),
              permissionStatus: 'granted',
              isLoading: false,
            }));
            return location;
          }

          const defaultLocation = locationService.getDefaultLocation();
          set(() => ({
            currentLocation: defaultLocation,
            selectedCity: locationService.getDefaultCity(),
            isLoading: false,
          }));
          return defaultLocation;
        } catch {
          const defaultLocation = locationService.getDefaultLocation();
          set(() => ({
            currentLocation: defaultLocation,
            selectedCity: locationService.getDefaultCity(),
            isLoading: false,
          }));
          return defaultLocation;
        }
      },

      setSelectedCity: (city: SupportedCity): void => {
        const location: UserLocation = {
          coordinates: city.coordinates,
          address: {
            address: city.name,
            city: city.name,
            state: city.state,
            country: city.country,
            formattedAddress: `${city.name}, ${city.state}, ${city.country}`,
          },
          lastUpdated: new Date(),
          source: 'manual',
        };

        locationService.cacheLocation(location);
        set(() => ({
          currentLocation: location,
          selectedCity: city,
          error: null,
        }));
      },

      clearError: (): void => {
        set(() => ({ error: null }));
      },
    })),
    {
      name: 'location-storage',
      version: 1,
      storage: createJSONStorage(() => capacitorStorageAdapter),
      partialize: (state) => ({
        currentLocation: state.currentLocation,
        selectedCity: state.selectedCity,
      }),
    }
  )
);

export { FALLBACK_SUPPORTED_CITIES as SUPPORTED_CITIES };

/** Load and return API-backed supported cities */
export function useSupportedCities(): SupportedCity[] {
  const supportedCities = useLocationStore((s) => s.supportedCities);
  const loadSupportedCities = useLocationStore((s) => s.loadSupportedCities);

  useEffect(() => {
    void loadSupportedCities();
  }, [loadSupportedCities]);

  return supportedCities;
}

export default useLocationStore;
