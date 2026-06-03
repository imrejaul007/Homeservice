import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

interface PriceBreakdownProps {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  currency?: string;
  couponCode?: string;
  className?: string;
}

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  className?: string;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, format, className }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setIsAnimating(true);

      // Animate the number change
      const startValue = prevValueRef.current;
      const endValue = value;
      const duration = 300;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + (endValue - startValue) * easeOut;

        setDisplayValue(currentValue);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          prevValueRef.current = value;
        }
      };

      requestAnimationFrame(animate);
    }
  }, [value]);

  return (
    <span
      className={cn(
        'tabular-nums transition-all duration-200',
        isAnimating && 'text-nilin-rose scale-105',
        className
      )}
    >
      {format(displayValue)}
    </span>
  );
};

const PriceBreakdown: React.FC<PriceBreakdownProps> = ({
  subtotal,
  discount,
  tax,
  total,
  currency = 'AED',
  couponCode,
  className,
}) => {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const hasDiscount = discount > 0;
  const hasCoupon = !!couponCode;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Subtotal */}
      <div className="flex justify-between items-center text-gray-700">
        <span className="text-sm">Subtotal</span>
        <AnimatedNumber
          value={subtotal}
          format={formatAmount}
          className="text-sm font-medium"
        />
      </div>

      {/* Discount */}
      {hasDiscount && (
        <div className="flex justify-between items-center text-green-600">
          <span className="text-sm flex items-center gap-2">
            Discount
            {hasCoupon && couponCode && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                {couponCode}
              </span>
            )}
          </span>
          <AnimatedNumber
            value={discount}
            format={(v) => `-${formatAmount(v)}`}
            className="text-sm font-medium"
          />
        </div>
      )}

      {/* Tax */}
      <div className="flex justify-between items-center text-gray-700">
        <span className="text-sm">Tax (VAT)</span>
        <AnimatedNumber
          value={tax}
          format={formatAmount}
          className="text-sm font-medium"
        />
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200" />

      {/* Total */}
      <div className="flex justify-between items-center">
        <span className="text-base font-semibold text-gray-900">Total</span>
        <AnimatedNumber
          value={total}
          format={formatAmount}
          className="text-xl font-bold text-nilin-rose"
        />
      </div>
    </div>
  );
};

export default PriceBreakdown;
