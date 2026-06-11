import React, { useState } from 'react';
import {
  Phone,
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  X,
  User,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import authService from '../../services/AuthService';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type CallbackStatus = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_answer';
export type CallbackCategory = 'general' | 'technical' | 'billing' | 'booking' | 'complaint';

export interface CallbackRequest {
  requestId: string;
  phoneNumber: string;
  preferredTime: string;
  reason: string;
  category: CallbackCategory;
  status: CallbackStatus;
  assignedAgentName?: string;
  scheduledAt?: string;
  createdAt: string;
}

export interface CallbackRequestFormData {
  phoneNumber: string;
  preferredTime: Date;
  reason: string;
  category: CallbackCategory;
  alternateTime?: Date;
}

export interface CallbackRequestProps {
  className?: string;
  onSuccess?: (requestId: string) => void;
  onCancel?: () => void;
}

// ============================================
// API SERVICE
// ============================================

const callbackApi = {
  async createRequest(data: Omit<CallbackRequestFormData, 'preferredTime'> & { preferredTime: string; alternateTime?: string }): Promise<{ requestId: string }> {
    const response = await authService.post<{ success: boolean; data: { requestId: string } }>(
      '/support/callback',
      data
    );
    return response.data;
  },

  async getMyCallbacks(): Promise<CallbackRequest[]> {
    const response = await authService.get<{
      success: boolean;
      data: { requests: CallbackRequest[] } | CallbackRequest[];
    }>('/support/callback/my');
    const data = response.data;
    if (Array.isArray(data)) return data;
    return data?.requests || [];
  },
};

// ============================================
// CONSTANTS
// ============================================

const CATEGORIES: Array<{ value: CallbackCategory; label: string; icon: string }> = [
  { value: 'general', label: 'General Inquiry', icon: '💬' },
  { value: 'technical', label: 'Technical Support', icon: '⚙️' },
  { value: 'billing', label: 'Billing Question', icon: '💳' },
  { value: 'booking', label: 'Booking Issue', icon: '📅' },
  { value: 'complaint', label: 'File a Complaint', icon: '📝' },
];

// ============================================
// TIME SLOT GENERATOR
// ============================================

const generateTimeSlots = (date: Date): Array<{ value: Date; label: string; available: boolean }> => {
  const slots: Array<{ value: Date; label: string; available: boolean }> = [];
  const startHour = 9; // 9 AM
  const endHour = 18; // 6 PM
  const slotDuration = 30; // 30 minutes

  for (let hour = startHour; hour < endHour; hour++) {
    for (let minute = 0; minute < 60; minute += slotDuration) {
      const slotDate = new Date(date);
      slotDate.setHours(hour, minute, 0, 0);

      const isPast = slotDate <= new Date();
      const available = !isPast;

      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      const displayMinute = minute.toString().padStart(2, '0');

      slots.push({
        value: slotDate,
        label: `${displayHour}:${displayMinute} ${period}`,
        available,
      });
    }
  }

  return slots;
};

// ============================================
// SUCCESS VIEW COMPONENT
// ============================================

const SuccessView: React.FC<{
  requestId: string;
  scheduledTime: Date;
  onDone: () => void;
}> = ({ requestId, scheduledTime, onDone }) => {
  const formattedDate = scheduledTime.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = scheduledTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="text-center py-6">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle className="h-8 w-8 text-green-600" />
      </div>
      <h3 className="text-xl font-semibold text-nilin-charcoal mb-2">
        Callback Scheduled!
      </h3>
      <p className="text-gray-500 mb-4">
        We'll call you at your scheduled time.
      </p>

      <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
        <div className="flex items-center gap-3 mb-3">
          <Calendar className="h-5 w-5 text-nilin-coral" />
          <div>
            <p className="text-sm text-gray-500">Scheduled For</p>
            <p className="font-medium text-nilin-charcoal">{formattedDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <Clock className="h-5 w-5 text-nilin-coral" />
          <div>
            <p className="text-sm text-gray-500">Time</p>
            <p className="font-medium text-nilin-charcoal">{formattedTime}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Phone className="h-5 w-5 text-nilin-coral" />
          <div>
            <p className="text-sm text-gray-500">Request ID</p>
            <p className="font-mono text-sm text-nilin-charcoal">{requestId}</p>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        Our representative will call you shortly after the scheduled time. Please ensure your phone is available.
      </p>

      <button
        onClick={onDone}
        className="w-full py-3 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-coral/90 transition-colors"
      >
        Done
      </button>
    </div>
  );
};

// ============================================
// MAIN CALLBACK REQUEST COMPONENT
// ============================================

export const CallbackRequest: React.FC<CallbackRequestProps> = ({
  className,
  onSuccess,
  onCancel,
}) => {
  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [category, setCategory] = useState<CallbackCategory>('general');
  const [reason, setReason] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [step, setStep] = useState<'form' | 'time'>('form');

  // Generate time slots for selected date
  const timeSlots = generateTimeSlots(selectedDate);

  // Validation
  const isPhoneValid = /^[+]?[\d\s\-()]{8,20}$/.test(phoneNumber);
  const isReasonValid = reason.trim().length >= 10;
  const isFormValid = isPhoneValid && isReasonValid;

  // Handle date change
  const handleDateChange = (days: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
    setSelectedTime(null);
  };

  // Handle time selection
  const handleTimeSelect = (time: Date) => {
    setSelectedTime(time);
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid || !selectedTime || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await callbackApi.createRequest({
        phoneNumber,
        reason,
        category,
        preferredTime: selectedTime.toISOString(),
      });

      setRequestId(response.requestId);
      setSuccess(true);
      onSuccess?.(response.requestId);
    } catch (err) {
      console.error('Failed to create callback request:', err);
      setError(err instanceof Error ? err.message : 'Failed to schedule callback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (success && selectedTime) {
    return (
      <div className={cn('p-6 bg-white rounded-2xl border border-gray-200', className)}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-nilin-charcoal">Request Callback</h2>
          {onCancel && (
            <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          )}
        </div>
        <SuccessView
          requestId={requestId}
          scheduledTime={selectedTime}
          onDone={onCancel || (() => setSuccess(false))}
        />
      </div>
    );
  }

  return (
    <div className={cn('p-6 bg-white rounded-2xl border border-gray-200', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-nilin-charcoal">Request Callback</h2>
        {onCancel && (
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Phone Number */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Phone Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+971 50 123 4567"
              className={cn(
                'w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30',
                !isPhoneValid && phoneNumber ? 'border-red-300 bg-red-50' : 'border-gray-200'
              )}
            />
          </div>
          {phoneNumber && !isPhoneValid && (
            <p className="text-xs text-red-500 mt-1">Please enter a valid phone number</p>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Category <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={cn(
                  'p-3 rounded-xl border text-center transition-all',
                  category === cat.value
                    ? 'border-nilin-coral bg-nilin-coral/10'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <span className="text-xl mb-1 block">{cat.icon}</span>
                <span className={cn(
                  'text-xs font-medium',
                  category === cat.value ? 'text-nilin-coral' : 'text-gray-600'
                )}>
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Reason for Callback <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Briefly describe what you need help with..."
            rows={3}
            className={cn(
              'w-full px-4 py-3 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30',
              !isReasonValid && reason ? 'border-red-300 bg-red-50' : 'border-gray-200'
            )}
          />
          <p className="text-xs text-gray-400 mt-1">
            {reason.length}/10 minimum characters
          </p>
        </div>

        {/* Time Selection */}
        <div>
          <label className="block text-sm font-medium text-nilin-charcoal mb-2">
            Preferred Time <span className="text-red-500">*</span>
          </label>

          {/* Date Selection */}
          <div className="flex gap-2 mb-3">
            {[1, 2, 3].map((days) => {
              const date = new Date();
              date.setDate(date.getDate() + days);
              const isSelected = selectedDate.toDateString() === date.toDateString();

              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => handleDateChange(days)}
                  className={cn(
                    'flex-1 p-3 rounded-xl border text-center transition-all',
                    isSelected
                      ? 'border-nilin-coral bg-nilin-coral/10'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <p className={cn(
                    'text-xs',
                    isSelected ? 'text-nilin-coral' : 'text-gray-500'
                  )}>
                    {days === 1 ? 'Tomorrow' : date.toLocaleDateString('en-US', { weekday: 'short' })}
                  </p>
                  <p className={cn(
                    'font-semibold',
                    isSelected ? 'text-nilin-coral' : 'text-gray-900'
                  )}>
                    {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Time Slots */}
          <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            {timeSlots.map((slot, index) => (
              <button
                key={index}
                type="button"
                onClick={() => slot.available && handleTimeSelect(slot.value)}
                disabled={!slot.available}
                className={cn(
                  'p-2 rounded-lg border text-center text-sm transition-all',
                  selectedTime?.toISOString() === slot.value.toISOString()
                    ? 'border-nilin-coral bg-nilin-coral text-white'
                    : slot.available
                    ? 'border-gray-200 hover:border-nilin-coral/50'
                    : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                )}
              >
                {slot.label}
              </button>
            ))}
          </div>

          {!selectedTime && (
            <p className="text-xs text-gray-400 mt-2">Select an available time slot</p>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!isFormValid || !selectedTime || submitting}
            className={cn(
              'flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
              isFormValid && selectedTime && !submitting
                ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white hover:shadow-lg'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Phone className="h-5 w-5" />
                Schedule Callback
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CallbackRequest;
