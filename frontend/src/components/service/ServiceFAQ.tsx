import React from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../common/Accordion';

interface FAQ {
  question: string;
  answer: string;
}

interface ServiceFAQProps {
  faqs: FAQ[];
  defaultOpen?: number;
}

const ServiceFAQ: React.FC<ServiceFAQProps> = ({
  faqs,
  defaultOpen = 0,
}) => {
  return (
    <section className="py-8 md:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
          Frequently asked questions
        </h2>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <Accordion
            defaultValue={`faq-${defaultOpen}`}
            collapsible={true}
          >
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`faq-${index}`}
                className="border-b border-gray-100 last:border-b-0"
              >
                <AccordionTrigger
                  className="px-5 py-4 hover:bg-gray-50/80 text-left w-full"
                  showArrow={true}
                >
                  <span className="font-medium text-gray-900 text-sm md:text-base pr-4">
                    {faq.question}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="px-5 pb-4 pt-1">
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* Help CTA */}
        <div className="mt-8 p-6 bg-gradient-to-br from-nilin-peach/30 to-nilin-rose/20 rounded-2xl border border-nilin-rose/20">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-nilin-rose/20 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-nilin-rose" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-1">Still have questions?</h3>
              <p className="text-sm text-gray-600 mb-3">Can't find the answer you're looking for? Reach out to our support team.</p>
              <button className="text-sm font-medium text-nilin-rose hover:text-nilin-rose/80 transition-colors">
                Contact Support →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServiceFAQ;
