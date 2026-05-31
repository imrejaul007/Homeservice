import React from 'react';
import { cn } from '../../lib/utils';

/**
 * NILIN Design System - Page Loading State Component
 *
 * Provides consistent loading UI for full page loads with skeleton placeholders.
 */

interface PageLoadingStateProps {
  /** Title to show while loading */
  title?: string;
  /** Show navigation skeleton */
  showNav?: boolean;
  /** Show header skeleton */
  showHeader?: boolean;
  /** Number of card skeletons */
  cardCount?: number;
  /** Custom className */
  className?: string;
}

/**
 * Skeleton line for text placeholders
 */
export const SkeletonLine: React.FC<{ width?: string; className?: string }> = ({
  width = 'w-full',
  className,
}) => (
  <div
    className={cn(
      'h-4 bg-gradient-to-r from-nilin-blush via-white to-nilin-blush bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded-md',
      width,
      className
    )}
  />
);

/**
 * Navigation skeleton for loading states
 */
export const NavigationSkeleton: React.FC = () => (
  <div className="bg-white border-b border-nilin-border/30">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        <div className="h-8 w-24 bg-gradient-to-r from-nilin-blush via-white to-nilin-blush bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded-lg" />
        <div className="flex items-center gap-4">
          <div className="h-10 w-64 bg-gradient-to-r from-nilin-blush via-white to-nilin-blush bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded-lg" />
          <div className="h-10 w-24 bg-gradient-to-r from-nilin-blush via-white to-nilin-blush bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded-lg" />
        </div>
      </div>
    </div>
  </div>
);

/**
 * Card skeleton for grid layouts
 */
export const CardSkeleton: React.FC<{ variant?: 'service' | 'provider' | 'booking' | 'stat' }> = ({
  variant = 'service',
}) => {
  if (variant === 'service') {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-nilin-blush/20 overflow-hidden">
        <div className="h-40 bg-gradient-to-r from-nilin-blush via-white to-nilin-blush bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded-xl mb-3" />
        <SkeletonLine width="w-3/4" className="mb-2" />
        <SkeletonLine width="w-1/2" className="mb-3" />
        <div className="flex items-center justify-between">
          <SkeletonLine width="w-20" className="h-6 rounded-full" />
          <SkeletonLine width="w-16" className="h-8 rounded-lg" />
        </div>
      </div>
    );
  }

  if (variant === 'provider') {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-nilin-blush/20">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-gradient-to-r from-nilin-blush via-white to-nilin-blush bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded-full" />
          <div className="flex-1">
            <SkeletonLine width="w-32" className="mb-2" />
            <SkeletonLine width="w-24" />
          </div>
        </div>
        <div className="h-20 bg-gradient-to-r from-nilin-blush via-white to-nilin-blush bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite] rounded-lg mb-3" />
        <div className="flex gap-2">
          <SkeletonLine width="w-16" className="h-6 rounded-full" />
          <SkeletonLine width="w-16" className="h-6 rounded-full" />
        </div>
      </div>
    );
  }

  if (variant === 'booking') {
    return (
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-nilin-blush/20">
        <div className="flex justify-between items-start mb-3">
          <div>
            <SkeletonLine width="w-40" className="mb-2" />
            <SkeletonLine width="w-32" />
          </div>
          <SkeletonLine width="w-20" className="h-6 rounded-full" />
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-nilin-border to-transparent mb-3" />
        <div className="flex justify-between">
          <SkeletonLine width="w-24" />
          <SkeletonLine width="w-20 h-8 rounded-lg" />
        </div>
      </div>
    );
  }

  // stat variant
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-nilin-blush/20">
      <SkeletonLine width="w-8 h-8 rounded-lg" className="mb-3" />
      <SkeletonLine width="w-20" className="h-8 mb-2" />
      <SkeletonLine width="w-32" />
    </div>
  );
};

/**
 * Grid skeleton for consistent loading grids
 */
export const GridSkeleton: React.FC<{
  count?: number;
  variant?: 'service' | 'provider' | 'booking' | 'stat';
  columns?: string;
}> = ({ count = 6, variant = 'service', columns = 'grid-cols-2 md:grid-cols-3' }) => (
  <div className={`grid ${columns} gap-4`}>
    {Array.from({ length: count }).map((_, i) => (
      <CardSkeleton key={i} variant={variant} />
    ))}
  </div>
);

/**
 * Header skeleton for page titles
 */
export const HeaderSkeleton: React.FC<{ title?: string }> = ({ title = 'Loading...' }) => (
  <div className="bg-nilin-cream border-b border-nilin-border/30">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <SkeletonLine width="w-64" className="h-8 mb-2" />
      <SkeletonLine width="w-48" />
    </div>
  </div>
);

/**
 * Main page loading state component
 */
export const PageLoadingState: React.FC<PageLoadingStateProps> = ({
  title,
  showNav = true,
  showHeader = true,
  cardCount = 6,
  className,
}) => {
  return (
    <div className="min-h-screen bg-nilin-cream flex flex-col">
      {/* Navigation */}
      {showNav && <NavigationSkeleton />}

      {/* Header */}
      {showHeader && (
        <div className="bg-nilin-cream border-b border-nilin-border/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
            {title ? (
              <>
                <SkeletonLine width="w-64" className="h-8 mb-2" />
                <SkeletonLine width="w-48" />
              </>
            ) : (
              <div className="flex items-center justify-center h-12">
                <div className="w-8 h-8 border-2 border-nilin-coral border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className={cn('flex-1 p-4 sm:p-6 lg:p-8', className)}>
        <div className="max-w-7xl mx-auto">
          <GridSkeleton count={cardCount} variant="service" />
        </div>
      </div>
    </div>
  );
};

/**
 * Inline loading spinner for smaller areas
 */
export const InlineLoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className,
}) => {
  const sizes = {
    sm: 'w-4 h-4 border-[1.5px]',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-2',
  };

  return (
    <div
      className={cn(
        'border-nilin-coral border-t-transparent rounded-full animate-spin',
        sizes[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
};

/**
 * Full page centered loading spinner
 */
export const FullPageLoadingSpinner: React.FC<{ message?: string }> = ({ message }) => (
  <div className="min-h-screen bg-nilin-cream flex flex-col">
    <NavigationSkeleton />
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <InlineLoadingSpinner size="lg" className="mx-auto mb-4" />
        {message && (
          <p className="text-nilin-warmGray text-sm">{message}</p>
        )}
      </div>
    </div>
  </div>
);

export default PageLoadingState;
