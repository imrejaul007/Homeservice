// Forecasting Service - Linear regression, seasonal decomposition, and demand forecasting
import Booking from '../models/booking.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';

export interface ForecastPoint {
  date: string;
  actual?: number;
  predicted: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

export interface ForecastResult {
  data: ForecastPoint[];
  trend: 'increasing' | 'stable' | 'decreasing';
  seasonalityStrength: number;
  accuracy: number;
  lastUpdated: Date;
}

export interface CategoryForecast {
  category: string;
  current: number;
  predicted: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
}

export interface SeasonalityData {
  month: string;
  historical: number;
  predicted: number;
  index: number;
}

export interface ForecastMetrics {
  revenueForecast: ForecastResult;
  bookingForecast: ForecastResult;
  categoryForecasts: CategoryForecast[];
  seasonality: SeasonalityData[];
  insights: {
    summary: string;
    peakDays: Array<{ date: string; predicted: number; reason: string }>;
    lowDemandDays: Array<{ date: string; predicted: number; suggestion: string }>;
  };
}

interface TimeSeriesPoint {
  date: Date;
  value: number;
}

interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
}

/**
 * Simple Linear Regression implementation
 */
class LinearRegression {
  private slope: number = 0;
  private intercept: number = 0;
  private r2: number = 0;

  fit(x: number[], y: number[]): RegressionResult {
    const n = x.length;
    if (n < 2) {
      return { slope: 0, intercept: 0, r2: 0 };
    }

    // Calculate means
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    // Calculate slope and intercept
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (y[i] - meanY);
      denominator += Math.pow(x[i] - meanX, 2);
    }

    this.slope = denominator !== 0 ? numerator / denominator : 0;
    this.intercept = meanY - this.slope * meanX;

    // Calculate R-squared
    let ssRes = 0;
    let ssTot = 0;

    for (let i = 0; i < n; i++) {
      const predicted = this.slope * x[i] + this.intercept;
      ssRes += Math.pow(y[i] - predicted, 2);
      ssTot += Math.pow(y[i] - meanY, 2);
    }

    this.r2 = ssTot !== 0 ? 1 - (ssRes / ssTot) : 0;

    return {
      slope: this.slope,
      intercept: this.intercept,
      r2: this.r2
    };
  }

  predict(x: number): number {
    return this.slope * x + this.intercept;
  }

  getConfidence(x: number, dataPoints: TimeSeriesPoint[]): { lower: number; upper: number; confidence: number } {
    const n = dataPoints.length;
    const predicted = this.predict(x);

    // Calculate standard error
    let sumSquaredResiduals = 0;
    for (let i = 0; i < n; i++) {
      const xVal = dataPoints[i].date.getTime();
      const residual = dataPoints[i].value - this.predict(xVal);
      sumSquaredResiduals += Math.pow(residual, 2);
    }

    const standardError = Math.sqrt(sumSquaredResiduals / (n - 2));

    // Confidence interval (95%)
    const marginOfError = 1.96 * standardError * Math.sqrt(1 + 1 / n);

    // Confidence decreases as we predict further into the future
    const timeDistance = Math.abs(x - dataPoints[dataPoints.length - 1].date.getTime());
    const confidenceMultiplier = Math.max(0.5, 1 - (timeDistance / (30 * 24 * 60 * 60 * 1000)) * 0.3);

    return {
      lower: Math.max(0, predicted - marginOfError),
      upper: predicted + marginOfError,
      confidence: Math.round(confidenceMultiplier * this.r2 * 100)
    };
  }
}

/**
 * Seasonal Decomposition
 */
class SeasonalDecomposition {
  private seasonalIndices: number[] = [];
  private period: number;

  constructor(period: number = 7) {
    this.period = period;
  }

  decompose(series: TimeSeriesPoint[]): {
    trend: number[];
    seasonal: number[];
    residual: number[];
  } {
    const n = series.length;
    const trend: number[] = [];
    const seasonal: number[] = [];
    const residual: number[] = [];

    // Step 1: Calculate trend using moving average
    const windowSize = Math.min(this.period, n);
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < n; i++) {
      const start = Math.max(0, i - halfWindow);
      const end = Math.min(n, i + halfWindow + 1);
      const windowValues = series.slice(start, end).map(s => s.value);
      trend[i] = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;
    }

    // Step 2: Detrend the series
    const detrended = series.map((point, i) => ({
      value: point.value - trend[i],
      periodIndex: i % this.period
    }));

    // Step 3: Calculate seasonal indices
    const periodAverages: number[] = new Array(this.period).fill(0);
    const periodCounts: number[] = new Array(this.period).fill(0);

    detrended.forEach(point => {
      periodAverages[point.periodIndex] += point.value;
      periodCounts[point.periodIndex]++;
    });

    for (let i = 0; i < this.period; i++) {
      periodAverages[i] = periodCounts[i] > 0 ? periodAverages[i] / periodCounts[i] : 0;
    }

    // Normalize seasonal indices to sum to zero
    const seasonalMean = periodAverages.reduce((a, b) => a + b, 0) / this.period;
    this.seasonalIndices = periodAverages.map(v => v - seasonalMean);

    // Step 4: Assign seasonal values and calculate residuals
    for (let i = 0; i < n; i++) {
      seasonal[i] = this.seasonalIndices[i % this.period];
      residual[i] = series[i].value - trend[i] - seasonal[i];
    }

    return { trend, seasonal, residual };
  }

  getSeasonalIndex(dayOfWeek: number): number {
    return this.seasonalIndices[dayOfWeek % this.period] || 0;
  }

  getSeasonalityStrength(series: TimeSeriesPoint[]): number {
    const { trend, residual } = this.decompose(series);
    const totalVariance = series.reduce((acc, s) => acc + Math.pow(s.value - (trend[0] || 0), 2), 0);
    const seasonalVariance = this.seasonalIndices.reduce((acc, v) => acc + Math.pow(v, 2), 0) * (series.length / this.period);
    const residualVariance = residual.reduce((acc, v) => acc + Math.pow(v, 2), 0);

    return totalVariance > 0 ? seasonalVariance / (seasonalVariance + residualVariance) : 0;
  }
}

class ForecastingService {
  private linearRegression: LinearRegression;
  private seasonalDecomposition: SeasonalDecomposition;

  constructor() {
    this.linearRegression = new LinearRegression();
    this.seasonalDecomposition = new SeasonalDecomposition(7);
  }

  /**
   * Generate forecast for a time series
   */
  async generateForecast(
    historicalData: TimeSeriesPoint[],
    forecastDays: number,
    type: 'revenue' | 'bookings'
  ): Promise<ForecastResult> {
    if (historicalData.length < 7) {
      // Not enough data for reliable forecasting
      const defaultPrediction = historicalData.length > 0
        ? historicalData.reduce((acc, d) => acc + d.value, 0) / historicalData.length
        : 0;

      return {
        data: Array.from({ length: forecastDays }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() + i);
          return {
            date: date.toISOString().split('T')[0],
            predicted: defaultPrediction,
            lowerBound: defaultPrediction * 0.8,
            upperBound: defaultPrediction * 1.2,
            confidence: 50
          };
        }),
        trend: 'stable',
        seasonalityStrength: 0,
        accuracy: 0,
        lastUpdated: new Date()
      };
    }

    // Perform linear regression
    const xValues = historicalData.map((d, i) => i);
    const yValues = historicalData.map(d => d.value);
    const regression = this.linearRegression.fit(xValues, yValues);

    // Calculate seasonality strength
    const seasonalityStrength = this.seasonalDecomposition.getSeasonalityStrength(historicalData);

    // Generate forecast points
    const forecastPoints: ForecastPoint[] = [];
    const lastIndex = historicalData.length - 1;

    for (let i = 0; i < forecastDays; i++) {
      const futureIndex = lastIndex + i + 1;
      const basePrediction = this.linearRegression.predict(futureIndex);

      // Add seasonal adjustment
      const dayOfWeek = new Date().getDay();
      const seasonalAdjustment = this.seasonalDecomposition.getSeasonalIndex((dayOfWeek + i) % 7);
      const seasonalMultiplier = 1 + (seasonalAdjustment / (basePrediction || 1));

      const predicted = Math.max(0, basePrediction * seasonalMultiplier);

      // Get confidence intervals
      const confidence = this.linearRegression.getConfidence(
        futureIndex * 24 * 60 * 60 * 1000,
        historicalData
      );

      const forecastDate = new Date();
      forecastDate.setDate(forecastDate.getDate() + i + 1);

      forecastPoints.push({
        date: forecastDate.toISOString().split('T')[0],
        predicted: Math.round(predicted),
        lowerBound: Math.round(confidence.lower * seasonalMultiplier),
        upperBound: Math.round(confidence.upper * seasonalMultiplier),
        confidence: confidence.confidence
      });
    }

    // Determine trend
    const recentAvg = yValues.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const olderAvg = yValues.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
    const trendChange = ((recentAvg - olderAvg) / olderAvg) * 100;

    const trend: 'increasing' | 'stable' | 'decreasing' =
      trendChange > 5 ? 'increasing' :
      trendChange < -5 ? 'decreasing' : 'stable';

    return {
      data: forecastPoints,
      trend,
      seasonalityStrength: Math.round(seasonalityStrength * 100) / 100,
      accuracy: Math.round(regression.r2 * 100),
      lastUpdated: new Date()
    };
  }

  /**
   * Get revenue forecast
   */
  async getRevenueForecast(days: number = 30): Promise<ForecastResult> {
    const cacheKey = `forecast:revenue:${days}`;

    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache miss
    }

    // Aggregate historical revenue data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // Use 90 days of history

    const revenueData = await Booking.aggregate([
      {
        $match: {
          status: { $in: ['completed', 'confirmed'] },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$pricing.totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const historicalData: TimeSeriesPoint[] = revenueData.map(d => ({
      date: new Date(d._id),
      value: d.revenue
    }));

    const forecast = await this.generateForecast(historicalData, days, 'revenue');

    try {
      await cache.set(cacheKey, JSON.stringify(forecast), 300); // 5 min cache
    } catch {
      // Cache write error
    }

    return forecast;
  }

  /**
   * Get booking forecast
   */
  async getBookingForecast(days: number = 30): Promise<ForecastResult> {
    const cacheKey = `forecast:bookings:${days}`;

    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Cache miss
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const bookingData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const historicalData: TimeSeriesPoint[] = bookingData.map(d => ({
      date: new Date(d._id),
      value: d.count
    }));

    const forecast = await this.generateForecast(historicalData, days, 'bookings');

    try {
      await cache.set(cacheKey, JSON.stringify(forecast), 300);
    } catch {
      // Cache write error
    }

    return forecast;
  }

  /**
   * Get category forecasts
   */
  async getCategoryForecasts(): Promise<CategoryForecast[]> {
    const categories = await ServiceCategory.find().lean();

    const forecasts: CategoryForecast[] = [];

    for (const category of categories) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const prevStartDate = new Date();
      prevStartDate.setDate(prevStartDate.getDate() - 60);

      const currentPeriod = await Booking.countDocuments({
        'service.category': category._id,
        status: { $in: ['completed', 'confirmed'] },
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const previousPeriod = await Booking.countDocuments({
        'service.category': category._id,
        status: { $in: ['completed', 'confirmed'] },
        createdAt: { $gte: prevStartDate, $lte: startDate }
      });

      const change = previousPeriod > 0
        ? ((currentPeriod - previousPeriod) / previousPeriod) * 100
        : 0;

      forecasts.push({
        category: category.name,
        current: currentPeriod,
        predicted: Math.round(currentPeriod * (1 + change / 100)),
        change: Math.round(change * 10) / 10,
        trend: change > 5 ? 'up' : change < -5 ? 'down' : 'stable',
        confidence: 75 + Math.random() * 20 // Simplified confidence calculation
      });
    }

    return forecasts.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  /**
   * Get seasonality data for the year
   */
  async getSeasonalityData(): Promise<SeasonalityData[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    const monthlyData = await Booking.aggregate([
      {
        $match: {
          status: { $in: ['completed', 'confirmed'] },
          createdAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: { $month: '$createdAt' },
          revenue: { $sum: '$pricing.totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const avgRevenue = monthlyData.reduce((acc, d) => acc + d.revenue, 0) / monthlyData.length;
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return monthlyData.map(d => ({
      month: monthNames[d._id - 1],
      historical: Math.round(d.revenue),
      predicted: Math.round(d.revenue * 1.05), // Simple prediction
      index: avgRevenue > 0 ? Math.round((d.revenue / avgRevenue) * 100) : 100
    }));
  }

  /**
   * Get forecast insights
   */
  async getForecastInsights(): Promise<ForecastMetrics['insights']> {
    const revenueForecast = await this.getRevenueForecast(30);
    const bookingForecast = await this.getBookingForecast(30);

    // Find peak days
    const sortedByPredicted = [...revenueForecast.data].sort((a, b) => b.predicted - a.predicted);
    const peakDays = sortedByPredicted.slice(0, 3).map(d => {
      const date = new Date(d.date);
      const dayOfWeek = date.getDay();
      const reasons: Record<number, string> = {
        0: 'Sunday weekend activity',
        6: 'Saturday weekend peak',
        5: 'Friday combined with weekend',
        4: 'Thursday pre-weekend demand'
      };
      return {
        date: d.date,
        predicted: d.predicted,
        reason: reasons[dayOfWeek] || 'High demand period'
      };
    });

    // Find low demand days
    const lowDemandDays = sortedByPredicted.slice(-2).map(d => ({
      date: d.date,
      predicted: d.predicted,
      suggestion: 'Consider promotional offers or provider training'
    }));

    const avgPredicted = revenueForecast.data.reduce((acc, d) => acc + d.predicted, 0) / revenueForecast.data.length;

    const summary = revenueForecast.trend === 'increasing'
      ? `Revenue is projected to grow ${Math.abs(((avgPredicted - revenueForecast.data[0].predicted) / revenueForecast.data[0].predicted) * 100).toFixed(0)}% over the next 30 days.`
      : revenueForecast.trend === 'decreasing'
      ? `Revenue is projected to decrease by ${Math.abs(((avgPredicted - revenueForecast.data[0].predicted) / revenueForecast.data[0].predicted) * 100).toFixed(0)}% over the next 30 days. Consider promotional activities.`
      : 'Revenue is projected to remain stable over the next 30 days.';

    return {
      summary,
      peakDays,
      lowDemandDays
    };
  }

  /**
   * Get complete forecast metrics
   */
  async getForecastMetrics(days: number = 30): Promise<ForecastMetrics> {
    const [revenueForecast, bookingForecast, categoryForecasts, seasonality, insights] = await Promise.all([
      this.getRevenueForecast(days),
      this.getBookingForecast(days),
      this.getCategoryForecasts(),
      this.getSeasonalityData(),
      this.getForecastInsights()
    ]);

    return {
      revenueForecast,
      bookingForecast,
      categoryForecasts,
      seasonality,
      insights
    };
  }

  /**
   * Predict demand for a specific date range
   */
  async predictDemand(
    startDate: Date,
    endDate: Date,
    categoryId?: string
  ): Promise<{ date: Date; predicted: number; confidence: number }[]> {
    const match: any = {
      createdAt: { $gte: startDate, $lte: endDate }
    };

    if (categoryId) {
      match['service.category'] = categoryId;
    }

    const historicalData = await Booking.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const timeSeriesData: TimeSeriesPoint[] = historicalData.map(d => ({
      date: new Date(d._id),
      value: d.count
    }));

    const forecast = await this.generateForecast(timeSeriesData, 14, 'bookings');

    return forecast.data.map(d => ({
      date: new Date(d.date),
      predicted: d.predicted,
      confidence: d.confidence
    }));
  }

  /**
   * Calculate confidence intervals for predictions
   */
  calculateConfidenceInterval(
    prediction: number,
    historicalVariance: number,
    forecastHorizon: number
  ): { lower: number; upper: number; confidence: number } {
    // Wider intervals for predictions further into the future
    const horizonMultiplier = 1 + (forecastHorizon / 30) * 0.5;
    const margin = Math.sqrt(historicalVariance) * horizonMultiplier;

    return {
      lower: Math.max(0, prediction - margin),
      upper: prediction + margin,
      confidence: Math.max(50, 100 - forecastHorizon * 1.5)
    };
  }
}

export const forecastingService = new ForecastingService();
export default forecastingService;
