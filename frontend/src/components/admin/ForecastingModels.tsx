// Forecasting Models - Revenue, booking, and demand forecasting with confidence intervals
import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  RefreshCw,
  Loader2,
  AlertCircle,
  BarChart3,
  LineChart as LineChartIcon,
  ArrowUp,
  ArrowDown,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  Minus,
  Zap
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
  BarChart,
  Bar,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';
import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';

interface ForecastPoint {
  date: string;
  actual?: number;
  predicted: number;
  lowerBound: number;
  upperBound: number;
  confidence: number;
}

interface ForecastMetrics {
  revenueForecast: ForecastPoint[];
  bookingForecast: ForecastPoint[];
  demandLevel: 'low' | 'medium' | 'high' | 'peak';
  trend: 'increasing' | 'stable' | 'decreasing';
  seasonalityStrength: number;
  accuracy: number;
  lastUpdated: Date;
}

interface SeasonalityData {
  month: string;
  historical: number;
  predicted: number;
  index: number;
}

interface CategoryForecast {
  category: string;
  current: number;
  predicted: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
}

interface ForecastInsights {
  summary: string;
  highlights: Array<{
    type: 'opportunity' | 'risk' | 'neutral';
    message: string;
  }>;
  recommendations: string[];
  peakDays: Array<{
    date: string;
    predicted: number;
    reason: string;
  }>;
  lowDemandDays: Array<{
    date: string;
    predicted: number;
    suggestion: string;
  }>;
}

interface ForecastingModelsProps {
  embedded?: boolean;
  onClose?: () => void;
}

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

const getTrendIcon = (trend: string) => {
  switch (trend) {
    case 'increasing': return TrendingUp;
    case 'decreasing': return TrendingDown;
    default: return Minus;
  }
};

const getTrendColor = (trend: string) => {
  switch (trend) {
    case 'increasing': return 'text-green-600';
    case 'decreasing': return 'text-red-600';
    default: return 'text-nilin-warmGray';
  }
};

const getDemandColor = (level: string) => {
  switch (level) {
    case 'peak': return 'bg-red-100 text-red-700 border-red-200';
    case 'high': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'medium': return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'low': return 'bg-gray-100 text-gray-700 border-gray-200';
    default: return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};

export const ForecastingModels: React.FC<ForecastingModelsProps> = ({
  embedded = false,
  onClose
}) => {
  const [metrics, setMetrics] = useState<ForecastMetrics | null>(null);
  const [insights, setInsights] = useState<ForecastInsights | null>(null);
  const [seasonality, setSeasonality] = useState<SeasonalityData[]>([]);
  const [categoryForecast, setCategoryForecast] = useState<CategoryForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [forecastRange, setForecastRange] = useState<'7d' | '14d' | '30d' | '90d'>('30d');
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'bookings'>('revenue');
  const [showConfidenceInterval, setShowConfidenceInterval] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/forecasting', {
        params: { range: forecastRange }
      });

      if (response.data?.success) {
        setMetrics(response.data.data.metrics);
        setInsights(response.data.data.insights);
        setSeasonality(response.data.data.seasonality);
        setCategoryForecast(response.data.data.categoryForecast);
      } else {
        setError('No forecasting data available from the server');
      }
    } catch (err) {
      console.error('Error fetching forecasting data:', err);
      setError(getAdminFetchErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [forecastRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const currentData = selectedMetric === 'revenue' ? metrics?.revenueForecast : metrics?.bookingForecast;

  const renderForecastChart = () => {
    const data = currentData || [];
    const todayIndex = data.findIndex(d => !d.actual);

    return (
      <div className="glass rounded-2xl border border-nilin-border/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-serif text-nilin-charcoal">
            {selectedMetric === 'revenue' ? 'Revenue' : 'Booking'} Forecast
          </h3>
          <div className="flex items-center gap-4">
            {/* Metric Toggle */}
            <div className="flex items-center gap-1 bg-nilin-blush/30 rounded-lg p-1">
              <button
                onClick={() => setSelectedMetric('revenue')}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  selectedMetric === 'revenue'
                    ? 'bg-white text-nilin-charcoal shadow-sm'
                    : 'text-nilin-warmGray hover:text-nilin-charcoal'
                )}
              >
                Revenue
              </button>
              <button
                onClick={() => setSelectedMetric('bookings')}
                className={cn(
                  'px-3 py-1 rounded text-xs font-medium transition-colors',
                  selectedMetric === 'bookings'
                    ? 'bg-white text-nilin-charcoal shadow-sm'
                    : 'text-nilin-warmGray hover:text-nilin-charcoal'
                )}
              >
                Bookings
              </button>
            </div>

            {/* Confidence Interval Toggle */}
            <label className="flex items-center gap-2 text-xs text-nilin-warmGray cursor-pointer">
              <input
                type="checkbox"
                checked={showConfidenceInterval}
                onChange={(e) => setShowConfidenceInterval(e.target.checked)}
                className="w-4 h-4 rounded border-nilin-border text-nilin-coral focus:ring-nilin-coral"
              />
              <span>Confidence Interval</span>
            </label>
          </div>
        </div>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="confidenceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                stroke="#6B7280"
                fontSize={10}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis
                stroke="#6B7280"
                fontSize={11}
                tickFormatter={(value) =>
                  selectedMetric === 'revenue' ? `${(value / 1000).toFixed(0)}k` : value
                }
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }}
                formatter={(value: number, name: string) => {
                  if (name === 'lowerBound' || name === 'upperBound') return null;
                  return [
                    selectedMetric === 'revenue' ? formatCurrency(value) : value.toLocaleString(),
                    name === 'actual' ? 'Actual' : 'Predicted'
                  ];
                }}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
              />

              {/* Today Line */}
              {todayIndex > 0 && (
                <ReferenceLine
                  x={data[todayIndex]?.date}
                  stroke="#EF4444"
                  strokeDasharray="3 3"
                  label={{ value: 'Today', fill: '#EF4444', fontSize: 10 }}
                />
              )}

              {/* Confidence Interval Area */}
              {showConfidenceInterval && (
                <Area
                  type="monotone"
                  dataKey="upperBound"
                  stroke="none"
                  fill="url(#confidenceGradient)"
                  stackId="confidence"
                />
              )}
              {showConfidenceInterval && (
                <Area
                  type="monotone"
                  dataKey="lowerBound"
                  stroke="none"
                  fill="white"
                  stackId="confidence"
                />
              )}

              {/* Actual Values */}
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#10B981"
                fill="url(#actualGradient)"
                strokeWidth={2}
                name="actual"
                connectNulls={false}
              />

              {/* Predicted Values */}
              <Line
                type="monotone"
                dataKey="predicted"
                stroke="#3B82F6"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="predicted"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-green-500" />
            <span className="text-nilin-warmGray">Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-blue-500" style={{ borderStyle: 'dashed' }} />
            <span className="text-nilin-warmGray">Predicted</span>
          </div>
          {showConfidenceInterval && (
            <div className="flex items-center gap-2">
              <div className="w-4 h-3 bg-indigo-200/50 rounded" />
              <span className="text-nilin-warmGray">Confidence Interval</span>
            </div>
          )}
        </div>
      </div>
    );
  };

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
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Forecast</h3>
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

  const TrendIcon = getTrendIcon(metrics?.trend || 'stable');

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200 flex items-center justify-center">
            <LineChartIcon className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Forecasting Models</h2>
            <p className="text-sm text-nilin-warmGray mt-1">AI-powered predictions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={forecastRange}
            onChange={(e) => setForecastRange(e.target.value as typeof forecastRange)}
            className="px-4 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          >
            <option value="7d">Next 7 days</option>
            <option value="14d">Next 14 days</option>
            <option value="30d">Next 30 days</option>
            <option value="90d">Next 90 days</option>
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
        <div className="glass rounded-xl border border-blue-200/50 p-4 text-center">
          <div className={cn('w-5 h-5 mx-auto mb-2', getTrendColor(metrics?.trend || 'stable'))}>
            <TrendIcon className="w-5 h-5" />
          </div>
          <p className="text-2xl font-serif text-nilin-charcoal capitalize">
            {metrics?.trend || 'stable'}
          </p>
          <p className="text-xs text-nilin-warmGray">Trend</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Zap className="w-5 h-5 text-amber-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-nilin-charcoal capitalize">
            {metrics?.demandLevel || 'medium'}
          </p>
          <p className="text-xs text-nilin-warmGray">Demand Level</p>
        </div>
        <div className="glass rounded-xl border border-green-200/50 p-4 text-center">
          <Target className="w-5 h-5 text-green-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-green-600">{metrics?.accuracy}%</p>
          <p className="text-xs text-nilin-warmGray">Model Accuracy</p>
        </div>
        <div className="glass rounded-xl border border-purple-200/50 p-4 text-center">
          <BarChart3 className="w-5 h-5 text-purple-500 mx-auto mb-2" />
          <p className="text-2xl font-serif text-purple-600">
            {(metrics?.seasonalityStrength || 0) * 100}%
          </p>
          <p className="text-xs text-nilin-warmGray">Seasonality</p>
        </div>
        <div className="glass rounded-xl border border-nilin-border/50 p-4 text-center">
          <Clock className="w-5 h-5 text-nilin-warmGray mx-auto mb-2" />
          <p className="text-xs text-nilin-charcoal">
            {metrics?.lastUpdated ? new Date(metrics.lastUpdated).toLocaleTimeString() : '-'}
          </p>
          <p className="text-xs text-nilin-warmGray">Last Updated</p>
        </div>
      </div>

      {/* Forecast Chart */}
      {renderForecastChart()}

      {/* Seasonality */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6 mb-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Monthly Seasonality Index</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={seasonality}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={11} />
              <YAxis stroke="#6B7280" fontSize={11} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
              <Bar dataKey="historical" fill="#3B82F6" name="Historical" radius={[4, 4, 0, 0]} opacity={0.5} />
              <Line type="monotone" dataKey="predicted" stroke="#10B981" strokeWidth={2} name="Predicted" />
              <ReferenceLine y={100} stroke="#EF4444" strokeDasharray="3 3" label={{ value: 'Baseline', fill: '#EF4444', fontSize: 10 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Forecasts */}
      <div className="glass rounded-2xl border border-nilin-border/50 p-6 mb-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Category Forecasts</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {categoryForecast.map(cat => {
            const CatTrendIcon = cat.trend === 'up' ? TrendingUp : cat.trend === 'down' ? TrendingDown : Minus;
            return (
              <div key={cat.category} className="p-4 bg-nilin-blush/30 rounded-xl text-center">
                <p className="text-sm font-medium text-nilin-charcoal">{cat.category}</p>
                <div className="flex items-center justify-center gap-1 mt-2">
                  <CatTrendIcon
                    className={cn('w-4 h-4', cat.trend === 'up' ? 'text-green-500' : cat.trend === 'down' ? 'text-red-500' : 'text-nilin-warmGray')}
                  />
                  <span className={cn(
                    'text-lg font-serif',
                    cat.trend === 'up' ? 'text-green-600' : cat.trend === 'down' ? 'text-red-600' : 'text-nilin-charcoal'
                  )}>
                    {cat.change > 0 ? '+' : ''}{cat.change.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-nilin-warmGray mt-1">{cat.confidence}% confidence</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Insights */}
      {insights && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Highlights */}
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Key Highlights</h3>
            <div className="space-y-3">
              {insights.highlights.map((highlight, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'p-3 rounded-xl flex items-start gap-3',
                    highlight.type === 'opportunity' ? 'bg-green-50/50 border border-green-200' :
                    highlight.type === 'risk' ? 'bg-red-50/50 border border-red-200' :
                    'bg-blue-50/50 border border-blue-200'
                  )}
                >
                  {highlight.type === 'opportunity' ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : highlight.type === 'risk' ? (
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Zap className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm text-nilin-charcoal">{highlight.message}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Peak & Low Days */}
          <div className="glass rounded-2xl border border-nilin-border/50 p-6">
            <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Forecasted Peak & Low Days</h3>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-green-600 font-medium mb-2">Peak Days</p>
                {insights.peakDays.map((day, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-nilin-border/20 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-nilin-charcoal">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-nilin-warmGray">{day.reason}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-serif text-green-600">
                        {selectedMetric === 'revenue' ? formatCurrency(day.predicted * 450) : day.predicted}
                      </p>
                      <p className="text-xs text-nilin-warmGray">
                        {selectedMetric === 'revenue' ? 'est. revenue' : 'est. bookings'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-amber-600 font-medium mb-2">Low Demand Days</p>
                {insights.lowDemandDays.map((day, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2 border-b border-nilin-border/20 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-nilin-charcoal">
                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-xs text-nilin-warmGray">{day.suggestion}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-serif text-amber-600">
                        {selectedMetric === 'revenue' ? formatCurrency(day.predicted * 450) : day.predicted}
                      </p>
                      <p className="text-xs text-nilin-warmGray">
                        {selectedMetric === 'revenue' ? 'est. revenue' : 'est. bookings'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
        <h4 className="font-medium text-indigo-800 mb-2">Forecast Summary</h4>
        <p className="text-sm text-indigo-700">{insights?.summary}</p>
      </div>
    </div>
  );
};

export default ForecastingModels;
