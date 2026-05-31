/**
 * TipTracking - Tips separate from earnings
 * Provider Dashboard Component
 */
import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  Heart,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Star,
  Award,
  Download,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

// =============================================================================
// Type Definitions
// =============================================================================

export interface Tip {
  /** Unique tip ID */
  id: string;
  /** Booking ID */
  bookingId: string;
  /** Customer name */
  customerName: string;
  /** Customer avatar */
  customerAvatar?: string;
  /** Service name */
  serviceName: string;
  /** Tip amount */
  amount: number;
  /** Currency code */
  currency?: string;
  /** Date received */
  date: string;
  /** Tip type */
  type: 'cash' | 'card' | 'in_app';
  /** Rating given */
  rating: number;
  /** Message (if any) */
  message?: string;
}

export interface TipTrackingData {
  /** Total tips */
  totalTips: number;
  /** Tips this month */
  thisMonthTips: number;
  /** Average tip amount */
  averageTip: number;
  /** Tip percentage (of total earnings) */
  tipPercentage: number;
  /** Growth rate compared to last month */
  growthRate: number;
  /** Total tips received count */
  tipsCount: number;
  /** Tips by source */
  tipsBySource: Array<{ name: string; value: number; color: string }>;
  /** Tips trend data */
  trendData: Array<{ date: string; amount: number; label?: string }>;
}

export interface TipTrackingProps {
  /** Tip tracking data */
  data: TipTrackingData;
  /** Individual tips */
  tips: Tip[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when viewing tip details */
  onTipClick?: (tip: Tip) => void;
  /** Callback when downloading report */
  onDownloadReport?: (filters?: { startDate?: string; endDate?: string }) => Promise<void>;
  /** Currency code */
  currency?: string;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

function formatCurrency(amount: number, currency = 'AED'): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// =============================================================================
// Custom Tooltip
// =============================================================================

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    payload: { date: string; label?: string };
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

  return (
    <div className="bg-white rounded-xl shadow-nilin-md border border-nilin-border p-3">
      <p className="text-sm font-medium text-nilin-charcoal mb-1">
        {payload[0].payload.label || label}
      </p>
      <p className="text-lg font-bold text-nilin-coral">
        {formatCurrency(payload[0].value, currency)}
      </p>
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
// Tip Item Component
// =============================================================================

interface TipItemProps {
  tip: Tip;
  onClick?: () => void;
}

const TipItem: React.FC<TipItemProps> = ({ tip, onClick }) => {
  const getTypeIcon = () => {
    switch (tip.type) {
      case 'cash':
        return DollarSign;
      case 'card':
        return Heart;
      default:
        return Heart;
    }
  };

  const TypeIcon = getTypeIcon();

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-3 bg-white rounded-xl border border-nilin-border hover:shadow-nilin-sm cursor-pointer transition-shadow"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-nilin-coral/10 flex items-center justify-center">
          <TypeIcon className="w-5 h-5 text-nilin-coral" />
        </div>
        <div>
          <h4 className="font-medium text-nilin-charcoal">{tip.customerName}</h4>
          <p className="text-xs text-nilin-warmGray">{tip.serviceName}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-bold text-nilin-coral">{formatCurrency(tip.amount, tip.currency)}</p>
        <div className="flex items-center justify-end gap-1 mt-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={cn(
                'w-3 h-3',
                i < tip.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const TipTracking: React.FC<TipTrackingProps> = ({
  data,
  tips,
  isLoading = false,
  onTipClick,
  onDownloadReport,
  currency = 'AED',
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  // Filter tips
  const filteredTips = useMemo(() => {
    return tips
      .filter((tip) => {
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            tip.customerName.toLowerCase().includes(query) ||
            tip.serviceName.toLowerCase().includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [tips, searchQuery]);

  // Process trend data
  const chartData = useMemo(() => {
    return data.trendData.map((d) => ({
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
  }, [data.trendData]);

  const isPositive = data.growthRate >= 0;

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
          <div className="h-48 bg-nilin-muted rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Tip Tracking
            </h3>
            <p className="text-sm text-nilin-warmGray">
              Tips earned from customers
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onDownloadReport && (
            <button
              onClick={() => onDownloadReport()}
              className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
              title="Download report"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-sm text-nilin-coral hover:text-nilin-rose transition-colors"
          >
            {expanded ? 'Show Less' : 'Show All'}
            <ChevronRight
              className={cn('w-4 h-4 transition-transform', expanded && 'rotate-90')}
            />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          title="Total Tips"
          value={formatCurrency(data.totalTips, currency)}
          trend={data.growthRate}
          icon={Heart}
          color="text-yellow-600"
          bgColor="bg-yellow-100"
        />
        <StatsCard
          title="This Month"
          value={formatCurrency(data.thisMonthTips, currency)}
          subtitle={`${data.tipsCount} tips received`}
          icon={Calendar}
          color="text-nilin-coral"
          bgColor="bg-nilin-coral/10"
        />
        <StatsCard
          title="Average Tip"
          value={formatCurrency(data.averageTip, currency)}
          icon={DollarSign}
          color="text-green-600"
          bgColor="bg-green-100"
        />
        <StatsCard
          title="Tip Rate"
          value={`${data.tipPercentage}%`}
          subtitle="of total earnings"
          icon={TrendingUp}
          color="text-blue-600"
          bgColor="bg-blue-100"
        />
      </div>

      {/* Chart & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Trend Chart */}
        <div className="lg:col-span-2">
          <h4 className="text-sm font-medium text-nilin-charcoal mb-3">
            Tips Over Time
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="tipGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
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
                  tickFormatter={(value) => `${currency} ${value}`}
                />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  fill="url(#tipGradient)"
                  dot={false}
                  activeDot={{
                    r: 6,
                    fill: '#F59E0B',
                    stroke: '#fff',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart */}
        <div>
          <h4 className="text-sm font-medium text-nilin-charcoal mb-3">
            Tips by Source
          </h4>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.tipsBySource}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.tipsBySource.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value, currency)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {data.tipsBySource.map((source, index) => (
              <div key={index} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: source.color }}
                />
                <span className="text-xs text-nilin-warmGray">{source.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Tips */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-nilin-charcoal">
            Recent Tips
          </h4>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-lightGray" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tips..."
              className="pl-9 pr-4 py-1.5 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm w-48"
            />
          </div>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {(expanded ? filteredTips : filteredTips.slice(0, 5)).map((tip) => (
            <TipItem
              key={tip.id}
              tip={tip}
              onClick={onTipClick ? () => onTipClick(tip) : undefined}
            />
          ))}
        </div>

        {!expanded && filteredTips.length > 5 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full mt-3 py-2 text-sm text-nilin-coral hover:text-nilin-rose transition-colors"
          >
            View all {filteredTips.length} tips
          </button>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default TipTracking;
