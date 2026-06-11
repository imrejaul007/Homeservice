import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Joi from 'joi';
import { asyncHandler } from '../utils/asyncHandler';
import { customerDashboardService } from '../services/customerDashboard.service';
import { bookingService } from '../services/booking.service';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import ProviderProfile from '../models/providerProfile.model';
import { LOCATION_TYPES, OBJECT_ID_PATTERN, IDEMPOTENCY_KEY_PATTERN } from '../validation/schemas';

/**
 * Validation schema for recommended pros query parameters
 */
const recommendedProsQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(10),
  category: Joi.string().max(100).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  radius: Joi.number().min(1).max(100).optional(),
});

/**
 * Validation schema for price filters in getPackages
 */
const priceFilterSchema = Joi.object({
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
}).custom((value, helpers) => {
  if (value.minPrice !== undefined && value.maxPrice !== undefined) {
    if (value.minPrice > value.maxPrice) {
      return helpers.error('custom.priceRange');
    }
  }
  return value;
}).messages({
  'custom.priceRange': 'minPrice cannot be greater than maxPrice',
});

/**
 * Validation schema for package selection query parameters (getPackages)
 */
const packageSelectionSchema = Joi.object({
  category: Joi.string().max(100).optional(),
  q: Joi.string().max(200).optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  sortBy: Joi.string().valid('price', 'price_desc', 'rating', 'popularity').optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  featured: Joi.string().valid('true', 'false').optional(),
}).custom((value, helpers) => {
  if (value.minPrice !== undefined && value.maxPrice !== undefined) {
    if (value.minPrice > value.maxPrice) {
      return helpers.error('custom.priceRange');
    }
  }
  return value;
}).messages({
  'custom.priceRange': 'minPrice cannot be greater than maxPrice',
});

/**
 * Validation schema for featured packages query parameters
 */
const featuredPackagesQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(50).default(10),
  category: Joi.string().max(100).optional(),
});

/**
 * Validation schema for creating a booking from a package
 */
const createBookingFromPackageSchema = Joi.object({
  scheduledDate: Joi.string().required(),
  scheduledTime: Joi.string().required(),
  location: Joi.object({
    type: Joi.string().valid('customer_address', 'provider_location', 'hotel').required(),
    address: Joi.object({
      street: Joi.string().allow(''),
      city: Joi.string().allow(''),
      state: Joi.string().allow(''),
      zipCode: Joi.string().allow(''),
      country: Joi.string().allow(''),
    }),
    notes: Joi.string().allow(''),
  }).required(),
  customerInfo: Joi.object({
    firstName: Joi.string().allow(''),
    lastName: Joi.string().allow(''),
    email: Joi.string().email().allow(''),
    phone: Joi.string().allow(''),
    specialRequests: Joi.string().allow(''),
    accessInstructions: Joi.string().allow(''),
  }),
  addOns: Joi.array().items(Joi.object({
    id: Joi.string().allow(''),
    name: Joi.string().required(),
    price: Joi.number().required(),
    description: Joi.string().allow(''),
  })),
  specialRequests: Joi.string().allow(''),
  metadata: Joi.object({
    bookingSource: Joi.string().default('package_selection'),
    deviceType: Joi.string(),
    sessionId: Joi.string(),
    // Use centralized idempotency key pattern
    idempotencyKey: Joi.string()
      .pattern(IDEMPOTENCY_KEY_PATTERN)
      .messages({
        'string.pattern.base': 'Idempotency key must be 16-64 alphanumeric characters',
      })
  }),
  // Use centralized location types
  locationType: Joi.string().valid(...LOCATION_TYPES).default('at_home'),
  selectedDuration: Joi.number().optional(),
  professionalPreference: Joi.string().valid('male', 'female', 'no_preference').default('no_preference'),
  paymentMethod: Joi.string().default('credit_card'),
  couponCode: Joi.string().allow('').optional(),
});

/**
 * Safely parse a string to a positive integer with default fallback.
 * Returns defaultValue if input is invalid, empty, parses to NaN, or is <= 0.
 */
function safeParseInt(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

/**
 * Safely parse a string to float with default fallback.
 * Returns defaultValue if input is invalid, empty, or parses to NaN.
 */
function safeParseFloat(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === '') return defaultValue;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

/**
 * GET /api/customer/dashboard
 * Get unified dashboard data for the authenticated customer
 */
export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  const tenantId = (req as any).tenantId;

  if (!userId || !tenantId) {
    throw new ApiError(403, 'Access denied');
  }

  if (req.user?.role !== 'customer') {
    throw new ApiError(403, 'Access denied');
  }

  // Validate tenantId format
  if (tenantId !== '000000000000000000000000' && !mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in getDashboard: ${tenantId}`);
    throw new ApiError(400, 'Invalid tenant ID format');
  }

  const dashboardData = await customerDashboardService.getDashboardData(userId, tenantId);

  res.json({
    success: true,
    data: dashboardData,
  });
});

/**
 * GET /api/packages
 * Get service packages available for customers
 */
export const getPackages = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  if (!tenantId) { throw new ApiError(400, 'Tenant ID required'); }

  // Validate tenantId format
  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in getPackages: ${tenantId}`);
    throw new ApiError(400, 'Invalid tenant ID format');
  }

  // Validate query parameters using Joi schema
  const { error, value } = packageSelectionSchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    logger.warn(`Invalid query parameters in getPackages: ${error.message}`);
    throw new ApiError(400, error.details.map(d => d.message).join(', '));
  }

  const result = await customerDashboardService.getServicePackages(tenantId, {
    category: value.category,
    search: value.q,
    minPrice: value.minPrice,
    maxPrice: value.maxPrice,
    sortBy: value.sortBy,
    page: value.page,
    limit: value.limit,
    isFeatured: value.featured === 'true' ? true : value.featured === 'false' ? false : undefined,
  });

  res.json({
    success: true,
    data: {
      packages: result.packages,
      pagination: result.pagination,
    },
  });
});

/**
 * GET /api/packages/featured
 * Get featured/promoted packages for homepage carousel
 * Public endpoint - does not require authentication
 */
export const getFeaturedPackages = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;

  // Tenant validation for multi-tenant security
  if (!tenantId) {
    throw new ApiError(400, 'Tenant ID required');
  }

  // Validate tenantId format
  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in getFeaturedPackages: ${tenantId}`);
    throw new ApiError(400, 'Invalid tenant ID format');
  }

  // Validate query parameters using Joi schema
  const { error, value } = featuredPackagesQuerySchema.validate(req.query, {
    abortEarly: true,
    stripUnknown: true,
  });

  if (error) {
    logger.warn(`Invalid query parameters in getFeaturedPackages: ${error.message}`);
    throw new ApiError(400, error.details.map(d => d.message).join(', '));
  }

  const result = await customerDashboardService.getFeaturedPackages(tenantId, {
    limit: value.limit,
    category: value.category,
  });

  logger.info('Featured packages retrieved', {
    context: 'CustomerDashboard',
    action: 'FEATURED_PACKAGES_RETRIEVED',
    tenantId,
    count: result.total,
    category: value.category,
  });

  res.json({
    success: true,
    data: {
      packages: result.packages,
      total: result.total,
    },
  });
});

/**
 * GET /api/packages/:id
 * Get a single service package by ID
 */
export const getPackageById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = (req as any).tenantId;
  if (!tenantId) { throw new ApiError(400, 'Tenant ID required'); }

  // Validate tenantId format
  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in getPackageById: ${tenantId}`);
    throw new ApiError(400, 'Invalid tenant ID format');
  }

  if (!id) {
    throw new ApiError(400, 'Package ID is required');
  }

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.warn(`Invalid package ID format in getPackageById: ${id}`);
    throw new ApiError(400, 'Invalid package ID format');
  }

  const result = await customerDashboardService.getPackageById(id, tenantId);

  if (!result) {
    throw new ApiError(404, 'Package not found');
  }

  res.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/packages/:id/book
 * Create a booking from a selected service package
 */
export const createBookingFromPackage = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const customerId = req.user?._id?.toString();
  const tenantId = (req as any).tenantId;

  // Validate required fields
  if (!customerId) {
    throw new ApiError(401, 'Authentication required');
  }

  if (!tenantId) { throw new ApiError(400, 'Tenant ID required'); }

  // Validate tenantId format
  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in createBookingFromPackage: ${tenantId}`);
    throw new ApiError(400, 'Invalid tenant ID format');
  }

  if (!id) {
    throw new ApiError(400, 'Package ID is required');
  }

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.warn(`Invalid package ID format in createBookingFromPackage: ${id}`);
    throw new ApiError(400, 'Invalid package ID format');
  }

  // Validate request body
  const { error, value } = createBookingFromPackageSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    logger.warn(`Invalid request body in createBookingFromPackage: ${error.message}`);
    throw new ApiError(400, error.details.map(d => d.message).join(', '));
  }

  // Import Bundle model dynamically to avoid circular dependency
  const Bundle = (await import('../models/bundle.model')).default;

  // Fetch the package from Bundle collection to validate it exists and get provider info
  const bundle = await Bundle.findOne({
    _id: new mongoose.Types.ObjectId(id),
    tenantId: new mongoose.Types.ObjectId(tenantId),
    isActive: true,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  }).populate('providerId', '_id');

  if (!bundle) {
    throw new ApiError(404, 'Package not found or no longer available');
  }

  // Cast bundle to any for dynamic property access
  const bundleData = bundle as any;

  // Get the provider ID from the bundle
  const providerId = bundle.providerId?._id?.toString();

  if (!providerId) {
    logger.warn(`No provider found for bundle in createBookingFromPackage: ${id}`);
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

  // Build booking input from package and request data
  const bookingInput = {
    serviceId: id,
    providerId: providerId,
    scheduledDate: value.scheduledDate,
    scheduledTime: value.scheduledTime,
    location: value.location,
    customerInfo: value.customerInfo,
    addOns: value.addOns,
    specialRequests: value.specialRequests,
    locationType: value.locationType,
    selectedDuration: value.selectedDuration || totalDuration,
    professionalPreference: value.professionalPreference,
    paymentMethod: value.paymentMethod,
    metadata: {
      ...value.metadata,
      bookingSource: value.metadata?.bookingSource || 'package_selection',
      packageName: bundleData.name,
      packageCategory: bundleData.categoryId?.name || 'Package',
      bundleServices: bundleData.services?.map((s: any) => s.serviceId?.toString() || s._id?.toString()) || [],
    },
    couponCode: value.couponCode,
  };

  // Create the booking using the booking service
  const result = await bookingService.createCustomerBooking(customerId, bookingInput);

  logger.info('Booking created from package', {
    context: 'CustomerDashboard',
    action: 'BOOKING_FROM_PACKAGE_CREATED',
    customerId,
    packageId: id,
    packageName: bundleData.name,
    bookingId: result.booking._id?.toString() || result.booking.id,
    bookingNumber: result.booking.bookingNumber,
  });

  res.status(201).json({
    success: true,
    message: 'Booking created successfully',
    data: {
      booking: result.booking,
      bookingNumber: result.booking.bookingNumber,
    },
  });
});

/**
 * GET /api/dashboard/activity
 * Get recent activity feed for the authenticated customer
 */
export const getActivityFeed = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  const tenantId = (req as any).tenantId;

  if (!userId || !tenantId) {
    throw new ApiError(403, 'Access denied');
  }

  // Validate tenantId format
  if (tenantId !== '000000000000000000000000' && !mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in getActivityFeed: ${tenantId}`);
    throw new ApiError(403, 'Access denied');
  }

  const { limit = '20' } = req.query;
  const activities = await customerDashboardService.getActivityFeed(
    userId,
    tenantId,
    Math.min(safeParseInt(limit as string | undefined, 20), 50)
  );

  res.json({
    success: true,
    data: activities,
  });
});

/**
 * GET /api/dashboard/recommended-pros
 * Get recommended professionals based on user's booking history
 */
export const getRecommendedPros = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  const tenantId = (req as any).tenantId;

  if (!userId || !tenantId) {
    throw new ApiError(403, 'Access denied');
  }

  // Validate tenantId format
  if (tenantId !== '000000000000000000000000' && !mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in getRecommendedPros: ${tenantId}`);
    throw new ApiError(403, 'Access denied');
  }

  // Validate query parameters using Joi schema
  const { error, value } = recommendedProsQuerySchema.validate(req.query, { abortEarly: true });
  if (error) {
    logger.warn(`Invalid query parameters in getRecommendedPros: ${error.message}`);
    throw new ApiError(403, 'Access denied');
  }

  const pros = await customerDashboardService.getRecommendedPros(
    userId,
    tenantId,
    value.limit,
    {
      latitude: value.latitude,
      longitude: value.longitude,
      maxDistanceKm: value.radius,
    }
  );

  res.json({
    success: true,
    data: pros,
  });
});

/**
 * GET /api/customer/dashboard/stats
 * Get dashboard statistics only
 */
export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  const tenantId = (req as any).tenantId;

  if (!userId || !tenantId) {
    throw new ApiError(403, 'Access denied');
  }

  // Validate tenantId format
  if (tenantId !== '000000000000000000000000' && !mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in getDashboardStats: ${tenantId}`);
    throw new ApiError(403, 'Access denied');
  }

  const stats = await customerDashboardService.getStats(userId, tenantId);

  res.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/customer/dashboard/loyalty
 * Get loyalty points data only
 */
export const getDashboardLoyalty = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  const tenantId = (req as any).tenantId;

  if (!userId || !tenantId) {
    throw new ApiError(403, 'Access denied');
  }

  // Validate tenantId format
  if (tenantId !== '000000000000000000000000' && !mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in getDashboardLoyalty: ${tenantId}`);
    throw new ApiError(403, 'Access denied');
  }

  const loyalty = await customerDashboardService.getLoyaltyData(userId, tenantId);

  res.json({
    success: true,
    data: loyalty,
  });
});

/**
 * GET /api/customer/dashboard/streak
 * Get streak data only
 */
export const getDashboardStreak = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?._id?.toString();
  const tenantId = (req as any).tenantId;

  if (!userId || !tenantId) {
    throw new ApiError(403, 'Access denied');
  }

  // Validate tenantId format
  if (tenantId !== '000000000000000000000000' && !mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in getDashboardStreak: ${tenantId}`);
    throw new ApiError(403, 'Access denied');
  }

  const streak = await customerDashboardService.getStreakData(userId, tenantId);

  res.json({
    success: true,
    data: streak,
  });
});

/**
 * GET /api/packages/:id/print
 * Generate and download a PDF with package details for offline reference
 */
export const printPackageDetails = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const tenantId = (req as any).tenantId;

  if (!id) {
    throw new ApiError(400, 'Package ID is required');
  }

  // Validate tenantId format
  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in printPackageDetails: ${tenantId}`);
    throw new ApiError(400, 'Invalid tenant ID format');
  }

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    logger.warn(`Invalid package ID format in printPackageDetails: ${id}`);
    throw new ApiError(400, 'Invalid package ID format');
  }

  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);
  const packageObjectId = new mongoose.Types.ObjectId(id);

  // Import Bundle model dynamically to avoid circular dependency
  const Bundle = (await import('../models/bundle.model')).default;

  // Get the package from Bundle collection (where packages are stored)
  const bundle = await Bundle.findOne({
    _id: packageObjectId,
    tenantId: tenantObjectId,
    isActive: true,
    validFrom: { $lte: new Date() },
    validUntil: { $gte: new Date() },
  }).populate('providerId', 'firstName lastName avatar businessName profileImage');

  if (!bundle) {
    throw new ApiError(404, 'Package not found');
  }

  // Cast bundle to any for dynamic property access (runtime properties may differ from TypeScript interface)
  const bundleData = bundle as any;
  const provider = bundle.providerId as any;
  const providerName = provider?.businessName ||
    (provider ? `${provider.firstName || ''} ${provider.lastName || ''}`.trim() : 'Service Provider');

  // Calculate total duration from services
  const totalDuration = (bundleData.services || []).reduce((sum: number, s: any) => sum + (s.duration || 60), 0);

  // Extract included items from services
  const includedItems = (bundleData.services || []).map((s: any) => s.serviceName).filter(Boolean);

  // Calculate savings
  const originalPrice = bundleData.originalPrice || 0;
  const currentPrice = bundleData.bundlePrice || originalPrice;
  const savings = originalPrice > currentPrice ? originalPrice - currentPrice : 0;
  const savingsPercentage = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

  // Get rating from bundle - ensure safe numeric values
  const bundleRating = bundleData.rating || {};
  // Sanitize values - ensure they're reasonable numbers
  const rawAvg = typeof bundleRating.average === 'number' ? bundleRating.average : 0;
  const rawCount = typeof bundleRating.count === 'number' ? bundleRating.count : 0;
  // Clamp rating to 1-5 range and round to 1 decimal
  const averageRating = Math.min(5, Math.max(0, rawAvg));
  // Clamp review count to reasonable range (0-999)
  const totalReviews = Math.min(999, Math.max(0, Math.round(rawCount)));

  // Category from bundle tags (same as getPackageById — not first service name word)
  const categoryRaw =
    (Array.isArray(bundleData.tags) && bundleData.tags[0]) ||
    bundleData.tags ||
    'Package';
  const category = typeof categoryRaw === 'string' ? categoryRaw : 'Package';

  // Build package PDF data with proper field mapping from Bundle model
  const packagePDFData = {
    packageId: bundle._id.toString(),
    name: bundleData.name,
    description: bundleData.description || '',
    category: category,

    pricing: {
      originalPrice: originalPrice,
      currentPrice: currentPrice,
      currency: bundleData.currency || 'AED',
      type: 'fixed' as const,
      savings: savings,
      savingsPercentage: savingsPercentage,
    },

    duration: {
      totalMinutes: totalDuration || 60,
      formatted: `${Math.floor((totalDuration || 60) / 60)}h ${(totalDuration || 60) % 60}m`,
    },

    provider: {
      id: provider?._id?.toString() || '',
      name: providerName,
      avatar: provider?.profileImage || provider?.avatar,
      rating: averageRating,
      totalReviews: totalReviews, // Already sanitized above
    },

    includedItems: includedItems,

    addOns: bundleData.addOns?.map((a: any) => ({
      name: a.name,
      price: a.price,
      description: a.description,
    })) || [],

    reviews: {
      averageRating: averageRating,
      totalReviews: totalReviews,
    },

    terms: bundleData.terms || bundleData.termsAndConditions || 'Terms and conditions apply. Prices subject to change. Booking must be made in advance. Cancellation policy applies.',

    printedAt: new Date(),
  };

  // Generate the PDF
  const { pdfService } = await import('../services/pdf.service');
  const pdfBuffer = await pdfService.generatePackagePDF(packagePDFData);

  // Generate a filename
  const sanitizedName = bundleData.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const filename = `Package_${sanitizedName}_${Date.now()}.pdf`;

  // Set response headers for PDF download
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.setHeader('Cache-Control', 'no-cache');

  // Send the PDF buffer
  res.send(pdfBuffer);

  logger.info('Package PDF generated', {
    packageId: id,
    packageName: bundle.name,
    generatedAt: new Date().toISOString(),
  });
});

export default {
  getDashboard,
  getPackages,
  getFeaturedPackages,
  getPackageById,
  createBookingFromPackage,
  getActivityFeed,
  getRecommendedPros,
  getDashboardStats,
  getDashboardLoyalty,
  getDashboardStreak,
  printPackageDetails,
};
