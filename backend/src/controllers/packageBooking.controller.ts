import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Joi from 'joi';
import { asyncHandler } from '../utils/asyncHandler';
import { packageBookingService } from '../services/packageBooking.service';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import Bundle from '../models/bundle.model';
import ProviderProfile from '../models/providerProfile.model';
import { IUser } from '../models/user.model';
import { LOCATION_TYPES, OBJECT_ID_PATTERN, IDEMPOTENCY_KEY_PATTERN } from '../validation/schemas';

/**
 * Validation schema for package booking input
 * Matches the PackageBookingWizard payload from frontend
 */
const packageBookingInputSchema = Joi.object({
  // bundleId is the package/bundle ID (not individual service ID)
  bundleId: Joi.string().optional().messages({
    'string.base': 'Bundle ID must be a string',
  }),
  scheduledDate: Joi.string().required().messages({
    'any.required': 'Scheduled date is required',
  }),
  scheduledTime: Joi.string().required().messages({
    'any.required': 'Scheduled time is required',
  }),
  location: Joi.object({
    // Use centralized location types for location.type field
    type: Joi.string()
      .valid(...LOCATION_TYPES)
      .required()
      .messages({
        'any.required': 'Location type is required',
        'any.only': `Location type must be one of: ${LOCATION_TYPES.join(', ')}`,
      }),
    address: Joi.object({
      street: Joi.string().allow('').optional(),
      city: Joi.string().allow('').optional(),
      state: Joi.string().allow('').optional(),
      zipCode: Joi.string().allow('').optional(),
      country: Joi.string().allow('').optional(),
    }).optional(),
    notes: Joi.string().allow('').optional(),
  }).required().messages({
    'any.required': 'Location is required',
  }),
  customerInfo: Joi.object({
    // Normalize field naming: prefer firstName/lastName over single 'name' field
    firstName: Joi.string().allow('').optional(),
    lastName: Joi.string().allow('').optional(),
    name: Joi.string().allow('').optional(), // Legacy field, will be normalized
    email: Joi.string().email().required().messages({
      'any.required': 'Customer email is required',
      'string.email': 'Please provide a valid email address',
    }),
    phone: Joi.string().required().messages({
      'any.required': 'Customer phone is required',
    }),
    specialRequests: Joi.string().allow('').optional(),
    accessInstructions: Joi.string().allow('').optional(),
  }).optional(),
  addOns: Joi.array().items(
    Joi.object({
      id: Joi.string().allow('').optional(),
      name: Joi.string().required().messages({
        'any.required': 'Add-on name is required',
      }),
      price: Joi.number().min(0).required().messages({
        'any.required': 'Add-on price is required',
        'number.min': 'Add-on price cannot be negative',
      }),
      description: Joi.string().allow('').optional(),
      quantity: Joi.number().integer().min(1).default(1).optional(),
    })
  ).optional(),
  selectedAddOns: Joi.array().items(Joi.string()).optional(),
  specialRequests: Joi.string().allow('').optional(),
  // Use centralized location types
  locationType: Joi.string()
    .valid(...LOCATION_TYPES)
    .default('at_home')
    .optional()
    .messages({
      'any.only': `Location type must be one of: ${LOCATION_TYPES.join(', ')}`,
    }),
  selectedDuration: Joi.number().integer().min(15).optional().messages({
    'number.min': 'Selected duration must be at least 15 minutes',
  }),
  professionalPreference: Joi.string()
    .valid('male', 'female', 'no_preference')
    .default('no_preference')
    .optional()
    .messages({
      'any.only': 'Professional preference must be one of: male, female, no_preference',
    }),
  paymentMethod: Joi.string()
    .valid('apple_pay', 'credit_card', 'cash', 'card', 'wallet')
    .default('cash')
    .optional(),
  couponCode: Joi.string().allow('').optional(),
  metadata: Joi.object({
    bookingSource: Joi.string().default('package_booking'),
    deviceType: Joi.string().optional(),
    sessionId: Joi.string().optional(),
    // Use centralized idempotency key pattern
    idempotencyKey: Joi.string()
      .pattern(IDEMPOTENCY_KEY_PATTERN)
      .required()
      .messages({
        'any.required': 'Idempotency key is required',
        'string.pattern.base': 'Idempotency key must be 16-64 alphanumeric characters',
      }),
  }).required(),
}).options({ stripUnknown: true });

/**
 * POST /api/packages/:id/book-package
 * Create a booking from a service package with individual service bookings
 *
 * This endpoint handles booking packages that contain multiple services,
 * creating individual bookings for each service in the package.
 */
export const bookPackage = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id || req.body?.bundleId;
  const customerId = (req.user as IUser)?._id?.toString();
  const tenantId = (req as any).tenantId;

  // Validate required authentication
  if (!customerId) {
    throw new ApiError(401, 'Authentication required');
  }

  if (req.user?.role !== 'customer') {
    throw new ApiError(403, 'Only customers can book packages');
  }

  // Validate tenant context
  if (!tenantId) {
    throw new ApiError(400, 'Tenant ID required');
  }

  // Validate tenantId format
  if (tenantId !== '000000000000000000000000' && !mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in bookPackage: ${tenantId}`);
    throw new ApiError(400, 'Invalid tenant ID format');
  }

  // Validate package ID
  if (!id) {
    throw new ApiError(400, 'Package ID is required');
  }

  // Validate ObjectId format for package ID
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.warn(`Invalid package ID format in bookPackage: ${id}`);
    throw new ApiError(400, 'Invalid package ID format');
  }

  // Validate request body
  const { error, value } = packageBookingInputSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    logger.warn(`Invalid request body in bookPackage: ${error.message}`);
    throw new ApiError(400, error.details.map(d => d.message).join(', '));
  }

  // Load package from Bundle collection with provider details
  const bundle = await Bundle.findOne({
    _id: new mongoose.Types.ObjectId(id),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isActive: true,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  }).populate('providerId', '_id firstName lastName email avatar phone businessName');

  if (!bundle) {
    throw new ApiError(404, 'Package not found or no longer available');
  }

  // Cast bundle to any for dynamic property access
  const bundleData = bundle as any;

  // Extract provider information
  const provider = bundle.providerId as any;
  const providerId = provider?._id?.toString();

  if (!providerId) {
    logger.warn(`No provider found for bundle in bookPackage: ${id}`);
    throw new ApiError(400, 'Package is not associated with a valid provider');
  }

  // Validate provider is active and verified
  const providerProfile = await ProviderProfile.findOne({
    userId: new mongoose.Types.ObjectId(providerId),
    isActive: true,
    isDeleted: { $ne: true },
  });

  if (!providerProfile) {
    throw new ApiError(400, 'Provider is not available for bookings at this time');
  }

  // Calculate total duration from services
  const totalDuration = (bundleData.services || []).reduce((sum: number, s: any) => sum + (s.duration || 60), 0);

  // Normalize customerInfo: convert 'name' to firstName/lastName
  const normalizedCustomerInfo = (value.customerInfo || {}).name
    ? (() => {
        const parts = value.customerInfo.name.split(' ');
        return {
          ...value.customerInfo,
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' ') || '',
          name: undefined, // Remove legacy field after normalization
        };
      })()
    : value.customerInfo;

  // Build the booking input for the service
  const bookingInput = {
    bundleId: id,
    providerId: providerId,
    scheduledDate: value.scheduledDate,
    scheduledTime: value.scheduledTime,
    location: value.location,
    customerInfo: normalizedCustomerInfo,
    addOns: value.addOns,
    specialRequests: value.specialRequests,
    locationType: value.locationType,
    selectedDuration: value.selectedDuration || totalDuration,
    professionalPreference: value.professionalPreference,
    paymentMethod: value.paymentMethod,
    metadata: {
      ...value.metadata,
      bookingSource: value.metadata?.bookingSource || 'package_booking',
      packageName: bundleData.name,
      packageCategory: bundleData.categoryId?.name || 'Package',
      bundleServices: bundleData.services?.map((s: any) => s.serviceId?.toString() || s._id?.toString()) || [],
    },
    couponCode: value.couponCode,
  };

  // Call the package booking service
  const result = await packageBookingService.bookPackage(
    customerId,
    bookingInput,
    tenantId
  );

  // Log successful booking
  logger.info('Package booking created', {
    context: 'PackageBooking',
    action: 'PACKAGE_BOOKING_CREATED',
    customerId,
    packageId: id,
    packageName: bundleData.name,
    bookingId: result.booking?._id?.toString() || result.booking?.id,
    bookingNumber: result.booking?.bookingNumber,
    individualBookingCount: result.individualBookings?.length || 0,
  });

  // Return booking confirmation with all individual booking IDs
  res.status(201).json({
    success: true,
    message: 'Package booked successfully',
    data: {
      booking: result.booking,
      bookingNumber: result.booking?.bookingNumber,
      individualBookings: result.individualBookings?.map((ib: any) => ({
        bookingId: ib._id?.toString() || ib.id,
        bookingNumber: ib.bookingNumber,
        serviceName: ib.serviceName || bundleData.name,
        scheduledDate: ib.scheduledDate,
        scheduledTime: ib.scheduledTime,
        status: ib.status,
      })),
      pricing: result.pricing,
      provider: {
        id: providerId,
        name: provider?.businessName || `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || 'Service Provider',
        avatar: provider?.avatar,
      },
    },
  });
});

/**
 * GET /api/packages/:id/booking-preview
 * Preview the package booking details before confirming
 */
export const previewPackageBooking = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = (req as any).tenantId;

  // Validate tenant context
  if (!tenantId) {
    throw new ApiError(400, 'Tenant ID required');
  }

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid package ID format');
  }

  // Load package from Bundle collection with provider details
  const bundle = await Bundle.findOne({
    _id: new mongoose.Types.ObjectId(id),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isActive: true,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  }).populate('providerId', '_id firstName lastName avatar rating businessName');

  if (!bundle) {
    throw new ApiError(404, 'Package not found');
  }

  // Cast bundle to any for dynamic property access
  const bundleData = bundle as any;
  const provider = bundle.providerId as any;

  // Calculate total duration from services
  const totalDuration = (bundleData.services || []).reduce((sum: number, s: any) => sum + (s.duration || 60), 0);

  // Extract included items from services
  const includedItems = (bundleData.services || []).map((s: any) => s.serviceName).filter(Boolean);

  res.json({
    success: true,
    data: {
      package: {
        id: bundle._id.toString(),
        name: bundleData.name,
        description: bundleData.description,
        category: bundleData.categoryId?.name || 'Package',
        duration: totalDuration,
        pricing: {
          basePrice: bundleData.basePrice || bundleData.bundlePrice || 0,
          discountedPrice: bundleData.discountedPrice || bundleData.bundlePrice || 0,
          currency: 'AED',
        },
        includedItems: includedItems,
        services: bundleData.services?.map((s: any) => ({
          serviceId: s.serviceId?.toString() || s._id?.toString(),
          serviceName: s.serviceName,
          originalPrice: s.originalPrice,
          duration: s.duration || 60,
        })),
        addOns: bundleData.addOns?.map((a: any) => ({
          id: a._id?.toString() || a.id,
          name: a.name,
          price: a.price,
          description: a.description,
        })) || [],
      },
      provider: provider ? {
        id: provider._id.toString(),
        name: provider.businessName || `${provider.firstName || ''} ${provider.lastName || ''}`.trim(),
        avatar: provider.avatar,
        rating: provider.rating?.average || 0,
      } : null,
    },
  });
});

/**
 * Validate booking availability for a package
 * GET /api/packages/:id/availability
 */
export const checkPackageAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { date, time } = req.query;
  const tenantId = (req as any).tenantId;

  // Validate tenant context
  if (!tenantId) {
    throw new ApiError(400, 'Tenant ID required');
  }

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, 'Invalid package ID format');
  }

  // Load package from Bundle collection
  const bundle = await Bundle.findOne({
    _id: new mongoose.Types.ObjectId(id),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isActive: true,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  }).populate('providerId', '_id');

  if (!bundle) {
    throw new ApiError(404, 'Package not found');
  }

  const providerId = (bundle.providerId as any)?._id?.toString();

  if (!providerId) {
    throw new ApiError(400, 'Package has no associated provider');
  }

  // Check availability using the service
  const availability = await packageBookingService.checkAvailability(
    providerId,
    date as string,
    time as string
  );

  res.json({
    success: true,
    data: {
      available: availability.available,
      reason: availability.reason,
      suggestedSlots: availability.suggestedSlots || [],
    },
  });
});

export default {
  bookPackage,
  previewPackageBooking,
  checkPackageAvailability,
};