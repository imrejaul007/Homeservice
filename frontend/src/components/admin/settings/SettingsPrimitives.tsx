import React from 'react';
import { Check } from 'lucide-react';

export const ToggleSwitch: React.FC<{
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
}> = ({ enabled, onChange, disabled = false }) => (
  <button
    type="button"
    role="switch"
    aria-checked={enabled}
    disabled={disabled}
    onClick={() => onChange(!enabled)}
    className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral focus-visible:ring-offset-2 ${
      enabled ? 'bg-nilin-coral' : 'bg-nilin-border'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${
        enabled ? 'translate-x-6' : 'translate-x-0'
      }`}
    >
      {enabled && <Check className="w-3 h-3 text-nilin-coral absolute top-1 left-1" />}
    </span>
  </button>
);

export const NumberInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}> = ({ value, onChange, min, max, step = 1, suffix, disabled = false }) => (
  <div className="flex items-center space-x-2">
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const newValue = parseFloat(e.target.value);
        if (!isNaN(newValue)) {
          if (min !== undefined && newValue < min) return;
          if (max !== undefined && newValue > max) return;
          onChange(newValue);
        }
      }}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className="w-24 px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal disabled:bg-nilin-muted disabled:cursor-not-allowed font-sans"
    />
    {suffix && <span className="text-sm text-nilin-warmGray font-sans">{suffix}</span>}
  </div>
);

export const TextInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'url' | 'password' | 'number';
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, type = 'text', placeholder, disabled = false, className = '' }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    className={`w-full px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal disabled:bg-nilin-muted disabled:cursor-not-allowed font-sans ${className}`}
  />
);

export const SettingRow: React.FC<{
  label: string;
  description?: string;
  children: React.ReactNode;
  warning?: boolean;
}> = ({ label, description, children, warning }) => (
  <div
    className={`flex items-center justify-between py-4 px-4 rounded-xl ${
      warning ? 'bg-amber-50/50' : 'hover:bg-nilin-blush/30 transition-colors'
    }`}
  >
    <div className="flex-1 mr-4">
      <label className="text-sm font-medium text-nilin-charcoal font-sans">{label}</label>
      {description && <p className="text-xs text-nilin-warmGray mt-0.5 font-sans">{description}</p>}
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

export const SelectInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
}> = ({ value, onChange, options, disabled = false, className = '' }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    disabled={disabled}
    className={`w-full px-3 py-2 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral focus:border-transparent bg-white text-sm text-nilin-charcoal disabled:bg-nilin-muted disabled:cursor-not-allowed font-sans ${className}`}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center py-2">
    <span className="text-xs font-semibold text-nilin-warmGray uppercase tracking-wider font-sans">
      {label}
    </span>
  </div>
);

export const LoadingSkeleton: React.FC = () => (
  <div className="animate-pulse">
    <div className="h-4 bg-nilin-blush/50 rounded w-1/3 mb-6" />
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass glass-blur p-4 rounded-xl border border-nilin-border/50">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-nilin-blush/50 rounded w-1/4" />
            <div className="h-6 bg-nilin-blush/50 rounded-full w-12" />
          </div>
        </div>
      ))}
    </div>
  </div>
);
