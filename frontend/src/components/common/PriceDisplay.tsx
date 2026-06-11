import React from 'react';
import { usePriceConversion, CURRENCY_SYMBOLS } from '../../utils/priceConverter';

interface PriceDisplayProps {
  price: number;
  originalCurrency?: string;
  size?: 'sm' | 'md' | 'lg';
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
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  const formattedPrice = convertedPrice.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return (
    <span className={`font-bold text-nilin-charcoal ${sizeClasses[size]} ${className}`}>
      {showCurrency && <span className="text-nilin-warmGray font-medium">{symbol}</span>}
      {formattedPrice}
    </span>
  );
};

/**
 * ServicePriceDisplay Component
 * Specialized price display for service cards
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

  // Calculate savings if original price is provided
  const savings = originalPrice
    ? Math.round(((convert(originalPrice, originalCurrency) - convertedPrice) / convert(originalPrice, originalCurrency)) * 100)
    : 0;

  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xl font-bold text-nilin-charcoal">{formattedPrice}</span>

      {originalPrice && showSavings && savings > 0 && (
        <>
          <span className="text-sm text-nilin-warmGray line-through">
            {format(convert(originalPrice, originalCurrency), currency)}
          </span>
          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            {savings}% OFF
          </span>
        </>
      )}
    </div>
  );
};

export default PriceDisplay;