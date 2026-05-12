import React from 'react';
import { cn } from '../../lib/utils';

// =============================================================================
// NILIN Design System - Badge Component
// =============================================================================

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Visual style variant */
  variant?: BadgeVariant;
  /** Size preset */
  size?: BadgeSize;
  /** Optional dot indicator */
  dot?: boolean;
  /** Pill shape (full rounded) */
  pill?: boolean;
  /** Dot color override */
  dotColor?: string;
}

// =============================================================================
// Style Configurations
// =============================================================================

const variantStyles: Record<BadgeVariant, { bg: string; text: string; dot: string }> = {
  default: {
    bg: 'bg-nilin-blush',
    text: 'text-nilin-charcoal',
    dot: 'bg-nilin-rose',
  },
  primary: {
    bg: 'bg-nilin-coral/15',
    text: 'text-nilin-rose',
    dot: 'bg-nilin-coral',
  },
  success: {
    bg: 'bg-nilin-success/15',
    text: 'text-nilin-success',
    dot: 'bg-nilin-success',
  },
  warning: {
    bg: 'bg-nilin-warning/20',
    text: 'text-amber-700',
    dot: 'bg-nilin-warning',
  },
  error: {
    bg: 'bg-nilin-error/15',
    text: 'text-nilin-error',
    dot: 'bg-nilin-error',
  },
};

const sizeStyles: Record<BadgeSize, { container: string; text: string; dot: string }> = {
  sm: {
    container: 'px-2 py-0.5 text-xs',
    text: 'text-xs',
    dot: 'w-1.5 h-1.5',
  },
  md: {
    container: 'px-2.5 py-1 text-sm',
    text: 'text-sm',
    dot: 'w-2 h-2',
  },
};

// =============================================================================
// Badge Component
// =============================================================================

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'md',
      dot = false,
      pill = false,
      dotColor,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const styles = variantStyles[variant];
    const sizes = sizeStyles[size];

    return (
      <span
        ref={ref}
        className={cn(
          // Base styles
          'inline-flex',
          'items-center',
          'gap-1.5',
          'font-medium',
          'rounded-lg',

          // Variant
          styles.bg,
          styles.text,

          // Size
          sizes.container,

          // Pill shape override
          pill && 'rounded-full',

          // Focus styles
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/30',

          // Custom className
          className
        )}
        {...props}
      >
        {/* Dot Indicator */}
        {dot && (
          <span
            className={cn(
              'rounded-full',
              sizes.dot,
              dotColor || styles.dot
            )}
            aria-hidden="true"
          />
        )}

        {/* Badge Content */}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// =============================================================================
// Preset Badges
// =============================================================================

interface StatusBadgeProps extends Omit<BadgeProps, 'variant' | 'dot'> {
  status: 'active' | 'pending' | 'inactive' | 'cancelled' | 'completed';
}

const statusVariantMap: Record<StatusBadgeProps['status'], BadgeVariant> = {
  active: 'success',
  pending: 'warning',
  inactive: 'default',
  cancelled: 'error',
  completed: 'primary',
};

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'sm',
  pill = true,
  className,
  ...props
}) => {
  const statusLabels: Record<StatusBadgeProps['status'], string> = {
    active: 'Active',
    pending: 'Pending',
    inactive: 'Inactive',
    cancelled: 'Cancelled',
    completed: 'Completed',
  };

  return (
    <Badge
      variant={statusVariantMap[status]}
      size={size}
      dot
      pill={pill}
      className={className}
      {...props}
    >
      {statusLabels[status]}
    </Badge>
  );
};

// =============================================================================
// Count Badge (for notifications, etc.)
// =============================================================================

interface CountBadgeProps extends Omit<BadgeProps, 'variant' | 'children'> {
  count: number;
  max?: number;
  showZero?: boolean;
}

const CountBadge: React.FC<CountBadgeProps> = ({
  count,
  max = 99,
  showZero = false,
  size = 'sm',
  className,
  ...props
}) => {
  const displayCount = count > max ? `${max}+` : count;

  if (count === 0 && !showZero) return null;

  return (
    <Badge
      variant="error"
      size={size}
      pill
      className={cn('min-w-[1.25rem] justify-center font-semibold', className)}
      {...props}
    >
      {displayCount}
    </Badge>
  );
};

// =============================================================================
// Exports
// =============================================================================

export { Badge, StatusBadge, CountBadge };
export default Badge;
