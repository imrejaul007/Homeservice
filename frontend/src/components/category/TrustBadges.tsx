import React from 'react';
import { TrustBadge } from '../product/TrustBadge';

// TrustBadges - displays multiple trust badges in a container
// Uses the consolidated TrustBadge component from product/TrustBadge.tsx
const TrustBadges: React.FC = () => {
  return (
    <div className="bg-white rounded-2xl p-5 md:p-6 border border-gray-100 shadow-sm">
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-8">
        <TrustBadge type="verified" size="sm" />
        <TrustBadge type="completed" size="sm" />
        <TrustBadge type="top_rated" size="sm" />
      </div>
    </div>
  );
};

export default TrustBadges;
