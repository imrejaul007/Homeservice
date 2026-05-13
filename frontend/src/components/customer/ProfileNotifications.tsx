import React, { useState, useEffect } from 'react';
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Calendar,
  CreditCard,
  Star,
  Users,
  Shield,
  Check,
  AlertCircle,
  Save,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

interface NotificationPreferences {
  email: {
    bookingUpdates: boolean;
    reminders: boolean;
    promotions: boolean;
    marketing: boolean;
    newsletters: boolean;
  };
  sms: {
    bookingUpdates: boolean;
    reminders: boolean;
    promotions: boolean;
  };
  push: {
    bookingUpdates: boolean;
    reminders: boolean;
    newMessages: boolean;
    promotions: boolean;
  };
}

const ProfileNotifications: React.FC = () => {
  const { user } = useAuthStore();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: {
      bookingUpdates: true,
      reminders: true,
      promotions: false,
      marketing: false,
      newsletters: false,
    },
    sms: {
      bookingUpdates: true,
      reminders: true,
      promotions: false,
    },
    push: {
      bookingUpdates: true,
      reminders: true,
      newMessages: true,
      promotions: false,
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/notifications/preferences');
      if (response.data.data) {
        setPreferences({
          email: {
            bookingUpdates: response.data.data.email?.bookingUpdates ?? true,
            reminders: response.data.data.email?.reminders ?? true,
            promotions: response.data.data.email?.promotions ?? false,
            marketing: response.data.data.email?.marketing ?? false,
            newsletters: response.data.data.email?.newsletters ?? false,
          },
          sms: {
            bookingUpdates: response.data.data.sms?.bookingUpdates ?? true,
            reminders: response.data.data.sms?.reminders ?? true,
            promotions: response.data.data.sms?.promotions ?? false,
          },
          push: {
            bookingUpdates: response.data.data.push?.bookingUpdates ?? true,
            reminders: response.data.data.push?.reminders ?? true,
            newMessages: response.data.data.push?.newMessages ?? true,
            promotions: response.data.data.push?.promotions ?? false,
          },
        });
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);

    try {
      await api.patch('/notifications/preferences', {
        email: preferences.email,
        sms: preferences.sms,
        push: preferences.push,
      });

      setMessage({ type: 'success', text: 'Notification preferences saved!' });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to save preferences',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreference = (
    channel: 'email' | 'sms' | 'push',
    key: string
  ) => {
    setPreferences(prev => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [key]: !(prev[channel] as any)[key],
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <div className="glass-nilin rounded-nilin p-6 hover-lift">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <Mail className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="font-serif text-lg text-nilin-charcoal">Email Notifications</h3>
            <p className="text-sm text-nilin-warmGray">Manage emails you receive</p>
          </div>
        </div>

        <div className="space-y-4">
          <NotificationToggle
            icon={<Calendar className="w-4 h-4" />}
            label="Booking Updates"
            description="Confirmation, changes, and completion"
            checked={preferences.email.bookingUpdates}
            onChange={() => togglePreference('email', 'bookingUpdates')}
          />
          <NotificationToggle
            icon={<Bell className="w-4 h-4" />}
            label="Reminders"
            description="Upcoming appointment reminders"
            checked={preferences.email.reminders}
            onChange={() => togglePreference('email', 'reminders')}
          />
          <NotificationToggle
            icon={<Star className="w-4 h-4" />}
            label="Reviews & Ratings"
            description="Feedback requests and responses"
            checked={preferences.email.promotions}
            onChange={() => togglePreference('email', 'promotions')}
          />
          <NotificationToggle
            icon={<CreditCard className="w-4 h-4" />}
            label="Payment Updates"
            description="Receipts and payment confirmations"
            checked={preferences.email.newsletters}
            onChange={() => togglePreference('email', 'newsletters')}
          />
          <NotificationToggle
            icon={<Users className="w-4 h-4" />}
            label="Marketing & Promotions"
            description="Special offers and exclusive deals"
            checked={preferences.email.marketing}
            onChange={() => togglePreference('email', 'marketing')}
          />
        </div>
      </div>

      {/* SMS Notifications */}
      <div className="glass-nilin rounded-nilin p-6 hover-lift">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="font-serif text-lg text-nilin-charcoal">SMS Notifications</h3>
            <p className="text-sm text-nilin-warmGray">Text messages you receive</p>
          </div>
        </div>

        <div className="space-y-4">
          <NotificationToggle
            icon={<Calendar className="w-4 h-4" />}
            label="Booking Updates"
            description="Confirmation and status changes"
            checked={preferences.sms.bookingUpdates}
            onChange={() => togglePreference('sms', 'bookingUpdates')}
          />
          <NotificationToggle
            icon={<Bell className="w-4 h-4" />}
            label="Reminders"
            description="Appointment reminders"
            checked={preferences.sms.reminders}
            onChange={() => togglePreference('sms', 'reminders')}
          />
          <NotificationToggle
            icon={<CreditCard className="w-4 h-4" />}
            label="Promotions"
            description="Special offers via SMS"
            checked={preferences.sms.promotions}
            onChange={() => togglePreference('sms', 'promotions')}
          />
        </div>
      </div>

      {/* Push Notifications */}
      <div className="glass-nilin rounded-nilin p-6 hover-lift">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="font-serif text-lg text-nilin-charcoal">Push Notifications</h3>
            <p className="text-sm text-nilin-warmGray">Alerts on your device</p>
          </div>
        </div>

        <div className="space-y-4">
          <NotificationToggle
            icon={<Calendar className="w-4 h-4" />}
            label="Booking Updates"
            description="Instant booking notifications"
            checked={preferences.push.bookingUpdates}
            onChange={() => togglePreference('push', 'bookingUpdates')}
          />
          <NotificationToggle
            icon={<Bell className="w-4 h-4" />}
            label="Reminders"
            description="Upcoming appointment alerts"
            checked={preferences.push.reminders}
            onChange={() => togglePreference('push', 'reminders')}
          />
          <NotificationToggle
            icon={<MessageSquare className="w-4 h-4" />}
            label="New Messages"
            description="Messages from providers"
            checked={preferences.push.newMessages}
            onChange={() => togglePreference('push', 'newMessages')}
          />
          <NotificationToggle
            icon={<Star className="w-4 h-4" />}
            label="Promotions"
            description="Exclusive deals and offers"
            checked={preferences.push.promotions}
            onChange={() => togglePreference('push', 'promotions')}
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
        disabled={isSaving}
        className="btn-nilin w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isSaving ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="w-5 h-5" />
            Save Preferences
          </>
        )}
      </button>
    </div>
  );
};

interface NotificationToggleProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

const NotificationToggle: React.FC<NotificationToggleProps> = ({
  icon,
  label,
  description,
  checked,
  onChange,
}) => (
  <div className="flex items-center justify-between py-3 border-b border-nilin-border last:border-0">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-nilin-muted flex items-center justify-center text-nilin-warmGray">
        {icon}
      </div>
      <div>
        <p className="font-medium text-nilin-charcoal">{label}</p>
        <p className="text-sm text-nilin-warmGray">{description}</p>
      </div>
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

export default ProfileNotifications;
