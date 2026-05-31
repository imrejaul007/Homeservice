import React, { useState, useEffect, useCallback } from 'react';
import {
  Ticket,
  Clock,
  User,
  ChevronRight,
  Search,
  Filter,
  Plus,
  AlertCircle,
  CheckCircle,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import authService from '../../services/AuthService';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type TicketStatus = 'open' | 'in_progress' | 'pending_response' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketCategory = 'technical' | 'billing' | 'account' | 'service' | 'other';

export interface TicketMessage {
  _id: string;
  sender: string;
  senderType: 'customer' | 'admin';
  senderName?: string;
  message: string;
  createdAt: string;
}

export interface Ticket {
  _id: string;
  id?: string;
  ticketNumber: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  userName?: string;
  userEmail?: string;
  assignedTo?: string;
  assignedToName?: string;
  messages?: TicketMessage[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  search?: string;
  page?: number;
  limit?: number;
  isAdmin?: boolean;
}

export interface PaginatedResponse<T> {
  tickets: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface TicketListProps {
  className?: string;
  onSelectTicket?: (ticket: Ticket) => void;
  showCreateButton?: boolean;
  onCreateTicket?: () => void;
  isAdmin?: boolean;
}

// ============================================
// API SERVICE
// ============================================

const ticketApi = {
  async getTickets(filters?: TicketFilters): Promise<PaginatedResponse<Ticket>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.page) params.append('page', String(filters.page));
    if (filters?.limit) params.append('limit', String(filters.limit));

    const endpoint = filters?.isAdmin ? '/support/admin/tickets' : '/support/tickets';
    const response = await authService.get<{ success: boolean; data: PaginatedResponse<Ticket> }>(
      `${endpoint}${params.toString() ? `?${params.toString()}` : ''}`
    );
    return response.data;
  },

  async getTicket(ticketId: string): Promise<Ticket> {
    const response = await authService.get<{ success: boolean; data: Ticket }>(
      `/support/tickets/${ticketId}`
    );
    return response.data;
  },
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

const getStatusConfig = (status: TicketStatus) => {
  const configs: Record<TicketStatus, { color: string; bgColor: string; label: string }> = {
    open: { color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Open' },
    in_progress: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'In Progress' },
    pending_response: { color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Pending' },
    resolved: { color: 'text-green-600', bgColor: 'bg-green-100', label: 'Resolved' },
    closed: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Closed' },
  };
  return configs[status];
};

const getPriorityConfig = (priority: TicketPriority) => {
  const configs: Record<TicketPriority, { color: string; bgColor: string; label: string }> = {
    low: { color: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Low' },
    medium: { color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Medium' },
    high: { color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'High' },
    urgent: { color: 'text-red-600', bgColor: 'bg-red-100', label: 'Urgent' },
  };
  return configs[priority];
};

const getCategoryConfig = (category: TicketCategory) => {
  const configs: Record<TicketCategory, { icon: string; label: string }> = {
    technical: { icon: '⚙️', label: 'Technical' },
    billing: { icon: '💳', label: 'Billing' },
    account: { icon: '🔐', label: 'Account' },
    service: { icon: '🛠️', label: 'Service' },
    other: { icon: '📝', label: 'Other' },
  };
  return configs[category];
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// ============================================
// TICKET CARD COMPONENT
// ============================================

const TicketCard: React.FC<{
  ticket: Ticket;
  onClick: () => void;
}> = ({ ticket, onClick }) => {
  const statusConfig = getStatusConfig(ticket.status);
  const priorityConfig = getPriorityConfig(ticket.priority);
  const categoryConfig = getCategoryConfig(ticket.category);

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
            <span className="text-xs font-mono text-gray-500">{ticket.ticketNumber}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded-full', priorityConfig.bgColor, priorityConfig.color)}>
              {priorityConfig.label}
            </span>
          </div>

          {/* Subject */}
          <h3 className="font-medium text-nilin-charcoal mb-1 truncate">{ticket.subject}</h3>

          {/* Preview */}
          <p className="text-sm text-gray-500 line-clamp-2 mb-3">
            {ticket.description}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatDate(ticket.createdAt)}</span>
            </div>
            {ticket.assignedToName && (
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                <span>{ticket.assignedToName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex flex-col items-end gap-2">
          <span className={cn('text-xs px-2 py-1 rounded-full', statusConfig.bgColor, statusConfig.color)}>
            {statusConfig.label}
          </span>
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </div>
      </div>
    </button>
  );
};

// ============================================
// FILTER DROPDOWN COMPONENT
// ============================================

const FilterDropdown: React.FC<{
  label: string;
  value: string | undefined;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string | undefined) => void;
}> = ({ label, value, options, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors',
          value
            ? 'bg-nilin-coral/10 border-nilin-coral/30 text-nilin-coral'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
        )}
      >
        {label}
        {value && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            className="ml-1 hover:text-red-500"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 min-w-[150px]">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm hover:bg-gray-50',
                  value === option.value && 'bg-nilin-coral/10 text-nilin-coral'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

// ============================================
// MAIN TICKET LIST COMPONENT
// ============================================

export const TicketList: React.FC<TicketListProps> = ({
  className,
  onSelectTicket,
  showCreateButton = true,
  onCreateTicket,
  isAdmin = false,
}) => {
  // State
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
    hasNext: false,
    hasPrev: false,
  });
  const [filters, setFilters] = useState<TicketFilters>({
    status: undefined,
    priority: undefined,
    category: undefined,
    search: '',
    isAdmin,
  });

  // Fetch tickets
  const fetchTickets = useCallback(async (filterParams?: TicketFilters) => {
    setLoading(true);
    setError(null);

    try {
      const response = await ticketApi.getTickets({
        ...filterParams,
        page: filterParams?.page || 1,
        limit: 20,
      });

      setTickets(response.tickets);
      setPagination(response.pagination);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
      setError('Failed to load tickets. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTickets(filters);
  }, [filters]);

  // Handle filter changes
  const handleStatusFilter = (status: string | undefined) => {
    setFilters((prev) => ({ ...prev, status: status as TicketStatus | undefined, page: 1 }));
  };

  const handlePriorityFilter = (priority: string | undefined) => {
    setFilters((prev) => ({ ...prev, priority: priority as TicketPriority | undefined, page: 1 }));
  };

  const handleCategoryFilter = (category: string | undefined) => {
    setFilters((prev) => ({ ...prev, category: category as TicketCategory | undefined, page: 1 }));
  };

  const handleSearch = (search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  // Status options
  const statusOptions = [
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'pending_response', label: 'Pending' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
  ];

  // Priority options
  const priorityOptions = [
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  // Category options
  const categoryOptions = [
    { value: 'technical', label: 'Technical' },
    { value: 'billing', label: 'Billing' },
    { value: 'account', label: 'Account' },
    { value: 'service', label: 'Service' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-nilin-coral" />
            <h2 className="font-semibold text-nilin-charcoal">Support Tickets</h2>
            <span className="text-sm text-gray-500">({pagination.total})</span>
          </div>
          {showCreateButton && (
            <button
              onClick={onCreateTicket}
              className="flex items-center gap-2 px-4 py-2 bg-nilin-coral text-white text-sm rounded-lg hover:bg-nilin-coral/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Ticket
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={filters.search || ''}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <FilterDropdown
            label="Status"
            value={filters.status}
            options={statusOptions}
            onChange={handleStatusFilter}
          />
          <FilterDropdown
            label="Priority"
            value={filters.priority}
            options={priorityOptions}
            onChange={handlePriorityFilter}
          />
          <FilterDropdown
            label="Category"
            value={filters.category}
            options={categoryOptions}
            onChange={handleCategoryFilter}
          />
          {(filters.status || filters.priority || filters.category || filters.search) && (
            <button
              onClick={() => setFilters({ status: undefined, priority: undefined, category: undefined, search: '', page: 1 })}
              className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-nilin-coral animate-spin" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-700">{error}</p>
            <button
              onClick={() => fetchTickets(filters)}
              className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && tickets.length === 0 && (
          <div className="text-center py-12">
            <Ticket className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-1">No tickets found</p>
            <p className="text-sm text-gray-400">
              {filters.search || filters.status || filters.priority || filters.category
                ? 'Try adjusting your filters'
                : 'Create your first support ticket'}
            </p>
          </div>
        )}

        {/* Tickets */}
        {!loading && !error && tickets.map((ticket) => (
          <TicketCard
            key={ticket._id || ticket.id}
            ticket={ticket}
            onClick={() => onSelectTicket?.(ticket)}
          />
        ))}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.pages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrev}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg border',
                pagination.hasPrev
                  ? 'border-gray-200 hover:bg-gray-50'
                  : 'border-gray-100 text-gray-300 cursor-not-allowed'
              )}
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNext}
              className={cn(
                'px-3 py-1.5 text-sm rounded-lg border',
                pagination.hasNext
                  ? 'border-gray-200 hover:bg-gray-50'
                  : 'border-gray-100 text-gray-300 cursor-not-allowed'
              )}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketList;
