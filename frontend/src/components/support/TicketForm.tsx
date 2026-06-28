import React, { useState } from 'react';
import {
  X,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  Info,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import authService from '../../services/AuthService';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type TicketCategory = 'technical' | 'billing' | 'account' | 'service' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface CreateTicketData {
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  description: string;
  bookingId?: string;
  bookingNumber?: string;
  serviceName?: string;
}

export interface TicketBookingContext {
  bookingId?: string;
  bookingNumber?: string;
  serviceName?: string;
  displayRef?: string;
}

export interface TicketFormProps {
  className?: string;
  onSuccess?: (ticketNumber: string) => void;
  onCancel?: () => void;
  preselectedCategory?: TicketCategory;
  prefilledSubject?: string;
  prefilledDescription?: string;
  bookingContext?: TicketBookingContext;
}

// ============================================
// API SERVICE
// ============================================

const ticketApi = {
  async createTicket(data: CreateTicketData): Promise<{ ticketNumber: string }> {
    const response = await authService.post<{
      success: boolean;
      data: { ticketNumber: string };
      message: string;
    }>('/support/tickets', data);

    return {
      ticketNumber: response.data?.ticketNumber ?? '',
    };
  },
};

// ============================================
// CONSTANTS
// ============================================

const CATEGORIES: Array<{
  value: TicketCategory;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    value: 'technical',
    label: 'Technical Issue',
    icon: '⚙️',
    description: 'App bugs, errors, or technical problems',
  },
  {
    value: 'billing',
    label: 'Billing & Payments',
    icon: '💳',
    description: 'Payment issues, refunds, or invoices',
  },
  {
    value: 'account',
    label: 'Account',
    icon: '🔐',
    description: 'Login, password, or account settings',
  },
  {
    value: 'service',
    label: 'Service Related',
    icon: '🛠️',
    description: 'Questions about our services',
  },
  {
    value: 'other',
    label: 'Other',
    icon: '📝',
    description: 'Anything else',
  },
];

const PRIORITIES: Array<{
  value: TicketPriority;
  label: string;
  color: string;
  bgColor: string;
  description: string;
}> = [
  {
    value: 'low',
    label: 'Low',
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    description: 'General questions, no urgency',
  },
  {
    value: 'medium',
    label: 'Medium',
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    description: 'Somewhat important',
  },
  {
    value: 'high',
    label: 'High',
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    description: 'Important, needs attention soon',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    description: 'Critical, needs immediate help',
  },
];

// ============================================
// CATEGORY SELECTOR COMPONENT
// ============================================

const CategorySelector: React.FC<{
  value: TicketCategory | '';
  onChange: (value: TicketCategory) => void;
}> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selected = CATEGORIES.find((c) => c.value === value);

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-nilin-charcoal mb-2">
        Category <span className="text-red-500">*</span>
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
      >
        {selected ? (
          <div className="flex items-center gap-3">
            <span className="text-xl">{selected.icon}</span>
            <span className="font-medium text-nilin-charcoal">{selected.label}</span>
          </div>
        ) : (
          <span className="text-gray-400">Select a category</span>
        )}
        <ChevronDown className={cn('h-5 w-5 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-20">
            {CATEGORIES.map((category) => (
              <button
                key={category.value}
                type="button"
                onClick={() => {
                  onChange(category.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors',
                  value === category.value && 'bg-nilin-coral/5'
                )}
              >
                <span className="text-xl mt-0.5">{category.icon}</span>
                <div className="text-left">
                  <p className={cn('font-medium', value === category.value ? 'text-nilin-coral' : 'text-nilin-charcoal')}>
                    {category.label}
                  </p>
                  <p className="text-sm text-gray-500">{category.description}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ============================================
// PRIORITY SELECTOR COMPONENT
// ============================================

const PrioritySelector: React.FC<{
  value: TicketPriority;
  onChange: (value: TicketPriority) => void;
}> = ({ value, onChange }) => {
  return (
    <div>
      <label className="block text-sm font-medium text-nilin-charcoal mb-2">
        Priority
      </label>
      <div className="grid grid-cols-4 gap-2">
        {PRIORITIES.map((priority) => (
          <button
            key={priority.value}
            type="button"
            onClick={() => onChange(priority.value)}
            className={cn(
              'p-3 rounded-xl border text-center transition-all',
              value === priority.value
                ? `${priority.bgColor} border-nilin-coral`
                : 'bg-white border-gray-200 hover:border-gray-300'
            )}
          >
            <p className={cn('text-sm font-medium', value === priority.value ? priority.color : 'text-gray-700')}>
              {priority.label}
            </p>
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        {PRIORITIES.find((p) => p.value === value)?.description}
      </p>
    </div>
  );
};

// ============================================
// MAIN TICKET FORM COMPONENT
// ============================================

export const TicketForm: React.FC<TicketFormProps> = ({
  className,
  onSuccess,
  onCancel,
  preselectedCategory,
  prefilledSubject,
  prefilledDescription,
  bookingContext,
}) => {
  // Form state
  const [category, setCategory] = useState<TicketCategory | ''>(preselectedCategory || '');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [subject, setSubject] = useState(prefilledSubject || '');
  const [description, setDescription] = useState(prefilledDescription || '');

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');

  // Validation
  const errors: Record<string, string> = {};

  if (!category) {
    errors.category = 'Please select a category';
  }
  if (subject.trim().length < 5) {
    errors.subject = 'Subject must be at least 5 characters';
  }
  if (subject.trim().length > 200) {
    errors.subject = 'Subject cannot exceed 200 characters';
  }
  if (description.trim().length < 20) {
    errors.description = 'Description must be at least 20 characters';
  }
  if (description.trim().length > 5000) {
    errors.description = 'Description cannot exceed 5000 characters';
  }

  const isValid = Object.keys(errors).length === 0;

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const result = await ticketApi.createTicket({
        category: category as TicketCategory,
        priority,
        subject: subject.trim(),
        description: description.trim(),
        ...(bookingContext?.bookingId ? { bookingId: bookingContext.bookingId } : {}),
        ...(bookingContext?.bookingNumber ? { bookingNumber: bookingContext.bookingNumber } : {}),
        ...(bookingContext?.serviceName ? { serviceName: bookingContext.serviceName } : {}),
      });

      setSuccess(true);
      setTicketNumber(result.ticketNumber);

      // Notify parent
      onSuccess?.(result.ticketNumber);
    } catch (err) {
      console.error('Failed to create ticket:', err);
      setError(err instanceof Error ? err.message : 'Failed to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className={cn('p-6 bg-white rounded-2xl border border-gray-200', className)}>
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-semibold text-nilin-charcoal mb-2">
            Ticket Created!
          </h3>
          <p className="text-gray-500 mb-4">
            Your support ticket has been submitted successfully.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-500">Ticket Number</p>
            <p className="text-xl font-mono font-semibold text-nilin-coral">
              {ticketNumber}
            </p>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            We'll get back to you as soon as possible. You can track your ticket status in the Tickets section.
          </p>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-nilin-coral text-white rounded-xl font-medium hover:bg-nilin-coral/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('p-6 bg-white rounded-2xl border border-gray-200', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-nilin-charcoal">
          Create Support Ticket
        </h2>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
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

      {bookingContext?.displayRef && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">
              This ticket is linked to booking {bookingContext.displayRef}
            </p>
            {bookingContext.serviceName && (
              <p className="text-sm text-blue-700 mt-1">{bookingContext.serviceName}</p>
            )}
            <p className="text-xs text-blue-600 mt-1">
              Describe your issue below — we&apos;ll include the booking reference automatically.
            </p>
          </div>
        </div>
      )}

      {/* Category */}
      <div className="mb-6">
        <CategorySelector value={category} onChange={setCategory} />
        {errors.category && (
          <p className="text-sm text-red-500 mt-1">{errors.category}</p>
        )}
      </div>

      {/* Priority */}
      <div className="mb-6">
        <PrioritySelector value={priority} onChange={setPriority} />
      </div>

      {/* Subject */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-nilin-charcoal mb-2">
          Subject <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Brief summary of your issue"
          maxLength={200}
          className={cn(
            'w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-nilin-coral/30',
            errors.subject ? 'border-red-300 bg-red-50' : 'border-gray-200'
          )}
        />
        <div className="flex items-center justify-between mt-1">
          {errors.subject ? (
            <p className="text-sm text-red-500">{errors.subject}</p>
          ) : (
            <span />
          )}
          <span className="text-xs text-gray-400">{subject.length}/200</span>
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-nilin-charcoal mb-2">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Please describe your issue in detail. Include any relevant information such as booking numbers, error messages, or screenshots."
          rows={6}
          maxLength={5000}
          className={cn(
            'w-full px-4 py-3 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-nilin-coral/30',
            errors.description ? 'border-red-300 bg-red-50' : 'border-gray-200'
          )}
        />
        <div className="flex items-center justify-between mt-1">
          {errors.description ? (
            <p className="text-sm text-red-500">{errors.description}</p>
          ) : (
            <span />
          )}
          <span className="text-xs text-gray-400">{description.length}/5000</span>
        </div>
      </div>

      {/* Tips */}
      <div className="mb-6 p-4 bg-blue-50 rounded-xl">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Tips for faster resolution:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-600">
              <li>Include your booking number if applicable</li>
              <li>Describe the steps that led to the issue</li>
              <li>Mention any error messages you saw</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3">
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
          disabled={!isValid || submitting}
          className={cn(
            'flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2',
            isValid && !submitting
              ? 'bg-gradient-to-r from-nilin-rose to-nilin-coral text-white hover:shadow-lg'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              Submit Ticket
            </>
          )}
        </button>
      </div>
    </form>
  );
};

export default TicketForm;
