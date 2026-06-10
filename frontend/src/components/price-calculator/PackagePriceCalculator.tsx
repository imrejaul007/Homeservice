/**
 * Package Price Calculator Component
 * Interactive component for calculating package prices with add-ons and options
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator,
  Plus,
  Minus,
  Tag,
  Clock,
  MapPin,
  Check,
  X,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  Gift,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { priceCalculatorApi, type PriceBreakdown, type PackageAddOn, type DurationSelection } from '../../services/priceCalculatorApi';

interface PackagePriceCalculatorProps {
  packageId: string;
  basePrice: number;
  currency?: string;
  addOns?: Array<{
    id: string;
    name: string;
    price: number;
    description?: string;
  }>;
  durationOptions?: DurationSelection[];
  defaultDuration?: number;
  onPriceChange?: (breakdown: PriceBreakdown) => void;
  compact?: boolean;
  className?: string;
}

export const PackagePriceCalculator: React.FC<PackagePriceCalculatorProps> = ({
  packageId,
  basePrice,
  currency = 'AED',
  addOns = [],
  durationOptions = [],
  defaultDuration,
  onPriceChange,
  compact = false,
  className,
}) => {
  // State
  const [selectedAddOns, setSelectedAddOns] = useState<Record<string, number>>({});
  const [selectedDuration, setSelectedDuration] = useState<DurationSelection | null>(
    durationOptions.length > 0 && defaultDuration
      ? durationOptions.find((d) => d.duration === defaultDuration) || durationOptions[0]
      : null
  );
  const [discountCode, setDiscountCode] = useState('');
  const [isApplyingDiscount, setIsApplyingDiscount] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<{
    code: string;
    type: string;
    value: number;
    description?: string;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(!compact);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch add-ons and durations from API if not provided
  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true);
      try {
        const [addOnsResult, durationsResult] = await Promise.all([
          addOns.length === 0 ? priceCalculatorApi.getAddOns(packageId) : Promise.resolve(null),
          durationOptions.length === 0 ? priceCalculatorApi.getDurations(packageId) : Promise.resolve(null),
        ]);

        // Handle durations if available
        if (durationsResult?.success && durationsResult.durationOptions) {
          // Duration options are fetched but stored in component state
          // This is handled by the props
        }
      } catch (error) {
        console.error('Error fetching package options:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOptions();
  }, [packageId, addOns.length, durationOptions.length]);

  // Calculate price whenever selections change
  useEffect(() => {
    const calculatePrice = async () => {
      setIsCalculating(true);
      try {
        const selectedAddOnsList = Object.entries(selectedAddOns)
          .filter(([_, quantity]) => quantity > 0)
          .map(([id]) => {
            const addon = addOns.find((a) => a.id === id);
            return addon ? { name: addon.name, price: addon.price } : null;
          })
          .filter(Boolean) as Array<{ name: string; price: number }>;

        const result = await priceCalculatorApi.calculatePrice({
          packageId,
          selectedAddOns: selectedAddOnsList.map((a) => ({
            name: a.name,
            price: a.price,
          })),
          selectedDuration: selectedDuration || undefined,
          discountCode: appliedDiscount?.code,
        });

        if (result.success && result.data) {
          setPriceBreakdown(result.data.priceBreakdown);
          onPriceChange?.(result.data.priceBreakdown);
        }
      } catch (error) {
        console.error('Error calculating price:', error);
      } finally {
        setIsCalculating(false);
      }
    };

    // Debounce price calculation
    const timeout = setTimeout(calculatePrice, 300);
    return () => clearTimeout(timeout);
  }, [packageId, selectedAddOns, selectedDuration, appliedDiscount]);

  // Handle add-on toggle
  const toggleAddOn = (addOnId: string) => {
    setSelectedAddOns((prev) => ({
      ...prev,
      [addOnId]: prev[addOnId] ? 0 : 1,
    }));
  };

  // Handle add-on quantity change
  const updateAddOnQuantity = (addOnId: string, quantity: number) => {
    if (quantity < 0) return;
    setSelectedAddOns((prev) => ({
      ...prev,
      [addOnId]: quantity,
    }));
  };

  // Handle discount code application
  const applyDiscountCode = async () => {
    if (!discountCode.trim()) return;

    setIsApplyingDiscount(true);
    setDiscountError(null);

    try {
      const currentSubtotal = priceBreakdown?.subtotal || basePrice;
      const result = await priceCalculatorApi.validateDiscount(
        discountCode,
        packageId,
        currentSubtotal
      );

      if (result.valid && result.discount) {
        setAppliedDiscount({
          code: discountCode.toUpperCase(),
          ...result.discount,
        });
        setDiscountCode('');
      } else {
        setDiscountError(result.error || 'Invalid discount code');
      }
    } catch (error) {
      setDiscountError('Failed to apply discount code');
    } finally {
      setIsApplyingDiscount(false);
    }
  };

  // Remove applied discount
  const removeDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCode('');
  };

  // Format price
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  // Calculate totals
  const selectedAddOnsTotal = Object.entries(selectedAddOns)
    .filter(([_, qty]) => qty > 0)
    .reduce((sum, [id, qty]) => {
      const addon = addOns.find((a) => a.id === id);
      return sum + (addon?.price || 0) * qty;
    }, 0);

  const totalAddOnsCount = Object.values(selectedAddOns).reduce((sum, qty) => sum + qty, 0);

  if (compact) {
    return (
      <div className={cn('bg-white rounded-xl p-4', className)}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-nilin-charcoal">Add-ons ({totalAddOnsCount})</span>
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="text-nilin-coral text-sm hover:underline flex items-center gap-1"
          >
            {showBreakdown ? 'Hide' : 'Customize'}
            {showBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showBreakdown && (
          <div className="space-y-4">
            {/* Add-ons */}
            {addOns.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-nilin-warmGray mb-2">Available Add-ons</h4>
                <div className="space-y-2">
                  {addOns.map((addon) => (
                    <div
                      key={addon.id}
                      className={cn(
                        'flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all',
                        selectedAddOns[addon.id]
                          ? 'border-nilin-coral bg-nilin-coral/5'
                          : 'border-gray-200 hover:border-nilin-coral/50'
                      )}
                      onClick={() => toggleAddOn(addon.id)}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                            selectedAddOns[addon.id]
                              ? 'bg-nilin-coral border-nilin-coral'
                              : 'border-gray-300'
                          )}
                        >
                          {selectedAddOns[addon.id] && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <span className="text-sm text-nilin-charcoal">{addon.name}</span>
                      </div>
                      <span className="text-sm font-medium text-nilin-coral">
                        +{formatPrice(addon.price)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Duration Options */}
            {durationOptions.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-nilin-warmGray mb-2">Duration Options</h4>
                <div className="grid grid-cols-2 gap-2">
                  {durationOptions.map((option) => (
                    <button
                      key={option.duration}
                      onClick={() => setSelectedDuration(option)}
                      className={cn(
                        'p-2 rounded-lg border text-sm transition-all',
                        selectedDuration?.duration === option.duration
                          ? 'border-nilin-coral bg-nilin-coral/5 text-nilin-coral'
                          : 'border-gray-200 hover:border-nilin-coral/50 text-nilin-charcoal'
                      )}
                    >
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs opacity-70">{formatPrice(option.price)}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Total */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-nilin-warmGray">Selected Total:</span>
            <span className="text-lg font-bold text-nilin-charcoal">
              {isCalculating ? (
                <Loader2 className="w-4 h-4 animate-spin inline" />
              ) : (
                formatPrice(priceBreakdown?.totalAmount || basePrice + selectedAddOnsTotal)
              )}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Full version
  return (
    <div className={cn('bg-white rounded-xl shadow-sm', className)}>
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-nilin-coral/10 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="font-semibold text-nilin-charcoal">Price Calculator</h3>
            <p className="text-sm text-nilin-warmGray">Customize your package</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Base Price */}
        <div className="flex items-center justify-between">
          <span className="text-nilin-charcoal">Base Package Price</span>
          <span className="font-medium text-nilin-charcoal">{formatPrice(basePrice)}</span>
        </div>

        {/* Duration Options */}
        {durationOptions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-nilin-charcoal">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Duration Options</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {durationOptions.map((option) => (
                <button
                  key={option.duration}
                  onClick={() => setSelectedDuration(option)}
                  className={cn(
                    'p-3 rounded-xl border-2 text-left transition-all',
                    selectedDuration?.duration === option.duration
                      ? 'border-nilin-coral bg-nilin-coral/5'
                      : 'border-gray-200 hover:border-nilin-coral/50'
                  )}
                >
                  <div className="font-medium text-nilin-charcoal">{option.label}</div>
                  <div className="text-sm text-nilin-warmGray mt-1">
                    {Math.floor(option.duration / 60)}h {option.duration % 60 > 0 ? `${option.duration % 60}m` : ''}
                  </div>
                  <div className="text-sm font-medium text-nilin-coral mt-1">
                    {formatPrice(option.price)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add-ons */}
        {addOns.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-nilin-charcoal">
              <Plus className="w-4 h-4" />
              <span className="font-medium">Add-ons</span>
            </div>
            <div className="space-y-2">
              {addOns.map((addon) => {
                const isSelected = (selectedAddOns[addon.id] || 0) > 0;
                const quantity = selectedAddOns[addon.id] || 0;

                return (
                  <div
                    key={addon.id}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all',
                      isSelected ? 'border-nilin-coral bg-nilin-coral/5' : 'border-gray-200'
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleAddOn(addon.id)}
                            className={cn(
                              'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors flex-shrink-0',
                              isSelected
                                ? 'bg-nilin-coral border-nilin-coral'
                                : 'border-gray-300 hover:border-nilin-coral'
                            )}
                          >
                            {isSelected && <Check className="w-4 h-4 text-white" />}
                          </button>
                          <div>
                            <h4 className="font-medium text-nilin-charcoal">{addon.name}</h4>
                            {addon.description && (
                              <p className="text-sm text-nilin-warmGray mt-1">{addon.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-nilin-coral">{formatPrice(addon.price)}</div>
                        {isSelected && (
                          <div className="flex items-center gap-1 mt-2">
                            <button
                              onClick={() => updateAddOnQuantity(addon.id, quantity - 1)}
                              className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-medium">{quantity}</span>
                            <button
                              onClick={() => updateAddOnQuantity(addon.id, quantity + 1)}
                              className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Discount Code */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-nilin-charcoal">
            <Tag className="w-4 h-4" />
            <span className="font-medium">Discount Code</span>
          </div>

          {appliedDiscount ? (
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-200">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-green-600" />
                <span className="text-green-700 font-medium">{appliedDiscount.code}</span>
                <span className="text-green-600 text-sm">({appliedDiscount.description})</span>
              </div>
              <button
                onClick={removeDiscount}
                className="text-green-600 hover:text-green-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={discountCode}
                  onChange={(e) => {
                    setDiscountCode(e.target.value.toUpperCase());
                    setDiscountError(null);
                  }}
                  placeholder="Enter code"
                  className="w-full px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-nilin-coral focus:outline-none uppercase"
                />
                {discountError && (
                  <div className="absolute -bottom-6 left-0 flex items-center gap-1 text-red-500 text-xs">
                    <AlertCircle className="w-3 h-3" />
                    {discountError}
                  </div>
                )}
              </div>
              <button
                onClick={applyDiscountCode}
                disabled={!discountCode.trim() || isApplyingDiscount}
                className={cn(
                  'px-4 py-2 rounded-xl font-medium transition-colors',
                  discountCode.trim()
                    ? 'bg-nilin-coral text-white hover:bg-nilin-rose'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                )}
              >
                {isApplyingDiscount ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  'Apply'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Price Breakdown */}
      {priceBreakdown && (
        <div className="px-6 pb-6 space-y-3">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-between text-nilin-charcoal"
          >
            <span className="font-medium">Price Breakdown</span>
            {showBreakdown ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showBreakdown && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-nilin-warmGray">Base Price</span>
                <span className="text-nilin-charcoal">{formatPrice(priceBreakdown.basePrice)}</span>
              </div>

              {priceBreakdown.addOnsTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-nilin-warmGray">Add-ons ({priceBreakdown.addOns.length})</span>
                  <span className="text-nilin-charcoal">+{formatPrice(priceBreakdown.addOnsTotal)}</span>
                </div>
              )}

              {priceBreakdown.durationUpgrade !== 0 && (
                <div className="flex justify-between">
                  <span className="text-nilin-warmGray">Duration Upgrade</span>
                  <span className="text-nilin-charcoal">
                    {priceBreakdown.durationUpgrade > 0 ? '+' : ''}{formatPrice(priceBreakdown.durationUpgrade)}
                  </span>
                </div>
              )}

              {priceBreakdown.travelFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-nilin-warmGray">Travel Fee</span>
                  <span className="text-nilin-charcoal">+{formatPrice(priceBreakdown.travelFee)}</span>
                </div>
              )}

              {priceBreakdown.subtotal !== priceBreakdown.basePrice && (
                <>
                  <div className="border-t border-gray-200 my-2" />
                  <div className="flex justify-between">
                    <span className="text-nilin-warmGray">Subtotal</span>
                    <span className="text-nilin-charcoal">{formatPrice(priceBreakdown.subtotal)}</span>
                  </div>
                </>
              )}

              {priceBreakdown.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatPrice(priceBreakdown.discount)}</span>
                </div>
              )}

              {priceBreakdown.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-nilin-warmGray">Tax (5%)</span>
                  <span className="text-nilin-charcoal">{formatPrice(priceBreakdown.tax)}</span>
                </div>
              )}

              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span className="text-nilin-charcoal">Total</span>
                  <span className="text-nilin-coral">{formatPrice(priceBreakdown.totalAmount)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Footer - Total */}
      <div className="px-6 pb-6">
        <div className="bg-gradient-to-r from-nilin-coral to-nilin-rose rounded-xl p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm opacity-80">Total Price</div>
              <div className="text-2xl font-bold">
                {isCalculating ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  formatPrice(priceBreakdown?.totalAmount || basePrice)
                )}
              </div>
            </div>
            {priceBreakdown && priceBreakdown.subtotal > priceBreakdown.totalAmount && (
              <div className="text-right">
                <div className="text-sm opacity-80">You Save</div>
                <div className="text-lg font-bold text-green-300">
                  {formatPrice(priceBreakdown.subtotal - priceBreakdown.totalAmount + priceBreakdown.discount)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PackagePriceCalculator;
