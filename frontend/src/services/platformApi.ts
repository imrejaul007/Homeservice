import axios from 'axios';
import { getApiUrl } from '../lib/getApiUrl';

const API_URL = getApiUrl();

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

const DEFAULT_CONFIG: PlatformPublicConfig = {
  platformName: 'Homeservice',
  platformLogo: '',
  favicon: '',
  primaryColor: '#E8B4A8',
  secondaryColor: '#D4A89A',
  currency: 'AED',
  dateFormat: 'DD/MM/YYYY',
  language: 'en',
  supportEmail: 'support@homeservice.com',
  supportPhone: '',
  enableFAQ: true,
  instantBookingEnabled: false,
};

/** Public — no auth required */
export async function fetchMaintenanceStatus(): Promise<MaintenanceStatus> {
  const response = await axios.get(`${API_URL}/platform/maintenance`, {
    timeout: 10000,
  });
  return response.data.data as MaintenanceStatus;
}

/** Public branding, locale, and feature flags */
export async function fetchPlatformConfig(): Promise<PlatformPublicConfig> {
  try {
    const response = await axios.get(`${API_URL}/platform/config`, { timeout: 10000 });
    return { ...DEFAULT_CONFIG, ...(response.data.data as Partial<PlatformPublicConfig>) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export { DEFAULT_CONFIG as DEFAULT_PLATFORM_CONFIG };
