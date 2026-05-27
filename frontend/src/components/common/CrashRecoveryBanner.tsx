/**
 * CrashRecoveryBanner Component
 *
 * Shows a banner when the app recovers from a crash.
 * Provides information about the crash and allows user to report issues.
 */

import React from 'react';
import { X } from 'lucide-react';

interface CrashRecoveryBannerProps {
  crashCount: number;
  anrCount: number;
  onDismiss: () => void;
}

export const CrashRecoveryBanner: React.FC<CrashRecoveryBannerProps> = ({
  crashCount,
  anrCount,
  onDismiss,
}) => {
  if (crashCount === 0 && anrCount === 0) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-3 shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-amber-800">
              App Recovered from Issue
            </p>
            <p className="text-xs text-amber-600">
              {crashCount > 0 && `Crashes: ${crashCount}`}
              {crashCount > 0 && anrCount > 0 && ' | '}
              {anrCount > 0 && `Freezes: ${anrCount}`}
            </p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-md text-amber-500 hover:bg-amber-100 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};

export default CrashRecoveryBanner;
