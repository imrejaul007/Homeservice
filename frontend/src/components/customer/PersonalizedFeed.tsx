import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, RefreshCw, X, TrendingUp, Star, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton, ServiceCardSkeleton } from '../common/Skeleton';
import { EmptyState } from '../common/EmptyState';
import { useRecommendations, useRecommendationFeedback, ServiceRecommendation } from '../../hooks/useRecommendations';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { formatPrice } from '../../lib/utils';

// =============================================================================
// NILIN Customer Dashboard - Personalized Feed Component
// ML-driven personalized service recommendations
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface PersonalizedFeedProps {
  /** Limit number of recommendations shown */
  limit?: number;
  /** Show category filter tabs */
  showCategoryFilter?: boolean;
  /** Auto-refresh interval in milliseconds */
  refreshInterval?: number;
  /** Callback when user clicks on a service */
  onServiceClick?: (service: ServiceRecommendation['service']) => void;
  /** Callback when user books a service */
  onBookService?: (service: ServiceRecommendation['service']) => void;
  /** Additional CSS classes */
  className?: string;
}

export interface FeedFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'relevance' | 'price' | 'rating' | 'popularity';
}

interface DismissedItem {
  serviceId: string;
  dismissedAt: Date;
}

// =============================================================================
// Reason Badge Component
// =============================================================================

interface ReasonBadgeProps {
  reason: string;
}

const getReasonConfig = (reason: string): { label: string; icon: React.ReactNode; color: string } => {
  const lowerReason = reason.toLowerCase();

  if (lowerReason.includes('popular') || lowerReason.includes('trending')) {
    return {
      label: 'Trending',
      icon: <TrendingUp className="h-3 w-3" />,
      color: 'text-nilin-coral bg-nilin-coral/10',
    };
  }

  if (lowerReason.includes('rating') || lowerReason.includes('top-rated') || lowerReason.includes('highly-rated')) {
    return {
      label: 'Top Rated',
      icon: <Star className="h-3 w-3" />,
      color: 'text-amber-600 bg-amber-50',
    };
  }

  if (lowerReason.includes('recent') || lowerReason.includes('viewed') || lowerReason.includes('browsed')) {
    return {
      label: 'Recently Viewed',
      icon: <Clock className="h-3 w-3" />,
      color: 'text-blue-600 bg-blue-50',
    };
  }

  if (lowerReason.includes('book') || lowerReason.includes('favorite') || lowerReason.includes('liked')) {
    return {
      label: 'You Booked',
      icon: <Sparkles className="h-3 w-3" />,
      color: 'text-purple-600 bg-purple-50',
    };
  }

  // Default
  return {
    label: 'Recommended',
    icon: <Sparkles className="h-3 w-3" />,
    color: 'text-nilin-coral bg-nilin-coral/10',
  };
};

const ReasonBadge: React.FC<ReasonBadgeProps> = ({ reason }) => {
  const config = getReasonConfig(reason);

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      config.color
    )}>
      {config.icon}
      {config.label}
    </span>
  );
};

// =============================================================================
// Service Card Component
// =============================================================================

interface FeedServiceCardProps {
  recommendation: ServiceRecommendation;
  onDismiss: (serviceId: string) => void;
  onServiceClick?: (service: ServiceRecommendation['service']) => void;
  onBookService?: (service: ServiceRecommendation['service']) => void;
}

const FeedServiceCard: React.FC<FeedServiceCardProps> = ({
  recommendation,
  onDismiss,
  onServiceClick,
  onBookService,
}) => {
  const { service, score, reasons } = recommendation;
  const [imageError, setImageError] = useState(false);

  const handleCardClick = () => {
    onServiceClick?.(service);
  };

  const handleBookClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBookService?.(service);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss(service._id);
  };

  const primaryReason = reasons[0] || 'Recommended for you';
  const reasonConfig = getReasonConfig(primaryReason);

  return (
    <article
      onClick={handleCardClick}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-sm border border-nilin-blush/30 hover:shadow-lg hover:border-nilin-coral/20 transition-all duration-300 cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleCardClick();
        }
      }}
      aria-label={`${service.name} - ${reasonConfig.label}`}
    >
      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/90 backdrop-blur-sm text-gray-500 hover:text-gray-700 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Dismiss recommendation"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Image Section */}
      <div className="relative h-40 bg-gradient-to-br from-nilin-blush to-nilin-peach overflow-hidden">
        {!imageError && service.images?.[0] ? (
          <img
            src={service.images[0]}
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Sparkles className="h-12 w-12 text-nilin-coral/40" />
          </div>
        )}

        {/* Match Score Badge */}
        {score && score > 0.7 && (
          <div className="absolute bottom-3 left-3">
            <Badge
              variant="primary"
              size="sm"
              className="backdrop-blur-sm bg-white/90"
            >
              {Math.round(score * 100)}% Match
            </Badge>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4">
        {/* Reason Badge */}
        <div className="mb-2">
          <ReasonBadge reason={primaryReason} />
        </div>

        {/* Service Name */}
        <h3 className="font-semibold text-nilin-charcoal text-base mb-1 line-clamp-1 group-hover:text-nilin-coral transition-colors">
          {service.name}
        </h3>

        {/* Category */}
        <p className="text-sm text-nilin-warmGray mb-2">
          {service.category}
          {service.subcategory && ` / ${service.subcategory}`}
        </p>

        {/* Rating & Price Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-medium text-nilin-charcoal">
              {service.rating?.average?.toFixed(1) || '0.0'}
            </span>
            <span className="text-xs text-nilin-warmGray">
              ({service.rating?.count || 0})
            </span>
          </div>

          <span className="font-bold text-nilin-coral">
            {formatPrice(service.price?.amount || 0, service.price?.currency)}
          </span>
        </div>

        {/* Provider Info */}
        {service.providerId && (
          <div className="flex items-center gap-2 pt-3 border-t border-nilin-blush/30">
            <div className="w-8 h-8 rounded-full bg-nilin-coral/10 flex items-center justify-center">
              <span className="text-xs font-medium text-nilin-coral">
                {service.providerId.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-nilin-charcoal truncate">
                Provider #{service.providerId.slice(-6)}
              </p>
            </div>
          </div>
        )}

        {/* Book Button */}
        <Button
          variant="primary"
          size="sm"
          fullWidth
          className="mt-3"
          onClick={handleBookClick}
        >
          Book Now
        </Button>
      </div>
    </article>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const PersonalizedFeed: React.FC<PersonalizedFeedProps> = ({
  limit = 10,
  showCategoryFilter = true,
  refreshInterval = 5 * 60 * 1000, // 5 minutes
  onServiceClick,
  onBookService,
  className,
}) => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string | undefined>(undefined);
  const [dismissedItems, setDismissedItems] = useState<DismissedItem[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const {
    recommendations,
    isLoading,
    isRefreshing,
    error,
    refreshRecommendations,
  } = useRecommendations({
    autoFetch: true,
    refreshInterval,
    limit,
    category: activeCategory,
    enableTrending: true,
  });

  const { trackClick, trackDismiss, trackBooking } = useRecommendationFeedback();

  // Filter out dismissed items
  const filteredRecommendations = recommendations.filter((rec) => {
    const isDismissed = dismissedItems.some(
      (item) => item.serviceId === rec.service._id
    );
    return !isDismissed;
  });

  // Get unique categories from recommendations
  const categories = React.useMemo(() => {
    const cats = new Set<string>();
    recommendations.forEach((rec) => {
      if (rec.service.category) {
        cats.add(rec.service.category);
      }
    });
    return Array.from(cats);
  }, [recommendations]);

  const handleServiceClick = useCallback((service: ServiceRecommendation['service']) => {
    // Track click
    trackClick(service._id);

    // Navigate or callback
    if (onServiceClick) {
      onServiceClick(service);
    } else {
      navigate(`/services/${service._id}`);
    }
  }, [navigate, onServiceClick, trackClick]);

  const handleBookService = useCallback((service: ServiceRecommendation['service']) => {
    // Track booking intent
    trackBooking(service._id);

    if (onBookService) {
      onBookService(service);
    } else {
      navigate(`/book/${service._id}`);
    }
  }, [navigate, onBookService, trackBooking]);

  const handleDismiss = useCallback((serviceId: string) => {
    // Track dismiss
    trackDismiss(serviceId, 'not_interested');

    // Add to dismissed items
    setDismissedItems((prev) => [
      ...prev,
      { serviceId, dismissedAt: new Date() },
    ]);
  }, [trackDismiss]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    await refreshRecommendations();
  }, [refreshRecommendations]);

  // Clear dismissed items older than 24 hours
  useEffect(() => {
    const interval = setInterval(() => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      setDismissedItems((prev) =>
        prev.filter((item) => item.dismissedAt > oneDayAgo)
      );
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(interval);
  }, []);

  // Loading State
  if (isLoading && recommendations.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-24" />
        </div>

        {showCategoryFilter && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full flex-shrink-0" />
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <ServiceCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (error && recommendations.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <EmptyState
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          title="Unable to load recommendations"
          description="We're having trouble personalizing your feed. Please try again."
          action={{
            label: 'Try Again',
            onClick: handleRefresh,
          }}
        />
      </div>
    );
  }

  // Empty State
  if (filteredRecommendations.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-nilin-coral" />
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Personalized For You
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            Refresh
          </Button>
        </div>

        <EmptyState
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          }
          title="No recommendations yet"
          description="Start exploring services to get personalized recommendations based on your preferences."
          action={{
            label: 'Browse Services',
            onClick: () => navigate('/services'),
          }}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-nilin-coral" />
          <h2 className="text-xl font-semibold text-nilin-charcoal">
            Personalized For You
          </h2>
          {isRefreshing && (
            <span className="text-sm text-nilin-warmGray animate-pulse">
              Updating...
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />}
            onClick={handleRefresh}
            disabled={isRefreshing}
            aria-label="Refresh recommendations"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      {showCategoryFilter && categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          <button
            onClick={() => setActiveCategory(undefined)}
            className={cn(
              'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              !activeCategory
                ? 'bg-nilin-coral text-white'
                : 'bg-nilin-blush/50 text-nilin-charcoal hover:bg-nilin-blush'
            )}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              className={cn(
                'flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                activeCategory === category
                  ? 'bg-nilin-coral text-white'
                  : 'bg-nilin-blush/50 text-nilin-charcoal hover:bg-nilin-blush'
              )}
            >
              {category}
            </button>
          ))}
        </div>
      )}

      {/* Recommendations Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        role="feed"
        aria-label="Personalized service recommendations"
      >
        {filteredRecommendations.slice(0, limit).map((recommendation) => (
          <FeedServiceCard
            key={recommendation.service._id}
            recommendation={recommendation}
            onDismiss={handleDismiss}
            onServiceClick={handleServiceClick}
            onBookService={handleBookService}
          />
        ))}
      </div>

      {/* Load More Hint */}
      {filteredRecommendations.length > limit && (
        <div className="text-center pt-4">
          <p className="text-sm text-nilin-warmGray">
            Showing {limit} of {filteredRecommendations.length} recommendations
          </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default PersonalizedFeed;
