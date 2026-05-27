import React from 'react';

interface TrustBadgeProps {
  type: 'verified' | 'top_rated' | 'premium';
}

export const TrustBadge: React.FC<TrustBadgeProps> = ({ type }) => {
  const config = {
    verified: { icon: '✓', bg: 'bg-green-100', text: 'text-green-700', label: 'Verified' },
    top_rated: { icon: '★', bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Top Rated' },
    premium: { icon: '◆', bg: 'bg-purple-100', text: 'text-purple-700', label: 'Premium' }
  };
  const { icon, bg, text, label } = config[type];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
      <span>{icon}</span> {label}
    </span>
  );
};
