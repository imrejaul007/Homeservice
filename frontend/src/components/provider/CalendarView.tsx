/**
 * CalendarView - Full calendar integration for bookings
 * Provider Dashboard Component
 */
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  Ban,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { bookingService } from '../../services/BookingService';
import { socketService } from '../../services/socket';

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
  /** Callback when date range changes (for fetching new data) */
  onDateRangeChange?: (date: Date) => void;
  /** Callback when refresh is clicked */
  onRefresh?: () => void;
  /** Initial view date */
  initialDate?: Date;
  /** Custom blocked times */
  blockedTimes?: Array<{ start: Date; end: Date; reason?: string }>;
  /** Custom className */
  className?: string;
}

// =============================================================================
// API Response Interfaces
// =============================================================================

/** API response structure for a single booking from the backend */
interface ApiCustomer {
  _id?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  phone?: string;
}

interface ApiService {
  name?: string;
  category?: string;
}

interface ApiPricing {
  totalAmount?: number;
  total?: number;
  currency?: string;
}

interface ApiLocation {
  address?: {
    street?: string;
  };
}

interface ApiCustomerInfo {
  specialRequests?: string;
}

interface ApiBookingResponse {
  _id: string;
  customer?: ApiCustomer;
  service?: ApiService;
  scheduledDate: string;
  scheduledTime: string;
  estimatedDuration?: number;
  status: string;
  pricing?: ApiPricing;
  location?: ApiLocation;
  customerInfo?: ApiCustomerInfo;
  isInstantBook?: boolean;
}

/** API response structure for blocked periods */
interface ApiBlockedPeriod {
  date: string;
  reason?: string;
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
                {dayEvents.slice(0, 2).map((event) => {
                  const statusStyle = event.type === 'booking' && event.booking
                    ? statusConfig[event.booking.status]
                    : null;
                  return (
                    <div
                      key={event.id}
                      className={cn(
                        'text-[10px] px-1 py-0.5 rounded truncate',
                        statusStyle
                          ? statusStyle.bgColor.replace('50', '100').replace('border-', '')
                          : 'bg-gray-100 text-gray-600'
                      )}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  );
                })}
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
  /** Track which booking action is currently in progress */
  pendingAction?: { bookingId: string; action: 'accept' | 'decline' } | null;
}

const DayView: React.FC<DayViewProps> = ({
  date,
  events,
  onEventClick,
  onAcceptBooking,
  onDeclineBooking,
  pendingAction = null,
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
                    event.type === 'booking' && event.booking
                      ? statusConfig[event.booking.status]?.bgColor || 'bg-gray-100 border-gray-200'
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
                          disabled={pendingAction?.bookingId === event.booking!.id}
                          className="flex-1 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                          {pendingAction?.bookingId === event.booking!.id && pendingAction.action === 'accept' ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Accepting...</span>
                            </>
                          ) : (
                            'Accept'
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeclineBooking(event.booking!.id);
                          }}
                          disabled={pendingAction?.bookingId === event.booking!.id}
                          className="flex-1 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                          {pendingAction?.bookingId === event.booking!.id && pendingAction.action === 'decline' ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>Declining...</span>
                            </>
                          ) : (
                            'Decline'
                          )}
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
// Returns null for invalid data instead of throwing to prevent calendar crashes
const mapApiBookingToCalendarBooking = (booking: ApiBookingResponse): CalendarBooking | null => {
  // Validate required fields
  if (!booking._id || !booking.scheduledDate || !booking.scheduledTime) {
    console.warn('[CalendarView] Invalid API booking response - missing required fields:', booking);
    return null;
  }

  // Validate that scheduledDate is a valid date string
  const parsedDate = new Date(booking.scheduledDate);
  if (isNaN(parsedDate.getTime())) {
    console.warn('[CalendarView] Invalid scheduledDate:', booking.scheduledDate, booking);
    return null;
  }

  // Build start time with validation
  const startTimeStr = `${booking.scheduledDate}T${booking.scheduledTime}`;
  const startDate = new Date(startTimeStr);
  if (isNaN(startDate.getTime())) {
    console.warn('[CalendarView] Invalid scheduledTime:', booking.scheduledTime, booking);
    return null;
  }

  return {
    id: booking._id,
    customerName: booking.customer
      ? `${booking.customer.firstName || ''} ${booking.customer.lastName || ''}`.trim()
      : 'Customer',
    customerAvatar: booking.customer?.avatar,
    customerPhone: booking.customer?.phone,
    serviceName: booking.service?.name || 'Service',
    category: booking.service?.category || '',
    startTime: startDate.toISOString(),
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
  try {
    // Handle different time formats (e.g., "09:00", "9:00", "09:00:00")
    const normalizedTime = time.length === 5 ? time : time.substring(0, 5);
    const start = new Date(`${date}T${normalizedTime}`);

    // Validate the date is valid
    if (isNaN(start.getTime())) {
      console.warn('[CalendarView] Invalid date/time:', date, time);
      // Return a fallback: start of the given date + duration
      const fallbackStart = new Date(date);
      if (isNaN(fallbackStart.getTime())) {
        return new Date().toISOString(); // Ultimate fallback
      }
      const fallbackEnd = new Date(fallbackStart.getTime() + durationMinutes * 60 * 1000);
      return fallbackEnd.toISOString();
    }

    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    return end.toISOString();
  } catch (err) {
    console.warn('[CalendarView] Error calculating end time:', err);
    return new Date().toISOString(); // Fallback to current time
  }
};

// =============================================================================
// Main Component
// =============================================================================

export const CalendarView: React.FC<CalendarViewProps> = ({
  bookings: bookingsProp = [],
  isLoading: isLoadingProp = false,
  onBookingClick,
  onAcceptBooking,
  onDeclineBooking,
  onDateSelect,
  onDateRangeChange,
  onRefresh,
  initialDate = new Date(),
  blockedTimes: blockedTimesProp = [],
  className,
}) => {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [view, setView] = useState<'month' | 'day'>('month');
  const [statusFilter, setStatusFilter] = useState<BookingStatus | 'all'>('all');
  // Use prop bookings if provided, otherwise use internal state (for backwards compatibility)
  const [internalBookings, setInternalBookings] = useState<CalendarBooking[]>([]);
  const [isLoading, setIsLoading] = useState(isLoadingProp);
  const [error, setError] = useState<string | null>(null);
  const [blockedTimes, setBlockedTimes] = useState<Array<{ start: Date; end: Date; reason?: string }>>(blockedTimesProp);

  // Use external bookings if provided, otherwise internal
  const bookings = bookingsProp.length > 0 ? bookingsProp : internalBookings;
  const isExternalData = bookingsProp.length > 0;

  // Track pending booking actions for optimistic UI
  const [pendingAction, setPendingAction] = useState<{ bookingId: string; action: 'accept' | 'decline' } | null>(null);

  // Track selected booking for detail modal
  const [selectedBooking, setSelectedBooking] = useState<CalendarBooking | null>(null);

  // Track confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'accept' | 'decline';
    bookingId: string;
    bookingName: string;
  } | null>(null);

  // Track mounted state to prevent memory leaks from async operations
  const isMountedRef = useRef(true);

  // Abort controller ref for cancelling in-flight requests on month change
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce ref for month navigation to prevent race conditions
  const monthChangeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch bookings from API if not provided via props
  useEffect(() => {
    // Update mounted ref
    isMountedRef.current = true;

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const fetchBookings = async () => {
      if (bookingsProp && bookingsProp.length > 0) {
        if (isMountedRef.current) {
          setInternalBookings(bookingsProp);
          setIsLoading(false);
        }
        return;
      }

      if (isMountedRef.current) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const response = await bookingService.getProviderBookings({
          startDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString(),
          endDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString(),
          limit: 100,
        });

        // Check if component is still mounted before updating state
        if (!isMountedRef.current) return;

        if (response.success && response.data?.bookings) {
          const mappedBookings = response.data.bookings
            .map((booking: ApiBookingResponse) => mapApiBookingToCalendarBooking(booking))
            .filter((b: CalendarBooking | null): b is CalendarBooking => b !== null);
          setInternalBookings(mappedBookings);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') return;

        // Check if component is still mounted before updating state
        if (!isMountedRef.current) return;

        const errorMessage = err instanceof Error ? err.message : 'Failed to load bookings';
        setError(errorMessage);
        console.error('Error fetching provider bookings:', err);
      } finally {
        // Only update loading state if still mounted
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // Debounce the fetch to prevent rapid month changes from causing race conditions
    if (monthChangeTimeoutRef.current) {
      clearTimeout(monthChangeTimeoutRef.current);
    }
    monthChangeTimeoutRef.current = setTimeout(fetchBookings, 150);

    // Cleanup: abort fetch and prevent state updates after unmount
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (monthChangeTimeoutRef.current) {
        clearTimeout(monthChangeTimeoutRef.current);
      }
    };
  }, [bookingsProp, currentDate]);

  // Fetch blocked times from API
  const fetchBlockedTimes = useCallback(async () => {
    try {
      const response = await bookingService.getAvailabilityBlocking();
      if (response.success && response.data?.blockedPeriods) {
        // Map API blocked periods to calendar format
        // The API returns { date: string, reason?: string } for each blocked day
        const mappedBlockedTimes: Array<{ start: Date; end: Date; reason?: string }> = [];
        for (const period of response.data.blockedPeriods) {
          // Validate date before parsing to prevent invalid dates
          const parsedDate = new Date(period.date);
          if (isNaN(parsedDate.getTime())) {
            console.warn('[CalendarView] Invalid blocked period date:', period.date);
            continue;
          }
          mappedBlockedTimes.push({
            start: parsedDate,
            end: new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 23, 59, 59, 999),
            reason: period.reason,
          });
        }
        setBlockedTimes(mappedBlockedTimes);
      }
    } catch (err) {
      console.error('Error fetching blocked times:', err);
    }
  }, []);

  useEffect(() => {
    fetchBlockedTimes();
  }, [fetchBlockedTimes]);

  // Sync blocked times prop changes
  useEffect(() => {
    setBlockedTimes(blockedTimesProp);
  }, [blockedTimesProp]);

  // Helper to refresh bookings (used by socket handlers)
  const fetchBookingsFromApi = useCallback(async () => {
    if (isMountedRef.current) {
      try {
        const response = await bookingService.getProviderBookings({
          startDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString(),
          endDate: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString(),
          limit: 100,
        });

        if (response.success && response.data?.bookings) {
          const mappedBookings = response.data.bookings
            .map((booking: ApiBookingResponse) => mapApiBookingToCalendarBooking(booking))
            .filter((b: CalendarBooking | null): b is CalendarBooking => b !== null);
          setInternalBookings(mappedBookings);
        }
      } catch (err) {
        console.error('Error refreshing bookings:', err);
      }
    }
  }, [currentDate]);

  // Subscribe to real-time booking updates via socket
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    // Handle new booking requests
    const unsubNewRequest = socketService.onNewBookingRequest(() => {
      // Refresh bookings when a new request arrives
      if (isMountedRef.current) {
        fetchBookingsFromApi();
      }
    });
    unsubscribers.push(unsubNewRequest);

    // Handle booking status changes (handles: accepted, rejected, completed, etc.)
    const unsubStatusChanged = socketService.onBookingStatusChanged((data) => {
      if (isMountedRef.current) {
        setInternalBookings(prev => prev.map(booking =>
          booking.id === data.bookingId
            ? { ...booking, status: data.status as BookingStatus }
            : booking
        ));
      }
    });
    unsubscribers.push(unsubStatusChanged);

    // Handle booking confirmed event
    const unsubConfirmed = socketService.on('booking:confirmed', (data) => {
      if (isMountedRef.current) {
        setInternalBookings(prev => prev.map(booking =>
          booking.id === data.bookingId
            ? { ...booking, status: 'confirmed' as BookingStatus }
            : booking
        ));
      }
    });
    unsubscribers.push(() => socketService.off('booking:confirmed', unsubConfirmed));

    // Handle booking cancelled event
    const unsubCancelled = socketService.on('booking:cancelled', (data) => {
      if (isMountedRef.current) {
        setInternalBookings(prev => prev.map(booking =>
          booking.id === data.bookingId
            ? { ...booking, status: 'cancelled' as BookingStatus }
            : booking
        ));
      }
    });
    unsubscribers.push(() => socketService.off('booking:cancelled', unsubCancelled));

    // Handle booking completed event
    const unsubCompleted = socketService.on('booking:completed', (data) => {
      if (isMountedRef.current) {
        setInternalBookings(prev => prev.map(booking =>
          booking.id === data.bookingId
            ? { ...booking, status: 'completed' as BookingStatus }
            : booking
        ));
      }
    });
    unsubscribers.push(() => socketService.off('booking:completed', unsubCompleted));

    // Handle booking started event
    const unsubStarted = socketService.on('booking:started', (data) => {
      if (isMountedRef.current) {
        setInternalBookings(prev => prev.map(booking =>
          booking.id === data.bookingId
            ? { ...booking, status: 'in_progress' as BookingStatus }
            : booking
        ));
      }
    });
    unsubscribers.push(() => socketService.off('booking:started', unsubStarted));

    // Handle booking no_show event
    const unsubNoShow = socketService.on('booking:no_show', (data) => {
      if (isMountedRef.current) {
        setInternalBookings(prev => prev.map(booking =>
          booking.id === data.bookingId
            ? { ...booking, status: 'cancelled' as BookingStatus }
            : booking
        ));
        toast.error('Customer did not show up for booking');
      }
    });
    unsubscribers.push(() => socketService.off('booking:no_show', unsubNoShow));

    // Cleanup all socket subscriptions on unmount
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [fetchBookingsFromApi]);

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
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    setCurrentDate(newDate);
    onDateRangeChange?.(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    setCurrentDate(newDate);
    onDateRangeChange?.(newDate);
  };

  const handleToday = () => {
    const newDate = new Date();
    setCurrentDate(newDate);
    setSelectedDate(newDate);
    onDateRangeChange?.(newDate);
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
      // Show booking detail modal
      setSelectedBooking(event.booking);
      onBookingClick?.(event.booking);
    }
  };

  // Optimistic UI handler for accepting a booking
  const handleAcceptBooking = async (bookingId: string, skipConfirm = false) => {
    // Find the booking to get its current state for potential rollback
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    // Show confirmation dialog if not skipped
    if (!skipConfirm) {
      setConfirmDialog({
        open: true,
        type: 'accept',
        bookingId,
        bookingName: booking.serviceName,
      });
      return;
    }

    // Set pending state to show loading UI
    setPendingAction({ bookingId, action: 'accept' });
    setConfirmDialog(null);

    // Optimistic update: immediately update UI
    if (!isExternalData) {
      setInternalBookings(prev => prev.map(b =>
        b.id === bookingId ? { ...b, status: 'confirmed' as BookingStatus } : b
      ));
    }

    try {
      // Call the parent handler if provided, otherwise call API directly
      if (onAcceptBooking) {
        await onAcceptBooking(bookingId);
      } else {
        // Direct API call fallback
        await bookingService.acceptBooking(bookingId);
      }
      toast.success('Booking accepted successfully');
    } catch (err) {
      // Revert optimistic update on failure
      if (!isExternalData) {
        setInternalBookings(prev => prev.map(b =>
          b.id === bookingId ? booking : b
        ));
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to accept booking';
      toast.error(errorMessage);
      console.error('Error accepting booking:', err);
    } finally {
      setPendingAction(null);
    }
  };

  // Optimistic UI handler for declining a booking
  const handleDeclineBooking = async (bookingId: string, skipConfirm = false) => {
    // Find the booking to get its current state for potential rollback
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    // Show confirmation dialog if not skipped
    if (!skipConfirm) {
      setConfirmDialog({
        open: true,
        type: 'decline',
        bookingId,
        bookingName: booking.serviceName,
      });
      return;
    }

    // Set pending state to show loading UI
    setPendingAction({ bookingId, action: 'decline' });
    setConfirmDialog(null);

    // Optimistic update: immediately update UI (remove from list)
    if (!isExternalData) {
      setInternalBookings(prev => prev.filter(b => b.id !== bookingId));
    }

    try {
      // Call the parent handler if provided, otherwise call API directly
      if (onDeclineBooking) {
        await onDeclineBooking(bookingId);
      } else {
        // Direct API call fallback
        await bookingService.declineBooking(bookingId);
      }
      toast.success('Booking declined');
    } catch (err) {
      // Revert optimistic update on failure
      if (!isExternalData) {
        setInternalBookings(prev => [...prev, booking]);
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to decline booking';
      toast.error(errorMessage);
      console.error('Error declining booking:', err);
    } finally {
      setPendingAction(null);
    }
  };

  // Retry fetching bookings
  const handleRetry = () => {
    setError(null);
    // Trigger a re-render with the same currentDate to refetch
    setCurrentDate(new Date(currentDate.getTime()));
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

  // Error state with retry button
  if (error && bookings.length === 0) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <p className="text-nilin-charcoal font-medium mb-2">Failed to load bookings</p>
          <p className="text-sm text-nilin-warmGray mb-6">{error}</p>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (!isLoading && bookings.length === 0) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="flex flex-col items-center justify-center py-12">
          <CalendarIcon className="w-12 h-12 text-nilin-warmGray mb-4" />
          <p className="text-nilin-charcoal font-medium mb-2">No bookings found</p>
          <p className="text-sm text-nilin-warmGray mb-6">
            There are no bookings in this time period.
          </p>
          <button
            onClick={handleToday}
            className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors"
          >
            Go to Today
          </button>
        </div>
      </div>
    );
  }

  // Confirmation Dialog
  const ConfirmDialog = () => {
    if (!confirmDialog?.open) return null;

    const isAccept = confirmDialog.type === 'accept';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center',
              isAccept ? 'bg-green-100' : 'bg-red-100'
            )}>
              {isAccept ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-nilin-charcoal">
                {isAccept ? 'Accept Booking?' : 'Decline Booking?'}
              </h3>
              <p className="text-sm text-nilin-warmGray">
                {isAccept
                  ? `Accept "${confirmDialog.bookingName}"?`
                  : `Decline "${confirmDialog.bookingName}"? This cannot be undone.`}
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setConfirmDialog(null)}
              className="px-4 py-2 text-nilin-charcoal border border-nilin-border rounded-lg hover:bg-nilin-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => isAccept
                ? handleAcceptBooking(confirmDialog.bookingId, true)
                : handleDeclineBooking(confirmDialog.bookingId, true)
              }
              className={cn(
                'px-4 py-2 text-white rounded-lg transition-colors',
                isAccept
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              )}
            >
              {isAccept ? 'Accept' : 'Decline'}
            </button>
          </div>
        </div>
      </div>
    );
  };

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
              onAcceptBooking={handleAcceptBooking}
              onDeclineBooking={handleDeclineBooking}
              pendingAction={pendingAction}
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

      {/* Booking Detail Modal */}
      <AnimatePresence>
        {selectedBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedBooking(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-nilin-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-nilin-charcoal">Booking Details</h3>
                  <button
                    onClick={() => setSelectedBooking(null)}
                    className="p-2 hover:bg-nilin-muted rounded-lg transition-colors"
                  >
                    <XCircle className="w-5 h-5 text-nilin-warmGray" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-4">
                {/* Status Badge */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'px-3 py-1 rounded-full text-sm font-medium',
                      statusConfig[selectedBooking.status].bgColor,
                      statusConfig[selectedBooking.status].color
                    )}
                  >
                    {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1).replace('_', ' ')}
                  </span>
                  {selectedBooking.isInstantBook && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                      Instant Book
                    </span>
                  )}
                </div>

                {/* Service Info */}
                <div className="bg-nilin-muted rounded-xl p-4">
                  <h4 className="font-medium text-nilin-charcoal mb-2">{selectedBooking.serviceName}</h4>
                  {selectedBooking.category && (
                    <p className="text-sm text-nilin-warmGray">{selectedBooking.category}</p>
                  )}
                  <p className="text-lg font-semibold text-nilin-coral mt-2">
                    {formatPrice(selectedBooking.price, selectedBooking.currency)}
                  </p>
                </div>

                {/* Customer Info */}
                <div className="space-y-3">
                  <h5 className="text-sm font-medium text-nilin-warmGray uppercase tracking-wide">Customer</h5>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                      <User className="w-5 h-5 text-nilin-coral" />
                    </div>
                    <div>
                      <p className="font-medium text-nilin-charcoal">{selectedBooking.customerName}</p>
                      {selectedBooking.customerPhone && (
                        <p className="text-sm text-nilin-warmGray flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {selectedBooking.customerPhone}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Schedule Info */}
                <div className="space-y-3">
                  <h5 className="text-sm font-medium text-nilin-warmGray uppercase tracking-wide">Schedule</h5>
                  <div className="flex items-center gap-2 text-nilin-charcoal">
                    <Clock className="w-4 h-4 text-nilin-warmGray" />
                    <span>
                      {new Date(selectedBooking.startTime).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-nilin-charcoal ml-6">
                    {formatTime(new Date(selectedBooking.startTime))} - {formatTime(new Date(selectedBooking.endTime))}
                  </div>
                </div>

                {/* Location Info */}
                {selectedBooking.location && (
                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-nilin-warmGray uppercase tracking-wide">Location</h5>
                    <div className="flex items-start gap-2 text-nilin-charcoal">
                      <MapPin className="w-4 h-4 text-nilin-warmGray mt-0.5" />
                      <span>{selectedBooking.location}</span>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedBooking.notes && (
                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-nilin-warmGray uppercase tracking-wide">Special Requests</h5>
                    <div className="bg-amber-50 rounded-xl p-4">
                      <p className="text-sm text-nilin-charcoal">{selectedBooking.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              {selectedBooking.status === 'pending' && (
                <div className="p-6 border-t border-nilin-border flex items-center gap-3">
                  <button
                    onClick={() => handleAcceptBooking(selectedBooking.id)}
                    disabled={pendingAction?.bookingId === selectedBooking.id}
                    className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {pendingAction?.bookingId === selectedBooking.id && pendingAction.action === 'accept' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Accepting...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        Accept
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeclineBooking(selectedBooking.id)}
                    disabled={pendingAction?.bookingId === selectedBooking.id}
                    className="flex-1 py-3 px-4 bg-red-100 text-red-600 rounded-xl font-medium hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {pendingAction?.bookingId === selectedBooking.id && pendingAction.action === 'decline' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Declining...
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4" />
                        Decline
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Close button for non-pending bookings */}
              {selectedBooking.status !== 'pending' && (
                <div className="p-6 border-t border-nilin-border">
                  <button
                    onClick={() => setSelectedBooking(null)}
                    className="w-full py-3 px-4 bg-nilin-muted text-nilin-charcoal rounded-xl font-medium hover:bg-nilin-muted/80 transition-colors"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <ConfirmDialog />
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default CalendarView;
