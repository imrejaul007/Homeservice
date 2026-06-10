import axios from 'axios';
import { getApiUrl } from '../lib/getApiUrl';

const API_URL = getApiUrl();

export type ContactSubject =
  | 'booking'
  | 'payment'
  | 'refund'
  | 'provider'
  | 'suggestion'
  | 'other';

export interface ContactFormPayload {
  name: string;
  email: string;
  subject: ContactSubject;
  message: string;
  website?: string;
}

export interface ContactSubmissionResult {
  submissionId: string;
  ticketNumber?: string;
  department: string;
  estimatedResponseHours: number;
  isDuplicate: boolean;
}

export interface ContactConfig {
  contact: {
    emails: { general: string; clients: string; providers: string };
    phone: string;
    regionalLabel?: string;
    regionalHours?: string;
    timezone: string;
    address: {
      name: string;
      lines: string[];
      mapsUrl: string;
      coordinates: { lat: number; lng: number };
    };
    businessHours: {
      weekdays: { days: string; hours: string };
      weekend: { days: string; hours: string };
      timezone: string;
    };
    social: Array<{ name: string; url: string; handle: string }>;
    sla: { firstResponseHours: number; resolutionHours: number; urgentFirstResponseHours: number };
  };
  isBusinessHoursOpen: boolean;
  businessHoursStatus?: string;
  upcomingHolidays?: Array<{ date: string; name: string; closed: boolean }>;
  subjectOptions: Array<{ value: string; label: string; department: string; team: string }>;
  departments: Array<{ title: string; email: string; description: string }>;
}

const CONFIG_CACHE_KEY = 'nilin:contact:config';
const CONFIG_CACHE_TTL = 3600_000; // 1 hour

function getCachedConfig(): ContactConfig | null {
  try {
    const raw = sessionStorage.getItem(CONFIG_CACHE_KEY);
    if (!raw) return null;
    const { data, expiry } = JSON.parse(raw);
    if (Date.now() > expiry) {
      sessionStorage.removeItem(CONFIG_CACHE_KEY);
      return null;
    }
    return data as ContactConfig;
  } catch {
    return null;
  }
}

function setCachedConfig(data: ContactConfig): void {
  try {
    sessionStorage.setItem(
      CONFIG_CACHE_KEY,
      JSON.stringify({ data, expiry: Date.now() + CONFIG_CACHE_TTL })
    );
  } catch {
    // storage full — non-critical
  }
}

export async function fetchContactConfig(region?: string): Promise<ContactConfig | null> {
  if (!region) {
    const cached = getCachedConfig();
    if (cached) return cached;
  }

  try {
    const response = await axios.get(`${API_URL}/contact/config`, {
      timeout: 10000,
      params: region ? { region } : undefined,
    });
    const data = response.data.data as ContactConfig;
    if (!region) setCachedConfig(data);
    return data;
  } catch {
    return getCachedConfig();
  }
}

export async function submitContactForm(
  payload: ContactFormPayload
): Promise<ContactSubmissionResult> {
  const response = await axios.post(`${API_URL}/contact/submit`, payload, {
    timeout: 30000,
    withCredentials: true,
  });

  if (!response.data?.success) {
    throw new Error(response.data?.error || 'Failed to submit contact form');
  }

  return response.data.data as ContactSubmissionResult;
}
