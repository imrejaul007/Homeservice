import React from 'react';
import { User, Users, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';

type Preference = 'male' | 'female' | 'no_preference';

interface ProfessionalPreferenceProps {
  selected: Preference;
  onChange: (pref: Preference) => void;
}

const ProfessionalPreference: React.FC<ProfessionalPreferenceProps> = ({
  selected,
  onChange
}) => {
  const options: { value: Preference; label: string; icon: React.ReactNode; description: string }[] = [
    {
      value: 'male',
      label: 'Male',
      description: 'Male professional',
      icon: (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
          <User className="w-6 h-6 text-blue-600" />
        </div>
      )
    },
    {
      value: 'female',
      label: 'Female',
      description: 'Female professional',
      icon: (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center">
          <User className="w-6 h-6 text-pink-600" />
        </div>
      )
    },
    {
      value: 'no_preference',
      label: 'No Preference',
      description: 'Any available',
      icon: (
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center">
          <Users className="w-6 h-6 text-purple-600" />
        </div>
      )
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {options.map((option) => {
        const isSelected = selected === option.value;

        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={isSelected}
            className={cn(
              "relative flex flex-col items-center py-4 px-3 rounded-xl transition-all duration-200",
              isSelected
                ? 'bg-white border-2 border-nilin-coral shadow-lg ring-2 ring-nilin-coral/20'
                : 'bg-white border-2 border-nilin-border/50 hover:border-nilin-coral/50 hover:shadow-md'
            )}
          >
            {option.icon}
            <span className={cn(
              "mt-3 text-sm font-semibold",
              isSelected ? 'text-nilin-coral' : 'text-nilin-charcoal'
            )}>
              {option.label}
            </span>
            <span className={cn(
              "text-xs mt-0.5",
              isSelected ? 'text-nilin-coral/70' : 'text-nilin-warmGray'
            )}>
              {option.description}
            </span>
            {isSelected && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-nilin-coral rounded-full flex items-center justify-center shadow-md">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default ProfessionalPreference;
