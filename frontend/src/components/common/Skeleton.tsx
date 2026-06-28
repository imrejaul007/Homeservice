import React from 'react';
import { cn } from '../../lib/utils';

/**
 * NILIN-themed Skeleton Loader Components
 *
 * Provides shimmer loading states matching the luxury minimal aesthetic.
 */

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'shimmer' | 'pulse' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'shimmer',
}) => {
  return (
    <div
      className={cn(
        'bg-gradient-to-r from-nilin-blush via-white to-nilin-blush bg-[length:200%_100%]',
        animation === 'shimmer' && 'animate-[shimmer_1.5s_ease-in-out_infinite]',
        animation === 'pulse' && 'animate-pulse',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'rounded-md h-4',
        variant === 'rectangular' && 'rounded-lg',
        className
      )}
      style={{
        width: width,
        height: height,
      }}
    />
  );
};

// Service Card Skeleton
export const ServiceCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-nilin-blush/20">
    <Skeleton className="w-full h-40 rounded-xl mb-3" />
    <Skeleton className="w-3/4 h-5 mb-2" />
    <Skeleton className="w-1/2 h-4 mb-3" />
    <div className="flex items-center justify-between">
      <Skeleton className="w-20 h-6 rounded-full" />
      <Skeleton className="w-24 h-8 rounded-lg" />
    </div>
  </div>
);

// Provider Card Skeleton
export const ProviderCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-nilin-blush/20">
    <div className="flex items-center gap-3 mb-3">
      <Skeleton variant="circular" className="w-12 h-12" />
      <div className="flex-1">
        <Skeleton className="w-32 h-4 mb-2" />
        <Skeleton className="w-24 h-3" />
      </div>
    </div>
    <Skeleton className="w-full h-20 rounded-lg mb-3" />
    <div className="flex gap-2">
      <Skeleton className="w-16 h-6 rounded-full" />
      <Skeleton className="w-16 h-6 rounded-full" />
    </div>
  </div>
);

// Booking Card Skeleton - matches actual BookingCard layout
export const BookingCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-nilin border border-nilin-border overflow-hidden">
    {/* Header with Status */}
    <div className="p-4 border-b border-nilin-border flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="w-40 h-5" />
          <Skeleton className="w-16 h-5 rounded-nilin-sm" />
        </div>
        <Skeleton className="w-32 h-4" />
      </div>
      <Skeleton className="w-20 h-6 rounded-full" />
    </div>
    {/* Booking Details Grid */}
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Date & Time */}
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
        <div className="flex-1">
          <Skeleton className="w-20 h-3 mb-1" />
          <Skeleton className="w-28 h-4 mb-1" />
          <Skeleton className="w-16 h-3" />
        </div>
      </div>
      {/* Provider */}
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
        <div className="flex-1">
          <Skeleton className="w-20 h-3 mb-1" />
          <Skeleton className="w-32 h-4 mb-1" />
          <Skeleton className="w-24 h-3" />
        </div>
      </div>
    </div>
    {/* Footer with Price and Actions */}
    <div className="p-4 bg-nilin-muted border-t border-nilin-border flex items-center justify-between">
      <div>
        <Skeleton className="w-20 h-3 mb-1" />
        <Skeleton className="w-24 h-6" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="w-16 h-9 rounded-nilin" />
        <Skeleton className="w-20 h-9 rounded-nilin" />
      </div>
    </div>
  </div>
);

// Category Card Skeleton
export const CategoryCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl p-4 shadow-sm border border-nilin-blush/20 flex flex-col items-center">
    <Skeleton variant="circular" className="w-16 h-16 mb-3" />
    <Skeleton className="w-24 h-4 mb-2" />
    <Skeleton className="w-16 h-3" />
  </div>
);

// Dashboard Stats Skeleton
export const StatsCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl p-5 shadow-sm border border-nilin-blush/20">
    <Skeleton className="w-8 h-8 rounded-lg mb-3" />
    <Skeleton className="w-20 h-8 mb-2" />
    <Skeleton className="w-32 h-4" />
  </div>
);

// Profile Skeleton
export const ProfileSkeleton: React.FC = () => (
  <div className="bg-white rounded-2xl p-6 shadow-sm border border-nilin-blush/20">
    <div className="flex items-center gap-4 mb-6">
      <Skeleton variant="circular" className="w-20 h-20" />
      <div className="flex-1">
        <Skeleton className="w-40 h-5 mb-2" />
        <Skeleton className="w-32 h-4" />
      </div>
    </div>
    <Skeleton className="w-full h-px mb-4" />
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="w-full h-12 rounded-lg" />
      <Skeleton className="w-full h-12 rounded-lg" />
      <Skeleton className="w-full h-12 rounded-lg" />
      <Skeleton className="w-full h-12 rounded-lg" />
    </div>
  </div>
);

// List Skeleton
export const ListItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 py-3">
    <Skeleton variant="circular" className="w-10 h-10" />
    <div className="flex-1">
      <Skeleton className="w-48 h-4 mb-2" />
      <Skeleton className="w-32 h-3" />
    </div>
    <Skeleton className="w-16 h-6 rounded-full" />
  </div>
);

// Page Skeleton
export const PageSkeleton: React.FC = () => (
  <div className="space-y-6 p-4">
    <Skeleton className="w-full h-64 rounded-2xl" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <CategoryCardSkeleton />
      <CategoryCardSkeleton />
      <CategoryCardSkeleton />
      <CategoryCardSkeleton />
    </div>
    <Skeleton className="w-full h-8" />
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
      <ServiceCardSkeleton />
    </div>
  </div>
);

export default Skeleton;
