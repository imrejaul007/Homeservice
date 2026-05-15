export interface TimezoneConfig {
  identifier: string;
  offset: string;
  displayName: string;
  region: string;
  country?: string;
}

export interface TimezoneConversion {
  originalDate: Date;
  convertedDate: Date;
  fromTimezone: string;
  toTimezone: string;
  originalOffset: string;
  convertedOffset: string;
}

export interface TimezoneInfo {
  timezone: string;
  offset: string;
  abbreviation: string;
  isDST: boolean;
  dstOffset: number;
  standardOffset: number;
  nextTransition?: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
  timezone: string;
}

export const SUPPORTED_TIMEZONES: TimezoneConfig[] = [
  { identifier: 'UTC', offset: '+00:00', displayName: 'UTC (Coordinated Universal Time)', region: 'global' },
  { identifier: 'America/New_York', offset: '-05:00', displayName: 'Eastern Time (US & Canada)', region: 'north_america' },
  { identifier: 'America/Chicago', offset: '-06:00', displayName: 'Central Time (US & Canada)', region: 'north_america' },
  { identifier: 'America/Denver', offset: '-07:00', displayName: 'Mountain Time (US & Canada)', region: 'north_america' },
  { identifier: 'America/Los_Angeles', offset: '-08:00', displayName: 'Pacific Time (US & Canada)', region: 'north_america' },
  { identifier: 'America/Anchorage', offset: '-09:00', displayName: 'Alaska', region: 'north_america' },
  { identifier: 'Pacific/Honolulu', offset: '-10:00', displayName: 'Hawaii', region: 'north_america' },
  { identifier: 'America/Toronto', offset: '-05:00', displayName: 'Eastern Time (Canada)', region: 'north_america', country: 'CA' },
  { identifier: 'America/Vancouver', offset: '-08:00', displayName: 'Pacific Time (Canada)', region: 'north_america', country: 'CA' },
  { identifier: 'America/Mexico_City', offset: '-06:00', displayName: 'Mexico City', region: 'north_america', country: 'MX' },
  { identifier: 'Europe/London', offset: '+00:00', displayName: 'London', region: 'europe' },
  { identifier: 'Europe/Paris', offset: '+01:00', displayName: 'Paris', region: 'europe' },
  { identifier: 'Europe/Berlin', offset: '+01:00', displayName: 'Berlin', region: 'europe' },
  { identifier: 'Europe/Amsterdam', offset: '+01:00', displayName: 'Amsterdam', region: 'europe' },
  { identifier: 'Europe/Rome', offset: '+01:00', displayName: 'Rome', region: 'europe' },
  { identifier: 'Europe/Madrid', offset: '+01:00', displayName: 'Madrid', region: 'europe' },
  { identifier: 'Europe/Brussels', offset: '+01:00', displayName: 'Brussels', region: 'europe' },
  { identifier: 'Europe/Vienna', offset: '+01:00', displayName: 'Vienna', region: 'europe' },
  { identifier: 'Europe/Stockholm', offset: '+01:00', displayName: 'Stockholm', region: 'europe' },
  { identifier: 'Europe/Warsaw', offset: '+01:00', displayName: 'Warsaw', region: 'europe' },
  { identifier: 'Europe/Athens', offset: '+02:00', displayName: 'Athens', region: 'europe' },
  { identifier: 'Europe/Moscow', offset: '+03:00', displayName: 'Moscow', region: 'europe' },
  { identifier: 'Europe/Istanbul', offset: '+03:00', displayName: 'Istanbul', region: 'europe' },
  { identifier: 'Asia/Dubai', offset: '+04:00', displayName: 'Dubai', region: 'middle_east' },
  { identifier: 'Asia/Riyadh', offset: '+03:00', displayName: 'Riyadh', region: 'middle_east' },
  { identifier: 'Asia/Doha', offset: '+03:00', displayName: 'Doha', region: 'middle_east' },
  { identifier: 'Asia/Kuwait', offset: '+03:00', displayName: 'Kuwait City', region: 'middle_east' },
  { identifier: 'Asia/Manila', offset: '+08:00', displayName: 'Manila', region: 'asia' },
  { identifier: 'Asia/Jakarta', offset: '+07:00', displayName: 'Jakarta', region: 'asia' },
  { identifier: 'Asia/Bangkok', offset: '+07:00', displayName: 'Bangkok', region: 'asia' },
  { identifier: 'Asia/Ho_Chi_Minh', offset: '+07:00', displayName: 'Ho Chi Minh City', region: 'asia' },
  { identifier: 'Asia/Singapore', offset: '+08:00', displayName: 'Singapore', region: 'asia' },
  { identifier: 'Asia/Hong_Kong', offset: '+08:00', displayName: 'Hong Kong', region: 'asia' },
  { identifier: 'Asia/Shanghai', offset: '+08:00', displayName: 'Shanghai', region: 'asia' },
  { identifier: 'Asia/Beijing', offset: '+08:00', displayName: 'Beijing', region: 'asia' },
  { identifier: 'Asia/Tokyo', offset: '+09:00', displayName: 'Tokyo', region: 'asia' },
  { identifier: 'Asia/Seoul', offset: '+09:00', displayName: 'Seoul', region: 'asia' },
  { identifier: 'Asia/Taipei', offset: '+08:00', displayName: 'Taipei', region: 'asia' },
  { identifier: 'Asia/Kolkata', offset: '+05:30', displayName: 'India (IST)', region: 'asia', country: 'IN' },
  { identifier: 'Asia/Kathmandu', offset: '+05:45', displayName: 'Kathmandu', region: 'asia' },
  { identifier: 'Australia/Sydney', offset: '+11:00', displayName: 'Sydney', region: 'oceania', country: 'AU' },
  { identifier: 'Australia/Melbourne', offset: '+11:00', displayName: 'Melbourne', region: 'oceania', country: 'AU' },
  { identifier: 'Australia/Perth', offset: '+08:00', displayName: 'Perth', region: 'oceania', country: 'AU' },
  { identifier: 'Pacific/Auckland', offset: '+13:00', displayName: 'Auckland', region: 'oceania' },
  { identifier: 'Africa/Cairo', offset: '+02:00', displayName: 'Cairo', region: 'africa', country: 'EG' },
  { identifier: 'Africa/Lagos', offset: '+01:00', displayName: 'Lagos', region: 'africa' },
  { identifier: 'Africa/Johannesburg', offset: '+02:00', displayName: 'Johannesburg', region: 'africa' },
  { identifier: 'Africa/Nairobi', offset: '+03:00', displayName: 'Nairobi', region: 'africa' },
  { identifier: 'America/Sao_Paulo', offset: '-03:00', displayName: 'Sao Paulo', region: 'south_america', country: 'BR' },
  { identifier: 'America/Buenos_Aires', offset: '-03:00', displayName: 'Buenos Aires', region: 'south_america' },
  { identifier: 'America/Santiago', offset: '-04:00', displayName: 'Santiago', region: 'south_america' },
  { identifier: 'America/Bogota', offset: '-05:00', displayName: 'Bogota', region: 'south_america' },
  { identifier: 'America/Lima', offset: '-05:00', displayName: 'Lima', region: 'south_america' },
];

export const REGION_LABELS: Record<string, string> = {
  global: 'Global',
  north_america: 'North America',
  south_america: 'South America',
  europe: 'Europe',
  middle_east: 'Middle East',
  asia: 'Asia',
  africa: 'Africa',
  oceania: 'Oceania',
};

export const LOCALE_TO_TIMEZONE: Record<string, string> = {
  'en-US': 'America/New_York',
  'en-GB': 'Europe/London',
  'en-AU': 'Australia/Sydney',
  'en-CA': 'America/Toronto',
  'de-DE': 'Europe/Berlin',
  'de-AT': 'Europe/Vienna',
  'de-CH': 'Europe/Zurich',
  'fr-FR': 'Europe/Paris',
  'fr-CA': 'America/Montreal',
  'fr-CH': 'Europe/Zurich',
  'es-ES': 'Europe/Madrid',
  'es-MX': 'America/Mexico_City',
  'ar-AE': 'Asia/Dubai',
  'ar-SA': 'Asia/Riyadh',
  'ar-KW': 'Asia/Kuwait',
  'ar-QA': 'Asia/Qatar',
  'ar-EG': 'Africa/Cairo',
  'zh-CN': 'Asia/Shanghai',
  'zh-TW': 'Asia/Taipei',
  'ja-JP': 'Asia/Tokyo',
  'ko-KR': 'Asia/Seoul',
  'hi-IN': 'Asia/Kolkata',
  'pt-BR': 'America/Sao_Paulo',
  'ru-RU': 'Europe/Moscow',
  'th-TH': 'Asia/Bangkok',
  'nl-NL': 'Europe/Amsterdam',
  'pl-PL': 'Europe/Warsaw',
  'tr-TR': 'Europe/Istanbul',
};

export const DEFAULT_TIMEZONE = 'UTC';

class TimezoneService {
  private defaultTimezone: string;
  private cache: Map<string, { info: TimezoneInfo; timestamp: number }>;
  private cacheExpiry: number;

  constructor() {
    this.defaultTimezone = DEFAULT_TIMEZONE;
    this.cache = new Map();
    this.cacheExpiry = 60 * 60 * 1000;
  }

  public getDefaultTimezone(): string {
    return this.defaultTimezone;
  }

  public setDefaultTimezone(timezone: string): void {
    if (this.isValidTimezone(timezone)) {
      this.defaultTimezone = timezone;
    } else {
      throw new Error(`Invalid timezone: ${timezone}`);
    }
  }

  public isValidTimezone(timezone: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }

  public getSupportedTimezones(): TimezoneConfig[] {
    return SUPPORTED_TIMEZONES;
  }

  public getSupportedTimezoneIdentifiers(): string[] {
    return SUPPORTED_TIMEZONES.map((tz) => tz.identifier);
  }

  public getTimezoneConfig(timezone: string): TimezoneConfig | undefined {
    return SUPPORTED_TIMEZONES.find((tz) => tz.identifier === timezone);
  }

  public getTimezonesByRegion(region: string): TimezoneConfig[] {
    return SUPPORTED_TIMEZONES.filter((tz) => tz.region === region);
  }

  public getTimezonesByCountry(country: string): TimezoneConfig[] {
    return SUPPORTED_TIMEZONES.filter((tz) => tz.country === country);
  }

  public getTimezoneInfo(timezone: string, date?: Date): TimezoneInfo {
    const cacheKey = `${timezone}-${date?.toISOString().slice(0, 13) || 'current'}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.info;
    }

    const tz = timezone || this.defaultTimezone;
    const targetDate = date || new Date();

    const offsetString = this.getOffsetString(tz, targetDate);
    const abbreviation = this.getAbbreviation(tz, targetDate);
    const isDST = this.isDST(tz, targetDate);
    const { dstOffset, standardOffset } = this.getOffsets(tz, targetDate);
    const nextTransition = this.getNextTransition(tz, targetDate);

    const info: TimezoneInfo = {
      timezone: tz,
      offset: offsetString,
      abbreviation,
      isDST,
      dstOffset,
      standardOffset,
      nextTransition,
    };

    this.cache.set(cacheKey, { info, timestamp: Date.now() });

    return info;
  }

  public getOffsetString(timezone: string, date?: Date): string {
    const tz = timezone || this.defaultTimezone;
    const targetDate = date || new Date();

    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset',
    });

    const parts = formatter.formatToParts(targetDate);
    const offsetPart = parts.find((part) => part.type === 'timeZoneName');
    return offsetPart?.value || '+00:00';
  }

  public getOffsetMinutes(timezone: string, date?: Date): number {
    const tz = timezone || this.defaultTimezone;
    const targetDate = date || new Date();

    const utcDate = new Date(targetDate.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(targetDate.toLocaleString('en-US', { timeZone: tz }));
    return (tzDate.getTime() - utcDate.getTime()) / (1000 * 60);
  }

  public getAbbreviation(timezone: string, date?: Date): string {
    const tz = timezone || this.defaultTimezone;
    const targetDate = date || new Date();

    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'short',
    });

    const parts = formatter.formatToParts(targetDate);
    const tzPart = parts.find((part) => part.type === 'timeZoneName');
    return tzPart?.value || 'UTC';
  }

  public isDST(timezone: string, date?: Date): boolean {
    const tz = timezone || this.defaultTimezone;
    const targetDate = date || new Date();

    const january = new Date(targetDate.getFullYear(), 0, 1);
    const july = new Date(targetDate.getFullYear(), 6, 1);

    const janOffset = this.getOffsetMinutes(tz, january);
    const julOffset = this.getOffsetMinutes(tz, july);
    const currentOffset = this.getOffsetMinutes(tz, targetDate);

    const standardOffset = Math.min(janOffset, julOffset);
    const dstOffset = Math.max(janOffset, julOffset);

    return currentOffset === dstOffset && dstOffset !== standardOffset;
  }

  private getOffsets(timezone: string, date?: Date): { dstOffset: number; standardOffset: number } {
    const tz = timezone || this.defaultTimezone;
    const targetDate = date || new Date();
    const year = targetDate.getFullYear();

    const january = new Date(year, 0, 1);
    const july = new Date(year, 6, 1);

    return {
      dstOffset: this.getOffsetMinutes(tz, july),
      standardOffset: this.getOffsetMinutes(tz, january),
    };
  }

  private getNextTransition(timezone: string, date?: Date): Date | undefined {
    const tz = timezone || this.defaultTimezone;
    const targetDate = date || new Date();
    const year = targetDate.getFullYear();

    const january = new Date(year, 0, 1);
    const july = new Date(year, 6, 1);

    const janOffset = this.getOffsetMinutes(tz, january);
    const julOffset = this.getOffsetMinutes(tz, july);

    const springOffset = Math.max(janOffset, julOffset);
    const fallOffset = Math.min(janOffset, julOffset);

    const isNorthern = janOffset !== julOffset && janOffset < julOffset;

    let springDate: Date;
    let fallDate: Date;

    if (isNorthern) {
      springDate = this.findDSTTransition(tz, new Date(year, 2, 1), new Date(year, 3, 1), springOffset);
      fallDate = this.findDSTTransition(tz, new Date(year, 9, 1), new Date(year, 10, 1), fallOffset);
    } else {
      springDate = this.findDSTTransition(tz, new Date(year, 7, 1), new Date(year, 10, 1), springOffset);
      fallDate = this.findDSTTransition(tz, new Date(year, 1, 1), new Date(year, 4, 1), fallOffset);
    }

    const candidates = [springDate, fallDate].filter((d) => d > targetDate);
    if (candidates.length === 0) return undefined;

    return candidates.sort((a, b) => a.getTime() - b.getTime())[0];
  }

  private findDSTTransition(
    timezone: string,
    start: Date,
    end: Date,
    targetOffset: number
  ): Date {
    let low = start;
    let high = end;

    while (low.getTime() < high.getTime() - 60000) {
      const mid = new Date(low.getTime() + (high.getTime() - low.getTime()) / 2);
      const midOffset = this.getOffsetMinutes(timezone, mid);

      if (midOffset === targetOffset) {
        return mid;
      } else if (midOffset < targetOffset) {
        low = new Date(mid.getTime() + 60000);
      } else {
        high = new Date(mid.getTime() - 60000);
      }
    }

    return low;
  }

  public convert(date: Date | string, fromTimezone: string, toTimezone: string): TimezoneConversion {
    const sourceTz = fromTimezone || this.defaultTimezone;
    const targetTz = toTimezone || this.defaultTimezone;
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);

    const sourceOffset = this.getOffsetMinutes(sourceTz, dateObj);
    const targetOffset = this.getOffsetMinutes(targetTz, dateObj);
    const diffMinutes = targetOffset - sourceOffset;

    const convertedDate = new Date(dateObj.getTime() + diffMinutes * 60 * 1000);

    return {
      originalDate: dateObj,
      convertedDate,
      fromTimezone: sourceTz,
      toTimezone: targetTz,
      originalOffset: this.getOffsetString(sourceTz, dateObj),
      convertedOffset: this.getOffsetString(targetTz, convertedDate),
    };
  }

  public toUTC(date: Date | string, fromTimezone?: string): Date {
    const sourceTz = fromTimezone || this.defaultTimezone;
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);

    const offset = this.getOffsetMinutes(sourceTz, dateObj);
    return new Date(dateObj.getTime() - offset * 60 * 1000);
  }

  public fromUTC(date: Date | string, toTimezone?: string): Date {
    const targetTz = toTimezone || this.defaultTimezone;
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);

    const offset = this.getOffsetMinutes(targetTz, dateObj);
    return new Date(dateObj.getTime() + offset * 60 * 1000);
  }

  public toTimezone(date: Date | string, targetTimezone: string): Date {
    return this.convert(date, 'UTC', targetTimezone).convertedDate;
  }

  public normalize(date: Date | string, timezone?: string): Date {
    const tz = timezone || this.defaultTimezone;
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
    return this.toUTC(this.fromUTC(dateObj, tz), 'UTC');
  }

  public format(date: Date | string, timezone?: string, options?: Intl.DateTimeFormatOptions): string {
    const tz = timezone || this.defaultTimezone;
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);

    const defaultOptions: Intl.DateTimeFormatOptions = {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };

    return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(dateObj);
  }

  public formatRelative(date: Date | string, timezone?: string, locale?: string): string {
    const tz = timezone || this.defaultTimezone;
    const localeCode = locale || 'en-US';
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
    const now = new Date();

    const diffMs = now.getTime() - dateObj.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (Math.abs(diffSec) < 60) {
      return 'just now';
    }
    if (Math.abs(diffMin) < 60) {
      return `${diffMin} minute${diffMin === 1 ? '' : 's'} ${diffMin < 0 ? 'from now' : 'ago'}`;
    }
    if (Math.abs(diffHour) < 24) {
      return `${diffHour} hour${diffHour === 1 ? '' : 's'} ${diffHour < 0 ? 'from now' : 'ago'}`;
    }
    if (Math.abs(diffDay) < 7) {
      return `${diffDay} day${diffDay === 1 ? '' : 's'} ${diffDay < 0 ? 'from now' : 'ago'}`;
    }

    return this.format(dateObj, tz, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  public getTimezoneForLocale(locale: string): string {
    return LOCALE_TO_TIMEZONE[locale] || this.defaultTimezone;
  }

  public getTimezoneForOffset(offset: string): string[] {
    return SUPPORTED_TIMEZONES.filter((tz) => tz.offset === offset).map((tz) => tz.identifier);
  }

  public getNearbyTimezones(identifier: string, limit: number = 5): string[] {
    const config = this.getTimezoneConfig(identifier);
    if (!config) return [];

    const targetOffset = config.offset;
    const sameOffset = SUPPORTED_TIMEZONES
      .filter((tz) => tz.offset === targetOffset && tz.identifier !== identifier)
      .map((tz) => tz.identifier);

    return sameOffset.slice(0, limit);
  }

  public getBusinessHours(
    timezone: string,
    options: {
      startHour?: number;
      endHour?: number;
      workDays?: number[];
      referenceDate?: Date;
    } = {}
  ): DateRange {
    const tz = timezone || this.defaultTimezone;
    const { startHour = 9, endHour = 17, workDays = [1, 2, 3, 4, 5], referenceDate = new Date() } = options;

    const now = this.fromUTC(referenceDate, tz);
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    let daysToAdd = 0;
    while (!workDays.includes((currentDay + daysToAdd) % 7)) {
      daysToAdd++;
    }

    if (currentDay !== (currentDay + daysToAdd) % 7 || currentHour < startHour) {
      daysToAdd = 0;
    }

    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + daysToAdd);
    startDate.setHours(startHour, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setHours(endHour, 0, 0, 0);

    return {
      start: this.toUTC(startDate, tz),
      end: this.toUTC(endDate, tz),
      timezone: tz,
    };
  }

  public isBusinessHours(
    timezone: string,
    options: {
      startHour?: number;
      endHour?: number;
      workDays?: number[];
      referenceDate?: Date;
    } = {}
  ): boolean {
    const tz = timezone || this.defaultTimezone;
    const { startHour = 9, endHour = 17, workDays = [1, 2, 3, 4, 5], referenceDate = new Date() } = options;

    const localDate = this.fromUTC(referenceDate, tz);
    const dayOfWeek = localDate.getDay();
    const hour = localDate.getHours();

    if (!workDays.includes(dayOfWeek)) {
      return false;
    }

    return hour >= startHour && hour < endHour;
  }

  public addBusinessDays(startDate: Date, days: number, timezone?: string): Date {
    const tz = timezone || this.defaultTimezone;
    let current = this.fromUTC(startDate, tz);
    let remainingDays = days;

    while (remainingDays > 0) {
      current.setDate(current.getDate() + 1);
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        remainingDays--;
      }
    }

    return this.toUTC(current, tz);
  }

  public getStartOfDay(date: Date | string, timezone?: string): Date {
    const tz = timezone || this.defaultTimezone;
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
    const localDate = this.fromUTC(dateObj, tz);

    localDate.setHours(0, 0, 0, 0);

    return this.toUTC(localDate, tz);
  }

  public getEndOfDay(date: Date | string, timezone?: string): Date {
    const tz = timezone || this.defaultTimezone;
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
    const localDate = this.fromUTC(dateObj, tz);

    localDate.setHours(23, 59, 59, 999);

    return this.toUTC(localDate, tz);
  }

  public getStartOfWeek(date: Date | string, timezone?: string, weekStartsOn: number = 1): Date {
    const tz = timezone || this.defaultTimezone;
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
    const localDate = this.fromUTC(dateObj, tz);

    const day = localDate.getDay();
    const diff = (day < weekStartsOn ? 7 : 0) + day - weekStartsOn;

    localDate.setDate(localDate.getDate() - diff);
    localDate.setHours(0, 0, 0, 0);

    return this.toUTC(localDate, tz);
  }

  public getStartOfMonth(date: Date | string, timezone?: string): Date {
    const tz = timezone || this.defaultTimezone;
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
    const localDate = this.fromUTC(dateObj, tz);

    localDate.setDate(1);
    localDate.setHours(0, 0, 0, 0);

    return this.toUTC(localDate, tz);
  }

  public getEndOfMonth(date: Date | string, timezone?: string): Date {
    const tz = timezone || this.defaultTimezone;
    const dateObj = typeof date === 'string' ? new Date(date) : new Date(date);
    const localDate = this.fromUTC(dateObj, tz);

    localDate.setMonth(localDate.getMonth() + 1, 0);
    localDate.setHours(23, 59, 59, 999);

    return this.toUTC(localDate, tz);
  }

  public diffInDays(date1: Date | string, date2: Date | string, timezone?: string): number {
    const tz = timezone || this.defaultTimezone;
    const start = this.getStartOfDay(date1, tz);
    const end = this.getStartOfDay(date2, tz);
    return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }

  public diffInHours(date1: Date | string, date2: Date | string, timezone?: string): number {
    const tz = timezone || this.defaultTimezone;
    const local1 = this.fromUTC(date1, tz);
    const local2 = this.fromUTC(date2, tz);
    return Math.floor((local2.getTime() - local1.getTime()) / (1000 * 60 * 60));
  }

  public diffInMinutes(date1: Date | string, date2: Date | string, timezone?: string): number {
    const tz = timezone || this.defaultTimezone;
    const local1 = this.fromUTC(date1, tz);
    const local2 = this.fromUTC(date2, tz);
    return Math.floor((local2.getTime() - local1.getTime()) / (1000 * 60));
  }

  public clearCache(): void {
    this.cache.clear();
  }
}

export const timezoneService = new TimezoneService();
export default timezoneService;
