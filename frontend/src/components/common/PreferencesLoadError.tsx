import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface PreferencesLoadErrorProps {
  message: string;
  onRetry: () => void;
  label?: string;
}

const PreferencesLoadError: React.FC<PreferencesLoadErrorProps> = ({
  message,
  onRetry,
  label = 'Failed to load preferences',
}) => (
  <div
    className="flex flex-col items-center justify-center py-12 gap-4 text-center"
    role="alert"
    aria-live="polite"
  >
    <AlertCircle className="w-10 h-10 text-red-500" aria-hidden="true" />
    <div>
      <p className="font-medium text-nilin-charcoal">{label}</p>
      <p className="text-sm text-nilin-warmGray mt-1">{message}</p>
    </div>
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-nilin-coral border border-nilin-coral rounded-nilin hover:bg-nilin-coral/10 transition-colors"
    >
      <RefreshCw className="w-4 h-4" />
      Try again
    </button>
  </div>
);

export default PreferencesLoadError;
