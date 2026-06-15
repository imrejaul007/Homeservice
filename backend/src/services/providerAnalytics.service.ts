import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import User from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import ProviderAd from '../models/providerAd.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';
import geolocationService from './geolocation.service';
import {
  BOOKING_ATTRIBUTION_SOURCES,
  BookingAttributionSource,
  buildAdAttributedBookingFilter,
  resolveStoredAttributionSource,
} from '../utils/bookingAttribution';
import {
  geographicLookupStages,
  resolvedCityAggregationField,
} from '../utils/bookingLocation.util';

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

export interface ROASChartPoint {
  date: string;
  adSpend: number;
  revenue: number;
  bookings: number;
  roas: number;
  cpc: number;
  impressions: number;
  clicks: number;
}

export interface ROASStats {
  totalAdSpend: number;
  totalRevenue: number;
  overallROAS: number;
  averageROAS: number;
  totalBookings: number;
  costPerBooking: number;
  bestCampaign: string;
  worstCampaign: string;
  targetROAS: number;
}

export interface ROASCampaign {
  name: string;
  spend: number;
  revenue: number;
  roas: number;
  status: 'active' | 'paused';
}

export interface ROASMetricsData {
  providerId: string;
  roasData: ROASChartPoint[];
  stats: ROASStats;
  campaigns: ROASCampaign[];
}

/** @deprecated Use ROASMetricsData — kept as alias for route imports */
export type ROASData = ROASMetricsData;

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
  reviews?: number;
  marketShare?: number;
  trend?: number;
}

export interface BookingSourceAttributionRow {
  source: BookingAttributionSource;
  bookings: number;
  completedBookings: number;
  revenue: number;
}

export interface BookingSourceAttributionData {
  providerId: string;
  period: string;
  startDate: string;
  endDate: string;
  totalBookings: number;
  totalCompletedBookings: number;
  totalRevenue: number;
  bySource: BookingSourceAttributionRow[];
}

export interface RepeatCustomerTrendPoint {
  month: string;
  newCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
}

export interface RepeatCustomerCohort {
  cohort: string;
  month1: number;
  month2: number;
  month3: number;
  month6: number;
}

export interface RepeatCustomerData {
  providerId: string;
  repeatRate: number;
  totalCustomers: number;
  repeatCustomers: number;
  newCustomers: number;
  trendData: RepeatCustomerTrendPoint[];
  cohortData: RepeatCustomerCohort[];
}

export interface ProviderLTVData {
  providerId: string;
  period: string;
  totalCustomers: number;
  avgRevenuePerCustomer: number;
  totalLTV: number;
  avgBookingsPerCustomer: number;
  topCustomers: Array<{
    customerId: string;
    totalSpent: number;
    bookingCount: number;
  }>;
}

export interface RevenueForecastPoint {
  date: string;
  predicted: number;
  lowerBound: number;
  upperBound: number;
}

export interface RevenueForecastData {
  providerId: string;
  period: string;
  historicalDaily: Array<{ date: string; revenue: number }>;
  forecast7d: RevenueForecastPoint[];
  forecast30d: RevenueForecastPoint[];
  projectedRevenue7d: number;
  projectedRevenue30d: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

export interface GeographicDemandEntry {
  city: string;
  emirate: string;
  bookings: number;
  revenue: number;
  avgBookingValue: number;
  share: number;
}

export interface GeographicDemandData {
  providerId: string;
  period: string;
  locations: GeographicDemandEntry[];
  totalBookings: number;
  totalRevenue: number;
}

export interface ResponseTimeMetricsData {
  providerId: string;
  period: string;
  avgResponseTimeMinutes: number;
  medianResponseTimeMinutes: number;
  p95ResponseTimeMinutes: number;
  sampleSize: number;
  targetMinutes: number;
  compliant: boolean;
  profileAvgResponseTimeMinutes: number;
  trend: 'improving' | 'stable' | 'declining';
}

export interface ProviderAnomalyAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  metric?: string;
  detectedAt: string;
}

export interface TravelDataPoint {
  date: string;
  totalTravelTime: number;
  avgTravelTime: number;
  totalDistance: number;
  bookings: number;
  efficiency: number;
}

export interface TravelStats {
  totalTravelTime: number;
  avgTravelTime: number;
  totalDistance: number;
  avgDistance: number;
  fuelCost: number;
  mostRemoteJob: string;
  leastEfficient: string;
  potentialSavings: number;
  efficiency: number;
}

export interface JobsByArea {
  area: string;
  jobs: number;
  avgTravel: number;
  avgDistance: number;
}

export interface ProviderTravelMetrics {
  providerId: string;
  period: string;
  travelData: TravelDataPoint[];
  stats: TravelStats;
  jobsByArea: JobsByArea[];
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
    case '1y':
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return { startDate, endDate };
};

const round2 = (value: number): number => Math.round(value * 100) / 100;

const monthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const formatMonthLabel = (key: string): string => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  });
};

const addMonths = (key: string, offset: number): string => {
  const [year, month] = key.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return monthKey(date);
};

const getTrendMonthCount = (period: string): number => {
  if (period === '1y') return 12;
  if (period === '90d') return 9;
  return 6;
};

const linearForecast = (
  dailyValues: number[],
  forecastDays: number,
): RevenueForecastPoint[] => {
  if (dailyValues.length === 0) {
    return Array.from({ length: forecastDays }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index + 1);
      return {
        date: date.toISOString().split('T')[0],
        predicted: 0,
        lowerBound: 0,
        upperBound: 0,
      };
    });
  }

  const n = dailyValues.length;
  const avg =
    dailyValues.reduce((sum, value) => sum + value, 0) / Math.max(n, 1);
  const recentAvg =
    dailyValues.slice(-7).reduce((sum, value) => sum + value, 0) /
    Math.max(Math.min(7, n), 1);

  let slope = 0;
  if (n >= 2) {
    const xMean = (n - 1) / 2;
    const yMean = avg;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (dailyValues[i] - yMean);
      denominator += (i - xMean) ** 2;
    }
    slope = denominator > 0 ? numerator / denominator : 0;
  }

  const base = recentAvg > 0 ? recentAvg : avg;

  return Array.from({ length: forecastDays }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index + 1);
    const predicted = Math.max(0, base + slope * (index + 1));
    return {
      date: date.toISOString().split('T')[0],
      predicted: round2(predicted),
      lowerBound: round2(predicted * 0.85),
      upperBound: round2(predicted * 1.15),
    };
  });
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
      const providerObjectId = new mongoose.Types.ObjectId(providerId);

      const bookings = await Booking.find({
        providerId: providerObjectId,
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
          name: service.title || service.name || 'Unknown Service',
          categoryId: service.category?.toString() || '',
          categoryName: '',
          rating: service.rating?.average || 0,
        };

        current.revenue += booking.pricing?.totalAmount || 0;
        current.bookings++;
        serviceData.set(serviceId, current);
      });

      // Get category names (skip empty/invalid ids — avoids CastError → 400)
      const categoryIds = [
        ...new Set(
          Array.from(serviceData.values())
            .map((s) => s.categoryId)
            .filter((id) => id && mongoose.Types.ObjectId.isValid(id)),
        ),
      ];
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
   * Returns frontend-compatible shape: roasData, stats, campaigns
   */
  async getROAS(providerId: string, period: string = '30d'): Promise<ROASMetricsData> {
    const cacheKey = `analytics:provider:${providerId}:roas:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);
      const providerObjectId = new mongoose.Types.ObjectId(providerId);

      const ads = await ProviderAd.find({
        providerId: providerObjectId,
        status: { $in: ['active', 'paused', 'completed'] },
      }).lean();

      const dailyAdSpend: Map<string, { spend: number; impressions: number; clicks: number }> = new Map();
      let periodAdSpend = 0;

      for (const ad of ads) {
        const dailyStats = ad.statistics?.dailyStats || [];
        for (const stat of dailyStats) {
          const statDate = new Date(stat.date);
          if (statDate < startDate || statDate > endDate) continue;

          const dateStr = statDate.toISOString().split('T')[0];
          const current = dailyAdSpend.get(dateStr) || { spend: 0, impressions: 0, clicks: 0 };
          current.spend += stat.spent || 0;
          current.impressions += stat.views || 0;
          current.clicks += stat.clicks || 0;
          dailyAdSpend.set(dateStr, current);
          periodAdSpend += stat.spent || 0;
        }
      }

      const adAttributedBookings = await Booking.find({
        ...buildAdAttributedBookingFilter(providerObjectId),
        completedAt: { $gte: startDate, $lte: endDate },
      })
        .select('pricing.totalAmount completedAt attribution.adCampaignId')
        .lean();

      const dailyRevenue: Map<string, { revenue: number; bookings: number }> = new Map();
      const campaignRevenue: Map<string, number> = new Map();
      let totalRevenueFromAds = 0;

      for (const booking of adAttributedBookings) {
        const revenue = booking.pricing?.totalAmount || 0;
        totalRevenueFromAds += revenue;

        const completedAt = booking.completedAt ? new Date(booking.completedAt) : null;
        if (completedAt) {
          const dateStr = completedAt.toISOString().split('T')[0];
          const current = dailyRevenue.get(dateStr) || { revenue: 0, bookings: 0 };
          current.revenue += revenue;
          current.bookings += 1;
          dailyRevenue.set(dateStr, current);
        }

        const campaignId = booking.attribution?.adCampaignId?.toString();
        if (campaignId) {
          campaignRevenue.set(campaignId, (campaignRevenue.get(campaignId) || 0) + revenue);
        }
      }

      const adConversionCount = adAttributedBookings.length;
      const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) || 1;
      const dailyData: Array<{ date: string; spend: number; revenue: number; bookings: number; roas: number; impressions: number; clicks: number }> = [];

      for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        const spendEntry = dailyAdSpend.get(dateStr) || { spend: 0, impressions: 0, clicks: 0 };
        const revenueEntry = dailyRevenue.get(dateStr) || { revenue: 0, bookings: 0 };
        const spend = spendEntry.spend;
        const revenue = revenueEntry.revenue;
        const dailyROAS = spend > 0 ? revenue / spend : 0;

        dailyData.push({
          date: dateStr,
          spend: Math.round(spend * 100) / 100,
          revenue: Math.round(revenue * 100) / 100,
          bookings: revenueEntry.bookings,
          roas: Math.round(dailyROAS * 100) / 100,
          impressions: spendEntry.impressions,
          clicks: spendEntry.clicks,
        });
      }

      const roundedAdSpend = Math.round(periodAdSpend * 100) / 100;
      const roundedRevenue = Math.round(totalRevenueFromAds * 100) / 100;
      const overallROAS = roundedAdSpend > 0 ? roundedRevenue / roundedAdSpend : 0;

      const campaigns: ROASCampaign[] = ads.map((ad) => {
        const spend = Math.round((ad.budget?.spent || 0) * 100) / 100;
        const revenue = Math.round((campaignRevenue.get(ad._id.toString()) || 0) * 100) / 100;
        const roas = spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0;
        const status: 'active' | 'paused' = ad.status === 'active' ? 'active' : 'paused';
        return { name: ad.name || 'Unnamed campaign', spend, revenue, roas, status };
      });

      const roasData: ROASChartPoint[] = dailyData.map((d) => ({
        date: d.date,
        adSpend: d.spend,
        revenue: d.revenue,
        bookings: d.bookings,
        roas: d.roas,
        cpc: d.clicks > 0 ? Math.round((d.spend / d.clicks) * 100) / 100 : 0,
        impressions: d.impressions,
        clicks: d.clicks,
      }));

      const nonZeroRoasDays = dailyData.filter((d) => d.roas > 0);
      const averageROAS = nonZeroRoasDays.length > 0
        ? Math.round(
            (nonZeroRoasDays.reduce((sum, d) => sum + d.roas, 0) / nonZeroRoasDays.length) * 100,
          ) / 100
        : 0;

      const sortedCampaigns = [...campaigns].sort((a, b) => b.roas - a.roas);

      const stats: ROASStats = {
        totalAdSpend: roundedAdSpend,
        totalRevenue: roundedRevenue,
        overallROAS: Math.round(overallROAS * 100) / 100,
        averageROAS,
        totalBookings: adConversionCount,
        costPerBooking:
          adConversionCount > 0
            ? Math.round((roundedAdSpend / adConversionCount) * 100) / 100
            : 0,
        bestCampaign: sortedCampaigns[0]?.name || '',
        worstCampaign: sortedCampaigns[sortedCampaigns.length - 1]?.name || '',
        targetROAS: 5.0,
      };

      return {
        providerId,
        roasData,
        stats,
        campaigns,
      };
    }, 300);
  }

  /**
   * Breakdown of bookings and revenue by attribution source for a provider.
   */
  async getBookingSourceAttribution(
    providerId: string,
    period: string = '30d',
  ): Promise<BookingSourceAttributionData> {
    const cacheKey = `analytics:provider:${providerId}:source-attribution:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);
      const providerObjectId = new mongoose.Types.ObjectId(providerId);

      const bookings = await Booking.find({
        providerId: providerObjectId,
        createdAt: { $gte: startDate, $lte: endDate },
        deletedAt: { $exists: false },
      })
        .select('status pricing.totalAmount attribution metadata.bookingSource completedAt')
        .lean();

      const bySourceMap = new Map<BookingAttributionSource, BookingSourceAttributionRow>();

      for (const source of BOOKING_ATTRIBUTION_SOURCES) {
        bySourceMap.set(source, {
          source,
          bookings: 0,
          completedBookings: 0,
          revenue: 0,
        });
      }

      let totalBookings = 0;
      let totalCompletedBookings = 0;
      let totalRevenue = 0;

      for (const booking of bookings) {
        const source = resolveStoredAttributionSource(booking);
        const row = bySourceMap.get(source)!;
        row.bookings += 1;
        totalBookings += 1;

        if (booking.status === 'completed') {
          const completedAt = booking.completedAt ? new Date(booking.completedAt) : null;
          if (completedAt && completedAt >= startDate && completedAt <= endDate) {
            const revenue = booking.pricing?.totalAmount || 0;
            row.completedBookings += 1;
            row.revenue += revenue;
            totalCompletedBookings += 1;
            totalRevenue += revenue;
          }
        }
      }

      const bySource = Array.from(bySourceMap.values())
        .filter((row) => row.bookings > 0 || row.revenue > 0)
        .map((row) => ({
          ...row,
          revenue: Math.round(row.revenue * 100) / 100,
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        providerId,
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalBookings,
        totalCompletedBookings,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        bySource,
      };
    }, 300);
  }

  /**
   * Get competitive position for a provider
   * FIX #6: Calculate actual average ratings and bookings from database
   */
  async getCompetitivePosition(providerId: string): Promise<CompetitivePositionData> {
    const cacheKey = `analytics:provider:${providerId}:competitive`;

    return getCachedData(cacheKey, async () => {
      const providerObjectId = new (require('mongoose').Types.ObjectId)(providerId);

      // FIX #6: Get real data from database instead of hardcoded values
      // Get provider's own stats
      const providerBookings = await Booking.find({
        providerId: providerObjectId,
        status: 'completed',
      }).lean();

      const providerProfile = await ProviderProfile.findOne({ userId: providerObjectId }).lean();
      const totalProviders = await User.countDocuments({ role: 'provider' });

      // Calculate provider's metrics
      const providerRating = providerProfile?.reviewsData?.averageRating || 0;
      const providerBookingsCount = providerBookings.length;

      // FIX #6: Calculate real aggregate stats from all providers
      // Get average rating across all providers
      const ratingStats = await ProviderProfile.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        { $match: { 'user.role': 'provider' } },
        {
          $group: {
            _id: null,
            avgRating: { $avg: '$reviewsData.averageRating' },
            minRating: { $min: '$reviewsData.averageRating' },
            maxRating: { $max: '$reviewsData.averageRating' },
          },
        },
      ]);

      const avgRating = ratingStats[0]?.avgRating || 0;
      const minRating = ratingStats[0]?.minRating || 0;
      const maxRating = ratingStats[0]?.maxRating || 5;

      // Get average bookings count across all providers
      const bookingsStats = await Booking.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$providerId',
            bookingCount: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: null,
            avgBookings: { $avg: '$bookingCount' },
            maxBookings: { $max: '$bookingCount' },
          },
        },
      ]);

      const avgBookings = Math.round(bookingsStats[0]?.avgBookings || 0);
      const maxBookings = bookingsStats[0]?.maxBookings || 100;

      // Get completion rate stats
      const completionStats = await Booking.aggregate([
        {
          $match: {
            status: { $in: ['completed', 'cancelled'] },
          },
        },
        {
          $group: {
            _id: '$providerId',
            completed: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
            },
            total: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: null,
            avgCompletionRate: { $avg: { $multiply: [{ $divide: ['$completed', '$total'] }, 100] } },
          },
        },
      ]);

      const avgCompletionRate = Math.round(completionStats[0]?.avgCompletionRate || 0);

      // FIX #6: Calculate proper percentile ranking
      // Get all provider ratings to determine actual percentile
      const allProviderRatings = await ProviderProfile.aggregate([
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        { $match: { 'user.role': 'provider' } },
        {
          $group: {
            _id: '$userId',
            rating: { $first: '$reviewsData.averageRating' },
            bookingCount: { $sum: 1 },
          },
        },
        { $sort: { rating: -1 } },
      ]);

      // Find provider's rank
      const providerIndex = allProviderRatings.findIndex(
        (p) => p._id.toString() === providerId
      );
      const ratingRank = providerIndex >= 0 ? providerIndex + 1 : totalProviders;

      // Get volume rank
      const allProviderVolumes = await Booking.aggregate([
        { $match: { status: 'completed' } },
        {
          $group: {
            _id: '$providerId',
            bookingCount: { $sum: 1 },
          },
        },
        { $sort: { bookingCount: -1 } },
      ]);

      const volumeIndex = allProviderVolumes.findIndex(
        (p) => p._id.toString() === providerId
      );
      const volumeRank = volumeIndex >= 0 ? volumeIndex + 1 : totalProviders;

      // Calculate overall rank (average of rating and volume rank)
      const overallRank = Math.round((ratingRank + volumeRank) / 2);
      const percentile = Math.round(((totalProviders - overallRank) / totalProviders) * 100);

      // Calculate provider's completion rate
      const providerCompleted = providerBookings.filter((b) => b.status === 'completed').length;
      const providerCompletionRate = providerBookings.length > 0
        ? Math.round((providerCompleted / providerBookings.length) * 100)
        : 0;

      const metrics = [
        { metric: 'Overall', rank: overallRank, percentile, change: 0 },
        { metric: 'Rating', rank: ratingRank, percentile: Math.round(((totalProviders - ratingRank) / totalProviders) * 100), change: 0 },
        { metric: 'Volume', rank: volumeRank, percentile: Math.round(((totalProviders - volumeRank) / totalProviders) * 100), change: 0 },
      ];

      // Get top 10% rating threshold
      const top10Index = Math.ceil(allProviderRatings.length * 0.1) - 1;
      const top10Rating = allProviderRatings[top10Index]?.rating || 4.7;

      const comparison = {
        rating: providerRating,
        avgRating: Math.round(avgRating * 10) / 10,
        top10Rating: Math.round(top10Rating * 10) / 10,
        responseTime: 0, // Would need response time tracking
        avgResponseTime: 0,
        completionRate: providerCompletionRate,
        avgCompletionRate,
      };

      // Generate suggestions based on actual data
      const suggestions = [];

      if (providerRating < avgRating) {
        suggestions.push({
          category: 'Rating',
          priority: 'high' as const,
          title: 'Improve customer ratings',
          description: `Your rating (${providerRating.toFixed(1)}) is below average (${avgRating.toFixed(1)}). Focus on service quality and customer satisfaction.`,
          potential: Math.round((avgRating - providerRating) * 10),
        });
      }

      if (providerBookingsCount < avgBookings) {
        suggestions.push({
          category: 'Volume',
          priority: 'high' as const,
          title: 'Increase booking volume',
          description: `Your bookings (${providerBookingsCount}) are below average (${avgBookings}). Consider expanding services or improving visibility.`,
          potential: Math.round(((avgBookings - providerBookingsCount) / avgBookings) * 100),
        });
      }

      if (providerCompletionRate < avgCompletionRate) {
        suggestions.push({
          category: 'Completion',
          priority: 'medium' as const,
          title: 'Improve completion rate',
          description: `Your completion rate (${providerCompletionRate}%) is below average (${avgCompletionRate}%). Focus on fulfilling bookings.`,
          potential: Math.round(avgCompletionRate - providerCompletionRate),
        });
      }

      if (suggestions.length === 0) {
        suggestions.push({
          category: 'Performance',
          priority: 'low' as const,
          title: 'Maintain excellence',
          description: 'You are performing above average. Keep up the great work!',
          potential: 0,
        });
      }

      const totalPlatformBookings = allProviderVolumes.reduce(
        (sum, p) => sum + (p.bookingCount || 0),
        0
      );
      const marketShare =
        totalPlatformBookings > 0
          ? Math.round((providerBookingsCount / totalPlatformBookings) * 1000) / 10
          : 0;

      return {
        providerId,
        overallRank,
        totalProviders,
        percentile,
        metrics,
        comparison,
        suggestions,
        reviews: providerProfile?.reviewsData?.totalReviews ?? 0,
        marketShare,
        trend: 0,
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
      const providerObjectId = new mongoose.Types.ObjectId(providerId);
      const trendMonths = getTrendMonthCount(period);
      const trendStart = new Date(endDate.getFullYear(), endDate.getMonth() - trendMonths + 1, 1);

      const [periodCustomers, customerProfiles, monthlyActivity] = await Promise.all([
        Booking.aggregate([
          {
            $match: {
              providerId: providerObjectId,
              status: 'completed',
              createdAt: { $gte: startDate, $lte: endDate },
              customerId: { $exists: true, $ne: null },
            },
          },
          {
            $group: {
              _id: '$customerId',
              bookingCount: { $sum: 1 },
            },
          },
        ]),
        Booking.aggregate([
          {
            $match: {
              providerId: providerObjectId,
              status: 'completed',
              customerId: { $exists: true, $ne: null },
            },
          },
          { $sort: { createdAt: 1 } },
          {
            $group: {
              _id: '$customerId',
              firstBookingAt: { $first: '$createdAt' },
              bookingMonths: {
                $addToSet: {
                  $dateToString: { format: '%Y-%m', date: '$createdAt' },
                },
              },
            },
          },
        ]),
        Booking.aggregate([
          {
            $match: {
              providerId: providerObjectId,
              status: 'completed',
              createdAt: { $gte: trendStart, $lte: endDate },
              customerId: { $exists: true, $ne: null },
            },
          },
          {
            $group: {
              _id: {
                month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                customerId: '$customerId',
              },
            },
          },
          {
            $group: {
              _id: '$_id.month',
              customers: { $addToSet: '$_id.customerId' },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

      const firstBookingByCustomer = new Map<string, Date>();
      const bookingMonthsByCustomer = new Map<string, Set<string>>();

      customerProfiles.forEach((profile) => {
        const customerId = profile._id.toString();
        firstBookingByCustomer.set(customerId, new Date(profile.firstBookingAt));
        bookingMonthsByCustomer.set(
          customerId,
          new Set((profile.bookingMonths as string[]) || []),
        );
      });

      const totalCustomers = periodCustomers.length;
      const repeatCustomers = periodCustomers.filter((customer) => customer.bookingCount > 1).length;
      const newCustomers = totalCustomers - repeatCustomers;
      const repeatRate = totalCustomers > 0 ? round2((repeatCustomers / totalCustomers) * 100) : 0;

      const trendMonthKeys: string[] = [];
      for (let offset = trendMonths - 1; offset >= 0; offset--) {
        trendMonthKeys.push(addMonths(monthKey(endDate), -offset));
      }

      const monthlyMap = new Map<string, Set<string>>();
      monthlyActivity.forEach((entry) => {
        monthlyMap.set(
          entry._id,
          new Set(entry.customers.map((id: mongoose.Types.ObjectId) => id.toString())),
        );
      });

      const trendData: RepeatCustomerTrendPoint[] = trendMonthKeys.map((key) => {
        const customersInMonth = monthlyMap.get(key) || new Set<string>();
        let monthNewCustomers = 0;
        let monthRepeatCustomers = 0;

        customersInMonth.forEach((customerId) => {
          const firstBookingAt = firstBookingByCustomer.get(customerId);
          if (!firstBookingAt) return;

          if (monthKey(firstBookingAt) === key) {
            monthNewCustomers += 1;
          } else {
            monthRepeatCustomers += 1;
          }
        });

        const monthTotal = monthNewCustomers + monthRepeatCustomers;

        return {
          month: formatMonthLabel(key),
          newCustomers: monthNewCustomers,
          repeatCustomers: monthRepeatCustomers,
          repeatRate: monthTotal > 0 ? round2((monthRepeatCustomers / monthTotal) * 100) : 0,
        };
      });

      const cohortKeys = trendMonthKeys.slice(-6);
      const cohortData: RepeatCustomerCohort[] = cohortKeys.map((cohortKey) => {
        const cohortCustomers = Array.from(firstBookingByCustomer.entries())
          .filter(([, firstBookingAt]) => monthKey(firstBookingAt) === cohortKey)
          .map(([customerId]) => customerId);

        const cohortSize = cohortCustomers.length;
        if (cohortSize === 0) {
          return {
            cohort: formatMonthLabel(cohortKey),
            month1: 0,
            month2: 0,
            month3: 0,
            month6: 0,
          };
        }

        const retentionAtOffset = (offset: number = 0): number => {
          if (offset === 0) return 100;
          const targetMonth = addMonths(cohortKey, offset);
          const retained = cohortCustomers.filter((customerId) =>
            bookingMonthsByCustomer.get(customerId)?.has(targetMonth),
          ).length;
          return round2((retained / cohortSize) * 100);
        };

        return {
          cohort: formatMonthLabel(cohortKey),
          month1: retentionAtOffset(0),
          month2: retentionAtOffset(1),
          month3: retentionAtOffset(2),
          month6: retentionAtOffset(5),
        };
      });

      return {
        providerId,
        repeatRate,
        totalCustomers,
        repeatCustomers,
        newCustomers,
        trendData,
        cohortData,
      };
    }, 300);
  }

  async getResponseTimeMetrics(
    providerId: string,
    period: string = '30d',
  ): Promise<ResponseTimeMetricsData> {
    const cacheKey = `analytics:provider:${providerId}:response-time:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);
      const providerObjectId = new mongoose.Types.ObjectId(providerId);
      const targetMinutes = 60;

      const [responseAgg, profile, previousAgg] = await Promise.all([
        Booking.aggregate([
          {
            $match: {
              providerId: providerObjectId,
              createdAt: { $gte: startDate, $lte: endDate },
              $or: [
                { 'providerResponse.acceptedAt': { $exists: true, $ne: null } },
                { 'messages.0': { $exists: true } },
              ],
            },
          },
          {
            $addFields: {
              firstProviderMessageAt: {
                $let: {
                  vars: {
                    providerMessages: {
                      $filter: {
                        input: { $ifNull: ['$messages', []] },
                        as: 'message',
                        cond: { $eq: ['$$message.from', '$providerId'] },
                      },
                    },
                  },
                  in: {
                    $min: '$$providerMessages.timestamp',
                  },
                },
              },
            },
          },
          {
            $project: {
              responseMinutes: {
                $cond: [
                  { $ifNull: ['$providerResponse.acceptedAt', false] },
                  {
                    $divide: [
                      { $subtract: ['$providerResponse.acceptedAt', '$createdAt'] },
                      60000,
                    ],
                  },
                  {
                    $divide: [
                      { $subtract: ['$firstProviderMessageAt', '$createdAt'] },
                      60000,
                    ],
                  },
                ],
              },
            },
          },
          { $match: { responseMinutes: { $gt: 0, $lt: 24 * 60 } } },
          {
            $group: {
              _id: null,
              avg: { $avg: '$responseMinutes' },
              values: { $push: '$responseMinutes' },
            },
          },
        ]),
        ProviderProfile.findOne({ userId: providerObjectId })
          .select('reviewsData.avgResponseTime analytics.performanceMetrics.responseTime')
          .lean(),
        Booking.aggregate([
          {
            $match: {
              providerId: providerObjectId,
              createdAt: {
                $gte: new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())),
                $lt: startDate,
              },
              $or: [
                { 'providerResponse.acceptedAt': { $exists: true, $ne: null } },
                { 'messages.0': { $exists: true } },
              ],
            },
          },
          {
            $addFields: {
              firstProviderMessageAt: {
                $let: {
                  vars: {
                    providerMessages: {
                      $filter: {
                        input: { $ifNull: ['$messages', []] },
                        as: 'message',
                        cond: { $eq: ['$$message.from', '$providerId'] },
                      },
                    },
                  },
                  in: {
                    $min: '$$providerMessages.timestamp',
                  },
                },
              },
            },
          },
          {
            $project: {
              responseMinutes: {
                $cond: [
                  { $ifNull: ['$providerResponse.acceptedAt', false] },
                  {
                    $divide: [
                      { $subtract: ['$providerResponse.acceptedAt', '$createdAt'] },
                      60000,
                    ],
                  },
                  {
                    $divide: [
                      { $subtract: ['$firstProviderMessageAt', '$createdAt'] },
                      60000,
                    ],
                  },
                ],
              },
            },
          },
          { $match: { responseMinutes: { $gt: 0, $lt: 24 * 60 } } },
          { $group: { _id: null, avg: { $avg: '$responseMinutes' } } },
        ]),
      ]);

      const values: number[] = (responseAgg[0]?.values || []).sort((a: number, b: number) => a - b);
      const sampleSize = values.length;
      const profileFallbackMinutes =
        profile?.analytics?.performanceMetrics?.responseTime ||
        (profile?.reviewsData?.avgResponseTime ? profile.reviewsData.avgResponseTime * 60 : 0);
      const avgResponseTimeMinutes = round2(
        responseAgg[0]?.avg || profileFallbackMinutes || 0,
      );
      const medianResponseTimeMinutes =
        sampleSize > 0 ? round2(values[Math.floor(sampleSize / 2)]) : avgResponseTimeMinutes;
      const p95ResponseTimeMinutes =
        sampleSize > 0 ? round2(values[Math.min(sampleSize - 1, Math.floor(sampleSize * 0.95))]) : 0;

      const previousAvg = previousAgg[0]?.avg ?? avgResponseTimeMinutes;
      let trend: ResponseTimeMetricsData['trend'] = 'stable';
      if (avgResponseTimeMinutes < previousAvg * 0.9) trend = 'improving';
      else if (avgResponseTimeMinutes > previousAvg * 1.1) trend = 'declining';

      return {
        providerId,
        period,
        avgResponseTimeMinutes,
        medianResponseTimeMinutes,
        p95ResponseTimeMinutes,
        sampleSize,
        targetMinutes,
        compliant: avgResponseTimeMinutes <= targetMinutes,
        profileAvgResponseTimeMinutes: round2(profileFallbackMinutes),
        trend,
      };
    }, 300);
  }

  async getProviderLTV(providerId: string, period: string = '30d'): Promise<ProviderLTVData> {
    const cacheKey = `analytics:provider:${providerId}:ltv:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);
      const providerObjectId = new mongoose.Types.ObjectId(providerId);

      const customerStats = await Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            status: 'completed',
            customerId: { $exists: true, $ne: null },
            $or: [
              { completedAt: { $gte: startDate, $lte: endDate } },
              {
                completedAt: { $exists: false },
                createdAt: { $gte: startDate, $lte: endDate },
              },
            ],
          },
        },
        {
          $group: {
            _id: '$customerId',
            totalSpent: { $sum: '$pricing.totalAmount' },
            bookingCount: { $sum: 1 },
          },
        },
        { $sort: { totalSpent: -1 } },
      ]);

      const totalCustomers = customerStats.length;
      const totalLTV = customerStats.reduce((sum, row) => sum + (row.totalSpent || 0), 0);
      const totalBookings = customerStats.reduce((sum, row) => sum + (row.bookingCount || 0), 0);

      return {
        providerId,
        period,
        totalCustomers,
        avgRevenuePerCustomer: totalCustomers > 0 ? round2(totalLTV / totalCustomers) : 0,
        totalLTV: round2(totalLTV),
        avgBookingsPerCustomer: totalCustomers > 0 ? round2(totalBookings / totalCustomers) : 0,
        topCustomers: customerStats.slice(0, 5).map((row) => ({
          customerId: row._id?.toString() || '',
          totalSpent: round2(row.totalSpent || 0),
          bookingCount: row.bookingCount || 0,
        })),
      };
    }, 300);
  }

  async getGeographicDemand(providerId: string, period: string = '30d'): Promise<GeographicDemandData> {
    const cacheKey = `analytics:provider:${providerId}:geographic:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);
      const providerObjectId = new mongoose.Types.ObjectId(providerId);

      const rows = await Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            status: 'completed',
            $or: [
              { completedAt: { $gte: startDate, $lte: endDate } },
              {
                completedAt: { $exists: false },
                createdAt: { $gte: startDate, $lte: endDate },
              },
            ],
          },
        },
        ...geographicLookupStages(),
        {
          $addFields: {
            resolvedCity: resolvedCityAggregationField(),
            resolvedEmirate: {
              $ifNull: [
                '$location.address.state',
                '$customer.address.state',
                '$defaultAddress.state',
                'Unknown',
              ],
            },
          },
        },
        {
          $group: {
            _id: { city: '$resolvedCity', emirate: '$resolvedEmirate' },
            bookings: { $sum: 1 },
            revenue: { $sum: '$pricing.totalAmount' },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]);

      const totalBookings = rows.reduce((sum, row) => sum + row.bookings, 0);
      const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);

      const locations: GeographicDemandEntry[] = rows.map((row) => ({
        city: row._id.city,
        emirate: row._id.emirate,
        bookings: row.bookings,
        revenue: round2(row.revenue),
        avgBookingValue: row.bookings > 0 ? round2(row.revenue / row.bookings) : 0,
        share: totalBookings > 0 ? round2((row.bookings / totalBookings) * 100) : 0,
      }));

      return {
        providerId,
        period,
        locations,
        totalBookings,
        totalRevenue: round2(totalRevenue),
      };
    }, 300);
  }

  async getRevenueForecast(providerId: string, period: string = '30d'): Promise<RevenueForecastData> {
    const cacheKey = `analytics:provider:${providerId}:forecast:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);
      const providerObjectId = new mongoose.Types.ObjectId(providerId);

      const dailyRows = await Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            status: 'completed',
            completedAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$completedAt' },
            },
            revenue: { $sum: '$pricing.totalAmount' },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const historicalDaily = dailyRows.map((row) => ({
        date: row._id,
        revenue: round2(row.revenue),
      }));

      const dailyValues = historicalDaily.map((row) => row.revenue);
      const forecast7d = linearForecast(dailyValues, 7);
      const forecast30d = linearForecast(dailyValues, 30);
      const projectedRevenue7d = round2(forecast7d.reduce((sum, point) => sum + point.predicted, 0));
      const projectedRevenue30d = round2(forecast30d.reduce((sum, point) => sum + point.predicted, 0));

      const firstHalf = dailyValues.slice(0, Math.floor(dailyValues.length / 2));
      const secondHalf = dailyValues.slice(Math.floor(dailyValues.length / 2));
      const firstAvg = firstHalf.length ? firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length : 0;
      const secondAvg = secondHalf.length ? secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length : 0;
      let trend: RevenueForecastData['trend'] = 'stable';
      if (secondAvg > firstAvg * 1.1) trend = 'increasing';
      else if (secondAvg < firstAvg * 0.9) trend = 'decreasing';

      return {
        providerId,
        period,
        historicalDaily,
        forecast7d,
        forecast30d,
        projectedRevenue7d,
        projectedRevenue30d,
        trend,
      };
    }, 300);
  }

  async getProviderAnomalyAlerts(providerId: string, period: string = '30d'): Promise<ProviderAnomalyAlert[]> {
    const cacheKey = `analytics:provider:${providerId}:anomalies:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);
      const providerObjectId = new mongoose.Types.ObjectId(providerId);
      const previousStart = new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime()));
      const alerts: ProviderAnomalyAlert[] = [];
      const now = new Date().toISOString();

      const [currentBookings, previousBookings, cancellationStats, responseTime] = await Promise.all([
        Booking.countDocuments({
          providerId: providerObjectId,
          createdAt: { $gte: startDate, $lte: endDate },
        }),
        Booking.countDocuments({
          providerId: providerObjectId,
          createdAt: { $gte: previousStart, $lt: startDate },
        }),
        Booking.aggregate([
          {
            $match: {
              providerId: providerObjectId,
              createdAt: { $gte: startDate, $lte: endDate },
              status: { $in: ['completed', 'cancelled'] },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
            },
          },
        ]),
        this.getResponseTimeMetrics(providerId, period),
      ]);

      // Minimum thresholds to avoid false positives on low-volume providers
      const MIN_BOOKINGS_FOR_ANALYSIS = 5;
      const BOOKING_DROP_THRESHOLD = 0.5; // 50% drop
      const CANCEL_RATE_WARNING = 25; // 25%
      const CANCEL_RATE_CRITICAL = 40; // 40%

      // Booking drop detection - only if we have enough historical data
      if (previousBookings >= MIN_BOOKINGS_FOR_ANALYSIS && currentBookings < previousBookings * BOOKING_DROP_THRESHOLD) {
        const dropPercent = round2(((previousBookings - currentBookings) / previousBookings) * 100);
        if (dropPercent >= 50) {
          alerts.push({
            id: `booking-drop-${period}`,
            severity: dropPercent >= 70 ? 'critical' : 'warning',
            title: dropPercent >= 70 ? 'Significant booking drop' : 'Booking volume declining',
            message: `Bookings fell ${dropPercent}% (${previousBookings} → ${currentBookings}) vs the previous period.`,
            metric: 'bookings',
            detectedAt: now,
          });
        }
      }

      // Cancellation rate - only if we have enough completed/cancelled bookings
      const cancelTotal = cancellationStats[0]?.total || 0;
      if (cancelTotal >= MIN_BOOKINGS_FOR_ANALYSIS) {
        const cancelRate = cancelTotal > 0 ? (cancellationStats[0].cancelled / cancelTotal) * 100 : 0;
        if (cancelRate > CANCEL_RATE_CRITICAL) {
          alerts.push({
            id: `high-cancellation-${period}`,
            severity: 'critical',
            title: 'Critical cancellation rate',
            message: `Cancellation rate is ${round2(cancelRate)}% — well above recommended levels.`,
            metric: 'cancellationRate',
            detectedAt: now,
          });
        } else if (cancelRate > CANCEL_RATE_WARNING) {
          alerts.push({
            id: `high-cancellation-${period}`,
            severity: 'warning',
            title: 'Elevated cancellation rate',
            message: `Cancellation rate is ${round2(cancelRate)}% — consider implementing prevention strategies.`,
            metric: 'cancellationRate',
            detectedAt: now,
          });
        }
      }

      // Response time - only if we have a meaningful sample and significant deviation
      if (responseTime.sampleSize >= MIN_BOOKINGS_FOR_ANALYSIS) {
        if (!responseTime.compliant) {
          const deviationPercent = round2((responseTime.avgResponseTimeMinutes / responseTime.targetMinutes) * 100 - 100);
          if (responseTime.avgResponseTimeMinutes > responseTime.targetMinutes * 2.5) {
            alerts.push({
              id: `slow-response-${period}`,
              severity: 'critical',
              title: 'Response time significantly above target',
              message: `Average response time is ${round2(responseTime.avgResponseTimeMinutes)}m — ${deviationPercent}% above your ${responseTime.targetMinutes}m target.`,
              metric: 'responseTime',
              detectedAt: now,
            });
          } else if (responseTime.avgResponseTimeMinutes > responseTime.targetMinutes) {
            alerts.push({
              id: `slow-response-${period}`,
              severity: 'warning',
              title: 'Response time above target',
              message: `Average response time is ${round2(responseTime.avgResponseTimeMinutes)} minutes (target: ${responseTime.targetMinutes}m).`,
              metric: 'responseTime',
              detectedAt: now,
            });
          }
        }
      }

      if (alerts.length === 0) {
        alerts.push({
          id: `all-clear-${period}`,
          severity: 'info',
          title: 'All metrics healthy',
          message: 'Your key performance metrics are within normal ranges.',
          detectedAt: now,
        });
      }

      return alerts;
    }, 120);
  }

  /**
   * Travel time and distance analytics from completed/on-site bookings
   */
  async getTravelMetrics(providerId: string, period: string = '30d'): Promise<ProviderTravelMetrics> {
    const cacheKey = `analytics:provider:${providerId}:travel:${period}`;

    return getCachedData(cacheKey, async () => {
      const { startDate, endDate } = getDateRange(period);
      const providerObjectId = new mongoose.Types.ObjectId(providerId);

      const UAE_EMIRATE_CENTROIDS: Record<string, { lat: number; lng: number }> = {
        dubai: { lat: 25.2048, lng: 55.2708 },
        'abu dhabi': { lat: 24.4539, lng: 54.3773 },
        sharjah: { lat: 25.3463, lng: 55.4209 },
        ajman: { lat: 25.4052, lng: 55.5136 },
        'ras al khaimah': { lat: 25.7895, lng: 55.9432 },
        rak: { lat: 25.7895, lng: 55.9432 },
        fujairah: { lat: 25.1288, lng: 56.3264 },
        'umm al quwain': { lat: 25.5647, lng: 55.5552 },
        uaq: { lat: 25.5647, lng: 55.5552 },
      };

      const resolveBookingCoordinates = (
        booking: {
          location?: {
            address?: {
              coordinates?: { coordinates?: number[] };
              city?: string;
              state?: string;
            };
          };
        },
      ): { lat: number; lng: number } | null => {
        const bookingCoords = booking.location?.address?.coordinates?.coordinates;
        if (bookingCoords && bookingCoords.length === 2) {
          return { lat: bookingCoords[1], lng: bookingCoords[0] };
        }

        const cityKey = (booking.location?.address?.city || booking.location?.address?.state || '')
          .trim()
          .toLowerCase();
        if (!cityKey) return null;

        const centroid = UAE_EMIRATE_CENTROIDS[cityKey]
          || Object.entries(UAE_EMIRATE_CENTROIDS).find(([name]) => cityKey.includes(name))?.[1];
        return centroid || null;
      };

      const [profile, bookings] = await Promise.all([
        ProviderProfile.findOne({ userId: providerId })
          .select('locationInfo.primaryAddress.coordinates locationInfo.travelFee')
          .lean(),
        Booking.find({
          providerId: providerObjectId,
          status: { $in: ['confirmed', 'in_progress', 'completed'] },
          createdAt: { $gte: startDate, $lte: endDate },
        })
          .select('location scheduledDate pricing.addOns createdAt')
          .lean(),
      ]);

      const providerCoords = profile?.locationInfo?.primaryAddress?.coordinates?.coordinates;
      const travelFeeConfig = profile?.locationInfo?.travelFee || {
        baseFee: 0,
        perKmFee: 0,
        maxTravelDistance: 25,
      };

      const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dailyBuckets = new Map<number, {
        totalTravelTime: number;
        totalDistance: number;
        bookings: number;
      }>();
      for (let i = 0; i < 7; i += 1) {
        dailyBuckets.set(i, { totalTravelTime: 0, totalDistance: 0, bookings: 0 });
      }

      const areaBuckets = new Map<string, {
        jobs: number;
        totalTravel: number;
        totalDistance: number;
      }>();

      let totalTravelTime = 0;
      let totalDistance = 0;
      let totalTravelFees = 0;
      let remoteArea = { name: '', distance: 0 };
      let inefficientArea = { name: '', travelPerJob: 0 };

      for (const booking of bookings) {
        const to = resolveBookingCoordinates(booking);
        if (!to) continue;

        let distanceKm = 0;
        let travelMinutes = 0;

        if (providerCoords && providerCoords.length === 2) {
          const from = { lat: providerCoords[1], lng: providerCoords[0] };
          const estimate = geolocationService.estimateTravelTime(from, to, {
            departureTime: booking.scheduledDate ? new Date(booking.scheduledDate) : undefined,
          });
          distanceKm = estimate.distance;
          travelMinutes = estimate.durationMinutes;
        } else {
          distanceKm = Math.min(travelFeeConfig.maxTravelDistance, 10);
          travelMinutes = Math.ceil((distanceKm / 30) * 60);
        }

        const travelFeeFromAddOn = (booking.pricing?.addOns || [])
          .filter((addOn) => /travel/i.test(addOn.name))
          .reduce((sum, addOn) => sum + (addOn.price || 0), 0);
        const computedTravelFee = travelFeeConfig.baseFee + (distanceKm * travelFeeConfig.perKmFee);
        totalTravelFees += travelFeeFromAddOn > 0 ? travelFeeFromAddOn : computedTravelFee;

        totalTravelTime += travelMinutes;
        totalDistance += distanceKm;

        const dayIndex = booking.scheduledDate
          ? new Date(booking.scheduledDate).getDay()
          : new Date(booking.createdAt).getDay();
        const dayBucket = dailyBuckets.get(dayIndex)!;
        dayBucket.totalTravelTime += travelMinutes;
        dayBucket.totalDistance += distanceKm;
        dayBucket.bookings += 1;

        const area = booking.location?.address?.city || booking.location?.address?.state || 'Unknown';
        const areaBucket = areaBuckets.get(area) || { jobs: 0, totalTravel: 0, totalDistance: 0 };
        areaBucket.jobs += 1;
        areaBucket.totalTravel += travelMinutes;
        areaBucket.totalDistance += distanceKm;
        areaBuckets.set(area, areaBucket);

        if (distanceKm > remoteArea.distance) {
          remoteArea = { name: area, distance: distanceKm };
        }

        const travelPerJob = areaBucket.totalTravel / areaBucket.jobs;
        if (travelPerJob > inefficientArea.travelPerJob) {
          inefficientArea = { name: area, travelPerJob };
        }
      }

      const bookingCount = bookings.filter((booking) => resolveBookingCoordinates(booking)).length;
      const avgTravelTime = bookingCount > 0 ? Math.round(totalTravelTime / bookingCount) : 0;
      const avgDistance = bookingCount > 0 ? round2(totalDistance / bookingCount) : 0;
      const fuelCost = round2(totalDistance * 0.35);
      const maxReasonableTravel = avgTravelTime * bookingCount * 0.85;
      const potentialSavings = round2(Math.max(0, totalTravelFees - maxReasonableTravel * 0.5));
      const efficiency = bookingCount > 0
        ? Math.min(100, Math.round((avgDistance <= travelFeeConfig.maxTravelDistance ? 85 : 65)))
        : 0;

      const travelData: TravelDataPoint[] = dayLabels.map((label, index) => {
        const bucket = dailyBuckets.get(index)!;
        const dayBookings = bucket.bookings || 0;
        return {
          date: label,
          totalTravelTime: bucket.totalTravelTime,
          avgTravelTime: dayBookings > 0 ? Math.round(bucket.totalTravelTime / dayBookings) : 0,
          totalDistance: round2(bucket.totalDistance),
          bookings: dayBookings,
          efficiency: dayBookings > 0
            ? Math.min(100, Math.round(100 - (bucket.totalDistance / dayBookings)))
            : 0,
        };
      });

      const jobsByArea: JobsByArea[] = Array.from(areaBuckets.entries())
        .map(([area, bucket]) => ({
          area,
          jobs: bucket.jobs,
          avgTravel: bucket.jobs > 0 ? Math.round(bucket.totalTravel / bucket.jobs) : 0,
          avgDistance: bucket.jobs > 0 ? round2(bucket.totalDistance / bucket.jobs) : 0,
        }))
        .sort((a, b) => b.jobs - a.jobs)
        .slice(0, 10);

      return {
        providerId,
        period,
        travelData,
        stats: {
          totalTravelTime,
          avgTravelTime,
          totalDistance: round2(totalDistance),
          avgDistance,
          fuelCost,
          mostRemoteJob: remoteArea.name || 'N/A',
          leastEfficient: inefficientArea.name || 'N/A',
          potentialSavings,
          efficiency,
        },
        jobsByArea,
      };
    }, 600);
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
