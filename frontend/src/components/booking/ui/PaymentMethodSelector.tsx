import React from 'react';
import { CreditCard, Check, Banknote } from 'lucide-react';
import { cn } from '../../../lib/utils';

type PaymentMethod = 'apple_pay' | 'credit_card' | 'cash';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

// Apple Pay SVG logo component
const ApplePayLogo: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    viewBox="0 0 50 20"
    className={cn("w-12 h-8", className)}
    aria-label="Apple Pay"
    role="img"
  >
    <path
      fill="currentColor"
      d="M35.6 14.5c.4-1.2.8-2.4 1.3-3.5-1.1-.4-2.1-.8-3.1-1.1-.8 1.1-1.6 2.4-2.2 3.8-.6 1.4-.9 2.8-1 3.8.8.3 1.8.5 3.1.5.9-.1 1.8-.2 1.9-2.5zm-1.1-6c-.8-.3-1.7-.4-2.5-.5-.2.5-.5 1-.7 1.4.9.3 1.9.6 3.1.6 1.5.1 2.9-.4 3.5-1.2-.6-.4-1.2-.6-1.9-.6-.5-.1-1.2.1-1.5.3zM27.8 2.1c1.8-.2 3.4 1 4.2 1 0 0 .1-.1.1-.1.8-1.1 2.1-1.2 2.6-1.2-.2-.2-2.1-.9-2.1-3.6-.1-2.8 2.2-4.1 2.3-4.1-.9-.4-2.8-.4-3.6.4-.8.6-1.3 1.6-1.4 2.5-1.7.2-3.4 1-4 2.3-.6 1.3-.5 2.8.1 3.9.6.9 1.6 1.6 2.7 1.8 0-.1-.1-.1-.1-.1-.6-.4-.9-1.1-1-1.8zm-7.7 9.9c-3.8 2.7-9.1 3.7-13.1 2.8-1.4-.3-2.7-.8-3.7-1.4-.8-.5-1.5-1.1-2-1.7-.5-.6-.8-1.1-.9-1.6-.2-.5-.2-.9-.1-1.2.1-.3.3-.6.6-.7.3-.2.6-.3.9-.2.4.1.7.4.9.7.2.4.4.8.7 1.2.3.4.7.7 1.2 1 .4.3.9.5 1.4.6.5.1 1 .2 1.5.1.5-.1.9-.2 1.3-.4.4-.2.8-.5 1.1-.8.4-.3.8-.6 1.2-.8.5-.2 1-.3 1.6-.3.6.1 1.1.3 1.5.5.4.2.7.5 1 .8.2.3.4.7.4 1.1 0 .4-.1.7-.4 1-.2.3-.6.4-1.1.4-.5-.1-.9-.3-1.3-.7-.4-.4-.7-.8-.9-1.3-.2-.5-.4-1-.5-1.4-.1-.5-.1-.9-.1-1.3.1-.8.2-1.4.5-1.9.3-.5.8-.8 1.5-.8.4 0 .7.1.9.3.2.2.4.5.4.9 0 .4-.1.9-.4 1.4-.3.6-.7 1.2-1.1 1.8-.4.6-.9 1.3-1.4 2 .6.3 1.4.5 2.3.7.9.2 1.7.3 2.3.5.7.1 1.2.3 1.7.6.4.2.7.6.7 1.1.1.5-.1.9-.4 1.4-.3.5-.6 1-.9 1.5-.3.5-.6 1.1-.8 1.8-.2.7-.2 1.5 0 2.4.1.8.5 1.5 1 2 .5.5 1.1.8 1.9.9.8.1 1.5-.1 2.3-.5.8-.4 1.5-1 2.2-1.7.6-.7 1.2-1.6 1.7-2.6.4-1 .7-2.2.7-3.3-.1-.5-.1-.8-.1-1.2 0-.3.1-.6.2-.8.1-.2.3-.3.6-.3.3 0 .5.1.6.3.2.3.3.6.3 1.1 0 .5-.1 1.1-.4 1.7z"
    />
  </svg>
);

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selected,
  onChange
}) => {
  const options: { value: PaymentMethod; label: string; icon: React.ReactNode; description?: string }[] = [
    {
      value: 'apple_pay',
      label: 'Apple Pay',
      icon: (
        <ApplePayLogo className="text-black" />
      ),
      description: 'Fast and secure'
    },
    {
      value: 'credit_card',
      label: 'Credit / Debit Card',
      icon: <CreditCard className="w-6 h-6 text-gray-600" />,
      description: 'Visa, Mastercard, etc.'
    },
    {
      value: 'cash',
      label: 'Cash on Delivery',
      icon: <Banknote className="w-6 h-6 text-gray-600" />,
      description: 'Pay when service is completed'
    }
  ];

  return (
    <div className="space-y-3" role="radiogroup" aria-label="Payment method selection">
      {options.map((option) => {
        const isSelected = selected === option.value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            aria-checked={isSelected}
            aria-label={`Select ${option.label} payment method`}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-xl transition-all card-3d",
              isSelected
                ? 'bg-gradient-to-br from-nilin-rose/10 to-nilin-coral/10 border-2 border-nilin-rose shadow-nilin-warm'
                : 'glass border-2 border-nilin-border/30 hover:border-nilin-rose/50 hover:bg-nilin-blush/30'
            )
            }
          >
            <div className="flex items-center gap-4">
              {option.icon}
              <div className="text-left">
                <span className={cn(
                  "font-medium",
                  isSelected ? 'text-nilin-rose' : 'text-nilin-charcoal'
                )}>
                  {option.label}
                </span>
                {option.description && (
                  <p className="text-xs text-nilin-warmGray mt-0.5">{option.description}</p>
                )}
              </div>
            </div>
            {isSelected && (
              <div className="w-7 h-7 bg-gradient-to-br from-nilin-rose to-nilin-coral rounded-full flex items-center justify-center shadow-sm float-3d shimmer">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default PaymentMethodSelector;
