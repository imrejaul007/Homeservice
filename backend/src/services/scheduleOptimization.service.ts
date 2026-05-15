import mongoose, { Types } from 'mongoose';
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import User from '../models/user.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';

// ============================================
// INTERFACES
// ============================================

export interface TimeSlot {
  time: string; // "HH:MM" format
  demand: number; // Number of bookings requested
  supply: number; // Available slots
  gap: number; // demand - supply (positive = undercapacity)
  fillRate: number; // Percentage filled
  recommendation: string;
}

export interface ScheduleOptimization {
  providerId: string;
  currentUtilization: number;
  optimalSlots: TimeSlot[];
  peakDemandHours: number[];
  offPeakHours: number[];
  suggestions: string[];
  weeklyPattern: DayPattern[];
  generatedAt: Date;
}

export interface DayPattern {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  dayName: string;
  totalBookings: number;
  averageBookings: number;
  averageRevenue: number;
  isPeakDay: boolean;
  demandLevel: 'low' | 'medium' | 'high';
}

export interface AvailabilityGap {
  dayOfWeek: number;
  timeSlot: string;
  unfilledDemand: number;
  potentialRevenue: number;
  recommendation: string;
}

export interface BookingPattern {
  hourlyDistribution: Array<{
    hour: number;
    bookings: number;
    revenue: number;
    averageValue: number;
  }>;
  dailyDistribution: Array<{
    dayOfWeek: number;
    bookings: number;
    revenue: number;
  }>;
  weeklyTrend: number; // Average bookings per week
  monthlyTrend: number; // Average bookings per month
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getDateRange = (days: number): { startDate: Date; endDate: Date } => {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { startDate, endDate };
};

const getDayName = (dayOfWeek: number): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
};

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

// ============================================
// ANALYZE BOOKING PATTERNS
// ============================================

export const analyzeBookingPatterns = async (
  providerId: string,
  days: number = 30
): Promise<BookingPattern> => {
  const cacheKey = `schedule:patterns:${providerId}:${days}`;
  const ttl = 600; // 10 minutes

  return getCached(cacheKey, async () => {
    const { startDate, endDate } = getDateRange(days);
    const providerObjectId = new Types.ObjectId(providerId);

    const [hourlyData, dailyData, weeklyData] = await Promise.all([
      // Hourly distribution
      Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            status: 'completed',
            completedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $hour: '$completedAt' },
            bookings: { $sum: 1 },
            revenue: { $sum: '$pricing.totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Daily distribution
      Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            status: 'completed',
            completedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: { $dayOfWeek: '$completedAt' },
            bookings: { $sum: 1 },
            revenue: { $sum: '$pricing.totalAmount' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      // Weekly trend calculation
      Booking.aggregate([
        {
          $match: {
            providerId: providerObjectId,
            status: 'completed',
            completedAt: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              week: { $isoWeek: '$completedAt' },
              year: { $isoWeekYear: '$completedAt' }
            },
            bookings: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: null,
            avgWeeklyBookings: { $avg: '$bookings' },
            totalBookings: { $sum: '$bookings' },
            weeks: { $sum: 1 }
          }
        }
      ])
    ]);

    const hourlyDistribution = hourlyData.map((h: any) => ({
      hour: h._id,
      bookings: h.bookings,
      revenue: h.revenue,
      averageValue: h.bookings > 0 ? h.revenue / h.bookings : 0
    }));

    const dailyDistribution = dailyData.map((d: any) => ({
      dayOfWeek: d._id === 1 ? 0 : d._id - 1, // Convert MongoDB dayOfWeek (1=Sunday) to JS (0=Sunday)
      bookings: d.bookings,
      revenue: d.revenue
    }));

    const weeklyTrend = weeklyData[0]?.avgWeeklyBookings || 0;
    const totalBookings = weeklyData[0]?.totalBookings || 0;
    const weeks = weeklyData[0]?.weeks || 1;
    const monthlyTrend = weeklyTrend * 4.33;

    return {
      hourlyDistribution,
      dailyDistribution,
      weeklyTrend,
      monthlyTrend
    };
  }, ttl);
};

// ============================================
// OPTIMAL SCHEDULE RECOMMENDATIONS
// ============================================

export const getOptimalSchedule = async (
  providerId: string
): Promise<ScheduleOptimization> => {
  const cacheKey = `schedule:optimal:${providerId}`;
  const ttl = 600;

  return getCached(cacheKey, async () => {
    const { startDate, endDate } = getDateRange(30);
    const providerObjectId = new Types.ObjectId(providerId);

    // Get services to understand typical duration
    const services = await Service.find({ providerId: providerObjectId, isActive: true }).lean();
    const avgDuration = services.length > 0
      ? services.reduce((sum, s) => sum + ((s.duration as any) || 60), 0) / services.length
      : 60;

    // Calculate slots per day (assuming 6 AM to 10 PM, 30-min slots)
    const totalSlotsPerDay = 32; // 16 hours * 2 slots per hour
    const workingDays = 7;

    // Analyze completed bookings for demand patterns
    const demandByHour = await Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          status: { $in: ['completed', 'confirmed', 'pending'] },
          scheduledDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$scheduledDate' },
            dayOfWeek: { $dayOfWeek: '$scheduledDate' }
          },
          demand: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' }
        }
      },
      { $sort: { demand: -1 } }
    ]);

    // Create demand map
    const demandMap = new Map<number, { demand: number; revenue: number }>();
    let totalDemand = 0;
    let totalRevenue = 0;

    demandByHour.forEach((d: any) => {
      const hour = d._id.hour;
      const existing = demandMap.get(hour) || { demand: 0, revenue: 0 };
      demandMap.set(hour, {
        demand: existing.demand + d.demand,
        revenue: existing.revenue + d.revenue
      });
      totalDemand += d.demand;
      totalRevenue += d.revenue;
    });

    // Calculate peak and off-peak hours
    const avgDemandPerHour = totalDemand / (totalSlotsPerDay * workingDays);
    const peakDemandThreshold = avgDemandPerHour * 1.5;

    const peakDemandHours: number[] = [];
    const offPeakHours: number[] = [];
    const optimalSlots: TimeSlot[] = [];

    // Analyze each hour slot
    for (let hour = 6; hour <= 22; hour++) {
      const demandData = demandMap.get(hour) || { demand: 0, revenue: 0 };
      const supply = 1; // One available slot per hour per working day
      const gap = demandData.demand - supply;
      const fillRate = supply > 0 ? Math.min(100, (demandData.demand / supply) * 100) : 0;

      if (demandData.demand > peakDemandThreshold) {
        peakDemandHours.push(hour);
      }

      // Off-peak is typically early morning (6-8 AM) and late evening (8-10 PM)
      if ((hour >= 6 && hour <= 8) || (hour >= 20 && hour <= 22)) {
        offPeakHours.push(hour);
      }

      // Find optimal slots (high demand, low supply)
      if (gap > 0 || demandData.demand >= avgDemandPerHour * 0.8) {
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;
        let recommendation = '';

        if (gap > 0) {
          recommendation = `High demand: Consider adding more availability at ${timeStr}`;
        } else if (fillRate >= 80) {
          recommendation = `Strong demand (${fillRate.toFixed(0)}% fill rate): Maintain current availability`;
        } else {
          recommendation = `Moderate demand: Consider promoting this time slot`;
        }

        optimalSlots.push({
          time: timeStr,
          demand: demandData.demand,
          supply,
          gap,
          fillRate,
          recommendation
        });
      }
    }

    // Calculate current utilization
    const completedBookings = await Booking.countDocuments({
      providerId: providerObjectId,
      status: 'completed',
      completedAt: { $gte: startDate, $lte: endDate }
    });

    const potentialSlots = workingDays * totalSlotsPerDay;
    const currentUtilization = potentialSlots > 0
      ? Math.min(100, (completedBookings / potentialSlots) * 100)
      : 0;

    // Generate suggestions
    const suggestions: string[] = [];

    if (currentUtilization < 50) {
      suggestions.push('Your calendar utilization is low. Consider adding more availability or promoting off-peak hours.');
    }

    if (peakDemandHours.length > 0) {
      const peakTimeStr = peakDemandHours.map(h => `${h}:00`).join(', ');
      suggestions.push(`Peak demand is between ${peakTimeStr}. Consider adjusting pricing or availability for these hours.`);
    }

    if (offPeakHours.length > 0) {
      const offPeakStr = offPeakHours.map(h => `${h}:00`).join(', ');
      suggestions.push(`Off-peak hours (${offPeakStr}) have lower demand. Consider offering discounts to fill these slots.`);
    }

    if (optimalSlots.length > 3) {
      suggestions.push(`Top ${optimalSlots.slice(0, 3).map(s => s.time).join(', ')} are your most requested times. Prioritize availability here.`);
    }

    // Calculate weekly pattern
    const weeklyPattern = await calculateWeeklyPattern(providerObjectId, startDate, endDate);

    return {
      providerId,
      currentUtilization,
      optimalSlots: optimalSlots.sort((a, b) => b.gap - a.gap).slice(0, 5),
      peakDemandHours,
      offPeakHours,
      suggestions,
      weeklyPattern,
      generatedAt: new Date()
    };
  }, ttl);
};

// ============================================
// WEEKLY PATTERN ANALYSIS
// ============================================

const calculateWeeklyPattern = async (
  providerId: Types.ObjectId,
  startDate: Date,
  endDate: Date
): Promise<DayPattern[]> => {
  const dailyStats = await Booking.aggregate([
    {
      $match: {
        providerId,
        status: 'completed',
        completedAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: { $dayOfWeek: '$completedAt' },
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$pricing.totalAmount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const totalBookings = dailyStats.reduce((sum, d: any) => sum + d.totalBookings, 0);
  const totalRevenue = dailyStats.reduce((sum, d: any) => sum + d.totalRevenue, 0);
  const avgBookingsPerDay = totalBookings / 7;

  // Determine peak days (above average)
  const peakDay = dailyStats.reduce((max: any, d: any) =>
    d.totalBookings > max.totalBookings ? d : max,
    { totalBookings: 0 }
  );

  return dailyStats.map((d: any) => {
    const dayOfWeek = d._id === 1 ? 0 : d._id - 1; // Convert MongoDB to JS day
    const isPeakDay = d._id === peakDay._id;
    const demandLevel: 'low' | 'medium' | 'high' =
      d.totalBookings < avgBookingsPerDay * 0.7 ? 'low' :
      d.totalBookings > avgBookingsPerDay * 1.3 ? 'high' : 'medium';

    return {
      dayOfWeek,
      dayName: getDayName(dayOfWeek),
      totalBookings: d.totalBookings,
      averageBookings: d.totalBookings / 4, // Assuming ~4 weeks
      averageRevenue: d.totalRevenue / 4,
      isPeakDay,
      demandLevel
    };
  });
};

// ============================================
// AVAILABILITY GAP ANALYSIS
// ============================================

export const getAvailabilityGaps = async (
  providerId: string
): Promise<AvailabilityGap[]> => {
  const cacheKey = `schedule:gaps:${providerId}`;
  const ttl = 600;

  return getCached(cacheKey, async () => {
    const { startDate, endDate } = getDateRange(30);
    const providerObjectId = new Types.ObjectId(providerId);

    // Get all bookings to analyze unfilled demand
    const bookingsBySlot = await Booking.aggregate([
      {
        $match: {
          providerId: providerObjectId,
          scheduledDate: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            dayOfWeek: { $dayOfWeek: '$scheduledDate' },
            hour: { $hour: '$scheduledDate' }
          },
          bookingCount: { $sum: 1 },
          totalRevenue: { $sum: '$pricing.totalAmount' }
        }
      },
      { $sort: { bookingCount: -1 } }
    ]);

    const gaps: AvailabilityGap[] = [];

    // Analyze slots with high demand but potential for more
    bookingsBySlot.forEach((slot: any) => {
      if (slot.bookingCount >= 3) { // High demand threshold
        const timeStr = `${slot._id.hour.toString().padStart(2, '0')}:00`;
        const avgRevenuePerBooking = slot.totalRevenue / slot.bookingCount;

        // Calculate potential if we had 2 more slots
        const unfilledDemand = Math.max(0, slot.bookingCount - 2); // Assuming 2 slots available
        const potentialRevenue = unfilledDemand * avgRevenuePerBooking;

        if (unfilledDemand > 0) {
          const dayOfWeek = slot._id.dayOfWeek === 1 ? 0 : slot._id.dayOfWeek - 1;
          gaps.push({
            dayOfWeek,
            timeSlot: timeStr,
            unfilledDemand,
            potentialRevenue,
            recommendation: `Consider adding more availability on ${getDayName(dayOfWeek)} at ${timeStr}. Estimated additional revenue: ${potentialRevenue.toFixed(0)} AED`
          });
        }
      }
    });

    return gaps.sort((a, b) => b.potentialRevenue - a.potentialRevenue);
  }, ttl);
};

// ============================================
// PEAK HOUR ANALYSIS
// ============================================

export const getPeakDemandAnalysis = async (
  providerId: string
): Promise<{
  peakHours: Array<{ hour: number; demand: number; revenue: number }>;
  optimalBookingWindow: { start: number; end: number };
  recommendations: string[];
}> => {
  const patterns = await analyzeBookingPatterns(providerId, 30);
  const peakHours = patterns.hourlyDistribution
    .filter(h => h.bookings > 0)
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 5)
    .map(h => ({
      hour: h.hour,
      demand: h.bookings,
      revenue: h.revenue
    }));

  // Find optimal booking window (contiguous hours with highest demand)
  let bestWindow = { start: 9, end: 12 }; // Default
  let bestWindowValue = 0;

  for (let start = 6; start <= 18; start++) {
    for (let end = start + 2; end <= start + 4; end++) {
      const windowValue = patterns.hourlyDistribution
        .filter(h => h.hour >= start && h.hour < end)
        .reduce((sum, h) => sum + h.bookings, 0);

      if (windowValue > bestWindowValue) {
        bestWindowValue = windowValue;
        bestWindow = { start, end };
      }
    }
  }

  const recommendations: string[] = [];

  if (peakHours.length > 0) {
    recommendations.push(
      `Your busiest hours are ${peakHours.map(h => `${h.hour}:00`).join(', ')}. Ensure maximum availability during these times.`
    );
  }

  recommendations.push(
    `Optimal booking window: ${bestWindow.start}:00 - ${bestWindow.end}:00. Schedule your marketing campaigns to target customers during these hours.`
  );

  if (patterns.hourlyDistribution.some(h => h.hour >= 6 && h.hour <= 8 && h.bookings < 2)) {
    recommendations.push(
      'Early morning slots (6-8 AM) are underutilized. Consider offering early-bird discounts to fill these slots.'
    );
  }

  return {
    peakHours,
    optimalBookingWindow: bestWindow,
    recommendations
  };
};

// ============================================
// SCHEDULE CONFLICT DETECTION
// ============================================

export const detectScheduleConflicts = async (
  providerId: string,
  date: Date
): Promise<{
  hasConflicts: boolean;
  conflicts: Array<{
    type: 'overlap' | 'too_short' | 'too_long';
    bookingId: string;
    message: string;
  }>;
  suggestions: string[];
}> => {
  const providerObjectId = new Types.ObjectId(providerId);
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const bookings = await Booking.find({
    providerId: providerObjectId,
    scheduledDate: { $gte: startOfDay, $lte: endOfDay },
    status: { $in: ['confirmed', 'pending'] }
  })
    .sort({ scheduledTime: 1 })
    .lean();

  const conflicts: Array<{
    type: 'overlap' | 'too_short' | 'too_long';
    bookingId: string;
    message: string;
  }> = [];

  for (let i = 0; i < bookings.length - 1; i++) {
    const current = bookings[i];
    const next = bookings[i + 1];

    // Parse times
    const [currentHour, currentMin] = current.scheduledTime.split(':').map(Number);
    const currentEnd = new Date(current.scheduledDate);
    currentEnd.setHours(currentHour, currentMin + current.duration, 0, 0);

    const [nextHour, nextMin] = next.scheduledTime.split(':').map(Number);
    const nextStart = new Date(next.scheduledDate);
    nextStart.setHours(nextHour, nextMin, 0, 0);

    // Check for overlap
    if (currentEnd > nextStart) {
      conflicts.push({
        type: 'overlap',
        bookingId: current._id.toString(),
        message: `Booking ${current.bookingNumber} ends at ${currentEnd.toTimeString().slice(0, 5)} but next booking starts at ${next.scheduledTime}`
      });
    }

    // Check for too-short buffer (less than 15 minutes)
    const gapMinutes = (nextStart.getTime() - currentEnd.getTime()) / (60 * 1000);
    if (gapMinutes > 0 && gapMinutes < 15) {
      conflicts.push({
        type: 'too_short',
        bookingId: current._id.toString(),
        message: `Only ${gapMinutes.toFixed(0)} minutes between bookings. Consider 15+ minute buffer.`
      });
    }
  }

  const suggestions: string[] = [];
  if (conflicts.length > 0) {
    suggestions.push('Review overlapping bookings and adjust times or notify customers.');
    suggestions.push('Consider adding buffer time between appointments for travel.');
  }

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    suggestions
  };
};

// ============================================
// EFFICIENCY SCORE
// ============================================

export const getScheduleEfficiencyScore = async (
  providerId: string
): Promise<{
  overallScore: number;
  components: {
    utilization: number;
    peakCoverage: number;
    offPeakFillRate: number;
    bufferAdequacy: number;
  };
  recommendations: string[];
}> => {
  const optimization = await getOptimalSchedule(providerId);
  const patterns = await analyzeBookingPatterns(providerId);

  // Calculate component scores
  const utilizationScore = optimization.currentUtilization;

  // Peak coverage: how many peak hours have availability
  const peakCoverage = optimization.peakDemandHours.length > 0
    ? Math.min(100, (optimization.optimalSlots.length / optimization.peakDemandHours.length) * 100)
    : 50;

  // Off-peak fill rate
  const offPeakHours = optimization.offPeakHours;
  const offPeakBookings = patterns.hourlyDistribution
    .filter(h => offPeakHours.includes(h.hour))
    .reduce((sum, h) => sum + h.bookings, 0);
  const totalOffPeakSlots = offPeakHours.length * 4; // ~4 weeks
  const offPeakFillRate = totalOffPeakSlots > 0
    ? Math.min(100, (offPeakBookings / totalOffPeakSlots) * 100)
    : 0;

  // Buffer adequacy (assumes 85%+ of bookings have 15+ min gaps)
  const bufferAdequacy = 75; // Simplified calculation

  // Weighted overall score
  const overallScore = Math.round(
    (utilizationScore * 0.35) +
    (peakCoverage * 0.30) +
    (offPeakFillRate * 0.20) +
    (bufferAdequacy * 0.15)
  );

  const recommendations: string[] = [];

  if (utilizationScore < 50) {
    recommendations.push('Increase your weekly availability hours to improve utilization.');
  }

  if (peakCoverage < 70) {
    recommendations.push('Ensure you have availability during your peak demand hours.');
  }

  if (offPeakFillRate < 30) {
    recommendations.push('Promote off-peak hours with discounts to improve fill rate.');
  }

  return {
    overallScore,
    components: {
      utilization: Math.round(utilizationScore),
      peakCoverage: Math.round(peakCoverage),
      offPeakFillRate: Math.round(offPeakFillRate),
      bufferAdequacy: Math.round(bufferAdequacy)
    },
    recommendations
  };
};

// ============================================
// CLEAR CACHE
// ============================================

export const clearScheduleCache = async (providerId: string): Promise<void> => {
  try {
    const patterns = [
      `schedule:patterns:${providerId}:*`,
      `schedule:optimal:${providerId}:*`,
      `schedule:gaps:${providerId}:*`
    ];

    for (const pattern of patterns) {
      const keys = await cache.keys(pattern);
      if (keys.length > 0) {
        await cache.del(...keys);
      }
    }

    logger.info('Schedule cache cleared', { providerId });
  } catch (error) {
    logger.error('Failed to clear schedule cache', { error, providerId });
  }
};

// ============================================
// EXPORTS
// ============================================

export default {
  analyzeBookingPatterns,
  getOptimalSchedule,
  getAvailabilityGaps,
  getPeakDemandAnalysis,
  detectScheduleConflicts,
  getScheduleEfficiencyScore,
  clearScheduleCache
};
