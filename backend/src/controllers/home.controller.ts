import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { homeTrendingFeedService, TrendingFeedItemType } from '../services/homeTrendingFeed.service';
import Booking from '../models/booking.model';
import Review from '../models/review.model';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import ServiceCategory from '../models/serviceCategory.model';
import HeroSlide from '../models/heroSlide.model';
import { DEFAULT_HERO_SLIDES } from '../constants/defaultHeroSlides';
import { cache } from '../config/redis';

// Cache TTLs in seconds
const HERO_SLIDES_CACHE_TTL = 900; // 15 minutes
const PLATFORM_STATS_CACHE_TTL = 300; // 5 minutes

/**
 * GET /api/home/trending-feed
 */
export const getTrendingFeed = asyncHandler(async (req: Request, res: Response) => {
  const {
    limit = '8',
    minItems = '4',
    city,
    lat,
    lng,
    period,
    types,
  } = req.query;

  const parsedTypes = types
    ? (types as string).split(',').filter(Boolean) as TrendingFeedItemType[]
    : undefined;

  const result = await homeTrendingFeedService.getFeed({
    limit: parseInt(limit as string, 10),
    minItems: parseInt(minItems as string, 10),
    city: city as string | undefined,
    lat: lat ? parseFloat(lat as string) : undefined,
    lng: lng ? parseFloat(lng as string) : undefined,
    period: period === '30d' ? '30d' : '7d',
    types: parsedTypes,
  });

  res.json({
    success: true,
    data: result,
  });
});

/**
 * POST /api/home/trending-feed/:itemId/click
 */
export const trackTrendingFeedClick = asyncHandler(async (req: Request, res: Response) => {
  const { itemId } = req.params;
  await homeTrendingFeedService.trackClick(itemId);
  res.json({ success: true });
});

/**
 * GET /api/home/stats
 * Public platform trust metrics for homepage and about page
 * Cacheable - data changes infrequently
 */
export const getPlatformStats = asyncHandler(async (_req: Request, res: Response) => {
  const cacheKey = 'home:platform-stats';

  // Check cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    // Add HTTP cache headers for CDN/browser caching
    res.set('Cache-Control', `public, max-age=${PLATFORM_STATS_CACHE_TTL}, stale-while-revalidate=${PLATFORM_STATS_CACHE_TTL * 2}`);
    return res.json({
      success: true,
      data: JSON.parse(cached),
      cached: true,
    });
  }

  const [completedCustomerIds, ratingStats, registeredCustomers, verifiedProfessionals, serviceCategories] =
    await Promise.all([
      Booking.distinct('customerId', { status: 'completed' }),
      Review.aggregate([
        {
          $match: {
            reviewerType: 'customer',
            isHidden: false,
            $or: [
              { moderationStatus: 'approved' },
              { moderationStatus: { $exists: false } },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalReviews: { $sum: 1 },
            averageRating: { $avg: '$rating' },
          },
        },
      ]),
      User.countDocuments({ role: 'customer' }),
      ProviderProfile.countDocuments({
        isActive: true,
        'verificationStatus.overall': 'approved',
      }),
      ServiceCategory.countDocuments({ isActive: true, comingSoon: { $ne: true } }),
    ]);

  const happyClients = completedCustomerIds.length > 0
    ? completedCustomerIds.length
    : registeredCustomers;

  const stats = ratingStats[0] || { totalReviews: 0, averageRating: 0 };

  const data = {
    happyClients,
    averageRating: stats.averageRating
      ? Math.round(stats.averageRating * 10) / 10
      : 0,
    totalReviews: stats.totalReviews || 0,
    verifiedProfessionals,
    serviceCategories,
  };

  // Cache the result
  await cache.set(cacheKey, JSON.stringify(data), PLATFORM_STATS_CACHE_TTL);

  // Add HTTP cache headers
  res.set('Cache-Control', `public, max-age=${PLATFORM_STATS_CACHE_TTL}, stale-while-revalidate=${PLATFORM_STATS_CACHE_TTL * 2}`);

  return res.json({
    success: true,
    data,
  });
});

/**
 * GET /api/home/hero-slides
 * Public hero carousel content (admin-curated with static fallback)
 * Cacheable - slides rarely change (admin-managed content)
 */
export const getHeroSlides = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '10'), 10), 1), 20);
  const cacheKey = `home:hero-slides:${limit}`;

  // Check cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    // Add HTTP cache headers for CDN/browser caching
    res.set('Cache-Control', `public, max-age=${HERO_SLIDES_CACHE_TTL}, stale-while-revalidate=${HERO_SLIDES_CACHE_TTL * 2}`);
    return res.json({
      success: true,
      data: JSON.parse(cached),
      cached: true,
    });
  }

  const dbSlides = await HeroSlide.findActiveSlides(limit);

  const slides = dbSlides.length > 0
    ? dbSlides.map((slide) => ({
        image: slide.image,
        badge: slide.badge,
        title: slide.title,
        subtitle: slide.subtitle,
        cta: slide.cta,
        ctaLink: slide.ctaLink,
        sortOrder: slide.sortOrder,
      }))
    : DEFAULT_HERO_SLIDES.slice(0, limit);

  const data = { slides, source: dbSlides.length > 0 ? 'database' : 'default' };

  // Cache the result (use shorter TTL for DB-sourced, longer for defaults)
  await cache.set(cacheKey, JSON.stringify(data), HERO_SLIDES_CACHE_TTL);

  // Add HTTP cache headers
  res.set('Cache-Control', `public, max-age=${HERO_SLIDES_CACHE_TTL}, stale-while-revalidate=${HERO_SLIDES_CACHE_TTL * 2}`);

  return res.json({
    success: true,
    data,
  });
});
