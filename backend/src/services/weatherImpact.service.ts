// Weather Impact Service - Weather API integration and demand correlation analysis
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { cache } from '../config/redis';

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy';

export interface WeatherDataPoint {
  date: string;
  condition: WeatherCondition;
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  bookings: number;
  revenue: number;
}

export interface WeatherCorrelation {
  condition: WeatherCondition;
  label: string;
  avgBookings: number;
  avgRevenue: number;
  changePercent: number;
  sampleDays: number;
}

export interface SeasonWeatherData {
  season: string;
  avgTemperature: number;
  avgBookings: number;
  avgRainfall: number;
  demandMultiplier: number;
}

export interface WeatherForecast {
  date: string;
  condition: WeatherCondition;
  temperature: number;
  predictedBookings: number;
  confidence: number;
  recommendation: string;
}

export interface WeatherMetrics {
  overallCorrelation: number;
  strongestFactor: string;
  avgRainImpact: number;
  avgHeatImpact: number;
  bestWeather: WeatherCondition;
  worstWeather: WeatherCondition;
  weatherCorrelation: WeatherCorrelation[];
  dailyWeather: WeatherDataPoint[];
  seasonWeather: SeasonWeatherData[];
  forecastImpact: WeatherForecast[];
  weatherBreakdown: Array<{
    condition: WeatherCondition;
    days: number;
    percentage: number;
    avgBookings: number;
  }>;
  temperatureCorrelation: Array<{ temp: number; bookings: number }>;
  rainCorrelation: Array<{ rainfall: number; bookings: number }>;
}

// Weather API configuration (mock - replace with actual API)
const WEATHER_API_CONFIG = {
  provider: process.env.WEATHER_API_PROVIDER || 'mock',
  apiKey: process.env.WEATHER_API_KEY || '',
  baseUrl: process.env.WEATHER_API_URL || ''
};

interface ExternalWeatherResponse {
  date: string;
  condition: WeatherCondition;
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
}

/**
 * Weather API Client
 */
class WeatherAPIClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = WEATHER_API_CONFIG.apiKey;
    this.baseUrl = WEATHER_API_CONFIG.baseUrl;
  }

  /**
   * Fetch weather data for a date range
   */
  async getHistoricalWeather(
    startDate: Date,
    endDate: Date,
    location: string = 'Dubai'
  ): Promise<ExternalWeatherResponse[]> {
    // In production, this would call a real weather API like:
    // - OpenWeatherMap
    // - WeatherAPI
    // - AccuWeather

    // For demo purposes, generate mock data
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    const weatherData: ExternalWeatherResponse[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);

      // Generate realistic weather patterns
      const month = date.getMonth();
      const isSummer = month >= 5 && month <= 8;

      const baseTemp = isSummer ? 38 : 25;
      const tempVariance = isSummer ? 5 : 10;

      const rainChance = Math.random();
      let condition: WeatherCondition = 'sunny';
      let rainfall = 0;

      if (rainChance > 0.85) {
        condition = 'rainy';
        rainfall = 5 + Math.random() * 25;
      } else if (rainChance > 0.7) {
        condition = 'cloudy';
      }

      weatherData.push({
        date: date.toISOString().split('T')[0],
        condition,
        temperature: baseTemp + (Math.random() - 0.5) * tempVariance,
        humidity: 30 + Math.random() * 40,
        rainfall,
        windSpeed: 5 + Math.random() * 20
      });
    }

    return weatherData;
  }

  /**
   * Get weather forecast for upcoming days
   */
  async getForecast(location: string = 'Dubai', days: number = 7): Promise<ExternalWeatherResponse[]> {
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.getHistoricalWeather(today, endDate, location);
  }
}

/**
 * Weather Impact Analyzer
 */
class WeatherImpactAnalyzer {
  private weatherClient: WeatherAPIClient;

  constructor() {
    this.weatherClient = new WeatherAPIClient();
  }

  /**
   * Calculate correlation between weather and bookings
   */
  calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n < 2) return 0;

    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    const denom = Math.sqrt(denomX * denomY);
    return denom !== 0 ? numerator / denom : 0;
  }

  /**
   * Analyze weather impact on bookings
   */
  analyzeWeatherImpact(
    weatherData: WeatherDataPoint[],
    baselineBookings: number
  ): WeatherCorrelation[] {
    const correlations: WeatherCorrelation[] = [];
    const conditions: WeatherCondition[] = ['sunny', 'cloudy', 'rainy'];

    for (const condition of conditions) {
      const conditionData = weatherData.filter(w => w.condition === condition);

      if (conditionData.length === 0) continue;

      const avgBookings = conditionData.reduce((acc, d) => acc + d.bookings, 0) / conditionData.length;
      const avgRevenue = conditionData.reduce((acc, d) => acc + d.revenue, 0) / conditionData.length;
      const changePercent = ((avgBookings - baselineBookings) / baselineBookings) * 100;

      const labels: Record<WeatherCondition, string> = {
        sunny: 'Sunny / Clear',
        cloudy: 'Cloudy',
        rainy: 'Rainy',
        stormy: 'Stormy',
        snowy: 'Snowy',
        windy: 'Windy'
      };

      correlations.push({
        condition,
        label: labels[condition],
        avgBookings: Math.round(avgBookings),
        avgRevenue: Math.round(avgRevenue),
        changePercent: Math.round(changePercent * 10) / 10,
        sampleDays: conditionData.length
      });
    }

    return correlations.sort((a, b) => b.changePercent - a.changePercent);
  }

  /**
   * Calculate temperature impact
   */
  calculateTemperatureImpact(
    weatherData: WeatherDataPoint[]
  ): { avgHeatImpact: number; optimalRange: { min: number; max: number } } {
    // Group by temperature ranges
    const tempRanges: Record<string, number[]> = {};

    weatherData.forEach(d => {
      const tempRange = Math.floor(d.temperature / 5) * 5;
      const key = `${tempRange}-${tempRange + 5}`;
      if (!tempRanges[key]) tempRanges[key] = [];
      tempRanges[key].push(d.bookings);
    });

    // Find optimal temperature range
    let maxAvgBookings = 0;
    let optimalMin = 20;
    let optimalMax = 30;

    Object.entries(tempRanges).forEach(([range, bookings]) => {
      if (bookings.length >= 3) {
        const avg = bookings.reduce((a, b) => a + b, 0) / bookings.length;
        if (avg > maxAvgBookings) {
          maxAvgBookings = avg;
          const [min] = range.split('-').map(Number);
          optimalMin = min;
          optimalMax = min + 5;
        }
      }
    });

    // Calculate heat impact
    const hotDays = weatherData.filter(d => d.temperature > 35);
    const moderateDays = weatherData.filter(d => d.temperature >= 20 && d.temperature <= 30);

    const avgHotBookings = hotDays.length > 0
      ? hotDays.reduce((a, b) => a + b.bookings, 0) / hotDays.length
      : 0;
    const avgModerateBookings = moderateDays.length > 0
      ? moderateDays.reduce((a, b) => a + b.bookings, 0) / moderateDays.length
      : 0;

    const avgHeatImpact = avgModerateBookings > 0
      ? ((avgHotBookings - avgModerateBookings) / avgModerateBookings) * 100
      : 0;

    return { avgHeatImpact: Math.round(avgHeatImpact * 10) / 10, optimalRange: { min: optimalMin, max: optimalMax } };
  }

  /**
   * Calculate rainfall impact
   */
  calculateRainfallImpact(weatherData: WeatherDataPoint[]): number {
    const rainyDays = weatherData.filter(d => d.rainfall > 0);
    const nonRainyDays = weatherData.filter(d => d.rainfall === 0);

    if (rainyDays.length === 0 || nonRainyDays.length === 0) return 0;

    const avgRainyBookings = rainyDays.reduce((a, b) => a + b.bookings, 0) / rainyDays.length;
    const avgNonRainyBookings = nonRainyDays.reduce((a, b) => a + b.bookings, 0) / nonRainyDays.length;

    return Math.round(((avgRainyBookings - avgNonRainyBookings) / avgNonRainyBookings) * 100 * 10) / 10;
  }

  /**
   * Predict demand based on weather forecast
   */
  predictDemand(
    weatherForecast: ExternalWeatherResponse[],
    baselineBookings: number,
    weatherCorrelation: WeatherCorrelation[]
  ): WeatherForecast[] {
    return weatherForecast.map(w => {
      const correlation = weatherCorrelation.find(c => c.condition === w.condition);
      const baseChange = correlation?.changePercent || 0;

      // Adjust for temperature
      let tempAdjustment = 0;
      if (w.temperature > 38) tempAdjustment -= 10;
      else if (w.temperature > 35) tempAdjustment -= 5;
      else if (w.temperature < 20) tempAdjustment -= 3;

      // Adjust for rainfall
      if (w.rainfall > 20) tempAdjustment -= 25;
      else if (w.rainfall > 10) tempAdjustment -= 15;
      else if (w.rainfall > 0) tempAdjustment -= 10;

      const totalAdjustment = baseChange + tempAdjustment;
      const predictedBookings = Math.round(baselineBookings * (1 + totalAdjustment / 100));

      let recommendation = 'Normal operations';
      if (w.condition === 'rainy' && totalAdjustment < -15) {
        recommendation = 'Consider promotional offers to offset weather impact';
      } else if (w.condition === 'sunny' && totalAdjustment > 10) {
        recommendation = 'High demand expected - ensure provider coverage';
      }

      return {
        date: w.date,
        condition: w.condition,
        temperature: Math.round(w.temperature),
        predictedBookings: Math.max(0, predictedBookings),
        confidence: 75 + Math.random() * 15,
        recommendation
      };
    });
  }
}

class WeatherImpactService {
  private analyzer: WeatherImpactAnalyzer;
  private weatherClient: WeatherAPIClient;

  constructor() {
    this.analyzer = new WeatherImpactAnalyzer();
    this.weatherClient = new WeatherAPIClient();
  }

  /**
   * Get complete weather impact metrics
   */
  async getWeatherImpactMetrics(days: number = 30, location: string = 'Dubai'): Promise<WeatherMetrics> {
    const cacheKey = `weather:impact:${days}:${location}`;

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
    startDate.setDate(startDate.getDate() - days);

    // Fetch weather data
    const weatherData = await this.weatherClient.getHistoricalWeather(startDate, endDate, location);

    // Fetch booking data
    const bookingData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['completed', 'confirmed'] }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          revenue: { $sum: '$pricing.totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Combine weather and booking data
    const combinedData: WeatherDataPoint[] = weatherData.map(w => {
      const booking = bookingData.find(b => b._id === w.date);
      return {
        date: w.date,
        condition: w.condition,
        temperature: w.temperature,
        humidity: w.humidity,
        rainfall: w.rainfall,
        windSpeed: w.windSpeed,
        bookings: booking?.count || 0,
        revenue: booking?.revenue || 0
      };
    });

    // Calculate baseline bookings (average non-rainy day)
    const nonRainyDays = combinedData.filter(d => d.rainfall === 0 && d.condition === 'sunny');
    const baselineBookings = nonRainyDays.length > 0
      ? nonRainyDays.reduce((a, b) => a + b.bookings, 0) / nonRainyDays.length
      : combinedData.reduce((a, b) => a + b.bookings, 0) / combinedData.length;

    // Analyze weather correlations
    const weatherCorrelation = this.analyzer.analyzeWeatherImpact(combinedData, baselineBookings);

    // Calculate impacts
    const rainImpact = this.analyzer.calculateRainfallImpact(combinedData);
    const tempImpact = this.analyzer.calculateTemperatureImpact(combinedData);

    // Weather breakdown
    const weatherBreakdown = weatherCorrelation.map(c => {
      const conditionData = combinedData.filter(w => w.condition === c.condition);
      return {
        condition: c.condition,
        days: conditionData.length,
        percentage: Math.round((conditionData.length / combinedData.length) * 100),
        avgBookings: c.avgBookings
      };
    });

    // Temperature correlation data
    const tempGroups: Record<number, number[]> = {};
    combinedData.forEach(d => {
      const tempBucket = Math.floor(d.temperature / 2) * 2;
      if (!tempGroups[tempBucket]) tempGroups[tempBucket] = [];
      tempGroups[tempBucket].push(d.bookings);
    });

    const temperatureCorrelation = Object.entries(tempGroups).map(([temp, bookings]) => ({
      temp: parseInt(temp),
      bookings: Math.round(bookings.reduce((a, b) => a + b, 0) / bookings.length)
    })).sort((a, b) => a.temp - b.temp);

    // Rain correlation data
    const rainGroups: Record<number, number[]> = {};
    combinedData.forEach(d => {
      const rainBucket = Math.floor(d.rainfall / 5) * 5;
      if (!rainGroups[rainBucket]) rainGroups[rainBucket] = [];
      rainGroups[rainBucket].push(d.bookings);
    });

    const rainCorrelation = Object.entries(rainGroups).map(([rain, bookings]) => ({
      rainfall: parseInt(rain),
      bookings: Math.round(bookings.reduce((a, b) => a + b, 0) / bookings.length)
    })).sort((a, b) => a.rainfall - b.rainfall);

    // Season data
    const seasonGroups: Record<string, WeatherDataPoint[]> = {
      Spring: [],
      Summer: [],
      Autumn: [],
      Winter: []
    };

    combinedData.forEach(d => {
      const month = new Date(d.date).getMonth();
      if (month >= 2 && month <= 4) seasonGroups.Spring.push(d);
      else if (month >= 5 && month <= 7) seasonGroups.Summer.push(d);
      else if (month >= 8 && month <= 10) seasonGroups.Autumn.push(d);
      else seasonGroups.Winter.push(d);
    });

    const seasonWeather: SeasonWeatherData[] = Object.entries(seasonGroups).map(([season, data]) => {
      if (data.length === 0) {
        return {
          season,
          avgTemperature: 30,
          avgBookings: baselineBookings,
          avgRainfall: 0,
          demandMultiplier: 1
        };
      }

      const avgTemp = data.reduce((a, b) => a + b.temperature, 0) / data.length;
      const avgBookings = data.reduce((a, b) => a + b.bookings, 0) / data.length;
      const avgRainfall = data.reduce((a, b) => a + b.rainfall, 0) / data.length;

      return {
        season,
        avgTemperature: Math.round(avgTemp),
        avgBookings: Math.round(avgBookings),
        avgRainfall: Math.round(avgRainfall * 10) / 10,
        demandMultiplier: Math.round((avgBookings / baselineBookings) * 100) / 100
      };
    });

    // Get forecast
    const forecast = await this.weatherClient.getForecast(location, 7);
    const forecastImpact = this.analyzer.predictDemand(forecast, baselineBookings, weatherCorrelation);

    // Calculate overall correlation
    const temps = temperatureCorrelation.map(t => t.temp);
    const bookingsAtTemp = temperatureCorrelation.map(t => t.bookings);
    const overallCorrelation = Math.abs(this.analyzer.calculateCorrelation(temps, bookingsAtTemp));

    // Find best and worst weather
    const bestWeather = weatherCorrelation[0]?.condition || 'sunny';
    const worstWeather = weatherCorrelation[weatherCorrelation.length - 1]?.condition || 'rainy';

    const metrics: WeatherMetrics = {
      overallCorrelation: Math.round(overallCorrelation * 100) / 100,
      strongestFactor: Math.abs(rainImpact) > Math.abs(tempImpact.avgHeatImpact) ? 'Rainfall' : 'Temperature',
      avgRainImpact: rainImpact,
      avgHeatImpact: tempImpact.avgHeatImpact,
      bestWeather,
      worstWeather,
      weatherCorrelation,
      dailyWeather: combinedData,
      seasonWeather,
      forecastImpact,
      weatherBreakdown,
      temperatureCorrelation,
      rainCorrelation
    };

    try {
      await cache.set(cacheKey, JSON.stringify(metrics), 1800); // 30 min cache
    } catch {
      // Cache write error
    }

    return metrics;
  }

  /**
   * Get weather forecast with booking predictions
   */
  async getWeatherForecast(days: number = 7, location: string = 'Dubai'): Promise<WeatherForecast[]> {
    const forecast = await this.weatherClient.getForecast(location, days);

    // Get historical baseline
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const baselineData = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['completed', 'confirmed'] }
        }
      },
      {
        $group: {
          _id: null,
          avgBookings: { $avg: 1 } // Simplified
        }
      }
    ]);

    const avgDailyBookings = baselineData[0]?.avgBookings || 150;

    // Get weather correlation
    const impact = await this.getWeatherImpactMetrics(30, location);
    const weatherCorrelation = impact.weatherCorrelation;

    return this.analyzer.predictDemand(forecast, avgDailyBookings, weatherCorrelation);
  }

  /**
   * Adjust demand prediction based on weather
   */
  adjustDemandForWeather(
    baseDemand: number,
    condition: WeatherCondition,
    temperature: number,
    rainfall: number
  ): { adjustedDemand: number; confidence: number } {
    let multiplier = 1;

    // Weather condition impact
    switch (condition) {
      case 'sunny':
        multiplier = 1.15;
        break;
      case 'cloudy':
        multiplier = 1.0;
        break;
      case 'rainy':
        multiplier = 0.85;
        break;
      case 'stormy':
        multiplier = 0.7;
        break;
      default:
        multiplier = 1.0;
    }

    // Temperature adjustment
    if (temperature > 38) multiplier *= 0.9;
    else if (temperature > 35) multiplier *= 0.95;
    else if (temperature < 15) multiplier *= 0.92;

    // Rainfall adjustment
    if (rainfall > 20) multiplier *= 0.75;
    else if (rainfall > 10) multiplier *= 0.85;
    else if (rainfall > 0) multiplier *= 0.9;

    return {
      adjustedDemand: Math.round(baseDemand * multiplier),
      confidence: 78
    };
  }

  /**
   * Get demand forecast based on weather
   */
  async getWeatherBasedDemandForecast(
    startDate: Date,
    endDate: Date,
    location: string = 'Dubai'
  ): Promise<Array<{ date: Date; demand: number; confidence: number; weather: WeatherCondition }>> {
    const weatherData = await this.weatherClient.getHistoricalWeather(startDate, endDate, location);

    // Get base demand from historical data
    const historicalDemand = await Booking.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: { $in: ['completed', 'confirmed'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          days: { $addToSet: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } }
        }
      }
    ]);

    const avgDailyDemand = historicalDemand.length > 0
      ? historicalDemand[0].total / historicalDemand[0].days.length
      : 150;

    return weatherData.map(w => {
      const { adjustedDemand, confidence } = this.adjustDemandForWeather(
        avgDailyDemand,
        w.condition,
        w.temperature,
        w.rainfall
      );

      return {
        date: new Date(w.date),
        demand: adjustedDemand,
        confidence,
        weather: w.condition
      };
    });
  }
}

export const weatherImpactService = new WeatherImpactService();
export default weatherImpactService;
