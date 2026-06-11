/**
 * RecentActivity Component
 * Timeline-style activity feed showing recent user activities
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CreditCard,
  Star,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Bell,
  RefreshCw,
  AlertCircle,
  ChevronRight,
  Activity,
  ArrowRight,
  Play,
  Sparkles,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import { useAuthStore } from '../../stores/authStore';
import { customerDashboardApi } from '../../services/customerDashboardApi';
import { escapeHtml } from '../../lib/security';
import { usePriceConversion } from '../../utils/priceConverter';

// =============================================================================
// Types
// =============================================================================

// Backend activity types (generic categories from API)
type BackendActivityType = 'booking' | 'payment' | 'review' | 'loyalty' | 'streak';

// Frontend activity types (specific compound types for UI)
type ActivityType =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_started'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'payment_received'
  | 'review_submitted'
  | 'review_received'
  | 'message_received'
  | 'promotion_used'
  | 'account_updated'
  | 'booking'
  | 'payment'
  | 'review'
  | 'loyalty'
  | 'streak';

interface Activity {
  _id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  metadata?: {
    bookingId?: string;
    serviceName?: string;
    providerName?: string;
    amount?: number;
    rating?: number;
    bookingNumber?: string;
  };
}

interface RecentActivityProps {
  limit?: number;
  showViewAll?: boolean;
}

// Backend activity item from API response
interface BackendActivityItem {
  _id?: string;
  type: BackendActivityType;
  action: string;
  description: string;
  timestamp: string | Date;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Activity Icons & Colors
// =============================================================================

interface ActivityConfig {
  icon: React.ElementType;
  iconClass: string;
  iconBg: string;
  accent: string;
  badgeClass: string;
}

const ACTIVITY_CONFIG: Record<ActivityType, ActivityConfig> = {
  booking_created: {
    icon: Calendar,
    iconClass: 'text-sky-600',
    iconBg: 'bg-sky-50 ring-sky-100',
    accent: 'bg-sky-400',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-100',
  },
  booking_confirmed: {
    icon: CheckCircle2,
    iconClass: 'text-nilin-coral',
    iconBg: 'bg-nilin-blush/60 ring-nilin-coral/20',
    accent: 'bg-nilin-coral',
    badgeClass: 'bg-nilin-blush/50 text-nilin-coral border-nilin-coral/20',
  },
  booking_started: {
    icon: Play,
    iconClass: 'text-violet-600',
    iconBg: 'bg-violet-50 ring-violet-100',
    accent: 'bg-violet-400',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-100',
  },
  booking_completed: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-600',
    iconBg: 'bg-emerald-50 ring-emerald-100',
    accent: 'bg-emerald-400',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  },
  booking_cancelled: {
    icon: XCircle,
    iconClass: 'text-red-600',
    iconBg: 'bg-red-50 ring-red-100',
    accent: 'bg-red-400',
    badgeClass: 'bg-red-50 text-red-700 border-red-100',
  },
  booking_rescheduled: {
    icon: Clock,
    iconClass: 'text-amber-600',
    iconBg: 'bg-amber-50 ring-amber-100',
    accent: 'bg-amber-400',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  payment_received: {
    icon: CreditCard,
    iconClass: 'text-nilin-coral',
    iconBg: 'bg-nilin-blush/60 ring-nilin-coral/20',
    accent: 'bg-nilin-rose',
    badgeClass: 'bg-nilin-blush/50 text-nilin-rose border-nilin-rose/20',
  },
  review_submitted: {
    icon: Star,
    iconClass: 'text-amber-600',
    iconBg: 'bg-amber-50 ring-amber-100',
    accent: 'bg-amber-400',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  review_received: {
    icon: Star,
    iconClass: 'text-amber-600',
    iconBg: 'bg-amber-50 ring-amber-100',
    accent: 'bg-amber-400',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  message_received: {
    icon: MessageSquare,
    iconClass: 'text-cyan-600',
    iconBg: 'bg-cyan-50 ring-cyan-100',
    accent: 'bg-cyan-400',
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  },
  promotion_used: {
    icon: Sparkles,
    iconClass: 'text-nilin-coral',
    iconBg: 'bg-nilin-blush/60 ring-nilin-coral/20',
    accent: 'bg-nilin-coral',
    badgeClass: 'bg-nilin-blush/50 text-nilin-coral border-nilin-coral/20',
  },
  account_updated: {
    icon: Bell,
    iconClass: 'text-nilin-warmGray',
    iconBg: 'bg-nilin-blush/40 ring-nilin-border/30',
    accent: 'bg-nilin-warmGray/40',
    badgeClass: 'bg-nilin-blush/40 text-nilin-charcoal border-nilin-border/40',
  },
  booking: {
    icon: Calendar,
    iconClass: 'text-sky-600',
    iconBg: 'bg-sky-50 ring-sky-100',
    accent: 'bg-sky-400',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-100',
  },
  payment: {
    icon: CreditCard,
    iconClass: 'text-nilin-coral',
    iconBg: 'bg-nilin-blush/60 ring-nilin-coral/20',
    accent: 'bg-nilin-rose',
    badgeClass: 'bg-nilin-blush/50 text-nilin-rose border-nilin-rose/20',
  },
  review: {
    icon: Star,
    iconClass: 'text-amber-600',
    iconBg: 'bg-amber-50 ring-amber-100',
    accent: 'bg-amber-400',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-100',
  },
  loyalty: {
    icon: TrendingUp,
    iconClass: 'text-nilin-coral',
    iconBg: 'bg-nilin-blush/60 ring-nilin-coral/20',
    accent: 'bg-nilin-coral',
    badgeClass: 'bg-nilin-blush/50 text-nilin-coral border-nilin-coral/20',
  },
  streak: {
    icon: Activity,
    iconClass: 'text-orange-600',
    iconBg: 'bg-orange-50 ring-orange-100',
    accent: 'bg-orange-400',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-100',
  },
};

const parseActivityDescription = (
  description: string,
): { serviceName?: string; providerName?: string } => {
  const match = description.match(/^(.+?)\s+with\s+(.+)$/i);
  if (!match) return {};
  return { serviceName: match[1].trim(), providerName: match[2].trim() };
};

const ActivityAmount: React.FC<{ amount: number }> = ({ amount }) => {
  const { convert, format, currency } = usePriceConversion();
  const converted = convert(amount, 'AED');
  return (
    <span className="text-sm font-semibold text-nilin-coral tabular-nums">
      {format(converted, currency)}
    </span>
  );
};

// =============================================================================
// Backend to Frontend Type Mapping
// =============================================================================

/**
 * Maps backend activity type + action to frontend compound ActivityType.
 * Backend format: { type: 'booking', action: 'Created' }
 * Frontend format: 'booking_created'
 */
const mapBackendTypeToFrontend = (
  backendType: BackendActivityType,
  action: string
): ActivityType => {
  const actionLower = action.toLowerCase();

  // Booking actions
  if (backendType === 'booking') {
    if (actionLower.includes('started') || actionLower.includes('in progress')) {
      return 'booking_started';
    }
    if (actionLower.includes('confirmed')) {
      return 'booking_confirmed';
    }
    if (actionLower.includes('created')) {
      return 'booking_created';
    }
    if (actionLower.includes('completed')) {
      return 'booking_completed';
    }
    if (actionLower.includes('cancelled') || actionLower.includes('no show')) {
      return 'booking_cancelled';
    }
    if (actionLower.includes('rescheduled') || actionLower.includes('reschedule')) {
      return 'booking_rescheduled';
    }
  }

  // Payment actions
  if (backendType === 'payment') {
    if (actionLower.includes('received') || actionLower.includes('completed') || actionLower.includes('paid')) {
      return 'payment_received';
    }
  }

  // Review actions
  if (backendType === 'review') {
    if (actionLower.includes('submitted') || actionLower.includes('your')) {
      return 'review_submitted';
    }
    if (actionLower.includes('received') || actionLower.includes('from')) {
      return 'review_received';
    }
  }

  // Loyalty actions - map to promotion_used or account_updated
  if (backendType === 'loyalty') {
    if (actionLower.includes('used') || actionLower.includes('redeemed') || actionLower.includes('coupon')) {
      return 'promotion_used';
    }
  }

  // Streak actions - map to account_updated
  if (backendType === 'streak') {
    return 'account_updated';
  }

  // Fallback to backend type as-is
  return backendType;
};

/**
 * Transforms backend activity item to frontend Activity format.
 */
const transformBackendActivity = (
  item: BackendActivityItem,
  index: number
): Activity => {
  const frontendType = mapBackendTypeToFrontend(item.type, item.action);

  // Handle metadata transformation
  const metadata: Activity['metadata'] = {};
  if (item.metadata) {
    if (item.metadata.bookingId) metadata.bookingId = String(item.metadata.bookingId);
    if (item.metadata.serviceName) metadata.serviceName = String(item.metadata.serviceName);
    if (item.metadata.providerName) metadata.providerName = String(item.metadata.providerName);
    if (item.metadata.amount) metadata.amount = Number(item.metadata.amount);
    if (item.metadata.rating) metadata.rating = Number(item.metadata.rating);
    if (item.metadata.bookingNumber) metadata.bookingNumber = String(item.metadata.bookingNumber);
  }

  const parsed = parseActivityDescription(item.description);
  if (!metadata.serviceName && parsed.serviceName) metadata.serviceName = parsed.serviceName;
  if (!metadata.providerName && parsed.providerName) metadata.providerName = parsed.providerName;

  // Generate stable fallback ID: combine available fields with index
  // This prevents React re-render issues when _id is missing from API
  const stableId = item._id?.toString()
    || `activity-${item.type}-${item.action}-${item.timestamp}-${index}`;

  return {
    _id: stableId,
    type: frontendType,
    title: item.action,
    description: item.description,
    timestamp: item.timestamp instanceof Date
      ? item.timestamp.toISOString()
      : String(item.timestamp),
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
  };
};

// =============================================================================
// Component
// =============================================================================

const RecentActivity: React.FC<RecentActivityProps> = ({
  limit = 5,
  showViewAll = true,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fetchInFlightRef = useRef(false);

  const fetchActivities = useCallback(async (signal?: AbortSignal, options?: { silent?: boolean }) => {
    if (!isAuthenticated) {
      if (!signal?.aborted) {
        setError('Please log in to view your activities.');
        setIsLoading(false);
      }
      return;
    }

    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;

    if (!options?.silent) {
      setIsLoading(true);
    }

    try {
      setError(null);
      const data = await customerDashboardApi.getActivityFeed(limit, signal);

      if (signal?.aborted) return;

      if (data && Array.isArray(data)) {
        const transformedActivities: Activity[] = data.map(
          (item: BackendActivityItem, index: number) => transformBackendActivity(item, index),
        );
        setActivities(transformedActivities);
      } else {
        setActivities([]);
      }
    } catch (err) {
      if (signal?.aborted) return;

      console.error('Activity fetch failed:', err);

      const errorMessage = ((): string => {
        if (
          err
          && typeof err === 'object'
          && 'response' in err
          && (err as { response?: { status?: number } }).response?.status === 401
        ) {
          return 'Your session has expired. Please log in again.';
        }
        return err instanceof Error ? err.message : 'Failed to load activities. Please try again.';
      })();

      setError(errorMessage);
    } finally {
      fetchInFlightRef.current = false;
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [limit, isAuthenticated]);

  useEffect(() => {
    const controller = new AbortController();
    fetchActivities(controller.signal);

    return () => {
      controller.abort();
      fetchInFlightRef.current = false;
    };
  }, [fetchActivities]);

  const handleRefresh = async () => {
    if (fetchInFlightRef.current) return;
    setIsRefreshing(true);
    await fetchActivities(undefined, { silent: true });
    setIsRefreshing(false);
  };

  const handleActivityClick = (activity: Activity) => {
    // Navigate based on activity type
    if (activity.metadata?.bookingId) {
      navigate(`/customer/bookings/${activity.metadata.bookingId}`);
    } else if (activity.type === 'message_received') {
      navigate('/customer/messages');
    } else if (activity.type === 'review_submitted' || activity.type === 'review_received') {
      navigate('/customer/reviews');
    } else {
      navigate('/customer/activity');
    }
  };

  const handleViewAll = () => {
    navigate('/customer/activity');
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  if (isLoading) {
    return (
      <section className="py-10 px-4" aria-busy="true" aria-label="Loading recent activity">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-8 animate-pulse">
            <div>
              <div className="h-8 bg-nilin-border/40 rounded-lg w-44 mb-2" />
              <div className="h-4 bg-nilin-border/25 rounded w-56" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-nilin-border/30 animate-pulse"
              >
                <div className="w-11 h-11 rounded-xl bg-nilin-blush/60" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-nilin-border/40 rounded w-32" />
                  <div className="h-3 bg-nilin-border/25 rounded w-2/3" />
                </div>
                <div className="h-4 bg-nilin-border/25 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-red-700 mb-1">Unable to load activity</h3>
            <p className="text-sm text-red-600/80 mb-4">{error}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2 bg-nilin-coral hover:bg-nilin-rose text-white rounded-xl text-sm font-medium transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (activities.length === 0) {
    return (
      <section className="py-10 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-nilin-blush/30 via-white to-nilin-cream/40 rounded-2xl p-10 text-center border border-nilin-border/40">
            <div className="w-14 h-14 rounded-2xl bg-nilin-coral/10 mx-auto mb-4 flex items-center justify-center">
              <Activity className="w-7 h-7 text-nilin-coral" />
            </div>
            <h3 className="text-lg font-serif text-nilin-charcoal mb-2">No recent activity</h3>
            <p className="text-sm text-nilin-warmGray max-w-sm mx-auto">
              Bookings, payments, and reviews will show up here as you use NILIN.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-10 px-4" aria-labelledby="activity-heading">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-5 h-5 text-nilin-coral" />
              <h2
                id="activity-heading"
                className="text-2xl md:text-3xl font-serif text-nilin-charcoal"
              >
                Recent Activity
              </h2>
              <span className="px-2.5 py-0.5 bg-nilin-blush/60 text-nilin-coral text-xs font-semibold rounded-full">
                {activities.length}
              </span>
            </div>
            <p className="text-sm text-nilin-warmGray">
              Your latest bookings and updates
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {showViewAll && (
              <button
                type="button"
                onClick={handleViewAll}
                className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2.5 rounded-nilin text-sm font-semibold text-white bg-gradient-to-r from-nilin-coral to-nilin-rose shadow-sm hover:shadow-md transition-all"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl border border-nilin-border/50 text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-blush/40 transition-colors disabled:opacity-50"
              aria-label="Refresh activity"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Activity feed */}
        <div className="rounded-2xl border border-nilin-border/40 bg-gradient-to-b from-white to-nilin-blush/10 overflow-hidden">
          <div className="divide-y divide-nilin-border/30">
            {activities.map((activity, index) => {
              const config = ACTIVITY_CONFIG[activity.type];
              if (!config) return null;

              const Icon = config.icon;
              const isLatest = index === 0;
              const serviceName = activity.metadata?.serviceName;
              const providerName = activity.metadata?.providerName;

              return (
                <article
                  key={activity._id}
                  className={`group relative flex items-center gap-4 px-4 py-4 sm:px-5 sm:py-5 transition-all duration-200 cursor-pointer hover:bg-nilin-blush/20 ${
                    isLatest ? 'bg-white' : 'bg-white/70'
                  }`}
                  onClick={() => handleActivityClick(activity)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleActivityClick(activity);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`${activity.title}: ${activity.description}`}
                >
                  {/* Left accent */}
                  <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${config.accent} opacity-80`} />

                  {/* Icon */}
                  <div
                    className={`relative z-10 flex-shrink-0 w-11 h-11 rounded-xl ring-1 flex items-center justify-center ${config.iconBg}`}
                  >
                    <Icon className={`w-5 h-5 ${config.iconClass}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.badgeClass}`}
                      >
                        {escapeHtml(activity.title)}
                      </span>
                      {isLatest && (
                        <span className="text-[10px] uppercase tracking-wide font-bold text-nilin-coral">
                          Latest
                        </span>
                      )}
                    </div>

                    {serviceName ? (
                      <>
                        <p className="font-medium text-nilin-charcoal text-sm sm:text-base truncate">
                          {escapeHtml(serviceName)}
                        </p>
                        {providerName && (
                          <p className="text-sm text-nilin-warmGray truncate">
                            with {escapeHtml(providerName)}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-nilin-charcoal line-clamp-2">
                        {escapeHtml(activity.description)}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {activity.metadata?.amount != null && activity.metadata.amount > 0 && (
                        <ActivityAmount amount={activity.metadata.amount} />
                      )}
                      {activity.metadata?.rating != null && (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {activity.metadata.rating.toFixed(1)}
                        </span>
                      )}
                      {activity.metadata?.bookingNumber && (
                        <span className="text-xs text-nilin-warmGray font-mono">
                          #{activity.metadata.bookingNumber.slice(-8).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Time + chevron */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1 pl-2">
                    <span className="text-xs text-nilin-warmGray whitespace-nowrap">
                      {formatTimestamp(activity.timestamp)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-nilin-border group-hover:text-nilin-coral group-hover:translate-x-0.5 transition-all" />
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {showViewAll && (
          <div className="mt-6 text-center sm:hidden">
            <button
              type="button"
              onClick={handleViewAll}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-nilin-coral to-nilin-rose text-white rounded-xl text-sm font-semibold transition-colors"
            >
              View all activity
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default RecentActivity;
