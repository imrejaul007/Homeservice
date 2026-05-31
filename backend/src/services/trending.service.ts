import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import cacheService, { CACHE_KEYS, getOrSet } from './cache.service';

// ============================================
// Trending Service - Service Popularity Analytics
// ============================================

// Time window options
export type TimeWindow = '24h' | '7d' | '30d' | '90d';

// Trending service interface
export interface TrendingServiceItem {
  serviceId: string;
  serviceName: string;
  categoryId?: string;
  categoryName?: string;
  providerId: string;
  providerName: string;
  bookingCount: number;
  revenue: number;
  averageRating?: number;
  trend: 'rising' | 'stable' | 'falling';
  trendPercentage: number;
  previousPeriodBookings: number;
  imageUrl?: string;
}

// Trending category interface
export interface TrendingCategory {
  categoryId: string;
  categoryName: string;
  bookingCount: number;
  revenue: number;
  averagePrice: number;
  trend: 'rising' | 'stable' | 'falling';
  trendPercentage: number;
  topServices: Array<{
    serviceId: string;
    serviceName: string;
    bookingCount: number;
  }>;
}

// Location-based trending interface
export interface LocationTrending {
  location: {
    type: string;
    coordinates: [number, number];
    name?: string;
  };
  radius: number;
  topServices: TrendingServiceItem[];
  topCategories: TrendingCategory[];
  totalBookings: number;
  totalRevenue: number;
}

// Service popularity score
export interface ServicePopularityScore {
  serviceId: string;
  serviceName: string;
  score: number;
  components: {
    bookingScore: number;
    revenueScore: number;
    ratingScore: number;
    recencyScore: number;
  };
  rank: number;
}

export class TrendingService {
  private getTimeWindowMs(window: TimeWindow): number {
    switch (window) {
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
      case '90d': return 90 * 24 * 60 * 60 * 1000;
      default: return 30 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Calculate trending services
   */
  async getTrendingServices(
    window: TimeWindow = '7d',
    options: {
      limit?: number;
      categoryId?: string;
      providerId?: string;
    } = {}
  ): Promise<TrendingServiceItem[]> {
    const { limit = 10, categoryId, providerId } = options;

    const cacheKey = `trending:services:${window}:${limit}:${categoryId || 'all'}:${providerId || 'all'}`;
    const ttl = window === '24h' ? 300 : window === '7d' ? 600 : 1800;

    return getOrSet(cacheKey, async () => {
      const now = new Date();
      const currentPeriodStart = new Date(now.getTime() - this.getTimeWindowMs(window));
      const previousPeriodStart = new Date(currentPeriodStart.getTime() - this.getTimeWindowMs(window));

      // Build match query
      const currentMatch: any = {
        status: 'completed',
        createdAt: { $gte: currentPeriodStart },
      };

      if (categoryId) {
        currentMatch.category = new Types.ObjectId(categoryId);
      }

      if (providerId) {
        currentMatch.provider = new Types.ObjectId(providerId);
      }

      // Get current period bookings
      const currentBookings = await Booking.aggregate([
        { $match: currentMatch },
        {
          $group: {
            _id: '$serviceId',
            bookingCount: { $sum: 1 },
            revenue: { $sum: '$pricing.totalAmount' },
          },
        },
      ]);

      // Get previous period bookings
      const previousMatch = {
        ...currentMatch,
        createdAt: { $gte: previousPeriodStart, $lt: currentPeriodStart },
      };

      const previousBookings = await Booking.aggregate([
        { $match: previousMatch },
        {
          $group: {
            _id: '$serviceId',
            bookingCount: { $sum: 1 },
          },
        },
      ]);

      // Create previous period map
      const previousMap = new Map<string, number>();
      previousBookings.forEach(p => {
        previousMap.set(p._id.toString(), p.bookingCount);
      });

      // Get service details
      const serviceIds = currentBookings.map(b => b._id);
      const services = await Service.find({ _id: { $in: serviceIds } })
        .populate('category', 'name')
        .populate('provider', 'firstName lastName');

      const serviceMap = new Map<string, any>();
      services.forEach(s => {
        serviceMap.set(s._id.toString(), s);
      });

      // Calculate trend and build result
      const trendingServices: TrendingServiceItem[] = currentBookings
        .map(booking => {
          const service = serviceMap.get(booking._id.toString());
          if (!service) return null;

          const previousCount = previousMap.get(booking._id.toString()) || 0;
          const trendPercentage = previousCount > 0
            ? ((booking.bookingCount - previousCount) / previousCount) * 100
            : booking.bookingCount > 0 ? 100 : 0;

          let trend: 'rising' | 'stable' | 'falling' = 'stable';
          if (trendPercentage > 10) trend = 'rising';
          else if (trendPercentage < -10) trend = 'falling';

          const provider = service.provider as any;

          return {
            serviceId: booking._id.toString(),
            serviceName: service.title || service.name,
            categoryId: (service.category as any)?._id?.toString(),
            categoryName: (service.category as any)?.name,
            providerId: (service.provider as any)?._id?.toString(),
            providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'Unknown',
            bookingCount: booking.bookingCount,
            revenue: booking.revenue,
            averageRating: service.rating?.average,
            trend,
            trendPercentage,
            previousPeriodBookings: previousCount,
            imageUrl: service.images?.[0],
          };
        })
        .filter(Boolean) as TrendingServiceItem[];

      // Sort by booking count and limit
      return trendingServices
        .sort((a, b) => b.bookingCount - a.bookingCount)
        .slice(0, limit);
    }, { prefix: CACHE_KEYS.SERVICE, ttl });
  }

  /**
   * Calculate trending categories
   */
  async getTrendingCategories(
    window: TimeWindow = '7d',
    options: {
      limit?: number;
    } = {}
  ): Promise<TrendingCategory[]> {
    const { limit = 5 } = options;

    const cacheKey = `trending:categories:${window}:${limit}`;
    const ttl = window === '24h' ? 300 : window === '7d' ? 600 : 1800;

    return getOrSet(cacheKey, async () => {
      const now = new Date();
      const currentPeriodStart = new Date(now.getTime() - this.getTimeWindowMs(window));
      const previousPeriodStart = new Date(currentPeriodStart.getTime() - this.getTimeWindowMs(window));

      // Get current period by category
      const currentByCategory = await Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: currentPeriodStart },
          },
        },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'service',
          },
        },
        { $unwind: '$service' },
        {
          $lookup: {
            from: 'servicecategories',
            localField: 'service.category',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$service.category',
            categoryId: { $first: '$service.category' },
            categoryName: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
            bookingCount: { $sum: 1 },
            revenue: { $sum: '$pricing.totalAmount' },
            totalPrice: { $sum: '$pricing.totalAmount' },
          },
        },
      ]);

      // Get previous period
      const previousByCategory = await Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: previousPeriodStart, $lt: currentPeriodStart },
          },
        },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'service',
          },
        },
        { $unwind: '$service' },
        {
          $group: {
            _id: '$service.category',
            bookingCount: { $sum: 1 },
          },
        },
      ]);

      const previousMap = new Map<string, number>();
      previousByCategory.forEach(p => {
        previousMap.set(p._id?.toString() || 'uncategorized', p.bookingCount);
      });

      // Get top services per category
      const topServicesByCategory = await Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: currentPeriodStart },
          },
        },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'service',
          },
        },
        { $unwind: '$service' },
        {
          $group: {
            _id: { category: '$service.category', service: '$serviceId' },
            serviceName: { $first: '$service.title' },
            bookingCount: { $sum: 1 },
          },
        },
        {
          $sort: { bookingCount: -1 },
        },
        {
          $group: {
            _id: '$_id.category',
            topServices: {
              $push: {
                serviceId: '$_id.service',
                serviceName: '$serviceName',
                bookingCount: '$bookingCount',
              },
            },
          },
        },
      ]);

      const topServicesMap = new Map<string, any[]>();
      topServicesByCategory.forEach(c => {
        topServicesMap.set(c._id?.toString(), c.topServices.slice(0, 3));
      });

      // Build result
      const trendingCategories: TrendingCategory[] = currentByCategory
        .map(cat => {
          const previousCount = previousMap.get(cat.categoryId?.toString() || 'uncategorized') || 0;
          const trendPercentage = previousCount > 0
            ? ((cat.bookingCount - previousCount) / previousCount) * 100
            : cat.bookingCount > 0 ? 100 : 0;

          let trend: 'rising' | 'stable' | 'falling' = 'stable';
          if (trendPercentage > 10) trend = 'rising';
          else if (trendPercentage < -10) trend = 'falling';

          return {
            categoryId: cat.categoryId?.toString() || 'uncategorized',
            categoryName: cat.categoryName,
            bookingCount: cat.bookingCount,
            revenue: cat.revenue,
            averagePrice: cat.bookingCount > 0 ? cat.totalPrice / cat.bookingCount : 0,
            trend,
            trendPercentage,
            topServices: topServicesMap.get(cat.categoryId?.toString()) || [],
          };
        })
        .filter(cat => cat.categoryId !== 'uncategorized')
        .sort((a, b) => b.bookingCount - a.bookingCount)
        .slice(0, limit);

      return trendingCategories;
    }, { prefix: CACHE_KEYS.SERVICE, ttl });
  }

  /**
   * Get trending services by location
   */
  async getTrendingByLocation(
    coordinates: { lat: number; lng: number },
    radiusKm: number = 10,
    window: TimeWindow = '7d',
    options: {
      limit?: number;
    } = {}
  ): Promise<LocationTrending> {
    const { limit = 5 } = options;

    const cacheKey = `trending:location:${coordinates.lat}:${coordinates.lng}:${radiusKm}:${window}`;
    const ttl = window === '24h' ? 300 : window === '7d' ? 600 : 1800;

    return getOrSet(cacheKey, async () => {
      const now = new Date();
      const currentPeriodStart = new Date(now.getTime() - this.getTimeWindowMs(window));

      // Get providers in area
      const providersInArea = await ProviderProfile.find({
        'locationInfo.primaryAddress.coordinates': {
          $nearSphere: {
            $geometry: {
              type: 'Point',
              coordinates: [coordinates.lng, coordinates.lat],
            },
            $maxDistance: radiusKm * 1000,
          },
        },
      }).select('userId');

      const providerIds = providersInArea.map(p => p.userId);

      // Get bookings from those providers
      const bookings = await Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: currentPeriodStart },
            providerId: { $in: providerIds },
          },
        },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'service',
          },
        },
        { $unwind: '$service' },
        {
          $lookup: {
            from: 'servicecategories',
            localField: 'service.category',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$serviceId',
            serviceName: { $first: '$service.title' },
            categoryId: { $first: '$service.category' },
            categoryName: { $first: '$category.name' },
            providerId: { $first: '$providerId' },
            bookingCount: { $sum: 1 },
            revenue: { $sum: '$pricing.totalAmount' },
            averageRating: { $avg: '$service.rating.average' },
          },
        },
        { $sort: { bookingCount: -1 } },
        { $limit: limit * 2 },
      ]);

      // Get top services
      const topServices: TrendingServiceItem[] = bookings.slice(0, limit).map(b => ({
        serviceId: b._id.toString(),
        serviceName: b.serviceName || 'Unknown Service',
        categoryId: b.categoryId?.toString(),
        categoryName: b.categoryName || 'General',
        providerId: b.providerId.toString(),
        providerName: 'Provider',
        bookingCount: b.bookingCount,
        revenue: b.revenue,
        averageRating: b.averageRating,
        trend: 'rising' as const,
        trendPercentage: 0,
        previousPeriodBookings: 0,
      }));

      // Get category breakdown
      const categoryBreakdown = await Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: currentPeriodStart },
            providerId: { $in: providerIds },
          },
        },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'service',
          },
        },
        { $unwind: '$service' },
        {
          $lookup: {
            from: 'servicecategories',
            localField: 'service.category',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$service.category',
            categoryName: { $first: { $ifNull: ['$category.name', 'General'] } },
            bookingCount: { $sum: 1 },
            revenue: { $sum: '$pricing.totalAmount' },
          },
        },
        { $sort: { bookingCount: -1 } },
        { $limit: limit },
      ]);

      const topCategories: TrendingCategory[] = categoryBreakdown.map(c => ({
        categoryId: c._id?.toString() || 'general',
        categoryName: c.categoryName,
        bookingCount: c.bookingCount,
        revenue: c.revenue,
        averagePrice: c.bookingCount > 0 ? c.revenue / c.bookingCount : 0,
        trend: 'rising' as const,
        trendPercentage: 0,
        topServices: [],
      }));

      // Calculate totals
      const totalBookings = bookings.reduce((sum, b) => sum + b.bookingCount, 0);
      const totalRevenue = bookings.reduce((sum, b) => sum + b.revenue, 0);

      return {
        location: {
          type: 'Point',
          coordinates: [coordinates.lng, coordinates.lat],
        },
        radius: radiusKm,
        topServices,
        topCategories,
        totalBookings,
        totalRevenue,
      };
    }, { prefix: CACHE_KEYS.SERVICE, ttl });
  }

  /**
   * Calculate service popularity score (for recommendations)
   */
  async calculatePopularityScores(
    window: TimeWindow = '30d',
    options: {
      limit?: number;
      categoryId?: string;
    } = {}
  ): Promise<ServicePopularityScore[]> {
    const { limit = 20, categoryId } = options;

    const cacheKey = `popularity:scores:${window}:${limit}:${categoryId || 'all'}`;
    const ttl = 1800; // 30 minutes

    return getOrSet(cacheKey, async () => {
      const now = new Date();
      const windowStart = new Date(now.getTime() - this.getTimeWindowMs(window));

      // Build match
      const match: any = {
        status: 'completed',
        createdAt: { $gte: windowStart },
      };

      if (categoryId) {
        match.category = new Types.ObjectId(categoryId);
      }

      // Aggregate scores
      const scores = await Booking.aggregate([
        { $match: match },
        {
          $lookup: {
            from: 'services',
            localField: 'serviceId',
            foreignField: '_id',
            as: 'service',
          },
        },
        { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$serviceId',
            serviceName: { $first: { $ifNull: ['$service.title', 'Unknown'] } },
            bookingCount: { $sum: 1 },
            totalRevenue: { $sum: '$pricing.totalAmount' },
            avgRating: { $avg: '$service.rating.average' },
            minCreatedAt: { $min: '$createdAt' },
          },
        },
      ]);

      // Normalize scores
      const maxBookings = Math.max(...scores.map(s => s.bookingCount), 1);
      const maxRevenue = Math.max(...scores.map(s => s.totalRevenue), 1);
      const maxRating = 5;

      const scoredServices = scores.map((s, index) => {
        const bookingScore = (s.bookingCount / maxBookings) * 40; // 40% weight
        const revenueScore = (s.totalRevenue / maxRevenue) * 30; // 30% weight
        const ratingScore = ((s.avgRating || 0) / maxRating) * 20; // 20% weight

        // Recency score (newer services get boost)
        const daysSinceFirstBooking = (now.getTime() - new Date(s.minCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 10 - (daysSinceFirstBooking / 10)) * 1; // 10% weight

        const totalScore = bookingScore + revenueScore + ratingScore + recencyScore;

        return {
          serviceId: s._id.toString(),
          serviceName: s.serviceName,
          score: Math.round(totalScore * 100) / 100,
          components: {
            bookingScore: Math.round(bookingScore * 100) / 100,
            revenueScore: Math.round(revenueScore * 100) / 100,
            ratingScore: Math.round(ratingScore * 100) / 100,
            recencyScore: Math.round(recencyScore * 100) / 100,
          },
          rank: 0,
        };
      });

      // Sort by score and assign ranks
      scoredServices.sort((a, b) => b.score - a.score);

      return scoredServices
        .map((s, i) => ({ ...s, rank: i + 1 }))
        .slice(0, limit);
    }, { prefix: CACHE_KEYS.SERVICE, ttl });
  }

  /**
   * Get rising stars (services with highest growth)
   */
  async getRisingStars(
    window: TimeWindow = '30d',
    options: {
      limit?: number;
      minPreviousBookings?: number;
    } = {}
  ): Promise<TrendingServiceItem[]> {
    const { limit = 5, minPreviousBookings = 3 } = options;

    const now = new Date();
    const currentPeriodStart = new Date(now.getTime() - this.getTimeWindowMs(window));
    const previousPeriodStart = new Date(currentPeriodStart.getTime() - this.getTimeWindowMs(window));

    // Get all services with booking counts
    const currentBookings = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: currentPeriodStart },
        },
      },
      {
        $group: {
          _id: '$serviceId',
          bookingCount: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' },
        },
      },
    ]);

    const previousBookings = await Booking.aggregate([
      {
        $match: {
          status: 'completed',
          createdAt: { $gte: previousPeriodStart, $lt: currentPeriodStart },
        },
      },
      {
        $group: {
          _id: '$serviceId',
          bookingCount: { $sum: 1 },
        },
      },
    ]);

    const previousMap = new Map<string, number>();
    previousBookings.forEach(p => {
      previousMap.set(p._id.toString(), p.bookingCount);
    });

    // Calculate growth rates
    const growthRates = currentBookings
      .map(c => {
        const previousCount = previousMap.get(c._id.toString()) || 0;
        const growthPercentage = previousCount >= minPreviousBookings
          ? ((c.bookingCount - previousCount) / previousCount) * 100
          : 0;

        return {
          ...c,
          previousCount,
          growthPercentage,
        };
      })
      .filter(c => c.growthPercentage > 0 && c.previousCount >= minPreviousBookings)
      .sort((a, b) => b.growthPercentage - a.growthPercentage)
      .slice(0, limit);

    // Get service details
    const serviceIds = growthRates.map(g => g._id);
    const services = await Service.find({ _id: { $in: serviceIds } })
      .populate('category', 'name')
      .populate('provider', 'firstName lastName');

    const serviceMap = new Map<string, any>();
    services.forEach(s => {
      serviceMap.set(s._id.toString(), s);
    });

    return growthRates.map(g => {
      const service = serviceMap.get(g._id.toString());
      const provider = service?.provider as any;

      return {
        serviceId: g._id.toString(),
        serviceName: service?.title || service?.name || 'Unknown',
        categoryId: (service?.category as any)?._id?.toString(),
        categoryName: (service?.category as any)?.name,
        providerId: provider?._id?.toString(),
        providerName: provider ? `${provider.firstName} ${provider.lastName}` : 'Unknown',
        bookingCount: g.bookingCount,
        revenue: g.revenue,
        averageRating: service?.rating?.average,
        trend: 'rising' as const,
        trendPercentage: g.growthPercentage,
        previousPeriodBookings: g.previousCount,
        imageUrl: service?.images?.[0],
      };
    });
  }

  /**
   * Get trending insights (seasonal patterns, etc.)
   */
  async getTrendingInsights(): Promise<{
    dayOfWeekTrends: Array<{ day: string; count: number; revenue: number }>;
    hourOfDayTrends: Array<{ hour: number; count: number; revenue: number }>;
    seasonalBoost: { season: string; affectedCategories: string[]; description: string };
  }> {
    const cacheKey = 'trending:insights';
    const ttl = 3600; // 1 hour

    return getOrSet(cacheKey, async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const bookings = await Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: monthStart },
          },
        },
      ]);

      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayMap = new Map<string, { count: number; revenue: number }>();
      const hourMap = new Map<number, { count: number; revenue: number }>();

      bookings.forEach(b => {
        const date = new Date(b.createdAt);
        const day = days[date.getDay()];
        const hour = date.getHours();

        const dayStats = dayMap.get(day) || { count: 0, revenue: 0 };
        dayStats.count++;
        dayStats.revenue += b.pricing.totalAmount;
        dayMap.set(day, dayStats);

        const hourStats = hourMap.get(hour) || { count: 0, revenue: 0 };
        hourStats.count++;
        hourStats.revenue += b.pricing.totalAmount;
        hourMap.set(hour, hourStats);
      });

      const dayOfWeekTrends = days.map(day => ({
        day,
        ...(dayMap.get(day) || { count: 0, revenue: 0 }),
      }));

      const hourOfDayTrends = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        ...(hourMap.get(i) || { count: 0, revenue: 0 }),
      }));

      // Determine season
      const month = now.getMonth();
      let season: string;
      let affectedCategories: string[];
      let description: string;

      if (month >= 2 && month <= 4) {
        season = 'Spring';
        affectedCategories = ['Gardening', 'Cleaning', 'Pest Control'];
        description = 'Spring cleaning and outdoor services see a 40% increase';
      } else if (month >= 5 && month <= 7) {
        season = 'Summer';
        affectedCategories = ['AC Repair', 'Pool Maintenance', 'Cooling Services'];
        description = 'Cooling and HVAC services peak during summer months';
      } else if (month >= 8 && month <= 10) {
        season = 'Autumn';
        affectedCategories = ['Heating', 'Gutter Cleaning', 'Lawn Care'];
        description = 'Preparation for winter increases heating service demand';
      } else {
        season = 'Winter';
        affectedCategories = ['Holiday Decorating', 'Deep Cleaning', 'Interior Painting'];
        description = 'Holiday preparation and deep cleaning services surge';
      }

      return {
        dayOfWeekTrends,
        hourOfDayTrends,
        seasonalBoost: {
          season,
          affectedCategories,
          description,
        },
      };
    }, { prefix: CACHE_KEYS.SERVICE, ttl });
  }
}

// Export singleton instance
export const trendingService = new TrendingService();
export default trendingService;
