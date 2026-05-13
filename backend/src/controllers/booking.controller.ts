import { Request, Response } from 'express';
import { bookingService } from '../services/booking.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { eventBus, EVENT_TYPES } from '../event-bus';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import Joi from 'joi';
import logger from '../utils/logger';

// Email service imports
import {
  sendBookingConfirmation,
  sendBookingCancellation,
  sendBookingReminder,
  sendBookingRescheduled,
} from '../services/email.service';

// ============================================
// Validation Schemas
// ============================================

const locationSchema = Joi.object({
  type: Joi.string().valid('customer_address', 'provider_location', 'hotel').required(),
  address: Joi.object({
    street: Joi.string(),
    city: Joi.string(),
    state: Joi.string(),
    zipCode: Joi.string(),
    country: Joi.string(),
  }),
  notes: Joi.string(),
});

const customerInfoSchema = Joi.object({
  firstName: Joi.string(),
  lastName: Joi.string(),
  email: Joi.string().email(),
  phone: Joi.string(),
  specialRequests: Joi.string(),
  accessInstructions: Joi.string(),
});

const addOnSchema = Joi.object({
  id: Joi.string(),
  name: Joi.string().required(),
  price: Joi.number().required(),
  description: Joi.string(),
});

const bookingInputSchema = Joi.object({
  serviceId: Joi.string().required(),
  providerId: Joi.string().required(),
  scheduledDate: Joi.string().required(),
  scheduledTime: Joi.string().required(),
  location: locationSchema.required(),
  customerInfo: customerInfoSchema,
  addOns: Joi.array().items(addOnSchema),
  specialRequests: Joi.string(),
  metadata: Joi.object({
    bookingSource: Joi.string(),
    deviceType: Joi.string(),
    sessionId: Joi.string(),
  }),
  locationType: Joi.string().valid('at_home', 'at_provider', 'at_hotel'),
  selectedDuration: Joi.number(),
  genderPreference: Joi.string().valid('male', 'female', 'no_preference').default('no_preference'),
  experiencePreference: Joi.string().valid('no_preference', 'specific', 'any_experience').default('no_preference'),
  paymentMethod: Joi.string(),
});

const guestInfoSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().required(),
});

const guestBookingInputSchema = Joi.object({
  serviceId: Joi.string().required(),
  providerId: Joi.string().required(),
  scheduledDate: Joi.string().required(),
  scheduledTime: Joi.string().required(),
  location: locationSchema,
  guestInfo: guestInfoSchema.required(),
  addOns: Joi.array().items(addOnSchema),
  specialRequests: Joi.string(),
  metadata: Joi.object(),
  locationType: Joi.string().valid('at_home', 'at_provider', 'at_hotel'),
  selectedDuration: Joi.number(),
  genderPreference: Joi.string().valid('male', 'female', 'no_preference').default('no_preference'),
  experiencePreference: Joi.string().valid('no_preference', 'specific', 'any_experience').default('no_preference'),
  paymentMethod: Joi.string(),
});

const bookingFiltersSchema = Joi.object({
  status: Joi.string(),
  page: Joi.number().min(1),
  limit: Joi.number().min(1).max(100),
  startDate: Joi.string(),
  endDate: Joi.string(),
});

const acceptBookingSchema = Joi.object({
  notes: Joi.string(),
  estimatedArrival: Joi.string(),
});

const rejectBookingSchema = Joi.object({
  reason: Joi.string(),
});

const cancelBookingSchema = Joi.object({
  reason: Joi.string(),
});

const completeBookingSchema = Joi.object({
  notes: Joi.string(),
  actualDuration: Joi.number(),
});

const addMessageSchema = Joi.object({
  message: Joi.string().required().min(1),
});

const rescheduleBookingSchema = Joi.object({
  scheduledDate: Joi.string().required(),
  scheduledTime: Joi.string().required(),
  reason: Joi.string(),
});

// ============================================
// Email Notification Helper
// ============================================

interface BookingNotificationData {
  bookingNumber: string;
  serviceName: string;
  providerName: string;
  providerEmail: string;
  customerName: string;
  customerEmail: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  location: string;
  totalAmount: number;
  currency: string;
  status: string;
  specialRequests?: string;
  providerNotes?: string;
}

/**
 * Format booking data for email notifications
 */
const formatBookingForEmail = async (booking: any): Promise<BookingNotificationData | null> => {
  try {
    // Get service name
    const service = await Service.findById(booking.serviceId).select('name duration').lean();
    if (!service) {
      logger.warn('Service not found for booking email', { bookingId: booking._id });
      return null;
    }

    // Get customer info
    let customerName = '';
    let customerEmail = '';

    if (booking.isGuestBooking && booking.guestInfo) {
      customerName = booking.guestInfo.name;
      customerEmail = booking.guestInfo.email;
    } else if (booking.customerId) {
      const customer = await User.findById(booking.customerId).select('firstName lastName email').lean();
      if (customer) {
        customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer';
        customerEmail = customer.email || '';
      }
    }

    // Get provider info
    const provider = await User.findById(booking.providerId).select('firstName lastName email').lean();
    if (!provider) {
      logger.warn('Provider not found for booking email', { bookingId: booking._id });
      return null;
    }

    const providerName = `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || 'Provider';
    const providerEmail = provider.email || '';

    // Format location
    let location = 'Location not specified';
    if (booking.location?.address) {
      const addr = booking.location.address;
      location = [addr.street, addr.city, addr.state].filter(Boolean).join(', ') || 'Location specified';
    }

    // Format date
    const scheduledDate = new Date(booking.scheduledDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      bookingNumber: booking.bookingNumber,
      serviceName: service.name || 'Service',
      providerName,
      providerEmail,
      customerName,
      customerEmail,
      scheduledDate,
      scheduledTime: booking.scheduledTime,
      duration: booking.duration || service.duration || 60,
      location,
      totalAmount: booking.pricing?.totalAmount || 0,
      currency: booking.pricing?.currency || 'AED',
      status: booking.status,
      specialRequests: booking.customerInfo?.specialRequests,
      providerNotes: booking.providerResponse?.notes,
    };
  } catch (error) {
    logger.error('Error formatting booking for email', {
      bookingId: booking._id,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

/**
 * Send email notification with error handling
 */
const sendEmailNotification = async (
  emailFn: (data: BookingNotificationData) => Promise<void>,
  booking: any,
  notificationType: string
): Promise<void> => {
  try {
    const emailData = await formatBookingForEmail(booking);
    if (emailData && emailData.customerEmail && emailData.providerEmail) {
      await emailFn(emailData);
      logger.info(`${notificationType} email notification sent`, {
        bookingNumber: booking.bookingNumber,
      });
    }
  } catch (error) {
    // Log but don't fail the booking action
    logger.error(`Failed to send ${notificationType} email`, {
      bookingNumber: booking.bookingNumber,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

// ============================================
// Customer Booking Operations
// ============================================

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  // Validate customer authorization
  if (req.user?.role !== 'customer') {
    throw new ApiError(403, 'Only customers can create bookings');
  }

  const { error, value } = bookingInputSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const customerId = (req.user as any)._id.toString();
  const result = await bookingService.createCustomerBooking(customerId, value);

  // Publish booking.created event
  await eventBus.publish(EVENT_TYPES.BOOKING_CREATED, {
    bookingId: result.booking._id.toString(),
    customerId,
    providerId: value.providerId,
    amount: result.booking.pricing?.totalAmount,
    bookingNumber: result.booking.bookingNumber,
    serviceId: value.serviceId,
    scheduledDate: value.scheduledDate,
    scheduledTime: value.scheduledTime,
  }, {
    userId: customerId,
    sessionId: req.body.metadata?.sessionId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({
    success: true,
    message: 'Booking request submitted, awaiting provider confirmation',
    data: { booking: result.booking },
  });
});

export const getCustomerBookings = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'customer') {
    throw new ApiError(403, 'Access denied');
  }

  const { error, value } = bookingFiltersSchema.validate(req.query);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const customerId = (req.user as any)._id.toString();
  const result = await bookingService.getCustomerBookings(customerId, value);

  res.json({
    success: true,
    data: result,
  });
});

export const getBookingDetails = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as any;

  const booking = await bookingService.getBookingById(id, user._id.toString(), user.role);

  res.json({
    success: true,
    data: { booking },
  });
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'customer') {
    throw new ApiError(403, 'Only customers can cancel bookings');
  }

  const { id } = req.params;
  const { error, value } = cancelBookingSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const customerId = (req.user as any)._id.toString();
  const result = await bookingService.cancelBooking(id, customerId, value);

  // Publish booking.cancelled event
  await eventBus.publish(EVENT_TYPES.BOOKING_CANCELLED, {
    bookingId: id,
    cancelledBy: customerId,
    reason: value.reason || null,
    bookingNumber: result.booking?.bookingNumber,
    customerId,
    providerId: result.booking?.providerId?.toString(),
    refundAmount: result.refundAmount,
  }, {
    userId: customerId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Send booking cancellation email to provider
  if (result.booking) {
    await sendEmailNotification(
      async (emailData) => {
        await sendBookingCancellation(emailData, 'customer');
      },
      result.booking,
      'Booking Cancellation'
    );
  }

  res.json({
    success: true,
    message: 'Booking cancelled successfully',
    data: {
      booking: result.booking,
      refundAmount: result.refundAmount,
      refundProcessingTime: result.refundProcessingTime,
    },
  });
});

export const rescheduleBooking = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { error, value } = rescheduleBookingSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  // Get the current booking to capture the old date
  const currentBooking = await Booking.findById(id);
  const oldDate = currentBooking
    ? new Date(currentBooking.scheduledDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const user = req.user as any;
  const booking = await bookingService.rescheduleBooking(
    id,
    user._id.toString(),
    user.role,
    value
  );

  // Publish booking.rescheduled event
  await eventBus.publish(EVENT_TYPES.BOOKING_RESCHEDULED, {
    bookingId: id,
    bookingNumber: booking.bookingNumber,
    customerId: booking.customerId?.toString(),
    providerId: booking.providerId?.toString(),
    newDate: booking.scheduledDate,
    newTime: booking.scheduledTime,
    oldDate,
    reason: value.reason,
  }, {
    userId: user._id.toString(),
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Send booking rescheduled email
  const newDate = new Date(booking.scheduledDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  await sendEmailNotification(
    async (emailData) => {
      await sendBookingRescheduled(emailData, oldDate, newDate);
    },
    booking,
    'Booking Rescheduled'
  );

  res.json({
    success: true,
    message: 'Booking rescheduled successfully',
    data: { booking },
  });
});

// ============================================
// Provider Booking Operations
// ============================================

export const getProviderBookings = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  if (req.user.role !== 'provider') {
    throw new ApiError(403, 'Access denied. Only providers can access this endpoint');
  }

  const { error, value } = bookingFiltersSchema.validate(req.query);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const providerId = (req.user as any)._id.toString();
  const result = await bookingService.getProviderBookings(providerId, value);

  res.json({
    success: true,
    data: result,
  });
});

export const acceptBooking = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    throw new ApiError(403, 'Only providers can accept bookings');
  }

  const { id } = req.params;
  const { error, value } = acceptBookingSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const providerId = (req.user as any)._id.toString();
  const booking = await bookingService.acceptBooking(id, providerId, value);

  // Publish booking.confirmed event
  await eventBus.publish(EVENT_TYPES.BOOKING_CONFIRMED, {
    bookingId: id,
    providerId,
    bookingNumber: booking.bookingNumber,
    customerId: booking.customerId?.toString(),
    estimatedArrival: value.estimatedArrival,
  }, {
    userId: providerId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  // Send booking confirmation email
  await sendEmailNotification(sendBookingConfirmation, booking, 'Booking Confirmation');

  res.json({
    success: true,
    message: 'Booking accepted successfully',
    data: { booking },
  });
});

export const rejectBooking = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    throw new ApiError(403, 'Only providers can reject bookings');
  }

  const { id } = req.params;
  const { error, value } = rejectBookingSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const providerId = (req.user as any)._id.toString();
  const booking = await bookingService.rejectBooking(id, providerId, value);

  // Publish booking.rejected event
  await eventBus.publish(EVENT_TYPES.BOOKING_REJECTED, {
    bookingId: id,
    providerId,
    reason: value.reason || null,
    bookingNumber: booking.bookingNumber,
    customerId: booking.customerId?.toString(),
  }, {
    userId: providerId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({
    success: true,
    message: 'Booking rejected successfully',
    data: { booking },
  });
});

export const startBooking = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    throw new ApiError(403, 'Only providers can start bookings');
  }

  const { id } = req.params;
  const { error, value } = Joi.object({ notes: Joi.string() }).validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const providerId = (req.user as any)._id.toString();
  const booking = await bookingService.startBooking(id, providerId, value);

  res.json({
    success: true,
    message: 'Booking started successfully',
    data: { booking },
  });
});

export const completeBooking = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    throw new ApiError(403, 'Only providers can complete bookings');
  }

  const { id } = req.params;
  const { error, value } = completeBookingSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const providerId = (req.user as any)._id.toString();
  const booking = await bookingService.completeBooking(id, providerId, value);

  // Publish booking.completed event
  await eventBus.publish(EVENT_TYPES.BOOKING_COMPLETED, {
    bookingId: id,
    customerId: booking.customerId?.toString(),
    providerId,
    amount: booking.pricing?.totalAmount,
    bookingNumber: booking.bookingNumber,
    notes: value.notes,
    actualDuration: value.actualDuration,
    serviceId: booking.serviceId?.toString(),
  }, {
    userId: providerId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({
    success: true,
    message: 'Booking marked as completed successfully',
    data: { booking },
  });
});

// ============================================
// Communication
// ============================================

export const addBookingMessage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { error, value } = addMessageSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const user = req.user as any;
  const messageCount = await bookingService.addMessage(id, user._id.toString(), value);

  res.json({
    success: true,
    message: 'Message added successfully',
    data: { messageCount },
  });
});

// Mark all messages as read for a booking
export const markMessagesAsRead = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as any;

  const booking = await Booking.findById(id);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  // Mark all unread messages from the other party as read
  const isCustomer = booking.customerId?.toString() === user._id.toString();
  const isProvider = booking.providerId?.toString() === user._id.toString();

  if (!isCustomer && !isProvider) {
    throw new ApiError(403, 'Not authorized to view this booking');
  }

  const unreadField = isCustomer ? 'readByCustomer' : 'readByProvider';

  // Update all messages where the other party sent them
  await Booking.updateOne(
    { _id: id },
    { $set: { [unreadField]: true } }
  );

  res.json({
    success: true,
    message: 'Messages marked as read',
  });
});

// ============================================
// Guest Booking
// ============================================

export const createGuestBooking = asyncHandler(async (req: Request, res: Response) => {
  const { error, value } = guestBookingInputSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const result = await bookingService.createGuestBooking(value);

  res.status(201).json({
    success: true,
    message: 'Guest booking submitted successfully',
    data: result,
  });
});

// ============================================
// Public Endpoints
// ============================================

export const trackBooking = asyncHandler(async (req: Request, res: Response) => {
  const { bookingNumber } = req.params;

  if (!bookingNumber) {
    throw new ApiError(400, 'Booking number is required');
  }

  const result = await bookingService.trackBooking(bookingNumber);

  res.json({
    success: true,
    data: result,
  });
});

// ============================================
// Export
// ============================================

export default {
  createBooking,
  getCustomerBookings,
  getBookingDetails,
  cancelBooking,
  rescheduleBooking,
  getProviderBookings,
  acceptBooking,
  rejectBooking,
  startBooking,
  completeBooking,
  addBookingMessage,
  markMessagesAsRead,
  createGuestBooking,
  trackBooking,
};
