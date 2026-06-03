/**
 * EarningsForecast - Earnings prediction/chart
 * Provider Dashboard Component
 */
import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  BarChart3,
  Target,
  AlertCircle,
  Loader2,
  ChevronDown,
  Info,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

// =============================================================================
// Type Definitions
// =============================================================================

export interface ForecastDataPoint {
  /** Date */
  date: string;
  /** Actual earnings */
  actual?: number;
  /** Projected earnings */
  projected?: number;
  /** Lower bound (for confidence interval) */
  lower?: number;
  /** Upper bound (for confidence interval) */
  upper?: number;
  /** Label for display */
  label?: string;
}

export interface EarningsForecastData {
  /** Historical and projected data */
  data: ForecastDataPoint[];
  /** Current month earnings */
  currentMonthEarnings: number;
  /** Projected month earnings */
  projectedMonthEarnings: number;
  /** Previous month earnings (for comparison) */
  previousMonthEarnings: number;
  /** Average weekly earnings */
  averageWeeklyEarnings: number;
  /** Growth rate */
  growthRate: number;
  /** Confidence level (0-100) */
  confidenceLevel: number;
  /** Number of booking days remaining */
  remainingDays: number;
  /** Expected earnings for remaining days */
  expectedRemaining: number;
}

export interface EarningsForecastProps {
  /** Forecast data */
  data: EarningsForecastData;
  /** Loading state */
  isLoading?: boolean;
  /** Currency code */
  currency?: string;
  /** Time period */
  period?: 'week' | 'month' | 'quarter' | 'year';
  /** Callback when data point is clicked */
  onPointClick?: (dataPoint: ForecastDataPoint) => void;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatPrice(amount: number, currency = 'AED'): string {
  if (amount >= 1000) {
    return `${currency} ${(amount / 1000).toFixed(1)}k`;
  }
  return `${currency} ${amount.toFixed(0)}`;
}

function formatCurrency(amount: number, currency = 'AED'): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// =============================================================================
// Custom Tooltip Component
// =============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    color: string;
    payload: ForecastDataPoint;
  }>;
  label?: string;
  currency?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  currency = 'AED',
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white rounded-xl shadow-nilin-md border border-nilin-border p-4">
      <p className="text-sm font-medium text-nilin-charcoal mb-2">
        {data.label || label}
      </p>
      {data.actual !== undefined && (
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-nilin-coral" />
          <span className="text-sm text-nilin-warmGray">Actual:</span>
          <span className="text-sm font-semibold text-nilin-charcoal">
            {formatCurrency(data.actual, currency)}
          </span>
        </div>
      )}
      {data.projected !== undefined && (
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-blue-400" />
          <span className="text-sm text-nilin-warmGray">Projected:</span>
          <span className="text-sm font-semibold text-nilin-charcoal">
            {formatCurrency(data.projected, currency)}
          </span>
        </div>
      )}
      {data.lower !== undefined && data.upper !== undefined && (
        <div className="text-xs text-nilin-lightGray mt-1">
          Range: {formatCurrency(data.lower, currency)} - {formatCurrency(data.upper, currency)}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Stats Card Component
// =============================================================================

interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  color,
  bgColor,
}) => {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div className="bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border">
      <div className="flex items-center justify-between mb-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', bgColor)}>
          <Icon className={cn('w-5 h-5', color)} />
        </div>
        {trend !== undefined && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <p className="text-xs text-nilin-warmGray mb-1">{title}</p>
      <p className="text-xl font-bold text-nilin-charcoal">{value}</p>
      {subtitle && <p className="text-xs text-nilin-lightGray mt-1">{subtitle}</p>}
    </div>
  );
};

// =============================================================================
// Confidence Indicator Component
// =============================================================================

interface ConfidenceIndicatorProps {
  confidence: number;
  remainingDays: number;
  expectedRemaining: number;
  currency?: string;
}

const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  confidence,
  remainingDays,
  expectedRemaining,
  currency = 'AED',
}) => {
  const getConfidenceColor = (level: number): string => {
    if (level >= 80) return 'text-green-600 bg-green-100';
    if (level >= 60) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  const colorClass = getConfidenceColor(confidence);

  return (
    <div className="bg-nilin-muted rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-nilin-warmGray">Prediction Confidence</span>
        <span className={cn('px-2 py-1 rounded-full text-xs font-medium', colorClass)}>
          {confidence}% confident
        </span>
      </div>

      <div className="h-2 bg-white rounded-full overflow-hidden mb-3">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            confidence >= 80 ? 'bg-green-500' : confidence >= 60 ? 'bg-amber-500' : 'bg-red-500'
          )}
          style={{ width: `${confidence}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-nilin-warmGray">
        <span>{remainingDays} days remaining</span>
        <span>~{formatCurrency(expectedRemaining, currency)} expected</span>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const EarningsForecast: React.FC<EarningsForecastProps> = ({
  data,
  isLoading = false,
  currency = 'AED',
  period = 'month',
  onPointClick,
  className,
}) => {
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  // Process data for chart
  const chartData = useMemo(() => {
    const sourceData = data?.data;
    if (!sourceData || !Array.isArray(sourceData)) {
      return [];
    }
    return sourceData.map((d) => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      label: d.label || new Date(d.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    }));
  }, [data?.data]);

  // Separate actual and projected data
  const actualData = chartData.filter((d) => d.actual !== undefined);
  const projectedData = chartData.filter((d) => d.projected !== undefined);

  // Calculate month comparison
  const monthComparison = data.currentMonthEarnings - data.previousMonthEarnings;
  const monthComparisonPercent =
    data.previousMonthEarnings > 0
      ? (monthComparison / data.previousMonthEarnings) * 100
      : 0;

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-nilin-muted rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-nilin-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-nilin-coral/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Earnings Forecast
            </h3>
            <p className="text-sm text-nilin-warmGray">
              {period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : period === 'quarter' ? 'This Quarter' : 'This Year'}
            </p>
          </div>
        </div>

        {/* Chart Type Toggle */}
        <div className="flex items-center bg-nilin-muted rounded-lg p-1">
          <button
            onClick={() => setChartType('area')}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-colors',
              chartType === 'area'
                ? 'bg-white text-nilin-charcoal shadow-sm'
                : 'text-nilin-warmGray hover:text-nilin-charcoal'
            )}
          >
            Trend
          </button>
          <button
            onClick={() => setChartType('bar')}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-colors',
              chartType === 'bar'
                ? 'bg-white text-nilin-charcoal shadow-sm'
                : 'text-nilin-warmGray hover:text-nilin-charcoal'
            )}
          >
            Compare
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Current Earnings"
          value={formatCurrency(data.currentMonthEarnings, currency)}
          subtitle="This month"
          trend={data.growthRate}
          icon={DollarSign}
          color="text-nilin-coral"
          bgColor="bg-nilin-coral/10"
        />
        <StatsCard
          title="Projected"
          value={formatCurrency(data.projectedMonthEarnings, currency)}
          subtitle="End of month"
          icon={Target}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <StatsCard
          title="vs Last Month"
          value={formatCurrency(Math.abs(monthComparison), currency)}
          subtitle={monthComparison >= 0 ? 'Increase' : 'Decrease'}
          trend={monthComparisonPercent}
          icon={monthComparison >= 0 ? TrendingUp : TrendingDown}
          color={monthComparison >= 0 ? 'text-green-600' : 'text-red-600'}
          bgColor={monthComparison >= 0 ? 'bg-green-50' : 'bg-red-50'}
        />
        <StatsCard
          title="Weekly Average"
          value={formatCurrency(data.averageWeeklyEarnings, currency)}
          subtitle="Per week"
          icon={Calendar}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
      </div>

      {/* Confidence Indicator */}
      <div className="mb-6">
        <ConfidenceIndicator
          confidence={data.confidenceLevel}
          remainingDays={data.remainingDays}
          expectedRemaining={data.expectedRemaining}
          currency={currency}
        />
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'area' ? (
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              onClick={(e) => {
                const payload = e as { activePayload?: Array<{ payload: unknown }> };
                if (payload?.activePayload && onPointClick) {
                  onPointClick(payload.activePayload[0].payload as ForecastDataPoint);
                }
              }}
            >
              <defs>
                <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#E8B4A8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#E8B4A8" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="projectedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#60A5FA" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E4E0" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B6B6B', fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B6B6B', fontSize: 11 }}
                tickFormatter={(value) => formatPrice(value, currency)}
              />
              <Tooltip content={<CustomTooltip currency={currency} />} />

              {/* Confidence interval (if available) */}
              {chartData.some((d) => d.lower !== undefined && d.upper !== undefined) && (
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="#60A5FA"
                  fillOpacity={0.1}
                />
              )}

              {/* Projected line */}
              <Area
                type="monotone"
                dataKey="projected"
                stroke="#60A5FA"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="url(#projectedGradient)"
                dot={false}
              />

              {/* Actual line */}
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#E8B4A8"
                strokeWidth={3}
                fill="url(#actualGradient)"
                dot={false}
                activeDot={{
                  r: 6,
                  fill: '#E8B4A8',
                  stroke: '#fff',
                  strokeWidth: 2,
                }}
              />

              {/* Divider line between actual and projected */}
              <ReferenceLine
                x={actualData[actualData.length - 1]?.date}
                stroke="#B5B0AB"
                strokeDasharray="3 3"
                aria-label="End of actual data"
              />
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E4E0" vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B6B6B', fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#6B6B6B', fontSize: 11 }}
                tickFormatter={(value) => formatPrice(value, currency)}
              />
              <Tooltip content={<CustomTooltip currency={currency} />} />
              <Bar dataKey="actual" fill="#E8B4A8" radius={[4, 4, 0, 0]} name="Actual" />
              <Bar dataKey="projected" fill="#60A5FA" radius={[4, 4, 0, 0]} name="Projected" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-nilin-warmGray">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-nilin-coral" />
          Actual Earnings
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-400" />
          Projected Earnings
        </span>
        <span className="flex items-center gap-2">
          <div className="w-6 h-0.5 border-t-2 border-dashed border-gray-400" />
          Forecast Start
        </span>
      </div>
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default EarningsForecast;
