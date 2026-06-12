import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle,
  Clock,
  Package,
  User,
  Users,
  ChevronDown,
  ArrowRight,
  Search,
  Star,
  LogOut,
  Settings,
  Bell,
  Plus,
  Sparkles,
  TrendingUp,
  CreditCard,
  MessageCircle,
  MessageSquare,
  Flame,
  Award,
} from 'lucide-react';
import NavigationHeader from '../components/layout/NavigationHeader';
import Footer from '../components/layout/Footer';
import CustomerHubNav from '../components/customer/CustomerHubNav';
import ViewProModal from '../components/dashboard/ViewProModal';
import OngoingBookings from '../components/dashboard/OngoingBookings';
import DashboardUpcomingSection from '../components/dashboard/DashboardUpcomingSection';
import { WriteReviewModal } from '../components/customer/WriteReviewModal';
import { useAuthStore } from '../stores/authStore';
import {
  customerDashboardApi,
  type DashboardStats,
  type BookingSummary,
  type LoyaltyData,
  type StreakData,
} from '../services/customerDashboardApi';
import { bookingApi } from '../services/bookingApi';
import { chatApi, type ChatRoom, type ChatRoomListItem } from '../services/chatApi';
import type { Booking } from '../types/booking.types';
import type { AuthUser } from '../services/AuthService';
import type { BookingStatus } from '../types/booking.types';
import { useSocketEvent } from '../hooks/useSocket';
import { PriceDisplay } from '../components/common/PriceDisplay';
import toast from 'react-hot-toast';

// ============================================
// HELPERS
// ============================================

const getDisplayName = (user: AuthUser | null): string => {
  if (!user) return 'there';
  if (user.name?.trim()) return user.name.trim().split(' ')[0];
  if (user.firstName?.trim()) return user.firstName.trim();
  return 'there';
};

const getFullDisplayName = (user: AuthUser | null): string => {
  if (!user) return 'User';
  if (user.name?.trim()) return user.name.trim();
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || 'User';
};

// Format relative time (e.g., "2 hours ago")
const formatRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const countActiveBookings = (bookings: BookingSummary[]): number =>
  bookings.filter((b) => ['pending', 'confirmed', 'in_progress'].includes(b.status)).length;

const mapBookingToSummary = (booking: Booking): BookingSummary => {
  const service =
    booking.service ||
    (typeof (booking as { serviceId?: { name?: string; category?: string } }).serviceId === 'object'
      ? (booking as { serviceId: { name?: string; category?: string } }).serviceId
      : null);
  const provider =
    booking.provider ||
    (typeof (booking as { providerId?: { firstName?: string; lastName?: string; avatar?: string } }).providerId ===
    'object'
      ? (booking as { providerId: { firstName?: string; lastName?: string; avatar?: string; _id?: string } }).providerId
      : null);

  const providerName = provider
    ? `${provider.firstName || ''}${provider.lastName ? ` ${provider.lastName}` : ''}`.trim()
    : 'Provider';

  return {
    _id: booking._id,
    bookingNumber: booking.bookingNumber,
    status: booking.status as BookingSummary['status'],
    scheduledDate: booking.scheduledDate,
    scheduledTime: booking.scheduledTime,
    duration: booking.duration || booking.estimatedDuration || 0,
    totalAmount: booking.pricing?.totalAmount || booking.pricing?.total || 0,
    currency: booking.pricing?.currency || 'AED',
    serviceName: service?.name || 'Service',
    serviceCategory: service?.category || '',
    providerName: providerName || 'Provider',
    providerId:
      (provider as { _id?: string })?._id ||
      (typeof booking.providerId === 'string' ? booking.providerId : '') ||
      '',
    providerAvatar: provider?.avatar,
    createdAt: booking.createdAt,
    canReview:
      booking.status === 'completed' &&
      !(booking as { customerRating?: { rating: number } }).customerRating,
  };
};

// ============================================
// STATUS CONFIGURATION
// ============================================

const statusConfig: Record<BookingStatus, { color: string; bgColor: string; label: string }> = {
  pending: { color: 'text-amber-600', bgColor: 'bg-amber-50', label: 'Pending' },
  confirmed: { color: 'text-blue-600', bgColor: 'bg-blue-50', label: 'Confirmed' },
  in_progress: { color: 'text-purple-600', bgColor: 'bg-purple-50', label: 'In Progress' },
  completed: { color: 'text-green-600', bgColor: 'bg-green-50', label: 'Completed' },
  cancelled: { color: 'text-red-600', bgColor: 'bg-red-50', label: 'Cancelled' },
  no_show: { color: 'text-gray-600', bgColor: 'bg-gray-50', label: 'No Show' },
  refunded: { color: 'text-teal-600', bgColor: 'bg-teal-50', label: 'Refunded' },
  rejected: { color: 'text-red-600', bgColor: 'bg-red-50', label: 'Rejected' },
};

// ============================================
// SKELETON COMPONENTS
// ============================================

const StatCardSkeleton = () => (
  <div className="rounded-2xl border border-nilin-border/40 bg-white p-5 animate-pulse">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 space-y-2">
        <div className="h-4 w-24 bg-nilin-border/40 rounded" />
        <div className="h-9 w-14 bg-nilin-border/50 rounded" />
        <div className="h-3 w-32 bg-nilin-border/30 rounded" />
      </div>
      <div className="w-11 h-11 rounded-xl bg-nilin-coral/20 flex-shrink-0" />
    </div>
  </div>
);

const BookingRowSkeleton = () => (
  <tr className="border-b border-nilin-border/30">
    <td className="py-4 px-4"><div className="h-4 w-20 bg-nilin-border/30 rounded" /></td>
    <td className="py-4 px-4"><div className="h-4 w-32 bg-nilin-border/30 rounded" /></td>
    <td className="py-4 px-4"><div className="h-4 w-24 bg-nilin-border/30 rounded" /></td>
    <td className="py-4 px-4"><div className="h-4 w-16 bg-nilin-border/30 rounded" /></td>
    <td className="py-4 px-4"><div className="h-6 w-20 bg-nilin-border/30 rounded-full" /></td>
    <td className="py-4 px-4"><div className="h-8 w-16 bg-nilin-border/30 rounded" /></td>
  </tr>
);

// ============================================
// STAT CARD COMPONENT
// ============================================

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; positive: boolean };
  onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  onClick,
}) => (
  <div
    role={onClick ? 'button' : undefined}
    tabIndex={onClick ? 0 : undefined}
    onClick={onClick}
    onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
    className={`relative overflow-hidden rounded-2xl border border-nilin-border/40 bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300 group ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-nilin-coral/30' : ''}`}
  >
    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-nilin-blush/40 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    <div className="relative flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-nilin-warmGray mb-1">{title}</p>
        <div className="text-3xl font-bold text-nilin-charcoal tracking-tight">{value}</div>
        {subtitle && <p className="text-xs text-nilin-warmGray/80 mt-1.5 line-clamp-2">{subtitle}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
    {trend && (
      <div className={`relative mt-3 flex items-center gap-1 text-xs font-medium ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
        <TrendingUp className={`w-3 h-3 ${!trend.positive && 'rotate-180'}`} />
        {Math.abs(trend.value)}%
      </div>
    )}
  </div>
);

// ============================================
// NAVIGATION CARD COMPONENT
// ============================================

interface NavCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  color: string;
}

const NavCard: React.FC<NavCardProps> = ({ title, description, icon: Icon, href, onClick, color }) => {
  const navigate = useNavigate();
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      navigate(href);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-left w-full flex items-center gap-3.5 rounded-2xl border border-nilin-border/40 bg-white p-4 shadow-sm hover:shadow-md hover:border-nilin-coral/25 transition-all duration-300 group hover:-translate-y-0.5 min-h-[88px]"
    >
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-nilin-charcoal text-sm leading-tight">{title}</h3>
        <p className="text-xs text-nilin-warmGray mt-0.5 line-clamp-2">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-nilin-coral/60 flex-shrink-0 group-hover:text-nilin-coral group-hover:translate-x-0.5 transition-all" />
    </button>
  );
};

// ============================================
// MOBILE BOOKING CARD
// ============================================

interface BookingMobileCardProps {
  booking: BookingSummary;
  onView: (id: string) => void;
  onWriteReview?: (bookingId: string) => void;
}

const BookingMobileCard: React.FC<BookingMobileCardProps> = ({
  booking,
  onView,
  onWriteReview,
}) => {
  const status = statusConfig[booking.status] || statusConfig.pending;
  const formattedDate = new Date(booking.scheduledDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <button
      type="button"
      onClick={() => onView(booking._id)}
      className="w-full text-left p-4 border-b border-nilin-border/20 last:border-0 hover:bg-nilin-blush/20 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0">
          <p className="font-semibold text-nilin-charcoal text-[15px]">{booking.serviceName}</p>
          <p className="text-xs text-nilin-warmGray mt-0.5">
            #{booking.bookingNumber?.slice(-6) || 'N/A'} · {formattedDate} · {booking.scheduledTime}
          </p>
        </div>
        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${status.bgColor} ${status.color}`}>
          {status.label}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-nilin-coral/10 flex items-center justify-center flex-shrink-0">
            {booking.providerAvatar ? (
              <img src={booking.providerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-3.5 h-3.5 text-nilin-coral" />
            )}
          </div>
          <span className="text-sm text-nilin-charcoal truncate">{booking.providerName}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {booking.canReview && onWriteReview && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onWriteReview(booking._id);
              }}
              className="px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200"
            >
              Review
            </button>
          )}
          <PriceDisplay
            price={booking.totalAmount || 0}
            originalCurrency={booking.currency || 'AED'}
            size="sm"
            className="text-sm"
          />
        </div>
      </div>
    </button>
  );
};

// ============================================
// BOOKING ROW COMPONENT
// ============================================

interface BookingRowProps {
  booking: BookingSummary;
  onView: (id: string) => void;
  onWriteReview?: (bookingId: string) => void;
}

const BookingRow: React.FC<BookingRowProps> = ({ booking, onView, onWriteReview }) => {
  const status = statusConfig[booking.status] || statusConfig.pending;
  const formattedDate = new Date(booking.scheduledDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const handleWriteReviewClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onWriteReview?.(booking._id);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onView(booking._id);
    }
  };

  return (
    <tr
      className="border-b border-nilin-border/20 last:border-0 hover:bg-nilin-blush/20 transition-colors cursor-pointer"
      onClick={() => onView(booking._id)}
      onKeyDown={handleRowKeyDown}
      tabIndex={0}
      role="button"
    >
      <td className="py-4 px-5">
        <div className="font-mono text-sm font-semibold text-nilin-coral">#{booking.bookingNumber?.slice(-6) || 'N/A'}</div>
      </td>
      <td className="py-4 px-5">
        <div className="font-semibold text-nilin-charcoal text-[15px]">{booking.serviceName}</div>
        {booking.serviceCategory && (
          <div className="text-xs text-nilin-warmGray mt-0.5">{booking.serviceCategory}</div>
        )}
      </td>
      <td className="py-4 px-5">
        <div className="text-sm font-medium text-nilin-charcoal">{formattedDate}</div>
        <div className="text-xs text-nilin-warmGray mt-0.5">{booking.scheduledTime}</div>
      </td>
      <td className="py-4 px-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-nilin-coral/15 ring-2 ring-white flex items-center justify-center flex-shrink-0">
            {booking.providerAvatar ? (
              <img src={booking.providerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-nilin-coral" />
            )}
          </div>
          <span className="text-sm font-medium text-nilin-charcoal">{booking.providerName}</span>
        </div>
      </td>
      <td className="py-4 px-5">
        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${status.bgColor} ${status.color}`}>
          {status.label}
        </span>
      </td>
      <td className="py-4 px-5">
        <div className="flex items-center justify-end gap-2">
          {booking.canReview && onWriteReview && (
            <button
              onClick={handleWriteReviewClick}
              className="px-3 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full hover:bg-amber-200 transition-colors flex items-center gap-1"
            >
              <Star className="w-3 h-3" />
              Review
            </button>
          )}
          <div className="text-right">
            <PriceDisplay
              price={booking.totalAmount || 0}
              originalCurrency={booking.currency || 'AED'}
              size="sm"
              className="text-base justify-end"
            />
            {booking.duration ? (
              <div className="text-xs text-nilin-warmGray flex items-center justify-end gap-1 mt-0.5">
                <Clock className="w-3 h-3" />
                {booking.duration} min
              </div>
            ) : null}
          </div>
        </div>
      </td>
    </tr>
  );
};

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBookings, setRecentBookings] = useState<BookingSummary[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<BookingSummary[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState<LoyaltyData | null>(null);
  const [currentStreak, setCurrentStreak] = useState<StreakData | null>(null);
  const [recentConversations, setRecentConversations] = useState<ChatRoomListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showViewProModal, setShowViewProModal] = useState(false);
  const [showWriteReviewModal, setShowWriteReviewModal] = useState(false);
  const [writeReviewBookingId, setWriteReviewBookingId] = useState<string | undefined>();

  const trackedBookingIdsRef = useRef<Set<string>>(new Set());
  const lastStatusToastRef = useRef<{ at: number; key: string } | null>(null);
  const STATUS_TOAST_DEBOUNCE_MS = 5000;

  // Fetch recent conversations
  const fetchRecentConversations = useCallback(async () => {
    setIsLoadingMessages(true);
    try {
      const response = await chatApi.getChatRooms({ limit: 3 });
      setRecentConversations(response.rooms || []);
    } catch (err) {
      console.error('Error fetching conversations:', err);
      // Silently fail - messages section is non-critical
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let statsData: DashboardStats | null = null;
      let recent: BookingSummary[] = [];
      let upcoming: BookingSummary[] = [];
      let loyalty: LoyaltyData | null = null;
      let streak: StreakData | null = null;

      let unifiedFetchFailed = false;
      try {
        const dashboard = await customerDashboardApi.getDashboard();
        statsData = dashboard.stats;
        recent = dashboard.recentBookings || [];
        upcoming = dashboard.upcomingBookings || [];
        loyalty = dashboard.loyaltyPoints || null;
        streak = dashboard.currentStreak || null;
      } catch (dashboardErr) {
        unifiedFetchFailed = true;
        console.warn('[CustomerDashboard] Unified fetch failed, using fallback', dashboardErr);
        const [statsResult, bookingsResult] = await Promise.allSettled([
          customerDashboardApi.getStats(),
          bookingApi.getBookings({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
        ]);

        const statsFailed = statsResult.status === 'rejected';
        const bookingsFailed = bookingsResult.status === 'rejected';

        if (statsResult.status === 'fulfilled') {
          statsData = statsResult.value;
        }
        if (bookingsResult.status === 'fulfilled') {
          recent = (bookingsResult.value.bookings || []).map(mapBookingToSummary);
        }

        if (!statsData && recent.length === 0) {
          // Throw a meaningful error with actual failure context, not stale dashboardErr
          const fallbackErrors: string[] = [];
          if (statsFailed) fallbackErrors.push('stats');
          if (bookingsFailed) fallbackErrors.push('bookings');
          throw new Error(
            `Dashboard fallback failed: ${fallbackErrors.join(' and ')}. Original error: ${dashboardErr instanceof Error ? dashboardErr.message : String(dashboardErr)}`
          );
        }
      }

      // Show toast if unified fetch failed (even if fallback partially succeeded)
      if (unifiedFetchFailed) {
        const partialSuccess = statsData || recent.length > 0;
        toast.error(
          partialSuccess
            ? 'Some dashboard data could not be loaded. Showing partial results.'
            : 'Failed to load dashboard data. Please try again.'
        );
      }

      const activeFromList = countActiveBookings(recent);
      if (statsData && (statsData.activeBookings ?? 0) === 0 && activeFromList > 0) {
        statsData = { ...statsData, activeBookings: activeFromList };
      }

      setStats(statsData);
      setRecentBookings(recent);
      setUpcomingBookings(upcoming);
      setLoyaltyPoints(loyalty);
      setCurrentStreak(streak);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchRecentConversations();
  }, [fetchDashboardData, fetchRecentConversations]);

  useEffect(() => {
    trackedBookingIdsRef.current = new Set([
      ...recentBookings.map((b) => b._id),
      ...upcomingBookings.map((b) => b._id),
    ]);
  }, [recentBookings, upcomingBookings]);

  // Socket event listeners for real-time updates
  useSocketEvent('booking:status_changed', (data) => {
    console.log('[CustomerDashboard] Booking status changed:', data);
    fetchDashboardData();

    const bookingId = data.bookingId || data._id;
    if (bookingId && !trackedBookingIdsRef.current.has(String(bookingId))) return;

    const toastKey = `${data.bookingNumber || bookingId}:${data.status}`;
    const now = Date.now();
    if (
      lastStatusToastRef.current?.key === toastKey &&
      now - lastStatusToastRef.current.at < STATUS_TOAST_DEBOUNCE_MS
    ) {
      return;
    }

    lastStatusToastRef.current = { at: now, key: toastKey };
    toast.success(`Booking ${data.bookingNumber || ''} status updated to ${data.status}`.trim());
  });

  useSocketEvent('notification:new', (data) => {
    console.log('[CustomerDashboard] New notification:', data);
    // Show toast for new notifications - strip HTML to prevent XSS
    const sanitizedMessage = (data.message || 'You have a new notification')
      .replace(/<[^>]*>/g, '')
      .trim();
    toast(sanitizedMessage, {
      icon: '🔔',
      duration: 4000,
    });
  });

  const activeBookings = stats?.activeBookings ?? countActiveBookings(recentBookings);
  const hasReviewableBooking = recentBookings.some((b) => b.canReview);

  const handleWriteReviewClick = () => {
    const firstReviewable = recentBookings.find((b) => b.canReview)?._id;
    if (firstReviewable) {
      setWriteReviewBookingId(firstReviewable);
    } else {
      setWriteReviewBookingId(undefined);
    }
    setShowWriteReviewModal(true);
  };

  const handlePendingReviewStatClick = () => {
    const pending = stats?.pendingReviews ?? 0;
    if (pending > 0) {
      handleWriteReviewClick();
    } else {
      navigate('/customer/book-services');
    }
  };

  // Navigation cards configuration
  const navCards = [
    {
      title: 'View Packages',
      description: 'Explore curated service bundles',
      icon: Package,
      onClick: () => navigate('/packages'),
      color: 'bg-gradient-to-br from-purple-500 to-purple-600',
    },
    {
      title: 'Find Professionals',
      description: 'Browse verified service providers',
      icon: Users,
      onClick: () => setShowViewProModal(true),
      color: 'bg-gradient-to-br from-blue-500 to-blue-600',
    },
    {
      title: 'Write Review',
      description: hasReviewableBooking
        ? 'Share your experience'
        : 'Available after a completed booking',
      icon: Star,
      onClick: handleWriteReviewClick,
      color: 'bg-gradient-to-br from-amber-500 to-orange-500',
    },
    {
      title: 'Book Service',
      description: 'Quick booking for any service',
      icon: Plus,
      href: '/customer/book-services',
      color: 'bg-gradient-to-br from-nilin-coral to-nilin-rose',
    },
    {
      title: 'My Bookings',
      description: 'View & manage appointments',
      icon: Calendar,
      href: '/customer/bookings',
      color: 'bg-gradient-to-br from-teal-500 to-teal-600',
    },
  ];

  // Quick actions configuration
  const quickActions = [
    { icon: Search, label: 'Browse Services', onClick: () => navigate('/customer/book-services') },
    { icon: Bell, label: 'Notifications', onClick: () => navigate('/customer/notifications') },
    { icon: MessageCircle, label: 'Messages', onClick: () => navigate('/customer/messages') },
    { icon: Settings, label: 'Profile', onClick: () => navigate('/customer/profile') },
    { icon: CreditCard, label: 'Wallet', onClick: () => navigate('/customer/wallet') },
  ];

  // Handle logout
  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Handle booking click
  const handleViewBooking = (bookingId: string) => {
    navigate(`/customer/bookings/${bookingId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-nilin-blush/30 via-nilin-cream to-nilin-cream flex flex-col">
      <NavigationHeader />

      <main className="flex-1 w-full">
        {/* Hero welcome strip — overflow visible so profile dropdown isn't clipped */}
        <div className="relative bg-gradient-to-r from-[#2a2826] via-nilin-charcoal to-[#252321] border-b border-white/5">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-16 right-0 w-72 h-72 rounded-full bg-nilin-coral/25 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 w-48 h-48 rounded-full bg-nilin-rose/20 blur-3xl" />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-nilin-coral mb-2 font-semibold">
                  Your account
                </p>
                <h1 className="text-2xl md:text-4xl font-serif font-light leading-tight text-white">
                  Welcome back,{' '}
                  <span className="font-medium text-nilin-coral">{getDisplayName(user)}</span>{' '}
                  <Sparkles className="inline w-6 h-6 text-amber-400 align-[-3px]" aria-hidden />
                </h1>
                <p className="text-base text-white/80 mt-2 max-w-xl leading-relaxed">
                  Track bookings, book new services, and manage your wallet — all in one place.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 relative z-50">
                <button
                  type="button"
                  onClick={() => navigate('/customer/book-services')}
                  className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-nilin-coral to-nilin-rose text-white text-sm font-semibold shadow-sm hover:shadow-md transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Book a service
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center gap-3 bg-white/10 hover:bg-white/15 backdrop-blur-sm rounded-2xl pl-1.5 pr-3 py-1.5 border border-white/15 transition-colors"
                    aria-expanded={showProfileDropdown}
                    aria-haspopup="menu"
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center ring-2 ring-white/20">
                      {user?.avatar ? (
                        <img src={user.avatar} alt="" className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        <span className="text-white font-semibold text-sm">
                          {(getFullDisplayName(user).charAt(0) || 'U').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="hidden sm:block text-left min-w-0">
                      <div className="font-medium text-white text-sm truncate max-w-[160px]">{getFullDisplayName(user)}</div>
                      <div className="text-xs text-white/75 capitalize">{user?.role || 'Customer'}</div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-white/70 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showProfileDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowProfileDropdown(false)}
                        aria-hidden
                      />
                      <div
                        role="menu"
                        className="absolute right-0 top-[calc(100%+8px)] w-64 bg-white rounded-2xl shadow-2xl ring-1 ring-black/10 z-50 overflow-hidden"
                      >
                        <div className="p-4 border-b border-nilin-border/30 bg-nilin-muted/30">
                          <div className="font-medium text-nilin-charcoal truncate">{getFullDisplayName(user)}</div>
                          <div className="text-sm text-nilin-warmGray truncate">{user?.email}</div>
                        </div>
                        <div className="py-1.5">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => { navigate('/customer/profile'); setShowProfileDropdown(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                          >
                            <User className="w-4 h-4 text-nilin-warmGray" />
                            My Profile
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => { navigate('/customer/bookings'); setShowProfileDropdown(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                          >
                            <Calendar className="w-4 h-4 text-nilin-warmGray" />
                            My Bookings
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => { navigate('/customer/wallet'); setShowProfileDropdown(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-nilin-charcoal hover:bg-nilin-muted transition-colors"
                          >
                            <CreditCard className="w-4 h-4 text-nilin-warmGray" />
                            Wallet
                          </button>
                        </div>
                        <div className="border-t border-nilin-border/30 py-1.5">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <CustomerHubNav />

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-red-50/80 border border-red-200/80 rounded-2xl text-red-700 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-600 font-bold">!</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">Couldn&apos;t load dashboard</div>
                <div className="text-xs text-red-600/80 mt-0.5">{error}</div>
              </div>
              <button
                type="button"
                onClick={fetchDashboardData}
                className="flex-shrink-0 px-4 py-2 bg-red-600 text-white text-sm rounded-xl hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Mobile primary CTA */}
          <button
            type="button"
            onClick={() => navigate('/customer/book-services')}
            className="sm:hidden w-full mb-6 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-nilin-coral to-nilin-rose text-white text-sm font-semibold shadow-md"
          >
            <Plus className="w-4 h-4" />
            Book a service
          </button>

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
            {isLoading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <StatCard
                  title="Active Bookings"
                  value={activeBookings}
                  icon={Clock}
                  color="bg-gradient-to-br from-amber-500 to-orange-500"
                  subtitle="Pending, confirmed & in progress"
                  onClick={() => navigate('/customer/bookings?status=active')}
                />
                <StatCard
                  title="Completed"
                  value={stats?.completedBookings || 0}
                  icon={CheckCircle}
                  color="bg-gradient-to-br from-green-500 to-emerald-500"
                  subtitle="Total completed bookings"
                  onClick={() => navigate('/customer/bookings?status=completed')}
                />
                <StatCard
                  title="Pending Review"
                  value={stats?.pendingReviews ?? 0}
                  icon={Star}
                  color="bg-gradient-to-br from-amber-500 to-orange-500"
                  subtitle="Completed bookings awaiting your review"
                  onClick={handlePendingReviewStatClick}
                />
                <StatCard
                  title="Reviews Written"
                  value={stats?.reviewsWritten ?? 0}
                  icon={Star}
                  color="bg-gradient-to-br from-purple-500 to-pink-500"
                  subtitle={
                    stats?.averageRating
                      ? `Avg. rating given: ${stats.averageRating.toFixed(1)}`
                      : 'Reviews you have submitted'
                  }
                  onClick={() => navigate('/customer/reviews')}
                />
              </>
            )}
          </div>

          {/* Navigation Cards */}
          <div className="mb-6 md:mb-8">
            <div className="flex items-end justify-between mb-3 md:mb-4">
              <div>
                <h2 className="text-lg md:text-xl font-serif text-nilin-charcoal">Get started</h2>
                <p className="text-xs text-nilin-warmGray mt-0.5">Shortcuts to common tasks</p>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
              {navCards.map((card) => (
                <div key={card.title} className="min-w-[240px] sm:min-w-[260px] lg:min-w-0 snap-start flex-shrink-0 lg:flex-shrink">
                  <NavCard {...card} />
                </div>
              ))}
            </div>
          </div>

          <DashboardUpcomingSection
            bookings={upcomingBookings}
            loading={isLoading}
            onViewBooking={handleViewBooking}
            onViewAll={() => navigate('/customer/bookings?status=active')}
          />

          {(activeBookings > 0 || (stats?.inProgressBookings ?? 0) > 0) && (
            <div className="mb-6 md:mb-8">
              <OngoingBookings limit={3} showViewAll />
            </div>
          )}

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Recent Bookings Table */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div>
                  <h2 className="text-lg md:text-xl font-serif text-nilin-charcoal">Recent Bookings</h2>
                  {!isLoading && recentBookings.length > 0 && (
                    <p className="text-xs text-nilin-warmGray mt-0.5">{recentBookings.length} most recent</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/customer/bookings')}
                  className="text-sm font-medium text-nilin-coral hover:text-nilin-rose flex items-center gap-1 transition-colors px-3 py-1.5 rounded-lg hover:bg-nilin-coral/5"
                >
                  View all <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-2xl overflow-hidden border border-nilin-border/40 bg-white shadow-sm">
                {isLoading ? (
                  <>
                    <div className="md:hidden divide-y divide-nilin-border/30">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 animate-pulse space-y-2">
                          <div className="h-4 w-3/4 bg-nilin-border/30 rounded" />
                          <div className="h-3 w-1/2 bg-nilin-border/20 rounded" />
                        </div>
                      ))}
                    </div>
                    <table className="w-full hidden md:table">
                      <tbody>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <BookingRowSkeleton key={i} />
                        ))}
                      </tbody>
                    </table>
                  </>
                ) : recentBookings.length > 0 ? (
                  <>
                    <div className="md:hidden divide-y divide-nilin-border/30">
                      {recentBookings.map((booking) => (
                        <BookingMobileCard
                          key={booking._id}
                          booking={booking}
                          onView={handleViewBooking}
                          onWriteReview={(bookingId) => {
                            setWriteReviewBookingId(bookingId);
                            setShowWriteReviewModal(true);
                          }}
                        />
                      ))}
                    </div>
                    <div className="overflow-x-auto hidden md:block">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-nilin-border/30 bg-nilin-muted/40">
                          <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-nilin-warmGray uppercase tracking-wider">Booking</th>
                          <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-nilin-warmGray uppercase tracking-wider">Service</th>
                          <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-nilin-warmGray uppercase tracking-wider">Date & Time</th>
                          <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-nilin-warmGray uppercase tracking-wider">Provider</th>
                          <th className="py-3.5 px-5 text-left text-[11px] font-semibold text-nilin-warmGray uppercase tracking-wider">Status</th>
                          <th className="py-3.5 px-5 text-right text-[11px] font-semibold text-nilin-warmGray uppercase tracking-wider">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBookings.map((booking) => (
                          <BookingRow
                            key={booking._id}
                            booking={booking}
                            onView={handleViewBooking}
                            onWriteReview={(bookingId) => {
                              setWriteReviewBookingId(bookingId);
                              setShowWriteReviewModal(true);
                            }}
                          />
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </>
                ) : (
                  <div className="p-10 md:p-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-nilin-coral/10 flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-7 h-7 text-nilin-coral" />
                    </div>
                    <h3 className="text-base font-semibold text-nilin-charcoal mb-1.5">No bookings yet</h3>
                    <p className="text-sm text-nilin-warmGray mb-5 max-w-xs mx-auto">Book your first service to see your appointments here.</p>
                    <button
                      type="button"
                      onClick={() => navigate('/customer/book-services')}
                      className="px-5 py-2.5 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-all"
                    >
                      Browse Services
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-4 lg:space-y-5">
              {/* Messages Preview Section */}
              <div className="rounded-2xl border border-nilin-border/40 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-white" />
                    </div>
                    <h3 className="font-semibold text-nilin-charcoal text-sm">Messages</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/customer/messages')}
                    className="text-xs font-medium text-nilin-coral hover:text-nilin-rose flex items-center gap-1 transition-colors"
                  >
                    View all
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {isLoadingMessages ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-nilin-border/30" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-4 w-24 bg-nilin-border/30 rounded" />
                          <div className="h-3 w-32 bg-nilin-border/20 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentConversations.length > 0 ? (
                  <div className="space-y-1">
                    {recentConversations.slice(0, 3).map((room) => {
                      const otherParticipant = room.participants?.find(
                        (p) => p.userId?._id !== user?._id && p.userId?._id !== user?.id
                      );
                      const participantName =
                        room.type === 'support'
                          ? 'Support'
                          : otherParticipant
                            ? `${otherParticipant.userId?.firstName || ''} ${otherParticipant.userId?.lastName || ''}`.trim() || 'Unknown'
                            : room.name || 'Chat';
                      const lastMessage = room.lastMessage;
                      const messagePreview =
                        lastMessage?.type === 'image'
                          ? '[Image]'
                          : lastMessage?.type === 'file'
                            ? '[File]'
                            : lastMessage?.type === 'system'
                              ? 'Support conversation'
                              : lastMessage?.content;
                      const hasUnread = (room.unreadCount || 0) > 0;

                      return (
                        <button
                          key={room._id}
                          type="button"
                          onClick={() => navigate('/customer/messages', { state: { roomId: room._id } })}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left group ${
                            hasUnread
                              ? 'bg-nilin-coral/5 hover:bg-nilin-coral/10'
                              : 'hover:bg-nilin-muted/50'
                          }`}
                        >
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nilin-blush to-nilin-peach flex items-center justify-center text-nilin-coral font-semibold text-sm shadow-sm">
                              {otherParticipant?.userId?.avatar ? (
                                <img
                                  src={otherParticipant.userId.avatar}
                                  alt={participantName}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                (participantName.charAt(0) || 'U').toUpperCase()
                              )}
                            </div>
                            {hasUnread && (
                              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-nilin-coral text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {room.unreadCount && room.unreadCount > 9 ? '9+' : room.unreadCount}
                              </span>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-sm font-medium truncate ${hasUnread ? 'text-nilin-charcoal' : 'text-nilin-warmGray'}`}>
                                {participantName}
                              </span>
                              {room.updatedAt && (
                                <span className="text-[10px] text-nilin-warmGray/70 flex-shrink-0">
                                  {formatRelativeTime(new Date(room.updatedAt))}
                                </span>
                              )}
                            </div>
                            {messagePreview && (
                              <p className={`text-xs truncate mt-0.5 ${
                                hasUnread ? 'text-nilin-charcoal font-medium' : 'text-nilin-warmGray/70'
                              }`}>
                                {messagePreview}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-nilin-muted/50 flex items-center justify-center mx-auto mb-3">
                      <MessageCircle className="w-6 h-6 text-nilin-warmGray/50" />
                    </div>
                    <p className="text-sm text-nilin-warmGray">No messages yet</p>
                    <button
                      type="button"
                      onClick={() => navigate('/customer/messages/new')}
                      className="mt-3 text-xs font-medium text-nilin-coral hover:text-nilin-rose transition-colors"
                    >
                      Start a conversation
                    </button>
                  </div>
                )}
              </div>

              {/* Account snapshot — replaces duplicate profile card */}
              <div className="rounded-2xl border border-nilin-border/40 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-nilin-charcoal mb-4 text-sm uppercase tracking-wide">Account snapshot</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-nilin-muted/50 p-3.5 text-center border border-nilin-border/20">
                    <div className="text-xl font-bold text-nilin-charcoal">{stats?.totalBookings || 0}</div>
                    <div className="text-[11px] text-nilin-warmGray mt-0.5">Total bookings</div>
                  </div>
                  <div className="rounded-xl bg-nilin-muted/50 p-3.5 text-center border border-nilin-border/20">
                    <div className="text-xl font-bold text-nilin-charcoal">{stats?.cancelledBookings || 0}</div>
                    <div className="text-[11px] text-nilin-warmGray mt-0.5">Cancelled</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/customer/wallet')}
                    className="rounded-xl bg-amber-50/80 p-3.5 text-center border border-amber-200/50 hover:bg-amber-50 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1 text-xl font-bold text-nilin-charcoal">
                      <Award className="w-4 h-4 text-amber-600" />
                      {loyaltyPoints?.points ?? 0}
                    </div>
                    <div className="text-[11px] text-nilin-warmGray mt-0.5 capitalize">
                      {(loyaltyPoints?.tier || 'bronze')} tier
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/customer/wallet')}
                    className="rounded-xl bg-orange-50/80 p-3.5 text-center border border-orange-200/50 hover:bg-orange-50 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1 text-xl font-bold text-nilin-charcoal">
                      <Flame className="w-4 h-4 text-orange-500" />
                      {currentStreak?.currentStreak ?? 0}
                    </div>
                    <div className="text-[11px] text-nilin-warmGray mt-0.5">
                      Day streak
                      {(currentStreak?.longestStreak ?? 0) > 0 && (
                        <span className="block text-[10px] text-nilin-warmGray/70">
                          Best: {currentStreak?.longestStreak}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/customer/profile')}
                  className="w-full mt-4 py-2.5 text-sm border border-nilin-border/60 text-nilin-charcoal rounded-xl font-medium hover:bg-nilin-muted/60 transition-colors"
                >
                  Edit profile
                </button>
              </div>

              {/* Shortcuts */}
              <div className="rounded-2xl border border-nilin-border/40 bg-white p-5 shadow-sm">
                <h3 className="font-semibold text-nilin-charcoal mb-3 text-sm uppercase tracking-wide">Shortcuts</h3>
                <div className="space-y-1">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-nilin-muted/70 transition-colors text-left group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-nilin-coral/10 flex items-center justify-center group-hover:bg-nilin-coral/15 transition-colors">
                        <action.icon className="w-4 h-4 text-nilin-coral" />
                      </div>
                      <span className="text-sm text-nilin-charcoal font-medium flex-1">{action.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-nilin-warmGray/50 group-hover:text-nilin-coral group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Help Card */}
              <div className="rounded-2xl border border-nilin-coral/20 bg-gradient-to-br from-nilin-coral/8 to-nilin-rose/5 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nilin-coral to-nilin-rose flex items-center justify-center shadow-sm">
                    <Bell className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-nilin-charcoal text-sm">Need help?</div>
                    <div className="text-xs text-nilin-warmGray">Support is available 24/7</div>
                  </div>
                </div>
                <p className="text-xs text-nilin-warmGray mb-4 leading-relaxed">
                  Questions about bookings, payments, or your account? Our team is ready to assist.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/customer/support')}
                  className="w-full py-2.5 bg-nilin-charcoal text-white text-sm rounded-xl font-medium hover:bg-nilin-charcoal/90 transition-colors"
                >
                  Contact support
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* View Pro Modal */}
      <ViewProModal
        open={showViewProModal}
        onOpenChange={setShowViewProModal}
        limit={12}
      />

      {/* Write Review Modal */}
      <WriteReviewModal
        open={showWriteReviewModal}
        onOpenChange={(open) => {
          setShowWriteReviewModal(open);
          if (!open) setWriteReviewBookingId(undefined);
        }}
        preSelectedBookingId={writeReviewBookingId}
        onReviewSubmitted={() => {
          fetchDashboardData();
        }}
      />

      <Footer />
    </div>
  );
};

export default CustomerDashboard;
