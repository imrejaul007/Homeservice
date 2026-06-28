import { api } from './api';

const BASE_PATH = '/provider/managed-contracts';

// ============================================
// Type Definitions
// ============================================

export type ContractStatus = 'draft' | 'pending' | 'active' | 'suspended' | 'expired' | 'terminated';
export type SLAPriority = 'standard' | 'express' | 'premium';
export type PricingModel = 'fixed' | 'hourly' | 'per_service' | 'tiered';
export type TeamMemberRole = 'manager' | 'technician' | 'coordinator' | 'backup';

export interface ClientAddress {
  street: string;
  city: string;
  emirate: string;
  postalCode?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface ServiceScope {
  serviceIds: string[];
  categories: string[];
  maxMonthlyServices: number;
  excludedServices: string[];
}

export interface SLATerms {
  responseTimeMinutes: number;
  completionTimeHours: number;
  availabilityPercentage: number;
  priority: SLAPriority;
  penaltyClauses: string;
  escalationPath: string[];
}

export interface VolumeDiscount {
  minServices: number;
  discountPercentage: number;
}

export interface PricingDetails {
  model: PricingModel;
  monthlyFee: number;
  currency: string;
  overtimeRate?: number;
  volumeDiscounts?: VolumeDiscount[];
  minimumCommitmentMonths: number;
}

export interface TeamMember {
  userId?: string;
  name: string;
  email: string;
  phone: string;
  role: TeamMemberRole;
  assignedAt: string;
  isActive: boolean;
}

export interface SLACompliance {
  totalBookings: number;
  compliantBookings: number;
  responseTimeBreaches: number;
  completionTimeBreaches: number;
  availabilityBreaches: number;
  complianceRate: number;
  lastCalculatedAt: string;
}

export interface ContractMetrics {
  totalRevenue: number;
  totalBookings: number;
  averageRating: number;
  totalClients: number;
  churnRisk: 'low' | 'medium' | 'high';
  lastCalculatedAt: string;
}

export interface ContractDocument {
  name: string;
  url: string;
  type: string;
  uploadedAt: string;
}

export interface HistoryEntry {
  action: string;
  performedBy: string;
  performedAt: string;
  details?: string;
}

export interface ManagedContract {
  _id: string;
  contractNumber: string;
  providerId: string;
  clientName: string;
  clientContactName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: ClientAddress;
  status: ContractStatus;
  serviceScope: ServiceScope;
  slaTerms: SLATerms;
  pricing: PricingDetails;
  teamMembers: TeamMember[];
  primaryContactId?: string;
  slaCompliance: SLACompliance;
  startDate: string;
  endDate: string;
  renewalDate?: string;
  autoRenew: boolean;
  documents: ContractDocument[];
  metrics: ContractMetrics;
  internalNotes: string;
  clientNotes: string;
  terminatedAt?: string;
  terminationReason?: string;
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ContractStats {
  byStatus: Record<string, {
    count: number;
    totalRevenue: number;
    totalBookings: number;
  }>;
  totalContracts: number;
  totalRevenue: number;
  totalBookings: number;
  activeContracts: number;
}

export interface ContractReport {
  contractId: string;
  contractNumber: string;
  clientName: string;
  period: { start: string; end: string };
  metrics: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalRevenue: number;
    averageServiceValue: number;
  };
  slaCompliance: {
    totalBookings: number;
    compliantBookings: number;
    complianceRate: number;
    breaches: {
      responseTime: number;
      completionTime: number;
      availability: number;
    };
  };
  teamPerformance: Array<{
    memberName: string;
    bookingsHandled: number;
    averageRating: number;
  }>;
  financials: {
    totalInvoiced: number;
    totalPaid: number;
    pendingPayment: number;
  };
}

export interface ContractFilters {
  status?: ContractStatus;
  search?: string;
  sortBy?: 'createdAt' | 'startDate' | 'endDate' | 'clientName' | 'pricing.monthlyFee';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Input types for creating/updating contracts
export interface CreateContractInput {
  clientName: string;
  clientContactName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: ClientAddress;
  serviceScope?: Partial<ServiceScope>;
  slaTerms?: Partial<SLATerms>;
  pricing: {
    model?: PricingModel;
    monthlyFee: number;
    currency?: string;
    overtimeRate?: number;
    volumeDiscounts?: VolumeDiscount[];
    minimumCommitmentMonths?: number;
  };
  startDate: string;
  endDate: string;
  autoRenew?: boolean;
  internalNotes?: string;
}

export interface UpdateContractInput {
  clientName?: string;
  clientContactName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: Partial<ClientAddress>;
  status?: ContractStatus;
  serviceScope?: Partial<ServiceScope>;
  slaTerms?: Partial<SLATerms>;
  pricing?: Partial<PricingDetails>;
  startDate?: string;
  endDate?: string;
  autoRenew?: boolean;
  internalNotes?: string;
  clientNotes?: string;
}

export interface AddTeamMemberInput {
  name: string;
  email: string;
  phone: string;
  role: TeamMemberRole;
}

// API Response types
interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  meta: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

// ============================================
// API Methods
// ============================================

export const managedContractApi = {
  // ========================================
  // Contract CRUD
  // ========================================

  /**
   * Create a new managed contract
   * POST /api/provider/managed-contracts
   */
  createContract: async (input: CreateContractInput): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.post(BASE_PATH, input);
    return response.data;
  },

  /**
   * Get all contracts with optional filters
   * GET /api/provider/managed-contracts
   */
  getContracts: async (filters?: ContractFilters): Promise<PaginatedResponse<ManagedContract>> => {
    const response = await api.get(BASE_PATH, { params: filters });
    return response.data;
  },

  /**
   * Get a single contract by ID
   * GET /api/provider/managed-contracts/:id
   */
  getContractById: async (id: string): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.get(`${BASE_PATH}/${id}`);
    return response.data;
  },

  /**
   * Get contract by contract number
   * GET /api/provider/managed-contracts/number/:contractNumber
   */
  getContractByNumber: async (contractNumber: string): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.get(`${BASE_PATH}/number/${contractNumber}`);
    return response.data;
  },

  /**
   * Update a contract
   * PUT /api/provider/managed-contracts/:id
   */
  updateContract: async (id: string, input: UpdateContractInput): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.put(`${BASE_PATH}/${id}`, input);
    return response.data;
  },

  /**
   * Delete a contract (only drafts, terminated, or expired)
   * DELETE /api/provider/managed-contracts/:id
   */
  deleteContract: async (id: string): Promise<ApiResponse<null>> => {
    const response = await api.delete(`${BASE_PATH}/${id}`);
    return response.data;
  },

  // ========================================
  // Status Management
  // ========================================

  /**
   * Activate a contract
   * POST /api/provider/managed-contracts/:id/activate
   */
  activateContract: async (id: string): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.post(`${BASE_PATH}/${id}/activate`);
    return response.data;
  },

  /**
   * Suspend a contract
   * POST /api/provider/managed-contracts/:id/suspend
   */
  suspendContract: async (id: string, reason?: string): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.post(`${BASE_PATH}/${id}/suspend`, { reason });
    return response.data;
  },

  /**
   * Terminate a contract
   * POST /api/provider/managed-contracts/:id/terminate
   */
  terminateContract: async (id: string, reason: string): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.post(`${BASE_PATH}/${id}/terminate`, { reason });
    return response.data;
  },

  // ========================================
  // Team Management
  // ========================================

  /**
   * Add team member to contract
   * POST /api/provider/managed-contracts/:id/team
   */
  addTeamMember: async (contractId: string, input: AddTeamMemberInput): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.post(`${BASE_PATH}/${contractId}/team`, input);
    return response.data;
  },

  /**
   * Update team member
   * PUT /api/provider/managed-contracts/:id/team/:email
   */
  updateTeamMember: async (
    contractId: string,
    email: string,
    updates: Partial<AddTeamMemberInput>
  ): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.put(`${BASE_PATH}/${contractId}/team/${encodeURIComponent(email)}`, updates);
    return response.data;
  },

  /**
   * Remove team member from contract
   * DELETE /api/provider/managed-contracts/:id/team/:email
   */
  removeTeamMember: async (contractId: string, email: string): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.delete(`${BASE_PATH}/${contractId}/team/${encodeURIComponent(email)}`);
    return response.data;
  },

  /**
   * Set team member as primary contact
   * POST /api/provider/managed-contracts/:id/team/:email/primary
   */
  setPrimaryContact: async (contractId: string, email: string): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.post(`${BASE_PATH}/${contractId}/team/${encodeURIComponent(email)}/primary`);
    return response.data;
  },

  // ========================================
  // SLA Compliance
  // ========================================

  /**
   * Calculate SLA compliance for a contract
   * POST /api/provider/managed-contracts/:id/sla/calculate
   */
  calculateSLACompliance: async (
    id: string
  ): Promise<ApiResponse<{
    complianceRate: number;
    totalBookings: number;
    compliantBookings: number;
    breaches: {
      responseTime: number;
      completionTime: number;
      availability: number;
    };
    lastCalculatedAt: string;
  }>> => {
    const response = await api.post(`${BASE_PATH}/${id}/sla/calculate`);
    return response.data;
  },

  // ========================================
  // Reports
  // ========================================

  /**
   * Generate contract report
   * GET /api/provider/managed-contracts/:id/report
   */
  generateReport: async (
    id: string,
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<ContractReport>> => {
    const response = await api.get(`${BASE_PATH}/${id}/report`, {
      params: { startDate, endDate },
    });
    return response.data;
  },

  // ========================================
  // Statistics
  // ========================================

  /**
   * Get contract statistics
   * GET /api/provider/managed-contracts/stats
   */
  getStats: async (): Promise<ApiResponse<ContractStats>> => {
    const response = await api.get(`${BASE_PATH}/stats`);
    return response.data;
  },

  /**
   * Get contract summary
   * GET /api/provider/managed-contracts/:id/summary
   */
  getSummary: async (id: string): Promise<ApiResponse<{
    contract: ManagedContract;
    stats: {
      totalBookings: number;
      totalRevenue: number;
      averageMonthlySpend: number;
      complianceRate: number;
    };
  }>> => {
    const response = await api.get(`${BASE_PATH}/${id}/summary`);
    return response.data;
  },

  // ========================================
  // Filtered Lists
  // ========================================

  /**
   * Get active contracts
   * GET /api/provider/managed-contracts/active
   */
  getActiveContracts: async (): Promise<ApiResponse<ManagedContract[]>> => {
    const response = await api.get(`${BASE_PATH}/active`);
    return response.data;
  },

  /**
   * Get expiring contracts
   * GET /api/provider/managed-contracts/expiring
   */
  getExpiringContracts: async (days: number = 30): Promise<ApiResponse<ManagedContract[]>> => {
    const response = await api.get(`${BASE_PATH}/expiring`, { params: { days } });
    return response.data;
  },

  // ========================================
  // Document Management
  // ========================================

  /**
   * Add document to contract
   * POST /api/provider/managed-contracts/:id/documents
   */
  addDocument: async (
    contractId: string,
    document: { name: string; url: string; type: string }
  ): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.post(`${BASE_PATH}/${contractId}/documents`, document);
    return response.data;
  },

  /**
   * Remove document from contract
   * DELETE /api/provider/managed-contracts/:id/documents/:name
   */
  removeDocument: async (contractId: string, documentName: string): Promise<ApiResponse<ManagedContract>> => {
    const response = await api.delete(`${BASE_PATH}/${contractId}/documents/${encodeURIComponent(documentName)}`);
    return response.data;
  },
};

// ============================================
// Utility Functions
// ============================================

export const formatCurrency = (amount: number, currency: string = 'AED'): string => {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-AE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getStatusColor = (status: ContractStatus): string => {
  const colors: Record<ContractStatus, string> = {
    draft: 'bg-gray-100 text-gray-800 border-gray-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    active: 'bg-green-100 text-green-800 border-green-200',
    suspended: 'bg-orange-100 text-orange-800 border-orange-200',
    expired: 'bg-red-100 text-red-800 border-red-200',
    terminated: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[status] || colors.draft;
};

export const getStatusLabel = (status: ContractStatus): string => {
  const labels: Record<ContractStatus, string> = {
    draft: 'Draft',
    pending: 'Pending',
    active: 'Active',
    suspended: 'Suspended',
    expired: 'Expired',
    terminated: 'Terminated',
  };
  return labels[status] || status;
};

export const getPriorityLabel = (priority: SLAPriority): string => {
  const labels: Record<SLAPriority, string> = {
    standard: 'Standard',
    express: 'Express',
    premium: 'Premium',
  };
  return labels[priority] || priority;
};

export const getRoleLabel = (role: TeamMemberRole): string => {
  const labels: Record<TeamMemberRole, string> = {
    manager: 'Manager',
    technician: 'Technician',
    coordinator: 'Coordinator',
    backup: 'Backup',
  };
  return labels[role] || role;
};

export const getPricingModelLabel = (model: PricingModel): string => {
  const labels: Record<PricingModel, string> = {
    fixed: 'Fixed Monthly',
    hourly: 'Hourly',
    per_service: 'Per Service',
    tiered: 'Tiered',
  };
  return labels[model] || model;
};

export const calculateContractDuration = (startDate: string, endDate: string): string => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const months = Math.floor(diffDays / 30);
  const days = diffDays % 30;

  if (months > 0 && days > 0) {
    return `${months} month${months > 1 ? 's' : ''} ${days} day${days > 1 ? 's' : ''}`;
  } else if (months > 0) {
    return `${months} month${months > 1 ? 's' : ''}`;
  } else {
    return `${days} day${days > 1 ? 's' : ''}`;
  }
};

export const isExpiringSoon = (endDate: string, daysThreshold: number = 30): boolean => {
  const end = new Date(endDate);
  const now = new Date();
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 && diffDays <= daysThreshold;
};

export default managedContractApi;
