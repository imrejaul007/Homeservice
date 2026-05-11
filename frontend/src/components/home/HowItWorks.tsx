import React from 'react';
import { ClipboardList, CheckCircle, Sparkles, Layers } from 'lucide-react';

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  bgGradient: string;
  iconColor: string;
  accentColor: string;
}

const STEPS: Step[] = [
  {
    icon: <ClipboardList className="w-6 h-6 sm:w-7 sm:h-7" />,
    title: 'Choose your service',
    description: 'Browse and select from our wide range of services',
    bgGradient: 'from-nilin-pink to-nilin-pink/50',
    iconColor: 'text-nilin-accent',
    accentColor: 'bg-nilin-primary',
  },
  {
    icon: <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7" />,
    title: 'Trusted Professionals',
    description: 'Verified experts with high ratings',
    bgGradient: 'from-nilin-blue to-nilin-blue/50',
    iconColor: 'text-nilin-primary',
    accentColor: 'bg-nilin-primary',
  },
  {
    icon: <Sparkles className="w-6 h-6 sm:w-7 sm:h-7" />,
    title: 'AI-Powered',
    description: 'Smart selection & automated suggestions',
    bgGradient: 'from-nilin-lavender to-nilin-lavender/50',
    iconColor: 'text-nilin-secondary',
    accentColor: 'bg-nilin-primary',
  },
  {
    icon: <Layers className="w-6 h-6 sm:w-7 sm:h-7" />,
    title: 'Multi-Service',
    description: 'Everything you need in-the-platform',
    bgGradient: 'from-nilin-cream to-nilin-cream/50',
    iconColor: 'text-nilin-primary',
    accentColor: 'bg-nilin-primary',
  },
];

const HowItWorks: React.FC = () => {
  return (
    <section className="py-10 md:py-16 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            How it Works
          </h2>
          <p className="text-sm text-gray-500">Simple steps to get started</p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 lg:gap-8">
          {STEPS.map((step, index) => (
            <div
              key={index}
              className="group text-center relative"
            >
              {/* Connector Line (hidden on mobile, first 3 items on desktop) */}
              {index < 3 && (
                <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-gray-200 to-gray-100" />
              )}

              {/* Icon Container */}
              <div className="relative inline-flex">
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br ${step.bgGradient} flex items-center justify-center ${step.iconColor} mb-4 shadow-lg group-hover:shadow-xl group-hover:scale-105 transition-all duration-300`}>
                  {step.icon}
                </div>
                {/* Step number badge */}
                <div className={`absolute -top-2 -right-2 w-6 h-6 sm:w-7 sm:h-7 rounded-full ${step.accentColor} text-white text-xs sm:text-sm font-bold flex items-center justify-center shadow-md`}>
                  {index + 1}
                </div>
              </div>

              {/* Title */}
              <h3 className="font-bold text-gray-900 text-sm sm:text-base mb-2">
                {step.title}
              </h3>

              {/* Description */}
              <p className="text-xs sm:text-sm text-gray-500 leading-relaxed max-w-[180px] mx-auto">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
