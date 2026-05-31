import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Calendar, Star, BarChart3, Clock, Loader2, AlertCircle, TrendingDown, DollarSign, RefreshCw, Search, Heart } from 'lucide-react';
import { analyticsApi } from '../../services/analyticsApi';
import { useAuthStore } from '../../stores/authStore';

interface CustomerAnalytics {
  totalBookings?: number;
  totalSpent?: number;
  averageRating?: number;
  totalHours?: number;
  monthlyBookings?: Array<{ month: string; bookings: number }>;
  categoryBreakdown?: Array<{ category: string; count: number }>;
  topServices?: Array<{ name: string; count: number }>;
}

const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [analytics, setAnalytics] = useState<CustomerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await analyticsApi.getCustomerAnalytics();
      setAnalytics({
        totalBookings: data?.totalBookings || data?.bookingStats?.total || 0,
        totalSpent: data?.totalSpent || data?.revenueStats?.total || 0,
        averageRating: data?.averageRating || data?.ratingStats?.average || 0,
        totalHours: data?.totalHours || 0,
        monthlyBookings: data?.monthlyBookings || data?.bookingStats?.monthly || [],
        categoryBreakdown: data?.categoryBreakdown || [],
        topServices: data?.topServices || [],
      });
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleRefresh = () => {
    fetchAnalytics(true);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Calculate max for chart
  const maxBookings = analytics?.monthlyBookings?.length
    ? Math.max(...analytics.monthlyBookings.map(d => d.bookings))
    : 1;

  // Stats to display
  const stats = [
    {
      label: 'Total Bookings',
      value: analytics?.totalBookings?.toString() || '0',
      icon: Calendar,
      color: 'blue',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-600',
    },
    {
      label: 'Total Spent',
      value: formatCurrency(analytics?.totalSpent || 0),
      icon: DollarSign,
      color: 'green',
      bgColor: 'bg-green-100',
      textColor: 'text-green-600',
    },
    {
      label: 'Avg Rating',
      value: analytics?.averageRating?.toFixed(1) || '0.0',
      icon: Star,
      color: 'yellow',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-600',
    },
    {
      label: 'Hours Booked',
      value: (analytics?.totalHours || 0).toString(),
      icon: Clock,
      color: 'purple',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-600',
    },
  ];

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-nilin-primary mx-auto mb-2" />
          <p className="text-nilin-warmGray">Loading your activity...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-gradient-to-br from-red-600 to-red-500 text-white p-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/customer/profile" className="p-2 -ml-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              My Activity
            </h1>
          </div>
        </div>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-red-800 mb-2">Unable to Load Analytics</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-500 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <Link to="/customer/profile" className="p-2 -ml-2 hover:bg-white/10 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              My Activity
            </h1>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-white/10 rounded-full disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-emerald-100 text-sm">
          {analytics?.totalBookings || 0} bookings • {formatCurrency(analytics?.totalSpent || 0)} spent
        </p>
      </div>

      {/* Stats Grid */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm">
            <div className={`w-10 h-10 rounded-full ${stat.bgColor} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.textColor}`} />
            </div>
            <p className="text-2xl font-bold text-nilin-charcoal mb-1">{stat.value}</p>
            <p className="text-sm text-nilin-warmGray">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Monthly Bookings Chart */}
      {analytics?.monthlyBookings && analytics.monthlyBookings.length > 0 ? (
        <div className="px-4 mb-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Monthly Bookings</h3>
            <div className="flex items-end justify-between gap-2 h-32">
              {analytics.monthlyBookings.map((item, index) => {
                const height = maxBookings > 0 ? (item.bookings / maxBookings) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-md transition-all hover:from-emerald-600 hover:to-emerald-500"
                      style={{ height: `${Math.max(height, 4)}%` }}
                    />
                    <p className="text-xs text-nilin-warmGray mt-2">{item.month}</p>
                    <p className="text-xs font-medium text-nilin-charcoal">{item.bookings}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 mb-4">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <BarChart3 className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-nilin-warmGray">No booking data yet</p>
            <button
              onClick={() => navigate('/search')}
              className="mt-3 px-4 py-2 bg-nilin-primary text-white rounded-lg text-sm hover:bg-nilin-primary/90 transition-colors"
            >
              Book Your First Service
            </button>
          </div>
        </div>
      )}

      {/* Category Breakdown */}
      {analytics?.categoryBreakdown && analytics.categoryBreakdown.length > 0 && (
        <div className="px-4 mb-4">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">Services by Category</h3>
            <div className="space-y-3">
              {analytics.categoryBreakdown.slice(0, 5).map((cat, index) => {
                const total = analytics.categoryBreakdown.reduce((sum, c) => sum + c.count, 0);
                const percentage = total > 0 ? (cat.count / total) * 100 : 0;
                return (
                  <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-nilin-charcoal">{cat.category}</span>
                      <span className="text-nilin-warmGray">{cat.count} bookings</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Insights Section */}
      <div className="px-4 mb-4">
        <div className="bg-gradient-to-br from-nilin-primary/10 to-nilin-coral/10 rounded-xl p-4 border border-nilin-primary/20">
          <h3 className="text-lg font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-nilin-primary" />
            Insights
          </h3>
          {analytics?.totalBookings && analytics.totalBookings > 0 ? (
            <div className="space-y-2 text-sm">
              {analytics.totalBookings >= 5 && (
                <p className="text-nilin-charcoal flex items-start gap-2">
                  <Star className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                  <span>You're a regular! You've made <strong>{analytics.totalBookings} bookings</strong> with us.</span>
                </p>
              )}
              {analytics.totalSpent && analytics.totalSpent > 1000 && (
                <p className="text-nilin-charcoal flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>You've spent <strong>{formatCurrency(analytics.totalSpent)}</strong> on home services.</span>
                </p>
              )}
              {analytics.averageRating && analytics.averageRating >= 4.5 && (
                <p className="text-nilin-charcoal flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span>Your bookings consistently get great ratings!</span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-nilin-warmGray text-sm">
              Book your first service to start earning insights!
            </p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4">
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-nilin-charcoal mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/search')}
              className="p-3 bg-nilin-primary/10 rounded-lg text-left hover:bg-nilin-primary/20 transition-colors"
            >
              <Search className="w-5 h-5 text-nilin-primary mb-1" />
              <p className="text-sm font-medium text-nilin-charcoal">Book Again</p>
            </button>
            <button
              onClick={() => navigate('/customer/favorites')}
              className="p-3 bg-red-50 rounded-lg text-left hover:bg-red-100 transition-colors"
            >
              <Heart className="w-5 h-5 text-red-500 mb-1" />
              <p className="text-sm font-medium text-nilin-charcoal">Favorites</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
