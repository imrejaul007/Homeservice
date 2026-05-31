/**
 * WhatsApp Opt-In Component
 * UI for WhatsApp notification opt-in flow
 */

import React, { useState, useCallback } from 'react';
import { MessageCircle, Check, X, Loader2, Shield, Bell } from 'lucide-react';
import { cn } from '../../lib/utils';

interface WhatsAppOptInProps {
  phoneNumber?: string;
  onOptIn: () => Promise<void>;
  onOptOut: () => Promise<void>;
  isEnabled: boolean;
  optedInAt?: Date;
  className?: string;
}

export const WhatsAppOptIn: React.FC<WhatsAppOptInProps> = ({
  phoneNumber,
  onOptIn,
  onOptOut,
  isEnabled,
  optedInAt,
  className,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onOptIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable WhatsApp');
    } finally {
      setIsLoading(false);
    }
  }, [onOptIn]);

  const handleOptOut = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await onOptOut();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable WhatsApp');
    } finally {
      setIsLoading(false);
    }
  }, [onOptOut]);

  const formatOptedInDate = (date?: Date) => {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 overflow-hidden', className)}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#25D366] to-[#128C7E] p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <MessageCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">WhatsApp Notifications</h3>
            <p className="text-white/80 text-sm">Get instant booking updates</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Status Badge */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm text-gray-600">Status</span>
          <span
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              isEnabled
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-600'
            )}
          >
            {isEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {/* Phone Number */}
        {phoneNumber && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Linked phone number</p>
            <p className="font-medium text-gray-900">{phoneNumber}</p>
          </div>
        )}

        {/* Benefits */}
        <div className="space-y-3 mb-6">
          <h4 className="text-sm font-medium text-gray-900">What you'll receive:</h4>
          <ul className="space-y-2">
            <li className="flex items-center gap-2 text-sm text-gray-600">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              Instant booking confirmations
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-600">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              Service reminders before appointments
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-600">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              Real-time status updates
            </li>
            <li className="flex items-center gap-2 text-sm text-gray-600">
              <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              Payment confirmations
            </li>
          </ul>
        </div>

        {/* Privacy Note */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg mb-6">
          <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900">Your privacy matters</p>
            <p className="text-blue-700 mt-1">
              We'll only send you notifications. You can unsubscribe anytime by
              replying STOP.
            </p>
          </div>
        </div>

        {/* Opted In Date */}
        {isEnabled && optedInAt && (
          <p className="text-xs text-gray-500 mb-4">
            Enabled on {formatOptedInDate(optedInAt)}
          </p>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg mb-4">
            <X className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Action Button */}
        {isEnabled ? (
          <button
            onClick={handleOptOut}
            disabled={isLoading}
            className={cn(
              'w-full py-3 px-4 rounded-lg font-medium transition-all',
              'bg-gray-100 text-gray-700 hover:bg-gray-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </span>
            ) : (
              'Disable WhatsApp Notifications'
            )}
          </button>
        ) : (
          <button
            onClick={handleOptIn}
            disabled={isLoading}
            className={cn(
              'w-full py-3 px-4 rounded-lg font-medium transition-all',
              'bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white',
              'hover:opacity-90 active:scale-[0.98]',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Enabling...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Bell className="w-4 h-4" />
                Enable WhatsApp Notifications
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default WhatsAppOptIn;
