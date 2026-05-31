/**
 * FollowUpReminders - Follow-up reminder system
 * Provider Dashboard Component
 */
import React, { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';
import {
  Bell,
  Clock,
  Check,
  X,
  Plus,
  Calendar,
  MessageSquare,
  Phone,
  Mail,
  User,
  AlertCircle,
  ChevronRight,
  Search,
  Filter,
  Loader2,
  Repeat,
} from 'lucide-react';

// =============================================================================
// Type Definitions
// =============================================================================

export type ReminderType = 'review_request' | 'check_in' | 'follow_up' | 'rebooking' | 'custom';
export type ReminderStatus = 'pending' | 'sent' | 'completed' | 'cancelled';
export type ReminderMethod = 'sms' | 'email' | 'app_notification' | 'whatsapp';

export interface FollowUpReminder {
  /** Unique reminder ID */
  id: string;
  /** Customer ID */
  customerId: string;
  /** Customer name */
  customerName: string;
  /** Customer avatar */
  customerAvatar?: string;
  /** Customer phone */
  customerPhone?: string;
  /** Customer email */
  customerEmail?: string;
  /** Associated booking ID */
  bookingId?: string;
  /** Service name */
  serviceName?: string;
  /** Reminder type */
  type: ReminderType;
  /** Reminder title */
  title: string;
  /** Reminder message */
  message: string;
  /** Scheduled date/time */
  scheduledAt: string;
  /** Status */
  status: ReminderStatus;
  /** Delivery method */
  method: ReminderMethod;
  /** Is recurring */
  isRecurring?: boolean;
  /** Recurrence pattern (if recurring) */
  recurrencePattern?: 'daily' | 'weekly' | 'monthly';
  /** Number of times sent */
  timesSent?: number;
  /** Last sent date */
  lastSentAt?: string;
  /** Next due date (for recurring) */
  nextDueDate?: string;
  /** Created at */
  createdAt: string;
}

export interface FollowUpRemindersProps {
  /** Reminders list */
  reminders: FollowUpReminder[];
  /** Loading state */
  isLoading?: boolean;
  /** Callback when reminder is completed */
  onComplete: (reminderId: string) => Promise<void>;
  /** Callback when reminder is cancelled */
  onCancel: (reminderId: string) => Promise<void>;
  /** Callback when reminder is sent */
  onSend: (reminderId: string) => Promise<void>;
  /** Callback when new reminder is created */
  onCreate: (reminder: Partial<FollowUpReminder>) => Promise<void>;
  /** Callback when reminder is clicked */
  onReminderClick?: (reminder: FollowUpReminder) => void;
  /** Custom className */
  className?: string;
}

// =============================================================================
// Type Configuration
// =============================================================================

const typeConfig: Record<ReminderType, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  review_request: { label: 'Review Request', color: 'text-yellow-600', bgColor: 'bg-yellow-50', icon: MessageSquare },
  check_in: { label: 'Check-in', color: 'text-blue-600', bgColor: 'bg-blue-50', icon: Bell },
  follow_up: { label: 'Follow-up', color: 'text-purple-600', bgColor: 'bg-purple-50', icon: MessageSquare },
  rebooking: { label: 'Rebooking', color: 'text-green-600', bgColor: 'bg-green-50', icon: Repeat },
  custom: { label: 'Custom', color: 'text-nilin-coral', bgColor: 'bg-nilin-coral/10', icon: Bell },
};

const statusConfig: Record<ReminderStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-amber-600', bgColor: 'bg-amber-50' },
  sent: { label: 'Sent', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  completed: { label: 'Completed', color: 'text-green-600', bgColor: 'bg-green-50' },
  cancelled: { label: 'Cancelled', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

const methodConfig: Record<ReminderMethod, { label: string; icon: React.ElementType }> = {
  sms: { label: 'SMS', icon: MessageSquare },
  email: { label: 'Email', icon: Mail },
  app_notification: { label: 'App', icon: Bell },
  whatsapp: { label: 'WhatsApp', icon: MessageSquare },
};

// =============================================================================
// Create Reminder Modal
// =============================================================================

interface CreateReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reminder: Partial<FollowUpReminder>) => Promise<void>;
}

const CreateReminderModal: React.FC<CreateReminderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<Partial<FollowUpReminder>>({
    type: 'follow_up',
    method: 'app_notification',
    title: '',
    message: '',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    isRecurring: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.title || !formData.message) return;

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
      setFormData({
        type: 'follow_up',
        method: 'app_notification',
        title: '',
        message: '',
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        isRecurring: false,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-nilin-xl max-w-md w-full">
          <div className="p-6 border-b border-nilin-border">
            <h2 className="text-lg font-semibold text-nilin-charcoal">
              Create Follow-up Reminder
            </h2>
          </div>

          <div className="p-6 space-y-4">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Reminder Type
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(typeConfig) as ReminderType[]).map((type) => {
                  const config = typeConfig[type];
                  const Icon = config.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => setFormData({ ...formData, type })}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        formData.type === type
                          ? `${config.bgColor} ${config.color}`
                          : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Title *
              </label>
              <input
                type="text"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                placeholder="e.g., Follow up on cleaning service"
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Message *
              </label>
              <textarea
                value={formData.message || ''}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={3}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 resize-none"
                placeholder="Write your reminder message..."
              />
            </div>

            {/* Method */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-2">
                Delivery Method
              </label>
              <div className="flex gap-2">
                {(Object.keys(methodConfig) as ReminderMethod[]).map((method) => {
                  const config = methodConfig[method];
                  const Icon = config.icon;
                  return (
                    <button
                      key={method}
                      onClick={() => setFormData({ ...formData, method })}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        formData.method === method
                          ? 'bg-nilin-coral text-white'
                          : 'bg-nilin-muted text-nilin-warmGray hover:bg-nilin-blush'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Schedule */}
            <div>
              <label className="block text-sm font-medium text-nilin-charcoal mb-1">
                Schedule For
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledAt?.slice(0, 16) || ''}
                onChange={(e) => setFormData({ ...formData, scheduledAt: new Date(e.target.value).toISOString() })}
                className="w-full px-4 py-2.5 border border-nilin-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
              />
            </div>

            {/* Recurring */}
            <label className="flex items-center gap-3 p-3 bg-nilin-muted rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isRecurring || false}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="w-5 h-5 text-nilin-coral rounded focus:ring-nilin-coral"
              />
              <div>
                <span className="text-sm text-nilin-charcoal font-medium">
                  Recurring Reminder
                </span>
                <p className="text-xs text-nilin-warmGray">
                  Automatically repeat this reminder
                </p>
              </div>
            </label>
          </div>

          <div className="p-6 border-t border-nilin-border flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-nilin-warmGray hover:text-nilin-charcoal font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!formData.title || !formData.message || isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Reminder
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// =============================================================================
// Reminder Card Component
// =============================================================================

interface ReminderCardProps {
  reminder: FollowUpReminder;
  onComplete: () => Promise<void>;
  onCancel: () => Promise<void>;
  onSend: () => Promise<void>;
  onClick?: () => void;
}

const ReminderCard: React.FC<ReminderCardProps> = ({
  reminder,
  onComplete,
  onCancel,
  onSend,
  onClick,
}) => {
  const [isActioning, setIsActioning] = useState(false);
  const type = typeConfig[reminder.type];
  const status = statusConfig[reminder.status];
  const method = methodConfig[reminder.method];
  const TypeIcon = type.icon;
  const MethodIcon = method.icon;

  const formatDateTime = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleAction = async (action: 'complete' | 'cancel' | 'send') => {
    setIsActioning(true);
    try {
      if (action === 'complete') await onComplete();
      else if (action === 'cancel') await onCancel();
      else if (action === 'send') await onSend();
    } finally {
      setIsActioning(false);
    }
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl border p-4 transition-all',
        reminder.status === 'pending'
          ? 'border-nilin-border hover:shadow-nilin-sm'
          : reminder.status === 'completed'
          ? 'border-green-200 bg-green-50/30'
          : 'border-gray-200 opacity-75'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', type.bgColor)}>
            <TypeIcon className={cn('w-5 h-5', type.color)} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-nilin-charcoal">{reminder.title}</h4>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium',
                  status.bgColor,
                  status.color
                )}
              >
                {status.label}
              </span>
            </div>
            <p className="text-sm text-nilin-warmGray">{reminder.customerName}</p>
            {reminder.serviceName && (
              <p className="text-xs text-nilin-lightGray">{reminder.serviceName}</p>
            )}
          </div>
        </div>

        {/* Method */}
        <div className="flex items-center gap-1 px-2 py-1 bg-nilin-muted rounded-lg">
          <MethodIcon className="w-3 h-3 text-nilin-warmGray" />
          <span className="text-xs text-nilin-warmGray">{method.label}</span>
        </div>
      </div>

      {/* Message Preview */}
      <p className="text-sm text-nilin-charcoal mb-3 line-clamp-2 pl-13">
        {reminder.message}
      </p>

      {/* Schedule Info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1 text-xs text-nilin-warmGray">
          <Clock className="w-3 h-3" />
          <span>
            {reminder.status === 'completed'
              ? `Completed ${formatDateTime(reminder.lastSentAt || reminder.scheduledAt)}`
              : `Scheduled for ${formatDateTime(reminder.scheduledAt)}`}
          </span>
        </div>
        {reminder.isRecurring && reminder.timesSent !== undefined && (
          <span className="flex items-center gap-1 text-xs text-purple-600">
            <Repeat className="w-3 h-3" />
            Sent {reminder.timesSent}x
          </span>
        )}
      </div>

      {/* Actions */}
      {reminder.status === 'pending' && (
        <div className="flex items-center gap-2 pt-3 border-t border-nilin-border">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction('send');
            }}
            disabled={isActioning}
            className="flex-1 py-2 bg-nilin-coral text-white rounded-lg hover:bg-nilin-rose font-medium text-sm transition-colors disabled:opacity-50"
          >
            Send Now
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction('complete');
            }}
            disabled={isActioning}
            className="flex-1 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium text-sm transition-colors disabled:opacity-50"
          >
            Mark Done
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction('cancel');
            }}
            disabled={isActioning}
            className="p-2 text-nilin-warmGray hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

export const FollowUpReminders: React.FC<FollowUpRemindersProps> = ({
  reminders,
  isLoading = false,
  onComplete,
  onCancel,
  onSend,
  onCreate,
  onReminderClick,
  className,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ReminderStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ReminderType | 'all'>('all');

  // Filter reminders
  const filteredReminders = useMemo(() => {
    return reminders
      .filter((reminder) => {
        if (statusFilter !== 'all' && reminder.status !== statusFilter) return false;
        if (typeFilter !== 'all' && reminder.type !== typeFilter) return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            reminder.title.toLowerCase().includes(query) ||
            reminder.customerName.toLowerCase().includes(query) ||
            reminder.message.toLowerCase().includes(query)
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Pending first, then by scheduled date
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      });
  }, [reminders, statusFilter, typeFilter, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    return {
      pending: reminders.filter((r) => r.status === 'pending').length,
      sent: reminders.filter((r) => r.status === 'sent').length,
      completed: reminders.filter((r) => r.status === 'completed').length,
    };
  }, [reminders]);

  if (isLoading) {
    return (
      <div className={cn('bg-white rounded-2xl p-6 shadow-nilin-sm', className)}>
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-nilin-muted rounded mb-6" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-nilin-muted rounded-xl" />
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Bell className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-nilin-charcoal">
              Follow-up Reminders
            </h3>
            <p className="text-sm text-nilin-warmGray">
              {stats.pending} pending, {stats.completed} completed
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-rose transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Reminder
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-700">{stats.pending}</p>
          <p className="text-xs text-amber-600">Pending</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-700">{stats.sent}</p>
          <p className="text-xs text-blue-600">Sent</p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-700">{stats.completed}</p>
          <p className="text-xs text-green-600">Completed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-nilin-lightGray" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reminders..."
            className="w-full pl-10 pr-4 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReminderStatus | 'all')}
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Status</option>
          {(Object.keys(statusConfig) as ReminderStatus[]).map((status) => (
            <option key={status} value={status}>
              {statusConfig[status].label}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ReminderType | 'all')}
          className="px-3 py-2 border border-nilin-border rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30 text-sm"
        >
          <option value="all">All Types</option>
          {(Object.keys(typeConfig) as ReminderType[]).map((type) => (
            <option key={type} value={type}>
              {typeConfig[type].label}
            </option>
          ))}
        </select>
      </div>

      {/* Reminders List */}
      {filteredReminders.length > 0 ? (
        <div className="space-y-3">
          {filteredReminders.map((reminder) => (
            <ReminderCard
              key={reminder.id}
              reminder={reminder}
              onComplete={() => onComplete(reminder.id)}
              onCancel={() => onCancel(reminder.id)}
              onSend={() => onSend(reminder.id)}
              onClick={onReminderClick ? () => onReminderClick(reminder) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Bell className="w-12 h-12 text-nilin-lightGray mx-auto mb-3" />
          <p className="text-nilin-warmGray">No reminders found</p>
          <p className="text-sm text-nilin-lightGray mt-1">
            {reminders.length === 0
              ? 'Create your first follow-up reminder'
              : 'Try adjusting your filters'}
          </p>
        </div>
      )}

      {/* Create Modal */}
      <CreateReminderModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={onCreate}
      />
    </div>
  );
};

// =============================================================================
// Export
// =============================================================================

export default FollowUpReminders;
