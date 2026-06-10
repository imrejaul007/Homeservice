import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Copy,
  Trash2,
  Save,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Globe,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  serviceAvailabilityApi,
  type ServiceSchedule,
  type TimeSlot,
  type ServiceScheduleResponse,
} from '../../services/serviceAvailabilityApi';
import toast from 'react-hot-toast';

// ============================================
// Time Slot Validation Utilities
// ============================================

interface ValidationError {
  field: string;
  message: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Parse time string "HH:MM" to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Convert minutes to time string "HH:MM"
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Validate a single time slot
 * Rules:
 * 1. endTime must be > startTime (minimum 30 minutes)
 * 2. Slot must be within service operating hours (08:00 - 22:00)
 */
function validateSingleSlot(slot: TimeSlot): ValidationResult {
  const errors: ValidationError[] = [];

  const startMinutes = timeToMinutes(slot.startTime);
  const endMinutes = timeToMinutes(slot.endTime);

  // Rule 1: endTime must be > startTime (minimum 30 minute duration)
  if (endMinutes <= startMinutes) {
    errors.push({
      field: 'endTime',
      message: 'End time must be after start time (minimum 30 minutes)',
    });
  }

  // Check minimum 30-minute duration
  if (endMinutes - startMinutes < 30) {
    errors.push({
      field: 'endTime',
      message: 'Slot duration must be at least 30 minutes',
    });
  }

  // Rule 2: Validate within operating hours (08:00 - 22:00)
  const operatingStart = timeToMinutes('08:00');
  const operatingEnd = timeToMinutes('22:00');

  if (startMinutes < operatingStart) {
    errors.push({
      field: 'startTime',
      message: 'Start time must be after 08:00 (operating hours)',
    });
  }

  if (endMinutes > operatingEnd) {
    errors.push({
      field: 'endTime',
      message: 'End time must be before 22:00 (operating hours)',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate slots for gaps and overlaps
 * Rules:
 * 1. No gaps between consecutive slots
 * 2. No overlaps between slots
 */
function validateSlotSequence(slots: TimeSlot[]): ValidationResult {
  const errors: ValidationError[] = [];

  for (let i = 0; i < slots.length - 1; i++) {
    const currentEnd = timeToMinutes(slots[i].endTime);
    const nextStart = timeToMinutes(slots[i + 1].startTime);

    // Check for overlap
    if (nextStart < currentEnd) {
      errors.push({
        field: `slot${i + 1}`,
        message: `Slot ${i + 1} overlaps with slot ${i + 2}`,
      });
    }

    // Check for gap (more than 5 minutes)
    if (nextStart - currentEnd > 5) {
      errors.push({
        field: `slot${i + 2}`,
        message: `Gap detected between slot ${i + 1} and ${i + 2}`,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate all slots for a day including single slot and sequence validation
 */
function validateDaySlots(slots: TimeSlot[]): ValidationResult {
  const allErrors: ValidationError[] = [];

  // Validate each slot individually
  slots.forEach((slot, index) => {
    const result = validateSingleSlot(slot);
    if (!result.isValid) {
      result.errors.forEach((err) => {
        allErrors.push({
          ...err,
          field: `slot${index + 1}_${err.field}`,
          message: `Slot ${index + 1}: ${err.message}`,
        });
      });
    }
  });

  // Validate sequence (gaps and overlaps)
  if (slots.length > 1) {
    const sequenceResult = validateSlotSequence(slots);
    allErrors.push(...sequenceResult.errors);
  }

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
  };
}

interface ServiceAvailabilityManagerProps {
  serviceId: string;
  serviceName: string;
  bundleName?: string;
  onScheduleChange?: (hasSchedule: boolean) => void;
  className?: string;
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday', short: 'Mon' },
  { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
  { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
  { key: 'thursday', label: 'Thursday', short: 'Thu' },
  { key: 'friday', label: 'Friday', short: 'Fri' },
  { key: 'saturday', label: 'Saturday', short: 'Sat' },
  { key: 'sunday', label: 'Sunday', short: 'Sun' },
];

const TIME_OPTIONS: string[] = [];
for (let hour = 0; hour < 24; hour++) {
  for (let min = 0; min < 60; min += 30) {
    TIME_OPTIONS.push(
      `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`
    );
  }
}

const ServiceAvailabilityManager: React.FC<ServiceAvailabilityManagerProps> = ({
  serviceId,
  serviceName,
  bundleName,
  onScheduleChange,
  className,
}) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usingGlobal, setUsingGlobal] = useState(false);
  const [schedule, setSchedule] = useState<ServiceSchedule | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Load existing schedule
  useEffect(() => {
    loadSchedule();
  }, [serviceId]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const result = await serviceAvailabilityApi.getServiceSchedule(serviceId);
      setUsingGlobal(!result.hasSchedule);
      if (result.schedule) {
        setSchedule(result.schedule);
      } else {
        setSchedule(serviceAvailabilityApi.createDefaultSchedule());
      }
      onScheduleChange?.(!result.hasSchedule);
    } catch (error) {
      console.error('Failed to load service schedule:', error);
      toast.error('Failed to load availability schedule');
      // Set default schedule on error
      setSchedule(serviceAvailabilityApi.createDefaultSchedule());
    } finally {
      setLoading(false);
    }
  };

  const handleToggleGlobal = async () => {
    if (usingGlobal) {
      // Switching to custom schedule
      setUsingGlobal(false);
      setSchedule(serviceAvailabilityApi.createDefaultSchedule());
      setHasChanges(true);
      onScheduleChange?.(false);
    } else {
      // Switching to global schedule
      try {
        setSaving(true);
        await serviceAvailabilityApi.updateServiceSchedule(serviceId, {}, true);
        toast.success('Now using global availability');
        setUsingGlobal(true);
        setHasChanges(false);
        onScheduleChange?.(false);
      } catch (error) {
        console.error('Failed to switch to global:', error);
        toast.error('Failed to update availability');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleCopyGlobal = async () => {
    try {
      setSaving(true);
      const result = await serviceAvailabilityApi.copyGlobalToService(serviceId);
      if (result.schedule) {
        setSchedule(result.schedule);
        toast.success('Global schedule copied');
        setUsingGlobal(false);
        setHasChanges(true);
        onScheduleChange?.(true);
      }
    } catch (error) {
      console.error('Failed to copy global:', error);
      toast.error('Failed to copy global schedule. Make sure global availability is set.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDay = (day: string) => {
    setExpandedDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const handleToggleAvailable = (day: string) => {
    if (!schedule) return;
    setSchedule((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [day]: {
          ...prev[day],
          isAvailable: !prev[day].isAvailable,
        },
      };
    });
    setHasChanges(true);
  };

  const handleTimeSlotChange = (
    day: string,
    slotIndex: number,
    field: 'startTime' | 'endTime',
    value: string
  ) => {
    setSchedule((prev) => {
      if (!prev) return prev;
      const currentSlots = prev[day].timeSlots || [];
      const newSlots = [...currentSlots];

      // Create the updated slot
      const updatedSlot = { ...newSlots[slotIndex], [field]: value };
      newSlots[slotIndex] = updatedSlot;

      // Validate the updated slot
      const singleValidation = validateSingleSlot(updatedSlot);
      if (!singleValidation.isValid) {
        toast.error(singleValidation.errors[0].message);
        return prev; // Don't apply invalid change
      }

      // If updating startTime, check for overlaps with previous slot
      if (field === 'startTime' && slotIndex > 0) {
        const prevSlot = newSlots[slotIndex - 1];
        const prevEnd = timeToMinutes(prevSlot.endTime);
        const newStart = timeToMinutes(value);
        if (newStart < prevEnd) {
          toast.error('Start time cannot be before previous slot ends');
          return prev;
        }
        if (newStart - prevEnd > 5) {
          toast.error('Cannot create gaps between consecutive slots');
          return prev;
        }
      }

      // If updating endTime, check for overlaps with next slot
      if (field === 'endTime' && slotIndex < newSlots.length - 1) {
        const nextSlot = newSlots[slotIndex + 1];
        const newEnd = timeToMinutes(value);
        const nextStart = timeToMinutes(nextSlot.startTime);
        if (nextStart < newEnd) {
          toast.error('End time cannot be after next slot starts');
          return prev;
        }
        if (newEnd > nextStart + 5) {
          toast.error('Cannot create gaps between consecutive slots');
          return prev;
        }
      }

      return {
        ...prev,
        [day]: {
          ...prev[day],
          timeSlots: newSlots,
        },
      };
    });
    setHasChanges(true);
  };

  const handleAddSlot = (day: string, afterIndex: number) => {
    if (!schedule) return;
    const slots = schedule[day].timeSlots;
    const afterSlot = slots[afterIndex];
    const newSlot: TimeSlot = {
      startTime: afterSlot?.endTime || '09:00',
      endTime: afterSlot?.endTime
        ? addMinutes(afterSlot.endTime, 30)
        : '09:30',
      isBooked: false,
      maxBookings: 2,
      currentBookings: 0,
    };

    setSchedule((prev) => {
      if (!prev) return prev;
      const newSlots = [...slots];
      newSlots.splice(afterIndex + 1, 0, newSlot);
      return {
        ...prev,
        [day]: { ...prev[day], timeSlots: newSlots },
      };
    });
    setHasChanges(true);
  };

  const handleRemoveSlot = (day: string, index: number) => {
    if (!schedule) return;
    setSchedule((prev) => {
      if (!prev) return prev;
      const newSlots = schedule[day].timeSlots.filter((_, i) => i !== index);
      return {
        ...prev,
        [day]: { ...prev[day], timeSlots: newSlots },
      };
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!schedule) return;
    try {
      setSaving(true);
      await serviceAvailabilityApi.updateServiceSchedule(serviceId, schedule, false);
      toast.success('Availability saved');
      setHasChanges(false);
      setUsingGlobal(false);
      onScheduleChange?.(true);
    } catch (error) {
      console.error('Failed to save schedule:', error);
      toast.error('Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={cn('p-4', className)}>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-nilin-charcoal">
              {bundleName || 'Service'} Availability
            </h3>
            <p className="text-sm text-nilin-warmGray">{serviceName}</p>
          </div>
          <div className="flex items-center gap-2">
            {usingGlobal ? (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full flex items-center gap-1">
                <Globe className="w-3 h-3" />
                Using Global
              </span>
            ) : hasChanges ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose transition-colors text-sm font-medium disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            ) : (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" />
                Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Global Toggle */}
      <div className="p-4 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-nilin-warmGray" />
            <div>
              <p className="font-medium text-nilin-charcoal">Use global availability</p>
              <p className="text-xs text-nilin-warmGray">
                Same hours as your default working schedule
              </p>
            </div>
          </div>
          <button
            onClick={handleToggleGlobal}
            disabled={saving}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors',
              usingGlobal ? 'bg-nilin-coral' : 'bg-gray-300'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                usingGlobal && 'translate-x-5'
              )}
            />
          </button>
        </div>

        {!usingGlobal && (
          <button
            onClick={handleCopyGlobal}
            disabled={saving}
            className="mt-3 flex items-center gap-1.5 text-sm text-nilin-coral hover:text-nilin-rose transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy from global schedule
          </button>
        )}
      </div>

      {/* Day Schedules */}
      {!usingGlobal && schedule && (
        <div className="divide-y divide-gray-100">
          {DAYS_OF_WEEK.map((day) => (
            <div key={day.key}>
              {/* Day Header */}
              <button
                onClick={() => handleToggleDay(day.key)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      schedule[day.key]?.isAvailable ? 'bg-green-500' : 'bg-gray-300'
                    )}
                  />
                  <span className="font-medium text-nilin-charcoal">{day.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {schedule[day.key]?.isAvailable && (
                    <span className="text-xs text-nilin-warmGray">
                      {schedule[day.key].timeSlots.length} slots
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleAvailable(day.key);
                    }}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium',
                      schedule[day.key]?.isAvailable
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    )}
                  >
                    {schedule[day.key]?.isAvailable ? 'Available' : 'Off'}
                  </button>
                  {expandedDays[day.key] ? (
                    <ChevronDown className="w-4 h-4 text-nilin-warmGray" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-nilin-warmGray" />
                  )}
                </div>
              </button>

              {/* Expanded Day Schedule */}
              {expandedDays[day.key] && schedule[day.key]?.isAvailable && (
                <div className="px-4 pb-4 bg-gray-50">
                  <div className="space-y-2">
                    {schedule[day.key].timeSlots.map((slot, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <select
                          value={slot.startTime}
                          onChange={(e) =>
                            handleTimeSlotChange(day.key, index, 'startTime', e.target.value)
                          }
                          className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                        <span className="text-nilin-warmGray">to</span>
                        <select
                          value={slot.endTime}
                          onChange={(e) =>
                            handleTimeSlotChange(day.key, index, 'endTime', e.target.value)
                          }
                          className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                        >
                          {TIME_OPTIONS.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleAddSlot(day.key, index)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                          title="Add slot after this"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        {schedule[day.key].timeSlots.length > 1 && (
                          <button
                            onClick={() => handleRemoveSlot(day.key, index)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                            title="Remove this slot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper function to add minutes to a time string
function addMinutes(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;
  return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

export default ServiceAvailabilityManager;
