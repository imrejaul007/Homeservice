import React from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';
import Button from './Button';
import { Plus } from 'lucide-react';

// NILIN Brand Colors
const COLORS = {
  coral: '#E8B4A8',
  rose: '#D4A89A',
  blush: '#F5E6E0',
  peach: '#FAE5E0',
  charcoal: '#2D2926',
  warmGray: '#6B635B',
  lightGray: '#A39E99',
};

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: ReactNode;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
  };
  className?: string;
  compact?: boolean;
  // New props for enhanced empty states
  variant?: 'empty' | 'search';
  showIllustration?: boolean;
}

// SVG Illustration for "No Services Yet" (empty state)
const EmptyServicesIllustration: React.FC = () => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 140 140"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Background circle */}
    <circle cx="70" cy="70" r="55" fill={COLORS.blush} opacity="0.6" />
    <circle cx="70" cy="70" r="45" fill={COLORS.peach} opacity="0.5" />

    {/* Main folder/document shape */}
    <g transform="translate(35, 45)">
      {/* Folder body */}
      <path
        d="M8 8H42C44.2091 8 46 9.79086 46 12V48C46 50.2091 44.2091 52 42 52H8C5.79086 52 4 50.2091 4 48V12C4 9.79086 5.79086 8 8 8Z"
        fill="white"
        stroke={COLORS.coral}
        strokeWidth="2"
      />
      {/* Folder tab */}
      <path
        d="M8 8C8 5.79086 9.79086 4 12 4H28C30.2091 4 32 5.79086 32 8V12C32 14.2091 30.2091 16 28 16H12C9.79086 16 8 14.2091 8 12V8Z"
        fill={COLORS.peach}
        stroke={COLORS.coral}
        strokeWidth="2"
      />
      {/* Document lines */}
      <line x1="12" y1="24" x2="38" y2="24" stroke={COLORS.rose} strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="32" x2="32" y2="32" stroke={COLORS.rose} strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="40" x2="28" y2="40" stroke={COLORS.rose} strokeWidth="2" strokeLinecap="round" />
    </g>

    {/* Plus badge */}
    <g transform="translate(85, 75)">
      <circle cx="12" cy="12" r="12" fill={COLORS.coral} />
      <path
        d="M12 6V18M6 12H18"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </g>

    {/* Decorative sparkles */}
    <g opacity="0.7">
      {/* Top sparkle */}
      <path
        d="M25 30L27 35L25 40L23 35L25 30Z"
        fill={COLORS.coral}
      />
      {/* Right sparkle */}
      <path
        d="M115 50L117 54L115 58L113 54L115 50Z"
        fill={COLORS.rose}
      />
      {/* Bottom sparkle */}
      <path
        d="M100 105L102 108L100 111L98 108L100 105Z"
        fill={COLORS.coral}
      />
      {/* Small dots */}
      <circle cx="30" cy="100" r="3" fill={COLORS.peach} />
      <circle cx="110" cy="85" r="2" fill={COLORS.rose} />
    </g>

    {/* Floating elements */}
    <circle cx="20" cy="55" r="4" fill={COLORS.blush} opacity="0.8" />
    <circle cx="120" cy="70" r="5" fill={COLORS.peach} opacity="0.6" />
    <circle cx="25" cy="85" r="3" fill={COLORS.rose} opacity="0.5" />
  </svg>
);

// SVG Illustration for "No Search Results" (search state)
const SearchEmptyIllustration: React.FC = () => (
  <svg
    width="120"
    height="120"
    viewBox="0 0 140 140"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Background circle */}
    <circle cx="70" cy="70" r="55" fill={COLORS.blush} opacity="0.6" />
    <circle cx="70" cy="70" r="45" fill={COLORS.peach} opacity="0.5" />

    {/* Magnifying glass */}
    <g transform="translate(40, 40)">
      {/* Glass circle */}
      <circle
        cx="28"
        cy="28"
        r="22"
        fill="white"
        stroke={COLORS.coral}
        strokeWidth="3"
      />
      {/* Glass handle */}
      <line
        x1="44"
        y1="44"
        x2="58"
        y2="58"
        stroke={COLORS.coral}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {/* Inner reflection */}
      <path
        d="M18 20C18 20 22 16 28 16"
        stroke={COLORS.rose}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />
    </g>

    {/* X mark inside magnifying glass */}
    <g transform="translate(58, 58)" opacity="0.5">
      <line x1="0" y1="0" x2="12" y2="12" stroke={COLORS.rose} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="0" x2="0" y2="12" stroke={COLORS.rose} strokeWidth="2.5" strokeLinecap="round" />
    </g>

    {/* Decorative elements */}
    <g opacity="0.7">
      {/* Top right dots */}
      <circle cx="100" cy="35" r="3" fill={COLORS.coral} />
      <circle cx="108" cy="42" r="2" fill={COLORS.rose} />
      <circle cx="95" cy="45" r="2" fill={COLORS.peach} />

      {/* Bottom left dots */}
      <circle cx="35" cy="105" r="3" fill={COLORS.rose} />
      <circle cx="28" cy="98" r="2" fill={COLORS.coral} />
      <circle cx="42" cy="100" r="2" fill={COLORS.blush} />

      {/* Floating dots */}
      <circle cx="115" cy="85" r="4" fill={COLORS.peach} opacity="0.6" />
      <circle cx="22" cy="70" r="3" fill={COLORS.blush} opacity="0.8" />
    </g>

    {/* Question mark sparkle */}
    <g transform="translate(95, 85)">
      <path
        d="M8 0L10 5L8 10L6 5L8 0Z"
        fill={COLORS.coral}
      />
    </g>
  </svg>
);

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
  variant = 'empty',
  showIllustration = false,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center animate-fade-in',
        compact ? 'py-8 px-4' : 'py-12 px-6',
        className
      )}
      role="status"
      aria-live="polite"
    >
      {/* Custom SVG Illustration */}
      {showIllustration && !icon && (
        <div className={cn('mb-6', compact && 'mb-4')}>
          {variant === 'empty' ? (
            <EmptyServicesIllustration />
          ) : (
            <SearchEmptyIllustration />
          )}
        </div>
      )}

      {/* Icon (legacy support) */}
      {icon && !showIllustration && (
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
          'font-serif text-nilin-charcoal mb-2',
          compact ? 'text-base' : 'text-xl'
        )}
      >
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p
          className={cn(
            'text-nilin-warmGray max-w-sm mb-6',
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

// Pre-built empty state for provider services
export const NoServicesEmpty: React.FC<{ onCreateService: () => void }> = ({
  onCreateService,
}) => (
  <EmptyState
    showIllustration
    variant="empty"
    title="No services yet"
    description="Start by creating your first service offering and grow your business."
    action={{
      label: (
        <span className="inline-flex items-center gap-2">
          <Plus className="w-4 h-4" aria-hidden="true" />
          Create Your First Service
        </span>
      ),
      onClick: onCreateService,
      variant: 'primary',
    }}
  />
);

// Pre-built empty state for search results in provider services
export const NoServicesSearchEmpty: React.FC<{ onClearFilters: () => void }> = ({
  onClearFilters,
}) => (
  <EmptyState
    showIllustration
    variant="search"
    title="No services found"
    description="Try adjusting your search terms or filters to find what you're looking for."
    action={{
      label: 'Clear Filters',
      onClick: onClearFilters,
      variant: 'secondary',
    }}
  />
);

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

// Pre-built empty state for trash view
export const NoTrashItemsEmpty: React.FC = () => (
  <EmptyState
    icon={
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    }
    title="Trash is empty"
    description="Deleted services will appear here for 30 days before permanent removal."
    compact
  />
);

export default EmptyState;
