/**
 * ICS Calendar Service
 * Provides calendar export and sync functionality for bookings and availability
 */

import { generateIcs, parseIcs, createBookingEvent, IcsCalendar, IcsEvent } from '../utils/ics';
import Booking from '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import User from '../models/user.model';
import logger from '../utils/logger';

const ICS_PRODID = '-//Nilin//Home Services Platform//EN';

export interface ExportOptions {
  startDate?: Date;
  endDate?: Date;
  includePast?: boolean;
  format?: 'ics' | 'json';
}

/**
 * ICS Service for calendar sync
 */
export class IcsService {

  /**
   * Export provider bookings as ICS calendar
   */
  async exportProviderBookings(
    providerId: string,
    options: ExportOptions = {}
  ): Promise<string> {
    const { startDate, endDate, includePast = false } = options;

    // Build query
    const query: any = { providerId };

    // Filter by status
    query.status = { $in: ['pending', 'confirmed', 'in_progress', 'completed'] };

    // Date filters
    if (!includePast) {
      query.scheduledDate = { $gte: new Date() };
    } else if (startDate) {
      query.scheduledDate = { $gte: startDate };
    }

    if (endDate) {
      query.scheduledDate = {
        ...(query.scheduledDate || {}),
        $lte: endDate,
      };
    }

    // Fetch bookings
    const bookings = await Booking.find(query)
      .populate('serviceId', 'name')
      .populate('customerId', 'firstName lastName')
      .lean();

    // Get provider timezone
    const providerProfile = await ProviderProfile.findOne({ userId: providerId }).lean();
    const timezone = providerProfile?.locationInfo?.primaryAddress?.country === 'AE' ? 'Asia/Dubai' : 'UTC';

    // Convert bookings to ICS events
    const events: IcsEvent[] = bookings.map(booking => ({
      uid: `booking-${booking._id}@nilin.app`,
      summary: `${(booking.serviceId as any)?.name || 'Service'}${booking.customerId ? ` with ${((booking.customerId as any).firstName)} ${((booking.customerId as any).lastName || '')}`.trim() : ''}`,
      description: [
        `Booking ID: ${booking._id}`,
        `Status: ${booking.status}`,
        booking.location?.notes ? `Notes: ${booking.location.notes}` : '',
      ].filter(Boolean).join('\\n'),
      startDate: new Date(`${booking.scheduledDate.toISOString().split('T')[0]}T${booking.scheduledTime}`),
      endDate: booking.estimatedEndTime
        ? new Date(`${booking.scheduledDate.toISOString().split('T')[0]}T${booking.estimatedEndTime}`)
        : new Date(new Date(`${booking.scheduledDate.toISOString().split('T')[0]}T${booking.scheduledTime}`).getTime() + 60 * 60 * 1000),
      location: booking.location?.address
        ? `${booking.location.address.street}, ${booking.location.address.city}`
        : undefined,
      categories: ['booking', 'nilin'],
    }));

    const calendar: IcsCalendar = {
      prodId: ICS_PRODID,
      events,
      timezone,
    };

    logger.info('Exported provider bookings to ICS', {
      context: 'IcsService',
      action: 'EXPORT_BOOKINGS',
      providerId,
      eventCount: events.length,
    });

    return generateIcs(calendar);
  }

  /**
   * Export provider availability as ICS calendar
   */
  async exportProviderAvailability(providerId: string): Promise<string> {
    const providerProfile = await ProviderProfile.findOne({ userId: providerId });

    if (!providerProfile?.availability?.schedule) {
      throw new Error('Provider availability not configured');
    }

    const schedule = providerProfile.availability.schedule;
    const timezone = providerProfile.locationInfo?.primaryAddress?.country === 'AE' ? 'Asia/Dubai' : 'UTC';

    const events: IcsEvent[] = [];
    const dayMap: Record<string, string> = {
      monday: 'MO', tuesday: 'TU', wednesday: 'WE',
      thursday: 'TH', friday: 'FR', saturday: 'SA', sunday: 'SU'
    };

    // Generate recurring events for each day
    for (const [day, daySchedule] of Object.entries(schedule)) {
      if (!daySchedule.isAvailable || !daySchedule.timeSlots?.length) continue;

      for (const slot of daySchedule.timeSlots) {
        if (slot.isBooked) continue; // Skip booked slots

        const [startHour, startMin] = slot.startTime.split(':').map(Number);
        const [endHour, endMin] = slot.endTime.split(':').map(Number);

        // Create a reference date (next occurrence of this day)
        const today = new Date();
        const dayIndex = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(day);
        const daysUntil = (dayIndex - today.getDay() + 7) % 7 || 7;
        const refDate = new Date(today);
        refDate.setDate(today.getDate() + daysUntil);
        refDate.setHours(startHour, startMin, 0, 0);

        const refEndDate = new Date(refDate);
        refEndDate.setHours(endHour, endMin, 0, 0);

        events.push({
          uid: `avail-${providerId}-${day}-${slot.startTime}@nilin.app`,
          summary: 'Available Slot',
          description: `Provider availability slot`,
          startDate: refDate,
          endDate: refEndDate,
          recurrence: `FREQ=WEEKLY;BYDAY=${dayMap[day] || day.substring(0, 2).toUpperCase()}`,
          categories: ['availability', 'nilin'],
        });
      }
    }

    const calendar: IcsCalendar = {
      prodId: ICS_PRODID,
      events,
      timezone,
    };

    logger.info('Exported provider availability to ICS', {
      context: 'IcsService',
      action: 'EXPORT_AVAILABILITY',
      providerId,
      eventCount: events.length,
    });

    return generateIcs(calendar);
  }

  /**
   * Generate booking confirmation ICS for customer
   */
  async generateBookingConfirmation(bookingId: string): Promise<string | null> {
    const booking = await Booking.findById(bookingId)
      .populate('serviceId', 'name duration')
      .populate('providerId', 'userId')
      .populate('customerId', 'firstName lastName email phone')
      .lean();

    if (!booking) {
      logger.warn('Booking not found for ICS confirmation', { bookingId });
      return null;
    }

    const service = booking.serviceId as any;
    const provider = booking.providerId as any;
    const customer = booking.customerId as any;

    // Get provider profile for location info
    const providerProfile = provider?.userId
      ? await ProviderProfile.findOne({ userId: provider.userId }).lean()
      : null;
    const timezone = providerProfile?.locationInfo?.primaryAddress?.country === 'AE' ? 'Asia/Dubai' : 'UTC';

    const startDate = new Date(`${booking.scheduledDate.toISOString().split('T')[0]}T${booking.scheduledTime}`);
    const endDate = booking.estimatedEndTime
      ? new Date(`${booking.scheduledDate.toISOString().split('T')[0]}T${booking.estimatedEndTime}`)
      : new Date(startDate.getTime() + (service?.duration || 60) * 60 * 1000);

    const event: IcsEvent = {
      uid: `booking-${booking._id}@nilin.app`,
      summary: service?.name || 'Service Appointment',
      description: [
        `Booking ID: ${booking._id}`,
        `Provider: ${provider?.businessInfo?.businessName || 'TBD'}`,
        customer ? `Customer: ${customer.firstName} ${customer.lastName || ''}` : '',
        customer?.phone ? `Phone: ${customer.phone}` : '',
        booking.location?.notes ? `Notes: ${booking.location.notes}` : '',
      ].filter(Boolean).join('\\n'),
      startDate,
      endDate,
      location: booking.location?.address
        ? `${booking.location.address.street}, ${booking.location.address.city}, ${booking.location.address.zipCode || ''}`
        : undefined,
      organizer: 'noreply@nilin.app',
      attendees: customer?.email ? [customer.email] : undefined,
      categories: ['booking-confirmation', 'nilin'],
    };

    const calendar: IcsCalendar = {
      prodId: ICS_PRODID,
      events: [event],
      timezone,
    };

    logger.info('Generated booking confirmation ICS', {
      context: 'IcsService',
      action: 'GENERATE_CONFIRMATION',
      bookingId,
    });

    return generateIcs(calendar);
  }

  /**
   * Parse imported ICS and extract events
   */
  parseImportedIcs(icsContent: string): { events: IcsEvent[]; errors: string[] } {
    const errors: string[] = [];

    try {
      const calendar = parseIcs(icsContent);
      return { events: calendar.events, errors };
    } catch (error) {
      logger.error('Failed to parse ICS content', {
        context: 'IcsService',
        action: 'PARSE_ICS_ERROR',
        error: error instanceof Error ? error.message : String(error),
      });
      errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { events: [], errors };
    }
  }
}

// Export singleton instance
export const icsService = new IcsService();
export default icsService;
