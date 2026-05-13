import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { locationService, SUPPORTED_CITIES } from '@/services/locationService';
import type { UserLocation, SupportedCity, LocationState } from '@/types/location.types';

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
            locationService.cacheLocation(location);
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
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        currentLocation: state.currentLocation,
        selectedCity: state.selectedCity,
      }),
    }
  )
);

export { SUPPORTED_CITIES };
export default useLocationStore;
