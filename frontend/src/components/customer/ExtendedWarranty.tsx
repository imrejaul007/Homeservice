import React, { useState } from 'react';
import {
  Shield,
  Check,
  Clock,
  AlertCircle,
  Calendar,
  Star,
  ChevronRight,
  X,
  FileText,
  Wrench,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../lib/utils';

type WarrantyTier = 'basic_30' | 'standard_90' | 'premium_365';

interface CoverageDetails {
  laborCoverage: number;
  partsCoverage: number;
  emergencyService: boolean;
  prioritySupport: boolean;
  multipleClaims: boolean;
  maxClaims: number;
  deductibleAmount: number;
  coveredIssues: string[];
  excludedIssues: string[];
}

interface WarrantyTierConfig {
  tier: WarrantyTier;
  name: string;
  description: string;
  durationDays: number;
  premiumPercent: number;
  premiumFixed: number;
  coverageAmount: number;
  coverageDetails: CoverageDetails;
}

interface ExtendedWarrantyProps {
  serviceValue: number;
  serviceName: string;
  onPurchase: (tier: WarrantyTier, premium: number) => void;
  onSkip: () => void;
  currency?: string;
  isLoading?: boolean;
}

const tierConfigs: Record<WarrantyTier, WarrantyTierConfig> = {
  basic_30: {
    tier: 'basic_30',
    name: 'Basic 30-Day Warranty',
    description: 'Essential protection for your service',
    durationDays: 30,
    premiumPercent: 3,
    premiumFixed: 0,
    coverageAmount: 0.5,
    coverageDetails: {
      laborCoverage: 50,
      partsCoverage: 30,
      emergencyService: false,
      prioritySupport: false,
      multipleClaims: false,
      maxClaims: 1,
      deductibleAmount: 25,
      coveredIssues: ['Service not completed as specified', 'Minor issues within 48 hours', 'Touch-up work'],
      excludedIssues: ['Normal wear and tear', 'Customer-caused damage', 'Pre-existing conditions'],
    },
  },
  standard_90: {
    tier: 'standard_90',
    name: 'Standard 90-Day Warranty',
    description: 'Comprehensive coverage with emergency support',
    durationDays: 90,
    premiumPercent: 5,
    premiumFixed: 15,
    coverageAmount: 0.75,
    coverageDetails: {
      laborCoverage: 75,
      partsCoverage: 50,
      emergencyService: true,
      prioritySupport: true,
      multipleClaims: true,
      maxClaims: 2,
      deductibleAmount: 50,
      coveredIssues: [
        'Service not completed as specified',
        'Quality issues reported within 30 days',
        'Equipment malfunction due to improper installation',
        'Emergency callback service',
      ],
      excludedIssues: ['Normal wear and tear', 'Customer-caused damage', 'Pre-existing conditions', 'Commercial use'],
    },
  },
  premium_365: {
    tier: 'premium_365',
    name: 'Premium 1-Year Warranty',
    description: 'Full year protection with VIP service',
    durationDays: 365,
    premiumPercent: 8,
    premiumFixed: 50,
    coverageAmount: 1.0,
    coverageDetails: {
      laborCoverage: 100,
      partsCoverage: 80,
      emergencyService: true,
      prioritySupport: true,
      multipleClaims: true,
      maxClaims: 3,
      deductibleAmount: 25,
      coveredIssues: [
        'All workmanship issues',
        'All equipment failures due to installation',
        'All covered parts replacement',
        'Priority emergency service 24/7',
        'Annual maintenance check',
        'Transferable to new homeowner',
      ],
      excludedIssues: ['Customer misuse or abuse', 'Natural damage', 'Unauthorized repairs'],
    },
  },
};

const ExtendedWarranty: React.FC<ExtendedWarrantyProps> = ({
  serviceValue,
  serviceName,
  onPurchase,
  onSkip,
  currency = 'AED',
  isLoading = false,
}) => {
  const [selectedTier, setSelectedTier] = useState<WarrantyTier>('standard_90');
  const [showComparison, setShowComparison] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const calculatePremium = (tier: WarrantyTier) => {
    const config = tierConfigs[tier];
    const premium = Math.round((serviceValue * (config.premiumPercent / 100) + config.premiumFixed) * 100) / 100;
    return premium;
  };

  const selectedConfig = tierConfigs[selectedTier];
  const premium = calculatePremium(selectedTier);
  const coverageAmount = Math.round(serviceValue * selectedConfig.coverageAmount * 100) / 100;

  const tierColors: Record<WarrantyTier, { border: string; bg: string; badge: string; icon: string }> = {
    basic_30: { border: 'border-gray-200', bg: 'bg-gray-50', badge: 'bg-gray-200 text-gray-700', icon: 'text-gray-600' },
    standard_90: { border: 'border-blue-200', bg: 'bg-blue-50', badge: 'bg-blue-200 text-blue-700', icon: 'text-blue-600' },
    premium_365: { border: 'border-amber-200', bg: 'bg-amber-50', badge: 'bg-gradient-to-r from-amber-400 to-orange-400 text-white', icon: 'text-amber-600' },
  };

  const colors = tierColors[selectedTier];

  const handlePurchase = () => {
    onPurchase(selectedTier, premium);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-nilin-charcoal">Extended Warranty</h2>
        <p className="text-nilin-gray mt-2">
          Protect your {serviceName} service with comprehensive warranty coverage
        </p>
      </div>

      {/* Tier Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Object.values(tierConfigs).map((config) => {
          const tierPremium = calculatePremium(config.tier);
          const tierColors = {
            basic_30: { border: 'border-gray-200', bg: 'bg-white', badge: 'bg-gray-100 text-gray-600' },
            standard_90: { border: 'border-blue-200', bg: 'bg-white', badge: 'bg-blue-100 text-blue-600' },
            premium_365: { border: 'border-amber-200', bg: 'bg-white', badge: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700' },
          }[config.tier];
          const isSelected = selectedTier === config.tier;

          return (
            <div
              key={config.tier}
              onClick={() => setSelectedTier(config.tier)}
              className={cn(
                'relative border-2 rounded-xl p-5 cursor-pointer transition-all',
                isSelected
                  ? `${tierColors.border} ${tierColors.bg} shadow-md scale-[1.02]`
                  : 'border-gray-200 bg-white hover:border-gray-300'
              )}
            >
              {config.tier === 'premium_365' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-semibold rounded-full">
                  Best Value
                </div>
              )}

              {isSelected && (
                <div className="absolute -top-3 -right-3 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}

              <div className="text-center">
                <span className={cn('inline-block px-2 py-1 rounded-full text-xs font-medium mb-2', tierColors.badge)}>
                  {config.durationDays} Days
                </span>
                <h3 className="font-semibold text-nilin-charcoal">{config.name}</h3>
                <p className="text-sm text-nilin-gray mt-1">{config.description}</p>

                <div className="mt-4">
                  <p className="text-3xl font-bold text-nilin-coral">{formatPrice(tierPremium)}</p>
                  <p className="text-xs text-nilin-gray">
                    Covers up to {Math.round(config.coverageAmount * 100)}% of service value
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Plan Details */}
      <div className={cn('border-2 rounded-xl p-6 mb-6', colors.border, colors.bg)}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">{selectedConfig.name}</h3>
            <p className="text-sm text-nilin-gray">{selectedConfig.description}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-nilin-coral">{formatPrice(premium)}</p>
            <p className="text-sm text-nilin-gray">Coverage: {formatPrice(coverageAmount)}</p>
          </div>
        </div>

        {/* Key Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-md', selectedConfig.coverageDetails.emergencyService ? 'bg-green-100' : 'bg-gray-100')}>
              <Wrench className={cn('h-4 w-4', selectedConfig.coverageDetails.emergencyService ? 'text-green-600' : 'text-gray-400')} />
            </div>
            <span className="text-sm">
              {selectedConfig.coverageDetails.laborCoverage}% Labor
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-md', selectedConfig.coverageDetails.partsCoverage > 50 ? 'bg-green-100' : 'bg-gray-100')}>
              <RefreshCw className={cn('h-4 w-4', selectedConfig.coverageDetails.partsCoverage > 50 ? 'text-green-600' : 'text-gray-400')} />
            </div>
            <span className="text-sm">
              {selectedConfig.coverageDetails.partsCoverage}% Parts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-md', selectedConfig.coverageDetails.multipleClaims ? 'bg-green-100' : 'bg-gray-100')}>
              <FileText className={cn('h-4 w-4', selectedConfig.coverageDetails.multipleClaims ? 'text-green-600' : 'text-gray-400')} />
            </div>
            <span className="text-sm">
              {selectedConfig.coverageDetails.maxClaims} Claim{selectedConfig.coverageDetails.maxClaims > 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-md', selectedConfig.coverageDetails.emergencyService ? 'bg-green-100' : 'bg-gray-100')}>
              <Clock className={cn('h-4 w-4', selectedConfig.coverageDetails.emergencyService ? 'text-green-600' : 'text-gray-400')} />
            </div>
            <span className="text-sm">
              {selectedConfig.coverageDetails.deductibleAmount} AED Deductible
            </span>
          </div>
        </div>

        {/* Additional Features */}
        <div className="grid grid-cols-2 gap-2">
          {selectedConfig.coverageDetails.emergencyService && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Check className="h-4 w-4" />
              Emergency Service Available
            </div>
          )}
          {selectedConfig.coverageDetails.prioritySupport && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Check className="h-4 w-4" />
              Priority Support
            </div>
          )}
          {selectedConfig.coverageDetails.multipleClaims && (
            <div className="flex items-center gap-2 text-sm text-green-700">
              <Check className="h-4 w-4" />
              Multiple Claims Allowed
            </div>
          )}
        </div>
      </div>

      {/* Comparison Toggle */}
      <button
        onClick={() => setShowComparison(!showComparison)}
        className="w-full py-2 text-sm text-nilin-coral hover:underline mb-4"
      >
        {showComparison ? 'Hide' : 'Show'} full comparison
      </button>

      {/* Comparison Table */}
      {showComparison && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 overflow-x-auto">
          <h3 className="font-semibold text-nilin-charcoal mb-4">Coverage Comparison</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-medium text-nilin-gray">Feature</th>
                <th className="text-center py-2 font-medium text-gray-400">Basic 30</th>
                <th className="text-center py-2 font-medium text-blue-600">Standard 90</th>
                <th className="text-center py-2 font-medium text-amber-600">Premium 365</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-2">Duration</td>
                <td className="text-center">30 days</td>
                <td className="text-center">90 days</td>
                <td className="text-center font-medium text-green-600">1 year</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2">Labor Coverage</td>
                <td className="text-center">50%</td>
                <td className="text-center">75%</td>
                <td className="text-center font-medium text-green-600">100%</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2">Parts Coverage</td>
                <td className="text-center">30%</td>
                <td className="text-center">50%</td>
                <td className="text-center font-medium text-green-600">80%</td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2">Emergency Service</td>
                <td className="text-center text-gray-400">-</td>
                <td className="text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                <td className="text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2">Priority Support</td>
                <td className="text-center text-gray-400">-</td>
                <td className="text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
                <td className="text-center"><Check className="h-4 w-4 text-green-500 mx-auto" /></td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-2">Max Claims</td>
                <td className="text-center">1</td>
                <td className="text-center">2</td>
                <td className="text-center font-medium text-green-600">3</td>
              </tr>
              <tr>
                <td className="py-2 font-medium">Deductible</td>
                <td className="text-center">25 AED</td>
                <td className="text-center">50 AED</td>
                <td className="text-center font-medium text-green-600">25 AED</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Exclusions */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">What's NOT Covered</p>
            <ul className="text-sm text-amber-700 mt-1 space-y-1">
              {selectedConfig.coverageDetails.excludedIssues.map((issue, i) => (
                <li key={i}>- {issue}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-semibold text-nilin-gray hover:bg-gray-50 transition"
        >
          Skip Warranty
        </button>
        <button
          onClick={handlePurchase}
          disabled={isLoading}
          className={cn(
            'flex-1 py-3 px-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2',
            'bg-gradient-to-r from-green-500 to-teal-500 hover:shadow-lg hover:scale-[1.02]',
            isLoading && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <>
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Shield className="h-5 w-5" />
              Add Warranty - {formatPrice(premium)}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default ExtendedWarranty;
