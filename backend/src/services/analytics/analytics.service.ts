import Booking from '../../models/booking.model';
import User from '../../models/user.model';
import Service from '../../models/service.model';
import ServiceCategory from '../../models/serviceCategory.model';
import logger from '../../utils/logger';
import { cache } from '../../config/redis';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

interface BookingAnalytics {
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
  completionRate: number;
  cancellationRate: number;
}

interface ProviderAnalytics {
  totalProviders: number;
  activeProviders: number;
  newProvidersThisMonth: number;
  topRatedProviders: Array<{
    id: string;
    name: string;
    rating: number;
    totalBookings: number;
  }>;
  providersByStatus: {
    pending: number;
    approved: number;
    rejected: number;
    suspended: number;
  };
}

interface CustomerAnalytics {
  totalCustomers: number;
  activeCustomers: number;
  newCustomersThisMonth: number;
  returningCustomers: number;
  topCustomers: Array<{
    id: string;
    name: string;
    totalBookings: number;
    totalSpent: number;
  }>;
}

interface RevenueAnalytics {
  totalRevenue: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  monthOverMonthGrowth: number;
  revenueByDay: Array<{
    date: string;
    revenue: number;
    bookings: number;
  }>;
  revenueByCategory: Array<{
    category: string;
    revenue: number;
    percentage: number;
  }>;
  averageOrderValue: number;
  projectedMonthlyRevenue: number;
}

interface ServiceAnalytics {
  totalServices: number;
  activeServices: number;
  topServices: Array<{
    id: string;
    title: string;
    bookings: number;
    revenue: number;
    rating: number;
  }>;
  servicesByCategory: Array<{
    name: string; // FIX: Changed from 'category' to 'name' to match frontend expectations
    count: number;
    percentage: number;
  }>;
}

// Helper to get date range
const getDateRange = (period: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all'): DateRange => {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let startDate: Date;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    case 'all':
    default:
      startDate = new Date(0); // Beginning of time
      break;
  }

  return { startDate, endDate };
};

// Cache helper
const getCached = async <T>(key: string, fetchFn: () => Promise<T>, ttl = 300): Promise<T> => {
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

// Booking Analytics
export const getBookingAnalytics = async (period: string = 'month'): Promise<BookingAnalytics> => {
  const cacheKey = `analytics:bookings:${period}`;
  const ttl = 300; // 5 minutes

  return getCached(cacheKey, async () => {
    const { startDate, endDate } = getDateRange(period as any);

    const matchStage = {
      createdAt: { $gte: startDate, $lte: endDate },
    };

    const [stats, completedStats] = await Promise.all([
      Booking.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalBookings: { $sum: 1 },
            totalRevenue: { $sum: '$pricing.totalAmount' },
          },
        },
      ]),
      Booking.aggregate([
        { $match: { ...matchStage, status: 'completed' } },
        {
          $group: {
            _id: null,
            completed: { $sum: 1 },
            revenue: { $sum: '$pricing.totalAmount' },
          },
        },
      ]),
    ]);

    const [cancelledCount, pendingCount] = await Promise.all([
      Booking.countDocuments({ ...matchStage, status: 'cancelled' }),
      Booking.countDocuments({ ...matchStage, status: 'pending' }),
    ]);

    const totalBookings = stats[0]?.totalBookings || 0;
    const completedBookings = completedStats[0]?.completed || 0;
    const totalRevenue = stats[0]?.totalRevenue || 0;

    return {
      totalBookings,
      completedBookings,
      cancelledBookings: cancelledCount,
      pendingBookings: pendingCount,
      totalRevenue,
      averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
      completionRate: totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0,
      cancellationRate: totalBookings > 0 ? (cancelledCount / totalBookings) * 100 : 0,
    };
  }, ttl);
};

// Provider Analytics
export const getProviderAnalytics = async (): Promise<ProviderAnalytics> => {
  const cacheKey = 'analytics:providers';
  const ttl = 600; // 10 minutes

  return getCached(cacheKey, async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalProviders, providersByRole] = await Promise.all([
      User.countDocuments({ role: 'provider' }),
      User.aggregate([
        { $match: { role: 'provider' } },
        {
          $lookup: {
            from: 'providerprofiles',
            localField: '_id',
            foreignField: 'userId',
            as: 'profile',
          },
        },
        { $unwind: '$profile' },
        {
          $group: {
            _id: '$profile.verificationStatus',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const providersByStatus = {
      pending: 0,
      approved: 0,
      rejected: 0,
      suspended: 0,
    };

    providersByRole.forEach((group: any) => {
      if (group._id === 'pending') providersByStatus.pending = group.count;
      else if (group._id === 'approved') providersByStatus.approved = group.count;
      else if (group._id === 'rejected') providersByStatus.rejected = group.count;
      else if (group._id === 'suspended') providersByStatus.suspended = group.count;
    });

    const [newProviders, topRated] = await Promise.all([
      User.countDocuments({
        role: 'provider',
        createdAt: { $gte: startOfMonth },
      }),
      User.aggregate([
        { $match: { role: 'provider' } },
        {
          $lookup: {
            from: 'services',
            localField: '_id',
            foreignField: 'provider',
            as: 'services',
          },
        },
        { $unwind: '$services' },
        {
          $group: {
            _id: '$_id',
            name: { $first: '$firstName' },
            rating: { $avg: '$services.rating.average' },
            totalBookings: { $sum: '$services.totalBookings' },
          },
        },
        { $sort: { rating: -1 } },
        { $limit: 10 },
      ]),
    ]);

    return {
      totalProviders,
      activeProviders: providersByStatus.approved,
      newProvidersThisMonth: newProviders,
      topRatedProviders: topRated.map((p: any) => ({
        id: p._id.toString(),
        name: `${p.name}`,
        rating: p.rating || 0,
        totalBookings: p.totalBookings || 0,
      })),
      providersByStatus,
    };
  }, ttl);
};

// Customer Analytics
export const getCustomerAnalytics = async (): Promise<CustomerAnalytics> => {
  const cacheKey = 'analytics:customers';
  const ttl = 600;

  return getCached(cacheKey, async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalCustomers, newCustomers, topCustomers] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({
        role: 'customer',
        createdAt: { $gte: startOfMonth },
      }),
      Booking.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$customerId',
            totalBookings: { $sum: 1 },
            totalSpent: { $sum: '$pricing.totalAmount' },
          },
        },
        { $sort: { totalSpent: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
      ]),
    ]);

    const activeCustomers = await User.countDocuments({
      role: 'customer',
      updatedAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
    });

    return {
      totalCustomers,
      activeCustomers,
      newCustomersThisMonth: newCustomers,
      returningCustomers: totalCustomers - newCustomers,
      topCustomers: topCustomers.map((c: any) => ({
        id: c._id.toString(),
        name: `${c.user.firstName} ${c.user.lastName}`,
        totalBookings: c.totalBookings,
        totalSpent: c.totalSpent,
      })),
    };
  }, ttl);
};

// Revenue Analytics
export const getRevenueAnalytics = async (period: string = 'month'): Promise<RevenueAnalytics> => {
  const cacheKey = `analytics:revenue:${period}`;
  const ttl = 300;

  return getCached(cacheKey, async () => {
    const { startDate, endDate } = getDateRange(period as any);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    const [
      totalRevenue,
      revenueThisMonth,
      revenueLastMonth,
      revenueByDay,
      revenueByCategory,
    ] = await Promise.all([
      Booking.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startDate } } },
        { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startOfMonth, $lte: endDate },
          },
        },
        { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
          },
        },
        { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            revenue: { $sum: '$pricing.totalAmount' },
            bookings: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Booking.aggregate([
        { $match: { status: 'completed', createdAt: { $gte: startDate } } },
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
        { $unwind: '$category' },
        {
          $group: {
            _id: '$category.name',
            revenue: { $sum: '$pricing.totalAmount' },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
    ]);

    const totalRev = totalRevenue[0]?.total || 0;
    const thisMonth = revenueThisMonth[0]?.total || 0;
    const lastMonth = revenueLastMonth[0]?.total || 0;
    const monthOverMonthGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    const bookingsThisMonth = await Booking.countDocuments({
      status: 'completed',
      createdAt: { $gte: startOfMonth, $lte: endDate },
    });

    const daysInMonth = now.getDate();
    const projectedMonthlyRevenue = thisMonth * (30 / daysInMonth);

    return {
      totalRevenue: totalRev,
      revenueThisMonth: thisMonth,
      revenueLastMonth: lastMonth,
      monthOverMonthGrowth,
      revenueByDay: revenueByDay.map((d: any) => ({
        date: d._id,
        revenue: d.revenue,
        bookings: d.bookings,
      })),
      revenueByCategory: revenueByCategory.map((c: any) => ({
        category: c._id,
        revenue: c.revenue,
        percentage: totalRev > 0 ? (c.revenue / totalRev) * 100 : 0,
      })),
      averageOrderValue: bookingsThisMonth > 0 ? thisMonth / bookingsThisMonth : 0,
      projectedMonthlyRevenue,
    };
  }, ttl);
};

// Service Analytics
export const getServiceAnalytics = async (): Promise<ServiceAnalytics> => {
  const cacheKey = 'analytics:services';
  const ttl = 600;

  return getCached(cacheKey, async () => {
    const [totalServices, topServices, servicesByCategory] = await Promise.all([
      Service.countDocuments({ isActive: true }),
      Service.aggregate([
        { $match: { isActive: true } },
        { $sort: { totalBookings: -1 } },
        { $limit: 10 },
      ]),
      ServiceCategory.aggregate([
        {
          $lookup: {
            from: 'services',
            localField: '_id',
            foreignField: 'category',
            as: 'services',
          },
        },
        {
          $group: {
            _id: '$_id',
            name: { $first: '$name' },
            count: { $sum: { $size: '$services' } },
          },
        },
        { $sort: { count: -1 } },
      ]),
    ]);

    const totalServiceCount = servicesByCategory.reduce((acc: number, c: any) => acc + c.count, 0);

    return {
      totalServices,
      activeServices: totalServices,
      topServices: topServices.map((s: any) => ({
        id: s._id.toString(),
        title: s.title,
        bookings: s.totalBookings || 0,
        revenue: s.pricing?.basePrice || 0,
        rating: s.rating?.average || 0,
      })),
      servicesByCategory: servicesByCategory.map((c: any) => ({
        name: c.name, // FIX: Changed from 'category' to 'name' to match frontend expectations
        count: c.count,
        percentage: totalServiceCount > 0 ? (c.count / totalServiceCount) * 100 : 0,
      })),
    };
  }, ttl);
};

// Clear analytics cache
export const clearAnalyticsCache = async (): Promise<void> => {
  try {
    const keys = await cache.keys('analytics:*');
    if (keys.length > 0) {
      await cache.del(...keys);
    }
    logger.info('Analytics cache cleared', {
      keysDeleted: keys.length,
      action: 'ANALYTICS_CACHE_CLEARED',
    });
  } catch (error) {
    logger.error('Failed to clear analytics cache', { error });
  }
};

export default {
  getBookingAnalytics,
  getProviderAnalytics,
  getCustomerAnalytics,
  getRevenueAnalytics,
  getServiceAnalytics,
  clearAnalyticsCache,
};
