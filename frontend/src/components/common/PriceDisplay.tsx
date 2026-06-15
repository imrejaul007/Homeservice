import React from 'react';
import { usePriceConversion, CURRENCY_SYMBOLS } from '../../utils/priceConverter';

interface PriceDisplayProps {
  price: number;
  originalCurrency?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showCurrency?: boolean;
  className?: string;
}

/**
 * PriceDisplay Component
 * Automatically converts and formats prices based on user's selected location
 */
export const PriceDisplay: React.FC<PriceDisplayProps> = ({
  price,
  originalCurrency = 'AED',
  size = 'md',
  showCurrency = true,
  className = '',
}) => {
  const { convert, currency } = usePriceConversion();
  const convertedPrice = convert(price, originalCurrency);
  const symbol = CURRENCY_SYMBOLS[currency] || currency;

  const sizeClasses = {
    xs: 'text-xs',
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  const formattedPrice = convertedPrice.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return (
    <span
      className={`inline-flex items-baseline gap-0.5 font-semibold text-nilin-charcoal tracking-tight ${sizeClasses[size]} ${className}`}
      aria-label={`${symbol}${formattedPrice}`}
    >
      {showCurrency && (
        <span className="text-nilin-warm-gray font-medium" aria-hidden="true">
          {symbol}
        </span>
      )}
      <span>{formattedPrice}</span>
    </span>
  );
};

/**
 * ServicePriceDisplay Component
 * Specialized price display for service cards with savings indicator
 */
interface ServicePriceDisplayProps {
  price: number | { amount: number; currency?: string };
  originalPrice?: number;
  originalCurrency?: string;
  showSavings?: boolean;
}

export const ServicePriceDisplay: React.FC<ServicePriceDisplayProps> = ({
  price,
  originalPrice,
  originalCurrency = 'AED',
  showSavings = true,
}) => {
  const numericPrice = typeof price === 'number' ? price : price.amount;
  const { convert, format, currency } = usePriceConversion();

  const convertedPrice = convert(numericPrice, originalCurrency);
  const formattedPrice = format(convertedPrice, currency);

  // Calculate savings percentage if original price is provided
  const savings = originalPrice
    ? Math.round(
        ((convert(originalPrice, originalCurrency) - convertedPrice) /
          convert(originalPrice, originalCurrency)) *
          100
      )
    : 0;

  const hasSavings = originalPrice && showSavings && savings > 0;
  const formattedOriginal = originalPrice
    ? format(convert(originalPrice, originalCurrency), currency)
    : '';

  return (
    <div
      className="inline-flex items-baseline gap-2"
      role="group"
      aria-label={
        hasSavings
          ? `Current price ${formattedPrice}, was ${formattedOriginal}, save ${savings}%`
          : `Price: ${formattedPrice}`
      }
    >
      {/* Current price */}
      <span className="text-xl font-bold tracking-tight text-nilin-charcoal">
        {formattedPrice}
      </span>

      {/* Original price (struck through) */}
      {hasSavings && (
        <>
          <span
            className="text-sm text-nilin-light-gray line-through font-normal"
            aria-hidden="true"
          >
            {formattedOriginal}
          </span>

          {/* Savings badge - NILIN styled */}
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-nilin bg-nilin-blush text-nilin-success border border-nilin-success/20"
            aria-label={`Save ${savings}%`}
          >
            <svg
              className="w-3 h-3"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 1L10.163 5.279L15 6.05L11.5 9.442L12.326 14.3L8 12.025L3.674 14.3L4.5 9.442L1 6.05L5.837 5.279L8 1Z"
                fill="currentColor"
              />
            </svg>
            <span>{savings}% OFF</span>
          </span>
        </>
      )}
    </div>
  );
};

export default PriceDisplay;
