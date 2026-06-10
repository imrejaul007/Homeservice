import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Calendar,
  CreditCard,
  Star,
  Users,
  Check,
  AlertCircle,
  Save,
  RefreshCw,
} from 'lucide-react';
import { useNotificationPreferences } from '../../hooks/useNotificationPreferences';
import PreferencesLoadError from '../common/PreferencesLoadError';
import type { NotificationPreferencesData } from '../../stores/notificationPreferencesStore';

type ChannelPrefs = Pick<NotificationPreferencesData, 'email' | 'sms' | 'push'>;

const ProfileNotifications: React.FC = () => {
  const { preferences, isLoading, isSaving, error, updatePreferences, refresh } = useNotificationPreferences();
  const [draft, setDraft] = useState<ChannelPrefs | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<ChannelPrefs | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const lastSyncedPrefs = useRef('');

  const isDirty = useMemo(() => {
    if (!draft || !savedSnapshot) return false;
    return JSON.stringify(draft) !== JSON.stringify(savedSnapshot);
  }, [draft, savedSnapshot]);

  useEffect(() => {
    if (!preferences) return;
    const channelPrefs: ChannelPrefs = {
      email: preferences.email,
      sms: preferences.sms,
      push: preferences.push,
    };
    const serialized = JSON.stringify(channelPrefs);
    if (serialized === lastSyncedPrefs.current) return;
    lastSyncedPrefs.current = serialized;
    setDraft(channelPrefs);
    setSavedSnapshot(channelPrefs);
  }, [preferences]);

  const handleManualRetry = useCallback(() => {
    setMessage(null);
    refresh().catch(() => {
      setMessage({ type: 'error', text: 'Failed to load notification preferences. Please try again.' });
    });
  }, [refresh]);

  const handleSave = async () => {
    if (!draft) return;
    setMessage(null);
    try {
      await updatePreferences({
        email: draft.email,
        sms: draft.sms,
        push: draft.push,
      });
      setSavedSnapshot(draft);
      lastSyncedPrefs.current = JSON.stringify(draft);
      setMessage({ type: 'success', text: 'Notification preferences saved!' });
    } catch {
      setMessage({
        type: 'error',
        text: error || 'Failed to save preferences',
      });
    }
  };

  const togglePreference = <T extends 'email' | 'sms' | 'push'>(
    channel: T,
    key: keyof ChannelPrefs[T]
  ) => {
    setDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [channel]: {
          ...prev[channel],
          [key]: !prev[channel][key],
        },
      };
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3" aria-busy="true">
        <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-nilin-warmGray">Loading notification preferences...</p>
      </div>
    );
  }

  if (!draft) {
    return (
      <PreferencesLoadError
        message={error || 'Unable to load notification preferences.'}
        onRetry={handleManualRetry}
        label="Failed to load notification preferences"
      />
    );
  }

  return (
    <div className="space-y-6">
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
            checked={draft.email.bookingUpdates}
            onChange={() => togglePreference('email', 'bookingUpdates')}
          />
          <NotificationToggle
            icon={<Bell className="w-4 h-4" />}
            label="Reminders"
            description="Upcoming appointment reminders"
            checked={draft.email.reminders}
            onChange={() => togglePreference('email', 'reminders')}
          />
          <NotificationToggle
            icon={<Star className="w-4 h-4" />}
            label="Reviews & Ratings"
            description="Feedback requests and responses"
            checked={draft.email.reviews ?? true}
            onChange={() => togglePreference('email', 'reviews')}
          />
          <NotificationToggle
            icon={<CreditCard className="w-4 h-4" />}
            label="Payment Updates"
            description="Receipts and payment confirmations"
            checked={draft.email.paymentUpdates ?? true}
            onChange={() => togglePreference('email', 'paymentUpdates')}
          />
          <NotificationToggle
            icon={<Users className="w-4 h-4" />}
            label="Marketing & Promotions"
            description="Special offers and exclusive deals"
            checked={draft.email.marketing}
            onChange={() => togglePreference('email', 'marketing')}
          />
        </div>
      </div>

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
            checked={draft.sms.bookingUpdates}
            onChange={() => togglePreference('sms', 'bookingUpdates')}
          />
          <NotificationToggle
            icon={<Bell className="w-4 h-4" />}
            label="Reminders"
            description="Appointment reminders via SMS"
            checked={draft.sms.reminders}
            onChange={() => togglePreference('sms', 'reminders')}
          />
          <NotificationToggle
            icon={<Star className="w-4 h-4" />}
            label="Promotions"
            description="Special offers via text"
            checked={draft.sms.promotions}
            onChange={() => togglePreference('sms', 'promotions')}
          />
        </div>
      </div>

      <div className="glass-nilin rounded-nilin p-6 hover-lift">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="font-serif text-lg text-nilin-charcoal">Push Notifications</h3>
            <p className="text-sm text-nilin-warmGray">Instant alerts on your device</p>
          </div>
        </div>

        <div className="space-y-4">
          <NotificationToggle
            icon={<Calendar className="w-4 h-4" />}
            label="Booking Updates"
            description="Real-time booking status"
            checked={draft.push.bookingUpdates}
            onChange={() => togglePreference('push', 'bookingUpdates')}
          />
          <NotificationToggle
            icon={<Bell className="w-4 h-4" />}
            label="Reminders"
            description="Appointment reminders"
            checked={draft.push.reminders}
            onChange={() => togglePreference('push', 'reminders')}
          />
          <NotificationToggle
            icon={<MessageSquare className="w-4 h-4" />}
            label="New Messages"
            description="Chat messages from providers"
            checked={draft.push.newMessages}
            onChange={() => togglePreference('push', 'newMessages')}
          />
          <NotificationToggle
            icon={<Star className="w-4 h-4" />}
            label="Promotions"
            description="Exclusive deals and offers"
            checked={draft.push.promotions}
            onChange={() => togglePreference('push', 'promotions')}
          />
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true">
        {message && (
          <div className={`p-4 rounded-nilin flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <div className="flex-1">
              <span className={message.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                {message.text}
              </span>
              {message.type === 'error' && (
                <button
                  onClick={handleManualRetry}
                  className="ml-2 text-sm underline hover:no-underline"
                >
                  Try again
                </button>
              )}
            </div>
            {message.type === 'error' && (
              <button
                onClick={handleManualRetry}
                className="p-1 hover:bg-red-100 rounded transition-colors"
                title="Retry"
                aria-label="Retry loading preferences"
              >
                <RefreshCw className="w-4 h-4 text-red-600" />
              </button>
            )}
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving || !isDirty}
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
            {isDirty ? 'Save Preferences' : 'No Changes'}
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
}) => {
  const toggleId = `notif-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex items-center justify-between py-3 border-b border-nilin-border last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-nilin-muted flex items-center justify-center text-nilin-warmGray" aria-hidden="true">
          {icon}
        </div>
        <div>
          <p className="font-medium text-nilin-charcoal" id={`${toggleId}-label`}>{label}</p>
          <p className="text-sm text-nilin-warmGray" id={`${toggleId}-desc`}>{description}</p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        id={toggleId}
        aria-checked={checked}
        aria-labelledby={`${toggleId}-label`}
        aria-describedby={`${toggleId}-desc`}
        onClick={onChange}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange();
          }
        }}
        className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-nilin-coral/40 focus:ring-offset-2 ${
          checked ? 'bg-nilin-coral' : 'bg-gray-300'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'left-7' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
};

export default ProfileNotifications;
