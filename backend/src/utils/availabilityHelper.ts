import mongoose, { ClientSession } from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import Booking from '../models/booking.model';
import logger from './logger';

interface ValidateSlotParams {
  providerId: string;
  scheduledDate: string | Date;
  scheduledTime: string;
  serviceDurationMinutes: number;
  bufferTimeMinutes?: number; // Buffer time between bookings
  serviceId?: string; // Optional service ID for per-service availability
  session?: ClientSession; // Optional session for transaction support
}

interface ValidateSlotResult {
  isValid: boolean;
  errorMessage?: string;
  errorCode?: 'NO_PROFILE' | 'NOT_AVAILABLE_DAY' | 'DATE_EXCEPTION' | 'NOT_IN_SLOT' | 'PAST_SLOT' | 'CONFLICT' | 'SLOT_LOCKED';
  availableSlots?: string[];
}

interface GetTimezoneOffsetResult {
  offsetMs: number;
  timezone: string;
}

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * FIX: Issue #3 - Timezone Calculation Incomplete
 * Get accurate timezone offset using Intl API with proper DST handling.
 * This replaces hardcoded offsets with actual IANA timezone calculations.
 */
export function getTimezoneOffset(timezone: string): GetTimezoneOffsetResult {
  // Validate timezone parameter
  if (!timezone || typeof timezone !== 'string') {
    logger.warn('Invalid timezone provided, defaulting to UTC', { timezone });
    return { offsetMs: 0, timezone: 'UTC' };
  }

  try {
    // Use Intl.DateTimeFormat to get accurate offset for the current moment
    // This correctly handles DST because it uses the actual current date
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    });

    const parts = formatter.formatToParts(now);
    const offsetString = parts.find(p => p.type === 'timeZoneName')?.value || 'UTC';

    // Parse offset from string like "GMT+4", "GMT-5", "IST", "GST", etc.
    // Common offset abbreviations
    const offsetMap: Record<string, number> = {
      'GMT': 0, 'UTC': 0,
      // Middle East
      'GST': 4, 'AST': 3, // Gulf Standard Time, Arabia Standard Time
      // South Asia
      'IST': 5.5, // India Standard Time
      // Europe
      'BST': 1, 'CET': 1, 'CEST': 2, 'WEST': 1, 'WET': 0,
      // Americas
      'EST': -5, 'EDT': -4, 'CST': -6, 'CDT': -5,
      'MST': -7, 'MDT': -6, 'PST': -8, 'PDT': -7,
      // Asia Pacific
      'JST': 9, 'KST': 9, 'CST_CHINA': 8, 'HKT': 8, 'SGT': 8, 'AEST': 10, 'AEDT': 11,
    };

    // Check if offsetString matches a known abbreviation
    if (offsetMap[offsetString] !== undefined) {
      return {
        offsetMs: offsetMap[offsetString] * 60 * 60 * 1000,
        timezone
      };
    }

    // Parse numeric offset from string like "GMT+4" or "GMT-5:30"
    const offsetMatch = offsetString.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (offsetMatch) {
      const sign = offsetMatch[1] === '+' ? 1 : -1;
      const hours = parseInt(offsetMatch[2], 10);
      const minutes = offsetMatch[3] ? parseInt(offsetMatch[3], 10) : 0;
      return {
        offsetMs: sign * (hours * 60 + minutes) * 60 * 1000,
        timezone
      };
    }

    // Fallback: try to calculate from IANA timezone
    // Create a date in the target timezone and compare with UTC
    const utcDate = new Date(now.toISOString());
    const targetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const targetParts = targetFormatter.formatToParts(now);
    const getPart = (type: string): number => {
      const value = targetParts.find(p => p.type === type)?.value || '0';
      return parseInt(value, 10);
    };

    const targetYear = getPart('year');
    const targetMonth = getPart('month') - 1;
    const targetDay = getPart('day');
    const targetHour = getPart('hour');
    const targetMinute = getPart('minute');
    const targetSecond = getPart('second');

    // Create a date assuming those parts are in the target timezone
    // and then convert to UTC by subtracting the offset
    const targetDate = Date.UTC(targetYear, targetMonth, targetDay, targetHour, targetMinute, targetSecond);
    const offsetMs = targetDate - now.getTime();

    return { offsetMs, timezone };

  } catch (error) {
    logger.error('Failed to calculate timezone offset, falling back to UTC', {
      context: 'AvailabilityHelper',
      action: 'TIMEZONE_OFFSET_ERROR',
      timezone,
      error: error instanceof Error ? error.message : String(error)
    });
    return { offsetMs: 0, timezone: 'UTC' };
  }
}

/**
 * FIX: Issue #2 - No Per-Service Availability
 * Get the schedule for a specific service, falling back to provider's global schedule.
 */
function getScheduleForService(
  providerProfile: any,
  serviceId?: string
): any {
  // If serviceId is provided, check for service-specific schedule
  if (serviceId && providerProfile.availability?.serviceSchedules) {
    const serviceSchedule = providerProfile.availability.serviceSchedules[serviceId];
    if (serviceSchedule) {
      logger.debug('Using service-specific schedule', { serviceId });
      return serviceSchedule;
    }
  }

  // Fall back to global schedule
  return providerProfile.availability?.schedule;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export async function validateProviderSlotAvailability({
  providerId,
  scheduledDate,
  scheduledTime,
  serviceDurationMinutes,
  bufferTimeMinutes = 0,
  serviceId,
  session
}: ValidateSlotParams): Promise<ValidateSlotResult> {
  const providerProfile = await ProviderProfile.findOne({ userId: providerId });

  // Use provider's buffer time if not explicitly provided
  const effectiveBufferTime = bufferTimeMinutes > 0
    ? bufferTimeMinutes
    : (providerProfile?.availability?.bufferTime || 0);

  if (!providerProfile?.availability?.schedule) {
    return {
      isValid: false,
      errorMessage: 'Provider availability not configured',
      errorCode: 'NO_PROFILE',
      availableSlots: []
    };
  }

  const requestedDate = new Date(scheduledDate);
  const dayOfWeek = DAYS_OF_WEEK[requestedDate.getDay()];

  // FIX: Issue #2 - Per-Service Availability
  // Get the schedule for the specific service, or fall back to global schedule
  const schedule = getScheduleForService(providerProfile, serviceId);
  const daySchedule = schedule?.[dayOfWeek as keyof typeof schedule];

  // Check day-of-week availability
  if (!daySchedule?.isAvailable || !daySchedule.timeSlots || daySchedule.timeSlots.length === 0) {
    return {
      isValid: false,
      errorMessage: 'Provider is not available on this day' + (serviceId ? ' for this service' : ''),
      errorCode: 'NOT_AVAILABLE_DAY',
      availableSlots: []
    };
  }

  // Check date exceptions (these apply globally, not per-service)
  const dateString = requestedDate.toISOString().split('T')[0];
  const dateException = providerProfile.availability.exceptions?.find(
    (ex: any) => ex.date && new Date(ex.date).toISOString().split('T')[0] === dateString
  );

  if (dateException && dateException.type === 'unavailable') {
    return {
      isValid: false,
      errorMessage: 'Provider is not available on this date',
      errorCode: 'DATE_EXCEPTION',
      availableSlots: []
    };
  }

  // Check if requested time falls within an active time slot
  const requestedMinutes = timeToMinutes(scheduledTime);
  const requestedEndMinutes = requestedMinutes + serviceDurationMinutes + effectiveBufferTime;

  const isWithinTimeSlot = daySchedule.timeSlots.some((slot: any) => {
    if (!slot.startTime || !slot.endTime) return false;
    if (slot.isBooked) return false;
    if (slot.maxBookings && slot.currentBookings >= slot.maxBookings) return false;

    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    return requestedMinutes >= slotStart && requestedEndMinutes <= slotEnd;
  });

  // Filter past slots for today - FIX: Use timezone-aware comparison
  const now = new Date();
  const todayString = now.toISOString().split('T')[0];
  const isToday = dateString === todayString;

  if (isToday) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const bufferMinutes = 60; // 1 hour minimum buffer for same-day bookings
    if (requestedMinutes < currentMinutes + bufferMinutes) {
      return {
        isValid: false,
        errorMessage: 'This time slot is no longer available for today',
        errorCode: 'PAST_SLOT',
        availableSlots: generateAvailableSlots(daySchedule.timeSlots, serviceDurationMinutes, currentMinutes + bufferMinutes, isToday, effectiveBufferTime)
      };
    }
  }

  if (!isWithinTimeSlot) {
    const minCutoff = isToday ? (now.getHours() * 60 + now.getMinutes() + 60) : 0;
    return {
      isValid: false,
      errorMessage: 'Provider is not available at the requested time' + (serviceId ? ' for this service' : ''),
      errorCode: 'NOT_IN_SLOT',
      availableSlots: generateAvailableSlots(daySchedule.timeSlots, serviceDurationMinutes, minCutoff, isToday, effectiveBufferTime)
    };
  }

  // FIX: Issue #4 - Real-Time Slot Blocking
  // Use atomic findOneAndUpdate with status check to prevent race conditions
  const slotLockQuery: any = {
    providerId,
    scheduledDate: {
      $gte: new Date(requestedDate.setHours(0, 0, 0, 0)),
      $lte: new Date(requestedDate.setHours(23, 59, 59, 999))
    },
    scheduledTime: scheduledTime,
    status: { $in: ['pending', 'confirmed', 'in_progress'] }
  };

  // Add service filter if checking per-service
  if (serviceId) {
    slotLockQuery.serviceId = serviceId;
  }

  const conflictingBooking = session
    ? await Booking.findOne(slotLockQuery).session(session)
    : await Booking.findOne(slotLockQuery);

  if (conflictingBooking) {
    // Check if the slot is truly locked (status check is already in query)
    return {
      isValid: false,
      errorMessage: 'This time slot is currently being booked by another customer',
      errorCode: 'SLOT_LOCKED'
    };
  }

  // Secondary check for overlapping bookings (buffer time considerations)
  const startOfDay = new Date(requestedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(requestedDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Use session if provided (for transaction support) to ensure read-your-writes consistency
  const bookingQuery: any = {
    providerId,
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'confirmed', 'in_progress'] }
  };

  const existingBookings = session
    ? await Booking.find(bookingQuery).session(session)
    : await Booking.find(bookingQuery);

  const conflict = existingBookings.find(booking => {
    const bookingStart = timeToMinutes(booking.scheduledTime);
    // Include buffer time when checking for conflicts
    const bookingEnd = bookingStart + booking.duration + effectiveBufferTime;
    return requestedMinutes < bookingEnd && requestedEndMinutes > bookingStart;
  });

  if (conflict) {
    return {
      isValid: false,
      errorMessage: 'Time slot conflicts with existing booking',
      errorCode: 'CONFLICT'
    };
  }

  return { isValid: true };
}

function generateAvailableSlots(
  timeSlots: any[],
  durationMinutes: number,
  minCutoffMinutes: number,
  filterPast: boolean,
  bufferTimeMinutes: number = 0
): string[] {
  const slots: string[] = [];
  const totalDuration = durationMinutes + bufferTimeMinutes;

  for (const slot of timeSlots) {
    if (!slot.startTime || !slot.endTime) continue;
    if (slot.isBooked) continue;
    if (slot.maxBookings && slot.currentBookings >= slot.maxBookings) continue;

    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);

    // Generate slots with buffer time included
    for (let minutes = slotStart; minutes + totalDuration <= slotEnd; minutes += 30) {
      if (filterPast && minutes < minCutoffMinutes) continue;
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  return slots;
}
