import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import Booking from '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';
import User, { IUser } from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import logger from '../utils/logger';
import {
  buildServiceAddressFromProvider,
  normalizeServiceAreas,
  sanitizeProviderGeo,
} from '../utils/sanitizeProviderGeo';
import { getSocketServer } from '../socket';
import { NotificationService } from '../services/notification.service';
import { cache, isRedisAvailable } from '../config/redis';
import { escapeRegex } from '../utils/formatBookingListItem';
import Review, { PUBLIC_REVIEW_QUERY } from '../models/review.model';
import { getCommissionRate, DEFAULT_PLATFORM_FEE_CONFIG } from '../services/settlement.service';
import { deleteFromCloudinary } from '../utils/cloudinary';

function buildBookingCityFilter(city?: string): Record<string, unknown> {
  if (!city || city.toLowerCase() === 'all') return {};
  const pattern = new RegExp(`^${escapeRegex(city)}$`, 'i');
  return {
    $or: [
      { 'location.address.city': pattern },
      { 'location.address.state': pattern },
    ],
  };
}

function estimateNetFromGross(gross: number): number {
  if (!gross) return 0;
  const commissionRate = getCommissionRate(gross);
  const platformFee =
    DEFAULT_PLATFORM_FEE_CONFIG.type === 'percentage'
      ? gross * DEFAULT_PLATFORM_FEE_CONFIG.value
      : 0;
  return Math.round((gross - gross * commissionRate - platformFee) * 100) / 100;
}

const CATEGORIES_CACHE_KEY = 'categories:all:active';
const CATEGORIES_CACHE_TTL = 300; // 5 minutes

// ===================================
// SECURITY: IDOR Protection Helpers
// ===================================

interface ServiceOwnershipResult {
  service: any;
  isOwner: boolean;
  isAdmin: boolean;
}

/**
 * SECURITY FIX: Reusable helper for verifying service ownership
 * Prevents IDOR vulnerabilities by ensuring users can only access their own services
 * Admins can access any service
 *
 * @param serviceId - The service ID to verify
 * @param user - The authenticated user from request
 * @returns Object containing the service (if found) and ownership flags
 * @throws ApiError with 404 if service not found OR user lacks access
 */
async function verifyServiceOwnership(
  serviceId: string,
  user: IUser
): Promise<ServiceOwnershipResult> {
  const userId = user._id.toString();
  const isAdmin = user.role === 'admin';

  // Admins can access any service - query without providerId restriction
  const query = isAdmin
    ? { _id: serviceId }
    : { _id: serviceId, providerId: userId };

  const service = await Service.findOne(query).lean();

  // SECURITY FIX: Return same error for both "not found" and "not owned"
  // This prevents ID enumeration attacks
  if (!service) {
    throw new ApiError(404, 'Service not found or access denied');
  }

  return {
    service,
    isOwner: service.providerId?.toString() === userId,
    isAdmin,
  };
}

/**
 * SECURITY: Verify portfolio item ownership
 * Ensures portfolio items belong to the requesting provider
 */
async function verifyPortfolioItemOwnership(
  itemId: string,
  userId: mongoose.Types.ObjectId
): Promise<{ providerProfile: any; item: any; itemIndex: number }> {
  const providerProfile = await ProviderProfile.findOne({ userId });

  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  const itemIndex = providerProfile.portfolio?.featured.findIndex(
    (item: any) => item._id?.toString() === itemId || item._id === itemId
  );

  if (itemIndex === -1 || itemIndex === undefined) {
    // Use generic message to prevent enumeration
    throw new ApiError(404, 'Portfolio item not found or access denied');
  }

  const item = providerProfile.portfolio.featured[itemIndex];

  return { providerProfile, item, itemIndex };
}

interface CategoryCache {
  categoryMap: Map<string, { exactName: string; subcategoryMap: Map<string, string> }>;
  cachedAt: number;
}

// Helper to get categories from cache or database
async function getCategoriesFromCache(): Promise<CategoryCache> {
  try {
    if (isRedisAvailable()) {
      const cached = await cache.get(CATEGORIES_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Convert plain object back to Map
        const categoryMap = new Map<string, { exactName: string; subcategoryMap: Map<string, string> }>();
        for (const [key, value] of Object.entries(parsed.categoryMap)) {
          const v = value as { exactName: string; subcategoryMap: Record<string, string> };
          categoryMap.set(key, {
            exactName: v.exactName,
            subcategoryMap: new Map(Object.entries(v.subcategoryMap))
          });
        }
        return { categoryMap, cachedAt: parsed.cachedAt };
      }
    }
  } catch (error) {
    logger.warn('Failed to read categories from cache', { error });
  }

  // Fetch from database
  const allCategories = await ServiceCategory.find({ isActive: true }).lean();
  const categoryMap = new Map<string, { exactName: string; subcategoryMap: Map<string, string> }>();

  for (const cat of allCategories) {
    const subcatMap = new Map<string, string>();
    for (const sub of ((cat as any).subcategories || [])) {
      if (sub.isActive !== false) {
        subcatMap.set(sub.name.toLowerCase(), sub.name);
      }
    }
    categoryMap.set((cat as any).name.toLowerCase(), {
      exactName: (cat as any).name,
      subcategoryMap: subcatMap
    });
  }

  const result: CategoryCache = { categoryMap, cachedAt: Date.now() };

  // Cache the result
  try {
    if (isRedisAvailable()) {
      // Convert Maps to plain objects for JSON serialization
      const cacheObj = {
        categoryMap: Object.fromEntries(
          Array.from(categoryMap.entries()).map(([key, value]) => [
            key,
            { exactName: value.exactName, subcategoryMap: Object.fromEntries(value.subcategoryMap) }
          ])
        ),
        cachedAt: result.cachedAt
      };
      await cache.set(CATEGORIES_CACHE_KEY, JSON.stringify(cacheObj), CATEGORIES_CACHE_TTL);
    }
  } catch (error) {
    logger.warn('Failed to cache categories', { error });
  }

  return result;
}

// Helper function to validate and normalize category/subcategory against database
const validateAndNormalizeCategorySubcategory = async (category: string, subcategory?: string) => {
  const { categoryMap } = await getCategoriesFromCache();

  const catLower = category?.toLowerCase();
  const catData = categoryMap.get(catLower);

  if (!catData) {
    const validCats = Array.from(categoryMap.values()).map(c => c.exactName);
    throw new ApiError(400,
      `Invalid category "${category}". Valid categories: ${validCats.join(', ')}`
    );
  }

  let normalizedSubcategory = subcategory || '';
  if (subcategory) {
    const subLower = subcategory.toLowerCase();
    const exactSubcat = catData.subcategoryMap.get(subLower);

    if (!exactSubcat) {
      const validSubs = Array.from(catData.subcategoryMap.values());
      throw new ApiError(400,
        `Invalid subcategory "${subcategory}" for category "${catData.exactName}". Valid subcategories: ${validSubs.join(', ')}`
      );
    }
    normalizedSubcategory = exactSubcat;
  }

  return {
    category: catData.exactName,
    subcategory: normalizedSubcategory
  };
};

// ===================================
// INTERFACES & TYPES
// ===================================

interface ServiceAnalytics {
  totalViews: number;
  totalClicks: number;
  totalBookings: number;
  conversionRate: number;
  bookingRate: number;
  popularityScore: number;
}

// ===================================
// SERVICE CRUD OPERATIONS
// ===================================

/**
 * Get all services for the authenticated provider
 * GET /api/provider/services
 */
export const getMyServices = asyncHandler(async (req: Request, res: Response) => {
  const {
    status,
    sortBy = 'createdAt',
    order = 'desc',
    page = 1,
    limit = 20,
    startDate,
    endDate,
    category,
    search
  } = req.query;

  // Build query - EXCLUDE soft-deleted services
  const query: any = {
    providerId: (req.user as IUser)._id.toString(),
    isDeleted: { $ne: true } // Exclude soft-deleted services
  };

  if (status && status !== 'all') {
    query.status = status as string;
  }

  // Date range filter
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) {
      query.createdAt.$gte = new Date(startDate as string);
    }
    if (endDate) {
      // Set to end of day
      const endDateObj = new Date(endDate as string);
      endDateObj.setHours(23, 59, 59, 999);
      query.createdAt.$lte = endDateObj;
    }
  }

  // Category filter
  if (category && category !== 'all') {
    // FIX: Escape regex special characters to prevent regex injection
    query.category = { $regex: new RegExp(escapeRegex(category as string), 'i') };
  }

  // Search filter
  if (search) {
    // FIX: Escape regex special characters to prevent regex injection
    const escapedSearch = escapeRegex(search as string);
    query.$or = [
      { name: { $regex: new RegExp(escapedSearch, 'i') } },
      { description: { $regex: new RegExp(escapedSearch, 'i') } },
      { category: { $regex: new RegExp(escapedSearch, 'i') } }
    ];
  }
  
  // Calculate pagination
  const skip = (Number(page) - 1) * Number(limit);
  
  // Build sort object
  const sortOrder = order === 'asc' ? 1 : -1;
  let sortObj: any = {};
  
  switch (sortBy) {
    case 'name':
      sortObj.name = sortOrder;
      break;
    case 'category':
      sortObj.category = sortOrder;
      break;
    case 'price':
      sortObj['price.amount'] = sortOrder;
      break;
    case 'views':
      sortObj['searchMetadata.searchCount'] = sortOrder;
      break;
    case 'popularity':
      sortObj['searchMetadata.popularityScore'] = sortOrder;
      break;
    case 'status':
      sortObj.status = sortOrder;
      break;
    default:
      sortObj.createdAt = sortOrder;
  }
  
  try {
    // Get services with pagination
    const [services, totalCount] = await Promise.all([
      Service.find(query)
        .sort(sortObj)
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Service.countDocuments(query)
    ]);
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / Number(limit));
    const hasNext = Number(page) < totalPages;
    const hasPrev = Number(page) > 1;
    
    res.json({
      success: true,
      data: {
        services,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          pages: totalPages,
          hasNext,
          hasPrev,
          nextPage: hasNext ? Number(page) + 1 : null,
          prevPage: hasPrev ? Number(page) - 1 : null
        }
      }
    });
  } catch (error: any) {
    throw new ApiError(500, 'Failed to fetch services', error.message);
  }
});

/**
 * Get specific service by ID
 * GET /api/provider/services/:id
 * SECURITY FIX: Uses verifyServiceOwnership helper to prevent IDOR
 * Admins can access any service, providers can only access their own
 */
export const getServiceById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as IUser;

  try {
    // SECURITY: Use reusable helper for ownership verification
    const { service } = await verifyServiceOwnership(id, user);

    res.json({
      success: true,
      data: { service }
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch service details', error.message);
  }
});

/**
 * Create new service
 * POST /api/provider/services
 */
export const createService = asyncHandler(async (req: Request, res: Response) => {
  try {
    logger.debug('Starting service creation', {
      context: 'ProviderController',
      action: 'CREATE_SERVICE_START',
      userId: (req.user as IUser)?._id?.toString(),
    });

    // Get provider's location from their profile
    const ProviderProfile = require('../models/providerProfile.model').default;
    const providerProfile = await ProviderProfile.findOne({ userId: (req.user as IUser)._id });

    if (!providerProfile?.locationInfo?.primaryAddress) {
      throw new ApiError(400, 'Provider location not found. Please complete your profile first.');
    }

    logger.debug('Provider profile location found', {
      context: 'ProviderController',
      action: 'PROVIDER_LOCATION_FOUND',
      userId: (req.user as IUser)?._id?.toString(),
    });

    // Validate and normalize category/subcategory against database (single source of truth)
    const { category, subcategory } = await validateAndNormalizeCategorySubcategory(
      req.body.category,
      req.body.subcategory
    );
    req.body.category = category;
    req.body.subcategory = subcategory;
    logger.debug('Category/subcategory validated', {
      context: 'ProviderController',
      action: 'CATEGORY_VALIDATED',
      category,
      subcategory,
    });

    // FIX: Check for duplicate/similar services before creation
    const currentUserId = (req.user as IUser)._id.toString();
    const serviceNameNormalized = (req.body.name || '').toLowerCase().trim();
    const existingServices = await Service.find({
      providerId: currentUserId,
      isDeleted: { $ne: true },
      $or: [
        // Exact match
        { name: { $regex: new RegExp(`^${escapeRegex(serviceNameNormalized)}$`, 'i') } },
        // Very similar (same category + similar name)
        {
          category,
          name: { $regex: new RegExp(escapeRegex(serviceNameNormalized.split(' ')[0] || ''), 'i') }
        }
      ]
    }).select('_id name category status').lean();

    // Return warning in response if duplicates found (but still allow creation)
    const duplicateWarning = existingServices.length > 0 ? {
      hasDuplicates: true,
      count: existingServices.length,
      similarServices: existingServices.map(s => ({
        id: s._id.toString(),
        name: s.name,
        category: s.category,
        status: s.status
      }))
    } : null;

    if (duplicateWarning) {
      logger.info('Similar service detected', {
        context: 'ProviderController',
        action: 'DUPLICATE_SERVICE_WARNING',
        providerId: currentUserId,
        serviceName: req.body.name,
        category,
        duplicateCount: existingServices.length,
      });
    }

    // ✅ FIX: Extract coordinates properly from provider profile and convert to array format
    // Now uses GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
    let serviceCoordinates: [number, number];
    const coords = providerProfile.locationInfo.primaryAddress.coordinates;

    if (coords?.coordinates && Array.isArray(coords.coordinates) && coords.coordinates.length === 2) {
      // New GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
      serviceCoordinates = coords.coordinates as [number, number];
      logger.debug('Using GeoJSON coordinates', {
        context: 'ProviderController',
        action: 'GEOJSON_COORDS',
        coordinates: serviceCoordinates,
      });
    } else if (coords?.lat !== undefined && coords?.lng !== undefined) {
      // Legacy format: { lat, lng } - convert to array [lng, lat]
      serviceCoordinates = [coords.lng, coords.lat];
      logger.info('Converted legacy lat/lng to GeoJSON format', {
        context: 'ProviderController',
        action: 'LEGACY_COORDS_CONVERTED',
        coordinates: serviceCoordinates,
      });
    } else {
      // Fallback to Dubai coordinates (default for the platform)
      logger.warn('No coordinates found, using Dubai default', {
        context: 'ProviderController',
        action: 'DEFAULT_COORDS',
      });
      serviceCoordinates = [55.2708, 25.2048]; // [lng, lat]
    }

    logger.debug('Using service coordinates', {
      context: 'ProviderController',
      action: 'USING_COORDS',
      coordinates: serviceCoordinates,
    });

    const serviceAddress = buildServiceAddressFromProvider(providerProfile);
    const serviceRadius =
      (providerProfile.businessInfo as { serviceRadius?: number })?.serviceRadius ?? 25;

    // Add provider ID and audit fields with inherited location
    const serviceData = {
      ...req.body,
      // Inherit location from provider profile (full address required by Service schema)
      location: {
        address: serviceAddress,
        coordinates: {
          type: 'Point',
          coordinates: serviceCoordinates,
        },
        serviceArea: {
          type: 'radius',
          value: serviceRadius,
          maxDistance: serviceRadius,
        },
      },
      // ✅ FIX: Add default availability schedule to prevent validation errors
      availability: req.body.availability || {
        schedule: {
          monday: { isAvailable: true, timeSlots: [] },
          tuesday: { isAvailable: true, timeSlots: [] },
          wednesday: { isAvailable: true, timeSlots: [] },
          thursday: { isAvailable: true, timeSlots: [] },
          friday: { isAvailable: true, timeSlots: [] },
          saturday: { isAvailable: true, timeSlots: [] },
          sunday: { isAvailable: false, timeSlots: [] }
        },
        exceptions: [],
        bufferTime: 15,
        instantBooking: false,
        advanceBookingDays: 7
      },
      status: 'pending_review', // Require admin approval for all new services
      isActive: false, // ✅ FIX: Keep inactive until admin approval
      providerId: currentUserId,
      createdBy: (req.user as IUser)._id,
      updatedBy: (req.user as IUser)._id,
      // Initialize search metadata
      searchMetadata: {
        searchCount: 0,
        clickCount: 0,
        bookingCount: 0,
        popularityScore: 0,
        searchKeywords: []
      },
      // Initialize rating
      rating: {
        average: 0,
        count: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      }
    };

    logger.debug('Creating service with data', {
      context: 'ProviderController',
      action: 'CREATE_SERVICE_DATA',
      serviceData: { ...serviceData, searchMetadata: '[REDACTED]' },
    });

    const service = new Service(serviceData);
    await service.save();

    // Notify admins about new service pending review
    const socketServer = getSocketServer();
    if (socketServer) {
      socketServer.emitNewServicePending(service._id.toString(), currentUserId, service.name);
    }

    logger.info('Service created successfully', {
      context: 'ProviderController',
      action: 'SERVICE_CREATED',
      serviceId: service._id.toString(),
      userId: (req.user as IUser)?._id?.toString(),
    });

    res.status(201).json({
      success: true,
      message: 'Service submitted for admin approval',
      data: {
        service,
        warning: duplicateWarning // Include duplicate warning if any
      }
    });
  } catch (error: any) {
    logger.error('Error creating service', {
      context: 'ProviderController',
      action: 'CREATE_SERVICE_ERROR',
      userId: (req.user as IUser)?._id?.toString(),
      error: error.message,
    });
    if (error.name === 'ValidationError') {
      throw new ApiError(400, `Service validation failed: ${error.message}`);
    }
    throw new ApiError(500, 'Failed to create service', error.message);
  }
});

/**
 * Update existing service
 * PUT /api/provider/services/:id
 * SECURITY FIX: Uses verifyServiceOwnership helper to prevent IDOR
 * Admins can update any service, providers can only update their own
 */
export const updateService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as IUser;

  try {
    // SECURITY: Use reusable helper for ownership verification
    const { service: existingService, isAdmin } = await verifyServiceOwnership(id, user);

    // Validate and normalize category/subcategory if being updated
    if (req.body.category || req.body.subcategory) {
      const categoryToValidate = req.body.category || existingService.category;
      const subcategoryToValidate = req.body.subcategory || existingService.subcategory;

      const { category, subcategory } = await validateAndNormalizeCategorySubcategory(
        categoryToValidate,
        subcategoryToValidate
      );

      if (req.body.category) req.body.category = category;
      if (req.body.subcategory) req.body.subcategory = subcategory;
    }

    // Strip system-owned fields; status/isActive are admin-only for non-admins
    const {
      isActive: _isActive,
      status: _status,
      providerId: _providerId,
      location: _location,
      searchMetadata: _searchMetadata,
      rating: _rating,
      createdBy: _createdBy,
      ...providerEditableFields
    } = req.body;

    const updateData: Record<string, unknown> = {
      ...providerEditableFields,
      updatedBy: user._id,
      updatedAt: new Date(),
    };

    // Providers cannot self-set status/isActive — only admin approval activates services
    if (!isAdmin) {
      delete updateData.status;
      delete updateData.isActive;

      const contentFields = [
        'name',
        'category',
        'subcategory',
        'description',
        'shortDescription',
        'duration',
        'price',
        'tags',
      ] as const;
      const hasContentChange = contentFields.some((field) => updateData[field] !== undefined);

      // Editing a live service requires re-approval
      if (existingService.status === 'active' && hasContentChange) {
        updateData.status = 'pending_review';
        updateData.isActive = false;
      }
    } else if (typeof updateData.status === 'string') {
      updateData.isActive = updateData.status === 'active';
    }

    const previousStatus = existingService.status;
    const newStatus = updateData.status as string | undefined;
    const statusChanged = previousStatus !== newStatus && newStatus !== undefined;
    const submittedForReview = previousStatus === 'active' && newStatus === 'pending_review';

    // FIX: Detect price/duration changes that affect existing bookings
    const priceChanged = req.body.price && JSON.stringify(req.body.price) !== JSON.stringify(existingService.price);
    const durationChanged = req.body.duration && req.body.duration !== existingService.duration;

    const service = await Service.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).lean();

    // FIX #3: Emit socket event to notify admins when service is updated
    // This ensures admin dashboard stays in sync with provider changes
    if (service) {
      const socketServer = getSocketServer();
      const providerId = user._id.toString();

      if (socketServer) {
        // Emit event for admin dashboard to refresh services list
        socketServer.emitServiceStatusChanged(
          service._id.toString(),
          providerId,
          service.name,
          service.status
        );

        // If service was submitted for review (status changed from active to pending_review),
        // also emit admin:new_service_pending to highlight in admin notifications
        if (submittedForReview) {
          socketServer.emitNewServicePending(
            service._id.toString(),
            providerId,
            service.name
          );
        }

        // Emit event to provider confirming their service was submitted for review
        socketServer.emitToUser(providerId, 'service:pending_review', {
          serviceId: service._id.toString(),
          serviceName: service.name,
          previousStatus,
          newStatus: service.status,
          timestamp: new Date()
        });
      }

      logger.info('Service updated by provider', {
        context: 'ProviderController',
        action: 'SERVICE_UPDATED',
        serviceId: service._id.toString(),
        providerId,
        previousStatus,
        newStatus: service.status,
        submittedForReview,
      });

      // FIX: Notify customers with pending/confirmed bookings when price/duration changes
      if ((priceChanged || durationChanged) && !submittedForReview) {
        try {
          const notificationService = new NotificationService();

          // Find bookings with this service that are pending or confirmed (not yet completed)
          const affectedBookings = await Booking.find({
            serviceId: service._id,
            status: { $in: ['pending', 'confirmed'] }
          }).populate('customerId', 'firstName lastName email phone communicationPreferences').lean();

          if (affectedBookings.length > 0) {
            const changeDetails: string[] = [];
            if (priceChanged) {
              const oldPrice = existingService.price.amount;
              const newPrice = (req.body.price as any)?.amount || service.price?.amount;
              changeDetails.push(`price: ${oldPrice} -> ${newPrice}`);
            }
            if (durationChanged) {
              changeDetails.push(`duration: ${existingService.duration} -> ${req.body.duration} minutes`);
            }

            // Create notifications for each affected customer
            const notificationPromises = affectedBookings.map(async (booking: any) => {
              const customer = booking.customerId as any;
              if (!customer) return;

              const metadata = {
                serviceId: service._id.toString(),
                serviceName: service.name,
                bookingId: booking._id.toString(),
                bookingNumber: booking.bookingNumber,
                changes: changeDetails,
                oldPrice: existingService.price,
                newPrice: req.body.price || existingService.price,
                oldDuration: existingService.duration,
                newDuration: req.body.duration || existingService.duration,
              };

              // Create in-app notification
              await notificationService.createNotification({
                recipientId: customer._id.toString(),
                type: 'service_updated',
                title: 'Service Update',
                message: `Important: ${service.name} has been updated. ${changeDetails.join(', ')}. Your booking (${booking.bookingNumber}) may be affected.`,
                actionText: 'View Booking',
                actionUrl: `/bookings/${booking._id}`,
                metadata,
              });

              // Try to send email notification if customer has email
              if (customer.email) {
                try {
                  await notificationService.sendEmail({
                    to: customer.email,
                    subject: `Service Update: ${service.name}`,
                    template: 'service-update',
                    data: {
                      customerName: customer.firstName,
                      serviceName: service.name,
                      bookingNumber: booking.bookingNumber,
                      changes: changeDetails,
                      oldPrice: existingService.price.amount,
                      newPrice: (req.body.price as any)?.amount || existingService.price.amount,
                      oldDuration: existingService.duration,
                      newDuration: req.body.duration || existingService.duration,
                    }
                  }, 'service_updated');
                } catch (emailError) {
                  logger.warn('Failed to send service update email', {
                    context: 'ProviderController',
                    action: 'SERVICE_UPDATE_EMAIL_FAILED',
                    bookingId: booking._id.toString(),
                    error: emailError instanceof Error ? emailError.message : String(emailError),
                  });
                }
              }

              // Try to send SMS notification if customer has phone
              if (customer.phone) {
                try {
                  const smsMessage = `${service.name} has been updated (${changeDetails.join(', ')}). Booking #${booking.bookingNumber} may be affected.`;
                  await notificationService.sendSms(customer.phone, smsMessage, 'service_updated');
                } catch (smsError) {
                  logger.warn('Failed to send service update SMS', {
                    context: 'ProviderController',
                    action: 'SERVICE_UPDATE_SMS_FAILED',
                    bookingId: booking._id.toString(),
                    error: smsError instanceof Error ? smsError.message : String(smsError),
                  });
                }
              }
            });

            await Promise.all(notificationPromises);

            logger.info('Service update notifications sent to customers', {
              context: 'ProviderController',
              action: 'SERVICE_UPDATE_NOTIFICATIONS_SENT',
              serviceId: service._id.toString(),
              affectedBookings: affectedBookings.length,
              changes: changeDetails,
            });
          }
        } catch (notifError) {
          // Don't fail the update if notification fails
          logger.error('Failed to send service update notifications', {
            context: 'ProviderController',
            action: 'SERVICE_UPDATE_NOTIFICATION_ERROR',
            serviceId: service._id.toString(),
            error: notifError instanceof Error ? notifError.message : String(notifError),
          });
        }
      }
    }

    res.json({
      success: true,
      message: isAdmin
        ? 'Service updated successfully (admin override)'
        : updateData.status === 'pending_review' && previousStatus === 'active'
          ? 'Service updated and submitted for admin re-approval'
          : 'Service updated successfully',
      data: { service }
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update service', error.message);
  }
});

/**
 * Delete service (soft delete)
 * DELETE /api/provider/services/:id
 * SECURITY FIX: Uses verifyServiceOwnership helper to prevent IDOR
 * Admins can delete any service, providers can only delete their own
 * FIX: Now uses soft delete instead of permanent deletion
 */
export const deleteService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as IUser;

  try {
    // SECURITY: Use reusable helper for ownership verification
    const { service, isAdmin } = await verifyServiceOwnership(id, user);

    const openBooking = await Booking.findOne({
      serviceId: service._id,
      status: { $in: ['pending', 'confirmed', 'in_progress'] },
    }).lean();

    if (openBooking) {
      throw new ApiError(
        400,
        'Cannot delete this service while it has active bookings. Cancel or complete them first.'
      );
    }

    // FIX: Soft delete - set isDeleted flag instead of removing
    await Service.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: user._id,
      isActive: false, // Also deactivate the service
    });

    const serviceId = service._id.toString();
    const providerIdStr = service.providerId?.toString();
    const category = service.category;

    // FIX #4: Emit socket event to notify admins when a service is deleted
    const socketServer = getSocketServer();
    if (socketServer) {
      // Use emitServiceStatusChanged to notify about deletion
      socketServer.emitServiceStatusChanged(serviceId, providerIdStr || '', service.name, 'deleted');
    }

    try {
      const { removeServiceFromIndex } = await import('../services/search.service');
      await removeServiceFromIndex(serviceId);
    } catch (searchError) {
      logger.warn('Failed to remove service from search index', {
        serviceId,
        error: searchError instanceof Error ? searchError.message : String(searchError),
      });
    }

    try {
      const { getRedisClient } = require('../config/redis');
      const redisClient = await getRedisClient();
      if (redisClient) {
        const cacheKeys = [
          `service:${serviceId}`,
          `service:${serviceId}:details`,
          ...(providerIdStr ? [`services:provider:${providerIdStr}`] : []),
          ...(category ? [`services:category:${category}`] : []),
        ];
        for (const key of cacheKeys) {
          await redisClient.del(key).catch(() => undefined);
        }
      }
    } catch (cacheError) {
      logger.warn('Failed to invalidate cache after service delete', {
        serviceId,
        error: cacheError instanceof Error ? cacheError.message : String(cacheError),
      });
    }

    res.json({
      success: true,
      message: isAdmin
        ? 'Service moved to trash (admin action)'
        : 'Service moved to trash'
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to delete service', error.message);
  }
});

/**
 * Restore a soft-deleted service
 * POST /api/provider/services/:id/restore
 * SECURITY FIX: Uses verifyServiceOwnership helper to prevent IDOR
 * Admins can restore any service, providers can only restore their own
 */
export const restoreService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as IUser;

  try {
    // SECURITY: Use reusable helper for ownership verification
    const { service } = await verifyServiceOwnership(id, user);

    // Must be deleted to restore
    if (!service.isDeleted) {
      throw new ApiError(400, 'Service is not deleted');
    }

    // Restore the service
    const restoredService = await Service.findByIdAndUpdate(
      id,
      {
        isDeleted: false,
        $unset: { deletedAt: '', deletedBy: '' }, // Remove the deletion metadata
        // Don't automatically reactivate - keep the previous status
      },
      { new: true, runValidators: true }
    ).lean();

    // Emit socket event
    const socketServer = getSocketServer();
    if (socketServer) {
      socketServer.emitServiceStatusChanged(
        id,
        service.providerId?.toString() || '',
        service.name,
        'restored'
      );
    }

    logger.info('Service restored', {
      context: 'ProviderController',
      action: 'SERVICE_RESTORED',
      serviceId: id,
      userId: user._id.toString(),
    });

    res.json({
      success: true,
      message: 'Service restored successfully',
      data: { service: restoredService }
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to restore service', error.message);
  }
});

/**
 * Get deleted services (trash)
 * GET /api/provider/services/trash
 * FIX: New endpoint to list soft-deleted services
 */
export const getDeletedServices = asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);

  const [services, totalCount] = await Promise.all([
    Service.find({
      providerId: (req.user as IUser)._id.toString(),
      isDeleted: true
    })
      .sort({ deletedAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    Service.countDocuments({
      providerId: (req.user as IUser)._id.toString(),
      isDeleted: true
    })
  ]);

  const totalPages = Math.ceil(totalCount / Number(limit));

  res.json({
    success: true,
    data: {
      services,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCount,
        pages: totalPages,
        hasNext: Number(page) < totalPages,
        hasPrev: Number(page) > 1
      }
    }
  });
});

/**
 * Permanently delete a soft-deleted service
 * DELETE /api/provider/services/:id/permanent
 * Only allows permanent deletion of already soft-deleted services
 */
export const permanentDeleteService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as IUser;

  try {
    // Use verifyServiceOwnership helper for ownership verification
    const { service } = await verifyServiceOwnership(id, user);

    // Must be already deleted to permanently delete
    if (!service.isDeleted) {
      throw new ApiError(400, 'Service must be in trash before permanent deletion');
    }

    // Permanently remove the service
    await Service.findByIdAndDelete(id);

    logger.info('Service permanently deleted', {
      context: 'ProviderController',
      action: 'SERVICE_PERMANENTLY_DELETED',
      serviceId: id,
      serviceName: service.name,
      userId: user._id.toString(),
    });

    res.json({
      success: true,
      message: 'Service permanently deleted'
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to permanently delete service', error.message);
  }
});

/**
 * Toggle service status (active/inactive)
 * PATCH /api/provider/services/:id/status
 * SECURITY FIX: Uses verifyServiceOwnership helper to prevent IDOR
 * Admins can toggle any service status, providers can only toggle their own
 */
export const toggleServiceStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const user = req.user as IUser;

  // Validate status against SERVICE_STATUS constants
  const validStatuses = ['active', 'inactive'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status. Must be: ' + validStatuses.join(', '));
  }

  try {
    // SECURITY: Use reusable helper for ownership verification
    const { service: existingService, isAdmin } = await verifyServiceOwnership(id, user);

    if (!isAdmin) {
      const toggleableStatuses = ['active', 'inactive'];
      if (!toggleableStatuses.includes(existingService.status)) {
        throw new ApiError(
          403,
          'Only approved services can be activated or deactivated. Awaiting admin review.'
        );
      }
    }

    const updateData: any = {
      status,
      updatedBy: user._id,
      updatedAt: new Date()
    };

    updateData.isActive = status === 'active';

    const updatedService = await Service.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).lean();

    if (updatedService) {
      try {
        const { updateServiceInIndex } = await import('../services/search.service');
        await updateServiceInIndex(updatedService._id.toString(), {
          isActive: updatedService.isActive,
          status: updatedService.status,
          updatedAt: new Date(),
        });
      } catch (searchError) {
        logger.warn('Failed to update search index after status toggle', {
          serviceId: id,
          error: searchError instanceof Error ? searchError.message : String(searchError),
        });
      }
    }

    res.json({
      success: true,
      message: `Service status updated to ${status}`,
      data: { service: updatedService }
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to update service status', error.message);
  }
});

// ===================================
// ANALYTICS & INSIGHTS
// ===================================

/**
 * Get service-specific analytics
 * GET /api/provider/services/:id/analytics
 * SECURITY FIX: Uses verifyServiceOwnership helper to prevent IDOR
 * Admins can view any service analytics, providers can only view their own
 */
export const getServiceAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as IUser;

  try {
    // SECURITY: Use reusable helper for ownership verification
    const { service } = await verifyServiceOwnership(id, user);

    const totalViews = service.searchMetadata.searchCount;
    const totalClicks = service.searchMetadata.clickCount;
    const totalBookings = await Booking.countDocuments({
      serviceId: service._id,
      status: 'completed',
    });

    const analytics: ServiceAnalytics = {
      totalViews,
      totalClicks,
      totalBookings,
      conversionRate: totalViews > 0 ? (totalClicks / totalViews) * 100 : 0,
      bookingRate: totalClicks > 0 ? (totalBookings / totalClicks) * 100 : 0,
      popularityScore: service.searchMetadata.popularityScore,
    };

    res.json({
      success: true,
      data: { analytics }
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch service analytics', error.message);
  }
});

/**
 * Provider analytics dashboard (insights page)
 * GET /api/provider/analytics/insights?period=7d|30d|90d
 */
export const getProviderInsightsAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as IUser)._id.toString();
    const periodParam = String(req.query.period || '30d');
    const period = (['7d', '30d', '90d'].includes(periodParam)
      ? periodParam
      : '30d') as '7d' | '30d' | '90d';
    const revenueParam = String(req.query.revenue || 'net');
    const revenue = revenueParam === 'gross' ? 'gross' : 'net';
    const city = typeof req.query.city === 'string' ? req.query.city : undefined;

    const { getProviderInsightsAnalytics: loadInsights } = await import(
      '../services/providerInsightsAnalytics.service'
    );
    const analytics = await loadInsights(providerId, period, { revenue, city });

    res.json({
      success: true,
      data: analytics,
    });
  },
);

/**
 * Get provider overview analytics
 * GET /api/provider/analytics
 */
export const getOverviewAnalytics = asyncHandler(async (req: Request, res: Response) => {
  try {
    const providerId = (req.user as IUser)._id.toString();
    const cityParam = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const cityFilter = buildBookingCityFilter(cityParam);

    // Get all provider services (exclude soft-deleted)
    const services = await Service.find({
      providerId,
      isDeleted: { $ne: true }
    }).lean();

    // Calculate overview statistics from services
    const totalServices = services.length;
    const activeServices = services.filter(s => s.isActive && s.status === 'active').length;
    const draftServices = services.filter(s => s.status === 'draft').length;
    const inactiveServices = services.filter(s => s.status === 'inactive').length;
    const pendingReviewServices = services.filter(s => s.status === 'pending_review').length;
    const rejectedServices = services.filter(s => s.status === 'rejected').length;

    // Calculate status counts for filter UI
    const statusCounts = {
      all: totalServices,
      active: activeServices,
      draft: draftServices,
      inactive: inactiveServices,
      pending_review: pendingReviewServices,
      rejected: rejectedServices,
    };

    const totalViews = services.reduce((sum, service) => sum + service.searchMetadata.searchCount, 0);
    const totalClicks = services.reduce((sum, service) => sum + service.searchMetadata.clickCount, 0);

    const completedBookingCounts = await Booking.aggregate([
      {
        $match: {
          providerId: new mongoose.Types.ObjectId(providerId),
          status: 'completed',
          'metadata.packageBookingId': { $exists: false },
          ...cityFilter,
        },
      },
      {
        $group: {
          _id: '$serviceId',
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' },
        },
      },
    ]);
    const bookingCountByServiceId = new Map<string, number>(
      completedBookingCounts.map((row: { _id: mongoose.Types.ObjectId; count: number }) => [
        row._id.toString(),
        row.count,
      ])
    );
    const revenueByServiceId = new Map<string, number>(
      completedBookingCounts.map((row: { _id: mongoose.Types.ObjectId; revenue: number }) => [
        row._id.toString(),
        row.revenue || 0,
      ])
    );
    const totalBookings = completedBookingCounts.reduce(
      (sum: number, row: { count: number }) => sum + row.count,
      0
    );

    const averageRating = totalServices > 0
      ? services.reduce((sum, service) => sum + service.rating.average, 0) / totalServices
      : 0;
    const totalReviews = services.reduce((sum, service) => sum + service.rating.count, 0);

    // Get booking stats using MongoDB aggregation (no N+1 queries)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
    const startOfWeek = new Date(startOfToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Use aggregation to compute booking stats in a single query
    const bookingStats = await Booking.aggregate([
      {
        $match: {
          providerId: new mongoose.Types.ObjectId(providerId),
          'metadata.packageBookingId': { $exists: false },
          ...cityFilter,
        },
      },
      {
        $facet: {
          // Pending requests count
          pendingCount: [
            { $match: { status: 'pending' } },
            { $count: 'count' }
          ],
          // Today's bookings
          todayCount: [
            {
              $match: {
                scheduledDate: { $gte: startOfToday, $lt: endOfToday }
              }
            },
            { $count: 'count' }
          ],
          // Completed this month
          completedThisMonth: [
            {
              $match: {
                status: 'completed',
                completedAt: { $gte: startOfMonth }
              }
            },
            { $count: 'count' }
          ],
          // New bookings (last 7 days, excluding cancelled)
          newBookingsCount: [
            {
              $match: {
                createdAt: { $gte: startOfWeek },
                status: { $ne: 'cancelled' }
              }
            },
            { $count: 'count' }
          ],
          // Status breakdown with counts
          statusBreakdown: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          // Monthly revenue aggregation
          monthlyRevenue: [
            {
              $match: {
                status: 'completed',
                completedAt: { $gte: startOfMonth }
              }
            },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$pricing.totalAmount' },
                avgBookingValue: { $avg: '$pricing.totalAmount' }
              }
            }
          ],
          completedLastMonth: [
            {
              $match: {
                status: 'completed',
                completedAt: { $gte: startOfLastMonth, $lt: startOfMonth },
              },
            },
            { $count: 'count' },
          ],
          revenueLastMonth: [
            {
              $match: {
                status: 'completed',
                completedAt: { $gte: startOfLastMonth, $lt: startOfMonth },
              },
            },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$pricing.totalAmount' },
              },
            },
          ],
        }
      }
    ]);

    // Extract counts from aggregation results
    const stats = bookingStats[0] || {};
    const pendingBookings = stats.pendingCount?.[0]?.count || 0;
    const todayBookings = stats.todayCount?.[0]?.count || 0;
    const completedThisMonth = stats.completedThisMonth?.[0]?.count || 0;
    const newBookings = stats.newBookingsCount?.[0]?.count || 0;
    const monthlyRevenue = stats.monthlyRevenue?.[0]?.totalRevenue || 0;
    const avgBookingValue = stats.monthlyRevenue?.[0]?.avgBookingValue || 0;
    const completedLastMonth = stats.completedLastMonth?.[0]?.count || 0;
    const revenueLastMonth = stats.revenueLastMonth?.[0]?.totalRevenue || 0;

    const percentChange = (current: number, previous: number): number | null => {
      if (!previous || previous === 0) return null;
      return Math.round(((current - previous) / previous) * 100);
    };

    // Create status map for easy lookup
    const statusMap = new Map<string, number>();
    (stats.statusBreakdown || []).forEach((item: any) => {
      statusMap.set(item._id, item.count);
    });

    // Top performing services
    const topServices = services
      .sort((a, b) => b.searchMetadata.popularityScore - a.searchMetadata.popularityScore)
      .slice(0, 5)
      .map(service => ({
        id: service._id,
        name: service.name,
        category: service.category,
        views: service.searchMetadata.searchCount,
        clicks: service.searchMetadata.clickCount,
        bookings: bookingCountByServiceId.get(service._id.toString()) ?? 0,
        revenue: revenueByServiceId.get(service._id.toString()) ?? 0,
        rating: service.rating.average,
        popularityScore: service.searchMetadata.popularityScore
      }));

    // Get unique categories from services (for provider's used categories)
    const providerCategories = [...new Set(services.map(s => s.category).filter(Boolean))];

    // Get all available categories from ServiceCategory collection
    const allCategories = await ServiceCategory.find({ isActive: true })
      .select('name')
      .sort({ name: 1 })
      .lean();

    const allCategoryNames = allCategories.map(c => c.name);

    const categoryBookingStats = await Booking.aggregate([
      {
        $match: {
          providerId: new mongoose.Types.ObjectId(providerId),
          status: 'completed',
          'metadata.packageBookingId': { $exists: false },
          ...cityFilter,
        },
      },
      {
        $lookup: {
          from: 'services',
          localField: 'serviceId',
          foreignField: '_id',
          as: 'serviceDoc',
        },
      },
      { $unwind: { path: '$serviceDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            $ifNull: ['$serviceDoc.category', '$metadata.packageCategory', 'Other'],
          },
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { bookingCount: -1 } },
      { $limit: 8 },
      {
        $project: {
          _id: 0,
          name: '$_id',
          bookingCount: 1,
        },
      },
    ]);

    const providerProfileDoc = await ProviderProfile.findOne({ userId: providerId })
      .select('analytics.customerMetrics reviewsData')
      .lean();

    const monthlyGrossEarnings = monthlyRevenue;
    const monthlyNetEarnings = estimateNetFromGross(monthlyGrossEarnings);

    const overview = {
      serviceStats: {
        total: totalServices,
        active: activeServices,
        draft: draftServices,
        inactive: inactiveServices,
        pending_review: pendingReviewServices,
        rejected: rejectedServices,
      },
      statusCounts,
      performanceStats: {
        totalViews,
        totalClicks,
        totalBookings,
        conversionRate: totalViews > 0 ? (totalClicks / totalViews) * 100 : 0,
        bookingRate: totalClicks > 0 ? (totalBookings / totalClicks) * 100 : 0
      },
      ratingStats: {
        averageRating: providerProfileDoc?.reviewsData?.averageRating
          ?? Math.round(averageRating * 10) / 10,
        totalReviews: providerProfileDoc?.reviewsData?.totalReviews ?? totalReviews
      },
      bookingStats: {
        newBookings,
        pendingRequests: pendingBookings,
        todaySchedule: todayBookings,
        completedThisMonth
      },
      customerMetrics: {
        repeatCustomers:
          providerProfileDoc?.analytics?.customerMetrics?.repeatCustomers ?? 0,
        totalCustomers:
          providerProfileDoc?.analytics?.customerMetrics?.totalCustomers ?? 0,
      },
      revenueStats: {
        monthlyRevenue,
        monthlyGrossEarnings,
        monthlyNetEarnings,
        avgBookingValue: Math.round(avgBookingValue * 100) / 100
      },
      statusBreakdown: {
        pending: statusMap.get('pending') || 0,
        confirmed: statusMap.get('confirmed') || 0,
        in_progress: statusMap.get('in_progress') || 0,
        completed: statusMap.get('completed') || 0,
        cancelled: statusMap.get('cancelled') || 0,
        no_show: statusMap.get('no_show') || 0
      },
      categories: providerCategories,
      allCategories: allCategoryNames,
      categoryStats: categoryBookingStats,
      topServices,
      trendStats: {
        earningsChangePercent: percentChange(monthlyRevenue, revenueLastMonth),
        bookingsChangePercent: percentChange(completedThisMonth, completedLastMonth),
      },
    };

    res.json({
      success: true,
      data: { overview }
    });
  } catch (error: any) {
    throw new ApiError(500, 'Failed to fetch overview analytics', error.message);
  }
});

// ===================================
// PROVIDER ONBOARDING
// ===================================

/**
 * Get provider's own onboarding status
 * GET /api/provider/onboarding
 */
export const getProviderOnboardingStatus = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Use authenticated user, or allow query param for admin fallback
    let providerId = (req.user as IUser)._id?.toString();
    if (!providerId && req.query.providerId) {
      providerId = req.query.providerId as string;
    }

    if (!providerId) {
      throw new ApiError(401, 'Provider ID not found');
    }

    // Import here to avoid circular dependency
    const { providerOpsService } = await import('../services/providerOps.service');

    const status = await providerOpsService.getOnboardingStatus(providerId);

    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    throw new ApiError(500, 'Failed to fetch onboarding status', error.message);
  }
});

/**
 * Get provider's own verification status
 * GET /api/provider/verification
 * SECURITY FIX: Users can only access their own verification status unless they are admin
 */
export const getProviderVerification = asyncHandler(async (req: Request, res: Response) => {
  try {
    const requestingUser = req.user as IUser;
    const requestingUserId = requestingUser._id?.toString();

    // SECURITY FIX: Only allow users to access their own verification status
    // Admins can access any provider's verification via provider-ops routes
    if (!requestingUserId) {
      throw new ApiError(401, 'User authentication required');
    }

    // SECURITY FIX: Remove the ability for non-admin users to query other providers
    // This was an IDOR vulnerability - users could access any provider's documents
    const requestedProviderId = req.query.providerId as string | undefined;

    // If providerId is specified, only admins can access other providers' verification
    if (requestedProviderId && requestedProviderId !== requestingUserId) {
      // Only admins can view other providers' verification status
      if (requestingUser.role !== 'admin') {
        throw new ApiError(403, 'Access denied. You can only view your own verification status.');
      }
    }

    // Use authenticated user's ID (or query param for admin)
    const providerId = requestedProviderId || requestingUserId;

    // Import here to avoid circular dependency
    const { providerOpsService } = await import('../services/providerOps.service');

    const documentStatus = await providerOpsService.getDocumentVerificationStatus(providerId);

    res.json({
      success: true,
      data: documentStatus
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to fetch verification status', error.message);
  }
});

/**
 * Upload verification document
 * POST /api/provider/verification/documents
 */
export const uploadVerificationDocument = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as IUser)._id;

  const { documentType, documentUrl } = req.body;

  if (!documentType || !documentUrl) {
    throw new ApiError(400, 'Document type and URL are required');
  }

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  // Initialize verificationStatus if not exists
  if (!providerProfile.verificationStatus) {
    providerProfile.verificationStatus = {
      identity: { status: 'pending', documents: [] },
      business: { status: 'pending', documents: [] },
      insurance: { status: 'pending', documents: [] },
      background: { status: 'pending' },
    } as any;
  }

  // Add document to appropriate category
  // FIX #3: Handle address proof documents (utility_bill, ejari, dewa)
  const category = documentType.includes('id') || documentType.includes('passport')
    ? 'identity'
    : documentType.includes('address') || documentType.includes('utility') ||
      documentType.includes('ejari') || documentType.includes('dewa') ||
      documentType.includes('utility_bill') || documentType.includes('address_proof')
    ? 'business' // Address verification stored in business category
    : documentType.includes('business') || documentType.includes('license') || documentType.includes('certificate')
    ? 'business'
    : 'insurance';

  if (providerProfile.verificationStatus[category as keyof typeof providerProfile.verificationStatus]) {
    const catStatus = providerProfile.verificationStatus[category as keyof typeof providerProfile.verificationStatus] as any;
    if (!catStatus.documents) catStatus.documents = [];
    catStatus.documents.push({
      type: documentType,
      url: documentUrl,
      status: 'pending',
      uploadedAt: new Date(),
    });
    catStatus.uploadedAt = new Date();
    catStatus.status = 'submitted';
  }

  await providerProfile.save();

  res.json({
    success: true,
    message: 'Document uploaded successfully',
    data: {
      documentType,
      url: documentUrl,
    },
  });
});

/**
 * Record background check consent
 * POST /api/provider/verification/consent
 */
export const recordBackgroundCheckConsent = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as IUser)._id;

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  // Initialize verificationStatus if not exists
  if (!providerProfile.verificationStatus) {
    providerProfile.verificationStatus = {
      identity: { status: 'pending', documents: [] },
      business: { status: 'pending', documents: [] },
      insurance: { status: 'pending', documents: [] },
      background: { status: 'pending' },
    } as any;
  }

  // Update background check status
  providerProfile.verificationStatus.background = {
    status: 'completed',
    consentGivenAt: new Date(),
    consentGiven: true,
  } as any;

  await providerProfile.save();

  // Emit socket event to notify admins
  const socketServer = getSocketServer();
  const businessName = (providerProfile.businessInfo as any)?.businessName || 'Unknown Provider';

  if (socketServer) {
    socketServer.emitNewProviderSubmission(providerId.toString(), businessName);
  }

  res.json({
    success: true,
    message: 'Background check consent recorded successfully',
    data: {
      consentGiven: true,
      consentGivenAt: new Date(),
    },
  });
});

/**
 * Submit verification for review
 * POST /api/provider/verification/submit
 */
export const submitVerification = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as IUser)._id;

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  // Check if required documents are uploaded
  const identityDocs = providerProfile.verificationStatus?.identity?.documents?.length || 0;
  if (identityDocs === 0) {
    throw new ApiError(400, 'Please upload identity verification documents before submitting');
  }

  // Update verification status
  if (providerProfile.verificationStatus) {
    providerProfile.verificationStatus.identity.status = 'pending';
    providerProfile.verificationStatus.business.status = 'pending';
    providerProfile.verificationStatus.overall = 'in_progress';
  }

  await providerProfile.save();

  // Notify admins about new verification submission
  const socketServer = getSocketServer();
  const businessName = (providerProfile.businessInfo as any)?.businessName || 'Unknown Provider';

  if (socketServer) {
    socketServer.emitNewProviderSubmission(providerId.toString(), businessName);
  }

  // Create notification for admins
  try {
    const notificationService = new NotificationService();
    const admins = await User.find({ role: 'admin' }).select('_id');
    for (const admin of admins) {
      await notificationService.createNotification({
        recipientId: admin._id.toString(),
        type: 'new_provider_submission',
        title: 'New Provider Verification',
        message: `${businessName} has submitted their verification for review.`,
        actionText: 'Review Now',
        actionUrl: `/admin/providers/${providerProfile._id}`,
        metadata: { providerId: providerProfile._id.toString(), submittedBy: providerId }
      });
    }
  } catch (notifError) {
    logger.error('Failed to create admin notification', {
      providerId,
      error: notifError instanceof Error ? notifError.message : String(notifError)
    });
  }

  res.json({
    success: true,
    message: 'Verification submitted for review. You will be notified once the review is complete.',
  });
});

// ===================================
// PORTFOLIO MANAGEMENT
// ===================================

/**
 * Get all portfolio items for the authenticated provider
 * GET /api/provider/portfolio
 */
export const getPortfolioItems = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as IUser)._id;

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  const featuredItems = providerProfile.portfolio?.featured || [];

  res.json({
    success: true,
    data: featuredItems,
  });
});

/**
 * Get a single portfolio item by ID
 * GET /api/provider/portfolio/:itemId
 * SECURITY FIX: Uses verifyPortfolioItemOwnership helper to prevent IDOR
 */
export const getPortfolioItemById = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const { itemId } = req.params;

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(itemId)) {
    throw new ApiError(400, 'Invalid portfolio item ID format');
  }

  // SECURITY: Use reusable helper for ownership verification
  const { item } = await verifyPortfolioItemOwnership(itemId, user._id);

  res.json({
    success: true,
    data: item,
  });
});

/**
 * Create a new portfolio item
 * POST /api/provider/portfolio
 */
export const createPortfolioItem = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as IUser)._id;
  const { title, description, category, images, tags, clientTestimonial, isVisible = true } = req.body;

  if (!title) {
    throw new ApiError(400, 'Title is required');
  }

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  // Initialize portfolio if not exists
  if (!providerProfile.portfolio) {
    providerProfile.portfolio = { featured: [], certifications: [], awards: [] };
  }

  // Process images if files were uploaded
  let processedImages = images || [];
  if (req.files && Array.isArray(req.files)) {
    const uploadedImages = (req.files as Express.Multer.File[]).map(file => ({
      url: (file as any).path || (file as any).secure_url || file.filename,
      caption: '',
    }));
    processedImages = [...uploadedImages, ...processedImages];
  }

  const newItem = {
    _id: new mongoose.Types.ObjectId(),
    title,
    description: description || '',
    category: category || 'Other',
    images: processedImages,
    tags: tags || [],
    clientTestimonial: clientTestimonial || undefined,
    isVisible,
    createdAt: new Date(),
  };

  providerProfile.portfolio.featured.unshift(newItem as any);
  await providerProfile.save();

  res.status(201).json({
    success: true,
    data: newItem,
    message: 'Portfolio item created successfully',
  });
});

/**
 * Update an existing portfolio item
 * PUT /api/provider/portfolio/:itemId
 * SECURITY FIX: Uses verifyPortfolioItemOwnership helper to prevent IDOR
 */
export const updatePortfolioItem = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const { itemId } = req.params;
  const { title, description, category, images, tags, clientTestimonial, isVisible } = req.body;

  // SECURITY: Use reusable helper for ownership verification
  const { providerProfile, itemIndex } = await verifyPortfolioItemOwnership(itemId, user._id);

  // Update fields if provided
  if (title) providerProfile.portfolio.featured[itemIndex].title = title;
  if (description !== undefined) providerProfile.portfolio.featured[itemIndex].description = description;
  if (category) providerProfile.portfolio.featured[itemIndex].category = category;
  if (tags) providerProfile.portfolio.featured[itemIndex].tags = tags;
  if (clientTestimonial !== undefined) providerProfile.portfolio.featured[itemIndex].clientTestimonial = clientTestimonial;
  if (isVisible !== undefined) providerProfile.portfolio.featured[itemIndex].isVisible = isVisible;

  // Merge images if provided
  if (images) {
    providerProfile.portfolio.featured[itemIndex].images = images;
  }

  await providerProfile.save();

  res.json({
    success: true,
    data: providerProfile.portfolio.featured[itemIndex],
    message: 'Portfolio item updated successfully',
  });
});

/**
 * Delete a portfolio item
 * DELETE /api/provider/portfolio/:itemId
 * SECURITY FIX: Uses verifyPortfolioItemOwnership helper to prevent IDOR
 * FIX: Now cleans up images from Cloudinary when item is deleted
 */
export const deletePortfolioItem = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const { itemId } = req.params;

  // SECURITY: Use reusable helper for ownership verification
  const { providerProfile, item } = await verifyPortfolioItemOwnership(itemId, user._id);

  // FIX: Collect image URLs before deletion for cleanup
  const imageUrls = item.images?.map((img: any) => img.url).filter(Boolean) || [];

  const initialLength = providerProfile.portfolio?.featured?.length || 0;
  providerProfile.portfolio.featured = providerProfile.portfolio.featured.filter(
    (item: any) => item._id?.toString() !== itemId && item._id !== itemId
  );

  if (providerProfile.portfolio.featured.length === initialLength) {
    throw new ApiError(404, 'Portfolio item not found or already deleted');
  }

  await providerProfile.save();

  // FIX: Clean up images from Cloudinary
  const imageCleanupPromises = imageUrls.map(async (url: string) => {
    try {
      // Extract public ID from Cloudinary URL
      const publicId = extractCloudinaryPublicId(url);
      if (publicId) {
        await deleteFromCloudinary(publicId);
        logger.debug('Deleted image from Cloudinary', {
          context: 'ProviderController',
          action: 'CLOUDINARY_DELETE',
          publicId,
        });
      }
    } catch (error) {
      // Log but don't fail the request
      logger.warn('Failed to delete image from Cloudinary', {
        context: 'ProviderController',
        action: 'CLOUDINARY_DELETE_ERROR',
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Fire and forget - don't wait for cleanup
  Promise.all(imageCleanupPromises).catch(() => {});

  res.json({
    success: true,
    message: 'Portfolio item deleted successfully',
  });
});

/**
 * Helper function to extract Cloudinary public ID from URL
 */
function extractCloudinaryPublicId(url: string): string | null {
  try {
    // Cloudinary URLs contain /upload/ followed by the public ID
    const match = url.match(/\/upload\/(.+?)(\.webp|\.jpg|\.jpeg|\.png|\?|$)/i);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Add images to an existing portfolio item
 * PATCH /api/provider/portfolio/:itemId/images
 * SECURITY FIX: Uses verifyPortfolioItemOwnership helper to prevent IDOR
 */
export const addPortfolioImage = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const { itemId } = req.params;

  // SECURITY: Use reusable helper for ownership verification
  const { providerProfile, item } = await verifyPortfolioItemOwnership(itemId, user._id);

  // Process uploaded files
  if (req.files && Array.isArray(req.files)) {
    const newImages = (req.files as Express.Multer.File[]).map(file => ({
      url: (file as any).path || (file as any).secure_url || file.filename,
      caption: '',
    }));
    item.images.push(...newImages);
  }

  await providerProfile.save();

  res.json({
    success: true,
    data: item.images,
    message: 'Image added successfully',
  });
});

/**
 * Remove an image from a portfolio item
 * DELETE /api/provider/portfolio/:itemId/images/:imageId
 * SECURITY FIX: Uses verifyPortfolioItemOwnership helper to prevent IDOR
 */
export const removePortfolioImage = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const { itemId, imageId } = req.params;

  // SECURITY: Use reusable helper for ownership verification
  const { providerProfile, item } = await verifyPortfolioItemOwnership(itemId, user._id);

  const initialLength = item.images?.length || 0;
  item.images = (item.images || []).filter((img: any) => {
    const imgId = img._id?.toString() || img.url || String(img);
    return imgId !== imageId;
  });

  if (item.images.length === initialLength) {
    throw new ApiError(404, 'Image not found in this portfolio item');
  }

  await providerProfile.save();

  res.json({
    success: true,
    data: item.images,
    message: 'Image removed successfully',
  });
});

// ===========================================
// PROVIDER SETTINGS
// ===========================================

type ProviderReviewScope = 'approved' | 'all' | 'pending';

function buildProviderReviewScopeQuery(scope: ProviderReviewScope): Record<string, unknown> {
  const base = { isHidden: false };
  if (scope === 'approved') {
    return { ...base, ...PUBLIC_REVIEW_QUERY };
  }
  if (scope === 'pending') {
    return { ...base, moderationStatus: 'pending' };
  }
  // all: approved + pending (exclude rejected/hidden)
  return {
    ...base,
    moderationStatus: { $in: ['pending', 'approved'] },
  };
}

function computeApprovedReviewStats(reviews: Array<{ rating: number }>) {
  const total = reviews.length;
  const ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) {
      ratingDistribution[r.rating] = (ratingDistribution[r.rating] || 0) + 1;
    }
  });
  const averageRating =
    total > 0
      ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / total) * 10) / 10
      : 0;
  return { averageRating, ratingDistribution, totalReviews: total };
}

async function transformProviderReviews(reviews: any[]) {
  const bookingIds = [...new Set(reviews.map((r) => r.bookingId?.toString()).filter(Boolean))];

  // Fetch bookings once
  const bookings = bookingIds.length > 0
    ? await Booking.find({ _id: { $in: bookingIds } })
        .select('serviceId')
        .lean()
    : [];

  // Extract serviceIds from bookings
  const serviceIds = [
    ...new Set(bookings.map((b: { serviceId?: { toString: () => string } }) => b.serviceId?.toString()).filter(Boolean)),
  ];

  // Fetch services
  const services = serviceIds.length > 0
    ? await Service.find({ _id: { $in: serviceIds } })
        .select('name')
        .lean()
    : [];

  const bookingServiceMap = new Map(
    bookings.map((b: { _id: { toString: () => string }; serviceId?: { toString: () => string } }) => [b._id.toString(), b.serviceId?.toString()])
  );
  const serviceMap = new Map(services.map((s: { _id: { toString: () => string }; name: string }) => [s._id.toString(), s.name]));

  return reviews.map((review) => {
    const bookingId = review.bookingId?.toString();
    const serviceId = bookingId ? bookingServiceMap.get(bookingId) : undefined;
    const serviceName = serviceId ? serviceMap.get(serviceId) : undefined;
    const reviewer = review.reviewerId;

    return {
      id: review._id.toString(),
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      photos: review.photos || [],
      isVerified: review.isVerified,
      moderationStatus: review.moderationStatus,
      createdAt: review.createdAt,
      customer: reviewer
        ? {
            id: reviewer._id?.toString() || String(reviewer),
            firstName: reviewer.firstName,
            lastName: reviewer.lastName,
            avatar: reviewer.avatar,
          }
        : null,
      service: serviceName
        ? { id: serviceId, name: serviceName }
        : null,
      response: review.response
        ? {
            comment: review.response.content,
            createdAt: review.response.createdAt?.toISOString?.() || review.response.createdAt,
          }
        : undefined,
    };
  });
}

/**
 * Get provider's received reviews (canonical)
 * GET /api/provider/reviews?scope=approved|all|pending
 */
export const getProviderReviews = asyncHandler(async (req: Request, res: Response) => {
  const providerUserId = (req.user as IUser)._id;
  const scopeParam = String(req.query.scope || 'all');
  const scope: ProviderReviewScope = ['approved', 'all', 'pending'].includes(scopeParam)
    ? (scopeParam as ProviderReviewScope)
    : 'all';
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
  const skip = (page - 1) * limit;
  const ratingFilter = req.query.rating ? parseInt(String(req.query.rating), 10) : undefined;

  const baseQuery: Record<string, unknown> = {
    revieweeId: providerUserId,
    reviewerType: 'customer',
    ...buildProviderReviewScopeQuery(scope),
  };
  if (ratingFilter && ratingFilter >= 1 && ratingFilter <= 5) {
    baseQuery.rating = ratingFilter;
  }

  const providerProfile = await ProviderProfile.findOne({ userId: providerUserId })
    .select('settings.reviewDisplaySettings')
    .lean();

  // Use aggregation pipeline to compute stats in a single query (replaces inefficient Review.find().select('rating'))
  // Use same criteria as PUBLIC_REVIEW_QUERY for consistency
  const statsAggregation = Review.aggregate([
    {
      $match: {
        revieweeId: providerUserId,
        reviewerType: 'customer',
        isHidden: false,
        $or: [
          { moderationStatus: 'approved' },
          { moderationStatus: { $exists: false } },
        ],
        $nor: [
          { reportCount: { $gte: 3 } },
        ],
      },
    },
    {
      $facet: {
        stats: [
          {
            $group: {
              _id: null,
              avgRating: { $avg: '$rating' },
              totalReviews: { $sum: 1 },
            },
          },
        ],
        ratingDistribution: [
          {
            $group: {
              _id: '$rating',
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ]);

  const [reviews, total, approvedCount, pendingCount, aggregationResult] = await Promise.all([
    Review.find(baseQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('reviewerId', 'firstName lastName avatar')
      .lean(),
    Review.countDocuments(baseQuery),
    Review.countDocuments({
      revieweeId: providerUserId,
      reviewerType: 'customer',
      isHidden: false,
      ...PUBLIC_REVIEW_QUERY,
    }),
    Review.countDocuments({
      revieweeId: providerUserId,
      reviewerType: 'customer',
      isHidden: false,
      moderationStatus: 'pending',
    }),
    statsAggregation,
  ]);

  // Extract stats from aggregation result
  const statsData = aggregationResult[0];
  const stats = {
    averageRating: statsData?.stats?.[0]?.avgRating
      ? Math.round(statsData.stats[0].avgRating * 10) / 10
      : 0,
    totalReviews: statsData?.stats?.[0]?.totalReviews ?? 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  };

  // Map rating distribution from aggregation results
  if (statsData?.ratingDistribution) {
    statsData.ratingDistribution.forEach((item: { _id: number; count: number }) => {
      if (item._id >= 1 && item._id <= 5) {
        const ratingKey = item._id as 1 | 2 | 3 | 4 | 5;
        stats.ratingDistribution[ratingKey] = item.count;
      }
    });
  }
  const transformedReviews = await transformProviderReviews(reviews);

  res.json({
    success: true,
    data: {
      reviews: transformedReviews,
      total,
      totalReviews: stats.totalReviews,
      averageRating: stats.averageRating,
      ratingDistribution: stats.ratingDistribution,
      approvedCount,
      pendingCount,
      reviewDisplaySettings: {
        showPendingOnReviewsPage:
          providerProfile?.settings?.reviewDisplaySettings?.showPendingOnReviewsPage ?? true,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    },
  });
});

/**
 * Get provider settings
 * GET /api/provider/settings
 */
export const getProviderSettings = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as IUser)._id;

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  const settings = providerProfile.settings as any || {};
  const availability = providerProfile.availability || ({} as any);
  const businessSettings = {
    autoAcceptBookings:
      settings.autoAcceptBookings ?? availability.autoAcceptBookings ?? false,
    instantBookingEnabled: settings.instantBookingEnabled || false,
    maxAdvanceBookingDays: availability.maxAdvanceBooking ?? 30,
    minBookingNoticeHours: availability.minNoticeTime ?? 24,
    cancellationPolicyHours: settings.cancellationPolicy?.freeUntilHours || 24,
  };
  const privacySettings = {
    showEmail: settings.privacySettings?.showEmail ?? false,
    showPhone: settings.privacySettings?.showPhoneNumber ?? true,
    showReviewsPublicly: settings.privacySettings?.showReviewsPublicly ?? true,
  };
  const reviewDisplaySettings = {
    showPendingOnReviewsPage:
      settings.reviewDisplaySettings?.showPendingOnReviewsPage ?? true,
  };

  res.json({
    success: true,
    data: {
      businessSettings,
      locationInfo: providerProfile.locationInfo || {},
      privacySettings,
      reviewDisplaySettings,
      analyticsPreferences: {
        emailReports: settings.analyticsPreferences?.emailReports ?? false,
        emailReportsFrequency: settings.analyticsPreferences?.emailReportsFrequency ?? 'weekly',
      },
    },
  });
});

/**
 * Update provider settings
 * PATCH /api/provider/settings
 */
export const updateProviderSettings = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as IUser)._id;
  const {
    businessSettings,
    locationInfo,
    privacySettings,
    reviewDisplaySettings,
    analyticsPreferences,
  } = req.body;

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  // Initialize settings if not exists
  const settings = (providerProfile.settings as any) || {};

  // Update business settings
  if (businessSettings) {
    if (businessSettings.autoAcceptBookings !== undefined) {
      settings.autoAcceptBookings = businessSettings.autoAcceptBookings;
    }
    if (businessSettings.cancellationPolicyHours !== undefined) {
      settings.cancellationPolicy = settings.cancellationPolicy || {};
      settings.cancellationPolicy.freeUntilHours = businessSettings.cancellationPolicyHours;
    }
    if (
      providerProfile.availability &&
      (
        businessSettings.maxAdvanceBookingDays !== undefined ||
        businessSettings.minBookingNoticeHours !== undefined ||
        businessSettings.autoAcceptBookings !== undefined
      )
    ) {
      if (businessSettings.maxAdvanceBookingDays !== undefined) {
        providerProfile.availability.maxAdvanceBooking = Math.max(
          1,
          Math.min(365, businessSettings.maxAdvanceBookingDays),
        );
      }
      if (businessSettings.minBookingNoticeHours !== undefined) {
        providerProfile.availability.minNoticeTime = Math.max(
          0,
          Math.min(168, businessSettings.minBookingNoticeHours),
        );
      }
      if (businessSettings.autoAcceptBookings !== undefined) {
        providerProfile.availability.autoAcceptBookings = businessSettings.autoAcceptBookings;
      }
      providerProfile.markModified('availability');
    }
  }

  // Update location info
  if (locationInfo) {
    const merged = {
      ...providerProfile.locationInfo,
      ...locationInfo,
    };
    if (locationInfo.serviceAreas !== undefined) {
      merged.serviceAreas = normalizeServiceAreas(locationInfo.serviceAreas) as any;
    }
    providerProfile.locationInfo = merged;
  }

  sanitizeProviderGeo(providerProfile);
  providerProfile.markModified('locationInfo');

  // Update privacy settings
  if (privacySettings) {
    settings.privacySettings = settings.privacySettings || {};
    if (privacySettings.showEmail !== undefined) {
      settings.privacySettings.showEmail = privacySettings.showEmail;
    }
    if (privacySettings.showPhone !== undefined) {
      settings.privacySettings.showPhoneNumber = privacySettings.showPhone;
    }
    if (privacySettings.showReviewsPublicly !== undefined) {
      settings.privacySettings.showReviewsPublicly = privacySettings.showReviewsPublicly;
    }
  }

  if (reviewDisplaySettings) {
    settings.reviewDisplaySettings = settings.reviewDisplaySettings || {
      showPendingOnReviewsPage: true,
    };
    if (reviewDisplaySettings.showPendingOnReviewsPage !== undefined) {
      settings.reviewDisplaySettings.showPendingOnReviewsPage =
        reviewDisplaySettings.showPendingOnReviewsPage;
    }
  }

  if (analyticsPreferences) {
    settings.analyticsPreferences = settings.analyticsPreferences || {
      emailReports: false,
      emailReportsFrequency: 'weekly',
    };
    if (analyticsPreferences.emailReports !== undefined) {
      settings.analyticsPreferences.emailReports = analyticsPreferences.emailReports;
    }
    if (analyticsPreferences.emailReportsFrequency !== undefined) {
      settings.analyticsPreferences.emailReportsFrequency = analyticsPreferences.emailReportsFrequency;
    }
  }

  providerProfile.settings = settings;

  await providerProfile.save();

  res.json({
    success: true,
    message: 'Settings updated successfully',
    data: {
      businessSettings: {
        autoAcceptBookings:
          settings.autoAcceptBookings
          ?? providerProfile.availability?.autoAcceptBookings
          ?? false,
        instantBookingEnabled: settings.instantBookingEnabled || false,
        maxAdvanceBookingDays: providerProfile.availability?.maxAdvanceBooking ?? 30,
        minBookingNoticeHours: providerProfile.availability?.minNoticeTime ?? 24,
        cancellationPolicyHours: settings.cancellationPolicy?.freeUntilHours || 24,
      },
      locationInfo: providerProfile.locationInfo,
      privacySettings: {
        showEmail: settings.privacySettings?.showEmail ?? false,
        showPhone: settings.privacySettings?.showPhoneNumber ?? true,
        showReviewsPublicly: settings.privacySettings?.showReviewsPublicly ?? true,
      },
      reviewDisplaySettings: {
        showPendingOnReviewsPage:
          settings.reviewDisplaySettings?.showPendingOnReviewsPage ?? true,
      },
      analyticsPreferences: {
        emailReports: settings.analyticsPreferences?.emailReports ?? false,
        emailReportsFrequency: settings.analyticsPreferences?.emailReportsFrequency ?? 'weekly',
      },
    },
  });
});

// ===========================================
// SERVICE CLONE
// ===========================================

/**
 * Clone a service with optional adjustments
 * POST /api/provider/services/:id/clone
 * SECURITY: Uses verifyServiceOwnership helper to prevent IDOR
 */
export const cloneService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = req.user as IUser;
  const {
    name,
    priceAdjustment,
    durationAdjustment,
    includeImages = true,
    includeTags = true,
    includeVariants = true,
    includeAddOns = true
  } = req.body;

  try {
    // SECURITY: Use reusable helper for ownership verification
    const { service: sourceService } = await verifyServiceOwnership(id, user);

    // Validate new name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ApiError(400, 'Service name is required');
    }
    if (name.length > 100) {
      throw new ApiError(400, 'Service name cannot exceed 100 characters');
    }

    // Check for duplicate names
    const existingService = await Service.findOne({
      providerId: user._id.toString(),
      name: { $regex: new RegExp(`^${escapeRegex(name.trim())}$`, 'i') },
      isDeleted: { $ne: true }
    });
    if (existingService) {
      throw new ApiError(400, 'A service with this name already exists');
    }

    // Build cloned service data
    const clonedService = new Service({
      providerId: user._id,
      name: name.trim(),
      category: sourceService.category,
      subcategory: sourceService.subcategory,
      description: sourceService.description,
      shortDescription: sourceService.shortDescription || '',
      duration: durationAdjustment || sourceService.duration,
      price: {
        amount: priceAdjustment !== undefined ? priceAdjustment : sourceService.price.amount,
        currency: sourceService.price.currency,
        type: sourceService.price.type,
        discounts: sourceService.price.discounts || []
      },
      tags: includeTags ? [...sourceService.tags] : [],
      requirements: [...(sourceService.requirements || [])],
      includedItems: [...(sourceService.includedItems || [])],
      addOns: includeAddOns ? sourceService.addOns?.map((a: any) => ({ ...a })) : [],
      durationOptions: includeVariants ? sourceService.durationOptions?.map((v: any) => ({ ...v })) : [],
      images: includeImages ? [...sourceService.images] : [],
      location: {
        ...sourceService.location
      },
      availability: {
        schedule: { ...sourceService.availability.schedule },
        exceptions: [],
        bufferTime: sourceService.availability.bufferTime,
        instantBooking: false,
        advanceBookingDays: sourceService.availability.advanceBookingDays
      },
      status: 'draft',
      isActive: false,
      isFeatured: false,
      isPopular: false,
      rating: {
        average: 0,
        count: 0,
        distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
      },
      searchMetadata: {
        searchCount: 0,
        clickCount: 0,
        bookingCount: 0,
        popularityScore: 0,
        searchKeywords: []
      },
      createdBy: user._id,
      updatedBy: user._id
    });

    await clonedService.save();

    logger.info('Service cloned successfully', {
      context: 'ProviderController',
      action: 'SERVICE_CLONED',
      sourceServiceId: id,
      newServiceId: clonedService._id.toString(),
      providerId: user._id.toString(),
    });

    res.status(201).json({
      success: true,
      message: 'Service cloned successfully. Review and publish when ready.',
      data: {
        service: clonedService
      }
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to clone service', error.message);
  }
});