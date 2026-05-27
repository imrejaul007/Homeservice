import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { bookingService } from '../../services/BookingService';
import { providerAnalyticsApi, type ProviderAnalytics } from '../../services/providerApi';
import { reviewsApi, type Review } from '../../services/reviewsApi';
import { socketService } from '../../services/socket';
import NotificationBell from '../common/NotificationBell';
import {
  Building,
  DollarSign,
  Calendar,
  Star,
  TrendingUp,
  Users,
  Eye,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Clock,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  ArrowRight,
  BarChart,
  Camera,
  Award,
  Activity,
  Building2,
  Shield
} from 'lucide-react';

interface StatCard {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: {
    value: number;
    isPositive: boolean;
  } | null;
  color: string;
}

interface BookingRequest {
  _id: string;
  bookingNumber: string;
  customerName: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'in_progress';
  totalAmount: number;
  customer?: {
    firstName: string;
    lastName: string;
  };
  service?: {
    name: string;
  };
  pricing?: {
    totalAmount: number;
  };
}

interface RecentReview {
  id: string;
  customerName: string;
  rating: number;
  comment: string;
  serviceName: string;
  date: string;
}

const ProviderDashboard: React.FC = () => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  // Analytics state
  const [analytics, setAnalytics] = useState<ProviderAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Reviews state
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  // Booking action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { user, providerProfile, logout } = useAuthStore();

  // Helper to provide empty analytics state
  const getEmptyAnalytics = (): ProviderAnalytics => ({
    serviceStats: { total: 0, active: 0, draft: 0, inactive: 0, pending_review: 0 },
    performanceStats: { totalViews: 0, totalClicks: 0, totalBookings: 0, conversionRate: 0, bookingRate: 0 },
    ratingStats: { averageRating: 0, totalReviews: 0 },
    bookingStats: { newBookings: 0, pendingRequests: 0, todaySchedule: 0, completedThisMonth: 0 },
    categories: [],
    topServices: [],
  });

  // Retry configuration
  const RETRY_DELAYS = [1000, 3000, 5000];
  const MAX_RETRIES = 3;

  // Fetch booking requests
  const fetchBookingRequests = useCallback(async () => {
    try {
      setLoadingBookings(true);
      const response = await bookingService.getProviderBookings({
        status: 'pending',
        limit: 5,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });

      if (response.success && response.data.bookings) {
        const transformedBookings = response.data.bookings.map((booking: any) => {
          // Resolve customer name: try populated customer, then customerInfo snapshot, then guestInfo
          const firstName = booking.customer?.firstName || booking.customerInfo?.firstName || booking.guestInfo?.name?.split(' ')[0];
          const lastName = booking.customer?.lastName || booking.customerInfo?.lastName || booking.guestInfo?.name?.split(' ').slice(1).join(' ');
          const customerName = (firstName || lastName) ? `${firstName || ''} ${lastName || ''}`.trim() : (booking.isGuestBooking ? 'Guest' : 'Customer');

          return {
            _id: booking._id,
            bookingNumber: booking.bookingNumber,
            customerName,
            serviceName: booking.service?.name || 'Service',
            scheduledDate: booking.scheduledDate,
            scheduledTime: booking.scheduledTime,
            status: booking.status,
            totalAmount: booking.pricing?.totalAmount || 0,
            customer: booking.customer,
            service: booking.service,
            pricing: booking.pricing
          };
        });
        setBookingRequests(transformedBookings);
      }
    } catch {
      setBookingRequests([]);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  // Fetch analytics with retry logic
  const fetchAnalyticsWithRetry = useCallback(async (retryCount = 0) => {
    try {
      setLoadingAnalytics(true);
      setAnalyticsError(null);
      const response = await providerAnalyticsApi.getProviderAnalytics();
      if (response.success && response.data.overview) {
        setAnalytics(response.data.overview);
        return;
      }
      // API returned success but no data - this is valid for new providers
      setAnalytics(response.data.overview || getEmptyAnalytics());
    } catch (error: any) {
      const isNetworkError = !error.response || error.code === 'ECONNABORTED';
      const shouldRetry = isNetworkError && retryCount < MAX_RETRIES;

      if (shouldRetry) {
        console.warn(`Analytics fetch failed, retrying in ${RETRY_DELAYS[retryCount]}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retryCount]));
        return fetchAnalyticsWithRetry(retryCount + 1);
      }

      console.error('Failed to fetch analytics:', error);
      setAnalyticsError(
        error.response?.status === 401
          ? 'Session expired. Please log in again.'
          : 'Failed to load analytics. Your data will update automatically.'
      );
      // Provide fallback empty analytics so UI doesn't break
      setAnalytics(getEmptyAnalytics());
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  // Fetch reviews data
  const fetchReviews = useCallback(async () => {
    try {
      setLoadingReviews(true);
      setReviewsError(null);
      const providerId = providerProfile?._id || (user as any)?.id;
      if (!providerId) return;

      const response = await reviewsApi.getProviderReviews(providerId);
      if (response.success && response.data.reviews) {
        // Transform reviews to RecentReview format
        const transformedReviews: RecentReview[] = response.data.reviews.slice(0, 5).map((review: Review) => ({
          id: review.id,
          customerName: review.customer
            ? `${review.customer.firstName} ${review.customer.lastName}`
            : 'Customer',
          rating: review.rating,
          comment: review.comment,
          serviceName: review.service?.name || 'Service',
          date: review.createdAt
        }));
        setRecentReviews(transformedReviews);
      }
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      setReviewsError('Failed to load reviews');
      setRecentReviews([]);
    } finally {
      setLoadingReviews(false);
    }
  }, [providerProfile?._id, (user as any)?.id]);

  // Initial data fetch
  useEffect(() => {
    fetchBookingRequests();
    fetchAnalyticsWithRetry();
    fetchReviews();
  }, [fetchBookingRequests, fetchAnalyticsWithRetry, fetchReviews]);

  // Socket listeners for real-time updates
  useEffect(() => {
    // Listen for booking status changes
    const unsubBookingStatus = socketService.onBookingStatusChanged((data) => {
      console.log('Booking status changed:', data);
      fetchBookingRequests();
      fetchAnalyticsWithRetry();
    });

    // Listen for new booking requests
    const unsubNewRequest = socketService.on('booking:new_request', (data) => {
      console.log('New booking request:', data);
      fetchBookingRequests();
    });

    // Listen for booking confirmations
    const unsubBookingConfirmed = socketService.on('booking:confirmed', (data) => {
      console.log('Booking confirmed:', data);
      fetchBookingRequests();
      fetchAnalyticsWithRetry();
    });

    // Listen for new notifications
    const unsubNotification = socketService.onNewNotification((data) => {
      console.log('New notification:', data);
    });

    // Cleanup on unmount
    return () => {
      unsubBookingStatus();
      unsubNewRequest();
      unsubBookingConfirmed();
      unsubNotification();
    };
  }, [fetchBookingRequests, fetchAnalyticsWithRetry]);

  // Handle booking accept
  const handleAcceptBooking = async (bookingId: string) => {
    try {
      setActionLoading(bookingId);
      await bookingService.acceptBooking(bookingId);
      // Refresh bookings
      const response = await bookingService.getProviderBookings({
        status: 'pending',
        limit: 5,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      if (response.success && response.data.bookings) {
        const transformedBookings = response.data.bookings.map((booking: any) => ({
          _id: booking._id,
          bookingNumber: booking.bookingNumber,
          customerName: booking.customer?.firstName
            ? `${booking.customer.firstName} ${booking.customer.lastName}`
            : booking.isGuestBooking
              ? 'Guest'
              : 'Customer',
          serviceName: booking.service?.name || 'Service',
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
          status: booking.status,
          totalAmount: booking.pricing?.totalAmount || 0,
          customer: booking.customer,
          service: booking.service,
          pricing: booking.pricing
        }));
        setBookingRequests(transformedBookings);
      }
    } catch (error) {
      console.error('Failed to accept booking:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle booking decline
  const handleDeclineBooking = async (bookingId: string) => {
    try {
      setActionLoading(bookingId);
      await bookingService.rejectBooking(bookingId, { reason: 'Declined by provider' });
      // Refresh bookings
      const response = await bookingService.getProviderBookings({
        status: 'pending',
        limit: 5,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      if (response.success && response.data.bookings) {
        const transformedBookings = response.data.bookings.map((booking: any) => ({
          _id: booking._id,
          bookingNumber: booking.bookingNumber,
          customerName: booking.customer?.firstName
            ? `${booking.customer.firstName} ${booking.customer.lastName}`
            : booking.isGuestBooking
              ? 'Guest'
              : 'Customer',
          serviceName: booking.service?.name || 'Service',
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
          status: booking.status,
          totalAmount: booking.pricing?.totalAmount || 0,
          customer: booking.customer,
          service: booking.service,
          pricing: booking.pricing
        }));
        setBookingRequests(transformedBookings);
      }
    } catch (error) {
      console.error('Failed to decline booking:', error);
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate trends from historical data if available
  const calculateTrend = (current: number, previous: number | undefined): { value: number; isPositive: boolean } | undefined => {
    if (!previous || previous === 0) return undefined;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(Math.round(change)),
      isPositive: change >= 0,
    };
  };

  // Get trend values from provider profile analytics (historical data)
  const earningsTrend = calculateTrend(
    providerProfile?.earnings?.totalEarned || 0,
    (providerProfile?.analytics as any)?.previousEarnings
  );
  const bookingsTrend = calculateTrend(
    analytics?.bookingStats.completedThisMonth || 0,
    (providerProfile?.analytics as any)?.previousBookings
  );
  const viewsTrend = calculateTrend(
    analytics?.performanceStats.totalViews || (providerProfile?.analytics as any)?.profileViews || 0,
    (providerProfile?.analytics as any)?.previousViews
  );

  // Derive stats from analytics data
  const stats: StatCard[] = (analytics ? [
    {
      title: 'Monthly Earnings',
      value: providerProfile?.earnings?.totalEarned || 0,
      subtitle: 'This month',
      icon: DollarSign,
      trend: earningsTrend,
      color: 'bg-nilin-rose'
    },
    {
      title: 'Total Bookings',
      value: analytics.bookingStats.completedThisMonth,
      subtitle: 'This month',
      icon: Calendar,
      trend: bookingsTrend,
      color: 'bg-nilin-coral'
    },
    {
      title: 'Average Rating',
      value: analytics.ratingStats.averageRating || providerProfile?.ratings?.average || 0,
      subtitle: `${analytics.ratingStats.totalReviews || providerProfile?.ratings?.count || 0} reviews`,
      icon: Star,
      color: 'bg-nilin-rose'
    },
    {
      title: 'Profile Views',
      value: analytics.performanceStats.totalViews || providerProfile?.analytics?.profileViews || 0,
      subtitle: 'This week',
      icon: Eye,
      trend: viewsTrend,
      color: 'bg-nilin-coral'
    }
  ] : [
    {
      title: 'Monthly Earnings',
      value: providerProfile?.earnings?.totalEarned || 0,
      subtitle: 'This month',
      icon: DollarSign,
      trend: earningsTrend,
      color: 'bg-nilin-rose'
    },
    {
      title: 'Total Bookings',
      value: (providerProfile?.analytics as any)?.totalBookings || 0,
      subtitle: 'This month',
      icon: Calendar,
      trend: bookingsTrend,
      color: 'bg-nilin-coral'
    },
    {
      title: 'Average Rating',
      value: providerProfile?.ratings?.average || 0,
      subtitle: `${providerProfile?.ratings?.count || 0} reviews`,
      icon: Star,
      color: 'bg-nilin-rose'
    },
    {
      title: 'Profile Views',
      value: providerProfile?.analytics?.profileViews || 0,
      subtitle: 'This week',
      icon: Eye,
      trend: viewsTrend,
      color: 'bg-nilin-coral'
    }
  ]) as StatCard[];

  const handleLogout = () => {
    logout();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getVerificationStatusDisplay = () => {
    // Get verification status with proper fallbacks
    const verificationStatus = providerProfile?.verificationStatus;
    const status = verificationStatus?.overall || (typeof verificationStatus === 'string' ? verificationStatus : 'pending');

    const config = {
      pending: {
        color: 'text-amber-700 bg-amber-50 border border-amber-200',
        icon: Clock,
        text: 'Verification Pending',
        description: 'Your account is under review. We\'ll notify you once approved.'
      },
      approved: {
        color: 'text-green-700 bg-green-50 border border-green-200',
        icon: CheckCircle,
        text: 'Verified Provider',
        description: 'Your account is verified and active.'
      },
      rejected: {
        color: 'text-red-700 bg-red-50 border border-red-200',
        icon: XCircle,
        text: 'Verification Rejected',
        description: 'Please review your documents and resubmit.'
      },
      suspended: {
        color: 'text-red-700 bg-red-50 border border-red-200',
        icon: AlertTriangle,
        text: 'Account Suspended',
        description: 'Contact support for assistance.'
      }
    };

    return config[status];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
      case 'in_progress':
        return 'text-green-700 bg-green-50';
      case 'pending':
        return 'text-amber-700 bg-amber-50';
      case 'cancelled':
        return 'text-red-700 bg-red-50';
      case 'completed':
        return 'text-nilin-charcoal bg-nilin-blush/50';
      default:
        return 'text-nilin-warmGray bg-nilin-muted';
    }
  };

  const getStatusDisplayText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
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

  const verificationStatus = getVerificationStatusDisplay();
  const StatusIcon = verificationStatus.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream">
      {/* Navigation Header */}
      <nav className="glass glass-blur shadow-nilin border-b border-nilin-border/50 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-serif font-light text-nilin-charcoal">Provider Dashboard</h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <NotificationBell userId={user?._id} userRole="provider" />

              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:ring-offset-2"
                >
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-nilin-rose to-nilin-coral flex items-center justify-center">
                    <Building className="h-5 w-5 text-white" />
                  </div>
                  <ChevronDown className="ml-2 h-4 w-4 text-nilin-warmGray" />
                </button>

                {showUserMenu && (
                  <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-xl shadow-nilin-lg bg-white ring-1 ring-nilin-border z-50">
                    <div className="py-1">
                      <div className="px-4 py-3 text-sm border-b border-nilin-border">
                        <div className="font-medium text-nilin-charcoal">{providerProfile?.businessInfo?.businessName || `${user?.firstName} ${user?.lastName}`}</div>
                        <div className="text-nilin-warmGray text-xs mt-0.5">{user?.email}</div>
                      </div>
                      <Link
                        to="/provider/settings"
                        className="flex items-center px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/50 font-sans"
                      >
                        <Settings className="mr-3 h-4 w-4 text-nilin-coral" />
                        Business Settings
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2.5 text-sm text-nilin-charcoal hover:bg-nilin-blush/50 font-sans"
                      >
                        <LogOut className="mr-3 h-4 w-4 text-nilin-coral" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-nilin-rose to-nilin-coral rounded-2xl p-6 text-white shadow-nilin-lg gradient-3d neu-light">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h2 className="text-2xl font-serif font-light mb-2">
                  {getGreeting()}, {user?.firstName}
                </h2>
                <p className="text-white/80 mb-4 font-sans text-sm">
                  Manage your business, track earnings, and connect with customers.
                </p>
                <div className="flex items-center space-x-6 text-sm font-sans">
                  <div className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    <span>AED {providerProfile?.earnings?.availableBalance || 0} available</span>
                  </div>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-1" />
                    <span>{providerProfile?.ratings?.average || 0} avg rating</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{providerProfile?.analytics?.repeatCustomers || 0} repeat customers</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Verification Status Banner */}
        {providerProfile?.verificationStatus?.overall !== 'approved' && (
          <div className={`mb-8 rounded-xl p-4 ${verificationStatus.color}`}>
            <div className="flex items-center">
              <StatusIcon className={`h-5 w-5 mr-3 ${verificationStatus.color.split(' ')[0]}`} />
              <div className="flex-1">
                <h3 className={`text-sm font-medium ${verificationStatus.color.split(' ')[0]}`}>
                  {verificationStatus.text}
                </h3>
                <p className={`text-sm ${verificationStatus.color.split(' ')[0]} opacity-75 mt-1`}>
                  {verificationStatus.description}
                </p>
              </div>
              {providerProfile?.verificationStatus?.overall === 'rejected' && (
                <Link
                  to="/provider/verification"
                  className="text-sm font-medium text-red-700 hover:text-red-800"
                >
                  Update Documents
                </Link>
              )}
            </div>
          </div>
        )}

	        {/* Quick Actions - Compact Grid */}
	        <div className="mb-8">
	          <div className="flex items-center justify-between mb-4">
	            <h3 className="text-lg font-semibold text-nilin-charcoal">Quick Actions</h3>
	          </div>
	          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
	            {/* Add Service - Primary */}
	            <Link
	              to="/provider/services"
	              className="flex flex-col items-center justify-center p-3 bg-gradient-to-br from-nilin-coral to-nilin-rose rounded-xl text-white hover:shadow-lg transition-all duration-300"
	            >
	              <Plus className="h-5 w-5 mb-1" />
	              <span className="text-xs font-medium text-center">Add Service</span>
	            </Link>

	            {/* Bookings */}
	            <Link
	              to="/provider/bookings"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Calendar className="h-5 w-5 text-nilin-coral mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Bookings</span>
	            </Link>

	            {/* Services */}
	            <Link
	              to="/provider/services"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Settings className="h-5 w-5 text-nilin-rose mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Services</span>
	            </Link>

	            {/* Analytics */}
	            <Link
	              to="/provider/analytics"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <BarChart className="h-5 w-5 text-nilin-rose mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Analytics</span>
	            </Link>

	            {/* Earnings */}
	            <Link
	              to="/provider/earnings"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <DollarSign className="h-5 w-5 text-green-600 mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Earnings</span>
	            </Link>

	            {/* Ads */}
	            <Link
	              to="/provider/ads"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Activity className="h-5 w-5 text-nilin-coral mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Ads</span>
	            </Link>

	            {/* Reviews */}
	            <Link
	              to="/provider/reviews"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Star className="h-5 w-5 text-yellow-500 mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Reviews</span>
	            </Link>

	            {/* Availability */}
	            <Link
	              to="/provider/availability"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Clock className="h-5 w-5 text-nilin-rose mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Availability</span>
	            </Link>

	            {/* Profile */}
	            <Link
	              to="/provider/profile"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Award className="h-5 w-5 text-nilin-coral mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Profile</span>
	            </Link>

	            {/* Portfolio */}
	            <Link
	              to="/provider/portfolio"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Camera className="h-5 w-5 text-nilin-rose mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Portfolio</span>
	            </Link>

	            {/* Settings */}
	            <Link
	              to="/provider/settings"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Shield className="h-5 w-5 text-nilin-warmGray mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Settings</span>
	            </Link>

	            {/* Managed Services */}
	            <Link
	              to="/provider/managed-services"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Building2 className="h-5 w-5 text-nilin-coral mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Managed</span>
	            </Link>
	          </div>
	        </div>


        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => {
            const IconComponent = stat.icon;
            return (
              <div key={index} className="glass glass-blur rounded-2xl p-6 gradient-3d neu-light">
                <div className="flex items-center">
                  <div className={`p-3 rounded-xl ${stat.color}`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <div className="ml-4 flex-1">
                    <p className="text-sm font-medium text-nilin-warmGray font-sans">{stat.title}</p>
                    <div className="flex items-baseline">
                      <p className="text-2xl font-serif font-light text-nilin-charcoal">
                        {typeof stat.value === 'number' && stat.title.includes('Earnings') ? `AED ${stat.value}` : stat.value}
                      </p>
                      {stat.trend && (
                        <span className={`ml-2 text-sm font-medium font-sans ${
                          stat.trend.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {stat.trend.isPositive ? '+' : '-'}{stat.trend.value}%
                        </span>
                      )}
                    </div>
                    {stat.subtitle && (
                      <p className="text-xs text-nilin-warmGray font-sans">{stat.subtitle}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Booking Requests */}
          <div className="glass rounded-2xl overflow-hidden inner-glow border border-nilin-border/50">
            <div className="p-6 border-b border-nilin-border/50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif font-light text-nilin-charcoal">Booking Requests</h3>
                <Link
                  to="/provider/bookings"
                  className="text-nilin-coral hover:text-nilin-rose text-sm font-medium font-sans flex items-center transition-colors"
                >
                  View all
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="p-6">
              {loadingBookings ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nilin-coral"></div>
                  <span className="ml-3 text-nilin-warmGray font-sans text-sm">Loading booking requests...</span>
                </div>
              ) : bookingRequests.length > 0 ? (
                <div className="space-y-4">
                  {bookingRequests.map((request) => (
                    <div key={request._id} className="border border-nilin-border/50 rounded-xl p-4 hover:border-glow transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-medium text-nilin-charcoal font-sans">{request.customerName}</h4>
                          <p className="text-xs text-nilin-warmGray">{request.serviceName}</p>
                        </div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium font-sans ${getStatusColor(request.status)}`}>
                          {getStatusDisplayText(request.status)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-nilin-warmGray mb-3 font-sans">
                        <div className="flex items-center">
                          <Calendar className="mr-1 h-4 w-4" />
                          {formatDate(request.scheduledDate)} at {request.scheduledTime}
                        </div>
                        <div className="font-medium text-nilin-charcoal">
                          AED {request.totalAmount}
                        </div>
                      </div>
                      {request.status === 'pending' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleAcceptBooking(request._id)}
                            disabled={actionLoading === request._id}
                            className="flex-1 bg-gradient-to-r from-nilin-rose to-nilin-coral text-white text-xs py-2.5 px-3 rounded-xl font-medium hover:shadow-nilin-warm transition-all btn-3d disabled:opacity-50"
                          >
                            {actionLoading === request._id ? 'Processing...' : 'Accept'}
                          </button>
                          <button
                            onClick={() => handleDeclineBooking(request._id)}
                            disabled={actionLoading === request._id}
                            className="flex-1 glass-btn bg-nilin-blush text-nilin-charcoal text-xs py-2.5 px-3 rounded-xl font-medium hover:bg-nilin-peach transition-all disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="mx-auto h-12 w-12 text-nilin-warmGray" />
                  <h3 className="mt-2 text-sm font-medium text-nilin-charcoal font-sans">No pending booking requests</h3>
                  <p className="mt-1 text-xs text-nilin-warmGray">New requests will appear here</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Reviews */}
          <div className="glass rounded-2xl overflow-hidden inner-glow border border-nilin-border/50">
            <div className="p-6 border-b border-nilin-border/50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif font-light text-nilin-charcoal">Recent Reviews</h3>
                <Link
                  to="/provider/reviews"
                  className="text-nilin-coral hover:text-nilin-rose text-sm font-medium font-sans flex items-center transition-colors"
                >
                  View all
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </div>
            </div>
            <div className="p-6">
              {loadingReviews ? (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nilin-coral"></div>
                  <span className="ml-3 text-nilin-warmGray font-sans text-sm">Loading reviews...</span>
                </div>
              ) : reviewsError ? (
                <div className="text-center py-6">
                  <AlertTriangle className="mx-auto h-12 w-12 text-nilin-warmGray" />
                  <h3 className="mt-2 text-sm font-medium text-nilin-charcoal font-sans">Failed to load reviews</h3>
                  <p className="mt-1 text-xs text-nilin-warmGray">{reviewsError}</p>
                </div>
              ) : recentReviews.length > 0 ? (
                <div className="space-y-4">
                  {recentReviews.map((review) => (
                    <div key={review.id} className="border border-nilin-border/50 rounded-xl p-4 hover:border-glow transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center">
                          <div className="h-9 w-9 bg-gradient-to-br from-nilin-rose to-nilin-coral rounded-xl flex items-center justify-center">
                            <span className="text-white text-sm font-medium font-sans">
                              {review.customerName.charAt(0)}
                            </span>
                          </div>
                          <div className="ml-3">
                            <h4 className="text-sm font-medium text-nilin-charcoal font-sans">{review.customerName}</h4>
                            <p className="text-xs text-nilin-warmGray">{review.serviceName} - {formatDate(review.date)}</p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-nilin-blush'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-nilin-warmGray font-sans">{review.comment}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <MessageSquare className="mx-auto h-12 w-12 text-nilin-warmGray" />
                  <h3 className="mt-2 text-sm font-medium text-nilin-charcoal font-sans">No reviews yet</h3>
                  <p className="mt-1 text-xs text-nilin-warmGray">Customer reviews will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 glass rounded-2xl border border-nilin-border/50 p-6 inner-glow">
          <h3 className="text-lg font-serif font-light text-nilin-charcoal mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Link
              to="/provider/services"
              className="flex flex-col items-center p-4 text-center border border-nilin-border/50 rounded-xl hover:shadow-nilin transition-shadow font-sans glass-btn"
            >
              <Plus className="h-8 w-8 text-nilin-coral mb-2" />
              <span className="text-sm font-medium text-nilin-charcoal">Add Service</span>
            </Link>
            <Link
              to="/provider/availability"
              className="flex flex-col items-center p-4 text-center border border-nilin-border/50 rounded-xl hover:shadow-nilin transition-shadow font-sans glass-btn"
            >
              <Calendar className="h-8 w-8 text-nilin-rose mb-2" />
              <span className="text-sm font-medium text-nilin-charcoal">Manage Availability</span>
            </Link>
            <Link
              to="/provider/portfolio"
              className="flex flex-col items-center p-4 text-center border border-nilin-border/50 rounded-xl hover:shadow-nilin transition-shadow font-sans glass-btn"
            >
              <Camera className="h-8 w-8 text-nilin-coral mb-2" />
              <span className="text-sm font-medium text-nilin-charcoal">Update Portfolio</span>
            </Link>
            <Link
              to="/provider/analytics"
              className="flex flex-col items-center p-4 text-center border border-nilin-border/50 rounded-xl hover:shadow-nilin transition-shadow font-sans glass-btn"
            >
              <BarChart className="h-8 w-8 text-nilin-rose mb-2" />
              <span className="text-sm font-medium text-nilin-charcoal">View Analytics</span>
            </Link>
            <Link
              to="/provider/profile"
              className="flex flex-col items-center p-4 text-center border border-nilin-border/50 rounded-xl hover:shadow-nilin transition-shadow font-sans glass-btn"
            >
              <Settings className="h-8 w-8 text-nilin-warmGray mb-2" />
              <span className="text-sm font-medium text-nilin-charcoal">Settings</span>
            </Link>
          </div>
        </div>

        {/* Business Performance Overview */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-6 card-3d">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-nilin-charcoal font-sans">This Month Performance</h4>
              <div className="w-10 h-10 rounded-xl bg-nilin-rose/20 flex items-center justify-center shimmer">
                <Activity className="h-5 w-5 text-nilin-rose" />
              </div>
            </div>
            {loadingAnalytics ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="h-4 w-24 bg-nilin-blush animate-pulse rounded"></div>
                    <div className="h-4 w-12 bg-nilin-blush animate-pulse rounded"></div>
                  </div>
                ))}
              </div>
            ) : analyticsError ? (
              <div className="text-center py-4">
                <AlertTriangle className="mx-auto h-8 w-8 text-amber-400 mb-2" />
                <p className="text-xs text-nilin-charcoal mb-3">{analyticsError}</p>
                <button
                  onClick={() => fetchAnalyticsWithRetry()}
                  className="text-xs text-nilin-coral hover:text-nilin-rose font-medium"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-nilin-warmGray font-sans">Booking Rate</span>
                  <span className="text-sm font-medium text-nilin-charcoal font-sans">
                    {analytics ? `${Math.round(analytics.performanceStats.bookingRate)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-nilin-warmGray font-sans">Conversion Rate</span>
                  <span className="text-sm font-medium text-nilin-charcoal font-sans">
                    {analytics ? `${Math.round(analytics.performanceStats.conversionRate)}%` : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-nilin-warmGray font-sans">Completed This Month</span>
                  <span className="text-sm font-medium text-nilin-charcoal font-sans">
                    {analytics ? analytics.bookingStats.completedThisMonth : 0}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-6 card-3d">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-nilin-charcoal font-sans">Revenue Breakdown</h4>
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shimmer">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-nilin-warmGray font-sans">Total Earned</span>
                <span className="text-sm font-medium text-nilin-charcoal font-sans">
                  AED {(providerProfile?.earnings?.totalEarned ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-nilin-warmGray font-sans">Available</span>
                <span className="text-sm font-medium text-green-600 font-sans">
                  AED {(providerProfile?.earnings?.availableBalance ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-nilin-warmGray font-sans">Pending</span>
                <span className="text-sm font-medium text-amber-600 font-sans">
                  AED {(providerProfile?.earnings?.pendingBalance ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-6 card-3d">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-nilin-charcoal font-sans">Recognition</h4>
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shimmer">
                <Award className="h-5 w-5 text-amber-500" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-nilin-warmGray font-sans">Overall Rating</span>
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400 mr-1" />
                  <span className="text-sm font-medium text-nilin-charcoal font-sans">
                    {(providerProfile?.ratings?.average ?? 0).toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-nilin-warmGray font-sans">Total Reviews</span>
                <span className="text-sm font-medium text-nilin-charcoal font-sans">
                  {providerProfile?.ratings?.count ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-nilin-warmGray font-sans">Badge</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-sans ${
                  (providerProfile?.ratings?.average ?? 0) >= 4.8 && (providerProfile?.ratings?.count ?? 0) >= 10
                    ? 'bg-amber-100 text-amber-700'
                    : (providerProfile?.ratings?.average ?? 0) >= 4.5 && (providerProfile?.ratings?.count ?? 0) >= 5
                    ? 'bg-green-100 text-green-700'
                    : (providerProfile?.ratings?.count ?? 0) >= 1
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-nilin-blush text-nilin-charcoal'
                }`}>
                  {(providerProfile?.ratings?.average ?? 0) >= 4.8 && (providerProfile?.ratings?.count ?? 0) >= 10
                    ? 'Elite Provider'
                    : (providerProfile?.ratings?.average ?? 0) >= 4.5 && (providerProfile?.ratings?.count ?? 0) >= 5
                    ? 'Top Rated'
                    : (providerProfile?.ratings?.count ?? 0) >= 1
                    ? 'Rising Star'
                    : 'New Provider'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProviderDashboard;
