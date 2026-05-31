import { api } from './api';

// ============================================
// Lead Types
// ============================================

export interface Lead {
  id: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  categoryId?: string;
  categoryName?: string;
  serviceId?: string;
  serviceName?: string;
  providerId?: string;
  providerName?: string;
  message: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  source: 'website' | 'app' | 'referral' | 'advertisement' | 'organic' | 'other';
  budget?: {
    min?: number;
    max?: number;
    currency: string;
  };
  preferredDate?: string;
  preferredTime?: string;
  location?: {
    city: string;
    area?: string;
    coordinates?: { lat: number; lng: number };
  };
  notes?: string;
  assignedTo?: string;
  assignedToName?: string;
  followUps: Array<{
    id: string;
    date: string;
    type: 'call' | 'email' | 'sms' | 'visit';
    outcome: string;
    notes?: string;
    madeBy: string;
    madeByName: string;
  }>;
  conversionDetails?: {
    bookingId?: string;
    bookingReference?: string;
    convertedAt?: string;
    revenue?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LeadListItem {
  id: string;
  customerName: string;
  customerPhone: string;
  categoryName?: string;
  serviceName?: string;
  status: Lead['status'];
  source: Lead['source'];
  budget?: {
    min?: number;
    max?: number;
    currency: string;
  };
  providerName?: string;
  createdAt: string;
  isHot: boolean;
}

export interface GetLeadsOptions {
  page?: number;
  limit?: number;
  status?: Lead['status'];
  source?: Lead['source'];
  categoryId?: string;
  providerId?: string;
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  isHot?: boolean;
  sortBy?: 'createdAt' | 'status' | 'budget' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateLeadPayload {
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  categoryId?: string;
  serviceId?: string;
  message: string;
  source?: Lead['source'];
  budget?: { min?: number; max?: number; currency?: string };
  preferredDate?: string;
  preferredTime?: string;
  location?: Lead['location'];
}

export interface LeadCredits {
  totalCredits: number;
  usedCredits: number;
  availableCredits: number;
  expiresInDays: number;
  transactions: Array<{
    id: string;
    type: 'purchase' | 'used' | 'refund' | 'expired' | 'bonus';
    amount: number;
    balance: number;
    description: string;
    createdAt: string;
  }>;
}

export interface LeadCreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  pricePerLead: number;
  currency: string;
  validityDays: number;
  description: string;
  features: string[];
  isPopular?: boolean;
  isActive: boolean;
}

export interface LeadStats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  lostLeads: number;
  conversionRate: number;
  averageResponseTime: number;
  leadsThisMonth: number;
  leadsLastMonth: number;
  monthOverMonthGrowth: number;
  bySource: Record<Lead['source'], number>;
  topCategories: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    conversionRate: number;
  }>;
  revenueFromLeads: number;
}

export interface UpdateLeadStatusPayload {
  status: Lead['status'];
  notes?: string;
  followUp?: {
    type: 'call' | 'email' | 'sms' | 'visit';
    outcome: string;
    notes?: string;
  };
}

// ============================================
// Lead API Service
// ============================================

export interface LeadApi {
  /**
   * Get leads with filtering and pagination
   */
  getLeads: (options?: GetLeadsOptions) => Promise<{
    leads: LeadListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Get a single lead by ID
   */
  getLead: (id: string) => Promise<Lead>;

  /**
   * Create a new lead
   */
  createLead: (data: CreateLeadPayload) => Promise<Lead>;

  /**
   * Update a lead
   */
  updateLead: (id: string, data: Partial<CreateLeadPayload>) => Promise<Lead>;

  /**
   * Update lead status
   */
  updateLeadStatus: (id: string, payload: UpdateLeadStatusPayload) => Promise<Lead>;

  /**
   * Delete a lead
   */
  deleteLead: (id: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Assign lead to provider
   */
  assignLead: (id: string, providerId: string) => Promise<Lead>;

  /**
   * Get lead credits
   */
  getLeadCredits: () => Promise<LeadCredits>;

  /**
   * Purchase lead credits
   */
  purchaseLeadCredits: (packageId: string, paymentMethod?: string) => Promise<{
    success: boolean;
    transactionId: string;
    creditsAdded: number;
    newBalance: number;
  }>;

  /**
   * Get available credit packages
   */
  getCreditPackages: () => Promise<LeadCreditPackage[]>;

  /**
   * Get lead statistics
   */
  getLeadStats: (options?: { startDate?: string; endDate?: string }) => Promise<LeadStats>;

  /**
   * Add follow-up to lead
   */
  addFollowUp: (
    id: string,
    data: {
      type: 'call' | 'email' | 'sms' | 'visit';
      outcome: string;
      notes?: string;
    }
  ) => Promise<Lead>;

  /**
   * Mark lead as hot/priority
   */
  markAsHot: (id: string, isHot: boolean) => Promise<{
    success: boolean;
    isHot: boolean;
  }>;

  /**
   * Convert lead to booking
   */
  convertToBooking: (
    id: string,
    bookingData: {
      serviceId: string;
      scheduledDate: string;
      scheduledTime: string;
      address: string;
      notes?: string;
    }
  ) => Promise<{
    success: boolean;
    bookingId: string;
    bookingReference: string;
  }>;

  /**
   * Export leads
   */
  exportLeads: (options?: GetLeadsOptions & { format?: 'csv' | 'xlsx' | 'json' }) => Promise<Blob>;
}

export const leadApi: LeadApi = {
  /**
   * Get leads with filtering and pagination
   * @param options - Query options including filters and sorting
   */
  getLeads: async (options = {}) => {
    const response = await api.get('/leads', { params: options });
    return response.data.data;
  },

  /**
   * Get a single lead by ID with full details
   * @param id - The lead ID
   */
  getLead: async (id: string) => {
    const response = await api.get(`/leads/${id}`);
    return response.data.data;
  },

  /**
   * Create a new lead
   * @param data - Lead data including customer info and requirements
   */
  createLead: async (data: CreateLeadPayload) => {
    const response = await api.post('/leads', data);
    return response.data.data;
  },

  /**
   * Update lead information
   * @param id - The lead ID
   * @param data - Fields to update
   */
  updateLead: async (id: string, data: Partial<CreateLeadPayload>) => {
    const response = await api.patch(`/leads/${id}`, data);
    return response.data.data;
  },

  /**
   * Update lead status with optional follow-up
   * @param id - The lead ID
   * @param payload - New status and optional follow-up details
   */
  updateLeadStatus: async (id: string, payload: UpdateLeadStatusPayload) => {
    const response = await api.patch(`/leads/${id}/status`, payload);
    return response.data.data;
  },

  /**
   * Delete a lead
   * @param id - The lead ID to delete
   */
  deleteLead: async (id: string) => {
    const response = await api.delete(`/leads/${id}`);
    return response.data;
  },

  /**
   * Assign lead to a provider
   * @param id - The lead ID
   * @param providerId - Provider ID to assign
   */
  assignLead: async (id: string, providerId: string) => {
    const response = await api.post(`/leads/${id}/assign`, { providerId });
    return response.data.data;
  },

  /**
   * Get current user's lead credits
   */
  getLeadCredits: async () => {
    const response = await api.get('/leads/credits');
    return response.data.data;
  },

  /**
   * Purchase lead credits package
   * @param packageId - Credit package ID to purchase
   * @param paymentMethod - Optional payment method override
   */
  purchaseLeadCredits: async (packageId: string, paymentMethod?: string) => {
    const response = await api.post('/leads/credits/purchase', {
      packageId,
      paymentMethod,
    });
    return response.data.data;
  },

  /**
   * Get available lead credit packages
   */
  getCreditPackages: async () => {
    const response = await api.get('/leads/credits/packages');
    return response.data.data;
  },

  /**
   * Get lead statistics
   * @param options - Optional date range for statistics
   */
  getLeadStats: async (options = {}) => {
    const response = await api.get('/leads/stats', { params: options });
    return response.data.data;
  },

  /**
   * Add a follow-up interaction to a lead
   * @param id - The lead ID
   * @param data - Follow-up details
   */
  addFollowUp: async (id: string, data) => {
    const response = await api.post(`/leads/${id}/followup`, data);
    return response.data.data;
  },

  /**
   * Mark a lead as hot (priority)
   * @param id - The lead ID
   * @param isHot - Whether to mark as hot or not
   */
  markAsHot: async (id: string, isHot: boolean) => {
    const response = await api.patch(`/leads/${id}/hot`, { isHot });
    return response.data.data;
  },

  /**
   * Convert a qualified lead to a booking
   * @param id - The lead ID
   * @param bookingData - Booking details for the conversion
   */
  convertToBooking: async (id: string, bookingData) => {
    const response = await api.post(`/leads/${id}/convert`, bookingData);
    return response.data.data;
  },

  /**
   * Export leads to file
   * @param options - Export filters and format
   */
  exportLeads: async (options = {}) => {
    const response = await api.get('/leads/export', {
      params: options,
      responseType: 'blob',
    });
    return response.data;
  },
};

export default leadApi;
