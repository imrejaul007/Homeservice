/**
 * Price Conversion Utility
 * Converts prices between different currencies based on location
 */

import { useLocationStore } from '../stores/locationStore';
import type { SupportedCity, UserLocation } from '../types/location.types';

// Exchange rates (can be fetched from API in production)
const EXCHANGE_RATES: Record<string, Record<string, number>> = {
  USD: {
    USD: 1,
    AED: 3.67,
    SAR: 3.75,
    EUR: 0.92,
    GBP: 0.79,
    INR: 83.12,
    PKR: 278.5,
  },
};

/** Alternate spellings / geocoder names → canonical city id */
const CITY_ALIASES: Record<string, string> = {
  bengaluru: 'bangalore',
  bangalore: 'bangalore',
  'new delhi': 'delhi',
  'national capital territory of delhi': 'delhi',
  mumbai: 'mumbai',
  bombay: 'mumbai',
  hyderabad: 'hyderabad',
  chennai: 'chennai',
  madras: 'chennai',
  dubai: 'dubai',
  'abu dhabi': 'abu-dhabi',
  sharjah: 'sharjah',
  ajman: 'ajman',
  riyadh: 'riyadh',
  jeddah: 'jeddah',
};

export const LOCATION_CURRENCY_MAP: Record<string, string> = {
  dubai: 'AED',
  'abu dhabi': 'AED',
  'abu-dhabi': 'AED',
  sharjah: 'AED',
  ajman: 'AED',
  uae: 'AED',
  'united arab emirates': 'AED',
  riyadh: 'SAR',
  jeddah: 'SAR',
  makkah: 'SAR',
  'saudi arabia': 'SAR',
  saudi: 'SAR',
  london: 'GBP',
  uk: 'GBP',
  'united kingdom': 'GBP',
  paris: 'EUR',
  germany: 'EUR',
  europe: 'EUR',
  mumbai: 'INR',
  delhi: 'INR',
  bangalore: 'INR',
  bengaluru: 'INR',
  hyderabad: 'INR',
  chennai: 'INR',
  india: 'INR',
  karachi: 'PKR',
  lahore: 'PKR',
  pakistan: 'PKR',
};

export const COUNTRY_CURRENCY_MAP: Record<string, string> = {
  india: 'INR',
  uae: 'AED',
  'united arab emirates': 'AED',
  'saudi arabia': 'SAR',
  saudi: 'SAR',
  pakistan: 'PKR',
  'united kingdom': 'GBP',
  uk: 'GBP',
  germany: 'EUR',
  france: 'EUR',
  'united states': 'USD',
  usa: 'USD',
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  AED: 'AED ',
  SAR: 'SAR ',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  PKR: 'Rs ',
};

export const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  EUR: 'Euro',
  GBP: 'British Pound',
  INR: 'Indian Rupee',
  PKR: 'Pakistani Rupee',
};

export const getCurrencyFromCity = (cityName: string): string | null => {
  if (!cityName) return null;
  const normalizedCity = cityName.toLowerCase().trim();
  const aliasId = CITY_ALIASES[normalizedCity];
  if (aliasId && LOCATION_CURRENCY_MAP[aliasId]) {
    return LOCATION_CURRENCY_MAP[aliasId];
  }
  return LOCATION_CURRENCY_MAP[normalizedCity] || null;
};

export const getCurrencyFromCountry = (countryName: string): string | null => {
  if (!countryName) return null;
  return COUNTRY_CURRENCY_MAP[countryName.toLowerCase().trim()] || null;
};

/** Resolve display/conversion currency from store state */
export const resolveTargetCurrency = (
  selectedCity: SupportedCity | null,
  currentLocation: UserLocation | null
): string => {
  const cityCandidates = [
    currentLocation?.address.city,
    selectedCity?.name,
  ].filter(Boolean) as string[];

  for (const city of cityCandidates) {
    const currency = getCurrencyFromCity(city);
    if (currency) return currency;
  }

  const countryCandidates = [
    currentLocation?.address.country,
    selectedCity?.country,
  ].filter(Boolean) as string[];

  for (const country of countryCandidates) {
    const currency = getCurrencyFromCountry(country);
    if (currency) return currency;
  }

  return 'AED';
};

export const getExchangeRate = (fromCurrency: string, toCurrency: string): number => {
  if (fromCurrency === toCurrency) return 1;
  const rates = EXCHANGE_RATES.USD;
  if (!rates || !rates[fromCurrency] || !rates[toCurrency]) return 1;
  return rates[toCurrency] / rates[fromCurrency];
};

export const formatPrice = (price: number, currency: string = 'AED'): string => {
  if (typeof price !== 'number' || isNaN(price)) price = 0;
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  const formatted = price.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
};

export const convertPrice = (
  price: number,
  fromCurrency: string,
  toCurrency: string
): number => {
  if (typeof price !== 'number' || isNaN(price)) price = 0;
  if (fromCurrency === toCurrency) return price;
  const rate = getExchangeRate(fromCurrency, toCurrency);
  return Math.round(price * rate * 100) / 100;
};

// Cache for location store to avoid circular dependencies in non-React helpers
let locationStoreCache: typeof useLocationStore | null = null;

const getLocationStore = () => {
  if (!locationStoreCache) {
    locationStoreCache = useLocationStore;
  }
  return locationStoreCache;
};

export const getTargetCurrencyFromStore = (): string => {
  try {
    const store = getLocationStore();
    const state = store.getState();
    return resolveTargetCurrency(state.selectedCity, state.currentLocation);
  } catch {
    return 'AED';
  }
};

export const convertPriceForLocation = (
  price: number,
  sourceCurrency: string = 'AED'
): { convertedPrice: number; currency: string; formatted: string } => {
  if (typeof price !== 'number' || isNaN(price)) price = 0;
  const targetCurrency = getTargetCurrencyFromStore();
  const converted = convertPrice(price, sourceCurrency, targetCurrency);
  return {
    convertedPrice: converted,
    currency: targetCurrency,
    formatted: formatPrice(converted, targetCurrency),
  };
};

/**
 * Replace hardcoded "AED 1,499" style amounts in marketing copy with localized prices.
 */
export const localizeAedAmountsInText = (
  text: string,
  convert: (price: number, fromCurrency?: string) => number,
  format: (price: number, currency: string) => string,
  currency: string,
): string => {
  if (!text) return text;
  return text.replace(/AED\s*([\d,]+(?:\.\d+)?)/gi, (_, numStr: string) => {
    const amount = parseFloat(numStr.replace(/,/g, ''));
    if (Number.isNaN(amount)) return `AED ${numStr}`;
    return format(convert(amount, 'AED'), currency);
  });
};

/**
 * Hook for price conversion in React components
 */
export const usePriceConversion = () => {
  const selectedCity = useLocationStore((s) => s.selectedCity);
  const currentLocation = useLocationStore((s) => s.currentLocation);

  const currency = resolveTargetCurrency(selectedCity, currentLocation);

  const convert = (price: number, fromCurrency: string = 'AED') => {
    if (typeof price !== 'number' || isNaN(price)) price = 0;
    return convertPrice(price, fromCurrency, currency);
  };

  const format = (price: number, currencyOverride?: string) => {
    if (typeof price !== 'number' || isNaN(price)) price = 0;
    return formatPrice(price, currencyOverride || currency);
  };

  const convertAndFormat = (price: number, fromCurrency: string = 'AED') => {
    if (typeof price !== 'number' || isNaN(price)) price = 0;
    const converted = convertPrice(price, fromCurrency, currency);
    return formatPrice(converted, currency);
  };

  return {
    currency,
    convert,
    format,
    convertAndFormat,
    selectedCity,
    currentLocation,
  };
};

export default {
  getCurrencyFromCity,
  getExchangeRate,
  formatPrice,
  convertPrice,
  usePriceConversion,
  convertPriceForLocation,
  getTargetCurrencyFromStore,
  localizeAedAmountsInText,
  CURRENCY_SYMBOLS,
  CURRENCY_NAMES,
};