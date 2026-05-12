import React from 'react';
import { cn } from '../../../lib/utils';

interface DurationOption {
  duration: number;
  price: number;
  label: string;
}

interface DurationSelectorProps {
  options: DurationOption[];
  selected: number;
  onSelect: (duration: number) => void;
  currency?: string;
}

const DurationSelector: React.FC<DurationSelectorProps> = ({
  options,
  selected,
  onSelect,
  currency = 'AED'
}) => {
  const formatPrice = (price: number) => {
    if (currency === 'AED') {
      return `AED ${price.toLocaleString('en-AE')}`;
    }
    return `${currency} ${price.toLocaleString('en-US')}`;
  };

  // If no options provided, don't Render
  if (!options || options.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {options.map((option) => {
        const isSelected = selected === option.duration;

        return (
          <button
            key={option.duration}
            onClick={() => onSelect(option.duration)}
            className={cn(
              "flex-shrink-0 flex flex-col items-center py-3 px-5 rounded-xl transition-all card-3d",
              isSelected
                ? 'bg-gradient-to-br from-nilin-rose to-nilin-coral text-white shadow-nilin-warm shimmer'
                : 'glass text-nilin-charcoal border border-nilin-border/30 hover:border-nilin-rose hover:bg-nilin-blush/30'
            )
            }
          >
            <span className={cn(
              "text-lg font-semibold",
              isSelected ? 'text-white' : 'text-nilin-charcoal'
            )}>
              {option.label || `${option.duration} min`}
            </span>
            <span className={cn(
              "text-sm mt-1",
              isSelected ? 'text-white/90' : 'text-nilin-warmGray'
            )}>
              {formatPrice(option.price)}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default DurationSelector;
