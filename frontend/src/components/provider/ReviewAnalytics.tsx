/**
 * ReviewAnalytics Component
 * Displays rating trends, response rates, and review metrics for providers
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Star,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Calendar,
  Loader2,
  AlertCircle,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { reviewsApi } from '../../services/reviewsApi';

interface ReviewAnalyticsProps {
  providerId: string;
  className?: string;
}

interface AnalyticsData {
  summary: {
    totalReviews: number;
    averageRating: number;
    responseRate: number;
    recentAvgRating: number;
  };
  trends: Array<{
    month: string;
    averageRating: number;
    count: number;
  }>;
  ratingDistribution: Record<number, number>;
  period: string;
}

const periodOptions = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
  { value: 'all', label: 'All time' },
] as const;

export const ReviewAnalytics: React.FC<ReviewAnalyticsProps> = ({
  providerId,
  className,
}) => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'30d' | '90d' | '1y' | 'all'>('30d');
  const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    if (!providerId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await reviewsApi.getProviderReviewAnalytics(providerId, period);
      if (response.success) {
        setAnalytics(response.data);
      } else {
        setError('Failed to load analytics');
      }
    } catch (err) {
      console.error('Error fetching review analytics:', err);
      setError('Failed to load analytics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [providerId, period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatRating = (rating: number) => {
    return rating.toFixed(1);
  };

  const calculateTrend = () => {
    if (!analytics?.trends || analytics.trends.length < 2) return null;

    const recent = analytics.trends.slice(-3);
    const older = analytics.trends.slice(0, -3);

    if (recent.length === 0 || older.length === 0) return null;

    const recentAvg = recent.reduce((sum, t) => sum + t.averageRating, 0) / recent.length;
    const olderAvg = older.reduce((sum, t) => sum + t.averageRating, 0) / older.length;

    const diff = recentAvg - olderAvg;
    const isPositive = diff > 0;
    const percentChange = olderAvg > 0 ? Math.abs((diff / olderAvg) * 100) : 0;

    return { diff, isPositive, percentChange };
  };

  const trend = calculateTrend();

  const maxTrendCount = analytics?.trends.reduce((max, t) => Math.max(max, t.count), 0) || 1;

  if (loading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 text-nilin-coral animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="flex items-center justify-center h-48 text-red-500">
          <AlertCircle className="w-8 h-8 mr-2" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">Review Analytics</h3>
            <p className="text-sm text-nilin-warmGray">Track your rating trends</p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="relative">
          <button
            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
            className="flex items-center gap-2 px-3 py-2 border border-nilin-border rounded-lg text-sm hover:bg-nilin-blush/30 transition-colors"
          >
            {periodOptions.find((p) => p.value === period)?.label}
            <ChevronDown className="w-4 h-4" />
          </button>

          {showPeriodDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowPeriodDropdown(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-nilin-border rounded-lg shadow-lg overflow-hidden">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setPeriod(option.value);
                      setShowPeriodDropdown(false);
                    }}
                    className={cn(
                      'w-full px-4 py-2 text-left text-sm hover:bg-nilin-blush/30 transition-colors',
                      period === option.value && 'bg-nilin-blush/50 text-nilin-coral font-medium'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Reviews */}
        <div className="bg-nilin-muted/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-nilin-warmGray text-xs mb-1">
            <MessageSquare className="w-3.5 h-3.5" />
            Total Reviews
          </div>
          <p className="text-2xl font-bold text-nilin-charcoal">
            {analytics.summary.totalReviews}
          </p>
        </div>

        {/* Average Rating */}
        <div className="bg-amber-50/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-600 text-xs mb-1">
            <Star className="w-3.5 h-3.5 fill-current" />
            Average Rating
          </div>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-bold text-nilin-charcoal">
              {formatRating(analytics.summary.averageRating)}
            </p>
            <span className="text-nilin-warmGray text-sm">/ 5</span>
          </div>
          {trend && (
            <div className={cn(
              'flex items-center gap-1 mt-1 text-xs',
              trend.isPositive ? 'text-green-600' : 'text-red-500'
            )}>
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{trend.percentChange.toFixed(1)}% vs previous period</span>
            </div>
          )}
        </div>

        {/* Response Rate */}
        <div className="bg-emerald-50/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-emerald-600 text-xs mb-1">
            <MessageSquare className="w-3.5 h-3.5" />
            Response Rate
          </div>
          <p className="text-2xl font-bold text-nilin-charcoal">
            {analytics.summary.responseRate}%
          </p>
        </div>

        {/* Recent Average */}
        <div className="bg-nilin-muted/50 rounded-xl p-4">
          <div className="flex items-center gap-2 text-nilin-warmGray text-xs mb-1">
            <Calendar className="w-3.5 h-3.5" />
            Recent Avg Rating
          </div>
          <p className="text-2xl font-bold text-nilin-charcoal">
            {formatRating(analytics.summary.recentAvgRating)}
          </p>
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Rating Distribution</h4>
        <div className="space-y-2">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = analytics.ratingDistribution[rating] || 0;
            const percentage = analytics.summary.totalReviews > 0
              ? (count / analytics.summary.totalReviews) * 100
              : 0;

            return (
              <div key={rating} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-12">
                  <span className="text-sm font-medium text-nilin-charcoal">{rating}</span>
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                </div>
                <div className="flex-1 h-2 bg-nilin-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-sm text-nilin-warmGray w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rating Trends Chart */}
      {analytics.trends.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-nilin-charcoal mb-3">Monthly Trends</h4>
          <div className="flex items-end gap-2 h-24">
            {analytics.trends.map((trend, index) => {
              const height = (trend.count / maxTrendCount) * 100;
              const isLast = index === analytics.trends.length - 1;

              return (
                <div key={trend.month} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'w-full rounded-t transition-all duration-300',
                      isLast ? 'bg-nilin-coral' : 'bg-nilin-coral/50 hover:bg-nilin-coral/70'
                    )}
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${trend.count} reviews, ${trend.averageRating.toFixed(1)} avg rating`}
                  />
                  <span className="text-xs text-nilin-warmGray">{trend.month}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {analytics.summary.totalReviews === 0 && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-nilin-muted/50 flex items-center justify-center mx-auto mb-3">
            <MessageSquare className="w-6 h-6 text-nilin-warmGray" />
          </div>
          <p className="text-nilin-warmGray">No reviews yet</p>
          <p className="text-sm text-nilin-lightGray mt-1">
            Complete more bookings to start seeing analytics
          </p>
        </div>
      )}
    </div>
  );
};

export default ReviewAnalytics;
