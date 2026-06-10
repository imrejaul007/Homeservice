import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Loader2, AlertCircle } from 'lucide-react';
import DateCarousel from './ui/DateCarousel';
import TimeSlotGrid from './ui/TimeSlotGrid';
import { useBookingStore } from '../../stores/bookingStore';

interface TrackingData {
  _id?: string;
  bookingNumber: string;
  service?: { name: string; _id?: string; duration?: number };
  scheduledDate: string;
  scheduledTime: string;
  provider?: { _id?: string; name: string };
  providerId?: string;
  duration?: number;
}

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: TrackingData;
  onConfirm: (newDate: string, newTime: string, reason: string) => Promise<void>;
  isLoading: boolean;
}

const RESCHEDULE_REASONS = [
  'Schedule conflict',
  'Emergency/Urgent matter',
  'Travel plans changed',
  'Health reasons',
  'Weather conditions',
  'Other'
];

const RescheduleModal: React.FC<RescheduleModalProps> = ({
  isOpen,
  onClose,
  booking,
  onConfirm,
  isLoading
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');

  const { getAvailableSlots, availableSlots, minBookingAdvanceHours } = useBookingStore();
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedDate('');
      setSelectedTime('');
      setSelectedReason('');
      setCustomReason('');
    }
  }, [isOpen]);

  // Fetch available slots when date changes
  useEffect(() => {
    const fetchSlots = async () => {
      if (!selectedDate) return;

      // Get provider ID from the booking object
      const providerId = booking.providerId || booking.provider?._id;

      if (!providerId) {
        console.error('No provider ID available for rescheduling');
        return;
      }

      setIsFetchingSlots(true);
      try {
        // Use duration from booking or default to 60 minutes
        const duration = booking.duration || booking.service?.duration || 60;

        await getAvailableSlots(providerId, {
          date: selectedDate,
          duration: duration,
          days: 1,
          serviceId: booking.service?._id,
        });
      } catch (err) {
        console.error('Failed to fetch slots:', err);
      } finally {
        setIsFetchingSlots(false);
      }
    };

    fetchSlots();
  }, [selectedDate, booking.providerId, booking.provider?._id, booking.duration, booking.service?.duration]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedDate || !selectedTime) return;
    const reason = selectedReason === 'Other' ? customReason : selectedReason;
    await onConfirm(selectedDate, selectedTime, reason || 'Rescheduled by customer');
  };

  // Transform available slots
  const timeSlots = availableSlots.map((slot) => ({
    time: slot.time,
    isAvailable: slot.isAvailable
  }));

  const isValid = selectedDate && selectedTime;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
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
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-nilin-charcoal">Reschedule Booking</h2>
            <p className="text-sm text-nilin-warmGray">#{booking.bookingNumber}</p>
          </div>
        </div>

        {/* Current Booking Info */}
        <div className="bg-nilin-cream rounded-xl p-4 mb-6">
          <p className="text-xs text-nilin-warmGray uppercase tracking-wide mb-1">Current Appointment</p>
          <p className="font-medium text-nilin-charcoal">{booking.service?.name || 'Service'}</p>
          <p className="text-sm text-nilin-warmGray mt-1">
            {new Date(booking.scheduledDate).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })} at {booking.scheduledTime}
          </p>
        </div>

        {/* New Date Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
            Select New Date
          </label>
          <DateCarousel
            selectedDate={selectedDate}
            onDateSelect={(date) => {
              setSelectedDate(date);
              setSelectedTime(''); // Reset time when date changes
            }}
            maxDays={30}
          />
        </div>

        {/* New Time Selection */}
        {selectedDate && (
          <div className="mb-6">
            <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
              Select New Time
            </label>
            {isFetchingSlots ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-nilin-coral animate-spin" />
              </div>
            ) : (
              <TimeSlotGrid
                slots={timeSlots}
                selectedTime={selectedTime}
                onTimeSelect={setSelectedTime}
                isLoading={false}
              />
            )}
          </div>
        )}

        {/* Reason Selection (optional) */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-nilin-charcoal mb-3">
            Reason for rescheduling (optional)
          </label>
          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none"
          >
            <option value="">Select a reason...</option>
            {RESCHEDULE_REASONS.map((reason) => (
              <option key={reason} value={reason}>{reason}</option>
            ))}
          </select>

          {selectedReason === 'Other' && (
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Please specify your reason..."
              className="mt-3 w-full px-4 py-3 rounded-xl border-2 border-nilin-border focus:border-nilin-coral focus:outline-none resize-none"
              rows={2}
            />
          )}
        </div>

        {/* New Time Summary */}
        {selectedDate && selectedTime && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-xs text-green-600 uppercase tracking-wide mb-1">New Appointment</p>
            <p className="font-medium text-green-800">
              {new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })} at {selectedTime}
            </p>
          </div>
        )}

        {/* Info */}
        <div className="flex items-start gap-2 text-xs text-nilin-warmGray mb-6">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Rescheduling is free up to 24 hours before your appointment.
            Late reschedules may incur a fee according to our policy.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-nilin-border rounded-xl font-medium text-nilin-charcoal hover:bg-nilin-cream transition-colors disabled:opacity-50"
          >
            Keep Original Time
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="flex-1 px-4 py-3 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Rescheduling...
              </>
            ) : (
              'Confirm Reschedule'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RescheduleModal;
