import React, { useState, useEffect } from 'react';
import {
  Zap,
  Clock,
  Calendar,
  Check,
  AlertCircle,
  ChevronRight,
  Timer,
  Star
} from 'lucide-react';
import { cn } from '../../lib/utils';

type RushTier = 'same_day' | 'next_day' | 'within_48h' | 'standard';

interface AvailableSlot {
  time: string;
  isAvailable: boolean;
  isRushPriority: boolean;
  surcharge?: number;
}

interface RushPricing {
  eligible: boolean;
  rushTier?: RushTier;
  tierLabel?: string;
  surchargePercent: number;
  baseAmount: number;
  rushFee: number;
  totalAmount: number;
  currency: string;
  hoursUntilService: number;
  availableSlots?: AvailableSlot[];
  reason?: string;
}

interface RushBookingOptionProps {
  baseAmount: number;
  currency?: string;
  scheduledDate: Date;
  onSelect: (pricing: RushPricing, selectedSlot?: string) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

const tierConfig: Record<RushTier, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactNode;
  surchargePercent: number;
  description: string;
}> = {
  same_day: {
    label: 'Same Day',
    color: 'text-red-600',
    bgColor: 'bg-red-50 border-red-200',
    icon: <Zap className="h-5 w-5" />,
    surchargePercent: 25,
    description: 'Get service today',
  },
  next_day: {
    label: 'Next Day',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
    icon: <Calendar className="h-5 w-5" />,
    surchargePercent: 15,
    description: 'Priority tomorrow',
  },
  within_48h: {
    label: 'Within 48 Hours',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 border-amber-200',
    icon: <Clock className="h-5 w-5" />,
    surchargePercent: 10,
    description: 'Fast scheduling',
  },
  standard: {
    label: 'Standard',
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 border-gray-200',
    icon: <Clock className="h-5 w-5" />,
    surchargePercent: 0,
    description: 'No rush fee',
  },
};

const RushBookingOption: React.FC<RushBookingOptionProps> = ({
  baseAmount,
  currency = 'AED',
  scheduledDate,
  onSelect,
  onSkip,
  isLoading = false,
}) => {
  const [selectedTier, setSelectedTier] = useState<RushTier | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [showSlots, setShowSlots] = useState(false);
  const [pricing, setPricing] = useState<RushPricing | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const getTimeRemaining = () => {
    const now = new Date();
    const diff = scheduledDate.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours <= 0 && minutes <= 0) {
      return 'Service time has passed';
    }

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} away`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }

    return `${minutes} minutes remaining`;
  };

  const getRushTier = (): RushTier => {
    const now = new Date();
    const diff = scheduledDate.getTime() - now.getTime();
    const hours = diff / (1000 * 60 * 60);

    if (hours <= 24) return 'same_day';
    if (hours <= 48) return 'next_day';
    if (hours <= 72) return 'within_48h';
    return 'standard';
  };

  const currentTier = getRushTier();
  const config = tierConfig[currentTier];

  useEffect(() => {
    // Calculate rush pricing based on tier
    const rushFee = Math.round(baseAmount * (config.surchargePercent / 100) * 100) / 100;
    const totalAmount = baseAmount + rushFee;
    const hoursUntil = Math.max(0, (scheduledDate.getTime() - new Date().getTime()) / (1000 * 60 * 60));

    const mockSlots: AvailableSlot[] = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00']
      .map(time => ({
        time,
        isAvailable: Math.random() > 0.3,
        isRushPriority: currentTier !== 'standard' && Math.random() > 0.3,
        surcharge: currentTier !== 'standard' ? config.surchargePercent : undefined,
      }));

    setPricing({
      eligible: currentTier !== 'standard',
      rushTier: currentTier,
      tierLabel: config.label,
      surchargePercent: config.surchargePercent,
      baseAmount,
      rushFee,
      totalAmount,
      currency,
      hoursUntilService: hoursUntil,
      availableSlots: mockSlots,
    });
  }, [baseAmount, currency, scheduledDate, currentTier, config.surchargePercent]);

  const handleSelect = () => {
    if (pricing) {
      if (pricing.availableSlots && showSlots && selectedSlot) {
        onSelect(pricing, selectedSlot);
      } else if (pricing.rushTier !== 'standard') {
        setShowSlots(true);
        setSelectedTier(currentTier);
      } else {
        onSelect(pricing);
      }
    }
  };

  if (!pricing) return null;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <div className={cn(
          'w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center',
          currentTier !== 'standard' ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-gray-400 to-gray-500'
        )}>
          {currentTier !== 'standard' ? (
            <Zap className="h-8 w-8 text-white" />
          ) : (
            <Clock className="h-8 w-8 text-white" />
          )}
        </div>
        <h2 className="text-2xl font-bold text-nilin-charcoal">
          {currentTier !== 'standard' ? 'Rush Booking Available!' : 'Standard Booking'}
        </h2>
        <p className="text-nilin-gray mt-1">
          {currentTier !== 'standard'
            ? `Book sooner for a ${config.surchargePercent}% rush fee`
            : 'Your booking is scheduled with standard timing'}
        </p>
      </div>

      {/* Time Remaining Badge */}
      {currentTier !== 'standard' && (
        <div className="flex items-center justify-center gap-2 mb-6">
          <Timer className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-medium text-amber-600">{getTimeRemaining()}</span>
        </div>
      )}

      {/* Pricing Card */}
      <div className={cn(
        'border-2 rounded-2xl p-6 mb-6 transition-all',
        currentTier !== 'standard' ? config.bgColor : 'bg-white border-gray-200'
      )}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', currentTier !== 'standard' ? 'bg-white/50' : 'bg-gray-100')}>
              {config.icon}
            </div>
            <div>
              <h3 className={cn('font-semibold', config.color)}>{config.label}</h3>
              <p className="text-sm text-nilin-gray">{config.description}</p>
            </div>
          </div>
          <div className="text-right">
            {pricing.rushFee > 0 ? (
              <>
                <p className="text-sm text-nilin-gray line-through">{formatPrice(baseAmount)}</p>
                <p className="text-2xl font-bold text-nilin-charcoal">{formatPrice(pricing.totalAmount)}</p>
                <p className="text-xs text-amber-600 font-medium">+{formatPrice(pricing.rushFee)} rush fee</p>
              </>
            ) : (
              <p className="text-2xl font-bold text-nilin-charcoal">{formatPrice(baseAmount)}</p>
            )}
          </div>
        </div>

        {/* Time Slots */}
        {showSlots && pricing.availableSlots && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="font-medium text-nilin-charcoal mb-3">Select a Time Slot</h4>
            <div className="grid grid-cols-4 gap-2">
              {pricing.availableSlots.map((slot) => (
                <button
                  key={slot.time}
                  onClick={() => slot.isAvailable && setSelectedSlot(slot.time)}
                  disabled={!slot.isAvailable}
                  className={cn(
                    'py-2 px-3 rounded-lg text-sm font-medium transition-all',
                    selectedSlot === slot.time
                      ? 'bg-nilin-coral text-white'
                      : slot.isAvailable
                        ? 'bg-white border border-gray-300 hover:border-nilin-coral text-nilin-charcoal'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                  )}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tier Comparison */}
      {currentTier === 'standard' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-nilin-charcoal mb-4">Rush Options Available</h3>
          <div className="space-y-3">
            {(['within_48h', 'next_day', 'same_day'] as RushTier[]).map((tier) => {
              const tierInfo = tierConfig[tier];
              const fee = Math.round(baseAmount * (tierInfo.surchargePercent / 100) * 100) / 100;
              return (
                <div key={tier} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-1.5 rounded-md', tierInfo.bgColor)}>
                      {tierInfo.icon}
                    </div>
                    <div>
                      <p className={cn('font-medium', tierInfo.color)}>{tierInfo.label}</p>
                      <p className="text-xs text-nilin-gray">{tierInfo.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-nilin-charcoal">+{formatPrice(fee)}</p>
                    <p className="text-xs text-nilin-gray">{tierInfo.surchargePercent}% surcharge</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Benefits */}
      {currentTier !== 'standard' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-nilin-charcoal mb-4">Rush Booking Benefits</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-green-100 rounded-md">
                <Check className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-nilin-charcoal">Priority Scheduling</p>
                <p className="text-xs text-nilin-gray">Skip the queue</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-green-100 rounded-md">
                <Star className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-nilin-charcoal">Top Providers</p>
                <p className="text-xs text-nilin-gray">Best availability</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-green-100 rounded-md">
                <Clock className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-nilin-charcoal">Flexible Hours</p>
                <p className="text-xs text-nilin-gray">Choose your slot</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-green-100 rounded-md">
                <AlertCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-nilin-charcoal">Free Cancellation</p>
                <p className="text-xs text-nilin-gray">Change of plans?</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onSkip}
          className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-semibold text-nilin-gray hover:bg-gray-50 transition"
        >
          Skip Rush Option
        </button>
        <button
          onClick={handleSelect}
          disabled={isLoading || (showSlots && !selectedSlot)}
          className={cn(
            'flex-1 py-3 px-4 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2',
            currentTier !== 'standard' && !showSlots
              ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:shadow-lg hover:scale-[1.02]'
              : 'bg-gradient-to-r from-nilin-coral to-nilin-rose hover:shadow-lg hover:scale-[1.02]',
            (isLoading || (showSlots && !selectedSlot)) && 'opacity-50 cursor-not-allowed'
          )}
        >
          {isLoading ? (
            <>
              <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing...
            </>
          ) : showSlots ? (
            <>
              Confirm {selectedTier && tierConfig[selectedTier].label}
              <ChevronRight className="h-5 w-5" />
            </>
          ) : pricing.rushTier !== 'standard' ? (
            <>
              <Zap className="h-5 w-5" />
              Add Rush Booking - {formatPrice(pricing.rushFee)}
            </>
          ) : (
            'Continue with Standard'
          )}
        </button>
      </div>

      {/* Note */}
      {pricing.rushTier !== 'standard' && (
        <p className="text-xs text-center text-nilin-gray mt-4">
          Rush fees are non-refundable if cancelled within 12 hours of service time.
        </p>
      )}
    </div>
  );
};

export default RushBookingOption;
