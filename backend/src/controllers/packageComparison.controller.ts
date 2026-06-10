import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Joi from 'joi';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import Bundle from '../models/bundle.model';
import ProviderProfile from '../models/providerProfile.model';
import Review from '../models/review.model';
import { DEFAULT_CURRENCY } from '../utils/currency';

/**
 * Validation schema for comparing packages
 * Validates comma-separated package IDs or array of package IDs
 */
const comparePackagesSchema = Joi.object({
  packageIds: Joi.alternatives().try(
    Joi.string().custom((value, helpers) => {
      // Accept comma-separated IDs
      const ids = value.split(',').map((id: string) => id.trim()).filter((id: string) => id);
      if (ids.length < 2) {
        return helpers.error('custom.minPackages');
      }
      if (ids.length > 5) {
        return helpers.error('custom.maxPackages');
      }
      // Validate each ID is a valid ObjectId
      for (const id of ids) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return helpers.error('custom.invalidId');
        }
      }
      return ids;
    }),
    Joi.array().items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/)).min(2).max(5)
  ).required(),
}).messages({
  'custom.minPackages': 'At least 2 packages are required for comparison',
  'custom.maxPackages': 'Maximum 5 packages can be compared at once',
  'custom.invalidId': 'Invalid package ID format',
  'any.required': 'Package IDs are required for comparison',
});

/**
 * GET /api/packages/compare
 * Compare multiple packages side-by-side
 *
 * Query params:
 * - packageIds: comma-separated list of package IDs (2-5 packages)
 *
 * Example: GET /api/packages/compare?packageIds=id1,id2,id3
 */
export const comparePackages = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  if (!tenantId) {
    throw new ApiError(400, 'Tenant ID required');
  }

  // Validate tenantId format
  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    logger.warn(`Invalid tenantId format in comparePackages: ${tenantId}`);
    throw new ApiError(400, 'Invalid tenant ID format');
  }

  // Parse packageIds from query
  const { packageIds: rawPackageIds } = req.query;

  if (!rawPackageIds) {
    throw new ApiError(400, 'Package IDs are required for comparison');
  }

  // Handle both string and array formats
  let packageIds: string[];
  if (typeof rawPackageIds === 'string') {
    packageIds = rawPackageIds.split(',').map(id => id.trim()).filter(id => id);
  } else if (Array.isArray(rawPackageIds)) {
    packageIds = rawPackageIds.map(id => String(id).trim()).filter(id => id);
  } else {
    throw new ApiError(400, 'Invalid package IDs format');
  }

  // Validate minimum and maximum
  if (packageIds.length < 2) {
    throw new ApiError(400, 'At least 2 packages are required for comparison');
  }
  if (packageIds.length > 5) {
    throw new ApiError(400, 'Maximum 5 packages can be compared at once');
  }

  // Validate each ID is a valid ObjectId
  for (const id of packageIds) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(400, `Invalid package ID format: ${id}`);
    }
  }

  // Fetch packages with their provider and review data
  const packageObjectIds = packageIds.map(id => new mongoose.Types.ObjectId(id));
  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

  // Fetch bundles with provider info
  const bundles = await Bundle.aggregate([
    {
      $match: {
        _id: { $in: packageObjectIds },
        tenantId: tenantObjectId,
        isActive: true,
        validFrom: { $lte: new Date() },
        validUntil: { $gte: new Date() },
      },
    },
    // Lookup provider details
    {
      $lookup: {
        from: 'users',
        localField: 'providerId',
        foreignField: '_id',
        as: 'provider',
      },
    },
    // Lookup provider profile for ratings
    {
      $lookup: {
        from: 'providerprofiles',
        let: { providerUserId: '$providerId' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$userId', '$$providerUserId'] },
              tenantId: tenantObjectId,
              isDeleted: false,
            },
          },
          {
            $project: {
              'reviewsData.averageRating': 1,
              'reviewsData.totalReviews': 1,
              tier: 1,
              isVerified: '$instagramStyleProfile.isVerified',
            },
          },
        ],
        as: 'providerProfile',
      },
    },
    // Project final shape
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        shortDescription: 1,
        basePrice: 1,
        bundlePrice: 1,
        discountedPrice: 1,
        services: 1,
        duration: 1,
        images: 1,
        addOns: 1,
        tags: 1,
        isFeatured: 1,
        isPopular: 1,
        rating: 1,
        searchMetadata: 1,
        location: 1,
        availability: 1,
        createdAt: 1,
        categoryId: 1,
        'provider._id': { $arrayElemAt: ['$provider._id', 0] },
        'provider.firstName': { $arrayElemAt: ['$provider.firstName', 0] },
        'provider.lastName': { $arrayElemAt: ['$provider.lastName', 0] },
        'provider.avatar': { $arrayElemAt: ['$provider.avatar', 0] },
        'provider.businessName': { $arrayElemAt: ['$provider.businessName', 0] },
        'providerProfile': { $arrayElemAt: ['$providerProfile', 0] },
      },
    },
  ]);

  // Check if all requested packages were found
  if (bundles.length === 0) {
    throw new ApiError(404, 'No packages found');
  }

  if (bundles.length !== packageIds.length) {
    const foundIds = bundles.map(b => b._id.toString());
    const missingIds = packageIds.filter(id => !foundIds.includes(id));
    logger.warn(`Some packages not found in comparePackages: ${missingIds.join(', ')}`);
  }

  // Calculate total duration and extract service names from bundle
  const calculateBundleDuration = (bundle: any) => {
    return (bundle.services || []).reduce((sum: number, s: any) => sum + (s.duration || 60), 0);
  };

  const getIncludedItems = (bundle: any) => {
    return (bundle.services || []).map((s: any) => s.serviceName).filter(Boolean);
  };

  // Format packages for comparison
  const formattedPackages = bundles.map((bundle: any) => {
    const basePrice = bundle.basePrice || bundle.bundlePrice || 0;
    const currentPrice = bundle.discountedPrice || bundle.bundlePrice || basePrice;

    const providerProfile = bundle.providerProfile || {};
    const provider = bundle.provider || {};

    // Get the best rating (from provider profile or bundle rating)
    const averageRating = providerProfile.reviewsData?.averageRating || bundle.rating?.average || 0;
    const totalReviews = providerProfile.reviewsData?.totalReviews || bundle.rating?.count || 0;

    // Calculate total duration from services
    const totalDuration = calculateBundleDuration(bundle);
    const includedItems = getIncludedItems(bundle);

    return {
      _id: bundle._id.toString(),
      name: bundle.name,
      description: bundle.description,
      shortDescription: bundle.shortDescription,
      category: bundle.categoryId?.name || 'Package',
      // Pricing
      pricing: {
        originalPrice: basePrice,
        currentPrice: currentPrice,
        currency: DEFAULT_CURRENCY,
        type: 'fixed',
        hasDiscount: currentPrice < basePrice,
        discountPercentage: currentPrice < basePrice
          ? Math.round(((basePrice - currentPrice) / basePrice) * 100)
          : 0,
        savings: basePrice - currentPrice,
      },
      // Duration
      duration: {
        totalMinutes: totalDuration,
        formatted: formatDuration(totalDuration),
      },
      // Features & Items
      includedItems: includedItems,
      services: bundle.services?.map((s: any) => ({
        serviceId: s.serviceId?.toString() || s._id?.toString(),
        serviceName: s.serviceName,
        originalPrice: s.originalPrice,
        duration: s.duration || 60,
      })) || [],
      requirements: [],
      addOns: bundle.addOns || [],
      tags: bundle.tags || [],
      // Provider info
      provider: {
        _id: provider._id?.toString() || '',
        name: provider.businessName ||
          `${provider.firstName || ''} ${provider.lastName || ''}`.trim() || 'Unknown',
        avatar: provider.avatar,
        isVerified: providerProfile.isVerified || false,
        tier: providerProfile.tier || 'standard',
      },
      // Stats
      stats: {
        rating: Math.round((averageRating || 0) * 10) / 10,
        reviewCount: totalReviews || 0,
        bookingCount: bundle.searchMetadata?.bookingCount || 0,
        popularityScore: bundle.searchMetadata?.popularityScore || 0,
      },
      // Status
      isFeatured: bundle.isFeatured || false,
      isPopular: bundle.isPopular || false,
      // Location
      location: {
        city: bundle.location?.address?.city || '',
        state: bundle.location?.address?.state || '',
        serviceArea: bundle.location?.serviceArea || {},
      },
      // Availability
      availability: {
        instantBooking: bundle.availability?.instantBooking || false,
        advanceBookingDays: bundle.availability?.advanceBookingDays || 30,
      },
      // Media
      images: bundle.images || [],
      createdAt: bundle.createdAt,
    };
  });

  // Calculate comparison metrics
  const comparisonMetrics = {
    priceRange: {
      min: Math.min(...formattedPackages.map(p => p.pricing.currentPrice)),
      max: Math.max(...formattedPackages.map(p => p.pricing.currentPrice)),
    },
    ratingRange: {
      max: Math.max(...formattedPackages.map(p => p.stats.rating)),
      hasRated: formattedPackages.some(p => p.stats.rating > 0),
    },
    durationRange: {
      min: Math.min(...formattedPackages.map(p => p.duration.totalMinutes)),
      max: Math.max(...formattedPackages.map(p => p.duration.totalMinutes)),
    },
    inclusionsRange: {
      max: Math.max(...formattedPackages.map(p => p.includedItems.length)),
    },
    // Best value package (best rating per price)
    bestValue: formattedPackages.reduce((best, pkg) => {
      const valueRatio = pkg.pricing.currentPrice > 0
        ? pkg.stats.rating / pkg.pricing.currentPrice
        : 0;
      const bestRatio = best.pricing.currentPrice > 0
        ? best.stats.rating / best.pricing.currentPrice
        : 0;
      return valueRatio > bestRatio ? pkg : best;
    }, formattedPackages[0]),
    // Highest rated
    highestRated: formattedPackages.reduce((highest, pkg) =>
      pkg.stats.rating > highest.stats.rating ? pkg : highest, formattedPackages[0]),
    // Shortest duration
    shortestDuration: formattedPackages.reduce((shortest, pkg) =>
      pkg.duration.totalMinutes < shortest.duration.totalMinutes ? pkg : shortest, formattedPackages[0]),
    // Most popular (by booking count)
    mostPopular: formattedPackages.reduce((popular, pkg) =>
      pkg.stats.bookingCount > popular.stats.bookingCount ? pkg : popular, formattedPackages[0]),
  };

  res.json({
    success: true,
    data: {
      packages: formattedPackages,
      comparisonMetrics,
      meta: {
        count: formattedPackages.length,
        requestedCount: packageIds.length,
        comparedAt: new Date().toISOString(),
      },
    },
  });
});

/**
 * GET /api/packages/compare/recommended
 * Get recommended packages for comparison based on a reference package
 */
export const getRecommendedForComparison = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  if (!tenantId) {
    throw new ApiError(400, 'Tenant ID required');
  }

  const { category, minPrice, maxPrice, excludeIds } = req.query;

  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    throw new ApiError(400, 'Invalid tenant ID format');
  }

  const tenantObjectId = new mongoose.Types.ObjectId(tenantId);

  // Build query
  const query: any = {
    tenantId: tenantObjectId,
    isActive: true,
  };

  if (category) {
    query.categoryId = new mongoose.Types.ObjectId(String(category));
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    query.bundlePrice = {};
    if (minPrice !== undefined) query.bundlePrice.$gte = Number(minPrice);
    if (maxPrice !== undefined) query.bundlePrice.$lte = Number(maxPrice);
  }

  // Exclude specified IDs
  if (excludeIds) {
    const excludeArray = typeof excludeIds === 'string'
      ? excludeIds.split(',').filter(id => mongoose.Types.ObjectId.isValid(id.trim()))
      : Array.isArray(excludeIds)
        ? (excludeIds as string[]).filter((id: string) => mongoose.Types.ObjectId.isValid(id))
        : [];
    if (excludeArray.length > 0) {
      query._id = { $nin: excludeArray.map((id: string) => new mongoose.Types.ObjectId(id)) };
    }
  }

  // Fetch top packages sorted by rating
  const recommendedPackages = await Bundle.aggregate([
    { $match: query },
    { $sort: { 'rating.average': -1, 'searchMetadata.bookingCount': -1 } },
    { $limit: 6 },
    {
      $lookup: {
        from: 'users',
        localField: 'providerId',
        foreignField: '_id',
        as: 'provider',
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        basePrice: 1,
        bundlePrice: 1,
        discountedPrice: 1,
        services: 1,
        duration: 1,
        rating: 1,
        isFeatured: 1,
        isPopular: 1,
        categoryId: 1,
        'provider._id': { $arrayElemAt: ['$provider._id', 0] },
        'provider.firstName': { $arrayElemAt: ['$provider.firstName', 0] },
        'provider.lastName': { $arrayElemAt: ['$provider.lastName', 0] },
        'provider.businessName': { $arrayElemAt: ['$provider.businessName', 0] },
      },
    },
  ]);

  // Format response
  const formatted = recommendedPackages.map((pkg: any) => ({
    _id: pkg._id.toString(),
    name: pkg.name,
    description: pkg.description,
    category: pkg.categoryId?.name || 'Package',
    price: pkg.bundlePrice || pkg.basePrice || 0,
    discountedPrice: pkg.discountedPrice || pkg.bundlePrice || 0,
    servicesCount: (pkg.services || []).length,
    duration: pkg.duration || 0,
    rating: pkg.rating?.average || 0,
    isFeatured: pkg.isFeatured || false,
    isPopular: pkg.isPopular || false,
    providerId: pkg.provider?._id?.toString() || '',
    providerName: pkg.provider?.businessName || `${pkg.provider?.firstName || ''} ${pkg.provider?.lastName || ''}`.trim() || 'Unknown',
  }));

  res.json({
    success: true,
    data: {
      packages: formatted,
      count: formatted.length,
    },
  });
});

/**
 * Format duration in minutes to human-readable string
 */
function formatDuration(minutes: number): string {
  if (minutes <= 0) return 'N/A';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours}h ${mins}m`;
}

export default {
  comparePackages,
  getRecommendedForComparison,
};
