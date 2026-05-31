import React, { useState, useCallback } from 'react';
import { AlertTriangle, Clock, MapPin, User, CheckCircle, Loader2, Phone, MessageSquare } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

// =============================================================================
// NILIN Customer Dashboard - No Show Report Component
// Provider no-show reporting functionality
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface NoShowReportProps {
  /** Booking information */
  booking: {
    id: string;
    serviceName: string;
    providerId: string;
    providerName: string;
    providerPhone?: string;
    scheduledDate: Date;
    scheduledTime: string;
    location: string;
  };
  /** Whether modal is open */
  open: boolean;
  /** Callback when report is submitted */
  onSubmit: (data: NoShowReportData) => Promise<void>;
  /** Callback when modal state changes */
  onOpenChange: (open: boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

export interface NoShowReportData {
  bookingId: string;
  providerId: string;
  reason: string;
  additionalDetails?: string;
  attemptsToContact: string;
  preferredResolution: 'reschedule' | 'refund' | 'credit' | 'other';
  alternativeProvider?: boolean;
  alternativeProviderId?: string;
}

// =============================================================================
// No Show Report Form
// =============================================================================

interface NoShowReportFormProps {
  booking: NoShowReportProps['booking'];
  onSubmit: (data: NoShowReportData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const NoShowReportForm: React.FC<NoShowReportFormProps> = ({
  booking,
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const [reason, setReason] = useState('');
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [attemptsToContact, setAttemptsToContact] = useState('0');
  const [preferredResolution, setPreferredResolution] = useState<NoShowReportData['preferredResolution']>('reschedule');
  const [alternativeProvider, setAlternativeProvider] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // No-show reasons
  const noShowReasons = [
    'Provider did not arrive',
    'Provider cancelled last minute without notice',
    'Provider is not responding',
    'Provider claimed they were never assigned',
    'Provider arrived but left before service',
    'Other',
  ];

  // Contact attempts
  const contactAttempts = [
    { value: '0', label: 'Did not try to contact' },
    { value: '1', label: 'Tried once' },
    { value: '2', label: 'Tried twice' },
    { value: '3+', label: 'Tried multiple times' },
  ];

  // Resolution options
  const resolutionOptions: Array<{
    value: NoShowReportData['preferredResolution'];
    label: string;
    description: string;
  }> = [
    {
      value: 'reschedule',
      label: 'Reschedule Service',
      description: 'Book with the same provider or a different one',
    },
    {
      value: 'refund',
      label: 'Full Refund',
      description: 'Get your money back',
    },
    {
      value: 'credit',
      label: 'Account Credit',
      description: 'Add credit to your account for future use',
    },
    {
      value: 'other',
      label: 'Other',
      description: 'Let us help you find the best solution',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason) {
      setError('Please select a reason for the no-show');
      return;
    }

    try {
      await onSubmit({
        bookingId: booking.id,
        providerId: booking.providerId,
        reason,
        additionalDetails: additionalDetails || undefined,
        attemptsToContact,
        preferredResolution,
        alternativeProvider,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Booking Info */}
      <div className="bg-red-50 rounded-xl p-4 border border-red-200">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="font-semibold text-red-700">Provider No-Show</span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <User className="h-4 w-4 text-nilin-warmGray mt-0.5" />
            <div>
              <p className="font-medium text-nilin-charcoal">{booking.providerName}</p>
              <p className="text-nilin-warmGray">{booking.serviceName}</p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <Clock className="h-4 w-4 text-nilin-warmGray mt-0.5" />
            <div>
              <p className="text-nilin-charcoal">
                {booking.scheduledDate.toLocaleDateString('en-AE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}{' '}
                at {booking.scheduledTime}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-nilin-warmGray mt-0.5" />
            <p className="text-nilin-charcoal">{booking.location}</p>
          </div>
        </div>

        {/* Quick Actions */}
        {booking.providerPhone && (
          <div className="flex gap-2 mt-4 pt-4 border-t border-red-200">
            <a
              href={`tel:${booking.providerPhone}`}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
            >
              <Phone className="h-4 w-4" />
              Call Provider
            </a>
            <a
              href={`sms:${booking.providerPhone}`}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              Message
            </a>
          </div>
        )}
      </div>

      {/* Reason Selection */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-3">
          What happened?
        </label>
        <div className="space-y-2">
          {noShowReasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all',
                reason === r
                  ? 'border-red-400 bg-red-50'
                  : 'border-nilin-blush/30 hover:border-nilin-coral/30'
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                reason === r
                  ? 'border-red-500 bg-red-500'
                  : 'border-gray-300'
              )}>
                {reason === r && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <span className={cn(
                'text-sm',
                reason === r ? 'text-red-700 font-medium' : 'text-nilin-charcoal'
              )}>
                {r}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Additional Details */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-2">
          Additional details (optional)
        </label>
        <textarea
          value={additionalDetails}
          onChange={(e) => setAdditionalDetails(e.target.value)}
          placeholder="Describe what happened in more detail..."
          className={cn(
            'w-full px-4 py-3 rounded-xl border-2 border-nilin-blush/30',
            'focus:border-nilin-coral focus:ring-0 focus:outline-none',
            'text-nilin-charcoal placeholder:text-nilin-warmGray/50',
            'resize-none h-24'
          )}
        />
      </div>

      {/* Attempts to Contact */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-2">
          Did you try to contact the provider?
        </label>
        <div className="flex flex-wrap gap-2">
          {contactAttempts.map((attempt) => (
            <button
              key={attempt.value}
              type="button"
              onClick={() => setAttemptsToContact(attempt.value)}
              className={cn(
                'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                attemptsToContact === attempt.value
                  ? 'border-nilin-coral bg-nilin-coral/5 text-nilin-coral'
                  : 'border-nilin-blush/30 text-nilin-charcoal hover:border-nilin-coral/30'
              )}
            >
              {attempt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preferred Resolution */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-3">
          How would you like to resolve this?
        </label>
        <div className="space-y-2">
          {resolutionOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPreferredResolution(option.value)}
              className={cn(
                'w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all',
                preferredResolution === option.value
                  ? 'border-nilin-coral bg-nilin-coral/5'
                  : 'border-nilin-blush/30 hover:border-nilin-coral/30'
              )}
            >
              <div className={cn(
                'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                preferredResolution === option.value
                  ? 'border-nilin-coral bg-nilin-coral'
                  : 'border-gray-300'
              )}>
                {preferredResolution === option.value && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
              <div>
                <p className={cn(
                  'font-medium',
                  preferredResolution === option.value ? 'text-nilin-coral' : 'text-nilin-charcoal'
                )}>
                  {option.label}
                </p>
                <p className="text-xs text-nilin-warmGray">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Alternative Provider */}
      <div className="flex items-center gap-3 p-4 bg-nilin-blush/20 rounded-xl">
        <button
          type="button"
          onClick={() => setAlternativeProvider(!alternativeProvider)}
          className={cn(
            'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
            alternativeProvider
              ? 'border-nilin-coral bg-nilin-coral'
              : 'border-gray-300'
          )}
        >
          {alternativeProvider && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <div>
          <p className="text-sm font-medium text-nilin-charcoal">
            Find an alternative provider
          </p>
          <p className="text-xs text-nilin-warmGray">
            We can help you find another available provider
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-700">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={isSubmitting}
        >
          Submit Report
        </Button>
      </div>
    </form>
  );
};

// =============================================================================
// Success State
// =============================================================================

interface NoShowSuccessProps {
  onClose: () => void;
  onReschedule?: () => void;
}

const NoShowSuccess: React.FC<NoShowSuccessProps> = ({
  onClose,
  onReschedule,
}) => {
  return (
    <div className="text-center py-6">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle className="h-8 w-8 text-green-600" />
      </div>

      <h3 className="text-xl font-bold text-nilin-charcoal mb-2">
        Report Submitted
      </h3>

      <p className="text-nilin-warmGray mb-6">
        Thank you for reporting. We've received your complaint and will investigate immediately.
      </p>

      <div className="bg-nilin-blush/20 rounded-xl p-4 mb-6 text-left">
        <h4 className="text-sm font-semibold text-nilin-charcoal mb-2">What happens next?</h4>
        <ul className="space-y-2 text-sm text-nilin-warmGray">
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-nilin-coral/20 text-nilin-coral text-xs flex items-center justify-center flex-shrink-0 font-medium">1</span>
            We'll contact the provider to verify the no-show
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-nilin-coral/20 text-nilin-coral text-xs flex items-center justify-center flex-shrink-0 font-medium">2</span>
            You'll receive an update within 24 hours
          </li>
          <li className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-nilin-coral/20 text-nilin-coral text-xs flex items-center justify-center flex-shrink-0 font-medium">3</span>
            Your preferred resolution will be processed
          </li>
        </ul>
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        {onReschedule && (
          <Button variant="primary" onClick={onReschedule}>
            Find New Provider
          </Button>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const NoShowReport: React.FC<NoShowReportProps> = ({
  booking,
  open,
  onSubmit,
  onOpenChange,
  className,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(async (data: NoShowReportData) => {
    setIsSubmitting(true);

    try {
      await onSubmit(data);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [onSubmit]);

  const handleClose = useCallback(() => {
    setSubmitted(false);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title={submitted ? 'Report Submitted' : 'Report No-Show'}
      description={
        submitted
          ? undefined
          : 'Let us know what happened so we can help resolve this'
      }
      size="md"
    >
      {submitted ? (
        <NoShowSuccess
          onClose={handleClose}
          onReschedule={() => {
            // Navigate to find new provider
            handleClose();
          }}
        />
      ) : (
        <NoShowReportForm
          booking={booking}
          onSubmit={handleSubmit}
          onCancel={handleClose}
          isSubmitting={isSubmitting}
        />
      )}
    </Modal>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default NoShowReport;
