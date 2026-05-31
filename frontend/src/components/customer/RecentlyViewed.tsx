import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, RotateCcw, X, ChevronRight, Star } from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { EmptyState } from '../common/EmptyState';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Service } from '../../types/service';

// =============================================================================
// NILIN Customer Dashboard - Recently Viewed Component
// Recently viewed services with quick rebook functionality
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface RecentlyViewedProps {
  /** Limit number of items shown */
  limit?: number;
  /** Storage key for recently viewed */
  storageKey?: string;
  /** Callback when item is clicked */
  onItemClick?: (service: Service) => void;
  /** Callback when rebook is clicked */
  onRebook?: (service: Service) => void;
  /** Callback when item is removed */
  onRemove?: (serviceId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

export interface RecentlyViewedItem {
  service: Service;
  viewedAt: Date;
  viewCount: number;
}

// =============================================================================
// Recently Viewed Item Card
// =============================================================================

interface RecentlyViewedCardProps {
  item: RecentlyViewedItem;
  onItemClick?: (service: Service) => void;
  onRebook?: (service: Service) => void;
  onRemove?: (serviceId: string) => void;
}

const RecentlyViewedCard: React.FC<RecentlyViewedCardProps> = ({
  item,
  onItemClick,
  onRebook,
  onRemove,
}) => {
  const { service, viewedAt, viewCount } = item;
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    onItemClick?.(service);
  };

  const handleRebook = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRebook?.(service);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(service._id);
  };

  const getTimeSinceView = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <article
      onClick={handleClick}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-sm border border-nilin-blush/30 hover:shadow-md hover:border-nilin-coral/20 transition-all cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${service.name} - viewed ${getTimeSinceView(viewedAt)}`}
    >
      {/* Remove Button */}
      <button
        onClick={handleRemove}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/90 backdrop-blur-sm text-gray-400 hover:text-gray-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Remove from recently viewed"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Image */}
      <div className="relative h-32 bg-gradient-to-br from-purple-50 to-pink-50 overflow-hidden">
        {!imageError && service.images?.[0] ? (
          <img
            src={service.images[0]}
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Clock className="h-8 w-8 text-purple-300" />
          </div>
        )}

        {/* View Count Badge */}
        {viewCount > 1 && (
          <div className="absolute bottom-3 left-3">
            <Badge variant="default" size="sm" className="bg-white/90 backdrop-blur-sm">
              Viewed {viewCount}x
            </Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-nilin-charcoal text-sm line-clamp-1 group-hover:text-nilin-coral transition-colors">
          {service.name}
        </h3>

        <p className="text-xs text-nilin-warmGray mt-0.5">
          {service.category}
        </p>

        {/* Rating & Price */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
            <span className="text-xs font-medium text-nilin-charcoal">
              {service.rating?.average?.toFixed(1) || '0.0'}
            </span>
          </div>

          <span className="text-sm font-bold text-nilin-coral">
            {formatPrice(service.price?.amount || 0, service.price?.currency)}
          </span>
        </div>

        {/* Time & Rebook */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-nilin-blush/30">
          <span className="text-xs text-nilin-warmGray">
            {getTimeSinceView(viewedAt)}
          </span>

          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RotateCcw className="h-3 w-3" />}
            onClick={handleRebook}
            className="text-xs"
          >
            Rebook
          </Button>
        </div>
      </div>
    </article>
  );
};

// =============================================================================
// Compact List Item
// =============================================================================

interface RecentlyViewedListItemProps {
  item: RecentlyViewedItem;
  onItemClick?: (service: Service) => void;
  onRebook?: (service: Service) => void;
  onRemove?: (serviceId: string) => void;
}

const RecentlyViewedListItem: React.FC<RecentlyViewedListItemProps> = ({
  item,
  onItemClick,
  onRebook,
  onRemove,
}) => {
  const { service, viewedAt, viewCount } = item;
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    onItemClick?.(service);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.(service._id);
  };

  const getTimeSinceView = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  return (
    <article
      onClick={handleClick}
      className="group flex items-center gap-3 p-3 bg-white rounded-xl border border-nilin-blush/30 hover:shadow-sm hover:border-purple-200 transition-all cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Image */}
      <div className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50">
        {!imageError && service.images?.[0] ? (
          <img
            src={service.images[0]}
            alt={service.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Clock className="h-5 w-5 text-purple-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-nilin-charcoal text-sm line-clamp-1 group-hover:text-nilin-coral transition-colors">
          {service.name}
        </h4>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-nilin-warmGray">{service.category}</span>
          <span className="text-xs text-nilin-warmGray">·</span>
          <span className="text-xs text-nilin-warmGray">{getTimeSinceView(viewedAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onRebook?.(service);
          }}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </Button>
        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-nilin-coral transition-colors" />
      </div>
    </article>
  );
};

// =============================================================================
// Custom Hook for Recently Viewed
// =============================================================================

const useRecentlyViewed = (storageKey: string, limit: number) => {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  // Load from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        const itemsWithDates = parsed.map((item: { service: Service; viewedAt: string; viewCount: number }) => ({
          ...item,
          viewedAt: new Date(item.viewedAt),
        }));
        setItems(itemsWithDates);
      }
    } catch {
      console.error('Failed to load recently viewed items');
    }
  }, [storageKey]);

  // Add/view item
  const addViewedItem = useCallback((service: Service) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.service._id === service._id);

      let updated: RecentlyViewedItem[];

      if (existingIndex >= 0) {
        // Update existing item
        updated = prev.map((item, index) =>
          index === existingIndex
            ? { ...item, viewedAt: new Date(), viewCount: item.viewCount + 1 }
            : item
        );
        // Move to front
        const item = updated.splice(existingIndex, 1)[0];
        updated.unshift(item);
      } else {
        // Add new item at front
        updated = [
          { service, viewedAt: new Date(), viewCount: 1 },
          ...prev,
        ];
      }

      // Limit size and save
      const limited = updated.slice(0, limit);

      try {
        localStorage.setItem(storageKey, JSON.stringify(limited));
      } catch {
        console.error('Failed to save recently viewed items');
      }

      return limited;
    });
  }, [storageKey, limit]);

  // Remove item
  const removeViewedItem = useCallback((serviceId: string) => {
    setItems((prev) => {
      const updated = prev.filter((item) => item.service._id !== serviceId);

      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {
        console.error('Failed to save recently viewed items');
      }

      return updated;
    });
  }, [storageKey]);

  // Clear all
  const clearAll = useCallback(() => {
    setItems([]);

    try {
      localStorage.removeItem(storageKey);
    } catch {
      console.error('Failed to clear recently viewed items');
    }
  }, [storageKey]);

  return {
    items,
    addViewedItem,
    removeViewedItem,
    clearAll,
  };
};

// =============================================================================
// Main Component
// =============================================================================

export const RecentlyViewed: React.FC<RecentlyViewedProps> = ({
  limit = 10,
  storageKey = 'recently_viewed_services',
  onItemClick,
  onRebook,
  onRemove: onRemoveProp,
  className,
}) => {
  const navigate = useNavigate();
  const { items, addViewedItem, removeViewedItem, clearAll } = useRecentlyViewed(storageKey, limit);

  const handleItemClick = useCallback((service: Service) => {
    addViewedItem(service);

    if (onItemClick) {
      onItemClick(service);
    } else {
      navigate(`/service/${service._id}`);
    }
  }, [navigate, onItemClick, addViewedItem]);

  const handleRebook = useCallback((service: Service) => {
    addViewedItem(service);

    if (onRebook) {
      onRebook(service);
    } else {
      navigate(`/book/${service._id}`);
    }
  }, [navigate, onRebook, addViewedItem]);

  const handleRemove = useCallback((serviceId: string) => {
    removeViewedItem(serviceId);
    onRemoveProp?.(serviceId);
  }, [removeViewedItem, onRemoveProp]);

  // Expose add function for external use
  React.useImperativeHandle?.(
    React.useRef(null),
    () => ({ addViewedItem }),
    [addViewedItem]
  );

  // Loading State
  if (items.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Recently Viewed
            </h2>
          </div>
        </div>

        <EmptyState
          icon={<Clock className="h-8 w-8" />}
          title="No recently viewed services"
          description="Services you view will appear here for easy rebooking."
          compact
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100">
            <Clock className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Recently Viewed
            </h2>
            <p className="text-sm text-nilin-warmGray">
              {items.length} service{items.length !== 1 ? 's' : ''} viewed
            </p>
          </div>
        </div>

        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-gray-500 hover:text-gray-700"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Services Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        role="feed"
        aria-label="Recently viewed services"
      >
        {items.slice(0, limit).map((item) => (
          <RecentlyViewedCard
            key={item.service._id}
            item={item}
            onItemClick={handleItemClick}
            onRebook={handleRebook}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* View All Link */}
      {items.length > limit && (
        <div className="text-center pt-2">
          <Button
            variant="ghost"
            rightIcon={<ChevronRight className="h-4 w-4" />}
            onClick={() => navigate('/recently-viewed')}
          >
            View All ({items.length})
          </Button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export the hook for external use
// =============================================================================

export { useRecentlyViewed };

export default RecentlyViewed;
