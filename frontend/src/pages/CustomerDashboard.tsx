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
  TrendingUp,
  CreditCard,
  MessageCircle,
  MessageSquare,
  Flame,
  Award,
  Gift,
  Sparkles,
  Scissors,
  Palette,
  Sparkle,
  Leaf,
  Heart,
  Hand,
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
// STATUS CONFIGURATION - Seed Design System
// ============================================

const statusConfig: Record<BookingStatus, { color: string; bgColor: string; label: string }> = {
  pending: { color: 'text-[#1c3a13]', bgColor: 'bg-[#d3fa99]/30', label: 'Pending' },
  confirmed: { color: 'text-[#1c3a13]', bgColor: 'bg-[#eeeee9]', label: 'Confirmed' },
  in_progress: { color: 'text-[#1c3a13]', bgColor: 'bg-[#c4c7c4]/30', label: 'In Progress' },
  completed: { color: 'text-[#1c3a13]', bgColor: 'bg-[#d3fa99]/30', label: 'Completed' },
  cancelled: { color: 'text-[#1c3a13]', bgColor: 'bg-[#eeeee9]', label: 'Cancelled' },
  no_show: { color: 'text-[#1c3a13]', bgColor: 'bg-[#eeeee9]', label: 'No Show' },
  refunded: { color: 'text-[#1c3a13]', bgColor: 'bg-[#eeeee9]', label: 'Refunded' },
  rejected: { color: 'text-[#1c3a13]', bgColor: 'bg-[#eeeee9]', label: 'Rejected' },
};

// ============================================
// SKELETON COMPONENTS - Seed Design
// ============================================

const StatCardSkeleton = () => (
  <div className="rounded-2xl border border-[#1c3a13]/10 bg-[#fcfcf7] p-5 animate-pulse">
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 space-y-2">
        <div className="h-3 w-20 bg-[#eeeee9] rounded" />
        <div className="h-8 w-14 bg-[#eeeee9] rounded" />
        <div className="h-2 w-28 bg-[#eeeee9] rounded" />
      </div>
      <div className="w-10 h-10 rounded-full bg-[#d3fa99]/30 flex-shrink-0" />
    </div>
  </div>
);

const BookingRowSkeleton = () => (
  <tr className="border-b border-[#1c3a13]/5">
    <td className="py-4 px-4"><div className="h-4 w-20 bg-[#eeeee9] rounded" /></td>
    <td className="py-4 px-4"><div className="h-4 w-32 bg-[#eeeee9] rounded" /></td>
    <td className="py-4 px-4"><div className="h-4 w-24 bg-[#eeeee9] rounded" /></td>
    <td className="py-4 px-4"><div className="h-4 w-16 bg-[#eeeee9] rounded" /></td>
    <td className="py-4 px-4"><div className="h-6 w-20 bg-[#eeeee9] rounded-full" /></td>
    <td className="py-4 px-4"><div className="h-8 w-16 bg-[#eeeee9] rounded" /></td>
  </tr>
);

// ============================================
// STAT CARD COMPONENT - Seed Design
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
    className={`relative overflow-hidden rounded-2xl border border-[#1c3a13]/10 bg-[#fcfcf7] p-5 transition-all duration-300 group ${onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-[#1c3a13]/30' : ''}`}
  >
    {/* Lime Sprout accent dot */}
    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#d3fa99]" />

    <div className="relative flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#6b6b6b] mb-2">{title}</p>
        <div className="text-3xl font-light text-[#1c3a13] tracking-tight">{value}</div>
        {subtitle && <p className="text-[11px] text-[#6b6b6b]/80 mt-2 line-clamp-2">{subtitle}</p>}
      </div>
      <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
        <Icon className="w-5 h-5 text-[#1c3a13]" />
      </div>
    </div>
    {trend && (
      <div className={`relative mt-3 flex items-center gap-1 text-[11px] font-medium ${trend.positive ? 'text-[#1c3a13]' : 'text-[#b3b3b3]'}`}>
        <TrendingUp className={`w-3 h-3 ${!trend.positive && 'rotate-180'}`} />
        {Math.abs(trend.value)}%
      </div>
    )}
  </div>
);

// ============================================
// NAVIGATION CARD COMPONENT - Seed Design
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
      className="text-left w-full flex items-center gap-3.5 rounded-2xl border border-[#1c3a13]/10 bg-[#fcfcf7] p-4 hover:border-[#1c3a13]/30 transition-all duration-300 group hover:-translate-y-0.5 min-h-[88px]"
    >
      <div className={`w-10 h-10 rounded-full ${color} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
        <Icon className="w-5 h-5 text-[#fcfcf7]" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-[#1c3a13] text-sm leading-tight">{title}</h3>
        <p className="text-xs text-[#6b6b6b] mt-0.5 line-clamp-2">{description}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-[#1c3a13]/40 flex-shrink-0 group-hover:text-[#1c3a13] group-hover:translate-x-0.5 transition-all" />
    </button>
  );
};

// ============================================
// MOBILE BOOKING CARD - Seed Design
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
      className="w-full text-left p-4 border-b border-[#1c3a13]/5 last:border-0 hover:bg-[#eeeee9]/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0">
          <p className="font-medium text-[#1c3a13] text-[15px]">{booking.serviceName}</p>
          <p className="text-xs text-[#6b6b6b] mt-0.5">
            #{booking.bookingNumber?.slice(-6) || 'N/A'} · {formattedDate} · {booking.scheduledTime}
          </p>
        </div>
        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${status.bgColor} ${status.color}`}>
          {status.label}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#d3fa99]/30 flex items-center justify-center flex-shrink-0">
            {booking.providerAvatar ? (
              <img src={booking.providerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-3.5 h-3.5 text-[#1c3a13]" />
            )}
          </div>
          <span className="text-sm text-[#1c3a13] truncate">{booking.providerName}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {booking.canReview && onWriteReview && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onWriteReview(booking._id);
              }}
              className="px-2.5 py-1 text-xs font-medium bg-[#d3fa99] text-[#1c3a13] rounded-full hover:bg-[#d3fa99]/80"
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
// BOOKING ROW COMPONENT - Seed Design
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
      className="border-b border-[#1c3a13]/5 last:border-0 hover:bg-[#eeeee9]/50 transition-colors cursor-pointer"
      onClick={() => onView(booking._id)}
      onKeyDown={handleRowKeyDown}
      tabIndex={0}
      role="button"
    >
      <td className="py-4 px-5">
        <div className="font-mono text-sm font-medium text-[#1c3a13]">#{booking.bookingNumber?.slice(-6) || 'N/A'}</div>
      </td>
      <td className="py-4 px-5">
        <div className="font-medium text-[#1c3a13] text-[15px]">{booking.serviceName}</div>
        {booking.serviceCategory && (
          <div className="text-xs text-[#6b6b6b] mt-0.5">{booking.serviceCategory}</div>
        )}
      </td>
      <td className="py-4 px-5">
        <div className="text-sm font-medium text-[#1c3a13]">{formattedDate}</div>
        <div className="text-xs text-[#6b6b6b] mt-0.5">{booking.scheduledTime}</div>
      </td>
      <td className="py-4 px-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#d3fa99]/30 ring-2 ring-[#fcfcf7] flex items-center justify-center flex-shrink-0">
            {booking.providerAvatar ? (
              <img src={booking.providerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-[#1c3a13]" />
            )}
          </div>
          <span className="text-sm font-medium text-[#1c3a13]">{booking.providerName}</span>
        </div>
      </td>
      <td className="py-4 px-5">
        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
          {status.label}
        </span>
      </td>
      <td className="py-4 px-5">
        <div className="flex items-center justify-end gap-2">
          {booking.canReview && onWriteReview && (
            <button
              onClick={handleWriteReviewClick}
              className="px-3 py-1.5 text-xs font-medium bg-[#d3fa99] text-[#1c3a13] rounded-full hover:bg-[#d3fa99]/80 transition-colors flex items-center gap-1"
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
              <div className="text-xs text-[#6b6b6b] flex items-center justify-end gap-1 mt-0.5">
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

  // Navigation cards configuration - Seed Design
  const navCards = [
    {
      title: 'View Packages',
      description: 'Explore curated service bundles',
      icon: Package,
      onClick: () => navigate('/packages'),
      color: 'bg-[#1c3a13]',
    },
    {
      title: 'Find Professionals',
      description: 'Browse verified service providers',
      icon: Users,
      onClick: () => setShowViewProModal(true),
      color: 'bg-[#1c3a13]',
    },
    {
      title: 'Write Review',
      description: hasReviewableBooking
        ? 'Share your experience'
        : 'Available after a completed booking',
      icon: Star,
      onClick: handleWriteReviewClick,
      color: 'bg-[#1c3a13]',
    },
    {
      title: 'Book Service',
      description: 'Quick booking for any service',
      icon: Plus,
      href: '/customer/book-services',
      color: 'bg-[#1c3a13]',
    },
    {
      title: 'My Bookings',
      description: 'View & manage appointments',
      icon: Calendar,
      href: '/customer/bookings',
      color: 'bg-[#1c3a13]',
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
    <div className="min-h-screen bg-[#fcfcf7] flex flex-col">
      <NavigationHeader />

      <main className="flex-1 w-full">
        {/* Seed Hero Section - Forest Canopy dark header */}
        <div className="relative bg-[#1c3a13] border-b border-[#1c3a13]">
          {/* Subtle lime accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#d3fa99]" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-[0.192em] text-[#d3fa99] mb-2 font-medium">
                  Your account
                </p>
                <h1 className="text-2xl md:text-3xl font-light leading-tight text-[#fcfcf7] tracking-tight">
                  Welcome back,{' '}
                  <span className="font-medium text-[#d3fa99]">{getDisplayName(user)}</span>
                </h1>
                <p className="text-[15px] text-[#fcfcf7]/80 mt-2 max-w-xl leading-relaxed">
                  Track bookings, book new services, and manage your wallet — all in one place.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 relative z-50">
                {/* Pill-shaped Book CTA */}
                <button
                  type="button"
                  onClick={() => navigate('/customer/book-services')}
                  className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-[9999px] bg-[#d3fa99] text-[#1c3a13] text-[13px] font-medium tracking-tight hover:bg-[#d3fa99]/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Book a service
                </button>

                {/* Profile Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                    className="flex items-center gap-3 bg-[#1c3a13] hover:bg-[#1c3a13]/80 border border-[#fcfcf7]/20 rounded-[9999px] pl-1.5 pr-4 py-1.5 transition-colors"
                    aria-expanded={showProfileDropdown}
                    aria-haspopup="menu"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#d3fa99] flex items-center justify-center">
                      {user?.avatar ? (
                        <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-[#1c3a13] font-medium text-sm">
                          {(getFullDisplayName(user).charAt(0) || 'U').toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="hidden sm:block text-left min-w-0">
                      <div className="font-medium text-[#fcfcf7] text-[13px] truncate max-w-[160px]">{getFullDisplayName(user)}</div>
                      <div className="text-[11px] text-[#fcfcf7]/60 capitalize">{user?.role || 'Customer'}</div>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-[#fcfcf7]/70 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
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
                        className="absolute right-0 top-[calc(100%+8px)] w-64 bg-[#fcfcf7] rounded-2xl border border-[#1c3a13]/10 z-50 overflow-hidden"
                      >
                        <div className="p-4 border-b border-[#1c3a13]/10">
                          <div className="font-medium text-[#1c3a13] truncate">{getFullDisplayName(user)}</div>
                          <div className="text-[13px] text-[#6b6b6b] truncate">{user?.email}</div>
                        </div>
                        <div className="py-1.5">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => { navigate('/customer/profile'); setShowProfileDropdown(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14px] text-[#1c3a13] hover:bg-[#eeeee9] transition-colors"
                          >
                            <User className="w-4 h-4 text-[#6b6b6b]" />
                            My Profile
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => { navigate('/customer/bookings'); setShowProfileDropdown(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14px] text-[#1c3a13] hover:bg-[#eeeee9] transition-colors"
                          >
                            <Calendar className="w-4 h-4 text-[#6b6b6b]" />
                            My Bookings
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => { navigate('/customer/wallet'); setShowProfileDropdown(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14px] text-[#1c3a13] hover:bg-[#eeeee9] transition-colors"
                          >
                            <CreditCard className="w-4 h-4 text-[#6b6b6b]" />
                            Wallet
                          </button>
                        </div>
                        <div className="border-t border-[#1c3a13]/10 py-1.5">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[14px] text-[#1c3a13] hover:bg-[#eeeee9] transition-colors"
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

        {/* Service Category Menu - Seed Design */}
        <div className="bg-[#fcfcf7] border-b border-[#1c3a13]/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
              {[
                { icon: Scissors, label: 'Hair', color: 'bg-purple-500' },
                { icon: Palette, label: 'Makeup', color: 'bg-pink-500' },
                { icon: Sparkle, label: 'Nails', color: 'bg-rose-500' },
                { icon: Leaf, label: 'Skin & Aesthetics', color: 'bg-green-500' },
                { icon: Heart, label: 'Massage & Body', color: 'bg-teal-500' },
                { icon: Hand, label: 'Personal Care', color: 'bg-cyan-500' },
              ].map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => {
                    const slug = cat.label.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
                    navigate(`/category/${slug}`);
                  }}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full border border-[#1c3a13]/10 bg-white hover:bg-[#eeeee9] text-[#1c3a13] text-[13px] font-medium transition-colors"
                >
                  <cat.icon className="w-4 h-4" />
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          {/* Error State */}
          {error && (
            <div className="mb-6 p-4 bg-[#eeeee9] border border-[#1c3a13]/10 rounded-2xl text-[#1c3a13] flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#d3fa99] flex items-center justify-center flex-shrink-0">
                <span className="text-[#1c3a13] font-bold">!</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">Couldn&apos;t load dashboard</div>
                <div className="text-[13px] text-[#6b6b6b] mt-0.5">{error}</div>
              </div>
              <button
                type="button"
                onClick={fetchDashboardData}
                className="flex-shrink-0 px-4 py-2 bg-[#1c3a13] text-[#fcfcf7] text-sm rounded-[9999px] hover:bg-[#1c3a13]/90 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Mobile primary CTA - Pill button */}
          <button
            type="button"
            onClick={() => navigate('/customer/book-services')}
            className="sm:hidden w-full mb-6 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-[9999px] bg-[#1c3a13] text-[#fcfcf7] text-[13px] font-medium"
          >
            <Plus className="w-4 h-4" />
            Book a service
          </button>

          {/* Stats Row - Seed Design */}
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
                  color="bg-[#d3fa99]"
                  subtitle="Pending, confirmed & in progress"
                  onClick={() => navigate('/customer/bookings?status=active')}
                />
                <StatCard
                  title="Completed"
                  value={stats?.completedBookings || 0}
                  icon={CheckCircle}
                  color="bg-[#eeeee9]"
                  subtitle="Total completed bookings"
                  onClick={() => navigate('/customer/bookings?status=completed')}
                />
                <StatCard
                  title="Pending Review"
                  value={stats?.pendingReviews ?? 0}
                  icon={Star}
                  color="bg-[#d3fa99]"
                  subtitle="Completed bookings awaiting your review"
                  onClick={handlePendingReviewStatClick}
                />
                <StatCard
                  title="Reviews Written"
                  value={stats?.reviewsWritten ?? 0}
                  icon={Star}
                  color="bg-[#eeeee9]"
                  subtitle={
                    stats?.averageRating
                      ? `Avg. rating: ${stats.averageRating.toFixed(1)}`
                      : 'Reviews you have submitted'
                  }
                  onClick={() => navigate('/customer/reviews')}
                />
              </>
            )}
          </div>

          {/* Navigation Cards - Seed Design */}
          <div className="mb-6 md:mb-8">
            <div className="flex items-end justify-between mb-3 md:mb-4">
              <div>
                <h2 className="text-lg md:text-xl font-light text-[#1c3a13] tracking-tight">Get started</h2>
                <p className="text-[13px] text-[#6b6b6b] mt-0.5">Shortcuts to common tasks</p>
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

          {/* Special Offers Section */}
          <div className="mb-6 md:mb-8">
            <div className="flex items-end justify-between mb-3 md:mb-4">
              <div>
                <h2 className="text-lg md:text-xl font-light text-[#1c3a13] tracking-tight">Special Offers</h2>
                <p className="text-[13px] text-[#6b6b6b] mt-0.5">Exclusive deals for you</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* First Booking Discount */}
              <button
                type="button"
                onClick={() => navigate('/search')}
                className="flex items-center gap-4 p-5 rounded-2xl border border-[#1c3a13]/10 bg-[#d3fa99]/20 hover:bg-[#d3fa99]/30 transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-[#1c3a13] flex items-center justify-center flex-shrink-0">
                  <Gift className="w-6 h-6 text-[#d3fa99]" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="inline-block px-2 py-0.5 bg-[#d3fa99] text-[#1c3a13] text-[10px] font-medium rounded-full mb-1">
                    New User
                  </span>
                  <h3 className="font-medium text-[#1c3a13] text-[15px]">First Booking Discount</h3>
                  <p className="text-[12px] text-[#6b6b6b] mt-0.5">Get 20% off your first booking</p>
                </div>
                <ArrowRight className="w-5 h-5 text-[#1c3a13]/40 flex-shrink-0" />
              </button>

              {/* Refer a Friend */}
              <button
                type="button"
                onClick={() => navigate('/customer/referrals')}
                className="flex items-center gap-4 p-5 rounded-2xl border border-[#1c3a13]/10 bg-[#fcfcf7] hover:bg-[#eeeee9] transition-colors text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-[#1c3a13] flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-[#d3fa99]" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="inline-block px-2 py-0.5 bg-[#eeeee9] text-[#1c3a13] text-[10px] font-medium rounded-full mb-1">
                    Referral
                  </span>
                  <h3 className="font-medium text-[#1c3a13] text-[15px]">Refer a Friend</h3>
                  <p className="text-[12px] text-[#6b6b6b] mt-0.5">Earn 50 AED credit for each referral</p>
                </div>
                <ArrowRight className="w-5 h-5 text-[#1c3a13]/40 flex-shrink-0" />
              </button>
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
            {/* Recent Bookings Table - Seed Design */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3 md:mb-4">
                <div>
                  <h2 className="text-lg md:text-xl font-light text-[#1c3a13] tracking-tight">Recent Bookings</h2>
                  {!isLoading && recentBookings.length > 0 && (
                    <p className="text-[13px] text-[#6b6b6b] mt-0.5">{recentBookings.length} most recent</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/customer/bookings')}
                  className="text-[13px] font-medium text-[#1c3a13] flex items-center gap-1 transition-colors px-3 py-1.5 rounded-[9999px] hover:bg-[#eeeee9]"
                >
                  View all <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <div className="rounded-2xl overflow-hidden border border-[#1c3a13]/10 bg-[#fcfcf7]">
                {isLoading ? (
                  <>
                    <div className="md:hidden divide-y divide-[#1c3a13]/5">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="p-4 animate-pulse space-y-2">
                          <div className="h-4 w-3/4 bg-[#eeeee9] rounded" />
                          <div className="h-3 w-1/2 bg-[#eeeee9] rounded" />
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
                    <div className="md:hidden divide-y divide-[#1c3a13]/5">
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
                        <tr className="border-b border-[#1c3a13]/5 bg-[#eeeee9]/50">
                          <th className="py-3.5 px-5 text-left text-[11px] font-medium text-[#6b6b6b] uppercase tracking-[0.1em]">Booking</th>
                          <th className="py-3.5 px-5 text-left text-[11px] font-medium text-[#6b6b6b] uppercase tracking-[0.1em]">Service</th>
                          <th className="py-3.5 px-5 text-left text-[11px] font-medium text-[#6b6b6b] uppercase tracking-[0.1em]">Date & Time</th>
                          <th className="py-3.5 px-5 text-left text-[11px] font-medium text-[#6b6b6b] uppercase tracking-[0.1em]">Provider</th>
                          <th className="py-3.5 px-5 text-left text-[11px] font-medium text-[#6b6b6b] uppercase tracking-[0.1em]">Status</th>
                          <th className="py-3.5 px-5 text-right text-[11px] font-medium text-[#6b6b6b] uppercase tracking-[0.1em]">Amount</th>
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
                    <div className="w-14 h-14 rounded-2xl bg-[#d3fa99]/30 flex items-center justify-center mx-auto mb-4">
                      <Calendar className="w-7 h-7 text-[#1c3a13]" />
                    </div>
                    <h3 className="text-base font-medium text-[#1c3a13] mb-1.5">No bookings yet</h3>
                    <p className="text-[14px] text-[#6b6b6b] mb-5 max-w-xs mx-auto">Book your first service to see your appointments here.</p>
                    <button
                      type="button"
                      onClick={() => navigate('/customer/book-services')}
                      className="px-5 py-2.5 bg-[#1c3a13] text-[#fcfcf7] rounded-[9999px] text-[14px] font-medium hover:bg-[#1c3a13]/90 transition-colors"
                    >
                      Browse Services
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Seed Design */}
            <div className="space-y-4 lg:space-y-5">
              {/* Messages Preview Section */}
              <div className="rounded-2xl border border-[#1c3a13]/10 bg-[#fcfcf7] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#1c3a13] flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-[#fcfcf7]" />
                    </div>
                    <h3 className="font-medium text-[#1c3a13] text-[14px]">Messages</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/customer/messages')}
                    className="text-[11px] font-medium text-[#1c3a13] flex items-center gap-1 transition-colors px-3 py-1 rounded-[9999px] hover:bg-[#eeeee9]"
                  >
                    View all
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {isLoadingMessages ? (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-center gap-3 animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-[#eeeee9]" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-4 w-24 bg-[#eeeee9] rounded" />
                          <div className="h-3 w-32 bg-[#eeeee9] rounded" />
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
                              ? 'bg-[#d3fa99]/10 hover:bg-[#d3fa99]/20'
                              : 'hover:bg-[#eeeee9]/50'
                          }`}
                        >
                          {/* Avatar with lime accent */}
                          <div className="relative flex-shrink-0">
                            <div className="w-10 h-10 rounded-full bg-[#eeeee9] flex items-center justify-center text-[#1c3a13] font-medium text-sm">
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
                              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#1c3a13] text-[#fcfcf7] text-[10px] font-medium rounded-full flex items-center justify-center">
                                {room.unreadCount && room.unreadCount > 9 ? '9+' : room.unreadCount}
                              </span>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[13px] font-medium truncate ${hasUnread ? 'text-[#1c3a13]' : 'text-[#6b6b6b]'}`}>
                                {participantName}
                              </span>
                              {room.updatedAt && (
                                <span className="text-[10px] text-[#6b6b6b]/70 flex-shrink-0">
                                  {formatRelativeTime(new Date(room.updatedAt))}
                                </span>
                              )}
                            </div>
                            {messagePreview && (
                              <p className={`text-[11px] truncate mt-0.5 ${
                                hasUnread ? 'text-[#1c3a13] font-medium' : 'text-[#6b6b6b]/70'
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
                    <div className="w-12 h-12 rounded-full bg-[#eeeee9] flex items-center justify-center mx-auto mb-3">
                      <MessageCircle className="w-6 h-6 text-[#6b6b6b]/50" />
                    </div>
                    <p className="text-[14px] text-[#6b6b6b]">No messages yet</p>
                    <button
                      type="button"
                      onClick={() => navigate('/customer/messages/new')}
                      className="mt-3 text-[12px] font-medium text-[#1c3a13] transition-colors"
                    >
                      Start a conversation
                    </button>
                  </div>
                )}
              </div>

              {/* Account snapshot — Seed Design */}
              <div className="rounded-2xl border border-[#1c3a13]/10 bg-[#fcfcf7] p-5">
                <h3 className="font-medium text-[#1c3a13] mb-4 text-[12px] uppercase tracking-[0.1em]">Account snapshot</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-[#eeeee9] p-3.5 text-center border border-[#1c3a13]/5">
                    <div className="text-xl font-light text-[#1c3a13]">{stats?.totalBookings || 0}</div>
                    <div className="text-[11px] text-[#6b6b6b] mt-0.5">Total bookings</div>
                  </div>
                  <div className="rounded-xl bg-[#eeeee9] p-3.5 text-center border border-[#1c3a13]/5">
                    <div className="text-xl font-light text-[#1c3a13]">{stats?.cancelledBookings || 0}</div>
                    <div className="text-[11px] text-[#6b6b6b] mt-0.5">Cancelled</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/customer/wallet')}
                    className="rounded-xl bg-[#d3fa99]/30 p-3.5 text-center border border-[#d3fa99]/50 hover:bg-[#d3fa99]/50 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1 text-xl font-light text-[#1c3a13]">
                      <Award className="w-4 h-4 text-[#1c3a13]" />
                      {loyaltyPoints?.points ?? 0}
                    </div>
                    <div className="text-[11px] text-[#6b6b6b] mt-0.5 capitalize">
                      {(loyaltyPoints?.tier || 'bronze')} tier
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/customer/wallet')}
                    className="rounded-xl bg-[#eeeee9] p-3.5 text-center border border-[#1c3a13]/5 hover:bg-[#eeeee9]/80 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1 text-xl font-light text-[#1c3a13]">
                      <Flame className="w-4 h-4 text-[#1c3a13]" />
                      {currentStreak?.currentStreak ?? 0}
                    </div>
                    <div className="text-[11px] text-[#6b6b6b] mt-0.5">
                      Day streak
                      {(currentStreak?.longestStreak ?? 0) > 0 && (
                        <span className="block text-[10px] text-[#6b6b6b]/70">
                          Best: {currentStreak?.longestStreak}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/customer/profile')}
                  className="w-full mt-4 py-2.5 text-[13px] border border-[#1c3a13]/10 text-[#1c3a13] rounded-[9999px] font-medium hover:bg-[#eeeee9] transition-colors"
                >
                  Edit profile
                </button>
              </div>

              {/* Shortcuts - Seed Design */}
              <div className="rounded-2xl border border-[#1c3a13]/10 bg-[#fcfcf7] p-5">
                <h3 className="font-medium text-[#1c3a13] mb-3 text-[12px] uppercase tracking-[0.1em]">Shortcuts</h3>
                <div className="space-y-1">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#eeeee9] transition-colors text-left group"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#d3fa99]/30 flex items-center justify-center group-hover:bg-[#d3fa99]/50 transition-colors">
                        <action.icon className="w-4 h-4 text-[#1c3a13]" />
                      </div>
                      <span className="text-[13px] text-[#1c3a13] font-medium flex-1">{action.label}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#6b6b6b]/50 group-hover:text-[#1c3a13] group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Help Card - Lime Sprout accent */}
              <div className="rounded-2xl border border-[#1c3a13]/10 bg-[#d3fa99]/20 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#1c3a13] flex items-center justify-center">
                    <Bell className="w-5 h-5 text-[#fcfcf7]" />
                  </div>
                  <div>
                    <div className="font-medium text-[#1c3a13] text-[14px]">Need help?</div>
                    <div className="text-[11px] text-[#6b6b6b]">Support is available 24/7</div>
                  </div>
                </div>
                <p className="text-[12px] text-[#6b6b6b] mb-4 leading-relaxed">
                  Questions about bookings, payments, or your account? Our team is ready to assist.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/customer/support')}
                  className="w-full py-2.5 bg-[#1c3a13] text-[#fcfcf7] text-[13px] rounded-[9999px] font-medium hover:bg-[#1c3a13]/90 transition-colors"
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
