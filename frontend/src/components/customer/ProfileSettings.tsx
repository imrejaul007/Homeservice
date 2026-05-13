import React, { useState } from 'react';
import { Globe, Bell, Shield, Palette, Check, AlertCircle, Save } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'العربية (Arabic)' },
  { code: 'fr', name: 'Français (French)' },
];

const TIMEZONES = [
  { value: 'Asia/Dubai', label: 'Dubai (GMT+4)' },
  { value: 'Asia/Riyadh', label: 'Riyadh (GMT+3)' },
  { value: 'Europe/London', label: 'London (GMT+0)' },
  { value: 'America/New_York', label: 'New York (GMT-5)' },
];

const ProfileSettings: React.FC = () => {
  const { user, customerProfile } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [settings, setSettings] = useState({
    language: user?.language || 'en',
    timezone: 'Asia/Dubai',
    currency: 'AED',
    marketingEmails: (customerProfile as any)?.communicationPreferences?.email?.marketing || false,
    bookingUpdates: (customerProfile as any)?.communicationPreferences?.email?.bookingUpdates ?? true,
    reminders: (customerProfile as any)?.communicationPreferences?.email?.reminders ?? true,
    smsUpdates: (customerProfile as any)?.communicationPreferences?.sms?.bookingUpdates ?? true,
    pushNotifications: (customerProfile as any)?.communicationPreferences?.push?.bookingUpdates ?? true,
  });

  const handleToggle = (key: keyof typeof settings) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      await api.patch('/notifications/preferences', {
        email: {
          marketing: settings.marketingEmails,
          bookingUpdates: settings.bookingUpdates,
          reminders: settings.reminders,
          newsletters: false,
          promotions: settings.marketingEmails,
        },
        sms: {
          bookingUpdates: settings.smsUpdates,
          reminders: settings.smsUpdates,
          promotions: false,
        },
        push: {
          bookingUpdates: settings.pushNotifications,
          reminders: settings.pushNotifications,
          newMessages: settings.pushNotifications,
          promotions: false,
        },
        language: settings.language,
        timezone: settings.timezone,
        currency: settings.currency,
      });

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to save settings'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Language & Region */}
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
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">Language</label>
            <select
              value={settings.language}
              onChange={(e) => setSettings(prev => ({ ...prev, language: e.target.value }))}
              className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal"
            >
              {LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">Timezone</label>
            <select
              value={settings.timezone}
              onChange={(e) => setSettings(prev => ({ ...prev, timezone: e.target.value }))}
              className="w-full px-4 py-3 rounded-nilin bg-white border border-nilin-border focus:border-nilin-coral focus:ring-2 focus:ring-nilin-coral/20 outline-none text-nilin-charcoal"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">Currency</label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings(prev => ({ ...prev, currency: e.target.value }))}
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

      {/* Email Notifications */}
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
          <ToggleRow
            label="Booking Updates"
            description="Receive updates about your bookings"
            checked={settings.bookingUpdates}
            onChange={() => handleToggle('bookingUpdates')}
          />
          <ToggleRow
            label="Reminders"
            description="Get reminded about upcoming appointments"
            checked={settings.reminders}
            onChange={() => handleToggle('reminders')}
          />
          <ToggleRow
            label="Marketing & Promotions"
            description="Receive special offers and promotions"
            checked={settings.marketingEmails}
            onChange={() => handleToggle('marketingEmails')}
          />
        </div>
      </div>

      {/* SMS & Push */}
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
          <ToggleRow
            label="SMS Updates"
            description="Receive booking updates via text message"
            checked={settings.smsUpdates}
            onChange={() => handleToggle('smsUpdates')}
          />
          <ToggleRow
            label="Push Notifications"
            description="Get instant alerts on your device"
            checked={settings.pushNotifications}
            onChange={() => handleToggle('pushNotifications')}
          />
        </div>
      </div>

      {/* Message */}
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

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isLoading}
        className="btn-nilin w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            Save Settings
          </>
        )}
      </button>
    </div>
  );
};

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between py-3 border-b border-nilin-border last:border-0">
    <div>
      <p className="font-medium text-nilin-charcoal">{label}</p>
      <p className="text-sm text-nilin-warmGray">{description}</p>
    </div>
    <button
      onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        checked ? 'bg-nilin-coral' : 'bg-gray-300'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'left-7' : 'left-1'
        }`}
      />
    </button>
  </div>
);

export default ProfileSettings;
