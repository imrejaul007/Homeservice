import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { bookingService } from '../../services/BookingService';
import { providerAnalyticsApi, type ProviderAnalytics } from '../../services/providerApi';
import { reviewsApi, type Review } from '../../services/reviewsApi';
import { providerWalletApi } from '../../services/walletApi';
import { socketService } from '../../services/socket';
import { AITipsAlerts, type AITip } from '../provider/AITipsAlerts';
import { providerInsightsApi } from '../../services/providerInsightsApi';
import { useFeatureFlag } from '../../services/marketplace/FeatureFlags';
import {
  dismissAiTip,
  getTipActionRoute,
  markAiTipRead,
  saveTipPreferencesCache,
  syncLocalTipPreferencesToServer,
} from '../../utils/aiTips';
import NotificationBell from '../common/NotificationBell';
import { PageErrorBoundary } from '../common/PageErrorBoundary';
import { useToastActions } from '../common/Toast';
import { useProviderStatus, useServiceBatchUpdates } from '../../hooks/useSocket';
import { formatPrice } from '../../lib/utils';
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
  Shield,
  PieChart,
  Layers,
  List,
  TrendingUpIcon,
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
  showStar?: boolean;
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

// Status counts for booking funnel widget
interface StatusCounts {
  pending: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  cancelled: number;
}

// Extended category with booking count
interface CategoryStats {
  name: string;
  bookingCount: number;
}

function normalizeProviderBooking(booking: any): BookingRequest {
  const populatedCustomer = booking.customer || booking.customerId;
  const populatedService = booking.service || booking.serviceId;
  const firstName =
    populatedCustomer?.firstName ||
    booking.customerInfo?.firstName ||
    booking.guestInfo?.name?.split(' ')[0];
  const lastName =
    populatedCustomer?.lastName ||
    booking.customerInfo?.lastName ||
    booking.guestInfo?.name?.split(' ').slice(1).join(' ');
  const customerName =
    firstName || lastName
      ? `${firstName || ''} ${lastName || ''}`.trim()
      : booking.isGuestBooking
        ? 'Guest'
        : 'Customer';

  return {
    _id: booking._id,
    bookingNumber: booking.bookingNumber,
    customerName,
    serviceName: populatedService?.name || 'Service',
    scheduledDate: booking.scheduledDate,
    scheduledTime: booking.scheduledTime,
    status: booking.status,
    totalAmount: booking.pricing?.totalAmount || 0,
    customer: populatedCustomer,
    service: populatedService,
    pricing: booking.pricing,
  };
}

const ProviderDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  // Track socket connection cleanup functions
  const socketCleanupRef = useRef<(() => void)[]>([]);
  // Track if socket was connected
  const socketConnectedRef = useRef(false);

  // Analytics state
  const [analytics, setAnalytics] = useState<ProviderAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const [aiTips, setAiTips] = useState<AITip[]>([]);
  const [aiTipsLoading, setAiTipsLoading] = useState(false);
  const [aiTipsError, setAiTipsError] = useState<string | null>(null);
  const [aiTipsHasLoaded, setAiTipsHasLoaded] = useState(false);
  const aiTipsFetchInFlightRef = useRef(false);
  // Reviews state
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  // Booking action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Wallet state
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [loadingWallet, setLoadingWallet] = useState(true);

  // Service status counts (for Service Stats widget)
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({
    pending: 0,
    confirmed: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  });

  // Booking status counts (for Booking Status Funnel widget)
  // FIX: Was using statusCounts (service counts) instead of statusBreakdown (booking counts)
  const [bookingStatusCounts, setBookingStatusCounts] = useState<StatusCounts>({
    pending: 0,
    confirmed: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
  });

  // Category stats with booking counts
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);

  const {
    user,
    providerProfile,
    logout,
    refreshProviderProfile,
    isAuthenticated,
    isInitialized,
  } = useAuthStore();
  const toast = useToastActions();
  const aiRecommendationsEnabled = useFeatureFlag('enable_ai_recommendations');
  const providerUserId = user?.id || user?._id;

  // Subscribe to provider status events (approval, rejection, suspension)
  const { approved, rejected, suspended } = useProviderStatus();

  // Subscribe to batch service operation events
  const { batchCompleted } = useServiceBatchUpdates();

  // Helper to provide empty analytics state
  const getEmptyAnalytics = (): ProviderAnalytics => ({
    serviceStats: { total: 0, active: 0, draft: 0, inactive: 0, pending_review: 0 },
    performanceStats: { totalViews: 0, totalClicks: 0, totalBookings: 0, conversionRate: 0, bookingRate: 0 },
    ratingStats: { averageRating: 0, totalReviews: 0 },
    bookingStats: { newBookings: 0, pendingRequests: 0, todaySchedule: 0, completedThisMonth: 0 },
    categories: [],
    topServices: [],
    statusCounts: { pending: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0 },
    categoryStats: [],
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
        setBookingRequests(response.data.bookings.map(normalizeProviderBooking));
      }
    } catch {
      setBookingRequests([]);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  // Fetch analytics with retry logic
  const fetchAnalyticsWithRetry = useCallback(async (retryCount = 0) => {
    if (!isMountedRef.current) return;
    try {
      setLoadingAnalytics(true);
      setAnalyticsError(null);
      const response = await providerAnalyticsApi.getProviderAnalytics();
      if (!isMountedRef.current) return;
      if (response.success && response.data.overview) {
        const overview = response.data.overview;
        setAnalytics(overview);
        // Extract service status counts if available (for Service Stats widget)
        if (overview.statusCounts) {
          setStatusCounts(overview.statusCounts);
        }
        // Extract booking status funnel counts if available (FIX: use statusBreakdown, not statusCounts)
        if (overview.statusBreakdown) {
          setBookingStatusCounts({
            pending: overview.statusBreakdown.pending || 0,
            confirmed: overview.statusBreakdown.confirmed || 0,
            in_progress: overview.statusBreakdown.in_progress || 0,
            completed: overview.statusBreakdown.completed || 0,
            cancelled: overview.statusBreakdown.cancelled || 0,
          });
        }
        // Extract category stats if available
        if (overview.categoryStats && Array.isArray(overview.categoryStats)) {
          setCategoryStats(overview.categoryStats);
        }
        return;
      }
      // API returned success but no data - this is valid for new providers
      setAnalytics(response.data.overview || getEmptyAnalytics());
    } catch (error: any) {
      const isNetworkError = !error.response || error.code === 'ECONNABORTED';
      const shouldRetry = isNetworkError && retryCount < MAX_RETRIES;

      if (shouldRetry && isMountedRef.current) {
        console.warn(`Analytics fetch failed, retrying in ${RETRY_DELAYS[retryCount]}ms...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[retryCount]));
        if (!isMountedRef.current) return;
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

      const response = await reviewsApi.getMyReviews({ scope: 'approved', limit: 5 });
      if (response.success && response.data.reviews) {
        const transformedReviews: RecentReview[] = response.data.reviews.map((review: Review) => ({
          id: review.id,
          customerName: review.customer
            ? `${review.customer.firstName} ${review.customer.lastName}`
            : 'Customer',
          rating: review.rating,
          comment: review.comment,
          serviceName: review.service?.name || 'Service',
          date: review.createdAt,
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
  }, []);

  const AI_TIPS_TIMEOUT_MS = 12000;

  // Fetch AI tips/recommendations
  const fetchAiTips = useCallback(async () => {
    if (!providerUserId || !aiRecommendationsEnabled || aiTipsFetchInFlightRef.current) return;

    aiTipsFetchInFlightRef.current = true;
    try {
      setAiTipsLoading(true);
      setAiTipsError(null);

      void syncLocalTipPreferencesToServer(providerUserId);

      const fetchPromise = providerInsightsApi.getAITips();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AI insights request timed out')), AI_TIPS_TIMEOUT_MS);
      });

      const { tips, preferences } = await Promise.race([fetchPromise, timeoutPromise]);
      if (!isMountedRef.current) return;

      saveTipPreferencesCache(providerUserId, preferences);
      setAiTips(tips);
      setAiTipsHasLoaded(true);
    } catch (error) {
      if (!isMountedRef.current) return;
      console.error('Failed to fetch AI tips:', error);
      setAiTipsError('Failed to load recommendations');
      setAiTipsHasLoaded(true);
    } finally {
      aiTipsFetchInFlightRef.current = false;
      if (isMountedRef.current) {
        setAiTipsLoading(false);
      }
    }
  }, [providerUserId, aiRecommendationsEnabled]);

  const handleTipDismiss = useCallback(async (tipId: string) => {
    if (!providerUserId) return;
    setAiTips((prev) =>
      prev.map((tip) => (tip.id === tipId ? { ...tip, isDismissed: true } : tip))
    );
    await dismissAiTip(providerUserId, tipId);
  }, [providerUserId]);

  const handleTipMarkAsRead = useCallback(async (tipId: string) => {
    if (!providerUserId) return;
    setAiTips((prev) =>
      prev.map((tip) => (tip.id === tipId ? { ...tip, isRead: true } : tip))
    );
    await markAiTipRead(providerUserId, tipId);
  }, [providerUserId]);

  const handleTipAction = useCallback(async (tip: AITip) => {
    if (!providerUserId) return;
    setAiTips((prev) =>
      prev.map((t) => (t.id === tip.id ? { ...t, isRead: true } : t))
    );
    await markAiTipRead(providerUserId, tip.id);
    navigate(getTipActionRoute(tip));
  }, [providerUserId, navigate]);

  // Fetch wallet balance
  const fetchWalletBalance = useCallback(async () => {
    try {
      setLoadingWallet(true);
      const response = await providerWalletApi.getWallet();
      if (response.success && response.data) {
        setWalletBalance(response.data.balance || 0);
      }
    } catch (error) {
      console.error('Failed to fetch wallet balance:', error);
      setWalletBalance(0);
    } finally {
      setLoadingWallet(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  // Handle provider approval in real-time
  useEffect(() => {
    if (approved && approved.providerId === user?.id) {
      toast.success('Congratulations! Your account has been approved. You can now start accepting bookings.');
      refreshProviderProfile();
      fetchAnalyticsWithRetry();
    }
  }, [approved, user?.id, toast, refreshProviderProfile, fetchAnalyticsWithRetry]);

  // Handle provider rejection in real-time
  useEffect(() => {
    if (rejected && rejected.providerId === user?.id) {
      toast.error(`Your application was rejected: ${rejected.reason}`);
      if (rejected.canAppeal) {
        toast.success('You can submit an appeal from your verification page.');
      }
    }
  }, [rejected, user?.id, toast]);

  // Handle provider suspension in real-time
  useEffect(() => {
    if (suspended && suspended.providerId === user?.id) {
      toast.error(`Your account has been suspended: ${suspended.reason}`);
      if (suspended.until) {
        toast.success(`Suspension will end on ${new Date(suspended.until).toLocaleDateString()}`);
      }
      refreshProviderProfile();
    }
  }, [suspended, user?.id, toast, refreshProviderProfile]);

  // Handle batch service operations in real-time
  useEffect(() => {
    if (batchCompleted && batchCompleted.providerIds.includes(user?.id || '')) {
      const message = batchCompleted.action === 'approved'
        ? `${batchCompleted.affectedCount} services have been approved!`
        : `${batchCompleted.affectedCount} services were rejected.`;
      toast.success(message);
      fetchAnalyticsWithRetry();
    }
  }, [batchCompleted, user?.id, toast, fetchAnalyticsWithRetry]);

  // Core dashboard data — wait for auth; avoid duplicate /auth/me (handled in authStore.initialize)
  useEffect(() => {
    if (!isInitialized || !isAuthenticated || !providerUserId) return;

    isMountedRef.current = true;
    fetchBookingRequests();
    fetchAnalyticsWithRetry();
    fetchReviews();

    return () => {
      isMountedRef.current = false;
    };
  }, [
    isInitialized,
    isAuthenticated,
    providerUserId,
    fetchBookingRequests,
    fetchAnalyticsWithRetry,
    fetchReviews,
  ]);

  // AI tips load separately so feature-flag hydration does not refetch the whole dashboard
  useEffect(() => {
    if (!isInitialized || !isAuthenticated || !providerUserId || !aiRecommendationsEnabled) return;
    fetchAiTips();
  }, [
    isInitialized,
    isAuthenticated,
    providerUserId,
    aiRecommendationsEnabled,
    fetchAiTips,
  ]);

  // Socket listeners for real-time updates
  useEffect(() => {
    let isMounted = true;

    const setupSocket = async () => {
      // CRITICAL FIX: Connect to socket only if not already connected
      if (!socketService.isConnected()) {
        try {
          await socketService.connect();
          socketConnectedRef.current = true;
        } catch (error) {
          console.warn('Socket connection failed:', error);
          return;
        }
      }

      if (!isMounted) return;

      // Listen for booking status changes
      const unsubBookingStatus = socketService.onBookingStatusChanged(() => {
        if (isMountedRef.current) {
          fetchBookingRequests();
          fetchAnalyticsWithRetry();
        }
      });

      // Listen for new booking requests
      const unsubNewRequest = socketService.on('booking:new_request', () => {
        if (isMountedRef.current) {
          fetchBookingRequests();
        }
      });

      // Listen for booking confirmations
      const unsubBookingConfirmed = socketService.on('booking:confirmed', () => {
        if (isMountedRef.current) {
          fetchBookingRequests();
          fetchAnalyticsWithRetry();
        }
      });

      // Listen for service approved events (when admin approves a provider's service)
      const unsubServiceApproved = socketService.onServiceApproved((data) => {
        if (isMountedRef.current) {
          // Refresh analytics to update service stats
          fetchAnalyticsWithRetry();
          // Show toast notification when service is approved (issue #11)
          toast.success('Your service has been approved and is now live!');
          console.log('Service approved:', data.serviceId);
        }
      });

      // Listen for service rejected events
      const unsubServiceRejected = socketService.onServiceRejected((data) => {
        if (isMountedRef.current) {
          fetchAnalyticsWithRetry();
          // Show toast notification when service is rejected (issue #12)
          toast.error(`Service rejected: ${data.reason || 'Please review the feedback'}`);
          console.log('Service rejected:', data.serviceId);
        }
      });

      // Listen for insights updates (AI tips may change when key metrics change)
      const unsubInsightsUpdated = socketService.onInsightsUpdated((data) => {
        if (isMountedRef.current) {
          // Refresh analytics and AI tips when insights change
          fetchAnalyticsWithRetry();
          fetchAiTips();
          console.log('Insights updated:', data.reason);
        }
      });

      const unsubReviewModerated = socketService.onReviewModerated(() => {
        if (isMountedRef.current) {
          fetchReviews();
          refreshProviderProfile();
        }
      });

      // Listen for new notifications
      const unsubNotification = socketService.onNewNotification(() => {
        // Notification bell handles its own updates
      });

      // Store cleanup functions
      socketCleanupRef.current = [
        unsubBookingStatus,
        unsubNewRequest,
        unsubBookingConfirmed,
        unsubServiceApproved,
        unsubServiceRejected,
        unsubReviewModerated,
        unsubNotification,
        unsubInsightsUpdated
      ];
    };

    setupSocket();

    // Cleanup on unmount
    return () => {
      isMounted = false;

      // CRITICAL FIX: Proper cleanup order - unsubscribe from events BEFORE disconnecting
      // This prevents the socket from emitting events to unsubscribed listeners
      socketCleanupRef.current.forEach(cleanup => {
        if (typeof cleanup === 'function') {
          cleanup();
        }
      });
      socketCleanupRef.current = [];

      // Only disconnect if we initiated the connection and component is truly unmounting
      // The socket service manages reconnection, so we don't want to disconnect
      // on every unmount if other components are using it
    };
  }, [fetchBookingRequests, fetchAnalyticsWithRetry, fetchReviews, refreshProviderProfile]);

  // Handle booking accept
  const handleAcceptBooking = async (bookingId: string) => {
    try {
      setActionLoading(bookingId);
      await bookingService.acceptBooking(bookingId);
      // Refresh bookings only if still mounted
      if (!isMountedRef.current) return;

      const response = await bookingService.getProviderBookings({
        status: 'pending',
        limit: 5,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      if (response.success && response.data.bookings && isMountedRef.current) {
        setBookingRequests(response.data.bookings.map(normalizeProviderBooking));
      }
    } catch (error) {
      console.error('Failed to accept booking:', error);
      toast.error('Failed to accept booking', 'Please try again.');
    } finally {
      if (isMountedRef.current) {
        setActionLoading(null);
      }
    }
  };

  // Handle booking decline
  const handleDeclineBooking = async (bookingId: string) => {
    try {
      setActionLoading(bookingId);
      await bookingService.rejectBooking(bookingId, { reason: 'Declined by provider' });
      // Refresh bookings only if still mounted
      if (!isMountedRef.current) return;

      const response = await bookingService.getProviderBookings({
        status: 'pending',
        limit: 5,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      });
      if (response.success && response.data.bookings && isMountedRef.current) {
        setBookingRequests(response.data.bookings.map(normalizeProviderBooking));
      }
    } catch (error) {
      console.error('Failed to decline booking:', error);
      toast.error('Failed to decline booking', 'Please try again.');
    } finally {
      if (isMountedRef.current) {
        setActionLoading(null);
      }
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
    providerProfile?.analytics?.previousEarnings
  );
  const bookingsTrend = calculateTrend(
    analytics?.bookingStats.completedThisMonth || 0,
    providerProfile?.analytics?.previousBookings
  );
  const viewsTrend = calculateTrend(
    analytics?.performanceStats.totalViews || providerProfile?.analytics?.profileViews || 0,
    providerProfile?.analytics?.previousViews
  );

  // Normalized values — single source of truth for stats cards
  const monthlyNetEarnings =
    analytics?.revenueStats?.monthlyNetEarnings ??
    providerProfile?.earnings?.thisMonth ??
    0;
  const repeatCustomers =
    analytics?.customerMetrics?.repeatCustomers ??
    providerProfile?.analytics?.customerMetrics?.repeatCustomers ??
    0;
  const totalViews =
    analytics?.performanceStats?.totalViews ??
    providerProfile?.analytics?.profileViews ??
    0;
  const completedBookings =
    analytics?.bookingStats?.completedThisMonth ??
    providerProfile?.analytics?.bookings ??
    0;
  const averageRating =
    providerProfile?.ratings?.average ??
    analytics?.ratingStats?.averageRating ??
    0;
  const reviewCount =
    providerProfile?.ratings?.count ??
    analytics?.ratingStats?.totalReviews ??
    0;

  // Derive stats cards from normalized values (single source of truth)
  const stats: StatCard[] = [
    {
      title: 'Monthly Earnings',
      value: monthlyNetEarnings,
      subtitle: 'Net this month',
      icon: DollarSign,
      trend: earningsTrend,
      color: 'bg-nilin-rose'
    },
    {
      title: 'Total Bookings',
      value: completedBookings,
      subtitle: 'Completed this month',
      icon: Calendar,
      trend: bookingsTrend,
      color: 'bg-nilin-coral'
    },
    {
      title: 'Average Rating',
      value: averageRating,
      subtitle: `${reviewCount} reviews`,
      icon: Star,
      color: 'bg-nilin-rose'
    },
    {
      title: 'Service Impressions',
      value: totalViews,
      subtitle: 'All time',
      icon: Eye,
      trend: viewsTrend,
      color: 'bg-nilin-coral'
    }
  ];

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
              <NotificationBell userId={user?.id || user?._id} userRole="provider" />

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
      <PageErrorBoundary pageName="Provider Dashboard">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-nilin-rose to-nilin-coral rounded-2xl p-6 text-white shadow-nilin-lg">
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
                    <span>{formatPrice(walletBalance)} available</span>
                  </div>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 mr-1" />
                    <span>{providerProfile?.ratings?.average || 0} avg rating</span>
                  </div>
                  <div className="flex items-center">
                    <Users className="h-4 w-4 mr-1" />
                    <span>{repeatCustomers} repeat customers</span>
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

	        {/* Quick Actions */}
	        <div className="mb-8">
	          <div className="flex items-center justify-between mb-4">
	            <h3 className="text-lg font-semibold text-nilin-charcoal">Quick Actions</h3>
	          </div>
	          <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-2">
	            <Link
	              to="/provider/services"
	              className="flex flex-col items-center justify-center p-3 bg-gradient-to-br from-nilin-coral to-nilin-rose rounded-xl text-white hover:shadow-lg transition-all duration-300"
	            >
	              <Plus className="h-5 w-5 mb-1" />
	              <span className="text-xs font-medium text-center">Add Service</span>
	            </Link>
	            <Link
	              to="/provider/bookings"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Calendar className="h-5 w-5 text-nilin-coral mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Bookings</span>
	            </Link>
	            <Link
	              to="/provider/calendar"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <List className="h-5 w-5 text-nilin-rose mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Schedule</span>
	            </Link>
	            <Link
	              to="/provider/analytics"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <BarChart className="h-5 w-5 text-nilin-rose mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Analytics</span>
	            </Link>
	            <Link
	              to="/provider/earnings"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <DollarSign className="h-5 w-5 text-green-600 mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Earnings</span>
	            </Link>
	            <Link
	              to="/provider/reviews"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Star className="h-5 w-5 text-yellow-500 mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Reviews</span>
	            </Link>
	            <Link
	              to="/provider/availability"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Clock className="h-5 w-5 text-nilin-rose mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Hours</span>
	            </Link>
	            <Link
	              to="/provider/settings"
	              className="flex flex-col items-center justify-center p-3 bg-white/60 backdrop-blur rounded-xl border border-nilin-border/30 hover:border-nilin-coral/50 hover:shadow-md transition-all duration-300"
	            >
	              <Shield className="h-5 w-5 text-nilin-warmGray mb-1" />
	              <span className="text-xs font-medium text-nilin-charcoal text-center">Settings</span>
	            </Link>
	          </div>
	          <div className="mt-3 flex flex-wrap gap-2">
	            <Link to="/provider/profile" className="text-xs px-3 py-1.5 rounded-full border border-nilin-border/50 text-nilin-charcoal hover:bg-nilin-blush/50">Profile</Link>
	            <Link to="/provider/portfolio" className="text-xs px-3 py-1.5 rounded-full border border-nilin-border/50 text-nilin-charcoal hover:bg-nilin-blush/50">Portfolio</Link>
	            <Link to="/provider/ads" className="text-xs px-3 py-1.5 rounded-full border border-nilin-border/50 text-nilin-charcoal hover:bg-nilin-blush/50">Ads</Link>
	            <Link to="/provider/managed-services" className="text-xs px-3 py-1.5 rounded-full border border-nilin-border/50 text-nilin-charcoal hover:bg-nilin-blush/50">Managed</Link>
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
                      {stat.showStar ? (
                        <div className="flex items-center gap-1">
                          <p className="text-2xl font-serif font-light text-nilin-charcoal">
                            {typeof stat.value === 'number' ? stat.value.toFixed(1) : stat.value}
                          </p>
                          <Star className="h-5 w-5 text-amber-400 fill-amber-400" />
                        </div>
                      ) : (
                        <p className="text-2xl font-serif font-light text-nilin-charcoal">
                          {stat.title.includes('Earnings') ? `AED ${stat.value}` : stat.value}
                        </p>
                      )}
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

        {/* AI Recommendations Section — fixed min-height prevents CLS while loading */}
        {aiRecommendationsEnabled && providerUserId && (
          <div className="mb-8 min-h-[12rem]">
            {aiTipsError && !aiTipsLoading ? (
              <div className="p-4 glass rounded-xl border border-nilin-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm text-nilin-charcoal">AI Recommendations unavailable</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => fetchAiTips()}
                    className="text-xs text-nilin-coral hover:text-nilin-rose font-medium"
                  >
                    Retry
                  </button>
                </div>
              </div>
            ) : (
              <AITipsAlerts
                tips={aiTips}
                isLoading={aiTipsLoading && !aiTipsHasLoaded}
                maxVisible={5}
                onTipAction={handleTipAction}
                onDismiss={handleTipDismiss}
                onMarkAsRead={handleTipMarkAsRead}
                viewAllHref="/provider/analytics?tab=insights"
              />
            )}
          </div>
        )}


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

        {/* Analytics Widgets Section */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Service Stats Widget */}
          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-6 card-3d">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-nilin-charcoal font-sans">Service Stats</h4>
              <div className="w-10 h-10 rounded-xl bg-nilin-coral/20 flex items-center justify-center shimmer">
                <Layers className="h-5 w-5 text-nilin-coral" />
              </div>
            </div>
            {loadingAnalytics ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="h-4 w-20 bg-nilin-blush animate-pulse rounded"></div>
                    <div className="h-4 w-8 bg-nilin-blush animate-pulse rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-nilin-border/30">
                  <span className="text-sm text-nilin-warmGray font-sans">Total Services</span>
                  <span className="text-sm font-medium text-nilin-charcoal font-sans">
                    {analytics?.serviceStats?.total ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-nilin-border/30">
                  <span className="text-sm text-nilin-warmGray font-sans">Active</span>
                  <span className="text-sm font-medium text-green-600 font-sans">
                    {analytics?.serviceStats?.active ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-nilin-border/30">
                  <span className="text-sm text-nilin-warmGray font-sans">Draft</span>
                  <span className="text-sm font-medium text-amber-600 font-sans">
                    {analytics?.serviceStats?.draft ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-nilin-border/30">
                  <span className="text-sm text-nilin-warmGray font-sans">Inactive</span>
                  <span className="text-sm font-medium text-nilin-warmGray font-sans">
                    {analytics?.serviceStats?.inactive ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-nilin-warmGray font-sans">Pending Review</span>
                  <span className="text-sm font-medium text-blue-600 font-sans">
                    {analytics?.serviceStats?.pending_review ?? 0}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Booking Status Funnel Widget */}
          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-6 card-3d">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-nilin-charcoal font-sans">Booking Status Funnel</h4>
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shimmer">
                <TrendingUpIcon className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            {loadingAnalytics ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="h-4 w-24 bg-nilin-blush animate-pulse rounded"></div>
                    <div className="h-4 w-8 bg-nilin-blush animate-pulse rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-nilin-border/30">
                  <span className="text-sm text-nilin-warmGray font-sans">Pending</span>
                  <span className="text-sm font-medium text-amber-600 font-sans">
                    {bookingStatusCounts.pending}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-nilin-border/30">
                  <span className="text-sm text-nilin-warmGray font-sans">Confirmed</span>
                  <span className="text-sm font-medium text-blue-600 font-sans">
                    {bookingStatusCounts.confirmed}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-nilin-border/30">
                  <span className="text-sm text-nilin-warmGray font-sans">In Progress</span>
                  <span className="text-sm font-medium text-purple-600 font-sans">
                    {bookingStatusCounts.in_progress}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-nilin-border/30">
                  <span className="text-sm text-nilin-warmGray font-sans">Completed</span>
                  <span className="text-sm font-medium text-green-600 font-sans">
                    {bookingStatusCounts.completed}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-nilin-warmGray font-sans">Cancelled</span>
                  <span className="text-sm font-medium text-red-600 font-sans">
                    {bookingStatusCounts.cancelled}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Services Widget */}
        <div className="mt-6 glass glass-blur rounded-2xl border border-nilin-border/50 p-6 card-3d">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-nilin-charcoal font-sans">Top Services</h4>
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shimmer">
              <Award className="h-5 w-5 text-amber-500" />
            </div>
          </div>
          {loadingAnalytics ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-nilin-blush animate-pulse rounded-xl"></div>
              ))}
            </div>
          ) : analytics?.topServices && analytics.topServices.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {analytics.topServices.slice(0, 3).map((service, index) => (
                <div key={service.id || index} className="bg-nilin-blush/30 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-nilin-coral/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-nilin-coral">#{index + 1}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-nilin-charcoal font-sans">{service.name}</p>
                      <p className="text-xs text-nilin-warmGray">{service.bookings} bookings</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-600 font-sans">
                      AED {(service.revenue || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-nilin-warmGray">revenue</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <List className="mx-auto h-10 w-10 text-nilin-warmGray mb-2" />
              <p className="text-sm text-nilin-warmGray font-sans">No services data available</p>
            </div>
          )}
        </div>

        {/* Categories Overview + Total Customers Widgets */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Categories Overview */}
          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-6 card-3d">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-nilin-charcoal font-sans">Categories Overview</h4>
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shimmer">
                <PieChart className="h-5 w-5 text-purple-500" />
              </div>
            </div>
            {loadingAnalytics ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-10 bg-nilin-blush animate-pulse rounded-lg"></div>
                ))}
              </div>
            ) : categoryStats.length > 0 ? (
              <div className="space-y-3">
                {categoryStats.slice(0, 5).map((category, index) => {
                  const totalBookings = categoryStats.reduce((sum, c) => sum + c.bookingCount, 0);
                  const percentage = totalBookings > 0 ? (category.bookingCount / totalBookings) * 100 : 0;
                  return (
                    <div key={index} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className="text-sm text-nilin-charcoal font-sans">{category.name}</span>
                          <span className="text-sm text-nilin-warmGray font-sans">{category.bookingCount}</span>
                        </div>
                        <div className="h-2 bg-nilin-blush rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-nilin-coral to-nilin-rose rounded-full transition-all"
                            style={{ width: `${Math.max(percentage, 2)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <PieChart className="mx-auto h-10 w-10 text-nilin-warmGray mb-2" />
                <p className="text-sm text-nilin-warmGray font-sans">No category data available</p>
              </div>
            )}
          </div>

          {/* Total Customers Widget */}
          <div className="glass glass-blur rounded-2xl border border-nilin-border/50 p-6 card-3d">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-nilin-charcoal font-sans">Customer Metrics</h4>
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shimmer">
                <Users className="h-5 w-5 text-green-500" />
              </div>
            </div>
            {loadingAnalytics ? (
              <div className="space-y-4">
                <div className="h-16 bg-nilin-blush animate-pulse rounded-xl"></div>
                <div className="h-16 bg-nilin-blush animate-pulse rounded-xl"></div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs text-green-600 font-medium font-sans">Total Customers</p>
                        <p className="text-2xl font-bold text-green-700">
                          {analytics?.customerMetrics?.totalCustomers ?? repeatCustomers ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Star className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs text-blue-600 font-medium font-sans">Repeat Customers</p>
                        <p className="text-2xl font-bold text-blue-700">
                          {repeatCustomers}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </PageErrorBoundary>
    </div>
  );
};

export default ProviderDashboard;
