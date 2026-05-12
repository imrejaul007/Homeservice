import React from 'react';
import { CreditCard, Smartphone, Check, Banknote } from 'lucide-react';
import { cn } from '../../../lib/utils';

type PaymentMethod = 'apple_pay' | 'credit_card' | 'cash';

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selected,
  onChange
}) => {
  const options: { value: PaymentMethod; label: string; icon: React.ReactNode; description?: string }[] = [
    {
      value: 'apple_pay',
      label: 'Apple Pay',
      icon: (
        <div className="flex items-center justify-center w-12 h-8 bg-black rounded text-white text-xs font-bold shadow-nilin">
          Pay
        </div>
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
    <div className="space-y-3">
      {options.map((option) => {
        const isSelected = selected === option.value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
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
