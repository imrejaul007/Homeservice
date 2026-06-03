import React from 'react';
import { cn } from '../../lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

// =============================================================================
// NILIN Design System - StatCard Component
// Gradient stat cards with hover effects and animations
// =============================================================================

export interface StatCardProps {
  /** Card label/title */
  label: string;
  /** Main stat value */
  value: string | number;
  /** Optional description/subtitle */
  description?: string;
  /** Icon component to display */
  icon?: React.ReactNode;
  /** Trend indicator - positive or negative change */
  trend?: {
    value: string;
    type: 'up' | 'down' | 'neutral';
  };
  /** Gradient color variant */
  variant?: 'blush' | 'coral' | 'lavender' | 'mint' | 'gold';
  /** Click handler */
  onClick?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Custom class name */
  className?: string;
}

// Gradient variants matching NILIN brand
const variantStyles: Record<NonNullable<StatCardProps['variant']>, {
  gradient: string;
  iconBg: string;
  iconColor: string;
  textColor: string;
}> = {
  blush: {
    gradient: 'bg-gradient-to-br from-nilin-blush via-white to-nilin-peach',
    iconBg: 'bg-nilin-rose/20',
    iconColor: 'text-nilin-rose',
    textColor: 'text-nilin-charcoal',
  },
  coral: {
    gradient: 'bg-gradient-to-br from-nilin-coral/20 via-white to-nilin-rose/10',
    iconBg: 'bg-nilin-coral/20',
    iconColor: 'text-nilin-coral',
    textColor: 'text-nilin-charcoal',
  },
  lavender: {
    gradient: 'bg-gradient-to-br from-purple-50 via-white to-purple-50/50',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    textColor: 'text-nilin-charcoal',
  },
  mint: {
    gradient: 'bg-gradient-to-br from-green-50 via-white to-green-50/50',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    textColor: 'text-nilin-charcoal',
  },
  gold: {
    gradient: 'bg-gradient-to-br from-amber-50 via-white to-amber-50/50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    textColor: 'text-nilin-charcoal',
  },
};

// =============================================================================
// StatCard Component
// =============================================================================

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  description,
  icon,
  trend,
  variant = 'blush',
  onClick,
  loading = false,
  className,
}) => {
  const styles = variantStyles[variant];

  // Loading skeleton
  if (loading) {
    return (
      <div
        className={cn(
          'rounded-2xl p-5 border border-nilin-border/30',
          'animate-pulse',
          className
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-nilin-blush" />
          <div className="w-16 h-5 rounded-full bg-nilin-blush" />
        </div>
        <div className="w-20 h-8 rounded-lg bg-nilin-blush mb-2" />
        <div className="w-32 h-4 rounded-md bg-nilin-blush/60" />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={cn(
        'rounded-2xl p-5 border border-nilin-border/30 transition-all duration-300',
        'hover:shadow-nilin-lg hover:-translate-y-1 hover:border-nilin-coral/30',
        'cursor-pointer',
        styles.gradient,
        className
      )}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        {/* Icon */}
        {icon && (
          <div
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center',
              styles.iconBg
            )}
          >
            <span className={cn(styles.iconColor)}>
              {icon}
            </span>
          </div>
        )}

        {/* Trend Badge */}
        {trend && (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
              trend.type === 'up' && 'bg-green-100 text-green-700',
              trend.type === 'down' && 'bg-red-100 text-red-700',
              trend.type === 'neutral' && 'bg-gray-100 text-gray-600'
            )}
          >
            {trend.type === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend.type === 'down' && <TrendingDown className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
      </div>

      {/* Value */}
      <div className={cn('text-2xl font-bold mb-1', styles.textColor)}>
        {value}
      </div>

      {/* Label */}
      <div className="text-sm text-nilin-warmGray font-medium">
        {label}
      </div>

      {/* Description */}
      {description && (
        <div className="mt-2 text-xs text-nilin-lightGray">
          {description}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// StatCardGrid - For responsive grid of stat cards
// =============================================================================

interface StatCardGridProps {
  children: React.ReactNode;
  columns?: {
    default: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
  gap?: string;
  className?: string;
}

// Helper to get Tailwind grid column classes
const getGridClasses = (columns: StatCardGridProps['columns'] = {}) => {
  const { default: def = 1, sm, md, lg } = columns;

  const classes: string[] = [];

  // Default columns
  if (def === 1) classes.push('grid-cols-1');
  else if (def === 2) classes.push('grid-cols-2');
  else if (def === 3) classes.push('grid-cols-3');
  else if (def === 4) classes.push('grid-cols-4');

  // SM breakpoint
  if (sm === 2) classes.push('sm:grid-cols-2');
  else if (sm === 3) classes.push('sm:grid-cols-3');
  else if (sm === 4) classes.push('sm:grid-cols-4');

  // MD breakpoint
  if (md === 2) classes.push('md:grid-cols-2');
  else if (md === 3) classes.push('md:grid-cols-3');
  else if (md === 4) classes.push('md:grid-cols-4');

  // LG breakpoint
  if (lg === 2) classes.push('lg:grid-cols-2');
  else if (lg === 3) classes.push('lg:grid-cols-3');
  else if (lg === 4) classes.push('lg:grid-cols-4');

  return classes.join(' ');
};

export const StatCardGrid: React.FC<StatCardGridProps> = ({
  children,
  columns = { default: 1, sm: 2, md: 2, lg: 4 },
  gap = 'gap-4',
  className,
}) => {
  return (
    <div className={cn('w-full grid', getGridClasses(columns), gap, className)}>
      {children}
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default StatCard;
