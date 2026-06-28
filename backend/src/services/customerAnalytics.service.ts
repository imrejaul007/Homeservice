import Booking from '../models/booking.model';
import User from '../models/user.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

// ============================================
// Customer Analytics Types
// ============================================

export interface BookingFrequencyTimePoint {
  date: string;
  bookings: number;
  revenue: number;
  avgValue: number;
}

export interface CustomerBookingFrequency {
  customerId: string;
  totalBookings: number;
  bookingsByPeriod: {
    week: number;
    month: number;
    quarter: number;
    year: number;
  };
  averageBookingsPerMonth: number;
  trend: number;
  trendDirection: 'up' | 'down' | 'stable';
  mostActiveDay: string;
  peakHours: string;
  favoriteCategories: string[];
  timeSeries: BookingFrequencyTimePoint[];
}

export interface CustomerAOVTrend {
  customerId: string;
  currentAOV: number;
  previousAOV: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  lifetimeAverage: number;
  highestOrder: number;
  lowestOrder: number;
  targetAOV: number;
  timeSeries: Array<{
    date: string;
    aov: number;
    orderCount: number;
    totalSpent: number;
  }>;
  aovByCategory: Array<{
    categoryId: string;
    categoryName: string;
    aov: number;
  }>;
}

export interface CategoryDistribution {
  customerId: string;
  categories: Array<{
    categoryId: string;
    categoryName: string;
    totalSpent: number;
    bookingCount: number;
    percentage: number;
  }>;
  totalSpent: number;
  diversification: number;
  topCategory: string;
  monthlyTrend: Array<Record<string, string | number>>;
}

export interface SeasonalPattern {
  customerId: string;
  monthlyData: Array<{
    month: number;
    year: number;
    bookings: number;
    spending: number;
    averageValue: number;
    season: 'winter' | 'spring' | 'summer' | 'fall';
  }>;
  seasonalTotals: {
    winter: { bookings: number; spending: number };
    spring: { bookings: number; spending: number };
    summer: { bookings: number; spending: number };
    fall: { bookings: number; spending: number };
  };
  peakMonth: { month: number; year: number };
  slowMonth: { month: number; year: number };
  seasonalityIndex: number;
}

export interface CESData {
  customerId: string;
  scores: Array<{
    score: number;
    date: Date;
    serviceId?: string;
    bookingId?: string;
  }>;
  averageScore: number;
  benchmark: number;
  trend: number;
  distribution: {
    veryEasy: number;
    easy: number;
    neutral: number;
    difficult: number;
    veryDifficult: number;
  };
  responseRate: number;
}

// ============================================
// Helper Functions
// ============================================

const getSeason = (month: number): 'winter' | 'spring' | 'summer' | 'fall' => {
  if (month >= 12 || month <= 2) return 'winter';
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  return 'fall';
};

const MONTH_ORDER = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
    case '1y':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case 'all':
      startDate = new Date(2020, 0, 1);
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate };
};

const buildBookingFrequencyTimeSeries = (
  bookings: Array<{ createdAt: Date; pricing?: { totalAmount?: number } }>,
  period: string,
): BookingFrequencyTimePoint[] => {
  const getAmount = (booking: { pricing?: { totalAmount?: number } }) =>
    booking.pricing?.totalAmount || 0;

  if (period === '7d') {
    const order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const buckets = Object.fromEntries(order.map((day) => [day, { bookings: 0, revenue: 0 }]));

    bookings.forEach((booking) => {
      const day = new Date(booking.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
      if (!buckets[day]) {
        buckets[day] = { bookings: 0, revenue: 0 };
      }
      buckets[day].bookings += 1;
      buckets[day].revenue += getAmount(booking);
    });

    return order.map((date) => ({
      date,
      bookings: buckets[date].bookings,
      revenue: buckets[date].revenue,
      avgValue: buckets[date].bookings > 0 ? buckets[date].revenue / buckets[date].bookings : 0,
    }));
  }

  if (period === '30d') {
    const now = new Date();
    const weeks: BookingFrequencyTimePoint[] = [];

    for (let weekIndex = 3; weekIndex >= 0; weekIndex -= 1) {
      const weekEnd = new Date(now.getTime() - weekIndex * 7 * 24 * 60 * 60 * 1000);
      const weekStart = new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
      const inWeek = bookings.filter((booking) => {
        const createdAt = new Date(booking.createdAt);
        return createdAt > weekStart && createdAt <= weekEnd;
      });
      const revenue = inWeek.reduce((sum, booking) => sum + getAmount(booking), 0);

      weeks.push({
        date: `Week ${4 - weekIndex}`,
        bookings: inWeek.length,
        revenue,
        avgValue: inWeek.length > 0 ? revenue / inWeek.length : 0,
      });
    }

    return weeks;
  }

  if (period === '90d') {
    const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
    const buckets = new Map<string, { bookings: number; revenue: number; sortKey: number }>();

    bookings.forEach((booking) => {
      const createdAt = new Date(booking.createdAt);
      const sortKey = createdAt.getFullYear() * 12 + createdAt.getMonth();
      const label = monthFormatter.format(createdAt);
      const current = buckets.get(label) || { bookings: 0, revenue: 0, sortKey };
      current.bookings += 1;
      current.revenue += getAmount(booking);
      buckets.set(label, current);
    });

    return Array.from(buckets.entries())
      .sort((a, b) => a[1].sortKey - b[1].sortKey)
      .map(([date, bucket]) => ({
        date,
        bookings: bucket.bookings,
        revenue: bucket.revenue,
        avgValue: bucket.bookings > 0 ? bucket.revenue / bucket.bookings : 0,
      }));
  }

  const quarterBuckets = new Map<string, { bookings: number; revenue: number; sortKey: number }>();
  bookings.forEach((booking) => {
    const createdAt = new Date(booking.createdAt);
    const quarter = Math.floor(createdAt.getMonth() / 3) + 1;
    const label = `Q${quarter}`;
    const sortKey = createdAt.getFullYear() * 10 + quarter;
    const current = quarterBuckets.get(label) || { bookings: 0, revenue: 0, sortKey };
    current.bookings += 1;
    current.revenue += getAmount(booking);
    quarterBuckets.set(label, current);
  });

  return Array.from(quarterBuckets.entries())
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([date, bucket]) => ({
      date,
      bookings: bucket.bookings,
      revenue: bucket.revenue,
      avgValue: bucket.bookings > 0 ? bucket.revenue / bucket.bookings : 0,
    }));
};

const buildAOVTrendTimeSeries = (
  bookings: Array<{ createdAt: Date; pricing?: { totalAmount?: number } }>,
  period: string,
) => {
  const frequencySeries = buildBookingFrequencyTimeSeries(bookings, period);
  return frequencySeries.map((point) => ({
    date: point.date,
    aov: point.avgValue,
    orderCount: point.bookings,
    totalSpent: point.revenue,
  }));
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

// ============================================
// Customer Analytics Service
// ============================================

export class CustomerAnalyticsService {
  /**
   * Get booking frequency data for a customer
   */
  async getBookingFrequency(customerId: string, period: string = '90d'): Promise<CustomerBookingFrequency> {
    const cacheKey = `analytics:customer:${customerId}:frequency:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);

      // Use aggregation pipeline with $lookup to join categories in a single query
      const bookings = await Booking.aggregate([
        {
          $match: {
            customerId,
            status: { $in: ['completed', 'confirmed', 'in_progress'] },
            createdAt: { $gte: startDate, $lte: endDate },
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
        { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'servicecategories',
            localField: 'service.category',
            foreignField: '_id',
            as: 'categoryData',
          },
        },
        {
          $addFields: {
            categoryId: { $arrayElemAt: ['$categoryData._id', 0] },
            categoryName: { $arrayElemAt: ['$categoryData.name', 0] },
          },
        },
        { $sort: { createdAt: 1 } },
      ]);

      // Calculate bookings by period
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const oneQuarterAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

      const bookingsByPeriod = {
        week: bookings.filter(b => new Date(b.createdAt) >= oneWeekAgo).length,
        month: bookings.filter(b => new Date(b.createdAt) >= oneMonthAgo).length,
        quarter: bookings.filter(b => new Date(b.createdAt) >= oneQuarterAgo).length,
        year: bookings.filter(b => new Date(b.createdAt) >= oneYearAgo).length,
      };

      // Calculate most active day
      const dayCount: Record<string, number> = {};
      const hourCount: Record<number, number> = {};

      bookings.forEach(booking => {
        const date = new Date(booking.createdAt);
        const day = date.toLocaleDateString('en-US', { weekday: 'long' });
        const hour = date.getHours();

        dayCount[day] = (dayCount[day] || 0) + 1;
        hourCount[hour] = (hourCount[hour] || 0) + 1;
      });

      const mostActiveDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

      // Find peak hours (most common booking hour)
      const peakHour = Object.entries(hourCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 10;
      const peakHours = `${peakHour}:00 - ${Number(peakHour) + 2}:00`;

      // Get favorite categories (category data already joined via $lookup)
      const categoryCount: Record<string, { count: number; categoryName: string }> = {};
      bookings.forEach(booking => {
        if (booking.categoryId) {
          const catId = booking.categoryId.toString();
          if (!categoryCount[catId]) {
            categoryCount[catId] = { count: 0, categoryName: booking.categoryName || '' };
          }
          categoryCount[catId].count++;
        }
      });

      const favoriteCategories = Object.entries(categoryCount)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([_, data]) => data.categoryName || 'Unknown');

      // Calculate trend (compare current period to previous)
      const previousStartDate = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
      const previousBookings = await Booking.countDocuments({
        customerId,
        status: { $in: ['completed', 'confirmed', 'in_progress'] },
        createdAt: { $gte: previousStartDate, $lt: startDate },
      });

      const currentBookings = bookings.length;
      const trend = previousBookings > 0
        ? ((currentBookings - previousBookings) / previousBookings) * 100
        : currentBookings > 0 ? 100 : 0;

      const trendDirection: 'up' | 'down' | 'stable' =
        trend > 1 ? 'up' : trend < -1 ? 'down' : 'stable';

      const monthsInPeriod = period === '7d' ? 0.25 : period === '30d' ? 1 : period === '90d' ? 3 : 12;
      const averageBookingsPerMonth = monthsInPeriod > 0 ? currentBookings / monthsInPeriod : currentBookings;

      return {
        customerId,
        totalBookings: currentBookings,
        bookingsByPeriod,
        averageBookingsPerMonth: Math.round(averageBookingsPerMonth * 10) / 10,
        trend: Math.round(trend * 10) / 10,
        trendDirection,
        mostActiveDay,
        peakHours,
        favoriteCategories,
        timeSeries: buildBookingFrequencyTimeSeries(bookings, period),
      };
    }, 300);
  }

  /**
   * Get AOV trend data for a customer
   */
  async getAOVTrend(customerId: string, period: string = '90d'): Promise<CustomerAOVTrend> {
    const cacheKey = `analytics:customer:${customerId}:aov:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);
      const periodLength = endDate.getTime() - startDate.getTime();
      const previousStartDate = new Date(startDate.getTime() - periodLength);
      const previousEndDate = new Date(startDate.getTime() - 1);

      // Get current period bookings with category lookup in single query
      const currentBookings = await Booking.aggregate([
        {
          $match: {
            customerId,
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate },
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
        { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'servicecategories',
            localField: 'service.category',
            foreignField: '_id',
            as: 'categoryData',
          },
        },
        {
          $addFields: {
            categoryId: { $arrayElemAt: ['$categoryData._id', 0] },
            categoryName: { $arrayElemAt: ['$categoryData.name', 0] },
          },
        },
      ]);

      // Get previous period bookings (no category lookup needed)
      const previousBookings = await Booking.find({
        customerId,
        status: 'completed',
        createdAt: { $gte: previousStartDate, $lte: previousEndDate },
      }).lean();

      // Calculate AOVs
      const currentTotal = currentBookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0);
      const previousTotal = previousBookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0);

      const currentAOV = currentBookings.length > 0 ? currentTotal / currentBookings.length : 0;
      const previousAOV = previousBookings.length > 0 ? previousTotal / previousBookings.length : 0;
      const change = currentAOV - previousAOV;
      const changePercent = previousAOV > 0 ? (change / previousAOV) * 100 : 0;

      // Get all-time stats
      const allTimeBookings = await Booking.find({
        customerId,
        status: 'completed',
      }).lean();

      const allTimeTotal = allTimeBookings.reduce((sum, b) => sum + (b.pricing?.totalAmount || 0), 0);
      const lifetimeAverage = allTimeBookings.length > 0 ? allTimeTotal / allTimeBookings.length : 0;

      const allAmounts = allTimeBookings.map(b => b.pricing?.totalAmount || 0);
      const highestOrder = Math.max(...allAmounts, 0);
      const lowestOrder = Math.min(...allAmounts.filter(a => a > 0), 0);

      // Calculate AOV by category (category data already joined via $lookup)
      const categoryTotals: Record<string, { total: number; count: number; name: string }> = {};
      currentBookings.forEach(booking => {
        if (booking.categoryId) {
          const catId = booking.categoryId.toString();
          if (!categoryTotals[catId]) {
            categoryTotals[catId] = { total: 0, count: 0, name: booking.categoryName || '' };
          }
          categoryTotals[catId].total += booking.pricing?.totalAmount || 0;
          categoryTotals[catId].count++;
        }
      });

      const aovByCategory = Object.entries(categoryTotals)
        .map(([categoryId, data]) => ({
          categoryId,
          categoryName: data.name || 'Unknown',
          aov: data.count > 0 ? data.total / data.count : 0,
        }))
        .sort((a, b) => b.aov - a.aov);

      const trend: 'up' | 'down' | 'stable' = changePercent > 1 ? 'up' : changePercent < -1 ? 'down' : 'stable';
      const timeSeries = buildAOVTrendTimeSeries(currentBookings, period);
      const targetAOV = lifetimeAverage > 0 ? Math.round(lifetimeAverage * 1.15) : 0;

      return {
        customerId,
        currentAOV,
        previousAOV,
        change,
        changePercent,
        trend,
        lifetimeAverage,
        highestOrder,
        lowestOrder,
        targetAOV,
        timeSeries,
        aovByCategory,
      };
    }, 300);
  }

  /**
   * Get category distribution for a customer
   */
  async getCategoryDistribution(customerId: string, period: string = '1y'): Promise<CategoryDistribution> {
    const cacheKey = `analytics:customer:${customerId}:category:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);

      // Use aggregation pipeline with $lookup to join categories in a single query
      const bookings = await Booking.aggregate([
        {
          $match: {
            customerId,
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate },
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
        { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'servicecategories',
            localField: 'service.category',
            foreignField: '_id',
            as: 'categoryData',
          },
        },
        {
          $addFields: {
            categoryId: { $arrayElemAt: ['$categoryData._id', 0] },
            categoryName: { $arrayElemAt: ['$categoryData.name', 0] },
            amount: '$pricing.totalAmount',
          },
        },
      ]);

      // Aggregate by category (category data already joined via $lookup)
      const categoryTotals: Record<string, { totalSpent: number; bookingCount: number; name: string }> = {};
      let totalSpent = 0;

      bookings.forEach(booking => {
        const amount = booking.amount || 0;
        totalSpent += amount;

        if (booking.categoryId) {
          const catId = booking.categoryId.toString();
          if (!categoryTotals[catId]) {
            categoryTotals[catId] = { totalSpent: 0, bookingCount: 0, name: booking.categoryName || '' };
          }
          categoryTotals[catId].totalSpent += amount;
          categoryTotals[catId].bookingCount++;
        }
      });

      const categories = Object.entries(categoryTotals).map(([categoryId, data]) => ({
        categoryId,
        categoryName: data.name || 'Unknown',
        totalSpent: data.totalSpent,
        bookingCount: data.bookingCount,
        percentage: totalSpent > 0 ? (data.totalSpent / totalSpent) * 100 : 0,
      })).sort((a, b) => b.totalSpent - a.totalSpent);

      // Calculate diversification (inverse Herfindahl index)
      const diversification = categories.reduce((sum, cat) => {
        const share = cat.percentage / 100;
        return sum + (share * share);
      }, 0);

      const normalizedDiversification = categories.length > 1
        ? (1 - diversification) * 100 / (1 - (1 / categories.length))
        : 100;

      const topCategory = categories[0]?.categoryName || 'N/A';

      const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
      const trendBuckets = new Map<string, Record<string, string | number>>();
      const topCategoryNames = categories.slice(0, 4).map((category) => category.categoryName);

      bookings.forEach((booking) => {
        const createdAt = new Date(booking.createdAt);
        const monthLabel = monthFormatter.format(createdAt);
        const categoryName = booking.categoryName || 'Other';
        if (!topCategoryNames.includes(categoryName)) return;

        const bucket = trendBuckets.get(monthLabel) || { month: monthLabel };
        bucket[categoryName] = (Number(bucket[categoryName] || 0)) + (booking.amount || 0);
        trendBuckets.set(monthLabel, bucket);
      });

      const monthlyTrend = Array.from(trendBuckets.values())
        .sort((a, b) => MONTH_ORDER.indexOf(String(a.month)) - MONTH_ORDER.indexOf(String(b.month)));

      return {
        customerId,
        categories,
        totalSpent,
        diversification: Math.max(0, Math.min(100, normalizedDiversification)),
        topCategory,
        monthlyTrend,
      };
    }, 600);
  }

  /**
   * Get seasonal patterns for a customer
   */
  async getSeasonalPatterns(customerId: string, year?: number): Promise<SeasonalPattern> {
    const targetYear = year || new Date().getFullYear();
    const cacheKey = `analytics:customer:${customerId}:seasonal:${targetYear}`;

    return getCachedData(cacheKey, async () => {
      const startDate = new Date(targetYear, 0, 1);
      const endDate = new Date(targetYear, 11, 31, 23, 59, 59);

      const bookings = await Booking.find({
        customerId,
        status: 'completed',
        createdAt: { $gte: startDate, $lte: endDate },
      }).lean();

      // Aggregate by month
      const monthlyData: Map<string, { bookings: number; spending: number }> = new Map();

      for (let month = 1; month <= 12; month++) {
        monthlyData.set(`${targetYear}-${month}`, { bookings: 0, spending: 0 });
      }

      bookings.forEach(booking => {
        const date = new Date(booking.createdAt);
        const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        const current = monthlyData.get(key) || { bookings: 0, spending: 0 };
        current.bookings++;
        current.spending += booking.pricing?.totalAmount || 0;
        monthlyData.set(key, current);
      });

      const monthly = Array.from(monthlyData.entries()).map(([key, data]) => {
        const [year, month] = key.split('-').map(Number);
        return {
          month,
          year,
          bookings: data.bookings,
          spending: data.spending,
          averageValue: data.bookings > 0 ? data.spending / data.bookings : 0,
          season: getSeason(month),
        };
      });

      // Aggregate seasonal totals
      const seasonalTotals = {
        winter: { bookings: 0, spending: 0 },
        spring: { bookings: 0, spending: 0 },
        summer: { bookings: 0, spending: 0 },
        fall: { bookings: 0, spending: 0 },
      };

      monthly.forEach(data => {
        seasonalTotals[data.season].bookings += data.bookings;
        seasonalTotals[data.season].spending += data.spending;
      });

      // Find peak and slow months
      const monthsWithBookings = monthly.filter(m => m.bookings > 0);
      const peakMonthData = monthsWithBookings.sort((a, b) => b.bookings - a.bookings)[0];
      const slowMonthData = monthsWithBookings.sort((a, b) => a.bookings - b.bookings)[0];

      // Calculate seasonality index
      const avgBookings = monthsWithBookings.reduce((sum, m) => sum + m.bookings, 0) / Math.max(monthsWithBookings.length, 1);
      const seasonalityIndex = avgBookings > 0 && peakMonthData
        ? peakMonthData.bookings / avgBookings
        : 1;

      return {
        customerId,
        monthlyData: monthly,
        seasonalTotals,
        peakMonth: peakMonthData ? { month: peakMonthData.month, year: peakMonthData.year } : { month: 0, year: 0 },
        slowMonth: slowMonthData ? { month: slowMonthData.month, year: slowMonthData.year } : { month: 0, year: 0 },
        seasonalityIndex,
      };
    }, 600);
  }

  /**
   * Clear cache for a customer
   */
  async getReferralAttribution(customerId: string) {
    const cacheKey = `analytics:customer:${customerId}:referral-attribution`;

    return getCachedData(cacheKey, async () => {
      const user = await User.findById(customerId).lean();
      if (!user) {
        throw new Error('Customer not found');
      }

      const referredUsers = await User.find({
        'loyaltySystem.referredBy': customerId,
      }).select('firstName lastName createdAt loyaltySystem.pointsHistory').lean();

      const totalReferralRewards = (user.loyaltySystem?.pointsHistory || [])
        .filter((entry) => entry.type === 'referral')
        .reduce((sum, entry) => sum + entry.amount, 0);

      const successfulReferrals = referredUsers.filter((referredUser) =>
        (referredUser.loyaltySystem?.pointsHistory || []).some((entry) => entry.type === 'referral'),
      );

      const referrals = referredUsers.map((referredUser, index) => {
        const converted = successfulReferrals.some((entry) => entry._id?.toString() === referredUser._id?.toString());
        const rewardEntry = (user.loyaltySystem?.pointsHistory || []).find(
          (entry) => entry.type === 'referral' && entry.relatedBooking,
        );

        return {
          referralId: referredUser._id?.toString() || String(index),
          referrerName: `${referredUser.firstName || ''} ${(referredUser.lastName || '').charAt(0)}.`.trim(),
          referralDate: referredUser.createdAt,
          status: converted ? 'converted' as const : 'pending' as const,
          reward: converted
            ? {
                amount: rewardEntry?.amount || 0,
                type: 'coins',
                claimedAt: rewardEntry?.date,
              }
            : undefined,
        };
      });

      const channelMap = new Map<string, { referrals: number; conversions: number; revenue: number }>();
      referrals.forEach(() => {
        const channel = 'Direct Share';
        const bucket = channelMap.get(channel) || { referrals: 0, conversions: 0, revenue: 0 };
        bucket.referrals += 1;
        channelMap.set(channel, bucket);
      });
      successfulReferrals.forEach(() => {
        const channel = 'Direct Share';
        const bucket = channelMap.get(channel) || { referrals: 0, conversions: 0, revenue: 0 };
        bucket.conversions += 1;
        bucket.revenue += 50;
        channelMap.set(channel, bucket);
      });

      const channelColors = ['#2563EB', '#7C3AED', '#10B981', '#F59E0B', '#EF4444'];
      const channels = Array.from(channelMap.entries()).map(([channel, data], index) => ({
        channel,
        referrals: data.referrals,
        conversions: data.conversions,
        conversionRate: data.referrals > 0 ? Math.round((data.conversions / data.referrals) * 100) : 0,
        revenue: data.revenue,
        color: channelColors[index % channelColors.length],
      }));

      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const referralCode = user.loyaltySystem?.referralCode || '';

      return {
        stats: {
          totalReferrals: referredUsers.length,
          successfulReferrals: successfulReferrals.length,
          pendingReferrals: referredUsers.length - successfulReferrals.length,
          conversionRate: referredUsers.length > 0
            ? Math.round((successfulReferrals.length / referredUsers.length) * 1000) / 10
            : 0,
          totalEarnings: totalReferralRewards,
          referralCode,
          shareUrl: `${clientUrl}/register/customer?ref=${encodeURIComponent(referralCode)}`,
        },
        referrals,
        channels,
      };
    }, 300);
  }

  async clearCache(customerId: string): Promise<void> {
    try {
      const client = cache.client;
      if (!client) return;

      let cursor = 0;

      do {
        const [nextCursor, keys] = await client.scan(
          cursor,
          'MATCH',
          `analytics:customer:${customerId}:*`,
          'COUNT',
          100
        );
        cursor = parseInt(nextCursor, 10);

        if (keys.length > 0) {
          await client.del(...keys);
        }
      } while (cursor !== 0);

      logger.info('Customer analytics cache cleared', { customerId });
    } catch (error) {
      logger.error('Failed to clear customer analytics cache', { error, customerId });
    }
  }
}

export const customerAnalyticsService = new CustomerAnalyticsService();
export default customerAnalyticsService;
