import { api } from './api';
import type { SupportedCity } from '@/types/location.types';

export interface MaintenanceStatus {
  maintenanceMode: boolean;
  message: string;
  estimatedDuration: string | null;
  supportEmail: string | null;
}

export interface PlatformPublicConfig {
  platformName: string;
  platformLogo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  currency: string;
  dateFormat: string;
  language: string;
  supportEmail: string;
  supportPhone: string;
  enableFAQ: boolean;
  instantBookingEnabled: boolean;
}

export const DEFAULT_PLATFORM_CONFIG: PlatformPublicConfig = {
  platformName: 'Nilin',
  platformLogo: '',
  favicon: '',
  primaryColor: '#E85D4C',
  secondaryColor: '#2D2A26',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  language: 'en',
  supportEmail: '',
  supportPhone: '',
  enableFAQ: true,
  instantBookingEnabled: true,
};

export async function fetchMaintenanceStatus(signal?: AbortSignal): Promise<MaintenanceStatus> {
  const response = await api.get<{ success: boolean; data: MaintenanceStatus }>(
    '/platform/maintenance',
    { signal }
  );
  return response.data.data;
}

export async function fetchPlatformConfig(signal?: AbortSignal): Promise<PlatformPublicConfig> {
  const response = await api.get<{ success: boolean; data: PlatformPublicConfig }>(
    '/platform/config',
    { signal }
  );
  return response.data.data;
}

export const platformApi = {
  async getSupportedCities(signal?: AbortSignal): Promise<SupportedCity[]> {
    const response = await api.get<{ success: boolean; data: { cities: SupportedCity[] } }>(
      '/platform/cities',
      { signal }
    );
    return response.data.data.cities;
  },
};

export default platformApi;
