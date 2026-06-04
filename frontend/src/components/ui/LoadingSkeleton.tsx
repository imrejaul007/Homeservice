import React from 'react';
import { cn } from '../../lib/utils';
import { LoadingShimmer } from '../common/LoadingShimmer';

// =============================================================================
// NILIN Design System - Dashboard Loading Skeletons
// Pre-built skeleton screens for dashboard loading states
// =============================================================================

// =============================================================================
// Dashboard Page Skeleton
// =============================================================================

interface DashboardSkeletonProps {
  className?: string;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({ className }) => (
  <div className={cn('space-y-6', className)}>
    {/* Welcome header skeleton */}
    <div className="space-y-2">
      <LoadingShimmer width="60%" height={32} borderRadius={8} />
      <LoadingShimmer width="40%" height={16} borderRadius={6} />
    </div>

    {/* Stats grid skeleton */}
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl p-5 border border-nilin-border/30 bg-white/40">
          <LoadingShimmer width={40} height={40} borderRadius={12} className="mb-3" />
          <LoadingShimmer width="60%" height={28} borderRadius={8} className="mb-2" />
          <LoadingShimmer width="80%" height={14} borderRadius={6} />
        </div>
      ))}
    </div>

    {/* Quick actions skeleton */}
    <div className="space-y-3">
      <LoadingShimmer width={120} height={20} borderRadius={6} className="mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl p-5 border border-nilin-border/30 bg-white/40">
            <LoadingShimmer width={56} height={56} borderRadius={16} className="mb-3" />
            <LoadingShimmer width="70%" height={16} borderRadius={6} className="mb-2" />
            <LoadingShimmer width="90%" height={12} borderRadius={6} />
          </div>
        ))}
      </div>
    </div>

    {/* Service list skeleton */}
    <div className="space-y-3">
      <LoadingShimmer width={160} height={20} borderRadius={6} className="mb-4" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-nilin-border/30 bg-white/40">
          <LoadingShimmer width={80} height={80} borderRadius={12} />
          <div className="flex-1 space-y-2">
            <LoadingShimmer width="60%" height={16} borderRadius={6} />
            <LoadingShimmer width="40%" height={12} borderRadius={6} />
            <LoadingShimmer width="30%" height={20} borderRadius={20} />
          </div>
          <LoadingShimmer width={60} height={24} borderRadius={8} />
        </div>
      ))}
    </div>
  </div>
);

// =============================================================================
// Stats Row Skeleton
// =============================================================================

interface StatsRowSkeletonProps {
  count?: number;
  className?: string;
}

export const StatsRowSkeleton: React.FC<StatsRowSkeletonProps> = ({
  count = 4,
  className
}) => (
  <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-4', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl p-5 border border-nilin-border/30 bg-white/40">
        <LoadingShimmer width={40} height={40} borderRadius={12} className="mb-3" />
        <LoadingShimmer width="60%" height={28} borderRadius={8} className="mb-2" />
        <LoadingShimmer width="80%" height={14} borderRadius={6} />
      </div>
    ))}
  </div>
);

// =============================================================================
// Quick Actions Row Skeleton
// =============================================================================

interface QuickActionsSkeletonProps {
  count?: number;
  className?: string;
}

export const QuickActionsSkeleton: React.FC<QuickActionsSkeletonProps> = ({
  count = 3,
  className
}) => (
  <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl p-5 border border-nilin-border/30 bg-white/40">
        <LoadingShimmer width={56} height={56} borderRadius={16} className="mb-3" />
        <LoadingShimmer width="70%" height={16} borderRadius={6} className="mb-2" />
        <LoadingShimmer width="90%" height={12} borderRadius={6} />
      </div>
    ))}
  </div>
);

// =============================================================================
// Service List Skeleton
// =============================================================================

interface ServiceListSkeletonProps {
  count?: number;
  className?: string;
}

export const ServiceListSkeleton: React.FC<ServiceListSkeletonProps> = ({
  count = 3,
  className
}) => (
  <div className={cn('space-y-3', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="flex items-center gap-4 p-4 rounded-2xl border border-nilin-border/30 bg-white/40"
      >
        <LoadingShimmer width={80} height={80} borderRadius={12} />
        <div className="flex-1 space-y-2">
          <LoadingShimmer width="60%" height={16} borderRadius={6} />
          <LoadingShimmer width="40%" height={12} borderRadius={6} />
          <LoadingShimmer width="30%" height={20} borderRadius={20} />
        </div>
        <LoadingShimmer width={60} height={24} borderRadius={8} />
      </div>
    ))}
  </div>
);

// =============================================================================
// Service Grid Skeleton
// =============================================================================

interface ServiceGridSkeletonProps {
  columns?: number;
  rows?: number;
  className?: string;
}

export const ServiceGridSkeleton: React.FC<ServiceGridSkeletonProps> = ({
  columns = 3,
  rows = 2,
  className
}) => (
  <div
    className={cn(
      'grid gap-4',
      className
    )}
    style={{
      gridTemplateColumns: `repeat(${columns}, 1fr)`,
    }}
  >
    {Array.from({ length: columns * rows }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-nilin-border/30 bg-white/40 overflow-hidden">
        <LoadingShimmer width="100%" height={160} borderRadius={0} />
        <div className="p-4 space-y-3">
          <LoadingShimmer width="80%" height={18} borderRadius={6} />
          <div className="flex gap-2">
            <LoadingShimmer width={60} height={24} borderRadius={20} />
            <LoadingShimmer width={60} height={24} borderRadius={20} />
          </div>
          <LoadingShimmer width="50%" height={14} borderRadius={6} />
          <div className="flex justify-between items-center pt-2 border-t border-nilin-border/30">
            <LoadingShimmer width={80} height={24} borderRadius={8} />
            <LoadingShimmer width={32} height={32} borderRadius={8} />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// =============================================================================
// Promo Cards Skeleton
// =============================================================================

interface PromoCardsSkeletonProps {
  count?: number;
  className?: string;
}

export const PromoCardsSkeleton: React.FC<PromoCardsSkeletonProps> = ({
  count = 2,
  className
}) => (
  <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-nilin-border/30 bg-white/40 p-5">
        <div className="flex items-start gap-4">
          <LoadingShimmer width={48} height={48} borderRadius={12} />
          <div className="flex-1 space-y-2">
            <LoadingShimmer width={100} height={20} borderRadius={20} />
            <LoadingShimmer width="80%" height={16} borderRadius={6} />
            <LoadingShimmer width="60%" height={14} borderRadius={6} />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// =============================================================================
// Booking List Skeleton
// =============================================================================

interface BookingListSkeletonProps {
  count?: number;
  className?: string;
}

export const BookingListSkeleton: React.FC<BookingListSkeletonProps> = ({
  count = 3,
  className
}) => (
  <div className={cn('space-y-4', className)}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="rounded-2xl border border-nilin-border/30 bg-white/40 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-nilin-border/30 flex justify-between items-start">
          <div className="space-y-2">
            <LoadingShimmer width={180} height={18} borderRadius={6} />
            <LoadingShimmer width={120} height={14} borderRadius={6} />
          </div>
          <LoadingShimmer width={80} height={28} borderRadius={20} />
        </div>
        {/* Body */}
        <div className="p-4 grid grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <LoadingShimmer width={40} height={40} borderRadius={10} />
            <div className="space-y-2">
              <LoadingShimmer width={80} height={12} borderRadius={6} />
              <LoadingShimmer width={100} height={14} borderRadius={6} />
            </div>
          </div>
          <div className="flex items-start gap-3">
            <LoadingShimmer width={40} height={40} borderRadius={10} />
            <div className="space-y-2">
              <LoadingShimmer width={80} height={12} borderRadius={6} />
              <LoadingShimmer width={100} height={14} borderRadius={6} />
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="p-4 bg-nilin-muted/30 border-t border-nilin-border/30 flex justify-between items-center">
          <div className="space-y-1">
            <LoadingShimmer width={80} height={12} borderRadius={6} />
            <LoadingShimmer width={60} height={24} borderRadius={6} />
          </div>
          <div className="flex gap-2">
            <LoadingShimmer width={70} height={36} borderRadius={10} />
            <LoadingShimmer width={90} height={36} borderRadius={10} />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// =============================================================================
// Profile Card Skeleton
// =============================================================================

interface ProfileSkeletonProps {
  className?: string;
}

export const ProfileSkeleton: React.FC<ProfileSkeletonProps> = ({ className }) => (
  <div className={cn('rounded-2xl border border-nilin-border/30 bg-white/40 p-6', className)}>
    <div className="flex items-center gap-4 mb-6">
      <LoadingShimmer width={80} height={80} borderRadius="50%" />
      <div className="space-y-2">
        <LoadingShimmer width={160} height={20} borderRadius={6} />
        <LoadingShimmer width={120} height={14} borderRadius={6} />
      </div>
    </div>
    <LoadingShimmer width="100%" height={1} borderRadius={1} className="mb-4" />
    <div className="grid grid-cols-2 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <LoadingShimmer width={80} height={12} borderRadius={6} />
          <LoadingShimmer width={120} height={16} borderRadius={6} />
        </div>
      ))}
    </div>
  </div>
);

// =============================================================================
// Empty State Card Skeleton
// =============================================================================

interface EmptyStateSkeletonProps {
  lines?: number;
  showAction?: boolean;
  className?: string;
}

export const EmptyStateSkeleton: React.FC<EmptyStateSkeletonProps> = ({
  lines = 3,
  showAction = true,
  className
}) => (
  <div className={cn('rounded-2xl border border-nilin-border/50 bg-white/40 p-8 text-center', className)}>
    <LoadingShimmer width={64} height={64} borderRadius="50%" className="mx-auto mb-4" />
    <LoadingShimmer width={160} height={20} borderRadius={6} className="mx-auto mb-2" />
    <LoadingShimmer width={240} height={14} borderRadius={6} className="mx-auto mb-4" />
    {showAction && (
      <LoadingShimmer width={120} height={40} borderRadius={10} className="mx-auto" />
    )}
  </div>
);

// =============================================================================
// Default Export
// =============================================================================

export default DashboardSkeleton;
