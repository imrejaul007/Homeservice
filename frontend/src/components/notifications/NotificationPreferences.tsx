/**
 * Notification Preferences Component
 * Full notification preferences UI with channel and type settings
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Settings, Bell, Mail, MessageSquare, Smartphone, Moon, Clock, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../common/Accordion';
import { notificationApi } from '../../services/notificationApi';

interface NotificationPreferenceTypes {
  bookingUpdates: boolean;
  reminders: boolean;
  promotions: boolean;
  messages: boolean;
  system: boolean;
}

interface NotificationChannelPreferences {
  email: NotificationPreferenceTypes;
  sms: NotificationPreferenceTypes;
  push: NotificationPreferenceTypes;
  whatsapp: NotificationPreferenceTypes;
  telegram: NotificationPreferenceTypes;
}

interface QuietHoursConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
}

interface NotificationPreferencesData {
  channels: NotificationChannelPreferences;
  quietHours: QuietHoursConfig;
}

interface NotificationPreferencesProps {
  preferences?: NotificationPreferencesData;
  onUpdate?: (preferences: Partial<NotificationPreferencesData>) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({
  preferences: preferencesProp,
  onUpdate,
  isLoading: isLoadingProp = false,
  className,
}) => {
  const [localPreferences, setLocalPreferences] = useState<NotificationPreferencesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch preferences from API if not provided via props
  useEffect(() => {
    if (preferencesProp) {
      setLocalPreferences(preferencesProp);
      setIsLoading(false);
    } else {
      const fetchPreferences = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await notificationApi.getPreferences();
          if (response.success && response.data) {
            // Map API response to component format
            const apiPrefs = response.data;
            setLocalPreferences({
              channels: {
                email: {
                  bookingUpdates: apiPrefs.email?.bookingUpdates ?? true,
                  reminders: apiPrefs.email?.reminders ?? true,
                  promotions: apiPrefs.email?.promotions ?? false,
                  messages: true,
                  system: true,
                },
                sms: {
                  bookingUpdates: apiPrefs.sms?.bookingUpdates ?? true,
                  reminders: apiPrefs.sms?.reminders ?? true,
                  promotions: apiPrefs.sms?.promotions ?? false,
                  messages: true,
                  system: true,
                },
                push: {
                  bookingUpdates: apiPrefs.push?.bookingUpdates ?? true,
                  reminders: apiPrefs.push?.reminders ?? true,
                  promotions: apiPrefs.push?.promotions ?? false,
                  messages: true,
                  system: true,
                },
                whatsapp: {
                  bookingUpdates: apiPrefs.whatsapp?.bookingUpdates ?? false,
                  reminders: apiPrefs.whatsapp?.reminders ?? false,
                  promotions: apiPrefs.whatsapp?.promotions ?? false,
                  messages: false,
                  system: false,
                },
                telegram: {
                  bookingUpdates: false,
                  reminders: false,
                  promotions: false,
                  messages: false,
                  system: false,
                },
              },
              quietHours: {
                enabled: apiPrefs.quietHours?.enabled ?? false,
                startTime: apiPrefs.quietHours?.startTime ?? '22:00',
                endTime: apiPrefs.quietHours?.endTime ?? '08:00',
                timezone: apiPrefs.quietHours?.timezone ?? 'Asia/Dubai',
              },
            });
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load preferences';
          setError(errorMessage);
          console.error('Error fetching notification preferences:', err);
        } finally {
          setIsLoading(false);
        }
      };

      fetchPreferences();
    }
  }, [preferencesProp]);

  // Sync with props
  useEffect(() => {
    if (preferencesProp) {
      setLocalPreferences(preferencesProp);
    }
  }, [preferencesProp]);

  const handleChannelToggle = useCallback((
    channel: keyof NotificationChannelPreferences,
    type: keyof NotificationPreferenceTypes
  ) => {
    if (!localPreferences) return;
    setLocalPreferences(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        channels: {
          ...prev.channels,
          [channel]: {
            ...prev.channels[channel],
            [type]: !prev.channels[channel][type],
          },
        },
      };
    });
    setSaved(false);
  }, [localPreferences]);

  const handleQuietHoursToggle = useCallback(() => {
    if (!localPreferences) return;
    setLocalPreferences(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        quietHours: {
          ...prev.quietHours,
          enabled: !prev.quietHours.enabled,
        },
      };
    });
    setSaved(false);
  }, [localPreferences]);

  const handleQuietHoursTimeChange = useCallback((
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    if (!localPreferences) return;
    setLocalPreferences(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        quietHours: {
          ...prev.quietHours,
          [field]: value,
        },
      };
    });
    setSaved(false);
  }, [localPreferences]);

  const handleTimezoneChange = useCallback((value: string) => {
    if (!localPreferences) return;
    setLocalPreferences(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        quietHours: {
          ...prev.quietHours,
          timezone: value,
        },
      };
    });
    setSaved(false);
  }, [localPreferences]);

  const handleSave = useCallback(async () => {
    if (!localPreferences) return;
    setIsSaving(true);
    try {
      // If onUpdate callback is provided, use it
      if (onUpdate) {
        await onUpdate(localPreferences);
      } else {
        // Otherwise, call API directly
        await notificationApi.updatePreferences({
          email: localPreferences.channels.email,
          sms: localPreferences.channels.sms,
          push: localPreferences.channels.push,
          quietHours: localPreferences.quietHours,
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setIsSaving(false);
    }
  }, [localPreferences, onUpdate]);

  const notificationTypes: Array<{
    key: keyof NotificationPreferenceTypes;
    label: string;
    description: string;
  }> = [
    {
      key: 'bookingUpdates',
      label: 'Booking Updates',
      description: 'Confirmed, cancelled, or completed bookings',
    },
    {
      key: 'reminders',
      label: 'Reminders',
      description: 'Upcoming appointment reminders',
    },
    {
      key: 'promotions',
      label: 'Promotions',
      description: 'Special offers and deals',
    },
    {
      key: 'messages',
      label: 'Messages',
      description: 'Messages from providers',
    },
    {
      key: 'system',
      label: 'System',
      description: 'Account and security alerts',
    },
  ];

  const channels: Array<{
    key: keyof NotificationChannelPreferences;
    label: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    { key: 'email', label: 'Email', icon: <Mail className="w-4 h-4" />, color: 'text-blue-500' },
    { key: 'sms', label: 'SMS', icon: <MessageSquare className="w-4 h-4" />, color: 'text-green-500' },
    { key: 'push', label: 'Push', icon: <Smartphone className="w-4 h-4" />, color: 'text-purple-500' },
    { key: 'whatsapp', label: 'WhatsApp', icon: <Smartphone className="w-4 h-4" />, color: 'text-green-600' },
    { key: 'telegram', label: 'Telegram', icon: <Smartphone className="w-4 h-4" />, color: 'text-blue-400' },
  ];

  const timezones = [
    'Asia/Dubai',
    'Asia/Kolkata',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Asia/Singapore',
    'Asia/Tokyo',
  ];

  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#E8B4A8] to-[#D4A5A5] p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Notification Settings</h3>
              <p className="text-white/80 text-sm">Customize how you receive updates</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || saved}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2',
              saved
                ? 'bg-green-500 text-white'
                : 'bg-white text-[#E8B4A8] hover:bg-white/90'
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <Accordion defaultValue="channels">
          {/* Channel Preferences */}
          <AccordionItem value="channels">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#E8B4A8]" />
                <span>Notification Channels</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6">
                {/* Channel Headers */}
                <div className="grid grid-cols-6 gap-2 px-4">
                  <div className="col-span-2" />
                  {channels.map(channel => (
                    <div key={channel.key} className="text-center">
                      <div className={cn('flex items-center justify-center gap-1 text-sm font-medium', channel.color)}>
                        {channel.icon}
                        <span>{channel.label}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notification Types */}
                {notificationTypes.map(type => (
                  <div key={type.key} className="grid grid-cols-6 gap-2 items-center">
                    <div className="col-span-2">
                      <p className="font-medium text-gray-900">{type.label}</p>
                      <p className="text-xs text-gray-500">{type.description}</p>
                    </div>
                    {channels.map(channel => (
                      <div key={`${channel.key}-${type.key}`} className="flex justify-center">
                        <Toggle
                          enabled={localPreferences.channels[channel.key]?.[type.key] ?? false}
                          onChange={() => handleChannelToggle(channel.key, type.key)}
                          size="sm"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Quiet Hours */}
          <AccordionItem value="quiet-hours">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Moon className="w-5 h-5 text-[#E8B4A8]" />
                <span>Do Not Disturb</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 px-4">
                {/* Enable Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">Quiet Hours</p>
                    <p className="text-sm text-gray-500">
                      Pause all notifications during specified hours
                    </p>
                  </div>
                  <Toggle
                    enabled={localPreferences.quietHours.enabled}
                    onChange={handleQuietHoursToggle}
                  />
                </div>

                {/* Time Settings */}
                {localPreferences.quietHours.enabled && (
                  <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={localPreferences.quietHours.startTime}
                          onChange={(e) => handleQuietHoursTimeChange('startTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/20 focus:border-[#E8B4A8]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={localPreferences.quietHours.endTime}
                          onChange={(e) => handleQuietHoursTimeChange('endTime', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/20 focus:border-[#E8B4A8]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Timezone
                      </label>
                      <select
                        value={localPreferences.quietHours.timezone}
                        onChange={(e) => handleTimezoneChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E8B4A8]/20 focus:border-[#E8B4A8]"
                      >
                        {timezones.map(tz => (
                          <option key={tz} value={tz}>
                            {tz.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Preview */}
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <p className="text-sm text-gray-600">
                        Notifications will be paused from{' '}
                        <span className="font-medium">{localPreferences.quietHours.startTime}</span>
                        {' '}to{' '}
                        <span className="font-medium">{localPreferences.quietHours.endTime}</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};

// Toggle Component
interface ToggleProps {
  enabled: boolean;
  onChange: () => void;
  size?: 'sm' | 'md';
}

const Toggle: React.FC<ToggleProps> = ({ enabled, onChange, size = 'md' }) => {
  const sizeClasses = {
    sm: {
      track: 'w-8 h-4',
      thumb: 'w-3 h-3',
      translate: 'translate-x-4',
    },
    md: {
      track: 'w-11 h-6',
      thumb: 'w-5 h-5',
      translate: 'translate-x-5',
    },
  };

  const classes = sizeClasses[size];

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onChange}
      className={cn(
        'relative inline-flex flex-shrink-0 cursor-pointer transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8B4A8] focus-visible:ring-offset-2',
        enabled ? 'bg-[#E8B4A8]' : 'bg-gray-200',
        classes.track
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block rounded-full bg-white shadow-lg',
          'transform transition-transform',
          classes.thumb,
          enabled ? classes.translate : 'translate-x-0.5',
          size === 'sm' && !enabled && 'translate-y-0.5',
          size === 'md' && !enabled && 'translate-y-0.5'
        )}
      />
    </button>
  );
};

export default NotificationPreferences;
