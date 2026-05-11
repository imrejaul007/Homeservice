import React from 'react';
import { CheckCircle, Sparkles, Home, ShieldCheck } from 'lucide-react';

const INCLUDED_FEATURES = [
  {
    icon: CheckCircle,
    title: 'Verified professionals',
    description: 'Background-checked experts',
    iconColor: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-100',
  },
  {
    icon: Sparkles,
    title: 'Premium products',
    description: 'High-quality tools & materials',
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-100',
  },
  {
    icon: Home,
    title: 'In-home service',
    description: 'Comfort of your own space',
    iconColor: 'text-sky-600',
    bgColor: 'bg-sky-50',
    borderColor: 'border-sky-100',
  },
  {
    icon: ShieldCheck,
    title: 'Safe & hygienic',
    description: 'Strict safety protocols',
    iconColor: 'text-violet-600',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-100',
  },
];

const WhatsIncluded: React.FC = () => {
  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-8 md:mb-10">
          What's Included
        </h2>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {INCLUDED_FEATURES.map((feature) => {
            const IconComponent = feature.icon;
            return (
              <div
                key={feature.title}
                className={`
                  bg-white rounded-2xl p-5 md:p-6 text-center
                  border-2 ${feature.borderColor}
                  hover:shadow-md transition-shadow duration-200
                `}
              >
                <div className={`
                  ${feature.bgColor} ${feature.iconColor}
                  w-14 h-14 md:w-16 md:h-16 rounded-2xl
                  flex items-center justify-center mx-auto mb-4
                `}>
                  <IconComponent className="w-7 h-7 md:w-8 md:h-8" strokeWidth={1.5} />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm md:text-base mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-gray-500 text-xs md:text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhatsIncluded;
