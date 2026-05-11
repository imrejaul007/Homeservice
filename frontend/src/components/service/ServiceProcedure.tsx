import React from 'react';

interface ProcedureStep {
  step: number;
  title: string;
  description: string;
}

interface ServiceProcedureProps {
  steps: ProcedureStep[];
}

const ServiceProcedure: React.FC<ServiceProcedureProps> = ({ steps }) => {
  return (
    <section className="py-8 md:py-12 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-8">
          How it works
        </h2>
        <div className="space-y-6">
          {steps.map((step, index) => (
            <div key={step.step} className="flex gap-4 md:gap-6">
              {/* Step number */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-nilin-primary text-white flex items-center justify-center font-bold text-sm">
                  {step.step}
                </div>
                {index < steps.length - 1 && (
                  <div className="w-0.5 h-full min-h-[40px] bg-nilin-primary/20 mt-2" />
                )}
              </div>
              {/* Step content */}
              <div className="pb-6">
                <h3 className="font-semibold text-gray-900 text-base mb-1">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServiceProcedure;
