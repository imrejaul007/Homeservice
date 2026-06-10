/**
 * @deprecated Use frontend/src/pages/CustomerDashboard.tsx (routed at /customer/dashboard).
 * This legacy component is kept for reference; navigation paths are synced with the live page.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Calendar,
  User,
  ArrowRight,
  Star,
  Clock,
  AlertTriangle,
  X,
  Sparkles,
  Heart,
  Sparkle,
  ChevronRight,
  RefreshCw,
  WifiOff,
  TrendingUp,
  Award,
  Briefcase,
  Package,
  Users,
  Activity as ActivityIcon,
  MapPin,
  Ticket,
  Gem,
  LayoutGrid
} from 'lucide-react';

// =============================================================================
// Error Boundary - Catches rendering errors to prevent dashboard crashes
// =============================================================================
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onRetry: () => void;
}

class DashboardErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Dashboard render error:', error, errorInfo.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
            <WifiOff className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="font-semibold text-red-700 mb-2">Something went wrong</h3>
          <p className="text-sm text-red-600/80 mb-4">
            We encountered an unexpected error. Please try refreshing.
          </p>
          <Button onClick={this.props.onRetry} variant="secondary" size="sm">
            Refresh Dashboard
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
import NavigationHeader from '../layout/NavigationHeader';
import Footer from '../layout/Footer';
import { useAuthStore } from '../../stores/authStore';
import { searchApi } from '../../services/searchApi';
import type { Service } from '../../types/service';
import { CATEGORY_IMAGES } from '../../constants/images';
import { useUserStatus } from '../../hooks/useSocket';
import { useAuthGuard } from '../../hooks/useAuthGuard';
import { toast } from 'react-hot-toast';
import { FadeSection } from '../ui/FadeSection';
import { EmptyState, NoBookingsEmpty, ErrorState } from '../common/EmptyState';
import { StatsCardSkeleton, ServiceCardSkeleton } from '../common/Skeleton';
import { LoadingShimmer, ShimmerCard } from '../common/LoadingShimmer';
import { StatCard, StatCardGrid } from '../ui/StatCard';
import Button from '../common/Button';
import { Badge, CountBadge } from '../common/Badge';
import UpcomingBookings from './UpcomingBookings';
import OngoingBookings from './OngoingBookings';
import PackagesSection from './PackagesSection';
import RecentActivity from './RecentActivity';
import RecommendedProsSection from './RecommendedProsSection';
import ViewProModal from './ViewProModal';
import NotificationsSection from './NotificationsSection';
import { favoritesApi } from '../../services/favoritesApi';
import {
  customerDashboardApi,
  type DashboardResponse,
  type BookingSummary
} from '../../services/customerDashboardApi';
import { offerService } from '../../services/offerService';
import type { Offer } from '../../types/offer';

// =============================================================================
// Customer Dashboard - Production-Ready Beauty & Wellness Platform
// NILIN Design System - Luxury Minimal Aesthetic
// =============================================================================

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
  badge?: string;
  onClick?: () => void;
}

interface BookingStats {
  upcoming: number;
  completed: number;
  totalSpent: number;
  favorites: number;
  active: number;
  inProgressBookings: number;
  todayBookings?: number;
  totalProviders?: number;
  rating?: number;
  pendingBookings?: number;
  confirmedBookings?: number;
}

// Quick Action Card Component
const QuickActionCard: React.FC<QuickActionProps> = ({
  icon,
  label,
  description,
  href,
  badge,
  onClick
}) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      onClick={onClick || (() => navigate(href))}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative flex items-center gap-4 p-5 rounded-2xl border border-nilin-border/50
                 bg-white/60 backdrop-blur-md
                 hover:bg-white hover:shadow-nilin-lg hover:-translate-y-1
                 transition-all duration-300 text-left group overflow-hidden"
    >
      {/* Gradient accent on hover */}
      <div
        className={`absolute inset-0 bg-gradient-to-br from-nilin-coral/5 to-nilin-rose/5
                    opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
      />

      {/* Icon container */}
      <div className="relative z-10 w-14 h-14 rounded-2xl bg-gradient-to-br from-nilin-blush to-nilin-peach
                      flex items-center justify-center flex-shrink-0
                      group-hover:scale-110 transition-transform duration-300">
        <span className="text-nilin-rose group-hover:text-nilin-coral transition-colors">
          {icon}
        </span>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-nilin-charcoal text-sm group-hover:text-nilin-coral transition-colors">
            {label}
          </h3>
          {badge && (
            <span className="px-2 py-0.5 bg-nilin-coral/10 text-nilin-coral text-xs font-medium rounded-full">
              {badge}
            </span>
          )}
        </div>
        <p className="text-xs text-nilin-warmGray mt-0.5">{description}</p>
      </div>

      {/* Arrow indicator */}
      <ChevronRight
        className={`relative z-10 w-5 h-5 text-nilin-warmGray
                     group-hover:text-nilin-coral group-hover:translate-x-1 transition-all duration-300`}
      />
    </button>
  );
};

// Service Card Component
interface ServiceCardProps {
  service: Service;
  onNavigate: (id: string) => void;
  index: number;
  providerId?: string;
  initialFavorited?: boolean;
  onFavoriteToggle?: (isFavorited: boolean) => void;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  onNavigate,
  index,
  providerId,
  initialFavorited = false,
  onFavoriteToggle
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFavorited, setIsFavorited] = useState(initialFavorited);
  const [isToggling, setIsToggling] = useState(false);

  const getServiceImage = (s: Service): string => {
    if (s.images?.[0]) return s.images[0];
    const catSlug = s.category?.toLowerCase?.().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-');
    if (catSlug && CATEGORY_IMAGES[catSlug]) return CATEGORY_IMAGES[catSlug].card;
    return 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80&fit=crop';
  };

  const handleFavoriteToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    // FIX HIGH: Explicitly check for undefined providerId with user feedback
    if (!providerId) {
      toast.error('Unable to favorite: provider information unavailable', { duration: 3000 });
      return;
    }
    if (isToggling) return;

    setIsToggling(true);
    try {
      const result = await favoritesApi.toggleFavorite(providerId);
      setIsFavorited(result.isFavorited);
      onFavoriteToggle?.(result.isFavorited);
      toast.success(
        result.isFavorited ? 'Added to favorites' : 'Removed from favorites',
        { duration: 2000 }
      );
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
      toast.error('Failed to update favorite');
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <FadeSection delay={index * 100}>
      <button
        onClick={() => onNavigate(service._id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="w-full flex items-center gap-4 p-4 rounded-2xl border border-nilin-border/30
                   bg-white/70 backdrop-blur-sm
                   hover:bg-white hover:shadow-nilin-lg hover:-translate-y-0.5
                   transition-all duration-300 text-left group"
      >
        {/* Image */}
        <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 shadow-sm">
          <img
            src={getServiceImage(service)}
            alt={service.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
          {/* Favorite button overlay */}
          {providerId && (
            <button
              onClick={handleFavoriteToggle}
              disabled={isToggling}
              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm
                         flex items-center justify-center opacity-0 group-hover:opacity-100
                         transition-all duration-200 hover:bg-white hover:scale-110 shadow-md
                         disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                className={`w-4 h-4 transition-colors ${
                  isFavorited
                    ? 'text-nilin-coral fill-nilin-coral'
                    : 'text-nilin-warmGray hover:text-nilin-coral'
                } ${isToggling ? 'animate-pulse' : ''}`}
              />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-nilin-charcoal text-sm line-clamp-1
                         group-hover:text-nilin-coral transition-colors">
            {service.name}
          </h3>

          {/* Rating and duration */}
          <div className="flex items-center gap-3 mt-1.5 text-xs text-nilin-warmGray">
            <span className="flex items-center gap-1 bg-amber-50/80 px-2 py-0.5 rounded-full border border-amber-100">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span className="font-semibold text-amber-700">
                {service.rating?.average ? service.rating.average.toFixed(1) : '-'}
              </span>
              <span className="text-amber-600/70">
                ({service.rating?.count ?? 0})
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {service.duration || 0} min
            </span>
          </div>

          {/* Category badge */}
          {service.category && (
            <span className="inline-block mt-2 px-2.5 py-0.5 bg-nilin-blush/60 text-nilin-rose text-xs rounded-full font-medium">
              {service.category}
            </span>
          )}
        </div>

        {/* Price */}
        <div className="text-right flex-shrink-0">
          <div className="font-bold text-nilin-charcoal text-lg">
            AED {service.price?.amount ?? 0}
          </div>
          <div className="text-xs text-nilin-warmGray">per session</div>
        </div>
      </button>
    </FadeSection>
  );
};

// Stats Overview Component
interface StatsOverviewProps {
  stats: BookingStats;
  loading: boolean;
  favoritesCount: number;
}

const StatsOverview: React.FC<StatsOverviewProps> = ({ stats, loading, favoritesCount }) => {
  if (loading) {
    return (
      <FadeSection>
        <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-nilin-border/40 p-5 mb-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <StatsCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </FadeSection>
    );
  }

  return (
    <FadeSection>
      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-nilin-border/40 p-5 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nilin-coral/20 to-nilin-rose/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-nilin-coral" />
          </div>
          <h2 className="text-base font-medium text-nilin-charcoal">Your Activity Overview</h2>
        </div>
        <StatCardGrid columns={{ default: 2, lg: 4 }} className="gap-4">
          {/* Active Bookings with breakdown */}
          <div className="bg-gradient-to-br from-nilin-coral/5 to-rose-50 rounded-xl p-4 border border-nilin-coral/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-nilin-warmGray">Active Bookings</span>
              <Calendar className="w-4 h-4 text-nilin-coral" />
            </div>
            <div className="text-2xl font-bold text-nilin-charcoal mb-2">{stats.active}</div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-nilin-warmGray">
                <span>Pending</span>
                <span className="font-medium text-amber-600">{stats.pendingBookings || 0}</span>
              </div>
              <div className="flex justify-between text-nilin-warmGray">
                <span>Confirmed</span>
                <span className="font-medium text-blue-600">{stats.confirmedBookings || 0}</span>
              </div>
              <div className="flex justify-between text-nilin-warmGray">
                <span>In Progress</span>
                <span className="font-medium text-purple-600">{stats.inProgressBookings}</span>
              </div>
            </div>
          </div>
          <StatCard
            label="Completed"
            value={stats.completed}
            icon={<Award className="w-5 h-5" />}
            variant="mint"
            description="Services completed"
          />
          <StatCard
            label="Total Spent"
            value={`AED ${stats.totalSpent.toLocaleString()}`}
            icon={<TrendingUp className="w-5 h-5" />}
            variant="gold"
            description="This month"
          />
          <StatCard
            label="Your Rating"
            value={stats.rating !== undefined ? stats.rating : 'N/A'}
            icon={<Star className="w-5 h-5" />}
            variant="lavender"
            description="From providers"
          />
        </StatCardGrid>
      </div>
    </FadeSection>
  );
};

// Welcome Header Component
interface WelcomeHeaderProps {
  userFirstName: string | undefined;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const WelcomeHeader: React.FC<WelcomeHeaderProps> = ({
  userFirstName,
  onRefresh,
  isRefreshing
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 mb-1">
          <h1 className="text-2xl md:text-3xl font-serif font-light text-nilin-charcoal">
            {getGreeting()},
          </h1>
          <span className="text-2xl md:text-3xl font-serif font-medium text-nilin-coral">
            {userFirstName || 'there'}
          </span>
        </div>
        <p className="text-nilin-warmGray text-sm flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          Discover beauty & wellness services tailored for you
        </p>
      </div>

      {/* Refresh button */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="p-2.5 rounded-xl bg-white/60 backdrop-blur-md border border-nilin-border/50
                   hover:bg-white hover:shadow-nilin-sm hover:border-nilin-coral/30
                   transition-all duration-200 disabled:opacity-50 flex-shrink-0 ml-4"
        aria-label="Refresh dashboard"
      >
        <RefreshCw
          className={`w-5 h-5 text-nilin-warmGray ${isRefreshing ? 'animate-spin' : ''}`}
        />
      </button>
    </div>
  );
};

// Section Header Component
interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  badge?: string;
  subtitle?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  action,
  badge,
  subtitle
}) => (
  <div className="flex items-center justify-between mb-5">
    <div className="flex items-center gap-3">
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nilin-coral/15 to-nilin-rose/10
                        flex items-center justify-center shadow-sm">
          <span className="text-nilin-coral">{icon}</span>
        </div>
      )}
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-serif font-semibold text-nilin-charcoal">{title}</h2>
          {badge && (
            <span className="px-2 py-0.5 bg-nilin-coral/10 text-nilin-coral text-xs font-medium rounded-full">
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-nilin-warmGray mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
    {action && (
      <button
        onClick={action.onClick}
        className="flex items-center gap-1.5 text-sm font-medium text-nilin-coral
                   hover:text-nilin-rose transition-colors group px-3 py-1.5 rounded-lg
                   hover:bg-nilin-coral/5"
      >
        {action.label}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
      </button>
    )}
  </div>
);

// Loading Skeleton for Service List
const ServiceListSkeleton: React.FC = () => (
  <div className="bg-white/60 backdrop-blur-sm rounded-2xl border border-nilin-border/30 p-5">
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 rounded-xl bg-white/80 border border-nilin-border/20"
        >
          <LoadingShimmer width={80} height={80} borderRadius={12} />
          <div className="flex-1 space-y-2.5">
            <LoadingShimmer width="55%" height={16} />
            <div className="flex items-center gap-3">
              <LoadingShimmer width={70} height={24} borderRadius={12} />
              <LoadingShimmer width={50} height={14} borderRadius={6} />
            </div>
            <LoadingShimmer width={80} height={22} borderRadius={10} />
          </div>
          <div className="space-y-1 text-right">
            <LoadingShimmer width={60} height={20} borderRadius={6} />
            <LoadingShimmer width={50} height={12} borderRadius={4} />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Empty Services State
const EmptyServices: React.FC<{ onBrowse: () => void }> = ({ onBrowse }) => (
  <div className="rounded-2xl border border-nilin-border/30 bg-white/60 backdrop-blur-sm p-8 text-center">
    {/* Decorative background */}
    <div className="absolute inset-0 bg-gradient-to-b from-nilin-blush/20 to-transparent pointer-events-none rounded-2xl" />

    <div className="relative">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-nilin-coral/10 to-nilin-rose/10 mx-auto mb-4 flex items-center justify-center">
        <Sparkles className="w-10 h-10 text-nilin-coral/70" />
      </div>
      <h3 className="font-semibold text-nilin-charcoal mb-2 text-lg">No recommendations yet</h3>
      <p className="text-sm text-nilin-warmGray mb-6 max-w-xs mx-auto leading-relaxed">
        We're curating personalized services for you based on your preferences
      </p>
      <Button onClick={onBrowse} size="md" leftIcon={<Search className="w-4 h-4" />}>
        Browse Services
      </Button>
    </div>
  </div>
);

// Status Badge Component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
    confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Confirmed' },
    in_progress: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'In Progress' },
    completed: { bg: 'bg-green-50', text: 'text-green-700', label: 'Completed' },
    cancelled: { bg: 'bg-red-50', text: 'text-red-700', label: 'Cancelled' },
  };
  const c = config[status] || { bg: 'bg-gray-50', text: 'text-gray-700', label: status };
  return <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${c.bg} ${c.text}`}>{c.label}</span>;
};

// Recent Bookings Table Component
interface RecentBookingsTableProps {
  bookings: BookingSummary[];
  loading: boolean;
  onViewAll: () => void;
  navigate: ReturnType<typeof useNavigate>;
}

const RecentBookingsTable: React.FC<RecentBookingsTableProps> = ({ bookings, loading, onViewAll, navigate }) => {
  if (loading) {
    return (
      <div className="rounded-2xl border border-nilin-border/50 bg-white/40 p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <LoadingShimmer width={60} height={60} borderRadius={8} />
              <div className="flex-1 space-y-2">
                <LoadingShimmer width="40%" height={16} />
                <LoadingShimmer width="60%" height={12} />
              </div>
              <LoadingShimmer width={80} height={24} borderRadius={12} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!bookings || bookings.length === 0) {
    return (
      <div className="relative rounded-2xl border border-nilin-border/30 bg-white/60 backdrop-blur-sm p-8 text-center overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-nilin-blush/30 to-transparent rounded-bl-full opacity-50" />

        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-nilin-coral/10 to-nilin-rose/10 mx-auto mb-4 flex items-center justify-center">
            <Calendar className="w-8 h-8 text-nilin-coral/60" />
          </div>
          <h3 className="font-semibold text-nilin-charcoal mb-2 text-lg">No bookings yet</h3>
          <p className="text-sm text-nilin-warmGray mb-5 max-w-xs mx-auto leading-relaxed">
            Book your first service to start your beauty journey
          </p>
          <Button onClick={() => navigate('/search')} size="sm" leftIcon={<Search className="w-4 h-4" />}>
            Browse Services
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-nilin-border/30 bg-white/70 backdrop-blur-sm overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-nilin-blush/30 to-nilin-peach/20 border-b border-nilin-border/40">
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-nilin-charcoal uppercase tracking-wide">Booking</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-nilin-charcoal uppercase tracking-wide">Service</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-nilin-charcoal uppercase tracking-wide">Provider</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-nilin-charcoal uppercase tracking-wide">Date</th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold text-nilin-charcoal uppercase tracking-wide">Status</th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold text-nilin-charcoal uppercase tracking-wide">Price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-nilin-border/20">
            {bookings.map((booking, index) => (
              <tr
                key={booking._id}
                className="hover:bg-nilin-blush/10 transition-colors group cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => onViewAll()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onViewAll(); } }}
                aria-label={`View booking ${booking.bookingNumber?.slice(-6) || booking._id} - ${booking.serviceName} with ${booking.providerName}`}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-nilin-coral/60" />
                    <span className="text-sm font-medium text-nilin-charcoal">
                      #{booking.bookingNumber?.slice(-6) || '-'}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="text-sm text-nilin-charcoal font-medium">{booking.serviceName}</div>
                  <div className="text-xs text-nilin-warmGray">{booking.serviceCategory}</div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="text-sm text-nilin-charcoal">{booking.providerName}</div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="text-sm text-nilin-charcoal">
                    {booking.scheduledDate ? new Date(booking.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-'}
                  </div>
                  <div className="text-xs text-nilin-warmGray">{booking.scheduledTime || ''}</div>
                </td>
                <td className="px-4 py-3.5"><StatusBadge status={booking.status} /></td>
                <td className="px-4 py-3.5 text-right">
                  <span className="text-sm font-semibold text-nilin-charcoal">
                    AED {booking.totalAmount?.toLocaleString() ?? 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3.5 border-t border-nilin-border/30 bg-nilin-blush/10">
        <button
          onClick={onViewAll}
          className="text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors flex items-center gap-1.5 group"
        >
          View all bookings
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};

// Navigation Cards Component
interface NavigationCardsProps {
  onViewPackages: () => void;
  onViewPro: () => void;
  onBookService: () => void;
  onMyBookings: () => void;
  onWriteReview: () => void;
  upcomingCount: number;
}

const NavigationCards: React.FC<NavigationCardsProps> = ({ onViewPackages, onViewPro, onBookService, onMyBookings, onWriteReview, upcomingCount }) => {
  const cards = [
    { icon: <LayoutGrid className="w-5 h-5" />, title: 'View Packages', description: 'Explore service bundles', onClick: onViewPackages, gradient: 'from-nilin-coral/15 via-white to-nilin-rose/10', iconBg: 'bg-nilin-coral/20', iconColor: 'text-nilin-coral' },
    { icon: <Search className="w-5 h-5" />, title: 'Find Professionals', description: 'Discover verified pros', onClick: onViewPro, gradient: 'from-purple-50 via-white to-pink-50/50', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
    { icon: <Star className="w-5 h-5" />, title: 'Write Review', description: 'Share your experience', onClick: onWriteReview, gradient: 'from-amber-50 via-white to-orange-50/50', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
    { icon: <Calendar className="w-5 h-5" />, title: 'Book Service', description: 'Schedule new appointment', onClick: onBookService, gradient: 'from-green-50 via-white to-emerald-50/50', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
    { icon: <ActivityIcon className="w-5 h-5" />, title: 'My Bookings', description: upcomingCount > 0 ? `${upcomingCount} upcoming` : 'View all bookings', onClick: onMyBookings, gradient: 'from-blue-50 via-white to-indigo-50/50', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' }
  ];

  return (
    <div className="mb-8">
      <SectionHeader
        title="Quick Actions"
        icon={<LayoutGrid className="w-5 h-5" />}
        subtitle="Navigate to key features"
      />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {cards.map((card, index) => (
          <FadeSection key={card.title} delay={index * 75}>
            <button
              onClick={card.onClick}
              className={`relative overflow-hidden rounded-2xl border border-nilin-border/40 bg-gradient-to-br ${card.gradient} p-5 text-left hover:shadow-nilin-xl hover:-translate-y-1.5 transition-all duration-300 group w-full`}
            >
              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-white/40 to-transparent rounded-bl-full" />
              </div>

              {/* Icon with glow effect on hover */}
              <div className={`relative w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
                <span className={card.iconColor}>{card.icon}</span>
              </div>

              {/* Content */}
              <div className="relative">
                <h3 className="font-semibold text-nilin-charcoal text-sm mb-1 group-hover:text-nilin-coral transition-colors">
                  {card.title}
                </h3>
                <p className="text-xs text-nilin-warmGray leading-relaxed">{card.description}</p>
              </div>

              {/* Arrow indicator */}
              <ChevronRight className="absolute bottom-4 right-4 w-4 h-4 text-nilin-warmGray/50 group-hover:text-nilin-coral group-hover:translate-x-1 transition-all duration-300" />
            </button>
          </FadeSection>
        ))}
      </div>
    </div>
  );
};

// Error State Component
const DashboardError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="rounded-2xl border border-red-200 bg-red-50/50 p-8 text-center">
    <div className="w-16 h-16 rounded-full bg-red-100 mx-auto mb-4 flex items-center justify-center">
      <WifiOff className="w-8 h-8 text-red-500" />
    </div>
    <h3 className="font-semibold text-red-700 mb-2">Unable to load dashboard</h3>
    <p className="text-sm text-red-600/80 mb-4">
      Please check your connection and try again
    </p>
    <Button onClick={onRetry} variant="secondary" size="sm">
      Try Again
    </Button>
  </div>
);

// =============================================================================
// Main Customer Dashboard Component
// =============================================================================

const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, tokens } = useAuthStore();

  // State
  const [recentServices, setRecentServices] = useState<Service[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAccountWarning, setShowAccountWarning] = useState(false);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [activeOffers, setActiveOffers] = useState<Offer[]>([]);
  const [showViewProModal, setShowViewProModal] = useState(false);
  const [bookingStats, setBookingStats] = useState<BookingStats>({
    upcoming: 0,
    completed: 0,
    totalSpent: 0,
    favorites: 0,
    active: 0,
    inProgressBookings: 0,
    todayBookings: 0,
    totalProviders: 0,
  });

  // Subscribe to user account status updates
  const { statusChanged, accountLocked } = useUserStatus();

  // FIX HIGH: Validate auth tokens before API calls
  // Use useAuthGuard to check token validity and trigger refresh if needed
  const { isSessionExpired, attemptTokenRefresh } = useAuthGuard({
    redirectOnExpiry: true,
    onExpired: () => {
      toast.error('Your session has expired. Please log in again.');
    },
    onExpiryWarning: () => {
      // Attempt silent refresh when session is expiring soon
      attemptTokenRefresh();
    },
  });

  // Fetch dashboard data from API
  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    // FIX HIGH: Validate tokens before making API calls
    // Check if session is expired or tokens are missing/invalid
    if (!tokens?.accessToken || isSessionExpired) {
      console.error('Auth token validation failed: missing or expired token');
      setError('Your session appears to be invalid. Please log in again.');
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      // Fetch all dashboard data in parallel
      const [dashboardResponse, servicesResponse, favoritesResponse] = await Promise.allSettled([
        customerDashboardApi.getDashboard(),
        searchApi.searchServices({ limit: 5, sortBy: 'popularity' }),
        favoritesApi.getFavorites()
      ]);

      // Extract and narrow all response data upfront to avoid race condition issues with PromiseSettledResult
      const dashboardData = dashboardResponse.status === 'fulfilled' ? dashboardResponse.value : null;
      const servicesData = servicesResponse.status === 'fulfilled' && servicesResponse.value.success ? servicesResponse.value.data : null;
      const favoritesRaw = favoritesResponse.status === 'fulfilled' ? favoritesResponse.value.data : null;
      const favoritesList = favoritesRaw ? (favoritesRaw.favorites || []) : [];

      // Handle dashboard data
      if (dashboardData) {
        setDashboardData(dashboardData);
        setBookingStats({
          upcoming: dashboardData.upcomingBookings?.length || 0,
          completed: dashboardData.stats?.completedBookings || 0,
          totalSpent: dashboardData.stats?.totalSpent || 0,
          favorites: favoritesList.length,
          active: dashboardData.stats?.activeBookings || 0,
          inProgressBookings: dashboardData.stats?.inProgressBookings || 0,
          todayBookings: (dashboardData.stats as any)?.todayBookings || 0,
          totalProviders: (dashboardData.stats as any)?.totalProviders || 0,
          rating: dashboardData.stats?.averageRating || 0,
          pendingBookings: (dashboardData.stats as any)?.pendingBookings || 0,
          confirmedBookings: (dashboardData.stats as any)?.confirmedBookings || 0,
        });
      } else {
        console.error('Dashboard API error:', dashboardResponse.status === 'rejected' ? dashboardResponse.reason : 'Unknown error');
        toast.error('Failed to load dashboard data. Some information may be missing.');
        setBookingStats(prev => ({
          ...prev,
          favorites: favoritesList.length
        }));
      }

      // Handle services data
      if (servicesData) {
        setRecentServices(servicesData.services || []);
      }

      // Handle favorites count
      setFavoritesCount(favoritesList.length);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard. Please try again.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [tokens, isSessionExpired]);

  // Fetch services only
  const fetchServices = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await searchApi.searchServices({ limit: 5, sortBy: 'popularity' });
      if (response.success && response.data?.services) {
        setRecentServices(response.data.services);
      }
    } catch (err) {
      console.error('Error fetching services:', err);
      setError('Failed to load services');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchDashboardData();

    // Fetch active offers from API
    offerService.getActiveOffers()
      .then((offers) => setActiveOffers(offers.slice(0, 4)))
      .catch((err) => console.error('Failed to fetch offers:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle user status changes
  useEffect(() => {
    if (statusChanged && statusChanged.userId === user?.id) {
      if (statusChanged.status === 'suspended') {
        toast.error('Your account has been suspended. Please contact support.');
        setShowAccountWarning(true);
      } else if (statusChanged.status === 'banned') {
        toast.error('Your account has been banned. Please contact support.');
        setShowAccountWarning(true);
      } else if (statusChanged.status === 'active') {
        toast.success('Your account has been reactivated!');
        setShowAccountWarning(false);
      }
    }
  }, [statusChanged, user?.id]);

  // Handle account locked events
  useEffect(() => {
    if (accountLocked && accountLocked.userId === user?.id) {
      // Sanitize reason to prevent XSS - strip HTML tags and limit length
      const sanitizedReason = accountLocked.reason
        ? accountLocked.reason.replace(/<[^>]*>/g, '').slice(0, 200)
        : 'Security concern';
      toast.error(`Account locked: ${sanitizedReason}`);
      if (accountLocked.until) {
        toast(`Account will be unlocked on ${new Date(accountLocked.until).toLocaleDateString()}`);
      }
    }
  }, [accountLocked, user?.id]);

  // Handle refresh with debounce to prevent rapid-fire API calls
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const handleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }
    refreshTimeoutRef.current = setTimeout(() => {
      fetchDashboardData(true);
    }, 500);
  }, [fetchDashboardData]);

  // Quick actions data
  const quickActions: QuickActionProps[] = [
    {
      icon: <Search className="w-6 h-6" />,
      label: 'Browse Services',
      description: 'Find beauty & wellness near you',
      href: '/search',
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      label: 'My Bookings',
      description: 'View upcoming appointments',
      href: '/customer/bookings',
      badge: bookingStats.upcoming > 0 ? `${bookingStats.upcoming} upcoming` : undefined,
    },
    {
      icon: <User className="w-6 h-6" />,
      label: 'My Profile',
      description: 'Update your details',
      href: '/customer/profile',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-nilin-blush via-nilin-peach to-nilin-cream">
      <NavigationHeader />

      <DashboardErrorBoundary onRetry={handleRefresh}>
        <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10 w-full">
          {/* Account Status Warning Banner */}
          {showAccountWarning && (
            <FadeSection>
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-700">Account Restricted</h3>
                  <p className="text-sm text-red-600 mt-1">
                    Your account has limited access. Please contact support to resolve this issue.
                  </p>
                </div>
                <button
                  onClick={() => setShowAccountWarning(false)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                  aria-label="Dismiss warning"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </FadeSection>
          )}

          {/* Welcome Header */}
          <WelcomeHeader
            userFirstName={user?.firstName}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />

          {/* Navigation Cards */}
          <NavigationCards
            onViewPackages={() => navigate('/packages')}
            onViewPro={() => setShowViewProModal(true)}
            onBookService={() => navigate('/customer/book-services')}
            onMyBookings={() => navigate('/customer/bookings')}
            onWriteReview={() => navigate('/customer/reviews')}
            upcomingCount={bookingStats.upcoming}
          />

          {/* Stats Overview */}
          <StatsOverview stats={bookingStats} loading={loading} favoritesCount={favoritesCount} />

          {/* Error Display */}
          {error && (
            <FadeSection>
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700">{error}</p>
                <button onClick={handleRefresh} className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900">Retry</button>
              </div>
            </FadeSection>
          )}

          {/* Promos Section */}
          {activeOffers.length > 0 && (
            <FadeSection delay={150}>
              <SectionHeader
                title="Special Offers"
                icon={<Ticket className="w-5 h-5" />}
                subtitle="Exclusive deals for you"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {activeOffers.map((offer) => {
                  const gradientColors = offer.displayGradient?.split(' ') || ['from-nilin-coral/15', 'to-nilin-rose/10'];
                  const gradientFrom = gradientColors[0] || 'from-nilin-coral/15';
                  const gradientTo = gradientColors[gradientColors.length - 1] || 'to-nilin-rose/10';

                  return (
                    <div
                      key={offer._id}
                      className={`group relative overflow-hidden rounded-2xl border border-nilin-border/40 bg-gradient-to-br ${gradientFrom} ${gradientTo} p-5 cursor-pointer hover:shadow-nilin-xl hover:-translate-y-1 transition-all duration-300`}
                      onClick={() => navigate(`/offer/${offer._id}`)}
                    >
                      {/* Decorative elements */}
                      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${gradientFrom.replace('/15', '/20').replace('/10', '/20')} to-transparent rounded-bl-full opacity-50`} />
                      <div className={`absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr ${gradientTo} to-transparent rounded-tr-full opacity-50`} />

                      <div className="relative flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradientFrom} flex items-center justify-center text-white shadow-lg`}>
                          <Sparkle className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                          {offer.displayBadge && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2.5 py-0.5 bg-gradient-to-r ${gradientFrom.replace('/15', '/20').replace('/10', '/20')} ${gradientTo.replace('/15', '/20').replace('/10', '/20')} text-xs font-semibold rounded-full`}>
                                {offer.displayBadge}
                              </span>
                            </div>
                          )}
                          <h3 className="font-semibold text-nilin-charcoal mb-1">{offer.displayTitle || offer.title}</h3>
                          <p className="text-sm text-nilin-warmGray leading-relaxed">
                            {offer.displaySubtitle || offer.description || `${offer.value}${offer.type === 'percentage' ? '%' : ' AED'} off`}
                          </p>
                          <div className="mt-3 flex items-center gap-1 text-nilin-coral text-sm font-medium group-hover:gap-2 transition-all">
                            <span>{offer.isClaimed ? 'View details' : 'Claim offer'}</span>
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </FadeSection>
          )}

          {/* Recent Bookings Section */}
          <FadeSection delay={175}>
            <SectionHeader
              title="Recent Bookings"
              icon={<Calendar className="w-5 h-5" />}
              badge={`${dashboardData?.recentBookings?.length || 0} bookings`}
              action={{ label: 'View all', onClick: () => navigate('/customer/bookings') }}
            />
            <RecentBookingsTable
              bookings={dashboardData?.recentBookings || []}
              loading={loading}
              onViewAll={() => navigate('/customer/bookings')}
              navigate={navigate}
            />
          </FadeSection>

          {/* Ongoing Bookings Section - Shows active in-progress bookings */}
          {bookingStats.inProgressBookings > 0 && (
            <FadeSection delay={185}>
              <OngoingBookings limit={3} showViewAll={true} />
            </FadeSection>
          )}

          {/* Packages Section */}
          <FadeSection delay={200}>
            <PackagesSection limit={3} showViewAll={true} />
          </FadeSection>

          {/* Recommended Professionals Section */}
          <FadeSection delay={212}>
            <RecommendedProsSection limit={6} showViewAll={true} />
          </FadeSection>

          {/* Recommended Services Section */}
          <FadeSection delay={225}>
            <SectionHeader
              title="Recommended for You"
              icon={<Sparkles className="w-5 h-5" />}
              badge="Based on your preferences"
              action={{
                label: 'View all',
                onClick: () => navigate('/customer/book-services'),
              }}
            />

            {/* Content based on state */}
            {error ? (
              <DashboardError onRetry={handleRefresh} />
            ) : loading ? (
              <ServiceListSkeleton />
            ) : recentServices.length > 0 ? (
              <div className="space-y-3">
                {recentServices.map((service, index) => (
                  <ServiceCard
                    key={service._id}
                    service={service}
                    index={index}
                    onNavigate={(id) => navigate(`/services/${id}`)}
                    providerId={service.provider?._id || service.providerId}
                  />
                ))}
              </div>
            ) : (
              <EmptyServices onBrowse={() => navigate('/customer/book-services')} />
            )}
          </FadeSection>

          {/* Recent Activity Section */}
          <FadeSection delay={250}>
            <RecentActivity limit={5} showViewAll={true} />
          </FadeSection>

          {/* Notifications Section */}
          <FadeSection delay={275}>
            <NotificationsSection limit={5} showViewAll={true} />
          </FadeSection>

          {/* Bottom spacing for mobile nav */}
          <div className="h-24 md:h-8" />
        </main>
      </DashboardErrorBoundary>

      <Footer />

      {/* View Pro Modal */}
      <ViewProModal
        open={showViewProModal}
        onOpenChange={setShowViewProModal}
      />
    </div>
  );
};

export default CustomerDashboard;
