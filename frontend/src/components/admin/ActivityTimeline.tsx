/**
 * ActivityTimeline - Shared component for displaying chronological activity feeds
 *
 * Features:
 * - Chronological activity display with icons per type
 * - Relative and absolute timestamps
 * - Grouped by date
 * - Filter by activity type
 * - Load more pagination
 * - Empty state
 *
 * @example
 * ```tsx
 * <ActivityTimeline
 *   activities={activities}
 *   loading={loading}
 *   maxItems={50}
 *   filterTypes={['booking_created', 'booking_cancelled']}
 *   onLoadMore={fetchMore}
 *   hasMore={hasMore}
 * />
 * ```
 */

import React, { useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  LogIn,
  LogOut,
  CalendarPlus,
  CalendarX,
  CalendarCheck,
  Star,
  CheckCircle,
  RotateCcw,
  Check,
  X,
  AlertTriangle,
  Shield,
  User,
  CreditCard,
  AlertCircle,
  MessageSquare,
  ChevronDown,
  Loader2,
  Filter,
  Inbox,
  ExternalLink,
} from 'lucide-react';
import type {
  Activity,
  ActivityType,
  ActivityFilter,
  ActivityGroup,
  ActivityTimelineProps,
  ACTIVITY_CONFIG,
} from '../../types/activity';

// Icon mapping
const iconMap: Record<string, React.ReactNode> = {
  LogIn: <LogIn className="w-4 h-4" />,
  LogOut: <LogOut className="w-4 h-4" />,
  CalendarPlus: <CalendarPlus className="w-4 h-4" />,
  CalendarX: <CalendarX className="w-4 h-4" />,
  CalendarCheck: <CalendarCheck className="w-4 h-4" />,
  Star: <Star className="w-4 h-4" />,
  CheckCircle: <CheckCircle className="w-4 h-4" />,
  RotateCcw: <RotateCcw className="w-4 h-4" />,
  Check: <Check className="w-4 h-4" />,
  X: <X className="w-4 h-4" />,
  AlertTriangle: <AlertTriangle className="w-4 h-4" />,
  Shield: <Shield className="w-4 h-4" />,
  User: <User className="w-4 h-4" />,
  CreditCard: <CreditCard className="w-4 h-4" />,
  AlertCircle: <AlertCircle className="w-4 h-4" />,
  MessageSquare: <MessageSquare className="w-4 h-4" />,
};

// Activity type configuration
const activityConfig: Record<ActivityType, {
  icon: string;
  color: string;
  bgColor: string;
  label: string;
}> = {
  login: {
    icon: 'LogIn',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Login',
  },
  logout: {
    icon: 'LogOut',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Logout',
  },
  booking_created: {
    icon: 'CalendarPlus',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Booking Created',
  },
  booking_cancelled: {
    icon: 'CalendarX',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Booking Cancelled',
  },
  booking_completed: {
    icon: 'CalendarCheck',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    label: 'Booking Completed',
  },
  review_given: {
    icon: 'Star',
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Review Given',
  },
  review_moderated: {
    icon: 'CheckCircle',
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
    label: 'Review Moderated',
  },
  refund_requested: {
    icon: 'RotateCcw',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    label: 'Refund Requested',
  },
  refund_approved: {
    icon: 'Check',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Refund Approved',
  },
  refund_rejected: {
    icon: 'X',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Refund Rejected',
  },
  dispute_opened: {
    icon: 'AlertTriangle',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Dispute Opened',
  },
  dispute_resolved: {
    icon: 'Shield',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Dispute Resolved',
  },
  profile_updated: {
    icon: 'User',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Profile Updated',
  },
  payment_made: {
    icon: 'CreditCard',
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Payment Made',
  },
  payment_failed: {
    icon: 'AlertCircle',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Payment Failed',
  },
  message_sent: {
    icon: 'MessageSquare',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Message Sent',
  },
};

// Grouped activity types for filter dropdown
const activityGroups = {
  authentication: ['login', 'logout'] as ActivityType[],
  bookings: ['booking_created', 'booking_cancelled', 'booking_completed'] as ActivityType[],
  reviews: ['review_given', 'review_moderated'] as ActivityType[],
  refunds: ['refund_requested', 'refund_approved', 'refund_rejected'] as ActivityType[],
  disputes: ['dispute_opened', 'dispute_resolved'] as ActivityType[],
  payments: ['payment_made', 'payment_failed'] as ActivityType[],
  messages: ['message_sent'] as ActivityType[],
  profile: ['profile_updated'] as ActivityType[],
};

/**
 * Format a date as relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

/**
 * Format a date for grouping (e.g., "Today", "Yesterday", "June 15, 2024")
 */
function formatDateGroup(date: Date): { date: string; label: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (targetDate.getTime() === today.getTime()) {
    return { date: 'today', label: 'Today' };
  }
  if (targetDate.getTime() === yesterday.getTime()) {
    return { date: 'yesterday', label: 'Yesterday' };
  }
  return {
    date: date.toISOString().split('T')[0],
    label: date.toLocaleDateString('en-US', {
      weekday: targetDate.getDay() === now.getDay() ? undefined : 'long',
      month: 'long',
      day: 'numeric',
      year: targetDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }),
  };
}

/**
 * Activity Item Component
 */
const ActivityItem: React.FC<{
  activity: Activity;
  isLast?: boolean;
}> = ({ activity, isLast }) => {
  const config = activityConfig[activity.type] || {
    icon: 'AlertCircle',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Activity',
  };

  const timestamp = useMemo(() => {
    const date = new Date(activity.timestamp || activity.createdAt || new Date());
    return {
      relative: formatRelativeTime(date),
      absolute: date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    };
  }, [activity.timestamp, activity.createdAt]);

  return (
    <div className="relative pl-8 sm:pl-12">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[11px] sm:left-[15px] top-8 bottom-0 w-0.5 bg-gray-200" />
      )}

      {/* Icon */}
      <div
        className={cn(
          'absolute left-0 sm:left-1 top-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center',
          config.bgColor,
          config.color
        )}
      >
        {iconMap[config.icon]}
      </div>

      {/* Content */}
      <div className="pb-6 sm:pb-8">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-nilin-charcoal leading-relaxed">
              {activity.description}
            </p>

            {/* Actor info */}
            {activity.actor && (
              <div className="flex items-center gap-2 mt-1.5">
                {activity.actor.avatar ? (
                  <img
                    src={activity.actor.avatar}
                    alt={activity.actor.name}
                    className="w-4 h-4 rounded-full"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                    <span className="text-[8px] text-nilin-coral font-medium">
                      {activity.actor.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-xs text-nilin-warmGray">
                  {activity.actor.name}
                  {activity.actor.role && (
                    <span className="ml-1 text-nilin-coral/70">({activity.actor.role})</span>
                  )}
                </span>
              </div>
            )}

            {/* Entity link */}
            {activity.entity && (
              <a
                href={activity.entity.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-1.5 text-xs text-nilin-coral hover:underline"
              >
                {activity.entity.name}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Timestamp */}
          <time
            dateTime={new Date(activity.timestamp || activity.createdAt || new Date()).toISOString()}
            className="text-xs text-nilin-warmGray whitespace-nowrap"
            title={timestamp.absolute}
          >
            {timestamp.relative}
          </time>
        </div>
      </div>
    </div>
  );
};

/**
 * Activity Group Component
 */
const ActivityGroupComponent: React.FC<{
  group: ActivityGroup;
  isLast?: boolean;
}> = ({ group, isLast }) => {
  return (
    <div className={cn(!isLast && 'mb-6')}>
      {/* Date header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm py-2 mb-2">
        <h4 className="text-xs font-semibold text-nilin-warmGray uppercase tracking-wider">
          {group.label}
        </h4>
      </div>

      {/* Activities */}
      <div className="space-y-0">
        {group.activities.map((activity, index) => (
          <ActivityItem
            key={activity._id}
            activity={activity}
            isLast={index === group.activities.length - 1}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Filter Dropdown Component
 */
const FilterDropdown: React.FC<{
  selectedTypes: ActivityType[];
  onTypesChange: (types: ActivityType[]) => void;
}> = ({ selectedTypes, onTypesChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleType = (type: ActivityType) => {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter((t) => t !== type));
    } else {
      onTypesChange([...selectedTypes, type]);
    }
  };

  const clearAll = () => {
    onTypesChange([]);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors',
          selectedTypes.length > 0
            ? 'border-nilin-coral bg-nilin-coral/5 text-nilin-coral'
            : 'border-gray-200 text-nilin-warmGray hover:border-gray-300 hover:text-nilin-charcoal'
        )}
      >
        <Filter className="w-4 h-4" />
        <span>Filter</span>
        {selectedTypes.length > 0 && (
          <span className="px-1.5 py-0.5 text-xs bg-nilin-coral text-white rounded-full">
            {selectedTypes.length}
          </span>
        )}
        <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-20 max-h-80 overflow-y-auto">
            <div className="px-3 pb-2 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-nilin-charcoal">Filter by type</span>
                {selectedTypes.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-nilin-coral hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {Object.entries(activityGroups).map(([groupName, types]) => (
              <div key={groupName} className="py-1">
                <p className="px-3 py-1 text-xs font-medium text-nilin-warmGray uppercase tracking-wider">
                  {groupName}
                </p>
                {types.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={() => toggleType(type)}
                      className="w-4 h-4 text-nilin-coral rounded border-gray-300 focus:ring-nilin-coral"
                    />
                    <span className="text-sm text-nilin-charcoal">
                      {activityConfig[type].label}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * Empty State Component
 */
const EmptyState: React.FC<{
  message?: string;
}> = ({ message }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4">
    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
      <Inbox className="w-8 h-8 text-gray-400" />
    </div>
    <h3 className="text-lg font-medium text-nilin-charcoal mb-1">No activity yet</h3>
    <p className="text-sm text-nilin-warmGray text-center max-w-xs">
      {message || 'Activity for this entity will appear here'}
    </p>
  </div>
);

/**
 * Loading Skeleton
 */
const LoadingSkeleton: React.FC = () => (
  <div className="space-y-0">
    {[1, 2, 3, 4, 5].map((i) => (
      <div key={i} className="relative pl-8 sm:pl-12 pb-8">
        <div className="absolute left-0 sm:left-1 top-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-200 animate-pulse" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * ActivityTimeline Component
 */
export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  loading = false,
  maxItems,
  filterTypes,
  onLoadMore,
  hasMore = false,
  onFilterChange,
  currentFilter,
  emptyMessage,
  className,
}) => {
  const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>(
    currentFilter?.types || filterTypes || []
  );

  // Filter activities
  const filteredActivities = useMemo(() => {
    let result = [...activities];

    if (selectedTypes.length > 0) {
      result = result.filter((a) => selectedTypes.includes(a.type));
    }

    if (maxItems && maxItems > 0) {
      result = result.slice(0, maxItems);
    }

    return result;
  }, [activities, selectedTypes, maxItems]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityGroup> = {};

    filteredActivities.forEach((activity) => {
      const date = new Date(activity.timestamp || activity.createdAt || new Date());
      const { date: dateKey, label } = formatDateGroup(date);

      if (!groups[dateKey]) {
        groups[dateKey] = {
          date: dateKey,
          label,
          activities: [],
        };
      }
      groups[dateKey].activities.push(activity);
    });

    // Sort groups by date (newest first)
    return Object.values(groups).sort((a, b) => {
      if (a.date === 'today') return -1;
      if (b.date === 'today') return 1;
      if (a.date === 'yesterday') return -1;
      if (b.date === 'yesterday') return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [filteredActivities]);

  // Handle filter change
  const handleTypesChange = (types: ActivityType[]) => {
    setSelectedTypes(types);
    onFilterChange?.({ types });
  };

  return (
    <div className={cn('bg-white rounded-xl', className)}>
      {/* Header */}
      {(filterTypes || onFilterChange) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-nilin-charcoal">Activity</h3>
          <FilterDropdown
            selectedTypes={selectedTypes}
            onTypesChange={handleTypesChange}
          />
        </div>
      )}

      {/* Content */}
      <div className="p-4 max-h-[500px] overflow-y-auto">
        {loading ? (
          <LoadingSkeleton />
        ) : filteredActivities.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <>
            {groupedActivities.map((group, index) => (
              <ActivityGroupComponent
                key={group.date}
                group={group}
                isLast={index === groupedActivities.length - 1}
              />
            ))}

            {/* Load more button */}
            {hasMore && onLoadMore && (
              <div className="pt-4 text-center">
                <button
                  onClick={onLoadMore}
                  className="px-4 py-2 text-sm text-nilin-coral hover:bg-nilin-coral/5 rounded-lg transition-colors"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityTimeline;
