/**
 * LoadingState - Reusable skeleton loading placeholder components for admin dashboards
 *
 * @example
 * ```tsx
 * // Basic skeleton
 * <LoadingState type="table" rows={5} columns={4} />
 *
 * // Card skeleton
 * <LoadingState type="card" count={3} />
 *
 * // Custom skeleton
 * <LoadingState type="custom">
 *   <Skeleton width="60%" height={20} />
 *   <Skeleton width="40%" height={16} />
 * </LoadingState>
 * ```
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

// ============================================
// Skeleton Primitives
// ============================================

export interface SkeletonProps {
  /** Custom className */
  className?: string;
  /** Animation variant */
  variant?: 'shimmer' | 'pulse' | 'wave';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'shimmer',
}) => {
  const animationClasses = {
    shimmer: 'shimmer-placeholder',
    pulse: 'animate-pulse bg-gray-200',
    wave: 'animate-pulse bg-gray-100',
  };

  return (
    <div
      className={cn(
        'rounded',
        animationClasses[variant],
        className
      )}
      aria-hidden="true"
    />
  );
};

// ============================================
// Skeleton Components
// ============================================

export interface SkeletonRowProps {
  columns?: number;
  columnWidths?: string[];
}

export const SkeletonRow: React.FC<SkeletonRowProps> = ({
  columns = 4,
  columnWidths,
}) => (
  <div className="flex items-center gap-4 py-3 px-4 border-b border-gray-100">
    {Array.from({ length: columns }, (_, i) => (
      <Skeleton
        key={i}
        className={cn(
          'h-4 flex-1',
          columnWidths?.[i] || ''
        )}
      />
    ))}
  </div>
);

export interface SkeletonTableProps {
  rows?: number;
  columns?: number;
  columnWidths?: string[];
  headerLabels?: string[];
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  columnWidths,
  headerLabels,
}) => (
  <div className="bg-white rounded-lg shadow overflow-hidden" role="status" aria-label="Loading table">
    {/* Header */}
    <div className="bg-gray-50 border-b border-gray-100 px-4 py-3">
      <div className="flex gap-4">
        {headerLabels?.slice(0, columns).map((label, i) => (
          <Skeleton key={i} className="h-4 flex-1 max-w-[120px]" />
        ))}
      </div>
    </div>

    {/* Body */}
    <div className="divide-y divide-gray-100">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <SkeletonRow key={rowIndex} columns={columns} columnWidths={columnWidths} />
      ))}
    </div>
  </div>
);

export interface SkeletonCardProps {
  /** Number of cards to render */
  count?: number;
  /** Custom className for container */
  className?: string;
  /** Show/hide specific elements */
  showImage?: boolean;
  showActions?: boolean;
  showBadge?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  count = 1,
  className,
  showImage = true,
  showActions = true,
  showBadge = true,
}) => {
  const cards = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {cards.map((index) => (
        <article
          key={index}
          className={cn(
            'bg-white rounded-xl p-5 shadow-sm border border-gray-100',
            className
          )}
          aria-hidden="true"
        >
          <div className="flex items-start gap-4">
            {/* Left content */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Header */}
              <div className="flex items-center gap-3">
                {showBadge && <Skeleton className="h-6 w-20 rounded-full" />}
                <Skeleton className="h-5 w-32" />
              </div>

              {/* Description */}
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />

              {/* Meta */}
              <div className="flex items-center gap-4 pt-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>

            {/* Right content / Actions */}
            {showImage && (
              <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
            )}
            {showActions && (
              <div className="flex flex-col gap-2 shrink-0">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <Skeleton className="w-9 h-9 rounded-lg" />
              </div>
            )}
          </div>
        </article>
      ))}
    </>
  );
};

export interface SkeletonListProps {
  /** Number of items */
  count?: number;
  /** Custom className */
  className?: string;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  count = 5,
  className,
}) => (
  <div className={cn('space-y-3', className)} role="status" aria-label="Loading list">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm">
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-60" />
        </div>
        <Skeleton className="w-20 h-6 rounded-full" />
      </div>
    ))}
  </div>
);

export interface SkeletonStatsProps {
  /** Number of stat cards */
  count?: number;
}

export const SkeletonStats: React.FC<SkeletonStatsProps> = ({ count = 4 }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4" role="status" aria-label="Loading statistics">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="bg-white rounded-xl p-4 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="w-10 h-10 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

// ============================================
// Loading State Types
// ============================================

export type LoadingStateType = 'table' | 'card' | 'list' | 'stats' | 'full' | 'inline';

export interface LoadingStateProps {
  /** Type of skeleton to display */
  type?: LoadingStateType;
  /** Number of items for list/card types */
  count?: number;
  /** Number of rows for table type */
  rows?: number;
  /** Number of columns for table type */
  columns?: number;
  /** Table column widths */
  columnWidths?: string[];
  /** Custom className */
  className?: string;
  /** Custom message */
  message?: string;
  /** Show inline spinner instead of skeleton */
  inline?: boolean;
}

// ============================================
// Loading State Component
// ============================================

export const LoadingState: React.FC<LoadingStateProps> = ({
  type = 'full',
  count = 3,
  rows = 5,
  columns = 4,
  columnWidths,
  className,
  message,
  inline = false,
}) => {
  // Inline spinner mode
  if (inline) {
    return (
      <div className={cn('flex items-center justify-center gap-2 py-8', className)} role="status">
        <Loader2 className="w-5 h-5 animate-spin text-nilin-coral" aria-hidden="true" />
        {message && <span className="text-sm text-nilin-warmGray">{message}</span>}
      </div>
    );
  }

  switch (type) {
    case 'table':
      return (
        <div className={cn(className)}>
          <SkeletonTable rows={rows} columns={columns} columnWidths={columnWidths} />
        </div>
      );

    case 'card':
      return (
        <div className={cn('grid gap-4', className)}>
          <SkeletonCard count={count} />
        </div>
      );

    case 'list':
      return (
        <div className={className}>
          <SkeletonList count={count} />
        </div>
      );

    case 'stats':
      return (
        <div className={className}>
          <SkeletonStats count={count} />
        </div>
      );

    case 'full':
      return (
        <div
          className={cn(
            'fixed inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center z-50',
            className
          )}
          role="status"
          aria-label="Loading"
        >
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-nilin-coral" aria-hidden="true" />
            {message && <p className="text-nilin-warmGray">{message}</p>}
          </div>
        </div>
      );

    case 'inline':
    default:
      return (
        <div className={cn('flex items-center justify-center py-12', className)} role="status">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-nilin-coral" aria-hidden="true" />
            {message && <p className="text-sm text-nilin-warmGray">{message}</p>}
          </div>
        </div>
      );
  }
};

// ============================================
// Combined Page Loading State
// ============================================

export interface PageLoadingStateProps {
  className?: string;
  message?: string;
}

export const PageLoadingState: React.FC<PageLoadingStateProps> = ({
  className,
  message = 'Loading...',
}) => (
  <div
    className={cn(
      'fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50',
      className
    )}
    role="status"
    aria-label="Loading page"
  >
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Loader2 className="w-12 h-12 animate-spin text-nilin-coral" aria-hidden="true" />
      </div>
      <p className="text-nilin-warmGray font-medium">{message}</p>
    </div>
  </div>
);

// ============================================
// Overlay Loading State (for modals/panels)
// ============================================

export interface OverlayLoadingStateProps {
  message?: string;
  className?: string;
}

export const OverlayLoadingState: React.FC<OverlayLoadingStateProps> = ({
  message = 'Loading...',
  className,
}) => (
  <div
    className={cn(
      'absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center rounded-xl z-10',
      className
    )}
    role="status"
    aria-label={message}
  >
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-nilin-coral" aria-hidden="true" />
      <p className="text-sm text-nilin-warmGray">{message}</p>
    </div>
  </div>
);

export default LoadingState;
