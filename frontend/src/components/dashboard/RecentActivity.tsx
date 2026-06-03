/**
 * RecentActivity Component
 * Timeline-style activity feed showing recent user activities
 */
import React, { useState, useEffect, useCallback } from 'react';
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
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useAuthStore } from '../../stores/authStore';

// =============================================================================
// Types
// =============================================================================

// Backend activity types (generic categories from API)
type BackendActivityType = 'booking' | 'payment' | 'review' | 'loyalty' | 'streak';

// Frontend activity types (specific compound types for UI)
type ActivityType =
  | 'booking_created'
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

const ACTIVITY_CONFIG: Record<
  ActivityType,
  { icon: React.ElementType; color: string; bgColor: string }
> = {
  booking_created: {
    icon: Calendar,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  booking_completed: {
    icon: CheckCircle2,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
  },
  booking_cancelled: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
  },
  booking_rescheduled: {
    icon: Clock,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  payment_received: {
    icon: CreditCard,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  review_submitted: {
    icon: Star,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  review_received: {
    icon: Star,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  message_received: {
    icon: MessageSquare,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-100',
  },
  promotion_used: {
    icon: TrendingUp,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
  },
  account_updated: {
    icon: Bell,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
  },
  booking: {
    icon: Calendar,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  // Backend type fallbacks
  payment: {
    icon: CreditCard,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  review: {
    icon: Star,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
  },
  loyalty: {
    icon: TrendingUp,
    color: 'text-pink-600',
    bgColor: 'bg-pink-100',
  },
  streak: {
    icon: Bell,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
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
    if (actionLower.includes('created') || actionLower.includes('confirmed')) {
      return 'booking_created';
    }
    if (actionLower.includes('completed')) {
      return 'booking_completed';
    }
    if (actionLower.includes('cancelled')) {
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
const transformBackendActivity = (item: BackendActivityItem): Activity => {
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

  return {
    _id: item._id?.toString() || Math.random().toString(),
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
  const { user, tokens } = useAuthStore();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      setError(null);
      // Fetch from real API
      const response = await fetch(`/api/dashboard/activity?limit=${limit}`, {
        headers: { Authorization: `Bearer ${tokens?.accessToken}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          // Transform backend data to frontend format using proper type mapping
          const transformedActivities: Activity[] = data.data.map(
            (item: BackendActivityItem) => transformBackendActivity(item)
          );
          setActivities(transformedActivities);
          return;
        }
      }

      // API returned no data - show empty state
      setError('Failed to load activities. Please try again.');
    } catch (err) {
      console.error('Activity fetch failed:', err);
      setError('Failed to load activities. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchActivities();
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
      return formatDistanceToNow(parseISO(timestamp), { addSuffix: true });
    } catch {
      return 'Recently';
    }
  };

  if (isLoading) {
    return (
      <section className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header Skeleton */}
          <div className="flex items-center justify-between mb-4">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded-lg w-40 mb-1.5" />
              <div className="h-4 bg-gray-100 rounded w-56" />
            </div>
          </div>

          {/* Activity Items Skeleton */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 animate-pulse"
              >
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 rounded-xl p-5 text-center border border-red-100">
            <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (activities.length === 0) {
    return (
      <section className="py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-8 text-center border border-gray-200">
            <Clock className="w-10 h-10 text-gray-400 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              No Recent Activity
            </h3>
            <p className="text-sm text-gray-500">
              Your recent bookings and updates will appear here.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6" aria-labelledby="activity-heading">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              id="activity-heading"
              className="text-lg font-serif font-light text-nilin-charcoal"
            >
              Recent Activity
            </h2>
            <p className="text-xs text-nilin-warmGray">
              Your latest bookings and updates
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              aria-label="Refresh activity"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
              />
            </button>
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-nilin-rose/30 via-nilin-coral/30 to-transparent" />

          {/* Activity Items */}
          <div className="space-y-3">
            {activities.map((activity, index) => {
              const config = ACTIVITY_CONFIG[activity.type];
              if (!config) {
                return null;
              }
              const Icon = config.icon;
              const isLatest = index === 0;

              return (
                <article
                  key={activity._id}
                  className={`relative flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                    isLatest
                      ? 'bg-white border-nilin-rose/20 shadow-sm hover:shadow-md hover:border-nilin-rose/30'
                      : 'bg-white/60 border-gray-100 hover:bg-white hover:shadow-sm hover:border-gray-200'
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
                  {/* Timeline Dot */}
                  <div
                    className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ${config.bgColor} flex items-center justify-center`}
                  >
                    <Icon className={`w-5 h-5 ${config.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-sans font-medium text-nilin-charcoal text-sm">
                          {activity.title}
                        </h3>
                        <p className="text-xs text-nilin-warmGray mt-0.5 line-clamp-2">
                          {activity.description}
                        </p>

                        {/* Additional Info */}
                        {activity.metadata && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {activity.metadata.serviceName && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-nilin-blush/50 text-nilin-rose text-xs rounded-full">
                                {activity.metadata.serviceName}
                              </span>
                            )}
                            {activity.metadata.rating && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs rounded-full">
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                {activity.metadata.rating}
                              </span>
                            )}
                            {activity.metadata.amount && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs rounded-full font-medium">
                                AED {activity.metadata.amount}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0 flex items-center gap-2">
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatTimestamp(activity.timestamp)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* View All Button */}
        {showViewAll && activities.length > 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={handleViewAll}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-nilin-coral hover:text-nilin-rose transition-colors"
            >
              View all activity
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default RecentActivity;
