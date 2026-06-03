import React, { useState } from 'react';
import { Tag, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discountType?: 'fixed' | 'percentage';
  discountValue?: number;
  discountAmount?: number;
  message?: string;
}

interface CouponCodeInputProps {
  onApply: (code: string) => Promise<CouponValidationResult>;
  onRemove?: () => Promise<void>;
  appliedCoupon?: {
    code: string;
    discountAmount: number;
  } | null;
  disabled?: boolean;
  currency?: string;
}

const CouponCodeInput: React.FC<CouponCodeInputProps> = ({
  onApply,
  onRemove,
  appliedCoupon,
  disabled = false,
  currency = 'AED',
}) => {
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount);
  };

  const handleApply = async () => {
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedCode) {
      setError('Please enter a coupon code');
      return;
    }

    setIsValidating(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await onApply(trimmedCode);

      if (result.valid) {
        setSuccess(result.message || `Coupon applied: ${formatAmount(result.discountAmount || 0)} off`);
        setCode('');
        setIsExpanded(false);
      } else {
        setError(result.message || 'Invalid coupon code');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate coupon';
      setError(errorMessage);
    } finally {
      setIsValidating(false);
    }
  };

  const handleRemove = async () => {
    setCode('');
    setError(null);
    setSuccess(null);
    setIsExpanded(false);
    try {
      await onRemove?.();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove coupon';
      setError(errorMessage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isValidating) {
      handleApply();
    }
  };

  // Show applied coupon state
  if (appliedCoupon && !isExpanded) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-800">
                Coupon: {appliedCoupon.code}
              </p>
              <p className="text-sm text-green-600">
                -{formatAmount(appliedCoupon.discountAmount)} discount applied
              </p>
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="text-sm text-green-700 hover:text-green-900 underline"
            disabled={disabled || isValidating}
          >
            {isValidating ? 'Removing...' : 'Remove'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!isExpanded ? (
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className={cn(
            "flex items-center gap-2 text-nilin-rose hover:text-nilin-coral transition-colors",
            "text-sm font-medium",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          disabled={disabled}
        >
          <Tag className="w-4 h-4" />
          <span>Have a coupon code?</span>
        </button>
      ) : (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Apply Coupon</span>
            <button
              type="button"
              onClick={() => {
                setIsExpanded(false);
                setCode('');
                setError(null);
                setSuccess(null);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Enter coupon code"
                disabled={disabled || isValidating}
                className={cn(
                  "w-full px-4 py-2.5 rounded-xl border-2 transition-colors",
                  "bg-white text-gray-900 placeholder-gray-400",
                  "focus:outline-none focus:border-nilin-rose/50",
                  error ? "border-red-300 bg-red-50" : "border-gray-200",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
                maxLength={20}
              />
              {isValidating && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-5 h-5 text-nilin-rose animate-spin" />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleApply}
              disabled={disabled || isValidating || !code.trim()}
              className={cn(
                "px-5 py-2.5 rounded-xl font-medium transition-all",
                "bg-gradient-to-r from-nilin-rose to-nilin-coral",
                "text-white hover:shadow-nilin-warm active:scale-[0.98]",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isValidating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Apply'
              )}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-red-600">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 text-green-600">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{success}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CouponCodeInput;
