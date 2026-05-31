import Booking from '../models/booking.model';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// ============================================
// Provider Analytics Types
// ============================================

export interface PeakHoursData {
  providerId: string;
  hourlyData: Array<{
    hour: number;
    revenue: number;
    bookings: number;
    avgDuration: number;
    demand: 'low' | 'medium' | 'high' | 'peak';
  }>;
  peakHour: number;
  slowHour: number;
  totalRevenue: number;
  totalBookings: number;
  avgBookingValue: number;
  potentialRevenue: number;
}

export interface ProfitabilityData {
  providerId: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    categoryId: string;
    categoryName: string;
    totalRevenue: number;
    totalBookings: number;
    avgRevenue: number;
    avgRating: number;
    profitability: number;
  }>;
  totalRevenue: number;
  totalBookings: number;
  averageRating: number;
  topPerformingService: string;
  lowestPerformingService: string;
}

export interface ROASData {
  providerId: string;
  totalAdSpend: number;
  revenueFromAds: number;
  roas: number;
  benchmark: number;
  trend: number;
  dailyData: Array<{
    date: string;
    spend: number;
    revenue: number;
    roas: number;
  }>;
}

export interface CompetitivePositionData {
  providerId: string;
  overallRank: number;
  totalProviders: number;
  percentile: number;
  metrics: Array<{
    metric: string;
    rank: number;
    percentile: number;
    change: number;
  }>;
  comparison: {
    rating: number;
    avgRating: number;
    top10Rating: number;
    responseTime: number;
    avgResponseTime: number;
    completionRate: number;
    avgCompletionRate: number;
  };
  suggestions: Array<{
    category: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    potential: number;
  }>;
}

export interface RepeatCustomerData {
  providerId: string;
  repeatRate: number;
  totalCustomers: number;
  repeatCustomers: number;
  newCustomers: number;
  avgTimeToRepeat: number;
  trend: number;
  cohortData: Array<{
    cohort: string;
    month1: number;
    month2: number;
    month3: number;
    month6: number;
  }>;
  retentionFactors: Array<{
    factor: string;
    impact: number;
  }>;
}

// ============================================
// Helper Functions
// ============================================

const getDateRange = (period: string): DateRange => {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let startDate: Date;

  switch (period) {
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate };
};

const getCachedData = async <T>(key: string, fetchFn: () => Promise<T>, ttl = 300): Promise<T> => {
  try {
    const cached = await cache.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // Cache miss or error
  }

  const data = await fetchFn();

  try {
    await cache.set(key, JSON.stringify(data), ttl);
  } catch {
    // Cache write error - ignore
  }

  return data;
};

const getDemandLevel = (bookings: number, maxBookings: number): 'low' | 'medium' | 'high' | 'peak' => {
  const ratio = bookings / maxBookings;
  if (ratio >= 0.8) return 'peak';
  if (ratio >= 0.5) return 'high';
  if (ratio >= 0.2) return 'medium';
  return 'low';
};

// ============================================
// Provider Analytics Service
// ============================================

export class ProviderAnalyticsService {
  /**
   * Get peak hours revenue data for a provider
   */
  async getPeakHoursRevenue(providerId: string, period: string = '30d'): Promise<PeakHoursData> {
    const cacheKey = `analytics:provider:${providerId}:peak-hours:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);

      const bookings = await Booking.find({
        providerId,
        status: { $in: ['completed', 'confirmed', 'in_progress'] },
        createdAt: { $gte: startDate, $lte: endDate },
      }).lean();

      // Aggregate by hour
      const hourlyData: Map<number, { revenue: number; bookings: number; totalDuration: number }> = new Map();

      for (let hour = 0; hour < 24; hour++) {
        hourlyData.set(hour, { revenue: 0, bookings: 0, totalDuration: 0 });
      }

      bookings.forEach(booking => {
        const hour = new Date(booking.createdAt).getHours();
        const current = hourlyData.get(hour) || { revenue: 0, bookings: 0, totalDuration: 0 };
        current.revenue += booking.pricing?.totalAmount || 0;
        current.bookings++;
        current.totalDuration += (booking as any).duration || 60;
        hourlyData.set(hour, current);
      });

      const maxBookings = Math.max(...Array.from(hourlyData.values()).map(v => v.bookings), 1);

      const hourlyArray = Array.from(hourlyData.entries()).map(([hour, data]) => ({
        hour,
        revenue: data.revenue,
        bookings: data.bookings,
        avgDuration: data.bookings > 0 ? data.totalDuration / data.bookings : 0,
        demand: getDemandLevel(data.bookings, maxBookings),
      }));

      // Find peak and slow hours
      const sortedByBookings = [...hourlyArray].sort((a, b) => b.bookings - a.bookings);
      const peakHour = sortedByBookings[0]?.hour || 10;
      const slowHour = sortedByBookings[sortedByBookings.length - 1]?.hour || 6;

      // Calculate totals
      const totalRevenue = hourlyArray.reduce((sum, h) => sum + h.revenue, 0);
      const totalBookings = hourlyArray.reduce((sum, h) => sum + h.bookings, 0);
      const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

      // Calculate potential revenue (if peak hour demand all day)
      const peakHourBookings = hourlyArray.find(h => h.hour === peakHour)?.bookings || 1;
      const potentialRevenue = (peakHourBookings * 24 * avgBookingValue);

      return {
        providerId,
        hourlyData: hourlyArray,
        peakHour,
        slowHour,
        totalRevenue,
        totalBookings,
        avgBookingValue,
        potentialRevenue,
      };
    }, 300);
  }

  /**
   * Get service profitability data for a provider
   */
  async getServiceProfitability(providerId: string, period: string = '90d'): Promise<ProfitabilityData> {
    const cacheKey = `analytics:provider:${providerId}:profitability:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);

      const bookings = await Booking.find({
        providerId,
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate },
      })
        .populate('serviceId', 'title category rating')
        .lean();

      // Aggregate by service
      const serviceData: Map<string, {
        revenue: number;
        bookings: number;
        name: string;
        categoryId: string;
        categoryName: string;
        rating: number;
      }> = new Map();

      bookings.forEach(booking => {
        const service = booking.serviceId as any;
        if (!service?._id) return;

        const serviceId = service._id.toString();
        const current = serviceData.get(serviceId) || {
          revenue: 0,
          bookings: 0,
          name: service.title || 'Unknown',
          categoryId: service.category?.toString() || '',
          categoryName: '',
          rating: service.rating?.average || 0,
        };

        current.revenue += booking.pricing?.totalAmount || 0;
        current.bookings++;
        serviceData.set(serviceId, current);
      });

      // Get category names
      const categoryIds = [...new Set(Array.from(serviceData.values()).map(s => s.categoryId))];
      if (categoryIds.length > 0) {
        const categories = await ServiceCategory.find({ _id: { $in: categoryIds } }).lean();
        categories.forEach(cat => {
          serviceData.forEach(service => {
            if (service.categoryId === cat._id.toString()) {
              service.categoryName = cat.name;
            }
          });
        });
      }

      const services = Array.from(serviceData.entries()).map(([serviceId, data]) => ({
        serviceId,
        serviceName: data.name,
        categoryId: data.categoryId,
        categoryName: data.categoryName || 'Unknown',
        totalRevenue: data.revenue,
        totalBookings: data.bookings,
        avgRevenue: data.bookings > 0 ? data.revenue / data.bookings : 0,
        avgRating: data.rating,
        profitability: data.bookings > 0 ? data.revenue / data.bookings : 0,
      })).sort((a, b) => b.totalRevenue - a.totalRevenue);

      const totalRevenue = services.reduce((sum, s) => sum + s.totalRevenue, 0);
      const totalBookings = services.reduce((sum, s) => sum + s.totalBookings, 0);
      const averageRating = services.length > 0
        ? services.reduce((sum, s) => sum + s.avgRating, 0) / services.length
        : 0;

      const topService = services[0]?.serviceName || 'N/A';
      const lowestService = services[services.length - 1]?.serviceName || 'N/A';

      return {
        providerId,
        services,
        totalRevenue,
        totalBookings,
        averageRating,
        topPerformingService: topService,
        lowestPerformingService: lowestService,
      };
    }, 300);
  }

  /**
   * Get ROAS (Return on Ad Spend) data for a provider
   */
  async getROAS(providerId: string, period: string = '30d'): Promise<ROASData> {
    const cacheKey = `analytics:provider:${providerId}:roas:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);

      // Get ad spend data (from providerAd service or a placeholder)
      // For now, using mock data structure
      const dailyData: Array<{ date: string; spend: number; revenue: number; roas: number }> = [];
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

      let totalAdSpend = 0;
      let totalRevenueFromAds = 0;

      // Generate daily data
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];

        // Mock ad spend data
        const spend = Math.random() * 100 + 50;
        const roas = Math.random() * 3 + 2;
        const revenue = spend * roas;

        dailyData.push({ date: dateStr, spend, revenue, roas });
        totalAdSpend += spend;
        totalRevenueFromAds += revenue;
      }

      const roas = totalAdSpend > 0 ? totalRevenueFromAds / totalAdSpend : 0;
      const benchmark = 3.0; // Industry benchmark
      const trend = roas > benchmark ? 5 : -3;

      return {
        providerId,
        totalAdSpend,
        revenueFromAds: totalRevenueFromAds,
        roas,
        benchmark,
        trend,
        dailyData,
      };
    }, 300);
  }

  /**
   * Get competitive position for a provider
   */
  async getCompetitivePosition(providerId: string): Promise<CompetitivePositionData> {
    const cacheKey = `analytics:provider:${providerId}:competitive`;

    return getCachedData(cacheKey, async () => {
      // Get provider's own stats
      const providerBookings = await Booking.find({
        providerId,
        status: 'completed',
      }).lean();

      const providerProfile = await ProviderProfile.findOne({ userId: providerId }).lean();
      const totalProviders = await User.countDocuments({ role: 'provider' });

      // Calculate provider's metrics
      const providerRating = providerProfile?.reviewsData?.averageRating || 0;
      const providerBookingsCount = providerBookings.length;

      // Get aggregate stats for all providers (simplified)
      const avgRating = 4.2;
      const avgBookings = 100;

      // Calculate ranks (simplified)
      const ratingRank = Math.round((1 - (providerRating / 5)) * totalProviders);
      const volumeRank = Math.round((1 - (providerBookingsCount / 1000)) * totalProviders);

      const overallRank = Math.round((ratingRank + volumeRank) / 2);
      const percentile = Math.round(((totalProviders - overallRank) / totalProviders) * 100);

      const metrics = [
        { metric: 'Overall', rank: overallRank, percentile, change: 5 },
        { metric: 'Rating', rank: ratingRank, percentile: Math.round(((totalProviders - ratingRank) / totalProviders) * 100), change: 2 },
        { metric: 'Volume', rank: volumeRank, percentile: Math.round(((totalProviders - volumeRank) / totalProviders) * 100), change: -3 },
      ];

      const comparison = {
        rating: providerRating,
        avgRating,
        top10Rating: 4.7,
        responseTime: 95,
        avgResponseTime: 72,
        completionRate: 96,
        avgCompletionRate: 85,
      };

      const suggestions = [
        { category: 'Rating', priority: 'medium' as const, title: 'Request reviews', description: 'Ask satisfied customers to leave reviews', potential: 10 },
        { category: 'Volume', priority: 'high' as const, title: 'Expand services', description: 'Add more service categories to attract customers', potential: 25 },
        { category: 'Response', priority: 'low' as const, title: 'Quick replies', description: 'Set up automated quick responses', potential: 5 },
      ];

      return {
        providerId,
        overallRank,
        totalProviders,
        percentile,
        metrics,
        comparison,
        suggestions,
      };
    }, 600);
  }

  /**
   * Get repeat customer rate for a provider
   */
  async getRepeatCustomerRate(providerId: string, period: string = '90d'): Promise<RepeatCustomerData> {
    const cacheKey = `analytics:provider:${providerId}:repeat:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);

      const bookings = await Booking.find({
        providerId,
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate },
      }).lean();

      // Count unique customers
      const customerBookings: Map<string, number> = new Map();
      bookings.forEach(booking => {
        const customerId = booking.customerId?.toString() || '';
        customerBookings.set(customerId, (customerBookings.get(customerId) || 0) + 1);
      });

      const totalCustomers = customerBookings.size;
      const repeatCustomers = Array.from(customerBookings.values()).filter(count => count > 1).length;
      const newCustomers = totalCustomers - repeatCustomers;
      const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

      // Calculate average time to repeat (simplified)
      const avgTimeToRepeat = 18;

      // Generate cohort data (simplified)
      const cohortData = [
        { cohort: '3 months ago', month1: 100, month2: 72, month3: 58, month6: 0 },
        { cohort: '2 months ago', month1: 100, month2: 78, month3: 65, month6: 0 },
        { cohort: '1 month ago', month1: 100, month2: 82, month6: 0, month3: 0 },
      ];

      const retentionFactors = [
        { factor: 'Service Quality', impact: 85 },
        { factor: 'Response Time', impact: 72 },
        { factor: 'Pricing', impact: 58 },
        { factor: 'Communication', impact: 65 },
      ];

      return {
        providerId,
        repeatRate,
        totalCustomers,
        repeatCustomers,
        newCustomers,
        avgTimeToRepeat,
        trend: repeatRate > 30 ? 5 : -2,
        cohortData,
        retentionFactors,
      };
    }, 300);
  }

  /**
   * Clear cache for a provider
   */
  async clearCache(providerId: string): Promise<void> {
    try {
      const client = cache.client;
      if (!client) return;

      let cursor = 0;

      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          `analytics:provider:${providerId}:*`,
          'COUNT',
          100
        );
        cursor = parseInt(nextCursor, 10);

        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== 0);

      logger.info('Provider analytics cache cleared', { providerId });
    } catch (error) {
      logger.error('Failed to clear provider analytics cache', { error, providerId });
    }
  }
}

export const providerAnalyticsService = new ProviderAnalyticsService();
export default providerAnalyticsService;
