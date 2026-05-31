import { Request, Response } from 'express';
import { bookingService } from '../services/booking.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { eventBus, EVENT_TYPES } from '../event-bus';
import Booking from '../models/booking.model';
import User, { IUser } from '../models/user.model';
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
    // FIX: Make idempotencyKey REQUIRED to prevent double-booking
    idempotencyKey: Joi.string()
      .min(16)
      .max(64)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .required()
      .messages({
        'string.min': 'Idempotency key must be at least 16 characters',
        'string.max': 'Idempotency key cannot exceed 64 characters',
        'any.required': 'Idempotency key is required to prevent duplicate bookings'
      })
  }).required(),
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
  metadata: Joi.object({
    bookingSource: Joi.string(),
    deviceType: Joi.string(),
    sessionId: Joi.string(),
    // FIX: Make idempotencyKey REQUIRED for guest bookings too
    idempotencyKey: Joi.string()
      .min(16)
      .max(64)
      .pattern(/^[a-zA-Z0-9_-]+$/)
      .required()
      .messages({
        'string.min': 'Idempotency key must be at least 16 characters',
        'string.max': 'Idempotency key cannot exceed 64 characters',
        'any.required': 'Idempotency key is required to prevent duplicate bookings'
      })
  }).required(),
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
  sortBy: Joi.string().valid('createdAt', 'scheduledDate', 'status', 'totalAmount', 'updatedAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().min(1).max(200),
}).options({ stripUnknown: true });

const acceptBookingSchema = Joi.object({
  notes: Joi.string(),
  estimatedArrival: Joi.string(),
});

const rejectBookingSchema = Joi.object({
  reason: Joi.string(),
});

const cancelBookingSchema = Joi.object({
  reason: Joi.string(),
  // FIX: Add cancellationToken for guest bookings
  cancellationToken: Joi.string(),
  email: Joi.string().email(),
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

const reportProviderNoShowSchema = Joi.object({
  notes: Joi.string().max(1000).optional().messages({
    'string.max': 'Notes cannot exceed 1000 characters',
  }),
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
 * Uses pre-populated data if available, otherwise fetches in parallel
 */
const formatBookingForEmail = async (
  booking: any,
  prePopulated?: { service?: any; customer?: any; provider?: any }
): Promise<BookingNotificationData | null> => {
  try {
    // Use pre-populated data if available, otherwise batch fetch in parallel
    let service = prePopulated?.service;
    let provider = prePopulated?.provider;
    let customer: any = prePopulated?.customer;

    // Parallel fetch for any missing data
    const [serviceData, providerData, customerData] = await Promise.all([
      // Get service
      Promise.resolve(service || booking.service || booking._doc?.service).then(async (s) => {
        if (s) return s;
        if (booking.serviceId) {
          const services = await Service.find({ _id: booking.serviceId }).select('name duration').lean();
          return services[0];
        }
        return null;
      }),
      // Get provider
      Promise.resolve(provider || booking.provider || booking._doc?.provider).then(async (p) => {
        if (p) return p;
        if (booking.providerId) {
          const providers = await User.find({ _id: booking.providerId }).select('firstName lastName email').lean();
          return providers[0];
        }
        return null;
      }),
      // Get customer
      Promise.resolve(customer || booking.customer || booking._doc?.customer).then(async (c) => {
        if (c) return c;
        if (booking.customerId) {
          const customers = await User.find({ _id: booking.customerId }).select('firstName lastName email').lean();
          return customers[0];
        }
        return null;
      }),
    ]);

    service = serviceData;
    provider = providerData;
    customer = customerData;

    if (!service) {
      logger.warn('Service not found for booking email', { bookingId: booking._id });
      return null;
    }

    if (!provider) {
      logger.warn('Provider not found for booking email', { bookingId: booking._id });
      return null;
    }

    // Get customer info
    let customerName = '';
    let customerEmail = '';

    if (booking.isGuestBooking && booking.guestInfo) {
      customerName = booking.guestInfo.name;
      customerEmail = booking.guestInfo.email;
    } else if (customer) {
      customerName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || 'Customer';
      customerEmail = customer.email || '';
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
 * Batch fetch related data for multiple bookings to avoid N+1 queries
 */
const prefetchBookingRelations = async (bookings: any[]): Promise<Map<string, { service?: any; customer?: any; provider?: any }>> => {
  const relationMap = new Map<string, { service?: any; customer?: any; provider?: any }>();

  if (!bookings.length) return relationMap;

  // Collect all IDs using Array.from to convert Set
  const serviceIds = Array.from(new Set(bookings.map(b => b.serviceId?.toString()).filter(Boolean)));
  const customerIds = Array.from(new Set(bookings.map(b => b.customerId?.toString()).filter(Boolean)));
  const providerIds = Array.from(new Set(bookings.map(b => b.providerId?.toString()).filter(Boolean)));

  // Batch fetch all related documents
  const [services, customers, providers] = await Promise.all([
    serviceIds.length ? Service.find({ _id: { $in: serviceIds } }).select('name duration').lean() : [],
    customerIds.length ? User.find({ _id: { $in: customerIds } }).select('firstName lastName email').lean() : [],
    providerIds.length ? User.find({ _id: { $in: providerIds } }).select('firstName lastName email').lean() : [],
  ]);

  // Create lookup maps using explicit set() calls to avoid type issues
  const serviceMap = new Map<string, any>();
  services.forEach(s => serviceMap.set(s._id.toString(), s));

  const customerMap = new Map<string, any>();
  customers.forEach(c => customerMap.set(c._id.toString(), c));

  const providerMap = new Map<string, any>();
  providers.forEach(p => providerMap.set(p._id.toString(), p));

  // Map relations to each booking
  for (const booking of bookings) {
    const serviceId = booking.serviceId?.toString();
    const customerId = booking.customerId?.toString();
    const providerId = booking.providerId?.toString();

    relationMap.set(booking._id.toString(), {
      service: serviceMap.get(serviceId),
      customer: customerMap.get(customerId),
      provider: providerMap.get(providerId),
    });
  }

  return relationMap;
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

  const customerId = (req.user as IUser)._id.toString();
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

  const customerId = (req.user as IUser)._id.toString();

  // CRITICAL: Pass tenant context to prevent cross-tenant data access
  const userRole = (req.user as IUser)?.role;
  const tenantContext = {
    tenantId: req.tenantId,
    isAdmin: userRole === 'admin'
  };

  const result = await bookingService.getCustomerBookings(customerId, value, { tenantContext });

  res.json({
    success: true,
    data: result,
  });
});

export const getBookingDetails = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as any;

  // SECURITY FIX: IDOR Prevention - Explicit ownership verification BEFORE delegating to service
  // Fetch booking directly to validate access before any operation
  const booking = await Booking.findById(id);
  if (!booking || booking.deletedAt) {
    throw new ApiError(404, 'Booking not found');
  }

  // Verify user has access to this booking
  const isOwner = booking.customerId?.toString() === user._id.toString();
  const isProvider = booking.providerId?.toString() === user._id.toString();
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  if (!isOwner && !isProvider && !isAdmin) {
    logger.warn('IDOR attempt detected in getBookingDetails', {
      action: 'IDOR_ATTEMPT',
      bookingId: id,
      userId: user._id,
      userRole: user.role,
    });
    throw new ApiError(403, 'Access denied. You do not have permission to view this booking.');
  }

  // Now delegate to service for consistent response formatting
  const result = await bookingService.getBookingById(id, user._id.toString(), user.role);

  res.json({
    success: true,
    data: { booking: result },
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

  const customerId = (req.user as IUser)._id.toString();
  // FIX: Pass cancellation token and email for guest booking cancellation
  const cancelData = {
    reason: value.reason,
    cancellationToken: value.cancellationToken,
    email: value.email,
  };
  const result = await bookingService.cancelBooking(id, customerId, cancelData);

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

  const user = req.user as any;

  // SECURITY FIX: IDOR Prevention - Explicit ownership verification BEFORE delegating to service
  // Fetch booking directly to validate access before any operation
  const currentBooking = await Booking.findById(id);
  if (!currentBooking || currentBooking.deletedAt) {
    throw new ApiError(404, 'Booking not found');
  }

  // Verify user has access to this booking
  const isOwner = currentBooking.customerId?.toString() === user._id.toString();
  const isProvider = currentBooking.providerId?.toString() === user._id.toString();
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';

  if (!isOwner && !isProvider && !isAdmin) {
    logger.warn('IDOR attempt detected in rescheduleBooking', {
      action: 'IDOR_ATTEMPT',
      bookingId: id,
      userId: user._id,
      userRole: user.role,
    });
    throw new ApiError(403, 'Access denied. You do not have permission to reschedule this booking.');
  }

  // Capture the old date for notification
  const oldDate = new Date(currentBooking.scheduledDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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
// Report Provider No-Show (Customer Reporting)
// ============================================

export const reportProviderNoShow = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'customer') {
    throw new ApiError(403, 'Only customers can report provider no-show');
  }

  const { id } = req.params;
  const { error, value } = reportProviderNoShowSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const customerId = (req.user as IUser)._id.toString();
  const booking = await bookingService.reportProviderNoShow(id, customerId, value.notes);

  // Publish booking.no_show event
  await eventBus.publish(EVENT_TYPES.BOOKING_NO_SHOW, {
    bookingId: id,
    bookingNumber: booking.bookingNumber,
    customerId,
    providerId: booking.providerId?.toString(),
    reportedBy: 'customer',
    reason: value.notes || 'Customer reported provider did not show up',
  }, {
    userId: customerId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.json({
    success: true,
    message: 'Provider no-show reported successfully. The provider has been flagged for review.',
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

  const providerId = (req.user as IUser)._id.toString();
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

  const providerId = (req.user as IUser)._id.toString();

  // SECURITY: Conflict detection before accepting booking
  // This prevents accepting a booking for a time slot that conflicts with existing bookings
  const conflictCheck = await bookingService.checkForTimeSlotConflicts(
    providerId,
    id,
    (req as any).booking?.scheduledDate,
    (req as any).booking?.scheduledTime,
    (req as any).booking?.duration
  );

  if (conflictCheck.hasConflict) {
    throw new ApiError(409, `Time slot conflict detected. You already have a booking (${conflictCheck.conflictingBookingNumber}) scheduled at this time. Please resolve the conflict before accepting this booking.`);
  }

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

  const providerId = (req.user as IUser)._id.toString();
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

  const providerId = (req.user as IUser)._id.toString();
  const booking = await bookingService.startBooking(id, providerId);

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

  const providerId = (req.user as IUser)._id.toString();
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

  // SECURITY: Verify user has access to this booking
  // Both customers and providers can add messages, but only to their own bookings
  const booking = await Booking.findById(id);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  const isCustomer = booking.customerId && booking.customerId.toString() === user._id.toString();
  const isProvider = booking.providerId.toString() === user._id.toString();

  // SECURITY: Enforce role-based access - providers must go through provider routes
  // Customers can only add messages to their own bookings
  if (!isCustomer && !isProvider) {
    throw new ApiError(403, 'Not authorized to add messages to this booking');
  }

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

  // SECURITY FIX: Single booking lookup with proper authorization and deletedAt check
  const booking = await Booking.findById(id);
  if (!booking || booking.deletedAt) {
    throw new ApiError(404, 'Booking not found');
  }

  // Mark all unread messages from the other party as read
  const isCustomer = booking.customerId?.toString() === user._id.toString();
  const isProvider = booking.providerId?.toString() === user._id.toString();

  if (!isCustomer && !isProvider) {
    throw new ApiError(403, 'Not authorized to access this booking');
  }

  const unreadField = isCustomer ? 'readByCustomer' : 'readByProvider';

  // SECURITY FIX: Only mark messages from the OTHER party as read, not all messages
  // Determine which messages to mark as read based on user role
  // If customer: mark provider's messages as read
  // If provider: mark customer's messages as read
  const senderIdToMark = isCustomer ? booking.providerId : booking.customerId;

  // Update messages where sender is the other party and message is not already read
  const result = await Booking.updateOne(
    {
      _id: id,
      'messages.from': senderIdToMark,
      'messages.isRead': false
    },
    {
      $set: { 'messages.$[elem].isRead': true, [unreadField]: true },
    },
    {
      arrayFilters: [{ 'elem.from': { $eq: senderIdToMark }, 'elem.isRead': { $eq: false } }]
    }
  );

  res.json({
    success: true,
    message: 'Messages marked as read',
    data: { modified: result.modifiedCount }
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
