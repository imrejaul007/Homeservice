import React from 'react';

interface SkeletonCardProps {
  /** Number of skeleton cards to render */
  count?: number;
  /** Optional className for the container */
  className?: string;
}

/**
 * SkeletonCard - Enhanced skeleton loading state for service cards
 * Mimics the structure of actual service cards with animated shimmer effect
 */
export const SkeletonCard: React.FC<SkeletonCardProps> = ({ count = 1, className = '' }) => {
  const cards = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {cards.map((index) => (
        <article
          key={index}
          className={`card-nilin p-6 rounded-nilin-lg bg-white/90 border border-nilin-border ${className}`}
          aria-hidden="true"
        >
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
            {/* Left content area */}
            <div className="flex-1 min-w-0">
              {/* Header: Service name + status badge */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {/* Service name placeholder */}
                <div className="h-7 w-48 rounded shimmer-placeholder" />
                {/* Status badge placeholder */}
                <div className="h-6 w-28 rounded-full shimmer-placeholder" />
              </div>

              {/* Metrics grid: category, price, duration, location */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {/* Category */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg shimmer-placeholder" />
                  <div className="h-4 w-20 rounded shimmer-placeholder" />
                </div>
                {/* Price */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg shimmer-placeholder" />
                  <div className="h-4 w-16 rounded shimmer-placeholder" />
                </div>
                {/* Duration */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg shimmer-placeholder" />
                  <div className="h-4 w-14 rounded shimmer-placeholder" />
                </div>
                {/* Location */}
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg shimmer-placeholder" />
                  <div className="h-4 w-24 rounded shimmer-placeholder" />
                </div>
              </div>

              {/* Bottom metrics: impressions, views, rating, date */}
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-4 w-24 rounded shimmer-placeholder" />
                <div className="h-4 w-20 rounded shimmer-placeholder" />
                <div className="h-4 w-16 rounded shimmer-placeholder" />
                <div className="h-4 w-20 rounded shimmer-placeholder ml-auto" />
              </div>
            </div>

            {/* Right action buttons area */}
            <div className="flex items-center lg:flex-col gap-1 shrink-0 bg-nilin-muted/30 p-2 rounded-xl border border-nilin-border/50">
              {/* Analytics button */}
              <div className="w-9 h-9 rounded-lg shimmer-placeholder" />
              {/* Clone button */}
              <div className="w-9 h-9 rounded-lg shimmer-placeholder" />
              {/* Divider space */}
              <div className="w-full h-px bg-nilin-border/50 my-1" />
              {/* Toggle button */}
              <div className="w-9 h-9 rounded-lg shimmer-placeholder" />
              {/* Edit button */}
              <div className="w-9 h-9 rounded-lg shimmer-placeholder" />
              {/* Divider space */}
              <div className="w-full h-px bg-nilin-border/50 my-1" />
              {/* Delete button */}
              <div className="w-9 h-9 rounded-lg shimmer-placeholder" />
            </div>
          </div>
        </article>
      ))}
    </>
  );
};

/**
 * SkeletonServiceList - Pre-configured skeleton list for service loading
 */
export const SkeletonServiceList: React.FC<{ count?: number }> = ({ count = 3 }) => (
  <div className="space-y-4">
    <SkeletonCard count={count} />
  </div>
);

export default SkeletonCard;
