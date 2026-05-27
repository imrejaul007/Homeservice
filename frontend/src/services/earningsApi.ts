import { api } from './api';

// Types for Commission and Earnings
export interface CommissionTier {
  minAmount: number;
  maxAmount: number;
  rate: number;
}

export interface Commission {
  _id: string;
  bookingId: string;
  bookingNumber: string;
  providerId: string;
  serviceId: string;
  categoryId?: string;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  commissionRate: number;
  commissionType: 'percentage' | 'flat';
  commissionAmount: number;
  platformFee: number;
  paymentProcessingFee: number;
  totalDeductions: number;
  providerEarnings: number;
  ruleId: string;
  ruleName: string;
  ruleType: 'standard' | 'tiered' | 'category' | 'provider' | 'promotional';
  tierApplied?: {
    minAmount: number;
    maxAmount: number;
    rate: number;
  };
  taxAmount: number;
  taxRate: number;
  adjustment?: {
    type: 'bonus' | 'penalty' | 'correction' | 'promotion';
    amount: number;
    reason: string;
    adjustedBy: string;
    adjustedAt: string;
  };
  status: 'calculated' | 'pending' | 'approved' | 'paid' | 'disputed' | 'reversed';
  calculatedAt: string;
  approvedAt?: string;
  paidAt?: string;
  metadata?: {
    customerId?: string;
    serviceTitle?: string;
    categoryName?: string;
    providerName?: string;
    bookingDate?: string;
    currency?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface TaxDocument {
  _id: string;
  providerId: string;
  type: 'invoice' | 'receipt' | 'tax_certificate' | '1099' | 'annual_statement';
  period: {
    start: string;
    end: string;
  };
  documentNumber: string;
  providerDetails: {
    name: string;
    address?: string;
    taxRegistrationNumber?: string;
    email: string;
  };
  customerDetails?: {
    name: string;
    address?: string;
    taxId?: string;
    email: string;
  };
  lineItems: Array<{
    description: string;
    bookingId?: string;
    bookingNumber?: string;
    amount: number;
    taxRate: number;
    taxAmount: number;
    date: string;
  }>;
  subtotal: number;
  totalTax: number;
  totalAmount: number;
  currency: string;
  taxBreakdown: Array<{
    type: string;
    rate: number;
    taxableAmount: number;
    taxAmount: number;
  }>;
  status: 'draft' | 'issued' | 'paid' | 'cancelled';
  issuedAt?: string;
  paidAt?: string;
  metadata?: {
    invoiceId?: string;
    paymentReference?: string;
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface EarningsReport {
  _id: string;
  providerId: string;
  period: {
    start: string;
    end: string;
  };
  totalGross: number;
  totalDiscounts: number;
  totalNet: number;
  totalCommission: number;
  totalPlatformFee: number;
  totalPaymentProcessingFee: number;
  totalTax: number;
  totalProviderEarnings: number;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  commissionBreakdown: {
    byRuleType: Array<{
      ruleType: string;
      count: number;
      amount: number;
    }>;
    byTier: Array<{
      tierName: string;
      minAmount: number;
      maxAmount: number;
      count: number;
      amount: number;
    }>;
  };
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    grossAmount: number;
    commission: number;
    earnings: number;
  }>;
  monthlyBreakdown: Array<{
    month: string;
    count: number;
    grossAmount: number;
    commission: number;
    earnings: number;
  }>;
  taxInfo: {
    region: string;
    taxRate: number;
    taxType: string;
    taxAmount: number;
  };
  taxDocumentId?: string;
  invoiceNumbers: string[];
  status: 'draft' | 'generated' | 'sent' | 'archived';
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface EarningsDashboardSummary {
  providerId: string;
  currentPeriod: {
    start: string;
    end: string;
  };
  comparisonPeriod: {
    start: string;
    end: string;
  };
  current: {
    grossEarnings: number;
    netEarnings: number;
    totalCommission: number;
    totalBookings: number;
    averageBookingValue: number;
  };
  previous: {
    grossEarnings: number;
    netEarnings: number;
    totalCommission: number;
    totalBookings: number;
    averageBookingValue: number;
  };
  growth: {
    grossEarnings: number;
    netEarnings: number;
    totalBookings: number;
    averageBookingValue: number;
  };
  topDayOfWeek: {
    day: string;
    count: number;
    earnings: number;
  };
  pendingPayments: {
    count: number;
    amount: number;
  };
  nextPayout: {
    date: string;
    amount: number;
  };
}

export interface CommissionAdjustment {
  type: 'bonus' | 'penalty' | 'correction' | 'promotion';
  amount: number;
  reason: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// API response type
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Earnings API Service
export const earningsApi = {
  // Commission endpoints

  /**
   * Get commissions for the current provider
   */
  getCommissions: async (params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    status?: Commission['status'];
    categoryId?: string;
  }): Promise<PaginatedResponse<Commission>> => {
    const response = await api.get('/earnings/commissions', { params });
    return response.data.data;
  },

  /**
   * Get a single commission by ID
   */
  getCommissionById: async (commissionId: string): Promise<Commission> => {
    const response = await api.get(`/earnings/commissions/${commissionId}`);
    return response.data.data.commission;
  },

  /**
   * Get commission summary for a date range
   */
  getCommissionSummary: async (startDate: string, endDate: string): Promise<{
    totalGross: number;
    totalNet: number;
    totalCommission: number;
    totalPlatformFee: number;
    totalPaymentProcessingFee: number;
    totalTax: number;
    totalProviderEarnings: number;
    bookingCount: number;
    averageCommissionRate: number;
    byStatus: Array<{ status: string; count: number; amount: number }>;
    byCategory: Array<{
      categoryId: string;
      categoryName: string;
      count: number;
      grossAmount: number;
      commission: number;
    }>;
  }> => {
    const response = await api.get('/earnings/commissions/summary', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  /**
   * Adjust a commission (admin/provider)
   */
  adjustCommission: async (
    commissionId: string,
    adjustment: CommissionAdjustment
  ): Promise<{ success: boolean; commission?: Commission; error?: string }> => {
    const response = await api.post(`/earnings/commissions/${commissionId}/adjust`, adjustment);
    return response.data;
  },

  /**
   * Update commission status
   */
  updateCommissionStatus: async (
    commissionId: string,
    status: Commission['status'],
    reason?: string
  ): Promise<{ success: boolean; commission?: Commission }> => {
    const response = await api.patch(`/earnings/commissions/${commissionId}/status`, {
      status,
      reason,
    });
    return response.data;
  },

  // Tax document endpoints

  /**
   * Get tax documents for the current provider
   */
  getTaxDocuments: async (params?: {
    page?: number;
    limit?: number;
    type?: TaxDocument['type'];
    year?: number;
    status?: TaxDocument['status'];
  }): Promise<PaginatedResponse<TaxDocument>> => {
    const response = await api.get('/earnings/tax-documents', { params });
    return response.data.data;
  },

  /**
   * Get a tax document by ID
   */
  getTaxDocumentById: async (documentId: string): Promise<TaxDocument> => {
    const response = await api.get(`/earnings/tax-documents/${documentId}`);
    return response.data.data.document;
  },

  /**
   * Generate invoice for a period
   */
  generateInvoice: async (
    startDate: string,
    endDate: string,
    options?: {
      customerInfo?: {
        name: string;
        address?: string;
        taxId?: string;
        email: string;
      };
    }
  ): Promise<TaxDocument> => {
    const response = await api.post('/earnings/tax-documents/generate', {
      startDate,
      endDate,
      ...options,
    });
    return response.data.data.document;
  },

  /**
   * Download tax document as PDF
   */
  downloadTaxDocument: async (documentId: string): Promise<Blob> => {
    const response = await api.get(`/earnings/tax-documents/${documentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Earnings report endpoints

  /**
   * Get earnings reports for the current provider
   */
  getEarningsReports: async (params?: {
    page?: number;
    limit?: number;
    year?: number;
    status?: EarningsReport['status'];
  }): Promise<PaginatedResponse<EarningsReport>> => {
    const response = await api.get('/earnings/reports', { params });
    return response.data.data;
  },

  /**
   * Get an earnings report by ID
   */
  getEarningsReportById: async (reportId: string): Promise<EarningsReport> => {
    const response = await api.get(`/earnings/reports/${reportId}`);
    return response.data.data.report;
  },

  /**
   * Generate a new earnings report
   */
  generateEarningsReport: async (
    startDate: string,
    endDate: string,
    options?: {
      includeTaxDocument?: boolean;
      region?: string;
    }
  ): Promise<EarningsReport> => {
    const response = await api.post('/earnings/reports/generate', {
      startDate,
      endDate,
      ...options,
    });
    return response.data.data.report;
  },

  /**
   * Get dashboard summary with period comparison
   */
  getDashboardSummary: async (
    period: 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise<EarningsDashboardSummary> => {
    const response = await api.get('/earnings/dashboard', {
      params: { period },
    });
    return response.data.data;
  },

  /**
   * Get annual statement for tax purposes
   */
  getAnnualStatement: async (year: number): Promise<{
    year: number;
    totalEarnings: number;
    totalCommission: number;
    totalTax: number;
    quarterlyBreakdown: Array<{
      quarter: number;
      count: number;
      earnings: number;
      tax: number;
    }>;
    taxDocument: TaxDocument | null;
  }> => {
    const response = await api.get(`/earnings/annual-statement/${year}`);
    return response.data.data;
  },

  // Export endpoints

  /**
   * Export earnings data
   */
  exportEarnings: async (
    startDate: string,
    endDate: string,
    format: 'csv' | 'json' = 'json'
  ): Promise<Blob> => {
    const response = await api.get('/earnings/export', {
      params: { startDate, endDate, format },
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Download export file
   */
  downloadExport: async (
    startDate: string,
    endDate: string,
    format: 'csv' | 'json' = 'json'
  ): Promise<void> => {
    const response = await api.get('/earnings/export', {
      params: { startDate, endDate, format },
      responseType: 'blob',
    });

    // Create download link
    const blob = new Blob([response.data], {
      type: format === 'csv' ? 'text/csv' : 'application/json',
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const filename = `earnings_${startDate.split('T')[0]}_${endDate.split('T')[0]}.${format}`;
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  // Commission rule endpoints (admin)

  /**
   * Get all commission rules
   */
  getCommissionRules: async (): Promise<Array<{
    _id: string;
    name: string;
    description?: string;
    type: 'standard' | 'tiered' | 'category' | 'provider' | 'promotional';
    rate?: number;
    tiers?: CommissionTier[];
    commissionType: 'percentage' | 'flat';
    flatAmount?: number;
    appliesTo: 'gross' | 'net';
    isActive: boolean;
    priority: number;
  }>> => {
    const response = await api.get('/admin/commission-rules');
    return response.data.data.rules;
  },

  /**
   * Create a commission rule (admin)
   */
  createCommissionRule: async (rule: {
    name: string;
    description?: string;
    type: 'standard' | 'tiered' | 'category' | 'promotional';
    categoryId?: string;
    rate?: number;
    tiers?: CommissionTier[];
    commissionType?: 'percentage' | 'flat';
    flatAmount?: number;
    appliesTo?: 'gross' | 'net';
    priority?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any> => {
    const response = await api.post('/admin/commission-rules', rule);
    return response.data.data.rule;
  },

  /**
   * Update a commission rule (admin)
   */
  updateCommissionRule: async (
    ruleId: string,
    updates: Partial<{
      name: string;
      description?: string;
      rate?: number;
      tiers?: CommissionTier[];
      isActive: boolean;
      priority: number;
      startDate?: string;
      endDate?: string;
    }>
  ): Promise<any> => {
    const response = await api.patch(`/admin/commission-rules/${ruleId}`, updates);
    return response.data.data.rule;
  },

  // Tax config endpoints (admin)

  /**
   * Get tax configurations
   */
  getTaxConfigs: async (): Promise<Array<{
    region: string;
    rate: number;
    type: 'gst' | 'vat' | 'sales_tax';
    threshold: number;
    includedInPrice: boolean;
    name: string;
    applicableTo: 'booking' | 'commission' | 'payout' | 'all';
    isActive: boolean;
  }>> => {
    const response = await api.get('/admin/tax-configs');
    return response.data.data.configs;
  },

  /**
   * Update tax configuration (admin)
   */
  updateTaxConfig: async (
    region: string,
    updates: Partial<{
      rate: number;
      threshold: number;
      includedInPrice: boolean;
      name: string;
      applicableTo: 'booking' | 'commission' | 'payout' | 'all';
      isActive: boolean;
    }>
  ): Promise<any> => {
    const response = await api.patch(`/admin/tax-configs/${region}`, updates);
    return response.data.data.config;
  },
};

export default earningsApi;
