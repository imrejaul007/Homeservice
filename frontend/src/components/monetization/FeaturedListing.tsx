import React, { useState } from 'react';
import {
  Zap,
  Star,
  TrendingUp,
  BarChart3,
  Clock,
  Check,
  AlertCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';

type BoostDuration = 'daily' | 'weekly' | 'monthly' | 'quarterly';
type BoostPosition = 'category_top' | 'featured' | 'premium' | 'hero';

interface FeaturedBoostProduct {
  productId: string;
  name: string;
  description: string;
  duration: BoostDuration;
  position: BoostPosition;
  price: number;
  pricePerDay: number;
  features: string[];
  positionGuarantee: number;
  categoryBoost: boolean;
  searchBoostMultiplier: number;
}

interface FeaturedListingProps {
  onPurchase: (productId: string, duration: BoostDuration) => Promise<void>;
  onCancel: () => void;
  serviceName?: string;
  categoryName?: string;
  isLoading?: boolean;
}

const positionConfig: Record<BoostPosition, { name: string; icon: React.ElementType; color: string }> = {
  category_top: { name: 'Category Top', icon: TrendingUp, color: 'text-blue-600' },
  featured: { name: 'Featured', icon: Star, color: 'text-purple-600' },
  premium: { name: 'Premium', icon: Zap, color: 'text-amber-600' },
  hero: { name: 'Hero', icon: Sparkles, color: 'text-pink-600' },
};

const durationConfig: Record<BoostDuration, { name: string; days: number; discount: number }> = {
  daily: { name: 'Daily', days: 1, discount: 0 },
  weekly: { name: 'Weekly', days: 7, discount: 0 },
  monthly: { name: 'Monthly', days: 30, discount: 15 },
  quarterly: { name: 'Quarterly', days: 90, discount: 30 },
};

const FeaturedListing: React.FC<FeaturedListingProps> = ({
  onPurchase,
  onCancel,
  serviceName = 'your service',
  categoryName = 'category',
  isLoading = false,
}) => {
  const [selectedPosition, setSelectedPosition] = useState<BoostPosition | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<BoostDuration | null>(null);
  const [error, setError] = useState<string | null>(null);

  const products: FeaturedBoostProduct[] = [
    {
      productId: 'BOOST-DAILY-TOP',
      name: 'Daily Top Placement',
      description: '24-hour featured placement at the top of category search results',
      duration: 'daily',
      position: 'category_top',
      price: 9.99,
      pricePerDay: 9.99,
      features: [
        'Top 3 placement in category',
        'Featured badge',
        'Basic analytics',
      ],
      positionGuarantee: 3,
      categoryBoost: true,
      searchBoostMultiplier: 2.0,
    },
    {
      productId: 'BOOST-WEEKLY-TOP',
      name: 'Weekly Top Placement',
      description: '7-day featured placement with enhanced visibility',
      duration: 'weekly',
      position: 'category_top',
      price: 49.99,
      pricePerDay: 7.14,
      features: [
        'Top 3 placement in category',
        'Featured badge',
        'Advanced analytics',
        'Priority support',
      ],
      positionGuarantee: 3,
      categoryBoost: true,
      searchBoostMultiplier: 2.5,
    },
    {
      productId: 'BOOST-MONTHLY-FEATURED',
      name: 'Monthly Featured Placement',
      description: '30-day featured placement across all categories',
      duration: 'monthly',
      position: 'featured',
      price: 149.99,
      pricePerDay: 5.00,
      features: [
        'Featured in category pages',
        'Featured badge',
        'Full analytics dashboard',
        'Priority support',
        'Homepage rotation',
      ],
      positionGuarantee: 5,
      categoryBoost: true,
      searchBoostMultiplier: 3.0,
    },
    {
      productId: 'BOOST-QUARTERLY-PREMIUM',
      name: 'Quarterly Premium Package',
      description: '90-day premium placement with maximum visibility',
      duration: 'quarterly',
      position: 'premium',
      price: 399.99,
      pricePerDay: 4.44,
      features: [
        'Premium placement',
        'Premium badge',
        'Real-time analytics',
        'Dedicated support',
        'Homepage featured',
        'Category hero placement',
      ],
      positionGuarantee: 2,
      categoryBoost: true,
      searchBoostMultiplier: 4.0,
    },
    {
      productId: 'BOOST-HERO',
      name: 'Hero Placement',
      description: 'Maximum visibility with hero section placement',
      duration: 'monthly',
      position: 'hero',
      price: 299.99,
      pricePerDay: 10.00,
      features: [
        'Hero section placement',
        'Premium badge',
        'Real-time analytics',
        'Dedicated account manager',
        'Social media promotion',
        'Push notification feature',
      ],
      positionGuarantee: 1,
      categoryBoost: false,
      searchBoostMultiplier: 5.0,
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

  const getSelectedProduct = (): FeaturedBoostProduct | null => {
    if (!selectedPosition || !selectedDuration) return null;
    return products.find(
      p => p.position === selectedPosition && p.duration === selectedDuration
    ) || null;
  };

  const handlePurchase = async () => {
    const product = getSelectedProduct();
    if (!product) return;

    setError(null);
    try {
      await onPurchase(product.productId, selectedDuration!);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    }
  };

  const selectedProduct = getSelectedProduct();
  const durationDiscount = selectedDuration
    ? durationConfig[selectedDuration].discount
    : 0;

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Zap className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-nilin-charcoal">
          Boost Your Listing
        </h2>
        <p className="text-nilin-gray mt-2 max-w-md mx-auto">
          Get more visibility and bookings with featured placement. Higher positions mean more customers see your service.
        </p>
      </div>

      {/* Service Info */}
      {serviceName && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-3 mb-6 flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" />
          <span className="text-sm text-nilin-charcoal">
            Boosting: <strong>{serviceName}</strong>
            {categoryName && <span className="text-nilin-gray"> in {categoryName}</span>}
          </span>
        </div>
      )}

      {/* Position Selection */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">
          Select Placement Position
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(positionConfig).map(([position, config]) => {
            const positionProducts = products.filter(p => p.position === position);
            const minPrice = Math.min(...positionProducts.map(p => p.price));
            const isSelected = selectedPosition === position;
            const Icon = config.icon;

            return (
              <button
                key={position}
                onClick={() => setSelectedPosition(position as BoostPosition)}
                className={cn(
                  'relative border-2 rounded-xl p-4 text-left transition-all',
                  isSelected
                    ? 'border-nilin-coral bg-nilin-coral/5 ring-2 ring-nilin-coral/20'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                )}
              >
                {isSelected && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-nilin-coral rounded-full flex items-center justify-center">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
                <Icon className={cn('h-6 w-6 mb-2', config.color)} />
                <h4 className="font-semibold text-nilin-charcoal">{config.name}</h4>
                <p className="text-xs text-nilin-gray">from {formatPrice(minPrice)}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration Selection */}
      {selectedPosition && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-nilin-charcoal mb-4">
            Select Duration
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(durationConfig).map(([duration, config]) => {
              const product = products.find(
                p => p.position === selectedPosition && p.duration === duration
              );
              if (!product) return null;

              const isSelected = selectedDuration === duration;
              const discountedPrice = product.price * (1 - config.discount / 100);

              return (
                <button
                  key={duration}
                  onClick={() => setSelectedDuration(duration as BoostDuration)}
                  className={cn(
                    'relative border-2 rounded-xl p-4 text-left transition-all',
                    isSelected
                      ? 'border-nilin-coral bg-nilin-coral/5 ring-2 ring-nilin-coral/20'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  )}
                >
                  {isSelected && (
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-nilin-coral rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}
                  {config.discount > 0 && (
                    <div className="absolute -top-2 left-2 px-2 py-0.5 bg-green-500 text-white text-xs font-semibold rounded-full">
                      {config.discount}% OFF
                    </div>
                  )}
                  <h4 className="font-semibold text-nilin-charcoal">{config.name}</h4>
                  <p className="text-xs text-nilin-gray">{config.days} day{config.days > 1 ? 's' : ''}</p>
                  <div className="mt-2">
                    {config.discount > 0 && (
                      <p className="text-xs text-nilin-gray line-through">{formatPrice(product.price)}</p>
                    )}
                    <p className="font-bold text-nilin-coral">{formatPrice(discountedPrice)}</p>
                  </div>
                  <p className="text-xs text-nilin-gray">{formatPrice(product.pricePerDay)}/day</p>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Product Details */}
      {selectedProduct && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-start gap-4 mb-4">
            <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', {
              'bg-blue-100': selectedProduct.position === 'category_top',
              'bg-purple-100': selectedProduct.position === 'featured',
              'bg-amber-100': selectedProduct.position === 'premium',
              'bg-pink-100': selectedProduct.position === 'hero',
            })}>
              {React.createElement(positionConfig[selectedProduct.position].icon, {
                className: cn('h-6 w-6', positionConfig[selectedProduct.position].color),
              })}
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-nilin-charcoal">{selectedProduct.name}</h3>
              <p className="text-sm text-nilin-gray">{selectedProduct.description}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-nilin-gray">Position</p>
              <p className="font-bold text-nilin-charcoal">#{selectedProduct.positionGuarantee}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-nilin-gray">Visibility Boost</p>
              <p className="font-bold text-green-600">{selectedProduct.searchBoostMultiplier}x</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-nilin-gray">Duration</p>
              <p className="font-bold text-nilin-charcoal">{durationConfig[selectedProduct.duration].days} days</p>
            </div>
          </div>

          {/* Features */}
          <h4 className="font-semibold text-nilin-charcoal mb-2">What's Included:</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {selectedProduct.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                <span className="text-nilin-charcoal">{feature}</span>
              </div>
            ))}
          </div>

          {/* Price Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-nilin-gray">Total Price</p>
                <p className="text-2xl font-bold text-nilin-charcoal">
                  {formatPrice(
                    selectedProduct.price *
                    (1 - durationConfig[selectedProduct.duration].discount / 100)
                  )}
                </p>
              </div>
              {durationConfig[selectedProduct.duration].discount > 0 && (
                <div className="text-right">
                  <p className="text-sm text-green-600 font-medium">
                    You save {durationConfig[selectedProduct.duration].discount}%
                  </p>
                  <p className="text-sm text-nilin-gray line-through">
                    {formatPrice(selectedProduct.price)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Analytics Preview */}
      {selectedProduct && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <span className="font-semibold text-nilin-charcoal">Expected Results</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">+{Math.round(selectedProduct.searchBoostMultiplier * 100)}%</p>
              <p className="text-xs text-nilin-gray">More Views</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">+{Math.round(selectedProduct.searchBoostMultiplier * 50)}%</p>
              <p className="text-xs text-nilin-gray">More Clicks</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">+{Math.round(selectedProduct.searchBoostMultiplier * 30)}%</p>
              <p className="text-xs text-nilin-gray">More Bookings</p>
            </div>
          </div>
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
          disabled={!selectedProduct || isLoading}
          className={cn(
            'flex-1 py-3 px-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2',
            !selectedProduct || isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-nilin-coral to-nilin-rose hover:shadow-lg hover:scale-[1.02]'
          )}
        >
          {isLoading ? (
            <>
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : selectedProduct ? (
            <>
              <Zap className="h-5 w-5" />
              Boost for {formatPrice(
                selectedProduct.price *
                (1 - durationConfig[selectedProduct.duration].discount / 100)
              )}
            </>
          ) : (
            'Select Position & Duration'
          )}
        </button>
      </div>
    </div>
  );
};

export default FeaturedListing;
