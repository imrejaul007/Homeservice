/**
 * QuickActions - One-click accept/decline buttons
 * Provider Dashboard Component
 */
import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import {
  Check,
  X,
  Clock,
  AlertCircle,
  Loader2,
  Calendar,
  MessageSquare,
  Phone,
  User,
  ChevronRight,
  Filter,
  Bell,
  BellOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// Type Definitions
// =============================================================================

export interface BookingRequest {
  /** Unique booking ID */
  id: string;
  /** Customer name */
  customerName: string;
  /** Customer avatar URL */
  customerAvatar?: string;
  /** Service name */
  serviceName: string;
  /** Booking date/time */
  scheduledDate: string;
  /** Service price */
  price: number;
  /** Currency code */
  currency?: string;
  /** Customer notes */
  notes?: string;
  /** Time remaining to respond (minutes) */
  timeRemaining?: number;
  /** Is instant booking */
  isInstantBook?: boolean;
  /** Customer phone */
  customerPhone?: string;
}

export interface QuickActionsProps {
  /** Booking requests to display */
  requests: BookingRequest[];
  /** Loading state */
  isLoading?: boolean;
  /** Maximum requests to show */
  maxVisible?: number;
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
  /** Callback when booking is accepted */
  onAccept: (bookingId: string) => Promise<void>;
  /** Callback when booking is declined */
  onDecline: (bookingId: string) => Promise<void>;
  /** Callback when viewing booking details */
  onViewDetails?: (booking: BookingRequest) => void;
  /** Callback when contacting customer */
  onContactCustomer?: (booking: BookingRequest, method: 'phone' | 'message') => void;
  /** Enable notification sounds */
  enableSounds?: boolean;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Individual Request Card
// =============================================================================

interface RequestCardProps {
  request: BookingRequest;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
  onViewDetails?: () => void;
  onContact?: (method: 'phone' | 'message') => void;
  soundEnabled?: boolean;
}

const RequestCard: React.FC<RequestCardProps> = ({
  request,
  onAccept,
  onDecline,
  onViewDetails,
  onContact,
  soundEnabled = true,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);
  const [showActions, setShowActions] = useState(true);

  const handleAccept = async () => {
    setIsAccepting(true);
    try {
      await onAccept();
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      await onDecline();
    } finally {
      setIsDeclining(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number, currency = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
    }).format(price);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className="bg-white rounded-xl border border-nilin-border shadow-nilin-sm overflow-hidden"
    >
      {/* Urgent Banner */}
      {request.timeRemaining !== undefined && request.timeRemaining < 30 && (
        <div className="bg-amber-50 px-4 py-2 flex items-center gap-2 border-b border-amber-100">
          <Clock className="w-4 h-4 text-amber-600" />
          <span className="text-xs text-amber-700 font-medium">
            Respond within {request.timeRemaining} minutes
          </span>
        </div>
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-nilin-coral/10 flex items-center justify-center overflow-hidden">
              {request.customerAvatar ? (
                <img
                  src={request.customerAvatar}
                  alt={request.customerName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-6 h-6 text-nilin-coral" />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-nilin-charcoal">
                {request.customerName}
              </h4>
              <p className="text-sm text-nilin-warmGray">{request.serviceName}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-nilin-charcoal">
              {formatPrice(request.price, request.currency)}
            </p>
            {request.isInstantBook && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                <Calendar className="w-3 h-3" />
                Instant
              </span>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="flex items-center gap-4 text-sm text-nilin-warmGray mb-3">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{formatTime(request.scheduledDate)}</span>
          </div>
        </div>

        {/* Notes */}
        {request.notes && (
          <div className="bg-nilin-blush rounded-lg p-3 mb-3">
            <p className="text-xs text-nilin-warmGray mb-1">Customer notes:</p>
            <p className="text-sm text-nilin-charcoal">{request.notes}</p>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-3">
            {/* Decline Button */}
            <button
              onClick={handleDecline}
              disabled={isDeclining || isAccepting}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 border-red-200 text-red-600',
                'hover:bg-red-50 transition-colors font-medium',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isDeclining ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <X className="w-4 h-4" />
                  <span>Decline</span>
                </>
              )}
            </button>

            {/* Accept Button */}
            <button
              onClick={handleAccept}
              disabled={isDeclining || isAccepting}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-600 text-white',
                'hover:bg-green-700 transition-colors font-medium',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isAccepting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Accept</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Secondary Actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-nilin-border">
          <div className="flex items-center gap-2">
            {request.customerPhone && (
              <button
                onClick={() => onContact?.('phone')}
                className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
                title="Call customer"
              >
                <Phone className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onContact?.('message')}
              className="p-2 text-nilin-warmGray hover:text-nilin-coral hover:bg-nilin-blush rounded-lg transition-colors"
              title="Message customer"
            >
              <MessageSquare className="w-4 h-4" />
            </button>
          </div>
          {onViewDetails && (
            <button
              onClick={onViewDetails}
              className="flex items-center gap-1 text-sm text-nilin-coral hover:text-nilin-rose transition-colors"
            >
              <span>View Details</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// =============================================================================
// Empty State Component
// =============================================================================

const EmptyState: React.FC = () => (
  <div className="text-center py-12">
    <div className="w-16 h-16 rounded-full bg-nilin-muted flex items-center justify-center mx-auto mb-4">
      <Check className="w-8 h-8 text-nilin-lightGray" />
    </div>
    <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
      All caught up!
    </h3>
    <p className="text-sm text-nilin-warmGray">
      No pending booking requests to review
    </p>
  </div>
);

// =============================================================================
// Main Component
// =============================================================================

export const QuickActions: React.FC<QuickActionsProps> = ({
  requests,
  isLoading = false,
  maxVisible = 5,
  onAccept,
  onDecline,
  onViewDetails,
  onContactCustomer,
  enableSounds = false,
  className,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(enableSounds);
  const [filter, setFilter] = useState<'all' | 'urgent' | 'instant'>('all');

  const filteredRequests = requests.filter((r) => {
    if (filter === 'urgent') return r.timeRemaining !== undefined && r.timeRemaining < 30;
    if (filter === 'instant') return r.isInstantBook;
    return true;
  });

  const visibleRequests = filteredRequests.slice(0, maxVisible);
  const urgentCount = requests.filter(
    (r) => r.timeRemaining !== undefined && r.timeRemaining < 30
  ).length;

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-nilin-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-nilin-charcoal">
            Booking Requests
          </h3>
          <p className="text-sm text-nilin-warmGray">
            {requests.length} pending
            {urgentCount > 0 && (
              <span className="text-amber-600 ml-2">
                ({urgentCount} urgent)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter Dropdown */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="text-sm border border-nilin-border rounded-lg px-3 py-1.5 text-nilin-charcoal focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
          >
            <option value="all">All</option>
            <option value="urgent">Urgent</option>
            <option value="instant">Instant Book</option>
          </select>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              soundEnabled
                ? 'bg-nilin-coral/10 text-nilin-coral'
                : 'bg-nilin-muted text-nilin-lightGray'
            )}
            title={soundEnabled ? 'Notifications on' : 'Notifications off'}
          >
            {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Requests List */}
      {visibleRequests.length > 0 ? (
        <AnimatePresence mode="popLayout">
          <div className="space-y-4">
            {visibleRequests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onAccept={() => onAccept(request.id)}
                onDecline={() => onDecline(request.id)}
                onViewDetails={onViewDetails ? () => onViewDetails(request) : undefined}
                onContact={
                  onContactCustomer
                    ? (method) => onContactCustomer(request, method)
                    : undefined
                }
                soundEnabled={soundEnabled}
              />
            ))}
          </div>
        </AnimatePresence>
      ) : (
        <EmptyState />
      )}

      {/* Show More */}
      {filteredRequests.length > maxVisible && (
        <div className="mt-6 text-center">
          <button className="text-nilin-coral hover:text-nilin-rose text-sm font-medium transition-colors">
            View all {filteredRequests.length} requests
          </button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default QuickActions;
