import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { bookingService } from '../../services/BookingService';
import NavigationHeader from '../layout/NavigationHeader';
import {
  Heart,
  Calendar,
  Star,
  TrendingUp,
  Gift,
  Search,
  Coins,
  Crown,
  User,
  ArrowRight,
  Plus
} from 'lucide-react';

interface StatCard {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: string;
}

interface RecentBooking {
  _id: string;
  bookingNumber: string;
  serviceName: string;
  providerName: string;
  scheduledDate: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  rating?: number;
  totalAmount: number;
  service?: {
    name: string;
  };
  provider?: {
    firstName: string;
    lastName: string;
    businessInfo?: {
      businessName: string;
    };
  };
  pricing?: {
    totalAmount: number;
  };
}

interface FavoriteProvider {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  imageUrl?: string;
  isOnline: boolean;
}

const StatsView: React.FC = () => {
  const navigate = useNavigate();
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const { user, customerProfile } = useAuthStore();

  const [stats] = useState<StatCard[]>([
    {
      title: 'Total Bookings',
      value: customerProfile?.bookingStats?.totalBookings || 12,
      subtitle: 'All time',
      icon: Calendar,
      trend: { value: 2, isPositive: true },
      color: 'bg-blue-500'
    },
    {
      title: 'Loyalty Coins',
      value: user?.loyaltySystem?.totalCoins || 1250,
      subtitle: `${user?.loyaltySystem?.tier || 'Bronze'} tier`,
      icon: Coins,
      trend: { value: 150, isPositive: true },
      color: 'bg-yellow-500'
    },
    {
      title: 'Saved Providers',
      value: customerProfile?.favoriteProviders?.length || 5,
      subtitle: 'In favorites',
      icon: Heart,
      color: 'bg-red-500'
    },
    {
      title: 'Avg Rating Given',
      value: '4.8',
      subtitle: 'Your reviews',
      icon: Star,
      color: 'bg-green-500'
    }
  ]);

  const [favoriteProviders] = useState<FavoriteProvider[]>([
    {
      id: '1',
      name: 'Sarah\'s Cleaning Co',
      category: 'Home Services',
      rating: 4.9,
      reviewCount: 127,
      isOnline: true
    },
    {
      id: '2',
      name: 'Bella Beauty Salon',
      category: 'Beauty & Personal Care',
      rating: 4.8,
      reviewCount: 203,
      isOnline: false
    },
    {
      id: '3',
      name: 'FitLife Gym',
      category: 'Fitness & Training',
      rating: 4.7,
      reviewCount: 89,
      isOnline: true
    }
  ]);

  useEffect(() => {
    const fetchRecentBookings = async () => {
      try {
        setLoadingBookings(true);
        const response = await bookingService.getCustomerBookings({
          limit: 3,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        });

        if (response.success && response.data.bookings) {
          const transformedBookings = response.data.bookings.map((booking: any) => ({
            _id: booking._id,
            bookingNumber: booking.bookingNumber,
            serviceName: booking.service?.name || 'Service',
            providerName: booking.provider?.businessInfo?.businessName ||
                         `${booking.provider?.firstName} ${booking.provider?.lastName}` || 'Provider',
            scheduledDate: booking.scheduledDate,
            status: booking.status,
            totalAmount: booking.pricing?.totalAmount || 0,
            service: booking.service,
            provider: booking.provider,
            pricing: booking.pricing
          }));
          setRecentBookings(transformedBookings);
        }
      } catch (error) {
        console.error('Error fetching recent bookings:', error);
        setRecentBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    };

    fetchRecentBookings();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'confirmed':
      case 'in_progress':
        return 'text-blue-600 bg-blue-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Upcoming';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  {getGreeting()}, {user?.firstName}! 👋
                </h2>
                <p className="text-blue-100 mb-4">
                  View your stats and activity overview
                </p>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center">
                    <Coins className="h-4 w-4 mr-1" />
                    <span>{user?.loyaltySystem?.totalCoins || 0} coins</span>
                  </div>
                  <div className="flex items-center">
                    <Crown className="h-4 w-4 mr-1" />
                    <span>{user?.loyaltySystem?.tier || 'Bronze'} member</span>
                  </div>
                  <div className="flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    <span>{user?.loyaltySystem?.currentStreak || 0} day streak</span>
                  </div>
                </div>
              </div>
              <div className="hidden md:block">
                <button
                  onClick={() => navigate('/customer/dashboard')}
                  className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-blue-50 transition-colors inline-flex items-center"
                >
                  <Search className="mr-2 h-4 w-4" />
                  Browse Services
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-center">
                  <div className={`p-2 rounded-lg ${stat.color}`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <div className="flex items-baseline">
                      <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                      {stat.trend && (
                        <span className={`ml-2 text-sm font-medium ${
                          stat.trend.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {stat.trend.isPositive ? '+' : '-'}{stat.trend.value}
                        </span>
                      )}
                    </div>
                    {stat.subtitle && (
                      <p className="text-sm text-gray-500">{stat.subtitle}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Bookings */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Recent Bookings</h3>
                <Link
                  to="/customer/bookings"
                  className="text-blue-600 hover:text-blue-500 text-sm font-medium flex items-center"
                >
                  View all
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="p-6">
              {loadingBookings ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading bookings...</span>
                </div>
              ) : recentBookings.length > 0 ? (
                <div className="space-y-4">
                  {recentBookings.map((booking) => (
                    <div key={booking._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{booking.serviceName}</h4>
                        <p className="text-sm text-gray-500">{booking.providerName}</p>
                        <div className="flex items-center mt-1 space-x-4">
                          <div className="flex items-center text-xs text-gray-500">
                            <Calendar className="mr-1 h-3 w-3" />
                            {formatDate(booking.scheduledDate)}
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                            {getStatusDisplayText(booking.status)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">AED {booking.totalAmount}</p>
                        {booking.rating && (
                          <div className="flex items-center">
                            <Star className="h-3 w-3 text-yellow-400 fill-current" />
                            <span className="text-xs text-gray-500 ml-1">{booking.rating}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No bookings yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Start by browsing our amazing services</p>
                  <div className="mt-6">
                    <Link
                      to="/services"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Book Service
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Favorite Providers */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Favorite Providers</h3>
                <Link
                  to="/customer/favorites"
                  className="text-blue-600 hover:text-blue-500 text-sm font-medium flex items-center"
                >
                  View all
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="p-6">
              {favoriteProviders.length > 0 ? (
                <div className="space-y-4">
                  {favoriteProviders.map((provider) => (
                    <div key={provider.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className="h-10 w-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium">
                              {provider.name.charAt(0)}
                            </span>
                          </div>
                          {provider.isOnline && (
                            <div className="absolute -bottom-0 -right-0 h-3 w-3 bg-green-400 border-2 border-white rounded-full"></div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">{provider.name}</h4>
                          <p className="text-sm text-gray-500">{provider.category}</p>
                          <div className="flex items-center mt-1">
                            <Star className="h-3 w-3 text-yellow-400 fill-current" />
                            <span className="text-xs text-gray-600 ml-1">
                              {provider.rating} ({provider.reviewCount} reviews)
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                          <Heart className="h-4 w-4 fill-current" />
                        </button>
                        <Link
                          to={`/providers/${provider.id}`}
                          className="text-blue-600 hover:text-blue-500 text-sm font-medium"
                        >
                          View
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Heart className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No favorites yet</h3>
                  <p className="mt-1 text-sm text-gray-500">Heart providers you love to see them here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              to="/customer/dashboard"
              className="flex flex-col items-center p-4 text-center border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <Search className="h-8 w-8 text-blue-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">Browse Services</span>
            </Link>
            <Link
              to="/customer/bookings"
              className="flex flex-col items-center p-4 text-center border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <Calendar className="h-8 w-8 text-green-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">My Bookings</span>
            </Link>
            <Link
              to="/customer/profile"
              className="flex flex-col items-center p-4 text-center border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <User className="h-8 w-8 text-purple-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">Edit Profile</span>
            </Link>
            <Link
              to="/customer/rewards"
              className="flex flex-col items-center p-4 text-center border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
            >
              <Gift className="h-8 w-8 text-yellow-500 mb-2" />
              <span className="text-sm font-medium text-gray-900">Rewards</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsView;
