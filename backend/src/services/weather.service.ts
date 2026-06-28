// Weather Service - Open-Meteo API integration with caching
import axios from 'axios';
import logger from '../utils/logger';
import { cache } from '../config/redis';

// Open-Meteo API base URL (free, no API key required)
const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1';

// Cache TTL in seconds (1 hour)
const WEATHER_CACHE_TTL = 3600;

// Default location (Dubai coordinates)
const DEFAULT_LOCATION = {
  latitude: 25.2048,
  longitude: 55.2708,
  timezone: 'Asia/Dubai'
};

export type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy' | 'foggy';

export interface CurrentWeather {
  temperature: number;
  humidity: number;
  weatherCode: number;
  condition: WeatherCondition;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  isDay: boolean;
}

export interface DailyForecast {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  condition: WeatherCondition;
  precipitationProbability: number;
  precipitationSum: number;
  windSpeedMax: number;
  sunrise: string;
  sunset: string;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  condition: WeatherCondition;
  precipitationProbability: number;
  precipitation: number;
  humidity: number;
  windSpeed: number;
}

export interface HistoricalWeather {
  date: string;
  temperatureMax: number;
  temperatureMin: number;
  temperatureMean: number;
  precipitationSum: number;
  windSpeedMax: number;
  sunshineDuration: number;
}

export interface WeatherData {
  current: CurrentWeather;
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  location: {
    latitude: number;
    longitude: number;
    timezone: string;
  };
  fetchedAt: string;
}

export interface WeatherAlert {
  type: 'heat' | 'rain' | 'storm' | 'wind';
  severity: 'low' | 'medium' | 'high';
  message: string;
  startTime: string;
  endTime: string;
}

/**
 * Map WMO weather codes to conditions
 * https://open-meteo.com/en/docs (WMO Weather interpretation codes)
 */
function mapWeatherCodeToCondition(code: number): WeatherCondition {
  if (code === 0 || code === 1) return 'sunny';
  if (code === 2 || code === 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'foggy';
  if (code >= 51 && code <= 67) return 'rainy';
  if (code >= 71 && code <= 77) return 'snowy';
  if (code >= 80 && code <= 82) return 'rainy';
  if (code >= 85 && code <= 86) return 'snowy';
  if (code >= 95 && code <= 99) return 'stormy';
  return 'cloudy';
}

/**
 * Check for weather alerts based on forecast data
 */
function detectWeatherAlerts(daily: DailyForecast[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  for (const day of daily) {
    // Heat alert
    if (day.temperatureMax > 45) {
      alerts.push({
        type: 'heat',
        severity: 'high',
        message: `Extreme heat expected: ${day.temperatureMax}°C`,
        startTime: day.date,
        endTime: day.date
      });
    } else if (day.temperatureMax > 40) {
      alerts.push({
        type: 'heat',
        severity: 'medium',
        message: `High temperature expected: ${day.temperatureMax}°C`,
        startTime: day.date,
        endTime: day.date
      });
    }

    // Rain alert
    if (day.precipitationProbability > 70 && day.precipitationSum > 10) {
      alerts.push({
        type: 'rain',
        severity: day.precipitationProbability > 90 ? 'high' : 'medium',
        message: `Heavy rain expected: ${day.precipitationSum}mm (${day.precipitationProbability}% chance)`,
        startTime: day.date,
        endTime: day.date
      });
    }

    // Wind alert
    if (day.windSpeedMax > 50) {
      alerts.push({
        type: 'wind',
        severity: 'high',
        message: `Strong winds expected: ${day.windSpeedMax} km/h`,
        startTime: day.date,
        endTime: day.date
      });
    }
  }

  return alerts;
}

class WeatherService {
  /**
   * Get current weather and forecast for a location
   */
  async getWeather(
    latitude: number = DEFAULT_LOCATION.latitude,
    longitude: number = DEFAULT_LOCATION.longitude,
    timezone: string = DEFAULT_LOCATION.timezone
  ): Promise<WeatherData> {
    const cacheKey = `weather:current:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;

    // Check cache first
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.debug('Weather cache hit', { latitude, longitude });
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      logger.debug('Weather cache miss or error', { latitude, longitude, error: cacheError });
    }

    try {
      // Fetch current weather and forecast from Open-Meteo
      const response = await axios.get(`${OPEN_METEO_BASE_URL}/forecast`, {
        params: {
          latitude,
          longitude,
          timezone,
          current: [
            'temperature_2m',
            'relative_humidity_2m',
            'weather_code',
            'wind_speed_10m',
            'wind_direction_10m',
            'precipitation',
            'is_day'
          ].join(','),
          hourly: [
            'temperature_2m',
            'weather_code',
            'precipitation_probability',
            'precipitation',
            'relative_humidity_2m',
            'wind_speed_10m'
          ].join(','),
          daily: [
            'temperature_2m_max',
            'temperature_2m_min',
            'weather_code',
            'precipitation_probability_max',
            'precipitation_sum',
            'wind_speed_10m_max',
            'sunrise',
            'sunset'
          ].join(','),
          forecast_days: 7
        },
        timeout: 10000 // 10 second timeout
      });

      const data = response.data;

      // Process current weather
      const current: CurrentWeather = {
        temperature: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        weatherCode: data.current.weather_code,
        condition: mapWeatherCodeToCondition(data.current.weather_code),
        windSpeed: data.current.wind_speed_10m,
        windDirection: data.current.wind_direction_10m,
        precipitation: data.current.precipitation,
        isDay: data.current.is_day === 1
      };

      // Process daily forecast
      const daily: DailyForecast[] = data.daily.time.map((date: string, i: number) => ({
        date,
        temperatureMax: data.daily.temperature_2m_max[i],
        temperatureMin: data.daily.temperature_2m_min[i],
        condition: mapWeatherCodeToCondition(data.daily.weather_code[i]),
        precipitationProbability: data.daily.precipitation_probability_max[i],
        precipitationSum: data.daily.precipitation_sum[i],
        windSpeedMax: data.daily.wind_speed_10m_max[i],
        sunrise: data.daily.sunrise[i],
        sunset: data.daily.sunset[i]
      }));

      // Process hourly forecast (next 24 hours)
      const hourly: HourlyForecast[] = data.hourly.time.slice(0, 24).map((time: string, i: number) => ({
        time,
        temperature: data.hourly.temperature_2m[i],
        condition: mapWeatherCodeToCondition(data.hourly.weather_code[i]),
        precipitationProbability: data.hourly.precipitation_probability[i],
        precipitation: data.hourly.precipitation[i],
        humidity: data.hourly.relative_humidity_2m[i],
        windSpeed: data.hourly.wind_speed_10m[i]
      }));

      const weatherData: WeatherData = {
        current,
        daily,
        hourly,
        location: { latitude, longitude, timezone },
        fetchedAt: new Date().toISOString()
      };

      // Cache the result
      try {
        await cache.set(cacheKey, JSON.stringify(weatherData), WEATHER_CACHE_TTL);
        logger.debug('Weather data cached', { latitude, longitude, ttl: WEATHER_CACHE_TTL });
      } catch (cacheError) {
        logger.warn('Failed to cache weather data', { error: cacheError });
      }

      return weatherData;

    } catch (error) {
      logger.error('Failed to fetch weather from Open-Meteo', {
        latitude,
        longitude,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return fallback data on API failure
      return this.getFallbackWeather(latitude, longitude, timezone);
    }
  }

  /**
   * Get historical weather data for a date range
   */
  async getHistoricalWeather(
    startDate: string,
    endDate: string,
    latitude: number = DEFAULT_LOCATION.latitude,
    longitude: number = DEFAULT_LOCATION.longitude
  ): Promise<HistoricalWeather[]> {
    const cacheKey = `weather:historical:${latitude.toFixed(2)}:${longitude.toFixed(2)}:${startDate}:${endDate}`;

    // Check cache first
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        logger.debug('Historical weather cache hit');
        return JSON.parse(cached);
      }
    } catch (cacheError) {
      // Cache miss
    }

    try {
      const response = await axios.get(`${OPEN_METEO_BASE_URL}/forecast`, {
        params: {
          latitude,
          longitude,
          start_date: startDate,
          end_date: endDate,
          daily: [
            'temperature_2m_max',
            'temperature_2m_min',
            'temperature_2m_mean',
            'precipitation_sum',
            'wind_speed_10m_max',
            'sunshine_duration'
          ].join(','),
          timezone: 'auto'
        },
        timeout: 15000
      });

      const data = response.data;

      const historical: HistoricalWeather[] = data.daily.time.map((date: string, i: number) => ({
        date,
        temperatureMax: data.daily.temperature_2m_max[i],
        temperatureMin: data.daily.temperature_2m_min[i],
        temperatureMean: data.daily.temperature_2m_mean[i],
        precipitationSum: data.daily.precipitation_sum[i],
        windSpeedMax: data.daily.wind_speed_10m_max[i],
        sunshineDuration: data.daily.sunshine_duration[i] / 3600 // Convert to hours
      }));

      // Cache for longer (historical data doesn't change)
      try {
        await cache.set(cacheKey, JSON.stringify(historical), WEATHER_CACHE_TTL * 24);
      } catch (cacheError) {
        // Cache error
      }

      return historical;

    } catch (error) {
      logger.error('Failed to fetch historical weather', {
        startDate,
        endDate,
        latitude,
        longitude,
        error: error instanceof Error ? error.message : String(error)
      });

      return [];
    }
  }

  /**
   * Get booking correlation data for weather analysis
   */
  async getWeatherForDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<{ date: string; weather: HistoricalWeather }[]> {
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const historical = await this.getHistoricalWeather(startStr, endStr);

    return historical.map(h => ({
      date: h.date,
      weather: h
    }));
  }

  /**
   * Generate fallback weather data when API fails
   */
  private getFallbackWeather(
    latitude: number,
    longitude: number,
    timezone: string
  ): WeatherData {
    const now = new Date();

    return {
      current: {
        temperature: 30,
        humidity: 60,
        weatherCode: 1,
        condition: 'sunny',
        windSpeed: 15,
        windDirection: 180,
        precipitation: 0,
        isDay: true
      },
      daily: Array.from({ length: 7 }, (_, i) => {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        return {
          date: date.toISOString().split('T')[0],
          temperatureMax: 35 + Math.random() * 5,
          temperatureMin: 25 + Math.random() * 3,
          condition: 'sunny' as WeatherCondition,
          precipitationProbability: Math.random() * 30,
          precipitationSum: 0,
          windSpeedMax: 15 + Math.random() * 10,
          sunrise: '06:00',
          sunset: '18:30'
        };
      }),
      hourly: [],
      location: { latitude, longitude, timezone },
      fetchedAt: new Date().toISOString()
    };
  }

  /**
   * Get weather alerts for a location
   */
  async getWeatherAlerts(
    latitude: number = DEFAULT_LOCATION.latitude,
    longitude: number = DEFAULT_LOCATION.longitude
  ): Promise<WeatherAlert[]> {
    const weather = await this.getWeather(latitude, longitude);
    return detectWeatherAlerts(weather.daily);
  }

  /**
   * Get weather impact on bookings
   */
  async getWeatherImpact(
    latitude: number = DEFAULT_LOCATION.latitude,
    longitude: number = DEFAULT_LOCATION.longitude
  ): Promise<{
    currentCondition: WeatherCondition;
    temperature: number;
    forecast: DailyForecast[];
    alerts: WeatherAlert[];
    recommendations: string[];
  }> {
    const weather = await this.getWeather(latitude, longitude);
    const alerts = detectWeatherAlerts(weather.daily);

    const recommendations: string[] = [];

    // Generate recommendations based on weather
    if (weather.current.temperature > 40) {
      recommendations.push('Consider promoting indoor services due to extreme heat');
    }

    const rainyDays = weather.daily.filter(d => d.precipitationProbability > 50).length;
    if (rainyDays >= 3) {
      recommendations.push(`Rain expected on ${rainyDays} days - promote weatherproof services`);
    }

    const hotDays = weather.daily.filter(d => d.temperatureMax > 38).length;
    if (hotDays >= 4) {
      recommendations.push('Extended heat wave - ensure provider hydration policies are followed');
    }

    return {
      currentCondition: weather.current.condition,
      temperature: weather.current.temperature,
      forecast: weather.daily,
      alerts,
      recommendations
    };
  }
}

export const weatherService = new WeatherService();
export default weatherService;
