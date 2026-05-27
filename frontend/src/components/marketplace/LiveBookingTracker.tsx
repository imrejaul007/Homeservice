// Live Booking Tracker Component - Real-time booking status
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Clock, MapPin, Phone, Navigation, Loader2, X } from 'lucide-react';
import { useRealTimeStore } from '../../services/marketplace/RealTimeSync';

interface LiveBookingTrackerProps {
  bookingId: string;
  serviceName: string;
  initialStatus?: 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  initialProvider?: {
    name: string;
    avatar?: string;
    phone?: string;
  };
}

const statusSteps = [
  { id: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { id: 'assigned', label: 'Provider Assigned', icon: Clock },
  { id: 'in_progress', label: 'In Progress', icon: Navigation },
  { id: 'completed', label: 'Completed', icon: CheckCircle },
];

export function LiveBookingTracker({
  bookingId,
  serviceName,
  initialStatus = 'confirmed',
  initialProvider,
}: LiveBookingTrackerProps) {
  const [status, setStatus] = useState(initialStatus);
  const [provider, setProvider] = useState(initialProvider);
  const [eta, setEta] = useState<number | null>(null);

  const { liveBookings, isConnected } = useRealTimeStore();
  const liveUpdate = liveBookings[bookingId];

  // Apply live updates
  useEffect(() => {
    if (liveUpdate) {
      if (liveUpdate.status) setStatus(liveUpdate.status);
      if (liveUpdate.provider) setProvider(liveUpdate.provider);
      if (liveUpdate.provider?.eta) setEta(liveUpdate.provider.eta);
    }
  }, [liveUpdate]);

  // Simulate progress for demo
  useEffect(() => {
    const timers: number[] = [];

    if (status === 'confirmed') {
      timers.push(
        window.setTimeout(() => setStatus('assigned'), 3000)
      );
    }

    if (status === 'assigned') {
      setEta(15);
      timers.push(
        window.setTimeout(() => setStatus('in_progress'), 5000)
      );
    }

    if (status === 'in_progress') {
      const interval = window.setInterval(() => {
        setEta((prev) => {
          if (prev === null || prev <= 0) {
            clearInterval(interval);
            setStatus('completed');
            return null;
          }
          return prev - 1;
        });
      }, 1000);
      timers.push(interval);
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [status]);

  const currentStepIndex = statusSteps.findIndex((s) => s.id === status);
  const isCancelled = status === 'cancelled';
  const isCompleted = status === 'completed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl shadow-aaa-card overflow-hidden"
    >
      {/* Status header */}
      <div className={`px-6 py-4 ${
        isCompleted ? 'bg-green-500' : isCancelled ? 'bg-red-500' : 'bg-nilin-coral'
      } text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">{serviceName}</h3>
            <p className="text-sm opacity-80">
              {isCancelled ? 'Booking Cancelled' : isCompleted ? 'Service Completed' : `Booking ${status}`}
            </p>
          </div>

          {/* Live indicator */}
          {isConnected && !isCancelled && !isCompleted && (
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
              <span className="text-sm font-medium">Live</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress steps */}
      {!isCancelled && (
        <div className="px-6 py-6">
          <div className="flex items-center justify-between relative">
            {/* Progress line */}
            <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200">
              <motion.div
                className="h-full bg-nilin-coral"
                initial={{ width: '0%' }}
                animate={{ width: `${(currentStepIndex / (statusSteps.length - 1)) * 100}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Steps */}
            {statusSteps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const Icon = step.icon;

              return (
                <div key={step.id} className="relative flex flex-col items-center z-10">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isCurrent ? 1.2 : 1,
                      backgroundColor: isCompleted || isCurrent ? '#E8B4A8' : '#E5E7EB',
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </motion.div>
                  <span className={`mt-2 text-xs font-medium ${
                    isCurrent ? 'text-nilin-charcoal' : 'text-nilin-warmGray'
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Provider info */}
      {provider && !isCancelled && (
        <div className="px-6 pb-6">
          <div className="bg-gray-50 rounded-2xl p-4">
            <div className="flex items-center gap-4">
              <img
                src={provider.avatar || '/placeholder-provider.jpg'}
                alt={provider.name}
                className="w-14 h-14 rounded-xl object-cover"
              />
              <div className="flex-1">
                <h4 className="font-semibold text-nilin-charcoal">{provider.name}</h4>
                <p className="text-sm text-nilin-warmGray">Your service provider</p>
              </div>

              {/* ETA */}
              {eta !== null && eta > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-nilin-coral">{eta}</div>
                  <div className="text-xs text-nilin-warmGray">mins away</div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-nilin-coral text-white rounded-xl font-medium">
                <Phone className="w-4 h-4" />
                Call
              </button>
              <button className="flex-1 flex items-center justify-center gap-2 py-3 bg-nilin-blush text-nilin-charcoal rounded-xl font-medium">
                <MapPin className="w-4 h-4" />
                Track
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancelled state */}
      {isCancelled && (
        <div className="px-6 py-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-500" />
          </div>
          <h4 className="font-semibold text-nilin-charcoal mb-2">Booking Cancelled</h4>
          <p className="text-sm text-nilin-warmGray">
            Your booking has been cancelled. The amount will be refunded within 5-7 business days.
          </p>
          <button className="mt-4 px-6 py-3 bg-nilin-coral text-white rounded-xl font-medium">
            Book Again
          </button>
        </div>
      )}
    </motion.div>
  );
}

// Mini tracker for lists
export function LiveBookingMini({ status, eta }: { status: string; eta?: number | null }) {
  const statusConfig = {
    confirmed: { color: 'bg-blue-100 text-blue-600', label: 'Confirmed' },
    assigned: { color: 'bg-purple-100 text-purple-600', label: 'Assigned' },
    in_progress: { color: 'bg-orange-100 text-orange-600', label: 'In Progress' },
    completed: { color: 'bg-green-100 text-green-600', label: 'Completed' },
    cancelled: { color: 'bg-red-100 text-red-600', label: 'Cancelled' },
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.confirmed;

  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
      {eta != null && eta > 0 && (
        <span className="text-xs text-nilin-warmGray">{eta} min</span>
      )}
    </div>
  );
}
