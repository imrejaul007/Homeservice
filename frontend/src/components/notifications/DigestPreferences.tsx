/**
 * Digest Preferences Component
 * Configure notification digest settings (daily/weekly summary)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  Mail,
  MessageSquare,
  Smartphone,
  Bell,
  Calendar,
  ChevronDown,
  Save,
  RotateCcw,
  Loader2,
  Check,
  AlertCircle,
  ExternalLink,
  Phone,
} from 'lucide-react';
import {
  notificationApi,
  DigestPreferences as DigestPreferencesType,
  DigestContactInfo,
  DigestScheduleInfo,
  PushSubscriptionJSON,
} from '../../services/notificationApi';
import { useAuthStore } from '../../stores/authStore';
import { BrowserPushPermission } from './BrowserPushPermission';
import { cn } from '../../lib/utils';

interface DigestPreferencesProps {
  className?: string;
  compact?: boolean;
}

const defaultPreferences: DigestPreferencesType = {
  enabled: true,
  frequency: 'daily',
  channels: {
    email: true,
    sms: false,
    push: true,
    whatsapp: false,
    telegram: false,
  },
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  types: {
    bookingUpdates: true,
    reminders: true,
    promotions: false,
    messages: true,
    system: true,
  },
};

const maskPhone = (phone?: string) => {
  if (!phone) return '';
  if (phone.length <= 4) return phone;
  return `${phone.slice(0, 3)}***${phone.slice(-2)}`;
};

const formatScheduleDate = (iso?: string) => {
  if (!iso) return 'Not scheduled';
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const DigestPreferences: React.FC<DigestPreferencesProps> = ({
  className,
  compact = false,
}) => {
  const { user } = useAuthStore();
  const [preferences, setPreferences] = useState<DigestPreferencesType>(defaultPreferences);
  const [originalPreferences, setOriginalPreferences] = useState<DigestPreferencesType>(defaultPreferences);
  const [contactInfo, setContactInfo] = useState<DigestContactInfo>({
    whatsappOptedIn: false,
    pushSubscribed: false,
  });
  const [schedule, setSchedule] = useState<DigestScheduleInfo>({ frequency: 'daily' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [pushPublicKey, setPushPublicKey] = useState('');
  const [showPushSetup, setShowPushSetup] = useState(false);

  const userEmail = contactInfo.email || user?.email;
  const userPhone = contactInfo.phone || user?.phone;
  const hasPhone = Boolean(userPhone?.trim());

  const applyPreferences = useCallback((prefs: DigestPreferencesType) => {
    const normalized = {
      enabled: prefs.enabled ?? true,
      frequency: prefs.frequency ?? 'daily',
      channels: {
        email: prefs.channels?.email ?? true,
        sms: prefs.channels?.sms ?? false,
        push: prefs.channels?.push ?? true,
        whatsapp: prefs.channels?.whatsapp ?? false,
        telegram: prefs.channels?.telegram ?? false,
      },
      quietHours: prefs.quietHours || defaultPreferences.quietHours,
      types: {
        bookingUpdates: prefs.types?.bookingUpdates ?? true,
        reminders: prefs.types?.reminders ?? true,
        promotions: prefs.types?.promotions ?? false,
        messages: prefs.types?.messages ?? true,
        system: prefs.types?.system ?? true,
      },
      scheduledTime: prefs.scheduledTime,
      scheduledDays: prefs.scheduledDays,
      contactInfo: prefs.contactInfo,
      schedule: prefs.schedule,
    };
    setPreferences(normalized);
    setOriginalPreferences(normalized);
    if (prefs.contactInfo) setContactInfo(prefs.contactInfo);
    if (prefs.schedule) setSchedule(prefs.schedule);
  }, []);

  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setIsLoading(true);
        const response = await notificationApi.getDigestPreferences();
        applyPreferences(response.data);
      } catch (err: unknown) {
        console.error('Failed to fetch digest preferences:', err);
        setError('Failed to load digest preferences');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [applyPreferences]);

  useEffect(() => {
    const fetchPushKey = async () => {
      try {
        const response = await notificationApi.getWebPushPublicKey();
        setPushPublicKey(response.data.publicKey);
      } catch {
        // Push may not be configured server-side
      }
    };
    fetchPushKey();
  }, []);

  useEffect(() => {
    const hasChanged = JSON.stringify(preferences) !== JSON.stringify(originalPreferences);
    setHasChanges(hasChanged);
  }, [preferences, originalPreferences]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const updateEnabled = (enabled: boolean) => {
    setPreferences(prev => ({ ...prev, enabled }));
    setSuccess(false);
  };

  const updateFrequency = (frequency: 'realtime' | 'hourly' | 'daily' | 'weekly') => {
    setPreferences(prev => ({ ...prev, frequency }));
    setSuccess(false);
  };

  const updateChannel = (channel: keyof typeof preferences.channels, value: boolean) => {
    if (value && (channel === 'sms' || channel === 'whatsapp') && !hasPhone) {
      setError('Add a phone number in your Profile before enabling SMS or WhatsApp.');
      return;
    }

    if (value && channel === 'push' && !contactInfo.pushSubscribed) {
      setShowPushSetup(true);
    }

    setPreferences(prev => ({
      ...prev,
      channels: { ...prev.channels, [channel]: value },
    }));
    setError(null);
    setSuccess(false);
  };

  const updateType = (type: keyof typeof preferences.types, value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      types: { ...prev.types, [type]: value },
    }));
    setSuccess(false);
  };

  const updateScheduledTime = (time: string) => {
    setPreferences(prev => ({ ...prev, scheduledTime: time }));
    setSuccess(false);
  };

  const updateScheduledDays = (days: number[]) => {
    setPreferences(prev => ({ ...prev, scheduledDays: days }));
    setSuccess(false);
  };

  const handlePushSubscribe = async (subscription: PushSubscriptionJSON) => {
    await notificationApi.subscribeWebPush(subscription);
    setContactInfo(prev => ({ ...prev, pushSubscribed: true }));
    setShowPushSetup(false);
    setPreferences(prev => ({
      ...prev,
      channels: { ...prev.channels, push: true },
    }));
  };

  const handlePushUnsubscribe = async () => {
    const registration = await navigator.serviceWorker?.ready;
    const subscription = await registration?.pushManager?.getSubscription();
    if (subscription?.endpoint) {
      await notificationApi.unsubscribeWebPush(subscription.endpoint);
    }
    setContactInfo(prev => ({ ...prev, pushSubscribed: false }));
    setPreferences(prev => ({
      ...prev,
      channels: { ...prev.channels, push: false },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const enablingWhatsApp =
        preferences.channels.whatsapp && !originalPreferences.channels.whatsapp;
      const disablingWhatsApp =
        !preferences.channels.whatsapp && originalPreferences.channels.whatsapp;

      if (enablingWhatsApp) {
        if (!hasPhone) {
          throw new Error('Add a phone number in your Profile before enabling WhatsApp.');
        }
        await notificationApi.enableWhatsApp();
        setContactInfo(prev => ({ ...prev, whatsappOptedIn: true }));
      } else if (disablingWhatsApp) {
        await notificationApi.disableWhatsApp();
        setContactInfo(prev => ({ ...prev, whatsappOptedIn: false }));
      }

      if (preferences.channels.push && !contactInfo.pushSubscribed) {
        throw new Error('Enable browser push notifications before saving the push channel.');
      }

      const response = await notificationApi.updateDigestPreferences(preferences);
      if (response.data) {
        applyPreferences(response.data);
      } else {
        setOriginalPreferences(preferences);
      }
      setHasChanges(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(axiosErr.response?.data?.message || axiosErr.message || 'Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPreferences(originalPreferences);
    setHasChanges(false);
    setSuccess(false);
    setError(null);
  };

  const timeOptions = [
    '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
    '20:00', '21:00', '22:00',
  ];

  const dayOptions = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
  ];

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-gray-50 border border-gray-100">
        <p className="text-sm text-nilin-warmGray">
          Digest bundles notifications and sends them on your schedule. For per-channel realtime controls, visit notification settings.
        </p>
        <Link
          to="/customer/notification-settings"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 hover:text-purple-700 whitespace-nowrap"
        >
          Realtime channel preferences
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-800 text-sm">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
          <span className="text-green-800 text-sm">Preferences saved successfully!</span>
        </div>
      )}

      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Bell className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-medium text-nilin-charcoal">Notification Digest</h3>
            <p className="text-sm text-nilin-warmGray">
              Receive a summary of notifications instead of individual alerts
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.enabled}
            onChange={(e) => updateEnabled(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
        </label>
      </div>

      {preferences.enabled && (
        <>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-nilin-charcoal flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Digest Frequency
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { value: 'realtime', label: 'Realtime', desc: 'As it happens' },
                { value: 'hourly', label: 'Hourly', desc: 'Every hour' },
                { value: 'daily', label: 'Daily', desc: 'Once a day' },
                { value: 'weekly', label: 'Weekly', desc: 'Once a week' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => updateFrequency(option.value as DigestPreferencesType['frequency'])}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    preferences.frequency === option.value
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-purple-200'
                  )}
                >
                  <div className="font-medium text-sm text-nilin-charcoal">{option.label}</div>
                  <div className="text-xs text-nilin-warmGray">{option.desc}</div>
                </button>
              ))}
            </div>
            {preferences.frequency !== 'realtime' && (
              <div className="text-xs text-nilin-warmGray flex flex-wrap gap-x-4 gap-y-1 pt-1">
                <span>Next digest: {formatScheduleDate(schedule.nextRun)}</span>
                {schedule.lastRun && <span>Last sent: {formatScheduleDate(schedule.lastRun)}</span>}
              </div>
            )}
          </div>

          {(preferences.frequency === 'daily' || preferences.frequency === 'weekly') && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-nilin-charcoal flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Scheduled Time
              </h4>
              <div className="relative">
                <select
                  value={preferences.scheduledTime || '09:00'}
                  onChange={(e) => updateScheduledTime(e.target.value)}
                  className={cn(
                    'w-full md:w-48 px-4 py-2.5 border border-gray-200 rounded-lg appearance-none',
                    'focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400',
                    'bg-white cursor-pointer'
                  )}
                >
                  {timeOptions.map((time) => (
                    <option key={time} value={time}>
                      {time === '09:00' ? '9:00 AM' :
                       time === '12:00' ? '12:00 PM' :
                       time < '12:00' ? `${parseInt(time)}:00 AM` :
                       `${parseInt(time) - 12}:00 PM`}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {preferences.frequency === 'weekly' && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {dayOptions.map((day) => (
                    <button
                      key={day.value}
                      onClick={() => {
                        const currentDays = preferences.scheduledDays || [1];
                        const newDays = currentDays.includes(day.value)
                          ? currentDays.filter(d => d !== day.value)
                          : [...currentDays, day.value].sort();
                        updateScheduledDays(newDays);
                      }}
                      className={cn(
                        'w-10 h-10 rounded-full text-sm font-medium transition-all',
                        (preferences.scheduledDays || [1]).includes(day.value)
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-purple-100'
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-4 rounded-lg border border-gray-200 bg-white space-y-2">
            <h4 className="text-sm font-medium text-nilin-charcoal">Contact details for delivery</h4>
            <div className="flex flex-col sm:flex-row sm:gap-6 text-sm">
              <div className="flex items-center gap-2 text-nilin-charcoal">
                <Mail className="w-4 h-4 text-blue-500" />
                <span>{userEmail || 'No email on file'}</span>
              </div>
              <div className="flex items-center gap-2 text-nilin-charcoal">
                <Phone className="w-4 h-4 text-green-500" />
                <span>{hasPhone ? maskPhone(userPhone) : 'No phone on file'}</span>
                {!hasPhone && (
                  <Link to="/customer/profile" className="text-purple-600 hover:underline text-xs">
                    Add in Profile
                  </Link>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-nilin-charcoal">Delivery Channels</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ToggleRow
                icon={<Mail className="w-4 h-4" />}
                label="Email"
                description={userEmail ? `Digest sent to ${userEmail}` : 'Add email in Profile'}
                checked={preferences.channels.email}
                onChange={(v) => updateChannel('email', v)}
                color="bg-blue-100 text-blue-600"
                disabled={!userEmail}
              />
              <ToggleRow
                icon={<Smartphone className="w-4 h-4" />}
                label="Push Notification"
                description={contactInfo.pushSubscribed ? 'Browser push enabled' : 'Requires browser permission'}
                checked={preferences.channels.push}
                onChange={(v) => updateChannel('push', v)}
                color="bg-purple-100 text-purple-600"
                badge={contactInfo.pushSubscribed ? 'Ready' : 'Setup required'}
              />
              <ToggleRow
                icon={<MessageSquare className="w-4 h-4" />}
                label="SMS"
                description={hasPhone ? `Summary sent to ${maskPhone(userPhone)}` : 'Phone required'}
                checked={preferences.channels.sms}
                onChange={(v) => updateChannel('sms', v)}
                color="bg-green-100 text-green-600"
                disabled={!hasPhone}
              />
              <ToggleRow
                icon={<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>}
                label="WhatsApp"
                description={
                  !hasPhone
                    ? 'Phone required'
                    : contactInfo.whatsappOptedIn
                      ? `Summary sent to ${maskPhone(userPhone)}`
                      : 'Opt-in required on save'
                }
                checked={preferences.channels.whatsapp}
                onChange={(v) => updateChannel('whatsapp', v)}
                color="bg-green-100 text-green-600"
                disabled={!hasPhone}
                badge={contactInfo.whatsappOptedIn ? 'Opted in' : undefined}
              />
            </div>

            {showPushSetup && pushPublicKey && (
              <BrowserPushPermission
                publicKey={pushPublicKey}
                onSubscribe={handlePushSubscribe}
                onUnsubscribe={handlePushUnsubscribe}
                className="mt-3"
              />
            )}
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium text-nilin-charcoal">Include Notifications</h4>
            <div className="space-y-2">
              <ToggleRow
                icon={<Calendar className="w-4 h-4" />}
                label="Booking Updates"
                description="Confirmations, cancellations, status changes"
                checked={preferences.types.bookingUpdates}
                onChange={(v) => updateType('bookingUpdates', v)}
                compact
              />
              <ToggleRow
                icon={<Bell className="w-4 h-4" />}
                label="Reminders"
                description="Upcoming appointment reminders"
                checked={preferences.types.reminders}
                onChange={(v) => updateType('reminders', v)}
                compact
              />
              <ToggleRow
                icon={<MessageSquare className="w-4 h-4" />}
                label="Messages"
                description="New messages from providers/customers"
                checked={preferences.types.messages}
                onChange={(v) => updateType('messages', v)}
                compact
              />
              <ToggleRow
                icon={<AlertCircle className="w-4 h-4" />}
                label="System Notifications"
                description="Account updates, security alerts, reviews, payments"
                checked={preferences.types.system}
                onChange={(v) => updateType('system', v)}
                compact
              />
            </div>
          </div>
        </>
      )}

      {!compact && (
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
          {hasChanges && (
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={cn(
              'flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-sm transition-colors',
              hasChanges
                ? 'bg-purple-500 text-white hover:bg-purple-600'
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
                Save Preferences
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  color?: string;
  compact?: boolean;
  disabled?: boolean;
  badge?: string;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  icon,
  label,
  description,
  checked,
  onChange,
  color = 'bg-gray-100 text-gray-600',
  compact = false,
  disabled = false,
  badge,
}) => (
  <div className={cn(
    'flex items-center justify-between py-2',
    !compact && 'p-3 rounded-lg bg-gray-50',
    disabled && 'opacity-60'
  )}>
    <div className="flex items-center gap-3">
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', color)}>
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h5 className={cn('font-medium text-nilin-charcoal', compact ? 'text-sm' : 'text-base')}>
            {label}
          </h5>
          {badge && (
            <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
              {badge}
            </span>
          )}
        </div>
        {description && !compact && (
          <p className="text-xs text-nilin-warmGray">{description}</p>
        )}
      </div>
    </div>
    <label className={cn('relative inline-flex items-center', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only peer"
      />
      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-200 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500 peer-disabled:opacity-50"></div>
    </label>
  </div>
);

export default DigestPreferences;
