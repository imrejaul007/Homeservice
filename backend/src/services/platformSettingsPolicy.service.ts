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

export function isAdminIpAllowed(clientIp: string, policy = getPlatformPolicySync()): boolean {
  if (!policy.ipAllowlist.length) return true;
  const normalized = clientIp.replace('::ffff:', '').trim();
  return policy.ipAllowlist.some((ip) => ip === normalized || ip === clientIp);
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
