import mongoose, { Types } from 'mongoose';
import User from '../models/user.model';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { eventBus, EVENT_TYPES } from '../event-bus';

// ============================================
// Types & Interfaces
// ============================================

export type AccountStatus = 'pending' | 'active' | 'suspended' | 'cancelled';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type EmployeeRole = 'employee' | 'manager' | 'admin';

export interface CorporateAccount {
  _id?: Types.ObjectId;
  accountId: string;
  companyName: string;
  companyRegistrationNumber?: string;
  companyEmail: string;
  companyPhone?: string;
  companyAddress?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  industry?: string;
  website?: string;
  accountManagerId?: Types.ObjectId;
  status: AccountStatus;
  spendingLimit?: {
    monthly?: number;
    perTransaction?: number;
    currency?: string;
  };
  paymentTerms: 'prepaid' | 'net15' | 'net30' | 'net60';
  creditLimit?: number;
  currentBalance?: number;
  billingEmail?: string;
  taxId?: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  metadata?: {
    employeeCount?: number;
    industryCategory?: string;
    referralSource?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  _id?: Types.ObjectId;
  employeeId: string;
  corporateAccountId: Types.ObjectId;
  userId?: Types.ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  role: EmployeeRole;
  department?: string;
  spendingLimit?: number;
  isActive: boolean;
  addedBy: Types.ObjectId;
  addedAt: Date;
  deactivatedAt?: Date;
  metadata?: {
    jobTitle?: string;
    costCenter?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface CorporateBilling {
  _id?: Types.ObjectId;
  invoiceId: string;
  corporateAccountId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  totalAmount: number;
  subtotal: number;
  taxAmount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  dueDate: Date;
  paidAt?: Date;
  paymentMethod?: string;
  transactions: Array<{
    employeeId: string;
    employeeName: string;
    description: string;
    amount: number;
    date: Date;
  }>;
  createdAt: Date;
}

// ============================================
// Corporate Account Service
// ============================================

export class CorporateAccountService {
  private accountModel: any;
  private employeeModel: any;
  private billingModel: any;

  constructor() {
    this.initializeModels();
  }

  private initializeModels(): void {
    this.accountModel = this.createAccountSchema();
    this.employeeModel = this.createEmployeeSchema();
    this.billingModel = this.createBillingSchema();
  }

  private createAccountSchema(): any {
    const AccountSchema = new mongoose.Schema({
      accountId: { type: String, required: true, unique: true },
      companyName: { type: String, required: true, trim: true },
      companyRegistrationNumber: String,
      companyEmail: { type: String, required: true },
      companyPhone: String,
      companyAddress: {
        street: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
      industry: String,
      website: String,
      accountManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: { type: String, enum: ['pending', 'active', 'suspended', 'cancelled'], default: 'pending' },
      spendingLimit: {
        monthly: Number,
        perTransaction: Number,
        currency: { type: String, default: 'AED' },
      },
      paymentTerms: { type: String, enum: ['prepaid', 'net15', 'net30', 'net60'], default: 'prepaid' },
      creditLimit: Number,
      currentBalance: { type: Number, default: 0 },
      billingEmail: String,
      taxId: String,
      approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      approvedAt: Date,
      rejectionReason: String,
      metadata: {
        employeeCount: Number,
        industryCategory: String,
        referralSource: String,
      },
    }, { timestamps: true });

    AccountSchema.index({ accountId: 1 }, { unique: true });
    AccountSchema.index({ companyEmail: 1 });
    AccountSchema.index({ status: 1, approvalStatus: 1 });

    return mongoose.model('CorporateAccount', AccountSchema);
  }

  private createEmployeeSchema(): any {
    const EmployeeSchema = new mongoose.Schema({
      employeeId: { type: String, required: true, unique: true },
      corporateAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'CorporateAccount', required: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      email: { type: String, required: true },
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      role: { type: String, enum: ['employee', 'manager', 'admin'], default: 'employee' },
      department: String,
      spendingLimit: Number,
      isActive: { type: Boolean, default: true },
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      addedAt: { type: Date, default: Date.now },
      deactivatedAt: Date,
      metadata: {
        jobTitle: String,
        costCenter: String,
      },
    }, { timestamps: true });

    EmployeeSchema.index({ employeeId: 1 }, { unique: true });
    EmployeeSchema.index({ corporateAccountId: 1, isActive: 1 });
    EmployeeSchema.index({ email: 1 });

    return mongoose.model('Employee', EmployeeSchema);
  }

  private createBillingSchema(): any {
    const BillingSchema = new mongoose.Schema({
      invoiceId: { type: String, required: true, unique: true },
      corporateAccountId: { type: mongoose.Schema.Types.ObjectId, ref: 'CorporateAccount', required: true },
      periodStart: { type: Date, required: true },
      periodEnd: { type: Date, required: true },
      totalAmount: { type: Number, required: true },
      subtotal: { type: Number, required: true },
      taxAmount: { type: Number, default: 0 },
      currency: { type: String, default: 'AED' },
      status: { type: String, enum: ['pending', 'paid', 'overdue', 'cancelled'], default: 'pending' },
      dueDate: { type: Date, required: true },
      paidAt: Date,
      paymentMethod: String,
      transactions: [{
        employeeId: String,
        employeeName: String,
        description: String,
        amount: Number,
        date: Date,
      }],
    }, { timestamps: true });

    BillingSchema.index({ invoiceId: 1 }, { unique: true });
    BillingSchema.index({ corporateAccountId: 1, status: 1 });
    BillingSchema.index({ dueDate: 1 });

    return mongoose.model('CorporateBilling', BillingSchema);
  }

  /**
   * Register a new corporate account
   */
  async registerAccount(data: {
    companyName: string;
    companyEmail: string;
    companyPhone?: string;
    companyRegistrationNumber?: string;
    companyAddress?: CorporateAccount['companyAddress'];
    industry?: string;
    website?: string;
    billingEmail?: string;
    taxId?: string;
    paymentTerms?: CorporateAccount['paymentTerms'];
    spendingLimit?: {
      monthly?: number;
      perTransaction?: number;
    };
    creditLimit?: number;
    metadata?: {
      employeeCount?: number;
      industryCategory?: string;
      referralSource?: string;
    };
  }): Promise<{ success: boolean; account?: CorporateAccount; error?: string }> {
    try {
      const accountId = this.generateAccountId();

      const account = new this.accountModel({
        accountId,
        companyName: data.companyName,
        companyEmail: data.companyEmail,
        companyPhone: data.companyPhone,
        companyRegistrationNumber: data.companyRegistrationNumber,
        companyAddress: data.companyAddress,
        industry: data.industry,
        website: data.website,
        billingEmail: data.billingEmail || data.companyEmail,
        taxId: data.taxId,
        paymentTerms: data.paymentTerms || 'prepaid',
        spendingLimit: {
          ...data.spendingLimit,
          currency: 'AED',
        },
        creditLimit: data.creditLimit,
        status: 'pending',
        approvalStatus: 'pending',
        metadata: data.metadata,
      });

      await account.save();

      logger.info('Corporate account registered', {
        accountId,
        companyName: data.companyName,
        companyEmail: data.companyEmail,
      });

      // Emit event
      eventBus.publish(EVENT_TYPES.CORPORATE_ACCOUNT_REGISTERED, {
        accountId,
        companyName: data.companyName,
        companyEmail: data.companyEmail,
      });

      return { success: true, account };
    } catch (error) {
      logger.error('Error registering corporate account', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to register account',
      };
    }
  }

  /**
   * Approve corporate account
   */
  async approveAccount(
    accountId: string,
    approvedBy: string | Types.ObjectId,
    options: {
      creditLimit?: number;
      paymentTerms?: CorporateAccount['paymentTerms'];
      spendingLimit?: {
        monthly?: number;
        perTransaction?: number;
      };
    } = {}
  ): Promise<{ success: boolean; account?: CorporateAccount; error?: string }> {
    try {
      const approverObjectId = typeof approvedBy === 'string'
        ? new Types.ObjectId(approvedBy)
        : approvedBy;

      const account = await this.accountModel.findOne({ accountId });
      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      if (account.approvalStatus !== 'pending') {
        return { success: false, error: `Account already ${account.approvalStatus}` };
      }

      account.approvalStatus = 'approved';
      account.approvedBy = approverObjectId;
      account.approvedAt = new Date();
      account.status = 'active';

      if (options.creditLimit !== undefined) {
        account.creditLimit = options.creditLimit;
      }
      if (options.paymentTerms) {
        account.paymentTerms = options.paymentTerms;
      }
      if (options.spendingLimit) {
        account.spendingLimit = { ...options.spendingLimit, currency: 'AED' };
      }

      await account.save();

      logger.info('Corporate account approved', {
        accountId,
        approvedBy: approverObjectId.toString(),
      });

      return { success: true, account };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to approve account',
      };
    }
  }

  /**
   * Reject corporate account
   */
  async rejectAccount(
    accountId: string,
    rejectedBy: string | Types.ObjectId,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const account = await this.accountModel.findOne({ accountId });
      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      account.approvalStatus = 'rejected';
      account.rejectionReason = reason;
      account.status = 'cancelled';

      await account.save();

      logger.info('Corporate account rejected', {
        accountId,
        reason,
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reject account',
      };
    }
  }

  /**
   * Add employee to corporate account
   */
  async addEmployee(
    accountId: string,
    data: {
      email: string;
      firstName: string;
      lastName: string;
      role?: EmployeeRole;
      department?: string;
      spendingLimit?: number;
      addedBy: string | Types.ObjectId;
      metadata?: {
        jobTitle?: string;
        costCenter?: string;
      };
    }
  ): Promise<{ success: boolean; employee?: Employee; error?: string }> {
    try {
      const account = await this.accountModel.findOne({ accountId });
      if (!account) {
        return { success: false, error: 'Corporate account not found' };
      }

      if (account.status !== 'active') {
        return { success: false, error: 'Corporate account is not active' };
      }

      // Check for existing employee with same email
      const existingEmployee = await this.employeeModel.findOne({
        corporateAccountId: account._id,
        email: data.email,
      });
      if (existingEmployee) {
        return { success: false, error: 'Employee with this email already exists' };
      }

      const employeeId = this.generateEmployeeId();
      const addedByObjectId = typeof data.addedBy === 'string'
        ? new Types.ObjectId(data.addedBy)
        : data.addedBy;

      // Try to find existing user
      const existingUser = await User.findOne({ email: data.email });

      const employee = new this.employeeModel({
        employeeId,
        corporateAccountId: account._id,
        userId: existingUser?._id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'employee',
        department: data.department,
        spendingLimit: data.spendingLimit,
        addedBy: addedByObjectId,
        metadata: data.metadata,
      });

      await employee.save();

      logger.info('Employee added to corporate account', {
        employeeId,
        accountId,
        email: data.email,
      });

      return { success: true, employee };
    } catch (error) {
      logger.error('Error adding employee', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add employee',
      };
    }
  }

  /**
   * Remove employee from corporate account
   */
  async removeEmployee(
    employeeId: string,
    removedBy: string | Types.ObjectId
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const employee = await this.employeeModel.findOne({ employeeId });
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }

      employee.isActive = false;
      employee.deactivatedAt = new Date();
      await employee.save();

      logger.info('Employee removed from corporate account', {
        employeeId,
        accountId: employee.corporateAccountId.toString(),
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove employee',
      };
    }
  }

  /**
   * Update employee role/permissions
   */
  async updateEmployee(
    employeeId: string,
    updates: {
      role?: EmployeeRole;
      department?: string;
      spendingLimit?: number;
      metadata?: {
        jobTitle?: string;
        costCenter?: string;
      };
    }
  ): Promise<{ success: boolean; employee?: Employee; error?: string }> {
    try {
      const employee = await this.employeeModel.findOne({ employeeId });
      if (!employee) {
        return { success: false, error: 'Employee not found' };
      }

      if (updates.role) employee.role = updates.role;
      if (updates.department) employee.department = updates.department;
      if (updates.spendingLimit !== undefined) employee.spendingLimit = updates.spendingLimit;
      if (updates.metadata) {
        employee.metadata = { ...employee.metadata, ...updates.metadata };
      }

      await employee.save();

      return { success: true, employee };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update employee',
      };
    }
  }

  /**
   * Get corporate account by ID
   */
  async getAccount(accountId: string): Promise<CorporateAccount | null> {
    return this.accountModel.findOne({ accountId });
  }

  /**
   * Get employees for corporate account
   */
  async getEmployees(
    accountId: string,
    options: { includeInactive?: boolean; page?: number; limit?: number } = {}
  ): Promise<{ employees: Employee[]; total: number }> {
    const account = await this.accountModel.findOne({ accountId });
    if (!account) {
      return { employees: [], total: 0 };
    }

    const query: any = { corporateAccountId: account._id };
    if (!options.includeInactive) {
      query.isActive = true;
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const [employees, total] = await Promise.all([
      this.employeeModel.find(query).skip(skip).limit(limit),
      this.employeeModel.countDocuments(query),
    ]);

    return { employees, total };
  }

  /**
   * Update spending limit for account
   */
  async updateSpendingLimit(
    accountId: string,
    limits: {
      monthly?: number;
      perTransaction?: number;
    }
  ): Promise<{ success: boolean; account?: CorporateAccount; error?: string }> {
    try {
      const account = await this.accountModel.findOne({ accountId });
      if (!account) {
        return { success: false, error: 'Account not found' };
      }

      account.spendingLimit = {
        ...account.spendingLimit,
        ...limits,
        currency: 'AED',
      };

      await account.save();

      return { success: true, account };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update spending limit',
      };
    }
  }

  /**
   * Check if employee can make transaction
   */
  async validateTransaction(
    accountId: string,
    employeeId: string,
    amount: number
  ): Promise<{ valid: boolean; reason?: string }> {
    const account = await this.accountModel.findOne({ accountId });
    if (!account) {
      return { valid: false, reason: 'Corporate account not found' };
    }

    if (account.status !== 'active') {
      return { valid: false, reason: 'Corporate account is not active' };
    }

    const employee = await this.employeeModel.findOne({
      employeeId,
      corporateAccountId: account._id,
      isActive: true,
    });

    if (!employee) {
      return { valid: false, reason: 'Employee not found or inactive' };
    }

    // Check per-transaction limit
    if (account.spendingLimit?.perTransaction && amount > account.spendingLimit.perTransaction) {
      return { valid: false, reason: `Amount exceeds per-transaction limit of ${account.spendingLimit.perTransaction}` };
    }

    if (employee.spendingLimit && amount > employee.spendingLimit) {
      return { valid: false, reason: `Amount exceeds personal spending limit of ${employee.spendingLimit}` };
    }

    // Check credit limit
    if (account.creditLimit) {
      const projectedBalance = (account.currentBalance || 0) + amount;
      if (projectedBalance > account.creditLimit) {
        return { valid: false, reason: 'Transaction would exceed credit limit' };
      }
    }

    return { valid: true };
  }

  /**
   * Get pending corporate accounts for approval
   */
  async getPendingAccounts(options: {
    page?: number;
    limit?: number;
  } = {}): Promise<{ accounts: CorporateAccount[]; total: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const query = { approvalStatus: 'pending' };

    const [accounts, total] = await Promise.all([
      this.accountModel.find(query)
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),
      this.accountModel.countDocuments(query),
    ]);

    return { accounts, total };
  }

  // ============================================
  // Helper Methods
  // ============================================

  private generateAccountId(): string {
    return `CORP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }

  private generateEmployeeId(): string {
    return `EMP-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
}

// ============================================
// Export singleton instance
// ============================================

export const corporateAccountService = new CorporateAccountService();
export default corporateAccountService;
