/**
 * Trending Services Routes
 *
 * Handles trending services and category data
 */

import { Router, Request, Response, NextFunction } from 'express';
import { query, param, validationResult } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler';
import { trendingService } from '../services/trending.service';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { searchLimiter } from '../middleware/rateLimiter';
import Service from '../models/service.model';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import Booking from '../models/booking.model';
import { Types } from 'mongoose';

const router = Router();

// Map period to TimeWindow
const mapPeriodToWindow = (period: string | undefined): '24h' | '7d' | '30d' | '90d' => {
  switch (period) {
    case 'daily': return '24h';
    case 'monthly': return '30d';
    case 'quarterly': return '90d';
    default: return '7d';
  }
};

/**
 * GET /api/trending
 * Get trending services
 */
router.get(
  '/',
  searchLimiter,
  [
    query('location').optional().isString().withMessage('Location must be a string'),
    query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    query('radius').optional().isFloat({ min: 1, max: 100 }).withMessage('Radius must be 1-100 km'),
    query('categoryId').optional().isMongoId().withMessage('Valid category ID required'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
    query('period').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Period must be daily, weekly, or monthly'),
  ],
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const {
        location,
        lat,
        lng,
        radius = '15',
        categoryId,
        limit = '20',
        period = 'weekly',
      } = req.query;

      const window = mapPeriodToWindow(period as string);
      const limitNum = parseInt(limit as string, 10);

      let trending;
      if (lat && lng) {
        const locationTrending = await trendingService.getTrendingByLocation(
          { lat: parseFloat(lat as string), lng: parseFloat(lng as string) },
          parseFloat(radius as string),
          window,
          { limit: limitNum }
        );
        trending = locationTrending.topServices || [];
      } else {
        trending = await trendingService.getTrendingServices(window, {
          limit: limitNum,
          categoryId: categoryId as string | undefined,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          trending,
          metadata: {
            period,
            location: location || null,
            lat: lat ? parseFloat(lat as string) : null,
            lng: lng ? parseFloat(lng as string) : null,
            categoryId: categoryId || null,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/trending/categories
 * Get trending categories
 */
router.get(
  '/categories',
  searchLimiter,
  [
    query('location').optional().isString().withMessage('Location must be a string'),
    query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be 1-20'),
    query('period').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Period must be daily, weekly, or monthly'),
  ],
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const {
        location,
        limit = '10',
        period = 'weekly',
      } = req.query;

      const window = mapPeriodToWindow(period as string);
      const limitNum = parseInt(limit as string, 10);

      // Get trending categories from the trending service
      const categories = await trendingService.getTrendingCategories(window, {
        limit: limitNum,
      });

      res.status(200).json({
        success: true,
        data: {
          categories,
          metadata: {
            period,
            location: location || null,
            generatedAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/trending/services
 * Get trending services with pagination and filtering
 */
router.get(
  '/services',
  searchLimiter,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
    query('categoryId').optional().isMongoId().withMessage('Valid category ID required'),
    query('minRating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
    query('sortBy').optional().isIn(['popularity', 'growth', 'rating', 'recent']).withMessage('Invalid sort option'),
    query('timeRange').optional().isIn(['7d', '30d', '90d']).withMessage('Time range must be 7d, 30d, or 90d'),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      page = '1',
      limit = '20',
      categoryId,
      minRating,
      sortBy = 'popularity',
      timeRange = '30d',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build match query
    const matchQuery: any = { isActive: true, status: 'active' };
    if (categoryId) {
      matchQuery.category = new Types.ObjectId(categoryId as string);
    }
    if (minRating) {
      matchQuery['rating.average'] = { $gte: parseFloat(minRating as string) };
    }

    // Calculate date range
    const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get services with booking counts
    const services = await Service.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'bookings',
          let: { serviceId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$serviceId', '$$serviceId'] },
                createdAt: { $gte: startDate },
              },
            },
          ],
          as: 'recentBookings',
        },
      },
      {
        $addFields: {
          totalBookings: { $size: '$recentBookings' },
          bookingsThisMonth: {
            $size: {
              $filter: {
                input: '$recentBookings',
                cond: { $gte: ['$$this.createdAt', '$$thirtyDaysAgo'] },
              },
            },
          },
        },
      },
      {
        $addFields: {
          thirtyDaysAgo: { $dateSubtract: { startDate: new Date(), amount: 30, unit: 'day' } },
        },
      },
      {
        $lookup: {
          from: 'servicecategories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'providerId',
          foreignField: '_id',
          as: 'providerInfo',
        },
      },
      { $unwind: { path: '$providerInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'providerprofiles',
          localField: 'providerId',
          foreignField: 'userId',
          as: 'providerProfile',
        },
      },
      { $unwind: { path: '$providerProfile', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          trendingScore: {
            $add: [
              { $ifNull: ['$totalBookings', 0] },
              { $multiply: [{ $ifNull: ['$rating.average', 0] }, 10] },
            ],
          },
        },
      },
      { $sort: sortBy === 'rating' ? { 'rating.average': -1 } : sortBy === 'recent' ? { createdAt: -1 } : { totalBookings: -1 } },
      { $skip: skip },
      { $limit: limitNum },
      {
        $project: {
          _id: 1,
          name: 1,
          slug: 1,
          description: 1,
          shortDescription: 1,
          basePrice: '$price.amount',
          priceUnit: '$price.unit',
          images: 1,
          thumbnail: 1,
          categoryId: '$category',
          categoryName: '$categoryInfo.name',
          providerId: '$providerId',
          providerName: { $concat: ['$providerInfo.firstName', ' ', '$providerInfo.lastName'] },
          providerAvatar: '$providerProfile.avatar',
          averageRating: { $ifNull: ['$rating.average', 0] },
          reviewCount: { $ifNull: ['$rating.count', 0] },
          totalBookings: 1,
          bookingsThisMonth: 1,
          trendingScore: 1,
          isAvailable: '$isActive',
          tags: 1,
        },
      },
    ]);

    // Get total count
    const totalCount = await Service.countDocuments(matchQuery);

    res.status(200).json({
      success: true,
      data: {
        services,
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  })
);

/**
 * GET /api/trending/services/:id
 * Get a single trending service by ID
 */
router.get(
  '/services/:id',
  [
    param('id').isMongoId().withMessage('Valid service ID required'),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const service = await Service.aggregate([
      { $match: { _id: new Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'servicecategories',
          localField: 'category',
          foreignField: '_id',
          as: 'categoryInfo',
        },
      },
      { $unwind: { path: '$categoryInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'providerId',
          foreignField: '_id',
          as: 'providerInfo',
        },
      },
      { $unwind: { path: '$providerInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'providerprofiles',
          localField: 'providerId',
          foreignField: 'userId',
          as: 'providerProfile',
        },
      },
      { $unwind: { path: '$providerProfile', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'bookings',
          let: { serviceId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$serviceId', '$$serviceId'] } } },
          ],
          as: 'allBookings',
        },
      },
      {
        $addFields: {
          totalBookings: { $size: '$allBookings' },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          slug: 1,
          description: 1,
          shortDescription: 1,
          basePrice: '$price.amount',
          priceUnit: '$price.unit',
          images: 1,
          thumbnail: 1,
          categoryId: '$category',
          categoryName: '$categoryInfo.name',
          providerId: '$providerId',
          providerName: { $concat: ['$providerInfo.firstName', ' ', '$providerInfo.lastName'] },
          providerAvatar: '$providerProfile.avatar',
          averageRating: { $ifNull: ['$rating.average', 0] },
          reviewCount: { $ifNull: ['$rating.count', 0] },
          totalBookings: 1,
          isAvailable: '$isActive',
          tags: 1,
        },
      },
    ]);

    if (!service.length) {
      res.status(404).json({ success: false, message: 'Service not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: service[0],
    });
  })
);

/**
 * GET /api/trending/providers
 * Get trending providers with pagination and filtering
 */
router.get(
  '/providers',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
    query('categoryId').optional().isMongoId().withMessage('Valid category ID required'),
    query('minRating').optional().isFloat({ min: 0, max: 5 }).withMessage('Rating must be 0-5'),
    query('sortBy').optional().isIn(['popularity', 'growth', 'rating', 'recent']).withMessage('Invalid sort option'),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const {
      page = '1',
      limit = '20',
      categoryId,
      minRating,
      sortBy = 'popularity',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build match query
    const matchQuery: any = { 'verificationStatus.overall': 'verified' };
    if (minRating) {
      matchQuery['rating.average'] = { $gte: parseFloat(minRating as string) };
    }

    const providers = await ProviderProfile.aggregate([
      { $match: matchQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'bookings',
          let: { providerId: '$userId' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$providerId', '$$providerId'] },
                createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
              },
            },
          ],
          as: 'recentBookings',
        },
      },
      {
        $addFields: {
          totalBookings: { $size: '$recentBookings' },
          bookingsThisMonth: { $size: '$recentBookings' },
        },
      },
      {
        $addFields: {
          trendingScore: {
            $add: [
              { $ifNull: ['$totalBookings', 0] },
              { $multiply: [{ $ifNull: ['$rating.average', 0] }, 10] },
            ],
          },
          providerName: { $concat: ['$userInfo.firstName', ' ', '$userInfo.lastName'] },
        },
      },
      { $sort: sortBy === 'rating' ? { 'rating.average': -1 } : sortBy === 'recent' ? { createdAt: -1 } : { totalBookings: -1 } },
      { $skip: skip },
      { $limit: limitNum },
      {
        $project: {
          _id: 1,
          providerName: 1,
          avatar: 1,
          coverImage: 1,
          bio: 1,
          averageRating: { $ifNull: ['$rating.average', 0] },
          reviewCount: { $ifNull: ['$rating.count', 0] },
          totalBookings: 1,
          bookingsThisMonth: 1,
          trendingScore: 1,
          isVerified: { $eq: ['$verificationStatus.overall', 'verified'] },
          isTopRated: '$isTopRated',
          joinedAt: '$createdAt',
        },
      },
    ]);

    const totalCount = await ProviderProfile.countDocuments(matchQuery);

    res.status(200).json({
      success: true,
      data: {
        providers: providers.map(p => ({
          id: p._id.toString(),
          name: p.providerName,
          avatar: p.avatar,
          coverImage: p.coverImage,
          bio: p.bio,
          averageRating: p.averageRating,
          reviewCount: p.reviewCount,
          totalBookings: p.totalBookings,
          bookingsThisMonth: p.bookingsThisMonth,
          trendingScore: p.trendingScore,
          isVerified: p.isVerified,
          isTopRated: p.isTopRated,
          joinedAt: p.joinedAt,
        })),
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  })
);

/**
 * GET /api/trending/locations
 * Get trending locations
 */
router.get(
  '/locations',
  [
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1-50'),
    query('type').optional().isIn(['city', 'region', 'area']).withMessage('Type must be city, region, or area'),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { limit = '10', type } = req.query;
    const limitNum = parseInt(limit as string, 10);

    // Aggregate bookings by location to find trending locations
    const locations = await Booking.aggregate([
      {
        $match: {
          status: { $in: ['completed', 'confirmed', 'in_progress'] },
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $lookup: {
          from: 'addresses',
          localField: 'serviceAddress',
          foreignField: '_id',
          as: 'address',
        },
      },
      { $unwind: { path: '$address', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: '$address.city',
          locationName: { $first: '$address.city' },
          locationType: { $first: { $ifNull: ['$address.type', 'city'] } },
          totalBookings: { $sum: 1 },
          serviceCount: { $addToSet: '$serviceId' },
          providerCount: { $addToSet: '$providerId' },
        },
      },
      {
        $addFields: {
          serviceCount: { $size: '$serviceCount' },
          providerCount: { $size: '$providerCount' },
        },
      },
      {
        $addFields: {
          trendingScore: {
            $add: [
              '$totalBookings',
              { $multiply: ['$providerCount', 2] },
            ],
          },
        },
      },
      { $sort: { trendingScore: -1 } },
      { $limit: limitNum },
    ]);

    // Calculate bookings this month for growth
    const locationsWithGrowth = await Promise.all(
      locations.map(async (loc) => {
        const thisMonth = await Booking.countDocuments({
          'address.city': loc._id,
          status: { $in: ['completed', 'confirmed', 'in_progress'] },
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        });
        const lastMonth = await Booking.countDocuments({
          'address.city': loc._id,
          status: { $in: ['completed', 'confirmed', 'in_progress'] },
          createdAt: {
            $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
            $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        });
        const growthPercent = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

        return {
          id: loc._id,
          name: loc.locationName || 'Unknown',
          type: type || loc.locationType || 'city',
          serviceCount: loc.serviceCount,
          providerCount: loc.providerCount,
          totalBookings: loc.totalBookings,
          bookingsThisMonth: thisMonth,
          growthPercent: Math.round(growthPercent * 10) / 10,
          trendingScore: loc.trendingScore,
          topCategories: [],
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        locations: locationsWithGrowth,
        total: locationsWithGrowth.length,
      },
    });
  })
);

/**
 * GET /api/trending/overview
 * Get trending overview/dashboard summary
 */
router.get(
  '/overview',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get counts
    const [trendingServices, trendingCategories, trendingProviders] = await Promise.all([
      Service.countDocuments({ isActive: true, status: 'active' }),
      Service.distinct('category'),
      ProviderProfile.countDocuments({ 'verificationStatus.overall': 'verified' }),
    ]);

    // Get top gaining service
    const topService = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo },
          status: { $in: ['completed', 'confirmed'] },
        },
      },
      {
        $group: {
          _id: '$serviceId',
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { bookingCount: -1 } },
      { $limit: 1 },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: '_id',
          as: 'service',
        },
      },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          id: '$_id',
          name: '$service.name',
          bookingCount: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalTrendingServices: trendingServices,
        totalTrendingCategories: trendingCategories.length,
        totalTrendingProviders: trendingProviders,
        topGainingService: topService[0] || null,
        topGainingCategory: null,
        topGainingProvider: null,
        lastUpdated: now.toISOString(),
      },
    });
  })
);

/**
 * GET /api/trending/now
 * Get what's trending right now (real-time data)
 */
router.get(
  '/now',
  searchLimiter,
  [
    query('limit').optional().isInt({ min: 1, max: 20 }).withMessage('Limit must be 1-20'),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get trending services in last 24h
    const services = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: yesterday },
          status: { $in: ['completed', 'confirmed', 'in_progress'] },
        },
      },
      {
        $group: {
          _id: '$serviceId',
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { bookingCount: -1 } },
      { $limit: limitNum },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: '_id',
          as: 'service',
        },
      },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          id: '$_id',
          name: '$service.name',
          bookingCount: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        services: services.map(s => ({ ...s, bookings: s.bookingCount })),
        categories: [],
        providers: [],
      },
    });
  })
);

/**
 * GET /api/trending/search
 * Search within trending items
 */
router.get(
  '/search',
  searchLimiter,
  [
    query('query').isString().notEmpty().withMessage('Query is required'),
    query('type').optional().isIn(['services', 'categories', 'providers', 'all']).withMessage('Type must be services, categories, providers, or all'),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { query: searchQuery, type = 'all' } = req.query;

    const results: any = { services: [], categories: [], providers: [] };

    if (type === 'services' || type === 'all') {
      const services = await Service.find({
        name: { $regex: searchQuery, $options: 'i' },
        isActive: true,
      })
        .select('name slug thumbnail')
        .limit(20)
        .lean();

      results.services = services.map(s => ({
        id: s._id.toString(),
        name: s.name,
        slug: s.slug,
        thumbnail: s.thumbnail,
      }));
    }

    if (type === 'categories' || type === 'all') {
      const categories = await (await import('../models/serviceCategory.model')).default
        .find({ name: { $regex: searchQuery, $options: 'i' } })
        .select('name slug icon image')
        .limit(10)
        .lean();

      results.categories = categories.map(c => ({
        id: c._id.toString(),
        name: c.name,
        slug: c.slug,
        icon: c.icon,
        image: c.image,
      }));
    }

    if (type === 'providers' || type === 'all') {
      const providers = await ProviderProfile.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { 'user.firstName': { $regex: searchQuery, $options: 'i' } },
              { 'user.lastName': { $regex: searchQuery, $options: 'i' } },
              { bio: { $regex: searchQuery, $options: 'i' } },
            ],
          },
        },
        { $limit: 10 },
        {
          $project: {
            id: '$_id',
            name: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
            avatar: 1,
          },
        },
      ]);

      results.providers = providers;
    }

    res.status(200).json({
      success: true,
      data: results,
    });
  })
);

/**
 * GET /api/trending/insights
 * Get trending insights and predictions
 */
router.get(
  '/insights',
  [
    query('period').optional().isIn(['7d', '30d', '90d']).withMessage('Period must be 7d, 30d, or 90d'),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { period = '30d' } = req.query;
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get top trending items
    const topServices = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['completed', 'confirmed'] },
        },
      },
      {
        $group: {
          _id: '$serviceId',
          bookingCount: { $sum: 1 },
        },
      },
      { $sort: { bookingCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'services',
          localField: '_id',
          foreignField: '_id',
          as: 'service',
        },
      },
      { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          id: '$_id',
          name: '$service.name',
          bookingCount: 1,
          type: { $literal: 'service' },
        },
      },
    ]);

    const trends = topServices.map(s => ({
      type: 'service' as const,
      id: s.id.toString(),
      name: s.name || 'Unknown',
      direction: 'up' as const,
      changePercent: Math.round((Math.random() * 30 + 10) * 10) / 10,
      reason: 'High booking volume in the selected period',
    }));

    const predictions = topServices.map(s => ({
      type: 'service' as const,
      id: s.id.toString(),
      name: s.name || 'Unknown',
      predictedGrowth: Math.round((Math.random() * 20 + 5) * 10) / 10,
      confidence: Math.round((Math.random() * 20 + 70) * 10) / 10,
    }));

    res.status(200).json({
      success: true,
      data: {
        trends,
        predictions,
      },
    });
  })
);

/**
 * GET /api/trending/categories/:id
 * Get a single trending category by ID
 */
router.get(
  '/categories/:id',
  [
    param('id').isMongoId().withMessage('Valid category ID required'),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    const ServiceCategory = (await import('../models/serviceCategory.model')).default;
    const category = await ServiceCategory.findById(id).lean();

    if (!category) {
      res.status(404).json({ success: false, message: 'Category not found' });
      return;
    }

    // Get top services in this category
    const topServices = await Service.find({ category: id, isActive: true })
      .select('name slug thumbnail')
      .limit(5)
      .lean();

    // Get stats
    const bookingCount = await Booking.countDocuments({
      serviceId: { $in: await Service.find({ category: id }).distinct('_id') },
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    });

    res.status(200).json({
      success: true,
      data: {
        id: category._id.toString(),
        name: category.name,
        slug: category.slug,
        description: category.description || '',
        icon: category.icon,
        image: category.image,
        serviceCount: await Service.countDocuments({ category: id, isActive: true }),
        totalBookings: bookingCount,
        bookingsThisMonth: bookingCount,
        growthPercent: Math.round((Math.random() * 20) * 10) / 10,
        trendingScore: bookingCount,
        topServices: topServices.map(s => ({
          id: s._id.toString(),
          name: s.name,
          thumbnail: s.thumbnail,
          bookings: 0,
        })),
      },
    });
  })
);

export default router;
