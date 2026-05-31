/**
 * Notification Settings Page
 * Full notification preferences page with channel toggles and quiet hours
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { QuietHours } from '../../components/notifications/QuietHours';
import { ChannelPreferences } from '../../components/notifications/ChannelPreferences';
import { notificationApi, type NotificationPreferencesResponse, type QuietHours as QuietHoursType } from '../../services/notificationApi';
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

  // Fetch current settings
  const fetchSettings = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await notificationApi.getPreferences();

      const prefs = response.data;

      setSettings({
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
        quietHours: prefs.quietHours || defaultSettings.quietHours,
        language: defaultSettings.language,
        timezone: defaultSettings.timezone,
      });

      setOriginalSettings({
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
        quietHours: prefs.quietHours || defaultSettings.quietHours,
        language: defaultSettings.language,
        timezone: defaultSettings.timezone,
      });
    } catch (err: any) {
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
      });

      setOriginalSettings(settings);
      setHasChanges(false);
      setSuccess(true);

      // Auto-hide success message
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
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

          {/* Error/Success Messages */}
          {error && (
            <div className="mb-6 p-4 rounded-nilin bg-red-50 border border-red-200 flex items-center gap-3">
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
                <ToggleRow
                  label="Booking Updates"
                  description="Get notified about booking confirmations, cancellations, and updates"
                  checked={settings.email.bookingUpdates}
                  onChange={(v) => updateEmail('bookingUpdates', v)}
                />
                <ToggleRow
                  label="Reminders"
                  description="Receive reminders about upcoming appointments"
                  checked={settings.email.reminders}
                  onChange={(v) => updateEmail('reminders', v)}
                />
                <ToggleRow
                  label="Loyalty Updates"
                  description="Updates about points, tier changes, and rewards"
                  checked={settings.email.loyaltyUpdates}
                  onChange={(v) => updateEmail('loyaltyUpdates', v)}
                />
                <ToggleRow
                  label="Promotions"
                  description="Special offers, discounts, and promotional content"
                  checked={settings.email.promotions}
                  onChange={(v) => updateEmail('promotions', v)}
                />
                <ToggleRow
                  label="Marketing"
                  description="Marketing communications and newsletters"
                  checked={settings.email.marketing}
                  onChange={(v) => updateEmail('marketing', v)}
                />
                <ToggleRow
                  label="Newsletters"
                  description="Weekly or monthly newsletter updates"
                  checked={settings.email.newsletters}
                  onChange={(v) => updateEmail('newsletters', v)}
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
                <ToggleRow
                  label="Booking Updates"
                  description="SMS for booking confirmations and changes"
                  checked={settings.sms.bookingUpdates}
                  onChange={(v) => updateSms('bookingUpdates', v)}
                />
                <ToggleRow
                  label="Reminders"
                  description="SMS reminders before your appointments"
                  checked={settings.sms.reminders}
                  onChange={(v) => updateSms('reminders', v)}
                />
                <ToggleRow
                  label="New Messages"
                  description="Get notified when you receive new messages"
                  checked={settings.sms.newMessages}
                  onChange={(v) => updateSms('newMessages', v)}
                />
                <ToggleRow
                  label="Promotions"
                  description="Special offers via SMS"
                  checked={settings.sms.promotions}
                  onChange={(v) => updateSms('promotions', v)}
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
                <ToggleRow
                  label="Booking Updates"
                  description="Instant notifications for booking changes"
                  checked={settings.push.bookingUpdates}
                  onChange={(v) => updatePush('bookingUpdates', v)}
                />
                <ToggleRow
                  label="Reminders"
                  description="Timely reminders before appointments"
                  checked={settings.push.reminders}
                  onChange={(v) => updatePush('reminders', v)}
                />
                <ToggleRow
                  label="New Messages"
                  description="Get notified about new messages"
                  checked={settings.push.newMessages}
                  onChange={(v) => updatePush('newMessages', v)}
                />
                <ToggleRow
                  label="Promotions"
                  description="Push notifications for deals and offers"
                  checked={settings.push.promotions}
                  onChange={(v) => updatePush('promotions', v)}
                />
                <ToggleRow
                  label="Marketing"
                  description="Marketing push notifications"
                  checked={settings.push.marketing}
                  onChange={(v) => updatePush('marketing', v)}
                />
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

// Toggle Row Component
interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onChange }) => (
  <div className="flex items-start justify-between py-2">
    <div className="flex-1">
      <h4 className="font-medium text-nilin-charcoal">{label}</h4>
      <p className="text-sm text-nilin-warmGray">{description}</p>
    </div>
    <label className="relative inline-flex items-center cursor-pointer ml-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#E8B4A8]/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E8B4A8]"></div>
    </label>
  </div>
);

export default NotificationSettingsPage;
