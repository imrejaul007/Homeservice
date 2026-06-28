/**
 * EmptyState - Reusable empty state component for admin dashboards
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={<Users />}
 *   title="No customers found"
 *   description="Try adjusting your filters"
 *   action={{
 *     label: "Clear filters",
 *     onClick: handleClearFilters
 *   }}
 *   variant="default"
 * />
 * ```
 */

import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export type EmptyStateVariant = 'default' | 'success' | 'warning' | 'error';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface EmptyStateProps {
  /** Icon to display (48-64px, muted) */
  icon: React.ReactNode;
  /** Main title text (default: text-lg, font-semibold) */
  title: string;
  /** Description text (default: text-sm, text-muted) */
  description?: string;
  /** Optional CTA button configuration */
  action?: EmptyStateAction;
  /** Visual variant (default, success, warning, error) */
  variant?: EmptyStateVariant;
  /** Custom className for container */
  className?: string;
  /** Custom className for icon wrapper */
  iconClassName?: string;
  /** Custom icon size */
  iconSize?: number;
}

const variantStyles: Record<EmptyStateVariant, { container: string; icon: string; title: string }> = {
  default: {
    container: 'bg-white/80 backdrop-blur-sm border border-nilin-border',
    icon: 'text-nilin-warmGray',
    title: 'text-nilin-charcoal',
  },
  success: {
    container: 'bg-emerald-50/80 backdrop-blur-sm border border-emerald-200',
    icon: 'text-emerald-500',
    title: 'text-emerald-800',
  },
  warning: {
    container: 'bg-amber-50/80 backdrop-blur-sm border border-amber-200',
    icon: 'text-amber-500',
    title: 'text-amber-800',
  },
  error: {
    container: 'bg-red-50/80 backdrop-blur-sm border border-red-200',
    icon: 'text-red-500',
    title: 'text-red-800',
  },
};

const actionButtonStyles: Record<NonNullable<EmptyStateAction['variant']>, string> = {
  primary: 'bg-nilin-coral text-white hover:bg-nilin-rose focus:ring-nilin-coral',
  secondary: 'bg-gray-100 text-nilin-charcoal hover:bg-gray-200 focus:ring-gray-400',
  danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className,
  iconClassName,
  iconSize = 48,
}) => {
  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'rounded-2xl p-8 md:p-12 flex flex-col items-center justify-center text-center',
        'animate-fade-in',
        styles.container,
        className
      )}
      role="status"
      aria-label={`Empty state: ${title}`}
    >
      {/* Icon */}
      <div
        className={cn('mb-4', styles.icon, iconClassName)}
        style={{ width: iconSize, height: iconSize }}
        aria-hidden="true"
      >
        {icon}
      </div>

      {/* Title */}
      <h3 className={cn('text-lg font-semibold mb-2', styles.title)}>
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-nilin-warmGray max-w-md mb-6">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <button
          onClick={action.onClick}
          className={cn(
            'px-5 py-2.5 rounded-lg font-medium text-sm transition-all',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            actionButtonStyles[action.variant || 'primary']
          )}
        >
          {action.label}
        </button>
      )}
    </div>
  );
};

/**
 * NoResultsEmptyState - Pre-configured empty state for search with no results
 */
export const NoResultsEmptyState: React.FC<{
  searchTerm?: string;
  onClearFilters?: () => void;
  className?: string;
}> = ({ searchTerm, onClearFilters, className }) => (
  <EmptyState
    icon={
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    }
    title={searchTerm ? `No results for "${searchTerm}"` : 'No results found'}
    description={searchTerm ? 'Try adjusting your search or filters' : 'No items match your current criteria'}
    action={
      onClearFilters
        ? {
            label: 'Clear all filters',
            onClick: onClearFilters,
            variant: 'secondary',
          }
        : undefined
    }
    className={className}
  />
);

/**
 * ErrorEmptyState - Pre-configured empty state for error states
 */
export const ErrorEmptyState: React.FC<{
  message?: string;
  onRetry?: () => void;
  className?: string;
}> = ({ message = 'Something went wrong', onRetry, className }) => (
  <EmptyState
    icon={
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
    }
    title="Unable to load"
    description={message}
    variant="error"
    action={
      onRetry
        ? {
            label: 'Try again',
            onClick: onRetry,
            variant: 'primary',
          }
        : undefined
    }
    className={className}
  />
);

/**
 * SuccessEmptyState - Pre-configured empty state for success/operation complete
 */
export const SuccessEmptyState: React.FC<{
  title?: string;
  description?: string;
  className?: string;
}> = ({ title = 'All done!', description, className }) => (
  <EmptyState
    icon={
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    }
    title={title}
    description={description}
    variant="success"
    className={className}
  />
);

/**
 * ListEmptyState - Generic list empty state
 */
export const ListEmptyState: React.FC<{
  title?: string;
  description?: string;
  action?: EmptyStateAction;
  className?: string;
}> = ({ title = 'No items', description, action, className }) => (
  <EmptyState
    icon={
      <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    }
    title={title}
    description={description}
    action={action}
    className={className}
  />
);

export default EmptyState;
