import React, { useState, useCallback } from 'react';
import {
  Check,
  Star,
  Crown,
  Zap,
  Shield,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CreditCard,
  AlertCircle,
  Loader2,
  Gift,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  BillingCycle,
  PackageBenefit,
  ServicePackage as ServicePackageInterface,
  SubscriptionDetails as SubscriptionDetailsInterface,
} from '../../types/subscription.types';

// Re-export BillingCycle for backwards compatibility
export type { BillingCycle } from '../../types/subscription.types';

// ============================================
// Type Definitions - using unified types
// ============================================

// Use unified provider subscription tier
export type PackageTier = 'basic' | 'standard' | 'premium' | 'elite';

// Backwards compatible alias - extend with needed properties
export type ServicePackage = ServicePackageInterface & {
  tier: PackageTier;
  price?: number;
  currency?: string;
  benefits?: Array<{
    id: string;
    name: string;
    icon?: string;
    value?: string | number;
    included?: boolean;
  }>;
  isPopular?: boolean;
};
export type SubscriptionDetails = SubscriptionDetailsInterface & { currentTier: PackageTier };

interface ServicePackageSubscriptionProps {
  packages: ServicePackage[];
  currentSubscription?: SubscriptionDetails;
  onSubscribe: (packageId: string, billingCycle: BillingCycle) => Promise<void>;
  onChangePlan?: (packageId: string, billingCycle: BillingCycle) => Promise<void>;
  onCancel?: () => Promise<void>;
  onToggleAutoRenewal?: (enabled: boolean) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

// ============================================
// Tier Configuration
// ============================================

const TIER_CONFIG: Record<PackageTier, { icon: React.ReactNode; color: string; label: string }> = {
  basic: {
    icon: <Star className="h-5 w-5" />,
    color: 'text-gray-500',
    label: 'Basic',
  },
  standard: {
    icon: <Shield className="h-5 w-5" />,
    color: 'text-blue-500',
    label: 'Standard',
  },
  premium: {
    icon: <Crown className="h-5 w-5" />,
    color: 'text-amber-500',
    label: 'Premium',
  },
  elite: {
    icon: <Sparkles className="h-5 w-5" />,
    color: 'text-purple-500',
    label: 'Elite',
  },
};

const BILLING_DISCOUNTS: Record<BillingCycle, number> = {
  monthly: 0,
  quarterly: 5,
  yearly: 20,
};

// ============================================
// Benefit Icons
// ============================================

const BenefitIcon: React.FC<{ icon?: string }> = ({ icon }) => {
  switch (icon) {
    case 'services':
      return <Zap className="h-4 w-4" />;
    case 'bookings':
      return <TrendingUp className="h-4 w-4" />;
    case 'support':
      return <Shield className="h-4 w-4" />;
    case 'featured':
      return <Crown className="h-4 w-4" />;
    case 'analytics':
      return <Sparkles className="h-4 w-4" />;
    default:
      return <Check className="h-4 w-4" />;
  }
};

// ============================================
// Package Card Component
// ============================================

interface PackageCardProps {
  pkg: ServicePackage;
  billingCycle: BillingCycle;
  isCurrentPlan: boolean;
  isUpgrading: boolean;
  isDowngrading: boolean;
  onSelect: () => void;
  isLoading?: boolean;
}

const PackageCard: React.FC<PackageCardProps> = ({
  pkg,
  billingCycle,
  isCurrentPlan,
  isUpgrading,
  isDowngrading,
  onSelect,
  isLoading,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const tierConfig = TIER_CONFIG[pkg.tier];
  const discount = BILLING_DISCOUNTS[billingCycle];
  const discountedPrice = pkg.price * (1 - discount / 100);
  const billingLabel = billingCycle === 'monthly' ? '/mo' : billingCycle === 'quarterly' ? '/qtr' : '/yr';

  return (
    <div
      className={cn(
        'relative rounded-2xl border-2 transition-all duration-300',
        isCurrentPlan
          ? 'border-nilin-coral bg-nilin-coral/5'
          : pkg.isPopular
          ? 'border-nilin-coral shadow-lg shadow-nilin-coral/10'
          : 'border-nilin-border hover:border-nilin-coral/50',
        isUpgrading && 'ring-2 ring-green-500/20',
        isDowngrading && 'opacity-75'
      )}
    >
      {/* Popular Badge */}
      {pkg.isPopular && !isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-gradient-to-r from-nilin-rose to-nilin-coral text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
            <Gift className="h-3 w-3" />
            Most Popular
          </span>
        </div>
      )}

      {/* Current Plan Badge */}
      {isCurrentPlan && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-nilin-coral text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1">
            <Check className="h-3 w-3" />
            Current Plan
          </span>
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className={cn('flex items-center gap-2 mb-1', tierConfig.color)}>
              {tierConfig.icon}
              <span className="font-bold text-lg">{pkg.name}</span>
            </div>
            <p className="text-sm text-nilin-warmGray">{pkg.description}</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-6">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-nilin-charcoal">
              {pkg.currency} {discountedPrice.toFixed(0)}
            </span>
            <span className="text-nilin-warmGray">{billingLabel}</span>
          </div>
          {discount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-green-600 font-medium">
                Save {discount}%
              </span>
              <span className="text-sm text-nilin-warmGray line-through">
                {pkg.currency} {pkg.price}/mo
              </span>
            </div>
          )}
        </div>

        {/* Action Button */}
        {!isCurrentPlan && (
          <button
            onClick={onSelect}
            disabled={isLoading || isDowngrading}
            className={cn(
              'w-full py-3 rounded-xl font-semibold transition-all mb-4',
              isUpgrading
                ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white hover:shadow-lg'
                : 'bg-nilin-blush text-nilin-charcoal hover:bg-nilin-coral/10'
            )}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mx-auto" />
            ) : isUpgrading ? (
              'Upgrade Now'
            ) : (
              'Downgrade'
            )}
          </button>
        )}

        {isCurrentPlan && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full py-3 rounded-xl font-semibold bg-nilin-blush text-nilin-charcoal hover:bg-nilin-coral/10 transition-all flex items-center justify-center gap-2"
          >
            Manage Plan
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}

        {/* Benefits */}
        <div className="space-y-3 mt-4">
          {pkg.benefits.slice(0, 4).map(benefit => (
            <div key={benefit.id} className="flex items-start gap-3">
              <div className="p-1 rounded-lg bg-green-100 text-green-600 flex-shrink-0">
                <BenefitIcon icon={benefit.icon} />
              </div>
              <div>
                <span className="text-sm font-medium text-nilin-charcoal">{benefit.name}</span>
                {benefit.value && (
                  <span className="text-sm text-nilin-warmGray ml-1">
                    ({typeof benefit.value === 'number' ? `${benefit.value}+` : benefit.value})
                  </span>
                )}
              </div>
            </div>
          ))}

          {pkg.benefits.length > 4 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-sm text-nilin-coral font-medium hover:underline"
            >
              {isExpanded ? 'Show less' : `+${pkg.benefits.length - 4} more benefits`}
            </button>
          )}
        </div>

        {/* Expanded Content */}
        {isExpanded && isCurrentPlan && (
          <div className="mt-4 pt-4 border-t border-nilin-border space-y-3">
            {pkg.benefits.slice(4).map(benefit => (
              <div key={benefit.id} className="flex items-start gap-3">
                <div className="p-1 rounded-lg bg-green-100 text-green-600 flex-shrink-0">
                  <BenefitIcon icon={benefit.icon} />
                </div>
                <div>
                  <span className="text-sm font-medium text-nilin-charcoal">{benefit.name}</span>
                  {benefit.value && (
                    <span className="text-sm text-nilin-warmGray ml-1">
                      ({typeof benefit.value === 'number' ? `${benefit.value}+` : benefit.value})
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

const ServicePackageSubscription: React.FC<ServicePackageSubscriptionProps> = ({
  packages,
  currentSubscription,
  onSubscribe,
  onChangePlan,
  onCancel,
  onToggleAutoRenewal,
  isLoading = false,
  className,
}) => {
  const [selectedCycle, setSelectedCycle] = useState<BillingCycle>('monthly');
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);

  const handlePackageSelect = useCallback(async (pkgId: string) => {
    if (!currentSubscription) {
      await onSubscribe(pkgId, selectedCycle);
    } else {
      await onChangePlan?.(pkgId, selectedCycle);
    }
  }, [currentSubscription, selectedCycle, onSubscribe, onChangePlan]);

  const getTierOrder = (tier: PackageTier): number => {
    const order: Record<PackageTier, number> = { basic: 1, standard: 2, premium: 3, elite: 4 };
    return order[tier];
  };

  const currentTierOrder = currentSubscription ? getTierOrder(currentSubscription.currentTier) : 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-nilin-charcoal mb-2">
          Choose Your Plan
        </h2>
        <p className="text-nilin-warmGray">
          Unlock more features and grow your business
        </p>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex bg-nilin-blush/50 rounded-xl p-1">
          {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map(cycle => (
            <button
              key={cycle}
              onClick={() => setSelectedCycle(cycle)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                selectedCycle === cycle
                  ? 'bg-white text-nilin-charcoal shadow-sm'
                  : 'text-nilin-warmGray hover:text-nilin-charcoal'
              )}
            >
              {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
              {BILLING_DISCOUNTS[cycle] > 0 && (
                <span className="ml-1 text-xs text-green-600 font-semibold">
                  Save {BILLING_DISCOUNTS[cycle]}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Current Subscription Summary */}
      {currentSubscription && (
        <div className="bg-gradient-to-r from-nilin-rose/10 to-nilin-coral/10 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-nilin-warmGray mb-1">Current Plan</p>
              <p className="text-xl font-bold text-nilin-charcoal flex items-center gap-2">
                {TIER_CONFIG[currentSubscription.currentTier].icon}
                {TIER_CONFIG[currentSubscription.currentTier].label}
              </p>
              <p className="text-sm text-nilin-warmGray mt-1">
                Renews {new Date(currentSubscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-nilin-warmGray mb-1">
                {currentSubscription.autoRenewal ? 'Auto-renewal ON' : 'Auto-renewal OFF'}
              </p>
              {currentSubscription.totalSaved > 0 && (
                <p className="text-sm text-green-600 font-medium">
                  Total saved: {currentSubscription.totalSaved}
                </p>
              )}
            </div>
          </div>

          {/* Subscription Actions */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => onToggleAutoRenewal?.(!currentSubscription.autoRenewal)}
              disabled={isLoading}
              className="flex-1 py-2 px-4 bg-white rounded-xl text-sm font-medium text-nilin-charcoal hover:bg-nilin-blush/50 transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard className="h-4 w-4" />
              {currentSubscription.autoRenewal ? 'Disable' : 'Enable'} Auto-Renew
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="py-2 px-4 text-sm font-medium text-nilin-error hover:bg-nilin-error/10 rounded-xl transition-colors"
            >
              Cancel Plan
            </button>
          </div>
        </div>
      )}

      {/* Package Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {packages.map(pkg => {
          const tierOrder = getTierOrder(pkg.tier);
          const isCurrentPlan = currentSubscription?.currentTier === pkg.tier;
          const isUpgrading = tierOrder > currentTierOrder;
          const isDowngrading = tierOrder < currentTierOrder;

          return (
            <PackageCard
              key={pkg._id}
              pkg={pkg}
              billingCycle={selectedCycle}
              isCurrentPlan={isCurrentPlan}
              isUpgrading={isUpgrading}
              isDowngrading={isDowngrading}
              onSelect={() => handlePackageSelect(pkg._id)}
              isLoading={isLoading && selectedPackage === pkg._id}
            />
          );
        })}
      </div>

      {/* Warning for Downgrade */}
      {selectedPackage && packages.find(p => p._id === selectedPackage) && (
        (() => {
          const pkg = packages.find(p => p._id === selectedPackage)!;
          const tierOrder = getTierOrder(pkg.tier);
          const isDowngrading = tierOrder < currentTierOrder;

          if (isDowngrading) {
            return (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">
                    Downgrading will reduce your features
                  </p>
                  <p className="text-sm text-amber-600 mt-1">
                    You may lose access to some services. Changes take effect at the end of your billing period.
                  </p>
                </div>
              </div>
            );
          }
          return null;
        })()
      )}

      {/* Terms Note */}
      <p className="text-xs text-center text-nilin-warmGray">
        All prices in AED. Cancel anytime. Changes take effect at the start of your next billing period.
      </p>
    </div>
  );
};

export default ServicePackageSubscription;
