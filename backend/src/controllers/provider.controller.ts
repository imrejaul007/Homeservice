import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import Booking from '../models/booking.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

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
  popularityScore: number;
  recentActivity: {
    period: string;
    views: number;
    clicks: number;
    bookings: number;
  }[];
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
    console.log('🚀 [createService] Starting service creation');
    console.log('🔍 [createService] Request body:', JSON.stringify(req.body, null, 2));

    // Get provider's location from their profile
    const ProviderProfile = require('../models/providerProfile.model').default;
    const providerProfile = await ProviderProfile.findOne({ userId: (req.user as any)._id });

    if (!providerProfile?.locationInfo?.primaryAddress) {
      throw new ApiError(400, 'Provider location not found. Please complete your profile first.');
    }

    console.log('🔍 [createService] Provider profile location:', JSON.stringify(providerProfile.locationInfo.primaryAddress, null, 2));

    // Validate and normalize category/subcategory against database (single source of truth)
    const { category, subcategory } = await validateAndNormalizeCategorySubcategory(
      req.body.category,
      req.body.subcategory
    );
    req.body.category = category;
    req.body.subcategory = subcategory;
    console.log('✅ [createService] Category/subcategory validated:', { category, subcategory });

    // ✅ FIX: Extract coordinates properly from provider profile and convert to array format
    // Now uses GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
    let serviceCoordinates: [number, number];
    const coords = providerProfile.locationInfo.primaryAddress.coordinates;

    if (coords?.coordinates && Array.isArray(coords.coordinates) && coords.coordinates.length === 2) {
      // New GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
      serviceCoordinates = coords.coordinates as [number, number];
      console.log(`✅ [createService] Using GeoJSON coordinates: [${serviceCoordinates}]`);
    } else if (coords?.lat !== undefined && coords?.lng !== undefined) {
      // Legacy format: { lat, lng } - convert to array [lng, lat]
      serviceCoordinates = [coords.lng, coords.lat];
      console.log(`⚠️ [createService] Converted legacy lat/lng to array: [${serviceCoordinates}]`);
    } else {
      // Fallback to Dubai coordinates (default for the platform)
      console.log('⚠️ [createService] No coordinates found, using Dubai default');
      serviceCoordinates = [55.2708, 25.2048]; // [lng, lat]
    }

    console.log('🔍 [createService] Using coordinates:', serviceCoordinates);

    // Add provider ID and audit fields with inherited location
    const serviceData = {
      ...req.body,
      // Inherit location from provider profile
      location: {
        address: providerProfile.locationInfo.primaryAddress,
        coordinates: {
          type: 'Point',
          coordinates: serviceCoordinates // ✅ FIX: Properly formatted coordinates array
        },
        serviceArea: {
          type: 'radius',
          value: providerProfile.locationInfo.serviceRadius || 25,
          maxDistance: providerProfile.locationInfo.serviceRadius || 25
        }
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

    console.log('🔍 [createService] Final service data:', JSON.stringify(serviceData, null, 2));

    const service = new Service(serviceData);
    await service.save();

    console.log('✅ [createService] Service created successfully:', service._id);

    res.status(201).json({
      success: true,
      message: 'Service submitted for admin approval',
      data: { service }
    });
  } catch (error: any) {
    console.error('❌ [createService] Error creating service:', error);
    console.error('❌ [createService] Error stack:', error.stack);
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

    // Add audit fields
    const updateData = {
      ...req.body,
      updatedBy: (req.user as any)._id,
      updatedAt: new Date()
    };
    
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
 * Delete service (soft delete by setting inactive)
 * DELETE /api/provider/services/:id
 */
export const deleteService = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    // Check if service exists and belongs to provider
    const service = await Service.findOne({
      _id: id,
      providerId: (req.user as any)._id.toString()
    });
    
    if (!service) {
      throw new ApiError(404, 'Service not found or access denied');
    }
    
    // Soft delete by setting inactive
    await Service.findByIdAndUpdate(id, {
      isActive: false,
      status: 'inactive',
      updatedBy: (req.user as any)._id,
      updatedAt: new Date()
    });
    
    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error: any) {
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
  
  // Validate status
  const validStatuses = ['draft', 'active', 'inactive', 'pending_review'];
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
    
    // Update status and isActive flag
    const updateData: any = {
      status,
      updatedBy: (req.user as any)._id,
      updatedAt: new Date()
    };
    
    // Update isActive based on status
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
    
    // Calculate analytics
    const analytics: ServiceAnalytics = {
      totalViews: service.searchMetadata.searchCount,
      totalClicks: service.searchMetadata.clickCount,
      totalBookings: service.searchMetadata.bookingCount,
      conversionRate: service.searchMetadata.searchCount > 0 
        ? (service.searchMetadata.clickCount / service.searchMetadata.searchCount) * 100 
        : 0,
      popularityScore: service.searchMetadata.popularityScore,
      recentActivity: [
        {
          period: 'Last 7 days',
          views: Math.floor(service.searchMetadata.searchCount * 0.3), // Mock recent data
          clicks: Math.floor(service.searchMetadata.clickCount * 0.3),
          bookings: Math.floor(service.searchMetadata.bookingCount * 0.3)
        }
      ]
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

    // Get unique categories from services
    const categories = [...new Set(services.map(s => s.category).filter(Boolean))];

    const overview = {
      serviceStats: {
        total: totalServices,
        active: activeServices,
        draft: draftServices,
        inactive: inactiveServices
      },
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
      categories,
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