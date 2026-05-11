import { Request, Response } from 'express';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

// ===================================
// INTERFACES & TYPES
// ===================================

export interface SearchResponse {
  success: boolean;
  data: {
    services?: any[];
    providers?: any[];
    categories?: any[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
    filters?: {
      categories: Array<{ name: string; count: number }>;
      priceRange: { min: number; max: number };
      averageRating: number;
      locationInfo?: {
        city: string;
        radius: number;
      };
    };
    searchMetadata?: {
      query?: string;
      resultCount: number;
      searchTime: number;
      suggestions?: string[];
    };
  };
  message?: string;
}

interface SearchFilters {
  q?: string;
  category?: string;
  subcategory?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  lat?: number;
  lng?: number;
  radius?: number;
  city?: string;
  state?: string;
  sortBy: 'popularity' | 'price' | 'price_desc' | 'rating' | 'distance' | 'newest';
  page: number;
  limit: number;
  isActive: boolean;
}

// ===================================
// SEARCH SERVICES
// ===================================

/**
 * Search services with comprehensive filtering and sorting
 * GET /api/search/services
 */
export const searchServices = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Parse and validate query parameters
    const filters = parseSearchFilters(req.query);
    
    // Build search query
    const { query, countQuery } = buildServiceSearchQuery(filters);
    
    // Execute search with population
    const [services, totalCount] = await Promise.all([
      Service.find(query)
        .populate('provider', 'firstName lastName avatar rating reviewsData businessInfo')
        .sort(buildSortQuery(filters))
        .skip(((filters.page || 1) - 1) * (filters.limit || 20))
        .limit(filters.limit || 20),
      Service.countDocuments(countQuery)
    ]);

    // Process results and add distance for geo searches
    const processedServices = await processSearchResults(services, filters);

    // Increment search counts for tracked services (background task)
    incrementSearchCounts(services.slice(0, 10)); // Top 10 results only

    // Generate pagination
    const pagination = generatePagination(
      filters.page || 1,
      filters.limit || 20,
      totalCount
    );

    // Generate search suggestions if no results
    const suggestions = totalCount === 0 ? await generateSearchSuggestions(filters.q) : undefined;

    const searchTime = Date.now() - startTime;

    const response: SearchResponse = {
      success: true,
      data: {
        services: processedServices,
        pagination,
        searchMetadata: {
          query: filters.q,
          resultCount: totalCount,
          searchTime,
          suggestions
        }
      }
    };

    res.json(response);

  } catch (error: any) {
    console.error('Service search error:', error);
    throw new ApiError(500, 'Search operation failed', error.message);
  }
});

/**
 * Get service suggestions/autocomplete
 * GET /api/search/suggestions
 */
export const getSearchSuggestions = asyncHandler(async (req: Request, res: Response) => {
  const { q, limit = 10 } = req.query;

  if (!q || typeof q !== 'string' || q.length < 2) {
    return res.json({
      success: true,
      data: { suggestions: [] }
    });
  }

  try {
    // Get service name suggestions
    const serviceNameSuggestions = await Service.aggregate([
      {
        $match: {
          isActive: true,
          name: { $regex: new RegExp(q, 'i') }
        }
      },
      {
        $group: {
          _id: '$name',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: Math.floor(Number(limit) / 2) },
      { $project: { suggestion: '$_id', type: 'service' } }
    ]);

    // Get category suggestions
    const categorySuggestions = await ServiceCategory.aggregate([
      {
        $match: {
          isActive: true,
          $or: [
            { name: { $regex: new RegExp(q, 'i') } },
            { 'subcategories.name': { $regex: new RegExp(q, 'i') } }
          ]
        }
      },
      { $limit: Math.floor(Number(limit) / 2) },
      { $project: { suggestion: '$name', type: 'category' } }
    ]);

    const suggestions = [
      ...serviceNameSuggestions.map(s => ({ text: s.suggestion, type: s.type })),
      ...categorySuggestions.map(s => ({ text: s.suggestion, type: s.type }))
    ].slice(0, Number(limit));

    return res.json({
      success: true,
      data: { suggestions }
    });

  } catch (error: any) {
    throw new ApiError(500, 'Failed to get search suggestions', error.message);
  }
});

/**
 * Get popular/trending services
 * GET /api/search/trending
 */
export const getTrendingServices = asyncHandler(async (req: Request, res: Response) => {
  const { limit = 10, timeframe = '7d' } = req.query;

  try {
    let dateFilter = {};
    const now = new Date();
    
    switch (timeframe) {
      case '1d':
        dateFilter = { 'searchMetadata.lastSearched': { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } };
        break;
      case '7d':
        dateFilter = { 'searchMetadata.lastSearched': { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case '30d':
        dateFilter = { 'searchMetadata.lastSearched': { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
        break;
    }

    const trendingServices = await Service.find({
      isActive: true,
      status: 'active', // ✅ SECURITY FIX: Only show approved services in trending
      ...dateFilter
    })
    .populate('provider', 'firstName lastName avatar rating')
    .sort({ 'searchMetadata.popularityScore': -1, 'searchMetadata.searchCount': -1 })
    .limit(Number(limit));

    res.json({
      success: true,
      data: { services: trendingServices }
    });

  } catch (error: any) {
    throw new ApiError(500, 'Failed to get trending services', error.message);
  }
});

/**
 * Get search filters metadata
 * GET /api/search/filters
 */
export const getSearchFilters = asyncHandler(async (req: Request, res: Response) => {
  const { lat, lng, radius } = req.query;

  try {
    let locationFilter = {};
    
    // Add location filter if coordinates provided
    if (lat && lng && radius) {
      locationFilter = {
        'location.coordinates': {
          $near: {
            $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
            $maxDistance: Number(radius) * 1000
          }
        }
      };
    }

    // Get category distribution
    const categoryStats = await Service.aggregate([
      { $match: { isActive: true, ...locationFilter } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          avgPrice: { $avg: '$price.amount' },
          avgRating: { $avg: '$rating.average' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get price range
    const priceStats = await Service.aggregate([
      { $match: { isActive: true, ...locationFilter } },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price.amount' },
          maxPrice: { $max: '$price.amount' },
          avgPrice: { $avg: '$price.amount' }
        }
      }
    ]);

    // Get rating distribution
    const ratingStats = await Service.aggregate([
      { $match: { isActive: true, ...locationFilter } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating.average' },
          totalWithRatings: { $sum: { $cond: [{ $gt: ['$rating.count', 0] }, 1, 0] } }
        }
      }
    ]);

    const filters = {
      categories: categoryStats.map(cat => ({
        name: cat._id,
        count: cat.count,
        avgPrice: Math.round(cat.avgPrice || 0),
        avgRating: Number((cat.avgRating || 0).toFixed(1))
      })),
      priceRange: {
        min: priceStats[0]?.minPrice || 0,
        max: priceStats[0]?.maxPrice || 500,
        average: Math.round(priceStats[0]?.avgPrice || 0)
      },
      averageRating: Number((ratingStats[0]?.avgRating || 0).toFixed(1)),
      ...(lat && lng && { locationInfo: { lat: Number(lat), lng: Number(lng), radius: Number(radius) } })
    };

    res.json({
      success: true,
      data: { filters }
    });

  } catch (error: any) {
    throw new ApiError(500, 'Failed to get search filters', error.message);
  }
});

// ===================================
// HELPER FUNCTIONS
// ===================================

function parseSearchFilters(query: any): SearchFilters {
  return {
    q: query.q ? String(query.q).trim() : undefined,
    category: query.category ? String(query.category) : undefined,
    subcategory: query.subcategory ? String(query.subcategory) : undefined,
    minPrice: query.minPrice ? Number(query.minPrice) : undefined,
    maxPrice: query.maxPrice ? Number(query.maxPrice) : undefined,
    minRating: query.minRating ? Number(query.minRating) : undefined,
    lat: query.lat ? Number(query.lat) : undefined,
    lng: query.lng ? Number(query.lng) : undefined,
    radius: query.radius ? Number(query.radius) : undefined,
    city: query.city ? String(query.city) : undefined,
    state: query.state ? String(query.state) : undefined,
    sortBy: (query.sortBy as 'popularity' | 'price' | 'price_desc' | 'rating' | 'distance' | 'newest') || 'popularity',
    page: query.page ? Math.max(1, Number(query.page)) : 1,
    limit: query.limit ? Math.min(100, Math.max(1, Number(query.limit))) : 20,
    isActive: query.isActive !== 'false' // Default to true unless explicitly false
  };
}

function buildServiceSearchQuery(filters: SearchFilters) {
  let query: any = {};
  let countQuery: any = {};

  // Base filter - only active services with approved status
  if (filters.isActive !== false) {
    query.isActive = true;
    query.status = 'active'; // ✅ SECURITY FIX: Only show approved services to customers
    countQuery.isActive = true;
    countQuery.status = 'active';
  }

  // Text search
  if (filters.q) {
    query.$text = { $search: filters.q };
    countQuery.$text = { $search: filters.q };
  }

  // Category filters
  if (filters.category) {
    query.category = filters.category;
    countQuery.category = filters.category;
  }
  
  if (filters.subcategory) {
    query.subcategory = filters.subcategory;
    countQuery.subcategory = filters.subcategory;
  }

  // Price range filter
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    query['price.amount'] = {};
    countQuery['price.amount'] = {};
    
    if (filters.minPrice !== undefined) {
      query['price.amount'].$gte = filters.minPrice;
      countQuery['price.amount'].$gte = filters.minPrice;
    }
    
    if (filters.maxPrice !== undefined) {
      query['price.amount'].$lte = filters.maxPrice;
      countQuery['price.amount'].$lte = filters.maxPrice;
    }
  }

  // Rating filter
  if (filters.minRating) {
    query['rating.average'] = { $gte: filters.minRating };
    countQuery['rating.average'] = { $gte: filters.minRating };
  }

  // Geographic filters
  if (filters.lat && filters.lng && filters.radius) {
    const geoQuery = {
      'location.coordinates': {
        $near: {
          $geometry: { type: 'Point', coordinates: [filters.lng, filters.lat] },
          $maxDistance: filters.radius * 1000 // Convert km to meters
        }
      }
    };
    query = { ...query, ...geoQuery };
    countQuery = { ...countQuery, ...geoQuery };
  }

  // City/State filters (alternative to coordinates)
  if (filters.city && !filters.lat) {
    query['location.address.city'] = new RegExp(filters.city, 'i');
    countQuery['location.address.city'] = new RegExp(filters.city, 'i');
  }
  
  if (filters.state && !filters.lat) {
    query['location.address.state'] = new RegExp(filters.state, 'i');
    countQuery['location.address.state'] = new RegExp(filters.state, 'i');
  }

  return { query, countQuery };
}

function buildSortQuery(filters: SearchFilters): any {
  let sort: any = {};

  switch (filters.sortBy) {
    case 'price':
      sort['price.amount'] = 1;
      break;
    case 'price_desc':
      sort['price.amount'] = -1;
      break;
    case 'rating':
      sort['rating.average'] = -1;
      sort['rating.count'] = -1; // Secondary sort by number of reviews
      break;
    case 'distance':
      // Distance sorting is handled by MongoDB's $near operator
      break;
    case 'newest':
      sort.createdAt = -1;
      break;
    case 'popularity':
    default:
      sort['searchMetadata.popularityScore'] = -1;
      sort['rating.average'] = -1; // Secondary sort
      break;
  }

  // If text search, include text score in sort
  if (filters.q) {
    sort = { score: { $meta: 'textScore' }, ...sort };
  }

  return sort;
}

async function processSearchResults(services: any[], filters: SearchFilters) {
  return services.map(service => {
    const result = service.toJSON();
    
    // Add computed fields
    result.provider = result.provider || {};
    result.fullLocation = service.fullLocation;
    
    // Add distance if it's a geographic search
    if (filters.lat && filters.lng && result.location?.coordinates?.coordinates) {
      result.distance = calculateDistance(
        filters.lat,
        filters.lng,
        result.location.coordinates.coordinates[1], // latitude
        result.location.coordinates.coordinates[0]  // longitude
      );
    }

    return result;
  });
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in kilometers
  return Math.round(d * 100) / 100; // Round to 2 decimal places
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

function generatePagination(page: number, limit: number, total: number) {
  const pages = Math.ceil(total / limit);
  
  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1,
    nextPage: page < pages ? page + 1 : null,
    prevPage: page > 1 ? page - 1 : null
  };
}

async function generateSearchSuggestions(query?: string): Promise<string[]> {
  if (!query || query.length < 2) return [];

  try {
    // Get similar service names
    const suggestions = await Service.aggregate([
      {
        $match: {
          isActive: true,
          $or: [
            { name: { $regex: new RegExp(query, 'i') } },
            { category: { $regex: new RegExp(query, 'i') } },
            { tags: { $elemMatch: { $regex: new RegExp(query, 'i') } } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          names: { $addToSet: '$name' },
          categories: { $addToSet: '$category' },
          tags: { $addToSet: '$tags' }
        }
      }
    ]);

    if (suggestions.length === 0) return [];

    const result = suggestions[0];
    const allSuggestions = [
      ...result.names,
      ...result.categories,
      ...(result.tags ? result.tags.flat() : [])
    ].slice(0, 5);

    return allSuggestions;
  } catch (error) {
    console.error('Error generating suggestions:', error);
    return [];
  }
}

/**
 * Get service by ID
 * GET /api/search/service/:id
 */
export const getServiceById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    // First get the service - only show active approved services to customers
    const service = await Service.findOne({
      _id: id,
      isActive: true,
      status: 'active' // ✅ SECURITY FIX: Only allow customers to view approved services
    }).lean();

    if (!service) {
      throw new ApiError(404, 'Service not found or not available');
    }

    // Get provider details from ProviderProfile and User
    const providerProfile = await ProviderProfile.findOne({ 
      userId: service.providerId 
    }).lean();
    
    const providerUser = await User.findById(service.providerId).lean();

    // Combine service with provider information
    const serviceWithProvider = {
      ...service,
      provider: {
        _id: service.providerId,
        firstName: providerUser?.firstName || 'Unknown',
        lastName: providerUser?.lastName || 'User',
        avatar: providerProfile?.instagramStyleProfile?.profilePhoto,
        businessInfo: {
          businessName: providerProfile?.businessInfo?.businessName || 'Business',
          description: providerProfile?.businessInfo?.description || '',
          website: providerProfile?.businessInfo?.website || '',
          businessType: providerProfile?.businessInfo?.businessType || 'individual'
        },
        rating: {
          average: (providerProfile as any)?.rating?.average || 0,
          count: (providerProfile as any)?.rating?.totalReviews || 0
        }
      }
    };
    
    // Increment click count in background
    setImmediate(async () => {
      try {
        await Service.findByIdAndUpdate(id, {
          $inc: { 'searchMetadata.clickCount': 1 }
        });
      } catch (error) {
        console.error('Error incrementing click count:', error);
      }
    });
    
    res.json({
      success: true,
      data: { service: serviceWithProvider }
    });
  } catch (error: any) {
    throw new ApiError(500, 'Failed to get service details', error.message);
  }
});

/**
 * Track service click
 * POST /api/search/service/:id/click
 */
export const trackServiceClick = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  
  try {
    const service = await Service.findByIdAndUpdate(
      id,
      { 
        $inc: { 'searchMetadata.clickCount': 1 },
        $set: { 'searchMetadata.lastSearched': new Date() }
      },
      { new: true }
    );
    
    if (!service) {
      throw new ApiError(404, 'Service not found');
    }
    
    res.json({
      success: true,
      message: 'Click tracked successfully'
    });
  } catch (error: any) {
    throw new ApiError(500, 'Failed to track click', error.message);
  }
});

/**
 * Get popular services
 * GET /api/search/popular
 */
export const getPopularServices = asyncHandler(async (req: Request, res: Response) => {
  const { limit = 20, category } = req.query;
  
  try {
    let query: any = { isActive: true, status: 'active', isPopular: true }; // ✅ SECURITY FIX: Only show approved services in popular
    if (category) {
      query.category = category;
    }
    
    const popularServices = await Service.find(query)
      .populate('provider', 'firstName lastName avatar rating')
      .sort({ 'searchMetadata.popularityScore': -1, 'rating.average': -1 })
      .limit(Number(limit))
      .lean();
    
    res.json({
      success: true,
      data: { services: popularServices }
    });
  } catch (error: any) {
    throw new ApiError(500, 'Failed to get popular services', error.message);
  }
});

/**
 * Get services by category
 * GET /api/search/category/:category
 */
export const getServicesByCategory = asyncHandler(async (req: Request, res: Response) => {
  const { category } = req.params;
  const filters = parseSearchFilters({ ...req.query, category });
  
  try {
    const { query, countQuery } = buildServiceSearchQuery(filters);
    const sortQuery = buildSortQuery(filters);
    
    const [services, totalCount] = await Promise.all([
      Service.find(query)
        .populate('provider', 'firstName lastName avatar rating')
        .sort(sortQuery)
        .skip((filters.page - 1) * filters.limit)
        .limit(filters.limit)
        .lean(),
      Service.countDocuments(countQuery)
    ]);
    
    const totalPages = Math.ceil(totalCount / filters.limit);
    
    // Track search counts in background
    incrementSearchCounts(services);
    
    const response: SearchResponse = {
      success: true,
      data: {
        services,
        pagination: {
          page: filters.page,
          limit: filters.limit,
          total: totalCount,
          pages: totalPages
        }
      }
    };
    
    res.json(response);
  } catch (error: any) {
    throw new ApiError(500, 'Failed to get services by category', error.message);
  }
});

function incrementSearchCounts(services: any[]) {
  // Background task - don't await
  setImmediate(async () => {
    try {
      const serviceIds = services.map(s => s._id);
      await Service.updateMany(
        { _id: { $in: serviceIds } },
        { 
          $inc: { 'searchMetadata.searchCount': 1 },
          $set: { 'searchMetadata.lastSearched': new Date() }
        }
      );
    } catch (error) {
      console.error('Error incrementing search counts:', error);
    }
  });
}

// Export all functions
export default {
  searchServices,
  getSearchSuggestions,
  getTrendingServices,
  getSearchFilters,
  getServiceById,
  trackServiceClick,
  getPopularServices,
  getServicesByCategory
};