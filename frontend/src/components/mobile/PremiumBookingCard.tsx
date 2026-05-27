import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin, ChevronRight, Phone } from 'lucide-react';

interface PremiumBookingCardProps {
  booking: {
    id: string;
    serviceName: string;
    providerName: string;
    providerImage?: string;
    date: string;
    time: string;
    price: number;
    location?: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'inProgress';
    providerPhone?: string;
  };
  onTrack?: () => void;
  onReschedule?: () => void;
  onCancel?: () => void;
}

const statusConfig = {
  pending: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
    label: 'Pending',
  },
  confirmed: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    dot: 'bg-green-500',
    label: 'Confirmed',
  },
  completed: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
    label: 'Completed',
  },
  cancelled: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
    label: 'Cancelled',
  },
  inProgress: {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
    label: 'In Progress',
  },
};

export function PremiumBookingCard({
  booking,
  onTrack,
  onReschedule,
  onCancel,
}: PremiumBookingCardProps) {
  const status = statusConfig[booking.status];
  const showActions = booking.status === 'confirmed' || booking.status === 'pending';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={`bg-white rounded-2xl p-4 shadow-premium-sm border border-gray-50 ${status.border}`}
    >
      {/* Header with provider info */}
      <div className="flex items-start gap-3 mb-4">
        <img
          src={booking.providerImage || '/placeholder-provider.jpg'}
          alt={booking.providerName}
          className="w-12 h-12 rounded-xl object-cover"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-nilin-charcoal line-clamp-1">
              {booking.serviceName}
            </h4>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text} flex items-center gap-1.5 shrink-0`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
          <p className="text-sm text-nilin-warmGray mt-0.5">{booking.providerName}</p>
        </div>
      </div>

      {/* Divider */}
      <div className={`border-t ${status.border} my-3`} />

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-start gap-2">
          <Calendar size={16} className="text-nilin-warmGray mt-0.5 shrink-0" />
          <div>
            <span className="text-xs text-nilin-warmGray">Date</span>
            <p className="text-sm font-medium text-nilin-charcoal">{booking.date}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Clock size={16} className="text-nilin-warmGray mt-0.5 shrink-0" />
          <div>
            <span className="text-xs text-nilin-warmGray">Time</span>
            <p className="text-sm font-medium text-nilin-charcoal">{booking.time}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MapPin size={16} className="text-nilin-warmGray mt-0.5 shrink-0" />
          <div>
            <span className="text-xs text-nilin-warmGray">Location</span>
            <p className="text-sm font-medium text-nilin-charcoal truncate">{booking.location || 'Not specified'}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 rounded bg-nilin-coral/10 flex items-center justify-center mt-0.5 shrink-0">
            <span className="text-nilin-coral text-xs font-bold">₹</span>
          </div>
          <div>
            <span className="text-xs text-nilin-warmGray">Price</span>
            <p className="text-sm font-bold text-nilin-coral">₹{booking.price}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex gap-2 mt-4">
          {booking.status === 'confirmed' && onTrack && (
            <button
              onClick={onTrack}
              className="flex-1 py-2.5 bg-nilin-coral text-white rounded-xl font-medium text-sm flex items-center justify-center gap-1 active:scale-[0.98] transition-transform"
            >
              Track Order
              <ChevronRight size={16} />
            </button>
          )}
          {onReschedule && (
            <button
              onClick={onReschedule}
              className="flex-1 py-2.5 bg-nilin-blush text-nilin-charcoal rounded-xl font-medium text-sm"
            >
              Reschedule
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="py-2.5 px-4 text-red-500 text-sm font-medium"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* Completed actions */}
      {booking.status === 'completed' && (
        <div className="flex gap-2 mt-4">
          <button className="flex-1 py-2.5 bg-nilin-coral text-white rounded-xl font-medium text-sm">
            Leave Review
          </button>
          <button className="py-2.5 px-4 bg-nilin-blush rounded-xl">
            <Phone size={18} className="text-nilin-charcoal" />
          </button>
        </div>
      )}
    </motion.div>
  );
}

// Skeleton
export function PremiumBookingCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-premium-sm">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export default PremiumBookingCard;
