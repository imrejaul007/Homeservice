/**
 * Currency Formatting Utilities
 *
 * Provides consistent currency formatting for the NILIN marketplace.
 *
 * AED (United Arab Emirates Dirham) is used as the primary/default currency
 * for this UAE-based marketplace service. The 'en-AE' locale ensures proper
 * formatting of numbers and currency display for users in the UAE region.
 *
 * Key design decisions:
 * - AED is hardcoded as default to ensure consistency across the marketplace
 * - The locale 'en-AE' is used even for other currencies to maintain uniform appearance
 * - All amounts are stored and processed in the smallest currency unit (fils for AED)
 * - Conversion support is placeholder-ready for future multi-currency integration
 *
 * @module utils/currency
 */

const AED_CURRENCY_CODE = 'AED';
const AED_LOCALE = 'en-AE';

/**
 * Format a price amount as AED currency string
 *
 * Uses Intl.NumberFormat with 'en-AE' locale and 'AED' currency
 * for consistent display across the UAE marketplace.
 *
 * Note: AED (Arab Emirate Dirham) is the official currency of UAE and is used
 * as the default for this marketplace. The 'en-AE' locale ensures numbers
 * are formatted with Arabic numerals and proper grouping for the region.
 *
 * @param amount - The numeric amount to format
 * @param currency - Optional currency code (defaults to AED)
 * @returns Formatted currency string (e.g., "AED 100.00" or "د.إ 100.00")
 *
 * @example
 * formatPrice(99.99) // "AED 99.99"
 * formatPrice(1000) // "AED 1,000.00"
 * formatPrice(50.5, 'USD') // "$50.50" (when using different currency)
 */
export function formatPrice(amount: number, currency?: string): string {
  const currencyCode = currency || AED_CURRENCY_CODE;
  // Always use 'en-AE' locale for consistent display in the UAE marketplace
  // Even when displaying other currencies, the en-AE locale maintains visual consistency
  const locale = AED_LOCALE;

  // Graceful fallback for invalid input - return 0 formatted
  if (typeof amount !== 'number' || isNaN(amount)) {
    console.warn(`Invalid amount provided to formatPrice: ${amount}. Using 0.`);
    return formatPrice(0, currency);
  }

  // Graceful fallback for unsupported currencies
  const validCurrencies = ['AED', 'USD', 'EUR', 'GBP', 'SAR', 'INR', 'CNY'];
  if (currency && !validCurrencies.includes(currency)) {
    console.warn(`Currency "${currency}" may not be fully supported. Falling back to display as-is.`);
  }

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return formatter.format(amount);
  } catch (error) {
    // Ultimate fallback if Intl formatting fails
    console.error(`Failed to format currency: ${currencyCode}. Falling back to plain number.`);
    return `${currencyCode || 'AED'} ${amount.toFixed(2)}`;
  }
}

/**
 * Format price with custom options
 *
 * Provides flexible currency formatting with customizable locale, decimal places,
 * and currency code display. Defaults to AED for UAE marketplace consistency.
 *
 * @param amount - The numeric amount to format
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatPriceWithOptions(
  amount: number,
  options: {
    currency?: string;
    locale?: string;
    decimals?: number;
    showCurrencyCode?: boolean;
  } = {}
): string {
  const {
    currency = AED_CURRENCY_CODE,
    locale = AED_LOCALE,
    decimals = 2,
    showCurrencyCode = true,
  } = options;

  // Graceful fallback for invalid input
  if (typeof amount !== 'number' || isNaN(amount)) {
    console.warn(`Invalid amount provided to formatPriceWithOptions: ${amount}. Using 0.`);
    return formatPriceWithOptions(0, options);
  }

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    return formatter.format(amount);
  } catch (error) {
    // Fallback if Intl formatting fails - return unformatted with currency code
    console.error(`Failed to format currency with options. Falling back to plain format.`);
    return showCurrencyCode ? `${currency} ${amount.toFixed(decimals)}` : amount.toFixed(decimals);
  }
}

/**
 * Get the currency symbol for a given currency code
 *
 * Returns the official currency symbol for supported currencies.
 * Defaults to returning the currency code itself if symbol is not known.
 * AED (UAE Dirham) is the default for this marketplace.
 *
 * @param currency - Currency code (defaults to AED)
 * @returns Currency symbol (e.g., "د.إ" for AED, "$" for USD)
 *
 * @example
 * getCurrencySymbol('AED') // "د.إ"
 * getCurrencySymbol('USD') // "$"
 * getCurrencySymbol('XXX') // "XXX" (falls back to code)
 */
export function getCurrencySymbol(currency: string = AED_CURRENCY_CODE): string {
  const symbols: Record<string, string> = {
    AED: 'د.إ', // UAE Dirham - primary currency for this marketplace
    USD: '$',    // US Dollar
    EUR: '€',    // Euro
    GBP: '£',    // British Pound
    SAR: 'ر.س',  // Saudi Riyal
    INR: '₹',    // Indian Rupee
    CNY: '¥',    // Chinese Yuan
  };

  // Graceful fallback - return currency code if symbol not found
  if (!symbols[currency]) {
    console.warn(`Currency symbol not found for "${currency}". Returning currency code.`);
  }

  return symbols[currency] || currency;
}

/**
 * Exchange rate cache configuration
 * Uses localStorage for persistence across page loads
 */
const CACHE_KEY = 'nilin_exchange_rates';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour in milliseconds

interface ExchangeRateCache {
  timestamp: number;
  rates: Record<string, number>;
  baseCurrency: string;
}

/**
 * Get cached exchange rates from localStorage
 * Returns null if cache is expired or doesn't exist
 */
function getCachedRates(): ExchangeRateCache | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cache: ExchangeRateCache = JSON.parse(cached);
    const now = Date.now();

    // Check if cache has expired
    if (now - cache.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return cache;
  } catch (error) {
    console.warn('Failed to read exchange rate cache:', error);
    return null;
  }
}

/**
 * Save exchange rates to localStorage cache
 */
function setCachedRates(rates: Record<string, number>, baseCurrency: string): void {
  try {
    const cache: ExchangeRateCache = {
      timestamp: Date.now(),
      rates,
      baseCurrency,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to save exchange rate cache:', error);
  }
}

/**
 * Fetch exchange rates from open.er-api.com API
 * Free API, no API key required for basic usage
 */
async function fetchExchangeRates(baseCurrency: string): Promise<Record<string, number>> {
  const url = `https://open.er-api.com/v6/latest/${baseCurrency}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.result !== 'success' || !data.rates) {
      throw new Error('Invalid API response format');
    }

    // Cache the successful response
    setCachedRates(data.rates, baseCurrency);

    return data.rates;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fallback exchange rates (approximate rates as of mid-2024)
 * Used when API is unavailable - these are approximate and may not be current
 */
const FALLBACK_RATES: Record<string, Record<string, number>> = {
  USD: { AED: 3.67, EUR: 0.92, GBP: 0.79, SAR: 3.75, INR: 83.12, CNY: 7.24 },
  AED: { USD: 0.27, EUR: 0.25, GBP: 0.21, SAR: 1.02, INR: 22.64, CNY: 1.97 },
  EUR: { USD: 1.09, AED: 4.00, GBP: 0.86, SAR: 4.08, INR: 90.35, CNY: 7.87 },
  GBP: { USD: 1.27, AED: 4.65, EUR: 1.16, SAR: 4.74, INR: 105.00, CNY: 9.14 },
  SAR: { USD: 0.27, AED: 0.98, EUR: 0.24, GBP: 0.21, INR: 22.17, CNY: 1.93 },
  INR: { USD: 0.012, AED: 0.044, EUR: 0.011, GBP: 0.0095, SAR: 0.045, CNY: 0.087 },
  CNY: { USD: 0.14, AED: 0.51, EUR: 0.13, GBP: 0.11, SAR: 0.52, INR: 11.48 },
};

/**
 * Get fallback rate when API is unavailable
 */
function getFallbackRate(fromCurrency: string, toCurrency: string): number {
  const rates = FALLBACK_RATES[fromCurrency];
  if (rates && rates[toCurrency]) {
    return rates[toCurrency];
  }

  // Try inverse calculation
  const inverseRates = FALLBACK_RATES[toCurrency];
  if (inverseRates && inverseRates[fromCurrency]) {
    return 1 / inverseRates[fromCurrency];
  }

  // Last resort: use USD as intermediate
  const fromToUSD = getFallbackRate(fromCurrency, 'USD');
  const usdToTo = getFallbackRate('USD', toCurrency);
  return fromToUSD * usdToTo;
}

// In-memory cache for session (faster than localStorage during same session)
let memoryCache: { timestamp: number; rates: Record<string, number> } | null = null;

/**
 * Get exchange rates with caching strategy:
 * 1. Check memory cache first (fastest, session-scoped)
 * 2. Check localStorage cache (persists across page loads)
 * 3. Fetch from API (network request)
 * 4. Use fallback rates (offline/unavailable)
 */
async function getExchangeRates(baseCurrency: string): Promise<Record<string, number>> {
  const now = Date.now();

  // 1. Check memory cache
  if (memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.rates;
  }

  // 2. Check localStorage cache
  const cached = getCachedRates();
  if (cached && cached.baseCurrency === baseCurrency) {
    // Also update memory cache
    memoryCache = { timestamp: cached.timestamp, rates: cached.rates };
    return cached.rates;
  }

  // 3. Try fetching from API
  try {
    const rates = await fetchExchangeRates(baseCurrency);
    // Update memory cache
    memoryCache = { timestamp: Date.now(), rates };
    return rates;
  } catch (apiError) {
    console.warn('Failed to fetch live exchange rates:', apiError);

    // 4. Use fallback rates
    const fallbackRates = FALLBACK_RATES[baseCurrency] || FALLBACK_RATES.USD;
    console.info('Using fallback exchange rates (may not be current)');
    return fallbackRates;
  }
}

/**
 * Synchronous fallback for when async is not possible
 * Uses cached or fallback rates immediately
 */
function getExchangeRateSync(fromCurrency: string, toCurrency: string): number {
  if (fromCurrency === toCurrency) return 1;

  // Check memory cache first
  if (memoryCache && memoryCache.rates[toCurrency]) {
    return memoryCache.rates[toCurrency];
  }

  // Check localStorage cache
  const cached = getCachedRates();
  if (cached && cached.rates[toCurrency]) {
    return cached.rates[toCurrency];
  }

  // Use fallback
  return getFallbackRate(fromCurrency, toCurrency);
}

/**
 * Convert amount from one currency to another
 *
 * Uses live exchange rates from open.er-api.com with intelligent caching.
 * Rates are cached for 1 hour to minimize API calls and improve performance.
 *
 * Supported currencies: AED, USD, EUR, GBP, SAR, INR, CNY
 *
 * @param amount - Amount to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns Converted amount
 *
 * @example
 * convertCurrency(100, 'USD', 'AED') // Returns ~367 AED
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  // Validate input
  if (typeof amount !== 'number' || isNaN(amount)) {
    console.warn('Invalid amount for currency conversion:', amount);
    return 0;
  }

  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // No conversion needed for same currency
  if (from === to) {
    return amount;
  }

  try {
    const rates = await getExchangeRates(from);

    if (!rates[to]) {
      console.warn(`Exchange rate not available for ${from} to ${to}`);
      return amount;
    }

    const convertedAmount = amount * rates[to];
    return Math.round(convertedAmount * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error('Currency conversion failed:', error);
    // Graceful fallback - return original amount
    return amount;
  }
}

/**
 * Synchronous currency conversion using cached/fallback rates
 * Use this when async is not possible (e.g., during render)
 * Note: May use stale rates if cache is empty and network is unavailable
 */
export function convertCurrencySync(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  // Validate input
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 0;
  }

  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // No conversion needed for same currency
  if (from === to) {
    return amount;
  }

  try {
    const rate = getExchangeRateSync(from, to);
    const convertedAmount = amount * rate;
    return Math.round(convertedAmount * 100) / 100;
  } catch (error) {
    console.error('Sync currency conversion failed:', error);
    return amount;
  }
}

/**
 * Force refresh exchange rates (bypass cache)
 * Call this when you need the most current rates
 */
export async function refreshExchangeRates(baseCurrency: string = 'USD'): Promise<Record<string, number>> {
  // Clear caches
  memoryCache = null;
  localStorage.removeItem(CACHE_KEY);

  // Fetch fresh rates
  return getExchangeRates(baseCurrency);
}

/**
 * Get currency configuration from environment variables
 *
 * Reads currency configuration from environment variables with graceful
 * fallback to AED defaults. Environment variables allow runtime configuration
 * for different deployment scenarios (e.g., different markets).
 *
 * Supported environment variables:
 * - VITE_CURRENCY_CODE: Override default currency code (e.g., 'USD')
 * - VITE_CURRENCY_SYMBOL: Override default symbol (e.g., '$')
 *
 * @returns Currency configuration object with code and symbol
 *
 * @example
 * // In .env: VITE_CURRENCY_CODE=USD
 * const { code, symbol } = getCurrencyConfig();
 * // code: 'USD', symbol: '$'
 */
export function getCurrencyConfig(): { code: string; symbol: string } {
  const currencyCode = import.meta.env.VITE_CURRENCY_CODE || AED_CURRENCY_CODE;
  const currencySymbol = import.meta.env.VITE_CURRENCY_SYMBOL || getCurrencySymbol(currencyCode);

  return {
    code: currencyCode,
    symbol: currencySymbol,
  };
}

/**
 * Format a referral reward amount with proper currency
 *
 * @param amount - The numeric amount to format
 * @returns Formatted currency string with symbol (e.g., "د.إ 100")
 *
 * @example
 * formatReferralReward(100) // "د.إ 100"
 */
export function formatReferralReward(amount: number): string {
  const { code, symbol } = getCurrencyConfig();
  // Use Intl.NumberFormat for locale-aware number formatting
  const formatter = new Intl.NumberFormat(AED_LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${symbol}${formatter.format(amount)}`;
}

export default formatPrice;
