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
} from 'lucide-react';
import PageLayout from '../layout/PageLayout';
import authService from '../../services/AuthService';
import { useToastActions } from '../common/Toast';

// Types
interface PlatformSettings {
  platformName: string;
  platformLogo: string;
  supportEmail: string;
  supportPhone: string;
  maintenanceMode: boolean;
  commissionRate: number;
  paymentProcessingFee: number;
  minimumWithdrawalAmount: number;
  defaultBookingBufferMinutes: number;
  cancellationWindowHours: number;
  autoAssignmentEnabled: boolean;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  pushNotificationsEnabled: boolean;
  require2FA: boolean;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  passwordRequireSpecialChar: boolean;
  cacheTTLSeconds: number;
  rateLimitRequestsPerMinute: number;
  apiRateLimitPerHour: number;
  // Email Config
  emailConfig: {
    provider: 'smtp' | 'ses' | 'sendgrid' | 'resend';
    smtp?: { host: string; port: number; secure: boolean; user: string; pass: string };
    fromEmail: string;
    fromName: string;
    replyToEmail: string;
  };
  // SMS Config
  smsConfig: {
    provider: 'twilio' | 'vonage' | 'nexmo' | 'msg91';
    twilio?: { accountSid: string; authToken: string; fromNumber: string };
    vonage?: { apiKey: string; apiSecret: string; fromNumber: string };
    nexmo?: { apiKey: string; apiSecret: string; fromNumber: string };
    msg91?: { authKey: string; templateId: string; senderId: string };
    enabled: boolean;
  };
  // Templates
  emailTemplates: {
    [key: string]: { subject: string; body: string; enabled: boolean; hoursBefore?: number };
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

// Email Templates Configuration
const EMAIL_TEMPLATES_CONFIG: Template[] = [
  {
    id: 'booking_confirmation',
    name: 'Booking Confirmation',
    description: 'Sent when a booking is confirmed',
    variables: ['{{userName}}', '{{bookingId}}', '{{bookingDate}}', '{{bookingTime}}', '{{providerName}}', '{{serviceName}}', '{{totalAmount}}'],
  },
  {
    id: 'booking_reminder',
    name: 'Booking Reminder',
    description: 'Sent before a booking appointment',
    variables: ['{{userName}}', '{{bookingId}}', '{{bookingDate}}', '{{bookingTime}}', '{{providerName}}', '{{serviceName}}', '{{address}}'],
  },
  {
    id: 'booking_cancelled',
    name: 'Booking Cancelled',
    description: 'Sent when a booking is cancelled',
    variables: ['{{userName}}', '{{bookingId}}', '{{bookingDate}}', '{{bookingTime}}', '{{providerName}}', '{{reason}}', '{{refundAmount}}'],
  },
  {
    id: 'booking_completed',
    name: 'Booking Completed',
    description: 'Sent when a booking is completed',
    variables: ['{{userName}}', '{{bookingId}}', '{{bookingDate}}', '{{providerName}}', '{{serviceName}}', '{{totalAmount}}', '{{reviewLink}}'],
  },
  {
    id: 'password_reset',
    name: 'Password Reset',
    description: 'Sent when user requests password reset',
    variables: ['{{userName}}', '{{resetLink}}', '{{expiryTime}}'],
  },
  {
    id: 'welcome_email',
    name: 'Welcome Email',
    description: 'Sent when a new user registers',
    variables: ['{{userName}}', '{{email}}', '{{verificationLink}}', '{{platformName}}'],
  },
  {
    id: 'payment_receipt',
    name: 'Payment Receipt',
    description: 'Sent after successful payment',
    variables: ['{{userName}}', '{{transactionId}}', '{{amount}}', '{{paymentMethod}}', '{{bookingId}}', '{{date}}'],
  },
  {
    id: 'provider_application',
    name: 'Provider Application Status',
    description: 'Sent when provider application is reviewed',
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
  commissionRate: 10,
  paymentProcessingFee: 2.9,
  minimumWithdrawalAmount: 100,
  defaultBookingBufferMinutes: 30,
  cancellationWindowHours: 24,
  autoAssignmentEnabled: true,
  emailNotificationsEnabled: true,
  smsNotificationsEnabled: true,
  pushNotificationsEnabled: true,
  require2FA: false,
  sessionTimeoutMinutes: 60,
  passwordMinLength: 8,
  passwordRequireSpecialChar: true,
  cacheTTLSeconds: 300,
  rateLimitRequestsPerMinute: 100,
  apiRateLimitPerHour: 1000,
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
    booking_confirmation: { subject: 'Booking Confirmed - {{bookingId}}', body: '', enabled: true },
    booking_reminder: { subject: 'Reminder: Your appointment on {{bookingDate}}', body: '', enabled: true, hoursBefore: 24 },
    booking_cancelled: { subject: 'Booking Cancelled - {{bookingId}}', body: '', enabled: true },
    booking_completed: { subject: 'Service Completed - {{bookingId}}', body: '', enabled: true },
    password_reset: { subject: 'Reset Your Password', body: '', enabled: true },
    welcome_email: { subject: 'Welcome to {{platformName}}!', body: '', enabled: true },
    payment_receipt: { subject: 'Payment Receipt - {{transactionId}}', body: '', enabled: true },
    provider_application: { subject: 'Provider Application Update', body: '', enabled: true },
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
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';

  return (
    <div className="relative">
      <input
        type={isPassword && showPassword ? 'text' : type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full px-3 py-2 pr-10 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal disabled:bg-nilin-muted disabled:cursor-not-allowed font-sans ${className}`}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
        >
          {showPassword ? <Eye className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
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
          emailConfig: { ...DEFAULT_SETTINGS.emailConfig, ...response.data.settings.emailConfig },
          smsConfig: { ...DEFAULT_SETTINGS.smsConfig, ...response.data.settings.smsConfig },
          emailTemplates: { ...DEFAULT_SETTINGS.emailTemplates, ...response.data.settings.emailTemplates },
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

  const handleNexmoConfigChange = useCallback((field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      smsConfig: {
        ...prev.smsConfig,
        nexmo: { ...(prev.smsConfig.nexmo || { apiKey: '', apiSecret: '', fromNumber: '' }), [field]: value },
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

      <SectionDivider label="Platform Status" />
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
        <SettingRow
          label="Auto-Assignment"
          description="Automatically assign providers to bookings"
        >
          <ToggleSwitch
            enabled={settings.autoAssignmentEnabled}
            onChange={(value) => handleSettingChange('autoAssignmentEnabled', value)}
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
                { value: 'nexmo', label: 'Nexmo' },
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

      {settings.smsConfig.provider === 'nexmo' && (
        <>
          <SectionDivider label="Nexmo Credentials" />
          <div className="glass rounded-2xl border border-nilin-border/50 inner-glow overflow-hidden">
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  API Key
                </label>
                <TextInput
                  value={settings.smsConfig.nexmo?.apiKey || ''}
                  onChange={(value) => handleNexmoConfigChange('apiKey', value)}
                  placeholder="Enter API key"
                  disabled={!settings.smsConfig.enabled}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-nilin-charcoal font-sans mb-1.5">
                  API Secret
                </label>
                <TextInput
                  value={settings.smsConfig.nexmo?.apiSecret || ''}
                  onChange={(value) => handleNexmoConfigChange('apiSecret', value)}
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
                  value={settings.smsConfig.nexmo?.fromNumber || ''}
                  onChange={(value) => handleNexmoConfigChange('fromNumber', value)}
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
    </div>
  );

  // Render Backup Settings
  const renderBackupSettings = () => (
    <div className="space-y-1">
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
  const renderSecuritySettings = () => (
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
      </div>
    </div>
  );

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
