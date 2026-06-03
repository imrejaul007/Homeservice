import PlatformSettings, { IPlatformSettings } from '../models/settings.model';
import { cacheRedis } from '../config/redis';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';
import {
  mapSettingsToPolicy,
  refreshPlatformPolicy,
} from './platformSettingsPolicy.service';
import { invalidateEmailTransportCache } from './platformEmailTransport.service';
import { invalidateSmsTransportCache } from './platformSmsTransport.service';

const SETTINGS_CACHE_KEY = 'platform:settings';
const DEFAULT_SETTINGS_CACHE_TTL = 300;

export interface UpdateSettingsDto {
  // General
  platformName?: string;
  platformLogo?: string;
  supportEmail?: string;
  supportPhone?: string;
  currency?: string;
  dateFormat?: string;
  language?: string;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  maintenanceEstimatedDuration?: string;

  // Fees
  commissionRate?: number;
  paymentProcessingFee?: number;
  minimumWithdrawalAmount?: number;
  platformFeeType?: 'percentage' | 'fixed' | 'both';
  taxRate?: number;
  weekendRates?: number;
  holidayRates?: number;

  // Booking
  defaultBookingBufferMinutes?: number;
  cancellationWindowHours?: number;
  autoAssignmentEnabled?: boolean;
  autoConfirmEnabled?: boolean;
  instantBooking?: boolean;
  maxBookingAdvanceDays?: number;
  minBookingAdvanceHours?: number;
  maxDailyBookings?: number;

  // Notifications
  emailNotificationsEnabled?: boolean;
  smsNotificationsEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  notificationSounds?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;

  // Email Config
  emailConfig?: IPlatformSettings['emailConfig'];

  // SMS Config
  smsConfig?: IPlatformSettings['smsConfig'];

  // Email Templates
  emailTemplates?: IPlatformSettings['emailTemplates'];

  // Security
  require2FA?: boolean;
  sessionTimeoutMinutes?: number;
  passwordMinLength?: number;
  passwordRequireSpecialChar?: boolean;
  passwordRequireNumber?: boolean;
  passwordRequireUppercase?: boolean;
  maxLoginAttempts?: number;
  lockoutDurationMinutes?: number;
  enableFAQ?: boolean;
  enableAuditLogs?: boolean;
  ipAllowlist?: string[];

  // Branding
  favicon?: string;
  primaryColor?: string;
  secondaryColor?: string;

  // Backup
  backupCloudStorage?: 'none' | 'aws' | 'gcp' | 'azure';
  backupRetentionDays?: number;
  backupEnabled?: boolean;
  backupLastRunAt?: Date;

  // System
  cacheTTLSeconds?: number;
  rateLimitRequestsPerMinute?: number;
  apiRateLimitPerHour?: number;
  maxFileUploadSizeMB?: number;
  allowedFileTypes?: string[];
}

// Get settings with caching
export const getSettings = async (useCache = true): Promise<IPlatformSettings> => {
  if (useCache && cacheRedis) {
    try {
      const cached = await cacheRedis.get(SETTINGS_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as IPlatformSettings;
        // Sync in-memory policy without another DB round-trip
        refreshPlatformPolicy(parsed).catch((error) => {
          logger.warn('Failed to refresh platform policy from cache', { error });
        });
        return parsed;
      }
    } catch (error) {
      logger.warn('Settings cache miss or error', { error });
    }
  }

  const settings = await PlatformSettings.getSettings();
  const policy = mapSettingsToPolicy(settings);
  const cacheTtl = policy.cacheTTLSeconds || DEFAULT_SETTINGS_CACHE_TTL;

  // Keep in-memory policy in sync whenever settings are loaded from DB
  await refreshPlatformPolicy(settings);

  // Cache the settings (only if Redis is available)
  if (cacheRedis) {
    try {
      await cacheRedis.setex(SETTINGS_CACHE_KEY, cacheTtl, JSON.stringify(settings));
    } catch (error) {
      logger.warn('Failed to cache settings', { error });
    }
  }

  return settings;
};

function invalidateTransportCaches(updates?: UpdateSettingsDto): void {
  if (!updates) {
    invalidateEmailTransportCache();
    invalidateSmsTransportCache();
    return;
  }
  if (updates.emailConfig !== undefined) {
    invalidateEmailTransportCache();
  }
  if (updates.smsConfig !== undefined) {
    invalidateSmsTransportCache();
  }
}

// Invalidate settings cache
export const invalidateSettingsCache = async (): Promise<void> => {
  invalidateEmailTransportCache();
  invalidateSmsTransportCache();
  if (!cacheRedis) {
    await refreshPlatformPolicy();
    return;
  }
  try {
    await cacheRedis.del(SETTINGS_CACHE_KEY);
    await refreshPlatformPolicy();
    logger.info('Settings cache invalidated');
  } catch (error) {
    logger.error('Failed to invalidate settings cache', { error });
  }
};

// Update settings with audit logging
export const updateSettings = async (
  updates: UpdateSettingsDto,
  updatedBy?: string,
  reason?: string
): Promise<IPlatformSettings> => {
  const settings = await PlatformSettings.getSettings();

  // Apply updates
  Object.assign(settings, updates);

  // Add audit entry
  (settings as any).history = (settings as any).history || [];
  (settings as any).history.push({
    updatedBy: updatedBy || 'system',
    updatedAt: new Date(),
    reason: reason || 'Settings updated',
    changes: Object.keys(updates),
  });

  await settings.save();
  invalidateTransportCaches(updates);
  await invalidateSettingsCache();
  await refreshPlatformPolicy(settings);

  return settings;
};

// Get a single setting value
export const getSetting = async (key: string): Promise<any> => {
  const settings = await getSettings();
  return (settings as any)[key];
};

// Get settings history
export const getSettingsHistory = async (
  limit = 50,
  skip = 0
): Promise<any[]> => {
  const settings = await PlatformSettings.getSettings();
  const history = (settings as any).history || [];
  return history.reverse().slice(skip, skip + limit);
};

// Reset settings to defaults
export const resetSettings = async (resetBy?: string): Promise<IPlatformSettings> => {
  const settings = await PlatformSettings.findOne();

  if (settings) {
    (settings as any).history = (settings as any).history || [];
    (settings as any).history.push({
      updatedBy: resetBy || 'system',
      updatedAt: new Date(),
      reason: 'Settings reset to defaults',
      changes: ['all'],
    });
    await settings.deleteOne();
  }

  const newSettings = await PlatformSettings.create({});
  return newSettings;
};

// Export settings (with sensitive data masked)
export const exportSettings = async (): Promise<object> => {
  const settings = await getSettings();
  const exportData: any = { ...settings.toObject() };

  // Mask sensitive fields
  if (exportData.emailConfig?.smtp?.pass) {
    exportData.emailConfig.smtp.pass = '***HIDDEN***';
  }
  if (exportData.smsConfig?.twilio?.authToken) {
    exportData.smsConfig.twilio.authToken = '***HIDDEN***';
  }

  delete exportData._id;
  delete exportData.__v;

  return {
    exportedAt: new Date(),
    version: '1.0',
    settings: exportData,
  };
};

// Import settings
export const importSettings = async (
  importData: any,
  importedBy?: string,
  reason?: string
): Promise<IPlatformSettings> => {
  if (!importData?.settings) {
    throw ApiError.badRequest('Invalid import file format', [], ERROR_CODES.INVALID_FORMAT);
  }

  const updates = { ...importData.settings };

  const currentSettings = await getSettings();
  if (updates.emailConfig?.smtp?.pass === '***HIDDEN***') {
    updates.emailConfig.smtp.pass = currentSettings.emailConfig?.smtp?.pass;
  }
  if (updates.smsConfig?.twilio?.authToken === '***HIDDEN***') {
    updates.smsConfig.twilio.authToken = currentSettings.smsConfig?.twilio?.authToken;
  }

  return updateSettings(updates, importedBy, reason || 'Settings imported');
};
