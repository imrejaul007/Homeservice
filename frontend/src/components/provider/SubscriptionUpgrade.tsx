import React, { useState } from 'react';
import {
  Crown,
  Zap,
  Star,
  Check,
  X,
  ChevronRight,
  Sparkles,
  Shield,
  TrendingUp,
  Users,
  Calendar,
  CreditCard,
  AlertCircle,
  ArrowUp
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type {
  ProviderSubscriptionTier,
  ProviderSubscriptionPlan,
  PlanFeatures,
  BillingCycle,
} from '../../types/subscription.types';

// Use unified type - backwards compatible alias
export type PlanTier = ProviderSubscriptionTier;

// Backwards compatible type alias for local use
type LocalSubscriptionPlan = Omit<ProviderSubscriptionPlan, 'tier' | 'features'> & {
  tier: PlanTier;
  features: PlanFeatures;
};

interface SubscriptionUpgradeProps {
  currentPlan: PlanTier;
  onUpgrade: (plan: PlanTier, billingCycle: BillingCycle) => void;
  onDowngrade?: (plan: PlanTier) => void;
  currentPeriodEnd?: Date;
  prorationAmount?: number;
}

const PLANS: LocalSubscriptionPlan[] = [
  {
    tier: 'basic',
    name: 'Basic',
    description: 'Perfect for starting out',
    monthlyPrice: 0,
    annualPrice: 0,
    features: {
      maxServices: 5,
      maxImages: 10,
      featuredListing: false,
      prioritySupport: false,
      analytics: false,
      customBranding: false,
      apiAccess: false,
      commissionRate: 15,
      bookingLimit: 20,
      leadCredits: 5,
      featuredDays: 0,
    },
  },
  {
    tier: 'standard',
    name: 'Standard',
    description: 'Grow your business',
    monthlyPrice: 99,
    annualPrice: 89,
    features: {
      maxServices: 20,
      maxImages: 30,
      featuredListing: true,
      prioritySupport: false,
      analytics: true,
      customBranding: false,
      apiAccess: false,
      commissionRate: 12,
      bookingLimit: 100,
      leadCredits: 25,
      featuredDays: 7,
    },
  },
  {
    tier: 'premium',
    name: 'Premium',
    description: 'For established providers',
    monthlyPrice: 249,
    annualPrice: 199,
    features: {
      maxServices: -1,
      maxImages: -1,
      featuredListing: true,
      prioritySupport: true,
      analytics: true,
      customBranding: true,
      apiAccess: true,
      commissionRate: 10,
      bookingLimit: -1,
      leadCredits: 100,
      featuredDays: 14,
    },
    popular: true,
  },
  {
    tier: 'elite',
    name: 'Elite',
    description: 'Maximum visibility & features',
    monthlyPrice: 499,
    annualPrice: 399,
    features: {
      maxServices: -1,
      maxImages: -1,
      featuredListing: true,
      prioritySupport: true,
      analytics: true,
      customBranding: true,
      apiAccess: true,
      commissionRate: 8,
      bookingLimit: -1,
      leadCredits: -1,
      featuredDays: 30,
    },
    highlighted: true,
  },
];

const SubscriptionUpgrade: React.FC<SubscriptionUpgradeProps> = ({
  currentPlan,
  onUpgrade,
  onDowngrade,
  currentPeriodEnd,
  prorationAmount = 0,
}) => {
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('premium');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [showComparison, setShowComparison] = useState(false);

  const formatPrice = (price: number) => {
    if (price === 0) return 'Free';
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-AE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  };

  const getCurrentPlanIndex = () => PLANS.findIndex((p) => p.tier === currentPlan);
  const getSelectedPlanIndex = () => PLANS.findIndex((p) => p.tier === selectedPlan);
  const isUpgrade = getSelectedPlanIndex() > getCurrentPlanIndex();
  const isDowngrade = getSelectedPlanIndex() < getCurrentPlanIndex();

  const selectedPlanData = PLANS.find((p) => p.tier === selectedPlan)!;
  const currentPlanData = PLANS.find((p) => p.tier === currentPlan)!;
  const price = billingCycle === 'yearly' ? selectedPlanData.annualPrice : selectedPlanData.monthlyPrice;
  const savings = billingCycle === 'yearly'
    ? (selectedPlanData.monthlyPrice * 12) - (selectedPlanData.annualPrice * 12)
    : 0;

  const handleConfirm = () => {
    if (isUpgrade) {
      onUpgrade(selectedPlan, billingCycle);
    } else if (isDowngrade && onDowngrade) {
      onDowngrade(selectedPlan);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Crown className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-nilin-charcoal">Upgrade Your Subscription</h2>
        <p className="text-nilin-gray mt-2">Choose the plan that fits your business needs</p>
      </div>

      {/* Current Plan Banner */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-4 mb-8 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-white/80">Current Plan</p>
              <p className="font-semibold text-lg">{currentPlanData.name}</p>
            </div>
          </div>
          {currentPeriodEnd && (
            <div className="text-right">
              <p className="text-sm text-white/80">Renews</p>
              <p className="font-medium">{formatDate(currentPeriodEnd)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center gap-4 p-1 bg-gray-100 rounded-xl">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={cn(
              'px-6 py-2.5 rounded-lg font-medium transition',
              billingCycle === 'monthly'
                ? 'bg-white text-nilin-charcoal shadow-sm'
                : 'text-nilin-gray hover:text-nilin-charcoal'
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={cn(
              'px-6 py-2.5 rounded-lg font-medium transition flex items-center gap-2',
              billingCycle === 'yearly'
                ? 'bg-white text-nilin-charcoal shadow-sm'
                : 'text-nilin-gray hover:text-nilin-charcoal'
            )}
          >
            Yearly
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
              Save 20%
            </span>
          </button>
        </div>
      </div>

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {PLANS.map((plan) => {
          const isSelected = selectedPlan === plan.tier;
          const isCurrent = currentPlan === plan.tier;
          const planPrice = billingCycle === 'yearly' ? plan.annualPrice : plan.monthlyPrice;
          const isDisabled = isCurrent || (isDowngrade && plan.tier !== selectedPlan);

          return (
            <div
              key={plan.tier}
              onClick={() => !isDisabled && setSelectedPlan(plan.tier)}
              className={cn(
                'relative border-2 rounded-2xl p-6 transition-all cursor-pointer',
                isSelected
                  ? 'border-nilin-coral shadow-lg scale-[1.02]'
                  : isDisabled
                    ? 'border-gray-200 opacity-60 cursor-not-allowed'
                    : 'border-gray-200 hover:border-gray-300',
                plan.highlighted && 'bg-gradient-to-b from-amber-50 to-white'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold rounded-full">
                  Most Popular
                </div>
              )}
              {plan.highlighted && !plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full">
                  Best Value
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4 px-3 py-1 bg-blue-500 text-white text-xs font-semibold rounded-full">
                  Current
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-nilin-charcoal">{plan.name}</h3>
                <p className="text-sm text-nilin-gray mt-1">{plan.description}</p>
              </div>

              <div className="text-center mb-6">
                <p className="text-3xl font-bold text-nilin-charcoal">{formatPrice(planPrice)}</p>
                <p className="text-sm text-nilin-gray">per month</p>
                {billingCycle === 'yearly' && planPrice > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    Billed {formatPrice(planPrice * 12)}/year
                  </p>
                )}
              </div>

              {/* Key Features */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>{plan.features.maxServices === -1 ? 'Unlimited' : plan.features.maxServices} services</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>{plan.features.commissionRate}% commission</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>{plan.features.featuredDays > 0 ? `${plan.features.featuredDays} days` : 'No'} featured</span>
                </div>
              </div>

              {/* Selection Indicator */}
              <div className="flex justify-center">
                <div
                  className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center transition',
                    isSelected ? 'border-nilin-coral bg-nilin-coral' : 'border-gray-300'
                  )}
                >
                  {isSelected && <Check className="h-4 w-4 text-white" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison Table Toggle */}
      <button
        onClick={() => setShowComparison(!showComparison)}
        className="w-full py-3 text-center text-nilin-coral hover:underline mb-6"
      >
        {showComparison ? 'Hide' : 'Show'} full feature comparison
      </button>

      {/* Feature Comparison */}
      {showComparison && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-8">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-nilin-gray">Feature</th>
                {PLANS.map((plan) => (
                  <th key={plan.tier} className="text-center py-3 px-4 font-medium text-nilin-charcoal">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Max Services', key: 'maxServices', format: (v: number) => v === -1 ? 'Unlimited' : v.toString() },
                { label: 'Max Images per Service', key: 'maxImages', format: (v: number) => v === -1 ? 'Unlimited' : v.toString() },
                { label: 'Featured Listings', key: 'featuredListing', format: (v: boolean) => v ? 'Yes' : 'No', bool: true },
                { label: 'Featured Days', key: 'featuredDays', format: (v: number) => v === 0 ? 'None' : `${v} days/month` },
                { label: 'Priority Support', key: 'prioritySupport', format: (v: boolean) => v ? 'Yes' : 'No', bool: true },
                { label: 'Analytics Dashboard', key: 'analytics', format: (v: boolean) => v ? 'Yes' : 'No', bool: true },
                { label: 'Custom Branding', key: 'customBranding', format: (v: boolean) => v ? 'Yes' : 'No', bool: true },
                { label: 'API Access', key: 'apiAccess', format: (v: boolean) => v ? 'Yes' : 'No', bool: true },
                { label: 'Platform Commission', key: 'commissionRate', format: (v: number) => `${v}%` },
                { label: 'Monthly Booking Limit', key: 'bookingLimit', format: (v: number) => v === -1 ? 'Unlimited' : v.toString() },
                { label: 'Lead Credits', key: 'leadCredits', format: (v: number) => v === -1 ? 'Unlimited' : v.toString() },
              ].map((row, index) => (
                <tr key={row.key} className={cn('border-b border-gray-100', index % 2 === 0 && 'bg-gray-50/50')}>
                  <td className="py-3 px-4 text-sm text-nilin-gray">{row.label}</td>
                  {PLANS.map((plan) => {
                    const value = plan.features[row.key as keyof PlanFeatures];
                    return (
                      <td key={plan.tier} className="py-3 px-4 text-center text-sm">
                        {row.bool ? (
                          value ? (
                            <Check className="h-4 w-4 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-gray-300 mx-auto" />
                          )
                        ) : (
                          <span className={cn(
                            'font-medium',
                            currentPlan === plan.tier && 'text-nilin-coral'
                          )}>
                            {(row.format as (v: number) => string)(value as number)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Proration Notice */}
      {prorationAmount > 0 && isUpgrade && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">Prorated Charge</p>
            <p className="text-sm text-blue-700">
              You'll be charged {formatPrice(prorationAmount)} immediately for the upgrade, then {formatPrice(price)}/month starting next billing cycle.
            </p>
          </div>
        </div>
      )}

      {/* Summary & CTA */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              {isUpgrade ? 'Upgrade' : isDowngrade ? 'Downgrade' : 'Selected'} Plan: {selectedPlanData.name}
            </h3>
            <p className="text-sm text-nilin-gray">
              {isUpgrade
                ? `Upgrade from ${currentPlanData.name} to ${selectedPlanData.name}`
                : `Switch to ${selectedPlanData.name}`}
            </p>
            {savings > 0 && (
              <p className="text-sm text-green-600 mt-1">
                You save {formatPrice(savings)} per year with annual billing!
              </p>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-sm text-nilin-gray">Total</p>
              <p className="text-2xl font-bold text-nilin-charcoal">
                {formatPrice(price)}<span className="text-sm font-normal text-nilin-gray">/mo</span>
              </p>
            </div>

            <button
              onClick={handleConfirm}
              disabled={selectedPlan === currentPlan}
              className={cn(
                'px-8 py-3 rounded-xl font-semibold transition-all flex items-center gap-2',
                isUpgrade
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:shadow-lg hover:scale-[1.02]'
                  : isDowngrade
                    ? 'bg-gray-200 text-nilin-charcoal hover:bg-gray-300'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              {isUpgrade ? (
                <>
                  <ArrowUp className="h-5 w-5" />
                  Upgrade Now
                </>
              ) : isDowngrade ? (
                <>
                  <ChevronRight className="h-5 w-5" />
                  Confirm {selectedPlanData.name}
                </>
              ) : (
                'Current Plan'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Trust Badges */}
      <div className="flex items-center justify-center gap-8 mt-8 text-nilin-gray">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <span className="text-sm">Secure Payment</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <span className="text-sm">Cancel Anytime</span>
        </div>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          <span className="text-sm">All Cards Accepted</span>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionUpgrade;
