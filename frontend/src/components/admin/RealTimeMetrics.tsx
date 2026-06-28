// Real-time Metrics Dashboard - Live-updating KPI cards with API polling
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  TrendingUp,
  Users,
  Calendar,
  DollarSign,
  RefreshCw,
  AlertCircle,
  Wifi,
  WifiOff,
  Clock,
  Zap,
  BarChart3,
  ArrowUp,
  ArrowDown,
  X,
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
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';
import { getAdminFetchErrorMessage } from '../../utils/adminDataHelpers';
import { ErrorEmptyState } from './EmptyState';

interface RealTimeMetricsData {
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  lastUpdated: string;
  activeProviders: number;
  activeProvidersChange: number;
  activeProvidersTrend: number[];
  bookingCount: number;
  bookingCountChange: number;
  bookingCountTrend: number[];
  revenueToday: number;
  revenueTodayChange: number;
  revenueTrend: number[];
  queuedJobs: number;
  queuedJobsChange: number;
  queuedJobsTrend: number[];
  activeUsers: number;
  activeUsersChange: number;
  activeUsersTrend: number[];
  conversionRate: number;
  conversionRateChange: number;
  conversionRateTrend: number[];
  averageRating: number;
  averageRatingChange: number;
  averageRatingTrend: number[];
  historicalData: Array<{
    time: string;
    bookings: number;
    revenue: number;
    providers: number;
    users: number;
  }>;
  alerts: Array<{
    id: string;
    type: 'info' | 'warning' | 'error';
    message: string;
    timestamp: string;
  }>;
}

interface RealTimeMetricsProps {
  embedded?: boolean;
  onClose?: () => void;
}

const METRIC_COLORS = {
  bookings: { bg: 'from-blue-100 to-blue-200', text: 'text-blue-600', icon: 'bg-blue-500' },
  revenue: { bg: 'from-green-100 to-green-200', text: 'text-green-600', icon: 'bg-green-500' },
  providers: { bg: 'from-purple-100 to-purple-200', text: 'text-purple-600', icon: 'bg-purple-500' },
  users: { bg: 'from-amber-100 to-amber-200', text: 'text-amber-600', icon: 'bg-amber-500' },
  jobs: { bg: 'from-red-100 to-red-200', text: 'text-red-600', icon: 'bg-red-500' },
  rating: { bg: 'from-pink-100 to-pink-200', text: 'text-pink-600', icon: 'bg-pink-500' },
  conversion: { bg: 'from-indigo-100 to-indigo-200', text: 'text-indigo-600', icon: 'bg-indigo-500' },
};

const POLL_INTERVAL_MS = 30000;

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    maximumFractionDigits: 0,
  }).format(amount);

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const generateSparkline = (trend: number[]): number[] =>
  trend.length >= 12 ? trend.slice(-12) : trend;

export const RealTimeMetrics: React.FC<RealTimeMetricsProps> = ({
  embedded = false,
  onClose,
}) => {
  const [metrics, setMetrics] = useState<RealTimeMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setError(null);
      const response = await api.get('/admin/realtime-metrics');

      if (response.data?.success && response.data.data) {
        setMetrics(response.data.data);
        setIsConnected(true);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setIsConnected(false);
      if (!silent) {
        setError(getAdminFetchErrorMessage(err));
        setMetrics(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const renderMetricCard = (metric: {
    id: string;
    label: string;
    value: number;
    change: number;
    trend: number[];
    icon: React.ElementType;
    color: string;
    format: 'number' | 'currency' | 'percent' | 'rating';
  }) => {
    const Icon = metric.icon;
    const colorConfig = METRIC_COLORS[metric.color as keyof typeof METRIC_COLORS] || METRIC_COLORS.bookings;
    const isPositive = metric.change >= 0;

    const formatValue = () => {
      switch (metric.format) {
        case 'currency':
          return formatCurrency(metric.value);
        case 'percent':
          return `${metric.value}%`;
        case 'rating':
          return metric.value.toFixed(2);
        default:
          return formatNumber(metric.value);
      }
    };

    const sparklineData = generateSparkline(metric.trend).map((value, index) => ({
      value,
      index,
    }));

    return (
      <div
        key={metric.id}
        className="glass rounded-2xl border border-nilin-border/50 p-4 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between mb-3">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorConfig.bg} flex items-center justify-center`}
          >
            <Icon className={cn('w-5 h-5', colorConfig.text)} />
          </div>
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
              isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
            )}
          >
            {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(metric.change).toFixed(1)}%
          </div>
        </div>

        <div className="mb-2">
          <p className="text-2xl font-serif text-nilin-charcoal">{formatValue()}</p>
          <p className="text-xs text-nilin-warmGray">{metric.label}</p>
        </div>

        <div className="h-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData}>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#E8B4A8"
                fill="#E8B4A840"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-nilin-blush/30 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className={cn('bg-white rounded-2xl shadow-sm p-8', embedded ? '' : 'max-w-7xl mx-auto')}>
        <ErrorEmptyState message={error || 'Unable to load metrics'} onRetry={handleRefresh} />
      </div>
    );
  }

  const metricsList = [
    {
      id: 'bookings',
      label: 'Bookings Today',
      value: metrics.bookingCount,
      change: metrics.bookingCountChange,
      trend: metrics.bookingCountTrend,
      icon: Calendar,
      color: 'bookings',
      format: 'number' as const,
    },
    {
      id: 'revenue',
      label: 'Revenue Today',
      value: metrics.revenueToday,
      change: metrics.revenueTodayChange,
      trend: metrics.revenueTrend,
      icon: DollarSign,
      color: 'revenue',
      format: 'currency' as const,
    },
    {
      id: 'providers',
      label: 'Active Providers',
      value: metrics.activeProviders,
      change: metrics.activeProvidersChange,
      trend: metrics.activeProvidersTrend,
      icon: Users,
      color: 'providers',
      format: 'number' as const,
    },
    {
      id: 'users',
      label: 'Active Users',
      value: metrics.activeUsers,
      change: metrics.activeUsersChange,
      trend: metrics.activeUsersTrend,
      icon: Activity,
      color: 'users',
      format: 'number' as const,
    },
    {
      id: 'conversion',
      label: 'Conversion Rate',
      value: metrics.conversionRate,
      change: metrics.conversionRateChange,
      trend: metrics.conversionRateTrend,
      icon: TrendingUp,
      color: 'conversion',
      format: 'percent' as const,
    },
    {
      id: 'rating',
      label: 'Avg. Rating',
      value: metrics.averageRating,
      change: metrics.averageRatingChange,
      trend: metrics.averageRatingTrend,
      icon: Zap,
      color: 'rating',
      format: 'rating' as const,
    },
    {
      id: 'jobs',
      label: 'Queued Jobs',
      value: metrics.queuedJobs,
      change: metrics.queuedJobsChange,
      trend: metrics.queuedJobsTrend,
      icon: BarChart3,
      color: 'jobs',
      format: 'number' as const,
    },
  ];

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-4 sm:p-6')}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <Activity className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Real-time Metrics</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Refreshes every 30 seconds</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
              isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            )}
          >
            {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isConnected ? 'Live' : 'Offline'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-nilin-warmGray">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated {new Date(metrics.lastUpdated).toLocaleTimeString()}</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="w-11 h-11 flex items-center justify-center rounded-xl border border-nilin-border hover:bg-nilin-blush/30"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-nilin-warmGray" />
            </button>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-nilin-border hover:bg-nilin-blush/30"
            aria-label="Refresh metrics"
          >
            <RefreshCw className={cn('w-5 h-5 text-nilin-warmGray', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="mb-6 p-3 bg-gradient-to-r from-nilin-coral/10 to-nilin-rose/10 rounded-xl border border-nilin-coral/20 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <Zap className="w-4 h-4 text-nilin-coral" />
            <span className="text-sm font-medium text-nilin-charcoal">Live snapshot</span>
          </div>
          <p className="text-sm text-nilin-warmGray truncate">
            Revenue {formatCurrency(metrics.revenueToday)} · Bookings {metrics.bookingCount} · Providers{' '}
            {metrics.activeProviders}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4 mb-6">
        {metricsList.map((metric) => renderMetricCard(metric))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="glass rounded-2xl border border-nilin-border/50 p-4 sm:p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Bookings & Revenue (24h)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={metrics.historicalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="time" stroke="#6B7280" fontSize={10} />
                <YAxis yAxisId="left" stroke="#6B7280" fontSize={11} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#6B7280"
                  fontSize={11}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8' }}
                  formatter={(value: number, name: string) => [
                    name === 'revenue' ? formatCurrency(value) : value.toLocaleString(),
                    name === 'revenue' ? 'Revenue' : 'Bookings',
                  ]}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  fill="#10B98120"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="revenue"
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="bookings"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="bookings"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl border border-nilin-border/50 p-4 sm:p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Providers & Users (24h)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.historicalData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="time" stroke="#6B7280" fontSize={10} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8' }} />
                <Line type="monotone" dataKey="providers" stroke="#8B5CF6" strokeWidth={2} name="Providers" dot={false} />
                <Line type="monotone" dataKey="users" stroke="#F59E0B" strokeWidth={2} name="Users" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {metrics.alerts.length > 0 && (
        <div className="glass rounded-2xl border border-amber-200/50 p-4 sm:p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Active Alerts
          </h3>
          <div className="space-y-3">
            {metrics.alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  'p-4 rounded-xl border',
                  alert.type === 'warning'
                    ? 'bg-amber-50 border-amber-200'
                    : alert.type === 'error'
                      ? 'bg-red-50 border-red-200'
                      : 'bg-blue-50 border-blue-200'
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <p className="text-sm text-nilin-charcoal">{alert.message}</p>
                  <span className="text-xs text-nilin-warmGray">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeMetrics;
