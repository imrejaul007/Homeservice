import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  ArrowRight,
  Award,
  Heart,
  Package,
  Search,
  Sparkles,
  Coins,
  Zap
} from 'lucide-react';
import NavigationHeader from '../../components/layout/NavigationHeader';
import Footer from '../../components/layout/Footer';
import Breadcrumb from '../../components/common/Breadcrumb';
import { useBookingStore } from '../../stores/bookingStore';
import { useAuthStore } from '../../stores/authStore';
import { loyaltyApi, type LoyaltyStatus } from '../../services/loyaltyApi';
import { toast } from 'react-hot-toast';

interface StatCard {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'increase' | 'decrease';
  icon: React.ReactNode;
}

const CustomerStatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { customerBookings, getCustomerBookings, isLoading } = useBookingStore();

  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [loyaltyStatus, setLoyaltyStatus] = useState<LoyaltyStatus | null>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    getCustomerBookings({ limit: 100 });
    fetchLoyaltyStatus();
  }, [selectedPeriod]);

  const fetchLoyaltyStatus = async () => {
    try {
      const response = await loyaltyApi.getStatus();
      setLoyaltyStatus(response?.data ?? null);
    } catch {
      // Silent failure - loyalty status will not display
      toast.error('Failed to load loyalty status');
    }
  };

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
      icon: <Calendar className="h-5 w-5" />
    },
    {
      title: 'Total Spent',
      value: `AED ${stats.totalSpent.toFixed(0)}`,
      change: '+8%',
      changeType: 'increase',
      icon: <DollarSign className="h-5 w-5" />
    },
    {
      title: 'Completed',
      value: stats.completedBookings,
      icon: <CheckCircle className="h-5 w-5" />
    },
    {
      title: 'Average Spent',
      value: `AED ${stats.averageSpent.toFixed(0)}`,
      icon: <TrendingUp className="h-5 w-5" />
    }
  ];

  const statusCards = [
    {
      title: 'Pending',
      count: stats.pendingBookings,
      icon: <Clock className="h-4 w-4" />,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-600'
    },
    {
      title: 'Completed',
      count: stats.completedBookings,
      icon: <CheckCircle className="h-4 w-4" />,
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-600'
    },
    {
      title: 'Cancelled',
      count: stats.cancelledBookings,
      icon: <XCircle className="h-4 w-4" />,
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-600'
    }
  ];

  const quickActions = [
    {
      title: 'Browse Services',
      description: 'Find your next service',
      icon: <Search className="h-5 w-5" />,
      link: '/search'
    },
    {
      title: 'My Bookings',
      description: 'View & manage',
      icon: <Calendar className="h-5 w-5" />,
      link: '/customer/bookings'
    },
    {
      title: 'Favorites',
      description: 'Saved providers',
      icon: <Heart className="h-5 w-5" />,
      link: '/customer/favorites'
    },
    {
      title: 'Rewards',
      description: 'Points & benefits',
      icon: <Award className="h-5 w-5" />,
      link: '/customer/rewards'
    }
  ];

  const recentBookings = customerBookings?.slice(0, 5) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-nilin-cream flex flex-col">
        <NavigationHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin"></div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      <NavigationHeader />

      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <Breadcrumb />
      </div>

      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Personalized Greeting Banner - NILIN Theme */}
          <div className="bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-coral rounded-nilin-xl p-8 mb-8 shadow-nilin-warm">
            <div className="flex items-center gap-3 mb-2">
              <Sparkles className="h-7 w-7 text-nilin-charcoal/60" />
              <h1 className="text-2xl md:text-3xl font-serif text-nilin-charcoal">
                {getGreeting()}, {user?.name?.split(' ')[0] || 'there'}!
              </h1>
            </div>
            <p className="text-nilin-warmGray text-base">
              Welcome back to your dashboard. Here's an overview of your bookings.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => navigate(action.link)}
                className="glass-nilin rounded-nilin-lg p-5 text-left hover-lift transition-all group"
              >
                <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center mb-3 group-hover:bg-nilin-coral/30 transition-colors">
                  <div className="text-nilin-coral">{action.icon}</div>
                </div>
                <h3 className="font-medium text-nilin-charcoal mb-1">{action.title}</h3>
                <p className="text-xs text-nilin-warmGray">{action.description}</p>
              </button>
            ))}
          </div>

          {/* Period Selector */}
          <div className="mb-6 flex items-center gap-3">
            <span className="text-sm text-nilin-warmGray">Period:</span>
            {(['week', 'month', 'year'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-4 py-2 rounded-nilin text-sm font-medium transition-all ${
                  selectedPeriod === period
                    ? 'bg-nilin-coral text-white shadow-nilin-warm'
                    : 'bg-white text-nilin-warmGray border border-nilin-border hover:bg-nilin-muted'
                }`}
              >
                {period}
              </button>
            ))}
          </div>

          {/* Stats Cards Grid - NILIN Theme */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {statCards.map((card, index) => (
              <div
                key={index}
                className="glass-nilin rounded-nilin-lg p-5 hover-lift"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-full bg-nilin-coral/15 flex items-center justify-center">
                    <div className="text-nilin-coral">{card.icon}</div>
                  </div>
                  {card.change && (
                    <span className={`text-xs font-medium ${
                      card.changeType === 'increase' ? 'text-green-600' : 'text-red-500'
                    }`}>
                      {card.change}
                    </span>
                  )}
                </div>
                <p className="text-xs text-nilin-warmGray mb-1">{card.title}</p>
                <p className="text-xl font-bold text-nilin-charcoal">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* Booking Status Distribution */}
            <div className="glass-nilin rounded-nilin-lg p-6">
              <h2 className="font-serif text-lg text-nilin-charcoal mb-5">Booking Status</h2>
              <div className="space-y-3">
                {statusCards.map((status, index) => (
                  <div
                    key={index}
                    className={`${status.bg} ${status.border} border rounded-nilin p-4 flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={status.text}>{status.icon}</div>
                      <span className="font-medium text-nilin-charcoal text-sm">{status.title}</span>
                    </div>
                    <span className="text-xl font-bold text-nilin-charcoal">{status.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-2 glass-nilin rounded-nilin-lg p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-serif text-lg text-nilin-charcoal">Recent Activity</h2>
                <button
                  onClick={() => navigate('/customer/bookings')}
                  className="text-sm text-nilin-coral hover:text-nilin-rose font-medium flex items-center gap-1"
                >
                  View All
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>

              {recentBookings.length > 0 ? (
                <div className="space-y-3">
                  {recentBookings.map((booking) => (
                    <div
                      key={booking._id}
                      onClick={() => navigate(`/customer/bookings/${booking._id}`)}
                      className="flex items-center gap-4 p-4 bg-nilin-muted rounded-nilin hover:bg-nilin-blush/50 transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-nilin bg-nilin-coral/20 flex items-center justify-center">
                        <Package className="h-5 w-5 text-nilin-coral" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-nilin-charcoal truncate text-sm">
                          {booking.service?.name || 'Service'}
                        </h3>
                        <p className="text-xs text-nilin-warmGray">
                          {new Date(booking.scheduledDate).toLocaleDateString()} • {booking.scheduledTime}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-medium text-nilin-charcoal text-sm">AED {booking.pricing?.totalAmount || booking.pricing?.total || 0}</span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            booking.status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : booking.status === 'pending'
                              ? 'bg-amber-100 text-amber-700'
                              : booking.status === 'cancelled'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-nilin-coral/20 text-nilin-coral'
                          }`}
                        >
                          {booking.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10">
                  <AlertCircle className="h-10 w-10 text-nilin-lightGray mx-auto mb-3" />
                  <p className="text-nilin-warmGray mb-4">No recent activity</p>
                  <button
                    onClick={() => navigate('/search')}
                    className="btn-nilin"
                  >
                    Book a Service
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pro Tip / Insights Section */}
          {stats.totalBookings > 0 ? (
            <div className="glass-nilin rounded-nilin-lg p-6 mb-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-nilin bg-nilin-coral/20 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-6 w-6 text-nilin-coral" />
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-lg text-nilin-charcoal mb-2">Pro Tip</h3>
                  <p className="text-nilin-warmGray text-sm leading-relaxed">
                    {stats.totalBookings >= 5
                      ? `You're a regular! Your favorite category is ${stats.favoriteCategory}. Book 3 more services this month to unlock Silver tier rewards and get 10% off!`
                      : stats.totalBookings >= 1
                      ? `Great start! You've booked ${stats.totalBookings} service${stats.totalBookings > 1 ? 's' : ''}. Book ${5 - stats.totalBookings} more to unlock loyalty rewards!`
                      : 'Book your first service today and earn welcome points!'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-16 mb-6 glass-nilin rounded-nilin-lg p-8">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 rounded-full bg-nilin-coral/20 flex items-center justify-center mx-auto mb-4">
                  <Package className="h-10 w-10 text-nilin-coral" />
                </div>
                <h3 className="text-2xl font-serif text-nilin-charcoal mb-2">
                  Start Your Journey
                </h3>
                <p className="text-nilin-warmGray mb-6">
                  No bookings yet. Discover amazing services from trusted providers!
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => navigate('/search')}
                    className="btn-nilin"
                  >
                    Browse Services
                  </button>
                  <button
                    onClick={() => navigate('/customer/favorites')}
                    className="px-6 py-3 rounded-nilin border border-nilin-border text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                  >
                    View Favorites
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Quick Insights */}
          {stats.totalBookings > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Favorite Category */}
              <div className="glass-nilin rounded-nilin-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                    <Heart className="h-5 w-5 text-nilin-coral" />
                  </div>
                  <h2 className="font-serif text-lg text-nilin-charcoal">Favorite Category</h2>
                </div>
                <p className="text-2xl font-bold text-nilin-charcoal mb-1">{stats.favoriteCategory}</p>
                <p className="text-sm text-nilin-warmGray">Your most booked service category</p>
              </div>

              {/* Loyalty Rewards */}
              <div className="glass-nilin rounded-nilin-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-100 to-amber-100 flex items-center justify-center">
                    <Award className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1">
                    <h2 className="font-serif text-lg text-nilin-charcoal">Loyalty Rewards</h2>
                  </div>
                </div>
                {loyaltyStatus ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-yellow-500" />
                        <span className="text-2xl font-bold text-nilin-charcoal">{loyaltyStatus.coins.toLocaleString()}</span>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                        loyaltyStatus.tier === 'platinum' ? 'bg-gradient-to-r from-slate-800 to-slate-600 text-white' :
                        loyaltyStatus.tier === 'gold' ? 'bg-gradient-to-r from-yellow-500 to-amber-500 text-white' :
                        loyaltyStatus.tier === 'silver' ? 'bg-gradient-to-r from-gray-400 to-gray-300 text-white' :
                        'bg-gradient-to-r from-amber-700 to-amber-600 text-white'
                      }`}>
                        {loyaltyStatus.tier}
                      </span>
                    </div>
                    {/* Tier Progress */}
                    {loyaltyStatus.nextTier && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-nilin-warmGray mb-1">
                          <span>Progress to {loyaltyStatus.nextTier}</span>
                          <span>{loyaltyStatus.pointsToNextTier.toLocaleString()} points to go</span>
                        </div>
                        <div className="h-2 bg-nilin-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full transition-all duration-500"
                            style={{ width: `${loyaltyStatus.progressToNext}%` }}
                          />
                        </div>
                      </div>
                    )}
                    {loyaltyStatus.streakDays > 0 && (
                      <div className="flex items-center gap-2 text-sm text-nilin-warmGray">
                        <Zap className="w-4 h-4 text-orange-500" />
                        <span>{loyaltyStatus.streakDays} day streak!</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Coins className="w-5 h-5 text-yellow-500" />
                      <span className="text-2xl font-bold text-nilin-charcoal">
                        {stats.totalBookings * 10}
                      </span>
                    </div>
                    <p className="text-sm text-nilin-warmGray">Earn more points with each booking</p>
                  </div>
                )}
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
