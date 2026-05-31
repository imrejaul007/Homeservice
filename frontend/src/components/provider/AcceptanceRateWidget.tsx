/**
 * AcceptanceRateWidget - Acceptance rate display widget
 * Provider Dashboard Component
 */
import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  Award,
  Info,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export interface AcceptanceRateData {
  /** Total booking requests */
  totalRequests: number;
  /** Accepted bookings */
  accepted: number;
  /** Declined bookings */
  declined: number;
  /** Pending bookings */
  pending: number;
  /** Expired bookings */
  expired: number;
  /** Acceptance rate percentage (0-100) */
  acceptanceRate: number;
  /** Average response time in minutes */
  avgResponseTime: number;
  /** Target acceptance rate */
  targetRate?: number;
}

export interface AcceptanceRateWidgetProps {
  /** Acceptance rate data */
  data: AcceptanceRateData;
  /** Loading state */
  isLoading?: boolean;
  /** Time period label */
  period?: string;
  /** Show detailed breakdown */
  showDetails?: boolean;
  /** Compact mode for smaller spaces */
  compact?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when widget is clicked */
  onClick?: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getRateStatus(
  rate: number,
  target?: number
): {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ElementType;
  description: string;
} {
  const effectiveTarget = target ?? 90;

  if (rate >= 95) {
    return {
      label: 'Excellent',
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      icon: Award,
      description: 'Outstanding performance! You are in the top tier.',
    };
  }
  if (rate >= effectiveTarget) {
    return {
      label: 'Good',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      icon: CheckCircle,
      description: 'You are meeting your target.',
    };
  }
  if (rate >= 75) {
    return {
      label: 'Fair',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      icon: Clock,
      description: 'Room for improvement to reach your target.',
    };
  }
  return {
    label: 'Needs Attention',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    icon: XCircle,
    description: 'Your acceptance rate is below target.',
  };
}

function getTrend(
  currentRate: number,
  previousRate: number
): {
  value: number;
  isPositive: boolean;
  label: string;
} {
  const change = currentRate - previousRate;
  const isPositive = change >= 0;
  return {
    value: Math.abs(change),
    isPositive,
    label: isPositive ? 'up' : 'down',
  };
}

// =============================================================================
// Circular Progress Component
// =============================================================================

interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  size = 160,
  strokeWidth = 12,
  className,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E8E4E0"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E8B4A8"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-nilin-charcoal">
          {value.toFixed(1)}%
        </span>
        <span className="text-xs text-nilin-warmGray mt-1">Acceptance</span>
      </div>
    </div>
  );
};

// =============================================================================
// Main Widget Component
// =============================================================================

export const AcceptanceRateWidget: React.FC<AcceptanceRateWidgetProps> = ({
  data,
  isLoading = false,
  period = 'Last 30 days',
  showDetails = true,
  compact = false,
  className,
  onClick,
}) => {
  const status = useMemo(
    () => getRateStatus(data.acceptanceRate, data.targetRate),
    [data.acceptanceRate, data.targetRate]
  );

  const StatusIcon = status.icon;

  // Calculate previous period data for trend (simulated)
  const previousRate = useMemo(() => {
    // In production, this would come from API comparison
    return Math.max(0, data.acceptanceRate - Math.random() * 10);
  }, [data.acceptanceRate]);

  const trend = useMemo(
    () => getTrend(data.acceptanceRate, previousRate),
    [data.acceptanceRate, previousRate]
  );

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-4" />
          <div className="h-40 bg-nilin-muted rounded-xl" />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={cn(
          'bg-white rounded-xl p-4 shadow-nilin-sm border border-nilin-border cursor-pointer hover:shadow-nilin-md transition-shadow',
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', status.bgColor)}>
              <StatusIcon className={cn('w-5 h-5', status.color)} />
            </div>
            <div>
              <p className="text-xs text-nilin-warmGray">Acceptance Rate</p>
              <p className="text-lg font-bold text-nilin-charcoal">
                {data.acceptanceRate.toFixed(1)}%
              </p>
            </div>
          </div>
          <div
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            )}
          >
            {trend.isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{trend.isPositive ? '+' : '-'}{trend.value.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-white rounded-2xl p-6 shadow-nilin-sm',
        onClick && 'cursor-pointer hover:shadow-nilin-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Acceptance Rate
          </h3>
          <p className="text-sm text-nilin-warmGray">{period}</p>
        </div>
        <div
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
            status.bgColor,
            status.color
          )}
        >
          <StatusIcon className="w-4 h-4" />
          <span>{status.label}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row items-center gap-8">
        {/* Circular Progress */}
        <CircularProgress value={data.acceptanceRate} />

        {/* Stats Grid */}
        <div className="flex-1 grid grid-cols-2 gap-4 w-full">
          {/* Accepted */}
          <div className="bg-green-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-xs text-green-600 font-medium">Accepted</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{data.accepted}</p>
            <p className="text-xs text-green-600/70">
              {data.totalRequests > 0
                ? ((data.accepted / data.totalRequests) * 100).toFixed(1)
                : 0}
              %
            </p>
          </div>

          {/* Declined */}
          <div className="bg-red-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <span className="text-xs text-red-600 font-medium">Declined</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{data.declined}</p>
            <p className="text-xs text-red-600/70">
              {data.totalRequests > 0
                ? ((data.declined / data.totalRequests) * 100).toFixed(1)
                : 0}
              %
            </p>
          </div>

          {/* Pending */}
          <div className="bg-amber-50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-amber-600 font-medium">Pending</span>
            </div>
            <p className="text-2xl font-bold text-amber-700">{data.pending}</p>
            <p className="text-xs text-amber-600/70">Awaiting response</p>
          </div>

          {/* Avg Response Time */}
          <div className="bg-nilin-blush rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-nilin-coral" />
              <span className="text-xs text-nilin-coral font-medium">Avg Response</span>
            </div>
            <p className="text-2xl font-bold text-nilin-rose">
              {data.avgResponseTime.toFixed(0)}
              <span className="text-sm font-normal">min</span>
            </p>
            <p className="text-xs text-nilin-rose/70">Per booking</p>
          </div>
        </div>
      </div>

      {/* Trend Indicator */}
      <div className="mt-6 pt-6 border-t border-nilin-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-nilin-warmGray" />
            <span className="text-sm text-nilin-warmGray">
              {trend.isPositive ? '+' : '-'}
              {trend.value.toFixed(1)}% {trend.label} from last period
            </span>
          </div>
          {data.targetRate && (
            <div className="flex items-center gap-1.5 text-sm text-nilin-warmGray">
              <Info className="w-4 h-4" />
              <span>Target: {data.targetRate}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Status Description */}
      {showDetails && (
        <div
          className={cn(
            'mt-4 p-4 rounded-xl text-sm',
            status.bgColor,
            status.color
          )}
        >
          <p>{status.description}</p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default AcceptanceRateWidget;
