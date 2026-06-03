import React from 'react';
import { cn } from '../../lib/utils';
import { ArrowRight } from 'lucide-react';
import { FadeSection } from './FadeSection';

// =============================================================================
// NILIN Design System - Dashboard Section Components
// Consistent section layout with headers, actions, and content areas
// =============================================================================

// Section Header Props
interface SectionHeaderProps {
  /** Section title */
  title: string;
  /** Optional icon to display alongside title */
  icon?: React.ReactNode;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Optional badge/count to display */
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning';
  };
  /** Action button configuration */
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  /** Whether to show fade-in animation */
  animate?: boolean;
  /** Animation delay in ms */
  delay?: number;
  /** Custom class name for the header wrapper */
  className?: string;
}

// Badge variant styles
const badgeVariants = {
  default: 'bg-nilin-blush text-nilin-warmGray',
  primary: 'bg-nilin-coral/10 text-nilin-coral',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-amber-100 text-amber-700',
};

/**
 * DashboardSectionHeader
 *
 * Consistent section header with icon, title, subtitle, badge, and action button.
 * Designed for use in dashboard layouts.
 */
export const DashboardSectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  subtitle,
  badge,
  action,
  animate = true,
  delay = 0,
  className,
}) => {
  const headerContent = (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <div className="flex items-center gap-3">
        {/* Icon */}
        {icon && (
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nilin-coral/10 to-nilin-rose/10
                          flex items-center justify-center flex-shrink-0">
            <span className="text-nilin-coral">{icon}</span>
          </div>
        )}

        {/* Title and subtitle */}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-serif font-medium text-nilin-charcoal">
              {title}
            </h2>
            {badge && (
              <span className={cn(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                badgeVariants[badge.variant || 'default']
              )}>
                {badge.text}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-nilin-warmGray mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Action button */}
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1 text-sm font-medium text-nilin-coral
                     hover:text-nilin-rose transition-colors group"
        >
          {action.icon && (
            <span className="mr-1">{action.icon}</span>
          )}
          {action.label}
          <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );

  if (animate) {
    return <FadeSection delay={delay}>{headerContent}</FadeSection>;
  }

  return headerContent;
};

// =============================================================================
// Dashboard Card Wrapper
// =============================================================================

interface DashboardCardProps {
  children: React.ReactNode;
  /** Card padding size */
  padding?: 'sm' | 'md' | 'lg';
  /** Whether to show hover effect */
  hoverable?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Animation delay */
  delay?: number;
  /** Custom class name */
  className?: string;
}

const paddingSizes = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const DashboardCard: React.FC<DashboardCardProps> = ({
  children,
  padding = 'md',
  hoverable = true,
  onClick,
  delay = 0,
  className,
}) => {
  const cardContent = (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      className={cn(
        'rounded-2xl border border-nilin-border/50 bg-white/60 backdrop-blur-md',
        paddingSizes[padding],
        hoverable && 'hover:bg-white hover:shadow-nilin-lg hover:-translate-y-0.5',
        onClick && 'cursor-pointer',
        'transition-all duration-300',
        className
      )}
    >
      {children}
    </div>
  );

  return (
    <FadeSection delay={delay}>
      {cardContent}
    </FadeSection>
  );
};

// =============================================================================
// Dashboard Section Container
// =============================================================================

interface DashboardSectionProps {
  children: React.ReactNode;
  /** Section title */
  title?: string;
  /** Section icon */
  icon?: React.ReactNode;
  /** Section subtitle */
  subtitle?: string;
  /** Badge config */
  badge?: {
    text: string;
    variant?: 'default' | 'primary' | 'success' | 'warning';
  };
  /** Action button config */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Section bottom margin */
  spacing?: 'sm' | 'md' | 'lg' | 'none';
  /** Animation delay offset */
  startDelay?: number;
  /** Custom class name */
  className?: string;
}

const spacingSizes = {
  sm: 'mb-6',
  md: 'mb-8',
  lg: 'mb-10',
  none: 'mb-0',
};

export const DashboardSection: React.FC<DashboardSectionProps> = ({
  children,
  title,
  icon,
  subtitle,
  badge,
  action,
  spacing = 'md',
  startDelay = 0,
  className,
}) => {
  return (
    <section className={cn(spacingSizes[spacing], className)}>
      {title && (
        <DashboardSectionHeader
          title={title}
          icon={icon}
          subtitle={subtitle}
          badge={badge}
          action={action}
          animate={false}
          delay={startDelay}
        />
      )}
      <FadeSection delay={startDelay + 50}>
        {children}
      </FadeSection>
    </section>
  );
};

// =============================================================================
// Quick Actions Grid
// =============================================================================

interface QuickActionsGridProps {
  children: React.ReactNode;
  columns?: {
    default: number;
    sm?: number;
    md?: number;
  };
  gap?: string;
  className?: string;
}

// Helper to get responsive grid classes
const getResponsiveGridClasses = (columns: QuickActionsGridProps['columns'] = {}) => {
  const { default: def = 1, sm, md } = columns;

  const classes: string[] = [];

  // Default columns
  if (def === 1) classes.push('grid-cols-1');
  else if (def === 2) classes.push('grid-cols-2');
  else if (def === 3) classes.push('grid-cols-3');

  // SM breakpoint
  if (sm === 2) classes.push('sm:grid-cols-2');
  else if (sm === 3) classes.push('sm:grid-cols-3');

  // MD breakpoint
  if (md === 2) classes.push('md:grid-cols-2');
  else if (md === 3) classes.push('md:grid-cols-3');

  return classes.join(' ');
};

export const QuickActionsGrid: React.FC<QuickActionsGridProps> = ({
  children,
  columns = { default: 1, md: 3 },
  gap = 'gap-4',
  className,
}) => {
  return (
    <div className={cn('grid', getResponsiveGridClasses(columns), gap, className)}>
      {children}
    </div>
  );
};

// =============================================================================
// Promo Card
// =============================================================================

interface PromoCardProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  badge?: string;
  gradient: string;
  iconBg?: string;
  iconColor?: string;
  onClick?: () => void;
  delay?: number;
}

export const PromoCard: React.FC<PromoCardProps> = ({
  title,
  description,
  icon,
  badge,
  gradient,
  iconBg = 'bg-white/60',
  iconColor = 'text-nilin-coral',
  onClick,
  delay = 0,
}) => {
  return (
    <FadeSection delay={delay}>
      <div
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        className={cn(
          'relative overflow-hidden rounded-2xl border border-nilin-border/50',
          'bg-gradient-to-br p-5 cursor-pointer',
          gradient,
          'hover:shadow-nilin-lg hover:-translate-y-1 transition-all duration-300'
        )}
      >
        <div className="flex items-start gap-4">
          {icon && (
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', iconBg, iconColor)}>
              {icon}
            </div>
          )}
          <div className="flex-1">
            {badge && (
              <span className="inline-block px-2 py-0.5 bg-white/60 text-nilin-warmGray text-xs rounded-full mb-1">
                {badge}
              </span>
            )}
            <h3 className="font-semibold text-nilin-charcoal">{title}</h3>
            <p className="text-sm text-nilin-warmGray mt-0.5">{description}</p>
          </div>
        </div>
      </div>
    </FadeSection>
  );
};

// =============================================================================
// Exports
// =============================================================================

export {
  DashboardSectionHeader,
  DashboardCard,
  QuickActionsGrid,
};
export default DashboardSection;
