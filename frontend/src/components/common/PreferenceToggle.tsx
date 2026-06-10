import React from 'react';

interface PreferenceToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  id?: string;
}

const PreferenceToggle: React.FC<PreferenceToggleProps> = ({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  id,
}) => {
  const toggleId = id ?? `toggle-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div className="flex items-center justify-between py-3 border-b border-nilin-border last:border-0">
      <div>
        <p className="font-medium text-nilin-charcoal" id={`${toggleId}-label`}>
          {label}
        </p>
        {description && (
          <p className="text-sm text-nilin-warmGray" id={`${toggleId}-desc`}>
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        id={toggleId}
        aria-checked={checked}
        aria-labelledby={`${toggleId}-label`}
        aria-describedby={description ? `${toggleId}-desc` : undefined}
        disabled={disabled}
        onClick={onChange}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            onChange();
          }
        }}
        className={`relative w-12 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-nilin-coral/40 focus:ring-offset-2 ${
          checked ? 'bg-nilin-coral' : 'bg-gray-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'left-7' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
};

export default PreferenceToggle;
