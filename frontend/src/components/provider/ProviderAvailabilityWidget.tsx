import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Calendar, Clock, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import axios, { type AxiosError } from 'axios';
import { cn } from '../../lib/utils';
import { API_BASE_URL } from '@/config/api';

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

export interface AvailabilityError {
  message: string;
  code?: string;
  retryable?: boolean;
}

// API Response Types
interface AvailabilitySlotsResponse {
  success: boolean;
  data?: {
    slots: string[];
    timezone: string;
  };
  message?: string;
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
// API Configuration
// ============================================

const availabilityApi = axios.create({
  baseURL: `${API_BASE_URL}/availability`,
  timeout: 10000,
});

// Get auth tokens from sessionStorage
const getAuthTokens = () => {
  try {
    const stored = sessionStorage.getItem('auth-storage');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const tokens = parsed?.state?.tokens;
    if (tokens?.accessToken && tokens?.refreshToken) {
      return tokens;
    }
    return null;
  } catch {
    return null;
  }
};

// Add auth interceptor
availabilityApi.interceptors.request.use((config) => {
  const tokens = getAuthTokens();
  if (tokens?.accessToken) {
    config.headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  return config;
});

// Add response interceptor for 401 handling (token expiration)
availabilityApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized - token expired
    if (error.response?.status === 401 && originalRequest) {
      const tokens = getAuthTokens();

      if (tokens?.refreshToken) {
        try {
          // Attempt to refresh the token
          const refreshResponse = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            { refreshToken: tokens.refreshToken }
          );

          if (refreshResponse.data?.success && refreshResponse.data?.data) {
            const { accessToken, refreshToken: newRefreshToken } = refreshResponse.data.data;

            // Update stored tokens
            const stored = sessionStorage.getItem('auth-storage');
            if (stored) {
              const parsed = JSON.parse(stored);
              parsed.state.tokens = { accessToken, refreshToken: newRefreshToken };
              sessionStorage.setItem('auth-storage', JSON.stringify(parsed));
            }

            // Retry the original request with new token
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return availabilityApi(originalRequest);
          }
        } catch {
          // Refresh failed - clear auth and redirect to login
          sessionStorage.removeItem('auth-storage');
          window.dispatchEvent(new CustomEvent('auth:expired'));
        }
      } else {
        // No refresh token - clear auth and redirect
        sessionStorage.removeItem('auth-storage');
        window.dispatchEvent(new CustomEvent('auth:expired'));
      }
    }

    return Promise.reject(error);
  }
);

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
  const [error, setError] = useState<AvailabilityError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  // Track current week dates for isToday comparison
  const weekDatesRef = useRef<Date[]>([]);

  // Helper to get week dates
  const getWeekDates = useCallback((offset: number): Date[] => {
    const today = new Date();
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + (offset * 7) + i);
      dates.push(date);
    }
    return dates;
  }, []);

  // Helper to format date as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Helper to get day name
  const getDayName = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  // Helper to check if two dates are the same day
  const isSameDay = (date1: Date, date2: Date): boolean => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  // Fetch availability slots for a specific date
  const fetchSlotsForDate = async (date: string, duration: number = 60): Promise<TimeSlot[]> => {
    try {
      const response = await availabilityApi.get<AvailabilitySlotsResponse>(
        `/provider/${providerId}/slots`,
        {
          params: { date, duration },
        }
      );

      if (response.data.success && response.data.data) {
        // Convert time strings to TimeSlot objects with end times
        return response.data.data.slots.map((timeStr, index) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          const startDate = new Date();
          startDate.setHours(hours, minutes, 0, 0);
          const endDate = new Date(startDate.getTime() + duration * 60 * 1000);

          const formatTime = (d: Date) => {
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          };

          return {
            id: `slot-${date}-${timeStr}`,
            startTime: formatTime(startDate),
            endTime: formatTime(endDate),
            isAvailable: true,
          };
        });
      }

      return [];
    } catch (err) {
      const axiosError = err as AxiosError<AvailabilitySlotsResponse>;
      const errorMessage = axiosError.response?.data?.message || axiosError.message || 'Failed to fetch slots';
      throw new Error(errorMessage);
    }
  };

  // Fetch availability data for the current week
  const fetchAvailability = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const weekDates = getWeekDates(currentWeekOffset);
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // Fetch slots for all 7 days in parallel (respecting API rate)
      const weeklySchedule: DayAvailability[] = await Promise.all(
        weekDates.map(async (date, index) => {
          const dateStr = formatDate(date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isPast = date < today;
          const isWeekend = index === 0 || index === 6;

          let slots: TimeSlot[] = [];

          if (!isPast && !isWeekend) {
            try {
              // Use service-specific duration if available, default to 60 minutes
              const duration = serviceId ? 60 : 60;
              slots = await fetchSlotsForDate(dateStr, duration);
            } catch {
              // If fetch fails for a specific day, return empty slots
              slots = [];
            }
          }

          return {
            date: dateStr,
            dayOfWeek: dayNames[date.getDay()],
            isAvailable: !isPast && !isWeekend && slots.length > 0,
            slots,
          };
        })
      );

      // Find the timezone from the first successful response or use local
      const providerAvailability: ProviderAvailabilityData = {
        providerId,
        weeklySchedule,
        timezone,
        advanceBookingHours: 2,
        maxAdvanceDays: 30,
      };

      setAvailability(providerAvailability);
      setRetryCount(0);
    } catch (err) {
      const axiosError = err as AxiosError<AvailabilitySlotsResponse>;
      const errorMessage = axiosError.response?.data?.message || axiosError.message || 'Failed to load availability';
      const isRetryable = !axiosError.response || axiosError.response.status >= 500;

      setError({
        message: errorMessage,
        code: axiosError.code,
        retryable: isRetryable,
      });
    } finally {
      setIsLoading(false);
      setIsNavigating(false);
      weekDatesRef.current = getWeekDates(currentWeekOffset);
    }
  }, [providerId, currentWeekOffset, serviceId, getWeekDates]);

  // Fetch availability on mount and when dependencies change
  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  // Handle slot selection
  const handleSlotClick = useCallback((slot: TimeSlot, date: string) => {
    if (!slot.isAvailable) return;
    onSlotSelect?.(slot, date);
  }, [onSlotSelect]);

  // Handle retry on error
  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    fetchAvailability();
  }, [fetchAvailability]);

  // Navigate weeks with debounce to prevent race conditions
  const goToPreviousWeek = useCallback(() => {
    if (currentWeekOffset > 0 && !isLoading && !isNavigating) {
      setIsNavigating(true);
      setCurrentWeekOffset(prev => prev - 1);
    }
  }, [currentWeekOffset, isLoading, isNavigating]);

  const goToNextWeek = useCallback(() => {
    const maxOffset = availability?.maxAdvanceDays ? Math.floor(availability.maxAdvanceDays / 7) : 4;
    if (currentWeekOffset < maxOffset && !isLoading && !isNavigating) {
      setIsNavigating(true);
      setCurrentWeekOffset(prev => prev + 1);
    }
  }, [currentWeekOffset, availability?.maxAdvanceDays, isLoading, isNavigating]);

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center p-8', className)}>
        <Loader2 className="h-8 w-8 animate-spin text-nilin-coral" />
      </div>
    );
  }

  // Error state with retry button
  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <AlertCircle className="h-8 w-8 text-nilin-error mb-2" />
        <p className="text-nilin-charcoal font-medium mb-1">Unable to load availability</p>
        <p className="text-sm text-nilin-warmGray mb-4 max-w-xs">{error.message}</p>
        {error.retryable !== false && (
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </button>
        )}
      </div>
    );
  }

  if (!availability) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <AlertCircle className="h-8 w-8 text-nilin-error mb-2" />
        <p className="text-nilin-warmGray">No availability data</p>
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
              disabled={currentWeekOffset === 0 || isLoading || isNavigating}
              className={cn(
                'p-2 rounded-lg transition-colors',
                currentWeekOffset === 0 || isLoading || isNavigating
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
              disabled={currentWeekOffset >= 4 || isLoading || isNavigating}
              className={cn(
                'p-2 rounded-lg transition-colors',
                currentWeekOffset >= 4 || isLoading || isNavigating
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
            const weekDate = weekDatesRef.current[index];
            const today = new Date();
            const isToday = weekDate ? isSameDay(weekDate, today) : false;

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
                onClick={() => {
                  const dayEntry = availability.weeklySchedule.find(d => d.slots.includes(slot));
                  if (dayEntry?.date) {
                    onSlotSelect?.(slot, dayEntry.date);
                  }
                }}
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
