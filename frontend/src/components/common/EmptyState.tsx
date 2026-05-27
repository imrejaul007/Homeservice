import React from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import Button from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
  };
  className?: string;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-12 px-6',
        className
      )}
    >
      {/* Icon */}
      {icon && (
        <div
          className={cn(
            'mb-4 p-4 rounded-full bg-gradient-to-br from-nilin-blush to-nilin-peach',
            compact && 'p-3 mb-3'
          )}
        >
          <div className="text-nilin-coral opacity-80">
            {icon}
          </div>
        </div>
      )}

      {/* Title */}
      <h3
        className={cn(
          'font-semibold text-nilin-charcoal mb-2',
          compact ? 'text-base' : 'text-lg'
        )}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn(
            'text-nilin-warmGray max-w-sm mb-4',
            compact ? 'text-sm' : 'text-base'
          )}
        >
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <Button
          variant={action.variant || 'primary'}
          size={compact ? 'sm' : 'md'}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};

// Pre-built empty states for common scenarios

export const NoBookingsEmpty: React.FC<{ onBrowseServices: () => void }> = ({
  onBrowseServices,
}) => (
  <EmptyState
    icon={
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    }
    title="No bookings yet"
    description="Start exploring our services and book your first appointment today."
    action={{
      label: 'Browse Services',
      onClick: onBrowseServices,
      variant: 'primary',
    }}
  />
);

export const NoSearchResultsEmpty: React.FC<{ onClearFilters: () => void }> = ({
  onClearFilters,
}) => (
  <EmptyState
    icon={
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    }
    title="No results found"
    description="Try adjusting your search or filters to find what you're looking for."
    action={{
      label: 'Clear Filters',
      onClick: onClearFilters,
      variant: 'secondary',
    }}
  />
);

export const NoFavoritesEmpty: React.FC<{ onBrowseServices: () => void }> = ({
  onBrowseServices,
}) => (
  <EmptyState
    icon={
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    }
    title="No favorites yet"
    description="Save your favorite providers here for quick access."
    action={{
      label: 'Explore Providers',
      onClick: onBrowseServices,
      variant: 'primary',
    }}
  />
);

export const NoNotificationsEmpty: React.FC = () => (
  <EmptyState
    icon={
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    }
    title="All caught up!"
    description="You don't have any notifications at the moment."
    compact
  />
);

export const NoReviewsEmpty: React.FC<{ onWriteReview: () => void }> = ({
  onWriteReview,
}) => (
  <EmptyState
    icon={
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    }
    title="No reviews yet"
    description="Share your experience to help others discover great services."
    action={{
      label: 'Write a Review',
      onClick: onWriteReview,
      variant: 'primary',
    }}
  />
);

export const ErrorState: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <EmptyState
    icon={
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    }
    title="Something went wrong"
    description="We encountered an error loading this content. Please try again."
    action={{
      label: 'Try Again',
      onClick: onRetry,
      variant: 'secondary',
    }}
  />
);

export default EmptyState;
