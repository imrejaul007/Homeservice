/**
 * Channel Preferences Component
 * Per-channel notification settings UI
 */

import React, { useState, useCallback } from 'react';
import {
  Mail,
  MessageSquare,
  Smartphone,
  MessageCircle,
  Send,
  Bell,
  BellOff,
  Check,
  Loader2,
  Settings,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface ChannelPreferenceTypes {
  bookingUpdates: boolean;
  reminders: boolean;
  promotions: boolean;
  messages: boolean;
  system: boolean;
}

interface ChannelConfig {
  enabled: boolean;
  types: ChannelPreferenceTypes;
}

interface ChannelPreferencesProps {
  channels: {
    email: ChannelConfig;
    sms: ChannelConfig;
    push: ChannelConfig;
    whatsapp: ChannelConfig;
    telegram: ChannelConfig;
  };
  onUpdate: (channel: string, updates: Partial<ChannelConfig>) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export const ChannelPreferences: React.FC<ChannelPreferencesProps> = ({
  channels,
  onUpdate,
  isLoading = false,
  className,
}) => {
  const [expandedChannel, setExpandedChannel] = useState<string | null>(null);
  const [savingChannel, setSavingChannel] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggleChannel = useCallback(async (channelKey: string) => {
    const channel = channels[channelKey as keyof typeof channels];
    if (!channel) return;

    setSavingChannel(channelKey);
    setError(null);

    try {
      await onUpdate(channelKey, { enabled: !channel.enabled });
      setSaved(channelKey);
      setTimeout(() => setSaved(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSavingChannel(null);
    }
  }, [channels, onUpdate]);

  const handleToggleType = useCallback(async (
    channelKey: string,
    typeKey: keyof ChannelPreferenceTypes
  ) => {
    const channel = channels[channelKey as keyof typeof channels];
    if (!channel) return;

    const newTypes = {
      ...channel.types,
      [typeKey]: !channel.types[typeKey],
    };

    setSavingChannel(channelKey);
    setError(null);

    try {
      await onUpdate(channelKey, { types: newTypes });
      setSaved(channelKey);
      setTimeout(() => setSaved(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setSavingChannel(null);
    }
  }, [channels, onUpdate]);

  const channelDefinitions = [
    {
      key: 'email' as const,
      label: 'Email',
      icon: Mail,
      color: 'blue',
      description: 'Receive notifications via email',
      bgColor: 'bg-blue-500',
      hoverBgColor: 'hover:bg-blue-50',
      activeBgColor: 'bg-blue-50 border-blue-200',
    },
    {
      key: 'sms' as const,
      label: 'SMS',
      icon: MessageSquare,
      color: 'green',
      description: 'Receive text messages',
      bgColor: 'bg-green-500',
      hoverBgColor: 'hover:bg-green-50',
      activeBgColor: 'bg-green-50 border-green-200',
    },
    {
      key: 'push' as const,
      label: 'Push',
      icon: Smartphone,
      color: 'purple',
      description: 'Browser and app push notifications',
      bgColor: 'bg-purple-500',
      hoverBgColor: 'hover:bg-purple-50',
      activeBgColor: 'bg-purple-50 border-purple-200',
    },
    {
      key: 'whatsapp' as const,
      label: 'WhatsApp',
      icon: MessageCircle,
      color: 'emerald',
      description: 'WhatsApp Business messages',
      bgColor: 'bg-[#25D366]',
      hoverBgColor: 'hover:bg-green-50',
      activeBgColor: 'bg-green-50 border-green-200',
    },
    {
      key: 'telegram' as const,
      label: 'Telegram',
      icon: Send,
      color: 'sky',
      description: 'Telegram bot notifications',
      bgColor: 'bg-[#0088cc]',
      hoverBgColor: 'hover:bg-sky-50',
      activeBgColor: 'bg-sky-50 border-sky-200',
    },
  ];

  const notificationTypes: Array<{
    key: keyof ChannelPreferenceTypes;
    label: string;
    icon: string;
  }> = [
    { key: 'bookingUpdates', label: 'Booking Updates', icon: '📋' },
    { key: 'reminders', label: 'Reminders', icon: '⏰' },
    { key: 'promotions', label: 'Promotions', icon: '🎁' },
    { key: 'messages', label: 'Messages', icon: '💬' },
    { key: 'system', label: 'System', icon: '⚙️' },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold text-gray-900">Notification Channels</h3>
        </div>
        <span className="text-sm text-gray-500">
          {Object.values(channels).filter(c => c.enabled).length} of {Object.keys(channels).length} enabled
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Channel Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {channelDefinitions.map(channel => {
          const config = channels[channel.key];
          const isExpanded = expandedChannel === channel.key;
          const isSaving = savingChannel === channel.key;
          const isSaved = saved === channel.key;
          const Icon = channel.icon;

          return (
            <div
              key={channel.key}
              className={cn(
                'rounded-xl border transition-all duration-200 overflow-hidden',
                config.enabled
                  ? `${channel.activeBgColor} border-2`
                  : 'bg-white border-gray-100 hover:border-gray-200',
                'hover:shadow-sm'
              )}
            >
              {/* Channel Header */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      config.enabled ? `${channel.bgColor} text-white` : 'bg-gray-100 text-gray-400'
                    )}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{channel.label}</h4>
                      <p className="text-xs text-gray-500">{channel.description}</p>
                    </div>
                  </div>

                  {/* Enable Toggle */}
                  <button
                    onClick={() => handleToggleChannel(channel.key)}
                    disabled={isSaving}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-colors',
                      config.enabled ? channel.bgColor : 'bg-gray-200',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                      isSaving && 'opacity-50'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                        config.enabled ? 'translate-x-5' : 'translate-x-0'
                      )}
                    />
                  </button>
                </div>

                {/* Quick Status */}
                <div className="flex items-center gap-2 text-sm">
                  {config.enabled ? (
                    <>
                      <Check className="w-4 h-4 text-green-500" />
                      <span className="text-green-700">Enabled</span>
                      <span className="text-gray-300">|</span>
                      <span className="text-gray-500">
                        {Object.values(config.types).filter(Boolean).length} of {Object.keys(config.types).length} types
                      </span>
                    </>
                  ) : (
                    <>
                      <BellOff className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-500">Disabled</span>
                    </>
                  )}
                </div>

                {/* Expand/Collapse */}
                {config.enabled && (
                  <button
                    onClick={() => setExpandedChannel(isExpanded ? null : channel.key)}
                    className={cn(
                      'w-full mt-3 py-2 text-sm font-medium rounded-lg transition-colors',
                      channel.hoverBgColor,
                      'text-gray-700'
                    )}
                  >
                    {isExpanded ? 'Hide settings' : 'Configure types'}
                  </button>
                )}
              </div>

              {/* Expanded Type Settings */}
              {config.enabled && isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100">
                  <div className="space-y-3">
                    {notificationTypes.map(type => (
                      <div
                        key={type.key}
                        className="flex items-center justify-between py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span>{type.icon}</span>
                          <span className="text-sm text-gray-700">{type.label}</span>
                        </div>

                        <button
                          onClick={() => handleToggleType(channel.key, type.key)}
                          disabled={isSaving}
                          className={cn(
                            'relative w-9 h-5 rounded-full transition-colors',
                            config.types[type.key] ? channel.bgColor : 'bg-gray-200',
                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                            isSaving && 'opacity-50'
                          )}
                        >
                          <span
                            className={cn(
                              'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                              config.types[type.key] ? 'translate-x-4' : 'translate-x-0'
                            )}
                          />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Saving Indicator */}
                  {isSaving && (
                    <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </div>
                  )}

                  {isSaved && !isSaving && (
                    <div className="flex items-center justify-center gap-2 py-2 text-sm text-green-600">
                      <Check className="w-4 h-4" />
                      Saved
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Bell className="w-5 h-5 text-gray-400 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-900">About Notification Types</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              <li><span className="font-medium">Booking Updates:</span> Confirmations, cancellations, completions</li>
              <li><span className="font-medium">Reminders:</span> Upcoming appointment alerts</li>
              <li><span className="font-medium">Promotions:</span> Special offers and deals</li>
              <li><span className="font-medium">Messages:</span> Messages from providers</li>
              <li><span className="font-medium">System:</span> Account and security alerts</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChannelPreferences;
