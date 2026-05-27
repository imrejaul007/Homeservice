import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe,
  DollarSign,
  Calendar,
  Bell,
  Shield,
  Settings,
  RefreshCw,
  Save,
  RotateCcw,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Check,
  X,
  Mail,
  MessageSquare,
  FileText,
  Image,
  Database,
  Upload,
  Download,
  Trash2,
  Edit3,
  Eye,
  Send,
  FileJson,
  AlertCircle,
  Key,
  Clock,
  Palette,
  Cloud,
  List,
  Network,
  FileCode,
  Volume2,
  Moon,
  Sun,
  Plus,
  Copy,
  ExternalLink,
} from 'lucide-react';
import PageLayout from '../layout/PageLayout';
import authService from '../../services/AuthService';
import { useToastActions } from '../common/Toast';

// Types
interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
}

interface PlatformSettings {
  platformName: string;
  platformLogo: string;
  supportEmail: string;
  supportPhone: string;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  maintenanceEstimatedDuration: string;
  // General Settings
  currency: string;
  dateFormat: string;
  language: string;
  // Fee & Commission
  commissionRate: number;
  paymentProcessingFee: number;
  minimumWithdrawalAmount: number;
  platformFeeType: 'percentage' | 'fixed' | 'both';
  // Fee Customization
  taxRate: number;
  weekendRates: number;
  holidayRates: number;
  // Booking Settings
  defaultBookingBufferMinutes: number;
  cancellationWindowHours: number;
  autoAssignmentEnabled: boolean;
  autoConfirmEnabled: boolean;
  maxBookingAdvanceDays: number;
  minBookingAdvanceHours: number;
  instantBooking: boolean;
  maxDailyBookings: number;
  // Notification Settings
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  notificationSounds: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  // Security Settings
  require2FA: boolean;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  passwordRequireSpecialChar: boolean;
  passwordRequireNumber: boolean;
  passwordRequireUppercase: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  // Custom Security
  enableFAQ: boolean;
  apiKeys: ApiKey[];
  ipAllowlist: string[];
  enableAuditLogs: boolean;
  // Branding
  favicon: string;
  primaryColor: string;
  secondaryColor: string;
  // System Settings
  cacheTTLSeconds: number;
  rateLimitRequestsPerMinute: number;
  apiRateLimitPerHour: number;
  maxFileUploadSizeMB: number;
  allowedFileTypes: string[];
  // Backup Settings
  backupCloudStorage: 'none' | 'aws' | 'gcp' | 'azure';
  backupRetentionDays: number;
  backupEnabled: boolean;
  // Email Config
  emailConfig: {
    provider: 'smtp' | 'ses' | 'sendgrid' | 'resend';
    smtp?: { host: string; port: number; secure: boolean; user: string; pass: string };
    fromEmail: string;
    fromName: string;
    replyToEmail: string;
  };
  // SMS Config (only providers that exist in backend)
  smsConfig: {
    provider: 'twilio' | 'vonage' | 'msg91';
    twilio?: { accountSid: string; authToken: string; fromNumber: string };
    vonage?: { apiKey: string; apiSecret: string; fromNumber: string };
    msg91?: { authKey: string; templateId: string; senderId: string };
    enabled: boolean;
  };
  // Templates (using camelCase to match backend)
  emailTemplates: {
    bookingConfirmation: { subject: string; body: string; enabled: boolean };
    bookingReminder: { subject: string; body: string; enabled: boolean; hoursBefore?: number };
    bookingCancellation: { subject: string; body: string; enabled: boolean };
    bookingCompletion: { subject: string; body: string; enabled: boolean };
    passwordReset: { subject: string; body: string; enabled: boolean };
    welcomeEmail: { subject: string; body: string; enabled: boolean };
    paymentReceipt: { subject: string; body: string; enabled: boolean };
    providerApplication: { subject: string; body: string; enabled: boolean };
    emailVerification: { subject: string; body: string; enabled: boolean };
    providerApproval: { subject: string; body: string; enabled: boolean };
    providerRejection: { subject: string; body: string; enabled: boolean };
  };
}

type SettingsSection = 'general' | 'fees' | 'booking' | 'notifications' | 'email' | 'sms' | 'templates' | 'branding' | 'security' | 'backup' | 'system';

interface SectionConfig {
  id: SettingsSection;
  label: string;
  icon: React.ElementType;
}

interface Template {
  id: string;
  name: string;
  description: string;
  variables: string[];
}

// Section configuration
const SECTIONS: SectionConfig[] = [
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

// Email Templates Configuration (using camelCase to match backend)
const EMAIL_TEMPLATES_CONFIG: Template[] = [
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

// Default settings
const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: '',
  platformLogo: '',
  supportEmail: '',
  supportPhone: '',
  maintenanceMode: false,
  maintenanceMessage: '',
  maintenanceEstimatedDuration: '',
  // General Settings
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  language: 'en',
  // Fee & Commission
  commissionRate: 10,
  paymentProcessingFee: 2.9,
  minimumWithdrawalAmount: 100,
  platformFeeType: 'percentage',
  // Fee Customization
  taxRate: 0,
  weekendRates: 0,
  holidayRates: 0,
  // Booking Settings
  defaultBookingBufferMinutes: 30,
  cancellationWindowHours: 24,
  autoAssignmentEnabled: true,
  autoConfirmEnabled: false,
  maxBookingAdvanceDays: 30,
  minBookingAdvanceHours: 2,
  instantBooking: false,
  maxDailyBookings: 5,
  // Notification Settings
  emailNotificationsEnabled: true,
  smsNotificationsEnabled: true,
  pushNotificationsEnabled: true,
  notificationSounds: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  // Security Settings
  require2FA: false,
  sessionTimeoutMinutes: 60,
  passwordMinLength: 8,
  passwordRequireSpecialChar: true,
  passwordRequireNumber: true,
  passwordRequireUppercase: true,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 30,
  // Custom Security
  enableFAQ: true,
  apiKeys: [],
  ipAllowlist: [],
  enableAuditLogs: true,
  // Branding
  favicon: '',
  primaryColor: '#E8B4A8',
  secondaryColor: '#D4A89A',
  // System Settings
  cacheTTLSeconds: 300,
  rateLimitRequestsPerMinute: 100,
  apiRateLimitPerHour: 1000,
  maxFileUploadSizeMB: 10,
  allowedFileTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
  // Backup Settings
  backupCloudStorage: 'none',
  backupRetentionDays: 30,
  backupEnabled: false,
  emailConfig: {
    provider: 'smtp',
    smtp: { host: '', port: 587, secure: false, user: '', pass: '' },
    fromEmail: '',
    fromName: '',
    replyToEmail: '',
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
    paymentReceipt: { subject: 'Payment Receipt - {{transactionId}}', body: '', enabled: true },
    providerApplication: { subject: 'Provider Application Update', body: '', enabled: true },
    emailVerification: { subject: 'Verify Your Email', body: '', enabled: true },
    providerApproval: { subject: 'Provider Account Approved', body: '', enabled: true },
    providerRejection: { subject: 'Provider Application Update', body: '', enabled: true },
  },
};

// Toggle Switch Component
interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onChange, disabled = false }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
        enabled ? 'bg-nilin-coral' : 'bg-nilin-border'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {enabled && (
          <Check className="w-3 h-3 text-nilin-coral absolute top-1 left-1" />
        )}
      </span>
    </button>
  );
};

// Number Input Component
interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  label?: string;
}

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled = false,
  label,
}) => {
  return (
    <div className="flex items-center space-x-2">
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const newValue = parseFloat(e.target.value);
          if (!isNaN(newValue)) {
            if (min !== undefined && newValue < min) return;
            if (max !== undefined && newValue > max) return;
            onChange(newValue);
          }
        }}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        className="w-24 px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal disabled:bg-nilin-muted disabled:cursor-not-allowed font-sans"
      />
      {suffix && <span className="text-sm text-nilin-warmGray font-sans">{suffix}</span>}
    </div>
  );
};

// Text Input Component
interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'url' | 'password' | 'number';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled = false,
  className = '',
}) => {
  const isPassword = type === 'password';

  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal disabled:bg-nilin-muted disabled:cursor-not-allowed font-sans ${className}`}
      />
    </div>
  );
};

// Setting Row Component
interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  warning?: boolean;
}

const SettingRow: React.FC<SettingRowProps> = ({ label, description, children, warning }) => {
  return (
    <div className={`flex items-center justify-between py-4 px-4 rounded-xl ${warning ? 'bg-amber-50/50' : 'hover:bg-nilin-blush/30 transition-colors'}`}>
      <div className="flex-1 mr-4">
        <label className="text-sm font-medium text-nilin-charcoal font-sans">{label}</label>
        {description && (
          <p className="text-xs text-nilin-warmGray mt-0.5 font-sans">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
};

// Select Input Component
interface SelectInputProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}

const SelectInput: React.FC<SelectInputProps> = ({ value, onChange, options, disabled = false }) => {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal disabled:bg-nilin-muted disabled:cursor-not-allowed font-sans"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};

// Loading Skeleton Component
const LoadingSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-nilin-blush/50 rounded w-1/3 mb-6"></div>
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="glass glass-blur p-4 rounded-xl border border-nilin-border/50">
            <div className="flex items-center justify-between">
              <div className="h-4 bg-nilin-blush/50 rounded w-1/4"></div>
              <div className="h-6 bg-nilin-blush/50 rounded-full w-12"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Section Divider Component
const SectionDivider: React.FC<{ label: string }> = ({ label }) => {
  return (
    <div className="flex items-center py-2">
      <span className="text-xs font-semibold text-nilin-warmGray uppercase tracking-wider font-sans">
        {label}
      </span>
    </div>
  );
};

// AdminSettings Component
const AdminSettings: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToastActions();

  // Get initial section from URL query param
  const getInitialSection = (): SettingsSection => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section && SECTIONS.some(s => s.id === section)) {
      return section as SettingsSection;
    }
    return 'general';
  };

  // State
  const [activeSection, setActiveSection] = useState<SettingsSection>(getInitialSection);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<PlatformSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Template editing state
  const [templateModal, setTemplateModal] = useState<{
    isOpen: boolean;
    templateId: string | null;
    subject: string;
    body: string;
  }>({
    isOpen: false,
    templateId: null,
    subject: '',
    body: '',
  });

  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Import file input ref
  const importInputRef = useRef<HTMLInputElement>(null);

  // Test email state
  const [testEmail, setTestEmail] = useState('');
  const [isTestingEmail, setIsTestingEmail] = useState(false);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  // Check for changes
  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  // Handle section change and update URL
  const handleSectionChange = (section: SettingsSection) => {
    setActiveSection(section);
    const url = new URL(window.location.href);
    url.searchParams.set('section', section);
    window.history.pushState({}, '', url.pathname + url.search);
  };

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await authService.get<{ success: boolean; data: { settings: PlatformSettings } }>('/settings');
      if (response.success && response.data.settings) {
        const fetchedSettings = {
          ...DEFAULT_SETTINGS,
          ...response.data.settings,
          emailConfig: {
            ...DEFAULT_SETTINGS.emailConfig,
            ...response.data.settings.emailConfig,
            smtp: {
              ...DEFAULT_SETTINGS.emailConfig.smtp,
              ...response.data.settings.emailConfig?.smtp,
            },
          },
          smsConfig: {
            ...DEFAULT_SETTINGS.smsConfig,
            ...response.data.settings.smsConfig,
            twilio: {
              ...DEFAULT_SETTINGS.smsConfig.twilio,
              ...response.data.settings.smsConfig?.twilio,
            },
            vonage: {
              ...DEFAULT_SETTINGS.smsConfig.vonage,
              ...response.data.settings.smsConfig?.vonage,
            },
            msg91: {
              ...DEFAULT_SETTINGS.smsConfig.msg91,
              ...response.data.settings.smsConfig?.msg91,
            },
          },
          emailTemplates: {
            ...DEFAULT_SETTINGS.emailTemplates,
            ...response.data.settings.emailTemplates,
          },
          apiKeys: response.data.settings.apiKeys || [],
          ipAllowlist: response.data.settings.ipAllowlist || [],
          allowedFileTypes: response.data.settings.allowedFileTypes || DEFAULT_SETTINGS.allowedFileTypes,
        };
        setSettings(fetchedSettings);
        setOriginalSettings(fetchedSettings);
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load settings', error.message || 'Please try again');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);
    try {
      // Calculate only changed fields
      const changedFields: Partial<PlatformSettings> = {};
      (Object.keys(settings) as Array<keyof PlatformSettings>).forEach((key) => {
        if (JSON.stringify(settings[key]) !== JSON.stringify(originalSettings[key])) {
          (changedFields as any)[key] = settings[key];
        }
      });

      if (Object.keys(changedFields).length === 0) {
        toast.info('No changes to save');
        return;
      }

      const response = await authService.patch<{ success: boolean }>('/settings', changedFields);
      if (response.success) {
        setOriginalSettings(settings);
        toast.success('Settings saved successfully', 'Your changes have been applied');
      }
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings', error.message || 'Please try again');
    } finally {
      setIsSaving(false);
    }
  }, [settings, originalSettings, toast]);

  const resetSettings = useCallback(async () => {
    setIsResetting(true);
    setShowResetConfirm(false);
    try {
      const response = await authService.post<{ success: boolean }>('/settings/reset');
      if (response.success) {
        await fetchSettings();
        toast.success('Settings reset to defaults', 'All platform settings have been restored');
      }
    } catch (error: any) {
      console.error('Error resetting settings:', error);
      toast.error('Failed to reset settings', error.message || 'Please try again');
    } finally {
      setIsResetting(false);
    }
  }, [fetchSettings, toast]);

  const handleSettingChange = useCallback(<K extends keyof PlatformSettings>(
    key: K,
    value: PlatformSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Email config handlers
  const handleEmailConfigChange = useCallback((field: string, value: string | 'smtp' | 'ses' | 'sendgrid' | 'resend') => {
    setSettings((prev) => ({
      ...prev,
      emailConfig: { ...prev.emailConfig, [field]: value },
    }));
  }, []);

  const handleSmtpConfigChange = useCallback((field: string, value: string | number | boolean) => {
    setSettings((prev) => ({
      ...prev,
      emailConfig: {
        ...prev.emailConfig,
        smtp: { ...prev.emailConfig.smtp!, [field]: value },
      },
    }));
  }, []);

  // SMS config handlers
  const handleSmsConfigChange = useCallback((field: string, value: string | boolean) => {
    setSettings((prev) => ({
      ...prev,
      smsConfig: { ...prev.smsConfig, [field]: value },
    }));
  }, []);

  const handleTwilioConfigChange = useCallback((field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      smsConfig: {
        ...prev.smsConfig,
        twilio: { ...prev.smsConfig.twilio!, [field]: value },
      },
    }));
  }, []);

  const handleVonageConfigChange = useCallback((field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      smsConfig: {
        ...prev.smsConfig,
        vonage: { ...(prev.smsConfig.vonage || { apiKey: '', apiSecret: '', fromNumber: '' }), [field]: value },
      },
    }));
  }, []);

  const handleMsg91ConfigChange = useCallback((field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      smsConfig: {
        ...prev.smsConfig,
        msg91: { ...(prev.smsConfig.msg91 || { authKey: '', templateId: '', senderId: '' }), [field]: value },
      },
    }));
  }, []);

  // Template handlers
  const handleTemplateToggle = useCallback((templateId: string) => {
    setSettings((prev) => ({
      ...prev,
      emailTemplates: {
        ...prev.emailTemplates,
        [templateId]: {
          ...prev.emailTemplates[templateId],
          enabled: !prev.emailTemplates[templateId].enabled,
        },
      },
    }));
  }, []);

  const openTemplateEditor = useCallback((templateId: string) => {
    const template = settings.emailTemplates[templateId];
    const config = EMAIL_TEMPLATES_CONFIG.find((t) => t.id === templateId);
    setTemplateModal({
      isOpen: true,
      templateId,
      subject: template?.subject || '',
      body: template?.body || '',
    });
  }, [settings.emailTemplates]);

  const closeTemplateEditor = useCallback(() => {
    setTemplateModal({
      isOpen: false,
      templateId: null,
      subject: '',
      body: '',
    });
  }, []);

  const saveTemplate = useCallback(() => {
    if (!templateModal.templateId) return;
    setSettings((prev) => ({
      ...prev,
      emailTemplates: {
        ...prev.emailTemplates,
        [templateModal.templateId!]: {
          ...prev.emailTemplates[templateModal.templateId!],
          subject: templateModal.subject,
          body: templateModal.body,
        },
      },
    }));
    closeTemplateEditor();
    toast.success('Template saved', 'Your template changes have been applied');
  }, [templateModal, closeTemplateEditor, toast]);

  // Test email handler
  const handleTestEmail = useCallback(async () => {
    if (!testEmail || !testEmail.includes('@')) {
      toast.error('Invalid email', 'Please enter a valid email address');
      return;
    }
    setIsTestingEmail(true);
    try {
      const response = await authService.post<{ success: boolean }>('/settings/test-email', { testEmail });
      if (response.success) {
        toast.success('Test email sent', `Email sent to ${testEmail}`);
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error('Failed to send test email', error.message || 'Please try again');
    } finally {
      setIsTestingEmail(false);
    }
  }, [testEmail, toast]);

  // Logo upload handlers
  const handleLogoUpload = useCallback(async (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|gif|webp)$/)) {
      toast.error('Invalid file type', 'Please upload a JPEG, PNG, GIF, or WebP image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large', 'Logo must be less than 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await authService.post<{ success: boolean; data: { logoUrl: string } }>(
        '/settings/upload-logo',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (response.success) {
        handleSettingChange('platformLogo', response.data.logoUrl);
        toast.success('Logo uploaded', 'Your logo has been updated');
      }
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo', error.message || 'Please try again');
    } finally {
      setIsUploading(false);
    }
  }, [handleSettingChange, toast]);

  const handleLogoRemove = useCallback(async () => {
    try {
      const response = await authService.delete<{ success: boolean }>('/settings/logo');
      if (response.success) {
        handleSettingChange('platformLogo', '');
        toast.success('Logo removed', 'Your logo has been deleted');
      }
    } catch (error: any) {
      console.error('Error removing logo:', error);
      toast.error('Failed to remove logo', error.message || 'Please try again');
    }
  }, [handleSettingChange, toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleLogoUpload(file);
    }
  }, [handleLogoUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleLogoUpload(file);
    }
  }, [handleLogoUpload]);

  // Export settings handler
  const handleExportSettings = useCallback(async () => {
    try {
      const response = await authService.get<{ success: boolean; data: { settings: PlatformSettings } }>('/settings/export');
      if (response.success) {
        const blob = new Blob([JSON.stringify(response.data.settings, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `platform-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Settings exported', 'Your settings have been downloaded');
      }
    } catch (error: any) {
      console.error('Error exporting settings:', error);
      toast.error('Failed to export settings', error.message || 'Please try again');
    }
  }, [toast]);

  // Import settings handlers
  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const jsonData = JSON.parse(event.target?.result as string);
          const response = await authService.post<{ success: boolean }>('/settings/import', jsonData);
          if (response.success) {
            await fetchSettings();
            toast.success('Settings imported', 'Your settings have been restored from the file');
          }
        } catch (error: any) {
          toast.error('Invalid file', 'The selected file is not a valid settings file');
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  }, [fetchSettings, toast]);

  // Reset to defaults (backup section)
  const handleResetToDefaults = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  // Render General Settings
  const renderGeneralSettings = () => (
    <div className="space-y-1">
      <SectionDivider label="Platform Identity" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Platform Name" description="The display name for your platform">
          <TextInput
            value={settings.platformName}
            onChange={(value) => handleSettingChange('platformName', value)}
            placeholder="Enter platform name"
          />
        </SettingRow>
        <SettingRow label="Platform Logo URL" description="URL to your platform logo">
          <TextInput
            value={settings.platformLogo}
            onChange={(value) => handleSettingChange('platformLogo', value)}
            type="url"
            placeholder="https://example.com/logo.png"
          />
        </SettingRow>
      </div>

      <SectionDivider label="Regional Settings" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Currency" description="Default currency for pricing">
          <select
            value={settings.currency}
            onChange={(e) => handleSettingChange('currency', e.target.value)}
            className="w-32 px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal font-sans"
          >
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (EUR)</option>
            <option value="GBP">GBP (GBP)</option>
            <option value="AED">AED (AED)</option>
            <option value="SAR">SAR (SAR)</option>
            <option value="INR">INR (INR)</option>
            <option value="CNY">CNY (CNY)</option>
            <option value="JPY">JPY (JPY)</option>
            <option value="CAD">CAD (CAD)</option>
            <option value="AUD">AUD (AUD)</option>
          </select>
        </SettingRow>
        <SettingRow label="Date Format" description="Format for displaying dates">
          <select
            value={settings.dateFormat}
            onChange={(e) => handleSettingChange('dateFormat', e.target.value)}
            className="w-40 px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal font-sans"
          >
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="DD-MM-YYYY">DD-MM-YYYY</option>
            <option value="MM-DD-YYYY">MM-DD-YYYY</option>
          </select>
        </SettingRow>
        <SettingRow label="Language" description="Default platform language">
          <select
            value={settings.language}
            onChange={(e) => handleSettingChange('language', e.target.value)}
            className="w-40 px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal font-sans"
          >
            <option value="en">English</option>
            <option value="ar">Arabic</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="zh">Chinese</option>
            <option value="hi">Hindi</option>
            <option value="pt">Portuguese</option>
            <option value="ru">Russian</option>
            <option value="ja">Japanese</option>
          </select>
        </SettingRow>
      </div>

      <SectionDivider label="Support Contact" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Support Email" description="Email address for customer support">
          <TextInput
            value={settings.supportEmail}
            onChange={(value) => handleSettingChange('supportEmail', value)}
            type="email"
            placeholder="support@example.com"
          />
        </SettingRow>
        <SettingRow label="Support Phone" description="Phone number for customer support">
          <TextInput
            value={settings.supportPhone}
            onChange={(value) => handleSettingChange('supportPhone', value)}
            placeholder="+1 (555) 123-4567"
          />
        </SettingRow>
      </div>

      <SectionDivider label="Maintenance" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow
          label="Maintenance Mode"
          description="When enabled, only admins can access the platform"
          warning={settings.maintenanceMode}
        >
          <ToggleSwitch
            enabled={settings.maintenanceMode}
            onChange={(value) => handleSettingChange('maintenanceMode', value)}
          />
        </SettingRow>
        {settings.maintenanceMode && (
          <>
            <div className="p-4 border-t border-nilin-border/30">
              <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                Maintenance Message
              </label>
              <textarea
                value={settings.maintenanceMessage}
                onChange={(e) => handleSettingChange('maintenanceMessage', e.target.value)}
                placeholder="The platform is currently under maintenance..."
                rows={3}
                className="w-full px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal font-sans resize-none"
              />
            </div>
            <div className="p-4 border-t border-nilin-border/30">
              <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                Estimated Duration
              </label>
              <TextInput
                value={settings.maintenanceEstimatedDuration}
                onChange={(value) => handleSettingChange('maintenanceEstimatedDuration', value)}
                placeholder="e.g., 2 hours"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Render Fees Settings
  const renderFeesSettings = () => (
    <div className="space-y-1">
      <SectionDivider label="Platform Fees" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Commission Rate" description="Percentage charged on each transaction">
          <NumberInput
            value={settings.commissionRate}
            onChange={(value) => handleSettingChange('commissionRate', value)}
            min={0}
            max={100}
            step={0.1}
            suffix="%"
          />
        </SettingRow>
        <SettingRow label="Payment Processing Fee" description="Percentage charged for payment processing">
          <NumberInput
            value={settings.paymentProcessingFee}
            onChange={(value) => handleSettingChange('paymentProcessingFee', value)}
            min={0}
            max={100}
            step={0.1}
            suffix="%"
          />
        </SettingRow>
        <SettingRow label="Minimum Withdrawal Amount" description="Minimum amount providers can withdraw">
          <NumberInput
            value={settings.minimumWithdrawalAmount}
            onChange={(value) => handleSettingChange('minimumWithdrawalAmount', value)}
            min={0}
            step={1}
            suffix="AED"
          />
        </SettingRow>
        <SettingRow label="Platform Fee Type" description="How platform fees are calculated">
          <select
            value={settings.platformFeeType}
            onChange={(e) => handleSettingChange('platformFeeType', e.target.value as 'percentage' | 'fixed' | 'both')}
            className="w-36 px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal font-sans"
          >
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed Amount</option>
            <option value="both">Both</option>
          </select>
        </SettingRow>
      </div>

      <SectionDivider label="Fee Customization" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Tax Rate" description="Additional tax percentage applied to bookings">
          <NumberInput
            value={settings.taxRate}
            onChange={(value) => handleSettingChange('taxRate', value)}
            min={0}
            max={100}
            step={0.1}
            suffix="%"
          />
        </SettingRow>
        <SettingRow label="Weekend Rates" description="Additional percentage for weekend bookings">
          <NumberInput
            value={settings.weekendRates}
            onChange={(value) => handleSettingChange('weekendRates', value)}
            min={0}
            max={100}
            step={5}
            suffix="%"
          />
        </SettingRow>
        <SettingRow label="Holiday Rates" description="Additional percentage for holiday bookings">
          <NumberInput
            value={settings.holidayRates}
            onChange={(value) => handleSettingChange('holidayRates', value)}
            min={0}
            max={200}
            step={5}
            suffix="%"
          />
        </SettingRow>
      </div>
    </div>
  );

  // Render Booking Settings
  const renderBookingSettings = () => (
    <div className="space-y-1">
      <SectionDivider label="Booking Configuration" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Default Booking Buffer" description="Minutes before booking start time">
          <NumberInput
            value={settings.defaultBookingBufferMinutes}
            onChange={(value) => handleSettingChange('defaultBookingBufferMinutes', value)}
            min={0}
            max={1440}
            step={5}
            suffix="min"
          />
        </SettingRow>
        <SettingRow label="Cancellation Window" description="Hours before booking to allow cancellation">
          <NumberInput
            value={settings.cancellationWindowHours}
            onChange={(value) => handleSettingChange('cancellationWindowHours', value)}
            min={0}
            max={168}
            step={1}
            suffix="hrs"
          />
        </SettingRow>
        <SettingRow label="Max Booking Advance Days" description="Maximum days in advance users can book">
          <NumberInput
            value={settings.maxBookingAdvanceDays}
            onChange={(value) => handleSettingChange('maxBookingAdvanceDays', value)}
            min={1}
            max={365}
            step={1}
            suffix="days"
          />
        </SettingRow>
        <SettingRow label="Min Booking Advance Hours" description="Minimum hours before booking time">
          <NumberInput
            value={settings.minBookingAdvanceHours}
            onChange={(value) => handleSettingChange('minBookingAdvanceHours', value)}
            min={0}
            max={72}
            step={1}
            suffix="hrs"
          />
        </SettingRow>
      </div>

      <SectionDivider label="Auto Features" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow
          label="Auto-Assignment"
          description="Automatically assign providers to bookings"
        >
          <ToggleSwitch
            enabled={settings.autoAssignmentEnabled}
            onChange={(value) => handleSettingChange('autoAssignmentEnabled', value)}
          />
        </SettingRow>
        <SettingRow
          label="Auto-Confirm Bookings"
          description="Automatically confirm bookings without manual approval"
        >
          <ToggleSwitch
            enabled={settings.autoConfirmEnabled}
            onChange={(value) => handleSettingChange('autoConfirmEnabled', value)}
          />
        </SettingRow>
        <SettingRow
          label="Instant Booking"
          description="Allow customers to book instantly without provider approval"
        >
          <ToggleSwitch
            enabled={settings.instantBooking}
            onChange={(value) => handleSettingChange('instantBooking', value)}
          />
        </SettingRow>
      </div>

      <SectionDivider label="Booking Limits" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Max Bookings Per Day" description="Maximum bookings per user per day">
          <NumberInput
            value={settings.maxDailyBookings}
            onChange={(value) => handleSettingChange('maxDailyBookings', value)}
            min={1}
            max={50}
            step={1}
            suffix="bookings"
          />
        </SettingRow>
      </div>
    </div>
  );

  // Render Notifications Settings
  const renderNotificationsSettings = () => (
    <div className="space-y-1">
      <SectionDivider label="Notification Channels" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow
          label="Email Notifications"
          description="Send notifications via email"
        >
          <ToggleSwitch
            enabled={settings.emailNotificationsEnabled}
            onChange={(value) => handleSettingChange('emailNotificationsEnabled', value)}
          />
        </SettingRow>
        <SettingRow
          label="SMS Notifications"
          description="Send notifications via SMS"
        >
          <ToggleSwitch
            enabled={settings.smsNotificationsEnabled}
            onChange={(value) => handleSettingChange('smsNotificationsEnabled', value)}
          />
        </SettingRow>
        <SettingRow
          label="Push Notifications"
          description="Send push notifications to mobile apps"
        >
          <ToggleSwitch
            enabled={settings.pushNotificationsEnabled}
            onChange={(value) => handleSettingChange('pushNotificationsEnabled', value)}
          />
        </SettingRow>
      </div>

      <SectionDivider label="Sound Settings" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow
          label="Notification Sounds"
          description="Play sounds for notifications"
        >
          <ToggleSwitch
            enabled={settings.notificationSounds}
            onChange={(value) => handleSettingChange('notificationSounds', value)}
          />
        </SettingRow>
      </div>

      <SectionDivider label="Quiet Hours" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow
          label="Enable Quiet Hours"
          description="Pause notifications during specified hours"
        >
          <ToggleSwitch
            enabled={settings.quietHoursEnabled}
            onChange={(value) => handleSettingChange('quietHoursEnabled', value)}
          />
        </SettingRow>
        {settings.quietHoursEnabled && (
          <>
            <div className="p-4 border-t border-nilin-border/30">
              <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                value={settings.quietHoursStart}
                onChange={(e) => handleSettingChange('quietHoursStart', e.target.value)}
                className="w-full px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal font-sans"
              />
            </div>
            <div className="p-4 border-t border-nilin-border/30">
              <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                End Time
              </label>
              <input
                type="time"
                value={settings.quietHoursEnd}
                onChange={(e) => handleSettingChange('quietHoursEnd', e.target.value)}
                className="w-full px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal font-sans"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );

  // Render Email Settings
  const renderEmailSettings = () => (
    <div className="space-y-1">
      <SectionDivider label="Email Provider" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
              Email Provider
            </label>
            <SelectInput
              value={settings.emailConfig.provider}
              onChange={(value) => handleEmailConfigChange('provider', value)}
              options={[
                { value: 'smtp', label: 'SMTP' },
                { value: 'resend', label: 'Resend' },
                { value: 'ses', label: 'Amazon SES' },
                { value: 'sendgrid', label: 'SendGrid' },
              ]}
            />
          </div>
        </div>
      </div>

      {settings.emailConfig.provider === 'smtp' && (
        <>
          <SectionDivider label="SMTP Configuration" />
          <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                    SMTP Host
                  </label>
                  <TextInput
                    value={settings.emailConfig.smtp?.host || ''}
                    onChange={(value) => handleSmtpConfigChange('host', value)}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                    Port
                  </label>
                  <TextInput
                    value={String(settings.emailConfig.smtp?.port || 587)}
                    onChange={(value) => handleSmtpConfigChange('port', parseInt(value) || 587)}
                    type="number"
                    placeholder="587"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-nilin-charcoal font-sans">
                    SSL/TLS (Secure)
                  </label>
                  <ToggleSwitch
                    enabled={settings.emailConfig.smtp?.secure || false}
                    onChange={(value) => handleSmtpConfigChange('secure', value)}
                  />
                </div>
                <p className="text-xs text-nilin-warmGray font-sans">
                  Enable for port 465, disable for port 587
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  Username
                </label>
                <TextInput
                  value={settings.emailConfig.smtp?.user || ''}
                  onChange={(value) => handleSmtpConfigChange('user', value)}
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  Password
                </label>
                <TextInput
                  value={settings.emailConfig.smtp?.pass || ''}
                  onChange={(value) => handleSmtpConfigChange('pass', value)}
                  type="password"
                  placeholder="Enter password"
                />
              </div>
            </div>
          </div>
        </>
      )}

      <SectionDivider label="Sender Information" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
              From Email
            </label>
            <TextInput
              value={settings.emailConfig.fromEmail}
              onChange={(value) => handleEmailConfigChange('fromEmail', value)}
              type="email"
              placeholder="noreply@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
              From Name
            </label>
            <TextInput
              value={settings.emailConfig.fromName}
              onChange={(value) => handleEmailConfigChange('fromName', value)}
              placeholder="HomeService Platform"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
              Reply-To Email
            </label>
            <TextInput
              value={settings.emailConfig.replyToEmail}
              onChange={(value) => handleEmailConfigChange('replyToEmail', value)}
              type="email"
              placeholder="support@example.com"
            />
          </div>
        </div>
      </div>

      <SectionDivider label="Test Configuration" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <div className="p-4">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                Test Email Address
              </label>
              <TextInput
                value={testEmail}
                onChange={setTestEmail}
                type="email"
                placeholder="test@example.com"
              />
            </div>
            <button
              onClick={handleTestEmail}
              disabled={isTestingEmail || !testEmail}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm font-medium font-sans hover:shadow-nilin-warm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isTestingEmail ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render SMS Settings
  const renderSmsSettings = () => (
    <div className="space-y-1">
      <SectionDivider label="SMS Configuration" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <div className="p-4 space-y-4">
          <SettingRow
            label="Enable SMS"
            description="Send SMS notifications to users"
          >
            <ToggleSwitch
              enabled={settings.smsConfig.enabled}
              onChange={(value) => handleSmsConfigChange('enabled', value)}
            />
          </SettingRow>
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
              SMS Provider
            </label>
            <SelectInput
              value={settings.smsConfig.provider}
              onChange={(value) => handleSmsConfigChange('provider', value)}
              options={[
                { value: 'twilio', label: 'Twilio' },
                { value: 'vonage', label: 'Vonage' },
                { value: 'msg91', label: 'MSG91' },
              ]}
              disabled={!settings.smsConfig.enabled}
            />
          </div>
        </div>
      </div>

      {settings.smsConfig.provider === 'twilio' && (
        <>
          <SectionDivider label="Twilio Credentials" />
          <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  Account SID
                </label>
                <TextInput
                  value={settings.smsConfig.twilio?.accountSid || ''}
                  onChange={(value) => handleTwilioConfigChange('accountSid', value)}
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  disabled={!settings.smsConfig.enabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  Auth Token
                </label>
                <TextInput
                  value={settings.smsConfig.twilio?.authToken || ''}
                  onChange={(value) => handleTwilioConfigChange('authToken', value)}
                  type="password"
                  placeholder="Enter auth token"
                  disabled={!settings.smsConfig.enabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  From Number
                </label>
                <TextInput
                  value={settings.smsConfig.twilio?.fromNumber || ''}
                  onChange={(value) => handleTwilioConfigChange('fromNumber', value)}
                  placeholder="+1234567890"
                  disabled={!settings.smsConfig.enabled}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {settings.smsConfig.provider === 'vonage' && (
        <>
          <SectionDivider label="Vonage Credentials" />
          <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  API Key
                </label>
                <TextInput
                  value={settings.smsConfig.vonage?.apiKey || ''}
                  onChange={(value) => handleVonageConfigChange('apiKey', value)}
                  placeholder="Enter API key"
                  disabled={!settings.smsConfig.enabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  API Secret
                </label>
                <TextInput
                  value={settings.smsConfig.vonage?.apiSecret || ''}
                  onChange={(value) => handleVonageConfigChange('apiSecret', value)}
                  type="password"
                  placeholder="Enter API secret"
                  disabled={!settings.smsConfig.enabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  From Number
                </label>
                <TextInput
                  value={settings.smsConfig.vonage?.fromNumber || ''}
                  onChange={(value) => handleVonageConfigChange('fromNumber', value)}
                  placeholder="+1234567890"
                  disabled={!settings.smsConfig.enabled}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {settings.smsConfig.provider === 'msg91' && (
        <>
          <SectionDivider label="MSG91 Credentials" />
          <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  Auth Key
                </label>
                <TextInput
                  value={settings.smsConfig.msg91?.authKey || ''}
                  onChange={(value) => handleMsg91ConfigChange('authKey', value)}
                  type="password"
                  placeholder="Enter auth key"
                  disabled={!settings.smsConfig.enabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  Template ID
                </label>
                <TextInput
                  value={settings.smsConfig.msg91?.templateId || ''}
                  onChange={(value) => handleMsg91ConfigChange('templateId', value)}
                  placeholder="Enter template ID"
                  disabled={!settings.smsConfig.enabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  Sender ID
                </label>
                <TextInput
                  value={settings.smsConfig.msg91?.senderId || ''}
                  onChange={(value) => handleMsg91ConfigChange('senderId', value)}
                  placeholder="Enter sender ID"
                  disabled={!settings.smsConfig.enabled}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Render Templates Settings
  const renderTemplatesSettings = () => (
    <div className="space-y-1">
      <SectionDivider label="Email Templates" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <div className="divide-y divide-nilin-border/30">
          {EMAIL_TEMPLATES_CONFIG.map((template) => {
            const templateData = settings.emailTemplates[template.id] || { subject: '', body: '', enabled: true };
            return (
              <div key={template.id} className="flex items-center justify-between p-4 hover:bg-nilin-blush/30 transition-colors">
                <div className="flex-1 mr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-nilin-charcoal font-sans">{template.name}</span>
                    {!templateData.enabled && (
                      <span className="px-2 py-0.5 text-xs bg-nilin-muted text-nilin-warmGray rounded-full font-sans">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-nilin-warmGray mt-0.5 font-sans">{template.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <ToggleSwitch
                    enabled={templateData.enabled}
                    onChange={() => handleTemplateToggle(template.id)}
                  />
                  <button
                    onClick={() => openTemplateEditor(template.id)}
                    className="p-2 text-nilin-coral hover:bg-nilin-coral/10 rounded-lg transition-colors"
                    title="Edit template"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Template Variables Reference */}
      <SectionDivider label="Available Variables" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden p-4">
        <div className="flex flex-wrap gap-2">
          {Array.from(new Set(EMAIL_TEMPLATES_CONFIG.flatMap((t) => t.variables))).map((variable) => (
            <span
              key={variable}
              className="px-2 py-1 bg-nilin-blush/50 text-nilin-coral text-xs rounded-lg font-mono"
            >
              {variable}
            </span>
          ))}
        </div>
        <p className="text-xs text-nilin-warmGray mt-3 font-sans">
          Use these variables in your templates. They will be replaced with actual values when emails are sent.
        </p>
      </div>

      {/* Template Editor Modal */}
      {templateModal.isOpen && (
        <div className="fixed inset-0 bg-nilin-charcoal/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass glass-blur rounded-2xl max-w-2xl w-full shadow-nilin-lg inner-glow max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-nilin-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-serif text-nilin-charcoal">
                    {EMAIL_TEMPLATES_CONFIG.find((t) => t.id === templateModal.templateId)?.name || 'Edit Template'}
                  </h3>
                  <p className="text-xs text-nilin-warmGray font-sans mt-1">
                    {EMAIL_TEMPLATES_CONFIG.find((t) => t.id === templateModal.templateId)?.description}
                  </p>
                </div>
                <button
                  onClick={closeTemplateEditor}
                  className="p-2 text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  Subject
                </label>
                <TextInput
                  value={templateModal.subject}
                  onChange={(value) => setTemplateModal((prev) => ({ ...prev, subject: value }))}
                  placeholder="Enter email subject"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  Body
                </label>
                <textarea
                  value={templateModal.body}
                  onChange={(e) => setTemplateModal((prev) => ({ ...prev, body: e.target.value }))}
                  placeholder="Enter email body content..."
                  rows={12}
                  className="w-full px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal font-sans resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-nilin-warmGray font-sans mb-2">
                  Available Variables
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {EMAIL_TEMPLATES_CONFIG
                    .find((t) => t.id === templateModal.templateId)
                    ?.variables.map((variable) => (
                      <button
                        key={variable}
                        onClick={() => {
                          setTemplateModal((prev) => ({
                            ...prev,
                            body: prev.body + variable,
                          }));
                        }}
                        className="px-2 py-1 bg-nilin-blush/50 text-nilin-coral text-xs rounded-lg font-mono hover:bg-nilin-blush transition-colors"
                      >
                        {variable}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-nilin-border/50 flex justify-end gap-3">
              <button
                onClick={closeTemplateEditor}
                className="px-4 py-2 border border-nilin-border rounded-xl text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-blush/50 font-sans transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveTemplate}
                className="px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm font-medium font-sans hover:shadow-nilin-warm transition-all"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Render Branding Settings
  const renderBrandingSettings = () => (
    <div className="space-y-1">
      <SectionDivider label="Platform Logo" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <div className="p-6">
          {settings.platformLogo ? (
            <div className="space-y-4">
              <div className="flex items-center justify-center p-8 bg-white rounded-xl border border-nilin-border/50">
                <img
                  src={settings.platformLogo}
                  alt="Platform Logo"
                  className="max-h-32 max-w-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden text-center text-nilin-warmGray">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Unable to load logo</p>
                </div>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex items-center px-4 py-2 border border-nilin-border/50 rounded-xl text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-blush/50 font-sans transition-colors disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Change Logo
                </button>
                <button
                  onClick={handleLogoRemove}
                  disabled={isUploading}
                  className="inline-flex items-center px-4 py-2 border border-red-200 rounded-xl text-sm font-medium text-red-600 bg-white hover:bg-red-50 font-sans transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                isDragging
                  ? 'border-nilin-coral bg-nilin-coral/5'
                  : 'border-nilin-border hover:border-nilin-coral/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-nilin-blush/50 flex items-center justify-center">
                <Upload className={`h-8 w-8 text-nilin-coral ${isUploading ? 'animate-bounce' : ''}`} />
              </div>
              <p className="text-sm font-medium text-nilin-charcoal font-sans mb-1">
                {isUploading ? 'Uploading...' : 'Drop your logo here or click to upload'}
              </p>
              <p className="text-xs text-nilin-warmGray font-sans mb-4">
                Supported formats: JPEG, PNG, GIF, WebP (max 5MB)
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm font-medium font-sans hover:shadow-nilin-warm transition-all disabled:opacity-50"
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose File
              </button>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      <SectionDivider label="Favicon" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <div className="p-4 space-y-4">
          <SettingRow label="Favicon URL" description="URL to your platform favicon (32x32 or 64x64)">
            <TextInput
              value={settings.favicon}
              onChange={(value) => handleSettingChange('favicon', value)}
              type="url"
              placeholder="https://example.com/favicon.ico"
            />
          </SettingRow>
        </div>
      </div>

      <SectionDivider label="Brand Colors" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between py-4 px-4">
            <div className="flex-1 mr-4">
              <label className="text-sm font-medium text-nilin-charcoal font-sans">Primary Color</label>
              <p className="text-xs text-nilin-warmGray mt-0.5 font-sans">Main brand color for buttons and accents</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.primaryColor}
                onChange={(e) => handleSettingChange('primaryColor', e.target.value)}
                className="w-12 h-10 rounded-lg cursor-pointer border border-nilin-border"
              />
              <TextInput
                value={settings.primaryColor}
                onChange={(value) => handleSettingChange('primaryColor', value)}
                placeholder="#E8B4A8"
                className="w-28"
              />
            </div>
          </div>
          <div className="flex items-center justify-between py-4 px-4 border-t border-nilin-border/30">
            <div className="flex-1 mr-4">
              <label className="text-sm font-medium text-nilin-charcoal font-sans">Secondary Color</label>
              <p className="text-xs text-nilin-warmGray mt-0.5 font-sans">Secondary brand color for gradients</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.secondaryColor}
                onChange={(e) => handleSettingChange('secondaryColor', e.target.value)}
                className="w-12 h-10 rounded-lg cursor-pointer border border-nilin-border"
              />
              <TextInput
                value={settings.secondaryColor}
                onChange={(value) => handleSettingChange('secondaryColor', value)}
                placeholder="#D4A89A"
                className="w-28"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render Backup Settings
  const renderBackupSettings = () => (
    <div className="space-y-1">
      <SectionDivider label="Cloud Backup" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow
          label="Enable Automatic Backup"
          description="Automatically backup settings to cloud storage"
        >
          <ToggleSwitch
            enabled={settings.backupEnabled}
            onChange={(value) => handleSettingChange('backupEnabled', value)}
          />
        </SettingRow>
        {settings.backupEnabled && (
          <>
            <div className="p-4 border-t border-nilin-border/30">
              <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                Cloud Storage Provider
              </label>
              <select
                value={settings.backupCloudStorage}
                onChange={(e) => handleSettingChange('backupCloudStorage', e.target.value as 'none' | 'aws' | 'gcp' | 'azure')}
                className="w-full px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal font-sans"
              >
                <option value="none">Select Provider</option>
                <option value="aws">Amazon Web Services (AWS S3)</option>
                <option value="gcp">Google Cloud Platform (GCP)</option>
                <option value="azure">Microsoft Azure (Blob Storage)</option>
              </select>
            </div>
            <div className="p-4 border-t border-nilin-border/30">
              <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                Retention Period (Days)
              </label>
              <p className="text-xs text-nilin-warmGray mb-2 font-sans">
                How long to keep backup snapshots before automatic deletion
              </p>
              <NumberInput
                value={settings.backupRetentionDays}
                onChange={(value) => handleSettingChange('backupRetentionDays', value)}
                min={1}
                max={365}
                step={1}
                suffix="days"
              />
            </div>
          </>
        )}
      </div>

      <SectionDivider label="Export Settings" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Download className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-nilin-charcoal font-sans">Export Platform Settings</h4>
              <p className="text-xs text-nilin-warmGray font-sans mt-1">
                Download all your platform settings as a JSON file. You can use this file to backup your configuration or transfer settings to another environment.
              </p>
              <button
                onClick={handleExportSettings}
                className="mt-4 inline-flex items-center px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm font-medium font-sans hover:shadow-nilin-warm transition-all"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Settings
              </button>
            </div>
          </div>
        </div>
      </div>

      <SectionDivider label="Import Settings" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Upload className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-nilin-charcoal font-sans">Import Platform Settings</h4>
              <p className="text-xs text-nilin-warmGray font-sans mt-1">
                Import settings from a previously exported JSON file. This will replace all current settings with the imported configuration.
              </p>
              <p className="text-xs text-amber-600 font-sans mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Warning: This action cannot be undone
              </p>
              <button
                onClick={handleImportClick}
                className="mt-4 inline-flex items-center px-4 py-2 border border-nilin-border/50 rounded-xl text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-blush/50 font-sans transition-colors"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import Settings
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFileSelect}
                className="hidden"
              />
            </div>
          </div>
        </div>
      </div>

      <SectionDivider label="Reset Settings" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <RotateCcw className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-nilin-charcoal font-sans">Reset to Defaults</h4>
              <p className="text-xs text-nilin-warmGray font-sans mt-1">
                Reset all platform settings to their default values. This will remove all custom configurations and restore the original settings.
              </p>
              <p className="text-xs text-red-600 font-sans mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                This action cannot be undone. Consider exporting your settings first.
              </p>
              <button
                onClick={handleResetToDefaults}
                className="mt-4 inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium font-sans hover:bg-red-600 transition-colors"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render Security Settings
  const renderSecuritySettings = () => {
    // State for API key modal
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);
    const [newApiKeyName, setNewApiKeyName] = useState('');
    const [isGeneratingKey, setIsGeneratingKey] = useState(false);
    const [newlyGeneratedKey, setNewlyGeneratedKey] = useState<string | null>(null);

    // State for IP allowlist
    const [newIpAddress, setNewIpAddress] = useState('');

    // Generate API key
    const handleGenerateApiKey = useCallback(async () => {
      if (!newApiKeyName.trim()) {
        toast.error('API key name required', 'Please enter a name for the API key');
        return;
      }
      setIsGeneratingKey(true);
      try {
        // Generate a random API key
        const generatedKey = `sk_${Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')}`;
        setNewlyGeneratedKey(generatedKey);
        setShowApiKeyModal(false);
        setNewApiKeyName('');

        // Add to settings
        const newKey: ApiKey = {
          id: `key_${Date.now()}`,
          name: newApiKeyName,
          key: generatedKey,
          createdAt: new Date().toISOString(),
          lastUsed: null,
        };
        handleSettingChange('apiKeys', [...settings.apiKeys, newKey]);
        toast.success('API key generated', 'Make sure to copy and save the key securely');
      } catch (error: any) {
        toast.error('Failed to generate key', error.message);
      } finally {
        setIsGeneratingKey(false);
      }
    }, [newApiKeyName, settings.apiKeys, handleSettingChange, toast]);

    // Delete API key
    const handleDeleteApiKey = useCallback((keyId: string) => {
      handleSettingChange('apiKeys', settings.apiKeys.filter(k => k.id !== keyId));
      toast.success('API key deleted', 'The key has been removed');
    }, [settings.apiKeys, handleSettingChange, toast]);

    // Copy API key
    const handleCopyApiKey = useCallback((key: string) => {
      navigator.clipboard.writeText(key);
      toast.success('Copied', 'API key copied to clipboard');
    }, [toast]);

    // Add IP to allowlist
    const handleAddIpAddress = useCallback(() => {
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^([a-fA-F0-9:]+)$/;
      if (!ipRegex.test(newIpAddress)) {
        toast.error('Invalid IP address', 'Please enter a valid IP address');
        return;
      }
      if (settings.ipAllowlist.includes(newIpAddress)) {
        toast.error('IP already exists', 'This IP address is already in the allowlist');
        return;
      }
      handleSettingChange('ipAllowlist', [...settings.ipAllowlist, newIpAddress]);
      setNewIpAddress('');
      toast.success('IP added', 'IP address added to allowlist');
    }, [newIpAddress, settings.ipAllowlist, handleSettingChange, toast]);

    // Remove IP from allowlist
    const handleRemoveIpAddress = useCallback((ip: string) => {
      handleSettingChange('ipAllowlist', settings.ipAllowlist.filter(i => i !== ip));
      toast.success('IP removed', 'IP address removed from allowlist');
    }, [settings.ipAllowlist, handleSettingChange, toast]);

    return (
      <div className="space-y-1">
        <SectionDivider label="Authentication" />
        <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
          <SettingRow
            label="Require 2FA"
            description="Mandatory two-factor authentication for all users"
          >
            <ToggleSwitch
              enabled={settings.require2FA}
              onChange={(value) => handleSettingChange('require2FA', value)}
            />
          </SettingRow>
          <SettingRow label="Session Timeout" description="Minutes before inactive session expires">
            <NumberInput
              value={settings.sessionTimeoutMinutes}
              onChange={(value) => handleSettingChange('sessionTimeoutMinutes', value)}
              min={5}
              max={1440}
              step={5}
              suffix="min"
            />
          </SettingRow>
        </div>

        <SectionDivider label="Password Policy" />
        <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
          <SettingRow label="Minimum Password Length" description="Minimum characters required for passwords">
            <NumberInput
              value={settings.passwordMinLength}
              onChange={(value) => handleSettingChange('passwordMinLength', value)}
              min={6}
              max={128}
              step={1}
              suffix="chars"
            />
          </SettingRow>
          <SettingRow
            label="Require Special Characters"
            description="Password must contain special characters (!@#$%)"
          >
            <ToggleSwitch
              enabled={settings.passwordRequireSpecialChar}
              onChange={(value) => handleSettingChange('passwordRequireSpecialChar', value)}
            />
          </SettingRow>
          <SettingRow
            label="Require Numbers"
            description="Password must contain at least one number"
          >
            <ToggleSwitch
              enabled={settings.passwordRequireNumber}
              onChange={(value) => handleSettingChange('passwordRequireNumber', value)}
            />
          </SettingRow>
          <SettingRow
            label="Require Uppercase"
            description="Password must contain uppercase letters"
          >
            <ToggleSwitch
              enabled={settings.passwordRequireUppercase}
              onChange={(value) => handleSettingChange('passwordRequireUppercase', value)}
            />
          </SettingRow>
          <SettingRow label="Max Login Attempts" description="Failed attempts before account lockout">
            <NumberInput
              value={settings.maxLoginAttempts}
              onChange={(value) => handleSettingChange('maxLoginAttempts', value)}
              min={3}
              max={20}
              step={1}
              suffix="attempts"
            />
          </SettingRow>
          <SettingRow label="Lockout Duration" description="Account lockout duration in minutes">
            <NumberInput
              value={settings.lockoutDurationMinutes}
              onChange={(value) => handleSettingChange('lockoutDurationMinutes', value)}
              min={5}
              max={1440}
              step={5}
              suffix="min"
            />
          </SettingRow>
        </div>

        <SectionDivider label="Platform Features" />
        <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
          <SettingRow
            label="Enable FAQ"
            description="Show FAQ/help section on the platform"
          >
            <ToggleSwitch
              enabled={settings.enableFAQ}
              onChange={(value) => handleSettingChange('enableFAQ', value)}
            />
          </SettingRow>
          <SettingRow
            label="Enable Audit Logs"
            description="Track and log all admin actions"
          >
            <ToggleSwitch
              enabled={settings.enableAuditLogs}
              onChange={(value) => handleSettingChange('enableAuditLogs', value)}
            />
          </SettingRow>
        </div>

        <SectionDivider label="IP Allowlist" />
        <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
          <div className="p-4 space-y-4">
            <p className="text-xs text-nilin-warmGray font-sans">
              Restrict admin panel access to specific IP addresses. Leave empty to allow all IPs.
            </p>
            <div className="flex gap-2">
              <TextInput
                value={newIpAddress}
                onChange={setNewIpAddress}
                placeholder="e.g., 192.168.1.1"
                className="flex-1"
              />
              <button
                onClick={handleAddIpAddress}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm font-medium font-sans hover:shadow-nilin-warm transition-all"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </button>
            </div>
            {settings.ipAllowlist.length > 0 && (
              <div className="space-y-2">
                {settings.ipAllowlist.map((ip, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-nilin-blush/20 rounded-lg">
                    <span className="text-sm font-mono text-nilin-charcoal">{ip}</span>
                    <button
                      onClick={() => handleRemoveIpAddress(ip)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <SectionDivider label="API Keys" />
        <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-nilin-warmGray font-sans">
                Manage API keys for external integrations. Keys are only shown once after generation.
              </p>
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm font-medium font-sans hover:shadow-nilin-warm transition-all"
              >
                <Key className="h-4 w-4 mr-1" />
                Generate Key
              </button>
            </div>
            {settings.apiKeys.length > 0 ? (
              <div className="space-y-2">
                {settings.apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="p-4 bg-nilin-blush/20 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-nilin-charcoal">{apiKey.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyApiKey(apiKey.key)}
                          className="p-2 text-nilin-coral hover:bg-nilin-coral/10 rounded-lg transition-colors"
                          title="Copy API key"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteApiKey(apiKey.id)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete API key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-nilin-warmGray">
                      <span className="font-mono">{apiKey.key.substring(0, 20)}...{apiKey.key.slice(-8)}</span>
                      <span>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-nilin-warmGray text-center py-4">No API keys generated yet</p>
            )}
          </div>
        </div>

        {/* New API Key Modal */}
        {showApiKeyModal && (
          <div className="fixed inset-0 bg-nilin-charcoal/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="glass glass-blur rounded-2xl max-w-md w-full shadow-nilin-lg inner-glow">
              <div className="p-6">
                <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Generate API Key</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                      Key Name
                    </label>
                    <TextInput
                      value={newApiKeyName}
                      onChange={setNewApiKeyName}
                      placeholder="e.g., Production API, Development Key"
                    />
                  </div>
                  <p className="text-xs text-nilin-warmGray font-sans">
                    The API key will be shown once after generation. Make sure to copy and store it securely.
                  </p>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowApiKeyModal(false);
                      setNewApiKeyName('');
                    }}
                    className="px-4 py-2 border border-nilin-border rounded-xl text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-blush/50 font-sans transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleGenerateApiKey}
                    disabled={isGeneratingKey || !newApiKeyName.trim()}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm font-medium font-sans hover:shadow-nilin-warm transition-all disabled:opacity-50"
                  >
                    {isGeneratingKey ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Key className="h-4 w-4 mr-2" />
                    )}
                    Generate
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Newly Generated Key Modal */}
        {newlyGeneratedKey && (
          <div className="fixed inset-0 bg-nilin-charcoal/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="glass glass-blur rounded-2xl max-w-md w-full shadow-nilin-lg inner-glow">
              <div className="p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                </div>
                <h3 className="text-lg font-serif text-nilin-charcoal text-center mb-2">API Key Generated</h3>
                <p className="text-sm text-nilin-warmGray text-center mb-4 font-sans">
                  Copy and save this key securely. It will not be shown again.
                </p>
                <div className="bg-nilin-blush/30 p-3 rounded-xl">
                  <code className="text-xs font-mono break-all text-nilin-charcoal">{newlyGeneratedKey}</code>
                </div>
                <div className="flex justify-center gap-3 mt-6">
                  <button
                    onClick={() => {
                      handleCopyApiKey(newlyGeneratedKey);
                      setNewlyGeneratedKey(null);
                    }}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl text-sm font-medium font-sans hover:shadow-nilin-warm transition-all"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy & Close
                  </button>
                  <button
                    onClick={() => setNewlyGeneratedKey(null)}
                    className="px-4 py-2 border border-nilin-border rounded-xl text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-blush/50 font-sans transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render System Settings
  const renderSystemSettings = () => (
    <div className="space-y-1">
      <SectionDivider label="Performance" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Cache TTL" description="Time in seconds to cache API responses">
          <NumberInput
            value={settings.cacheTTLSeconds}
            onChange={(value) => handleSettingChange('cacheTTLSeconds', value)}
            min={0}
            max={86400}
            step={60}
            suffix="sec"
          />
        </SettingRow>
      </div>

      <SectionDivider label="Rate Limiting" />
      <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
        <SettingRow label="Requests Per Minute" description="Maximum requests per minute per user">
          <NumberInput
            value={settings.rateLimitRequestsPerMinute}
            onChange={(value) => handleSettingChange('rateLimitRequestsPerMinute', value)}
            min={1}
            max={10000}
            step={10}
            suffix="req/min"
          />
        </SettingRow>
        <SettingRow label="API Rate Limit Per Hour" description="Maximum API calls per hour">
          <NumberInput
            value={settings.apiRateLimitPerHour}
            onChange={(value) => handleSettingChange('apiRateLimitPerHour', value)}
            min={1}
            max={100000}
            step={100}
            suffix="req/hr"
          />
        </SettingRow>
      </div>
    </div>
  );

  // Render active section content
  const renderSectionContent = () => {
    if (isLoading) {
      return <LoadingSkeleton />;
    }

    switch (activeSection) {
      case 'general':
        return renderGeneralSettings();
      case 'fees':
        return renderFeesSettings();
      case 'booking':
        return renderBookingSettings();
      case 'notifications':
        return renderNotificationsSettings();
      case 'email':
        return renderEmailSettings();
      case 'sms':
        return renderSmsSettings();
      case 'templates':
        return renderTemplatesSettings();
      case 'branding':
        return renderBrandingSettings();
      case 'security':
        return renderSecuritySettings();
      case 'backup':
        return renderBackupSettings();
      case 'system':
        return renderSystemSettings();
      default:
        return null;
    }
  };

  return (
    <PageLayout
      title="Settings"
      subtitle="Platform configuration"
      backHref="/admin/dashboard"
      headerActions={
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={isResetting || isSaving}
            className="inline-flex items-center px-4 py-2 border border-nilin-border/50 rounded-xl shadow-sm text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-blush/50 font-sans transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isResetting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4 mr-2" />
            )}
            Reset
          </button>
          <button
            onClick={fetchSettings}
            disabled={isLoading || isSaving || isResetting}
            className="inline-flex items-center px-4 py-2 border border-nilin-border/50 rounded-xl shadow-sm text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-blush/50 font-sans transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={saveSettings}
            disabled={!hasChanges || isSaving || isResetting}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-nilin-rose to-nilin-coral hover:shadow-nilin-warm font-sans transition-all btn-3d disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </button>
        </div>
      }
    >
      {/* Maintenance Mode Warning Banner */}
      {settings.maintenanceMode && (
        <div className="mb-6 rounded-xl p-4 bg-amber-50 border border-amber-200">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-amber-800 font-sans">
                Maintenance Mode Active
              </h3>
              <p className="text-sm mt-1 text-amber-700 font-sans">
                The platform is currently in maintenance mode. Only administrators can access the site.
                Customers and providers will see a maintenance page.
              </p>
            </div>
            <button
              onClick={() => handleSettingChange('maintenanceMode', false)}
              className="ml-3 p-1 text-amber-500 hover:text-amber-700 transition-colors"
              title="Disable maintenance mode"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-nilin-charcoal/50 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass glass-blur rounded-2xl max-w-md w-full shadow-nilin-lg inner-glow">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                </div>
              </div>
              <h3 className="text-lg font-serif text-nilin-charcoal text-center mb-2">
                Reset Settings?
              </h3>
              <p className="text-sm text-nilin-warmGray text-center mb-6 font-sans">
                This will restore all platform settings to their default values. This action cannot be undone.
              </p>
              <div className="flex items-center justify-center space-x-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  disabled={isResetting}
                  className="px-4 py-2 border border-nilin-border rounded-xl text-sm font-medium text-nilin-charcoal bg-white hover:bg-nilin-blush/50 font-sans transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={resetSettings}
                  disabled={isResetting}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium font-sans hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center"
                >
                  {isResetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Reset All Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden sticky top-6">
            <div className="p-2">
              <h3 className="px-3 py-2 text-xs font-semibold text-nilin-warmGray uppercase tracking-wider font-sans">
                Settings Sections
              </h3>
              <nav className="space-y-1">
                {SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => handleSectionChange(section.id)}
                      className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium font-sans transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white shadow-md btn-3d'
                          : 'text-nilin-charcoal hover:bg-nilin-blush/50'
                      }`}
                    >
                      <Icon className={`h-4 w-4 mr-3 ${isActive ? '' : 'text-nilin-coral'}`} />
                      {section.label}
                      {isActive && (
                        <ChevronRight className="ml-auto h-4 w-4" />
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Changes Indicator */}
            {hasChanges && (
              <div className="p-4 border-t border-nilin-border/50 bg-nilin-blush/20">
                <div className="flex items-center text-sm text-nilin-coral font-sans">
                  <div className="w-2 h-2 rounded-full bg-nilin-coral mr-2 animate-pulse"></div>
                  Unsaved changes
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 min-w-0">
          <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
            {/* Section Header */}
            <div className="px-6 py-4 border-b border-nilin-border/50 bg-gradient-to-r from-nilin-blush/30 to-transparent">
              <div className="flex items-center space-x-3">
                {(() => {
                  const Section = SECTIONS.find((s) => s.id === activeSection);
                  const Icon = Section?.icon || Settings;
                  return (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-nilin-coral/20 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-nilin-coral" />
                      </div>
                      <div>
                        <h2 className="text-lg font-serif text-nilin-charcoal">
                          {Section?.label || 'Settings'} Settings
                        </h2>
                        <p className="text-xs text-nilin-warmGray font-sans">
                          Configure {Section?.label?.toLowerCase() || ''} options for your platform
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Section Content */}
            <div className="p-6">
              {renderSectionContent()}
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
};

export default AdminSettings;
