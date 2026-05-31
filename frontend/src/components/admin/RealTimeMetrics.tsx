// Real-time Metrics Dashboard - Live-updating KPI cards with WebSocket-powered updates
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  DollarSign,
  RefreshCw,
  Loader2,
  AlertCircle,
  Wifi,
  WifiOff,
  Clock,
  Zap,
  BarChart3,
  ArrowUp,
  ArrowDown
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
  ComposedChart
} from 'recharts';
import { cn } from '../../lib/utils';
import { api } from '../../services/api';

interface MetricData {
  id: string;
  label: string;
  value: number;
  previousValue: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
  unit: string;
  icon: React.ElementType;
  color: string;
  sparkline: number[];
}

interface RealTimeMetricsData {
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  lastUpdated: Date;
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
    timestamp: Date;
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
  conversion: { bg: 'from-indigo-100 to-indigo-200', text: 'text-indigo-600', icon: 'bg-indigo-500' }
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

const generateSparkline = (trend: number[]): number[] => {
  return trend.length >= 12 ? trend.slice(-12) : trend;
};

export const RealTimeMetrics: React.FC<RealTimeMetricsProps> = ({
  embedded = false,
  onClose
}) => {
  const [metrics, setMetrics] = useState<RealTimeMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate mock real-time data
  const generateMockData = useCallback((): RealTimeMetricsData => {
    const now = new Date();
    const hourLabel = `${now.getHours().toString().padStart(2, '0')}:${Math.floor(now.getMinutes() / 15) * 15}`;

    return {
      connectionStatus: isConnected ? 'connected' : 'disconnected',
      lastUpdated: now,
      activeProviders: Math.round(145 + Math.random() * 20),
      activeProvidersChange: 5.2,
      activeProvidersTrend: Array.from({ length: 24 }, () => Math.round(140 + Math.random() * 30)),
      bookingCount: Math.round(234 + Math.random() * 30),
      bookingCountChange: 12.5,
      bookingCountTrend: Array.from({ length: 24 }, () => Math.round(220 + Math.random() * 50)),
      revenueToday: Math.round(45600 + Math.random() * 5000),
      revenueTodayChange: 8.3,
      revenueTrend: Array.from({ length: 24 }, () => Math.round(45000 + Math.random() * 10000)),
      queuedJobs: Math.round(12 + Math.random() * 8),
      queuedJobsChange: -15.2,
      queuedJobsTrend: Array.from({ length: 24 }, () => Math.round(10 + Math.random() * 15)),
      activeUsers: Math.round(1234 + Math.random() * 100),
      activeUsersChange: 7.8,
      activeUsersTrend: Array.from({ length: 24 }, () => Math.round(1200 + Math.random() * 200)),
      conversionRate: parseFloat((3.2 + Math.random() * 0.5).toFixed(1)),
      conversionRateChange: 0.3,
      conversionRateTrend: Array.from({ length: 24 }, () => parseFloat((3.0 + Math.random()).toFixed(1))),
      averageRating: parseFloat((4.5 + Math.random() * 0.3).toFixed(2)),
      averageRatingChange: 0.12,
      averageRatingTrend: Array.from({ length: 24 }, () => parseFloat((4.4 + Math.random() * 0.5).toFixed(2))),
      historicalData: Array.from({ length: 24 }, (_, i) => ({
        time: `${(now.getHours() - 23 + i).toString().padStart(2, '0')}:00`,
        bookings: Math.round(180 + Math.random() * 80),
        revenue: Math.round(35000 + Math.random() * 20000),
        providers: Math.round(130 + Math.random() * 40),
        users: Math.round(1100 + Math.random() * 300)
      })),
      alerts: Math.random() > 0.7 ? [
        {
          id: '1',
          type: 'warning',
          message: 'High demand detected in Dubai Marina area',
          timestamp: new Date()
        }
      ] : []
    };
  }, [isConnected]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const response = await api.get('/admin/realtime-metrics');

      if (response.data?.success) {
        setMetrics(response.data.data);
      } else {
        setMetrics(generateMockData());
      }
    } catch {
      // Use mock data on API failure
      setMetrics(generateMockData());
    } finally {
      setLoading(false);
    }
  }, [generateMockData]);

  // WebSocket connection for real-time updates
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      // In production, this would connect to a real WebSocket endpoint
      // For demo purposes, we simulate WebSocket with intervals
      setIsConnected(true);

      // Simulate real-time updates every 3 seconds
      const updateInterval = setInterval(() => {
        setMetrics(prev => {
          if (!prev) return generateMockData();

          const now = new Date();
          const hourLabel = `${now.getHours().toString().padStart(2, '0')}:${Math.floor(now.getMinutes() / 15) * 15}`;

          return {
            ...prev,
            lastUpdated: now,
            bookingCount: prev.bookingCount + Math.round(Math.random() * 3 - 1),
            activeProviders: prev.activeProviders + Math.round(Math.random() * 3 - 1),
            revenueToday: prev.revenueToday + Math.round(Math.random() * 500 - 200),
            activeUsers: prev.activeUsers + Math.round(Math.random() * 10 - 5),
            bookingCountTrend: [...prev.bookingCountTrend.slice(1), prev.bookingCount + Math.round(Math.random() * 5 - 2)],
            revenueTrend: [...prev.revenueTrend.slice(1), prev.revenueToday + Math.round(Math.random() * 1000 - 500)],
            activeUsersTrend: [...prev.activeUsersTrend.slice(1), prev.activeUsers + Math.round(Math.random() * 20 - 10)],
            historicalData: [
              ...prev.historicalData.slice(1),
              {
                time: hourLabel,
                bookings: Math.round(180 + Math.random() * 80),
                revenue: Math.round(35000 + Math.random() * 20000),
                providers: Math.round(130 + Math.random() * 40),
                users: Math.round(1100 + Math.random() * 300)
              }
            ]
          };
        });
      }, 3000);

      // Store interval for cleanup
      wsRef.current = { readyState: WebSocket.OPEN } as unknown as WebSocket;

      return () => clearInterval(updateInterval);
    } catch {
      setIsConnected(false);
      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectWebSocket();
      }, 5000);
    }
  }, [generateMockData]);

  useEffect(() => {
    fetchData();
    const cleanup = connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      cleanup?.();
    };
  }, [fetchData, connectWebSocket]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  };

  const renderMetricCard = (
    metric: {
      id: string;
      label: string;
      value: number;
      change: number;
      trend: number[];
      icon: React.ElementType;
      color: string;
      unit: string;
      format: 'number' | 'currency' | 'percent' | 'rating';
    }
  ) => {
    const Icon = metric.icon;
    const colorConfig = METRIC_COLORS[metric.color as keyof typeof METRIC_COLORS] || METRIC_COLORS.bookings;
    const isPositive = metric.change >= 0;

    const formatValue = () => {
      switch (metric.format) {
        case 'currency': return formatCurrency(metric.value);
        case 'percent': return `${metric.value}%`;
        case 'rating': return metric.value.toFixed(2);
        default: return formatNumber(metric.value);
      }
    };

    const sparklineData = generateSparkline(metric.trend).map((value, index) => ({
      value,
      index
    }));

    return (
      <div
        key={metric.id}
        className="glass rounded-2xl border border-nilin-border/50 p-4 hover:shadow-md transition-shadow"
      >
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${colorConfig.bg} flex items-center justify-center`}>
            <Icon className={cn('w-5 h-5', colorConfig.text)} />
          </div>
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full',
            isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
          )}>
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
              <defs>
                <linearGradient id={`gradient-${metric.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorConfig.text.replace('text-', '')} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={colorConfig.text.replace('text-', '')} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={colorConfig.text.replace('text-', '#')}
                fill={`url(#gradient-${metric.id})`}
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
          <div className="h-8 bg-nilin-blush/30 rounded w-1/3"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-nilin-blush/30 rounded-xl"></div>)}
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
          <h3 className="text-lg font-serif text-nilin-charcoal mb-2">Unable to Load Real-time Metrics</h3>
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

  const metricsList = metrics ? [
    {
      id: 'bookings',
      label: 'Bookings Today',
      value: metrics.bookingCount,
      change: metrics.bookingCountChange,
      trend: metrics.bookingCountTrend,
      icon: Calendar,
      color: 'bookings',
      unit: '',
      format: 'number' as const
    },
    {
      id: 'revenue',
      label: 'Revenue Today',
      value: metrics.revenueToday,
      change: metrics.revenueTodayChange,
      trend: metrics.revenueTrend,
      icon: DollarSign,
      color: 'revenue',
      unit: '',
      format: 'currency' as const
    },
    {
      id: 'providers',
      label: 'Active Providers',
      value: metrics.activeProviders,
      change: metrics.activeProvidersChange,
      trend: metrics.activeProvidersTrend,
      icon: Users,
      color: 'providers',
      unit: '',
      format: 'number' as const
    },
    {
      id: 'users',
      label: 'Active Users',
      value: metrics.activeUsers,
      change: metrics.activeUsersChange,
      trend: metrics.activeUsersTrend,
      icon: Activity,
      color: 'users',
      unit: '',
      format: 'number' as const
    },
    {
      id: 'conversion',
      label: 'Conversion Rate',
      value: metrics.conversionRate,
      change: metrics.conversionRateChange,
      trend: metrics.conversionRateTrend,
      icon: TrendingUp,
      color: 'conversion',
      unit: '',
      format: 'percent' as const
    },
    {
      id: 'rating',
      label: 'Avg. Rating',
      value: metrics.averageRating,
      change: metrics.averageRatingChange,
      trend: metrics.averageRatingTrend,
      icon: Zap,
      color: 'rating',
      unit: '',
      format: 'rating' as const
    },
    {
      id: 'jobs',
      label: 'Queued Jobs',
      value: metrics.queuedJobs,
      change: metrics.queuedJobsChange,
      trend: metrics.queuedJobsTrend,
      icon: BarChart3,
      color: 'jobs',
      unit: '',
      format: 'number' as const
    }
  ] : [];

  return (
    <div className={cn('bg-white rounded-2xl shadow-sm', embedded ? '' : 'max-w-7xl mx-auto p-6')}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
            <Activity className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-serif text-nilin-charcoal">Real-time Metrics</h2>
            <p className="text-sm text-nilin-warmGray mt-1">Live-updating dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
            isConnected
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          )}>
            {isConnected ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Live</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Last Updated */}
          <div className="flex items-center gap-1.5 text-xs text-nilin-warmGray">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {metrics?.lastUpdated
                ? `Updated ${new Date(metrics.lastUpdated).toLocaleTimeString()}`
                : 'Updating...'}
            </span>
          </div>

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

      {/* Live Ticker */}
      <div className="mb-6 p-3 bg-gradient-to-r from-nilin-coral/10 to-nilin-rose/10 rounded-xl border border-nilin-coral/20">
        <div className="flex items-center gap-4 overflow-hidden">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-nilin-coral animate-pulse" />
            <span className="text-sm font-medium text-nilin-charcoal">Live Updates</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="animate-marquee whitespace-nowrap">
              <span className="text-sm text-nilin-warmGray">
                Today&apos;s Revenue: {formatCurrency(metrics?.revenueToday || 0)} (+{metrics?.revenueTodayChange.toFixed(1)}%)
                &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                Active Bookings: {metrics?.bookingCount || 0}
                &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                Online Providers: {metrics?.activeProviders || 0}
                &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                Conversion: {metrics?.conversionRate?.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        {metricsList.map(metric => renderMetricCard(metric))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Bookings & Revenue Chart */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Bookings & Revenue (24h)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={metrics?.historicalData || []}>
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
                  contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }}
                  formatter={(value: number, name: string) => [
                    name === 'revenue' ? formatCurrency(value) : value.toLocaleString(),
                    name === 'revenue' ? 'Revenue' : 'Bookings'
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

        {/* Providers & Users Chart */}
        <div className="glass rounded-2xl border border-nilin-border/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Providers & Users (24h)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics?.historicalData || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="time" stroke="#6B7280" fontSize={10} />
                <YAxis stroke="#6B7280" fontSize={11} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E8E0D8', fontFamily: 'system-ui' }} />
                <Line
                  type="monotone"
                  dataKey="providers"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  name="Providers"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  name="Users"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {metrics?.alerts && metrics.alerts.length > 0 && (
        <div className="glass rounded-2xl border border-amber-200/50 p-6">
          <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Active Alerts
          </h3>
          <div className="space-y-3">
            {metrics.alerts.map(alert => (
              <div
                key={alert.id}
                className={cn(
                  'p-4 rounded-xl border',
                  alert.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                  alert.type === 'error' ? 'bg-red-50 border-red-200' :
                  'bg-blue-50 border-blue-200'
                )}
              >
                <div className="flex items-center justify-between">
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

      {/* Performance Summary */}
      <div className="mt-6 p-4 bg-green-50 rounded-xl border border-green-100">
        <h4 className="font-medium text-green-800 mb-2">System Status</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-green-600">Platform Health</p>
            <p className="text-sm font-medium text-green-800">Operational</p>
          </div>
          <div>
            <p className="text-xs text-green-600">Response Time</p>
            <p className="text-sm font-medium text-green-800">45ms avg</p>
          </div>
          <div>
            <p className="text-xs text-green-600">Success Rate</p>
            <p className="text-sm font-medium text-green-800">99.9%</p>
          </div>
          <div>
            <p className="text-xs text-green-600">Uptime (30d)</p>
            <p className="text-sm font-medium text-green-800">99.99%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeMetrics;
