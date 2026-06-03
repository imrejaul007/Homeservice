import React, { useState } from 'react';
import { Clock, Check, ArrowRight } from 'lucide-react';

interface Variant {
  name: string;
  duration: string;
  price: number;
  description: string;
  popular?: boolean;
}

interface ServiceVariantsProps {
  variants: Variant[];
  currency?: string;
  onSelect?: (variant: Variant, index: number) => void;
  onBook?: (variant: Variant) => void;
}

const ServiceVariants: React.FC<ServiceVariantsProps> = ({
  variants,
  currency = 'AED',
  onSelect,
  onBook,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const handleSelect = (index: number) => {
    setSelectedIndex(index);
    const variant = variants[index];
    onSelect?.(variant, index);
  };

  const handleBook = () => {
    if (selectedIndex !== null && onBook) {
      onBook(variants[selectedIndex]);
    }
  };

  return (
    <section className="py-8 md:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
          Choose your service
        </h2>
        <div className="space-y-3">
          {variants.map((variant, index) => {
            const isSelected = selectedIndex === index;
            return (
              <div
                key={index}
                onClick={() => handleSelect(index)}
                className={`relative p-4 md:p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-nilin-primary bg-nilin-primary/5'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                {variant.popular && (
                  <span className="absolute -top-2.5 left-4 px-3 py-0.5 bg-nilin-accent text-white text-xs font-semibold rounded-full">
                    Most Popular
                  </span>
                )}

                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 text-base">
                        {variant.name}
                      </h3>
                      {isSelected && (
                        <Check className="w-5 h-5 text-nilin-primary" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">{variant.description}</p>
                    <div className="flex items-center gap-1 text-sm text-gray-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{variant.duration}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-bold text-gray-900">
                      {currency} {variant.price}
                    </p>
                  </div>
                </div>

                {isSelected && (
                  <button
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      handleBook();
                    }}
                    className="absolute bottom-4 right-4 px-4 py-2 bg-nilin-coral text-white text-sm font-semibold rounded-xl hover:bg-nilin-rose transition-colors flex items-center gap-2"
                  >
                    Book Now <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ServiceVariants;