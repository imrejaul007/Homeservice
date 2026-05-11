import { Request, Response } from 'express';
import ProviderProfile from '../models/providerProfile.model';
import Booking from '../models/booking.model';
import { asyncHandler } from '../utils/asyncHandler';

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
    providerProfile = new ProviderProfile({
      userId: req.user?._id,
      availability: {
        schedule: createDefaultSchedule(),
        exceptions: [],
        bufferTime: 15,
        maxAdvanceBooking: 30,
        minNoticeTime: 24,
        autoAcceptBookings: false
      }
    });
    await providerProfile.save();
  } else if (!providerProfile.availability || !providerProfile.availability.schedule) {
    providerProfile.availability = {
      schedule: createDefaultSchedule(),
      exceptions: [],
      bufferTime: 15,
      maxAdvanceBooking: 30,
      minNoticeTime: 24,
      autoAcceptBookings: false
    };
    await providerProfile.save();
  }

  const legacyAvailability = {
    _id: providerProfile._id,
    providerId: providerProfile.userId,
    weeklySchedule: transformToLegacyFormat(providerProfile.availability.schedule),
    dateOverrides: providerProfile.availability.exceptions.map(exception => ({
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.reason,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: 'Asia/Kolkata',
    bufferTime: providerProfile.availability.bufferTime,
    autoAcceptBookings: providerProfile.availability.autoAcceptBookings,
    maxAdvanceBookingDays: providerProfile.availability.maxAdvanceBooking
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

  let providerProfile = await ProviderProfile.findOne({ userId: req.user?._id });

  if (!providerProfile) {
    providerProfile = new ProviderProfile({
      userId: req.user?._id,
      availability: {
        schedule: transformToProviderProfile(weeklySchedule),
        exceptions: [],
        bufferTime: 15,
        maxAdvanceBooking: 30,
        minNoticeTime: 24,
        autoAcceptBookings: false
      }
    });
  } else {
    if (!providerProfile.availability) {
      providerProfile.availability = {
        schedule: {},
        exceptions: [],
        bufferTime: 15,
        maxAdvanceBooking: 30,
        minNoticeTime: 24,
        autoAcceptBookings: false
      };
    }
    providerProfile.availability.schedule = transformToProviderProfile(weeklySchedule);
  }

  await providerProfile.save();

  const legacyAvailability = {
    _id: providerProfile._id,
    providerId: providerProfile.userId,
    weeklySchedule: transformToLegacyFormat(providerProfile.availability.schedule),
    dateOverrides: providerProfile.availability.exceptions.map(exception => ({
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.reason,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: 'Asia/Kolkata',
    bufferTime: providerProfile.availability.bufferTime,
    autoAcceptBookings: providerProfile.availability.autoAcceptBookings,
    maxAdvanceBookingDays: providerProfile.availability.maxAdvanceBooking
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

  providerProfile.availability.exceptions = providerProfile.availability.exceptions.filter(
    exception => exception.date.toISOString().split('T')[0] !== date
  );

  providerProfile.availability.exceptions.push({
    date: new Date(date),
    type: isAvailable === false ? 'unavailable' : 'custom_hours',
    reason: reason || (isAvailable === false ? 'Unavailable' : 'Custom hours')
  });

  await providerProfile.save();

  const legacyAvailability = {
    _id: providerProfile._id,
    providerId: providerProfile.userId,
    weeklySchedule: transformToLegacyFormat(providerProfile.availability.schedule),
    dateOverrides: providerProfile.availability.exceptions.map(exception => ({
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.reason,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: 'Asia/Kolkata',
    bufferTime: providerProfile.availability.bufferTime,
    autoAcceptBookings: providerProfile.availability.autoAcceptBookings,
    maxAdvanceBookingDays: providerProfile.availability.maxAdvanceBooking
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

  providerProfile.availability.exceptions = providerProfile.availability.exceptions.filter(
    exception => exception.date.toISOString().split('T')[0] !== date
  );

  await providerProfile.save();

  const legacyAvailability = {
    _id: providerProfile._id,
    providerId: providerProfile.userId,
    weeklySchedule: transformToLegacyFormat(providerProfile.availability.schedule),
    dateOverrides: providerProfile.availability.exceptions.map(exception => ({
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.reason,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: 'Asia/Kolkata',
    bufferTime: providerProfile.availability.bufferTime,
    autoAcceptBookings: providerProfile.availability.autoAcceptBookings,
    maxAdvanceBookingDays: providerProfile.availability.maxAdvanceBooking
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

  providerProfile.availability.exceptions.push({
    date: new Date(startDate),
    type: 'unavailable',
    reason: reason || 'Blocked period'
  });

  await providerProfile.save();

  const legacyAvailability = {
    _id: providerProfile._id,
    providerId: providerProfile.userId,
    weeklySchedule: transformToLegacyFormat(providerProfile.availability.schedule),
    dateOverrides: providerProfile.availability.exceptions.map(exception => ({
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.reason,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: 'Asia/Kolkata',
    bufferTime: providerProfile.availability.bufferTime,
    autoAcceptBookings: providerProfile.availability.autoAcceptBookings,
    maxAdvanceBookingDays: providerProfile.availability.maxAdvanceBooking
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

  providerProfile.availability.exceptions = providerProfile.availability.exceptions.filter(
    exception => exception.date.toISOString().split('T')[0] !== blockId
  );

  await providerProfile.save();

  const legacyAvailability = {
    _id: providerProfile._id,
    providerId: providerProfile.userId,
    weeklySchedule: transformToLegacyFormat(providerProfile.availability.schedule),
    dateOverrides: providerProfile.availability.exceptions.map(exception => ({
      date: exception.date,
      isAvailable: exception.type !== 'unavailable',
      reason: exception.reason,
      notes: exception.reason,
      createdAt: exception.date
    })),
    blockedPeriods: [],
    timezone: 'Asia/Kolkata',
    bufferTime: providerProfile.availability.bufferTime,
    autoAcceptBookings: providerProfile.availability.autoAcceptBookings,
    maxAdvanceBookingDays: providerProfile.availability.maxAdvanceBooking
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
      console.error('Error processing time slot:', timeSlot, error);
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