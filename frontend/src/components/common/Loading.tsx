import React from 'react';
import {
  Skeleton,
  ServiceCardSkeleton,
  ProviderCardSkeleton,
  BookingCardSkeleton,
  CategoryCardSkeleton,
  StatsCardSkeleton,
  ProfileSkeleton,
  ListItemSkeleton,
  PageSkeleton,
} from './Skeleton';
import { LoadingSpinner, PageLoader, InlineLoader } from './LoadingSpinner';

/**
 * NILIN-themed Loading Components
 *
 * Provides both spinner and skeleton loading states for a consistent
 * luxury minimal aesthetic throughout the app.
 */

// Re-export existing spinners
export { LoadingSpinner, PageLoader, InlineLoader };

// Re-export skeleton components
export {
  Skeleton,
  ServiceCardSkeleton,
  ProviderCardSkeleton,
  BookingCardSkeleton,
  CategoryCardSkeleton,
  StatsCardSkeleton,
  ProfileSkeleton,
  ListItemSkeleton,
  PageSkeleton,
};

// Convenience component for inline text loading
export const TextSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="space-y-2">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className="w-full"
        height={i === lines - 1 ? 12 : 16}
      />
    ))}
  </div>
);

// Convenience component for image loading
export const ImageSkeleton: React.FC<{ aspectRatio?: string }> = ({
  aspectRatio = '16/9',
}) => (
  <div
    className="w-full bg-gradient-to-r from-nilin-blush via-white to-nilin-blush rounded-xl animate-pulse"
    style={{ aspectRatio }}
  />
);

// Grid skeleton for search results
export const SearchResultsSkeleton: React.FC<{ count?: number }> = ({
  count = 6,
}) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <ServiceCardSkeleton key={i} />
    ))}
  </div>
);

// Table row skeleton for bookings list
export const TableRowSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 py-4 border-b border-nilin-border">
    <Skeleton variant="circular" className="w-10 h-10" />
    <div className="flex-1">
      <Skeleton className="w-48 h-4 mb-2" />
      <Skeleton className="w-32 h-3" />
    </div>
    <Skeleton className="w-20 h-6 rounded-full" />
  </div>
);

// Stat card skeleton for dashboard
export const DashboardStatsSkeleton: React.FC<{ count?: number }> = ({
  count = 4,
}) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <StatsCardSkeleton key={i} />
    ))}
  </div>
);

// Full page skeleton with header and content
export const FullPageSkeleton: React.FC<{
  title?: boolean;
  subtitle?: boolean;
  hasStats?: boolean;
  hasList?: boolean;
  listItems?: number;
}> = ({
  title = true,
  subtitle = true,
  hasStats = false,
  hasList = true,
  listItems = 6,
}) => (
  <div className="p-4 space-y-6">
    {title && <Skeleton className="w-48 h-8" />}
    {subtitle && <Skeleton className="w-64 h-4" />}
    {hasStats && <DashboardStatsSkeleton count={4} />}
    {hasList && (
      <div className="space-y-3">
        {Array.from({ length: listItems }).map((_, i) => (
          <ListItemSkeleton key={i} />
        ))}
      </div>
    )}
  </div>
);

export default LoadingSpinner;
