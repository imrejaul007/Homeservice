import React, { useState, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  ChevronRight,
  Search,
  Filter,
  Upload,
  FileText,
  Image,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import authService from '../../services/AuthService';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'escalated' | 'closed';
export type DisputeCategory = 'service_quality' | 'no_show' | 'damage' | 'billing' | 'cancellation' | 'communication' | 'other';
export type ResolutionType = 'refund' | 'partial_refund' | 'no_action' | 'provider_warning' | 'provider_suspended';
export type AppealStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface DisputeEvidence {
  _id: string;
  type: 'image' | 'document' | 'text';
  url?: string;
  description?: string;
  submittedAt: string;
}

export interface DisputeMessage {
  _id: string;
  senderId: string;
  senderRole: 'customer' | 'provider' | 'admin';
  message: string;
  timestamp: string;
  isSystemMessage: boolean;
}

export interface DisputeTimeline {
  action: string;
  performedBy: string;
  performedByRole: string;
  timestamp: string;
  details?: string;
}

export interface DisputeAppeal {
  status: AppealStatus;
  reason: string;
  submittedAt: string;
  deadline: string;
  reviewedAt?: string;
  reviewNotes?: string;
  originalResolution?: {
    type: ResolutionType;
    amount?: number;
    reason: string;
  };
}

export interface BookingReference {
  bookingNumber: string;
  serviceName: string;
  scheduledDate: string;
  totalAmount: number;
  currency: string;
}

export interface Dispute {
  _id: string;
  disputeNumber: string;
  bookingId: string;
  reason: string;
  description: string;
  category: DisputeCategory;
  status: DisputeStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  evidence: DisputeEvidence[];
  messages: DisputeMessage[];
  resolution?: {
    type: ResolutionType;
    amount?: number;
    reason: string;
    notes?: string;
    resolvedAt: string;
  };
  appeal?: DisputeAppeal;
  timeline: DisputeTimeline[];
  bookingReference?: BookingReference;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}

// ============================================
// API SERVICE
// ============================================

const disputeApi = {
  async getMyDisputes(filters?: { status?: DisputeStatus; page?: number; limit?: number }): Promise<PaginatedResponse<Dispute>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const response = await authService.get<{ success: boolean; data: Dispute[]; pagination: PaginatedResponse<Dispute>['pagination'] }>(
      `/disputes/my${params.toString() ? `?${params.toString()}` : ''}`
    );
    return {
      data: response.data || [],
      pagination: response.pagination || { page: 1, limit: 20, total: 0, pages: 0, hasMore: false },
    };
  },

  async createDispute(data: {
    bookingId: string;
    reason: string;
    description: string;
    category: DisputeCategory;
    evidence?: Array<{ type: string; url?: string; description?: string }>;
  }): Promise<Dispute> {
    const response = await authService.post<{ success: boolean; data: Dispute }>('/disputes', data);
    return response.data;
  },

  async addEvidence(disputeId: string, evidence: { type: string; url?: string; description?: string }): Promise<Dispute> {
    const response = await authService.post<{ success: boolean; data: Dispute }>(`/disputes/${disputeId}/evidence`, evidence);
    return response.data;
  },

  async addMessage(disputeId: string, message: string): Promise<Dispute> {
    const response = await authService.post<{ success: boolean; data: Dispute }>(`/disputes/${disputeId}/messages`, { message });
    return response.data;
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getStatusConfig = (status: DisputeStatus) => {
  const configs: Record<DisputeStatus, { color: string; bgColor: string; label: string; icon: React.ReactNode }> = {
    open: { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Open', icon: <Clock className="h-4 w-4" /> },
    under_review: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Under Review', icon: <Clock className="h-4 w-4" /> },
    resolved: { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Resolved', icon: <CheckCircle className="h-4 w-4" /> },
    escalated: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Escalated', icon: <AlertTriangle className="h-4 w-4" /> },
    closed: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Closed', icon: <XCircle className="h-4 w-4" /> },
  };
  return configs[status];
};

const getCategoryConfig = (category: DisputeCategory) => {
  const configs: Record<DisputeCategory, { icon: string; label: string }> = {
    service_quality: { icon: '⭐', label: 'Service Quality' },
    no_show: { icon: '👤', label: 'No Show' },
    damage: { icon: '💔', label: 'Damage' },
    billing: { icon: '💰', label: 'Billing' },
    cancellation: { icon: '🚫', label: 'Cancellation' },
    communication: { icon: '💬', label: 'Communication' },
    other: { icon: '📝', label: 'Other' },
  };
  return configs[category];
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays < 1) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatCurrency = (amount: number, currency: string = 'AED'): string => {
  return new Intl.NumberFormat('en-AE', { style: 'currency', currency }).format(amount);
};

// ============================================
// DISPUTE CARD COMPONENT
// ============================================

const DisputeCard: React.FC<{
  dispute: Dispute;
  onClick: () => void;
}> = ({ dispute, onClick }) => {
  const statusConfig = getStatusConfig(dispute.status);
  const categoryConfig = getCategoryConfig(dispute.category);

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-xl p-4 text-left border border-nilin-border hover:border-nilin-coral/50 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">{categoryConfig.icon}</span>
            <span className="font-mono text-sm text-gray-500">{dispute.disputeNumber}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full flex items-center gap-1', statusConfig.bgColor, statusConfig.color)}>
              {statusConfig.icon}
              {statusConfig.label}
            </span>
          </div>

          {/* Reason */}
          <h3 className="font-medium text-nilin-charcoal mb-1 truncate">{dispute.reason}</h3>

          {/* Description */}
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">{dispute.description}</p>

          {/* Booking Reference */}
          {dispute.bookingReference && (
            <div className="bg-gray-50 rounded-lg p-2 mb-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">{dispute.bookingReference.bookingNumber}</span>
                <span className="font-medium text-nilin-charcoal">
                  {formatCurrency(dispute.bookingReference.totalAmount, dispute.bookingReference.currency)}
                </span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Filed {formatDate(dispute.createdAt)}</span>
            {dispute.evidence.length > 0 && (
              <span className="flex items-center gap-1">
                <Upload className="h-3 w-3" />
                {dispute.evidence.length} files
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
      </div>
    </button>
  );
};

// ============================================
// MAIN DISPUTE CENTER COMPONENT
// ============================================

export const DisputeCenter: React.FC<{
  className?: string;
  onSelectDispute?: (dispute: Dispute) => void;
  onCreateDispute?: () => void;
}> = ({ className, onSelectDispute, onCreateDispute }) => {
  // State
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<DisputeStatus | undefined>(undefined);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasMore: false,
  });

  // Fetch disputes
  const fetchDisputes = useCallback(async (status?: DisputeStatus) => {
    setLoading(true);
    setError(null);

    try {
      const response = await disputeApi.getMyDisputes({ status, page: 1 });
      setDisputes(response.data);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Failed to fetch disputes:', err);
      setError('Failed to load disputes. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  React.useEffect(() => {
    fetchDisputes(statusFilter);
  }, [fetchDisputes, statusFilter]);

  // Handle status filter change
  const handleStatusChange = (status: DisputeStatus | undefined) => {
    setStatusFilter(status);
  };

  // Status options
  const statusOptions = [
    { value: undefined, label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'escalated', label: 'Escalated' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ];

  return (
    <div className={cn('flex flex-col h-full bg-gray-50', className)}>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-nilin-coral" />
            <h2 className="font-semibold text-nilin-charcoal">My Disputes</h2>
            <span className="text-sm text-gray-500">({pagination.total})</span>
          </div>
          <button
            onClick={onCreateDispute}
            className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white text-sm rounded-lg hover:bg-nilin-coral/90 transition-colors"
          >
            Open Dispute
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {statusOptions.map((option) => (
            <button
              key={option.value || 'all'}
              onClick={() => handleStatusChange(option.value as DisputeStatus | undefined)}
              className={cn(
                'px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors',
                statusFilter === option.value
                  ? 'bg-nilin-coral text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dispute List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-nilin-coral animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => fetchDisputes(statusFilter)}
              className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1 mx-auto"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && disputes.length === 0 && (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-1">No disputes found</p>
            <p className="text-sm text-gray-400">
              {statusFilter
                ? 'Try a different filter'
                : 'If you have an issue with a booking, you can open a dispute'}
            </p>
          </div>
        )}

        {/* Disputes */}
        {!loading && !error && disputes.map((dispute) => (
          <DisputeCard
            key={dispute._id}
            dispute={dispute}
            onClick={() => onSelectDispute?.(dispute)}
          />
        ))}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="p-4 border-t border-gray-100 bg-white flex-shrink-0">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              disabled={pagination.page === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              disabled={!pagination.hasMore}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisputeCenter;
