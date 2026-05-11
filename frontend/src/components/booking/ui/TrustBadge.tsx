import React from 'react';
import { Shield, CheckCircle, Lock } from 'lucide-react';

interface TrustBadgeProps {
  variant?: 'default' | 'compact' | 'inline';
}

const TrustBadge: React.FC<TrustBadgeProps> = ({ variant = 'default' }) => {
  if (variant === 'inline') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-nilin-primary/10 rounded-full">
        <Shield className="w-3.5 h-3.5 text-nilin-primary" />
        <span className="text-xs font-medium text-nilin-primary">Verified by NILIN</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 p-2 bg-nilin-primary/5 rounded-lg">
        <Shield className="w-4 h-4 text-nilin-primary" />
        <span className="text-sm text-gray-600">NILIN verified professional</span>
      </div>
    );
  }

  // Default variant - full trust badges section
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-5 h-5 text-nilin-primary" />
        <span className="font-medium text-gray-800">Booking Protection</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span>Verified professionals only</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span>Pay after service completion</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Lock className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span>Secure payment processing</span>
        </div>
      </div>
    </div>
  );
};

export default TrustBadge;
