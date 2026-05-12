import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Minus,
  Save,
  X,
  AlertCircle,
  Check,
  Edit,
  Trash2
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

const AvailabilityManager: React.FC<AvailabilityManagerProps> = ({ className }) => {
  const {
    providerAvailability,
    getProviderAvailability,
    updateWeeklySchedule,
    addDateOverride,
    removeDateOverride,
    isLoading,
    isSubmitting,
    errors
  } = useBookingStore();

  const [weeklySchedule, setWeeklySchedule] = useState<ProviderAvailability['weeklySchedule']>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [newOverride, setNewOverride] = useState({
    date: '',
    isAvailable: true,
    reason: '',
    notes: ''
  });
  const [showOverrideForm, setShowOverrideForm] = useState(false);

  // Load availability on component mount
  useEffect(() => {
    getProviderAvailability();
  }, [getProviderAvailability]);

  // Update local state when provider availability changes
  useEffect(() => {
    if (providerAvailability?.weeklySchedule) {
      setWeeklySchedule(providerAvailability.weeklySchedule);
      setHasChanges(false);
    }
  }, [providerAvailability]);

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
    setHasChanges(true);
  };

  const addTimeSlot = (day: string) => {
    const daySchedule = schedule[day] || { isAvailable: false, timeSlots: [] };
    const lastSlot = daySchedule.timeSlots[daySchedule.timeSlots.length - 1];
    const newStart = lastSlot ? addHour(lastSlot.end) : '09:00';
    const newEnd = addHour(newStart);

    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...daySchedule,
        timeSlots: [
          ...daySchedule.timeSlots,
          { start: newStart, end: newEnd, isActive: true }
        ]
      }
    }));
    setHasChanges(true);
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
    setHasChanges(true);
  };

  const updateTimeSlot = (day: string, index: number, field: 'start' | 'end', value: string) => {
    const daySchedule = schedule[day];
    if (!daySchedule) return;

    const updatedSlots = [...daySchedule.timeSlots];
    updatedSlots[index] = {
      ...updatedSlots[index],
      [field]: value
    };

    setWeeklySchedule(prev => ({
      ...prev,
      [day]: {
        ...daySchedule,
        timeSlots: updatedSlots
      }
    }));
    setHasChanges(true);
  };

  const addHour = (time: string): string => {
    const [hour, minute] = time.split(':').map(Number);
    const newHour = (hour + 1) % 24;
    return `${newHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  const handleSaveSchedule = async () => {
    try {
      await updateWeeklySchedule(weeklySchedule);
      setHasChanges(false);
    } catch (error) {
      console.error('Failed to save schedule:', error);
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
    } catch (error) {
      console.error('Failed to add override:', error);
    }
  };

  const handleRemoveOverride = async (date: string) => {
    try {
      await removeDateOverride(date);
    } catch (error) {
      console.error('Failed to remove override:', error);
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
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-nilin-charcoal font-serif">Availability Management</h2>
          <p className="text-nilin-warmGray">Set your weekly schedule and manage special dates</p>
        </div>

        {hasChanges && (
          <button
            onClick={handleSaveSchedule}
            disabled={isSubmitting}
            className={cn(
              "btn-3d flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white rounded-xl font-medium transition-all shadow-nilin-warm",
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
            Save Changes
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

      {/* Weekly Schedule */}
      <div className="glass glass-blur rounded-xl p-6 gradient-3d card-3d">
        <h3 className="text-lg font-semibold text-nilin-charcoal mb-4 font-serif">Weekly Schedule</h3>

        <div className="space-y-4">
          {DAYS_OF_WEEK.map(day => {
            const daySchedule = schedule[day] || { isAvailable: false, timeSlots: [] };

            return (
              <div key={day} className="glass p-4 rounded-xl border border-nilin-border/30 card-3d transition-all hover:border-glow">
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

                {daySchedule.isAvailable && (
                  <div className="space-y-2">
                    {daySchedule.timeSlots.map((slot, index) => (
                      <div key={index} className="flex items-center gap-3 neu-light p-3 rounded-xl">
                        <Clock className="h-4 w-4 text-nilin-rose" />

                        <input
                          type="time"
                          value={typeof slot.start === 'string' ? slot.start : ''}
                          onChange={(e) => updateTimeSlot(day, index, 'start', e.target.value)}
                          className="glass-input px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
                        />

                        <span className="text-nilin-warmGray">to</span>

                        <input
                          type="time"
                          value={typeof slot.end === 'string' ? slot.end : ''}
                          onChange={(e) => updateTimeSlot(day, index, 'end', e.target.value)}
                          className="glass-input px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans"
                        />

                        {daySchedule.timeSlots.length > 1 && (
                          <button
                            onClick={() => removeTimeSlot(day, index)}
                            className="glass-btn p-1 text-nilin-error hover:bg-nilin-error/10 rounded-lg transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}

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
                        {new Date(override.date).toLocaleDateString('en-US', {
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
                value={providerAvailability?.bufferTime || 15}
                min="0"
                max="120"
                className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans bg-nilin-muted/50"
                readOnly
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
                value={providerAvailability?.maxAdvanceBookingDays || 30}
                min="1"
                max="365"
                className="glass-input w-full px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-rose/30 font-sans bg-nilin-muted/50"
                readOnly
              />
            </div>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={providerAvailability?.autoAcceptBookings || false}
                className="h-4 w-4 text-nilin-coral border-nilin-border rounded focus:ring-nilin-rose/50"
                readOnly
              />
              <span className="ml-2 text-sm text-nilin-charcoal">
                Auto-accept bookings (no manual approval required)
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-nilin-warmGray mb-1">
              Timezone
            </label>
            <p className="text-sm text-nilin-charcoal neu-light p-2 rounded-lg inline-block">
              {providerAvailability?.timezone || 'Asia/Kolkata'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityManager;
