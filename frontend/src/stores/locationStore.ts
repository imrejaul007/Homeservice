import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { locationService, SUPPORTED_CITIES } from '@/services/locationService';
import type { UserLocation, SupportedCity, LocationState } from '@/types/location.types';

/**
 * Capacitor-safe Zustand storage adapter
 */
const capacitorStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await Preferences.get({ key: name });
        return result.value;
      } catch {
        return null;
      }
    }
    // Browser fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(name);
    }
    return null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key: name, value });
    } else {
      // Browser fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(name, value);
      }
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key: name });
    } else {
      // Browser fallback
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(name);
      }
    }
  },
};

interface LocationStoreState extends LocationState {
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

const initialState: LocationState = {
  currentLocation: null,
  selectedCity: null,
  isLoading: false,
  error: null,
  permissionStatus: 'undetermined',
};

export const useLocationStore = create<LocationStoreState>()(
  persist(
    immer((set: StoreSet, get: StoreGet) => ({
      ...initialState,

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
            set(() => ({
              currentLocation: location,
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

export { SUPPORTED_CITIES };
export default useLocationStore;
