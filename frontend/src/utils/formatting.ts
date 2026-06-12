/**
 * Formatting Utilities for NILIN Marketplace
 *
 * Shared formatting functions for consistent display of dates, currencies,
 * phone numbers, and other data across the platform.
 *
 * @module utils/formatting
 */

/**
 * Currency configuration for different locales
 */
const CURRENCY_CONFIG: Record<string, { symbol: string; position: 'before' | 'after'; decimals: number }> = {
  USD: { symbol: '$', position: 'before', decimals: 2 },
  EUR: { symbol: '€', position: 'after', decimals: 2 },
  GBP: { symbol: '£', position: 'before', decimals: 2 },
  AED: { symbol: 'د.إ', position: 'after', decimals: 2 },
  SAR: { symbol: 'ر.س', position: 'after', decimals: 2 },
  default: { symbol: '$', position: 'before', decimals: 2 },
};

/**
 * Default currency for the marketplace
 */
const DEFAULT_CURRENCY = 'USD';

/**
 * Format a number as currency
 *
 * @param amount - The amount to format
 * @param currency - Currency code (default: USD)
 * @param locale - Locale for number formatting (default: en-US)
 * @returns Formatted currency string
 *
 * @example
 * formatCurrency(99.99) // "$99.99"
 * formatCurrency(99.99, 'EUR') // "99.99 €"
 * formatCurrency(99.99, 'EUR', 'de-DE') // "99,99 €"
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = 'en-US'
): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return formatCurrency(0, currency, locale);
  }

  const config = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.default;

  // Use Intl.NumberFormat for locale-aware formatting
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals,
  });

  return formatter.format(amount);
}

/**
 * Format currency with custom symbol (for display purposes)
 *
 * @param amount - The amount to format
 * @param symbol - Currency symbol to display
 * @param decimals - Number of decimal places
 * @returns Formatted currency string
 */
export function formatCurrencySimple(
  amount: number,
  symbol: string = '$',
  decimals: number = 2
): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return `${symbol}0.${'0'.repeat(decimals)}`;
  }

  const fixed = amount.toFixed(decimals);
  return `${symbol}${fixed}`;
}

// =============================================================================
// Booking Price Formatting
// =============================================================================

/**
 * Format booking price with proper locale and currency
 * Optimized for AED (UAE) with fallback to en-US locale
 *
 * @param amount - The amount to format
 * @param currency - Currency code (default: 'AED')
 * @returns Formatted currency string with proper decimals
 *
 * @example
 * formatBookingPrice(1410) // "AED 1,410.00"
 * formatBookingPrice(99.9, 'USD') // "USD 99.90"
 */
export function formatBookingPrice(
  amount: number,
  currency: string = 'AED'
): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return formatBookingPrice(0, currency);
  }

  // Use AED locale for UAE marketplace, en-US for others
  const locale = currency === 'AED' ? 'en-AE' : 'en-US';

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format booking price with custom options
 * Use when you need more control over the formatting
 *
 * @param amount - The amount to format
 * @param options - Custom formatting options
 * @returns Formatted currency string
 */
export function formatBookingPriceWithOptions(
  amount: number,
  options: {
    currency?: string;
    showSymbol?: boolean;
    decimals?: number;
    locale?: string;
  } = {}
): string {
  const {
    currency = 'AED',
    showSymbol = true,
    decimals = 2,
    locale = currency === 'AED' ? 'en-AE' : 'en-US'
  } = options;

  if (typeof amount !== 'number' || isNaN(amount)) {
    return `0.${'0'.repeat(decimals)}`;
  }

  return new Intl.NumberFormat(locale, {
    style: showSymbol ? 'currency' : 'decimal',
    currency: showSymbol ? currency : undefined,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

// =============================================================================
// Date/Time Formatting
// =============================================================================

/**
 * Format a date string for display
 *
 * @param date - Date string, Date object, or timestamp
 * @param options - Intl.DateTimeFormat options
 * @param locale - Locale (default: en-US)
 * @returns Formatted date string
 *
 * @example
 * formatDate('2024-01-15') // "January 15, 2024"
 * formatDate('2024-01-15', { month: 'short', day: 'numeric' }) // "Jan 15"
 */
export function formatDate(
  date: string | Date | number,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  },
  locale: string = 'en-US'
): string {
  const dateObj = parseDate(date);
  if (!dateObj) return '';

  return new Intl.DateTimeFormat(locale, options).format(dateObj);
}

/**
 * Format a time string
 *
 * @param time - Time string (HH:mm) or Date object
 * @param format - Format type: '12h' or '24h' (default: '12h')
 * @param locale - Locale (default: en-US)
 * @returns Formatted time string
 *
 * @example
 * formatTime('14:30') // "2:30 PM"
 * formatTime('14:30', '24h') // "14:30"
 */
export function formatTime(
  time: string | Date,
  format: '12h' | '24h' = '12h',
  locale: string = 'en-US'
): string {
  let dateObj: Date;

  if (typeof time === 'string' && time.includes(':')) {
    // Parse time string
    const [hours, minutes] = time.split(':').map(Number);
    dateObj = new Date();
    dateObj.setHours(hours, minutes, 0, 0);
  } else {
    dateObj = new Date(time);
  }

  if (isNaN(dateObj.getTime())) return '';

  if (format === '24h') {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(dateObj);
  }

  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(dateObj);
}

/**
 * Format a date and time together
 *
 * @param date - Date string, Date object, or timestamp
 * @param time - Optional time string
 * @param locale - Locale (default: en-US)
 * @returns Formatted date and time string
 */
export function formatDateTime(
  date: string | Date | number,
  time?: string,
  locale: string = 'en-US'
): string {
  const dateObj = parseDate(date);
  if (!dateObj) return '';

  if (time) {
    const [hours, minutes] = time.split(':').map(Number);
    dateObj.setHours(hours, minutes, 0, 0);
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(dateObj);
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 *
 * @param date - Date to format
 * @param referenceDate - Reference date (default: now)
 * @param locale - Locale (default: en-US)
 * @returns Relative time string
 *
 * @example
 * formatRelativeTime('2024-01-15T10:00:00Z') // "2 days ago" (depending on current time)
 */
export function formatRelativeTime(
  date: string | Date | number,
  referenceDate: Date = new Date(),
  locale: string = 'en-US'
): string {
  const dateObj = parseDate(date);
  if (!dateObj) return '';

  const diffMs = referenceDate.getTime() - dateObj.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffDays) >= 30) {
    return formatDate(dateObj, { year: 'numeric', month: 'short', day: 'numeric' }, locale);
  }
  if (Math.abs(diffDays) >= 1) {
    return rtf.format(-diffDays, 'day');
  }
  if (Math.abs(diffHours) >= 1) {
    return rtf.format(-diffHours, 'hour');
  }
  if (Math.abs(diffMinutes) >= 1) {
    return rtf.format(-diffMinutes, 'minute');
  }

  return rtf.format(-diffSeconds, 'second');
}

/**
 * Format duration in minutes to human-readable string
 *
 * @param minutes - Duration in minutes
 * @param format - Format type: 'full' or 'short' (default: 'full')
 * @returns Formatted duration string
 *
 * @example
 * formatDuration(90) // "1 hour 30 minutes"
 * formatDuration(90, 'short') // "1h 30m"
 */
export function formatDuration(minutes: number, format: 'full' | 'short' = 'full'): string {
  if (typeof minutes !== 'number' || isNaN(minutes) || minutes < 0) {
    return format === 'short' ? '0m' : '0 minutes';
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (format === 'short') {
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
  }
  if (mins > 0) {
    parts.push(`${mins} minute${mins !== 1 ? 's' : ''}`);
  }

  return parts.join(' ') || '0 minutes';
}

/**
 * Format a date range
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @param locale - Locale (default: en-US)
 * @returns Formatted date range string
 */
export function formatDateRange(
  startDate: string | Date | number,
  endDate: string | Date | number,
  locale: string = 'en-US'
): string {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end) return '';

  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return `${formatDate(start, { weekday: 'short', month: 'short', day: 'numeric' }, locale)}`;
  }

  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameYear) {
    return `${formatDate(start, { month: 'short', day: 'numeric' }, locale)} - ${formatDate(end, { month: 'short', day: 'numeric', year: 'numeric' }, locale)}`;
  }

  return `${formatDate(start, { month: 'short', day: 'numeric', year: 'numeric' }, locale)} - ${formatDate(end, { month: 'short', day: 'numeric', year: 'numeric' }, locale)}`;
}

// =============================================================================
// Phone Number Formatting
// =============================================================================

/**
 * Format a phone number for display
 *
 * @param phone - Raw phone number
 * @param country - Country code (default: US)
 * @returns Formatted phone number
 *
 * @example
 * formatPhone('1234567890') // "(123) 456-7890"
 * formatPhone('+971501234567', 'AE') // "+971 50 123 4567"
 */
export function formatPhone(phone: string, country: string = 'US'): string {
  if (!phone) return '';

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // UAE numbers (without country code)
  if (country === 'AE' && digits.length === 9) {
    return `+971 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }

  // US/Default formatting
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  // US number with country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // If no specific formatting, add + for country code
  if (digits.length > 10) {
    return `+${digits.slice(0, digits.length - 10)} ${digits.slice(-10).replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}`;
  }

  return phone;
}

/**
 * Format phone for international display
 *
 * @param phone - Phone number
 * @returns Internationally formatted phone number
 */
export function formatPhoneInternational(phone: string): string {
  if (!phone) return '';

  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1 ${formatPhone(phone)}`;
  }

  if (digits.length === 9 && digits.startsWith('0')) {
    // UAE mobile without leading 0
    return `+971 ${digits.slice(1)}`;
  }

  return phone.startsWith('+') ? phone : `+${digits}`;
}

// =============================================================================
// Text Formatting
// =============================================================================

/**
 * Truncate text to a maximum length
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @param suffix - Suffix for truncated text (default: '...')
 * @returns Truncated text
 *
 * @example
 * truncate('This is a long text', 10) // "This is a..."
 */
export function truncate(text: string, maxLength: number, suffix: string = '...'): string {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength - suffix.length).trim() + suffix;
}

/**
 * Capitalize first letter of each word
 *
 * @param text - Text to capitalize
 * @returns Capitalized text
 *
 * @example
 * capitalizeWords('hello world') // "Hello World"
 */
export function capitalizeWords(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format name to display (first name + last initial)
 *
 * @param firstName - First name
 * @param lastName - Last name
 * @param format - Format type: 'full', 'initial', 'first'
 * @returns Formatted name
 *
 * @example
 * formatName('John', 'Doe') // "John Doe"
 * formatName('John', 'Doe', 'initial') // "John D."
 * formatName('John', 'Doe', 'first') // "John"
 */
export function formatName(
  firstName?: string,
  lastName?: string,
  format: 'full' | 'initial' | 'first' = 'full'
): string {
  const first = firstName?.trim() || '';
  const last = lastName?.trim() || '';

  if (format === 'first') return first || 'User';

  if (format === 'initial') {
    return last ? `${first} ${last.charAt(0).toUpperCase()}.` : first || 'User';
  }

  return `${first} ${last}`.trim() || 'User';
}

/**
 * Format percentage
 *
 * @param value - Value between 0 and 1 (or 0 and 100)
 * @param decimals - Number of decimal places
 * @param isRaw - If true, value is 0-1; if false, value is 0-100
 * @returns Formatted percentage string
 *
 * @example
 * formatPercentage(0.15) // "15%"
 * formatPercentage(15, 1, false) // "15.0%"
 */
export function formatPercentage(
  value: number,
  decimals: number = 0,
  isRaw: boolean = true
): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }

  const percent = isRaw ? value * 100 : value;
  return `${percent.toFixed(decimals)}%`;
}

/**
 * Format a number with thousands separator
 *
 * @param value - Number to format
 * @param locale - Locale (default: en-US)
 * @returns Formatted number string
 *
 * @example
 * formatNumber(1234567) // "1,234,567"
 */
export function formatNumber(value: number, locale: string = 'en-US'): string {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }

  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Format file size to human-readable string
 *
 * @param bytes - Size in bytes
 * @param decimals - Number of decimal places
 * @returns Formatted file size string
 *
 * @example
 * formatFileSize(1024) // "1 KB"
 * formatFileSize(1048576) // "1 MB"
 */
export function formatFileSize(bytes: number, decimals: number = 2): string {
  if (typeof bytes !== 'number' || isNaN(bytes) || bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${units[i]}`;
}

/**
 * Format rating stars display
 *
 * @param rating - Rating value (0-5)
 * @param maxRating - Maximum rating (default: 5)
 * @returns Object with full, half, and empty star counts
 *
 * @example
 * formatRatingStars(4.5) // { full: 4, half: 1, empty: 0 }
 */
export function formatRatingStars(rating: number, maxRating: number = 5): {
  full: number;
  half: number;
  empty: number;
} {
  const normalized = Math.max(0, Math.min(rating, maxRating));
  const full = Math.floor(normalized);
  const half = normalized % 1 >= 0.5 ? 1 : 0;
  const empty = maxRating - full - half;

  return { full, half, empty };
}

// =============================================================================
// Address Formatting
// =============================================================================

/**
 * Format an address object to string
 *
 * @param address - Address components
 * @param format - Format type: 'full', 'short', 'city'
 * @returns Formatted address string
 *
 * @example
 * formatAddress({ street: '123 Main St', city: 'Dubai', country: 'UAE' })
 * // "123 Main St, Dubai, UAE"
 */
export function formatAddress(
  address: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  },
  format: 'full' | 'short' | 'city' = 'full'
): string {
  const parts: string[] = [];

  if (address.street && format !== 'city') {
    parts.push(address.street);
  }

  if (address.city) {
    if (format === 'city') {
      return address.city;
    }
    parts.push(address.city);
  }

  if (address.state && format === 'full') {
    parts.push(address.state);
  }

  if (address.zipCode && format === 'full') {
    parts.push(address.zipCode);
  }

  if (address.country) {
    parts.push(address.country);
  }

  return parts.join(', ');
}

/**
 * Format distance for display
 *
 * @param distanceKm - Distance in kilometers
 * @param useMetric - Use metric units (default: true)
 * @returns Formatted distance string
 *
 * @example
 * formatDistance(1.5) // "1.5 km"
 * formatDistance(1.5, false) // "0.9 mi"
 */
export function formatDistance(distanceKm: number, useMetric: boolean = true): string {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm)) {
    return useMetric ? '0 km' : '0 mi';
  }

  if (useMetric) {
    if (distanceKm < 1) {
      return `${Math.round(distanceKm * 1000)} m`;
    }
    return `${distanceKm.toFixed(1)} km`;
  }

  const miles = distanceKm * 0.621371;
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

// =============================================================================
// Booking Reference Formatting
// =============================================================================

/**
 * Format booking number for display
 *
 * @param bookingNumber - Raw booking number
 * @returns Formatted booking reference
 *
 * @example
 * formatBookingNumber('RZ-20240115-001') // "RZ-20240115-001"
 */
export function formatBookingNumber(bookingNumber: string): string {
  if (!bookingNumber) return '';
  return bookingNumber.toUpperCase();
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse various date formats to Date object
 *
 * @param date - Date to parse
 * @returns Date object or null
 */
function parseDate(date: string | Date | number): Date | null {
  if (!date) return null;

  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof date === 'number') {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? null : parsed;
}

// =============================================================================
// Exports
// =============================================================================

export const formatting = {
  currency: formatCurrency,
  currencySimple: formatCurrencySimple,
  bookingPrice: formatBookingPrice,
  bookingPriceWithOptions: formatBookingPriceWithOptions,
  date: formatDate,
  time: formatTime,
  dateTime: formatDateTime,
  relativeTime: formatRelativeTime,
  duration: formatDuration,
  dateRange: formatDateRange,
  phone: formatPhone,
  phoneInternational: formatPhoneInternational,
  truncate,
  capitalizeWords,
  name: formatName,
  percentage: formatPercentage,
  number: formatNumber,
  fileSize: formatFileSize,
  ratingStars: formatRatingStars,
  address: formatAddress,
  distance: formatDistance,
  bookingNumber: formatBookingNumber,
};

export default formatting;
