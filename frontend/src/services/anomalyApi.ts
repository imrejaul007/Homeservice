import { api } from './api';

// ============================================
// Types & Interfaces
// ============================================

export type AnomalyType = 'fraud' | 'booking' | 'payment' | 'behavior';
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';
export type EntityType = 'user' | 'provider' | 'booking' | 'payment';
export type AnomalyStatus = 'pending' | 'investigating' | 'resolved' | 'false_positive';

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  entityType: EntityType;
  entityId: string;
  description: string;
  evidence: string[];
  confidence: number;
  detectedAt: string;
  status: AnomalyStatus;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  metadata?: Record<string, any>;
}

export interface AnomalyFilters {
  type?: AnomalyType;
  severity?: AnomalySeverity;
  status?: AnomalyStatus;
  entityType?: EntityType;
  entityId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AnomalyStats {
  total: number;
  byType: Record<AnomalyType, number>;
  bySeverity: Record<AnomalySeverity, number>;
  byStatus: Record<AnomalyStatus, number>;
  recentCount: number;
  criticalCount: number;
  resolvedToday: number;
}

export interface BehavioralScore {
  entityId: string;
  entityType: EntityType;
  overallScore: number;
  factors: Array<{
    name: string;
    score: number;
    weight: number;
  }>;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastUpdated: string;
}

export interface PaginatedAnomalies {
  data: Anomaly[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ============================================
// API Methods
// ============================================

export const anomalyApi = {
  // ========================================
  // Anomaly CRUD
  // ========================================

  /**
   * Get paginated list of anomalies with filters
   */
  listAnomalies: async (filters?: AnomalyFilters): Promise<PaginatedAnomalies> => {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.type) params.append('type', filters.type);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.status) params.append('status', filters.status);
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.entityId) params.append('entityId', filters.entityId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.page) params.append('page', String(filters.page));
      if (filters.limit) params.append('limit', String(filters.limit));
    }

    const response = await api.get(`/admin/anomalies?${params.toString()}`);
    return response.data;
  },

  /**
   * Get single anomaly by ID
   */
  getAnomaly: async (anomalyId: string): Promise<Anomaly> => {
    const response = await api.get(`/admin/anomalies/${anomalyId}`);
    return response.data.data;
  },

  /**
   * Update anomaly status
   */
  updateAnomalyStatus: async (
    anomalyId: string,
    status: AnomalyStatus,
    resolution?: string
  ): Promise<Anomaly> => {
    const response = await api.patch(`/admin/anomalies/${anomalyId}/status`, {
      status,
      resolution,
    });
    return response.data.data;
  },

  /**
   * Bulk update anomaly statuses
   */
  bulkUpdateStatus: async (
    anomalyIds: string[],
    status: AnomalyStatus,
    resolution?: string
  ): Promise<{ updated: number }> => {
    const response = await api.post('/admin/anomalies/bulk-update', {
      anomalyIds,
      status,
      resolution,
    });
    return response.data;
  },

  // ========================================
  // Anomaly Statistics
  // ========================================

  /**
   * Get anomaly statistics
   */
  getAnomalyStats: async (): Promise<AnomalyStats> => {
    const response = await api.get('/admin/anomalies/stats');
    return response.data.data;
  },

  /**
   * Get anomalies by severity chart data
   */
  getSeverityChartData: async (
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ date: string; critical: number; high: number; medium: number; low: number }>> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`/admin/anomalies/chart/severity?${params.toString()}`);
    return response.data.data;
  },

  /**
   * Get anomalies by type chart data
   */
  getTypeChartData: async (
    startDate?: string,
    endDate?: string
  ): Promise<Array<{ type: AnomalyType; count: number }>> => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await api.get(`/admin/anomalies/chart/type?${params.toString()}`);
    return response.data.data;
  },

  // ========================================
  // Behavioral Scoring
  // ========================================

  /**
   * Get behavioral score for an entity
   */
  getBehavioralScore: async (
    entityId: string,
    entityType: EntityType
  ): Promise<BehavioralScore> => {
    const response = await api.get(`/admin/anomalies/score/${entityType}/${entityId}`);
    return response.data.data;
  },

  /**
   * Get all entities with high risk scores
   */
  getHighRiskEntities: async (
    limit: number = 20
  ): Promise<Array<{ entityId: string; entityType: EntityType; score: number }>> => {
    const response = await api.get(`/admin/anomalies/high-risk?limit=${limit}`);
    return response.data.data;
  },

  // ========================================
  // Detection Actions
  // ========================================

  /**
   * Trigger anomaly detection for a specific entity
   */
  runDetection: async (
    entityId: string,
    entityType: EntityType
  ): Promise<{ anomalies: Anomaly[]; score: BehavioralScore }> => {
    const response = await api.post(`/admin/anomalies/detect`, {
      entityId,
      entityType,
    });
    return response.data.data;
  },

  /**
   * Get recent anomalies feed
   */
  getRecentAnomalies: async (
    limit: number = 10
  ): Promise<Anomaly[]> => {
    const response = await api.get(`/admin/anomalies/recent?limit=${limit}`);
    return response.data.data;
  },

  // ========================================
  // Support Ticket Integration
  // ========================================

  /**
   * Get support tickets related to an anomaly
   */
  getRelatedTickets: async (anomalyId: string): Promise<any[]> => {
    const response = await api.get(`/admin/anomalies/${anomalyId}/tickets`);
    return response.data.data;
  },

  /**
   * Create support ticket for anomaly investigation
   */
  createTicket: async (
    anomalyId: string,
    message: string
  ): Promise<{ ticketId: string }> => {
    const response = await api.post(`/admin/anomalies/${anomalyId}/ticket`, {
      message,
    });
    return response.data.data;
  },

  // ========================================
  // Export & Reports
  // ========================================

  /**
   * Export anomalies to CSV
   */
  exportAnomalies: async (filters?: AnomalyFilters): Promise<Blob> => {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.type) params.append('type', filters.type);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.status) params.append('status', filters.status);
      if (filters.entityType) params.append('entityType', filters.entityType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
    }

    const response = await api.get(`/admin/anomalies/export?${params.toString()}`, {
      responseType: 'blob',
    });

    return response.data;
  },

  /**
   * Generate anomaly report
   */
  generateReport: async (
    startDate: string,
    endDate: string,
    format: 'pdf' | 'csv' = 'pdf'
  ): Promise<Blob> => {
    const response = await api.post(
      `/admin/anomalies/report`,
      { startDate, endDate, format },
      { responseType: 'blob' }
    );
    return response.data;
  },
};

// ============================================
// Support Ticket API
// ============================================

export type TicketCategory = 'booking' | 'payment' | 'technical' | 'complaint' | 'billing' | 'account' | 'general';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'pending' | 'in_progress' | 'resolved' | 'closed';

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  message: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  source: 'email' | 'chat' | 'in_app' | 'phone' | 'social';
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  assignedTo?: string;
  assignedAt?: string;
  bookingId?: string;
  relatedBooking?: {
    bookingNumber: string;
    serviceName?: string;
    scheduledDate?: string;
    status?: string;
  };
  messages: Array<{
    id: string;
    senderId: string;
    senderRole: 'customer' | 'agent' | 'system' | 'admin';
    senderName?: string;
    message: string;
    attachments?: string[];
    timestamp: string;
    readAt?: string;
  }>;
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  satisfactionRating?: number;
}

export interface TicketFilters {
  status?: TicketStatus;
  category?: TicketCategory;
  priority?: TicketPriority;
  assignedTo?: string;
  customerId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface TicketStats {
  total: number;
  byStatus: Record<TicketStatus, number>;
  byCategory: Record<TicketCategory, number>;
  byPriority: Record<TicketPriority, number>;
  openTickets: number;
  avgResponseTime: number;
  resolutionRate: number;
  urgentCount: number;
}

export interface TicketTriage {
  category: TicketCategory;
  priority: TicketPriority;
  suggestedAction: string;
  estimatedResolution: string;
  confidence: number;
  keywords: string[];
  escalationRequired: boolean;
}

export interface PaginatedTickets {
  data: Ticket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const supportTicketApi = {
  // ========================================
  // Ticket CRUD
  // ========================================

  /**
   * Create a new support ticket
   */
  createTicket: async (data: {
    subject: string;
    message: string;
    source?: 'email' | 'chat' | 'in_app' | 'phone' | 'social';
    customerId?: string;
    customerEmail?: string;
    customerName?: string;
    bookingId?: string;
  }): Promise<Ticket> => {
    const response = await api.post('/support/tickets', data);
    return response.data.data;
  },

  /**
   * Get paginated list of tickets
   */
  listTickets: async (filters?: TicketFilters): Promise<PaginatedTickets> => {
    const params = new URLSearchParams();

    if (filters) {
      if (filters.status) params.append('status', filters.status);
      if (filters.category) params.append('category', filters.category);
      if (filters.priority) params.append('priority', filters.priority);
      if (filters.assignedTo) params.append('assignedTo', filters.assignedTo);
      if (filters.customerId) params.append('customerId', filters.customerId);
      if (filters.search) params.append('search', filters.search);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.page) params.append('page', String(filters.page));
      if (filters.limit) params.append('limit', String(filters.limit));
    }

    const response = await api.get(`/support/tickets?${params.toString()}`);
    return response.data;
  },

  /**
   * Get single ticket by ID
   */
  getTicket: async (ticketId: string): Promise<Ticket> => {
    const response = await api.get(`/support/tickets/${ticketId}`);
    return response.data.data;
  },

  /**
   * Add message to ticket
   */
  addMessage: async (
    ticketId: string,
    data: {
      message: string;
      attachments?: string[];
    }
  ): Promise<Ticket> => {
    const response = await api.post(`/support/tickets/${ticketId}/messages`, data);
    return response.data.data;
  },

  // ========================================
  // Ticket Actions
  // ========================================

  /**
   * Assign ticket to agent
   */
  assignTicket: async (
    ticketId: string,
    agentId: string
  ): Promise<Ticket> => {
    const response = await api.post(`/support/tickets/${ticketId}/assign`, {
      agentId,
    });
    return response.data.data;
  },

  /**
   * Update ticket status
   */
  updateTicketStatus: async (
    ticketId: string,
    status: TicketStatus
  ): Promise<Ticket> => {
    const response = await api.patch(`/support/tickets/${ticketId}/status`, {
      status,
    });
    return response.data.data;
  },

  /**
   * Update ticket priority
   */
  updateTicketPriority: async (
    ticketId: string,
    priority: TicketPriority
  ): Promise<Ticket> => {
    const response = await api.patch(`/support/tickets/${ticketId}/priority`, {
      priority,
    });
    return response.data.data;
  },

  // ========================================
  // Auto-Triage
  // ========================================

  /**
   * Preview triage result for a message
   */
  previewTriage: async (message: string, subject?: string): Promise<TicketTriage> => {
    const response = await api.post('/support/triage/preview', {
      message,
      subject,
    });
    return response.data.data;
  },

  // ========================================
  // Statistics
  // ========================================

  /**
   * Get ticket statistics
   */
  getTicketStats: async (): Promise<TicketStats> => {
    const response = await api.get('/support/tickets/stats');
    return response.data.data;
  },

  // ========================================
  // Search
  // ========================================

  /**
   * Search tickets
   */
  searchTickets: async (
    query: string,
    limit: number = 20
  ): Promise<Ticket[]> => {
    const response = await api.get(`/support/tickets/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return response.data.data;
  },
};

// ============================================
// Analytics Event API
// ============================================

export type AggregationWindow = '1m' | '5m' | '15m' | '1h' | '1d';

export interface StreamMetrics {
  eventsPerMinute: number;
  eventsPerHour: number;
  totalEvents: number;
  uniqueUsers: number;
  errorRate: number;
  lastEventAt: string;
  topEvents: Array<{ eventName: string; count: number }>;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  revenueByDay: Array<{ date: string; revenue: number }>;
  revenueByCategory: Array<{ category: string; revenue: number }>;
  averageOrderValue: number;
  conversionRate: number;
}

export const analyticsEventApi = {
  /**
   * Get real-time stream metrics
   */
  getMetrics: async (window: AggregationWindow = '5m'): Promise<StreamMetrics> => {
    const response = await api.get(`/analytics/stream/metrics?window=${window}`);
    return response.data.data;
  },

  /**
   * Get revenue analytics
   */
  getRevenueAnalytics: async (
    startDate: string,
    endDate: string
  ): Promise<RevenueAnalytics> => {
    const response = await api.get(`/analytics/revenue?startDate=${startDate}&endDate=${endDate}`);
    return response.data.data;
  },

  /**
   * Get user journey
   */
  getUserJourney: async (
    userId: string,
    limit: number = 50
  ): Promise<any[]> => {
    const response = await api.get(`/analytics/user/${userId}/journey?limit=${limit}`);
    return response.data.data;
  },

  /**
   * Record custom event
   */
  recordEvent: async (
    eventName: string,
    properties: Record<string, any>,
    metadata?: {
      userId?: string;
      sessionId?: string;
      revenue?: number;
      conversionValue?: number;
    }
  ): Promise<{ eventId: string }> => {
    const response = await api.post('/analytics/events', {
      eventName,
      properties,
      metadata,
    });
    return response.data.data;
  },
};

export default anomalyApi;
