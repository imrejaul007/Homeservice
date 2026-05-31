import mongoose, { Schema, Document } from 'mongoose';

// Corporate wallet status
export type CorporateWalletStatus = 'active' | 'suspended' | 'frozen' | 'closed';

// Corporate wallet transaction types
export type CorporateTransactionType = 'charge' | 'refund' | 'credit' | 'limit_adjustment' | 'fee';

export interface ICorporateWallet extends Document {
  // Multi-tenant
  tenantId?: mongoose.Types.ObjectId;

  companyId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId; // Primary employee (company admin)
  employeeName?: string;
  employeeEmail?: string;
  department?: string;
  monthlyLimit?: number;
  usedThisMonth?: number;
  bookingCount?: number;

  // Balance and limits
  currentBalance: number;
  creditLimit: number;
  availableCredit: number;
  currency: string;

  // Spending limits
  dailySpendingLimit?: number;
  monthlySpendingLimit?: number;
  perTransactionLimit?: number;

  // Tracking
  totalSpent: number;
  totalSpentThisMonth: number;
  totalSpentThisYear: number;
  spendingResetAt?: Date;

  // Status
  status: CorporateWalletStatus;

  // Approval settings
  requiresApprovalAbove?: number;
  approvalEmails?: string[];

  // Transactions
  transactions: Array<{
    id: string;
    type: CorporateTransactionType;
    amount: number;
    description: string;
    reference: string;
    referenceType: 'booking' | 'refund' | 'adjustment' | 'fee';
    status: 'pending' | 'completed' | 'failed' | 'reversed';
    balanceAfter: number;
    employeeId?: mongoose.Types.ObjectId;
    employeeName?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    completedAt?: Date;
  }>;

  // Billing cycle
  billingCycle: 'monthly' | 'quarterly' | 'annually';
  billingDay: number; // Day of month for billing
  nextBillingDate: Date;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

// Corporate spending by employee
export interface ICorporateSpending extends Document {
  // Multi-tenant
  tenantId?: mongoose.Types.ObjectId;

  companyId: mongoose.Types.ObjectId;
  walletId: mongoose.Types.ObjectId;

  employeeId: mongoose.Types.ObjectId;
  employeeName: string;
  employeeEmail: string;
  department?: string;

  // Spending limits for this employee
  monthlyLimit?: number;
  usedThisMonth: number;

  // Spending tracking
  totalSpent: number;
  bookingCount: number;

  // Period
  periodStart: Date;
  periodEnd: Date;

  // Breakdown by service category
  spendingByCategory: Array<{
    categoryId: mongoose.Types.ObjectId;
    categoryName: string;
    amount: number;
    bookingCount: number;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

const corporateWalletSchema = new Schema<ICorporateWallet>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    companyId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    currentBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    creditLimit: {
      type: Number,
      default: 0,
      min: 0,
    },
    availableCredit: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'AED',
    },
    dailySpendingLimit: {
      type: Number,
      min: 0,
    },
    monthlySpendingLimit: {
      type: Number,
      min: 0,
    },
    perTransactionLimit: {
      type: Number,
      min: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSpentThisMonth: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSpentThisYear: {
      type: Number,
      default: 0,
      min: 0,
    },
    spendingResetAt: Date,
    status: {
      type: String,
      enum: ['active', 'suspended', 'frozen', 'closed'],
      default: 'active',
      index: true,
    },
    requiresApprovalAbove: {
      type: Number,
      min: 0,
    },
    approvalEmails: [String],
    transactions: [{
      id: { type: String, required: true },
      type: {
        type: String,
        enum: ['charge', 'refund', 'credit', 'limit_adjustment', 'fee'],
        required: true,
      },
      amount: { type: Number, required: true },
      description: { type: String, required: true },
      reference: { type: String, required: true },
      referenceType: {
        type: String,
        enum: ['booking', 'refund', 'adjustment', 'fee'],
        required: true,
      },
      status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'reversed'],
        default: 'completed',
      },
      balanceAfter: { type: Number, required: true },
      employeeId: { type: Schema.Types.ObjectId, ref: 'User' },
      employeeName: String,
      metadata: { type: Schema.Types.Mixed },
      createdAt: { type: Date, default: Date.now },
      completedAt: Date,
    }],
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'annually'],
      default: 'monthly',
    },
    billingDay: {
      type: Number,
      min: 1,
      max: 28,
      default: 1,
    },
    nextBillingDate: {
      type: Date,
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
corporateWalletSchema.index({ tenantId: 1, companyId: 1 });
corporateWalletSchema.index({ tenantId: 1, status: 1 });
corporateWalletSchema.index({ 'transactions.createdAt': -1 });
corporateWalletSchema.index({ employeeId: 1, 'transactions.createdAt': -1 });

const corporateSpendingSchema = new Schema<ICorporateSpending>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    companyId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    walletId: {
      type: Schema.Types.ObjectId,
      ref: 'CorporateWallet',
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      required: true,
    },
    employeeEmail: {
      type: String,
      required: true,
    },
    department: String,
    monthlyLimit: {
      type: Number,
      min: 0,
    },
    usedThisMonth: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: 0,
    },
    bookingCount: {
      type: Number,
      default: 0,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    spendingByCategory: [{
      categoryId: { type: Schema.Types.ObjectId, ref: 'ServiceCategory' },
      categoryName: String,
      amount: { type: Number, default: 0 },
      bookingCount: { type: Number, default: 0 },
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes
corporateSpendingSchema.index({ companyId: 1, periodStart: -1, periodEnd: -1 });
corporateSpendingSchema.index({ employeeId: 1, periodStart: -1, periodEnd: -1 });
corporateSpendingSchema.index({ companyId: 1, employeeId: 1, periodStart: -1 });

const CorporateWallet = mongoose.model<ICorporateWallet>('CorporateWallet', corporateWalletSchema);
const CorporateSpending = mongoose.model<ICorporateSpending>('CorporateSpending', corporateSpendingSchema);

export { CorporateWallet, CorporateSpending };
export default CorporateWallet;
