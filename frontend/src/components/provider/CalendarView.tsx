/**
 * CalendarView - Full calendar integration for bookings
 * Provider Dashboard Component
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  MapPin,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  Plus,
  ExternalLink,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { bookingService } from '../../services/BookingService';

// =============================================================================
// Type Definitions
// =============================================================================

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export interface CalendarBooking {
  /** Unique booking ID */
  id: string;
  /** Customer name */
  customerName: string;
  /** Customer avatar */
  customerAvatar?: string;
  /** Customer phone */
  customerPhone?: string;
  /** Service name */
  serviceName: string;
  /** Service category */
  category: string;
  /** Start time */
  startTime: string;
  /** End time */
  endTime: string;
  /** Booking status */
  status: BookingStatus;
  /** Service price */
  price: number;
  /** Currency */
  currency?: string;
  /** Location */
  location?: string;
  /** Customer notes */
  notes?: string;
  /** Is instant booking */
  isInstantBook?: boolean;
}

export interface CalendarEvent {
  /** Event ID */
  id: string;
  /** Event title */
  title: string;
  /** Start time */
  start: Date;
  /** End time */
  end: Date;
  /** Event type */
  type: 'booking' | 'blocked' | 'personal';
  /** Color */
  color?: string;
  /** Booking data (if type is booking) */
  booking?: CalendarBooking;
}

export interface CalendarViewProps {
  /** Bookings to display */
  bookings: CalendarBooking[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when booking is clicked */
  onBookingClick?: (booking: CalendarBooking) => void;
  /** Callback when accepting booking */
  onAcceptBooking?: (bookingId: string) => Promise<void>;
  /** Callback when declining booking */
  onDeclineBooking?: (bookingId: string) => Promise<void>;
  /** Callback when date is selected */
  onDateSelect?: (date: Date) => void;
  /** Initial view date */
  initialDate?: Date;
  /** Custom blocked times */
  blockedTimes?: Array<{ start: Date; end: Date; reason?: string }>;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatPrice(price: number, currency = 'AED'): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(price);
}

// =============================================================================
// Status Configurations
// =============================================================================

const statusConfig: Record<BookingStatus, { color: string; bgColor: string; icon: React.ElementType }> = {
  pending: { color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-200', icon: AlertCircle },
  confirmed: { color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', icon: CheckCircle },
  in_progress: { color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200', icon: Clock },
  completed: { color: 'text-green-600', bgColor: 'bg-green-50 border-green-200', icon: CheckCircle },
  cancelled: { color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', icon: XCircle },
};

// =============================================================================
// Calendar Header Component
// =============================================================================

interface CalendarHeaderProps {
  currentDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onDateSelect: (date: Date) => void;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  onDateSelect,
}) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onPrevMonth}
          className="p-2 hover:bg-nilin-muted rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-nilin-charcoal" />
        </button>
        <h2 className="text-lg font-semibold text-nilin-charcoal min-w-[200px] text-center">
          {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
        </h2>
        <button
          onClick={onNextMonth}
          className="p-2 hover:bg-nilin-muted rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-nilin-charcoal" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onToday}
          className="px-3 py-1.5 text-sm font-medium text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
        >
          Today
        </button>
        <button
          onClick={() => onDateSelect(new Date())}
          className="p-2 hover:bg-nilin-muted rounded-lg transition-colors"
          title="Add booking"
        >
          <Plus className="w-5 h-5 text-nilin-coral" />
        </button>
      </div>
    </div>
  );
};

// =============================================================================
// Calendar Grid Component
// =============================================================================

interface CalendarGridProps {
  currentDate: Date;
  selectedDate: Date | null;
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
  onDateSelect: (date: Date) => void;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentDate,
  selectedDate,
  events,
  onDateClick,
  onDateSelect,
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);

  const days: (Date | null)[] = [];
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  // Add days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  return (
    <>
      {/* Day Headers */}
      <div className="grid grid-cols-7 mb-2">
        {DAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-nilin-warmGray py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-20" />;
          }

          const isToday = isSameDay(date, new Date());
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isCurrentMonth = date.getMonth() === month;
          const dayEvents = events.filter((e) => isSameDay(e.start, date));

          return (
            <div
              key={date.toISOString()}
              onClick={() => onDateClick(date)}
              onDoubleClick={() => onDateSelect(date)}
              className={cn(
                'h-20 rounded-lg border p-1 cursor-pointer transition-all',
                isCurrentMonth ? 'bg-white' : 'bg-nilin-muted/50',
                isSelected
                  ? 'border-nilin-coral ring-2 ring-nilin-coral/20'
                  : 'border-nilin-border hover:border-nilin-coral/50',
                isToday && !isSelected && 'bg-nilin-blush'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full',
                    isToday && 'bg-nilin-coral text-white',
                    !isToday && isCurrentMonth && 'text-nilin-charcoal',
                    !isToday && !isCurrentMonth && 'text-nilin-lightGray'
                  )}
                >
                  {date.getDate()}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[10px] text-nilin-warmGray">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              {/* Event Indicators */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, 2).map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      'text-[10px] px-1 py-0.5 rounded truncate',
                      event.type === 'booking'
                        ? event.booking?.status === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : event.booking?.status === 'confirmed'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    )}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[10px] text-nilin-warmGray px-1">
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

// =============================================================================
// Day View Component
// =============================================================================

interface DayViewProps {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onAcceptBooking?: (bookingId: string) => Promise<void>;
  onDeclineBooking?: (bookingId: string) => Promise<void>;
}

const DayView: React.FC<DayViewProps> = ({
  date,
  events,
  onEventClick,
  onAcceptBooking,
  onDeclineBooking,
}) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Generate time slots for the day
  const timeSlots = hours.map((hour) => {
    const slotDate = new Date(date);
    slotDate.setHours(hour, 0, 0, 0);
    const slotEvents = events.filter(
      (e) =>
        e.start.getHours() === hour ||
        (e.start.getHours() < hour && e.end.getHours() >= hour)
    );
    return { hour, events: slotEvents };
  });

  return (
    <div className="border border-nilin-border rounded-xl overflow-hidden">
      {/* Day Header */}
      <div className="bg-nilin-muted px-4 py-3 border-b border-nilin-border">
        <p className="text-sm font-medium text-nilin-charcoal">
          {DAYS[date.getDay()]}, {MONTHS[date.getMonth()]} {date.getDate()}
        </p>
        <p className="text-xs text-nilin-warmGray">
          {events.length} event{events.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Time Slots */}
      <div className="max-h-[400px] overflow-y-auto">
        {timeSlots.map(({ hour, events: slotEvents }) => (
          <div
            key={hour}
            className="flex border-b border-nilin-border last:border-b-0"
          >
            {/* Time Label */}
            <div className="w-16 flex-shrink-0 px-2 py-3 border-r border-nilin-border">
              <span className="text-xs text-nilin-warmGray">
                {hour === 0
                  ? '12 AM'
                  : hour < 12
                  ? `${hour} AM`
                  : hour === 12
                  ? '12 PM'
                  : `${hour - 12} PM`}
              </span>
            </div>

            {/* Events */}
            <div className="flex-1 p-2 min-h-[60px]">
              {slotEvents.map((event) => (
                <div
                  key={event.id}
                  onClick={() => onEventClick(event)}
                  className={cn(
                    'p-2 rounded-lg border cursor-pointer hover:shadow-md transition-shadow mb-1',
                    event.type === 'booking'
                      ? event.booking?.status === 'pending'
                        ? 'bg-amber-50 border-amber-200'
                        : event.booking?.status === 'confirmed'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-green-50 border-green-200'
                      : 'bg-gray-100 border-gray-200'
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-nilin-charcoal truncate">
                      {event.title}
                    </p>
                    {event.type === 'booking' && event.booking && (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                          statusConfig[event.booking.status].bgColor,
                          statusConfig[event.booking.status].color
                        )}
                      >
                        {event.booking.status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-nilin-warmGray">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(event.start)} - {formatTime(event.end)}
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {formatPrice(event.booking?.price || 0, event.booking?.currency)}
                    </span>
                  </div>

                  {/* Quick Actions for Pending */}
                  {event.type === 'booking' &&
                    event.booking?.status === 'pending' &&
                    onAcceptBooking &&
                    onDeclineBooking && (
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAcceptBooking(event.booking!.id);
                          }}
                          className="flex-1 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeclineBooking(event.booking!.id);
                          }}
                          className="flex-1 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// API Helper Functions
// =============================================================================

// Helper to map API booking to CalendarBooking format
const mapApiBookingToCalendarBooking = (booking: any): CalendarBooking => {
  return {
    id: booking._id,
    customerName: booking.customer
      ? `${booking.customer.firstName || ''} ${booking.customer.lastName || ''}`.trim()
      : 'Customer',
    customerAvatar: booking.customer?.avatar,
    customerPhone: booking.customer?.phone,
    serviceName: booking.service?.name || 'Service',
    category: booking.service?.category || '',
    startTime: `${booking.scheduledDate}T${booking.scheduledTime}`,
    endTime: calculateEndTime(booking.scheduledDate, booking.scheduledTime, booking.estimatedDuration || 60),
    status: booking.status as BookingStatus,
    price: booking.pricing?.totalAmount || booking.pricing?.total || 0,
    currency: booking.pricing?.currency || 'AED',
    location: booking.location?.address?.street || '',
    notes: booking.customerInfo?.specialRequests,
    isInstantBook: booking.isInstantBook,
  };
};

// Calculate end time based on start time and duration
const calculateEndTime = (date: string, time: string, durationMinutes: number): string => {
  const start = new Date(`${date}T${time}`);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  return end.toISOString();
};

// =============================================================================
// Main Component
// =============================================================================

export const CalendarView: React.FC<CalendarViewProps> = ({
  bookings: bookingsProp,
  isLoading: isLoadingProp = false,
  onBookingClick,
  onAcceptBooking,
  onDeclineBooking,
  onDateSelect,
  initialDate = new Date(),
  blockedTimes = [],
  className,
}) => {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'month' | 'day'>('month');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  const [bookings, setBookings] = useState<CalendarBooking[]>(bookingsProp || []);
  const [isLoading, setIsLoading] = useState(isLoadingProp);
  const [error, setError] = useState<string | null>(null);

  // Fetch bookings from API if not provided via props
  useEffect(() => {
    if (bookingsProp && bookingsProp.length > 0) {
      setBookings(bookingsProp);
      setIsLoading(false);
    } else if (!bookingsProp) {
      const fetchBookings = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const response = await bookingService.getProviderBookings({
            dateFrom: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString(),
            dateTo: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString(),
            limit: 100,
          });

          if (response.success && response.data?.bookings) {
            const mappedBookings = response.data.bookings.map(mapApiBookingToCalendarBooking);
            setBookings(mappedBookings);
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load bookings';
          setError(errorMessage);
          console.error('Error fetching provider bookings:', err);
        } finally {
          setIsLoading(false);
        }
      };

      fetchBookings();
    }
  }, [bookingsProp, currentDate]);

  // Fetch availability for blocked times
  const fetchBlockedTimes = useCallback(async () => {
    try {
      const response = await bookingService.getAvailabilityBlocking();
      if (response.success && response.data?.blockedPeriods) {
        // These would need to be mapped to the blockedTimes format
        // For now, the component accepts blockedTimes as props
      }
    } catch (err) {
      console.error('Error fetching blocked times:', err);
    }
  }, []);

  useEffect(() => {
    fetchBlockedTimes();
  }, [fetchBlockedTimes]);

  // Convert bookings to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    const bookingEvents: CalendarEvent[] = bookings
      .filter((b) => statusFilter === 'all' || b.status === statusFilter)
      .map((booking) => ({
        id: booking.id,
        title: booking.serviceName,
        start: new Date(booking.startTime),
        end: new Date(booking.endTime),
        type: 'booking',
        booking,
      }));

    const blockedEvents: CalendarEvent[] = blockedTimes.map((blocked, index) => ({
      id: `blocked-${index}`,
      title: blocked.reason || 'Blocked',
      start: blocked.start,
      end: blocked.end,
      type: 'blocked' as const,
    }));

    return [...bookingEvents, ...blockedEvents];
  }, [bookings, blockedTimes, statusFilter]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    if (isSameDay(date, selectedDate || new Date(0))) {
      setView('day');
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setView('day');
    onDateSelect?.(date);
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.type === 'booking' && event.booking) {
      onBookingClick?.(event.booking);
    }
  };

  // Get events for selected date
  const selectedDateEvents = selectedDate
    ? events.filter((e) => isSameDay(e.start, selectedDate))
    : [];

  if (isLoading && bookings.length === 0) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-nilin-muted rounded mb-6" />
          <div className="h-[400px] bg-nilin-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Booking Calendar
            </h3>
            <p className="text-sm text-nilin-warmGray">
              {events.filter((e) => e.type === 'booking').length} bookings
            </p>
          </div>
        </div>

        {/* View Toggle & Filters */}
        <div className="flex items-center gap-3">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="text-sm border border-nilin-border rounded-lg px-3 py-1.5 text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* View Toggle */}
          <div className="flex items-center bg-nilin-muted rounded-lg p-1">
            <button
              onClick={() => setView('month')}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                view === 'month'
                  ? 'bg-white text-nilin-charcoal shadow-sm'
                  : 'text-nilin-warmGray hover:text-nilin-charcoal'
              )}
            >
              Month
            </button>
            <button
              onClick={() => setView('day')}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                view === 'day'
                  ? 'bg-white text-nilin-charcoal shadow-sm'
                  : 'text-nilin-warmGray hover:text-nilin-charcoal'
              )}
            >
              Day
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <AnimatePresence mode="wait">
        {view === 'month' ? (
          <motion.div
            key="month"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <CalendarHeader
              currentDate={currentDate}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              onToday={handleToday}
              onDateSelect={handleDateSelect}
            />
            <CalendarGrid
              currentDate={currentDate}
              selectedDate={selectedDate}
              events={events}
              onDateClick={handleDateClick}
              onDateSelect={handleDateSelect}
            />
          </motion.div>
        ) : selectedDate ? (
          <motion.div
            key="day"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <DayView
              date={selectedDate}
              events={selectedDateEvents}
              onEventClick={handleEventClick}
              onAcceptBooking={onAcceptBooking}
              onDeclineBooking={onDeclineBooking}
            />
          </motion.div>
        ) : (
          <div className="text-center py-12">
            <CalendarIcon className="w-12 h-12 text-nilin-lightGray mx-auto mb-4" />
            <p className="text-nilin-warmGray">
              Select a date to view bookings
            </p>
          </div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-nilin-border flex items-center gap-4 text-xs text-nilin-warmGray">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-amber-200" />
          Pending
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-200" />
          Confirmed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-200" />
          Completed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-200" />
          Blocked
        </span>
      </div>
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default CalendarView;
