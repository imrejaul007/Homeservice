// Shared notification preference keys — keep in sync between NotificationSettings and ProfileNotifications.
/**
 * Notification Settings Page
 * Full notification preferences page with channel toggles and quiet hours
 *
 * Shares notification preference state with ProfileSettings.tsx via
 * useNotificationPreferencesStore — invalidate/fetch on save to keep both in sync.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Clock,
  Globe,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  Loader2,
  X,
  Send,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { QuietHours } from '../../components/notifications/QuietHours';
import PreferenceToggle from '../../components/common/PreferenceToggle';
import PreferencesLoadError from '../../components/common/PreferencesLoadError';
import { notificationApi, type QuietHours as QuietHoursType } from '../../services/notificationApi';
import { useNotificationPreferencesStore } from '../../stores/notificationPreferencesStore';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../lib/utils';

interface NotificationSettingsState {
  email: {
    bookingUpdates: boolean;
    reminders: boolean;
    promotions: boolean;
    marketing: boolean;
    newsletters: boolean;
    loyaltyUpdates: boolean;
  };
  sms: {
    bookingUpdates: boolean;
    reminders: boolean;
    promotions: boolean;
    newMessages: boolean;
  };
  push: {
    bookingUpdates: boolean;
    reminders: boolean;
    promotions: boolean;
    newMessages: boolean;
    marketing: boolean;
  };
  whatsapp: {
    enabled: boolean;
    bookingUpdates: boolean;
    reminders: boolean;
    promotions: boolean;
  };
  telegram: {
    enabled: boolean;
    linked: boolean;
  };
  quietHours: QuietHoursType;
  language: string;
  timezone: string;
}

const defaultSettings: NotificationSettingsState = {
  email: {
    bookingUpdates: true,
    reminders: true,
    promotions: false,
    marketing: false,
    newsletters: false,
    loyaltyUpdates: true,
  },
  sms: {
    bookingUpdates: true,
    reminders: true,
    promotions: false,
    newMessages: true,
  },
  push: {
    bookingUpdates: true,
    reminders: true,
    promotions: false,
    newMessages: true,
    marketing: false,
  },
  whatsapp: {
    enabled: false,
    bookingUpdates: true,
    reminders: true,
    promotions: false,
  },
  telegram: {
    enabled: false,
    linked: false,
  },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

const NotificationSettingsPage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate?.();

  // State
  const [settings, setSettings] = useState<NotificationSettingsState>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<NotificationSettingsState>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Fetch current settings
  const fetchSettings = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await notificationApi.getPreferences();
      const prefs = response.data;

      // Fetch WhatsApp and Telegram status in parallel
      const [whatsappStatus, telegramStatus] = await Promise.all([
        notificationApi.getWhatsAppStatus().catch(() => ({ data: { enabled: false } })),
        notificationApi.getTelegramStatus().catch(() => ({ data: { linked: false, enabled: false } })),
      ]);

      const newSettings = {
        email: {
          bookingUpdates: prefs.email?.bookingUpdates ?? true,
          reminders: prefs.email?.reminders ?? true,
          promotions: prefs.email?.promotions ?? false,
          marketing: prefs.email?.marketing ?? false,
          newsletters: prefs.email?.newsletters ?? false,
          loyaltyUpdates: prefs.email?.loyaltyUpdates ?? true,
        },
        sms: {
          bookingUpdates: prefs.sms?.bookingUpdates ?? true,
          reminders: prefs.sms?.reminders ?? true,
          promotions: prefs.sms?.promotions ?? false,
          newMessages: prefs.sms?.newMessages ?? true,
        },
        push: {
          bookingUpdates: prefs.push?.bookingUpdates ?? true,
          reminders: prefs.push?.reminders ?? true,
          promotions: prefs.push?.promotions ?? false,
          newMessages: prefs.push?.newMessages ?? true,
          marketing: prefs.push?.marketing ?? false,
        },
        whatsapp: {
          enabled: prefs.whatsapp?.enabled ?? whatsappStatus.data?.enabled ?? false,
          bookingUpdates: prefs.whatsapp?.bookingUpdates ?? true,
          reminders: prefs.whatsapp?.reminders ?? true,
          promotions: prefs.whatsapp?.promotions ?? false,
        },
        telegram: {
          enabled: telegramStatus.data?.enabled ?? false,
          linked: telegramStatus.data?.linked ?? false,
        },
        quietHours: prefs.quietHours || defaultSettings.quietHours,
        language: prefs.language ?? defaultSettings.language,
        timezone: prefs.timezone ?? defaultSettings.timezone,
      };

      setSettings(newSettings);
      setOriginalSettings(newSettings);
      setHasLoaded(true);
    } catch (err) {
      setHasLoaded(false);
      setError(err.response?.data?.message || 'Failed to load notification settings');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate?.('/login', { state: { returnTo: '/customer/notification-settings' } });
      return;
    }
    fetchSettings();
  }, [isAuthenticated, navigate, fetchSettings]);

  // Check for changes
  useEffect(() => {
    const hasChanged = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(hasChanged);
  }, [settings, originalSettings]);

  // Update handlers
  const updateEmail = (key: keyof typeof settings.email, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      email: { ...prev.email, [key]: value },
    }));
    setSuccess(false);
  };

  const updateSms = (key: keyof typeof settings.sms, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      sms: { ...prev.sms, [key]: value },
    }));
    setSuccess(false);
  };

  const updatePush = (key: keyof typeof settings.push, value: boolean) => {
    setSettings(prev => ({
      ...prev,
      push: { ...prev.push, [key]: value },
    }));
    setSuccess(false);
  };

  const updateWhatsApp = async (key: keyof typeof settings.whatsapp, value: boolean) => {
    if (key === 'enabled') {
      // Toggle WhatsApp enabled status via API
      try {
        if (value) {
          await notificationApi.enableWhatsApp();
        } else {
          await notificationApi.disableWhatsApp();
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to update WhatsApp status');
        return;
      }
    }
    setSettings(prev => ({
      ...prev,
      whatsapp: { ...prev.whatsapp, [key]: value },
    }));
    setSuccess(false);
  };

  const handleLinkTelegram = async () => {
    try {
      const response = await notificationApi.getTelegramLink();
      window.open(response.data.link, '_blank');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to get Telegram link');
    }
  };

  const handleUnlinkTelegram = async () => {
    try {
      await notificationApi.unlinkTelegram();
      setSettings(prev => ({
        ...prev,
        telegram: { enabled: false, linked: false },
      }));
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to unlink Telegram');
    }
  };

  const updateQuietHours = (quietHours: QuietHoursType) => {
    setSettings(prev => ({
      ...prev,
      quietHours,
    }));
    setSuccess(false);
  };

  const updateLanguage = (language: string) => {
    setSettings(prev => ({ ...prev, language }));
    setSuccess(false);
  };

  const updateTimezone = (timezone: string) => {
    setSettings(prev => ({ ...prev, timezone }));
    setSuccess(false);
  };

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await notificationApi.updatePreferences({
        email: settings.email,
        sms: settings.sms,
        push: settings.push,
        quietHours: settings.quietHours,
        language: settings.language,
        timezone: settings.timezone,
      });

      useNotificationPreferencesStore.getState().invalidate();
      await useNotificationPreferencesStore.getState().fetchPreferences();

      setOriginalSettings(settings);
      setHasChanges(false);
      setSuccess(true);

      // Auto-hide success message
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to original
  const handleReset = () => {
    setSettings(originalSettings);
    setHasChanges(false);
    setSuccess(false);
  };

  // Common timezones
  const timezones = [
    { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
    { value: 'Asia/Kolkata', label: 'India (GMT+5:30)' },
    { value: 'Europe/London', label: 'London (GMT+0)' },
    { value: 'Europe/Paris', label: 'Paris (GMT+1)' },
    { value: 'America/New_York', label: 'New York (GMT-5)' },
    { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
    { value: 'Australia/Sydney', label: 'Sydney (GMT+10)' },
  ];

  // Languages
  const languages = [
    { value: 'en', label: 'English' },
    { value: 'ar', label: 'Arabic' },
    { value: 'fr', label: 'French' },
    { value: 'es', label: 'Spanish' },
    { value: 'de', label: 'German' },
    { value: 'zh', label: 'Chinese' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (!hasLoaded) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center px-4">
          <PreferencesLoadError
            message={error || 'Unable to load notification settings.'}
            onRetry={() => {
              setError(null);
              fetchSettings();
            }}
            label="Failed to load notification settings"
          />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                <Bell className="w-6 h-6 text-nilin-coral" />
              </div>
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal">Notification Settings</h1>
                <p className="text-nilin-warmGray">Manage how you receive notifications</p>
              </div>
            </div>
          </div>

          <div className="mb-6 p-4 rounded-nilin bg-white border border-nilin-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-nilin-warmGray">
              Configure digest frequency, scheduled delivery, and bundled notification summaries.
            </p>
            <Link
              to="/customer/notifications?tab=digest"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-nilin-coral hover:text-nilin-coral/80 whitespace-nowrap"
            >
              Digest settings
            </Link>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div role="alert" className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-800">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-nilin bg-green-50 border border-green-200 flex items-center gap-3">
              <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
              <span className="text-green-800">Settings saved successfully!</span>
            </div>
          )}

          <div className="space-y-6">
            {/* Email Notifications */}
            <div className="glass-nilin rounded-nilin-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-nilin-charcoal">Email Notifications</h2>
                  <p className="text-sm text-nilin-warmGray">Receive updates via email</p>
                </div>
              </div>

              <div className="space-y-4">
                <PreferenceToggle
                  label="Booking Updates"
                  description="Get notified about booking confirmations, cancellations, and updates"
                  checked={settings.email.bookingUpdates}
                  onChange={() => updateEmail('bookingUpdates', !settings.email.bookingUpdates)}
                />
                <PreferenceToggle
                  label="Reminders"
                  description="Receive reminders about upcoming appointments"
                  checked={settings.email.reminders}
                  onChange={() => updateEmail('reminders', !settings.email.reminders)}
                />
                <PreferenceToggle
                  label="Loyalty Updates"
                  description="Updates about points, tier changes, and rewards"
                  checked={settings.email.loyaltyUpdates}
                  onChange={() => updateEmail('loyaltyUpdates', !settings.email.loyaltyUpdates)}
                />
                <PreferenceToggle
                  label="Promotions"
                  description="Special offers, discounts, and promotional content"
                  checked={settings.email.promotions}
                  onChange={() => updateEmail('promotions', !settings.email.promotions)}
                />
                <PreferenceToggle
                  label="Marketing"
                  description="Marketing communications and newsletters"
                  checked={settings.email.marketing}
                  onChange={() => updateEmail('marketing', !settings.email.marketing)}
                />
                <PreferenceToggle
                  label="Newsletters"
                  description="Weekly or monthly newsletter updates"
                  checked={settings.email.newsletters}
                  onChange={() => updateEmail('newsletters', !settings.email.newsletters)}
                />
              </div>
            </div>

            {/* SMS Notifications */}
            <div className="glass-nilin rounded-nilin-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-nilin-charcoal">SMS Notifications</h2>
                  <p className="text-sm text-nilin-warmGray">Receive text messages for important updates</p>
                </div>
              </div>

              <div className="space-y-4">
                <PreferenceToggle
                  label="Booking Updates"
                  description="SMS for booking confirmations and changes"
                  checked={settings.sms.bookingUpdates}
                  onChange={() => updateSms('bookingUpdates', !settings.sms.bookingUpdates)}
                />
                <PreferenceToggle
                  label="Reminders"
                  description="SMS reminders before your appointments"
                  checked={settings.sms.reminders}
                  onChange={() => updateSms('reminders', !settings.sms.reminders)}
                />
                <PreferenceToggle
                  label="New Messages"
                  description="Get notified when you receive new messages"
                  checked={settings.sms.newMessages}
                  onChange={() => updateSms('newMessages', !settings.sms.newMessages)}
                />
                <PreferenceToggle
                  label="Promotions"
                  description="Special offers via SMS"
                  checked={settings.sms.promotions}
                  onChange={() => updateSms('promotions', !settings.sms.promotions)}
                />
              </div>
            </div>

            {/* Push Notifications */}
            <div className="glass-nilin rounded-nilin-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-nilin-charcoal">Push Notifications</h2>
                  <p className="text-sm text-nilin-warmGray">Instant notifications on your device</p>
                </div>
              </div>

              <div className="space-y-4">
                <PreferenceToggle
                  label="Booking Updates"
                  description="Instant notifications for booking changes"
                  checked={settings.push.bookingUpdates}
                  onChange={() => updatePush('bookingUpdates', !settings.push.bookingUpdates)}
                />
                <PreferenceToggle
                  label="Reminders"
                  description="Timely reminders before appointments"
                  checked={settings.push.reminders}
                  onChange={() => updatePush('reminders', !settings.push.reminders)}
                />
                <PreferenceToggle
                  label="New Messages"
                  description="Get notified about new messages"
                  checked={settings.push.newMessages}
                  onChange={() => updatePush('newMessages', !settings.push.newMessages)}
                />
                <PreferenceToggle
                  label="Promotions"
                  description="Push notifications for deals and offers"
                  checked={settings.push.promotions}
                  onChange={() => updatePush('promotions', !settings.push.promotions)}
                />
                <PreferenceToggle
                  label="Marketing"
                  description="Marketing push notifications"
                  checked={settings.push.marketing}
                  onChange={() => updatePush('marketing', !settings.push.marketing)}
                />
              </div>
            </div>

            {/* WhatsApp Notifications */}
            <div className="glass-nilin rounded-nilin-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-nilin-charcoal">WhatsApp Notifications</h2>
                  <p className="text-sm text-nilin-warmGray">Receive notifications via WhatsApp</p>
                </div>
              </div>

              <div className="space-y-4">
                <PreferenceToggle
                  label="Enable WhatsApp"
                  description="Receive booking updates and reminders via WhatsApp"
                  checked={settings.whatsapp.enabled}
                  onChange={() => updateWhatsApp('enabled', !settings.whatsapp.enabled)}
                />
                {settings.whatsapp.enabled && (
                  <>
                    <PreferenceToggle
                      label="Booking Updates"
                      description="Get booking confirmations and changes via WhatsApp"
                      checked={settings.whatsapp.bookingUpdates}
                      onChange={() => updateWhatsApp('bookingUpdates', !settings.whatsapp.bookingUpdates)}
                    />
                    <PreferenceToggle
                      label="Reminders"
                      description="Receive appointment reminders via WhatsApp"
                      checked={settings.whatsapp.reminders}
                      onChange={() => updateWhatsApp('reminders', !settings.whatsapp.reminders)}
                    />
                    <PreferenceToggle
                      label="Promotions"
                      description="Special offers and deals via WhatsApp"
                      checked={settings.whatsapp.promotions}
                      onChange={() => updateWhatsApp('promotions', !settings.whatsapp.promotions)}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Telegram Integration */}
            <div className="glass-nilin rounded-nilin-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-medium text-nilin-charcoal">Telegram Integration</h2>
                  <p className="text-sm text-nilin-warmGray">Link your Telegram account for notifications</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-3 h-3 rounded-full',
                    settings.telegram.linked ? 'bg-green-500' : 'bg-gray-400'
                  )} />
                  <div>
                    <p className="font-medium text-nilin-charcoal">
                      {settings.telegram.linked ? 'Telegram Connected' : 'Not Connected'}
                    </p>
                    <p className="text-sm text-nilin-warmGray">
                      {settings.telegram.linked
                        ? 'You will receive notifications via Telegram'
                        : 'Link your Telegram account to receive notifications'}
                    </p>
                  </div>
                </div>
                {settings.telegram.linked ? (
                  <button
                    onClick={handleUnlinkTelegram}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Unlink
                  </button>
                ) : (
                  <button
                    onClick={handleLinkTelegram}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                  >
                    <Send className="w-4 h-4" />
                    Connect
                  </button>
                )}
              </div>
            </div>

            {/* Quiet Hours */}
            <div className="glass-nilin rounded-nilin-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-nilin-charcoal">Quiet Hours</h2>
                  <p className="text-sm text-nilin-warmGray">Pause non-urgent notifications during specific hours</p>
                </div>
              </div>

              <QuietHours
                config={settings.quietHours}
                onUpdate={async (config) => updateQuietHours(config)}
              />
            </div>

            {/* Language & Timezone */}
            <div className="glass-nilin rounded-nilin-lg p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-nilin-charcoal">Language & Timezone</h2>
                  <p className="text-sm text-nilin-warmGray">Notification language and timezone settings</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Language
                  </label>
                  <select
                    value={settings.language}
                    onChange={(e) => updateLanguage(e.target.value)}
                    className={cn(
                      'w-full px-4 py-2.5 border border-gray-200 rounded-lg',
                      'focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/20 focus:border-[#E8B4A8]',
                      'bg-white'
                    )}
                  >
                    {languages.map((lang) => (
                      <option key={lang.value} value={lang.value}>
                        {lang.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                    Timezone
                  </label>
                  <select
                    value={settings.timezone}
                    onChange={(e) => updateTimezone(e.target.value)}
                    className={cn(
                      'w-full px-4 py-2.5 border border-gray-200 rounded-lg',
                      'focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/20 focus:border-[#E8B4A8]',
                      'bg-white'
                    )}
                  >
                    {timezones.map((tz) => (
                      <option key={tz.value} value={tz.value}>
                        {tz.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-4">
              {hasChanges && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                className={cn(
                  'flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors',
                  hasChanges
                    ? 'bg-nilin-coral text-white hover:bg-nilin-coral/90'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                )}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default NotificationSettingsPage;
