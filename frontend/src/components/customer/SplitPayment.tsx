import React, { useState, useCallback, useMemo } from 'react';
import {
  Wallet,
  CreditCard,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight,
  Info,
  Sparkles,
} from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useAuthStore } from '../../stores/authStore';

// =============================================================================
// NILIN Customer Dashboard - Split Payment Component
// Wallet + card split payment functionality
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface SplitPaymentProps {
  /** Total amount to pay */
  totalAmount: number;
  /** Currency code */
  currency?: string;
  /** Minimum wallet balance required */
  minWalletAmount?: number;
  /** Callback when payment is confirmed */
  onConfirm: (payment: SplitPaymentDetails) => Promise<void>;
  /** Callback when payment is cancelled */
  onCancel?: () => void;
  /** Show loading state */
  isProcessing?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export interface SplitPaymentDetails {
  walletAmount: number;
  cardAmount: number;
  paymentMethod: 'card' | 'wallet' | 'split';
  cardLast4?: string;
  cardBrand?: string;
}

export interface WalletBalance {
  available: number;
  pending: number;
  currency: string;
}

// =============================================================================
// Amount Slider Component
// =============================================================================

interface AmountSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  currency?: string;
  className?: string;
}

const AmountSlider: React.FC<AmountSliderProps> = ({
  value,
  min,
  max,
  step = 10,
  onChange,
  currency = 'AED',
  className,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  const presets = [0, 25, 50, 75, 100];

  const handlePresetClick = (preset: number) => {
    const newValue = min + (max - min) * (preset / 100);
    // Round to nearest step
    const roundedValue = Math.round(newValue / step) * step;
    onChange(Math.max(min, Math.min(max, roundedValue)));
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Slider Track */}
      <div className="relative">
        {/* Background Track */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-nilin-coral to-rose-400 rounded-full transition-all duration-200"
            style={{ width: `${percentage}%` }}
          />
        </div>

        {/* Thumb */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />

        {/* Thumb Indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white border-2 border-nilin-coral shadow-md pointer-events-none transition-all"
          style={{ left: `calc(${percentage}% - 12px)` }}
        />
      </div>

      {/* Preset Buttons */}
      <div className="flex justify-between">
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => handlePresetClick(preset)}
            className={cn(
              'text-xs font-medium px-2 py-1 rounded-full transition-colors',
              Math.abs(percentage - preset) < 5
                ? 'bg-nilin-coral text-white'
                : 'bg-nilin-blush/50 text-nilin-charcoal hover:bg-nilin-blush'
            )}
          >
            {preset}%
          </button>
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// Payment Method Card
// =============================================================================

interface PaymentMethodCardProps {
  type: 'wallet' | 'card';
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  type,
  selected,
  onClick,
  disabled = false,
  children,
}) => {
  const Icon = type === 'wallet' ? Wallet : CreditCard;
  const label = type === 'wallet' ? 'Wallet' : 'Card';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full p-4 rounded-xl border-2 transition-all text-left',
        selected
          ? 'border-nilin-coral bg-nilin-coral/5'
          : 'border-gray-200 bg-white hover:border-nilin-coral/30',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <div className="flex items-center gap-3">
        {/* Radio Indicator */}
        <div
          className={cn(
            'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
            selected
              ? 'border-nilin-coral bg-nilin-coral'
              : 'border-gray-300'
          )}
        >
          {selected && <Check className="h-4 w-4 text-white" />}
        </div>

        {/* Icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center',
            type === 'wallet'
              ? 'bg-green-100 text-green-600'
              : 'bg-blue-100 text-blue-600'
          )}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Content */}
        <div className="flex-1">{children}</div>

        {/* Chevron */}
        <ChevronRight className="h-5 w-5 text-gray-400" />
      </div>
    </button>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const SplitPayment: React.FC<SplitPaymentProps> = ({
  totalAmount,
  currency = 'AED',
  minWalletAmount = 0,
  onConfirm,
  onCancel,
  isProcessing = false,
  className,
}) => {
  const [splitMode, setSplitMode] = useState<'wallet_only' | 'card_only' | 'split'>('card_only');
  const [walletAmount, setWalletAmount] = useState(0);
  const [cardAmount, setCardAmount] = useState(totalAmount);
  const [error, setError] = useState<string | null>(null);

  const customerProfile = useAuthStore((state) => state.customerProfile);

  // Mock wallet balance - in production, fetch from API
  const walletBalance: WalletBalance = useMemo(() => ({
    available: customerProfile?.loyaltyPoints?.current || 0,
    pending: 0,
    currency,
  }), [customerProfile, currency]);

  // Calculate split amounts
  const calculateSplit = useCallback((newWalletAmount: number) => {
    setWalletAmount(newWalletAmount);
    setCardAmount(totalAmount - newWalletAmount);
    setError(null);
  }, [totalAmount]);

  // Handle split mode change
  const handleSplitModeChange = useCallback((mode: 'wallet_only' | 'card_only' | 'split') => {
    setSplitMode(mode);
    setError(null);

    switch (mode) {
      case 'wallet_only':
        const maxWallet = Math.min(walletBalance.available, totalAmount);
        setWalletAmount(maxWallet);
        setCardAmount(totalAmount - maxWallet);
        break;
      case 'card_only':
        setWalletAmount(0);
        setCardAmount(totalAmount);
        break;
      case 'split':
        // Default to 50/50 split
        const halfAmount = Math.floor(totalAmount / 2);
        const walletContribution = Math.min(halfAmount, walletBalance.available);
        setWalletAmount(walletContribution);
        setCardAmount(totalAmount - walletContribution);
        break;
    }
  }, [walletBalance.available, totalAmount]);

  // Validate payment
  const validation = useMemo(() => {
    const errors: string[] = [];

    if (walletAmount > walletBalance.available) {
      errors.push(`Wallet balance insufficient. Available: ${formatPrice(walletBalance.available, currency)}`);
    }

    if (walletAmount > totalAmount) {
      errors.push('Wallet amount cannot exceed total amount');
    }

    if (walletAmount < 0) {
      errors.push('Wallet amount cannot be negative');
    }

    if (cardAmount < 0) {
      errors.push('Card amount cannot be negative');
    }

    if (splitMode === 'wallet_only' && walletAmount < minWalletAmount) {
      errors.push(`Minimum ${formatPrice(minWalletAmount, currency)} required from wallet`);
    }

    if (splitMode === 'split' && walletAmount === 0) {
      errors.push('Please enter a wallet amount greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [walletAmount, cardAmount, walletBalance.available, totalAmount, splitMode, minWalletAmount, currency]);

  // Handle confirm
  const handleConfirm = async () => {
    if (!validation.isValid) {
      setError(validation.errors[0]);
      return;
    }

    try {
      setError(null);

      const paymentDetails: SplitPaymentDetails = {
        walletAmount,
        cardAmount,
        paymentMethod: splitMode === 'split' ? 'split' : splitMode === 'wallet_only' ? 'wallet' : 'card',
      };

      await onConfirm(paymentDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-bold text-nilin-charcoal">Payment Method</h2>
        <p className="text-sm text-nilin-warmGray mt-1">
          Total: <span className="font-bold text-nilin-coral">{formatPrice(totalAmount, currency)}</span>
        </p>
      </div>

      {/* Payment Mode Tabs */}
      <div className="flex rounded-xl bg-gray-100 p-1">
        {[
          { value: 'card_only', label: 'Card Only' },
          { value: 'split', label: 'Split' },
          { value: 'wallet_only', label: 'Wallet Only' },
        ].map((option) => (
          <button
            key={option.value}
            onClick={() => handleSplitModeChange(option.value as typeof splitMode)}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-colors',
              splitMode === option.value
                ? 'bg-white text-nilin-charcoal shadow-sm'
                : 'text-nilin-warmGray hover:text-nilin-charcoal'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Payment Methods */}
      <div className="space-y-3">
        {/* Card Method */}
        <PaymentMethodCard
          type="card"
          selected={splitMode === 'card_only' || splitMode === 'split'}
          onClick={() => handleSplitModeChange(splitMode === 'card_only' ? 'split' : 'card_only')}
          disabled={splitMode === 'wallet_only'}
        >
          <div>
            <p className="font-medium text-nilin-charcoal">Credit/Debit Card</p>
            <p className="text-xs text-nilin-warmGray">
              Pay with Visa, Mastercard, or Amex
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-nilin-coral">
              {formatPrice(cardAmount, currency)}
            </p>
          </div>
        </PaymentMethodCard>

        {/* Wallet Method */}
        <PaymentMethodCard
          type="wallet"
          selected={splitMode === 'wallet_only' || splitMode === 'split'}
          onClick={() => handleSplitModeChange(splitMode === 'wallet_only' ? 'split' : 'wallet_only')}
          disabled={splitMode === 'card_only'}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-nilin-charcoal">NILIN Wallet</p>
              {walletBalance.available >= totalAmount && (
                <Badge variant="success" size="sm">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Sufficient
                </Badge>
              )}
            </div>
            <p className="text-xs text-nilin-warmGray">
              Balance: {formatPrice(walletBalance.available, currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="font-bold text-nilin-coral">
              {formatPrice(walletAmount, currency)}
            </p>
          </div>
        </PaymentMethodCard>
      </div>

      {/* Split Slider (only in split mode) */}
      {splitMode === 'split' && (
        <div className="p-4 bg-nilin-blush/20 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-nilin-charcoal">
              Wallet: {formatPrice(walletAmount, currency)}
            </span>
            <span className="text-sm font-medium text-nilin-charcoal">
              Card: {formatPrice(cardAmount, currency)}
            </span>
          </div>

          <AmountSlider
            value={walletAmount}
            min={0}
            max={Math.min(walletBalance.available, totalAmount)}
            step={10}
            onChange={calculateSplit}
            currency={currency}
          />

          <div className="flex items-start gap-2 text-xs text-nilin-warmGray">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>
              Slide to adjust the split between your wallet and card.
              Your wallet has {formatPrice(walletBalance.available, currency)} available.
            </p>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
        <h4 className="text-sm font-semibold text-nilin-charcoal">Payment Summary</h4>

        {splitMode !== 'card_only' && (
          <div className="flex justify-between text-sm">
            <span className="text-nilin-warmGray">Wallet Payment</span>
            <span className="text-nilin-charcoal font-medium">
              {formatPrice(walletAmount, currency)}
            </span>
          </div>
        )}

        {splitMode !== 'wallet_only' && (
          <div className="flex justify-between text-sm">
            <span className="text-nilin-warmGray">Card Payment</span>
            <span className="text-nilin-charcoal font-medium">
              {formatPrice(cardAmount, currency)}
            </span>
          </div>
        )}

        <div className="flex justify-between font-semibold text-base pt-2 border-t border-gray-200">
          <span className="text-nilin-charcoal">Total</span>
          <span className="text-nilin-coral">{formatPrice(totalAmount, currency)}</span>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl text-red-700 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Validation Errors */}
      {!validation.isValid && validation.errors.length > 0 && !error && (
        <div className="space-y-2">
          {validation.errors.map((err, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl text-amber-700 text-sm"
            >
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <Button
            variant="ghost"
            fullWidth
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          fullWidth
          onClick={handleConfirm}
          loading={isProcessing}
          disabled={isProcessing || !validation.isValid}
          leftIcon={!isProcessing && <Check className="h-4 w-4" />}
        >
          {isProcessing ? 'Processing...' : `Pay ${formatPrice(totalAmount, currency)}`}
        </Button>
      </div>

      {/* Security Note */}
      <p className="text-xs text-center text-nilin-warmGray">
        Your payment is secured with 256-bit SSL encryption
      </p>
    </div>
  );
};

// =============================================================================
// Compact Split Payment Selector
// =============================================================================

interface SplitPaymentSelectorProps {
  totalAmount: number;
  walletBalance: number;
  currency?: string;
  onSplitChange: (walletAmount: number, cardAmount: number) => void;
  className?: string;
}

export const SplitPaymentSelector: React.FC<SplitPaymentSelectorProps> = ({
  totalAmount,
  walletBalance,
  currency = 'AED',
  onSplitChange,
  className,
}) => {
  const [sliderValue, setSliderValue] = useState(0);

  const handleSliderChange = (value: number) => {
    setSliderValue(value);
    onSplitChange(value, totalAmount - value);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-green-600" />
          <span className="text-sm font-medium text-nilin-charcoal">
            Use Wallet Balance
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-nilin-warmGray">
            {formatPrice(walletBalance, currency)} available
          </span>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={sliderValue > 0}
              onChange={(e) => {
                const newValue = e.target.checked
                  ? Math.min(walletBalance, totalAmount)
                  : 0;
                handleSliderChange(newValue);
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-nilin-coral/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-nilin-coral"></div>
          </label>
        </div>
      </div>

      {/* Slider */}
      {sliderValue > 0 && (
        <div className="p-4 bg-nilin-blush/20 rounded-xl space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-nilin-charcoal">
              Wallet: <strong>{formatPrice(sliderValue, currency)}</strong>
            </span>
            <span className="text-nilin-charcoal">
              Card: <strong>{formatPrice(totalAmount - sliderValue, currency)}</strong>
            </span>
          </div>

          <AmountSlider
            value={sliderValue}
            min={0}
            max={Math.min(walletBalance, totalAmount)}
            step={10}
            onChange={handleSliderChange}
            currency={currency}
          />
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default SplitPayment;
