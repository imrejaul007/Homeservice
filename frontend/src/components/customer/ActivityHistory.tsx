import React, { useState, useCallback } from 'react';
import {
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  ChevronDown,
  ChevronRight,
  FileText,
  CreditCard,
  ShoppingBag,
  User,
  Settings,
  LogIn,
  LogOut,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================
// Type Definitions
// ============================================

export type ActivityCategory =
  | 'authentication'
  | 'booking'
  | 'payment'
  | 'profile'
  | 'service'
  | 'review'
  | 'messaging'
  | 'settings'
  | 'admin';

export interface ActivityItem {
  id: string;
  category: ActivityCategory;
  action: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
  status: 'success' | 'failed';
  ipAddress?: string;
  deviceInfo?: {
    type: 'mobile' | 'tablet' | 'desktop';
    browser?: string;
    os?: string;
  };
  location?: {
    country?: string;
    city?: string;
  };
}

export interface ActivityHistoryProps {
  activities: ActivityItem[];
  onExport?: (format: 'csv' | 'json') => Promise<void>;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

// ============================================
// Constants
// ============================================

const CATEGORY_CONFIG: Record<ActivityCategory, { icon: React.ReactNode; color: string; label: string }> = {
  authentication: { icon: <LogIn className="h-4 w-4" />, color: 'text-purple-500', label: 'Authentication' },
  booking: { icon: <ShoppingBag className="h-4 w-4" />, color: 'text-blue-500', label: 'Bookings' },
  payment: { icon: <CreditCard className="h-4 w-4" />, color: 'text-green-500', label: 'Payments' },
  profile: { icon: <User className="h-4 w-4" />, color: 'text-orange-500', label: 'Profile' },
  service: { icon: <Settings className="h-4 w-4" />, color: 'text-teal-500', label: 'Services' },
  review: { icon: <FileText className="h-4 w-4" />, color: 'text-pink-500', label: 'Reviews' },
  messaging: { icon: <FileText className="h-4 w-4" />, color: 'text-indigo-500', label: 'Messages' },
  settings: { icon: <Settings className="h-4 w-4" />, color: 'text-gray-500', label: 'Settings' },
  admin: { icon: <AlertCircle className="h-4 w-4" />, color: 'text-red-500', label: 'Admin' },
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'login': <LogIn className="h-4 w-4" />,
  'logout': <LogOut className="h-4 w-4" />,
  'booking_created': <ShoppingBag className="h-4 w-4" />,
  'booking_completed': <CheckCircle className="h-4 w-4" />,
  'payment_received': <CreditCard className="h-4 w-4" />,
  'profile_updated': <User className="h-4 w-4" />,
  'password_changed': <AlertCircle className="h-4 w-4" />,
};

// ============================================
// Helper Functions
// ============================================

const formatTimestamp = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const formatFullTimestamp = (date: Date): string => {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================
// Activity Group Component
// ============================================

interface ActivityGroupProps {
  date: string;
  activities: ActivityItem[];
  expandedGroups: Set<string>;
  onToggleGroup: (date: string) => void;
  onExport?: (format: 'csv' | 'json') => Promise<void>;
}

const ActivityGroup: React.FC<ActivityGroupProps> = ({
  date,
  activities,
  expandedGroups,
  onToggleGroup,
}) => {
  const isExpanded = expandedGroups.has(date);
  const categoryCounts = activities.reduce((acc, a) => {
    acc[a.category] = (acc[a.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="border-b border-nilin-border last:border-b-0">
      {/* Group Header */}
      <button
        onClick={() => onToggleGroup(date)}
        className="w-full flex items-center justify-between p-4 hover:bg-nilin-blush/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg transition-transform',
            isExpanded ? 'bg-nilin-coral/10 rotate-90' : 'bg-nilin-blush'
          )}>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-nilin-coral" />
            ) : (
              <ChevronRight className="h-4 w-4 text-nilin-warmGray" />
            )}
          </div>
          <div className="text-left">
            <span className="font-medium text-nilin-charcoal">{date}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-nilin-warmGray">
                {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
              </span>
              {Object.entries(categoryCounts).slice(0, 3).map(([cat, count]) => (
                <span key={cat} className="text-xs text-nilin-warmGray bg-nilin-blush/50 px-2 py-0.5 rounded-full">
                  {CATEGORY_CONFIG[cat as ActivityCategory]?.label}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </button>

      {/* Activities List */}
      {isExpanded && (
        <div className="pb-2">
          {activities.map((activity, index) => (
            <div
              key={activity.id}
              className={cn(
                'flex items-start gap-3 px-4 py-3 hover:bg-nilin-blush/20 transition-colors',
                activity.status === 'failed' && 'bg-red-50/50'
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Icon */}
              <div className={cn(
                'p-2 rounded-lg flex-shrink-0',
                CATEGORY_CONFIG[activity.category]?.color,
                activity.status === 'failed' ? 'bg-red-100' : 'bg-nilin-blush/50'
              )}>
                {activity.status === 'failed' ? (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                ) : (
                  ACTION_ICONS[activity.action] || CATEGORY_CONFIG[activity.category]?.icon
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-nilin-charcoal">
                      {activity.description}
                    </p>
                    <p className="text-xs text-nilin-warmGray mt-0.5">
                      {CATEGORY_CONFIG[activity.category]?.label}
                    </p>
                  </div>
                  <span className="text-xs text-nilin-warmGray whitespace-nowrap">
                    {formatTimestamp(activity.timestamp)}
                  </span>
                </div>

                {/* Details Tooltip */}
                {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                  <div className="mt-2 text-xs text-nilin-warmGray bg-nilin-blush/30 rounded-lg p-2">
                    {Object.entries(activity.metadata).slice(0, 3).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="capitalize">{key}:</span>
                        <span className="text-nilin-charcoal">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Location & Device */}
                <div className="flex items-center gap-3 mt-1 text-xs text-nilin-warmGray">
                  {activity.location?.city && (
                    <span>{activity.location.city}</span>
                  )}
                  {activity.deviceInfo && (
                    <span>{activity.deviceInfo.type}</span>
                  )}
                  {activity.ipAddress && (
                    <span className="font-mono">{activity.ipAddress}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// Main Component
// ============================================

const ActivityHistory: React.FC<ActivityHistoryProps> = ({
  activities,
  onExport,
  onRefresh,
  isLoading = false,
  className,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<ActivityCategory>>(new Set());
  const [selectedStatuses, setSelectedStatuses] = useState<Set<'success' | 'failed'>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Today']));
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Filter activities
  const filteredActivities = activities.filter(activity => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!activity.description.toLowerCase().includes(query) &&
          !activity.action.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Category filter
    if (selectedCategories.size > 0 && !selectedCategories.has(activity.category)) {
      return false;
    }

    // Status filter
    if (selectedStatuses.size > 0 && !selectedStatuses.has(activity.status)) {
      return false;
    }

    // Date filter
    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(activity.timestamp) < cutoff) {
        return false;
      }
    }

    return true;
  });

  // Group by date
  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const date = new Date(activity.timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const activityDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let groupKey: string;
    if (activityDate.getTime() === today.getTime()) {
      groupKey = 'Today';
    } else if (activityDate.getTime() === yesterday.getTime()) {
      groupKey = 'Yesterday';
    } else {
      groupKey = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(activity);
    return groups;
  }, {} as Record<string, ActivityItem[]>);

  // Toggle category
  const toggleCategory = useCallback((category: ActivityCategory) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  // Toggle status
  const toggleStatus = useCallback((status: 'success' | 'failed') => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }, []);

  // Toggle group
  const toggleGroup = useCallback((date: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  }, []);

  // Handle export
  const handleExport = useCallback(async (format: 'csv' | 'json') => {
    setShowExportMenu(false);
    await onExport?.(format);
  }, [onExport]);

  return (
    <div className={cn('bg-white rounded-2xl overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 border-b border-nilin-border bg-gradient-to-r from-nilin-blush/50 to-transparent">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-nilin-charcoal">Activity History</h2>
            <p className="text-sm text-nilin-warmGray">
              {filteredActivities.length} of {activities.length} activities
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="p-2 rounded-lg hover:bg-nilin-blush/50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn('h-4 w-4 text-nilin-warmGray', isLoading && 'animate-spin')} />
              </button>
            )}
            {onExport && (
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="p-2 rounded-lg hover:bg-nilin-blush/50 transition-colors"
                >
                  <Download className="h-4 w-4 text-nilin-warmGray" />
                </button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-xl shadow-lg border border-nilin-border py-1 z-10">
                    <button
                      onClick={() => handleExport('csv')}
                      className="w-full px-4 py-2 text-left text-sm text-nilin-charcoal hover:bg-nilin-blush/50"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => handleExport('json')}
                      className="w-full px-4 py-2 text-left text-sm text-nilin-charcoal hover:bg-nilin-blush/50"
                    >
                      Export as JSON
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-nilin-warmGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search activities..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
          />
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-nilin-warmGray" />
            <div className="flex bg-nilin-blush/50 rounded-lg p-1">
              {(['7d', '30d', '90d', 'all'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-md transition-all',
                    dateRange === range
                      ? 'bg-white text-nilin-charcoal shadow-sm'
                      : 'text-nilin-warmGray hover:text-nilin-charcoal'
                  )}
                >
                  {range === 'all' ? 'All' : range}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <Filter className="h-4 w-4 text-nilin-warmGray flex-shrink-0" />
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
              <button
                key={key}
                onClick={() => toggleCategory(key as ActivityCategory)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                  selectedCategories.has(key as ActivityCategory)
                    ? 'bg-nilin-coral text-white'
                    : 'bg-nilin-blush/50 text-nilin-warmGray hover:bg-nilin-blush'
                )}
              >
                <span className={cn(selectedCategories.has(key as ActivityCategory) ? '' : config.color)}>
                  {config.icon}
                </span>
                {config.label}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleStatus('success')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                selectedStatuses.has('success')
                  ? 'bg-green-500 text-white'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              )}
            >
              <CheckCircle className="h-3 w-3" />
              Success
            </button>
            <button
              onClick={() => toggleStatus('failed')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                selectedStatuses.has('failed')
                  ? 'bg-red-500 text-white'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              )}
            >
              <AlertCircle className="h-3 w-3" />
              Failed
            </button>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="max-h-[600px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-nilin-coral" />
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="h-12 w-12 text-nilin-warmGray mx-auto mb-3" />
            <p className="text-nilin-charcoal font-medium">No activities found</p>
            <p className="text-sm text-nilin-warmGray mt-1">
              Try adjusting your filters
            </p>
          </div>
        ) : (
          Object.entries(groupedActivities).map(([date, items]) => (
            <ActivityGroup
              key={date}
              date={date}
              activities={items}
              expandedGroups={expandedGroups}
              onToggleGroup={toggleGroup}
              onExport={onExport}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityHistory;
