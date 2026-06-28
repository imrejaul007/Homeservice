export interface SupportedCityData {
  id: string;
  name: string;
  coordinates: { latitude: number; longitude: number };
  state: string;
  country: string;
}

/** Canonical supported cities served by the platform */
export const SUPPORTED_CITIES: SupportedCityData[] = [
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
