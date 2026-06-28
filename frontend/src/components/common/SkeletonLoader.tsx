import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton component with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div
    className={cn(
      'animate-pulse bg-gradient-to-r from-nilin-muted via-gray-100 to-nilin-muted bg-[length:200%_100%] rounded',
      className
    )}
  />
);

/**
 * Skeleton for card lists
 */
export const CardSkeleton: React.FC = () => (
  <div className="glass-nilin rounded-nilin-lg p-6">
    <div className="flex items-start gap-4">
      <Skeleton className="w-16 h-16 rounded-full" />
      <div className="flex-1 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2 pt-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  </div>
);

/**
 * Skeleton for table rows
 */
export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => (
  <div className="flex items-center gap-4 p-4 border-b border-nilin-border">
    {Array.from({ length: columns }).map((_, i) => (
      <Skeleton
        key={i}
        className={cn(
          'h-4',
          i === 0 ? 'w-8' : i === columns - 1 ? 'w-20' : 'flex-1'
        )}
      />
    ))}
  </div>
);

/**
 * Skeleton for data tables
 */
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 5,
}) => (
  <div className="border border-nilin-border rounded-nilin">
    {/* Header */}
    <div className="flex items-center gap-4 p-4 bg-nilin-muted/50 border-b border-nilin-border">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            'h-4',
            i === 0 ? 'w-8' : i === columns - 1 ? 'w-20' : 'flex-1'
          )}
        />
      ))}
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <TableRowSkeleton key={rowIndex} columns={columns} />
    ))}
  </div>
);

/**
 * Skeleton for profile sections
 */
export const ProfileSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="flex items-center gap-4">
      <Skeleton className="w-20 h-20 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-24 rounded-nilin" />
      <Skeleton className="h-24 rounded-nilin" />
    </div>
  </div>
);

/**
 * Skeleton for transaction/wallet items
 */
export const TransactionSkeleton: React.FC = () => (
  <div className="flex items-center justify-between p-4 border-b border-nilin-border">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
    <Skeleton className="h-5 w-20" />
  </div>
);

/**
 * Skeleton for notification items
 */
export const NotificationSkeleton: React.FC = () => (
  <div className="flex items-start gap-4 p-4">
    <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
    <Skeleton className="h-3 w-16" />
  </div>
);

/**
 * Skeleton for service cards
 */
export const ServiceCardSkeleton: React.FC = () => (
  <div className="glass-nilin rounded-nilin-lg overflow-hidden">
    <Skeleton className="w-full h-40" />
    <div className="p-4 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-8 w-24 rounded-nilin" />
      </div>
    </div>
  </div>
);

/**
 * Generic grid skeleton for lists
 */
export const GridSkeleton: React.FC<{ count?: number; type?: 'card' | 'compact' }> = ({
  count = 6,
  type = 'card',
}) => (
  <div className={cn(
    'grid',
    type === 'card'
      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
      : 'grid-cols-1 gap-4'
  )}>
    {Array.from({ length: count }).map((_, i) => (
      <React.Fragment key={i}>
        {type === 'card' ? (
          <ServiceCardSkeleton />
        ) : (
          <div className="glass-nilin rounded-nilin-lg p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          </div>
        )}
      </React.Fragment>
    ))}
  </div>
);
