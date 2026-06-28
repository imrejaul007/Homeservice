import Booking from '../models/booking.model';
import User from '../models/user.model';
import { Commission } from '../models/commission.model';
import { cache } from '../config/redis';
import referralGamification from '../automation/referralGamification';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const getDateRange = (period: string): { start: Date; end: Date } => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let start: Date;

  switch (period) {
    case '24h':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case '1y':
      start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    case 'all':
      start = new Date(2020, 0, 1);
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { start, end };
};

const getCachedData = async <T>(key: string, fetchFn: () => Promise<T>, ttl = 300): Promise<T> => {
  try {
    const cached = await cache.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // cache miss
  }

  const data = await fetchFn();

  try {
    await cache.set(key, JSON.stringify(data), ttl);
  } catch {
    // ignore cache write errors
  }

  return data;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const periodToMonths = (period: string): number => {
  switch (period) {
    case '30d':
      return 1;
    case '90d':
      return 3;
    case '1y':
      return 12;
    default:
      return 6;
  }
};

const predictLTV = (totalSpent: number, lifetimeDays: number): number => {
  if (lifetimeDays <= 0) return totalSpent;
  const dailyRate = totalSpent / lifetimeDays;
  return Math.round((totalSpent * 0.7) + (dailyRate * 365 * 0.3));
};

const getLTVSegmentMeta = (segmentId: string) => {
  const segments: Record<string, { segmentName: string; color: string }> = {
    vip: { segmentName: 'VIP Premium', color: '#7C3AED' },
    frequent: { segmentName: 'Frequent Users', color: '#2563EB' },
    regular: { segmentName: 'Regular Users', color: '#10B981' },
    occasional: { segmentName: 'Occasional Users', color: '#F59E0B' },
    at_risk: { segmentName: 'At Risk', color: '#EF4444' },
  };
  return segments[segmentId] || { segmentName: segmentId, color: '#6B7280' };
};

const classifyLTVSegment = (
  totalBookings: number,
  predictedLTV: number,
  daysSinceLastBooking: number,
): string => {
  if (daysSinceLastBooking > 90 || totalBookings <= 1) return 'at_risk';
  if (predictedLTV >= 5000) return 'vip';
  if (totalBookings >= 10) return 'frequent';
  if (totalBookings >= 5) return 'regular';
  return 'occasional';
};

export class AdminAnalyticsService {
  async getPlatformCAC(period = '90d') {
    const cacheKey = `analytics:admin:platform-cac:${period}`;
    return getCachedData(cacheKey, async () => {
      const { start, end } = getDateRange(period);
      const months = periodToMonths(period);
      const now = new Date();
      const monthlyData = [];

      for (let i = months - 1; i >= 0; i -= 1) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

        const [newCustomers, newProviders] = await Promise.all([
          User.countDocuments({
            role: 'customer',
            createdAt: { $gte: monthStart, $lte: monthEnd },
          }),
          User.countDocuments({
            role: 'provider',
            createdAt: { $gte: monthStart, $lte: monthEnd },
          }),
        ]);

        const estimatedSpend = newCustomers * 55 + newProviders * 280;
        const acquisitions = newCustomers + newProviders;
        const customerCAC = newCustomers > 0 ? estimatedSpend * (newCustomers / Math.max(acquisitions, 1)) / newCustomers : 0;
        const providerCAC = newProviders > 0 ? estimatedSpend * (newProviders / Math.max(acquisitions, 1)) / newProviders : 0;

        monthlyData.push({
          month: MONTH_NAMES[monthStart.getMonth()],
          totalSpend: estimatedSpend,
          newCustomers,
          newProviders,
          customerCAC: round2(customerCAC),
          providerCAC: round2(providerCAC),
          blendedCAC: acquisitions > 0 ? round2(estimatedSpend / acquisitions) : 0,
        });
      }

      const latest = monthlyData[monthlyData.length - 1] || {
        customerCAC: 0,
        providerCAC: 0,
        blendedCAC: 0,
        totalSpend: 0,
        newCustomers: 0,
        newProviders: 0,
      };
      const previous = monthlyData[monthlyData.length - 2];
      const cacTrend = previous?.blendedCAC
        ? round2(((latest.blendedCAC - previous.blendedCAC) / previous.blendedCAC) * 100)
        : 0;

      const firstTimeCustomers = await Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: '$customerId',
            firstBookingDate: { $min: '$createdAt' },
          },
        },
        {
          $match: {
            $expr: {
              $and: [
                { $gte: ['$firstBookingDate', start] },
                { $lte: ['$firstBookingDate', end] },
              ],
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'customer',
          },
        },
        { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            referralSource: { $ifNull: ['$customer.referralSource', 'direct'] },
          },
        },
      ]);

      const channelLabels: Record<string, string> = {
        direct: 'Direct',
        organic: 'SEO/Organic',
        referral: 'Referral Program',
        social: 'Social Media',
        paid_ads: 'Google Ads',
        unknown: 'Other',
      };
      const estimatedSpendByChannel: Record<string, number> = {
        direct: 50,
        organic: 10,
        referral: 30,
        social: 80,
        paid_ads: 100,
        unknown: 60,
      };

      const channelMap = new Map<string, { spend: number; acquisitions: number }>();
      for (const customer of firstTimeCustomers) {
        const channel = channelLabels[(customer.referralSource as string) || 'unknown'] || 'Other';
        const existing = channelMap.get(channel) || { spend: 0, acquisitions: 0 };
        const unitSpend = estimatedSpendByChannel[(customer.referralSource as string) || 'unknown'] || 60;
        existing.spend += unitSpend;
        existing.acquisitions += 1;
        channelMap.set(channel, existing);
      }

      const cacByChannel = Array.from(channelMap.entries()).map(([channel, data]) => ({
        channel,
        spend: data.spend,
        acquisitions: data.acquisitions,
        cac: data.acquisitions > 0 ? round2(data.spend / data.acquisitions) : 0,
      }));

      const totalSpend = monthlyData.reduce((sum, row) => sum + row.totalSpend, 0);
      const totalCustomers = monthlyData.reduce((sum, row) => sum + row.newCustomers, 0);
      const totalProviders = monthlyData.reduce((sum, row) => sum + row.newProviders, 0);
      const avgLTV = await this.getAverageCustomerLTV();

      return {
        timeSeries: monthlyData,
        stats: {
          currentCustomerCAC: latest.customerCAC,
          currentProviderCAC: latest.providerCAC,
          currentBlendedCAC: latest.blendedCAC,
          cacTrend,
          totalSpend,
          totalCustomers,
          totalProviders,
          ltvToCacRatio: latest.customerCAC > 0 ? round2(avgLTV / latest.customerCAC) : 0,
          cacByChannel,
        },
        period,
      };
    }, 600);
  }

  private async getAverageCustomerLTV(): Promise<number> {
    const result = await Booking.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: '$customerId',
          totalSpent: { $sum: '$pricing.totalAmount' },
          firstBookingDate: { $min: '$createdAt' },
          lastBookingDate: { $max: '$createdAt' },
        },
      },
      {
        $project: {
          lifetimeDays: {
            $max: [
              1,
              {
                $divide: [
                  { $subtract: ['$lastBookingDate', '$firstBookingDate'] },
                  1000 * 60 * 60 * 24,
                ],
              },
            ],
          },
          totalSpent: 1,
        },
      },
      {
        $project: {
          predictedLTV: {
            $add: [
              { $multiply: ['$totalSpent', 0.7] },
              {
                $multiply: [
                  { $divide: ['$totalSpent', '$lifetimeDays'] },
                  365,
                  0.3,
                ],
              },
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgLTV: { $avg: '$predictedLTV' },
        },
      },
    ]);

    return round2(result[0]?.avgLTV || 0);
  }

  async getLTVBySegment(period = '90d') {
    const cacheKey = `analytics:admin:ltv-by-segment:${period}`;
    return getCachedData(cacheKey, async () => {
      const { start, end } = getDateRange(period);
      const now = Date.now();
      const customerStats = await Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: start, $lte: end },
          },
        },
        {
          $group: {
            _id: '$customerId',
            totalBookings: { $sum: 1 },
            totalSpent: { $sum: '$pricing.totalAmount' },
            firstBookingDate: { $min: '$createdAt' },
            lastBookingDate: { $max: '$createdAt' },
          },
        },
      ]);

      const segmentBuckets: Record<string, {
        userCount: number;
        totalLTV: number;
        totalOrders: number;
        totalSpent: number;
        churnCount: number;
      }> = {
        vip: { userCount: 0, totalLTV: 0, totalOrders: 0, totalSpent: 0, churnCount: 0 },
        frequent: { userCount: 0, totalLTV: 0, totalOrders: 0, totalSpent: 0, churnCount: 0 },
        regular: { userCount: 0, totalLTV: 0, totalOrders: 0, totalSpent: 0, churnCount: 0 },
        occasional: { userCount: 0, totalLTV: 0, totalOrders: 0, totalSpent: 0, churnCount: 0 },
        at_risk: { userCount: 0, totalLTV: 0, totalOrders: 0, totalSpent: 0, churnCount: 0 },
      };

      for (const customer of customerStats) {
        const lifetimeDays = Math.max(
          1,
          (new Date(customer.lastBookingDate).getTime() - new Date(customer.firstBookingDate).getTime())
            / (1000 * 60 * 60 * 24),
        );
        const predictedLTV = predictLTV(customer.totalSpent, lifetimeDays);
        const daysSinceLastBooking = (now - new Date(customer.lastBookingDate).getTime()) / (1000 * 60 * 60 * 24);
        const segmentId = classifyLTVSegment(customer.totalBookings, predictedLTV, daysSinceLastBooking);
        const bucket = segmentBuckets[segmentId];
        bucket.userCount += 1;
        bucket.totalLTV += predictedLTV;
        bucket.totalOrders += customer.totalBookings;
        bucket.totalSpent += customer.totalSpent;
        if (daysSinceLastBooking > 90) bucket.churnCount += 1;
      }

      const segments = Object.entries(segmentBuckets).map(([segmentId, bucket]) => {
        const meta = getLTVSegmentMeta(segmentId);
        return {
          segmentId,
          segmentName: meta.segmentName,
          userCount: bucket.userCount,
          avgLTV: bucket.userCount > 0 ? round2(bucket.totalLTV / bucket.userCount) : 0,
          totalLTV: round2(bucket.totalLTV),
          avgOrders: bucket.userCount > 0 ? round2(bucket.totalOrders / bucket.userCount) : 0,
          avgOrderValue: bucket.totalOrders > 0 ? round2(bucket.totalSpent / bucket.totalOrders) : 0,
          churnRate: bucket.userCount > 0 ? round2((bucket.churnCount / bucket.userCount) * 100) : 0,
          growth: 0,
        };
      }).filter((segment) => segment.userCount > 0)
        .sort((a, b) => b.avgLTV - a.avgLTV);

      const totalUsers = segments.reduce((sum, segment) => sum + segment.userCount, 0);
      const totalLTV = segments.reduce((sum, segment) => sum + segment.totalLTV, 0);

      return {
        segments,
        stats: {
          totalUsers,
          avgLTV: totalUsers > 0 ? round2(totalLTV / totalUsers) : 0,
          totalLTV: round2(totalLTV),
          topSegment: segments[0]?.segmentName || 'N/A',
          fastestGrowingSegment: segments[0]?.segmentName || 'N/A',
          segments,
        },
        period,
      };
    }, 600);
  }

  async getViralCoefficient(period = '30d') {
    const cacheKey = `analytics:admin:viral-coefficient:${period}`;
    return getCachedData(cacheKey, async () => {
      const { start, end } = getDateRange(period);
      const ReferralGamification = referralGamification.ReferralGamification;

      const referrals = await ReferralGamification.find({
        createdAt: { $gte: start, $lte: end },
      }).lean();

      const bucketSize = period === '7d' ? 'day' : 'week';
      const buckets = new Map<string, {
        invitesSent: number;
        invitesAccepted: number;
        viralReach: number;
      }>();

      referrals.forEach((referral) => {
        const createdAt = new Date(referral.createdAt);
        const key = bucketSize === 'day'
          ? DAY_NAMES[createdAt.getDay()]
          : `Week ${Math.ceil(createdAt.getDate() / 7)}`;
        const bucket = buckets.get(key) || { invitesSent: 0, invitesAccepted: 0, viralReach: 0 };
        bucket.invitesSent += 1;
        if (['completed', 'rewarded'].includes(referral.status)) {
          bucket.invitesAccepted += 1;
          bucket.viralReach += 1;
        }
        buckets.set(key, bucket);
      });

      const timeSeries = Array.from(buckets.entries()).map(([date, bucket]) => {
        const conversionRate = bucket.invitesSent > 0
          ? round2((bucket.invitesAccepted / bucket.invitesSent) * 100)
          : 0;
        const kFactor = bucket.invitesSent > 0
          ? round2(bucket.invitesAccepted / bucket.invitesSent)
          : 0;
        return {
          date,
          kFactor,
          invitesSent: bucket.invitesSent,
          invitesAccepted: bucket.invitesAccepted,
          conversionRate,
          viralReach: bucket.viralReach,
        };
      });

      const totalInvites = referrals.length;
      const totalAccepted = referrals.filter((r) => ['completed', 'rewarded'].includes(r.status)).length;
      const [viralStats, newUsers] = await Promise.all([
        referralGamification.calculateViralCoefficient(),
        User.countDocuments({ role: 'customer', createdAt: { $gte: start, $lte: end } }),
      ]);

      const organicUsers = Math.max(newUsers - totalAccepted, 0);

      return {
        timeSeries,
        stats: {
          currentK: viralStats.coefficient,
          targetK: 0.7,
          avgInvitesPerUser: totalAccepted > 0 ? round2(totalInvites / totalAccepted) : 0,
          avgConversionRate: totalInvites > 0 ? round2((totalAccepted / totalInvites) * 100) : 0,
          totalViralUsers: totalAccepted,
          viralGrowth: newUsers > 0 ? round2((totalAccepted / newUsers) * 100) : 0,
          organicGrowth: newUsers > 0 ? round2((organicUsers / newUsers) * 100) : 0,
          networkEffect: round2(viralStats.coefficient * 0.6),
        },
        period,
      };
    }, 300);
  }

  async getTakeRate(period = '30d') {
    const cacheKey = `analytics:admin:take-rate:${period}`;
    return getCachedData(cacheKey, async () => {
      const { start, end } = getDateRange(period);
      const commissions = await Commission.find({
        createdAt: { $gte: start, $lte: end },
        status: { $ne: 'cancelled' },
      }).lean();

      const bucketLabels = period === '7d'
        ? DAY_NAMES
        : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
      const bucketData = Object.fromEntries(
        bucketLabels.map((label) => [label, {
          grossRevenue: 0,
          netRevenue: 0,
          platformRevenue: 0,
          transactionCount: 0,
        }]),
      );

      commissions.forEach((record) => {
        const createdAt = new Date(record.createdAt);
        let label: string;
        if (period === '7d') {
          label = DAY_NAMES[createdAt.getDay()];
        } else {
          const weekIndex = Math.min(3, Math.floor((createdAt.getDate() - 1) / 7));
          label = `Week ${weekIndex + 1}`;
        }

        const bucket = bucketData[label];
        if (!bucket) return;

        const grossRevenue = record.grossAmount || 0;
        const platformRevenue = (record.commissionAmount || 0) + (record.platformFee || 0);
        bucket.grossRevenue += grossRevenue;
        bucket.netRevenue += record.providerEarnings || 0;
        bucket.platformRevenue += platformRevenue;
        bucket.transactionCount += 1;
      });

      const timeSeries = bucketLabels.map((date) => {
        const bucket = bucketData[date];
        const takeRate = bucket.grossRevenue > 0
          ? round2((bucket.platformRevenue / bucket.grossRevenue) * 100)
          : 0;
        return {
          date,
          grossRevenue: round2(bucket.grossRevenue),
          netRevenue: round2(bucket.netRevenue),
          platformRevenue: round2(bucket.platformRevenue),
          takeRate,
          transactionCount: bucket.transactionCount,
        };
      });

      const grossRevenue = timeSeries.reduce((sum, row) => sum + row.grossRevenue, 0);
      const platformRevenue = timeSeries.reduce((sum, row) => sum + row.platformRevenue, 0);
      const totalTransactions = timeSeries.reduce((sum, row) => sum + row.transactionCount, 0);
      const currentTakeRate = grossRevenue > 0 ? round2((platformRevenue / grossRevenue) * 100) : 0;

      const byCategoryAgg = await Commission.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lte: end },
            status: { $ne: 'cancelled' },
          },
        },
        {
          $lookup: {
            from: 'servicecategories',
            localField: 'categoryId',
            foreignField: '_id',
            as: 'category',
          },
        },
        { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: '$category.name',
            grossRevenue: { $sum: '$grossAmount' },
            platformRevenue: {
              $sum: { $add: ['$commissionAmount', '$platformFee'] },
            },
          },
        },
        { $sort: { grossRevenue: -1 } },
        { $limit: 5 },
      ]);

      const byCategory = byCategoryAgg.map((row) => ({
        category: row._id || 'Uncategorized',
        grossRevenue: round2(row.grossRevenue || 0),
        takeRate: row.grossRevenue > 0
          ? round2((row.platformRevenue / row.grossRevenue) * 100)
          : 0,
      }));

      return {
        timeSeries,
        stats: {
          currentTakeRate,
          targetTakeRate: 25,
          grossRevenue: round2(grossRevenue),
          platformRevenue: round2(platformRevenue),
          totalTransactions,
          avgTransactionValue: totalTransactions > 0 ? round2(grossRevenue / totalTransactions) : 0,
          takeRateTrend: 0,
          byCategory,
        },
        period,
      };
    }, 120);
  }

  async getMarketplaceVelocity(period = '24h') {
    const cacheKey = `analytics:admin:marketplace-velocity:${period}`;
    return getCachedData(cacheKey, async () => {
      const { start, end } = getDateRange(period);
      const bookings = await Booking.find({
        createdAt: { $gte: start, $lte: end },
      }).lean();

      const bucketCount = period === '24h' ? 6 : period === '7d' ? 7 : 6;
      const bucketMs = (end.getTime() - start.getTime()) / bucketCount;
      const buckets = Array.from({ length: bucketCount }, (_, index) => ({
        timestamp: period === '24h'
          ? `${String(index * 4).padStart(2, '0')}:00`
          : period === '7d'
            ? DAY_NAMES[(start.getDay() + index) % 7]
            : `Week ${index + 1}`,
        bookings: 0,
        revenue: 0,
        newUsers: 0,
        transactions: 0,
        start: new Date(start.getTime() + index * bucketMs),
        end: new Date(start.getTime() + (index + 1) * bucketMs),
      }));

      bookings.forEach((booking) => {
        const createdAt = new Date(booking.createdAt).getTime();
        const bucket = buckets.find((item) => createdAt >= item.start.getTime() && createdAt < item.end.getTime());
        if (!bucket) return;
        bucket.bookings += 1;
        bucket.revenue += booking.pricing?.totalAmount || 0;
        if (booking.status === 'completed') bucket.transactions += 1;
      });

      const newUsers = await User.find({
        createdAt: { $gte: start, $lte: end },
      }).select('createdAt').lean();

      newUsers.forEach((user) => {
        const createdAt = new Date(user.createdAt).getTime();
        const bucket = buckets.find((item) => createdAt >= item.start.getTime() && createdAt < item.end.getTime());
        if (bucket) bucket.newUsers += 1;
      });

      const timeSeries = buckets.map(({ timestamp, bookings: bookingCount, revenue, newUsers: users, transactions }) => ({
        timestamp,
        bookings: bookingCount,
        revenue: round2(revenue),
        newUsers: users,
        transactions,
      }));

      const totalBookings = timeSeries.reduce((sum, row) => sum + row.bookings, 0);
      const totalRevenue = timeSeries.reduce((sum, row) => sum + row.revenue, 0);
      const durationHours = Math.max((end.getTime() - start.getTime()) / (1000 * 60 * 60), 1);
      const currentTPS = round2(totalBookings / (durationHours * 3600));
      const peakTPS = round2(Math.max(...timeSeries.map((row) => row.bookings), 0) / 3600);

      const [totalUsers, activeProviders] = await Promise.all([
        User.countDocuments({ role: 'customer' }),
        User.countDocuments({ role: 'provider', isActive: true }),
      ]);

      return {
        timeSeries,
        stats: {
          currentTPS,
          peakTPS,
          avgResponseTime: 0,
          totalBookings,
          totalRevenue: round2(totalRevenue),
          totalUsers,
          activeProviders,
          growth: 0,
        },
        period,
      };
    }, 60);
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
export default adminAnalyticsService;
