import React, { useState, useCallback, useEffect } from 'react';
import { Calendar, Clock, RefreshCw, DollarSign, AlertCircle, CheckCircle, CreditCard, Loader2 } from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { Skeleton } from '../common/Skeleton';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { useAuthStore } from '../../stores/authStore';
import { api } from '../../services/api';

// =============================================================================
// NILIN Customer Dashboard - Recurring Booking Setup Component
// Subscription/recurring booking configuration
// =============================================================================

// =============================================================================
// Types
// =============================================================================

export interface RecurringBookingSetupProps {
  /** Service to create recurring booking for */
  serviceId?: string;
  /** Provider ID */
  providerId?: string;
  /** Service details */
  service?: {
    name: string;
    price: number;
    duration: number;
    category: string;
  };
  /** Callback when subscription is created */
  onSubscriptionCreated?: (subscription: RecurringSubscription) => void;
  /** Callback on cancellation */
  onSubscriptionCancelled?: (subscriptionId: string) => void;
  /** Additional CSS classes */
  className?: string;
}

export interface RecurringSubscription {
  id: string;
  serviceId: string;
  providerId: string;
  serviceName: string;
  providerName: string;
  frequency: RecurringFrequency;
  interval: number;
  startDate: Date;
  nextRun: Date;
  endDate?: Date;
  status: 'active' | 'paused' | 'cancelled';
  price: number;
  paymentMethod: {
    type: string;
    last4?: string;
  };
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  discount: number;
  createdAt: Date;
}

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

interface FrequencyOption {
  value: RecurringFrequency;
  label: string;
  description: string;
  discount: number;
}

const FREQUENCY_OPTIONS: FrequencyOption[] = [
  { value: 'weekly', label: 'Weekly', description: 'Every week', discount: 5 },
  { value: 'biweekly', label: 'Bi-weekly', description: 'Every 2 weeks', discount: 10 },
  { value: 'monthly', label: 'Monthly', description: 'Every month', discount: 15 },
  { value: 'quarterly', label: 'Quarterly', description: 'Every 3 months', discount: 20 },
];

// =============================================================================
// Setup Form Component
// =============================================================================

interface SetupFormProps {
  service?: RecurringBookingSetupProps['service'];
  onSubmit: (data: RecurringBookingData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

interface RecurringBookingData {
  frequency: RecurringFrequency;
  interval: number;
  startDate: string;
  preferredTime: string;
  addressId?: string;
  paymentMethodId?: string;
  notes?: string;
}

const SetupForm: React.FC<SetupFormProps> = ({
  service,
  onSubmit,
  onCancel,
  isSubmitting,
}) => {
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [interval, setInterval] = useState(1);
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [notes, setNotes] = useState('');

  const currentFrequency = FREQUENCY_OPTIONS.find(f => f.value === frequency);

  const calculateTotal = useCallback(() => {
    if (!service) return 0;
    const discount = currentFrequency?.discount || 0;
    return service.price * (1 - discount / 100);
  }, [service, currentFrequency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      frequency,
      interval,
      startDate,
      preferredTime,
      notes,
    });
  };

  // Generate available dates (next 30 days, excluding past dates)
  const availableDates = React.useMemo(() => {
    const dates = [];
    const today = new Date();

    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      // Skip weekends if needed
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dates.push({
          value: date.toISOString().split('T')[0],
          label: date.toLocaleDateString('en-AE', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }),
        });
      }
    }

    return dates;
  }, []);

  // Time slots
  const timeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00',
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Service Summary */}
      {service && (
        <div className="bg-nilin-blush/20 rounded-xl p-4">
          <div className="flex justify-between items-start">
            <div>
              <h4 className="font-semibold text-nilin-charcoal">{service.name}</h4>
              <p className="text-sm text-nilin-warmGray">{service.category}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-nilin-warmGray line-through">
                {formatPrice(service.price)}
              </p>
              <p className="font-bold text-nilin-coral">
                {formatPrice(calculateTotal())}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Frequency Selection */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-3">
          How often do you need this service?
        </label>
        <div className="grid grid-cols-2 gap-3">
          {FREQUENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFrequency(option.value)}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all',
                frequency === option.value
                  ? 'border-nilin-coral bg-nilin-coral/5'
                  : 'border-nilin-blush/30 hover:border-nilin-coral/30'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-nilin-charcoal">
                  {option.label}
                </span>
                <Badge variant="success" size="sm">
                  {option.discount}% off
                </Badge>
              </div>
              <p className="text-xs text-nilin-warmGray">{option.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Start Date */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-2">
          When should it start?
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {availableDates.slice(0, 10).map((date) => (
            <button
              key={date.value}
              type="button"
              onClick={() => setStartDate(date.value)}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-xl border-2 text-sm font-medium transition-all',
                startDate === date.value
                  ? 'border-nilin-coral bg-nilin-coral/5 text-nilin-coral'
                  : 'border-nilin-blush/30 text-nilin-charcoal hover:border-nilin-coral/30'
              )}
            >
              {date.label}
            </button>
          ))}
        </div>
      </div>

      {/* Preferred Time */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-2">
          Preferred time
        </label>
        <div className="flex flex-wrap gap-2">
          {timeSlots.map((time) => (
            <button
              key={time}
              type="button"
              onClick={() => setPreferredTime(time)}
              className={cn(
                'px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                preferredTime === time
                  ? 'border-nilin-coral bg-nilin-coral/5 text-nilin-coral'
                  : 'border-nilin-blush/30 text-nilin-charcoal hover:border-nilin-coral/30'
              )}
            >
              {time}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-nilin-charcoal mb-2">
          Special instructions (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any special requirements or preferences..."
          className={cn(
            'w-full px-4 py-3 rounded-xl border-2 border-nilin-blush/30',
            'focus:border-nilin-coral focus:ring-0 focus:outline-none',
            'text-nilin-charcoal placeholder:text-nilin-warmGray/50',
            'resize-none h-24'
          )}
        />
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-nilin-coral/10 to-rose-50/50 rounded-xl p-4">
        <h4 className="font-semibold text-nilin-charcoal mb-3 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Subscription Summary
        </h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-nilin-warmGray">Frequency</span>
            <span className="font-medium text-nilin-charcoal capitalize">
              {currentFrequency?.label}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-nilin-warmGray">Starting</span>
            <span className="font-medium text-nilin-charcoal">
              {new Date(startDate).toLocaleDateString('en-AE', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-nilin-warmGray">Preferred time</span>
            <span className="font-medium text-nilin-charcoal">{preferredTime}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-nilin-warmGray">Discount</span>
            <span className="font-medium text-green-600">
              {currentFrequency?.discount}% savings
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-nilin-blush/30">
            <span className="font-semibold text-nilin-charcoal">Per booking</span>
            <span className="font-bold text-nilin-coral text-lg">
              {formatPrice(calculateTotal())}
            </span>
          </div>
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
          leftIcon={<CheckCircle className="h-4 w-4" />}
        >
          Create Subscription
        </Button>
      </div>
    </form>
  );
};

// =============================================================================
// Subscription Card Component
// =============================================================================

interface SubscriptionCardProps {
  subscription: RecurringSubscription;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  onModify?: () => void;
}

const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  onPause,
  onResume,
  onCancel,
  onModify,
}) => {
  const getNextRunDate = (): string => {
    return subscription.nextRun.toLocaleDateString('en-AE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-nilin-blush/30 overflow-hidden hover:shadow-md transition-all">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-nilin-coral/10 to-rose-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm">
              <RefreshCw className="h-5 w-5 text-nilin-coral" />
            </div>
            <div>
              <h4 className="font-semibold text-nilin-charcoal">
                {subscription.serviceName}
              </h4>
              <p className="text-xs text-nilin-warmGray">
                {subscription.providerName}
              </p>
            </div>
          </div>

          <Badge
            variant={subscription.status === 'active' ? 'success' : 'warning'}
            size="sm"
          >
            {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
          </Badge>
        </div>
      </div>

      {/* Details */}
      <div className="p-4 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-nilin-warmGray">Frequency</span>
          <span className="font-medium text-nilin-charcoal capitalize">
            {subscription.frequency}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-nilin-warmGray">Next booking</span>
          <span className="font-medium text-nilin-charcoal">
            {getNextRunDate()} at{' '}
            {subscription.nextRun.toLocaleTimeString('en-AE', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-nilin-warmGray">Price per booking</span>
          <span className="font-bold text-nilin-coral">
            {formatPrice(subscription.price)}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-nilin-warmGray">Payment</span>
          <span className="font-medium text-nilin-charcoal flex items-center gap-1">
            <CreditCard className="h-3 w-3" />
            {subscription.paymentMethod.type}
            {subscription.paymentMethod.last4 && ` •••• ${subscription.paymentMethod.last4}`}
          </span>
        </div>
      </div>

      {/* Actions */}
      {subscription.status === 'active' && (
        <div className="px-4 pb-4 flex gap-2">
          <Button variant="ghost" size="sm" onClick={onPause}>
            Pause
          </Button>
          <Button variant="ghost" size="sm" onClick={onModify}>
            Modify
          </Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}

      {subscription.status === 'paused' && (
        <div className="px-4 pb-4 flex gap-2">
          <Button variant="primary" size="sm" onClick={onResume}>
            Resume
          </Button>
          <Button variant="ghost" size="sm" className="text-red-500" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const RecurringBookingSetup: React.FC<RecurringBookingSetupProps> = ({
  serviceId,
  providerId,
  service,
  onSubscriptionCreated,
  onSubscriptionCancelled,
  className,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);

  const customerProfile = useAuthStore((state) => state.customerProfile);

  // Load subscriptions from API
  const [subscriptions, setSubscriptions] = useState<RecurringSubscription[]>([]);

  useEffect(() => {
    const loadSubscriptions = async () => {
      setIsLoading(true);
      try {
        const response = await api.get('/customer/subscriptions');
        if (response.data?.success) {
          setSubscriptions(response.data.data?.subscriptions || []);
        }
      } catch (err) {
        console.error('Failed to load subscriptions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscriptions();
  }, []);

  const handleSubmit = async (data: RecurringBookingData) => {
    if (!service) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await api.post('/customer/subscriptions', {
        serviceId,
        providerId,
        frequency: data.frequency,
        interval: data.interval,
        startDate: data.startDate,
        preferredTime: data.preferredTime,
        notes: data.notes,
        addressId: data.addressId,
        paymentMethodId: data.paymentMethodId,
      });

      if (response.data?.success) {
        const newSubscription: RecurringSubscription = {
          ...response.data.data,
          serviceName: service.name,
          providerName: 'Service Provider',
        };

        setSubscriptions((prev) => [...prev, newSubscription]);
        onSubscriptionCreated?.(newSubscription);
        setShowSetup(false);
      } else {
        throw new Error(response.data?.message || 'Failed to create subscription');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePause = useCallback((subscriptionId: string) => {
    setSubscriptions((prev) =>
      prev.map((sub) =>
        sub.id === subscriptionId ? { ...sub, status: 'paused' as const } : sub
      )
    );
  }, []);

  const handleResume = useCallback((subscriptionId: string) => {
    setSubscriptions((prev) =>
      prev.map((sub) =>
        sub.id === subscriptionId ? { ...sub, status: 'active' as const } : sub
      )
    );
  }, []);

  const handleCancel = useCallback((subscriptionId: string) => {
    setSubscriptions((prev) =>
      prev.filter((sub) => sub.id !== subscriptionId)
    );
    onSubscriptionCancelled?.(subscriptionId);
  }, [onSubscriptionCancelled]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100">
            <RefreshCw className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-nilin-charcoal">
              Recurring Bookings
            </h2>
            <p className="text-sm text-nilin-warmGray">
              Save with regular service subscriptions
            </p>
          </div>
        </div>

        {service && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Calendar className="h-4 w-4" />}
            onClick={() => setShowSetup(true)}
          >
            New Subscription
          </Button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Subscriptions List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse bg-white rounded-2xl border border-nilin-blush/30 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-nilin-blush/30 rounded-xl" />
                <div className="flex-1">
                  <div className="h-5 bg-nilin-blush/30 rounded w-1/3 mb-2" />
                  <div className="h-4 bg-nilin-blush/30 rounded w-1/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : subscriptions.length > 0 ? (
        <div className="grid gap-4">
          {subscriptions.map((subscription) => (
            <SubscriptionCard
              key={subscription.id}
              subscription={subscription}
              onPause={() => handlePause(subscription.id)}
              onResume={() => handleResume(subscription.id)}
              onCancel={() => handleCancel(subscription.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-nilin-blush/20 rounded-2xl p-8 text-center">
          <RefreshCw className="h-12 w-12 text-nilin-coral/40 mx-auto mb-3" />
          <h3 className="font-semibold text-nilin-charcoal mb-2">
            No recurring bookings yet
          </h3>
          <p className="text-sm text-nilin-warmGray mb-4">
            Set up a subscription to save up to 20% on regular services.
          </p>
          {service && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowSetup(true)}
            >
              Create Subscription
            </Button>
          )}
        </div>
      )}

      {/* Setup Modal */}
      <Modal
        open={showSetup}
        onOpenChange={setShowSetup}
        title="Create Subscription"
        description="Set up a recurring booking and save on every service"
        size="md"
      >
        <SetupForm
          service={service}
          onSubmit={handleSubmit}
          onCancel={() => setShowSetup(false)}
          isSubmitting={isSubmitting}
        />
      </Modal>
    </div>
  );
};

// =============================================================================
// Exports
// =============================================================================

export default RecurringBookingSetup;
