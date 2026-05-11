import ProviderProfile from '../models/providerProfile.model';
import Booking from '../models/booking.model';

interface ValidateSlotParams {
  providerId: string;
  scheduledDate: string | Date;
  scheduledTime: string;
  serviceDurationMinutes: number;
}

interface ValidateSlotResult {
  isValid: boolean;
  errorMessage?: string;
  errorCode?: 'NO_PROFILE' | 'NOT_AVAILABLE_DAY' | 'DATE_EXCEPTION' | 'NOT_IN_SLOT' | 'PAST_SLOT' | 'CONFLICT';
  availableSlots?: string[];
}

const DAYS_OF_WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export async function validateProviderSlotAvailability({
  providerId,
  scheduledDate,
  scheduledTime,
  serviceDurationMinutes
}: ValidateSlotParams): Promise<ValidateSlotResult> {
  const providerProfile = await ProviderProfile.findOne({ userId: providerId });

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
  const schedule = providerProfile.availability.schedule;
  const daySchedule = schedule[dayOfWeek as keyof typeof schedule];

  // Check day-of-week availability
  if (!daySchedule?.isAvailable || !daySchedule.timeSlots || daySchedule.timeSlots.length === 0) {
    return {
      isValid: false,
      errorMessage: 'Provider is not available on this day',
      errorCode: 'NOT_AVAILABLE_DAY',
      availableSlots: []
    };
  }

  // Check date exceptions
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
  const requestedEndMinutes = requestedMinutes + serviceDurationMinutes;

  const isWithinTimeSlot = daySchedule.timeSlots.some((slot: any) => {
    if (!slot.startTime || !slot.endTime) return false;
    if (slot.isBooked) return false;
    if (slot.maxBookings && slot.currentBookings >= slot.maxBookings) return false;

    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);
    return requestedMinutes >= slotStart && requestedEndMinutes <= slotEnd;
  });

  // Filter past slots for today
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
        availableSlots: generateAvailableSlots(daySchedule.timeSlots, serviceDurationMinutes, currentMinutes + bufferMinutes, isToday)
      };
    }
  }

  if (!isWithinTimeSlot) {
    const minCutoff = isToday ? (now.getHours() * 60 + now.getMinutes() + 60) : 0;
    return {
      isValid: false,
      errorMessage: 'Provider is not available at the requested time',
      errorCode: 'NOT_IN_SLOT',
      availableSlots: generateAvailableSlots(daySchedule.timeSlots, serviceDurationMinutes, minCutoff, isToday)
    };
  }

  // Check for conflicting existing bookings
  const startOfDay = new Date(requestedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(requestedDate);
  endOfDay.setHours(23, 59, 59, 999);

  const existingBookings = await Booking.find({
    providerId,
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['pending', 'confirmed', 'in_progress'] }
  });

  const conflict = existingBookings.find(booking => {
    const bookingStart = timeToMinutes(booking.scheduledTime);
    const bookingEnd = bookingStart + booking.duration;
    return requestedMinutes < bookingEnd && requestedEndMinutes > bookingStart;
  });

  if (conflict) {
    return {
      isValid: false,
      errorMessage: 'Time slot is already booked',
      errorCode: 'CONFLICT'
    };
  }

  return { isValid: true };
}

function generateAvailableSlots(
  timeSlots: any[],
  durationMinutes: number,
  minCutoffMinutes: number,
  filterPast: boolean
): string[] {
  const slots: string[] = [];

  for (const slot of timeSlots) {
    if (!slot.startTime || !slot.endTime) continue;
    if (slot.isBooked) continue;
    if (slot.maxBookings && slot.currentBookings >= slot.maxBookings) continue;

    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = timeToMinutes(slot.endTime);

    for (let minutes = slotStart; minutes + durationMinutes <= slotEnd; minutes += 30) {
      if (filterPast && minutes < minCutoffMinutes) continue;
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }

  return slots;
}
