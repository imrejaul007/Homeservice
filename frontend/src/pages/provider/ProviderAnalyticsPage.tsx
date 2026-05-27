import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Calendar,
  DollarSign,
  Star,
  Eye,
  PieChart,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';
import {
  providerAnalyticsApi,
  type ProviderInsightsAnalytics,
} from '../../services/providerApi';
import { cn } from '../../lib/utils';

const EMPTY_ANALYTICS: ProviderInsightsAnalytics = {
  overview: {
    totalViews: 0,
    viewsTrend: 0,
    profileViews: 0,
    profileViewsTrend: 0,
    bookingRequests: 0,
    bookingRequestsTrend: 0,
    conversionRate: 0,
    conversionRateTrend: 0,
  },
  earnings: { thisMonth: 0, lastMonth: 0, trend: 0 },
  bookings: { total: 0, completed: 0, pending: 0, cancelled: 0 },
  topServices: [],
  weeklyData: [
    { day: 'Mon', bookings: 0, revenue: 0 },
    { day: 'Tue', bookings: 0, revenue: 0 },
    { day: 'Wed', bookings: 0, revenue: 0 },
    { day: 'Thu', bookings: 0, revenue: 0 },
    { day: 'Fri', bookings: 0, revenue: 0 },
    { day: 'Sat', bookings: 0, revenue: 0 },
    { day: 'Sun', bookings: 0, revenue: 0 },
  ],
  ratings: {
    average: 0,
    total: 0,
    breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  },
};

const PERIOD_LABELS: Record<'7d' | '30d' | '90d', { current: string; previous: string }> = {
  '7d': { current: 'Last 7 days', previous: 'Previous 7 days' },
  '30d': { current: 'Last 30 days', previous: 'Previous 30 days' },
  '90d': { current: 'Last 90 days', previous: 'Previous 90 days' },
};

const ProviderAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState<ProviderInsightsAnalytics>(EMPTY_ANALYTICS);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const loadAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await providerAnalyticsApi.getProviderInsights(timeRange);
      if (response.success && response.data) {
        setAnalytics(response.data);
      } else {
        setAnalytics(EMPTY_ANALYTICS);
      }
    } catch (err) {
      console.error('Failed to load provider analytics:', err);
      setError('Unable to load analytics. Please try again.');
      setAnalytics(EMPTY_ANALYTICS);
    } finally {
      setIsLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    if (user?.role === 'provider') {
      void loadAnalytics();
    }
  }, [loadAnalytics, user?.role]);

  const periodLabels = PERIOD_LABELS[timeRange];
  const maxBookings = Math.max(...analytics.weeklyData.map((d) => d.bookings), 1);

  const StatCard = ({
    title,
    value,
    trend,
    icon: Icon,
    suffix = '',
    hint,
  }: {
    title: string;
    value: number | string;
    trend: number;
    icon: React.ElementType;
    suffix?: string;
    hint?: string;
  }) => {
    const isPositive = trend >= 0;
    return (
      <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-nilin-coral/10 rounded-nilin">
            <Icon className="h-5 w-5 text-nilin-coral" />
          </div>
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-medium',
              isPositive ? 'text-green-600' : 'text-red-600',
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {Math.abs(trend)}%
          </div>
        </div>
        <p className="text-sm text-nilin-warmGray mb-1">{title}</p>
        <p className="text-2xl font-bold text-nilin-charcoal">
          {typeof value === 'number' ? value.toLocaleString() : value}
          {suffix}
        </p>
        {hint && <p className="text-xs text-nilin-warmGray mt-1">{hint}</p>}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <button
              type="button"
              onClick={() => navigate('/provider/dashboard')}
              className="flex items-center text-nilin-warmGray hover:text-nilin-charcoal mb-4 transition-colors font-sans text-sm"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </button>

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">Analytics</h1>
                <p className="text-nilin-warmGray font-sans">
                  Track your performance and insights
                </p>
              </div>

              <div className="flex items-center gap-2 bg-white rounded-nilin p-1 shadow-nilin">
                {(['7d', '30d', '90d'] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setTimeRange(range)}
                    disabled={isLoading}
                    className={cn(
                      'px-4 py-2 rounded-nilin text-sm font-medium transition-colors',
                      timeRange === range
                        ? 'bg-nilin-coral text-white'
                        : 'text-nilin-warmGray hover:text-nilin-charcoal',
                    )}
                  >
                    {range === '7d'
                      ? 'Last 7 days'
                      : range === '30d'
                        ? 'Last 30 days'
                        : 'Last 90 days'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-center gap-2 rounded-nilin-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
              <button
                type="button"
                onClick={() => void loadAnalytics()}
                className="ml-auto font-medium underline"
              >
                Retry
              </button>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-nilin-coral" />
              <p className="text-nilin-warmGray font-sans">Loading analytics…</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                  title="Listing impressions"
                  value={analytics.overview.totalViews}
                  trend={analytics.overview.viewsTrend}
                  icon={Eye}
                  hint="All-time search impressions on your services"
                />
                <StatCard
                  title="Profile views"
                  value={analytics.overview.profileViews}
                  trend={analytics.overview.profileViewsTrend}
                  icon={Users}
                  hint={periodLabels.current}
                />
                <StatCard
                  title="Booking requests"
                  value={analytics.overview.bookingRequests}
                  trend={analytics.overview.bookingRequestsTrend}
                  icon={Calendar}
                  hint={periodLabels.current}
                />
                <StatCard
                  title="Booking rate"
                  value={analytics.overview.conversionRate}
                  trend={analytics.overview.conversionRateTrend}
                  icon={TrendingUp}
                  suffix="%"
                  hint="Requests ÷ listing clicks"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-serif text-nilin-charcoal">
                        {timeRange === '7d' ? 'Daily performance' : 'Weekly performance'}
                      </h2>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-nilin-coral" />
                          <span className="text-nilin-warmGray">Bookings</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-nilin-coral/30" />
                          <span className="text-nilin-warmGray">Revenue</span>
                        </div>
                      </div>
                    </div>

                    <div className="h-64 flex items-end justify-between gap-2 sm:gap-4">
                      {analytics.weeklyData.map((day) => {
                        const height = (day.bookings / maxBookings) * 100;
                        return (
                          <div
                            key={day.day}
                            className="flex-1 flex flex-col items-center gap-2 min-w-0"
                          >
                            <div className="w-full flex flex-col items-center gap-1">
                              <span className="text-xs text-nilin-warmGray truncate w-full text-center">
                                ${day.revenue.toLocaleString()}
                              </span>
                              <div
                                className="w-full max-w-12 bg-nilin-coral rounded-t-nilin transition-all hover:bg-nilin-rose mx-auto"
                                style={{
                                  height: `${Math.max(height, day.bookings > 0 ? 8 : 4)}%`,
                                  minHeight: day.bookings > 0 ? '20px' : '4px',
                                }}
                              />
                              <span className="text-xs text-nilin-warmGray">{day.bookings}</span>
                            </div>
                            <span className="text-xs font-medium text-nilin-charcoal">
                              {day.day}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <div className="glass-nilin rounded-nilin-lg p-6 hover-lift mb-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-green-100 rounded-nilin">
                        <DollarSign className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-serif text-nilin-charcoal">
                          {periodLabels.current}
                        </h2>
                        <p className="text-xs text-nilin-warmGray">vs {periodLabels.previous.toLowerCase()}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-3xl font-bold text-nilin-charcoal">
                        ${analytics.earnings.thisMonth.toLocaleString()}
                      </p>
                      <div
                        className={cn(
                          'flex items-center gap-1 text-sm font-medium',
                          analytics.earnings.trend >= 0 ? 'text-green-600' : 'text-red-600',
                        )}
                      >
                        {analytics.earnings.trend >= 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {Math.abs(analytics.earnings.trend)}% vs previous period
                      </div>
                    </div>

                    <div className="pt-4 border-t border-nilin-border">
                      <div className="flex justify-between text-sm">
                        <span className="text-nilin-warmGray">{periodLabels.previous}</span>
                        <span className="font-medium text-nilin-charcoal">
                          ${analytics.earnings.lastMonth.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-yellow-100 rounded-nilin">
                        <Star className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <h2 className="text-lg font-serif text-nilin-charcoal">Rating</h2>
                        <p className="text-xs text-nilin-warmGray">
                          {analytics.ratings.total} reviews
                        </p>
                      </div>
                    </div>

                    <div className="text-center mb-6">
                      <p className="text-4xl font-bold text-nilin-charcoal">
                        {analytics.ratings.average.toFixed(1)}
                      </p>
                      <div className="flex items-center justify-center gap-1 mt-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={cn(
                              'h-4 w-4',
                              star <= Math.round(analytics.ratings.average)
                                ? 'text-yellow-500 fill-yellow-500'
                                : 'text-gray-300',
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {Object.entries(analytics.ratings.breakdown)
                        .sort((a, b) => Number(b[0]) - Number(a[0]))
                        .map(([rating, count]) => (
                          <div key={rating} className="flex items-center gap-3">
                            <span className="text-sm text-nilin-warmGray w-6">{rating}★</span>
                            <div className="flex-1 h-2 bg-nilin-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-500 rounded-full"
                                style={{
                                  width: `${
                                    analytics.ratings.total > 0
                                      ? (count / analytics.ratings.total) * 100
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-nilin-warmGray w-8 text-right">
                              {count}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-nilin-coral/10 rounded-nilin">
                      <PieChart className="h-5 w-5 text-nilin-coral" />
                    </div>
                    <h2 className="text-lg font-serif text-nilin-charcoal">Top Services</h2>
                  </div>

                  {analytics.topServices.length === 0 ? (
                    <p className="text-center text-nilin-warmGray py-8 font-sans">
                      No completed bookings in this period yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-nilin-border">
                            <th className="text-left py-3 px-4 text-sm font-medium text-nilin-warmGray">
                              Service
                            </th>
                            <th className="text-center py-3 px-4 text-sm font-medium text-nilin-warmGray">
                              Bookings
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-nilin-warmGray">
                              Revenue
                            </th>
                            <th className="text-right py-3 px-4 text-sm font-medium text-nilin-warmGray">
                              Avg Price
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.topServices.map((service, index) => (
                            <tr
                              key={`${service.name}-${index}`}
                              className="border-b border-nilin-border last:border-b-0 hover:bg-nilin-muted/50 transition-colors"
                            >
                              <td className="py-4 px-4">
                                <div className="flex items-center gap-3">
                                  <span className="text-nilin-warmGray text-sm">#{index + 1}</span>
                                  <span className="font-medium text-nilin-charcoal">
                                    {service.name}
                                  </span>
                                </div>
                              </td>
                              <td className="py-4 px-4 text-center text-nilin-charcoal">
                                {service.bookings}
                              </td>
                              <td className="py-4 px-4 text-right font-medium text-nilin-charcoal">
                                ${service.revenue.toLocaleString()}
                              </td>
                              <td className="py-4 px-4 text-right text-nilin-warmGray">
                                $
                                {service.bookings > 0
                                  ? Math.round(service.revenue / service.bookings).toLocaleString()
                                  : '0'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8">
                <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
                  <h2 className="text-lg font-serif text-nilin-charcoal mb-6">
                    Booking Overview
                  </h2>
                  <p className="text-xs text-nilin-warmGray mb-4 -mt-4">
                    {periodLabels.current}
                  </p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-nilin-muted rounded-nilin">
                      <p className="text-2xl font-bold text-nilin-charcoal">
                        {analytics.bookings.total}
                      </p>
                      <p className="text-sm text-nilin-warmGray">Total Bookings</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-nilin">
                      <p className="text-2xl font-bold text-green-600">
                        {analytics.bookings.completed}
                      </p>
                      <p className="text-sm text-green-600">Completed</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-nilin">
                      <p className="text-2xl font-bold text-yellow-600">
                        {analytics.bookings.pending}
                      </p>
                      <p className="text-sm text-yellow-600">Pending</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-nilin">
                      <p className="text-2xl font-bold text-red-600">
                        {analytics.bookings.cancelled}
                      </p>
                      <p className="text-sm text-red-600">Cancelled</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProviderAnalyticsPage;
