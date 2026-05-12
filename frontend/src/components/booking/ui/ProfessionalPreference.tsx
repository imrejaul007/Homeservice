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
  const options: { value: Preference; label: string; icon: React.ReactNode }[] = [
    {
      value: 'male',
      label: 'Male',
      icon: (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center shadow-nilin">
          <User className="w-5 h-5 text-blue-600" />
        </div>
      )
    },
    {
      value: 'female',
      label: 'Female',
      icon: (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-100 to-pink-200 flex items-center justify-center shadow-nilin">
          <User className="w-5 h-5 text-pink-600" />
        </div>
      )
    },
    {
      value: 'no_preference',
      label: 'No preference',
      icon: (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-nilin">
          <Users className="w-5 h-5 text-gray-600" />
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
            className={cn(
              "relative flex flex-col items-center py-4 px-2 rounded-xl transition-all card-3d",
              isSelected
                ? 'bg-gradient-to-br from-nilin-rose/10 to-nilin-coral/10 border-2 border-nilin-rose shadow-nilin-warm'
                : 'glass border-2 border-nilin-border/30 hover:border-nilin-rose/50 hover:bg-nilin-blush/30'
            )
            }
          >
            {option.icon}
            <span className={cn(
              "mt-2 text-sm font-medium",
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

export default ProfessionalPreference;
