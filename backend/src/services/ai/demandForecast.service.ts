import Booking from '../../models/booking.model';
import Service from '../../models/service.model';
import ServiceCategory from '../../models/serviceCategory.model';
import logger from '../../utils/logger';

export interface DemandForecast {
  serviceId?: string;
  category?: string;
  date: Date;
  predictedDemand: number;
  confidence: number;
  peakHours: HourForecast[];
  trend: 'increasing' | 'stable' | 'decreasing';
  factors: string[];
}

export interface HourForecast {
  hour: number;
  predictedBookings: number;
  confidence: number;
}

export interface RegionalDemand {
  region: string;
  demand: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  topServices: string[];
}

class DemandForecastService {
  /**
   * Get demand forecast for a service
   */
  async forecastServiceDemand(
    serviceId: string,
    daysAhead: number = 7
  ): Promise<DemandForecast[]> {
    try {
      const forecasts: DemandForecast[] = [];

      for (let i = 0; i < daysAhead; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);

        const forecast = await this.forecastForDate(serviceId, date);
        forecasts.push(forecast);
      }

      return forecasts;
    } catch (error) {
      logger.error('Demand forecast error', { error, serviceId });
      return [];
    }
  }

  /**
   * Get category demand forecast
   */
  async forecastCategoryDemand(
    categoryId: string,
    daysAhead: number = 7
  ): Promise<DemandForecast[]> {
    try {
      const forecasts: DemandForecast[] = [];
      const category = await ServiceCategory.findById(categoryId);

      for (let i = 0; i < daysAhead; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i);

        const forecast = await this.forecastCategoryForDate(categoryId, date, category?.name);
        forecasts.push(forecast);
      }

      return forecasts;
    } catch (error) {
      logger.error('Category forecast error', { error, categoryId });
      return [];
    }
  }

  /**
   * Get peak hours prediction
   */
  async getPeakHours(date: Date): Promise<HourForecast[]> {
    try {
      // Get historical booking patterns for this day of week
      const dayOfWeek = date.getDay();
      const historicalBookings = await Booking.aggregate([
        {
          $match: {
            $expr: { $eq: [{ $dayOfWeek: '$createdAt' }, dayOfWeek + 1] },
            status: { $in: ['completed', 'confirmed', 'pending'] },
          },
        },
        {
          $group: {
            _id: { $hour: '$scheduledTime' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Calculate average for each hour
      const avgBookings = historicalBookings.length > 0
        ? historicalBookings.reduce((sum, h) => sum + h.count, 0) / historicalBookings.length
        : 1;

      // Generate hourly forecast
      const hourForecasts: HourForecast[] = [];

      for (let hour = 8; hour <= 22; hour++) {
        const historical = historicalBookings.find(h => h._id === hour);
        const baseDemand = historical ? historical.count : avgBookings * 0.3;

        // Apply time-of-day multipliers
        let multiplier = 1;
        if (hour >= 9 && hour <= 11) multiplier = 1.5; // Morning peak
        if (hour >= 14 && hour <= 17) multiplier = 1.3; // Afternoon peak
        if (hour >= 18 && hour <= 20) multiplier = 1.4; // Evening peak
        if (hour < 9 || hour > 20) multiplier = 0.2; // Off hours

        hourForecasts.push({
          hour,
          predictedBookings: Math.round(baseDemand * multiplier * 10) / 10,
          confidence: historical ? 0.8 : 0.5,
        });
      }

      return hourForecasts;
    } catch (error) {
      logger.error('Peak hours forecast error', { error });
      return [];
    }
  }

  /**
   * Get regional demand analysis
   */
  async getRegionalDemand(): Promise<RegionalDemand[]> {
    try {
      const regionalData = await Booking.aggregate([
        { $match: { status: { $in: ['completed', 'confirmed'] } } },
        { $unwind: '$location' },
        {
          $group: {
            _id: '$location.city',
            demand: { $sum: 1 },
            services: { $push: '$serviceId' },
          },
        },
        { $sort: { demand: -1 } },
      ]);

      return regionalData.map(r => ({
        region: r._id || 'Unknown',
        demand: r.demand,
        trend: 'stable' as const, // Would need historical comparison
        topServices: r.services.slice(0, 5),
      }));
    } catch (error) {
      logger.error('Regional demand error', { error });
      return [];
    }
  }

  /**
   * Get smart pricing multiplier based on demand
   */
  async getDemandMultiplier(serviceId: string, date: Date, hour: number): Promise<number> {
    try {
      const forecast = await this.forecastForDate(serviceId, date);
      const hourForecast = forecast.peakHours.find(h => h.hour === hour);

      if (!hourForecast) return 1;

      // Calculate multiplier based on demand level
      const avgDemand = forecast.predictedDemand / forecast.peakHours.length;
      const hourDemand = hourForecast.predictedBookings;

      let multiplier = 1;

      if (hourDemand > avgDemand * 1.5) {
        multiplier = 1.2; // High demand - premium pricing
      } else if (hourDemand > avgDemand * 1.2) {
        multiplier = 1.1;
      } else if (hourDemand < avgDemand * 0.5) {
        multiplier = 0.9; // Low demand - discount
      }

      // Apply day of week factor
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Weekend - higher demand
        multiplier *= 1.15;
      }

      return Math.round(multiplier * 100) / 100;
    } catch (error) {
      logger.error('Demand multiplier error', { error });
      return 1;
    }
  }

  private async forecastForDate(serviceId: string, date: Date): Promise<DemandForecast> {
    // Get historical bookings for similar dates
    const historical = await this.getHistoricalDemand(serviceId, date);

    // Calculate predicted demand
    const predictedDemand = this.calculatePredictedDemand(historical, date);

    // Get peak hours
    const peakHours = await this.getPeakHours(date);

    // Calculate trend
    const trend = this.calculateTrend(historical);

    return {
      serviceId,
      date,
      predictedDemand,
      confidence: this.calculateConfidence(historical),
      peakHours,
      trend,
      factors: this.identifyDemandFactors(date),
    };
  }

  private async forecastCategoryForDate(
    categoryId: string,
    date: Date,
    categoryName?: string
  ): Promise<DemandForecast> {
    const historical = await this.getCategoryHistoricalDemand(categoryId, date);
    const predictedDemand = this.calculatePredictedDemand(historical, date);
    const peakHours = await this.getPeakHours(date);
    const trend = this.calculateTrend(historical);

    return {
      category: categoryName || categoryId,
      date,
      predictedDemand,
      confidence: this.calculateConfidence(historical),
      peakHours,
      trend,
      factors: this.identifyDemandFactors(date),
    };
  }

  private async getHistoricalDemand(serviceId: string, targetDate: Date): Promise<number[]> {
    const dayOfWeek = targetDate.getDay();
    const historicalData: number[] = [];

    // Get bookings from same day of week in past 8 weeks
    for (let week = 1; week <= 8; week++) {
      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - week * 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const bookings = await Booking.countDocuments({
        serviceId,
        createdAt: { $gte: startDate, $lt: endDate },
        status: { $in: ['completed', 'confirmed'] },
      });

      historicalData.push(bookings);
    }

    return historicalData;
  }

  private async getCategoryHistoricalDemand(categoryId: string, targetDate: Date): Promise<number[]> {
    const historicalData: number[] = [];

    for (let week = 1; week <= 8; week++) {
      const startDate = new Date(targetDate);
      startDate.setDate(startDate.getDate() - week * 7);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      const bookings = await Booking.countDocuments({
        serviceId: { $in: await Service.distinct('_id', { category: categoryId }) },
        createdAt: { $gte: startDate, $lt: endDate },
        status: { $in: ['completed', 'confirmed'] },
      });

      historicalData.push(bookings);
    }

    return historicalData;
  }

  private calculatePredictedDemand(historical: number[], date: Date): number {
    if (historical.length === 0) return 0;

    // Simple average
    const avg = historical.reduce((a, b) => a + b, 0) / historical.length;

    // Apply seasonal adjustment
    const month = date.getMonth();
    let seasonalMultiplier = 1;

    // Peak months (summer for AC services, etc.)
    if (month >= 4 && month <= 9) {
      seasonalMultiplier = 1.2;
    }

    return Math.round(avg * seasonalMultiplier);
  }

  private calculateTrend(historical: number[]): 'increasing' | 'stable' | 'decreasing' {
    if (historical.length < 3) return 'stable';

    // Compare recent vs older data
    const recent = historical.slice(0, Math.floor(historical.length / 2));
    const older = historical.slice(Math.floor(historical.length / 2));

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const changePercent = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (changePercent > 10) return 'increasing';
    if (changePercent < -10) return 'decreasing';
    return 'stable';
  }

  private calculateConfidence(historical: number[]): number {
    if (historical.length === 0) return 0;

    // More historical data = higher confidence
    const dataConfidence = Math.min(historical.length / 8, 1) * 0.5;

    // Lower variance = higher confidence
    const avg = historical.reduce((a, b) => a + b, 0) / historical.length;
    const variance = historical.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / historical.length;
    const stdDev = Math.sqrt(variance);
    const varianceConfidence = Math.max(0, 1 - (stdDev / (avg || 1))) * 0.5;

    return Math.round((dataConfidence + varianceConfidence) * 100) / 100;
  }

  private identifyDemandFactors(date: Date): string[] {
    const factors: string[] = [];

    // Day of week
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    factors.push(`It is ${days[date.getDay()]}`);

    // Weekend effect
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      factors.push('Weekend - typically higher demand');
    }

    // Holiday effect (simplified)
    const month = date.getMonth();
    if (month === 11) {
      factors.push('Holiday season - elevated demand');
    }

    return factors;
  }
}

export const demandForecastService = new DemandForecastService();
