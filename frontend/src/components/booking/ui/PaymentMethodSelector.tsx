import React from 'react';
import { CreditCard, Smartphone, Check, Banknote } from 'lucide-react';

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
        <div className="flex items-center justify-center w-12 h-8 bg-black rounded text-white text-xs font-bold">
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
            className={`
              w-full flex items-center justify-between p-4 rounded-xl transition-all
              ${isSelected
                ? 'bg-nilin-primary/10 border-2 border-nilin-primary'
                : 'bg-white border-2 border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <div className="flex items-center gap-4">
              {option.icon}
              <div className="text-left">
                <span className={`font-medium ${isSelected ? 'text-nilin-primary' : 'text-gray-800'}`}>
                  {option.label}
                </span>
                {option.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                )}
              </div>
            </div>
            {isSelected && (
              <div className="w-6 h-6 bg-nilin-primary rounded-full flex items-center justify-center">
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
