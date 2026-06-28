import React, { useState, useEffect, useMemo, useRef } from 'react';
// Shares notification preference state with NotificationSettings.tsx via useNotificationPreferences /
// useNotificationPreferencesStore — keep save/load paths aligned when changing either page.
import { Globe, Bell, Shield, Check, AlertCircle, Save } from 'lucide-react';
import { useNotificationPreferences } from '../../hooks/useNotificationPreferences';
import { useWebPushRegistration } from '../../hooks/useWebPushRegistration';
import PreferenceToggle from '../common/PreferenceToggle';
import PreferencesLoadError from '../common/PreferencesLoadError';
import type { NotificationPreferencesData } from '../../stores/notificationPreferencesStore';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'العربية (Arabic)' },
  { code: 'fr', name: 'Français (French)' },
  { code: 'es', name: 'Español (Spanish)' },
  { code: 'de', name: 'Deutsch (German)' },
  { code: 'zh', name: '中文 (Chinese)' },
];

const TIMEZONES = [
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
  { value: 'Asia/Riyadh', label: 'Riyadh (GMT+3)' },
  { value: 'Asia/Kolkata', label: 'India (GMT+5:30)' },
  { value: 'Europe/London', label: 'London (GMT+0)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (GMT-8)' },
  { value: 'UTC', label: 'UTC' },
];

interface SettingsForm {
  language: string;
  timezone: string;
  currency: string;
  marketingEmails: boolean;
  bookingUpdates: boolean;
  reminders: boolean;
  smsUpdates: boolean;
  pushNotifications: boolean;
}

function prefsToForm(prefs: NotificationPreferencesData): SettingsForm {
  return {
    language: prefs.language,
    timezone: prefs.timezone,
    currency: prefs.currency,
    marketingEmails: prefs.email.marketing,
    bookingUpdates: prefs.email.bookingUpdates,
    reminders: prefs.email.reminders,
    smsUpdates: prefs.sms.bookingUpdates && prefs.sms.reminders,
    pushNotifications: prefs.push.bookingUpdates && prefs.push.reminders,
  };
}

function buildMergedPatch(
  current: NotificationPreferencesData,
  settings: SettingsForm
): Partial<NotificationPreferencesData> {
  return {
    email: {
      ...current.email,
      marketing: settings.marketingEmails,
      bookingUpdates: settings.bookingUpdates,
      reminders: settings.reminders,
      promotions: settings.marketingEmails,
    },
    sms: {
      ...current.sms,
      bookingUpdates: settings.smsUpdates,
      reminders: settings.smsUpdates,
    },
    push: {
      ...current.push,
      bookingUpdates: settings.pushNotifications,
      reminders: settings.pushNotifications,
    },
    language: settings.language,
    timezone: settings.timezone,
    currency: settings.currency,
  };
}

const ProfileSettings: React.FC = () => {
  const { preferences, isLoading, isSaving, error, updatePreferences, refresh } = useNotificationPreferences();
  const { registerWebPush, unregisterWebPush, isRegistering } = useWebPushRegistration();
  const [settings, setSettings] = useState<SettingsForm | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<SettingsForm | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const lastSyncedPrefs = useRef('');

  const isDirty = useMemo(() => {
    if (!settings || !savedSnapshot) return false;
    return JSON.stringify(settings) !== JSON.stringify(savedSnapshot);
  }, [settings, savedSnapshot]);

  useEffect(() => {
    if (!preferences) return;
    const serialized = JSON.stringify(preferences);
    if (serialized === lastSyncedPrefs.current) return;
    lastSyncedPrefs.current = serialized;
    const form = prefsToForm(preferences);
    setSettings(form);
    setSavedSnapshot(form);
  }, [preferences]);

  const handleToggle = async (key: keyof SettingsForm) => {
    if (!settings) return;

    if (key === 'pushNotifications' && !settings.pushNotifications) {
      const registered = await registerWebPush();
      if (!registered) {
        setMessage({
          type: 'error',
          text: 'Browser push permission was denied or is unavailable. Enable notifications in your browser settings.',
        });
        return;
      }
    }

    setSettings(prev => (prev ? { ...prev, [key]: !prev[key] } : prev));
  };

  const handleSave = async () => {
    if (!settings || !preferences) return;
    setMessage(null);

    try {
      if (settings.pushNotifications && !savedSnapshot?.pushNotifications) {
        const registered = await registerWebPush();
        if (!registered) {
          setMessage({
            type: 'error',
            text: 'Could not enable push notifications. Check browser permissions and try again.',
          });
          return;
        }
      } else if (!settings.pushNotifications && savedSnapshot?.pushNotifications) {
        await unregisterWebPush();
      }

      await updatePreferences(buildMergedPatch(preferences, settings));

      setSavedSnapshot(settings);
      lastSyncedPrefs.current = JSON.stringify(preferences);
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      setMessage({
        type: 'error',
        text: apiError.response?.data?.message || error || 'Failed to save settings',
      });
    }
  };

  const handleRetry = () => {
    setMessage(null);
    refresh().catch(() => {
      // error stored in hook state
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading settings">
        {[1, 2, 3].map(i => (
          <div key={i} className="glass-nilin rounded-nilin p-6 animate-pulse">
            <div className="h-6 bg-nilin-border rounded w-1/3 mb-4" />
            <div className="space-y-3">
              <div className="h-10 bg-nilin-border rounded" />
              <div className="h-10 bg-nilin-border rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!settings) {
    return (
      <PreferencesLoadError
        message={error || 'Unable to load your settings.'}
        onRetry={handleRetry}
        label="Failed to load settings"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-nilin rounded-nilin p-6 hover-lift">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <Globe className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="font-serif text-lg text-nilin-charcoal">Language & Region</h3>
            <p className="text-sm text-nilin-warmGray">Set your preferred language and timezone</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="settings-language" className="block text-sm font-medium text-nilin-charcoal mb-2">
              Language
            </label>
            <select
              id="settings-language"
              value={settings.language}
              onChange={(e) => setSettings(prev => prev ? { ...prev, language: e.target.value } : prev)}
              className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="settings-timezone" className="block text-sm font-medium text-nilin-charcoal mb-2">
              Timezone
            </label>
            <select
              id="settings-timezone"
              value={settings.timezone}
              onChange={(e) => setSettings(prev => prev ? { ...prev, timezone: e.target.value } : prev)}
              className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="settings-currency" className="block text-sm font-medium text-nilin-charcoal mb-2">
              Currency
            </label>
            <select
              id="settings-currency"
              value={settings.currency}
              onChange={(e) => setSettings(prev => prev ? { ...prev, currency: e.target.value } : prev)}
              className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal"
            >
              <option value="AED">AED - UAE Dirham</option>
              <option value="USD">USD - US Dollar</option>
              <option value="EUR">EUR - Euro</option>
              <option value="GBP">GBP - British Pound</option>
            </select>
          </div>
        </div>
      </div>

      <div className="glass-nilin rounded-nilin p-6 hover-lift">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <Bell className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="font-serif text-lg text-nilin-charcoal">Email Notifications</h3>
            <p className="text-sm text-nilin-warmGray">Manage what emails you receive</p>
          </div>
        </div>

        <div className="space-y-4">
          <PreferenceToggle
            label="Booking Updates"
            description="Receive updates about your bookings"
            checked={settings.bookingUpdates}
            onChange={() => handleToggle('bookingUpdates')}
          />
          <PreferenceToggle
            label="Reminders"
            description="Get reminded about upcoming appointments"
            checked={settings.reminders}
            onChange={() => handleToggle('reminders')}
          />
          <PreferenceToggle
            label="Marketing & Promotions"
            description="Receive special offers and promotions"
            checked={settings.marketingEmails}
            onChange={() => handleToggle('marketingEmails')}
          />
        </div>
      </div>

      <div className="glass-nilin rounded-nilin p-6 hover-lift">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="font-serif text-lg text-nilin-charcoal">SMS & Push Notifications</h3>
            <p className="text-sm text-nilin-warmGray">Control your mobile notifications</p>
          </div>
        </div>

        <div className="space-y-4">
          <PreferenceToggle
            label="SMS Updates"
            description="Receive booking updates via text message"
            checked={settings.smsUpdates}
            onChange={() => handleToggle('smsUpdates')}
          />
          <PreferenceToggle
            label="Push Notifications"
            description="Get instant alerts on your device"
            checked={settings.pushNotifications}
            onChange={() => handleToggle('pushNotifications')}
            disabled={isRegistering}
          />
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {message && (
          <div className={`p-4 rounded-nilin flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
              {message.text}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving || isRegistering || !isDirty}
        className="btn-nilin w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSaving || isRegistering ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            {isDirty ? 'Save Settings' : 'No Changes'}
          </>
        )}
      </button>
    </div>
  );
};

export default ProfileSettings;
