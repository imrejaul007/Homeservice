import { api } from './api';

// ============================================
// Corporate/B2B Types
// ============================================

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  coverImage?: string;
  description: string;
  website?: string;
  industry: string;
  size: '1-10' | '11-50' | '51-200' | '201-500' | '501-1000' | '1000+';
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  primaryContact: {
    name: string;
    email: string;
    phone: string;
    role: string;
  };
  taxId?: string;
  billingEmail: string;
  paymentTerms: 'prepaid' | 'net15' | 'net30' | 'net60' | 'net90';
  creditLimit?: number;
  employeeCount: number;
  managerId: string;
  managerName: string;
  status: 'active' | 'suspended' | 'pending' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface CompanyEmployee {
  id: string;
  companyId: string;
  userId?: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  role: 'admin' | 'manager' | 'employee';
  isActive: boolean;
  bookingAllowance?: {
    monthlyLimit?: number;
    usedThisMonth?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CorporateBilling {
  companyId: string;
  currentPeriod: {
    start: string;
    end: string;
  };
  totalSpent: number;
  totalBookings: number;
  pendingAmount: number;
  paidAmount: number;
  creditLimit: number;
  availableCredit: number;
  invoiceCount: number;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amount: number;
    status: 'draft' | 'pending' | 'paid' | 'overdue';
    dueDate: string;
    paidAt?: string;
  }>;
  recentTransactions: Array<{
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'charge' | 'payment' | 'refund' | 'credit';
    bookingId?: string;
  }>;
  paymentMethods: Array<{
    id: string;
    type: 'card' | 'bank_account' | 'invoice';
    last4?: string;
    brand?: string;
    isDefault: boolean;
    expiryDate?: string;
  }>;
}

export interface CreateCompanyPayload {
  name: string;
  description: string;
  industry: string;
  size: Company['size'];
  website?: string;
  address: Company['address'];
  billingAddress?: Company['billingAddress'];
  primaryContact: Company['primaryContact'];
  taxId?: string;
  billingEmail: string;
  paymentTerms?: Company['paymentTerms'];
  creditLimit?: number;
}

export interface AddEmployeePayload {
  name: string;
  email: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  role: CompanyEmployee['role'];
  bookingAllowance?: {
    monthlyLimit?: number;
  };
  sendInvitation?: boolean;
}

export interface UpdateEmployeePayload {
  name?: string;
  email?: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  role?: CompanyEmployee['role'];
  isActive?: boolean;
  bookingAllowance?: {
    monthlyLimit?: number;
  };
}

export interface CorporateStats {
  totalCompanies: number;
  activeCompanies: number;
  totalEmployees: number;
  activeEmployees: number;
  totalBookings: number;
  totalRevenue: number;
  averageBookingValue: number;
  topCompanies: Array<{
    companyId: string;
    companyName: string;
    totalBookings: number;
    totalSpent: number;
  }>;
}

// ============================================
// Corporate API Service
// ============================================

export interface CorporateApi {
  /**
   * Get all companies (admin)
   */
  getCompanies: (options?: {
    page?: number;
    limit?: number;
    status?: Company['status'];
    industry?: string;
    search?: string;
    sortBy?: 'name' | 'createdAt' | 'totalSpent';
    sortOrder?: 'asc' | 'desc';
  }) => Promise<{
    companies: Company[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Get a single company by ID
   */
  getCompany: (id: string) => Promise<Company>;

  /**
   * Get my company
   */
  getMyCompany: () => Promise<Company>;

  /**
   * Create a new company
   */
  createCompany: (data: CreateCompanyPayload) => Promise<Company>;

  /**
   * Update a company
   */
  updateCompany: (id: string, data: Partial<CreateCompanyPayload>) => Promise<Company>;

  /**
   * Update company status
   */
  updateCompanyStatus: (id: string, status: Company['status']) => Promise<Company>;

  /**
   * Get company employees
   */
  getEmployees: (companyId: string, options?: {
    page?: number;
    limit?: number;
    role?: CompanyEmployee['role'];
    isActive?: boolean;
  }) => Promise<{
    employees: CompanyEmployee[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;

  /**
   * Add employee to company
   */
  addEmployee: (companyId: string, data: AddEmployeePayload) => Promise<CompanyEmployee>;

  /**
   * Update employee
   */
  updateEmployee: (id: string, data: UpdateEmployeePayload) => Promise<CompanyEmployee>;

  /**
   * Remove employee from company
   */
  removeEmployee: (id: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Get corporate billing information
   */
  getCorporateBilling: (companyId: string) => Promise<CorporateBilling>;

  /**
   * Get billing invoices
   */
  getBillingInvoices: (companyId: string, options?: {
    page?: number;
    limit?: number;
    status?: string;
  }) => Promise<{
    invoices: CorporateBilling['invoices'];
    total: number;
  }>;

  /**
   * Add payment method
   */
  addPaymentMethod: (
    companyId: string,
    data: {
      type: 'card' | 'bank_account';
      token: string;
      isDefault?: boolean;
    }
  ) => Promise<CorporateBilling['paymentMethods'][0]>;

  /**
   * Remove payment method
   */
  removePaymentMethod: (companyId: string, paymentMethodId: string) => Promise<{
    success: boolean;
    message: string;
  }>;

  /**
   * Set default payment method
   */
  setDefaultPaymentMethod: (companyId: string, paymentMethodId: string) => Promise<{
    success: boolean;
    defaultPaymentMethod: CorporateBilling['paymentMethods'][0];
  }>;

  /**
   * Make payment
   */
  makePayment: (
    companyId: string,
    data: {
      amount: number;
      paymentMethodId?: string;
      invoiceIds?: string[];
    }
  ) => Promise<{
    success: boolean;
    transactionId: string;
    newBalance: number;
  }>;

  /**
   * Get corporate statistics (admin)
   */
  getCorporateStats: (options?: { startDate?: string; endDate?: string }) => Promise<CorporateStats>;

  /**
   * Get company usage report
   */
  getUsageReport: (
    companyId: string,
    options?: { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' | 'month' }
  ) => Promise<{
    company: { id: string; name: string };
    period: { start: string; end: string };
    totalBookings: number;
    totalSpent: number;
    byEmployee: Array<{
      employeeId: string;
      employeeName: string;
      bookings: number;
      spent: number;
    }>;
    byService: Array<{
      serviceId: string;
      serviceName: string;
      bookings: number;
      spent: number;
    }>;
    daily: Array<{
      date: string;
      bookings: number;
      spent: number;
    }>;
  }>;
}

export const corporateApi: CorporateApi = {
  /**
   * Get all companies (admin only)
   * @param options - Query options including filters and sorting
   */
  getCompanies: async (options = {}) => {
    const response = await api.get('/corporate/companies', { params: options });
    return response.data.data;
  },

  /**
   * Get a single company by ID
   * @param id - The company ID
   */
  getCompany: async (id: string) => {
    const response = await api.get(`/corporate/companies/${id}`);
    return response.data.data;
  },

  /**
   * Get the current user's company
   */
  getMyCompany: async () => {
    const response = await api.get('/corporate/my-company');
    return response.data.data;
  },

  /**
   * Create a new company
   * @param data - Company data including contact and billing info
   */
  createCompany: async (data: CreateCompanyPayload) => {
    const response = await api.post('/corporate/companies', data);
    return response.data.data;
  },

  /**
   * Update company information
   * @param id - The company ID
   * @param data - Fields to update
   */
  updateCompany: async (id: string, data: Partial<CreateCompanyPayload>) => {
    const response = await api.patch(`/corporate/companies/${id}`, data);
    return response.data.data;
  },

  /**
   * Update company status
   * @param id - The company ID
   * @param status - New status
   */
  updateCompanyStatus: async (id: string, status: Company['status']) => {
    const response = await api.patch(`/corporate/companies/${id}/status`, { status });
    return response.data.data;
  },

  /**
   * Get employees for a company
   * @param companyId - The company ID
   * @param options - Filter and pagination options
   */
  getEmployees: async (companyId: string, options = {}) => {
    const response = await api.get(`/corporate/companies/${companyId}/employees`, {
      params: options,
    });
    return response.data.data;
  },

  /**
   * Add a new employee to company
   * @param companyId - The company ID
   * @param data - Employee data
   */
  addEmployee: async (companyId: string, data: AddEmployeePayload) => {
    const response = await api.post(
      `/corporate/companies/${companyId}/employees`,
      data
    );
    return response.data.data;
  },

  /**
   * Update employee details
   * @param id - The employee ID
   * @param data - Fields to update
   */
  updateEmployee: async (id: string, data: UpdateEmployeePayload) => {
    const response = await api.patch(`/corporate/employees/${id}`, data);
    return response.data.data;
  },

  /**
   * Remove an employee from company
   * @param id - The employee ID
   */
  removeEmployee: async (id: string) => {
    const response = await api.delete(`/corporate/employees/${id}`);
    return response.data;
  },

  /**
   * Get corporate billing information
   * @param companyId - The company ID
   */
  getCorporateBilling: async (companyId: string) => {
    const response = await api.get(`/corporate/companies/${companyId}/billing`);
    return response.data.data;
  },

  /**
   * Get billing invoices for a company
   * @param companyId - The company ID
   * @param options - Filter options
   */
  getBillingInvoices: async (companyId: string, options = {}) => {
    const response = await api.get(
      `/corporate/companies/${companyId}/billing/invoices`,
      { params: options }
    );
    return response.data.data;
  },

  /**
   * Add a payment method
   * @param companyId - The company ID
   * @param data - Payment method data
   */
  addPaymentMethod: async (companyId: string, data) => {
    const response = await api.post(
      `/corporate/companies/${companyId}/billing/payment-methods`,
      data
    );
    return response.data.data;
  },

  /**
   * Remove a payment method
   * @param companyId - The company ID
   * @param paymentMethodId - Payment method ID to remove
   */
  removePaymentMethod: async (companyId: string, paymentMethodId: string) => {
    const response = await api.delete(
      `/corporate/companies/${companyId}/billing/payment-methods/${paymentMethodId}`
    );
    return response.data;
  },

  /**
   * Set default payment method
   * @param companyId - The company ID
   * @param paymentMethodId - Payment method ID
   */
  setDefaultPaymentMethod: async (companyId: string, paymentMethodId: string) => {
    const response = await api.post(
      `/corporate/companies/${companyId}/billing/payment-methods/${paymentMethodId}/default`
    );
    return response.data.data;
  },

  /**
   * Make a payment
   * @param companyId - The company ID
   * @param data - Payment details
   */
  makePayment: async (companyId: string, data) => {
    const response = await api.post(
      `/corporate/companies/${companyId}/billing/pay`,
      data
    );
    return response.data.data;
  },

  /**
   * Get corporate statistics (admin)
   * @param options - Optional date range
   */
  getCorporateStats: async (options = {}) => {
    const response = await api.get('/corporate/stats', { params: options });
    return response.data.data;
  },

  /**
   * Get usage report for a company
   * @param companyId - The company ID
   * @param options - Report options
   */
  getUsageReport: async (companyId: string, options = {}) => {
    const response = await api.get(
      `/corporate/companies/${companyId}/usage`,
      { params: options }
    );
    return response.data.data;
  },
};

export default corporateApi;
