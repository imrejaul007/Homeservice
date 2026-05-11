import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  Award,
  Heart,
  Package,
  Search,
  Sparkles
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';

interface StatCard {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'increase' | 'decrease';
  icon: React.ReactNode;
  gradient: string;
}

const CustomerStatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { customerBookings, getCustomerBookings, isLoading } = useBookingStore();

  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');

  // Helper function for time-based greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    getCustomerBookings({ limit: 100 });
  }, []);

  // Calculate statistics
  const calculateStats = () => {
    if (!customerBookings || customerBookings.length === 0) {
      return {
        totalBookings: 0,
        totalSpent: 0,
        completedBookings: 0,
        pendingBookings: 0,
        cancelledBookings: 0,
        averageSpent: 0,
        favoriteCategory: 'N/A'
      };
    }

    const totalBookings = customerBookings.length;
    const totalSpent = customerBookings.reduce((sum, booking) => sum + (booking.pricing?.totalAmount || booking.pricing?.total || 0), 0);
    const completedBookings = customerBookings.filter(b => b.status === 'completed').length;
    const pendingBookings = customerBookings.filter(b => b.status === 'pending').length;
    const cancelledBookings = customerBookings.filter(b => b.status === 'cancelled').length;
    const averageSpent = totalSpent / totalBookings;

    // Find favorite category
    const categoryCount: { [key: string]: number } = {};
    customerBookings.forEach(booking => {
      const category = booking.service?.category || 'Other';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    const favoriteCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      totalBookings,
      totalSpent,
      completedBookings,
      pendingBookings,
      cancelledBookings,
      averageSpent,
      favoriteCategory
    };
  };

  const stats = calculateStats();

  const statCards: StatCard[] = [
    {
      title: 'Total Bookings',
      value: stats.totalBookings,
      change: '+12%',
      changeType: 'increase',
      icon: <Calendar className="h-6 w-6" />,
      gradient: 'bg-gradient-to-br from-pink-100 to-pink-50'
    },
    {
      title: 'Total Spent',
      value: `AED ${stats.totalSpent.toFixed(2)}`,
      change: '+8%',
      changeType: 'increase',
      icon: <DollarSign className="h-6 w-6" />,
      gradient: 'bg-gradient-to-br from-blue-100 to-blue-50'
    },
    {
      title: 'Completed',
      value: stats.completedBookings,
      icon: <CheckCircle className="h-6 w-6" />,
      gradient: 'bg-gradient-to-br from-green-100 to-green-50'
    },
    {
      title: 'Average Spent',
      value: `AED ${stats.averageSpent.toFixed(2)}`,
      icon: <TrendingUp className="h-6 w-6" />,
      gradient: 'bg-gradient-to-br from-purple-100 to-purple-50'
    }
  ];

  const statusCards = [
    {
      title: 'Pending',
      count: stats.pendingBookings,
      icon: <Clock className="h-5 w-5" />,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200'
    },
    {
      title: 'Completed',
      count: stats.completedBookings,
      icon: <CheckCircle className="h-5 w-5" />,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200'
    },
    {
      title: 'Cancelled',
      count: stats.cancelledBookings,
      icon: <XCircle className="h-5 w-5" />,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200'
    }
  ];

  const quickActions = [
    {
      title: 'Browse Services',
      description: 'Find your next service',
      icon: <Search className="h-6 w-6" />,
      link: '/search',
      gradient: 'from-pink-500 to-rose-500'
    },
    {
      title: 'My Bookings',
      description: 'View & manage bookings',
      icon: <Calendar className="h-6 w-6" />,
      link: '/customer/bookings',
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Favorites',
      description: 'Your saved providers',
      icon: <Heart className="h-6 w-6" />,
      link: '/customer/favorites',
      gradient: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Rewards',
      description: 'Points & benefits',
      icon: <Award className="h-6 w-6" />,
      link: '/customer/rewards',
      gradient: 'from-yellow-500 to-orange-500'
    }
  ];

  // Get recent bookings (last 5)
  const recentBookings = customerBookings?.slice(0, 5) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-400"></div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <NavigationHeader />

      {/* Breadcrumb Navigation */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Personalized Greeting Banner */}
          <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 rounded-2xl p-8 mb-8 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <Sparkles className="h-8 w-8" />
              <h1 className="text-3xl md:text-4xl font-bold">
                {getGreeting()}, {user?.firstName || 'there'}!
              </h1>
            </div>
            <p className="text-white/90 text-lg">
              Welcome back to your dashboard. Here's what's happening with your bookings.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => navigate(action.link)}
                className={`bg-gradient-to-br ${action.gradient} text-white rounded-xl p-6 hover:scale-105 transition-transform shadow-md hover:shadow-xl`}
              >
                <div className="mb-3">{action.icon}</div>
                <h3 className="font-bold text-lg mb-1">{action.title}</h3>
                <p className="text-sm text-white/90">{action.description}</p>
              </button>
            ))}
          </div>

          {/* Period Selector */}
          <div className="mb-6 flex items-center gap-3">
            <span className="text-sm text-gray-600">Period:</span>
            {(['week', 'month', 'year'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-lg font-medium transition-all capitalize ${
                  selectedPeriod === period
                    ? 'bg-gradient-nilin-primary text-gray-900'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statCards.map((card, index) => (
              <div
                key={index}
                className={`${card.gradient} rounded-2xl p-6 border border-gray-200 hover:shadow-lg transition-shadow`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    <div className="text-gray-700">{card.icon}</div>
                  </div>
                  {card.change && (
                    <span
                      className={`text-sm font-semibold ${
                        card.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {card.change}
                    </span>
                  )}
                </div>
                <h3 className="text-sm text-gray-600 mb-1">{card.title}</h3>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Booking Status Distribution */}
            <div className="lg:col-span-1 bg-white rounded-2xl border p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Booking Status</h2>
              <div className="space-y-4">
                {statusCards.map((status, index) => (
                  <div
                    key={index}
                    className={`${status.bg} ${status.border} border rounded-xl p-4 flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`${status.color}`}>{status.icon}</div>
                      <span className="font-medium text-gray-900">{status.title}</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-900">{status.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-2 bg-white rounded-2xl border p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
                <button
                  onClick={() => navigate('/customer/bookings')}
                  className="text-sm text-pink-600 hover:text-pink-700 font-medium flex items-center gap-1"
                >
                  View All
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>

              {recentBookings.length > 0 ? (
                <div className="space-y-3">
                  {recentBookings.map((booking) => (
                    <div
                      key={booking._id}
                      onClick={() => navigate(`/customer/bookings/${booking._id}`)}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <div className="p-3 bg-gradient-nilin-primary rounded-lg">
                        <Package className="h-5 w-5 text-gray-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">
                          {booking.service?.name || 'Service'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {new Date(booking.scheduledDate).toLocaleDateString()} • {booking.scheduledTime}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-bold text-gray-900">AED {booking.pricing?.totalAmount || booking.pricing?.total || 0}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            booking.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : booking.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : booking.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No recent activity</p>
                  <button
                    onClick={() => navigate('/search')}
                    className="mt-4 px-6 py-3 bg-gradient-nilin-primary text-gray-900 font-semibold rounded-lg hover:shadow-lg transition-shadow"
                  >
                    Book a Service
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pro Tip / Insights Section */}
          {stats.totalBookings > 0 ? (
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Sparkles className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg mb-2">💡 Pro Tip</h3>
                  <p className="text-gray-700">
                    {stats.totalBookings >= 5
                      ? `You're a regular! Your favorite category is ${stats.favoriteCategory}. Book 3 more services this month to unlock exclusive Silver tier rewards and get 10% off all future bookings!`
                      : stats.totalBookings >= 1
                      ? `Great start! You've booked ${stats.totalBookings} service${stats.totalBookings > 1 ? 's' : ''}. Book ${5 - stats.totalBookings} more to unlock loyalty rewards and special perks!`
                      : 'Book your first service today and earn 100 welcome points instantly!'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 mb-6 bg-white rounded-2xl border border-gray-200">
              <div className="max-w-md mx-auto">
                <Package className="h-20 w-20 text-gray-300 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Start Your Journey
                </h3>
                <p className="text-gray-600 mb-6">
                  No bookings yet. Discover amazing services from trusted providers and get things done effortlessly!
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => navigate('/search')}
                    className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow"
                  >
                    Browse Services
                  </button>
                  <button
                    onClick={() => navigate('/customer/favorites')}
                    className="px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:border-gray-300 transition-colors"
                  >
                    View Favorites
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Actions & Insights */}
          {stats.totalBookings > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Favorite Category */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    <Heart className="h-6 w-6 text-purple-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Favorite Category</h2>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-2">{stats.favoriteCategory}</p>
                <p className="text-gray-600">Your most booked service category</p>
              </div>

              {/* Loyalty Rewards */}
              <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl border border-yellow-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-white rounded-xl shadow-sm">
                    <Award className="h-6 w-6 text-yellow-600" />
                  </div>
                  <h2 className="text-xl font-bold text-gray-900">Loyalty Points</h2>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-2">{stats.totalBookings * 100}</p>
                <p className="text-gray-600">Earn more points with each booking</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default CustomerStatsPage;
