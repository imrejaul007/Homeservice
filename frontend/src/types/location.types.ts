export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface LocationAddress {
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  formattedAddress: string;
}

export interface UserLocation {
  coordinates: LocationCoordinates;
  address: LocationAddress;
  lastUpdated: Date;
  source: 'manual' | 'gps' | 'ip';
}

export interface SupportedCity {
  id: string;
  name: string;
  coordinates: LocationCoordinates;
  state: string;
  country: string;
}

export interface LocationState {
  currentLocation: UserLocation | null;
  selectedCity: SupportedCity | null;
  isLoading: boolean;
  error: string | null;
  permissionStatus: 'granted' | 'denied' | 'prompt' | 'undetermined';
}

export interface GeocodeResponse {
  formattedAddress: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
}
