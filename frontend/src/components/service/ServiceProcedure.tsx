import React from 'react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../common/Accordion';

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
    <section className="py-8 md:py-12 bg-gradient-to-b from-gray-50/50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-8">
          How it works
        </h2>
        <Accordion type="multiple" className="space-y-3">
          {steps.map((step, index) => (
            <AccordionItem
              key={step.step}
              value={`step-${step.step}`}
              className="border-0"
            >
              <div className="flex gap-4 md:gap-6">
                {/* Timeline connector with step number */}
                <div className="flex flex-col items-center flex-shrink-0">
                  {/* Step number bubble with warm coral */}
                  <button
                    className="group relative w-11 h-11 rounded-full flex items-center justify-center
                      bg-gradient-to-br from-[#E8B4A8] to-[#d4a090]
                      text-white font-bold text-sm
                      shadow-[0_4px_14px_rgba(232,180,168,0.4)]
                      transition-all duration-300 ease-out
                      hover:shadow-[0_6px_20px_rgba(232,180,168,0.6)]
                      hover:scale-105
                      data-[state=open]:from-[#d4a090] data-[state=open]:to-[#c49183]"
                    style={{ '--tw-shadow-color': 'rgba(232, 180, 168, 0.4)' } as React.CSSProperties}
                    aria-label={`Step ${step.step}: ${step.title}`}
                  >
                    {step.step}
                    {/* Subtle pulse ring on hover */}
                    <span className="absolute inset-0 rounded-full bg-[#E8B4A8]/30 scale-100 opacity-0 group-hover:scale-150 group-hover:opacity-100 transition-all duration-500" />
                  </button>
                  {/* Connector line with NILIN styling */}
                  {index < steps.length - 1 && (
                    <div
                      className="w-0.5 flex-1 min-h-[40px] mt-3
                        bg-gradient-to-b from-[#E8B4A8]/40 via-[#E8B4A8]/20 to-[#E8B4A8]/40
                        rounded-full
                        transition-all duration-300"
                    />
                  )}
                </div>

                {/* Collapsible step content */}
                <div className="flex-1 pb-2">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 text-base md:text-lg text-left
                        transition-colors duration-200
                        group-data-[state=open]:text-[#c49183]
                        group-hover:text-[#d4a090]">
                        {step.title}
                      </h3>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent
                    className="[&>div]:!pt-3 [&>div]:!pb-0"
                  >
                    {/* Glass effect container for expanded content */}
                    <div
                      className="relative overflow-hidden rounded-xl
                        bg-white/60 backdrop-blur-md
                        border border-[#E8B4A8]/20
                        shadow-[0_4px_16px_rgba(232,180,168,0.15)]
                        before:absolute before:inset-0 before:bg-gradient-to-br
                        before:from-white/40 before:to-[#E8B4A8]/5
                        before:pointer-events-none"
                    >
                      {/* Decorative corner accent */}
                      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#E8B4A8]/10 to-transparent rounded-bl-full" />

                      <p className="relative text-sm md:text-base text-gray-600 leading-relaxed
                        pl-4 py-3 border-l-2 border-[#E8B4A8]/30">
                        {step.description}
                      </p>
                    </div>
                  </AccordionContent>
                </div>
              </div>
            </AccordionItem>
          ))}
        </Accordion>

        {/* Bottom decorative element */}
        <div className="mt-8 flex justify-center">
          <div className="flex items-center gap-2 text-[#E8B4A8]/60">
            <div className="w-8 h-0.5 bg-gradient-to-r from-transparent to-[#E8B4A8]/40 rounded-full" />
            <div className="w-2 h-2 rounded-full bg-[#E8B4A8]/50" />
            <div className="w-8 h-0.5 bg-gradient-to-l from-transparent to-[#E8B4A8]/40 rounded-full" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServiceProcedure;
