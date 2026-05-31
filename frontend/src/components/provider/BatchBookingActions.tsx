/**
 * BatchBookingActions - Bulk operations on multiple bookings
 * Provider Dashboard Component
 */
import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  CheckSquare,
  Square,
  Check,
  X,
  Loader2,
  AlertTriangle,
  Calendar,
  Clock,
  User,
  DollarSign,
  MessageSquare,
  ChevronDown,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Ban,
  Mail,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// =============================================================================
// Type Definitions
// =============================================================================

export interface BookingSummary {
  id: string;
  bookingNumber: string;
  customerName: string;
  customerAvatar?: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';
  total: number;
  currency?: string;
}

export type BatchAction = 'accept' | 'decline' | 'complete' | 'cancel' | 'message';

export interface BatchBookingActionsProps {
  /** Bookings available for selection */
  bookings: BookingSummary[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when batch action is performed */
  onBatchAction: (action: BatchAction, bookingIds: string[]) => Promise<void>;
  /** Callback when individual booking is clicked */
  onBookingClick?: (bookingId: string) => void;
  /** Max bookings that can be selected */
  maxSelection?: number;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Status Configuration
// =============================================================================

const STATUS_CONFIG: Record<
  BookingSummary['status'],
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  pending: { label: 'Pending', color: 'text-amber-600', bgColor: 'bg-amber-50', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Calendar },
  in_progress: { label: 'In Progress', color: 'text-purple-600', bgColor: 'bg-purple-50', icon: Loader2 },
  completed: { label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-50', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'text-red-600', bgColor: 'bg-red-50', icon: XCircle },
  no_show: { label: 'No Show', color: 'text-orange-600', bgColor: 'bg-orange-50', icon: User },
};

// =============================================================================
// Confirmation Dialog Component
// =============================================================================

interface ConfirmationDialogProps {
  action: BatchAction;
  count: number;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  customMessage?: string;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  action,
  count,
  isLoading,
  onConfirm,
  onCancel,
  customMessage,
}) => {
  const actionConfig = {
    accept: {
      title: 'Accept Bookings',
      message: customMessage || `Are you sure you want to accept ${count} booking${count > 1 ? 's' : ''}?`,
      confirmText: 'Accept All',
      icon: CheckCircle,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      buttonClass: 'bg-green-600 hover:bg-green-700',
    },
    decline: {
      title: 'Decline Bookings',
      message: customMessage || `Are you sure you want to decline ${count} booking${count > 1 ? 's' : ''}?`,
      confirmText: 'Decline All',
      icon: XCircle,
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      buttonClass: 'bg-red-600 hover:bg-red-700',
    },
    complete: {
      title: 'Mark as Complete',
      message: customMessage || `Mark ${count} booking${count > 1 ? 's' : ''} as completed?`,
      confirmText: 'Complete All',
      icon: Check,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      buttonClass: 'bg-blue-600 hover:bg-blue-700',
    },
    cancel: {
      title: 'Cancel Bookings',
      message: customMessage || `Are you sure you want to cancel ${count} booking${count > 1 ? 's' : ''}?`,
      confirmText: 'Cancel All',
      icon: Ban,
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
      buttonClass: 'bg-gray-600 hover:bg-gray-700',
    },
    message: {
      title: 'Send Message',
      message: customMessage || `Send a message to ${count} customer${count > 1 ? 's' : ''}?`,
      confirmText: 'Send Message',
      icon: Mail,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      buttonClass: 'bg-purple-600 hover:bg-purple-700',
    },
  };

  const config = actionConfig[action];
  const Icon = config.icon;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onCancel}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-nilin-xl max-w-md w-full p-6"
        >
          <div className="text-center mb-6">
            <div className={cn('w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4', config.iconBg)}>
              <Icon className={cn('w-8 h-8', config.iconColor)} />
            </div>
            <h3 className="text-lg font-semibold text-nilin-charcoal mb-2">
              {config.title}
            </h3>
            <p className="text-sm text-nilin-warmGray">{config.message}</p>
          </div>

          {/* Selected Bookings Summary */}
          <div className="bg-nilin-muted/30 rounded-lg p-3 mb-6 max-h-32 overflow-y-auto">
            <p className="text-xs text-nilin-warmGray mb-2">Selected bookings:</p>
            <div className="space-y-1">
              {/* This will be populated by parent */}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 py-2.5 border border-nilin-border rounded-xl text-nilin-charcoal font-medium hover:bg-nilin-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(
                'flex-1 py-2.5 rounded-xl font-medium text-white transition-colors disabled:opacity-50',
                config.buttonClass
              )}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </span>
              ) : (
                config.confirmText
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
};

// =============================================================================
// Selection Header Component
// =============================================================================

interface SelectionHeaderProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

const SelectionHeader: React.FC<SelectionHeaderProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
}) => {
  const isAllSelected = selectedCount === totalCount;

  return (
    <div className="flex items-center justify-between p-3 bg-nilin-coral/5 rounded-lg mb-4">
      <div className="flex items-center gap-3">
        <button
          onClick={isAllSelected ? onClearSelection : onSelectAll}
          className={cn(
            'w-6 h-6 rounded-md flex items-center justify-center transition-colors',
            isAllSelected
              ? 'bg-nilin-coral text-white'
              : 'border-2 border-nilin-border hover:border-nilin-coral'
          )}
        >
          {isAllSelected && <Check className="w-4 h-4" />}
        </button>
        <span className="text-sm text-nilin-charcoal">
          <span className="font-semibold">{selectedCount}</span> of {totalCount} selected
        </span>
      </div>
      {selectedCount > 0 && (
        <button
          onClick={onClearSelection}
          className="text-sm text-nilin-coral hover:text-nilin-rose transition-colors"
        >
          Clear selection
        </button>
      )}
    </div>
  );
};

// =============================================================================
// Booking Row Component
// =============================================================================

interface BookingRowProps {
  booking: BookingSummary;
  isSelected: boolean;
  onToggle: () => void;
  onClick: () => void;
}

const BookingRow: React.FC<BookingRowProps> = ({
  booking,
  isSelected,
  onToggle,
  onClick,
}) => {
  const statusConfig = STATUS_CONFIG[booking.status];
  const StatusIcon = statusConfig.icon;

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return date.toLocaleTimeString('en-AE', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatPrice = (amount: number, currency = 'AED') => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-xl border transition-all',
        isSelected
          ? 'border-nilin-coral bg-nilin-coral/5'
          : 'border-nilin-border hover:border-nilin-coral/30 hover:bg-nilin-muted/30',
        booking.status === 'cancelled' && 'opacity-60'
      )}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={cn(
          'w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors',
          isSelected
            ? 'bg-nilin-coral text-white'
            : 'border-2 border-nilin-border hover:border-nilin-coral'
        )}
      >
        {isSelected && <Check className="w-4 h-4" />}
      </button>

      {/* Customer Avatar */}
      <div className="w-10 h-10 rounded-full bg-nilin-coral/10 flex items-center justify-center flex-shrink-0">
        {booking.customerAvatar ? (
          <img
            src={booking.customerAvatar}
            alt={booking.customerName}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <User className="w-5 h-5 text-nilin-coral" />
        )}
      </div>

      {/* Booking Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium text-nilin-charcoal truncate">{booking.customerName}</p>
          <span className="px-2 py-0.5 rounded-full text-xs bg-nilin-muted text-nilin-warmGray flex-shrink-0">
            {booking.bookingNumber}
          </span>
        </div>
        <p className="text-sm text-nilin-warmGray truncate">{booking.serviceName}</p>
      </div>

      {/* Date & Time */}
      <div className="hidden sm:flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1 text-nilin-warmGray">
          <Calendar className="w-4 h-4" />
          <span>{formatDate(booking.scheduledDate)}</span>
        </div>
        <div className="flex items-center gap-1 text-nilin-warmGray">
          <Clock className="w-4 h-4" />
          <span>{formatTime(booking.scheduledTime)}</span>
        </div>
      </div>

      {/* Status */}
      <div className={cn('px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1', statusConfig.bgColor, statusConfig.color)}>
        <StatusIcon className="w-3 h-3" />
        {statusConfig.label}
      </div>

      {/* Amount */}
      <div className="text-right">
        <p className="font-semibold text-nilin-charcoal">
          {formatPrice(booking.total, booking.currency)}
        </p>
      </div>
    </div>
  );
};

// =============================================================================
// Action Bar Component
// =============================================================================

interface ActionBarProps {
  selectedCount: number;
  selectedBookings: BookingSummary[];
  onAction: (action: BatchAction) => void;
  isLoading: boolean;
  disabledActions: BatchAction[];
}

const ActionBar: React.FC<ActionBarProps> = ({
  selectedCount,
  selectedBookings,
  onAction,
  isLoading,
  disabledActions,
}) => {
  const [showDropdown, setShowDropdown] = useState(false);

  const availableActions: Array<{ action: BatchAction; label: string; icon: React.ElementType; color: string }> = [
    { action: 'accept', label: 'Accept', icon: CheckCircle, color: 'text-green-600' },
    { action: 'decline', label: 'Decline', icon: XCircle, color: 'text-red-600' },
    { action: 'complete', label: 'Complete', icon: Check, color: 'text-blue-600' },
    { action: 'cancel', label: 'Cancel', icon: Ban, color: 'text-gray-600' },
    { action: 'message', label: 'Send Message', icon: Mail, color: 'text-purple-600' },
  ];

  // Determine which actions are valid for current selection
  const validActions = useMemo(() => {
    if (selectedCount === 0) return [];

    const statuses = selectedBookings.map((b) => b.status);

    return availableActions.filter(({ action }) => {
      if (disabledActions.includes(action)) return false;

      switch (action) {
        case 'accept':
          return statuses.every((s) => s === 'pending');
        case 'decline':
          return statuses.every((s) => s === 'pending');
        case 'complete':
          return statuses.every((s) => s === 'confirmed' || s === 'in_progress');
        case 'cancel':
          return statuses.every((s) => ['pending', 'confirmed'].includes(s));
        case 'message':
          return true;
        default:
          return false;
      }
    });
  }, [selectedCount, selectedBookings, disabledActions]);

  if (selectedCount === 0) return null;

  return (
    <div className="sticky bottom-4 mx-4 mb-4 bg-white rounded-xl shadow-nilin-lg border border-nilin-border p-3 z-30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-nilin-coral flex items-center justify-center">
              <span className="text-sm font-bold text-white">{selectedCount}</span>
            </div>
            <span className="text-sm font-medium text-nilin-charcoal">
              {selectedCount === 1 ? 'booking' : 'bookings'} selected
            </span>
          </div>

          <div className="h-6 w-px bg-nilin-border" />

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            {validActions.slice(0, 2).map(({ action, label, icon: Icon, color }) => (
              <button
                key={action}
                onClick={() => onAction(action)}
                disabled={isLoading}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  color,
                  'hover:bg-nilin-muted'
                )}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                {label}
              </button>
            ))}

            {/* More Actions Dropdown */}
            {validActions.length > 2 && (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-nilin-warmGray hover:bg-nilin-muted transition-colors"
                >
                  More
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowDropdown(false)}
                    />
                    <div className="absolute bottom-full left-0 mb-2 z-50 bg-white rounded-xl shadow-nilin-lg border border-nilin-border py-2 min-w-[160px]">
                      {validActions.slice(2).map(({ action, label, icon: Icon, color }) => (
                        <button
                          key={action}
                          onClick={() => {
                            setShowDropdown(false);
                            onAction(action);
                          }}
                          disabled={isLoading}
                          className={cn(
                            'w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-nilin-muted transition-colors',
                            color
                          )}
                        >
                          <Icon className="w-4 h-4" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="hidden md:flex items-center gap-4 text-sm">
          <span className="text-nilin-warmGray">
            Total:{' '}
            <span className="font-semibold text-nilin-charcoal">
              {new Intl.NumberFormat('en-AE', {
                style: 'currency',
                currency: selectedBookings[0]?.currency || 'AED',
                minimumFractionDigits: 0,
              }).format(selectedBookings.reduce((sum, b) => sum + b.total, 0))}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const BatchBookingActions: React.FC<BatchBookingActionsProps> = ({
  bookings,
  isLoading = false,
  onBatchAction,
  onBookingClick,
  maxSelection = 100,
  className,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<BatchAction | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleToggleSelection = useCallback((bookingId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookingId)) {
        next.delete(bookingId);
      } else if (next.size < maxSelection) {
        next.add(bookingId);
      }
      return next;
    });
  }, [maxSelection]);

  const handleSelectAll = useCallback(() => {
    const selectableBookings = bookings.filter((b) =>
      !['cancelled', 'completed'].includes(b.status)
    );
    setSelectedIds(new Set(selectableBookings.map((b) => b.id)));
  }, [bookings]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleAction = useCallback((action: BatchAction) => {
    setPendingAction(action);
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!pendingAction) return;

    setIsProcessing(true);
    try {
      await onBatchAction(pendingAction, Array.from(selectedIds));
      setSelectedIds(new Set());
    } finally {
      setIsProcessing(false);
      setPendingAction(null);
    }
  }, [pendingAction, selectedIds, onBatchAction]);

  const handleCancelAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  const selectedBookings = useMemo(
    () => bookings.filter((b) => selectedIds.has(b.id)),
    [bookings, selectedIds]
  );

  const disabledActions = useMemo(() => {
    const disabled: BatchAction[] = [];
    const statuses = bookings.map((b) => b.status);

    if (!statuses.every((s) => s === 'pending')) {
      disabled.push('accept', 'decline');
    }
    if (!statuses.some((s) => ['confirmed', 'in_progress'].includes(s))) {
      disabled.push('complete');
    }
    if (!statuses.some((s) => ['pending', 'confirmed'].includes(s))) {
      disabled.push('cancel');
    }

    return disabled;
  }, [bookings]);

  // Filter to show only actionable bookings by default
  const displayedBookings = useMemo(() => {
    return bookings.filter((b) => !['cancelled', 'completed'].includes(b.status));
  }, [bookings]);

  if (isLoading && bookings.length === 0) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-4" />
          <div className="h-12 bg-nilin-muted rounded mb-4" />
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-nilin-muted rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-nilin-coral/10 flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-nilin-coral" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Batch Actions
            </h3>
            <p className="text-sm text-nilin-warmGray">
              Select multiple bookings for bulk operations
            </p>
          </div>
        </div>
      </div>

      {/* Selection Header */}
      {displayedBookings.length > 0 && (
        <SelectionHeader
          selectedCount={selectedIds.size}
          totalCount={displayedBookings.length}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
        />
      )}

      {/* Bookings List */}
      {displayedBookings.length > 0 ? (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {displayedBookings.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              isSelected={selectedIds.has(booking.id)}
              onToggle={() => handleToggleSelection(booking.id)}
              onClick={() => onBookingClick?.(booking.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-nilin-lightGray mx-auto mb-4" />
          <p className="text-nilin-warmGray">No actionable bookings</p>
          <p className="text-sm text-nilin-lightGray mt-1">
            Completed or cancelled bookings cannot be modified
          </p>
        </div>
      )}

      {/* Action Bar */}
      <ActionBar
        selectedCount={selectedIds.size}
        selectedBookings={selectedBookings}
        onAction={handleAction}
        isLoading={isProcessing}
        disabledActions={disabledActions}
      />

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {pendingAction && (
          <ConfirmationDialog
            action={pendingAction}
            count={selectedIds.size}
            isLoading={isProcessing}
            onConfirm={handleConfirmAction}
            onCancel={handleCancelAction}
          />
        )}
      </AnimatePresence>

      {/* Help Text */}
      {displayedBookings.length > 0 && selectedIds.size === 0 && (
        <div className="mt-4 p-3 bg-nilin-muted/30 rounded-lg">
          <p className="text-sm text-nilin-warmGray text-center">
            Click on the checkboxes to select bookings for batch operations
          </p>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default BatchBookingActions;
