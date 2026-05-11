import React from 'react';
import { Package } from 'lucide-react';

interface Equipment {
  name: string;
  description: string;
}

interface ServiceEquipmentProps {
  equipment: Equipment[];
}

const ServiceEquipment: React.FC<ServiceEquipmentProps> = ({ equipment }) => {
  return (
    <section className="py-8 md:py-12 bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
          What we bring
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Our professionals arrive fully equipped
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {equipment.map((item, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-4 border border-gray-100"
            >
              <div className="w-10 h-10 rounded-lg bg-nilin-lavender/50 flex items-center justify-center mb-3">
                <Package className="w-5 h-5 text-nilin-primary" />
              </div>
              <h3 className="font-medium text-gray-900 text-sm mb-1">
                {item.name}
              </h3>
              <p className="text-xs text-gray-500">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServiceEquipment;
