import { Request, Response } from 'express';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
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

interface ServiceQuery {
  providerId: string;
  status?: string;
  isActive?: boolean;
}

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
  const { status, sortBy = 'createdAt', order = 'desc', page = 1, limit = 20 } = req.query;
  
  // Build query
  const query: ServiceQuery = { providerId: (req.user as any)._id.toString() };
  if (status && status !== 'all') {
    query.status = status as string;
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
    let serviceCoordinates;
    if (providerProfile.locationInfo.primaryAddress.coordinates) {
      const coords = providerProfile.locationInfo.primaryAddress.coordinates;

      // Check if coordinates are in lat/lng object format
      if (coords.lat && coords.lng) {
        // Convert lat/lng object to [lng, lat] array format
        serviceCoordinates = [coords.lng, coords.lat];
        console.log(`🔄 [createService] Converted lat/lng object to array: [${coords.lng}, ${coords.lat}]`);
      }
      // Check if coordinates are already in GeoJSON format
      else if (coords.coordinates && Array.isArray(coords.coordinates)) {
        serviceCoordinates = coords.coordinates;
        console.log(`✅ [createService] Using existing GeoJSON coordinates: [${coords.coordinates}]`);
      }
      // Check if coordinates are directly an array
      else if (Array.isArray(coords)) {
        serviceCoordinates = coords;
        console.log(`✅ [createService] Using direct array coordinates: [${coords}]`);
      }
      else {
        // Fallback to Assam coordinates
        console.log('⚠️ [createService] Unknown coordinate format, using Assam default');
        serviceCoordinates = [92.9376, 26.2006]; // [lng, lat]
      }
    } else {
      // No coordinates - use Assam, India as default
      console.log('⚠️ [createService] No coordinates found, using default for Assam');
      serviceCoordinates = [92.9376, 26.2006]; // Assam, India coordinates [lng, lat]
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
    // Get all provider services
    const services = await Service.find({
      providerId: (req.user as any)._id.toString()
    }).lean();
    
    // Calculate overview statistics
    const totalServices = services.length;
    const activeServices = services.filter(s => s.isActive && s.status === 'active').length;
    const draftServices = services.filter(s => s.status === 'draft').length;
    const inactiveServices = services.filter(s => s.status === 'inactive').length;
    
    const totalViews = services.reduce((sum, service) => sum + service.searchMetadata.searchCount, 0);
    const totalClicks = services.reduce((sum, service) => sum + service.searchMetadata.clickCount, 0);
    const totalBookings = services.reduce((sum, service) => sum + service.searchMetadata.bookingCount, 0);
    
    const averageRating = services.reduce((sum, service) => sum + service.rating.average, 0) / totalServices || 0;
    const totalReviews = services.reduce((sum, service) => sum + service.rating.count, 0);
    
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