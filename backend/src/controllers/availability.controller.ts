import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import { asyncHandler } from '../utils/asyncHandler';
import { REGIONS } from '../services/region.service';
import logger from '../utils/logger';

// MongoDB ObjectId validator
const isValidObjectId = (id: string): boolean => {
  return mongoose.Types.ObjectId.isValid(id);
};

// Helper function to get provider's timezone
async function getProviderTimezone(providerId: string): Promise<string> {
  try {
    const user = await User.findById(providerId).select('communicationPreferences.timezone').lean();
    if (user?.communicationPreferences?.timezone) {
      return user.communicationPreferences.timezone;
    }
  } catch (error) {
    logger.error('Error fetching user timezone', {
      context: 'AvailabilityController',
      action: 'FETCH_TIMEZONE_ERROR',
      providerId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Fallback: try to get timezone from provider profile's country
  try {
    const providerProfile = await ProviderProfile.findOne({ userId: providerId }).select('locationInfo.primaryAddress.country').lean();
    if (providerProfile?.locationInfo?.primaryAddress?.country) {
      const country = providerProfile.locationInfo.primaryAddress.country.toUpperCase();
      // Map country to region timezone
      const countryToRegion: Record<string, string> = {
        'AE': 'UAE', 'UNITED ARAB EMIRATES': 'UAE',
        'SA': 'KSA', 'SAUDI ARABIA': 'KSA',
        'IN': 'INDIA', 'INDIA': 'INDIA',
        'GB': 'UK', 'UK': 'UK', 'UNITED KINGDOM': 'UK',
      };
      const regionCode = countryToRegion[country];
      if (regionCode && REGIONS[regionCode]) {
        return REGIONS[regionCode].timezone;
      }
    }
  } catch (error) {
    logger.error('Error fetching provider country for timezone', {
      context: 'AvailabilityController',
      action: 'FETCH_COUNTRY_ERROR',
      providerId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return 'UTC'; // Default fallback
}

/**
 * FIX: Issue #3 - Timezone Calculation Incomplete
 * Get accurate timezone offset using Intl API with proper DST handling.
 */
function getTimezoneOffset(timezone: string): number {
  if (!timezone || typeof timezone !== 'string') {
    return 0;
  }

  try {
    // Use Intl.DateTimeFormat to get accurate offset for the current moment
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset'
    });

    const parts = formatter.formatToParts(now);
    const offsetString = parts.find(p => p.type === 'timeZoneName')?.value || 'UTC';

    // Common offset abbreviations
    const offsetMap: Record<string, number> = {
      'GMT': 0, 'UTC': 0, 'GST': 4, 'AST': 3, 'IST': 5.5,
      'BST': 1, 'CET': 1, 'CEST': 2, 'WEST': 1, 'WET': 0,
      'EST': -5, 'EDT': -4, 'CST': -6, 'CDT': -5,
      'MST': -7, 'MDT': -6, 'PST': -8, 'PDT': -7,
      'JST': 9, 'KST': 9, 'CST_CHINA': 8, 'HKT': 8, 'SGT': 8, 'AEST': 10, 'AEDT': 11,
    };

    // Check if offsetString matches a known abbreviation
    if (offsetMap[offsetString] !== undefined) {
      return offsetMap[offsetString] * 60 * 60 * 1000;
    }

    // Parse numeric offset from string like "GMT+4" or "GMT-5:30"
    const offsetMatch = offsetString.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (offsetMatch) {
      const sign = offsetMatch[1] === '+' ? 1 : -1;
      const hours = parseInt(offsetMatch[2], 10);
      const minutes = offsetMatch[3] ? parseInt(offsetMatch[3], 10) : 0;
      return sign * (hours * 60 + minutes) * 60 * 1000;
    }

    // Fallback: try to calculate from IANA timezone
    const targetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
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

    const targetDate = Date.UTC(targetYear, targetMonth, targetDay, targetHour, targetMinute, targetSecond);
    return targetDate - now.getTime();

  } catch {
    return 0;
  }
}

// Transform old availability format to new provider profile format
const transformToProviderProfile = (oldWeeklySchedule: any) => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const newSchedule: any = {};

  days.forEach(day => {
    const oldDay = oldWeeklySchedule[day];
    if (oldDay) {
      newSchedule[day] = {
        isAvailable: oldDay.isAvailable,
        timeSlots: oldDay.timeSlots
          .filter((slot: any) => slot.isActive)
          .map((slot: any) => ({
            startTime: slot.start,
            endTime: slot.end,
            isBooked: false,
            maxBookings: 1,
            currentBookings: 0
          }))
      };
    }
  });

  return newSchedule;
};

// Transform new provider profile format to old availability format (for API responses)
const transformToLegacyFormat = (newWeeklySchedule: any) => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const oldSchedule: any = {};

  days.forEach(day => {
    const newDay = newWeeklySchedule[day];
    if (newDay) {
      oldSchedule[day] = {
        isAvailable: newDay.isAvailable,
        timeSlots: newDay.timeSlots.map((slot: any) => ({
          start: slot.startTime,
          end: slot.endTime,
          isActive: !slot.isBooked && slot.currentBookings < slot.maxBookings
        }))
      };
    }
  });

  return oldSchedule;
};

// Create default weekly schedule for new providers
const createDefaultSchedule = () => {
  const defaultWorkingDay = {
    isAvailable: true,
    timeSlots: [{
      startTime: '09:00',
      endTime: '17:00',
      isBooked: false,
      maxBookings: 1,
      currentBookings: 0
    }]
  };

  const defaultOffDay = {
    isAvailable: false,
    timeSlots: []
  };

  return {
    monday: { ...defaultWorkingDay },
    tuesday: { ...defaultWorkingDay },
    wednesday: { ...defaultWorkingDay },
    thursday: { ...defaultWorkingDay },
    friday: { ...defaultWorkingDay },
    saturday: { ...defaultOffDay },
    sunday: { ...defaultOffDay }
  };
};

export const getProviderAvailability = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    return res.status(403).json({
      success: false,
      message: 'Only providers can access availability settings'
    });
  }

  let providerProfile = await ProviderProfile.findOne({ userId: req.user?._id });

  if (!providerProfile) {
    return res.status(404).json({
      success: false,
      message: 'Provider profile not found. Complete profile setup first.'
    });
  } else if (!providerProfile.availability || !providerProfile.availability.schedule) {
    providerProfile = await ProviderProfile.findByIdAndUpdate(
      providerProfile._id,
      {
        $set: {
          availability: {
            schedule: createDefaultSchedule(),
            exceptions: [],
            bufferTime: 15,
            maxAdvanceBooking: 30,
            minNoticeTime: 24,
            autoAcceptBookings: false
          }
        }
      },
      { new: true }
    );
  }
  if (!providerProfile) {
    return res.status(500).json({
      success: false,
      message: 'Failed to initialize availability settings'
    });
  }

  // Get provider's timezone dynamically
  const providerTimezone = await getProviderTimezone(req.user?._id?.toString() || '');

  const legacyAvailability = {
    _id: providerProfile._id,
    providerId: providerProfile.userId,
    weeklySchedule: transformToLegacyFormat(providerProfile.availability.schedule),
    dateOverrides: providerProfile.availability.exceptions.map((exception, idx) => ({
      _id: exception._id?.toString() || `override_${idx}`,
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.notes,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: providerTimezone,
    bufferTime: providerProfile.availability.bufferTime,
    autoAcceptBookings: providerProfile.availability.autoAcceptBookings,
    maxAdvanceBookingDays: providerProfile.availability.maxAdvanceBooking,
    minNoticeTime: providerProfile.availability.minNoticeTime
  };

  return res.json({
    success: true,
    data: { availability: legacyAvailability }
  });
});

export const updateWeeklySchedule = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    return res.status(403).json({
      success: false,
      message: 'Only providers can update availability settings'
    });
  }

  const { weeklySchedule } = req.body;

  if (!weeklySchedule) {
    return res.status(400).json({
      success: false,
      message: 'Weekly schedule is required'
    });
  }

  const providerProfile = await ProviderProfile.findOne({ userId: req.user?._id });
  if (!providerProfile) {
    return res.status(404).json({
      success: false,
      message: 'Provider profile not found. Complete profile setup first.'
    });
  }

  const availabilityBase = providerProfile.availability || {
    schedule: createDefaultSchedule(),
    exceptions: [],
    bufferTime: 15,
    maxAdvanceBooking: 30,
    minNoticeTime: 24,
    autoAcceptBookings: false
  };

  const updatedProfile = await ProviderProfile.findByIdAndUpdate(
    providerProfile._id,
    {
      $set: {
        availability: {
          ...availabilityBase,
          schedule: transformToProviderProfile(weeklySchedule)
        }
      }
    },
    { new: true }
  );
  if (!updatedProfile) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update weekly schedule'
    });
  }

  // Get provider's timezone dynamically
  const providerTimezone = await getProviderTimezone(req.user?._id?.toString() || '');

  const legacyAvailability = {
    _id: updatedProfile!._id,
    providerId: updatedProfile!.userId,
    weeklySchedule: transformToLegacyFormat(updatedProfile!.availability.schedule),
    dateOverrides: updatedProfile!.availability.exceptions.map((exception, idx) => ({
      _id: exception._id?.toString() || `override_${idx}`,
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.notes,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: providerTimezone,
    bufferTime: updatedProfile!.availability.bufferTime,
    autoAcceptBookings: updatedProfile!.availability.autoAcceptBookings,
    maxAdvanceBookingDays: updatedProfile!.availability.maxAdvanceBooking,
    minNoticeTime: updatedProfile!.availability.minNoticeTime
  };

  return res.json({
    success: true,
    message: 'Weekly schedule updated successfully',
    data: { availability: legacyAvailability }
  });
});

export const addDateOverride = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    return res.status(403).json({
      success: false,
      message: 'Only providers can add date overrides'
    });
  }

  const { date, isAvailable, reason } = req.body;

  if (!date) {
    return res.status(400).json({
      success: false,
      message: 'Date is required'
    });
  }

  let providerProfile = await ProviderProfile.findOne({ userId: req.user?._id });

  if (!providerProfile || !providerProfile.availability) {
    return res.status(404).json({
      success: false,
      message: 'Availability settings not found. Please set up your weekly schedule first.'
    });
  }

  // Normalize date to YYYY-MM-DD for comparison (handles both ISO strings and date strings)
  const normalizeDateString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const normalizedInputDate = date.split('T')[0]; // Handle both "2024-01-15" and ISO strings

  providerProfile.availability.exceptions = providerProfile.availability.exceptions.filter(
    exception => normalizeDateString(exception.date) !== normalizedInputDate
  );

  // FIX: Add unique overrideId for reliable removal
  const newException: any = {
    date: new Date(date),
    type: isAvailable === false ? 'unavailable' : 'custom_hours',
    reason: reason || (isAvailable === false ? 'Unavailable' : 'Custom hours'),
    notes: req.body.notes || undefined
  };

  // Generate a unique override ID
  newException._id = new mongoose.Types.ObjectId();

  providerProfile.availability.exceptions.push(newException);

  providerProfile = await ProviderProfile.findByIdAndUpdate(
    providerProfile._id,
    { $set: { availability: providerProfile.availability } },
    { new: true }
  );
  if (!providerProfile) {
    return res.status(500).json({
      success: false,
      message: 'Failed to save date override'
    });
  }

  // Get provider's timezone dynamically
  const providerTimezone = await getProviderTimezone(req.user?._id?.toString() || '');

  const legacyAvailability = {
    _id: providerProfile._id,
    providerId: providerProfile.userId,
    weeklySchedule: transformToLegacyFormat(providerProfile.availability.schedule),
    dateOverrides: providerProfile.availability.exceptions.map((exception, idx) => ({
      _id: exception._id?.toString() || `override_${idx}`,
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.notes,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: providerTimezone,
    bufferTime: providerProfile.availability.bufferTime,
    autoAcceptBookings: providerProfile.availability.autoAcceptBookings,
    maxAdvanceBookingDays: providerProfile.availability.maxAdvanceBooking,
    minNoticeTime: providerProfile.availability.minNoticeTime
  };

  return res.json({
    success: true,
    message: 'Date override added successfully',
    data: { availability: legacyAvailability }
  });
});

export const removeDateOverride = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    return res.status(403).json({
      success: false,
      message: 'Only providers can remove date overrides'
    });
  }

  // FIX: Issue #5 - removeDateOverride by Date Only
  // Support both override ID (preferred) and date (legacy fallback)
  const { overrideId, date } = req.query as { overrideId?: string; date?: string };

  if (!overrideId && !date) {
    return res.status(400).json({
      success: false,
      message: 'Either overrideId or date is required'
    });
  }

  let providerProfile = await ProviderProfile.findOne({ userId: req.user?._id });

  if (!providerProfile || !providerProfile.availability) {
    return res.status(404).json({
      success: false,
      message: 'Availability settings not found'
    });
  }

  let removed = false;

  if (overrideId) {
    // Remove by override ID (preferred method - unique)
    const originalLength = providerProfile.availability.exceptions.length;
    providerProfile.availability.exceptions = providerProfile.availability.exceptions.filter(
      exception => (exception as any)._id?.toString() !== overrideId
    );
    removed = providerProfile.availability.exceptions.length < originalLength;

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'Override not found'
      });
    }
  } else if (date) {
    // Legacy fallback: remove by date (may remove multiple overrides on same date)
    // Normalize date to YYYY-MM-DD for comparison (handle both formats)
    const normalizeDateString = (d: Date): string => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    // Handle both "2024-01-15" and "2024-01-15T00:00:00.000Z" formats from params
    const normalizedParamDate = date.split('T')[0];

    const originalLength = providerProfile.availability.exceptions.length;
    providerProfile.availability.exceptions = providerProfile.availability.exceptions.filter(
      exception => normalizeDateString(exception.date) !== normalizedParamDate
    );
    removed = providerProfile.availability.exceptions.length < originalLength;

    if (!removed) {
      return res.status(404).json({
        success: false,
        message: 'No override found for this date'
      });
    }
  }

  providerProfile = await ProviderProfile.findByIdAndUpdate(
    providerProfile._id,
    { $set: { availability: providerProfile.availability } },
    { new: true }
  );
  if (!providerProfile) {
    return res.status(500).json({
      success: false,
      message: 'Failed to remove date override'
    });
  }

  // Get provider's timezone dynamically
  const providerTimezone = await getProviderTimezone(req.user?._id?.toString() || '');

  const legacyAvailability = {
    _id: providerProfile._id,
    providerId: providerProfile.userId,
    weeklySchedule: transformToLegacyFormat(providerProfile.availability.schedule),
    dateOverrides: providerProfile.availability.exceptions.map((exception, idx) => ({
      _id: (exception as any)._id || `override_${idx}`,
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.notes,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: providerTimezone,
    bufferTime: providerProfile.availability.bufferTime,
    autoAcceptBookings: providerProfile.availability.autoAcceptBookings,
    maxAdvanceBookingDays: providerProfile.availability.maxAdvanceBooking,
    minNoticeTime: providerProfile.availability.minNoticeTime
  };

  return res.json({
    success: true,
    message: 'Date override removed successfully',
    data: { availability: legacyAvailability }
  });
});

export const blockTimePeriod = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    return res.status(403).json({
      success: false,
      message: 'Only providers can block time periods'
    });
  }

  const { startDate, endDate, reason } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({
      success: false,
      message: 'Start date and end date are required'
    });
  }

  let providerProfile = await ProviderProfile.findOne({ userId: req.user?._id });

  if (!providerProfile || !providerProfile.availability) {
    return res.status(404).json({
      success: false,
      message: 'Availability settings not found. Please set up your weekly schedule first.'
    });
  }

  // Add all dates from startDate to endDate (inclusive)
  const start = new Date(startDate);
  const end = new Date(endDate);
  const current = new Date(start);

  while (current <= end) {
    // Check if this date already has an exception
    const existingIndex = providerProfile.availability.exceptions.findIndex(
      ex => ex.date.toISOString().split('T')[0] === current.toISOString().split('T')[0]
    );

    if (existingIndex >= 0) {
      // Update existing exception to unavailable
      providerProfile.availability.exceptions[existingIndex] = {
        date: new Date(current),
        type: 'unavailable',
        reason: reason || 'Blocked period'
      };
    } else {
      // Add new exception
      providerProfile.availability.exceptions.push({
        date: new Date(current),
        type: 'unavailable',
        reason: reason || 'Blocked period'
      });
    }

    current.setDate(current.getDate() + 1);
  }

  providerProfile = await ProviderProfile.findByIdAndUpdate(
    providerProfile._id,
    { $set: { availability: providerProfile.availability } },
    { new: true }
  );
  if (!providerProfile) {
    return res.status(500).json({
      success: false,
      message: 'Failed to block selected period'
    });
  }

  // Get provider's timezone dynamically
  const providerTimezone = await getProviderTimezone(req.user?._id?.toString() || '');

  const legacyAvailability = {
    _id: providerProfile._id,
    providerId: providerProfile.userId,
    weeklySchedule: transformToLegacyFormat(providerProfile.availability.schedule),
    dateOverrides: providerProfile.availability.exceptions.map(exception => ({
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.notes,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: providerTimezone,
    bufferTime: providerProfile.availability.bufferTime,
    autoAcceptBookings: providerProfile.availability.autoAcceptBookings,
    maxAdvanceBookingDays: providerProfile.availability.maxAdvanceBooking,
    minNoticeTime: providerProfile.availability.minNoticeTime
  };

  return res.json({
    success: true,
    message: 'Time period blocked successfully',
    data: { availability: legacyAvailability }
  });
});

export const removeBlockedPeriod = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    return res.status(403).json({
      success: false,
      message: 'Only providers can remove blocked periods'
    });
  }

  const { blockId } = req.params;

  let providerProfile = await ProviderProfile.findOne({ userId: req.user?._id });

  if (!providerProfile || !providerProfile.availability) {
    return res.status(404).json({
      success: false,
      message: 'Availability settings not found'
    });
  }

  // Normalize date to YYYY-MM-DD for comparison (handle both formats)
  const normalizeDateString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Handle both "2024-01-15" and "2024-01-15T00:00:00.000Z" formats from params
  const normalizedBlockId = blockId.split('T')[0];

  providerProfile.availability.exceptions = providerProfile.availability.exceptions.filter(
    exception => normalizeDateString(exception.date) !== normalizedBlockId
  );

  providerProfile = await ProviderProfile.findByIdAndUpdate(
    providerProfile._id,
    { $set: { availability: providerProfile.availability } },
    { new: true }
  );
  if (!providerProfile) {
    return res.status(500).json({
      success: false,
      message: 'Failed to remove blocked period'
    });
  }

  // Get provider's timezone dynamically
  const providerTimezone = await getProviderTimezone(req.user?._id?.toString() || '');

  const legacyAvailability = {
    _id: providerProfile._id,
    providerId: providerProfile.userId,
    weeklySchedule: transformToLegacyFormat(providerProfile.availability.schedule),
    dateOverrides: providerProfile.availability.exceptions.map(exception => ({
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.notes,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: providerTimezone,
    bufferTime: providerProfile.availability.bufferTime,
    autoAcceptBookings: providerProfile.availability.autoAcceptBookings,
    maxAdvanceBookingDays: providerProfile.availability.maxAdvanceBooking,
    minNoticeTime: providerProfile.availability.minNoticeTime
  };

  return res.json({
    success: true,
    message: 'Blocked period removed successfully',
    data: { availability: legacyAvailability }
  });
});

export const getProviderAvailableSlots = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  // FIX: Issue #2 - Add serviceId for per-service availability
  const { date, duration = '60', timezone: clientTimezone, serviceId } = req.query;

  if (!providerId) {
    return res.status(400).json({
      success: false,
      message: 'Provider ID is required'
    });
  }

  if (!date) {
    return res.status(400).json({
      success: false,
      message: 'Date is required'
    });
  }

  // FIX: Issue #3 - Get provider's timezone for consistent slot calculations
  const providerTimezone = await getProviderTimezone(providerId);
  const requestDateStr = date as string;

  // Parse date - use provider's timezone for correct day of week
  let requestDate: Date;
  try {
    requestDate = new Date(requestDateStr);
    // Adjust for timezone offset to get correct day in provider's timezone
    const tzOffset = getTimezoneOffset(providerTimezone);
    requestDate = new Date(requestDate.getTime() + tzOffset);
  } catch (e) {
    requestDate = new Date(requestDateStr);
  }

  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][requestDate.getDay()];

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });

  if (!providerProfile || !providerProfile.availability?.schedule) {
    return res.json({
      success: true,
      data: { slots: [], timezone: providerTimezone }
    });
  }

  // FIX: Issue #2 - Get schedule for specific service or fall back to global schedule
  let schedule = providerProfile.availability.schedule;
  if (serviceId && providerProfile.availability.serviceSchedules?.[serviceId as string]) {
    schedule = providerProfile.availability.serviceSchedules[serviceId as string];
    logger.debug('Using service-specific schedule', { providerId, serviceId });
  }

  const daySchedule = schedule[dayOfWeek as keyof typeof schedule];

  if (!daySchedule?.isAvailable || !daySchedule.timeSlots) {
    return res.json({
      success: true,
      data: { slots: [], timezone: providerTimezone }
    });
  }

  // FIX: Use timezone-aware date comparison
  const dateString = requestDateStr.split('T')[0];
  const dateException = providerProfile.availability.exceptions.find(
    exception => {
      const exceptionDateStr = exception.date instanceof Date
        ? exception.date.toISOString().split('T')[0]
        : String(exception.date).split('T')[0];
      return exceptionDateStr === dateString;
    }
  );

  if (dateException && dateException.type === 'unavailable') {
    return res.json({
      success: true,
      data: { slots: [], timezone: providerTimezone }
    });
  }

  // FIX: Calculate start/end of day in provider's timezone
  const tzOffset = getTimezoneOffset(providerTimezone);
  const startOfDay = new Date(requestDate);
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayUtc = new Date(startOfDay.getTime() - tzOffset);

  const endOfDay = new Date(requestDate);
  endOfDay.setHours(23, 59, 59, 999);
  const endOfDayUtc = new Date(endOfDay.getTime() - tzOffset);

  // FIX: Issue #4 - Real-Time Slot Blocking
  // Query bookings, optionally filtered by serviceId
  const bookingQuery: any = {
    providerId,
    scheduledDate: {
      $gte: startOfDayUtc,
      $lte: endOfDayUtc
    },
    status: { $in: ['pending', 'confirmed', 'in_progress'] }
  };

  // Add service filter if checking per-service availability
  if (serviceId) {
    bookingQuery.serviceId = serviceId;
  }

  const existingBookings = await Booking.find(bookingQuery);

  const availableSlots: string[] = [];
  const slotDuration = parseInt(duration as string, 10);

  // FIX: Validate slot duration
  if (isNaN(slotDuration) || slotDuration < 15 || slotDuration > 480) {
    return res.status(400).json({
      success: false,
      message: 'Duration must be between 15 and 480 minutes'
    });
  }

  // FIX: Use timezone-aware current time comparison
  const now = new Date();
  const nowInProviderTz = new Date(now.getTime() + tzOffset);
  const isToday = dateString === nowInProviderTz.toISOString().split('T')[0];
  const nowMsInTz = nowInProviderTz.getTime();

  for (const timeSlot of daySchedule.timeSlots) {
    if (!timeSlot.startTime || !timeSlot.endTime) {
      continue;
    }

    if (timeSlot.isBooked || timeSlot.currentBookings >= (timeSlot.maxBookings || 1)) {
      continue;
    }

    try {
      const startHour = parseInt(timeSlot.startTime.split(':')[0], 10);
      const startMinute = parseInt(timeSlot.startTime.split(':')[1], 10);
      const endHour = parseInt(timeSlot.endTime.split(':')[0], 10);
      const endMinute = parseInt(timeSlot.endTime.split(':')[1], 10);

      // Create slot times in provider's timezone
      const slotStartBase = new Date(requestDate);
      slotStartBase.setHours(startHour, startMinute, 0, 0);

      const slotEndTime = new Date(requestDate);
      slotEndTime.setHours(endHour, endMinute, 0, 0);

      // Iterate through time slots
      let currentSlotTime = new Date(slotStartBase);
      const slotDurationMs = slotDuration * 60 * 1000;

      while (currentSlotTime.getTime() + slotDurationMs <= slotEndTime.getTime()) {
        const slotStart = new Date(currentSlotTime);
        const slotEnd = new Date(currentSlotTime.getTime() + slotDurationMs);

        // Skip past slots for today
        if (isToday && slotStart.getTime() <= nowMsInTz) {
          currentSlotTime.setTime(currentSlotTime.getTime() + slotDurationMs);
          continue;
        }

        // Check conflicts using timezone-aware comparison
        const hasConflict = existingBookings.some(booking => {
          const bookingStart = new Date(booking.scheduledDate);
          const bookingEnd = new Date(booking.estimatedEndTime);
          return (slotStart < bookingEnd && slotEnd > bookingStart);
        });

        if (!hasConflict) {
          const hours = String(slotStart.getHours()).padStart(2, '0');
          const minutes = String(slotStart.getMinutes()).padStart(2, '0');
          const timeString = `${hours}:${minutes}`;

          if (!availableSlots.includes(timeString)) {
            availableSlots.push(timeString);
          }
        }

        currentSlotTime.setTime(currentSlotTime.getTime() + slotDurationMs);
      }
    } catch (error) {
      logger.error('Error processing time slot', {
        context: 'AvailabilityController',
        action: 'PROCESS_SLOT_ERROR',
        timeSlot,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
  }

  return res.json({
    success: true,
    data: { slots: availableSlots, timezone: providerTimezone }
  });
});

export const checkTimeSlotAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { providerId } = req.params;
  const { startTime, endTime } = req.query;

  if (!providerId || !startTime || !endTime) {
    return res.status(400).json({
      success: false,
      message: 'Provider ID, start time, and end time are required'
    });
  }

  const requestStart = new Date(startTime as string);
  const requestEnd = new Date(endTime as string);

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });

  if (!providerProfile || !providerProfile.availability?.schedule) {
    return res.json({
      success: true,
      data: {
        isAvailable: false,
        conflictingBookings: 0
      }
    });
  }

  const existingBookings = await Booking.find({
    providerId,
    $or: [
      {
        scheduledDate: { $lt: requestEnd },
        estimatedEndTime: { $gt: requestStart }
      }
    ],
    status: { $in: ['pending', 'confirmed', 'in_progress'] }
  });

  const isAvailable = existingBookings.length === 0;

  return res.json({
    success: true,
    data: {
      isAvailable,
      conflictingBookings: existingBookings.length
    }
  });
});

export const updateAvailabilitySettings = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    return res.status(403).json({
      success: false,
      message: 'Only providers can update availability settings'
    });
  }

  const { bufferTime, maxAdvanceBookingDays, autoAcceptBookings, minNoticeTime, timezone } = req.body;

  let providerProfile = await ProviderProfile.findOne({ userId: req.user?._id });

  if (!providerProfile) {
    return res.status(404).json({
      success: false,
      message: 'Provider profile not found'
    });
  }

  // Initialize availability object if it doesn't exist
  if (!providerProfile.availability) {
    providerProfile.availability = {
      schedule: createDefaultSchedule(),
      exceptions: [],
      bufferTime: 15,
      maxAdvanceBooking: 30,
      minNoticeTime: 24,
      autoAcceptBookings: false
    };
  }

  // Update only provided fields
  if (bufferTime !== undefined) {
    providerProfile.availability.bufferTime = Math.max(0, Math.min(120, bufferTime));
  }

  if (maxAdvanceBookingDays !== undefined) {
    providerProfile.availability.maxAdvanceBooking = Math.max(1, Math.min(365, maxAdvanceBookingDays));
  }

  if (autoAcceptBookings !== undefined) {
    providerProfile.availability.autoAcceptBookings = autoAcceptBookings;
  }

  if (minNoticeTime !== undefined) {
    providerProfile.availability.minNoticeTime = Math.max(0, Math.min(168, minNoticeTime));
  }

  providerProfile = await ProviderProfile.findByIdAndUpdate(
    providerProfile._id,
    { $set: { availability: providerProfile.availability } },
    { new: true }
  );
  if (!providerProfile) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update availability settings'
    });
  }

  // Get provider's timezone dynamically
  const providerTimezone = timezone || await getProviderTimezone(req.user?._id?.toString() || '');

  const legacyAvailability = {
    _id: providerProfile._id,
    providerId: providerProfile.userId,
    weeklySchedule: transformToLegacyFormat(providerProfile.availability.schedule),
    dateOverrides: providerProfile.availability.exceptions.map(exception => ({
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.notes,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: providerTimezone,
    bufferTime: providerProfile.availability.bufferTime,
    autoAcceptBookings: providerProfile.availability.autoAcceptBookings,
    maxAdvanceBookingDays: providerProfile.availability.maxAdvanceBooking,
    minNoticeTime: providerProfile.availability.minNoticeTime
  };

  return res.json({
    success: true,
    message: 'Availability settings updated successfully',
    data: { availability: legacyAvailability }
  });
});

/**
 * Get Availability Analytics
 * GET /api/availability/analytics
 *
 * Returns provider's availability statistics including:
 * - Utilization rate
 * - Booking density by day of week
 * - Most/least booked time slots
 * - Availability trends
 */
export const getAvailabilityAnalytics = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    return res.status(403).json({
      success: false,
      message: 'Only providers can access availability analytics'
    });
  }

  const providerId = req.user._id.toString();
  const { period = '30d' } = req.query;

  // Calculate date range based on period
  let startDate: Date;
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  // Get provider profile
  const providerProfile = await ProviderProfile.findOne({ userId: providerId });

  if (!providerProfile) {
    return res.status(404).json({
      success: false,
      message: 'Provider profile not found'
    });
  }

  // Get bookings in the period
  const bookings = await Booking.find({
    providerId,
    createdAt: { $gte: startDate, $lte: endDate },
  }).select('scheduledDate scheduledTime status duration').lean();

  // Calculate total available slots (based on weekly schedule)
  const schedule = providerProfile.availability?.schedule;
  let totalWeeklySlots = 0;
  const slotsPerDay: Record<string, number> = {};

  if (schedule) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const weeksInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

    days.forEach(day => {
      const daySchedule = schedule[day as keyof typeof schedule];
      if (daySchedule?.isAvailable && daySchedule.timeSlots) {
        let daySlots = 0;
        daySchedule.timeSlots.forEach(slot => {
          if (slot.startTime && slot.endTime) {
            const [startH, startM] = slot.startTime.split(':').map(Number);
            const [endH, endM] = slot.endTime.split(':').map(Number);
            const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
            daySlots += Math.max(1, Math.floor(durationMinutes / 60));
          }
        });
        slotsPerDay[day] = daySlots;
        totalWeeklySlots += daySlots;
      }
    });

    totalWeeklySlots *= weeksInPeriod;
  }

  // Calculate booking statistics
  const totalBookings = bookings.length;
  const completedBookings = bookings.filter(b => b.status === 'completed').length;
  const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
  const confirmedBookings = bookings.filter(b => ['confirmed', 'in_progress'].includes(b.status)).length;

  // Calculate utilization rate
  const utilizationRate = totalWeeklySlots > 0 ? (totalBookings / totalWeeklySlots) * 100 : 0;

  // Calculate bookings by day of week
  const bookingsByDayOfWeek: Record<string, number> = {
    sunday: 0, monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0
  };
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  bookings.forEach(booking => {
    const date = new Date(booking.scheduledDate);
    const dayName = days[date.getDay()];
    bookingsByDayOfWeek[dayName]++;
  });

  // Find most and least busy days
  const dayCounts = Object.entries(bookingsByDayOfWeek);
  const mostBusyDay = dayCounts.reduce((max, [day, count]) => count > max[1] ? [day, count] : max, ['', 0]);
  const leastBusyDay = dayCounts.reduce((min, [day, count]) => count < min[1] ? [day, count] : min, ['', Infinity]);

  // Calculate average bookings per day
  const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const avgBookingsPerDay = daysInPeriod > 0 ? totalBookings / daysInPeriod : 0;

  // Calculate average duration of booked slots
  const completedWithDuration = bookings.filter(b => b.duration);
  const avgBookingDuration = completedWithDuration.length > 0
    ? completedWithDuration.reduce((sum, b) => sum + (b.duration || 0), 0) / completedWithDuration.length
    : 60;

  return res.json({
    success: true,
    data: {
      period,
      dateRange: {
        start: startDate,
        end: endDate,
      },
      summary: {
        totalAvailableSlots: totalWeeklySlots,
        totalBookings,
        completedBookings,
        cancelledBookings,
        confirmedBookings,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
        avgBookingsPerDay: Math.round(avgBookingsPerDay * 100) / 100,
        avgBookingDuration: Math.round(avgBookingDuration),
      },
      bookingsByDayOfWeek,
      busiestDay: {
        day: mostBusyDay[0],
        bookings: mostBusyDay[1],
      },
      quietestDay: {
        day: leastBusyDay[0],
        bookings: leastBusyDay[1] === Infinity ? 0 : leastBusyDay[1],
      },
      generatedAt: new Date().toISOString(),
    },
  });
});