import React, { useState, useMemo } from 'react';
import { Award, Star, Crown, Sparkles, ChevronDown, ChevronUp, Gift, Lock, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useAuthStore } from '../../stores/authStore';

// =============================================================================
// NILIN Customer Dashboard - Loyalty Status Badge Component
// Displays loyalty tier with benefits
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface LoyaltyBenefits {
  tier: LoyaltyTier;
  name: string;
  minPoints: number;
  maxPoints: number;
  benefits: string[];
  bonusMultiplier: number;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ReactNode;
}

export interface LoyaltyStatusBadgeProps {
  /** Show expanded benefits list */
  showExpanded?: boolean;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Callback when tier upgrade is available */
  onTierUpgrade?: () => void;
  /** Callback when benefits are clicked */
  onBenefitsClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Tier Configurations
// =============================================================================

const LOYALTY_TIERS: Record<LoyaltyTier, LoyaltyBenefits> = {
  bronze: {
    tier: 'bronze',
    name: 'Bronze',
    minPoints: 0,
    maxPoints: 999,
    benefits: [
      '5% discount on all bookings',
      'Birthday reward',
      'Priority email support',
      'Access to Bronze-only deals',
    ],
    bonusMultiplier: 1,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: <Award className="h-4 w-4" />,
  },
  silver: {
    tier: 'silver',
    name: 'Silver',
    minPoints: 1000,
    maxPoints: 4999,
    benefits: [
      '10% discount on all bookings',
      'Birthday reward + free upgrade',
      'Priority phone support',
      'Early access to sales',
      'Free service add-ons (monthly)',
    ],
    bonusMultiplier: 1.25,
    color: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-300',
    icon: <Star className="h-4 w-4" />,
  },
  gold: {
    tier: 'gold',
    name: 'Gold',
    minPoints: 5000,
    maxPoints: 14999,
    benefits: [
      '15% discount on all bookings',
      'VIP birthday package',
      'Dedicated support line',
      'First access to new features',
      'Quarterly free add-ons',
      'Exclusive Gold events access',
    ],
    bonusMultiplier: 1.5,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-400',
    icon: <Crown className="h-4 w-4" />,
  },
  platinum: {
    tier: 'platinum',
    name: 'Platinum',
    minPoints: 15000,
    maxPoints: 49999,
    benefits: [
      '20% discount on all bookings',
      'Premium birthday experience',
      '24/7 concierge support',
      'Complimentary priority bookings',
      'Monthly free service credits',
      'Private events access',
      'Personal account manager',
    ],
    bonusMultiplier: 2,
    color: 'text-slate-700',
    bgColor: 'bg-gradient-to-br from-slate-100 to-slate-50',
    borderColor: 'border-slate-400',
    icon: <Crown className="h-4 w-4" />,
  },
  diamond: {
    tier: 'diamond',
    name: 'Diamond',
    minPoints: 50000,
    maxPoints: Infinity,
    benefits: [
      '25% discount on all bookings',
      'Luxury birthday experience',
      'White-glove concierge service',
      'Guaranteed availability',
      'Significant monthly credits',
      'VIP event invitations',
      'Personal lifestyle manager',
      'Customized service packages',
    ],
    bonusMultiplier: 3,
    color: 'text-sky-600',
    bgColor: 'bg-gradient-to-br from-sky-50 via-slate-50 to-white',
    borderColor: 'border-sky-400',
    icon: <Sparkles className="h-4 w-4" />,
  },
};

// =============================================================================
// Progress Bar Component
// =============================================================================

interface TierProgressProps {
  currentPoints: number;
  currentTier: LoyaltyTier;
  nextTier: LoyaltyTier | null;
}

const TierProgress: React.FC<TierProgressProps> = ({
  currentPoints,
  currentTier,
  nextTier,
}) => {
  const currentConfig = LOYALTY_TIERS[currentTier];
  const nextConfig = nextTier ? LOYALTY_TIERS[nextTier] : null;

  if (!nextConfig) {
    return (
      <div className="mt-4 p-4 bg-gradient-to-r from-sky-50 to-slate-50 rounded-xl border border-sky-200">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-sky-600" />
          <span className="font-semibold text-sky-700">Maximum Tier Reached!</span>
        </div>
        <p className="text-sm text-sky-600">
          You've reached Diamond status. Enjoy all exclusive benefits!
        </p>
      </div>
    );
  }

  const progress = currentPoints - currentConfig.minPoints;
  const range = nextConfig.minPoints - currentConfig.minPoints;
  const percentage = Math.min(100, Math.max(0, (progress / range) * 100));
  const pointsNeeded = nextConfig.minPoints - currentPoints;

  return (
    <div className="mt-4">
      {/* Progress Info */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-medium text-nilin-charcoal">
            {currentPoints.toLocaleString()} points
          </span>
        </div>
        <span className="text-sm text-nilin-warmGray">
          {pointsNeeded.toLocaleString()} to {nextConfig.name}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative">
        <div className="h-3 bg-nilin-blush/30 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              'bg-gradient-to-r from-nilin-coral to-rose-400'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Current Position Marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-nilin-coral shadow-sm"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>

      {/* Tier Milestones */}
      <div className="flex justify-between mt-2 text-xs text-nilin-warmGray">
        <span>{currentConfig.name}</span>
        <span>{nextConfig.name}</span>
      </div>
    </div>
  );
};

// =============================================================================
// Benefit Item Component
// =============================================================================

interface BenefitItemProps {
  benefit: string;
  tier: LoyaltyTier;
  isLocked?: boolean;
}

const BenefitItem: React.FC<BenefitItemProps> = ({
  benefit,
  tier,
  isLocked = false,
}) => {
  return (
    <li className={cn(
      'flex items-start gap-2 text-sm py-1',
      isLocked ? 'text-gray-400' : 'text-nilin-charcoal'
    )}>
      {isLocked ? (
        <Lock className="h-4 w-4 flex-shrink-0 mt-0.5 text-gray-400" />
      ) : (
        <Check className="h-4 w-4 flex-shrink-0 mt-0.5 text-green-500" />
      )}
      <span>{benefit}</span>
    </li>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const LoyaltyStatusBadge: React.FC<LoyaltyStatusBadgeProps> = ({
  showExpanded = false,
  compact = false,
  onTierUpgrade,
  onBenefitsClick,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(showExpanded);

  const customerProfile = useAuthStore((state) => state.customerProfile);
  const loyaltyPoints = customerProfile?.loyaltyPoints;
  const loyaltySystem = customerProfile?.loyaltySystem;

  // Calculate current tier based on points
  const { currentTier, currentConfig, nextTier, nextConfig } = useMemo(() => {
    const points = loyaltyPoints?.current || loyaltySystem?.points || 0;

    let tier: LoyaltyTier = 'bronze';
    let next: LoyaltyTier | null = 'silver';

    if (points >= 50000) {
      tier = 'diamond';
      next = null;
    } else if (points >= 15000) {
      tier = 'platinum';
      next = 'diamond';
    } else if (points >= 5000) {
      tier = 'gold';
      next = 'platinum';
    } else if (points >= 1000) {
      tier = 'silver';
      next = 'gold';
    }

    return {
      currentTier: tier,
      currentConfig: LOYALTY_TIERS[tier],
      nextTier: next,
      nextConfig: next ? LOYALTY_TIERS[next] : null,
    };
  }, [loyaltyPoints, loyaltySystem]);

  const currentPoints = loyaltyPoints?.current || loyaltySystem?.points || 0;
  const expiringPoints = loyaltyPoints?.expiringPoints;
  const bonusMultiplier = currentConfig.bonusMultiplier;

  // Loading State
  if (!customerProfile) {
    return (
      <div className={cn('bg-white rounded-2xl p-4 shadow-sm border border-nilin-blush/30', className)}>
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-5 w-24 mb-2" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
    );
  }

  // Compact Mode
  if (compact) {
    return (
      <button
        onClick={onBenefitsClick}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
          currentConfig.bgColor,
          currentConfig.borderColor,
          'border',
          'hover:shadow-sm transition-all',
          className
        )}
      >
        {currentConfig.icon}
        <span className={cn('font-semibold', currentConfig.color)}>
          {currentConfig.name}
        </span>
        <span className="text-sm text-nilin-warmGray">
          {currentPoints.toLocaleString()} pts
        </span>
      </button>
    );
  }

  return (
    <div className={cn(
      'rounded-2xl border-2 overflow-hidden',
      currentConfig.bgColor,
      currentConfig.borderColor,
      className
    )}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          {/* Tier Info */}
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-14 h-14 rounded-xl flex items-center justify-center',
              'bg-white shadow-sm',
              currentConfig.color
            )}>
              {currentConfig.icon}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className={cn('text-xl font-bold', currentConfig.color)}>
                  {currentConfig.name}
                </h3>
                <Badge variant="primary" size="sm">
                  {bonusMultiplier}x points
                </Badge>
              </div>

              <p className="text-sm text-nilin-warmGray mt-0.5">
                {currentPoints.toLocaleString()} points
              </p>

              {expiringPoints && expiringPoints.amount > 0 && (
                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                  <Gift className="h-3 w-3" />
                  {expiringPoints.amount.toLocaleString()} points expiring soon
                </p>
              )}
            </div>
          </div>

          {/* Expand/Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 rounded-lg hover:bg-white/50 transition-colors"
            aria-label={isExpanded ? 'Collapse benefits' : 'Expand benefits'}
          >
            {isExpanded ? (
              <ChevronUp className="h-5 w-5 text-nilin-charcoal" />
            ) : (
              <ChevronDown className="h-5 w-5 text-nilin-charcoal" />
            )}
          </button>
        </div>

        {/* Progress to Next Tier */}
        <TierProgress
          currentPoints={currentPoints}
          currentTier={currentTier}
          nextTier={nextTier}
        />
      </div>

      {/* Expanded Benefits */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-nilin-blush/20">
          <div className="pt-4">
            <h4 className="text-sm font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
              <Gift className="h-4 w-4 text-nilin-coral" />
              Your {currentConfig.name} Benefits
            </h4>

            <ul className="space-y-1">
              {currentConfig.benefits.map((benefit, index) => (
                <BenefitItem
                  key={index}
                  benefit={benefit}
                  tier={currentTier}
                />
              ))}
            </ul>

            {/* Next Tier Preview */}
            {nextConfig && (
              <div className="mt-6">
                <h4 className="text-sm font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  Unlock at {nextConfig.name}
                </h4>

                <ul className="space-y-1">
                  {nextConfig.benefits.map((benefit, index) => (
                    <BenefitItem
                      key={index}
                      benefit={benefit}
                      tier={nextTier!}
                      isLocked
                    />
                  ))}
                </ul>
              </div>
            )}

            {/* CTA */}
            <div className="mt-6 flex gap-3">
              <Button
                variant="primary"
                size="sm"
                fullWidth
                onClick={onTierUpgrade}
              >
                Earn More Points
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBenefitsClick}
              >
                View All
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Standalone Tier Badge
// =============================================================================

interface TierBadgeProps {
  tier: LoyaltyTier;
  size?: 'sm' | 'md' | 'lg';
  showPoints?: boolean;
  points?: number;
  className?: string;
}

export const TierBadge: React.FC<TierBadgeProps> = ({
  tier,
  size = 'md',
  showPoints = false,
  points = 0,
  className,
}) => {
  const config = LOYALTY_TIERS[tier];

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-3 py-1 text-sm gap-1.5',
    lg: 'px-4 py-1.5 text-base gap-2',
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span className={cn(
      'inline-flex items-center rounded-full font-semibold',
      config.bgColor,
      config.color,
      sizeClasses[size],
      className
    )}>
      <span className={iconSizes[size]}>{config.icon}</span>
      <span>{config.name}</span>
      {showPoints && (
        <span className="opacity-75">· {points.toLocaleString()}</span>
      )}
    </span>
  );
};

// =============================================================================
// Exports
// =============================================================================

export { LOYALTY_TIERS };
export default LoyaltyStatusBadge;
