import React, { useState, useCallback, useMemo } from 'react';
import { AlertCircle, Zap, MapPin, Clock, Shield, Loader2, CheckCircle, Phone, MessageSquare, Star } from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { useLocationStore } from '../../stores/locationStore';

// =============================================================================
// NILIN Customer Dashboard - Emergency Booking Component
// Emergency/urgent booking functionality
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface EmergencyBookingProps {
  /** Whether modal is open */
  open: boolean;
  /** Callback when emergency booking is created */
  onSubmit: (data: EmergencyBookingData) => Promise<void>;
  /** Callback when modal state changes */
  onOpenChange: (open: boolean) => void;
  /** Additional CSS classes */
  className?: string;
}

export interface EmergencyBookingData {
  serviceCategory: string;
  serviceId?: string;
  providerId?: string;
  address: string;
  description: string;
  urgencyLevel: 'high' | 'urgent' | 'critical';
  preferredContact: 'call' | 'sms' | 'both';
  callbackNumber: string;
  scheduledTime: string;
}

interface EmergencyService {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  urgencyFee: number;
  estimatedTime: string;
  available: boolean;
}

interface EmergencyProvider {
  id: string;
  name: string;
  rating: number;
  distance: string;
  responseTime: string;
  avatar?: string;
  isAvailable: boolean;
}

// =============================================================================
// Emergency Categories
// =============================================================================

const EMERGENCY_CATEGORIES: Array<{
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
}> = [
  {
    id: 'plumbing',
    name: 'Plumbing Emergency',
    icon: <span className="text-2xl">🔧</span>,
    description: 'Burst pipes, severe leaks, no water',
  },
  {
    id: 'electrical',
    name: 'Electrical Emergency',
    icon: <span className="text-2xl">⚡</span>,
    description: 'Power outage, exposed wires, sparks',
  },
  {
    id: 'ac',
    name: 'AC Emergency',
    icon: <span className="text-2xl">❄️</span>,
    description: 'AC not working, refrigerant leak',
  },
  {
    id: 'locksmith',
    name: 'Lockout',
    icon: <span className="text-2xl">🔐</span>,
    description: 'Locked out, broken lock',
  },
  {
    id: 'pest',
    name: 'Pest Control',
    icon: <span className="text-2xl">🐜</span>,
    description: 'Urgent pest problem',
  },
  {
    id: 'cleaning',
    name: 'Deep Cleaning',
    icon: <span className="text-2xl">🧹</span>,
    description: 'Post-event, urgent cleaning needed',
  },
];

// =============================================================================
// Emergency Booking Form
// =============================================================================

interface EmergencyBookingFormProps {
  onSubmit: (data: EmergencyBookingData) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const EmergencyBookingForm: React.FC<EmergencyBookingFormProps> = ({
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const [step, setStep] = useState(1);
  const [serviceCategory, setServiceCategory] = useState('');
  const [urgencyLevel, setUrgencyLevel] = useState<EmergencyBookingData['urgencyLevel']>('urgent');
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [callbackNumber, setCallbackNumber] = useState('');
  const [preferredContact, setPreferredContact] = useState<EmergencyBookingData['preferredContact']>('call');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLocation = useLocationStore((state) => state.currentLocation);

  // Urgency levels
  const urgencyLevels: Array<{
    value: EmergencyBookingData['urgencyLevel'];
    label: string;
    description: string;
    fee: number;
    color: string;
  }> = [
    {
      value: 'high',
      label: 'High Priority',
      description: 'Within 2 hours',
      fee: 25,
      color: 'text-amber-600 bg-amber-50 border-amber-200',
    },
    {
      value: 'urgent',
      label: 'Urgent',
      description: 'Within 1 hour',
      fee: 50,
      color: 'text-orange-600 bg-orange-50 border-orange-200',
    },
    {
      value: 'critical',
      label: 'Critical',
      description: 'Immediate response',
      fee: 100,
      color: 'text-red-600 bg-red-50 border-red-200',
    },
  ];

  // Contact preferences
  const contactOptions: Array<{
    value: EmergencyBookingData['preferredContact'];
    label: string;
    icon: React.ReactNode;
  }> = [
    { value: 'call', label: 'Call', icon: <Phone className="h-4 w-4" /> },
    { value: 'sms', label: 'SMS', icon: <MessageSquare className="h-4 w-4" /> },
    { value: 'both', label: 'Both', icon: <Phone className="h-4 w-4" /> },
  ];

  const selectedCategory = EMERGENCY_CATEGORIES.find(c => c.id === serviceCategory);
  const selectedUrgency = urgencyLevels.find(u => u.value === urgencyLevel);

  const canProceedToStep2 = serviceCategory && address && callbackNumber;
  const canSubmit = canProceedToStep2 && agreedToTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError('Please complete all required fields');
      return;
    }

    try {
      await onSubmit({
        serviceCategory,
        address,
        description,
        urgencyLevel,
        preferredContact,
        callbackNumber,
        scheduledTime: new Date().toISOString(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit emergency booking');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-4">
        {[1, 2].map((s) => (
          <React.Fragment key={s}>
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
              step >= s
                ? 'bg-nilin-coral text-white'
                : 'bg-nilin-blush/30 text-nilin-warmGray'
            )}>
              {step > s ? <CheckCircle className="h-4 w-4" /> : s}
            </div>
            {s < 2 && (
              <div className={cn(
                'flex-1 h-0.5 rounded',
                step > s ? 'bg-nilin-coral' : 'bg-nilin-blush/30'
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <>
          {/* Emergency Warning */}
          <div className="bg-red-50 rounded-xl p-4 border border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <span className="font-semibold text-red-700">Emergency Service</span>
            </div>
            <p className="text-sm text-red-600">
              Emergency bookings have higher service fees due to immediate response times.
              A representative will contact you within minutes to confirm your booking.
            </p>
          </div>

          {/* Category Selection */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-3">
              What type of emergency do you have?
            </label>
            <div className="grid grid-cols-2 gap-3">
              {EMERGENCY_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setServiceCategory(category.id)}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    serviceCategory === category.id
                      ? 'border-nilin-coral bg-nilin-coral/5'
                      : 'border-nilin-blush/30 hover:border-nilin-coral/30'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <p className={cn(
                        'font-medium text-sm',
                        serviceCategory === category.id ? 'text-nilin-coral' : 'text-nilin-charcoal'
                      )}>
                        {category.name}
                      </p>
                      <p className="text-xs text-nilin-warmGray mt-0.5">
                        {category.description}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Urgency Level */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-3">
              How urgent is your situation?
            </label>
            <div className="space-y-2">
              {urgencyLevels.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  onClick={() => setUrgencyLevel(level.value)}
                  className={cn(
                    'w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all',
                    urgencyLevel === level.value
                      ? `${level.color} border-current`
                      : 'border-nilin-blush/30 hover:border-nilin-coral/30'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                      urgencyLevel === level.value ? 'border-current bg-current' : 'border-gray-300'
                    )}>
                      {urgencyLevel === level.value && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-semibold">{level.label}</p>
                      <p className="text-sm opacity-75">{level.description}</p>
                    </div>
                  </div>
                  <span className="font-bold">+{formatPrice(level.fee)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Service Address *
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-nilin-warmGray" />
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your address"
                  className={cn(
                    'w-full pl-10 pr-4 py-3 rounded-xl border-2 border-nilin-blush/30',
                    'focus:border-nilin-coral focus:ring-0 focus:outline-none',
                    'text-nilin-charcoal placeholder:text-nilin-warmGray/50'
                  )}
                />
              </div>
              {currentLocation && (
                <button
                  type="button"
                  onClick={() => setAddress(currentLocation.address.formattedAddress || '')}
                  className="px-3 py-3 rounded-xl border-2 border-nilin-blush/30 text-nilin-coral hover:bg-nilin-coral/5 transition-colors"
                  title="Use current location"
                >
                  <MapPin className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Callback Number */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Callback Number *
            </label>
            <input
              type="tel"
              value={callbackNumber}
              onChange={(e) => setCallbackNumber(e.target.value)}
              placeholder="+971 XX XXX XXXX"
              className={cn(
                'w-full px-4 py-3 rounded-xl border-2 border-nilin-blush/30',
                'focus:border-nilin-coral focus:ring-0 focus:outline-none',
                'text-nilin-charcoal placeholder:text-nilin-warmGray/50'
              )}
            />
          </div>

          {/* Contact Preference */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Preferred contact method
            </label>
            <div className="flex gap-2">
              {contactOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPreferredContact(option.value)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 font-medium transition-all',
                    preferredContact === option.value
                      ? 'border-nilin-coral bg-nilin-coral/5 text-nilin-coral'
                      : 'border-nilin-blush/30 text-nilin-charcoal hover:border-nilin-coral/30'
                  )}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            variant="primary"
            fullWidth
            disabled={!canProceedToStep2}
            onClick={() => setStep(2)}
            leftIcon={<Zap className="h-4 w-4" />}
          >
            Continue
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          {/* Summary */}
          <div className="bg-nilin-blush/20 rounded-xl p-4">
            <h4 className="font-semibold text-nilin-charcoal mb-3">Booking Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-nilin-warmGray">Service</span>
                <span className="font-medium text-nilin-charcoal">
                  {selectedCategory?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-nilin-warmGray">Response Time</span>
                <span className="font-medium text-nilin-charcoal">
                  {selectedUrgency?.description}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-nilin-warmGray">Emergency Fee</span>
                <span className="font-bold text-nilin-coral">
                  +{formatPrice(selectedUrgency?.fee || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-nilin-warmGray">Address</span>
                <span className="font-medium text-nilin-charcoal max-w-[200px] truncate">
                  {address}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-nilin-charcoal mb-2">
              Describe the emergency (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the problem in detail..."
              className={cn(
                'w-full px-4 py-3 rounded-xl border-2 border-nilin-blush/30',
                'focus:border-nilin-coral focus:ring-0 focus:outline-none',
                'text-nilin-charcoal placeholder:text-nilin-warmGray/50',
                'resize-none h-24'
              )}
            />
          </div>

          {/* Terms */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl">
            <button
              type="button"
              onClick={() => setAgreedToTerms(!agreedToTerms)}
              className={cn(
                'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                agreedToTerms
                  ? 'border-nilin-coral bg-nilin-coral'
                  : 'border-gray-300'
              )}
            >
              {agreedToTerms && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
            <div className="text-sm">
              <p className="text-amber-800 font-medium">
                I understand the emergency service fees
              </p>
              <p className="text-amber-700 text-xs mt-1">
                Emergency bookings are non-refundable. A representative will confirm
                availability before processing.
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

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(1)}
              disabled={isSubmitting}
            >
              Back
            </Button>
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting}
              disabled={!canSubmit}
              leftIcon={<Zap className="h-4 w-4" />}
            >
              Submit Emergency Request
            </Button>
          </div>
        </>
      )}

      {/* Cancel */}
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        disabled={isSubmitting}
        className="w-full"
      >
        Cancel
      </Button>
    </form>
  );
};

// =============================================================================
// Success State
// =============================================================================

interface EmergencySuccessProps {
  onClose: () => void;
  estimatedTime?: string;
}

const EmergencySuccess: React.FC<EmergencySuccessProps> = ({
  onClose,
  estimatedTime = '30 minutes',
}) => {
  return (
    <div className="text-center py-6">
      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-nilin-coral to-rose-500 flex items-center justify-center shadow-lg">
        <Zap className="h-10 w-10 text-white" />
      </div>

      <h3 className="text-xl font-bold text-nilin-charcoal mb-2">
        Emergency Request Received!
      </h3>

      <p className="text-nilin-warmGray mb-6">
        A representative will contact you within minutes to confirm provider availability.
      </p>

      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Clock className="h-5 w-5 text-amber-600" />
          <span className="text-lg font-bold text-amber-700">
            Estimated Response
          </span>
        </div>
        <p className="text-2xl font-bold text-amber-600">{estimatedTime}</p>
      </div>

      <div className="flex items-start gap-3 p-4 bg-nilin-blush/20 rounded-xl mb-6 text-left">
        <Shield className="h-5 w-5 text-nilin-coral flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-nilin-charcoal">What's next?</p>
          <ul className="text-nilin-warmGray mt-2 space-y-1">
            <li>1. You'll receive a call within 5 minutes</li>
            <li>2. We'll match you with an available provider</li>
            <li>3. Provider will be at your location ASAP</li>
          </ul>
        </div>
      </div>

      <Button variant="primary" fullWidth onClick={onClose}>
        Done
      </Button>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const EmergencyBooking: React.FC<EmergencyBookingProps> = ({
  open,
  onSubmit,
  onOpenChange,
  className,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = useCallback(async (data: EmergencyBookingData) => {
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
      title={submitted ? 'Request Received' : 'Emergency Booking'}
      description={
        submitted
          ? undefined
          : 'Get immediate help for urgent service needs'
      }
      size="md"
    >
      {submitted ? (
        <EmergencySuccess onClose={handleClose} />
      ) : (
        <EmergencyBookingForm
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

export default EmergencyBooking;
