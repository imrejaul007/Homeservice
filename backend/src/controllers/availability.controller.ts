import { Request, Response } from 'express';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import { asyncHandler } from '../utils/asyncHandler';
import { REGIONS } from '../services/region.service';
import logger from '../utils/logger';

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
    dateOverrides: updatedProfile!.availability.exceptions.map(exception => ({
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

  providerProfile.availability.exceptions.push({
    date: new Date(date),
    type: isAvailable === false ? 'unavailable' : 'custom_hours',
    reason: reason || (isAvailable === false ? 'Unavailable' : 'Custom hours'),
    notes: req.body.notes || undefined
  });

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

  const { date } = req.params;

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
  const normalizedParamDate = date.split('T')[0];

  providerProfile.availability.exceptions = providerProfile.availability.exceptions.filter(
    exception => normalizeDateString(exception.date) !== normalizedParamDate
  );

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
  const { date, duration = '60' } = req.query;

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

  const requestDate = new Date(date as string);
  const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][requestDate.getDay()];

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });

  if (!providerProfile || !providerProfile.availability?.schedule) {
    return res.json({
      success: true,
      data: { slots: [] }
    });
  }

  const daySchedule = providerProfile.availability.schedule[dayOfWeek as keyof typeof providerProfile.availability.schedule];

  if (!daySchedule?.isAvailable || !daySchedule.timeSlots) {
    return res.json({
      success: true,
      data: { slots: [] }
    });
  }

  const dateString = requestDate.toISOString().split('T')[0];
  const dateException = providerProfile.availability.exceptions.find(
    exception => exception.date.toISOString().split('T')[0] === dateString
  );

  if (dateException && dateException.type === 'unavailable') {
    return res.json({
      success: true,
      data: { slots: [] }
    });
  }

  const startOfDay = new Date(requestDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(requestDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existingBookings = await Booking.find({
    providerId,
    scheduledDate: {
      $gte: startOfDay,
      $lte: endOfDay
    },
    status: { $in: ['pending', 'confirmed', 'in_progress'] }
  });

  const availableSlots: string[] = [];
  const slotDuration = parseInt(duration as string);

  // Filter past slots for today
  const now = new Date();
  const isToday = requestDate.toISOString().split('T')[0] === now.toISOString().split('T')[0];
  const nowMs = now.getTime();

  for (const timeSlot of daySchedule.timeSlots) {
    if (!timeSlot.startTime || !timeSlot.endTime) {
      continue;
    }

    if (timeSlot.isBooked || timeSlot.currentBookings >= (timeSlot.maxBookings || 1)) {
      continue;
    }

    try {
      const startHour = parseInt(timeSlot.startTime.split(':')[0]);
      const startMinute = parseInt(timeSlot.startTime.split(':')[1]);
      const endHour = parseInt(timeSlot.endTime.split(':')[0]);
      const endMinute = parseInt(timeSlot.endTime.split(':')[1]);

      let currentTime = new Date(requestDate);
      currentTime.setHours(startHour, startMinute, 0, 0);

      const slotEndTime = new Date(requestDate);
      slotEndTime.setHours(endHour, endMinute, 0, 0);

      while (currentTime.getTime() + slotDuration * 60 * 1000 <= slotEndTime.getTime()) {
        const slotStart = new Date(currentTime);
        const slotEnd = new Date(currentTime.getTime() + slotDuration * 60 * 1000);

        // Skip past slots for today
        if (isToday && slotStart.getTime() <= nowMs) {
          currentTime.setTime(currentTime.getTime() + slotDuration * 60 * 1000);
          continue;
        }

        const hasConflict = existingBookings.some(booking => {
          const bookingStart = new Date(booking.scheduledDate);
          const bookingEnd = new Date(booking.estimatedEndTime);
          return (slotStart < bookingEnd && slotEnd > bookingStart);
        });

        if (!hasConflict) {
          const timeString = slotStart.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
          });

          if (!availableSlots.includes(timeString)) {
            availableSlots.push(timeString);
          }
        }

        currentTime.setTime(currentTime.getTime() + slotDuration * 60 * 1000);
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
    data: { slots: availableSlots }
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