import React from 'react';
import { ClipboardList, UserCheck, Home, ArrowRight } from 'lucide-react';

const STEPS = [
  {
    icon: ClipboardList,
    number: '1',
    title: 'Choose your service',
    description: 'Select the service that fits your needs',
  },
  {
    icon: UserCheck,
    number: '2',
    title: 'Get matched',
    description: 'We connect you with the right professional',
  },
  {
    icon: Home,
    number: '3',
    title: 'Enjoy at home',
    description: 'Relax while we come to your place',
  },
];

const HowItWorksSection: React.FC = () => {
  return (
    <section className="py-12 md:py-16 bg-[#FAF8F5]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 md:mb-10">
          <h2 className="text-2xl md:text-3xl font-serif font-medium text-gray-900 mb-2">
            How NILIN Works
          </h2>
          <p className="text-gray-500 text-sm md:text-base">
            Simple steps to book your perfect service
          </p>
        </div>

        {/* Desktop Layout */}
        <div className="hidden md:flex items-center justify-between gap-4">
          {STEPS.map((step, index) => {
            const IconComponent = step.icon;
            return (
              <React.Fragment key={step.title}>
                <div className="flex-1 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 lg:p-8 text-center border border-amber-100/50 hover:shadow-md transition-shadow">
                  <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-amber-100">
                    <IconComponent className="w-8 h-8 text-amber-600" strokeWidth={1.5} />
                  </div>
                  <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold mb-3">
                    {step.number}
                  </div>
                  <h3 className="font-semibold text-gray-900 text-base mb-2">
                    {step.title}
                  </h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {index < STEPS.length - 1 && (
                  <div className="flex-shrink-0 w-12 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm">
                      <ArrowRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Mobile Layout */}
        <div className="md:hidden space-y-4">
          {STEPS.map((step) => {
            const IconComponent = step.icon;
            return (
              <div
                key={step.title}
                className="flex items-start gap-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100/50"
              >
                <div className="bg-white w-14 h-14 rounded-xl flex items-center justify-center shadow-sm border border-amber-100 flex-shrink-0">
                  <IconComponent className="w-7 h-7 text-amber-600" strokeWidth={1.5} />
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-600 text-white text-xs font-bold">
                      {step.number}
                    </span>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {step.title}
                    </h3>
                  </div>
                  <p className="text-gray-500 text-xs leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
