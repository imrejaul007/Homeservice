// Weather Impact Correlation - Weather effects on bookings and demand
import React, { useState, useEffect, useCallback } from 'react';
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Thermometer,
  Droplets,
  RefreshCw,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  ArrowUp,
  ArrowDown,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Zap
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';
import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';

type WeatherCondition = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy';

interface WeatherData {
  date: string;
  condition: WeatherCondition;
  temperature: number;
  humidity: number;
  rainfall: number;
  windSpeed: number;
  bookings: number;
  revenue: number;
  services: string[];
}

interface WeatherCorrelation {
  condition: WeatherCondition;
  label: string;
  avgBookings: number;
  avgRevenue: number;
  changePercent: number;
  sampleDays: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

interface SeasonWeatherData {
  season: string;
  avgTemperature: number;
  avgBookings: number;
  avgRainfall: number;
  demandMultiplier: number;
}

interface ForecastImpact {
  date: string;
  condition: WeatherCondition;
  temperature: number;
  predictedBookings: number;
  confidence: number;
  recommendation: string;
}

interface WeatherMetrics {
  overallCorrelation: number;
  strongestFactor: string;
  avgRainImpact: number;
  avgHeatImpact: number;
  bestWeather: WeatherCondition;
  worstWeather: WeatherCondition;
  weatherCorrelation: WeatherCorrelation[];
  dailyWeather: WeatherData[];
  seasonWeather: SeasonWeatherData[];
  forecastImpact: ForecastImpact[];
  weatherBreakdown: Array<{
    condition: WeatherCondition;
    days: number;
    percentage: number;
    avgBookings: number;
  }>;
  temperatureCorrelation: Array<{
    temp: number;
    bookings: number;
  }>;
  rainCorrelation: Array<{
    rainfall: number;
    bookings: number;
  }>;
}

interface WeatherImpactProps {
  embedded?: boolean;
  onClose?: () => void;
}

const WEATHER_CONFIG: Record<WeatherCondition, { icon: React.ElementType; color: string; bgColor: string }> = {
  sunny: { icon: Sun, color: '#F59E0B', bgColor: 'bg-amber-500' },
  cloudy: { icon: Cloud, color: '#6B7280', bgColor: 'bg-gray-500' },
  rainy: { icon: CloudRain, color: '#3B82F6', bgColor: 'bg-blue-500' },
  stormy: { icon: CloudLightning, color: '#8B5CF6', bgColor: 'bg-purple-500' },
  snowy: { icon: CloudSnow, color: '#60A5FA', bgColor: 'bg-sky-500' },
  windy: { icon: Wind, color: '#10B981', bgColor: 'bg-green-500' }
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0
  }).format(amount);
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const generateWeatherData = (): WeatherMetrics => {
  const conditions: WeatherCondition[] = ['sunny', 'cloudy', 'rainy'];
  const weatherCorrelation: WeatherCorrelation[] = [
    {
      condition: 'sunny',
      label: 'Sunny / Clear',
      avgBookings: 245,
      avgRevenue: 98200,
      changePercent: 15.3,
      sampleDays: 18,
      icon: Sun,
      color: '#F59E0B',
      bgColor: 'bg-amber-100'
    },
    {
      condition: 'cloudy',
      label: 'Cloudy',
      avgBookings: 212,
      avgRevenue: 84800,
      changePercent: 0,
      sampleDays: 8,
      icon: Cloud,
      color: '#6B7280',
      bgColor: 'bg-gray-100'
    },
    {
      condition: 'rainy',
      label: 'Rainy',
      avgBookings: 178,
      avgRevenue: 71200,
      changePercent: -16.0,
      sampleDays: 4,
      icon: CloudRain,
      color: '#3B82F6',
      bgColor: 'bg-blue-100'
    }
  ];

  const dailyWeather: WeatherData[] = [];
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    const baseBookings = condition === 'sunny' ? 240 : condition === 'cloudy' ? 210 : 170;
    const variance = (Math.random() - 0.5) * 40;

    dailyWeather.push({
      date: date.toISOString().split('T')[0],
      condition,
      temperature: 25 + Math.random() * 15,
      humidity: 40 + Math.random() * 40,
      rainfall: condition === 'rainy' ? 5 + Math.random() * 20 : 0,
      windSpeed: 5 + Math.random() * 20,
      bookings: Math.round(baseBookings + variance),
      revenue: Math.round((baseBookings + variance) * 400),
      services: ['Cleaning', 'Beauty', 'Maintenance'].slice(0, Math.floor(Math.random() * 3) + 1)
    });
  }

  const seasonWeather: SeasonWeatherData[] = [
    { season: 'Spring', avgTemperature: 28, avgBookings: 220, avgRainfall: 2, demandMultiplier: 1.1 },
    { season: 'Summer', avgTemperature: 38, avgBookings: 195, avgRainfall: 0.5, demandMultiplier: 0.9 },
    { season: 'Autumn', avgTemperature: 30, avgBookings: 235, avgRainfall: 1.5, demandMultiplier: 1.15 },
    { season: 'Winter', avgTemperature: 22, avgBookings: 250, avgRainfall: 3, demandMultiplier: 1.2 }
  ];

  const forecastImpact: ForecastImpact[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + i);
    const condition = conditions[Math.floor(Math.random() * conditions.length)];
    forecastImpact.push({
      date: date.toISOString().split('T')[0],
      condition,
      temperature: 24 + Math.random() * 12,
      predictedBookings: Math.round(200 + Math.random() * 60),
      confidence: 75 + Math.random() * 20,
      recommendation: condition === 'rainy' ? 'Consider promotional offers' : 'Normal operations'
    });
  }

  const temperatureCorrelation = Array.from({ length: 20 }, (_, i) => ({
    temp: 15 + i * 2,
    bookings: Math.round(280 - Math.abs(30 - (15 + i * 2)) * 5 + (Math.random() - 0.5) * 20)
  }));

  const rainCorrelation = Array.from({ length: 10 }, (_, i) => ({
    rainfall: i * 5,
    bookings: Math.round(250 - i * 12 + (Math.random() - 0.5) * 20)
  }));

  return {
    overallCorrelation: 0.78,
    strongestFactor: 'Rainfall',
    avgRainImpact: -16.5,
    avgHeatImpact: -8.2,
    bestWeather: 'sunny',
    worstWeather: 'rainy',
    weatherCorrelation,
    dailyWeather,
    seasonWeather,
    forecastImpact,
    weatherBreakdown: [
      { condition: 'sunny', days: 18, percentage: 60, avgBookings: 245 },
      { condition: 'cloudy', days: 8, percentage: 27, avgBookings: 212 },
      { condition: 'rainy', days: 4, percentage: 13, avgBookings: 178 }
    ],
    temperatureCorrelation,
    rainCorrelation
  };
};

export const WeatherImpact: React.FC<WeatherImpactProps> = ({
  embedded = false,
  onClose
}) => {
  const [metrics, setMetrics] = useState<WeatherMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'correlation' | 'trends' | 'forecast'>('correlation');
  const [dateRange, setDateRange] = useState<string>('30d');

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/weather-impact', {
        params: { dateRange }
      });

      if (response.data?.success) {
        setMetrics(response.data.data);
      } else {
        setMetrics(null);
        setError('No weather impact data available from the server');
      }
    } catch (err) {
      setMetrics(null);
      setError(getAdminFetchErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const renderCorrelationView = () => (
    <div className="space-y-6">
      {/* Weather Impact Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics?.weatherCorrelation.map(weather => {
          const config = WEATHER_CONFIG[weather.condition];
          const WeatherIcon = config.icon;
          const isPositive = weather.changePercent >= 0;

          return (
            <div
              key={weather.condition}
              className="glass rounded-2xl border border-nilin-border/50 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', config.bgColor)}>
                  <WeatherIcon className="w-6 h-6" style={{ color: config.color }} />
                </div>
                <div className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                  isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                )}>
                  {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                  {Math.abs(weather.changePercent).toFixed(1)}%
                </div>
              </div>

              <h3 className="font-medium text-nilin-charcoal mb-2">{weather.label}</h3>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-nilin-warmGray">Avg Bookings</span>
                  <span className="text-sm font-medium text-nilin-charcoal">{weather.avgBookings}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-nilin-warmGray">Avg Revenue</span>
                  <span className="text-sm font-medium text-nilin-charcoal">{formatCurrency(weather.avgRevenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-nilin-warmGray">Sample Days</span>
                  <span className="text-sm font-medium text-nilin-charcoal">{weather.sampleDays}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-nilin-border/30">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(weather.avgBookings / 300) * 100}%`,
                      backgroundColor: config.color
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Weather Breakdown Pie Chart */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Weather Distribution</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={metrics?.weatherBreakdown || []}
                  dataKey="days"
                  nameKey="condition"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                >
                  {(metrics?.weatherBreakdown || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={WEATHER_CONFIG[entry.condition].color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            {metrics?.weatherBreakdown.map(weather => {
              const config = WEATHER_CONFIG[weather.condition];
              const WeatherIcon = config.icon;
              return (
                <div key={weather.condition} className="flex items-center gap-3 p-3 bg-nilin-blush/20 rounded-xl">
                  <WeatherIcon className="w-5 h-5" style={{ color: config.color }} />
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-nilin-charcoal capitalize">{weather.condition}</span>
                      <span className="text-sm text-nilin-warmGray">{weather.days} days ({weather.percentage}%)</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${weather.percentage}%`, backgroundColor: config.color }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Correlation Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Temperature vs Bookings */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-amber-500" />
            Temperature vs Bookings
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  dataKey="temp"
                  stroke="#6B7280"
                  fontSize={11}
                  name="Temperature"
                  unit="°C"
                  label={{ value: 'Temperature (°C)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis
                  type="number"
                  dataKey="bookings"
                  stroke="#6B7280"
                  fontSize={11}
                  name="Bookings"
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }}
                  formatter={(value: number, name: string) => [
                    name === 'temp' ? `${value}°C` : value,
                    name === 'temp' ? 'Temperature' : 'Bookings'
                  ]}
                />
                <Scatter data={metrics?.temperatureCorrelation || []} fill="#F59E0B">
                  {(metrics?.temperatureCorrelation || []).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.temp > 35 ? '#EF4444' : entry.temp < 20 ? '#3B82F6' : '#10B981'}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rainfall vs Bookings */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-500" />
            Rainfall vs Bookings
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.rainCorrelation || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="rainfall"
                  stroke="#6B7280"
                  fontSize={11}
                  label={{ value: 'Rainfall (mm)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar dataKey="bookings" name="Bookings" radius={[4, 4, 0, 0]}>
                  {(metrics?.rainCorrelation || []).map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.rainfall > 25 ? '#3B82F6' : entry.rainfall > 10 ? '#60A5FA' : '#93C5FD'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTrendsView = () => (
    <div className="space-y-6">
      {/* Daily Weather & Bookings */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Daily Weather & Booking Trends</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={metrics?.dailyWeather || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                stroke="#6B7280"
                fontSize={10}
                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              />
              <YAxis yAxisId="left" stroke="#6B7280" fontSize={11} />
              <YAxis yAxisId="right" orientation="right" stroke="#6B7280" fontSize={11} />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }}
                formatter={(value: number, name: string) => {
                  if (name === 'temperature') return [`${value}°C`, 'Temperature'];
                  if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                  return [value, name];
                }}
              />
              <Bar yAxisId="left" dataKey="bookings" fill="#3B82F6" name="Bookings" opacity={0.7} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="temperature"
                stroke="#F59E0B"
                strokeWidth={2}
                name="Temperature"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Seasonal Patterns */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Seasonal Weather Patterns</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Season Comparison */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.seasonWeather || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="season" stroke="#6B7280" fontSize={11} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Bar dataKey="avgBookings" name="Avg Bookings" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Demand Multiplier */}
          <div className="space-y-4">
            {metrics?.seasonWeather.map(season => (
              <div key={season.season} className="p-4 bg-nilin-blush/20 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-nilin-charcoal">{season.season}</span>
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    season.demandMultiplier >= 1.1 ? 'bg-green-100 text-green-700' :
                    season.demandMultiplier >= 1 ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  )}>
                    {season.demandMultiplier >= 1 ? '+' : ''}{((season.demandMultiplier - 1) * 100).toFixed(0)}% demand
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-nilin-warmGray">
                  <div>
                    <p>Temp</p>
                    <p className="font-medium text-nilin-charcoal">{season.avgTemperature.toFixed(0)}°C</p>
                  </div>
                  <div>
                    <p>Rainfall</p>
                    <p className="font-medium text-nilin-charcoal">{season.avgRainfall.toFixed(1)}mm</p>
                  </div>
                  <div>
                    <p>Bookings</p>
                    <p className="font-medium text-nilin-charcoal">{season.avgBookings}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderForecastView = () => (
    <div className="space-y-6">
      {/* Weather Forecast Impact */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-nilin-coral" />
          7-Day Weather Forecast Impact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {metrics?.forecastImpact.map((forecast, idx) => {
            const config = WEATHER_CONFIG[forecast.condition];
            const WeatherIcon = config.icon;

            return (
              <div
                key={idx}
                className="p-4 rounded-xl border border-nilin-border/50 text-center"
              >
                <p className="text-xs text-nilin-warmGray mb-2">
                  {new Date(forecast.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <div className={cn('w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center', config.bgColor)}>
                  <WeatherIcon className="w-6 h-6" style={{ color: config.color }} />
                </div>
                <p className="text-lg font-serif text-nilin-charcoal">{forecast.temperature.toFixed(0)}°C</p>
                <p className="text-xs text-nilin-warmGray capitalize mb-2">{forecast.condition}</p>
                <div className="pt-2 border-t border-nilin-border/30">
                  <p className="text-xs text-nilin-warmGray">Predicted</p>
                  <p className="text-sm font-medium text-nilin-charcoal">{forecast.predictedBookings} bookings</p>
                  <p className="text-xs text-nilin-warmGray mt-1">{forecast.confidence.toFixed(0)}% confidence</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          Operational Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics?.weatherCorrelation.map(weather => {
            const config = WEATHER_CONFIG[weather.condition];
            const WeatherIcon = config.icon;
            const isPositive = weather.changePercent >= 0;

            return (
              <div
                key={weather.condition}
                className={cn(
                  'p-4 rounded-xl border',
                  isPositive ? 'bg-green-50/50 border-green-200' :
                  'bg-amber-50/50 border-amber-200'
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <WeatherIcon className="w-6 h-6" style={{ color: config.color }} />
                  <div>
                    <h4 className="font-medium text-nilin-charcoal capitalize">{weather.condition} Weather</h4>
                    <p className="text-xs text-nilin-warmGray">
                      {isPositive ? `+${weather.changePercent.toFixed(1)}%` : `${weather.changePercent.toFixed(1)}%`} vs baseline
                    </p>
                  </div>
                </div>
                <p className="text-sm text-nilin-charcoal">
                  {isPositive
                    ? `Expect ${weather.changePercent.toFixed(0)}% higher demand. Ensure adequate provider coverage.`
                    : `Rain expected to reduce demand by ${Math.abs(weather.changePercent).toFixed(0)}%. Consider promotions or adjust staffing.`
                  }
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-nilin-blush/30 rounded-xl"></div>)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Weather Impact Data</h3>
          <p className="text-sm text-nilin-warmGray mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-coral/90 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-100 to-sky-200 flex items-center justify-center">
            <CloudRain className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Weather Impact Analysis</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Correlation between weather and demand</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors"
            >
              <AlertCircle className="w-5 h-5 text-nilin-warmGray" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-nilin-border hover:bg-nilin-blush/30 transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5 text-nilin-warmGray', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal">{metrics?.overallCorrelation}</p>
          <p className="text-xs text-nilin-warmGray">Correlation</p>
        </div>
        <div className="glass rounded-xl border border-blue-200/50 p-4 text-center">
          <Droplets className="w-5 h-5 text-blue-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-blue-600">{metrics?.avgRainImpact}%</p>
          <p className="text-xs text-nilin-warmGray">Rain Impact</p>
        </div>
        <div className="glass rounded-xl border border-amber-200/50 p-4 text-center">
          <Thermometer className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-amber-600">{metrics?.avgHeatImpact}%</p>
          <p className="text-xs text-nilin-warmGray">Heat Impact</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <Sun className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600 capitalize">{metrics?.bestWeather}</p>
          <p className="text-xs text-nilin-warmGray">Best Weather</p>
        </div>
        <div className="glass rounded-xl border border-red-200/50 p-4 text-center">
          <CloudRain className="w-5 h-5 text-red-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-red-600 capitalize">{metrics?.worstWeather}</p>
          <p className="text-xs text-nilin-warmGray">Worst Weather</p>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-2 mb-6">
        {(['correlation', 'trends', 'forecast'] as const).map(view => (
          <button
            key={view}
            onClick={() => setSelectedView(view)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all capitalize',
              selectedView === view
                ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white shadow-nilin-warm'
                : 'border border-nilin-border text-nilin-charcoal hover:bg-nilin-blush/30'
            )}
          >
            {view === 'correlation' ? 'Correlation' : view === 'trends' ? 'Trends' : 'Forecast'}
          </button>
        ))}
      </div>

      {/* Content */}
      {selectedView === 'correlation' && renderCorrelationView()}
      {selectedView === 'trends' && renderTrendsView()}
      {selectedView === 'forecast' && renderForecastView()}
    </div>
  );
};

export default WeatherImpact;
