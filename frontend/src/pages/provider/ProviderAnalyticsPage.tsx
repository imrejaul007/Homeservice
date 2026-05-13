import React, { useState, useEffect } from 'react';
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
  Heart,
  Clock,
  BarChart3,
  PieChart,
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useAuthStore } from '../../stores/authStore';

interface AnalyticsData {
  overview: {
    totalViews: number;
    viewsTrend: number;
    profileViews: number;
    profileViewsTrend: number;
    bookingRequests: number;
    bookingRequestsTrend: number;
    conversionRate: number;
    conversionRateTrend: number;
  };
  earnings: {
    thisMonth: number;
    lastMonth: number;
    trend: number;
  };
  bookings: {
    total: number;
    completed: number;
    pending: number;
    cancelled: number;
  };
  topServices: Array<{
    name: string;
    bookings: number;
    revenue: number;
  }>;
  weeklyData: Array<{
    day: string;
    bookings: number;
    revenue: number;
  }>;
  ratings: {
    average: number;
    total: number;
    breakdown: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  };
}

// Mock analytics data
const mockAnalytics: AnalyticsData = {
  overview: {
    totalViews: 12453,
    viewsTrend: 12.5,
    profileViews: 892,
    profileViewsTrend: 8.3,
    bookingRequests: 47,
    bookingRequestsTrend: -2.1,
    conversionRate: 5.3,
    conversionRateTrend: 0.8,
  },
  earnings: {
    thisMonth: 4850,
    lastMonth: 4200,
    trend: 15.5,
  },
  bookings: {
    total: 156,
    completed: 142,
    pending: 8,
    cancelled: 6,
  },
  topServices: [
    { name: 'Hair Coloring', bookings: 45, revenue: 3150 },
    { name: 'Bridal Makeup', bookings: 28, revenue: 5600 },
    { name: 'Nail Art', bookings: 35, revenue: 1750 },
    { name: 'Facial Treatment', bookings: 22, revenue: 1980 },
    { name: 'Massage Therapy', bookings: 18, revenue: 2160 },
  ],
  weeklyData: [
    { day: 'Mon', bookings: 8, revenue: 640 },
    { day: 'Tue', bookings: 12, revenue: 960 },
    { day: 'Wed', bookings: 15, revenue: 1200 },
    { day: 'Thu', bookings: 10, revenue: 800 },
    { day: 'Fri', bookings: 18, revenue: 1440 },
    { day: 'Sat', bookings: 22, revenue: 1760 },
    { day: 'Sun', bookings: 14, revenue: 1120 },
  ],
  ratings: {
    average: 4.8,
    total: 89,
    breakdown: {
      5: 72,
      4: 12,
      3: 3,
      2: 1,
      1: 1,
    },
  },
};

const ProviderAnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState<AnalyticsData>(mockAnalytics);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if not a provider
  useEffect(() => {
    if (user?.role !== 'provider') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const StatCard = ({
    title,
    value,
    trend,
    icon: Icon,
    suffix = '',
  }: {
    title: string;
    value: number | string;
    trend: number;
    icon: React.ElementType;
    suffix?: string;
  }) => {
    const isPositive = trend >= 0;
    return (
      <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 bg-nilin-coral/10 rounded-nilin">
            <Icon className="h-5 w-5 text-nilin-coral" />
          </div>
          <div className={`flex items-center gap-1 text-sm font-medium ${
            isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
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
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate('/provider/dashboard')}
              className="flex items-center text-nilin-warmGray hover:text-nilin-charcoal mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </button>

            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-serif text-nilin-charcoal mb-2">Analytics</h1>
                <p className="text-nilin-warmGray">Track your performance and insights</p>
              </div>

              {/* Time Range Selector */}
              <div className="flex items-center gap-2 bg-white rounded-nilin p-1 shadow-nilin">
                {(['7d', '30d', '90d'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-4 py-2 rounded-nilin text-sm font-medium transition-colors ${
                      timeRange === range
                        ? 'bg-nilin-coral text-white'
                        : 'text-nilin-warmGray hover:text-nilin-charcoal'
                    }`}
                  >
                    {range === '7d' ? 'Last 7 days' : range === '30d' ? 'Last 30 days' : 'Last 90 days'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Service Views"
              value={analytics.overview.totalViews}
              trend={analytics.overview.viewsTrend}
              icon={Eye}
            />
            <StatCard
              title="Profile Views"
              value={analytics.overview.profileViews}
              trend={analytics.overview.profileViewsTrend}
              icon={Users}
            />
            <StatCard
              title="Booking Requests"
              value={analytics.overview.bookingRequests}
              trend={analytics.overview.bookingRequestsTrend}
              icon={Calendar}
            />
            <StatCard
              title="Conversion Rate"
              value={analytics.overview.conversionRate}
              trend={analytics.overview.conversionRateTrend}
              icon={TrendingUp}
              suffix="%"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Weekly Performance Chart */}
            <div className="lg:col-span-2">
              <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-serif text-nilin-charcoal">Weekly Performance</h2>
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

                {/* Simple Bar Chart */}
                <div className="h-64 flex items-end justify-between gap-4">
                  {analytics.weeklyData.map((day, index) => {
                    const maxBookings = Math.max(...analytics.weeklyData.map((d) => d.bookings));
                    const height = (day.bookings / maxBookings) * 100;
                    return (
                      <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full flex flex-col items-center gap-1">
                          <span className="text-xs text-nilin-warmGray">${day.revenue}</span>
                          <div
                            className="w-full max-w-12 bg-nilin-coral rounded-t-nilin transition-all hover:bg-nilin-rose"
                            style={{ height: `${height}%`, minHeight: '20px' }}
                          />
                          <span className="text-xs text-nilin-warmGray">{day.bookings}</span>
                        </div>
                        <span className="text-xs font-medium text-nilin-charcoal">{day.day}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Earnings Summary */}
            <div className="lg:col-span-1">
              <div className="glass-nilin rounded-nilin-lg p-6 hover-lift mb-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-green-100 rounded-nilin">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-serif text-nilin-charcoal">This Month</h2>
                    <p className="text-xs text-nilin-warmGray">vs last month</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-3xl font-bold text-nilin-charcoal">
                    ${analytics.earnings.thisMonth.toLocaleString()}
                  </p>
                  <div className={`flex items-center gap-1 text-sm font-medium ${
                    analytics.earnings.trend >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {analytics.earnings.trend >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    {Math.abs(analytics.earnings.trend)}% from last month
                  </div>
                </div>

                <div className="pt-4 border-t border-nilin-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-nilin-warmGray">Last Month</span>
                    <span className="font-medium text-nilin-charcoal">
                      ${analytics.earnings.lastMonth.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rating Summary */}
              <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-yellow-100 rounded-nilin">
                    <Star className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-serif text-nilin-charcoal">Rating</h2>
                    <p className="text-xs text-nilin-warmGray">{analytics.ratings.total} reviews</p>
                  </div>
                </div>

                <div className="text-center mb-6">
                  <p className="text-4xl font-bold text-nilin-charcoal">{analytics.ratings.average}</p>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${
                          star <= Math.floor(analytics.ratings.average)
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300'
                        }`}
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
                              width: `${(count / analytics.ratings.total) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-sm text-nilin-warmGray w-8 text-right">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Top Services */}
          <div className="mt-8">
            <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-nilin-coral/10 rounded-nilin">
                  <PieChart className="h-5 w-5 text-nilin-coral" />
                </div>
                <h2 className="text-lg font-serif text-nilin-charcoal">Top Services</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-nilin-border">
                      <th className="text-left py-3 px-4 text-sm font-medium text-nilin-warmGray">Service</th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-nilin-warmGray">Bookings</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-nilin-warmGray">Revenue</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-nilin-warmGray">Avg Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.topServices.map((service, index) => (
                      <tr
                        key={service.name}
                        className="border-b border-nilin-border last:border-b-0 hover:bg-nilin-muted/50 transition-colors"
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <span className="text-nilin-warmGray text-sm">#{index + 1}</span>
                            <span className="font-medium text-nilin-charcoal">{service.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-center text-nilin-charcoal">{service.bookings}</td>
                        <td className="py-4 px-4 text-right font-medium text-nilin-charcoal">
                          ${service.revenue.toLocaleString()}
                        </td>
                        <td className="py-4 px-4 text-right text-nilin-warmGray">
                          ${(service.revenue / service.bookings).toFixed(0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Booking Status */}
          <div className="mt-8">
            <div className="glass-nilin rounded-nilin-lg p-6 hover-lift">
              <h2 className="text-lg font-serif text-nilin-charcoal mb-6">Booking Overview</h2>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-nilin-muted rounded-nilin">
                  <p className="text-2xl font-bold text-nilin-charcoal">{analytics.bookings.total}</p>
                  <p className="text-sm text-nilin-warmGray">Total Bookings</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-nilin">
                  <p className="text-2xl font-bold text-green-600">{analytics.bookings.completed}</p>
                  <p className="text-sm text-green-600">Completed</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-nilin">
                  <p className="text-2xl font-bold text-yellow-600">{analytics.bookings.pending}</p>
                  <p className="text-sm text-yellow-600">Pending</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-nilin">
                  <p className="text-2xl font-bold text-red-600">{analytics.bookings.cancelled}</p>
                  <p className="text-sm text-red-600">Cancelled</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default ProviderAnalyticsPage;
