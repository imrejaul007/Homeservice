/**
 * Quiet Hours Component
 * Do Not Disturb settings for notification preferences
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Moon, Sun, Clock, Save, RotateCcw, Check, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface QuietHoursConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  timezone: string;
}

interface QuietHoursProps {
  config: QuietHoursConfig;
  onUpdate: (config: QuietHoursConfig) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export const QuietHours: React.FC<QuietHoursProps> = ({
  config,
  onUpdate,
  isLoading = false,
  className,
}) => {
  const [localConfig, setLocalConfig] = useState<QuietHoursConfig>(config);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync with props
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleToggle = useCallback(() => {
    setLocalConfig(prev => ({
      ...prev,
      enabled: !prev.enabled,
    }));
    setSaved(false);
    setError(null);
  }, []);

  const handleStartTimeChange = useCallback((value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      startTime: value,
    }));
    setSaved(false);
    setError(null);
  }, []);

  const handleEndTimeChange = useCallback((value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      endTime: value,
    }));
    setSaved(false);
    setError(null);
  }, []);

  const handleTimezoneChange = useCallback((value: string) => {
    setLocalConfig(prev => ({
      ...prev,
      timezone: value,
    }));
    setSaved(false);
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    // Validate time range
    const [startHour, startMin] = localConfig.startTime.split(':').map(Number);
    const [endHour, endMin] = localConfig.endTime.split(':').map(Number);
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;

    // Allow overnight ranges (e.g., 22:00 to 08:00)
    const isOvernight = startTotal > endTotal;

    if (!isOvernight && startTotal === endTotal) {
      setError('Start and end times cannot be the same');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onUpdate(localConfig);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  }, [localConfig, onUpdate]);

  const handleReset = useCallback(() => {
    const defaultConfig: QuietHoursConfig = {
      enabled: false,
      startTime: '22:00',
      endTime: '08:00',
      timezone: 'Asia/Dubai',
    };
    setLocalConfig(defaultConfig);
    setSaved(false);
    setError(null);
  }, []);

  // Calculate duration display
  const getDurationDisplay = (): string => {
    const [startHour, startMin] = localConfig.startTime.split(':').map(Number);
    const [endHour, endMin] = localConfig.endTime.split(':').map(Number);
    let startTotal = startHour * 60 + startMin;
    let endTotal = endHour * 60 + endMin;

    // Handle overnight
    if (endTotal < startTotal) {
      endTotal += 24 * 60;
    }

    const durationMinutes = endTotal - startTotal;
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;

    if (hours === 24) {
      return 'All day';
    }
    if (minutes === 0) {
      return `${hours} hours`;
    }
    return `${hours}h ${minutes}m`;
  };

  // Check if it's currently quiet hours
  const isCurrentlyQuietHours = (): boolean => {
    if (!localConfig.enabled) return false;

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: localConfig.timezone,
    });

    const currentTime = formatter.format(now);
    const [currentHour, currentMin] = currentTime.split(':').map(Number);
    const [startHour, startMin] = localConfig.startTime.split(':').map(Number);
    const [endHour, endMin] = localConfig.endTime.split(':').map(Number);

    const currentTotal = currentHour * 60 + currentMin;
    const startTotal = startHour * 60 + startMin;
    const endTotal = endHour * 60 + endMin;

    // Handle overnight
    if (startTotal > endTotal) {
      return currentTotal >= startTotal || currentTotal < endTotal;
    }

    return currentTotal >= startTotal && currentTotal < endTotal;
  };

  const timezones = [
    { value: 'Asia/Dubai', label: 'Dubai (GST)', offset: '+04:00' },
    { value: 'Asia/Kolkata', label: 'India (IST)', offset: '+05:30' },
    { value: 'America/New_York', label: 'New York (EST)', offset: '-05:00' },
    { value: 'America/Los_Angeles', label: 'Los Angeles (PST)', offset: '-08:00' },
    { value: 'Europe/London', label: 'London (GMT)', offset: '+00:00' },
    { value: 'Europe/Paris', label: 'Paris (CET)', offset: '+01:00' },
    { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: '+08:00' },
    { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: '+09:00' },
  ];

  const currentStatus = isCurrentlyQuietHours();

  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 overflow-hidden', className)}>
      {/* Header */}
      <div className={cn(
        'p-6 transition-colors duration-300',
        localConfig.enabled && currentStatus
          ? 'bg-indigo-900'
          : localConfig.enabled
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600'
            : 'bg-gradient-to-r from-indigo-600 to-purple-600'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
              localConfig.enabled ? 'bg-white/20' : 'bg-white/20'
            )}>
              {localConfig.enabled && currentStatus ? (
                <Moon className="w-6 h-6 text-white" />
              ) : (
                <Sun className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-white text-lg">Do Not Disturb</h3>
              <p className="text-white/80 text-sm">
                {localConfig.enabled
                  ? currentStatus
                    ? 'Currently active'
                    : 'Scheduled'
                  : 'Currently disabled'}
              </p>
            </div>
          </div>

          {/* Enable Toggle */}
          <button
            onClick={handleToggle}
            disabled={isLoading}
            className={cn(
              'relative w-14 h-8 rounded-full transition-colors',
              localConfig.enabled ? 'bg-white/30' : 'bg-white/30'
            )}
          >
            <span
              className={cn(
                'absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-lg transition-transform',
                localConfig.enabled ? 'translate-x-6' : 'translate-x-0'
              )}
            />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Status Banner */}
        {localConfig.enabled && (
          <div className={cn(
            'p-4 rounded-lg flex items-center gap-3',
            currentStatus ? 'bg-indigo-50' : 'bg-green-50'
          )}>
            {currentStatus ? (
              <>
                <Moon className="w-5 h-5 text-indigo-600" />
                <div>
                  <p className="font-medium text-indigo-900">Quiet hours are active</p>
                  <p className="text-sm text-indigo-700">Notifications are being paused</p>
                </div>
              </>
            ) : (
              <>
                <Check className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-900">Quiet hours will activate later</p>
                  <p className="text-sm text-green-700">
                    Notifications are currently enabled
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Time Settings */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            Schedule
          </h4>

          <div className="grid grid-cols-2 gap-4">
            {/* Start Time */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Start Time
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={localConfig.startTime}
                  onChange={(e) => handleStartTimeChange(e.target.value)}
                  disabled={!localConfig.enabled}
                  className={cn(
                    'w-full px-4 py-3 border border-gray-200 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500',
                    'disabled:bg-gray-100 disabled:cursor-not-allowed',
                    'text-lg font-medium'
                  )}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  Start
                </span>
              </div>
            </div>

            {/* End Time */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                End Time
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={localConfig.endTime}
                  onChange={(e) => handleEndTimeChange(e.target.value)}
                  disabled={!localConfig.enabled}
                  className={cn(
                    'w-full px-4 py-3 border border-gray-200 rounded-lg',
                    'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500',
                    'disabled:bg-gray-100 disabled:cursor-not-allowed',
                    'text-lg font-medium'
                  )}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  End
                </span>
              </div>
            </div>
          </div>

          {/* Duration Display */}
          {localConfig.enabled && (
            <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">Duration</span>
              <span className="font-medium text-gray-900">{getDurationDisplay()}</span>
            </div>
          )}

          {/* Timezone */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Timezone
            </label>
            <select
              value={localConfig.timezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              disabled={!localConfig.enabled}
              className={cn(
                'w-full px-4 py-3 border border-gray-200 rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500',
                'disabled:bg-gray-100 disabled:cursor-not-allowed'
              )}
            >
              {timezones.map(tz => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.offset})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-50 rounded-lg flex items-center gap-2">
            <span className="text-red-600 text-sm">{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={handleReset}
            disabled={isSaving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              'text-gray-600 hover:bg-gray-100',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving || saved}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-all',
              saved
                ? 'bg-green-500 text-white'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:opacity-90',
              'disabled:opacity-50 disabled:cursor-not-allowed'
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
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>

        {/* Info Note */}
        <p className="text-xs text-gray-500 text-center">
          During quiet hours, notifications will be queued and delivered when the period ends.
        </p>
      </div>
    </div>
  );
};

export default QuietHours;
