import { api } from './api';

// ============================================
// Invoice Types
// ============================================

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  serviceId?: string;
  serviceName?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: 'booking' | 'subscription' | 'refund' | 'adjustment';
  status: 'draft' | 'pending' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  providerId?: string;
  providerName?: string;
  bookingId?: string;
  bookingDetails?: {
    serviceName: string;
    scheduledDate?: string;
    address?: string;
  };
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
  dueDate: string;
  paidAt?: string;
  sentAt?: string;
  notes?: string;
  terms?: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetInvoicesOptions {
  page?: number;
  limit?: number;
  status?: Invoice['status'];
  type?: Invoice['type'];
  customerId?: string;
  providerId?: string;
  bookingId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: 'createdAt' | 'dueDate' | 'totalAmount' | 'invoiceNumber';
  sortOrder?: 'asc' | 'desc';
}

export interface InvoiceStats {
  totalInvoices: number;
  totalRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  paidThisMonth: number;
  paidLastMonth: number;
  monthOverMonthGrowth: number;
  averageInvoiceValue: number;
  collectionRate: number;
  byStatus: {
    draft: number;
    pending: number;
    sent: number;
    paid: number;
    overdue: number;
    cancelled: number;
    refunded: number;
  };
  byType: {
    booking: number;
    subscription: number;
    refund: number;
    adjustment: number;
  };
}

export interface CreateInvoicePayload {
  type: Invoice['type'];
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerAddress?: string;
  providerId?: string;
  bookingId?: string;
  items: Omit<InvoiceItem, 'id'>[];
  taxRate?: number;
  discountAmount?: number;
  dueDate: string;
  notes?: string;
  terms?: string;
}

export interface UpdateInvoicePayload {
  status?: Invoice['status'];
  items?: Omit<InvoiceItem, 'id'>[];
  taxRate?: number;
  discountAmount?: number;
  dueDate?: string;
  notes?: string;
  terms?: string;
}

// ============================================
// Invoice API Service
// ============================================

export interface InvoiceApi {
  /**
   * Get invoices with filtering and pagination
   */
  getInvoices: (options?: GetInvoicesOptions) => Promise<{
    invoices: Invoice[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Get a single invoice by ID
   */
  getInvoice: (id: string) => Promise<Invoice>;

  /**
   * Create a new invoice
   */
  createInvoice: (data: CreateInvoicePayload) => Promise<Invoice>;

  /**
   * Update an existing invoice
   */
  updateInvoice: (id: string, data: UpdateInvoicePayload) => Promise<Invoice>;

  /**
   * Delete a draft invoice
   */
  deleteInvoice: (id: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Download invoice as PDF
   */
  downloadInvoicePdf: (id: string) => Promise<Blob>;

  /**
   * Get PDF URL for an invoice
   */
  getInvoicePdfUrl: (id: string) => Promise<{
    url: string;
    expiresAt: string;
  }>;

  /**
   * Send invoice to customer
   */
  sendInvoice: (id: string, recipients?: string[]) => Promise<{
    success: boolean;
    sentTo: string[];
    message: string;
  }>;

  /**
   * Mark invoice as paid
   */
  markAsPaid: (id: string, paymentDetails?: {
    paymentMethod?: string;
    transactionId?: string;
    notes?: string;
  }) => Promise<Invoice>;

  /**
   * Cancel an invoice
   */
  cancelInvoice: (id: string, reason?: string) => Promise<Invoice>;

  /**
   * Get invoice statistics
   */
  getInvoiceStats: (startDate?: string, endDate?: string) => Promise<InvoiceStats>;

  /**
   * Get overdue invoices
   */
  getOverdueInvoices: (options?: {
    page?: number;
    limit?: number;
    daysOverdue?: number;
  }) => Promise<{
    invoices: Invoice[];
    total: number;
    totalAmount: number;
  }>;

  /**
   * Send payment reminder for overdue invoices
   */
  sendPaymentReminder: (id: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Resend invoice email
   */
  resendInvoice: (id: string) => Promise<{
    success: boolean;
    message: string;
  }>;
}

export const invoiceApi: InvoiceApi = {
  /**
   * Get invoices with filtering and pagination
   * @param options - Query options including filters and sorting
   */
  getInvoices: async (options = {}) => {
    const response = await api.get('/invoices', { params: options });
    return response.data.data;
  },

  /**
   * Get a single invoice by ID with full details
   * @param id - The invoice ID
   */
  getInvoice: async (id: string) => {
    const response = await api.get(`/invoices/${id}`);
    return response.data.data;
  },

  /**
   * Create a new invoice
   * @param data - Invoice data including customer, items, and terms
   */
  createInvoice: async (data: CreateInvoicePayload) => {
    const response = await api.post('/invoices', data);
    return response.data.data;
  },

  /**
   * Update an existing invoice (only draft invoices can be fully edited)
   * @param id - The invoice ID
   * @param data - Fields to update
   */
  updateInvoice: async (id: string, data: UpdateInvoicePayload) => {
    const response = await api.patch(`/invoices/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete a draft invoice
   * @param id - The invoice ID to delete
   */
  deleteInvoice: async (id: string) => {
    const response = await api.delete(`/invoices/${id}`);
    return response.data;
  },

  /**
   * Download invoice as PDF blob
   * @param id - The invoice ID
   */
  downloadInvoicePdf: async (id: string) => {
    const response = await api.get(`/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Get a signed URL for the invoice PDF
   * @param id - The invoice ID
   */
  getInvoicePdfUrl: async (id: string) => {
    const response = await api.get(`/invoices/${id}/pdf-url`);
    return response.data.data;
  },

  /**
   * Send invoice to customer via email
   * @param id - The invoice ID
   * @param recipients - Optional custom recipients (defaults to customer email)
   */
  sendInvoice: async (id: string, recipients?: string[]) => {
    const response = await api.post(`/invoices/${id}/send`, { recipients });
    return response.data.data;
  },

  /**
   * Mark invoice as paid
   * @param id - The invoice ID
   * @param paymentDetails - Optional payment metadata
   */
  markAsPaid: async (id: string, paymentDetails = {}) => {
    const response = await api.post(`/invoices/${id}/pay`, paymentDetails);
    return response.data.data;
  },

  /**
   * Cancel an invoice
   * @param id - The invoice ID
   * @param reason - Optional cancellation reason
   */
  cancelInvoice: async (id: string, reason?: string) => {
    const response = await api.post(`/invoices/${id}/cancel`, { reason });
    return response.data.data;
  },

  /**
   * Get invoice statistics for a date range
   * @param startDate - Start date for statistics (optional)
   * @param endDate - End date for statistics (optional)
   */
  getInvoiceStats: async (startDate?: string, endDate?: string) => {
    const response = await api.get('/invoices/stats', {
      params: { startDate, endDate },
    });
    return response.data.data;
  },

  /**
   * Get all overdue invoices
   * @param options - Pagination and filter options
   */
  getOverdueInvoices: async (options = {}) => {
    const response = await api.get('/invoices/overdue', { params: options });
    return response.data.data;
  },

  /**
   * Send a payment reminder for an overdue invoice
   * @param id - The invoice ID
   */
  sendPaymentReminder: async (id: string) => {
    const response = await api.post(`/invoices/${id}/reminder`);
    return response.data.data;
  },

  /**
   * Resend an invoice email
   * @param id - The invoice ID
   */
  resendInvoice: async (id: string) => {
    const response = await api.post(`/invoices/${id}/resend`);
    return response.data.data;
  },
};

export default invoiceApi;
