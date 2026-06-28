import authService from './AuthService';

// ============================================
// TYPES & INTERFACES
// ============================================

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'escalated' | 'closed';
export type ResolutionType = 'refund' | 'partial_refund' | 'no_action' | 'provider_warning' | 'provider_suspended';
export type AppealStatus = 'none' | 'pending' | 'approved' | 'rejected';
export type RefundStatus = 'pending' | 'approved' | 'processing' | 'completed' | 'rejected' | 'failed';
export type RefundType = 'full' | 'partial' | 'prorated' | 'chargeback' | 'dispute';

// Escalation trigger types
export type EscalationTrigger =
  | 'high_amount'
  | 'unresolved_too_long'
  | 'banned_user_involved'
  | 'suspended_user_involved'
  | 'repeat_disputes'
  | 'repeat_refunds'
  | 'chargeback';

export interface DisputeParty {
  userId: string;
  role: 'customer' | 'provider';
  name: string;
  email: string;
}

export interface DisputeEvidence {
  _id: string;
  submittedBy: string;
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

export interface DisputeResolution {
  type: ResolutionType;
  amount?: number;
  reason: string;
  notes?: string;
  resolvedBy: string;
  resolvedAt: string;
}

export interface DisputeTimeline {
  action: string;
  performedBy: string;
  performedByRole: 'customer' | 'provider' | 'admin' | 'system';
  timestamp: string;
  details?: string;
  previousStatus?: DisputeStatus;
  newStatus?: DisputeStatus;
}

export interface DisputeAppeal {
  status: AppealStatus;
  reason: string;
  submittedBy: string;
  submittedAt: string;
  deadline: string;
  reviewedBy?: string;
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
  initiator: DisputeParty;
  respondent: DisputeParty;
  reason: string;
  description: string;
  category: 'service_quality' | 'no_show' | 'damage' | 'billing' | 'cancellation' | 'communication' | 'other';
  status: DisputeStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  evidence: DisputeEvidence[];
  messages: DisputeMessage[];
  resolution?: DisputeResolution;
  appeal?: DisputeAppeal;
  assignedTo?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  assignedAt?: string;
  escalatedAt?: string;
  escalationReason?: string;
  escalationTriggers?: EscalationTrigger[];
  timeline: DisputeTimeline[];
  bookingReference?: BookingReference;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRequest {
  _id: string;
  refundNumber: string;
  bookingId: {
    _id: string;
    bookingNumber: string;
    pricing?: {
      totalAmount: number;
      currency: string;
    };
    scheduledDate?: string;
  };
  requestedBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  processedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  amount: number;
  originalAmount: number;
  reason: string;
  description?: string;
  status: RefundStatus;
  type: RefundType;
  stripeRefundId?: string;
  stripeChargeId?: string;
  disputeId?: string;
  refundPercentage?: number;
  processingNotes?: string;
  rejectionReason?: string;
  approvedAt?: string;
  processedAt?: string;
  completedAt?: string;
  escalatedAt?: string;
  escalationTriggers?: EscalationTrigger[];
  isEscalated?: boolean;
  timeline: Array<{
    action: string;
    performedBy: string;
    performedByRole: string;
    timestamp: string;
    details?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDisputeData {
  bookingId: string;
  reason: string;
  description: string;
  category: 'service_quality' | 'no_show' | 'damage' | 'billing' | 'cancellation' | 'communication' | 'other';
  evidence?: Array<{
    type: 'image' | 'document' | 'text';
    url?: string;
    description?: string;
  }>;
}

export interface CreateRefundData {
  bookingId: string;
  amount?: number;
  reason: string;
  description?: string;
  type?: RefundType;
  disputeId?: string;
}

export interface ResolveDisputeData {
  resolutionType: ResolutionType;
  amount?: number;
  reason: string;
  notes?: string;
}

export interface ProcessRefundData {
  action: 'approve' | 'reject';
  amount?: number;
  notes?: string;
  rejectionReason?: string;
}

export interface DisputeFilters {
  status?: DisputeStatus;
  category?: string;
  priority?: string;
  assignedTo?: string;
  initiatorId?: string;
  respondentId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface RefundFilters {
  status?: RefundStatus;
  type?: RefundType;
  bookingId?: string;
  disputeId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
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
  statusBreakdown?: Record<string, number>;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface DisputeStats {
  totalDisputes: number;
  openDisputes: number;
  escalatedDisputes: number;
  avgResponseTimeHours: number;
  byStatus: Record<DisputeStatus, number>;
  byCategory: Record<string, number>;
  byResolution: Record<string, { count: number; totalAmount: number }>;
  avgResolutionTimeHours: number;
}

export interface RefundStats {
  totalRefunds: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  completedCount: number;
  completedAmount: number;
  rejectedCount: number;
  avgRefundAmount: number;
  byStatus: Record<RefundStatus, { count: number; amount: number }>;
  byType: Record<RefundType, { count: number; amount: number }>;
}

// ============================================
// DISPUTE API SERVICE
// ============================================

class DisputeApiService {

  // ========================================
  // DISPUTE METHODS
  // ========================================

  /**
   * Create a new dispute
   */
  async createDispute(data: CreateDisputeData): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.post<ApiResponse<Dispute>>('/disputes', data);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to create dispute');
    }
  }

  /**
   * Get dispute by ID
   */
  async getDispute(disputeId: string): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.get<ApiResponse<Dispute>>(`/disputes/${disputeId}`);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to get dispute');
    }
  }

  /**
   * Get my dispute (user's own dispute)
   */
  async getMyDispute(disputeId: string): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.get<ApiResponse<Dispute>>(`/disputes/my/detail/${disputeId}`);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to get dispute');
    }
  }

  /**
   * List disputes (admin)
   */
  async listDisputes(filters?: DisputeFilters): Promise<PaginatedResponse<Dispute>> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }

      const url = `/disputes${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await authService.get<ApiResponse<Dispute[]> & { pagination: PaginatedResponse<Dispute>['pagination'] }>(url);
      return {
        data: response.data || [],
        pagination: response.pagination || { page: 1, limit: 20, total: 0, pages: 0, hasMore: false },
      };
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to list disputes');
    }
  }

  /**
   * Get my disputes
   */
  async getMyDisputes(filters?: { status?: DisputeStatus; page?: number; limit?: number }): Promise<PaginatedResponse<Dispute>> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }

      const url = `/disputes/my${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await authService.get<
        ApiResponse<Dispute[]> & {
          pagination: PaginatedResponse<Dispute>['pagination'];
          statusBreakdown?: Record<string, number>;
        }
      >(url);
      return {
        data: response.data || [],
        pagination: response.pagination || { page: 1, limit: 20, total: 0, pages: 0, hasMore: false },
        statusBreakdown: response.statusBreakdown,
      };
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to get disputes');
    }
  }

  /**
   * Get unassigned disputes
   */
  async getUnassignedDisputes(limit?: number): Promise<ApiResponse<Dispute[]>> {
    try {
      const url = `/disputes/unassigned${limit ? `?limit=${limit}` : ''}`;
      const response = await authService.get<ApiResponse<Dispute[]>>(url);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to get unassigned disputes');
    }
  }

  /**
   * Get dispute statistics
   */
  async getDisputeStats(startDate?: string, endDate?: string): Promise<ApiResponse<DisputeStats>> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const url = `/disputes/stats${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await authService.get<ApiResponse<DisputeStats>>(url);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to get dispute statistics');
    }
  }

  /**
   * Add evidence to dispute
   */
  async addEvidence(disputeId: string, evidence: { type: 'image' | 'document' | 'text'; url?: string; description?: string }): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.post<ApiResponse<Dispute>>(`/disputes/${disputeId}/evidence`, evidence);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to add evidence');
    }
  }

  /**
   * Add message to dispute
   */
  async addMessage(disputeId: string, message: string): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.post<ApiResponse<Dispute>>(`/disputes/${disputeId}/messages`, { message });
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to add message');
    }
  }

  /**
   * Assign dispute to admin
   */
  async assignDispute(disputeId: string): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.post<ApiResponse<Dispute>>(`/disputes/${disputeId}/assign`);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to assign dispute');
    }
  }

  /**
   * Escalate dispute
   */
  async escalateDispute(disputeId: string, reason: string): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.post<ApiResponse<Dispute>>(`/disputes/${disputeId}/escalate`, { reason });
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to escalate dispute');
    }
  }

  /**
   * Update dispute status
   */
  async updateDisputeStatus(disputeId: string, status: DisputeStatus, reason?: string): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.patch<ApiResponse<Dispute>>(`/disputes/${disputeId}/status`, { status, reason });
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to update status');
    }
  }

  /**
   * Resolve dispute
   */
  async resolveDispute(disputeId: string, data: ResolveDisputeData): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.post<ApiResponse<Dispute>>(`/disputes/${disputeId}/resolve`, data);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to resolve dispute');
    }
  }

  /**
   * Close dispute
   */
  async closeDispute(disputeId: string, reason?: string): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.post<ApiResponse<Dispute>>(`/disputes/${disputeId}/close`, { reason });
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to close dispute');
    }
  }

  /**
   * Update admin notes
   */
  async updateAdminNotes(disputeId: string, notes: string): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.patch<ApiResponse<Dispute>>(`/disputes/${disputeId}/notes`, { notes });
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to update notes');
    }
  }

  // ========================================
  // APPEAL METHODS
  // ========================================

  /**
   * Submit appeal for a resolved dispute
   */
  async submitAppeal(disputeId: string, reason: string): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.post<ApiResponse<Dispute>>(`/disputes/${disputeId}/appeal`, { reason });
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to submit appeal');
    }
  }

  /**
   * List pending appeals (admin)
   */
  async getPendingAppeals(page?: number, limit?: number): Promise<PaginatedResponse<Dispute>> {
    try {
      const params = new URLSearchParams();
      if (page) params.append('page', String(page));
      if (limit) params.append('limit', String(limit));

      const url = `/disputes/admin/appeals${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await authService.get<ApiResponse<Dispute[]> & { pagination: PaginatedResponse<Dispute>['pagination'] }>(url);
      return {
        data: response.data || [],
        pagination: response.pagination || { page: 1, limit: 20, total: 0, pages: 0, hasMore: false },
      };
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to get pending appeals');
    }
  }

  /**
   * Review appeal (approve/reject)
   */
  async reviewAppeal(disputeId: string, action: 'approve' | 'reject', reviewNotes?: string): Promise<ApiResponse<Dispute>> {
    try {
      const response = await authService.post<ApiResponse<Dispute>>(`/disputes/admin/${disputeId}/appeal-review`, { action, reviewNotes });
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to review appeal');
    }
  }

  /**
   * Get appeal deadline status
   */
  getAppealDeadlineStatus(deadline: string): { canAppeal: boolean; daysRemaining: number; isExpired: boolean } {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return {
      canAppeal: daysRemaining > 0,
      daysRemaining: Math.max(0, daysRemaining),
      isExpired: daysRemaining <= 0,
    };
  }

  /**
   * Get appeal status color
   */
  getAppealStatusColor(status: AppealStatus): string {
    const colors: Record<string, string> = {
      none: 'bg-gray-100 text-gray-800',
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  /**
   * Get appeal status label
   */
  getAppealStatusLabel(status: AppealStatus): string {
    const labels: Record<string, string> = {
      none: 'No Appeal',
      pending: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected',
    };
    return labels[status] || status;
  }

  // ========================================
  // REFUND METHODS
  // ========================================

  /**
   * Create refund request
   */
  async createRefund(data: CreateRefundData): Promise<ApiResponse<RefundRequest>> {
    try {
      const response = await authService.post<ApiResponse<RefundRequest>>('/disputes/refunds', data);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to create refund request');
    }
  }

  /**
   * Get refund by ID
   */
  async getRefund(refundId: string): Promise<ApiResponse<RefundRequest>> {
    try {
      const response = await authService.get<ApiResponse<RefundRequest>>(`/disputes/refunds/${refundId}`);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to get refund');
    }
  }

  /**
   * List refunds
   */
  async listRefunds(filters?: RefundFilters): Promise<PaginatedResponse<RefundRequest>> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }

      const url = `/disputes/refunds${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await authService.get<ApiResponse<RefundRequest[]> & { pagination: PaginatedResponse<RefundRequest>['pagination'] }>(url);
      return {
        data: response.data || [],
        pagination: response.pagination || { page: 1, limit: 20, total: 0, pages: 0, hasMore: false },
      };
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to list refunds');
    }
  }

  /**
   * Get my refunds
   */
  async getMyRefunds(filters?: { status?: RefundStatus; page?: number; limit?: number }): Promise<PaginatedResponse<RefundRequest>> {
    try {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            params.append(key, String(value));
          }
        });
      }

      const url = `/disputes/refunds/my${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await authService.get<ApiResponse<RefundRequest[]> & { pagination: PaginatedResponse<RefundRequest>['pagination'] }>(url);
      return {
        data: response.data || [],
        pagination: response.pagination || { page: 1, limit: 20, total: 0, pages: 0, hasMore: false },
      };
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to get refunds');
    }
  }

  /**
   * Get pending refunds
   */
  async getPendingRefunds(limit?: number): Promise<ApiResponse<RefundRequest[]>> {
    try {
      const url = `/disputes/refunds/pending${limit ? `?limit=${limit}` : ''}`;
      const response = await authService.get<ApiResponse<RefundRequest[]>>(url);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to get pending refunds');
    }
  }

  /**
   * Get refund statistics
   */
  async getRefundStats(startDate?: string, endDate?: string): Promise<ApiResponse<RefundStats>> {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const url = `/disputes/refunds/stats${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await authService.get<ApiResponse<RefundStats>>(url);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to get refund statistics');
    }
  }

  /**
   * Process refund (approve/reject)
   */
  async processRefund(refundId: string, data: ProcessRefundData): Promise<ApiResponse<RefundRequest>> {
    try {
      const response = await authService.post<ApiResponse<RefundRequest>>(`/disputes/refunds/${refundId}/process`, data);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to process refund');
    }
  }

  /**
   * Cancel refund request
   */
  async cancelRefund(refundId: string): Promise<ApiResponse<RefundRequest>> {
    try {
      const response = await authService.post<ApiResponse<RefundRequest>>(`/disputes/refunds/${refundId}/cancel`);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to cancel refund');
    }
  }

  /**
   * Get refunds by booking
   */
  async getRefundsByBooking(bookingId: string): Promise<ApiResponse<RefundRequest[]>> {
    try {
      const response = await authService.get<ApiResponse<RefundRequest[]>>(`/disputes/refunds/booking/${bookingId}`);
      return response;
    } catch (error: any) {
      throw new Error(error?.response?.data?.message || error?.message || 'Failed to get refunds');
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * Get status color for UI
   */
  getStatusColor(status: DisputeStatus | RefundStatus): string {
    const colors: Record<string, string> = {
      open: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-yellow-100 text-yellow-800',
      under_review: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      processing: 'bg-purple-100 text-purple-800',
      resolved: 'bg-green-100 text-green-800',
      completed: 'bg-green-100 text-green-800',
      escalated: 'bg-red-100 text-red-800',
      rejected: 'bg-gray-100 text-gray-800',
      failed: 'bg-red-100 text-red-800',
      closed: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  /**
   * Get status label for display
   */
  getStatusLabel(status: DisputeStatus | RefundStatus): string {
    const labels: Record<string, string> = {
      open: 'Open',
      pending: 'Pending',
      under_review: 'Under Review',
      approved: 'Approved',
      processing: 'Processing',
      resolved: 'Resolved',
      completed: 'Completed',
      escalated: 'Escalated',
      rejected: 'Rejected',
      failed: 'Failed',
      closed: 'Closed',
    };
    return labels[status] || status;
  }

  /**
   * Get category label for display
   */
  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      service_quality: 'Service Quality',
      no_show: 'No Show',
      damage: 'Damage',
      billing: 'Billing Issue',
      cancellation: 'Cancellation',
      communication: 'Communication',
      other: 'Other',
    };
    return labels[category] || category;
  }

  /**
   * Get resolution type label
   */
  getResolutionLabel(type: ResolutionType): string {
    const labels: Record<string, string> = {
      refund: 'Full Refund',
      partial_refund: 'Partial Refund',
      no_action: 'No Action',
      provider_warning: 'Provider Warning',
      provider_suspended: 'Provider Suspended',
    };
    return labels[type] || type;
  }

  /**
   * Get escalation trigger description
   */
  getEscalationTriggerDescription(trigger: EscalationTrigger): string {
    const descriptions: Record<EscalationTrigger, string> = {
      high_amount: 'High transaction amount',
      unresolved_too_long: 'Unresolved too long',
      banned_user_involved: 'Banned user involved',
      suspended_user_involved: 'Suspended user involved',
      repeat_disputes: 'Repeat disputes between parties',
      repeat_refunds: 'Repeat refunds from customer',
      chargeback: 'Chargeback initiated',
    };
    return descriptions[trigger] || trigger;
  }

  /**
   * Get escalation trigger color
   */
  getEscalationTriggerColor(trigger: EscalationTrigger): string {
    const colors: Record<EscalationTrigger, string> = {
      high_amount: 'bg-orange-100 text-orange-800',
      unresolved_too_long: 'bg-yellow-100 text-yellow-800',
      banned_user_involved: 'bg-red-100 text-red-800',
      suspended_user_involved: 'bg-red-100 text-red-800',
      repeat_disputes: 'bg-purple-100 text-purple-800',
      repeat_refunds: 'bg-purple-100 text-purple-800',
      chargeback: 'bg-red-100 text-red-800',
    };
    return colors[trigger] || 'bg-gray-100 text-gray-800';
  }

  /**
   * Format currency amount
   */
  formatAmount(amount: number, currency: string = 'AED'): string {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency,
    }).format(amount);
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Format datetime for display
   */
  formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

// Export singleton instance
export const disputeApi = new DisputeApiService();
export default disputeApi;
