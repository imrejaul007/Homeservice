import React from 'react';
import { Home, Building2, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';

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
            className={cn(
              "relative flex items-center gap-3 p-4 rounded-xl transition-all card-3d",
              isSelected
                ? 'bg-gradient-to-br from-nilin-rose/10 to-nilin-coral/10 border-2 border-nilin-rose shadow-nilin-warm'
                : 'glass border-2 border-nilin-border/30 hover:border-nilin-rose/50 hover:bg-nilin-blush/30'
            )
            }
          >
            <div className={cn(
              "transition-colors",
              isSelected ? 'text-nilin-rose' : 'text-nilin-warmGray'
            )}>
              {option.icon}
            </div>
            <span className={cn(
              "font-medium",
              isSelected ? 'text-nilin-rose' : 'text-nilin-charcoal'
            )}>
              {option.label}
            </span>
            {isSelected && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-br from-nilin-rose to-nilin-coral rounded-full flex items-center justify-center shadow-sm float-3d">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default LocationTypeSelector;
