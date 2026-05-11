import React from 'react';
import { User, Users, Check } from 'lucide-react';

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
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <User className="w-5 h-5 text-blue-600" />
        </div>
      )
    },
    {
      value: 'female',
      label: 'Female',
      icon: (
        <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
          <User className="w-5 h-5 text-pink-600" />
        </div>
      )
    },
    {
      value: 'no_preference',
      label: 'No preference',
      icon: (
        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
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
            className={`
              relative flex flex-col items-center py-4 px-2 rounded-xl transition-all
              ${isSelected
                ? 'bg-nilin-primary/10 border-2 border-nilin-primary'
                : 'bg-white border-2 border-gray-200 hover:border-gray-300'
              }
            `}
          >
            {option.icon}
            <span className={`mt-2 text-sm font-medium ${isSelected ? 'text-nilin-primary' : 'text-gray-700'}`}>
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

export default ProfessionalPreference;
