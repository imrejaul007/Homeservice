/**
 * Currency Formatting Utilities
 *
 * Provides consistent currency formatting for the NILIN marketplace
 * using AED as the primary currency with en-AE locale.
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
  const locale = currency === AED_CURRENCY_CODE ? AED_LOCALE : 'en-US';

  // Validate input
  if (typeof amount !== 'number' || isNaN(amount)) {
    return formatPrice(0, currency);
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatter.format(amount);
}

/**
 * Format price with custom options
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

  // Validate input
  if (typeof amount !== 'number' || isNaN(amount)) {
    return formatPriceWithOptions(0, options);
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return formatter.format(amount);
}

/**
 * Get the currency symbol for a given currency code
 *
 * @param currency - Currency code (defaults to AED)
 * @returns Currency symbol
 *
 * @example
 * getCurrencySymbol('AED') // "د.إ"
 * getCurrencySymbol('USD') // "$"
 */
export function getCurrencySymbol(currency: string = AED_CURRENCY_CODE): string {
  const symbols: Record<string, string> = {
    AED: 'د.إ',
    USD: '$',
    EUR: '€',
    GBP: '£',
    SAR: 'ر.س',
  };

  return symbols[currency] || currency;
}

/**
 * Convert amount from one currency to another (placeholder for future implementation)
 * This would require exchange rate API integration
 *
 * @param amount - Amount to convert
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @returns Converted amount
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  // TODO: Integrate with exchange rate API
  if (fromCurrency === toCurrency) {
    return amount;
  }

  // Placeholder - would need real exchange rates
  console.warn('Currency conversion requires exchange rate API integration');
  return amount;
}

/**
 * Get currency configuration from environment variables
 *
 * @returns Currency configuration object
 *
 * @example
 * const { code, symbol } = getCurrencyConfig();
 * // code: 'AED', symbol: 'د.إ'
 */
export function getCurrencyConfig(): { code: string; symbol: string } {
  return {
    code: import.meta.env.VITE_CURRENCY_CODE || AED_CURRENCY_CODE,
    symbol: import.meta.env.VITE_CURRENCY_SYMBOL || getCurrencySymbol(AED_CURRENCY_CODE),
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
