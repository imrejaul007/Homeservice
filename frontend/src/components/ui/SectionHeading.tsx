import React from 'react';

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  action?: { label: string; onClick: () => void };
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({ title, subtitle, action }) => (
  <div className="flex items-center justify-between mb-6">
    <div>
      <h2 className="text-2xl font-bold text-nilin-charcoal">{title}</h2>
      {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
    </div>
    {action && (
      <button onClick={action.onClick} className="text-nilin-coral font-medium hover:underline">
        {action.label}
      </button>
    )}
  </div>
);
