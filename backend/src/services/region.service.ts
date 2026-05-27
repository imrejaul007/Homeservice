import Tenant from '../models/tenant.model';

export interface Region {
  code: string;
  country: string;
  cities: string[];
  timezone: string;
  locale: string;
  currency: {
    code: string;
    symbol: string;
    decimalPlaces: number;
  };
  tax: {
    enabled: boolean;
    rate: number;
    name: string;
  };
}

// Pre-configured regions
export const REGIONS: Record<string, Region> = {
  UAE: {
    code: 'UAE',
    country: 'United Arab Emirates',
    cities: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman'],
    timezone: 'Asia/Dubai',
    locale: 'en-AE',
    currency: { code: 'AED', symbol: 'د.إ', decimalPlaces: 2 },
    tax: { enabled: true, rate: 5, name: 'VAT' },
  },
  KSA: {
    code: 'KSA',
    country: 'Saudi Arabia',
    cities: ['Riyadh', 'Jeddah', 'Makkah', 'Medina'],
    timezone: 'Asia/Riyadh',
    locale: 'ar-SA',
    currency: { code: 'SAR', symbol: 'ر.س', decimalPlaces: 2 },
    tax: { enabled: true, rate: 15, name: 'VAT' },
  },
  INDIA: {
    code: 'INDIA',
    country: 'India',
    cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai'],
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    currency: { code: 'INR', symbol: '₹', decimalPlaces: 2 },
    tax: { enabled: true, rate: 18, name: 'GST' },
  },
  UK: {
    code: 'UK',
    country: 'United Kingdom',
    cities: ['London', 'Manchester', 'Birmingham'],
    timezone: 'Europe/London',
    locale: 'en-GB',
    currency: { code: 'GBP', symbol: '£', decimalPlaces: 2 },
    tax: { enabled: true, rate: 20, name: 'VAT' },
  },
};

export const getAvailableRegions = (): Region[] => {
  return Object.values(REGIONS);
};

export const getRegion = (code: string): Region | undefined => {
  return REGIONS[code];
};

export const initializeDefaultTenants = async (): Promise<void> => {
  for (const [code, region] of Object.entries(REGIONS)) {
    const exists = await Tenant.findOne({ 'region.code': code });
    if (!exists) {
      await Tenant.create({
        name: `${region.country} Operations`,
        slug: code.toLowerCase(),
        region: {
          code: region.code,
          country: region.country,
          cities: region.cities,
          timezone: region.timezone,
          locale: region.locale,
          currency: region.currency,
        },
        taxConfig: {
          enabled: region.tax.enabled,
          rate: region.tax.rate,
        },
        isActive: true,
      });
    }
  }
};
