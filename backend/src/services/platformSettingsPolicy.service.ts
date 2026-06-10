import type { IPlatformSettings } from '../models/settings.model';
import { getSettings, invalidateSettingsCache } from './settings.service';
import logger from '../utils/logger';

/** Runtime snapshot of platform settings used across the app */
export interface PlatformPolicySnapshot {
  platformName: string;
  platformLogo: string;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  supportEmail: string;
  supportPhone: string;
  currency: string;
  dateFormat: string;
  language: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  commissionRate: number;
  paymentProcessingFee: number;
  minimumWithdrawalAmount: number;
  platformFeeType: 'percentage' | 'fixed' | 'both';
  taxRate: number;
  weekendRates: number;
  holidayRates: number;
  defaultBookingBufferMinutes: number;
  cancellationWindowHours: number;
  autoAssignmentEnabled: boolean;
  autoConfirmEnabled: boolean;
  instantBooking: boolean;
  maxBookingAdvanceDays: number;
  minBookingAdvanceHours: number;
  maxDailyBookings: number;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  notificationSounds: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  require2FA: boolean;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  passwordRequireSpecialChar: boolean;
  passwordRequireNumber: boolean;
  passwordRequireUppercase: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  enableFAQ: boolean;
  enableAuditLogs: boolean;
  ipAllowlist: string[];
  backupEnabled: boolean;
  backupCloudStorage: 'none' | 'aws' | 'gcp' | 'azure';
  backupRetentionDays: number;
  cacheTTLSeconds: number;
  rateLimitRequestsPerMinute: number;
  apiRateLimitPerHour: number;
  maxFileUploadSizeMB: number;
  allowedFileTypes: string[];
}

export const DEFAULT_PLATFORM_POLICY: PlatformPolicySnapshot = {
  platformName: 'Homeservice',
  platformLogo: '',
  favicon: '',
  primaryColor: '#E8B4A8',
  secondaryColor: '#D4A89A',
  supportEmail: 'support@homeservice.com',
  supportPhone: '',
  currency: 'AED',
  dateFormat: 'DD/MM/YYYY',
  language: 'en',
  maintenanceMode: false,
  maintenanceMessage: '',
  commissionRate: 15,
  paymentProcessingFee: 2.9,
  minimumWithdrawalAmount: 50,
  platformFeeType: 'percentage',
  taxRate: 5,
  weekendRates: 0,
  holidayRates: 0,
  defaultBookingBufferMinutes: 30,
  cancellationWindowHours: 24,
  autoAssignmentEnabled: false,
  autoConfirmEnabled: false,
  instantBooking: false,
  maxBookingAdvanceDays: 30,
  minBookingAdvanceHours: 2,
  maxDailyBookings: 5,
  emailNotificationsEnabled: true,
  smsNotificationsEnabled: true,
  pushNotificationsEnabled: true,
  notificationSounds: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  require2FA: false,
  sessionTimeoutMinutes: 480,
  passwordMinLength: 8,
  passwordRequireSpecialChar: true,
  passwordRequireNumber: true,
  passwordRequireUppercase: true,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 30,
  enableFAQ: true,
  enableAuditLogs: true,
  ipAllowlist: [],
  backupEnabled: false,
  backupCloudStorage: 'none',
  backupRetentionDays: 30,
  cacheTTLSeconds: 300,
  rateLimitRequestsPerMinute: 100,
  apiRateLimitPerHour: 1000,
  maxFileUploadSizeMB: 10,
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
};

let memoryPolicy: PlatformPolicySnapshot = { ...DEFAULT_PLATFORM_POLICY };

export function mapSettingsToPolicy(settings: Partial<IPlatformSettings>): PlatformPolicySnapshot {
  return {
    platformName: settings.platformName ?? DEFAULT_PLATFORM_POLICY.platformName,
    platformLogo: settings.platformLogo ?? '',
    favicon: settings.favicon ?? '',
    primaryColor: settings.primaryColor ?? DEFAULT_PLATFORM_POLICY.primaryColor,
    secondaryColor: settings.secondaryColor ?? DEFAULT_PLATFORM_POLICY.secondaryColor,
    supportEmail: settings.supportEmail ?? DEFAULT_PLATFORM_POLICY.supportEmail,
    supportPhone: settings.supportPhone ?? '',
    currency: settings.currency ?? DEFAULT_PLATFORM_POLICY.currency,
    dateFormat: settings.dateFormat ?? DEFAULT_PLATFORM_POLICY.dateFormat,
    language: settings.language ?? DEFAULT_PLATFORM_POLICY.language,
    maintenanceMode: Boolean(settings.maintenanceMode),
    maintenanceMessage: settings.maintenanceMessage ?? '',
    commissionRate: settings.commissionRate ?? DEFAULT_PLATFORM_POLICY.commissionRate,
    paymentProcessingFee: settings.paymentProcessingFee ?? DEFAULT_PLATFORM_POLICY.paymentProcessingFee,
    minimumWithdrawalAmount: settings.minimumWithdrawalAmount ?? DEFAULT_PLATFORM_POLICY.minimumWithdrawalAmount,
    platformFeeType: settings.platformFeeType ?? DEFAULT_PLATFORM_POLICY.platformFeeType,
    taxRate: settings.taxRate ?? DEFAULT_PLATFORM_POLICY.taxRate,
    weekendRates: settings.weekendRates ?? 0,
    holidayRates: settings.holidayRates ?? 0,
    defaultBookingBufferMinutes: settings.defaultBookingBufferMinutes ?? 30,
    cancellationWindowHours: settings.cancellationWindowHours ?? 24,
    autoAssignmentEnabled: Boolean(settings.autoAssignmentEnabled),
    autoConfirmEnabled: Boolean(settings.autoConfirmEnabled),
    instantBooking: Boolean(settings.instantBooking),
    maxBookingAdvanceDays: settings.maxBookingAdvanceDays ?? 30,
    minBookingAdvanceHours: settings.minBookingAdvanceHours ?? 2,
    maxDailyBookings: settings.maxDailyBookings ?? 5,
    emailNotificationsEnabled: settings.emailNotificationsEnabled !== false,
    smsNotificationsEnabled: settings.smsNotificationsEnabled !== false,
    pushNotificationsEnabled: settings.pushNotificationsEnabled !== false,
    notificationSounds: settings.notificationSounds !== false,
    quietHoursEnabled: Boolean(settings.quietHoursEnabled),
    quietHoursStart: settings.quietHoursStart ?? '22:00',
    quietHoursEnd: settings.quietHoursEnd ?? '08:00',
    require2FA: Boolean(settings.require2FA),
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes ?? 480,
    passwordMinLength: settings.passwordMinLength ?? 8,
    passwordRequireSpecialChar: settings.passwordRequireSpecialChar !== false,
    passwordRequireNumber: settings.passwordRequireNumber !== false,
    passwordRequireUppercase: settings.passwordRequireUppercase !== false,
    maxLoginAttempts: settings.maxLoginAttempts ?? 5,
    lockoutDurationMinutes: settings.lockoutDurationMinutes ?? 30,
    enableFAQ: settings.enableFAQ !== false,
    enableAuditLogs: settings.enableAuditLogs !== false,
    ipAllowlist: settings.ipAllowlist ?? [],
    backupEnabled: Boolean(settings.backupEnabled),
    backupCloudStorage: settings.backupCloudStorage ?? 'none',
    backupRetentionDays: settings.backupRetentionDays ?? 30,
    cacheTTLSeconds: settings.cacheTTLSeconds ?? 300,
    rateLimitRequestsPerMinute: settings.rateLimitRequestsPerMinute ?? 100,
    apiRateLimitPerHour: settings.apiRateLimitPerHour ?? 1000,
    maxFileUploadSizeMB: settings.maxFileUploadSizeMB ?? 10,
    allowedFileTypes: settings.allowedFileTypes?.length
      ? settings.allowedFileTypes
      : DEFAULT_PLATFORM_POLICY.allowedFileTypes,
  };
}

/** Synchronous access — call refreshPlatformPolicy() on boot and after settings changes */
export function getPlatformPolicySync(): PlatformPolicySnapshot {
  return memoryPolicy;
}

export function applyPolicyFromSettings(settings: Partial<IPlatformSettings>): PlatformPolicySnapshot {
  memoryPolicy = mapSettingsToPolicy(settings);
  return memoryPolicy;
}

export async function refreshPlatformPolicy(
  settingsOverride?: Partial<IPlatformSettings>
): Promise<PlatformPolicySnapshot> {
  try {
    const policy = settingsOverride
      ? applyPolicyFromSettings(settingsOverride)
      : applyPolicyFromSettings(await getSettings(false));
    logger.debug('Platform policy refreshed from settings', {
      action: 'PLATFORM_POLICY_REFRESH',
      cacheTTLSeconds: policy.cacheTTLSeconds,
    });
    return policy;
  } catch (error) {
    logger.warn('Failed to refresh platform policy, using in-memory defaults', { error });
    return memoryPolicy;
  }
}

export async function invalidatePlatformPolicy(): Promise<void> {
  await invalidateSettingsCache();
  await refreshPlatformPolicy();
}

/** Platform quiet hours (UTC-based HH:mm comparison) */
export function isPlatformQuietHours(now = new Date(), policy = getPlatformPolicySync()): boolean {
  if (!policy.quietHoursEnabled) return false;

  const toMinutes = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const current = now.getUTCHours() * 60 + now.getUTCMinutes();
  const start = toMinutes(policy.quietHoursStart);
  const end = toMinutes(policy.quietHoursEnd);

  if (start <= end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

export function isChannelEnabledByPlatform(
  channel: 'email' | 'sms' | 'push',
  policy = getPlatformPolicySync()
): boolean {
  switch (channel) {
    case 'email':
      return policy.emailNotificationsEnabled;
    case 'sms':
      return policy.smsNotificationsEnabled;
    case 'push':
      return policy.pushNotificationsEnabled;
    default:
      return true;
  }
}

/**
 * Normalize any IPv6 representation of an IPv4 address to standard dotted-decimal format.
 * Handles:
 * - ::ffff:192.168.1.1 (IPv4-mapped IPv6 with decimal)
 * - ::ffff:c0a8:0101 (IPv4-mapped IPv6 with hex - last 32 bits of address)
 * - 2001:db8::192.168.1.1 (IPv4-compatible IPv6 with embedded IPv4)
 * - 64:ff9b::192.168.1.1 (IPv4/IPv6 translation prefix)
 * - ::192.168.1.1 (IPv4-compatible short form)
 * - 0:0:0:0:0:ffff:192.168.1.1 (full form)
 * Returns null for pure IPv6 addresses that are not IPv4 representations.
 */
function normalizeIPv6ToIPv4(ip: string): string | null {
  const trimmed = ip.trim();

  // Pattern 1: IPv6 with embedded IPv4 at the end (e.g., 2001:db8::192.168.1.1)
  const embeddedIPv4Match = trimmed.match(/^([0-9a-fA-F:]+):(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (embeddedIPv4Match) {
    const ipv4Part = embeddedIPv4Match[2];
    // Validate the IPv4 part
    const octets = ipv4Part.split('.').map(Number);
    if (octets.length === 4 && octets.every((o) => o >= 0 && o <= 255)) {
      return ipv4Part;
    }
  }

  // Pattern 2: IPv4-mapped IPv6 (e.g., ::ffff:192.168.1.1 or ::ffff:c0a8:0101)
  const mappedV6Match = trimmed.match(/^([0-9a-fA-F:]+:)?(ffff:)?([0-9a-fA-F]{1,4}):([0-9a-fA-F]{1,4})$/i);
  if (mappedV6Match) {
    const hex1 = mappedV6Match[3];
    const hex2 = mappedV6Match[4];
    // Check if it's hex form (c0a8:0101) - needs conversion
    if (hex1.match(/^[0-9a-fA-F]+$/i) && hex2.match(/^[0-9a-fA-F]+$/i)) {
      const fullHex = hex1 + hex2;
      if (fullHex.length === 8) {
        // Convert 8 hex digits to 4 decimal octets
        // c0a80101 -> c0 a8 01 01 -> 192.168.1.1
        const oct1 = parseInt(fullHex.slice(0, 2), 16);
        const oct2 = parseInt(fullHex.slice(2, 4), 16);
        const oct3 = parseInt(fullHex.slice(4, 6), 16);
        const oct4 = parseInt(fullHex.slice(6, 8), 16);
        if (!isNaN(oct1) && !isNaN(oct2) && !isNaN(oct3) && !isNaN(oct4)) {
          return `${oct1}.${oct2}.${oct3}.${oct4}`;
        }
      }
    }
  }

  // Pattern 3: ::ffff: prefix with dotted-decimal (e.g., ::ffff:192.168.1.1)
  if (trimmed.startsWith('::ffff:')) {
    const inner = trimmed.substring(7);
    const octets = inner.split('.').map(Number);
    if (octets.length === 4 && octets.every((o) => o >= 0 && o <= 255)) {
      return inner;
    }
  }

  // Pattern 4: IPv4-compatible IPv6 without ffff (e.g., ::192.168.1.1)
  // These start with :: followed by an IPv4
  if (trimmed.startsWith('::') && !trimmed.startsWith('::ffff:')) {
    const afterPrefix = trimmed.substring(2);
    // Check if remaining part looks like an IPv4
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(afterPrefix)) {
      const octets = afterPrefix.split('.').map(Number);
      if (octets.every((o) => o >= 0 && o <= 255)) {
        return afterPrefix;
      }
    }
  }

  return null;
}

/**
 * Normalize an IP address for consistent comparison.
 * Converts all IPv6 representations of IPv4 addresses to standard dotted-decimal format.
 */
function normalizeIpAddress(ip: string): string {
  // First check if it's an IPv6 representation of IPv4
  const ipv4FromV6 = normalizeIPv6ToIPv4(ip);
  if (ipv4FromV6) {
    return ipv4FromV6;
  }
  // For pure IPv4, validate and return trimmed
  const octets = ip.trim().split('.').map(Number);
  if (octets.length === 4 && octets.every((o) => o >= 0 && o <= 255)) {
    return ip.trim();
  }
  // For pure IPv6 (not an IPv4 representation), return as-is
  return ip.trim();
}

/**
 * Parse a CIDR notation string and check if an IP address is within the range.
 * Supports both IPv4 and IPv6 CIDR notation.
 */
function isIpInCidrRange(ip: string, cidr: string): boolean {
  const [range, prefixLengthStr] = cidr.split('/');

  // If no prefix length, treat as exact match
  if (!prefixLengthStr) {
    return ip === range;
  }

  const prefixLength = parseInt(prefixLengthStr, 10);
  if (isNaN(prefixLength)) return false;

  // IPv4 CIDR (e.g., 192.168.1.0/24)
  if (ip.includes('.') && range.includes('.')) {
    if (prefixLength < 0 || prefixLength > 32) return false;

    const ipParts = ip.split('.').map(Number);
    const rangeParts = range.split('.').map(Number);

    if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
    if (ipParts.some((o) => o < 0 || o > 255) || rangeParts.some((o) => o < 0 || o > 255)) return false;

    if (prefixLength === 32) {
      return ip === range;
    }

    if (prefixLength === 0) {
      return true;
    }

    // Create subnet mask and compare using unsigned 32-bit integers
    const mask = prefixLength === 0 ? 0 : (~0 << (32 - prefixLength)) >>> 0;
    const ipInt = (ipParts[0] << 24 | ipParts[1] << 16 | ipParts[2] << 8 | ipParts[3]) >>> 0;
    const rangeInt = (rangeParts[0] << 24 | rangeParts[1] << 16 | rangeParts[2] << 8 | rangeParts[3]) >>> 0;

    return (ipInt & mask) === (rangeInt & mask);
  }

  // IPv6 CIDR (e.g., 2001:db8::/32)
  if (ip.includes(':') && range.includes(':')) {
    if (prefixLength < 0 || prefixLength > 128) return false;

    // Expand IPv6 addresses to 8 groups of 4 hex digits
    const expandIPv6 = (addr: string): string => {
      const parts = addr.toLowerCase().split(':');
      const result: string[] = [];
      let emptyIndex = -1;

      for (let i = 0; i < 8; i++) {
        if (parts[i] && parts[i].length > 0) {
          result.push(parts[i].padStart(4, '0'));
        } else {
          if (emptyIndex === -1) {
            emptyIndex = i;
            const zerosNeeded = 8 - parts.filter((p, idx) => idx !== emptyIndex && p && p.length > 0).length;
            for (let j = 0; j < zerosNeeded; j++) {
              result.push('0000');
            }
          }
        }
      }
      return result.join('');
    };

    try {
      const ipExpanded = BigInt('0x' + expandIPv6(ip));
      const rangeExpanded = BigInt('0x' + expandIPv6(range));

      if (prefixLength === 128) {
        return ipExpanded === rangeExpanded;
      }

      if (prefixLength === 0) {
        return true;
      }

      // Create IPv6 mask: prefix ones followed by zeros
      const shiftBits = 128n - BigInt(prefixLength);
      const mask = shiftBits === 128n ? 0n : ((1n << 128n) - 1n) ^ ((1n << shiftBits) - 1n);

      return (ipExpanded & mask) === (rangeExpanded & mask);
    } catch {
      return false;
    }
  }

  return false;
}

export function isAdminIpAllowed(clientIp: string, policy = getPlatformPolicySync()): boolean {
  if (!policy.ipAllowlist.length) return true;
  const normalized = normalizeIpAddress(clientIp);
  return policy.ipAllowlist.some((ip) => {
    const normalizedAllowlistIp = normalizeIpAddress(ip);
    // Check exact match first, then CIDR range match
    if (normalizedAllowlistIp === normalized) return true;
    // If CIDR notation, check if IP falls within range
    if (normalizedAllowlistIp.includes('/')) {
      return isIpInCidrRange(normalized, normalizedAllowlistIp);
    }
    return false;
  });
}

export function getEffectiveBufferMinutes(
  providerBufferMinutes: number | undefined,
  policy = getPlatformPolicySync()
): number {
  return Math.max(providerBufferMinutes ?? 0, policy.defaultBookingBufferMinutes);
}

/** Weekend = Sat/Sun; holiday = fixed UAE public holidays (extend via settings.holidayRates as %) */
const UAE_PUBLIC_HOLIDAYS_MM_DD = new Set([
  '01-01', // New Year
  '12-02', // National Day
  '12-03',
]);

export function getScheduleSurchargePercent(scheduledDate: Date, policy = getPlatformPolicySync()): number {
  const day = scheduledDate.getDay();
  const mmdd = `${String(scheduledDate.getMonth() + 1).padStart(2, '0')}-${String(scheduledDate.getDate()).padStart(2, '0')}`;

  if (UAE_PUBLIC_HOLIDAYS_MM_DD.has(mmdd)) {
    return policy.holidayRates;
  }
  if (day === 0 || day === 6) {
    return policy.weekendRates;
  }
  return 0;
}

export function calculateTaxAmount(subtotal: number, policy = getPlatformPolicySync()): number {
  const rate = Math.max(0, Math.min(100, policy.taxRate));
  return Math.round(subtotal * (rate / 100) * 100) / 100;
}

export function getPublicPlatformConfig(policy = getPlatformPolicySync()) {
  return {
    platformName: policy.platformName,
    platformLogo: policy.platformLogo,
    favicon: policy.favicon,
    primaryColor: policy.primaryColor,
    secondaryColor: policy.secondaryColor,
    currency: policy.currency,
    dateFormat: policy.dateFormat,
    language: policy.language,
    supportEmail: policy.supportEmail,
    supportPhone: policy.supportPhone,
    enableFAQ: policy.enableFAQ,
    instantBookingEnabled: policy.instantBooking,
  };
}
