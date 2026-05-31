/**
 * RevenueTrendChart - Revenue trend line chart with recharts
 * Provider Dashboard Component
 */
import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { cn } from '../../lib/utils';
import { formatPrice } from '../../lib/utils';
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  bookings: number;
  label?: string;
}

export interface RevenueTrendChartProps {
  /** Revenue data points */
  data: RevenueDataPoint[];
  /** Chart height */
  height?: number;
  /** Show comparison period */
  comparisonData?: RevenueDataPoint[];
  /** Currency code */
  currency?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Chart type */
  variant?: 'line' | 'area';
  /** Time period label */
  period?: string;
  /** Custom className */
  className?: string;
  /** Callback when data point is clicked */
  onPointClick?: (dataPoint: RevenueDataPoint) => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
  }>;
  label?: string;
  currency?: string;
}

interface StatsSummaryProps {
  totalRevenue: number;
  revenueChange: number;
  totalBookings: number;
  bookingsChange: number;
  averageOrderValue: number;
  currency: string;
}

// =============================================================================
// Custom Tooltip Component
// =============================================================================

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  currency = 'AED',
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-nilin-md border border-nilin-border p-4">
      <p className="text-sm font-medium text-nilin-charcoal mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-nilin-warmGray capitalize">
            {entry.dataKey === 'revenue' ? 'Revenue' : 'Bookings'}:
          </span>
          <span className="font-semibold text-nilin-charcoal">
            {entry.dataKey === 'revenue'
              ? formatPrice(entry.value, currency)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// =============================================================================
// Stats Summary Component
// =============================================================================

const StatsSummary: React.FC<StatsSummaryProps> = ({
  totalRevenue,
  revenueChange,
  totalBookings,
  bookingsChange,
  averageOrderValue,
  currency,
}) => {
  const isRevenueUp = revenueChange >= 0;
  const isBookingsUp = bookingsChange >= 0;

  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      {/* Total Revenue */}
      <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-nilin-coral/10 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-nilin-coral" />
          </div>
          <span className="text-xs text-nilin-warmGray">Total Revenue</span>
        </div>
        <p className="text-xl font-bold text-nilin-charcoal">
          {formatPrice(totalRevenue, currency)}
        </p>
        <div
          className={cn(
            'flex items-center gap-1 mt-1 text-xs',
            isRevenueUp ? 'text-green-600' : 'text-red-600'
          )}
        >
          {isRevenueUp ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>
            {isRevenueUp ? '+' : ''}
            {revenueChange.toFixed(1)}% vs last period
          </span>
        </div>
      </div>

      {/* Total Bookings */}
      <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-nilin-success/10 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-nilin-success" />
          </div>
          <span className="text-xs text-nilin-warmGray">Bookings</span>
        </div>
        <p className="text-xl font-bold text-nilin-charcoal">{totalBookings}</p>
        <div
          className={cn(
            'flex items-center gap-1 mt-1 text-xs',
            isBookingsUp ? 'text-green-600' : 'text-red-600'
          )}
        >
          {isBookingsUp ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>
            {isBookingsUp ? '+' : ''}
            {bookingsChange.toFixed(1)}% vs last period
          </span>
        </div>
      </div>

      {/* Average Order Value */}
      <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-lg bg-nilin-rose/10 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-nilin-rose" />
          </div>
          <span className="text-xs text-nilin-warmGray">Avg Order Value</span>
        </div>
        <p className="text-xl font-bold text-nilin-charcoal">
          {formatPrice(averageOrderValue, currency)}
        </p>
        <p className="text-xs text-nilin-lightGray mt-1">Per booking</p>
      </div>
    </div>
  );
};

// =============================================================================
// Main Revenue Trend Chart Component
// =============================================================================

export const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({
  data,
  height = 300,
  comparisonData,
  currency = 'AED',
  isLoading = false,
  variant = 'area',
  period = 'Last 30 days',
  className,
  onPointClick,
}) => {
  // Calculate stats
  const stats = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalRevenue: 0,
        totalBookings: 0,
        averageOrderValue: 0,
        revenueChange: 0,
        bookingsChange: 0,
      };
    }

    const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
    const totalBookings = data.reduce((sum, d) => sum + d.bookings, 0);
    const averageOrderValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // Calculate changes from comparison data
    let revenueChange = 0;
    let bookingsChange = 0;

    if (comparisonData && comparisonData.length > 0) {
      const compRevenue = comparisonData.reduce((sum, d) => sum + d.revenue, 0);
      const compBookings = comparisonData.reduce((sum, d) => sum + d.bookings, 0);

      if (compRevenue > 0) {
        revenueChange = ((totalRevenue - compRevenue) / compRevenue) * 100;
      }
      if (compBookings > 0) {
        bookingsChange = ((totalBookings - compBookings) / compBookings) * 100;
      }
    }

    return {
      totalRevenue,
      totalBookings,
      averageOrderValue,
      revenueChange,
      bookingsChange,
    };
  }, [data, comparisonData]);

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-4" />
          <div className="h-[300px] bg-nilin-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="text-center py-12">
          <TrendingUp className="w-12 h-12 text-nilin-lightGray mx-auto mb-4" />
          <p className="text-nilin-warmGray">No revenue data available</p>
          <p className="text-sm text-nilin-lightGray mt-1">
            Revenue will appear here once you start receiving bookings
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Revenue Overview
          </h3>
          <p className="text-sm text-nilin-warmGray">{period}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-nilin-coral" />
            <span className="text-xs text-nilin-warmGray">Revenue</span>
          </div>
          {comparisonData && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-nilin-lightGray" />
              <span className="text-xs text-nilin-warmGray">Previous</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      <StatsSummary
        totalRevenue={stats.totalRevenue}
        revenueChange={stats.revenueChange}
        totalBookings={stats.totalBookings}
        bookingsChange={stats.bookingsChange}
        averageOrderValue={stats.averageOrderValue}
        currency={currency}
      />

      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {variant === 'area' ? (
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              onClick={(e) => {
                const payload = e as { activePayload?: Array<{ payload: unknown }> };
                if (payload?.activePayload && onPointClick) {
                  onPointClick(payload.activePayload[0].payload as RevenueDataPoint);
                }
              }}
            >
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8B4A8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#E8B4A8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E8E4E0"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B6B6B', fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B6B6B', fontSize: 12 }}
                tickFormatter={(value) => {
                  if (value >= 1000) {
                    return `$${value / 1000}k`;
                  }
                  return `$${value}`;
                }}
              />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              {comparisonData && (
                <Area
                  type="monotone"
                  data={comparisonData}
                  dataKey="revenue"
                  stroke="#B5B0AB"
                  strokeWidth={2}
                  fill="none"
                  strokeDasharray="5 5"
                />
              )}
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#E8B4A8"
                strokeWidth={3}
                fill="url(#revenueGradient)"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: '#E8B4A8',
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          ) : (
            <LineChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              onClick={(e) => {
                const payload = e as { activePayload?: Array<{ payload: unknown }> };
                if (payload?.activePayload && onPointClick) {
                  onPointClick(payload.activePayload[0].payload as RevenueDataPoint);
                }
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#E8E4E0"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B6B6B', fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B6B6B', fontSize: 12 }}
                tickFormatter={(value) => {
                  if (value >= 1000) {
                    return `$${value / 1000}k`;
                  }
                  return `$${value}`;
                }}
              />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              {comparisonData && (
                <Line
                  type="monotone"
                  data={comparisonData}
                  dataKey="revenue"
                  stroke="#B5B0AB"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#E8B4A8"
                strokeWidth={3}
                dot={false}
                activeDot={{
                  r: 6,
                  fill: '#E8B4A8',
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default RevenueTrendChart;
