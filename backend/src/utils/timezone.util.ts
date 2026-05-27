import { format, parseISO, addHours, addDays, isAfter, isBefore } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Convert UTC date to timezone
 */
export const toTimezone = (utcDate: Date, timezone: string): Date => {
  return toZonedTime(utcDate, timezone);
};

/**
 * Convert timezone date to UTC
 */
export const fromTimezone = (zonedDate: Date, timezone: string): Date => {
  return fromZonedTime(zonedDate, timezone);
};

/**
 * Format date in timezone
 */
export const formatInTimezone = (
  date: Date,
  timezone: string,
  formatStr: string = 'yyyy-MM-dd HH:mm:ss'
): string => {
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, formatStr);
};

/**
 * Get current time in timezone
 */
export const nowInTimezone = (timezone: string): Date => {
  return toZonedTime(new Date(), timezone);
};

/**
 * Convert booking time string to Date
 */
export const parseBookingTime = (
  dateStr: string,
  timeStr: string,
  timezone: string
): Date => {
  const dateTimeStr = `${dateStr}T${timeStr}:00`;
  const zonedDate = parseISO(dateTimeStr);
  return fromZonedTime(zonedDate, timezone);
};

/**
 * Check if booking time is in the future
 */
export const isBookingTimeValid = (
  scheduledDate: Date,
  minAdvanceHours: number,
  maxAdvanceDays: number,
  timezone: string
): boolean => {
  const now = nowInTimezone(timezone);
  const minTime = addHours(now, minAdvanceHours);
  const maxTime = addDays(now, maxAdvanceDays);

  return (
    isAfter(scheduledDate, minTime) &&
    isBefore(scheduledDate, maxTime)
  );
};

/**
 * Get available time slots for a day
 */
export const getAvailableSlots = (
  date: Date,
  startHour: number = 8,
  endHour: number = 20,
  slotDuration: number = 60 // minutes
): string[] => {
  const slots: string[] = [];

  for (let hour = startHour; hour < endHour; hour++) {
    const timeStr = `${hour.toString().padStart(2, '0')}:00`;
    slots.push(timeStr);

    if (slotDuration === 30 && hour < endHour - 1) {
      slots.push(`${hour.toString().padStart(2, '0')}:30`);
    }
  }

  return slots;
};

// Common timezones
export const TIMEZONES = {
  'Asia/Dubai': 'Dubai (GST)',
  'Asia/Riyadh': 'Riyadh (AST)',
  'Asia/Kolkata': 'India (IST)',
  'Europe/London': 'London (GMT/BST)',
  'Asia/Singapore': 'Singapore (SGT)',
  'Australia/Sydney': 'Sydney (AEST)',
};
