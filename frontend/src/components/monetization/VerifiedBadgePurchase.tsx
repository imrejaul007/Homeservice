import React, { useState } from 'react';
import {
  BadgeCheck,
  Check,
  Star,
  Crown,
  Diamond,
  Sparkles,
  TrendingUp,
  BarChart3,
  Headphones,
  Zap,
  Calendar,
  CreditCard,
  AlertCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';

type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum';

interface BadgeFeatures {
  priorityVisibility: boolean;
  customBadge: boolean;
  analytics: boolean;
  supportPriority: number;
  featuredSearchSlots: number;
  exclusiveBadges: string[];
}

interface BadgeProduct {
  productId: string;
  name: string;
  description: string;
  tier: BadgeTier;
  price: number;
  durationDays: number;
  features: string[];
  benefits: BadgeFeatures;
  renewalDiscount: number;
}

interface VerifiedBadgePurchaseProps {
  onPurchase: (tier: BadgeTier, autoRenew: boolean) => Promise<void>;
  onCancel: () => void;
  currentTier?: BadgeTier;
  isLoading?: boolean;
}

const tierConfig: Record<BadgeTier, {
  name: string;
  color: string;
  gradient: string;
  icon: React.ElementType;
  badgeStyle: string;
}> = {
  bronze: {
    name: 'Bronze',
    color: 'text-amber-700',
    gradient: 'from-amber-600 to-amber-800',
    icon: Star,
    badgeStyle: 'bg-gradient-to-br from-amber-600 to-amber-800',
  },
  silver: {
    name: 'Silver',
    color: 'text-slate-400',
    gradient: 'from-slate-400 to-slate-600',
    icon: Star,
    badgeStyle: 'bg-gradient-to-br from-slate-300 to-slate-500',
  },
  gold: {
    name: 'Gold',
    color: 'text-amber-500',
    gradient: 'from-amber-400 to-yellow-500',
    icon: Crown,
    badgeStyle: 'bg-gradient-to-br from-amber-400 to-yellow-500',
  },
  platinum: {
    name: 'Platinum',
    color: 'text-purple-300',
    gradient: 'from-purple-400 to-pink-500',
    icon: Diamond,
    badgeStyle: 'bg-gradient-to-br from-purple-400 to-pink-500',
  },
};

const VerifiedBadgePurchase: React.FC<VerifiedBadgePurchaseProps> = ({
  onPurchase,
  onCancel,
  currentTier,
  isLoading = false,
}) => {
  const [selectedTier, setSelectedTier] = useState<BadgeTier | null>(null);
  const [autoRenew, setAutoRenew] = useState(true);
  const [showFeatures, setShowFeatures] = useState<BadgeTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const products: BadgeProduct[] = [
    {
      productId: 'BADGE-BRONZE',
      name: 'Bronze Verified',
      description: 'Basic verified badge for trusted providers',
      tier: 'bronze',
      price: 29.99,
      durationDays: 30,
      features: [
        'Verified badge on profile',
        'Basic search priority',
        'Email support',
        'Up to 10 featured slots/month',
      ],
      benefits: {
        priorityVisibility: true,
        customBadge: false,
        analytics: false,
        supportPriority: 4,
        featuredSearchSlots: 10,
        exclusiveBadges: ['bronze-check'],
      },
      renewalDiscount: 10,
    },
    {
      productId: 'BADGE-SILVER',
      name: 'Silver Verified',
      description: 'Enhanced verified badge with analytics',
      tier: 'silver',
      price: 59.99,
      durationDays: 30,
      features: [
        'Verified badge with silver styling',
        'Enhanced search priority',
        'Basic analytics dashboard',
        'Priority email support',
        'Up to 25 featured slots/month',
        'Custom response template',
      ],
      benefits: {
        priorityVisibility: true,
        customBadge: false,
        analytics: true,
        supportPriority: 3,
        featuredSearchSlots: 25,
        exclusiveBadges: ['silver-check', 'silver-star'],
      },
      renewalDiscount: 15,
    },
    {
      productId: 'BADGE-GOLD',
      name: 'Gold Verified',
      description: 'Premium verified badge with full analytics',
      tier: 'gold',
      price: 99.99,
      durationDays: 30,
      features: [
        'Verified badge with gold styling',
        'Top search priority placement',
        'Full analytics dashboard',
        'Priority phone support',
        'Up to 50 featured slots/month',
        'Custom response templates',
        'Featured in category highlights',
        'Monthly performance report',
      ],
      benefits: {
        priorityVisibility: true,
        customBadge: true,
        analytics: true,
        supportPriority: 2,
        featuredSearchSlots: 50,
        exclusiveBadges: ['gold-check', 'gold-star', 'gold-crown'],
      },
      renewalDiscount: 20,
    },
    {
      productId: 'BADGE-PLATINUM',
      name: 'Platinum Verified',
      description: 'The ultimate verified badge with exclusive benefits',
      tier: 'platinum',
      price: 199.99,
      durationDays: 30,
      features: [
        'Exclusive platinum verified badge',
        'Number 1 search priority placement',
        'Real-time analytics dashboard',
        'Dedicated account manager',
        'Unlimited featured slots',
        'Custom branded profile',
        'Featured in all category highlights',
        'Weekly performance reports',
        'Early access to new features',
        'Exclusive partner discounts',
      ],
      benefits: {
        priorityVisibility: true,
        customBadge: true,
        analytics: true,
        supportPriority: 1,
        featuredSearchSlots: -1,
        exclusiveBadges: ['platinum-check', 'platinum-star', 'platinum-crown', 'platinum-diamond'],
      },
      renewalDiscount: 25,
    },
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const handlePurchase = async () => {
    if (!selectedTier) return;

    setError(null);
    try {
      await onPurchase(selectedTier, autoRenew);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    }
  };

  const isUpgrade = (tier: BadgeTier) => {
    if (!currentTier) return true;
    const tiers: BadgeTier[] = ['bronze', 'silver', 'gold', 'platinum'];
    return tiers.indexOf(tier) > tiers.indexOf(currentTier);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <BadgeCheck className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-nilin-charcoal">
          Get Verified Badge
        </h2>
        <p className="text-nilin-gray mt-2 max-w-md mx-auto">
          Stand out to customers with a verified badge. Higher tiers get more visibility and exclusive features.
        </p>
      </div>

      {/* Badge Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {products.map((product) => {
          const config = tierConfig[product.tier];
          const isSelected = selectedTier === product.tier;
          const isCurrent = currentTier === product.tier;
          const upgradeAvailable = isUpgrade(product.tier);

          return (
            <div
              key={product.productId}
              className={cn(
                'relative border-2 rounded-xl p-4 cursor-pointer transition-all',
                isSelected
                  ? 'border-nilin-coral ring-2 ring-nilin-coral/20 bg-nilin-coral/5'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md',
                isCurrent && 'opacity-60'
              )}
              onClick={() => upgradeAvailable && setSelectedTier(product.tier)}
            >
              {/* Current Badge Indicator */}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-nilin-coral text-white text-xs font-semibold rounded-full">
                  Current
                </div>
              )}

              {/* Not Upgradeable Overlay */}
              {!upgradeAvailable && !isCurrent && (
                <div className="absolute inset-0 bg-gray-100/80 rounded-xl flex items-center justify-center z-10">
                  <span className="text-sm text-nilin-gray font-medium">
                    {currentTier ? 'Lower tier' : 'Current tier'}
                  </span>
                </div>
              )}

              {/* Badge Icon */}
              <div className={cn('w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3', config.badgeStyle)}>
                <config.icon className="h-7 w-7 text-white" />
              </div>

              {/* Name & Price */}
              <div className="text-center mb-3">
                <h3 className={cn('font-bold text-lg', config.color)}>
                  {config.name}
                </h3>
                <p className="text-2xl font-bold text-nilin-charcoal">
                  {formatPrice(product.price)}
                </p>
                <p className="text-xs text-nilin-gray">/ {product.durationDays} days</p>
              </div>

              {/* Key Features */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span className="text-nilin-charcoal">Search Priority</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <BarChart3 className="h-4 w-4 text-blue-500" />
                  <span className="text-nilin-charcoal">
                    {product.benefits.featuredSearchSlots === -1 ? 'Unlimited' : product.benefits.featuredSearchSlots} slots
                  </span>
                </div>
                {product.benefits.analytics && (
                  <div className="flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                    <span className="text-nilin-charcoal">Analytics</span>
                  </div>
                )}
              </div>

              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute -top-3 -right-3 w-8 h-8 bg-nilin-coral rounded-full flex items-center justify-center shadow-lg">
                  <Check className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Tier Details */}
      {selectedTier && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          {(() => {
            const product = products.find(p => p.tier === selectedTier);
            if (!product) return null;
            const config = tierConfig[selectedTier];

            return (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', config.badgeStyle)}>
                    <config.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className={cn('font-bold text-lg', config.color)}>{product.name}</h3>
                    <p className="text-sm text-nilin-gray">{product.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-nilin-gray">Duration</p>
                    <p className="font-semibold text-nilin-charcoal">{product.durationDays} days</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-nilin-gray">Featured Slots</p>
                    <p className="font-semibold text-nilin-charcoal">
                      {product.benefits.featuredSearchSlots === -1 ? 'Unlimited' : product.benefits.featuredSearchSlots}/mo
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-nilin-gray">Support Priority</p>
                    <p className="font-semibold text-nilin-charcoal">#{product.benefits.supportPriority}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-nilin-gray">Renewal Discount</p>
                    <p className="font-semibold text-green-600">{product.renewalDiscount}% off</p>
                  </div>
                </div>

                <h4 className="font-semibold text-nilin-charcoal mb-2">All Features:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {product.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      <span className="text-nilin-charcoal">{feature}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Auto-Renew Toggle */}
      {selectedTier && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-blue-600" />
            <div>
              <p className="font-medium text-nilin-charcoal">Auto-Renew</p>
              <p className="text-xs text-nilin-gray">
                Never lose your badge with automatic renewal
              </p>
            </div>
          </div>
          <button
            onClick={() => setAutoRenew(!autoRenew)}
            className={cn(
              'w-12 h-7 rounded-full transition-colors relative',
              autoRenew ? 'bg-nilin-coral' : 'bg-gray-300'
            )}
          >
            <div
              className={cn(
                'absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform',
                autoRenew ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-semibold text-nilin-gray hover:bg-gray-50 transition"
        >
          Cancel
        </button>
        <button
          onClick={handlePurchase}
          disabled={!selectedTier || isLoading}
          className={cn(
            'flex-1 py-3 px-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2',
            !selectedTier || isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-nilin-coral to-nilin-rose hover:shadow-lg hover:scale-[1.02]'
          )}
        >
          {isLoading ? (
            <>
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : selectedTier ? (
            <>
              <CreditCard className="h-5 w-5" />
              Purchase {tierConfig[selectedTier].name} Badge
            </>
          ) : (
            'Select a Badge Tier'
          )}
        </button>
      </div>
    </div>
  );
};

export default VerifiedBadgePurchase;
