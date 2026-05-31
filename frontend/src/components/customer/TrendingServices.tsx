import React, { useCallback, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Flame, Star, ChevronRight, RefreshCw, Filter } from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { EmptyState } from '../common/EmptyState';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useTrendingRecommendations, TrendingService } from '../../hooks/useRecommendations';

// =============================================================================
// NILIN Customer Dashboard - Trending Services Component
// Popular services with growth indicators
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface TrendingServicesProps {
  /** Limit number of trending services */
  limit?: number;
  /** Category filter */
  category?: string;
  /** Show growth rate indicator */
  showGrowthRate?: boolean;
  /** Show booking count */
  showBookingCount?: boolean;
  /** Display mode */
  displayMode?: 'grid' | 'list' | 'compact';
  /** Callback when service is clicked */
  onServiceClick?: (serviceId: string, service: TrendingService['service']) => void;
  /** Additional CSS classes */
  className?: string;
}

type TimeFrame = '24h' | '7d' | '30d';

interface TimeFrameOption {
  value: TimeFrame;
  label: string;
}

const TIME_FRAME_OPTIONS: TimeFrameOption[] = [
  { value: '24h', label: 'Today' },
  { value: '7d', label: 'This Week' },
  { value: '30d', label: 'This Month' },
];

// =============================================================================
// Growth Indicator Component
// =============================================================================

interface GrowthIndicatorProps {
  growthRate: number;
  size?: 'sm' | 'md';
}

const GrowthIndicator: React.FC<GrowthIndicatorProps> = ({
  growthRate,
  size = 'sm',
}) => {
  const isPositive = growthRate >= 0;
  const isNeutral = growthRate === 0;

  const sizeClasses = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  if (isNeutral) {
    return (
      <span className={cn(
        'inline-flex items-center gap-0.5 rounded font-medium',
        'bg-gray-100 text-gray-600',
        sizeClasses
      )}>
        <span>No change</span>
      </span>
    );
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded font-medium',
      isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
      sizeClasses
    )}>
      <TrendingUp className={cn(iconSize, !isPositive && 'rotate-180')} />
      <span>{isPositive ? '+' : ''}{growthRate}%</span>
    </span>
  );
};

// =============================================================================
// Trending Service Card (Grid Mode)
// =============================================================================

interface TrendingGridCardProps {
  trending: TrendingService;
  rank: number;
  onServiceClick?: (serviceId: string, service: TrendingService['service']) => void;
}

const TrendingGridCard: React.FC<TrendingGridCardProps> = ({
  trending,
  rank,
  onServiceClick,
}) => {
  const { service, trendScore, growthRate } = trending;
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    onServiceClick?.(service._id, service);
  };

  return (
    <article
      onClick={handleClick}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-sm border border-nilin-blush/30 hover:shadow-lg hover:border-orange-200 transition-all duration-300 cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${rank}. ${service.name} - Trending`}
    >
      {/* Rank Badge */}
      <div className={cn(
        'absolute top-3 left-3 z-10 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
        rank === 1 ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg' :
        rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
        rank === 3 ? 'bg-gradient-to-br from-amber-600 to-amber-700 text-white' :
        'bg-white/90 backdrop-blur-sm text-nilin-charcoal border border-nilin-blush'
      )}>
        {rank}
      </div>

      {/* Hot Badge for high growth */}
      {growthRate > 50 && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold shadow-lg">
            <Flame className="h-3 w-3" />
            Hot
          </span>
        </div>
      )}

      {/* Image */}
      <div className="relative h-36 bg-gradient-to-br from-orange-50 to-amber-50 overflow-hidden">
        {!imageError && service.image ? (
          <img
            src={service.image}
            alt={service.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Flame className="h-10 w-10 text-orange-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-nilin-charcoal text-base mb-1 line-clamp-1 group-hover:text-orange-600 transition-colors">
          {service.name}
        </h3>

        <p className="text-sm text-nilin-warmGray mb-3">
          {service.category}
        </p>

        {/* Stats Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
            <span className="text-sm font-medium text-nilin-charcoal">
              {service.rating?.average?.toFixed(1) || '0.0'}
            </span>
            <span className="text-xs text-nilin-warmGray">
              ({service.rating?.count || 0})
            </span>
          </div>

          <GrowthIndicator growthRate={growthRate} />
        </div>

        {/* Trend Score Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-nilin-warmGray mb-1">
            <span>Popularity</span>
            <span>{Math.round(trendScore * 100)}%</span>
          </div>
          <div className="h-1.5 bg-nilin-blush/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.round(trendScore * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  );
};

// =============================================================================
// Trending Service Row (List Mode)
// =============================================================================

interface TrendingListRowProps {
  trending: TrendingService;
  rank: number;
  onServiceClick?: (serviceId: string, service: TrendingService['service']) => void;
}

const TrendingListRow: React.FC<TrendingListRowProps> = ({
  trending,
  rank,
  onServiceClick,
}) => {
  const { service, trendScore, growthRate } = trending;
  const [imageError, setImageError] = useState(false);

  const handleClick = () => {
    onServiceClick?.(service._id, service);
  };

  return (
    <article
      onClick={handleClick}
      className="group flex items-center gap-4 p-3 bg-white rounded-xl border border-nilin-blush/30 hover:shadow-sm hover:border-orange-200 transition-all cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Rank */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm',
        rank <= 3 ? 'bg-orange-100 text-orange-600' : 'bg-nilin-blush/50 text-nilin-charcoal'
      )}>
        {rank}
      </div>

      {/* Image */}
      <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-gradient-to-br from-orange-50 to-amber-50 overflow-hidden">
        {!imageError && service.image ? (
          <img
            src={service.image}
            alt={service.name}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Flame className="h-6 w-6 text-orange-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-nilin-charcoal line-clamp-1 group-hover:text-orange-600 transition-colors">
          {service.name}
        </h3>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-nilin-warmGray">{service.category}</span>
          <span className="text-xs text-nilin-warmGray">·</span>
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
            <span className="text-xs font-medium text-nilin-charcoal">
              {service.rating?.average?.toFixed(1) || '0.0'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 flex items-center gap-3">
        <GrowthIndicator growthRate={growthRate} size="sm" />
        <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-orange-500 transition-colors" />
      </div>
    </article>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const TrendingServices: React.FC<TrendingServicesProps> = ({
  limit = 10,
  category,
  showGrowthRate = true,
  showBookingCount = true,
  displayMode = 'grid',
  onServiceClick,
  className,
}) => {
  const navigate = useNavigate();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('7d');

  const { trending, isLoading, error, refresh } = useTrendingRecommendations({
    autoFetch: true,
    limit,
    category,
  });

  const trendingItems = useMemo<TrendingService[]>(
    () =>
      trending.map((item) => ({
        service: {
          _id: item.service._id,
          name: item.service.name,
          category: item.service.category,
          price: {
            amount: item.service.price.amount,
            currency: item.service.price.currency,
          },
          image: item.service.images?.[0],
          rating: item.service.rating,
          bookingCount: item.service.rating.count,
        },
        trendScore: item.score,
        growthRate: Math.round(item.score),
        category: item.service.category,
      })),
    [trending]
  );

  const handleServiceClick = useCallback((serviceId: string, service: TrendingService['service']) => {
    if (onServiceClick) {
      onServiceClick(serviceId, service);
    } else {
      navigate(`/service/${serviceId}`);
    }
  }, [navigate, onServiceClick]);

  // Loading State
  if (isLoading && trendingItems.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100">
              <TrendingUp className="h-5 w-5 text-orange-600" />
            </div>
            <Skeleton className="h-7 w-40" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>

        <div className={cn(
          displayMode === 'grid'
            ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
            : 'space-y-2'
        )}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
              <Skeleton className="w-full h-36 rounded-xl mb-3" />
              <Skeleton className="w-3/4 h-5 mb-2" />
              <Skeleton className="w-1/2 h-4 mb-3" />
              <Skeleton className="w-full h-2 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error State
  if (error && trendingItems.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <EmptyState
          icon={
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          title="Unable to load trending services"
          description="We're having trouble fetching trending services. Please try again."
          action={{
            label: 'Try Again',
            onClick: refresh,
          }}
        />
      </div>
    );
  }

  // Empty State
  if (trendingItems.length === 0) {
    return (
      <div className={cn('space-y-4', className)}>
        <EmptyState
          icon={<TrendingUp className="h-8 w-8" />}
          title="No trending services"
          description="Trending services will appear here based on popular demand."
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
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100">
            <TrendingUp className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Trending Now
            </h2>
            <p className="text-sm text-nilin-warmGray">
              Services everyone is booking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Frame Selector */}
          <div className="flex items-center bg-nilin-blush/30 rounded-lg p-1">
            {TIME_FRAME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeFrame(option.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  timeFrame === option.value
                    ? 'bg-white text-nilin-charcoal shadow-sm'
                    : 'text-nilin-warmGray hover:text-nilin-charcoal'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Refresh Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            aria-label="Refresh trending services"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {displayMode === 'grid' ? (
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          role="feed"
          aria-label="Trending services"
        >
          {trendingItems.slice(0, limit).map((item, index) => (
            <TrendingGridCard
              key={item.service._id}
              trending={item}
              rank={index + 1}
              onServiceClick={handleServiceClick}
            />
          ))}
        </div>
      ) : displayMode === 'list' ? (
        <div
          className="space-y-2"
          role="feed"
          aria-label="Trending services"
        >
          {trendingItems.slice(0, limit).map((item, index) => (
            <TrendingListRow
              key={item.service._id}
              trending={item}
              rank={index + 1}
              onServiceClick={handleServiceClick}
            />
          ))}
        </div>
      ) : (
        // Compact mode - horizontal scroll
        <div
          className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide"
          role="feed"
          aria-label="Trending services"
        >
          {trendingItems.slice(0, limit).map((item, index) => (
            <article
              key={item.service._id}
              onClick={() => handleServiceClick(item.service._id, item.service)}
              className="flex-shrink-0 w-40 bg-white rounded-xl overflow-hidden shadow-sm border border-nilin-blush/30 hover:shadow-md transition-all cursor-pointer group"
              role="button"
              tabIndex={0}
            >
              <div className="relative h-24 bg-gradient-to-br from-orange-50 to-amber-50">
                <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                {item.growthRate > 50 && (
                  <div className="absolute top-2 right-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h4 className="font-medium text-nilin-charcoal text-sm line-clamp-1 group-hover:text-orange-600 transition-colors">
                  {item.service.name}
                </h4>
                <div className="flex items-center justify-between mt-2">
                  <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                  <GrowthIndicator growthRate={item.growthRate} size="sm" />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* View All Link */}
      <div className="text-center pt-2">
        <Button
          variant="ghost"
          rightIcon={<ChevronRight className="h-4 w-4" />}
          onClick={() => navigate('/trending')}
        >
          View All Trending Services
        </Button>
      </div>
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default TrendingServices;
