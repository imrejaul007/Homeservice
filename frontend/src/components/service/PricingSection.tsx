import React from 'react';
import { Info, CreditCard, Shield } from 'lucide-react';

interface PricingSectionProps {
  startingPrice: number;
  currency?: string;
}

const PricingSection: React.FC<PricingSectionProps> = ({
  startingPrice,
  currency = 'AED',
}) => {
  return (
    <section className="py-12 md:py-16 bg-[#FAF8F5]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Pricing Display */}
        <div className="bg-white rounded-2xl p-6 md:p-8 border border-gray-100 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            {/* Left: Pricing Info */}
            <div>
              <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-2">
                Pricing
              </h2>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-gray-500 text-lg">Starts from</span>
                <span className="text-3xl md:text-4xl font-bold text-gray-900">
                  {currency} {startingPrice}
                </span>
              </div>
              <p className="text-gray-500 text-sm md:text-base max-w-md">
                Final price is calculated based on your service details and selected professional.
              </p>
            </div>

            {/* Right: Trust Badges */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4 h-4 text-emerald-600" />
                </div>
                <span>No hidden charges</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="w-4 h-4 text-blue-600" />
                </div>
                <span>Secure payment</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Info className="w-4 h-4 text-amber-600" />
                </div>
                <span>Transparent pricing</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
