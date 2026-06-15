/**
 * Customer Dashboard — Seed layout/typography, NILIN palette
 * High-end visual design with organic animations, cohesive shadows,
 * accessible focus states, shimmer loading, and elegant empty states
 */
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
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
  CreditCard,
  MessageCircle,
  MessageSquare,
  Flame,
  Award,
  Heart,
  Gift,
  Inbox,
} from 'lucide-react';

import { cn } from '@/lib/utils';

// ============================================
// DESIGN TOKENS (for consistency)
// ============================================

const DESIGN = {
  // Organic animation stagger (simulates natural timing)
  stagger: {
    base: 0.06,
    variance: 0.02, // Random variance for organic feel
    min: 0.03,
  },
  // Shadow scale (cohesive depth system)
  shadows: {
    subtle: '0 1px 2px rgba(0,0,0,0.04)',
    sm: '0 2px 4px rgba(0,0,0,0.06)',
    md: '0 4px 12px rgba(0,0,0,0.08)',
    lg: '0 8px 24px rgba(0,0,0,0.1)',
    brand: '0 4px 16px rgba(var(--dash-brand-rgb, 99,102,241), 0.15)',
    brandHover: '0 8px 24px rgba(var(--dash-brand-rgb, 99,102,241), 0.2)',
  },
  // Timing curves (more natural easing)
  easing: {
    spring: [0.22, 1, 0.36, 1], // expo out - organic spring
    smooth: [0.4, 0, 0.2, 1], // ease-out-quad
    bounce: [0.34, 1.56, 0.64, 1], // spring with overshoot
  },
} as const;

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
import { chatApi, type ChatRoomListItem } from '../services/chatApi';
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

const ProfileAvatar: React.FC<{
  user: AuthUser | null;
  size?: 'sm' | 'lg';
  className?: string;
}> = ({ user, size = 'sm', className }) => (
  <div
    className={cn(
      'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--dash-cta)] font-medium text-[var(--dash-cta-text)]',
      size === 'sm' ? 'h-9 w-9 text-sm' : 'h-11 w-11 border-[3px] border-[var(--dash-surface)] text-base shadow-[0_4px_12px_rgba(45,45,45,0.12)]',
      className
    )}
  >
    {user?.avatar ? (
      <img src={user.avatar} alt="" className="h-full w-full rounded-full object-cover" />
    ) : (
      <span className="uppercase">{(getFullDisplayName(user).charAt(0) || 'U')}</span>
    )}
  </div>
);

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
// ANIMATED COUNTER COMPONENT (Framer Motion spring)
// ============================================

interface AnimatedCounterProps {
  value: number;
  className?: string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  className = '',
}) => {
  return (
    <motion.span
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
    >
      <motion.span
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 15 }}
      >
        {value.toLocaleString()}
      </motion.span>
    </motion.span>
  );
};

// ============================================
// STATUS CONFIGURATION
// ============================================

const statusConfig: Record<BookingStatus, { color: string; bgColor: string; label: string }> = {
  pending: { color: 'text-[var(--dash-text)]', bgColor: 'bg-[var(--dash-accent-wash)]', label: 'Pending' },
  confirmed: { color: 'text-[var(--dash-text)]', bgColor: 'bg-[var(--dash-surface-raised)]', label: 'Confirmed' },
  in_progress: { color: 'text-[var(--dash-text)]', bgColor: 'bg-[var(--dash-accent-highlight)]', label: 'In Progress' },
  completed: { color: 'text-[var(--dash-text)]', bgColor: 'bg-[var(--nilin-success)]/15', label: 'Completed' },
  cancelled: { color: 'text-[var(--dash-text-muted)]', bgColor: 'bg-[var(--dash-surface-raised)]', label: 'Cancelled' },
  no_show: { color: 'text-[var(--dash-text-muted)]', bgColor: 'bg-[var(--dash-surface-raised)]', label: 'No Show' },
  refunded: { color: 'text-[var(--dash-text-muted)]', bgColor: 'bg-[var(--dash-surface-raised)]', label: 'Refunded' },
  rejected: { color: 'text-[var(--dash-text-muted)]', bgColor: 'bg-[var(--nilin-error)]/15', label: 'Rejected' },
};

// ============================================
// SHIMMER SKELETON (replaces pulse)
// ============================================

const ShimmerSkeleton: React.FC<{ className?: string; delay?: number }> = ({
  className = '',
  delay = 0,
}) => (
  <div
    className={cn('relative overflow-hidden rounded', className)}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div
      className="absolute inset-0 -translate-x-full animate-shimmer"
      style={{
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
        animationDuration: '1.5s',
        animationDelay: `${delay}ms`,
      }}
    />
    <div className="w-full h-full bg-[var(--dash-surface-raised)] rounded" />
  </div>
);

const BentoStatSkeleton = () => (
  <div className="dash-stat-card">
    <ShimmerSkeleton className="dash-stat-icon mb-3" />
    <ShimmerSkeleton className="h-4 w-20 mb-3" delay={50} />
    <ShimmerSkeleton className="h-9 w-16 mb-2" delay={100} />
    <ShimmerSkeleton className="h-3 w-28" delay={150} />
  </div>
);

// Organic stagger delay calculator
const getStaggerDelay = (index: number, baseVariance = 0.03): number => {
  const baseDelay = index * DESIGN.stagger.base;
  // Add small random variance based on position
  const variance = Math.sin(index * 1.7) * DESIGN.stagger.variance;
  return Math.max(DESIGN.stagger.min, baseDelay + variance);
};

// ============================================
// HNST STAT CARD - Cohesive shadows, organic animation
// ============================================

interface BentoStatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  onClick?: () => void;
  delay?: number;
  isLoading?: boolean;
}

const BentoStatCard: React.FC<BentoStatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  onClick,
  delay = 0,
  isLoading = false,
}) => {
  return (
    <motion.button
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={onClick ? {
        y: -2,
        boxShadow: DESIGN.shadows.brandHover,
        transition: { duration: 0.25, ease: DESIGN.easing.spring }
      } : undefined}
      whileTap={onClick ? { scale: 0.97, y: 0 } : undefined}
      transition={{
        duration: 0.4,
        delay: getStaggerDelay(delay),
        ease: DESIGN.easing.spring,
      }}
      onClick={onClick}
      className={cn(
        'dash-stat-card w-full relative overflow-hidden group',
        'shadow-[var(--dash-surface-raised)] shadow-sm',
        'hover:shadow-md hover:border-[var(--dash-brand)]/30',
        onClick && 'cursor-pointer',
        // Accessible focus state
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dash-surface)]'
      )}
      tabIndex={onClick ? 0 : -1}
    >
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--dash-brand)]/0 via-[var(--dash-brand)]/5 to-[var(--dash-brand)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative">
        <motion.div
          className="dash-stat-icon group-hover:scale-110 transition-transform duration-300"
          whileHover={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.4, ease: DESIGN.easing.spring }}
        >
          <Icon className="w-5 h-5" />
        </motion.div>
        <p className="dash-stat-label group-hover:text-[var(--dash-brand-deep)] transition-colors">{title}</p>
        {isLoading ? (
          <ShimmerSkeleton className="h-9 w-16 mb-2" delay={delay * 50} />
        ) : (
          <div className="dash-stat-value">
            {typeof value === 'number' ? <AnimatedCounter value={value} /> : value}
          </div>
        )}
        {subtitle && <p className="dash-stat-meta">{subtitle}</p>}
      </div>
    </motion.button>
  );
};

// ============================================
// NAVIGATION CARD with Spotlight Effect
// Organic animations, cohesive shadows, accessible focus
// ============================================

interface NavCardSpotlightProps {
  title: string;
  description: string;
  icon: React.ElementType;
  href?: string;
  onClick?: () => void;
  delay?: number;
}

const NavCardSpotlight: React.FC<NavCardSpotlightProps> = ({
  title,
  description,
  icon: Icon,
  href,
  onClick,
  delay = 0,
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      navigate(href);
    }
  };

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: getStaggerDelay(delay),
        ease: DESIGN.easing.spring,
      }}
    >
      <div className="dash-nav-card dash-nav-card--stacked group relative overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 h-full">
        {/* Hover gradient shine effect */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        <button
          type="button"
          onClick={handleClick}
          title={`${title} — ${description}`}
          className={cn(
            'w-full h-full text-left flex flex-col gap-3 relative',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dash-surface)]'
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <motion.div
              className="dash-nav-icon dash-nav-icon--compact group-hover:bg-[var(--dash-brand)] transition-colors duration-300"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              <Icon className="w-[18px] h-[18px] group-hover:text-[var(--dash-cta-text)] transition-colors duration-300" />
            </motion.div>
            <motion.div
              animate={{ x: 0 }}
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2, ease: DESIGN.easing.spring }}
            >
              <ArrowRight className="w-4 h-4 text-[var(--dash-brand)] flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <h3 className="font-medium text-[var(--dash-text)] text-sm leading-snug line-clamp-2 group-hover:text-[var(--dash-brand-deep)] transition-colors">
              {title}
            </h3>
            <p className="text-xs text-[var(--dash-text-muted)] mt-1 line-clamp-2 min-h-[2.5rem] leading-relaxed">
              {description}
            </p>
          </div>
        </button>
      </div>
    </motion.div>
  );
};

// ============================================
// 3D BOOKING CARD COMPONENT
// Organic animations, cohesive shadows, accessible focus
// ============================================

interface BookingCard3DProps {
  booking: BookingSummary;
  onView: (id: string) => void;
  onWriteReview?: (bookingId: string) => void;
  delay?: number;
}

const BookingCard3D: React.FC<BookingCard3DProps> = ({
  booking,
  onView,
  onWriteReview,
  delay = 0,
}) => {
  const status = statusConfig[booking.status] || statusConfig.pending;
  const formattedDate = new Date(booking.scheduledDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: getStaggerDelay(delay),
        ease: DESIGN.easing.spring,
      }}
      className="group"
    >
      <button
        type="button"
        onClick={() => onView(booking._id)}
        className={cn(
          'w-full text-left p-4 border-b dash-divider last:border-0',
          'hover:bg-[var(--dash-surface-raised)] transition-all duration-250',
          'relative overflow-hidden',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--dash-surface)]',
          'shadow-sm hover:shadow-md'
        )}
      >
        {/* Subtle hover indicator with animation */}
        <motion.div
          className="absolute left-0 top-0 bottom-0 w-0.5 bg-[var(--dash-brand)]"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="min-w-0 flex-1">
            <motion.p
              className="font-medium text-[var(--dash-text)] text-[15px] group-hover:text-[var(--dash-brand-deep)] transition-colors"
            >
              {booking.serviceName}
            </motion.p>
            <p className="text-xs text-[var(--dash-text-muted)] mt-0.5">
              #{booking.bookingNumber?.slice(-6) || 'N/A'} · {formattedDate} · {booking.scheduledTime}
            </p>
          </div>
          <span className={cn('inline-flex px-2.5 py-1 rounded-[var(--dash-radius-pill)] text-xs font-medium flex-shrink-0', status.bgColor, status.color)}>
            {status.label}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <motion.div
              className="w-8 h-8 rounded-full bg-[var(--dash-accent-wash)] flex items-center justify-center flex-shrink-0 ring-2 ring-transparent group-hover:ring-[var(--dash-brand)]/20 transition-all"
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            >
              {booking.providerAvatar ? (
                <img src={booking.providerAvatar} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <User className="w-3.5 h-3.5 text-[var(--dash-brand-deep)]" />
              )}
            </motion.div>
            <span className="text-sm text-[var(--dash-text)] truncate">{booking.providerName}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {booking.canReview && onWriteReview && (
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.stopPropagation();
                  onWriteReview(booking._id);
                }}
                className="dash-badge text-xs py-1 hover:bg-[var(--dash-brand)] hover:text-[var(--dash-cta-text)] transition-colors"
              >
                Review
              </motion.button>
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
    </motion.div>
  );
};

// ============================================
// SPOTLIGHT OFFER CARD
// Organic animations, cohesive shadows, accessible focus
// ============================================

interface SpotlightOfferCardProps {
  title: string;
  description: string;
  onClick?: () => void;
  delay?: number;
}

const SpotlightOfferCard: React.FC<SpotlightOfferCardProps> = ({
  title,
  description,
  onClick,
  delay = 0,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: getStaggerDelay(delay),
        ease: DESIGN.easing.spring,
      }}
      className="dash-offer-card border-[var(--dash-brand-muted)] group relative overflow-hidden cursor-pointer shadow-sm hover:shadow-md transition-shadow duration-300"
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      role="button"
      tabIndex={0}
      // Accessible focus
      whileHover={{ y: -2 }}
    >
      {/* Premium gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--dash-brand)]/5 via-transparent to-[var(--dash-accent-highlight)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative flex items-start gap-4">
        <motion.div
          className="w-12 h-12 rounded-[var(--dash-radius-input)] bg-gradient-to-br from-[var(--dash-accent-wash)] to-[var(--dash-accent-highlight)]/50 flex items-center justify-center flex-shrink-0"
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ duration: 0.3, ease: DESIGN.easing.spring }}
        >
          <Gift className="w-6 h-6 text-[var(--dash-brand-deep)] group-hover:rotate-12 transition-transform duration-300" />
        </motion.div>
        <div className="flex-1">
          <h3 className="font-medium text-[var(--dash-text)] group-hover:text-[var(--dash-brand-deep)] transition-colors">{title}</h3>
          <p className="text-sm text-[var(--dash-text-muted)] mt-1 group-hover:text-[var(--dash-text)] transition-colors">{description}</p>
        </div>
        <motion.div
          animate={{ x: 0 }}
          whileHover={{ x: 4 }}
          transition={{ duration: 0.2, ease: DESIGN.easing.spring }}
        >
          <ArrowRight className="w-5 h-5 text-[var(--dash-brand-muted)] group-hover:text-[var(--dash-brand)] transition-all duration-200 self-center" />
        </motion.div>
      </div>
    </motion.div>
  );
};

// ============================================
// MAIN ENHANCED DASHBOARD COMPONENT
// ============================================

const CustomerDashboardEnhanced: React.FC = () => {
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

  const lastStatusToastRef = useRef<{ at: number; key: string } | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const [profileDropdownPos, setProfileDropdownPos] = useState({ top: 0, right: 0 });

  // Fetch recent conversations
  const fetchRecentConversations = useCallback(async () => {
    setIsLoadingMessages(true);
    try {
      const response = await chatApi.getChatRooms({ limit: 3 });
      setRecentConversations(response.rooms || []);
    } catch {
      // Silently handle conversation fetch errors
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
      let loyalty: LoyaltyData | null = null;
      let streak: StreakData | null = null;

      try {
        const dashboard = await customerDashboardApi.getDashboard();
        statsData = dashboard.stats;
        recent = dashboard.recentBookings || [];
        setUpcomingBookings(dashboard.upcomingBookings || []);
        loyalty = dashboard.loyaltyPoints || null;
        streak = dashboard.currentStreak || null;
      } catch {
        const [statsResult, bookingsResult] = await Promise.allSettled([
          customerDashboardApi.getStats(),
          bookingApi.getBookings({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
        ]);

        if (statsResult.status === 'fulfilled') {
          statsData = statsResult.value;
        }
        if (bookingsResult.status === 'fulfilled') {
          recent = (bookingsResult.value.bookings || []).map(mapBookingToSummary);
        }
      }

      const activeFromList = countActiveBookings(recent);
      if (statsData && (statsData.activeBookings ?? 0) === 0 && activeFromList > 0) {
        statsData = { ...statsData, activeBookings: activeFromList };
      }

      setStats(statsData);
      setRecentBookings(recent);
      setLoyaltyPoints(loyalty);
      setCurrentStreak(streak);
    } catch {
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Memoized socket event handlers
  const handleBookingStatusChange = useCallback(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleNewNotification = useCallback((data: { message?: string }) => {
    const sanitizedMessage = (data.message || 'You have a new notification')
      .replace(/<[^>]*>/g, '')
      .trim();
    toast(sanitizedMessage, {
      icon: <Bell className="h-5 w-5 text-nilin-coral" />,
      duration: 4000,
    });
  }, []);

  useEffect(() => {
    fetchDashboardData();
    fetchRecentConversations();
  }, [fetchDashboardData, fetchRecentConversations]);

  const updateProfileDropdownPosition = useCallback(() => {
    if (!profileTriggerRef.current) return;
    const rect = profileTriggerRef.current.getBoundingClientRect();
    setProfileDropdownPos({
      top: rect.bottom + 10,
      right: Math.max(16, window.innerWidth - rect.right),
    });
  }, []);

  useLayoutEffect(() => {
    if (!showProfileDropdown) return;
    updateProfileDropdownPosition();
    window.addEventListener('scroll', updateProfileDropdownPosition, true);
    window.addEventListener('resize', updateProfileDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateProfileDropdownPosition, true);
      window.removeEventListener('resize', updateProfileDropdownPosition);
    };
  }, [showProfileDropdown, updateProfileDropdownPosition]);

  useEffect(() => {
    if (!showProfileDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        profileMenuRef.current?.contains(target) ||
        profileDropdownRef.current?.contains(target)
      ) {
        return;
      }
      setShowProfileDropdown(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowProfileDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showProfileDropdown]);

  // Socket event listeners with stable callbacks
  useSocketEvent('booking:status_changed', handleBookingStatusChange);
  useSocketEvent('notification:new', handleNewNotification);

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
      description: 'Explore curated bundles',
      icon: Package,
      onClick: () => navigate('/packages'),
    },
    {
      title: 'Find Professionals',
      description: 'Discover verified pros',
      icon: Users,
      onClick: () => setShowViewProModal(true),
    },
    {
      title: 'Write Review',
      description: hasReviewableBooking ? 'Share your experience' : 'After a completed booking',
      icon: Star,
      onClick: handleWriteReviewClick,
    },
    {
      title: 'Book Service',
      description: 'Book any service quickly',
      icon: Plus,
      href: '/customer/book-services',
    },
    {
      title: 'My Bookings',
      description: 'View & manage appointments',
      icon: Calendar,
      href: '/customer/bookings',
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
    <div className="min-h-screen customer-dashboard flex flex-col">
      <NavigationHeader />

      <main className="flex-1 w-full">
        {/* Hero Section with premium gradient background */}
        <div className="border-b dash-divider relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--dash-surface)] via-transparent to-[var(--dash-accent-wash)]/40 pointer-events-none" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--dash-brand)]/[0.03] rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] bg-[var(--dash-accent-highlight)]/[0.05] rounded-full blur-3xl translate-y-1/2 pointer-events-none" />
          <div className="max-w-[var(--dash-page-max-width)] mx-auto px-4 sm:px-6 lg:px-8 py-[var(--dash-spacing-40)] md:py-[var(--dash-spacing-56)] relative">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-8">
              <motion.div
                className="flex-1 min-w-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease: DESIGN.easing.smooth }}
              >
                <motion.p
                  className="dash-eyebrow mb-3 inline-flex items-center gap-2"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1, duration: 0.5, ease: DESIGN.easing.spring }}
                >
                  <span className="w-2 h-2 rounded-full bg-[var(--dash-brand)] animate-pulse" />
                  Your Account
                </motion.p>
                <motion.h1
                  className="dash-display mb-3"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.6, ease: DESIGN.easing.spring }}
                >
                  Welcome back,{' '}
                  <span className="font-medium bg-gradient-to-r from-[var(--dash-brand-deep)] to-[var(--dash-brand)] bg-clip-text text-transparent">{getDisplayName(user)}</span>
                </motion.h1>
                <motion.p
                  className="text-[var(--dash-text-muted)] max-w-lg text-[15px] leading-relaxed"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.5, ease: DESIGN.easing.spring }}
                >
                  Track bookings, discover services, and manage your wellness journey — all in one beautiful place.
                </motion.p>
              </motion.div>

              <motion.div
                className="flex items-center gap-3 flex-shrink-0"
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5, ease: DESIGN.easing.spring }}
              >
                <button
                  type="button"
                  onClick={() => navigate('/customer/book-services')}
                  className="dash-btn-primary hidden sm:inline-flex group relative overflow-hidden"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                  Book a service
                </button>

                <div ref={profileMenuRef} className="relative">
                  <button
                    ref={profileTriggerRef}
                    type="button"
                    onClick={() => setShowProfileDropdown((open) => !open)}
                    className={cn(
                      'dash-profile-chip dash-profile-trigger',
                      showProfileDropdown && 'border-[var(--dash-brand)]',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dash-brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-white'
                    )}
                    aria-expanded={showProfileDropdown}
                    aria-haspopup="menu"
                  >
                    {!showProfileDropdown && <ProfileAvatar user={user} size="sm" />}
                    <div className="hidden lg:flex min-w-0 flex-1 flex-col dash-profile-meta">
                      <div className="dash-profile-name max-w-[140px]">{getFullDisplayName(user)}</div>
                      <div className="dash-profile-role capitalize">{user?.role || 'Customer'}</div>
                    </div>
                    <ChevronDown
                      className={cn('dash-profile-chevron h-4 w-4 shrink-0', showProfileDropdown && 'dash-profile-chevron--open')}
                      aria-hidden
                    />
                  </button>
                </div>

                {typeof document !== 'undefined' &&
                  createPortal(
                    <AnimatePresence>
                      {showProfileDropdown && (
                        <motion.div
                          key="profile-dropdown"
                          ref={profileDropdownRef}
                          initial={{ opacity: 0, y: -10, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -10, scale: 0.96 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          style={{
                            position: 'fixed',
                            top: profileDropdownPos.top,
                            right: profileDropdownPos.right,
                            zIndex: 9999,
                          }}
                          className="w-72 bg-white rounded-2xl border border-[var(--dash-border)] shadow-[0_8px_30px_rgba(0,0,0,0.12)] overflow-hidden pointer-events-auto"
                          role="menu"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Header with gradient */}
                          <div className="dash-profile-panel-header">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <ProfileAvatar user={user} size="lg" />
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                                  <div className="w-2 h-2 bg-white rounded-full" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="dash-profile-name font-semibold">{getFullDisplayName(user)}</div>
                                <div className="truncate text-[13px] text-[var(--dash-text-muted)]">{user?.email}</div>
                              </div>
                            </div>
                          </div>

                          {/* Menu items */}
                          <div className="dash-profile-panel">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => { navigate('/customer/profile'); setShowProfileDropdown(false); }}
                              className="dash-profile-item"
                            >
                              <User className="h-5 w-5" />
                              My Profile
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => { navigate('/customer/bookings'); setShowProfileDropdown(false); }}
                              className="dash-profile-item"
                            >
                              <Calendar className="h-5 w-5" />
                              My Bookings
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => { navigate('/customer/wallet'); setShowProfileDropdown(false); }}
                              className="dash-profile-item"
                            >
                              <CreditCard className="h-5 w-5" />
                              Wallet
                            </button>
                          </div>

                          {/* Footer */}
                          <div className="border-t border-[var(--dash-border)]">
                            <button
                              type="button"
                              role="menuitem"
                              onClick={handleLogout}
                              className="dash-profile-item dash-profile-item--danger"
                            >
                              <LogOut className="h-5 w-5" />
                              Sign Out
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>,
                    document.body
                  )}
              </motion.div>
            </div>
          </div>
        </div>

        <CustomerHubNav />

        <div className="max-w-[var(--dash-page-max-width)] mx-auto px-4 sm:px-6 lg:px-8 py-[var(--dash-spacing-24)] md:py-[var(--dash-spacing-32)]">
          {/* Error State */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-[var(--dash-card-padding)] bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-[var(--dash-radius-card)] text-[var(--dash-text)] flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-[var(--dash-radius-card)] bg-[var(--dash-accent-wash)] flex items-center justify-center flex-shrink-0">
                  <span className="text-[var(--dash-brand-deep)] font-medium">!</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-[var(--dash-text-body-sm)]">Couldn&apos;t load dashboard</div>
                  <div className="text-[var(--dash-text-caption-sm)] text-[var(--dash-text-muted)] mt-0.5">{error}</div>
                </div>
                <button
                  type="button"
                  onClick={fetchDashboardData}
                  className="flex-shrink-0 px-4 py-2 bg-[var(--dash-cta)] text-[var(--dash-cta-text)] text-[var(--dash-text-body-sm)] rounded-[var(--dash-radius-card)] hover:bg-[var(--dash-brand)] transition-colors"
                >
                  Retry
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="button"
            onClick={() => navigate('/customer/book-services')}
            className="dash-btn-primary sm:hidden w-full mb-[var(--dash-spacing-24)] justify-center"
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            Book a service
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: getStaggerDelay(0),
              ease: DESIGN.easing.spring,
            }}
            className="mb-[var(--dash-spacing-32)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-[var(--dash-brand)] to-[var(--dash-brand)]/50 rounded-full" />
                  <h2 className="dash-section-title">Your Stats</h2>
                </div>
                <p className="dash-section-subtitle mt-1">Activity overview at a glance</p>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-[var(--dash-spacing-16)]">
              {isLoading ? (
                <>
                  <BentoStatSkeleton />
                  <BentoStatSkeleton />
                  <BentoStatSkeleton />
                  <BentoStatSkeleton />
                </>
              ) : (
                <>
                  <BentoStatCard
                    title="Active Bookings"
                    value={activeBookings}
                    icon={Clock}
                    subtitle="Pending, confirmed & in progress"
                    onClick={() => navigate('/customer/bookings?status=active')}
                    delay={0}
                  />
                  <BentoStatCard
                    title="Completed"
                    value={stats?.completedBookings || 0}
                    icon={CheckCircle}
                    subtitle="Total completed"
                    onClick={() => navigate('/customer/bookings?status=completed')}
                    delay={1}
                  />
                  <BentoStatCard
                    title="Pending Review"
                    value={stats?.pendingReviews ?? 0}
                    icon={Star}
                    subtitle="Awaiting your review"
                    onClick={handlePendingReviewStatClick}
                    delay={2}
                  />
                  <BentoStatCard
                    title="Reviews Written"
                    value={stats?.reviewsWritten ?? 0}
                    icon={Award}
                    subtitle={stats?.averageRating ? `Avg. ${stats.averageRating.toFixed(1)}` : 'Submitted reviews'}
                    onClick={() => navigate('/customer/reviews')}
                    delay={3}
                  />
                </>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: getStaggerDelay(1),
              ease: DESIGN.easing.spring,
            }}
            className="mb-[var(--dash-spacing-32)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-[var(--dash-brand)] to-[var(--dash-brand)]/50 rounded-full" />
                  <h2 className="dash-section-title">Quick Actions</h2>
                </div>
                <p className="dash-section-subtitle mt-1">Navigate to key features</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-[var(--dash-spacing-16)] items-stretch">
              {navCards.map((card, index) => (
                <NavCardSpotlight
                  key={card.title}
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  onClick={card.onClick}
                  href={card.href}
                  delay={index}
                />
              ))}
            </div>
          </motion.div>

          {/* Dashboard Bubble Button CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.5,
              delay: getStaggerDelay(2),
              ease: DESIGN.easing.spring,
            }}
            className="mb-[var(--dash-spacing-32)]"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-[var(--dash-radius-input)] bg-gradient-to-br from-[var(--dash-accent-wash)] to-[var(--dash-accent-highlight)]/50 flex items-center justify-center">
                    <Gift className="w-4 h-4 text-[var(--dash-brand-deep)]" />
                  </div>
                  <h2 className="dash-section-title normal-case font-light tracking-tight">Special Offers</h2>
                </div>
                <p className="dash-section-subtitle mt-1">Exclusive deals for you</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--dash-spacing-16)]">
              <SpotlightOfferCard
                title="First Booking Discount"
                description="Get 20% off your first booking"
                onClick={() => navigate('/search')}
                delay={0}
              />
              <SpotlightOfferCard
                title="Refer a Friend"
                description="Earn 50 AED credit for each referral"
                onClick={() => navigate('/customer/referrals')}
                delay={1}
              />
            </div>
          </motion.div>

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

          <div className="grid lg:grid-cols-3 gap-[var(--dash-spacing-24)] lg:gap-[var(--dash-spacing-32)]">
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-[var(--dash-radius-input)] bg-[var(--dash-accent-wash)] flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-[var(--dash-brand-deep)]" />
                    </div>
                    <h2 className="dash-section-title normal-case font-light tracking-tight">Recent Bookings</h2>
                  </div>
                  {!isLoading && recentBookings.length > 0 && (
                    <p className="dash-section-subtitle">{recentBookings.length} most recent</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/customer/bookings')}
                  className="dash-btn-ghost flex items-center gap-1 px-3 py-1.5 rounded-[var(--dash-radius-pill)] hover:bg-[var(--dash-surface-raised)]"
                >
                  View all <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <motion.div
                className="dash-panel overflow-hidden p-0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.5,
                  delay: getStaggerDelay(3),
                  ease: DESIGN.easing.spring,
                }}
              >
                {isLoading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="p-4 rounded-[var(--dash-radius-card)]">
                        <ShimmerSkeleton className="h-4 w-3/4 mb-2" delay={i * 50} />
                        <ShimmerSkeleton className="h-3 w-1/2" delay={i * 50 + 25} />
                      </div>
                    ))}
                  </div>
                ) : recentBookings.length > 0 ? (
                  <div className="divide-y dash-divider p-2">
                    {recentBookings.map((booking, index) => (
                      <BookingCard3D
                        key={booking._id}
                        booking={booking}
                        onView={handleViewBooking}
                        onWriteReview={(bookingId) => {
                          setWriteReviewBookingId(bookingId);
                          setShowWriteReviewModal(true);
                        }}
                        delay={index}
                      />
                    ))}
                  </div>
                ) : (
                  // Elegant empty state with illustration-like design
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                    className="p-10 md:p-12 text-center"
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                      className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--dash-accent-wash)] to-[var(--dash-accent-highlight)]/30 mx-auto mb-6 flex items-center justify-center shadow-lg shadow-[var(--dash-brand)]/10"
                    >
                      <Inbox className="w-9 h-9 text-[var(--dash-brand-deep)]" />
                    </motion.div>
                    <h3 className="text-base font-medium text-[var(--dash-text)] mb-2">Your booking history is empty</h3>
                    <p className="text-sm text-[var(--dash-text-muted)] mb-6 max-w-[260px] mx-auto leading-relaxed">
                      Ready to experience exceptional service? Browse our professionals and book your first appointment.
                    </p>
                    <motion.button
                      type="button"
                      onClick={() => navigate('/customer/book-services')}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="dash-btn-primary inline-flex items-center gap-2"
                    >
                      <Search className="w-4 h-4" />
                      Explore Services
                    </motion.button>
                  </motion.div>
                )}
              </motion.div>
            </div>

            <div className="space-y-[var(--dash-spacing-16)] lg:space-y-5">
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: getStaggerDelay(4),
                  ease: DESIGN.easing.spring,
                }}
                className="dash-panel"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-[var(--dash-radius-input)] bg-[var(--dash-cta)] flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-[var(--dash-cta-text)]" />
                    </div>
                    <h3 className="font-medium text-[var(--dash-text)] text-sm">Messages</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/customer/messages')}
                    className="dash-btn-ghost text-xs flex items-center gap-1"
                  >
                    View all <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                  {isLoadingMessages ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3">
                          <ShimmerSkeleton className="w-10 h-10 rounded-full" delay={i * 75} />
                          <div className="flex-1 space-y-1.5">
                            <ShimmerSkeleton className="h-4 w-24 rounded" delay={i * 75 + 25} />
                            <ShimmerSkeleton className="h-3 w-32 rounded" delay={i * 75 + 50} />
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
                            className={cn(
                              'w-full flex items-center gap-3 p-2.5 rounded-[var(--dash-radius-input)] transition-colors text-left',
                              hasUnread ? 'bg-[var(--dash-accent-wash)] hover:bg-[var(--dash-accent-highlight)]' : 'hover:bg-[var(--dash-surface-raised)]'
                            )}
                          >
                            <div className="relative flex-shrink-0">
                              <div className="w-10 h-10 rounded-full bg-[var(--dash-accent-wash)] flex items-center justify-center text-[var(--dash-brand-deep)] font-medium text-sm">
                                {otherParticipant?.userId?.avatar ? (
                                  <img src={otherParticipant.userId.avatar} alt={participantName} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                  participantName.charAt(0).toUpperCase() || 'U'
                                )}
                              </div>
                              {hasUnread && (
                                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--dash-brand)] text-[var(--dash-cta-text)] text-[10px] font-medium rounded-full flex items-center justify-center">
                                  {room.unreadCount && room.unreadCount > 9 ? '9+' : room.unreadCount}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className={cn('text-sm truncate', hasUnread ? 'font-medium text-[var(--dash-text)]' : 'text-[var(--dash-text-muted)]')}>
                                  {participantName}
                                </span>
                                {room.updatedAt && (
                                  <span className="text-[10px] text-[var(--dash-text-subtle)] flex-shrink-0">
                                    {formatRelativeTime(new Date(room.updatedAt))}
                                  </span>
                                )}
                              </div>
                              {messagePreview && (
                                <p className={cn('text-xs truncate mt-0.5', hasUnread ? 'text-[var(--dash-text)] font-medium' : 'text-[var(--dash-text-muted)]')}>
                                  {messagePreview}
                                </p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    // Elegant empty state for messages
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15, duration: 0.4 }}
                      className="text-center py-8 px-4"
                    >
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.25, duration: 0.3 }}
                        className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--dash-accent-wash)] to-[var(--dash-accent-highlight)]/30 mx-auto mb-4 flex items-center justify-center shadow-md shadow-[var(--dash-brand)]/5"
                      >
                        <MessageCircle className="w-6 h-6 text-[var(--dash-brand-deep)]" />
                      </motion.div>
                      <p className="text-sm text-[var(--dash-text)] font-medium mb-1">No conversations yet</p>
                      <p className="text-xs text-[var(--dash-text-muted)] mb-4 max-w-[180px] mx-auto leading-relaxed">
                        Start chatting with your service providers
                      </p>
                      <button
                        type="button"
                        onClick={() => navigate('/customer/messages/new')}
                        className="text-xs font-medium text-[var(--dash-brand)] hover:text-[var(--dash-brand-deep)] transition-colors inline-flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        New conversation
                      </button>
                    </motion.div>
                  )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: getStaggerDelay(5),
                  ease: DESIGN.easing.spring,
                }}
                className="dash-panel"
              >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-[var(--dash-radius-input)] bg-[var(--dash-accent-wash)] flex items-center justify-center">
                      <Award className="w-4 h-4 text-[var(--dash-brand-deep)]" />
                    </div>
                    <h3 className="font-medium text-[var(--dash-text)] text-sm uppercase tracking-wide">Account Snapshot</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[var(--dash-radius-input)] bg-[var(--dash-surface-raised)] p-3.5 text-center border dash-divider hover:border-[var(--dash-brand)]/30 transition-colors">
                      <div className="text-xl font-medium text-[var(--dash-text)]">{stats?.totalBookings || 0}</div>
                      <div className="text-[11px] text-[var(--dash-text-muted)] mt-0.5">Total bookings</div>
                    </div>
                    <div className="rounded-[var(--dash-radius-input)] bg-[var(--dash-surface-raised)] p-3.5 text-center border dash-divider hover:border-[var(--dash-brand)]/30 transition-colors">
                      <div className="text-xl font-medium text-[var(--dash-text)]">{stats?.cancelledBookings || 0}</div>
                      <div className="text-[11px] text-[var(--dash-text-muted)] mt-0.5">Cancelled</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/customer/wallet')}
                      className="rounded-[var(--dash-radius-input)] bg-gradient-to-br from-[var(--dash-accent-wash)] to-[var(--dash-accent-highlight)]/30 p-3.5 text-center border dash-divider hover:shadow-lg hover:shadow-[var(--dash-brand)]/10 hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="flex items-center justify-center gap-1 text-xl font-medium text-[var(--dash-text)]">
                        <Award className="w-4 h-4 text-[var(--dash-brand)]" />
                        {loyaltyPoints?.points ?? 0}
                      </div>
                      <div className="text-[11px] text-[var(--dash-text-muted)] mt-0.5 capitalize">
                        {(loyaltyPoints?.tier || 'bronze')} tier
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/customer/wallet')}
                      className="rounded-[var(--dash-radius-input)] bg-gradient-to-br from-[var(--dash-accent-highlight)]/50 to-[var(--dash-accent-wash)]/30 p-3.5 text-center border dash-divider hover:shadow-lg hover:shadow-[var(--dash-brand)]/10 hover:-translate-y-0.5 transition-all duration-200"
                    >
                      <div className="flex items-center justify-center gap-1 text-xl font-medium text-[var(--dash-text)]">
                        <Flame className="w-4 h-4 text-[var(--dash-brand)]" />
                        {currentStreak?.currentStreak ?? 0}
                      </div>
                      <div className="text-[11px] text-[var(--dash-text-muted)] mt-0.5">Day streak</div>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/customer/profile')}
                    className="w-full mt-4 py-2.5 text-sm border dash-divider text-[var(--dash-text)] rounded-[var(--dash-radius-pill)] font-medium hover:bg-[var(--dash-surface-raised)] transition-colors"
                  >
                    Edit profile
                  </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: getStaggerDelay(6),
                  ease: DESIGN.easing.spring,
                }}
                className="dash-panel"
              >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-[var(--dash-radius-input)] bg-[var(--dash-accent-wash)] flex items-center justify-center">
                      <Heart className="w-4 h-4 text-[var(--dash-brand-deep)]" />
                    </div>
                    <h3 className="font-medium text-[var(--dash-text)] text-sm uppercase tracking-wide">Shortcuts</h3>
                  </div>
                  <div className="space-y-1">
                    {quickActions.map((action) => (
                      <button
                        key={action.label}
                        type="button"
                        onClick={action.onClick}
                        className="w-full flex items-center gap-3 p-2.5 rounded-[var(--dash-radius-input)] hover:bg-[var(--dash-surface-raised)] transition-all duration-200 text-left group"
                      >
                        <div className="w-9 h-9 rounded-[var(--dash-radius-input)] bg-gradient-to-br from-[var(--dash-accent-wash)] to-[var(--dash-accent-highlight)]/30 flex items-center justify-center group-hover:scale-105 group-hover:shadow-md group-hover:shadow-[var(--dash-brand)]/10 transition-all duration-200">
                          <action.icon className="w-4 h-4 text-[var(--dash-brand-deep)]" />
                        </div>
                        <span className="text-sm text-[var(--dash-text)] font-medium flex-1">{action.label}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[var(--dash-text-subtle)] group-hover:text-[var(--dash-brand)] group-hover:translate-x-1 transition-all duration-200" />
                      </button>
                    ))}
                  </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: getStaggerDelay(7),
                  ease: DESIGN.easing.spring,
                }}
              >
                <div className="dash-panel border-[var(--dash-brand-muted)] relative overflow-hidden group">
                  {/* Premium gradient background on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[var(--dash-brand)]/5 via-transparent to-[var(--dash-accent-highlight)]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-[var(--dash-radius-input)] bg-gradient-to-br from-[var(--dash-cta)] to-[var(--dash-brand)] flex items-center justify-center shadow-lg shadow-[var(--dash-brand)]/20">
                      <Bell className="w-5 h-5 text-[var(--dash-cta-text)]" />
                    </div>
                    <div>
                      <div className="font-medium text-[var(--dash-text)] text-sm group-hover:text-[var(--dash-brand-deep)] transition-colors">Need help?</div>
                      <div className="text-xs text-[var(--dash-text-muted)]">Support is available 24/7</div>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--dash-text-muted)] mb-4 leading-relaxed">
                    Questions about bookings, payments, or your account? Our team is ready to assist.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/customer/support')}
                    className="dash-btn-primary w-full justify-center group-hover:shadow-lg group-hover:shadow-[var(--dash-brand)]/10 transition-shadow duration-300"
                  >
                    Contact support
                  </button>
                </div>
              </motion.div>
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

export default CustomerDashboardEnhanced;
