import {
  Globe,
  DollarSign,
  Calendar,
  Bell,
  Shield,
  Settings,
  Mail,
  MessageSquare,
  FileText,
  Image,
  Database,
} from 'lucide-react';
import type { ElementType } from 'react';

export interface PlatformSettings {
  platformName: string;
  platformLogo: string;
  supportEmail: string;
  supportPhone: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maintenanceEstimatedDuration: string;
  currency: string;
  dateFormat: string;
  language: string;
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
  maxBookingAdvanceDays: number;
  minBookingAdvanceHours: number;
  instantBooking: boolean;
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
  ipAllowlist: string[];
  enableAuditLogs: boolean;
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  cacheTTLSeconds: number;
  rateLimitRequestsPerMinute: number;
  apiRateLimitPerHour: number;
  maxFileUploadSizeMB: number;
  allowedFileTypes: string[];
  backupCloudStorage: 'none' | 'aws' | 'gcp' | 'azure';
  backupRetentionDays: number;
  backupEnabled: boolean;
  backupLastRunAt?: string;
  emailConfig: {
    provider: 'smtp' | 'ses' | 'sendgrid' | 'resend';
    smtp?: { host: string; port: number; secure: boolean; user: string; pass: string };
    ses?: { accessKeyId: string; secretAccessKey: string; region: string };
    sendgrid?: { apiKey: string };
    resend?: { apiKey: string };
    fromEmail: string;
    fromName: string;
    replyToEmail: string;
  };
  smsConfig: {
    provider: 'twilio' | 'vonage' | 'msg91';
    twilio?: { accountSid: string; authToken: string; fromNumber: string };
    vonage?: { apiKey: string; apiSecret: string; fromNumber: string };
    msg91?: { authKey: string; templateId: string; senderId: string };
    enabled: boolean;
  };
  emailTemplates: Record<
    string,
    { subject: string; body: string; enabled: boolean; hoursBefore?: number }
  >;
}

export type SettingsSection =
  | 'general'
  | 'fees'
  | 'booking'
  | 'notifications'
  | 'email'
  | 'sms'
  | 'templates'
  | 'branding'
  | 'security'
  | 'backup'
  | 'system';

export interface SectionConfig {
  id: SettingsSection;
  label: string;
  icon: ElementType;
}

export interface EmailTemplateConfig {
  id: string;
  name: string;
  description: string;
  variables: string[];
}

export const SETTINGS_SECTIONS: SectionConfig[] = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'fees', label: 'Fees', icon: DollarSign },
  { id: 'booking', label: 'Booking', icon: Calendar },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'sms', label: 'SMS', icon: MessageSquare },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'branding', label: 'Branding', icon: Image },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'backup', label: 'Backup', icon: Database },
  { id: 'system', label: 'System', icon: Settings },
];

export const EMAIL_TEMPLATES_CONFIG: EmailTemplateConfig[] = [
  {
    id: 'bookingConfirmation',
    name: 'Booking Confirmation',
    description: 'Sent when a booking is confirmed',
    variables: ['{{userName}}', '{{bookingId}}', '{{bookingDate}}', '{{bookingTime}}', '{{providerName}}', '{{serviceName}}', '{{totalAmount}}'],
  },
  {
    id: 'bookingReminder',
    name: 'Booking Reminder',
    description: 'Sent before a booking appointment',
    variables: ['{{userName}}', '{{bookingId}}', '{{bookingDate}}', '{{bookingTime}}', '{{providerName}}', '{{serviceName}}', '{{address}}'],
  },
  {
    id: 'bookingCancellation',
    name: 'Booking Cancelled',
    description: 'Sent when a booking is cancelled',
    variables: ['{{userName}}', '{{bookingId}}', '{{bookingDate}}', '{{bookingTime}}', '{{providerName}}', '{{reason}}', '{{refundAmount}}'],
  },
  {
    id: 'bookingCompletion',
    name: 'Booking Completed',
    description: 'Sent when a booking is completed',
    variables: ['{{userName}}', '{{bookingId}}', '{{bookingDate}}', '{{providerName}}', '{{serviceName}}', '{{totalAmount}}', '{{reviewLink}}'],
  },
  {
    id: 'passwordReset',
    name: 'Password Reset',
    description: 'Sent when user requests password reset',
    variables: ['{{userName}}', '{{resetLink}}', '{{expiryTime}}'],
  },
  {
    id: 'welcomeEmail',
    name: 'Welcome Email',
    description: 'Sent when a new user registers',
    variables: ['{{userName}}', '{{email}}', '{{verificationLink}}', '{{platformName}}'],
  },
  {
    id: 'emailVerification',
    name: 'Email Verification',
    description: 'Sent to verify a new email address',
    variables: ['{{userName}}', '{{verificationLink}}', '{{expiryTime}}', '{{platformName}}'],
  },
  {
    id: 'paymentReceipt',
    name: 'Payment Receipt',
    description: 'Sent after successful payment',
    variables: ['{{userName}}', '{{transactionId}}', '{{amount}}', '{{paymentMethod}}', '{{bookingId}}', '{{date}}'],
  },
  {
    id: 'providerApplication',
    name: 'Provider Application Status',
    description: 'Sent when provider application is reviewed',
    variables: ['{{providerName}}', '{{status}}', '{{comments}}', '{{nextSteps}}'],
  },
  {
    id: 'providerApproval',
    name: 'Provider Approval',
    description: 'Sent when provider application is approved',
    variables: ['{{providerName}}', '{{status}}', '{{comments}}', '{{nextSteps}}'],
  },
  {
    id: 'providerRejection',
    name: 'Provider Rejection',
    description: 'Sent when provider application is rejected',
    variables: ['{{providerName}}', '{{status}}', '{{comments}}', '{{nextSteps}}'],
  },
];

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformName: '',
  platformLogo: '',
  supportEmail: '',
  supportPhone: '',
  maintenanceMode: false,
  maintenanceMessage: '',
  maintenanceEstimatedDuration: '',
  currency: 'AED',
  dateFormat: 'DD/MM/YYYY',
  language: 'en',
  commissionRate: 15,
  paymentProcessingFee: 2.9,
  minimumWithdrawalAmount: 50,
  platformFeeType: 'percentage',
  taxRate: 0,
  weekendRates: 0,
  holidayRates: 0,
  defaultBookingBufferMinutes: 30,
  cancellationWindowHours: 24,
  autoAssignmentEnabled: false,
  autoConfirmEnabled: false,
  maxBookingAdvanceDays: 30,
  minBookingAdvanceHours: 2,
  instantBooking: false,
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
  ipAllowlist: [],
  enableAuditLogs: true,
  favicon: '',
  primaryColor: '#E8B4A8',
  secondaryColor: '#D4A89A',
  cacheTTLSeconds: 300,
  rateLimitRequestsPerMinute: 100,
  apiRateLimitPerHour: 1000,
  maxFileUploadSizeMB: 10,
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  backupCloudStorage: 'none',
  backupRetentionDays: 30,
  backupEnabled: false,
  emailConfig: {
    provider: 'resend',
    smtp: { host: '', port: 587, secure: false, user: '', pass: '' },
    ses: { accessKeyId: '', secretAccessKey: '', region: 'us-east-1' },
    sendgrid: { apiKey: '' },
    resend: { apiKey: '' },
    fromEmail: 'noreply@homeservice.com',
    fromName: 'Homeservice',
    replyToEmail: 'support@homeservice.com',
  },
  smsConfig: {
    provider: 'twilio',
    twilio: { accountSid: '', authToken: '', fromNumber: '' },
    enabled: false,
  },
  emailTemplates: {
    bookingConfirmation: { subject: 'Booking Confirmed - {{bookingId}}', body: '', enabled: true },
    bookingReminder: { subject: 'Reminder: Your appointment on {{bookingDate}}', body: '', enabled: true, hoursBefore: 24 },
    bookingCancellation: { subject: 'Booking Cancelled - {{bookingId}}', body: '', enabled: true },
    bookingCompletion: { subject: 'Service Completed - {{bookingId}}', body: '', enabled: true },
    passwordReset: { subject: 'Reset Your Password', body: '', enabled: true },
    welcomeEmail: { subject: 'Welcome to {{platformName}}!', body: '', enabled: true },
    emailVerification: { subject: 'Verify Your Email', body: '', enabled: true },
    paymentReceipt: { subject: 'Payment Receipt - {{transactionId}}', body: '', enabled: true },
    providerApplication: { subject: 'Provider Application Update', body: '', enabled: true },
    providerApproval: { subject: 'Provider Account Approved', body: '', enabled: true },
    providerRejection: { subject: 'Provider Application Update', body: '', enabled: true },
  },
};

const MASKED_MARKERS = ['***MASKED***', '***HIDDEN***'];

function isMaskedString(value: string): boolean {
  return MASKED_MARKERS.some((marker) => value.includes(marker));
}

/** Remove masked secret placeholders so PATCH does not overwrite stored credentials. */
export function stripMaskedSecrets<T>(value: T): T | undefined {
  if (typeof value === 'string') {
    return isMaskedString(value) ? undefined : value;
  }
  if (Array.isArray(value)) {
    const next = value
      .map((item) => stripMaskedSecrets(item))
      .filter((item) => item !== undefined) as T[];
    return next as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const stripped = stripMaskedSecrets(entry);
      if (stripped !== undefined) {
        result[key] = stripped;
      }
    }
    return result as T;
  }
  return value;
}

export function mergePlatformSettings(apiSettings: Partial<PlatformSettings>): PlatformSettings {
  return {
    ...DEFAULT_PLATFORM_SETTINGS,
    ...apiSettings,
    emailConfig: {
      ...DEFAULT_PLATFORM_SETTINGS.emailConfig,
      ...apiSettings.emailConfig,
      smtp: {
        ...DEFAULT_PLATFORM_SETTINGS.emailConfig.smtp!,
        ...apiSettings.emailConfig?.smtp,
      },
      ses: {
        ...DEFAULT_PLATFORM_SETTINGS.emailConfig.ses!,
        ...apiSettings.emailConfig?.ses,
      },
      sendgrid: {
        ...DEFAULT_PLATFORM_SETTINGS.emailConfig.sendgrid!,
        ...apiSettings.emailConfig?.sendgrid,
      },
      resend: {
        ...DEFAULT_PLATFORM_SETTINGS.emailConfig.resend!,
        ...apiSettings.emailConfig?.resend,
      },
    },
    smsConfig: {
      ...DEFAULT_PLATFORM_SETTINGS.smsConfig,
      ...apiSettings.smsConfig,
      twilio: {
        ...DEFAULT_PLATFORM_SETTINGS.smsConfig.twilio!,
        ...apiSettings.smsConfig?.twilio,
      },
      vonage: {
        ...(DEFAULT_PLATFORM_SETTINGS.smsConfig.vonage ?? { apiKey: '', apiSecret: '', fromNumber: '' }),
        ...apiSettings.smsConfig?.vonage,
      },
      msg91: {
        ...(DEFAULT_PLATFORM_SETTINGS.smsConfig.msg91 ?? { authKey: '', templateId: '', senderId: '' }),
        ...apiSettings.smsConfig?.msg91,
      },
    },
    emailTemplates: {
      ...DEFAULT_PLATFORM_SETTINGS.emailTemplates,
      ...apiSettings.emailTemplates,
    },
    ipAllowlist: apiSettings.ipAllowlist ?? [],
    allowedFileTypes: apiSettings.allowedFileTypes ?? DEFAULT_PLATFORM_SETTINGS.allowedFileTypes,
  };
}

export function buildSettingsPatch(
  current: PlatformSettings,
  original: PlatformSettings
): Partial<PlatformSettings> {
  const patch: Partial<PlatformSettings> = {};
  (Object.keys(current) as Array<keyof PlatformSettings>).forEach((key) => {
    if (JSON.stringify(current[key]) !== JSON.stringify(original[key])) {
      const stripped = stripMaskedSecrets(current[key]);
      if (stripped !== undefined) {
        (patch as Record<string, unknown>)[key as string] = stripped;
      }
    }
  });
  return patch;
}

export function parseSettingsSection(search: string): SettingsSection {
  const params = new URLSearchParams(search);
  const section = params.get('section');
  if (section && SETTINGS_SECTIONS.some((s) => s.id === section)) {
    return section as SettingsSection;
  }
  return 'general';
}
