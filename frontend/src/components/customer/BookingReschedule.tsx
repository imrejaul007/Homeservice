import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, Clock, AlertCircle, CheckCircle, Loader2, RefreshCw, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

// =============================================================================
// NILIN Customer Dashboard - Booking Reschedule Component
// Booking reschedule modal functionality
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface BookingRescheduleProps {
  /** Booking to reschedule */
  booking: {
    id: string;
    serviceName: string;
    providerName: string;
    currentDate: Date;
    currentTime: string;
    duration: number;
  };
  /** Whether modal is open */
  open: boolean;
  /** Callback when reschedule is confirmed */
  onReschedule: (newDate: Date, newTime: string, reason?: string) => Promise<void>;
  /** Callback when modal state changes */
  onOpenChange: (open: boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

interface RescheduleData {
  date: string;
  time: string;
  reason?: string;
}

// =============================================================================
// Reschedule Form
// =============================================================================

interface RescheduleFormProps {
  booking: BookingRescheduleProps['booking'];
  onSubmit: (data: RescheduleData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const RescheduleForm: React.FC<RescheduleFormProps> = ({
  booking,
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  // Set initial date to current booking date
  const [selectedDate, setSelectedDate] = useState(() => {
    const date = new Date(booking.currentDate);
    date.setDate(date.getDate() + 1); // Minimum is tomorrow
    return date.toISOString().split('T')[0];
  });
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Generate available dates (next 30 days)
  const availableDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      // Skip weekends
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push({
          value: date.toISOString().split('T')[0],
          date: date,
          label: date.toLocaleDateString('en-AE', { weekday: 'short', day: 'numeric', month: 'short' }),
          dayName: date.toLocaleDateString('en-AE', { weekday: 'long' }),
        });
      }
    }

    return dates;
  }, []);

  // Time slots
  const timeSlots = [
    '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
    '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  ];

  // Common reasons
  const commonReasons = [
    'Schedule conflict',
    'Emergency situation',
    'Travel plans',
    'Illness',
    'Family commitment',
    'Work commitment',
    'Other',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedDate || !selectedTime) {
      setError('Please select a date and time');
      return;
    }

    try {
      await onSubmit({
        date: selectedDate,
        time: selectedTime,
        reason: reason || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reschedule booking');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Current Booking Info */}
      <div className="bg-nilin-blush/20 rounded-xl p-4">
        <p className="text-xs text-nilin-warmGray uppercase tracking-wider mb-2">
          Current Booking
        </p>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="font-semibold text-nilin-charcoal">{booking.serviceName}</p>
            <p className="text-sm text-nilin-warmGray">{booking.providerName}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-nilin-charcoal">
              {booking.currentDate.toLocaleDateString('en-AE', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </p>
            <p className="text-sm text-nilin-warmGray">{booking.currentTime}</p>
          </div>
        </div>
      </div>

      {/* New Date Selection */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-3">
          Select New Date
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {availableDates.slice(0, 12).map((date) => (
            <button
              key={date.value}
              type="button"
              onClick={() => setSelectedDate(date.value)}
              className={cn(
                'p-3 rounded-xl border-2 text-center transition-all',
                selectedDate === date.value
                  ? 'border-nilin-coral bg-nilin-coral/5'
                  : 'border-nilin-blush/30 hover:border-nilin-coral/30'
              )}
            >
              <p className="text-xs text-nilin-warmGray">{date.dayName}</p>
              <p className="font-semibold text-nilin-charcoal text-sm">
                {date.date.getDate()}
              </p>
              <p className="text-xs text-nilin-warmGray">
                {date.date.toLocaleDateString('en-AE', { month: 'short' })}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* New Time Selection */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-3">
          Select New Time
        </label>
        <div className="flex flex-wrap gap-2">
          {timeSlots.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => setSelectedTime(time)}
              className={cn(
                'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                selectedTime === time
                  ? 'border-nilin-coral bg-nilin-coral/5 text-nilin-coral'
                  : 'border-nilin-blush/30 text-nilin-charcoal hover:border-nilin-coral/30'
              )}
            >
              {time}
            </button>
          ))}
        </div>
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-2">
          Reason for rescheduling (optional)
        </label>
        <div className="flex flex-wrap gap-2 mb-3">
          {commonReasons.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                reason === r
                  ? 'bg-nilin-coral text-white'
                  : 'bg-nilin-blush/30 text-nilin-charcoal hover:bg-nilin-blush/50'
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Additional details (optional)"
          className={cn(
            'w-full px-4 py-3 rounded-xl border-2 border-nilin-blush/30',
            'focus:border-nilin-coral focus:ring-0 focus:outline-none',
            'text-nilin-charcoal placeholder:text-nilin-warmGray/50',
            'resize-none h-20'
          )}
        />
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-blue-700 font-medium">Rescheduling Policy</p>
          <p className="text-blue-600 mt-1">
            You can reschedule your booking up to 24 hours before the scheduled time without any fees.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Summary */}
      <div className="bg-gradient-to-r from-nilin-coral/10 to-rose-50/50 rounded-xl p-4">
        <p className="text-xs text-nilin-warmGray uppercase tracking-wider mb-2">
          New Booking Time
        </p>
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-nilin-coral" />
          <span className="font-semibold text-nilin-charcoal">
            {selectedDate
              ? new Date(selectedDate).toLocaleDateString('en-AE', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : 'Select a date'}
          </span>
          <span className="text-nilin-warmGray">at</span>
          <Clock className="h-5 w-5 text-nilin-coral" />
          <span className="font-semibold text-nilin-charcoal">{selectedTime}</span>
        </div>
      </div>

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
          leftIcon={<RefreshCw className="h-4 w-4" />}
        >
          Confirm Reschedule
        </Button>
      </div>
    </form>
  );
};

// =============================================================================
// Success State
// =============================================================================

interface RescheduleSuccessProps {
  booking: BookingRescheduleProps['booking'];
  newDate: Date;
  newTime: string;
  onClose: () => void;
}

const RescheduleSuccess: React.FC<RescheduleSuccessProps> = ({
  booking,
  newDate,
  newTime,
  onClose,
}) => {
  return (
    <div className="text-center py-6">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
        <CheckCircle className="h-8 w-8 text-green-600" />
      </div>

      <h3 className="text-xl font-bold text-nilin-charcoal mb-2">
        Booking Rescheduled
      </h3>

      <p className="text-nilin-warmGray mb-6">
        Your booking has been successfully rescheduled.
      </p>

      <div className="bg-nilin-blush/20 rounded-xl p-4 mb-6">
        <p className="text-sm font-medium text-nilin-charcoal">{booking.serviceName}</p>
        <p className="text-xs text-nilin-warmGray">{booking.providerName}</p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <Calendar className="h-4 w-4 text-nilin-coral" />
          <span className="text-sm font-medium text-nilin-charcoal">
            {newDate.toLocaleDateString('en-AE', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
          <Clock className="h-4 w-4 text-nilin-coral" />
          <span className="text-sm font-medium text-nilin-charcoal">{newTime}</span>
        </div>
      </div>

      <p className="text-xs text-nilin-warmGray mb-6">
        A confirmation has been sent to your email and the provider has been notified.
      </p>

      <Button variant="primary" onClick={onClose}>
        Done
      </Button>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const BookingReschedule: React.FC<BookingRescheduleProps> = ({
  booking,
  open,
  onReschedule,
  onOpenChange,
  className,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{ date: Date; time: string } | null>(null);

  const handleSubmit = useCallback(async (data: RescheduleData) => {
    setIsSubmitting(true);

    try {
      const newDate = new Date(`${data.date}T${data.time}`);
      await onReschedule(newDate, data.time, data.reason);
      setSuccessData({ date: newDate, time: data.time });
    } finally {
      setIsSubmitting(false);
    }
  }, [onReschedule]);

  const handleClose = useCallback(() => {
    setSuccessData(null);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title={successData ? 'Reschedule Complete' : 'Reschedule Booking'}
      description={
        successData
          ? undefined
          : 'Choose a new date and time for your booking'
      }
      size="md"
    >
      {successData ? (
        <RescheduleSuccess
          booking={booking}
          newDate={successData.date}
          newTime={successData.time}
          onClose={handleClose}
        />
      ) : (
        <RescheduleForm
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

export default BookingReschedule;
