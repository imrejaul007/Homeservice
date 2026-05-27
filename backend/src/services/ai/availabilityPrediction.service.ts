// AI Availability Prediction Service - Provider Availability Forecasting
import { Types } from 'mongoose';
import Booking from '../../models/booking.model';
import ProviderProfile from '../../models/providerProfile.model';
import Service from '../../models/service.model';
import logger from '../../utils/logger';
import { circuitBreaker, CIRCUIT_NAMES } from '../../services/circuitBreaker.service';
import { withRetry } from '../../utils/retry.util';

// Types
export interface AvailabilityForecast {
  providerId: string;
  date: Date;
  predictions: HourlyAvailability[];
  summary: AvailabilitySummary;
  metadata: AvailabilityMetadata;
}

export interface HourlyAvailability {
  hour: number;
  isAvailable: boolean;
  confidence: number;
  bookedSlots: number;
  totalSlots: number;
  availabilityLevel: 'high' | 'medium' | 'low' | 'full';
  waitlistProbability: number;
}

export interface AvailabilitySummary {
  mostAvailableHour: number;
  leastAvailableHour: number;
  totalAvailableSlots: number;
  peakHours: number[];
  offPeakHours: number[];
  recommendation: string;
}

export interface AvailabilityMetadata {
  modelVersion: string;
  calculatedAt: Date;
  historicalDataDays: number;
  accuracy?: number;
}

export interface SlotRecommendation {
  date: Date;
  hour: number;
  confidence: number;
  reason: string;
  alternatives: { date: Date; hour: number; confidence: number }[];
}

export interface ProviderAvailabilityRequest {
  providerId: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  serviceId?: string;
  duration?: number; // minutes
}

// Constants
const DEFAULT_WORKING_HOURS = {
  start: 9,
  end: 21,
};

const BOOKING_DURATION_MINUTES = 60; // Default booking duration

// Feature Extraction
async function getProviderBookingHistory(
  providerId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  hourlyPatterns: Map<number, { bookings: number; cancellations: number }>;
  dayOfWeekPatterns: Map<number, { bookings: number; cancellations: number }>;
  avgBookingsPerDay: number;
  cancellationRate: number;
}> {
  const bookings = await Booking.find({
    providerId: new Types.ObjectId(providerId),
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean();

  const hourlyPatterns = new Map<number, { bookings: number; cancellations: number }>();
  const dayOfWeekPatterns = new Map<number, { bookings: number; cancellations: number }>();

  let totalBookings = 0;
  let totalCancellations = 0;

  bookings.forEach(booking => {
    const scheduledAt = new Date(booking.scheduledDate || booking.createdAt);
    const hour = scheduledAt.getHours();
    const dayOfWeek = scheduledAt.getDay();

    // Hourly patterns
    const hourly = hourlyPatterns.get(hour) || { bookings: 0, cancellations: 0 };
    if (booking.status === 'cancelled' || booking.status === 'no_show') {
      hourly.cancellations++;
      totalCancellations++;
    } else {
      hourly.bookings++;
      totalBookings++;
    }
    hourlyPatterns.set(hour, hourly);

    // Day of week patterns
    const daily = dayOfWeekPatterns.get(dayOfWeek) || { bookings: 0, cancellations: 0 };
    if (booking.status === 'cancelled' || booking.status === 'no_show') {
      daily.cancellations++;
    } else {
      daily.bookings++;
    }
    dayOfWeekPatterns.set(dayOfWeek, daily);
  });

  const daysDiff = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const avgBookingsPerDay = totalBookings / daysDiff;
  const cancellationRate = totalBookings > 0 ? totalCancellations / (totalBookings + totalCancellations) : 0;

  return {
    hourlyPatterns,
    dayOfWeekPatterns,
    avgBookingsPerDay,
    cancellationRate,
  };
}

async function getProviderSchedule(providerId: string): Promise<{
  workingHours: { start: number; end: number };
  weeklySchedule: Record<number, { start: string; end: string; isActive: boolean }[]>;
  dateOverrides: Map<string, boolean>;
}> {
  const profile = await ProviderProfile.findOne({ userId: providerId }).lean();

  if (!profile?.availability) {
    return {
      workingHours: DEFAULT_WORKING_HOURS,
      weeklySchedule: {},
      dateOverrides: new Map(),
    };
  }

  const weeklySchedule = new Map<number, { start: string; end: string; isActive: boolean }[]>();

  // Parse weekly schedule
  Object.entries(profile.availability.schedule || {}).forEach(([day, schedule]: [string, any]) => {
    if (schedule && typeof schedule === 'object') {
      const slots = schedule.timeSlots?.map((slot: { startTime: string; endTime: string }) => ({
        start: slot.startTime,
        end: slot.endTime,
        isActive: true,
      })) || [];
      weeklySchedule.set(parseInt(day), slots);
    }
  });

  // Parse date overrides (from exceptions)
  const dateOverrides = new Map<string, boolean>();
  profile.availability.exceptions?.forEach((exception: any) => {
    const dateKey = new Date(exception.date).toISOString().split('T')[0];
    const isAvailable = exception.type === 'available' || exception.isAvailable === true;
    dateOverrides.set(dateKey, isAvailable);
  });

  return {
    workingHours: DEFAULT_WORKING_HOURS,
    weeklySchedule: Object.fromEntries(weeklySchedule),
    dateOverrides,
  };
}

// Prediction Functions
function predictHourlyAvailability(
  hour: number,
  dayOfWeek: number,
  bookingHistory: ReturnType<typeof getProviderBookingHistory> extends Promise<infer T> ? T : never,
  schedule: Awaited<ReturnType<typeof getProviderSchedule>>,
  bookedSlots: number
): HourlyAvailability {
  const workingHours = schedule.workingHours;

  // Check if within working hours
  if (hour < workingHours.start || hour >= workingHours.end) {
    return {
      hour,
      isAvailable: false,
      confidence: 1.0,
      bookedSlots: 0,
      totalSlots: 0,
      availabilityLevel: 'full',
      waitlistProbability: 0,
    };
  }

  // Check day schedule
  const daySchedule = schedule.weeklySchedule[dayOfWeek];
  if (daySchedule && !daySchedule.some(s => s.isActive && isHourInSlot(hour, s.start, s.end))) {
    return {
      hour,
      isAvailable: false,
      confidence: 0.9,
      bookedSlots: 0,
      totalSlots: 0,
      availabilityLevel: 'full',
      waitlistProbability: 0,
    };
  }

  // Calculate total slots for this hour
  const totalSlots = 2; // slots per hour

  // Calculate historical demand for this hour
  const hourlyData = bookingHistory.hourlyPatterns.get(hour);
  const historicalAvgBookings = hourlyData ? hourlyData.bookings / 90 : 1; // 90 days of history

  // Adjust for day of week
  const dayData = bookingHistory.dayOfWeekPatterns.get(dayOfWeek);
  const dayFactor = dayData ? (dayData.bookings / Math.max(1, bookingHistory.avgBookingsPerDay)) : 1;

  // Calculate expected demand
  const expectedDemand = historicalAvgBookings * dayFactor;

  // Calculate availability
  const effectiveBooked = Math.max(bookedSlots, expectedDemand);
  const availableSlots = Math.max(0, totalSlots - effectiveBooked);
  const utilizationRate = effectiveBooked / totalSlots;

  // Determine availability level
  let availabilityLevel: HourlyAvailability['availabilityLevel'];
  if (utilizationRate >= 1.0) {
    availabilityLevel = 'full';
  } else if (utilizationRate >= 0.7) {
    availabilityLevel = 'low';
  } else if (utilizationRate >= 0.3) {
    availabilityLevel = 'medium';
  } else {
    availabilityLevel = 'high';
  }

  // Calculate waitlist probability
  const waitlistProbability = utilizationRate > 0.8
    ? (utilizationRate - 0.8) / 0.2
    : 0;

  // Calculate confidence based on historical data quality
  const historicalDataPoints = hourlyData ? hourlyData.bookings + hourlyData.cancellations : 0;
  const confidence = Math.min(0.95, 0.5 + (historicalDataPoints / 100) * 0.4 + 0.1);

  return {
    hour,
    isAvailable: availableSlots > 0,
    confidence,
    bookedSlots: effectiveBooked,
    totalSlots,
    availabilityLevel,
    waitlistProbability: Math.min(0.9, waitlistProbability),
  };
}

function isHourInSlot(hour: number, start: string, end: string): boolean {
  const slotStart = parseInt(start.split(':')[0]);
  const slotEnd = parseInt(end.split(':')[0]);
  return hour >= slotStart && hour < slotEnd;
}

// Main Availability Prediction Service
export class AvailabilityPredictionService {
  private modelVersion = 'v1.0.0';

  async predictAvailability(
    request: ProviderAvailabilityRequest
  ): Promise<AvailabilityForecast[]> {
    return circuitBreaker.execute(
      CIRCUIT_NAMES.AI_PREDICTION,
      async () => {
        return withRetry(
          async () => {
            const { providerId, dateRange } = request;

            // Get historical data (last 90 days)
            const endDate = new Date();
            const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

            const [bookingHistory, schedule, existingBookings] = await Promise.all([
              getProviderBookingHistory(providerId, startDate, endDate),
              getProviderSchedule(providerId),
              Booking.find({
                providerId: new Types.ObjectId(providerId),
                scheduledDate: { $gte: dateRange.start, $lte: dateRange.end },
                status: { $in: ['pending', 'confirmed', 'in_progress'] },
              }).lean(),
            ]);

            // Count bookings per hour
            const bookingsPerHour = new Map<string, number>();
            existingBookings.forEach(booking => {
              const scheduledAt = new Date(booking.scheduledDate);
              const dateKey = scheduledAt.toISOString().split('T')[0];
              const hourKey = `${dateKey}_${scheduledAt.getHours()}`;
              bookingsPerHour.set(hourKey, (bookingsPerHour.get(hourKey) || 0) + 1);
            });

            // Generate predictions for each day
            const forecasts: AvailabilityForecast[] = [];
            let currentDate = new Date(dateRange.start);

            while (currentDate <= dateRange.end) {
              const dayOfWeek = currentDate.getDay();
              const dateKey = currentDate.toISOString().split('T')[0];

              const predictions: HourlyAvailability[] = [];
              const workingHours = schedule.workingHours;

              for (let hour = workingHours.start; hour < workingHours.end; hour++) {
                const hourKey = `${dateKey}_${hour}`;
                const bookedSlots = bookingsPerHour.get(hourKey) || 0;

                const prediction = predictHourlyAvailability(
                  hour,
                  dayOfWeek,
                  bookingHistory,
                  schedule,
                  bookedSlots
                );
                predictions.push(prediction);
              }

              // Calculate summary
              const availableHours = predictions.filter(p => p.isAvailable);
              const mostAvailable = availableHours.reduce(
                (best, curr) => (curr.totalSlots - curr.bookedSlots) > (best.totalSlots - best.bookedSlots) ? curr : best,
                { hour: 0, bookedSlots: Infinity, totalSlots: 0 } as HourlyAvailability
              );

              const leastAvailable = availableHours.reduce(
                (worst, curr) => curr.availabilityLevel === 'low' || curr.availabilityLevel === 'full' ? curr : worst,
                availableHours[0] || null
              );

              const peakHours = predictions
                .filter(p => p.availabilityLevel === 'full' || p.availabilityLevel === 'low')
                .map(p => p.hour);

              const offPeakHours = predictions
                .filter(p => p.availabilityLevel === 'high')
                .map(p => p.hour);

              forecasts.push({
                providerId,
                date: new Date(currentDate),
                predictions,
                summary: {
                  mostAvailableHour: mostAvailable?.hour || 12,
                  leastAvailableHour: leastAvailable?.hour || 18,
                  totalAvailableSlots: availableHours.reduce((sum, h) => sum + (h.totalSlots - h.bookedSlots), 0),
                  peakHours,
                  offPeakHours,
                  recommendation: generateRecommendation(predictions, peakHours),
                },
                metadata: {
                  modelVersion: this.modelVersion,
                  calculatedAt: new Date(),
                  historicalDataDays: 90,
                },
              });

              currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
            }

            logger.info('Availability forecast generated', {
              providerId,
              daysForecasted: forecasts.length,
            });

            return forecasts;
          },
          { maxAttempts: 2, initialDelayMs: 300 }
        ).then(result => {
          if (!result.success) {
            throw result.error || new Error('Availability prediction failed');
          }
          return result.result!;
        });
      },
      async () => {
        // Fallback: return default schedule
        return [{
          providerId: request.providerId,
          date: request.dateRange.start,
          predictions: [],
          summary: {
            mostAvailableHour: 10,
            leastAvailableHour: 18,
            totalAvailableSlots: 20,
            peakHours: [],
            offPeakHours: [],
            recommendation: 'Unable to generate availability forecast',
          },
          metadata: {
            modelVersion: 'fallback',
            calculatedAt: new Date(),
            historicalDataDays: 0,
          },
        }];
      }
    );
  }

  async getBestSlots(
    providerId: string,
    dateRange: { start: Date; end: Date },
    count: number = 3
  ): Promise<SlotRecommendation[]> {
    const forecasts = await this.predictAvailability({
      providerId,
      dateRange,
    });

    const recommendations: SlotRecommendation[] = [];

    for (const forecast of forecasts) {
      // Find high-availability slots
      const highAvailability = forecast.predictions
        .filter(p => p.isAvailable && p.availabilityLevel === 'high')
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, count);

      if (highAvailability.length > 0) {
        recommendations.push({
          date: forecast.date,
          hour: highAvailability[0].hour,
          confidence: highAvailability[0].confidence,
          reason: `${highAvailability[0].availabilityLevel} availability (${highAvailability[0].totalSlots - highAvailability[0].bookedSlots} slots)`,
          alternatives: highAvailability.slice(1).map(h => ({
            date: forecast.date,
            hour: h.hour,
            confidence: h.confidence,
          })),
        });
      }
    }

    return recommendations.slice(0, count);
  }

  async predictNextAvailable(
    providerId: string,
    afterDate?: Date
  ): Promise<{ date: Date; hour: number; confidence: number } | null> {
    const startDate = afterDate || new Date();
    const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const forecasts = await this.predictAvailability({
      providerId,
      dateRange: { start: startDate, end: endDate },
    });

    for (const forecast of forecasts) {
      const availableSlots = forecast.predictions
        .filter(p => p.isAvailable && p.availabilityLevel !== 'full');

      if (availableSlots.length > 0) {
        const best = availableSlots.sort((a, b) => b.confidence - a.confidence)[0];
        return {
          date: forecast.date,
          hour: best.hour,
          confidence: best.confidence,
        };
      }
    }

    return null;
  }
}

function generateRecommendation(
  predictions: HourlyAvailability[],
  peakHours: number[]
): string {
  const highAvailability = predictions.filter(p => p.availabilityLevel === 'high');
  const lowAvailability = predictions.filter(p => p.availabilityLevel === 'low' || p.availabilityLevel === 'full');

  if (highAvailability.length === 0 && lowAvailability.length === 0) {
    return 'No specific availability data available';
  }

  if (highAvailability.length > lowAvailability.length * 2) {
    const bestHour = highAvailability[0]?.hour || 10;
    return `Book during morning hours (${bestHour}:00) for best availability`;
  }

  if (lowAvailability.length > highAvailability.length) {
    return `High demand period - book ${peakHours[0] - 1}:00 or earlier for better availability`;
  }

  return 'Standard availability - book 24+ hours in advance for best slots';
}

export const availabilityPredictionService = new AvailabilityPredictionService();
export default availabilityPredictionService;
