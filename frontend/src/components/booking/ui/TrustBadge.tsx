import React from 'react';
import { Shield, CheckCircle, Lock } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface TrustBadgeProps {
  variant?: 'default' | 'compact' | 'inline';
}

const TrustBadge: React.FC<TrustBadgeProps> = ({ variant = 'default' }) => {
  if (variant === 'inline') {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-gradient-to-r from-nilin-rose/10 to-nilin-coral/10 rounded-full glass">
        <Shield className="w-3.5 h-3.5 text-nilin-rose" />
        <span className="text-xs font-medium text-nilin-rose">Verified by NILIN</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="glass flex items-center gap-2 p-2 rounded-lg gradient-3d">
        <Shield className="w-4 h-4 text-nilin-rose" />
        <span className="text-sm text-nilin-charcoal">NILIN verified professional</span>
      </div>
    );
  }

  // Default variant - full trust badges section
  return (
    <div className="glass glass-blur rounded-xl p-4 gradient-3d card-3d">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 bg-gradient-to-br from-nilin-rose/20 to-nilin-coral/20 rounded-lg flex items-center justify-center">
          <Shield className="w-5 h-5 text-nilin-rose" />
        </div>
        <span className="font-medium text-nilin-charcoal">Booking Protection</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-nilin-charcoal">
          <CheckCircle className="w-4 h-4 text-nilin-success flex-shrink-0" />
          <span>Verified professionals only</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-nilin-charcoal">
          <CheckCircle className="w-4 h-4 text-nilin-success flex-shrink-0" />
          <span>Pay after service completion</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-nilin-charcoal">
          <Lock className="w-4 h-4 text-nilin-success flex-shrink-0" />
          <span>Secure payment processing</span>
        </div>
      </div>
    </div>
  );
};

export default TrustBadge;
