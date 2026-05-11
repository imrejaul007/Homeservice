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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Availability Management</h2>
          <p className="text-gray-600">Set your weekly schedule and manage special dates</p>
        </div>

        {hasChanges && (
          <button
            onClick={handleSaveSchedule}
            disabled={isSubmitting}
            className={cn(
              "flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium transition-colors",
              isSubmitting
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-blue-600"
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="text-sm text-red-700 mt-1">
                {errors.map((error, index) => (
                  <p key={index}>{error.message}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weekly Schedule */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Schedule</h3>

        <div className="space-y-4">
          {DAYS_OF_WEEK.map(day => {
            const daySchedule = schedule[day] || { isAvailable: false, timeSlots: [] };

            return (
              <div key={day} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={daySchedule.isAvailable}
                        onChange={(e) => updateDayAvailability(day, e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2 font-medium text-gray-900">
                        {DAY_LABELS[day as keyof typeof DAY_LABELS]}
                      </span>
                    </label>
                  </div>

                  {daySchedule.isAvailable && (
                    <button
                      onClick={() => addTimeSlot(day)}
                      className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add Time Slot
                    </button>
                  )}
                </div>

                {daySchedule.isAvailable && (
                  <div className="space-y-2">
                    {daySchedule.timeSlots.map((slot, index) => (
                      <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded">
                        <Clock className="h-4 w-4 text-gray-400" />

                        <input
                          type="time"
                          value={typeof slot.start === 'string' ? slot.start : ''}
                          onChange={(e) => updateTimeSlot(day, index, 'start', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        <span className="text-gray-500">to</span>

                        <input
                          type="time"
                          value={typeof slot.end === 'string' ? slot.end : ''}
                          onChange={(e) => updateTimeSlot(day, index, 'end', e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />

                        {daySchedule.timeSlots.length > 1 && (
                          <button
                            onClick={() => removeTimeSlot(day, index)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}

                    {daySchedule.timeSlots.length === 0 && (
                      <p className="text-sm text-gray-500 italic">
                        No time slots set. Click "Add Time Slot" to add availability.
                      </p>
                    )}
                  </div>
                )}

                {!daySchedule.isAvailable && (
                  <p className="text-sm text-gray-500 italic">Not available on this day</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Date Overrides */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Special Dates</h3>
          <button
            onClick={() => setShowOverrideForm(!showOverrideForm)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Special Date
          </button>
        </div>

        {/* Add Override Form */}
        {showOverrideForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Add Special Date Override</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={newOverride.date}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={newOverride.isAvailable ? 'available' : 'unavailable'}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, isAvailable: e.target.value === 'available' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="available">Available</option>
                  <option value="unavailable">Unavailable</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (Optional)</label>
                <select
                  value={newOverride.reason}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={newOverride.notes}
                  onChange={(e) => setNewOverride(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowOverrideForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddOverride}
                disabled={!newOverride.date || isSubmitting}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-medium transition-colors",
                  (!newOverride.date || isSubmitting)
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-blue-600"
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
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {new Date(override.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          override.isAvailable
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        )}>
                          {override.isAvailable ? 'Available' : 'Unavailable'}
                        </span>
                        {override.reason && (
                          <span className="text-sm text-gray-600 capitalize">
                            {override.reason.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      {override.notes && (
                        <p className="text-sm text-gray-600 mt-1">{override.notes}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveOverride(override.date)}
                    disabled={isSubmitting}
                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="h-12 w-12 mx-auto mb-2 text-gray-300" />
            <p>No special dates set</p>
            <p className="text-sm">Add vacation days, holidays, or special availability</p>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Availability Settings</h3>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Buffer Time (minutes)
              </label>
              <p className="text-sm text-gray-500 mb-2">
                Time between bookings for preparation
              </p>
              <input
                type="number"
                value={providerAvailability?.bufferTime || 15}
                min="0"
                max="120"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Advance Booking (days)
              </label>
              <p className="text-sm text-gray-500 mb-2">
                How far in advance customers can book
              </p>
              <input
                type="number"
                value={providerAvailability?.maxAdvanceBookingDays || 30}
                min="1"
                max="365"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                readOnly
              />
            </div>
          </div>

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={providerAvailability?.autoAcceptBookings || false}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                readOnly
              />
              <span className="ml-2 text-sm text-gray-700">
                Auto-accept bookings (no manual approval required)
              </span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <p className="text-sm text-gray-500">
              {providerAvailability?.timezone || 'Asia/Kolkata'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AvailabilityManager;