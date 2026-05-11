import React from 'react';
import { Home, Building2, Check } from 'lucide-react';

type LocationType = 'at_home' | 'hotel';

interface LocationTypeSelectorProps {
  selected: LocationType;
  onChange: (type: LocationType) => void;
}

const LocationTypeSelector: React.FC<LocationTypeSelectorProps> = ({
  selected,
  onChange
}) => {
  const options: { type: LocationType; label: string; icon: React.ReactNode }[] = [
    { type: 'at_home', label: 'At home', icon: <Home className="w-6 h-6" /> },
    { type: 'hotel', label: 'Hotel', icon: <Building2 className="w-6 h-6" /> }
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const isSelected = selected === option.type;

        return (
          <button
            key={option.type}
            onClick={() => onChange(option.type)}
            className={`
              relative flex items-center gap-3 p-4 rounded-xl transition-all
              ${isSelected
                ? 'bg-nilin-primary/10 border-2 border-nilin-primary'
                : 'bg-white border-2 border-gray-200 hover:border-gray-300'
              }
            `}
          >
            <div className={`${isSelected ? 'text-nilin-primary' : 'text-gray-500'}`}>
              {option.icon}
            </div>
            <span className={`font-medium ${isSelected ? 'text-nilin-primary' : 'text-gray-700'}`}>
              {option.label}
            </span>
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-nilin-primary rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default LocationTypeSelector;
