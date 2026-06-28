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

const PUBLIC_CACHE_MS = 30_000;

type CacheEntry<T> = { data: T; at: number };

let maintenanceCache: CacheEntry<MaintenanceStatus> | null = null;
let maintenanceInflight: Promise<MaintenanceStatus> | null = null;

let platformConfigCache: CacheEntry<PlatformPublicConfig> | null = null;
let platformConfigInflight: Promise<PlatformPublicConfig> | null = null;

function readCache<T>(entry: CacheEntry<T> | null): T | null {
  if (!entry) return null;
  if (Date.now() - entry.at > PUBLIC_CACHE_MS) return null;
  return entry.data;
}

export async function fetchMaintenanceStatus(signal?: AbortSignal): Promise<MaintenanceStatus> {
  const cached = readCache(maintenanceCache);
  if (cached) return cached;

  if (maintenanceInflight) return maintenanceInflight;

  maintenanceInflight = api
    .get<{ success: boolean; data: MaintenanceStatus }>('/platform/maintenance', { signal })
    .then((response) => {
      const data = response.data.data;
      maintenanceCache = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      maintenanceInflight = null;
    });

  return maintenanceInflight;
}

export async function fetchPlatformConfig(signal?: AbortSignal): Promise<PlatformPublicConfig> {
  const cached = readCache(platformConfigCache);
  if (cached) return cached;

  if (platformConfigInflight) return platformConfigInflight;

  platformConfigInflight = api
    .get<{ success: boolean; data: PlatformPublicConfig }>('/platform/config', { signal })
    .then((response) => {
      const data = response.data.data;
      platformConfigCache = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      platformConfigInflight = null;
    });

  return platformConfigInflight;
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
