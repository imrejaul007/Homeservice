import React, { useState } from 'react';
import {
  Shield,
  Check,
  X,
  AlertCircle,
  Star,
  Clock,
  Phone,
  RefreshCw,
  BadgeCheck,
  Sparkles
} from 'lucide-react';
import { cn } from '../../lib/utils';

type CoverageTier = 'basic' | 'standard' | 'premium' | 'comprehensive';

interface CoverageDetails {
  cancellationCoverage: number;
  delayCoverage: number;
  noShowCoverage: number;
  qualityIssueCoverage: number;
  priceGuarantee: boolean;
  prioritySupport: boolean;
  refundProcessingDays: number;
}

interface InsuranceProduct {
  productId: string;
  name: string;
  description: string;
  tier: CoverageTier;
  premiumAmount: number;
  coverageAmount: number;
  coverageDetails: CoverageDetails;
  features: string[];
}

interface InsuranceProductCardProps {
  product: InsuranceProduct;
  bookingValue: number;
  currency?: string;
  isSelected?: boolean;
  onSelect: (product: InsuranceProduct) => void;
}

const InsuranceProductCard: React.FC<InsuranceProductCardProps> = ({
  product,
  bookingValue,
  currency = 'AED',
  isSelected,
  onSelect,
}) => {
  const tierColors: Record<CoverageTier, { bg: string; text: string; border: string; badge: string; ring: string }> = {
    basic: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', badge: 'bg-gray-200 text-gray-700', ring: 'ring-gray-500' },
    standard: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', badge: 'bg-blue-200 text-blue-800', ring: 'ring-blue-500' },
    premium: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', badge: 'bg-purple-200 text-purple-800', ring: 'ring-purple-500' },
    comprehensive: { bg: 'bg-gradient-to-br from-amber-50 to-orange-50', text: 'text-amber-700', border: 'border-amber-200', badge: 'bg-gradient-to-r from-amber-400 to-orange-400 text-white', ring: 'ring-amber-500' },
  };

  const tierIcons: Record<CoverageTier, React.ReactNode> = {
    basic: <Shield className="h-5 w-5" />,
    standard: <Shield className="h-5 w-5" />,
    premium: <Sparkles className="h-5 w-5" />,
    comprehensive: <BadgeCheck className="h-5 w-5" />,
  };

  const colors = tierColors[product.tier];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const coveragePercentage = Math.round((product.coverageAmount / bookingValue) * 100);

  return (
    <div
      onClick={() => onSelect(product)}
      className={cn(
        'relative border-2 rounded-xl p-5 cursor-pointer transition-all',
        colors.border,
        isSelected
          ? `${colors.bg} ring-2 ring-offset-2 ring-offset-white ${colors.ring}`
          : 'hover:shadow-md hover:scale-[1.01]'
      )}
    >
      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute -top-3 -right-3 w-8 h-8 bg-nilin-coral rounded-full flex items-center justify-center shadow-lg">
          <Check className="h-5 w-5 text-white" />
        </div>
      )}

      {/* Popular Badge */}
      {product.tier === 'premium' && !isSelected && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold rounded-full shadow">
          Popular
        </div>
      )}

      {/* Recommended Badge */}
      {product.tier === 'comprehensive' && !isSelected && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full shadow">
          Best Value
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className={cn('inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mb-2', colors.badge)}>
            {tierIcons[product.tier]}
            <span className="capitalize">{product.tier}</span>
          </div>
          <h3 className={cn('text-lg font-bold', colors.text)}>{product.name}</h3>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-nilin-charcoal">{formatPrice(product.premiumAmount)}</p>
          <p className="text-xs text-nilin-gray">per booking</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-nilin-gray mb-4">{product.description}</p>

      {/* Coverage Summary */}
      <div className={cn('rounded-lg p-3 mb-4', isSelected ? 'bg-white/50' : 'bg-white')}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-nilin-charcoal">Coverage</span>
          <span className="text-sm font-bold text-nilin-coral">{coveragePercentage}% of booking value</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={cn('h-2 rounded-full', product.tier === 'comprehensive' ? 'bg-gradient-to-r from-amber-400 to-orange-500' : product.tier === 'premium' ? 'bg-gradient-to-r from-purple-400 to-pink-500' : product.tier === 'standard' ? 'bg-blue-500' : 'bg-gray-400')}
            style={{ width: `${coveragePercentage}%` }}
          />
        </div>
      </div>

      {/* Key Benefits */}
      <div className="space-y-2 mb-4">
        {product.coverageDetails.cancellationCoverage > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            <span>{product.coverageDetails.cancellationCoverage}% cancellation refund</span>
          </div>
        )}
        {product.coverageDetails.noShowCoverage > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            <span>{product.coverageDetails.noShowCoverage}% provider no-show coverage</span>
          </div>
        )}
        {product.coverageDetails.priceGuarantee && (
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            <span>Price guarantee protection</span>
          </div>
        )}
        {product.coverageDetails.prioritySupport && (
          <div className="flex items-center gap-2 text-sm">
            <Check className="h-4 w-4 text-green-500" />
            <span>Priority customer support</span>
          </div>
        )}
      </div>

      {/* Refund Processing Time */}
      <div className="flex items-center gap-2 text-xs text-nilin-gray pt-3 border-t border-gray-200">
        <Clock className="h-3 w-3" />
        <span>Refund processed within {product.coverageDetails.refundProcessingDays} days</span>
      </div>
    </div>
  );
};

interface InsuranceProductSelectorProps {
  bookingValue: number;
  currency?: string;
  onPurchase: (product: InsuranceProduct) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

const InsuranceProductSelector: React.FC<InsuranceProductSelectorProps> = ({
  bookingValue,
  currency = 'AED',
  onPurchase,
  onSkip,
  isLoading = false,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<InsuranceProduct | null>(null);

  const products: InsuranceProduct[] = [
    {
      productId: 'INS-BASIC',
      name: 'Basic Protection',
      description: 'Essential coverage for peace of mind on your bookings',
      tier: 'basic',
      premiumAmount: Math.round(bookingValue * 0.02 * 100) / 100,
      coverageAmount: bookingValue * 0.5,
      coverageDetails: {
        cancellationCoverage: 50,
        delayCoverage: 0,
        noShowCoverage: 0,
        qualityIssueCoverage: 0,
        priceGuarantee: false,
        prioritySupport: false,
        refundProcessingDays: 14,
      },
      features: ['Cancellation protection', 'Basic coverage'],
    },
    {
      productId: 'INS-STANDARD',
      name: 'Standard Protection',
      description: 'Enhanced coverage with provider no-show protection',
      tier: 'standard',
      premiumAmount: Math.round(bookingValue * 0.04 * 100) / 100 + 5,
      coverageAmount: bookingValue * 0.75,
      coverageDetails: {
        cancellationCoverage: 75,
        delayCoverage: 24,
        noShowCoverage: 50,
        qualityIssueCoverage: 25,
        priceGuarantee: true,
        prioritySupport: false,
        refundProcessingDays: 10,
      },
      features: ['Cancellation protection', 'No-show coverage', 'Delay coverage', 'Price guarantee'],
    },
    {
      productId: 'INS-PREMIUM',
      name: 'Premium Protection',
      description: 'Comprehensive coverage with priority support',
      tier: 'premium',
      premiumAmount: Math.round(bookingValue * 0.06 * 100) / 100 + 10,
      coverageAmount: bookingValue * 0.9,
      coverageDetails: {
        cancellationCoverage: 90,
        delayCoverage: 48,
        noShowCoverage: 75,
        qualityIssueCoverage: 50,
        priceGuarantee: true,
        prioritySupport: true,
        refundProcessingDays: 5,
      },
      features: ['Full cancellation coverage', 'No-show coverage', 'Delay coverage', 'Quality protection', 'Priority support'],
    },
    {
      productId: 'INS-COMPREHENSIVE',
      name: 'Complete Protection',
      description: 'Maximum coverage with fastest claim processing',
      tier: 'comprehensive',
      premiumAmount: Math.round(bookingValue * 0.1 * 100) / 100 + 20,
      coverageAmount: bookingValue,
      coverageDetails: {
        cancellationCoverage: 100,
        delayCoverage: 72,
        noShowCoverage: 100,
        qualityIssueCoverage: 75,
        priceGuarantee: true,
        prioritySupport: true,
        refundProcessingDays: 3,
      },
      features: ['Full refund guarantee', 'No-show protection', 'Extended delay coverage', 'Quality protection', 'VIP support', 'Fastest claims'],
    },
  ];

  const handlePurchase = () => {
    if (selectedProduct) {
      onPurchase(selectedProduct);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-nilin-charcoal">
          Protect Your Booking
        </h2>
        <p className="text-nilin-gray mt-2 max-w-md mx-auto">
          Add booking insurance to protect against cancellations, provider no-shows, and service issues.
        </p>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {products.map((product) => (
          <InsuranceProductCard
            key={product.productId}
            product={product}
            bookingValue={bookingValue}
            currency={currency}
            isSelected={selectedProduct?.productId === product.productId}
            onSelect={setSelectedProduct}
          />
        ))}
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6 overflow-x-auto">
        <h3 className="font-semibold text-nilin-charcoal mb-4">Compare Coverage</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 font-medium text-nilin-gray">Feature</th>
              <th className="text-center py-2 font-medium text-gray-400">Basic</th>
              <th className="text-center py-2 font-medium text-blue-600">Standard</th>
              <th className="text-center py-2 font-medium text-purple-600">Premium</th>
              <th className="text-center py-2 font-medium text-amber-600">Complete</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="py-2">Cancellation Coverage</td>
              <td className="text-center py-2">50%</td>
              <td className="text-center py-2">75%</td>
              <td className="text-center py-2">90%</td>
              <td className="text-center py-2 font-medium text-green-600">100%</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2">No-Show Coverage</td>
              <td className="text-center py-2 text-gray-400">-</td>
              <td className="text-center py-2">50%</td>
              <td className="text-center py-2">75%</td>
              <td className="text-center py-2 font-medium text-green-600">100%</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2">Delay Coverage</td>
              <td className="text-center py-2 text-gray-400">-</td>
              <td className="text-center py-2">24h</td>
              <td className="text-center py-2">48h</td>
              <td className="text-center py-2 font-medium text-green-600">72h</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2">Price Guarantee</td>
              <td className="text-center py-2 text-gray-400">-</td>
              <td className="text-center py-2"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
              <td className="text-center py-2"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
              <td className="text-center py-2"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
            </tr>
            <tr>
              <td className="py-2">Refund Processing</td>
              <td className="text-center py-2">14 days</td>
              <td className="text-center py-2">10 days</td>
              <td className="text-center py-2">5 days</td>
              <td className="text-center py-2 font-medium text-green-600">3 days</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-semibold text-nilin-gray hover:bg-gray-50 transition"
        >
          Skip Insurance
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
              <Shield className="h-5 w-5" />
              Add {selectedProduct.name} - {new Intl.NumberFormat('en-AE', { style: 'currency', currency }).format(selectedProduct.premiumAmount)}
            </>
          ) : (
            'Select a Protection Plan'
          )}
        </button>
      </div>
    </div>
  );
};

export default InsuranceProductSelector;
