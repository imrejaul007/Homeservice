import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Minus,
  Save,
  X,
  AlertCircle,
  Check,
  Trash2,
  Globe
} from 'lucide-react';
import { useBookingStore } from '../../stores/bookingStore';
import type { ProviderAvailability } from '../../services/BookingService';
import { cn } from '../../lib/utils';

interface AvailabilityManagerProps {
  className?: string;
}

interface TimeSlot {
  start: string;
  end: string;
  isActive: boolean;
}

interface DaySchedule {
  isAvailable: boolean;
  timeSlots: TimeSlot[];
}

const DAYS_OF_WEEK = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
];

const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday'
};

const COMMON_TIMEZONES = [
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Riyadh', label: 'Riyadh (AST)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'UTC', label: 'UTC' }
];

const AvailabilityManager: React.FC<AvailabilityManagerProps> = ({ className }) => {
  const {
    providerAvailability,
    getProviderAvailability,
    updateWeeklySchedule,
    updateAvailabilitySettings,
    addDateOverride,
    removeDateOverride,
    isLoading,
    isSubmitting,
    errors
  } = useBookingStore();

  const [weeklySchedule, setWeeklySchedule] = useState<ProviderAvailability['weeklySchedule']>({});
  const [hasScheduleChanges, setHasScheduleChanges] = useState(false);
  const [hasSettingsChanges, setHasSettingsChanges] = useState(false);
  const [newOverride, setNewOverride] = useState({
    date: '',
    isAvailable: true,
    reason: '',
    notes: ''
  });
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    bufferTime: 15,
    maxAdvanceBookingDays: 30,
    autoAcceptBookings: false,
    minNoticeTime: 24,
    timezone: 'Asia/Kolkata'
  });

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Success message
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load availability on component mount
  useEffect(() => {
    getProviderAvailability();
  }, [getProviderAvailability]);

  // Update local state when provider availability changes
  useEffect(() => {
    if (providerAvailability?.weeklySchedule) {
      setWeeklySchedule(providerAvailability.weeklySchedule);
      setHasScheduleChanges(false);
    }

    // Update settings from provider availability
    if (providerAvailability) {
      setSettings({
        bufferTime: providerAvailability.bufferTime ?? 15,
        maxAdvanceBookingDays: providerAvailability.maxAdvanceBookingDays ?? 30,
        autoAcceptBookings: providerAvailability.autoAcceptBookings ?? false,
        minNoticeTime: providerAvailability.minNoticeTime ?? 24,
        timezone: providerAvailability.timezone ?? 'Asia/Kolkata'
      });
      setHasSettingsChanges(false);
    }
  }, [providerAvailability]);

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const initializeDefaultSchedule = () => {
    const defaultSchedule: ProviderAvailability['weeklySchedule'] = {};

    DAYS_OF_WEEK.forEach(day => {
      if (!weeklySchedule[day]) {
        defaultSchedule[day] = {
          isAvailable: day !== 'saturday' && day !== 'sunday',
          timeSlots: day !== 'saturday' && day !== 'sunday' ? [
            { start: '09:00', end: '17:00', isActive: true }
          ] : []
        };
      } else {
        defaultSchedule[day] = weeklySchedule[day];
      }
    });

    return defaultSchedule;
  };

  const schedule = weeklySchedule && Object.keys(weeklySchedule).length > 0
    ? weeklySchedule
    : initializeDefaultSchedule();

  // Helper: Convert time string to minutes
  const timeToMinutes = useCallback((time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }, []);

  // Validation: Check for overlapping time slots
  const validateTimeSlots = useCallback((slots: TimeSlot[]): string | null => {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const start1 = timeToMinutes(slots[i].start);
        const end1 = timeToMinutes(slots[i].end);
        const start2 = timeToMinutes(slots[j].start);
        const end2 = timeToMinutes(slots[j].end);

        // Check for overlap
        if (start1 < end2 && start2 < end1) {
          return `Time slots overlap: ${slots[i].start}-${slots[i].end} and ${slots[j].start}-${slots[j].end}`;
        }
      }
    }
    return null;
  }, [timeToMinutes]);

  // Validation: Check if start time is before end time
  const validateTimeRange = useCallback((slot: TimeSlot): string | null => {
    const start = timeToMinutes(slot.start);
    const end = timeToMinutes(slot.end);

    if (start >= end) {
      return `Start time must be before end time`;
    }

    if (end - start < 30) {
      return `Time slot must be at least 30 minutes`;
    }

    return null;
  }, [timeToMinutes]);

  const updateDayAvailability = (day: string, isAvailable: boolean) => {
    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isAvailable,
        timeSlots: isAvailable && (!prev[day] || prev[day].timeSlots.length === 0)
          ? [{ start: '09:00', end: '17:00', isActive: true }]
          : prev[day]?.timeSlots || []
      }
    }));
    setHasScheduleChanges(true);
    setValidationErrors({});
  };

  const addTimeSlot = (day: string) => {
    const daySchedule = schedule[day] || { isAvailable: false, timeSlots: [] };
    const lastSlot = daySchedule.timeSlots[daySchedule.timeSlots.length - 1];
    const newStart = lastSlot ? addHour(lastSlot.end) : '09:00';
    const newEnd = addHour(newStart);

    const newSlot = { start: newStart, end: newEnd, isActive: true };

    // Check if new slot would cause overlap
    const allSlots = [...daySchedule.timeSlots, newSlot];
    const overlapError = validateTimeSlots(allSlots);

    if (overlapError) {
      setValidationErrors({ [day]: overlapError });
      return;
    }

    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...daySchedule,
        timeSlots: [...daySchedule.timeSlots, newSlot]
      }
    }));
    setHasScheduleChanges(true);
    setValidationErrors({});
  };

  const removeTimeSlot = (day: string, index: number) => {
    const daySchedule = schedule[day];
    if (!daySchedule) return;

    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...daySchedule,
        timeSlots: daySchedule.timeSlots.filter((_, i) => i !== index)
      }
    }));
    setHasScheduleChanges(true);
    setValidationErrors({});
  };

  const updateTimeSlot = (day: string, index: number, field: 'start' | 'end', value: string) => {
    const daySchedule = schedule[day];
    if (!daySchedule) return;

    const updatedSlots = [...daySchedule.timeSlots];
    const updatedSlot = { ...updatedSlots[index], [field]: value };
    updatedSlots[index] = updatedSlot;

    // Validate time range
    const rangeError = validateTimeRange(updatedSlot);
    if (rangeError) {
      setValidationErrors({ [`${day}-${index}`]: rangeError });
      setWeeklySchedule(prev => ({
        ...prev,
        [day]: {
          ...daySchedule,
          timeSlots: updatedSlots
        }
      }));
      return;
    }

    // Check for overlaps with other slots
    const overlapError = validateTimeSlots(updatedSlots);
    if (overlapError) {
      setValidationErrors({ [day]: overlapError });
    } else {
      setValidationErrors({});
    }

    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...daySchedule,
        timeSlots: updatedSlots
      }
    }));
    setHasScheduleChanges(true);
  };

  const addHour = (time: string): string => {
    const [hour, minute] = time.split(':').map(Number);
    const newHour = (hour + 1) % 24;
    return `${newHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const handleSaveSchedule = async () => {
    try {
      await updateWeeklySchedule(weeklySchedule);
      setHasScheduleChanges(false);
      setSuccessMessage('Weekly schedule saved successfully!');
    } catch {
      // Error handled by store
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateAvailabilitySettings({
        bufferTime: settings.bufferTime,
        maxAdvanceBookingDays: settings.maxAdvanceBookingDays,
        autoAcceptBookings: settings.autoAcceptBookings,
        minNoticeTime: settings.minNoticeTime
      });
      setHasSettingsChanges(false);
      setSuccessMessage('Settings saved successfully!');
    } catch {
      // Error handled by store
    }
  };

  const handleAddOverride = async () => {
    try {
      await addDateOverride({
        date: newOverride.date,
        isAvailable: newOverride.isAvailable,
        reason: newOverride.reason || undefined,
        notes: newOverride.notes || undefined
      });

      setNewOverride({
        date: '',
        isAvailable: true,
        reason: '',
        notes: ''
      });
      setShowOverrideForm(false);
      setSuccessMessage('Special date added successfully!');
    } catch {
      // Error handled by store
    }
  };

  const handleRemoveOverride = async (date: string) => {
    try {
      await removeDateOverride(date);
      setSuccessMessage('Special date removed successfully!');
    } catch {
      // Error handled by store
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nilin-coral"></div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Success Message */}
      {successMessage && (
        <div className="glass p-4 rounded-xl bg-nilin-success/10 border border-nilin-success/20 flex items-center">
          <Check className="h-5 w-5 text-nilin-success mr-2" />
          <span className="text-sm text-nilin-success">{successMessage}</span>
        </div>
      )}

      {/* Top actions */}
      <div className="flex justify-end items-start gap-2">
        {hasScheduleChanges && (
          <button
            onClick={handleSaveSchedule}
            disabled={isSubmitting || Object.keys(validationErrors).length > 0}
            className={cn(
              "btn-3d flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl font-medium transition-all shadow-nilin-warm",
              isSubmitting || Object.keys(validationErrors).length > 0
                ? "opacity-50 cursor-not-allowed"
                : "hover:shadow-lg"
            )}
          >
            {isSubmitting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Schedule
          </button>
        )}

        {hasSettingsChanges && (
          <button
            onClick={handleSaveSettings}
            disabled={isSubmitting}
            className={cn(
              "btn-3d flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-nilin-green to-nilin-teal text-white rounded-xl font-medium transition-all",
              isSubmitting
                ? "opacity-50 cursor-not-allowed"
                : "hover:shadow-lg"
            )}
          >
            {isSubmitting ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Settings
          </button>
        )}
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="glass p-4 rounded-xl bg-nilin-error/10 border border-nilin-error/20">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-nilin-error mr-2" />
            <div>
              <h3 className="text-sm font-medium text-nilin-error">Error</h3>
              <div className="text-sm text-nilin-error/80 mt-1">
                {errors.map((error, index) => (
                  <p key={index}>{error.message}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="glass p-4 rounded-xl bg-yellow-50 border border-yellow-200">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-yellow-700">Validation Error</h3>
              <div className="text-sm text-yellow-700 mt-1">
                {Object.values(validationErrors).map((error, index) => (
                  <p key={index}>{error}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Schedule */}
      <div className="glass glass-blur rounded-xl p-6 gradient-3d card-3d">
        <h3 className="text-lg font-semibold text-nilin-charcoal mb-4 font-serif">Weekly Schedule</h3>

        <div className="space-y-4">
          {DAYS_OF_WEEK.map(day => {
            const daySchedule = schedule[day] || { isAvailable: false, timeSlots: [] };
            const dayError = validationErrors[day];

            return (
              <div key={day} className={cn(
                "glass p-4 rounded-xl border card-3d transition-all",
                dayError ? "border-yellow-400" : "border-nilin-border/30 hover:border-glow"
              )}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={daySchedule.isAvailable}
                        onChange={(e) => updateDayAvailability(day, e.target.checked)}
                        className="h-4 w-4 text-nilin-coral border-nilin-border rounded focus:ring-nilin-rose/50"
                      />
                      <span className="ml-2 font-medium text-nilin-charcoal">
                        {DAY_LABELS[day as keyof typeof DAY_LABELS]}
                      </span>
                    </label>
                  </div>

                  {daySchedule.isAvailable && (
                    <button
                      onClick={() => addTimeSlot(day)}
                      className="glass-btn flex items-center gap-1 px-3 py-1 text-sm text-nilin-coral hover:bg-nilin-blush/30 rounded-lg transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add Time Slot
                    </button>
                  )}
                </div>

                {dayError && (
                  <p className="text-sm text-yellow-600 mb-2">{dayError}</p>
                )}

                {daySchedule.isAvailable && (
                  <div className="space-y-2">
                    {daySchedule.timeSlots.map((slot, index) => {
                      const slotError = validationErrors[`${day}-${index}`];
                      return (
                        <div key={index} className={cn(
                          "flex items-center gap-3 neu-light p-3 rounded-xl",
                          slotError ? "border border-yellow-300" : ""
                        )}>
                          <Clock className="h-4 w-4 text-nilin-rose" />

                          <div className="flex-1">
                            <input
                              type="time"
                              value={typeof slot.start === 'string' ? slot.start : ''}
                              onChange={(e) => updateTimeSlot(day, index, 'start', e.target.value)}
                              className="glass-input px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
                            />
                          </div>

                          <span className="text-nilin-warmGray">to</span>

                          <div className="flex-1">
                            <input
                              type="time"
                              value={typeof slot.end === 'string' ? slot.end : ''}
                              onChange={(e) => updateTimeSlot(day, index, 'end', e.target.value)}
                              className="glass-input px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
                            />
                          </div>

                          {daySchedule.timeSlots.length > 1 && (
                            <button
                              onClick={() => removeTimeSlot(day, index)}
                              className="glass-btn p-1 text-nilin-error hover:bg-nilin-error/10 rounded-lg transition-colors"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          )}

                          {slotError && (
                            <span aria-label={slotError}>
                              <AlertCircle className="h-4 w-4 text-yellow-500" />
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {daySchedule.timeSlots.length === 0 && (
                      <p className="text-sm text-nilin-warmGray italic">
                        No time slots set. Click "Add Time Slot" to add availability.
                      </p>
                    )}
                  </div>
                )}

                {!daySchedule.isAvailable && (
                  <p className="text-sm text-nilin-warmGray italic">Not available on this day</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Date Overrides */}
      <div className="glass glass-blur rounded-xl p-6 gradient-3d card-3d">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-nilin-charcoal font-serif">Special Dates</h3>
          <button
            onClick={() => setShowOverrideForm(!showOverrideForm)}
            className="glass-btn flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
          >
            <Plus className="h-4 w-4 text-nilin-coral" />
            <span className="text-nilin-charcoal">Add Special Date</span>
          </button>
        </div>

        {/* Add Override Form */}
        {showOverrideForm && (
          <div className="mb-6 neu-light p-6 rounded-xl">
            <h4 className="font-medium text-nilin-charcoal mb-3">Add Special Date Override</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-nilin-warmGray mb-1">Date</label>
                <input
                  type="date"
                  value={newOverride.date}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-warmGray mb-1">Status</label>
                <select
                  value={newOverride.isAvailable ? 'available' : 'unavailable'}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, isAvailable: e.target.value === 'available' }))}
                  className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
                >
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-warmGray mb-1">Reason (Optional)</label>
                <select
                  value={newOverride.reason}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, reason: e.target.value }))}
                  className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
                >
                  <option value="">Select reason...</option>
                  <option value="vacation">Vacation</option>
                  <option value="sick">Sick Leave</option>
                  <option value="personal">Personal</option>
                  <option value="holiday">Holiday</option>
                  <option value="special_event">Special Event</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-nilin-warmGray mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={newOverride.notes}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowOverrideForm(false)}
                className="glass-btn px-4 py-2 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOverride}
                disabled={!newOverride.date || isSubmitting}
                className={cn(
                  "btn-3d flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl font-medium transition-all",
                  (!newOverride.date || isSubmitting)
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:shadow-nilin-warm"
                )}
              >
                {isSubmitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Add Override
              </button>
            </div>
          </div>
        )}

        {/* Current Overrides */}
        {providerAvailability?.dateOverrides && providerAvailability.dateOverrides.length > 0 ? (
          <div className="space-y-3">
            {providerAvailability.dateOverrides
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((override, index) => (
                <div key={index} className="flex items-center justify-between p-3 neu-light rounded-xl">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-nilin-rose" />
                    <div>
                      <p className="font-medium text-nilin-charcoal">
                        {new Date(override.date + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium glass",
                          override.isAvailable
                            ? "bg-nilin-success/10 text-nilin-success"
                            : "bg-nilin-error/10 text-nilin-error"
                        )}>
                          {override.isAvailable ? 'Available' : 'Unavailable'}
                        </span>
                        {override.reason && (
                          <span className="text-sm text-nilin-warmGray capitalize">
                            {override.reason.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      {override.notes && (
                        <p className="text-sm text-nilin-warmGray mt-1">{override.notes}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveOverride(override.date)}
                    disabled={isSubmitting}
                    className="glass-btn p-2 text-nilin-error hover:bg-nilin-error/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <div className="glass text-center py-8 rounded-xl">
            <Calendar className="h-12 w-12 mx-auto mb-2 text-nilin-rose/50" />
            <p>No special dates set</p>
            <p className="text-sm text-nilin-warmGray">Add vacation days, holidays, or special availability</p>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="glass glass-blur rounded-xl p-6 gradient-3d card-3d">
        <h3 className="text-lg font-semibold text-nilin-charcoal mb-4 font-serif">Availability Settings</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-nilin-warmGray mb-1">
                Buffer Time (minutes)
              </label>
              <p className="text-sm text-nilin-lightGray mb-2">
                Time between bookings for preparation
              </p>
              <input
                type="number"
                value={settings.bufferTime}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setSettings(prev => ({ ...prev, bufferTime: Math.max(0, Math.min(120, value)) }));
                  setHasSettingsChanges(true);
                }}
                min="0"
                max="120"
                className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-warmGray mb-1">
                Max Advance Booking (days)
              </label>
              <p className="text-sm text-nilin-lightGray mb-2">
                How far in advance customers can book
              </p>
              <input
                type="number"
                value={settings.maxAdvanceBookingDays}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 1;
                  setSettings(prev => ({ ...prev, maxAdvanceBookingDays: Math.max(1, Math.min(365, value)) }));
                  setHasSettingsChanges(true);
                }}
                min="1"
                max="365"
                className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-nilin-warmGray mb-1">
                Minimum Notice Time (hours)
              </label>
              <p className="text-sm text-nilin-lightGray mb-2">
                Hours before booking that customer must book
              </p>
              <input
                type="number"
                value={settings.minNoticeTime}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  setSettings(prev => ({ ...prev, minNoticeTime: Math.max(0, Math.min(168, value)) }));
                  setHasSettingsChanges(true);
                }}
                min="0"
                max="168"
                className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-nilin-warmGray mb-1">
                Timezone
              </label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
                <select
                  value={settings.timezone}
                  onChange={(e) => {
                    setSettings(prev => ({ ...prev, timezone: e.target.value }));
                    setHasSettingsChanges(true);
                  }}
                  className="glass-input w-full pl-10 pr-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans appearance-none"
                >
                  {COMMON_TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.autoAcceptBookings}
                onChange={(e) => {
                  setSettings(prev => ({ ...prev, autoAcceptBookings: e.target.checked }));
                  setHasSettingsChanges(true);
                }}
                className="h-4 w-4 text-nilin-coral border-nilin-border rounded focus:ring-nilin-rose/50"
              />
              <span className="ml-2 text-sm text-nilin-charcoal">
                Auto-accept bookings (no manual approval required)
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityManager;
