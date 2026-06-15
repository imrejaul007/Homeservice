import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { getTenantContext, TenantContext } from '../utils/tenantFilter';
import logger from '../utils/logger';
import {
  searchServices as meiliSearchServices,
  searchServicesWithGeo,
  getSearchSuggestions as getMeiliSuggestions,
  getSearchAnalytics,
  analyzeRefinementPatterns,
  expandQueryWithSynonyms,
  GeoSearchOptions,
} from '../services/search.service';
import { escapeRegex } from '../utils/formatBookingListItem';
import { resolveCategoryFilters, buildCaseInsensitiveNameFilter } from '../utils/categoryResolver';
import {
  getViewerKey,
  isBotUserAgent,
  trackListingImpressions,
} from '../services/providerAnalyticsTracking.service';

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
      didYouMean?: string[];
      correctionApplied?: boolean;
      expandedQueries?: string[];
    };
    analytics?: {
      totalSearches: number;
      zeroResultSearches: number;
      topQueries: Array<{ query: string; count: number }>;
    };
    refinementPatterns?: {
      commonRefinements: Array<{ from: string; to: string; count: number }>;
      averageRefinementsPerSession: number;
      mostAbandonedQueryPattern: string | null;
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
  providerId?: string;
  tier?: 'elite' | 'premium' | 'standard';
  verified?: boolean;
}

// ===================================
// SEARCH SERVICES
// ===================================

/**
 * Search services with comprehensive filtering and sorting
 * GET /api/search/services
 * Enhanced with typo tolerance, synonyms, and "Did you mean?" suggestions
 */
export const searchServices = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Extract tenant context for service calls
    const tenantContext: TenantContext = getTenantContext(req);

    // Parse and validate query parameters, then resolve slugs to canonical names
    const filters = await normalizeSearchFilters(parseSearchFilters(req.query));

    // Get previous query from session/header for refinement tracking
    const previousQuery = req.headers['x-previous-query'] as string | undefined;

    // Use Meilisearch with enhanced search if available, with MongoDB fallback
    let services: any[];
    let totalCount: number;
    let didYouMean: string[] | undefined;
    let correctionApplied = false;
    let expandedQueries: string[] | undefined;

    // Check if geo-search is needed
    if (filters.lat && filters.lng && filters.radius) {
      // Geo search with Meilisearch
      // SECURITY: Pass tenantId for multi-tenant isolation
      const geoOptions: GeoSearchOptions = {
        limit: filters.limit,
        offset: ((filters.page || 1) - 1) * (filters.limit || 20),
        category: filters.category,
        subcategory: filters.subcategory,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        minRating: filters.minRating,
        sortBy: (filters.sortBy === 'price' ? 'price_asc' :
                filters.sortBy === 'price_desc' ? 'price_desc' :
                filters.sortBy === 'rating' ? 'rating' : 'popular') as 'price_asc' | 'price_desc' | 'rating' | 'popular',
        latitude: filters.lat,
        longitude: filters.lng,
        radiusKm: filters.radius,
        tenantId: tenantContext.isAdmin ? undefined : tenantContext.tenantId,
      };

      const geoResults = await searchServicesWithGeo(filters.q || '', geoOptions, previousQuery);
      services = geoResults.hits || [];
      totalCount = geoResults.estimatedTotalHits;
    } else {
      // Standard search with typo tolerance and synonyms
      // SECURITY: Pass tenantId for multi-tenant isolation
      const searchOptions = {
        limit: filters.limit,
        offset: ((filters.page || 1) - 1) * (filters.limit || 20),
        category: filters.category,
        subcategory: filters.subcategory,
        minPrice: filters.minPrice,
        maxPrice: filters.maxPrice,
        minRating: filters.minRating,
        sortBy: (filters.sortBy === 'price' ? 'price_asc' :
                filters.sortBy === 'price_desc' ? 'price_desc' :
                filters.sortBy === 'rating' ? 'rating' : 'popular') as 'price_asc' | 'price_desc' | 'rating' | 'popular',
        providerId: filters.providerId,
        tenantId: tenantContext.isAdmin ? undefined : tenantContext.tenantId,
      };

      const searchResults = await meiliSearchServices(filters.q || '', searchOptions, previousQuery);
      services = searchResults.hits || [];
      totalCount = searchResults.estimatedTotalHits;
      didYouMean = searchResults.didYouMean;
      correctionApplied = searchResults.correctionApplied || false;

      // Get expanded queries for debugging/display
      if (filters.q) {
        expandedQueries = expandQueryWithSynonyms(filters.q);
      }
    }

    // Process results and add distance for geo searches
    const processedServices = await processSearchResults(services, filters);

    // Increment search counts for tracked services (background task)
    incrementSearchCounts(req, processedServices.slice(0, 10), getViewerKey(req));

    // Generate pagination
    const pagination = generatePagination(
      filters.page || 1,
      filters.limit || 20,
      totalCount
    );

    // Generate search suggestions if no results
    const suggestions = totalCount === 0 && !didYouMean
      ? await getMeiliSuggestions(filters.q || '', 5)
      : undefined;

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
          suggestions: suggestions || didYouMean,
          didYouMean,
          correctionApplied,
          expandedQueries: (expandedQueries?.length ?? 0) > 1 ? expandedQueries : undefined,
        }
      }
    };

    res.json(response);

  } catch (error: any) {
    logger.error('Service search error', {
      context: 'SearchController',
      action: 'SEARCH_ERROR',
      error: error.message,
    });
    throw new ApiError(500, 'Search operation failed', error.message);
  }
});

/**
 * Get service suggestions/autocomplete
 * GET /api/search/suggestions
 * Enhanced with typo tolerance using Levenshtein distance
 */
export const getSearchSuggestions = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { q, limit = 10 } = req.query;

  if (!q || typeof q !== 'string' || q.length < 2) {
    return res.json({
      success: true,
      data: { suggestions: [] }
    });
  }

  try {
    // SECURITY: Pass tenantId for multi-tenant isolation
    const tenantId = tenantContext.isAdmin ? undefined : tenantContext.tenantId;

    // Try Meilisearch suggestions first (with typo tolerance)
    const meiliSuggestions = await getMeiliSuggestions(q as string, Number(limit), tenantId);

    if (meiliSuggestions.length > 0) {
      return res.json({
        success: true,
        data: {
          suggestions: meiliSuggestions.map(text => ({ text, type: 'service' })),
          source: 'meilisearch'
        }
      });
    }

    // Fallback to MongoDB suggestions
    // Build tenant filter for suggestions
    // FIX: Escape regex special characters to prevent regex injection
    const escapedQ = escapeRegex(q as string);
    const tenantMatch: any = { isActive: true, isDeleted: { $ne: true }, name: { $regex: new RegExp(escapedQ, 'i') } };
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      tenantMatch.tenantId = tenantContext.tenantId;
    }

    // Get service name suggestions
    const serviceNameSuggestions = await Service.aggregate([
      {
        $match: tenantMatch
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

    // Build tenant filter for category suggestions
    const categoryMatch: any = { isActive: true };
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      categoryMatch.tenantId = tenantContext.tenantId;
    }
    categoryMatch.$or = [
      // FIX: Use escaped search term to prevent regex injection
      { name: { $regex: new RegExp(escapedQ, 'i') } },
      { 'subcategories.name': { $regex: new RegExp(escapedQ, 'i') } }
    ];

    // Get category suggestions
    const categorySuggestions = await ServiceCategory.aggregate([
      {
        $match: categoryMatch
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
      data: { suggestions, source: 'mongodb' }
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
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
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

    // Build tenant-scoped query
    const query: any = {
      isActive: true,
      status: 'active', // ✅ SECURITY FIX: Only show approved services in trending
      ...dateFilter
    };
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      query.tenantId = tenantContext.tenantId;
    }

    // PERFORMANCE FIX: Add projection to limit fields returned
    const trendingServices = await Service.find(query)
      .select('name category subcategory shortDescription price duration images rating searchMetadata providerId')
      .populate('providerId', 'firstName lastName avatar')
      .sort({ 'searchMetadata.popularityScore': -1, 'searchMetadata.searchCount': -1 })
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      data: { services: deriveHeroImage(trendingServices) }
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
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
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

    // Build tenant filter for aggregations
    const baseMatch: any = { isActive: true, ...locationFilter };
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      baseMatch.tenantId = tenantContext.tenantId;
    }

    // Get category distribution
    const categoryStats = await Service.aggregate([
      { $match: baseMatch },
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
      { $match: baseMatch },
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
      { $match: baseMatch },
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

/**
 * Search providers with filtering and sorting
 * GET /api/search/providers
 */
export const searchProviders = asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const tenantContext: TenantContext = getTenantContext(req);
  const filters = await normalizeSearchFilters(parseSearchFilters(req.query));

  try {
    const page = filters.page || 1;
    const limit = filters.limit || 12;
    const skip = (page - 1) * limit;

    // Build service query to find providers with matching services
    const serviceQuery: any = {
      isActive: true,
      status: 'active',
    };

    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      serviceQuery.tenantId = tenantContext.tenantId;
    }

    if (filters.category) {
      serviceQuery.category = buildCaseInsensitiveNameFilter(filters.category);
    }

    if (filters.subcategory) {
      serviceQuery.subcategory = buildCaseInsensitiveNameFilter(filters.subcategory);
    }

    if (filters.q) {
      serviceQuery.name = { $regex: new RegExp(escapeRegex(filters.q), 'i') };
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      serviceQuery['price.amount'] = {};
      if (filters.minPrice !== undefined) {
        serviceQuery['price.amount'].$gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        serviceQuery['price.amount'].$lte = filters.maxPrice;
      }
    }

    // Collect provider IDs from matching services
    let providerIdSet: Set<string> | null = null;
    const hasServiceFilters = !!(
      filters.q || filters.category || filters.subcategory ||
      filters.minPrice !== undefined || filters.maxPrice !== undefined
    );

    if (hasServiceFilters) {
      const matchingServices = await Service.find(serviceQuery).select('providerId').lean();
      providerIdSet = new Set(matchingServices.map((s: any) => s.providerId.toString()));
    }

    // Also search provider profiles by name/business when q is provided
    if (filters.q) {
      const searchRegex = { $regex: escapeRegex(filters.q), $options: 'i' };
      const nameMatchedUsers = await User.find({
        role: 'provider',
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
        ],
      }).select('_id').limit(100).lean();

      const profileMatches = await ProviderProfile.find({
        isActive: true,
        isDeleted: false,
        $or: [
          { 'businessInfo.businessName': searchRegex },
          { 'businessInfo.tagline': searchRegex },
          { 'businessInfo.description': searchRegex },
          { 'instagramStyleProfile.bio': searchRegex },
          ...(nameMatchedUsers.length > 0
            ? [{ userId: { $in: nameMatchedUsers.map((u: any) => u._id) } }]
            : []),
        ],
      }).select('userId').lean();

      const profileProviderIds = profileMatches.map((p: any) => p.userId.toString());
      if (providerIdSet) {
        profileProviderIds.forEach(id => providerIdSet!.add(id));
      } else {
        providerIdSet = new Set(profileProviderIds);
      }
    }

    // Build provider profile query
    const providerQuery: any = {
      isActive: true,
      isDeleted: false,
    };

    if (filters.providerId && mongoose.Types.ObjectId.isValid(filters.providerId)) {
      providerQuery.userId = new mongoose.Types.ObjectId(filters.providerId);
    } else if (providerIdSet) {
      if (providerIdSet.size === 0) {
        return res.json({
          success: true,
          data: {
            providers: [],
            pagination: { page, limit, total: 0, pages: 0 },
            searchMetadata: { query: filters.q, resultCount: 0, searchTime: Date.now() - startTime },
          },
        });
      }
      providerQuery.userId = { $in: Array.from(providerIdSet) };
    } else {
      // FIX: Use distinct() instead of fetching all services to extract provider IDs
      // This avoids loading entire service documents just to get provider IDs
      const allProviderIds = await Service.distinct('providerId', {
        isActive: true,
        status: 'active',
        ...(tenantContext.tenantId && !tenantContext.isAdmin ? { tenantId: tenantContext.tenantId } : {}),
      });
      if (allProviderIds.length === 0) {
        return res.json({
          success: true,
          data: {
            providers: [],
            pagination: { page, limit, total: 0, pages: 0 },
            searchMetadata: { query: filters.q, resultCount: 0, searchTime: Date.now() - startTime },
          },
        });
      }
      providerQuery.userId = { $in: allProviderIds };
    }

    const effectiveMinRating = filters.minRating;
    if (effectiveMinRating) {
      providerQuery['reviewsData.averageRating'] = { $gte: effectiveMinRating };
    }

    if (filters.city) {
      providerQuery['locationInfo.primaryAddress.city'] = { $regex: escapeRegex(filters.city), $options: 'i' };
    }

    if (filters.tier) {
      providerQuery.tier = filters.tier;
    }

    if (filters.verified) {
      providerQuery.$or = [
        { 'instagramStyleProfile.isVerified': true },
        { 'verificationStatus.overall': 'approved' },
        { 'verificationStatus.overall': 'verified' },
      ];
    }

    // Sort
    let sort: any = {};
    switch (filters.sortBy) {
      case 'price':
        sort['analytics.performanceMetrics.averagePrice'] = 1;
        break;
      case 'price_desc':
        sort['analytics.performanceMetrics.averagePrice'] = -1;
        break;
      case 'newest':
        sort.createdAt = -1;
        break;
      case 'rating':
        sort['reviewsData.averageRating'] = -1;
        sort['reviewsData.totalReviews'] = -1;
        break;
      case 'popularity':
      default:
        sort['reviewsData.averageRating'] = -1;
        sort['instagramStyleProfile.followersCount'] = -1;
        sort['reviewsData.totalReviews'] = -1;
        break;
    }

    const [providers, totalCount] = await Promise.all([
      ProviderProfile.find(providerQuery).sort(sort).skip(skip).limit(limit).lean(),
      ProviderProfile.countDocuments(providerQuery),
    ]);

    const userIds = providers.map((p: any) => p.userId);
    const [users, providerServices] = await Promise.all([
      User.find({ _id: { $in: userIds } }).select('firstName lastName').lean(),
      Service.find({
        providerId: { $in: userIds },
        isActive: true,
        status: 'active',
        ...(filters.category ? { category: buildCaseInsensitiveNameFilter(filters.category) } : {}),
        ...(filters.subcategory ? { subcategory: buildCaseInsensitiveNameFilter(filters.subcategory) } : {}),
      }).lean(),
    ]);

    const userMap = new Map(users.map((u: any) => [u._id.toString(), u]));
    const servicesByProvider = new Map<string, any[]>();
    providerServices.forEach((s: any) => {
      const pid = s.providerId.toString();
      if (!servicesByProvider.has(pid)) servicesByProvider.set(pid, []);
      servicesByProvider.get(pid)!.push(s);
    });

    const formattedProviders = providers.map((provider: any) => {
      const user = userMap.get(provider.userId.toString());
      const services = servicesByProvider.get(provider.userId.toString()) || [];
      const prices = services.map((s: any) => s.price?.amount || 0).filter((p: number) => p > 0);

      // FIX: Include coordinates in location for map view
      const providerCoords = provider.locationInfo?.coordinates?.coordinates;

      return {
        id: provider.userId,
        _id: provider.userId.toString(),
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        businessName: provider.businessInfo?.businessName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
        tagline: provider.businessInfo?.tagline || '',
        profilePhoto: provider.instagramStyleProfile?.profilePhoto || '',
        tier: provider.tier || 'standard',
        isVerified: provider.instagramStyleProfile?.isVerified || provider.verificationStatus?.overall === 'approved',
        location: provider.locationInfo?.primaryAddress ? {
          city: provider.locationInfo.primaryAddress.city,
          state: provider.locationInfo.primaryAddress.state,
          // GeoJSON format: [longitude, latitude]
          coordinates: Array.isArray(providerCoords) && providerCoords.length === 2
            ? [providerCoords[0], providerCoords[1]]
            : undefined,
        } : null,
        rating: provider.reviewsData?.averageRating || 0,
        reviewCount: provider.reviewsData?.totalReviews || 0,
        startingPrice: prices.length > 0 ? Math.min(...prices) : null,
        maxPrice: prices.length > 0 ? Math.max(...prices) : null,
        servicesCount: services.length,
        specializations: [...new Set(services.map((s: any) => s.category).filter(Boolean))],
        completionRate: provider.analytics?.performanceMetrics?.completionRate || 0,
      };
    });

    // Post-sort by price if needed (price is computed from services)
    if (filters.sortBy === 'price') {
      formattedProviders.sort((a, b) => (a.startingPrice || 0) - (b.startingPrice || 0));
    } else if (filters.sortBy === 'price_desc') {
      formattedProviders.sort((a, b) => (b.startingPrice || 0) - (a.startingPrice || 0));
    }

    const searchTime = Date.now() - startTime;

    return res.json({
      success: true,
      data: {
        providers: formattedProviders,
        pagination: {
          page,
          limit,
          total: totalCount,
          pages: Math.ceil(totalCount / limit),
        },
        searchMetadata: {
          query: filters.q,
          resultCount: totalCount,
          searchTime,
        },
      },
    });
  } catch (error: any) {
    logger.error('Provider search error', {
      context: 'SearchController',
      action: 'PROVIDER_SEARCH_ERROR',
      error: error.message,
    });
    throw new ApiError(500, 'Provider search operation failed', error.message);
  }
});

// ===================================
// HELPER FUNCTIONS
// ===================================

async function normalizeSearchFilters(filters: SearchFilters): Promise<SearchFilters> {
  if (!filters.category && !filters.subcategory) return filters;

  const resolved = await resolveCategoryFilters(filters.category, filters.subcategory);
  return {
    ...filters,
    category: resolved.categoryName || filters.category,
    subcategory: resolved.subcategoryName || filters.subcategory,
  };
}

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
    isActive: query.isActive !== 'false', // Default to true unless explicitly false
    providerId: query.providerId ? String(query.providerId) : undefined,
    tier: query.tier ? String(query.tier) as 'elite' | 'premium' | 'standard' : undefined,
    verified: query.verified === true || query.verified === 'true' ? true : undefined,
  };
}

function buildServiceSearchQuery(filters: SearchFilters, tenantContext: TenantContext) {
  let query: any = {};
  let countQuery: any = {};

  // Add tenant filter for non-admin requests
  if (!tenantContext.isAdmin && tenantContext.tenantId) {
    query.tenantId = tenantContext.tenantId;
    countQuery.tenantId = tenantContext.tenantId;
  }

  // Base filter - only active services with approved status
  if (filters.isActive !== false) {
    query.isActive = true;
    query.status = 'active'; // ✅ SECURITY FIX: Only show approved services to customers
    // FIX: Exclude soft-deleted services from customer-facing results
    query.isDeleted = { $ne: true };
    countQuery.isActive = true;
    countQuery.status = 'active';
    countQuery.isDeleted = { $ne: true };
  }

  // Text search
  if (filters.q) {
    query.$text = { $search: filters.q };
    countQuery.$text = { $search: filters.q };
  }

  // Category filters (case-insensitive name match)
  if (filters.category) {
    const categoryFilter = buildCaseInsensitiveNameFilter(filters.category);
    query.category = categoryFilter;
    countQuery.category = categoryFilter;
  }

  if (filters.subcategory) {
    const subcategoryFilter = buildCaseInsensitiveNameFilter(filters.subcategory);
    query.subcategory = subcategoryFilter;
    countQuery.subcategory = subcategoryFilter;
  }

  if (filters.providerId && mongoose.Types.ObjectId.isValid(filters.providerId)) {
    const providerObjectId = new mongoose.Types.ObjectId(filters.providerId);
    query.providerId = providerObjectId;
    countQuery.providerId = providerObjectId;
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
  // FIX: Batch fetch provider data to avoid N+1 queries within the map
  // Collect all unique provider IDs
  const providerIds = new Set<string>();
  services.forEach(service => {
    const result = typeof service.toJSON === 'function' ? service.toJSON() : { ...service };
    if (result.providerId) {
      const pid = typeof result.providerId === 'object' ? result.providerId._id?.toString() : result.providerId.toString();
      if (pid) providerIds.add(pid);
    }
  });

  // Batch fetch all providers in one query
  const providerDataMap = new Map<string, any>();
  if (providerIds.size > 0) {
    const [providerProfiles, users] = await Promise.all([
      ProviderProfile.find({ userId: { $in: Array.from(providerIds) } }).lean(),
      User.find({ _id: { $in: Array.from(providerIds) } }).select('firstName lastName avatar rating location').lean(),
    ]);
    users.forEach(user => providerDataMap.set(user._id.toString(), { type: 'user', data: user }));
    providerProfiles.forEach(profile => providerDataMap.set(profile.userId.toString(), { type: 'profile', data: profile }));
  }

  return services.map(service => {
    const result = typeof service.toJSON === 'function' ? service.toJSON() : { ...service };

    // Transform providerId to provider object using batch-loaded data
    if (result.providerId && !result.provider) {
      const pid = typeof result.providerId === 'object' ? result.providerId._id?.toString() : result.providerId.toString();
      const userData = pid ? providerDataMap.get(pid) : null;
      const user = userData?.type === 'user' ? userData.data : null;
      const profile = userData?.type === 'profile' ? userData.data : null;

      result.provider = {
        _id: pid,
        firstName: user?.firstName || result.provider?.firstName || '',
        lastName: user?.lastName || result.provider?.lastName || '',
        avatar: user?.avatar || profile?.instagramStyleProfile?.profilePhoto || '',
        rating: user?.rating || profile?.reviewsData?.averageRating || 0,
        location: user?.location || profile?.locationInfo?.primaryAddress?.city || null,
        businessName: profile?.businessInfo?.businessName || '',
        isVerified: profile?.instagramStyleProfile?.isVerified || profile?.verificationStatus?.overall === 'approved' || false,
      };
    } else {
      result.provider = result.provider || {};
      result.provider.isVerified = result.provider.isVerified || false;
    }
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

    // Derive a singular `image` field from `images[0]` so the frontend
    // ServiceCard component (which reads `service.image`) always has a
    // hero image to render, regardless of which endpoint supplied the data.
    if (!result.image && Array.isArray(result.images) && result.images.length > 0) {
      result.image = result.images[0];
    }

    return result;
  });
}

/**
 * Add a derived `image` (singular) field to each service so the frontend
 * ServiceCard — which reads `service.image` per its documented type — has
 * a hero image to render. Idempotent: respects any explicit `image` value
 * already on the document. Used by endpoints that bypass processSearchResults.
 */
function deriveHeroImage<T extends { image?: string; images?: string[] }>(services: T[]): T[] {
  return services.map((s) => {
    if (!s.image && Array.isArray(s.images) && s.images.length > 0) {
      return { ...s, image: s.images[0] };
    }
    return s;
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

/**
 * Generate search suggestions from services
 * SECURITY FIX C8: Add isDeleted filter to exclude soft-deleted services
 */
async function generateSearchSuggestions(query?: string): Promise<string[]> {
  if (!query || query.length < 2) return [];

  try {
    // Get similar service names
    // SECURITY FIX C8: Exclude soft-deleted services
    const suggestions = await Service.aggregate([
      {
        $match: {
          isActive: true,
          isDeleted: { $ne: true },
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
    logger.error('Error generating suggestions', {
      context: 'SearchController',
      action: 'SUGGESTIONS_ERROR',
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Get service by ID
 * GET /api/search/service/:id
 */
export const getServiceById = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;

  try {
    // Build tenant-scoped query
    const serviceQuery: any = {
      _id: id,
      isActive: true,
      status: 'active' // ✅ SECURITY FIX: Only allow customers to view approved services
    };
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      serviceQuery.tenantId = tenantContext.tenantId;
    }

    // PERFORMANCE FIX: Add projection to limit fields returned
    const serviceProjection = {
      name: 1,
      category: 1,
      subcategory: 1,
      description: 1,
      shortDescription: 1,
      price: 1,
      duration: 1,
      durationOptions: 1,
      images: 1,
      tags: 1,
      requirements: 1,
      includedItems: 1,
      addOns: 1,
      location: 1,
      availability: 1,
      rating: 1,
      searchMetadata: 1,
      isPopular: 1,
      isFeatured: 1,
      providerId: 1,
    };

    // First get the service - only show active approved services to customers
    const service = await Service.findOne(serviceQuery, serviceProjection).lean();

    if (!service) {
      throw new ApiError(404, 'Service not found or not available');
    }

    // SECURITY FIX: Batch fetch provider data with tenant isolation to prevent cross-tenant leaks
    const providerQuery: any = { userId: service.providerId };
    const userQuery: any = { _id: service.providerId };
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      providerQuery.tenantId = tenantContext.tenantId;
      userQuery.tenantId = tenantContext.tenantId;
    }
    const [providerProfile, providerUser] = await Promise.all([
      ProviderProfile.findOne(providerQuery)
        .select('instagramStyleProfile.profilePhoto businessInfo businessType verificationStatus')
        .lean(),
      User.findOne(userQuery)
        .select('firstName lastName')
        .lean(),
    ]);

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
          average: (providerProfile as any)?.reviewsData?.averageRating || 0,
          count: (providerProfile as any)?.reviewsData?.totalReviews || 0
        }
      }
    };

    // Increment click count in background (non-blocking)
    Service.findByIdAndUpdate(id, {
      $inc: { 'searchMetadata.clickCount': 1 }
    }).catch((error) => {
      logger.error('Error incrementing click count', {
        context: 'SearchController',
        action: 'INCREMENT_CLICK_ERROR',
        serviceId: id,
        error: error instanceof Error ? error.message : String(error),
      });
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
 * Get multiple services by IDs (batch lookup)
 * GET /api/search/services/batch?ids=id1,id2,id3
 * FIX: Replaces need for admin endpoint in customer-facing code
 */
export const getServicesByIds = async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract tenant context for service calls
    const tenantContext: TenantContext = getTenantContext(req);
    const { ids } = req.query;

    if (!ids || typeof ids !== 'string') {
      res.status(400).json({ success: false, message: 'Service IDs are required' });
      return;
    }

    const serviceIds = ids.split(',').filter(Boolean);

    if (serviceIds.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    if (serviceIds.length > 50) {
      res.status(400).json({ success: false, message: 'Maximum 50 service IDs allowed per request' });
      return;
    }

    // Build tenant-scoped query
    const serviceQuery: Record<string, unknown> = {
      _id: { $in: serviceIds },
      isActive: true,
      status: 'active'
    };
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      serviceQuery.tenantId = tenantContext.tenantId;
    }

    // Projection for limited fields
    const serviceProjection = {
      name: 1,
      category: 1,
      subcategory: 1,
      shortDescription: 1,
      price: 1,
      duration: 1,
      images: 1,
      rating: 1,
      thumbnail: 1,
      providerId: 1,
    };

    const services = await Service.find(serviceQuery, serviceProjection).lean();

    res.json({
      success: true,
      data: deriveHeroImage(services),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get services';
    res.status(500).json({ success: false, message: errorMessage });
  }
};

/**
 * Track service click
 * POST /api/search/service/:id/click
 * SECURITY FIX C6: Add tenant validation to ensure service belongs to tenant
 */
export const trackServiceClick = asyncHandler(async (req: Request, res: Response) => {
  // Extract tenant context for service calls
  const tenantContext: TenantContext = getTenantContext(req);
  const { id } = req.params;

  try {
    // SECURITY FIX C6: Build tenant-scoped query to verify service belongs to tenant
    const serviceQuery: any = { _id: id };
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      serviceQuery.tenantId = tenantContext.tenantId;
    }

    const service = await Service.findOneAndUpdate(
      serviceQuery,
      {
        $inc: { 'searchMetadata.clickCount': 1 },
        $set: { 'searchMetadata.lastSearched': new Date() }
      },
      { new: true }
    );

    if (!service) {
      throw new ApiError(404, 'Service not found or not accessible');
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
  // FIX: Apply tenant isolation to prevent cross-tenant data leaks
  const tenantContext: TenantContext = getTenantContext(req);

  try {
    let query: any = {
      isActive: true,
      status: 'active',
      isPopular: true,
      isDeleted: { $ne: true }, // FIX: Exclude soft-deleted
    };
    if (category) {
      query.category = category;
    }
    // FIX: Apply tenant filter for non-admin users
    if (!tenantContext.isAdmin && tenantContext.tenantId) {
      query.tenantId = tenantContext.tenantId;
    }

    // PERFORMANCE FIX: Add projection to limit fields returned
    const popularServices = await Service.find(query)
      .select('name category subcategory shortDescription price duration images rating searchMetadata providerId isFeatured')
      .populate('providerId', 'firstName lastName avatar')
      .sort({ 'searchMetadata.popularityScore': -1, 'rating.average': -1 })
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      data: { services: deriveHeroImage(popularServices) }
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
  const filters = await normalizeSearchFilters(parseSearchFilters({ ...req.query, category }));
  const tenantContext: TenantContext = getTenantContext(req);

  try {
    const { query, countQuery } = buildServiceSearchQuery(filters, tenantContext);
    const sortQuery = buildSortQuery(filters);

    // PERFORMANCE FIX: Add projection to limit fields returned
    const [services, totalCount] = await Promise.all([
      Service.find(query)
        .select('name category subcategory shortDescription price duration images rating tags providerId isPopular isFeatured searchMetadata')
        .populate('providerId', 'firstName lastName avatar')
        .sort(sortQuery)
        .skip((filters.page - 1) * filters.limit)
        .limit(filters.limit)
        .lean(),
      Service.countDocuments(countQuery)
    ]);

    const totalPages = Math.ceil(totalCount / filters.limit);

    // Track search counts in background
    incrementSearchCounts(req, services, getViewerKey(req));

    const response: SearchResponse = {
      success: true,
      data: {
        services: deriveHeroImage(services),
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

function incrementSearchCounts(req: Request, services: any[], sessionKey: string) {
  if (isBotUserAgent(req)) {
    return;
  }

  setImmediate(async () => {
    try {
      const serviceIds = services.map((s) => s._id);
      await Service.updateMany(
        { _id: { $in: serviceIds } },
        {
          $inc: { 'searchMetadata.searchCount': 1 },
          $set: { 'searchMetadata.lastSearched': new Date() },
        },
      );

      const providerRows = await Service.find({ _id: { $in: serviceIds } })
        .select('providerId')
        .lean();
      const providerCounts = new Map<string, number>();
      providerRows.forEach((row) => {
        const providerId = row.providerId?.toString();
        if (providerId) {
          providerCounts.set(providerId, (providerCounts.get(providerId) || 0) + 1);
        }
      });

      await trackListingImpressions(providerCounts, sessionKey);
    } catch (error) {
      logger.error('Error incrementing search counts', {
        context: 'SearchController',
        action: 'INCREMENT_SEARCH_ERROR',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

// ============================================
// SEARCH ANALYTICS ENDPOINTS
// ============================================

/**
 * Get search analytics summary
 * GET /api/search/analytics
 * Requires admin privileges
 */
export const getSearchAnalyticsSummary = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);

  // Only allow admin access to analytics
  if (!tenantContext.isAdmin) {
    throw new ApiError(403, 'Admin access required for search analytics');
  }

  try {
    const analytics = await getSearchAnalytics();

    // Calculate zero-result rate
    const zeroResultRate = analytics.totalSearches > 0
      ? (analytics.zeroResultSearches / analytics.totalSearches * 100).toFixed(2)
      : '0.00';

    res.json({
      success: true,
      data: {
        summary: {
          totalSearches: analytics.totalSearches,
          zeroResultSearches: analytics.zeroResultSearches,
          zeroResultRate: `${zeroResultRate}%`,
          refinementCount: analytics.refinementCount,
        },
        topQueries: analytics.topQueries.slice(0, 20),
        zeroResultQueries: analytics.zeroResultQueries
          .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
          .slice(0, 20)
          .map((q: { query: string; count: number; timestamp: number }) => ({
            query: q.query,
            count: q.count,
            lastSeen: new Date(q.timestamp).toISOString()
          })),
      }
    });
  } catch (error: any) {
    logger.error('Error fetching search analytics', {
      context: 'SearchController',
      action: 'ANALYTICS_ERROR',
      error: error.message,
    });
    throw new ApiError(500, 'Failed to fetch search analytics', error.message);
  }
});

/**
 * Get search refinement patterns analysis
 * GET /api/search/analytics/refinements
 * Requires admin privileges
 */
export const getRefinementPatterns = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);

  // Only allow admin access to analytics
  if (!tenantContext.isAdmin) {
    throw new ApiError(403, 'Admin access required for search analytics');
  }

  try {
    const patterns = await analyzeRefinementPatterns();

    res.json({
      success: true,
      data: patterns
    });
  } catch (error: any) {
    logger.error('Error fetching refinement patterns', {
      context: 'SearchController',
      action: 'REFINEMENTS_ERROR',
      error: error.message,
    });
    throw new ApiError(500, 'Failed to fetch refinement patterns', error.message);
  }
});

/**
 * Get synonym dictionary (for debugging/admin)
 * GET /api/search/synonyms
 * Requires admin privileges
 */
export const getSynonymDictionary = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);

  // Only allow admin access to synonym dictionary
  if (!tenantContext.isAdmin) {
    throw new ApiError(403, 'Admin access required for synonym dictionary');
  }

  try {
    const { SYNONYM_DICTIONARY } = await import('../services/search.service');

    res.json({
      success: true,
      data: {
        synonyms: SYNONYM_DICTIONARY,
        totalEntries: Object.keys(SYNONYM_DICTIONARY).length,
      }
    });
  } catch (error: any) {
    logger.error('Error fetching synonym dictionary', {
      context: 'SearchController',
      action: 'SYNONYMS_ERROR',
      error: error.message,
    });
    throw new ApiError(500, 'Failed to fetch synonym dictionary', error.message);
  }
});

/**
 * Preview query expansion with synonyms
 * POST /api/search/preview-expansion
 * Requires admin privileges
 */
export const previewQueryExpansion = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);

  // Only allow admin access to preview
  if (!tenantContext.isAdmin) {
    throw new ApiError(403, 'Admin access required for query expansion preview');
  }

  const { query } = req.body;

  if (!query || typeof query !== 'string') {
    throw new ApiError(400, 'Query parameter is required');
  }

  try {
    const expandedQueries = expandQueryWithSynonyms(query);

    res.json({
      success: true,
      data: {
        originalQuery: query,
        expandedQueries,
        expandedCount: expandedQueries.length,
      }
    });
  } catch (error: any) {
    logger.error('Error previewing query expansion', {
      context: 'SearchController',
      action: 'PREVIEW_EXPAND_ERROR',
      error: error.message,
    });
    throw new ApiError(500, 'Failed to preview query expansion', error.message);
  }
});

/**
 * Get zero-result searches for content gap analysis
 * GET /api/search/zero-results
 * Requires admin privileges
 */
export const getZeroResultSearches = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext: TenantContext = getTenantContext(req);

  // Only allow admin access
  if (!tenantContext.isAdmin) {
    throw new ApiError(403, 'Admin access required for zero-result analysis');
  }

  const { limit = 50, minCount = 1 } = req.query;

  try {
    const analytics = await getSearchAnalytics();

    // Filter by minimum count and sort by count descending
    const zeroResults = analytics.zeroResultQueries
      .filter((q: { count: number }) => q.count >= Number(minCount))
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
      .slice(0, Number(limit))
      .map((q: { query: string; count: number; timestamp: number }) => ({
        query: q.query,
        occurrences: q.count,
        firstSeen: new Date(q.timestamp).toISOString(),
        suggestions: [] // Could add LLM-based suggestions here
      }));

    // Generate content opportunity report
    const contentOpportunities = zeroResults
      .filter(q => q.occurrences >= 3)
      .map((q: { query: string; occurrences: number }) => ({
        searchTerm: q.query,
        frequency: q.occurrences,
        recommendation: `Consider adding services or content for: "${q.query}"`
      }));

    res.json({
      success: true,
      data: {
        zeroResultSearches: zeroResults,
        contentOpportunities,
        summary: {
          totalUniqueZeroResultQueries: analytics.zeroResultQueries.length,
          highPriorityOpportunities: contentOpportunities.length,
        }
      }
    });
  } catch (error: any) {
    logger.error('Error fetching zero-result searches', {
      context: 'SearchController',
      action: 'ZERO_RESULTS_ERROR',
      error: error.message,
    });
    throw new ApiError(500, 'Failed to fetch zero-result searches', error.message);
  }
});

// Export all functions
export default {
  searchServices,
  searchProviders,
  getSearchSuggestions,
  getTrendingServices,
  getSearchFilters,
  getServiceById,
  trackServiceClick,
  getPopularServices,
  getServicesByCategory,
  // Analytics endpoints
  getSearchAnalyticsSummary,
  getRefinementPatterns,
  getSynonymDictionary,
  previewQueryExpansion,
  getZeroResultSearches,
};