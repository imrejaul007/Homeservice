import React from 'react';
import { Check, X } from 'lucide-react';

interface ServicePrerequisitesProps {
  dos: string[];
  donts: string[];
}

const ServicePrerequisites: React.FC<ServicePrerequisitesProps> = ({ dos, donts }) => {
  return (
    <section className="py-8 md:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">
          Before your appointment
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Do's */}
          <div className="bg-green-50 rounded-2xl p-5 md:p-6">
            <h3 className="font-semibold text-green-800 text-base mb-4 flex items-center gap-2">
              <Check className="w-5 h-5" />
              Do's
            </h3>
            <ul className="space-y-3">
              {dos.map((item, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-green-800">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Don'ts */}
          <div className="bg-red-50 rounded-2xl p-5 md:p-6">
            <h3 className="font-semibold text-red-800 text-base mb-4 flex items-center gap-2">
              <X className="w-5 h-5" />
              Don'ts
            </h3>
            <ul className="space-y-3">
              {donts.map((item, index) => (
                <li key={index} className="flex items-start gap-2.5">
                  <X className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-red-800">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ServicePrerequisites;
