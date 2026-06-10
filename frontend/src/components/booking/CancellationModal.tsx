import React, { useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface TrackingData {
  bookingNumber: string;
  service?: { name: string };
  scheduledDate: string;
  scheduledTime: string;
}

interface CancellationModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: TrackingData;
  onConfirm: (reason: string) => Promise<void>;
  isLoading: boolean;
}

const CANCELLATION_REASONS = [
  'Changed my mind',
  'Found another provider',
  'Schedule conflict',
  'Service no longer needed',
  'Emergency/Urgent matter',
  'Other'
];

const CancellationModal: React.FC<CancellationModalProps> = ({
  isOpen,
  onClose,
  booking,
  onConfirm,
  isLoading
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const reason = selectedReason === 'Other' ? customReason : selectedReason;
    if (!reason.trim()) return;
    await onConfirm(reason);
  };

  const isValid = selectedReason && (selectedReason !== 'Other' || customReason.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
          disabled={isLoading}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-nilin-charcoal">Cancel Booking</h2>
            <p className="text-sm text-nilin-warmGray">#{booking.bookingNumber}</p>
          </div>
        </div>

        {/* Booking Info */}
        <div className="bg-nilin-cream rounded-xl p-4 mb-6">
          <p className="font-medium text-nilin-charcoal">{booking.service?.name || 'Service'}</p>
          <p className="text-sm text-nilin-warmGray mt-1">
            {new Date(booking.scheduledDate).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })} at {booking.scheduledTime}
          </p>
        </div>

        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Cancellation policies may apply. Please review our cancellation policy for more information.
          </p>
        </div>

        {/* Reason Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
            Why are you cancelling?
          </label>
          <div className="space-y-2">
            {CANCELLATION_REASONS.map((reason) => (
              <label
                key={reason}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedReason === reason
                    ? 'border-nilin-coral bg-nilin-coral/5'
                    : 'border-nilin-border hover:border-nilin-coral/50'
                }`}
              >
                <input
                  type="radio"
                  name="cancelReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-4 h-4 text-nilin-coral"
                />
                <span className="text-nilin-charcoal">{reason}</span>
              </label>
            ))}
          </div>

          {/* Custom reason input */}
          {selectedReason === 'Other' && (
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Please specify your reason..."
              className="mt-3 w-full px-4 py-3 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none resize-none"
              rows={3}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-nilin-border rounded-xl font-medium text-nilin-charcoal hover:bg-nilin-cream transition-colors disabled:opacity-50"
          >
            Keep Booking
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Cancel Booking'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancellationModal;
