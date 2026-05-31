import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// Type Definitions
// ============================================

export interface TimeSlot {
  id: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  isBooked?: boolean;
}

export interface DayAvailability {
  date: string;
  dayOfWeek: string;
  isAvailable: boolean;
  slots: TimeSlot[];
}

export interface ProviderAvailabilityData {
  providerId: string;
  weeklySchedule: DayAvailability[];
  timezone: string;
  advanceBookingHours: number;
  maxAdvanceDays: number;
}

interface ProviderAvailabilityWidgetProps {
  providerId: string;
  serviceId?: string;
  onSlotSelect?: (slot: TimeSlot, date: string) => void;
  selectedDate?: string;
  selectedSlot?: string;
  compact?: boolean;
  showCalendar?: boolean;
  className?: string;
}

// ============================================
// Mock Data Generator
// ============================================

const generateMockSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const startHour = 9;
  const endHour = 18;
  const slotDuration = 60; // minutes

  for (let hour = startHour; hour < endHour; hour++) {
    const isBooked = Math.random() > 0.7;
    slots.push({
      id: `slot-${hour}`,
      startTime: `${hour.toString().padStart(2, '0')}:00`,
      endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
      isAvailable: !isBooked,
      isBooked,
    });
  }

  return slots;
};

const generateWeeklySchedule = (): DayAvailability[] => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const today = new Date();

  return days.map((day, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);

    const isWeekend = index === 0 || index === 6;
    const isPast = date < today;

    return {
      date: date.toISOString().split('T')[0],
      dayOfWeek: day,
      isAvailable: !isWeekend && !isPast,
      slots: !isWeekend && !isPast ? generateMockSlots() : [],
    };
  });
};

// ============================================
// Component
// ============================================

const ProviderAvailabilityWidget: React.FC<ProviderAvailabilityWidgetProps> = ({
  providerId,
  serviceId,
  onSlotSelect,
  selectedDate,
  selectedSlot,
  compact = false,
  showCalendar = true,
  className,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [availability, setAvailability] = useState<ProviderAvailabilityData | null>(null);
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  // Fetch availability data
  useEffect(() => {
    const fetchAvailability = async () => {
      setIsLoading(true);
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));

        // Generate mock data
        const mockData: ProviderAvailabilityData = {
          providerId,
          weeklySchedule: generateWeeklySchedule(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          advanceBookingHours: 2,
          maxAdvanceDays: 30,
        };

        setAvailability(mockData);
      } catch (error) {
        console.error('Failed to fetch availability:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailability();
  }, [providerId, currentWeekOffset]);

  // Handle slot selection
  const handleSlotClick = useCallback((slot: TimeSlot, date: string) => {
    if (!slot.isAvailable) return;
    onSlotSelect?.(slot, date);
  }, [onSlotSelect]);

  // Navigate weeks
  const goToPreviousWeek = () => {
    if (currentWeekOffset > 0) {
      setCurrentWeekOffset(prev => prev - 1);
    }
  };

  const goToNextWeek = () => {
    const maxOffset = availability?.maxAdvanceDays ? Math.floor(availability.maxAdvanceDays / 7) : 4;
    if (currentWeekOffset < maxOffset) {
      setCurrentWeekOffset(prev => prev + 1);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-nilin-coral" />
      </div>
    );
  }

  if (!availability) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <AlertCircle className="h-8 w-8 text-nilin-error mb-2" />
        <p className="text-nilin-warmGray">Unable to load availability</p>
      </div>
    );
  }

  const hasAvailability = availability.weeklySchedule.some(day => day.isAvailable);

  if (!hasAvailability && !compact) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <Calendar className="h-8 w-8 text-nilin-warmGray mb-2" />
        <p className="text-nilin-charcoal font-medium">No availability this week</p>
        <p className="text-sm text-nilin-warmGray mt-1">Check back next week</p>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl', className)}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between p-4 border-b border-nilin-border">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-nilin-coral" />
            <h3 className="font-medium text-nilin-charcoal">Select Date & Time</h3>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={goToPreviousWeek}
              disabled={currentWeekOffset === 0}
              className={cn(
                'p-2 rounded-lg transition-colors',
                currentWeekOffset === 0
                  ? 'text-nilin-warmGray cursor-not-allowed'
                  : 'hover:bg-nilin-blush/50 text-nilin-charcoal'
              )}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToNextWeek}
              disabled={currentWeekOffset >= 4}
              className={cn(
                'p-2 rounded-lg transition-colors',
                currentWeekOffset >= 4
                  ? 'text-nilin-warmGray cursor-not-allowed'
                  : 'hover:bg-nilin-blush/50 text-nilin-charcoal'
              )}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {showCalendar && !compact && (
        <div className="grid grid-cols-7 gap-1 p-4 bg-nilin-blush/30">
          {availability.weeklySchedule.map((day, index) => {
            const isSelected = selectedDate === day.date;
            const isToday = index === 0;

            return (
              <div
                key={day.date}
                className={cn(
                  'flex flex-col items-center p-2 rounded-xl transition-all cursor-pointer',
                  day.isAvailable
                    ? 'hover:bg-white hover:shadow-sm'
                    : 'opacity-50 cursor-not-allowed'
                )}
              >
                <span className={cn(
                  'text-xs font-medium',
                  day.isAvailable ? 'text-nilin-warmGray' : 'text-nilin-warmGray/50'
                )}>
                  {day.dayOfWeek.slice(0, 3)}
                </span>
                <span className={cn(
                  'text-lg font-semibold mt-1',
                  day.isAvailable ? 'text-nilin-charcoal' : 'text-nilin-warmGray/50'
                )}>
                  {new Date(day.date).getDate()}
                </span>
                {isToday && !isSelected && (
                  <div className="w-1.5 h-1.5 rounded-full bg-nilin-coral mt-1" />
                )}
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-nilin-coral mt-1 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Time Slots */}
      {selectedDate && (
        <div className="p-4 border-t border-nilin-border">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-nilin-coral" />
            <span className="text-sm font-medium text-nilin-charcoal">
              Available Times
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {availability.weeklySchedule
              .find(d => d.date === selectedDate)
              ?.slots.filter(slot => slot.isAvailable)
              .map(slot => {
                const isSelected = selectedSlot === slot.id;
                const isHovered = hoveredSlot === slot.id;

                return (
                  <button
                    key={slot.id}
                    onClick={() => handleSlotClick(slot, selectedDate)}
                    onMouseEnter={() => setHoveredSlot(slot.id)}
                    onMouseLeave={() => setHoveredSlot(null)}
                    disabled={!slot.isAvailable}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      isSelected
                        ? 'bg-nilin-coral text-white shadow-md'
                        : isHovered && slot.isAvailable
                        ? 'bg-nilin-coral/10 text-nilin-coral border border-nilin-coral/30'
                        : slot.isAvailable
                        ? 'bg-white border border-nilin-border text-nilin-charcoal hover:border-nilin-coral/50'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    )}
                  >
                    {slot.startTime}
                  </button>
                );
              })}
          </div>

          {availability.weeklySchedule.find(d => d.date === selectedDate)?.slots.filter(s => s.isAvailable).length === 0 && (
            <div className="text-center py-4 text-nilin-warmGray">
              <p>No available slots for this date</p>
            </div>
          )}
        </div>
      )}

      {/* Compact View - Just Next Available */}
      {compact && (
        <div className="p-4">
          {availability.weeklySchedule
            .filter(d => d.isAvailable)
            .flatMap(d => d.slots.filter(s => s.isAvailable))
            .slice(0, 3)
            .map((slot, index) => (
              <button
                key={`${slot.id}-${index}`}
                onClick={() => onSlotSelect?.(slot, availability.weeklySchedule.find(d => d.slots.includes(slot))?.date || '')}
                className="w-full flex items-center justify-between p-3 bg-nilin-blush/30 rounded-xl mb-2 hover:bg-nilin-blush/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-nilin-coral" />
                  <span className="text-sm font-medium text-nilin-charcoal">
                    {slot.startTime} - {slot.endTime}
                  </span>
                </div>
                <span className="text-xs text-nilin-warmGray">
                  {availability.weeklySchedule.find(d => d.slots.includes(slot))?.dayOfWeek.slice(0, 3)}
                </span>
              </button>
            ))}
        </div>
      )}

      {/* Legend */}
      {!compact && (
        <div className="flex items-center justify-center gap-4 p-3 border-t border-nilin-border text-xs text-nilin-warmGray">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-white border border-nilin-border" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-nilin-coral" />
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-gray-100" />
            <span>Unavailable</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderAvailabilityWidget;
