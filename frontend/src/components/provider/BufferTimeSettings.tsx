/**
 * BufferTimeSettings - Configure travel and gap times between bookings
 * Provider Dashboard Component
 */
import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';
import {
  Clock,
  MapPin,
  Car,
  Plus,
  Minus,
  Save,
  RotateCcw,
  AlertCircle,
  Check,
  ChevronDown,
  Info,
  Calendar,
  Timer,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export interface BufferTimeSettings {
  /** Travel buffer time in minutes */
  travelBuffer: number;
  /** Gap time between bookings in minutes */
  betweenBookingGap: number;
  /** Maximum daily working hours */
  maxDailyHours: number;
  /** Auto-schedule buffer based on distance */
  autoScheduleBuffer: boolean;
  /** Buffer for long distances (above this km, use extended buffer) */
  longDistanceThreshold: number;
  /** Extended buffer for long distances in minutes */
  longDistanceBuffer: number;
  /** Buffer for back-to-back bookings */
  backToBackEnabled: boolean;
  /** Minimum notice time before booking (hours) */
  minNoticeHours: number;
}

export interface BufferTimeSettingsProps {
  /** Current settings */
  settings: BufferTimeSettings;
  /** Loading state */
  isLoading?: boolean;
  /** Callback when settings are saved */
  onSave: (settings: BufferTimeSettings) => Promise<void>;
  /** Callback when reset to defaults */
  onReset?: () => void;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Default Settings
// =============================================================================

export const DEFAULT_BUFFER_SETTINGS: BufferTimeSettings = {
  travelBuffer: 15,
  betweenBookingGap: 10,
  maxDailyHours: 10,
  autoScheduleBuffer: true,
  longDistanceThreshold: 15,
  longDistanceBuffer: 30,
  backToBackEnabled: false,
  minNoticeHours: 2,
};

// =============================================================================
// Time Input Component
// =============================================================================

interface TimeInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 120,
  step = 5,
  label,
  description,
  icon,
}) => {
  const handleIncrement = () => {
    if (value < max) {
      onChange(Math.min(value + step, max));
    }
  };

  const handleDecrement = () => {
    if (value > min) {
      onChange(Math.max(value - step, min));
    }
  };

  return (
    <div className="bg-nilin-muted/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && <span className="text-nilin-coral">{icon}</span>}
          <span className="text-sm font-medium text-nilin-charcoal">{label}</span>
        </div>
        <span className="text-xs text-nilin-warmGray">
          {value} min
        </span>
      </div>
      {description && (
        <p className="text-xs text-nilin-warmGray mb-3">{description}</p>
      )}
      <div className="flex items-center gap-2">
        <button
          onClick={handleDecrement}
          disabled={value <= min}
          className="w-8 h-8 rounded-lg bg-white border border-nilin-border flex items-center justify-center hover:bg-nilin-blush disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Minus className="w-4 h-4 text-nilin-charcoal" />
        </button>
        <div className="flex-1 h-10 bg-white border border-nilin-border rounded-lg flex items-center justify-center">
          <span className="text-lg font-semibold text-nilin-charcoal">{value}</span>
        </div>
        <button
          onClick={handleIncrement}
          disabled={value >= max}
          className="w-8 h-8 rounded-lg bg-white border border-nilin-border flex items-center justify-center hover:bg-nilin-blush disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4 text-nilin-charcoal" />
        </button>
      </div>
      <div className="flex justify-between mt-1 text-xs text-nilin-lightGray">
        <span>{min} min</span>
        <span>{max} min</span>
      </div>
    </div>
  );
};

// =============================================================================
// Toggle Switch Component
// =============================================================================

interface ToggleSwitchProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label: string;
  description?: string;
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  enabled,
  onChange,
  label,
  description,
}) => {
  return (
    <div className="flex items-start justify-between p-4 bg-nilin-muted/30 rounded-xl">
      <div className="flex-1">
        <p className="text-sm font-medium text-nilin-charcoal">{label}</p>
        {description && (
          <p className="text-xs text-nilin-warmGray mt-1">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          enabled ? 'bg-nilin-coral' : 'bg-nilin-border'
        )}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            enabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </button>
    </div>
  );
};

// =============================================================================
// Slider Input Component
// =============================================================================

interface SliderInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  description?: string;
  unit?: string;
  icon?: React.ReactNode;
  showMarks?: boolean;
  marks?: number[];
}

const SliderInput: React.FC<SliderInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  description,
  unit = '',
  icon,
  marks,
}) => {
  return (
    <div className="bg-nilin-muted/30 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {icon && <span className="text-nilin-coral">{icon}</span>}
          <span className="text-sm font-medium text-nilin-charcoal">{label}</span>
        </div>
        <span className="text-lg font-bold text-nilin-coral">
          {value}{unit}
        </span>
      </div>
      {description && (
        <p className="text-xs text-nilin-warmGray mb-3">{description}</p>
      )}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-full h-2 bg-nilin-border rounded-lg appearance-none cursor-pointer accent-nilin-coral"
        />
        {marks && (
          <div className="flex justify-between mt-2 text-xs text-nilin-lightGray">
            {marks.map((mark) => (
              <span key={mark}>{mark}{unit}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Info Card Component
// =============================================================================

interface InfoCardProps {
  title: string;
  items: string[];
  icon?: React.ReactNode;
}

const InfoCard: React.FC<InfoCardProps> = ({ title, items, icon }) => {
  return (
    <div className="bg-blue-50 rounded-xl p-4">
      <div className="flex items-start gap-2 mb-3">
        {icon || <Info className="w-5 h-5 text-blue-600 flex-shrink-0" />}
        <h4 className="text-sm font-medium text-blue-900">{title}</h4>
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
            <Check className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

// =============================================================================
// Impact Preview Component
// =============================================================================

interface ImpactPreviewProps {
  settings: BufferTimeSettings;
}

const ImpactPreview: React.FC<ImpactPreviewProps> = ({ settings }) => {
  // Calculate daily impact
  const avgBookingDuration = 60; // Assume average booking is 60 min
  const breaksPerDay = Math.floor(settings.maxDailyHours * 60 / (avgBookingDuration + settings.betweenBookingGap + settings.travelBuffer));
  const effectiveHours = Math.min(
    settings.maxDailyHours,
    (breaksPerDay * (avgBookingDuration + settings.travelBuffer + settings.betweenBookingGap)) / 60
  );

  return (
    <div className="bg-nilin-coral/5 rounded-xl p-4">
      <h4 className="text-sm font-medium text-nilin-charcoal mb-3">
        Daily Schedule Impact
      </h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-nilin-coral">
            {breaksPerDay}
          </p>
          <p className="text-xs text-nilin-warmGray">Bookings/day</p>
        </div>
        <div className="bg-white rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-nilin-coral">
            {effectiveHours.toFixed(1)}h
          </p>
          <p className="text-xs text-nilin-warmGray">Effective Hours</p>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const BufferTimeSettings: React.FC<BufferTimeSettingsProps> = ({
  settings: initialSettings,
  isLoading = false,
  onSave,
  onReset,
  className,
}) => {
  const [settings, setSettings] = useState<BufferTimeSettings>(initialSettings);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Reset dirty state when initialSettings changes
  useEffect(() => {
    setSettings(initialSettings);
    setIsDirty(false);
  }, [initialSettings]);

  const updateSetting = useCallback(<K extends keyof BufferTimeSettings>(
    key: K,
    value: BufferTimeSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await onSave(settings);
      setIsDirty(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  }, [settings, onSave]);

  const handleReset = useCallback(() => {
    setSettings(DEFAULT_BUFFER_SETTINGS);
    setIsDirty(true);
    onReset?.();
  }, [onReset]);

  // Calculate total buffer per booking
  const totalBufferPerBooking = settings.travelBuffer + settings.betweenBookingGap;

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-nilin-coral/10 flex items-center justify-center">
            <Timer className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Buffer Time Settings
            </h3>
            <p className="text-sm text-nilin-warmGray">
              Configure gaps between bookings and travel time
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
              Unsaved changes
            </span>
          )}
          {onReset && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-muted rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors',
              isDirty
                ? 'bg-nilin-coral text-white hover:bg-nilin-coral/90'
                : 'bg-nilin-muted text-nilin-warmGray cursor-not-allowed'
            )}
          >
            {isSaving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : showSuccess ? (
              <>
                <Check className="w-4 h-4" />
                Saved!
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

      {/* Loading State */}
      {isLoading && (
        <div className="animate-pulse space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-nilin-muted rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="space-y-6">
          {/* Travel & Gap Settings */}
          <div>
            <h4 className="text-sm font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-nilin-coral" />
              Travel & Gap Times
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <TimeInput
                label="Travel Buffer"
                value={settings.travelBuffer}
                onChange={(v) => updateSetting('travelBuffer', v)}
                min={0}
                max={60}
                step={5}
                description="Time needed to travel between locations"
                icon={<Car className="w-4 h-4" />}
              />
              <TimeInput
                label="Between Booking Gap"
                value={settings.betweenBookingGap}
                onChange={(v) => updateSetting('betweenBookingGap', v)}
                min={0}
                max={30}
                step={5}
                description="Rest time between appointments"
                icon={<Clock className="w-4 h-4" />}
              />
            </div>
            <div className="mt-3 p-3 bg-nilin-muted/50 rounded-lg flex items-center justify-between">
              <span className="text-sm text-nilin-warmGray">Total buffer per booking:</span>
              <span className="text-sm font-bold text-nilin-charcoal">
                {totalBufferPerBooking} minutes
              </span>
            </div>
          </div>

          {/* Long Distance Settings */}
          <div>
            <h4 className="text-sm font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-nilin-coral" />
              Long Distance Handling
            </h4>
            <ToggleSwitch
              enabled={settings.autoScheduleBuffer}
              onChange={(v) => updateSetting('autoScheduleBuffer', v)}
              label="Auto-schedule buffer based on distance"
              description="Automatically add extra buffer for distant locations"
            />
            {settings.autoScheduleBuffer && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <SliderInput
                  label="Long Distance Threshold"
                  value={settings.longDistanceThreshold}
                  onChange={(v) => updateSetting('longDistanceThreshold', v)}
                  min={5}
                  max={50}
                  step={5}
                  unit=" km"
                  description="Apply extra buffer above this distance"
                />
                <TimeInput
                  label="Long Distance Buffer"
                  value={settings.longDistanceBuffer}
                  onChange={(v) => updateSetting('longDistanceBuffer', v)}
                  min={15}
                  max={90}
                  step={5}
                  description="Additional buffer for long distances"
                />
              </div>
            )}
          </div>

          {/* Daily Limits */}
          <div>
            <h4 className="text-sm font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-nilin-coral" />
              Daily Limits
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <SliderInput
                label="Maximum Daily Hours"
                value={settings.maxDailyHours}
                onChange={(v) => updateSetting('maxDailyHours', v)}
                min={4}
                max={14}
                step={0.5}
                unit="h"
                description="Maximum bookings per day"
                icon={<Clock className="w-4 h-4" />}
              />
              <SliderInput
                label="Minimum Notice"
                value={settings.minNoticeHours}
                onChange={(v) => updateSetting('minNoticeHours', v)}
                min={1}
                max={24}
                step={1}
                unit="h"
                description="Hours before booking start"
                icon={<Clock className="w-4 h-4" />}
              />
            </div>
          </div>

          {/* Back-to-Back Bookings */}
          <div>
            <h4 className="text-sm font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-nilin-coral" />
              Booking Configuration
            </h4>
            <ToggleSwitch
              enabled={settings.backToBackEnabled}
              onChange={(v) => updateSetting('backToBackEnabled', v)}
              label="Allow back-to-back bookings"
              description="Enable scheduling consecutive bookings at the same location"
            />
          </div>

          {/* Impact Preview */}
          <ImpactPreview settings={settings} />

          {/* Info Cards */}
          <div className="grid grid-cols-2 gap-4">
            <InfoCard
              title="Why Buffer Times Matter"
              icon={<AlertCircle className="w-5 h-5 text-blue-600" />}
              items={[
                'Prevents rushed appointments',
                'Accounts for travel between locations',
                'Reduces customer complaints',
                'Improves scheduling accuracy',
              ]}
            />
            <InfoCard
              title="Best Practices"
              icon={<Check className="w-5 h-5 text-green-600" />}
              items={[
                'Start with 15 min travel buffer',
                'Add 10 min gap between bookings',
                'Increase buffer during peak hours',
                'Review and adjust monthly',
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default BufferTimeSettings;
