import React from 'react';

interface SkeletonStatCardProps {
  /** Number of skeleton stat cards to render */
  count?: number;
  /** Optional className for the container */
  className?: string;
  /** Variant: 'stat' for overview stats, 'compact' for smaller inline stats */
  variant?: 'stat' | 'compact';
}

/**
 * SkeletonStatCard - Enhanced skeleton loading state for stat cards
 * Mimics the structure of actual StatCard with animated shimmer effect
 */
export const SkeletonStatCard: React.FC<SkeletonStatCardProps> = ({
  count = 1,
  className = '',
  variant = 'stat',
}) => {
  const cards = Array.from({ length: count }, (_, i) => i);

  if (variant === 'compact') {
    return (
      <>
        {cards.map((index) => (
          <div
            key={index}
            className={`glass-nilin rounded-nilin-lg p-5 border border-nilin-border/60 ${className}`}
            aria-hidden="true"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {/* Label placeholder */}
                <div className="h-4 w-2/3 rounded shimmer-placeholder mb-3" />
                {/* Value placeholder */}
                <div className="h-8 w-1/2 rounded shimmer-placeholder" />
              </div>
              {/* Icon placeholder with pulse */}
              <div className="flex-shrink-0 w-11 h-11 rounded-xl shimmer-placeholder pulse-icon" />
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <>
      {cards.map((index) => (
        <div
          key={index}
          className={`glass-nilin rounded-nilin-lg p-5 border border-nilin-border/60 ${className}`}
          aria-hidden="true"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Label placeholder */}
              <div className="h-4 w-2/3 rounded shimmer-placeholder mb-3" />
              {/* Value placeholder */}
              <div className="h-8 w-1/2 rounded shimmer-placeholder" />
            </div>
            {/* Icon placeholder with pulse */}
            <div className="flex-shrink-0 w-11 h-11 rounded-xl shimmer-placeholder pulse-icon" />
          </div>
        </div>
      ))}
    </>
  );
};

/**
 * SkeletonStatGrid - Pre-configured skeleton grid for overview stats
 */
export const SkeletonStatGrid: React.FC<{
  columns?: 2 | 3 | 4 | 5;
  count?: number;
}> = ({ columns = 4, count }) => {
  const actualCount = count ?? columns;

  return (
    <div className={`grid grid-cols-2 ${columns >= 3 ? 'lg:grid-cols-3' : ''} ${columns >= 4 ? 'xl:grid-cols-4' : ''} ${columns === 5 ? 'xl:grid-cols-5' : ''} gap-4`}>
      <SkeletonStatCard count={actualCount} />
    </div>
  );
};

/**
 * SkeletonPerformanceCard - Skeleton for performance metric cards
 * Used in the Service Performance section
 */
export const SkeletonPerformanceCard: React.FC<{ count?: number }> = ({ count = 5 }) => {
  const cards = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {cards.map((index) => (
        <div
          key={index}
          className="glass-nilin rounded-nilin-lg p-5 border border-nilin-border/50 h-24"
          aria-hidden="true"
        >
          <div className="flex items-center gap-3 mb-3">
            {/* Icon placeholder */}
            <div className="w-10 h-10 rounded-xl shimmer-placeholder pulse-icon" />
          </div>
          {/* Value placeholder */}
          <div className="h-8 w-3/4 rounded shimmer-placeholder mb-2" />
          {/* Label placeholder */}
          <div className="h-4 w-1/2 rounded shimmer-placeholder" />
        </div>
      ))}
    </>
  );
};

export default SkeletonStatCard;
