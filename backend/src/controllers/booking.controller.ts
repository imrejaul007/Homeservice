import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { bookingService } from '../services/booking.service';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import { eventBus, EVENT_TYPES } from '../event-bus';
import Booking from '../models/booking.model';
import User, { IUser } from '../models/user.model';
import Service from '../models/service.model';
import Bundle from '../models/bundle.model';
import Review from '../models/review.model';
import Joi from 'joi';
import logger from '../utils/logger';
import { hashBookingCancellationToken } from '../utils/tokenUtil';
import {
  getPlatformPolicySync,
  calculateTaxAmount,
} from '../services/platformSettingsPolicy.service';
import { LOCATION_TYPES, OBJECT_ID_PATTERN, IDEMPOTENCY_KEY_PATTERN } from '../validation/schemas';
import { LocationType } from '../interfaces/service.interface';

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
  }).custom((value, helpers) => {
    // If type is customer_address, require at least city and country
    const type = helpers.state.ancestors[0]?.type;
    if (type === 'customer_address') {
      if (!value?.city) {
        return helpers.error('any.required', { message: 'City is required for customer address' });
      }
      if (!value?.country) {
        return helpers.error('any.required', { message: 'Country is required for customer address' });
      }
    }
    return value;
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

/**
 * Unified booking input schema using centralized LOCATION_TYPES
 * Re-exported for backward compatibility
 */
export const bookingInputSchema = Joi.object({
  serviceId: Joi.string().pattern(OBJECT_ID_PATTERN).required().messages({
    'string.pattern.base': 'Invalid service ID format',
  }),
  providerId: Joi.string().pattern(OBJECT_ID_PATTERN).optional().messages({
    'string.pattern.base': 'Invalid provider ID format',
  }),
  scheduledDate: Joi.string().isoDate().required().messages({
    'string.isoDate': 'Please provide a valid date',
  }),
  scheduledTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
    'string.pattern.base': 'Please provide a valid time in HH:MM format',
  }),
  location: locationSchema.required(),
  customerInfo: customerInfoSchema,
  addOns: Joi.array().items(addOnSchema),
  specialRequests: Joi.string().max(1000).allow('').optional(),
  // FIX: Add couponCode field for promo code application
  couponCode: Joi.string().max(50).uppercase().optional().messages({
    'string.max': 'Coupon code cannot exceed 50 characters',
  }),
  metadata: Joi.object({
    bookingSource: Joi.string().max(100).allow('').optional(),
    deviceType: Joi.string().max(50).allow('').optional(),
    sessionId: Joi.string().max(255).allow('').optional(),
    variantDuration: Joi.number().integer().min(15).max(480),
    variantPrice: Joi.number().min(0),
    selectedVariantIndex: Joi.number().integer().min(0),
    idempotencyKey: Joi.string()
      .pattern(IDEMPOTENCY_KEY_PATTERN)
      .required()
      .messages({
        'string.pattern.base': 'Idempotency key must be 16-64 alphanumeric characters',
        'any.required': 'Idempotency key is required to prevent duplicate bookings'
      })
  }).required(),
  // Use centralized location types
  locationType: Joi.string().valid(...LOCATION_TYPES),
  selectedDuration: Joi.number(),
  genderPreference: Joi.string().valid('male', 'female', 'no_preference').default('no_preference'),
  professionalPreference: Joi.string().valid('male', 'female', 'no_preference').optional(),
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
  providerId: Joi.string().optional(),
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
    variantDuration: Joi.number().integer().min(15).max(480),
    variantPrice: Joi.number().min(0),
    selectedVariantIndex: Joi.number().integer().min(0),
    idempotencyKey: Joi.string()
      .pattern(IDEMPOTENCY_KEY_PATTERN)
      .required()
      .messages({
        'string.pattern.base': 'Idempotency key must be 16-64 alphanumeric characters',
        'any.required': 'Idempotency key is required to prevent duplicate bookings'
      })
  }).required(),
  // Use centralized location types
  locationType: Joi.string().valid(...LOCATION_TYPES),
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
  reviewable: Joi.boolean(),
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
          const service = await Service.findOne({ _id: booking.serviceId }).select('name duration').lean();
          return service;
        }
        return null;
      }),
      // Get provider
      Promise.resolve(provider || booking.provider || booking._doc?.provider).then(async (p) => {
        if (p) return p;
        if (booking.providerId) {
          const provider = await User.findOne({ _id: booking.providerId }).select('firstName lastName email').lean();
          return provider;
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

  // FIX: COLLECTION MISMATCH BUG - Check Bundle (packages) first, then Service (individual services)
  // Package data is stored in Bundle collection, not Service collection
  let service = null;
  let isPackageBooking = false;

  // First, check if this is a package booking (check Bundle collection)
  const bundle = await Bundle.findOne({ _id: value.serviceId, tenantId: (req as any).tenantId, isActive: true });
  if (bundle) {
    isPackageBooking = true;
    // Transform bundle to match service-like structure for consistent processing
    service = {
      ...bundle.toObject(),
      _id: bundle._id,
      name: bundle.name,
      price: bundle.bundlePrice,
      isPackage: true,
    };
  } else {
    // Fall back to Service collection for individual services
    service = await Service.findOne({ _id: value.serviceId, tenantId: (req as any).tenantId, isActive: true });
  }

  if (!service) {
    throw new ApiError(400, 'Service or package not found or inactive');
  }

  const bookingPayload = {
    ...value,
    professionalPreference:
      value.professionalPreference ?? value.genderPreference ?? 'no_preference',
    tenantId: (req as any).tenantId,
  };

  const userId = (req.user as IUser)?._id ?? (req.user as { id?: unknown })?.id;
  if (!userId) {
    throw new ApiError(401, 'Invalid customer session');
  }
  const customerId = String(userId);
  logger.info('Create booking request received', {
    context: 'BookingController',
    customerId,
    serviceId: value.serviceId,
    scheduledDate: value.scheduledDate,
    scheduledTime: value.scheduledTime,
    couponCode: value.couponCode,
    idempotencyKey: value.metadata?.idempotencyKey,
  });
  const result = await bookingService.createCustomerBooking(customerId, bookingPayload);

  // Publish booking.created event
  await eventBus.publish(EVENT_TYPES.BOOKING_CREATED, {
    bookingId: result.booking._id.toString(),
    customerId,
    providerId: result.booking.providerId?.toString(),
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

  res.status(result.isDuplicate ? 200 : 201).json({
    success: true,
    message: result.message || 'Booking request submitted, awaiting provider confirmation',
    data: {
      booking: result.booking,
      isDuplicate: Boolean(result.isDuplicate),
    },
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
    tenantId: (req as any).tenantId,
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

  // SECURITY FIX: Validate booking data exists before using in conflict check
  const bookingScheduledDate = (req as any).booking?.scheduledDate;
  const bookingScheduledTime = (req as any).booking?.scheduledTime;
  const bookingDuration = (req as any).booking?.duration;

  // SECURITY: Conflict detection before accepting booking
  // This prevents accepting a booking for a time slot that conflicts with existing bookings
  // Only check conflicts if we have the required booking data
  if (bookingScheduledDate && bookingScheduledTime) {
    const conflictCheck = await bookingService.checkForTimeSlotConflicts(
      providerId,
      id,
      bookingScheduledDate,
      bookingScheduledTime,
      bookingDuration
    );

    if (conflictCheck.hasConflict) {
      throw new ApiError(409, `Time slot conflict detected. You already have a booking (${conflictCheck.conflictingBookingNumber}) scheduled at this time. Please resolve the conflict before accepting this booking.`);
    }
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

  // Fetch booking and verify provider ownership (IDOR prevention)
  const booking = await Booking.findById(id);
  if (!booking || booking.deletedAt) {
    throw new ApiError(404, 'Booking not found');
  }
  if (booking.providerId?.toString() !== providerId) {
    logger.warn('IDOR attempt detected in startBooking', {
      action: 'IDOR_ATTEMPT',
      bookingId: id,
      userId: providerId,
      userRole: 'provider',
    });
    throw new ApiError(403, 'Access denied. You do not have permission to start this booking.');
  }

  const result = await bookingService.startBooking(id, providerId);

  res.json({
    success: true,
    message: 'Booking started successfully',
    data: { booking: result },
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

  // Fetch booking and verify provider ownership (IDOR prevention)
  const bookingCheck = await Booking.findById(id);
  if (!bookingCheck || bookingCheck.deletedAt) {
    throw new ApiError(404, 'Booking not found');
  }
  if (bookingCheck.providerId?.toString() !== providerId) {
    logger.warn('IDOR attempt detected in completeBooking', {
      action: 'IDOR_ATTEMPT',
      bookingId: id,
      userId: providerId,
      userRole: 'provider',
    });
    throw new ApiError(403, 'Access denied. You do not have permission to complete this booking.');
  }

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
  const isProvider = booking.providerId && booking.providerId.toString() === user._id.toString();

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

  const result = await bookingService.createGuestBooking({
    ...value,
    tenantId: (req as any).tenantId,
  });

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
// Rating Endpoint (Customer)
// ============================================

// Validation schema for rating
const ratingSchema = Joi.object({
  rating: Joi.number().min(1).max(5).required().messages({
    'number.min': 'Rating must be at least 1 star',
    'number.max': 'Rating cannot exceed 5 stars',
    'any.required': 'Rating is required'
  }),
  comment: Joi.string().min(10).max(1000).required().messages({
    'string.min': 'Review comment must be at least 10 characters',
    'string.max': 'Review comment cannot exceed 1000 characters',
    'any.required': 'Review comment is required'
  }),
  title: Joi.string().max(100).allow('').optional(),
  photos: Joi.array().items(Joi.string()).max(5).optional(),
});

/**
 * Rate a completed booking
 * POST /api/bookings/:id/rate
 */
export const rateBooking = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'customer') {
    throw new ApiError(403, 'Only customers can rate bookings');
  }

  const { id } = req.params;
  const { error, value } = ratingSchema.validate(req.body);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const customerId = (req.user as IUser)._id.toString();

  // Fetch booking and verify ownership
  const booking = await Booking.findById(id);
  if (!booking || booking.deletedAt) {
    throw new ApiError(404, 'Booking not found');
  }

  // Verify customer owns this booking
  if (booking.customerId?.toString() !== customerId) {
    throw new ApiError(403, 'You can only rate your own bookings');
  }

  // Verify booking is completed
  if (booking.status !== 'completed') {
    throw new ApiError(400, 'Only completed bookings can be rated');
  }

  // Check if already reviewed
  if (booking.customerReview) {
    throw new ApiError(400, 'This booking has already been rated');
  }

  // Create the review document
  const review = new Review({
    bookingId: booking._id,
    reviewerId: req.user._id,
    reviewerType: 'customer',
    revieweeId: booking.providerId,
    revieweeType: 'provider',
    rating: value.rating,
    title: value.title || '',
    comment: value.comment.trim(),
    photos: value.photos || [],
    isVerified: true,
  });

  await review.save();

  // Update booking with review reference
  booking.customerReview = review._id;
  await booking.save();

  // Publish review received event for notifications
  // FIX: Added bookingNumber and serviceName for socket event
  eventBus.publish(EVENT_TYPES.REVIEW_RECEIVED, {
    reviewId: review._id.toString(),
    providerId: booking.providerId.toString(),
    bookingId: booking._id.toString(),
    bookingNumber: booking.bookingNumber || '',
    customerName: `${req.user.firstName} ${req.user.lastName}`,
    rating: review.rating,
    comment: review.comment,
  }, {
    userId: customerId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(201).json({
    success: true,
    message: 'Thank you for your rating! Your review helps other customers.',
    data: {
      review: {
        _id: review._id,
        rating: review.rating,
        title: review.title,
        comment: review.comment,
        photos: review.photos,
        isVerified: review.isVerified,
        createdAt: review.createdAt,
      },
    },
  });
});

// ============================================
// COUPON OPERATIONS
// ============================================

// FIX: Import discount stacking utility
import { checkDiscountStacking, DISCOUNT_PRIORITY } from '../utils/discountStacking';

/**
 * Apply coupon to a booking
 * POST /api/bookings/:id/coupon
 * FIX: Integrated with discount stacking rules
 */
export const applyCouponToBooking = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { code, cancellationToken } = req.body;
  const userId = (req.user as IUser)._id.toString();

  if (!code) {
    throw new ApiError(400, 'Coupon code is required');
  }

  // SECURITY FIX: ObjectId validation
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid booking ID format');
  }

  // Find booking
  const booking = await Booking.findById(id);
  if (!booking || booking.deletedAt) {
    throw new ApiError(404, 'Booking not found');
  }

  // SECURITY FIX: Handle guest booking ownership
  if (booking.customerId) {
    // Registered user booking - check customerId match
    if (booking.customerId.toString() !== userId) {
      throw new ApiError(403, 'You can only apply coupons to your own bookings');
    }
  } else if (booking.isGuestBooking && booking.guestInfo?.email) {
    // Guest booking requires email verification token
    const guestEmail = booking.guestInfo.email;
    const providedEmail = req.body.email;

    // For guest bookings, require either a valid cancellation token or matching email
    if (!cancellationToken && (!providedEmail || providedEmail.toLowerCase() !== guestEmail.toLowerCase())) {
      throw new ApiError(403, 'Guest booking requires email verification to apply coupons. Please provide the email address used for the booking.');
    }

    // Validate cancellation token if provided
    if (cancellationToken) {
      const expectedToken = hashBookingCancellationToken(id, guestEmail);
      if (cancellationToken !== expectedToken) {
        throw new ApiError(403, 'Invalid or expired cancellation token');
      }
    }
  } else {
    throw new ApiError(403, 'Cannot verify booking ownership');
  }

  // Check booking status - only pending/confirmed bookings can have coupons applied
  const allowedStatuses = ['pending', 'confirmed'];
  if (!allowedStatuses.includes(booking.status as string)) {
    throw new ApiError(400, 'Cannot apply coupon to this booking');
  }

  // FIX: Check existing discounts with stacking rules
  const currentDiscounts = booking.pricing.discounts || [];
  const existingCoupon = currentDiscounts.find((d: any) => d.type === 'coupon');

  // Also check the legacy couponDiscount field for backwards compatibility
  if (existingCoupon || (booking.pricing as any).couponDiscount > 0) {
    // If replacing an existing coupon, that's allowed (coupon has highest priority)
    // But we need to check stacking rules first
  }

  // Find coupon
  const Coupon = (await import('../models/coupon.model')).default;
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isDeleted: false });

  if (!coupon) {
    throw new ApiError(404, 'Invalid coupon code');
  }

  // Check if coupon is valid (methods are added by mongoose-schema)
  const couponAny = coupon as any;
  const validityCheck = couponAny.isValid();
  if (!validityCheck.valid) {
    throw new ApiError(400, validityCheck.reason || 'Coupon is not valid');
  }

  // Calculate order value for discount calculation
  const addOnsTotal = booking.pricing.addOns?.reduce(
    (sum: number, addon: { price: number }) => sum + addon.price, 0
  ) || 0;
  const orderValue = booking.pricing.basePrice + addOnsTotal;

  // Check minimum order value
  if (orderValue < coupon.minOrderValue) {
    throw new ApiError(
      400,
      `Minimum order value of ${coupon.currency} ${coupon.minOrderValue} required`
    );
  }

  // Calculate discount
  const discountAmount = couponAny.calculateDiscount(orderValue);
  const discountDetails = couponAny.getDiscountObject(orderValue);

  // FIX: Check discount stacking rules before applying coupon
  const stackingCheck = await checkDiscountStacking(id, 'coupon');
  if (!stackingCheck.canApply) {
    // If there are conflicting discounts, inform the user
    if (stackingCheck.conflictingDiscounts && stackingCheck.conflictingDiscounts.length > 0) {
      const conflictNames = stackingCheck.conflictingDiscounts
        .map(c => `${c.description} (${c.type})`)
        .join(', ');
      throw new ApiError(
        400,
        `Cannot apply coupon: Another discount (${conflictNames}) is already applied. Only one discount can be used at a time.`
      );
    }
    throw new ApiError(400, stackingCheck.reason || 'Cannot apply coupon at this time');
  }

  // Calculate new pricing
  const newSubtotal = orderValue - discountAmount;
  const policy = getPlatformPolicySync();
  const newTax = calculateTaxAmount(newSubtotal, policy);
  const newTotal = Math.round((newSubtotal + newTax) * 100) / 100;

  // FIX: Remove any existing coupon discounts before applying new one
  // (Coupon has highest priority, so we replace any existing coupon)
  const existingDiscounts = booking.pricing.discounts || [];
  const nonCouponDiscounts = existingDiscounts.filter((d: any) => d.type !== 'coupon');

  // Add coupon to discounts array (replacing any existing coupon)
  const discounts = [
    ...nonCouponDiscounts,
    {
      type: 'coupon' as const,
      amount: discountAmount,
      description: coupon.code,
    }
  ];

  // Update booking pricing within a transaction to prevent race conditions
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Update booking pricing
    (booking.pricing as any).couponDiscount = discountAmount;
    booking.pricing.subtotal = Math.round(newSubtotal * 100) / 100;
    booking.pricing.tax = newTax;
    booking.pricing.totalAmount = newTotal;
    booking.pricing.discounts = discounts;

    await booking.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  res.json({
    success: true,
    message: 'Coupon applied successfully',
    data: {
      booking: booking.toObject(),
      appliedCoupon: {
        code: coupon.code,
        type: coupon.type,
        discount: discountAmount,
        discountDetails,
        newTotal,
      },
    },
  });
});

/**
 * Remove coupon from a booking
 * DELETE /api/bookings/:id/coupon
 */
export const removeCouponFromBooking = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { cancellationToken } = req.body;
  const userId = (req.user as IUser)._id.toString();

  // SECURITY FIX: ObjectId validation
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid booking ID format');
  }

  // Find booking
  const booking = await Booking.findById(id);
  if (!booking || booking.deletedAt) {
    throw new ApiError(404, 'Booking not found');
  }

  // SECURITY FIX: Handle guest booking ownership
  if (booking.customerId) {
    // Registered user booking - check customerId match
    if (booking.customerId.toString() !== userId) {
      throw new ApiError(403, 'You can only modify your own bookings');
    }
  } else if (booking.isGuestBooking && booking.guestInfo?.email) {
    // Guest booking requires email verification token
    const guestEmail = booking.guestInfo.email;
    const providedEmail = req.body.email;

    // For guest bookings, require either a valid cancellation token or matching email
    if (!cancellationToken && (!providedEmail || providedEmail.toLowerCase() !== guestEmail.toLowerCase())) {
      throw new ApiError(403, 'Guest booking requires email verification to remove coupons. Please provide the email address used for the booking.');
    }

    // Validate cancellation token if provided
    if (cancellationToken) {
      const expectedToken = hashBookingCancellationToken(id, guestEmail);
      if (cancellationToken !== expectedToken) {
        throw new ApiError(403, 'Invalid or expired cancellation token');
      }
    }
  } else {
    throw new ApiError(403, 'Cannot verify booking ownership');
  }

  // Check booking status
  const allowedStatuses = ['pending', 'confirmed'];
  if (!allowedStatuses.includes(booking.status as string)) {
    throw new ApiError(400, 'Cannot remove coupon from this booking');
  }

  // Check if coupon is applied
  if (!(booking.pricing as any).couponDiscount || (booking.pricing as any).couponDiscount <= 0) {
    throw new ApiError(404, 'No coupon applied to this booking');
  }

  // Recalculate pricing without coupon
  const addOnsTotal = booking.pricing.addOns?.reduce(
    (sum: number, addon: { price: number }) => sum + addon.price, 0
  ) || 0;
  const baseTotal = booking.pricing.basePrice + addOnsTotal;
  const policy = getPlatformPolicySync();
  const newTax = calculateTaxAmount(baseTotal, policy);
  const newTotal = Math.round((baseTotal + newTax) * 100) / 100;

  // Remove coupon discount from discounts array
  const discounts = (booking.pricing.discounts || []).filter((d: any) => d.type !== 'coupon');

  // Update booking pricing within a transaction to prevent race conditions
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Update booking pricing
    (booking.pricing as any).couponDiscount = 0;
    booking.pricing.subtotal = Math.round(baseTotal * 100) / 100;
    booking.pricing.tax = newTax;
    booking.pricing.totalAmount = newTotal;
    booking.pricing.discounts = discounts;

    await booking.save({ session });
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  res.json({
    success: true,
    message: 'Coupon removed successfully',
    data: { booking: booking.toObject() },
  });
});

// ============================================
// Booking Count Endpoint
// ============================================

const bookingCountQuerySchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show', 'active')
    .optional()
    .messages({
      'any.only': 'Status must be one of: pending, confirmed, in_progress, completed, cancelled, no_show, active'
    }),
  includeBreakdown: Joi.boolean()
    .default(false)
    .messages({
      'boolean.base': 'includeBreakdown must be a boolean'
    }),
}).options({ stripUnknown: true });

/**
 * Get booking count for the authenticated customer
 * GET /api/bookings/count?status=active
 */
export const getCustomerBookingCount = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'customer') {
    throw new ApiError(403, 'Access denied. Only customers can access this endpoint.');
  }

  const { error, value } = bookingCountQuerySchema.validate(req.query);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const customerId = (req.user as IUser)._id.toString();

  const options = {
    status: value.status,
    activeOnly: value.includeBreakdown || value.status === 'active',
    tenantId: (req as any).tenantId,
  };

  const result = await bookingService.getCustomerBookingCount(customerId, options);

  res.json({
    success: true,
    data: {
      count: result.count,
      ...(result.statusCounts && { statusBreakdown: result.statusCounts })
    }
  });
});

/**
 * Get booking count for the authenticated provider
 * GET /api/provider/bookings/count?status=active
 */
export const getProviderBookingCount = asyncHandler(async (req: Request, res: Response) => {
  if (req.user?.role !== 'provider') {
    throw new ApiError(403, 'Access denied. Only providers can access this endpoint.');
  }

  const { error, value } = bookingCountQuerySchema.validate(req.query);
  if (error) {
    throw new ApiError(400, error.details[0].message);
  }

  const providerId = (req.user as IUser)._id.toString();

  const options = {
    status: value.status,
    activeOnly: value.includeBreakdown || value.status === 'active'
  };

  const result = await bookingService.getProviderBookingCount(providerId, options);

  res.json({
    success: true,
    data: {
      count: result.count,
      ...(result.statusCounts && { statusBreakdown: result.statusCounts })
    }
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
  rateBooking,
  reportProviderNoShow,
  applyCouponToBooking,
  removeCouponFromBooking,
  getCustomerBookingCount,
  getProviderBookingCount,
};
