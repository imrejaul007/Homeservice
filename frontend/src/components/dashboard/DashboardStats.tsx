/**
 * DashboardStats Component
 * Animated stat cards showing key metrics
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  CheckCircle2,
  CreditCard,
  Star,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { customerDashboardApi } from '../../services/customerDashboardApi';

// =============================================================================
// Types
// =============================================================================

interface DashboardStats {
  activeBookings: number;
  completedBookings: number;
  totalSpent: number;
  averageRating: number;
}

interface StatCardProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  isLoading?: boolean;
  decimals?: number;
}

interface DashboardStatsProps {
  showRefresh?: boolean;
}

// =============================================================================
// Animated Counter Hook
// =============================================================================

const useAnimatedCounter = (
  endValue: number,
  duration: number = 1500,
  decimals: number = 0
): number => {
  const [count, setCount] = useState(0);
  const countRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      countRef.current = endValue * easeOut;

      setCount(countRef.current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setCount(endValue);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [endValue, duration]);

  return count;
};

// =============================================================================
// Stat Card Component
// =============================================================================

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  prefix = '',
  suffix = '',
  icon: Icon,
  iconBg,
  iconColor,
  trend,
  isLoading = false,
  decimals = 0,
}) => {
  const animatedValue = useAnimatedCounter(value, 1500, decimals);

  const formatValue = (val: number): string => {
    if (decimals > 0) {
      return val.toFixed(decimals);
    }
    if (val >= 1000) {
      return `${(val / 1000).toFixed(1)}K`;
    }
    return Math.round(val).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded w-20" />
            <div className="h-8 bg-gray-200 rounded w-24" />
          </div>
          <div className="w-12 h-12 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-nilin-charcoal">
            {prefix}
            {formatValue(animatedValue)}
            {suffix}
          </p>

          {/* Trend Indicator */}
          {trend && (
            <div
              className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                trend.isPositive ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {trend.isPositive ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              <span>
                {trend.isPositive ? '+' : ''}
                {trend.value}% from last month
              </span>
            </div>
          )}
        </div>

        {/* Icon */}
        <div
          className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Dashboard Stats Component
// =============================================================================

const DashboardStats: React.FC<DashboardStatsProps> = ({
  showRefresh = true,
}) => {
  const [stats, setStats] = useState<DashboardStats>({
    activeBookings: 0,
    completedBookings: 0,
    totalSpent: 0,
    averageRating: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);
      const response = await customerDashboardApi.getStats();
      setStats({
        activeBookings: response.activeBookings ?? (
          response.totalBookings != null && response.completedBookings != null
            ? response.totalBookings - response.completedBookings
            : 0
        ),
        completedBookings: response.completedBookings ?? 0,
        totalSpent: response.totalSpent ?? 0,
        averageRating: response.averageRating ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setIsLoading(true);
    await fetchStats();
    setIsRefreshing(false);
  };

  const statCards = [
    {
      label: 'Active Bookings',
      value: stats.activeBookings,
      icon: Calendar,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      trend: { value: 15, isPositive: true },
    },
    {
      label: 'Completed',
      value: stats.completedBookings,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      trend: { value: 23, isPositive: true },
    },
    {
      label: 'Total Spent',
      value: stats.totalSpent,
      prefix: 'AED ',
      icon: CreditCard,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      trend: { value: 8, isPositive: true },
    },
    {
      label: 'Your Rating',
      value: stats.averageRating,
      suffix: '/5',
      icon: Star,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      decimals: 1,
      trend: undefined, // Rating doesn't have trend
    },
  ];

  if (error) {
    return (
      <section className="py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 rounded-xl p-4 text-center border border-red-100">
            <AlertCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-4" aria-labelledby="stats-heading">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4">
          <h2
            id="stats-heading"
            className="text-sm font-medium text-gray-500 uppercase tracking-wide sr-only"
          >
            Your Statistics
          </h2>

          {showRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              aria-label="Refresh statistics"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              prefix={stat.prefix}
              suffix={stat.suffix}
              icon={stat.icon}
              iconBg={stat.iconBg}
              iconColor={stat.iconColor}
              trend={stat.trend}
              isLoading={isLoading}
              decimals={stat.decimals}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default DashboardStats;
