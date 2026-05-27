import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import Booking from '../models/booking.model';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
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

// Helper function to validate and normalize category/subcategory against database
const validateAndNormalizeCategorySubcategory = async (category: string, subcategory?: string) => {
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

  // Build query
  const query: any = { providerId: (req.user as any)._id.toString() };

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
    query.category = { $regex: new RegExp(category as string, 'i') };
  }

  // Search filter
  if (search) {
    query.$or = [
      { name: { $regex: new RegExp(search as string, 'i') } },
      { description: { $regex: new RegExp(search as string, 'i') } },
      { category: { $regex: new RegExp(search as string, 'i') } }
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
 * Get specific service by ID (provider must own the service)
 * GET /api/provider/services/:id
 */
export const getServiceById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const service = await Service.findOne({
      _id: id,
      providerId: (req.user as any)._id.toString()
    }).lean();
    
    if (!service) {
      throw new ApiError(404, 'Service not found or access denied');
    }
    
    res.json({
      success: true,
      data: { service }
    });
  } catch (error: any) {
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
      userId: (req.user as any)?._id?.toString(),
    });

    // Get provider's location from their profile
    const ProviderProfile = require('../models/providerProfile.model').default;
    const providerProfile = await ProviderProfile.findOne({ userId: (req.user as any)._id });

    if (!providerProfile?.locationInfo?.primaryAddress) {
      throw new ApiError(400, 'Provider location not found. Please complete your profile first.');
    }

    logger.debug('Provider profile location found', {
      context: 'ProviderController',
      action: 'PROVIDER_LOCATION_FOUND',
      userId: (req.user as any)?._id?.toString(),
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
      providerId: (req.user as any)._id.toString(),
      createdBy: (req.user as any)._id,
      updatedBy: (req.user as any)._id,
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
      const providerId = (req.user as any)._id.toString();
      socketServer.emitNewServicePending(service._id.toString(), providerId, service.name);
    }

    logger.info('Service created successfully', {
      context: 'ProviderController',
      action: 'SERVICE_CREATED',
      serviceId: service._id.toString(),
      userId: (req.user as any)?._id?.toString(),
    });

    res.status(201).json({
      success: true,
      message: 'Service submitted for admin approval',
      data: { service }
    });
  } catch (error: any) {
    logger.error('Error creating service', {
      context: 'ProviderController',
      action: 'CREATE_SERVICE_ERROR',
      userId: (req.user as any)?._id?.toString(),
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
 */
export const updateService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    // Check if service exists and belongs to provider
    const existingService = await Service.findOne({
      _id: id,
      providerId: (req.user as any)._id.toString()
    });
    
    if (!existingService) {
      throw new ApiError(404, 'Service not found or access denied');
    }

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

    // Strip system-owned fields; provider may set status (including active)
    const {
      isActive: _isActive,
      providerId: _providerId,
      location: _location,
      searchMetadata: _searchMetadata,
      rating: _rating,
      createdBy: _createdBy,
      ...providerEditableFields
    } = req.body;

    const updateData: Record<string, unknown> = {
      ...providerEditableFields,
      updatedBy: (req.user as any)._id,
      updatedAt: new Date(),
    };

    if (typeof updateData.status === 'string') {
      updateData.isActive = updateData.status === 'active';
    }

    const service = await Service.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).lean();
    
    res.json({
      success: true,
      message: 'Service updated successfully',
      data: { service }
    });
  } catch (error: any) {
    throw new ApiError(500, 'Failed to update service', error.message);
  }
});

/**
 * Delete service permanently
 * DELETE /api/provider/services/:id
 */
export const deleteService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const service = await Service.findOne({
      _id: id,
      providerId: (req.user as any)._id.toString()
    });
    
    if (!service) {
      throw new ApiError(404, 'Service not found or access denied');
    }

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
    
    await Service.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Service permanently deleted'
    });
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Failed to delete service', error.message);
  }
});

/**
 * Toggle service status (active/inactive)
 * PATCH /api/provider/services/:id/status
 */
export const toggleServiceStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  // Validate status against SERVICE_STATUS constants
  const validStatuses = ['active', 'inactive'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status. Must be: ' + validStatuses.join(', '));
  }
  
  try {
    // Check if service exists and belongs to provider
    const service = await Service.findOne({
      _id: id,
      providerId: (req.user as any)._id.toString()
    });
    
    if (!service) {
      throw new ApiError(404, 'Service not found or access denied');
    }
    
    const updateData: any = {
      status,
      updatedBy: (req.user as any)._id,
      updatedAt: new Date()
    };
    
    updateData.isActive = status === 'active';
    
    const updatedService = await Service.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).lean();
    
    res.json({
      success: true,
      message: `Service status updated to ${status}`,
      data: { service: updatedService }
    });
  } catch (error: any) {
    throw new ApiError(500, 'Failed to update service status', error.message);
  }
});

// ===================================
// ANALYTICS & INSIGHTS
// ===================================

/**
 * Get service-specific analytics
 * GET /api/provider/services/:id/analytics
 */
export const getServiceAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    // Check if service exists and belongs to provider
    const service = await Service.findOne({
      _id: id,
      providerId: (req.user as any)._id.toString()
    }).lean();
    
    if (!service) {
      throw new ApiError(404, 'Service not found or access denied');
    }
    
    const totalViews = service.searchMetadata.searchCount;
    const totalClicks = service.searchMetadata.clickCount;
    const totalBookings = service.searchMetadata.bookingCount;

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
    throw new ApiError(500, 'Failed to fetch service analytics', error.message);
  }
});

/**
 * Provider analytics dashboard (insights page)
 * GET /api/provider/analytics/insights?period=7d|30d|90d
 */
export const getProviderInsightsAnalytics = asyncHandler(
  async (req: Request, res: Response) => {
    const providerId = (req.user as any)._id.toString();
    const periodParam = String(req.query.period || '30d');
    const period = (['7d', '30d', '90d'].includes(periodParam)
      ? periodParam
      : '30d') as '7d' | '30d' | '90d';

    const { getProviderInsightsAnalytics: loadInsights } = await import(
      '../services/providerInsightsAnalytics.service'
    );
    const analytics = await loadInsights(providerId, period);

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
    const providerId = (req.user as any)._id.toString();

    // Get all provider services
    const services = await Service.find({
      providerId
    }).lean();

    // Calculate overview statistics from services
    const totalServices = services.length;
    const activeServices = services.filter(s => s.isActive && s.status === 'active').length;
    const draftServices = services.filter(s => s.status === 'draft').length;
    const inactiveServices = services.filter(s => s.status === 'inactive').length;
    const pendingReviewServices = services.filter(s => s.status === 'pending_review').length;

    // Calculate status counts for filter UI
    const statusCounts = {
      all: totalServices,
      active: activeServices,
      draft: draftServices,
      inactive: inactiveServices,
      pending_review: pendingReviewServices
    };

    const totalViews = services.reduce((sum, service) => sum + service.searchMetadata.searchCount, 0);
    const totalClicks = services.reduce((sum, service) => sum + service.searchMetadata.clickCount, 0);
    const totalBookings = services.reduce((sum, service) => sum + service.searchMetadata.bookingCount, 0);

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

    // Use aggregation to compute booking stats in a single query
    const bookingStats = await Booking.aggregate([
      { $match: { providerId: new mongoose.Types.ObjectId(providerId) } },
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
          ]
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
        bookings: service.searchMetadata.bookingCount,
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

    const overview = {
      serviceStats: {
        total: totalServices,
        active: activeServices,
        draft: draftServices,
        inactive: inactiveServices,
        pending_review: pendingReviewServices
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
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews
      },
      bookingStats: {
        newBookings,
        pendingRequests: pendingBookings,
        todaySchedule: todayBookings,
        completedThisMonth
      },
      revenueStats: {
        monthlyRevenue,
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
      topServices
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
    let providerId = (req.user as any)._id?.toString();
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
 */
export const getProviderVerification = asyncHandler(async (req: Request, res: Response) => {
  try {
    // Use authenticated user, or allow query param for admin fallback
    let providerId = (req.user as any)._id?.toString();
    if (!providerId && req.query.providerId) {
      providerId = req.query.providerId as string;
    }

    if (!providerId) {
      throw new ApiError(401, 'Provider ID not found');
    }

    // Import here to avoid circular dependency
    const { providerOpsService } = await import('../services/providerOps.service');

    const documentStatus = await providerOpsService.getDocumentVerificationStatus(providerId);

    res.json({
      success: true,
      data: documentStatus
    });
  } catch (error: any) {
    throw new ApiError(500, 'Failed to fetch verification status', error.message);
  }
});

/**
 * Upload verification document
 * POST /api/provider/verification/documents
 */
export const uploadVerificationDocument = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id;

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
  const category = documentType.includes('id') || documentType.includes('passport') || documentType.includes('license')
    ? 'identity'
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
 * Submit verification for review
 * POST /api/provider/verification/submit
 */
export const submitVerification = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id;

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
    socketServer.emitNewProviderSubmission(providerId, businessName);
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
  const providerId = (req.user as any)._id;

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
 * Create a new portfolio item
 * POST /api/provider/portfolio
 */
export const createPortfolioItem = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id;
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
 */
export const updatePortfolioItem = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id;
  const { itemId } = req.params;
  const { title, description, category, images, tags, clientTestimonial, isVisible } = req.body;

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  const itemIndex = providerProfile.portfolio?.featured.findIndex(
    (item: any) => item._id?.toString() === itemId || item._id === itemId
  );

  if (itemIndex === -1 || itemIndex === undefined) {
    throw new ApiError(404, 'Portfolio item not found');
  }

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
 */
export const deletePortfolioItem = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id;
  const { itemId } = req.params;

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  const initialLength = providerProfile.portfolio?.featured?.length || 0;
  providerProfile.portfolio.featured = providerProfile.portfolio.featured.filter(
    (item: any) => item._id?.toString() !== itemId && item._id !== itemId
  );

  if (providerProfile.portfolio.featured.length === initialLength) {
    throw new ApiError(404, 'Portfolio item not found');
  }

  await providerProfile.save();

  res.json({
    success: true,
    message: 'Portfolio item deleted successfully',
  });
});

/**
 * Add images to an existing portfolio item
 * PATCH /api/provider/portfolio/:itemId/images
 */
export const addPortfolioImage = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id;
  const { itemId } = req.params;

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  const item = providerProfile.portfolio?.featured.find(
    (i: any) => i._id?.toString() === itemId || i._id === itemId
  );

  if (!item) {
    throw new ApiError(404, 'Portfolio item not found');
  }

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
 */
export const removePortfolioImage = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id;
  const { itemId, imageId } = req.params;

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  const item = providerProfile.portfolio?.featured.find(
    (i: any) => i._id?.toString() === itemId || i._id === itemId
  );

  if (!item) {
    throw new ApiError(404, 'Portfolio item not found');
  }

  const initialLength = item.images?.length || 0;
  item.images = (item.images || []).filter((img: any) => {
    const imgId = img._id?.toString() || img.url || String(img);
    return imgId !== imageId;
  });

  if (item.images.length === initialLength) {
    throw new ApiError(404, 'Image not found');
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

/**
 * Get provider settings
 * GET /api/provider/settings
 */
export const getProviderSettings = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id;

  const providerProfile = await ProviderProfile.findOne({ userId: providerId });
  if (!providerProfile) {
    throw new ApiError(404, 'Provider profile not found');
  }

  const settings = providerProfile.settings as any || {};
  const businessSettings = {
    autoAcceptBookings: settings.autoAcceptBookings || false,
    instantBookingEnabled: settings.instantBookingEnabled || false,
    cancellationPolicyHours: settings.cancellationPolicy?.freeUntilHours || 24,
  };
  const privacySettings = {
    showEmail: settings.privacySettings?.showEmail ?? false,
    showPhone: settings.privacySettings?.showPhoneNumber ?? true,
    showReviewsPublicly: true,
  };

  res.json({
    success: true,
    data: {
      businessSettings,
      locationInfo: providerProfile.locationInfo || {},
      privacySettings,
    },
  });
});

/**
 * Update provider settings
 * PATCH /api/provider/settings
 */
export const updateProviderSettings = asyncHandler(async (req: Request, res: Response) => {
  const providerId = (req.user as any)._id;
  const {
    businessSettings,
    locationInfo,
    privacySettings,
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
  }

  providerProfile.settings = settings;

  await providerProfile.save();

  res.json({
    success: true,
    message: 'Settings updated successfully',
    data: {
      businessSettings: {
        autoAcceptBookings: settings.autoAcceptBookings || false,
        instantBookingEnabled: settings.instantBookingEnabled || false,
        cancellationPolicyHours: settings.cancellationPolicy?.freeUntilHours || 24,
      },
      locationInfo: providerProfile.locationInfo,
      privacySettings: {
        showEmail: settings.privacySettings?.showEmail ?? false,
        showPhone: settings.privacySettings?.showPhoneNumber ?? true,
        showReviewsPublicly: true,
      },
    },
  });
});