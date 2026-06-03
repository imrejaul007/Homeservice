import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DuplicateChargeWarningProps {
  className?: string;
  onDismiss?: () => void;
}

const DuplicateChargeWarning: React.FC<DuplicateChargeWarningProps> = ({
  className,
  onDismiss,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        'bg-amber-50 border border-amber-200 rounded-xl p-4',
        'flex items-start gap-3',
        className
      )}
    >
      {/* Warning Icon */}
      <div className="flex-shrink-0 w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
        <AlertTriangle className="w-5 h-5 text-amber-600" />
      </div>

      {/* Message */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-amber-800">
          Duplicate Charge Notice
        </p>
        <p className="text-sm text-amber-700 mt-1">
          You may see a duplicate charge on your statement, but don't worry - only one charge will be applied.
        </p>
      </div>

      {/* Dismiss Button */}
      <button
        onClick={handleDismiss}
        className={cn(
          'flex-shrink-0 p-1 rounded-lg',
          'text-amber-600 hover:text-amber-800 hover:bg-amber-100',
          'transition-colors'
        )}
        aria-label="Dismiss warning"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
};

export default DuplicateChargeWarning;
