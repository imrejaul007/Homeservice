import mongoose, { Document, Schema, Model } from 'mongoose';

// Commission Tier Interface
export interface ICommissionTier {
  name?: string; // Optional name for tier identification (e.g., "Bronze", "Silver", "Gold")
  minAmount: number;
  maxAmount: number;
  rate: number; // Percentage (0-100)
}

// Commission Rule Interface
export interface ICommissionRule {
  _id?: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  type: 'standard' | 'tiered' | 'category' | 'provider' | 'promotional';
  // For category-based or provider-specific rules
  categoryId?: mongoose.Types.ObjectId;
  providerId?: mongoose.Types.ObjectId;
  // For tiered commission
  tiers?: ICommissionTier[];
  // For standard rate
  rate?: number;
  // Commission type
  commissionType: 'percentage' | 'flat';
  flatAmount?: number;
  // Application rules
  appliesTo: 'gross' | 'net';
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  // Priority (higher = applied first)
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

// Commission Record Interface
export interface ICommission extends Document {
  _id: mongoose.Types.ObjectId;

  // Multi-tenant support
  tenantId?: mongoose.Types.ObjectId;

  // Booking reference
  bookingId: mongoose.Types.ObjectId;
  bookingNumber: string;
  // Provider reference
  providerId: mongoose.Types.ObjectId;
  // Service reference
  serviceId: mongoose.Types.ObjectId;
  categoryId?: mongoose.Types.ObjectId;
  // Amounts
  grossAmount: number; // Total booking amount before deductions
  discountAmount: number; // Any discounts applied
  netAmount: number; // grossAmount - discountAmount
  // Commission details
  commissionRate: number; // The rate applied (percentage)
  commissionType: 'percentage' | 'flat';
  commissionAmount: number; // The calculated commission
  // Platform fees
  platformFee: number; // Additional platform fees
  paymentProcessingFee: number; // Payment processing fee
  totalDeductions: number; // commissionAmount + platformFee + paymentProcessingFee
  // Final amounts
  providerEarnings: number; // netAmount - totalDeductions
  // Rule applied
  ruleId: mongoose.Types.ObjectId;
  ruleName: string;
  ruleType: ICommissionRule['type'];
  // Tier information (for tiered commissions)
  tierApplied?: {
    minAmount: number;
    maxAmount: number;
    rate: number;
  };
  // Tax
  taxAmount: number;
  taxRate: number;
  // Adjustments
  adjustment?: {
    type: 'bonus' | 'penalty' | 'correction' | 'promotion';
    amount: number;
    reason: string;
    adjustedBy: mongoose.Types.ObjectId;
    adjustedAt: Date;
  };
  // Status
  status: 'calculated' | 'pending' | 'approved' | 'paid' | 'disputed' | 'reversed';
  // Timestamps
  calculatedAt: Date;
  approvedAt?: Date;
  paidAt?: Date;
  // Metadata
  metadata?: {
    customerId?: mongoose.Types.ObjectId;
    serviceTitle?: string;
    categoryName?: string;
    providerName?: string;
    bookingDate?: Date;
    currency?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Commission History Interface (for audit trail)
export interface ICommissionHistory extends Document {
  _id: mongoose.Types.ObjectId;
  commissionId: mongoose.Types.ObjectId;
  // Status and earnings changes tracking
  fieldChanged: string;
  previousStatus?: ICommission['status'];
  newStatus?: ICommission['status'];
  previousEarnings?: number;
  newEarnings?: number;
  previousValue?: any;
  newValue?: any;
  // Adjustment details
  adjustment?: {
    type: 'bonus' | 'penalty' | 'correction' | 'promotion';
    amount: number;
    reason: string;
  };
  changeReason?: string;
  // Who made the change
  adjustedBy: mongoose.Types.ObjectId;
  adjustedByRole: 'system' | 'admin' | 'provider';
  adjustedAt: Date;
}

// Commission Rule Schema
const commissionTierSchema = new Schema<ICommissionTier>(
  {
    name: {
      type: String,
      trim: true,
      maxlength: [50, 'Tier name cannot exceed 50 characters'],
    },
    minAmount: { type: Number, required: true, min: 0 },
    maxAmount: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

// Pre-save hook to validate tier min/max amounts
commissionTierSchema.pre('validate', function (next) {
  if (this.minAmount > this.maxAmount) {
    this.invalidate('minAmount', `minAmount (${this.minAmount}) cannot be greater than maxAmount (${this.maxAmount})`);
  }
  next();
});

const commissionRuleSchema = new Schema<ICommissionRule>(
  {
    name: {
      type: String,
      required: [true, 'Commission rule name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    type: {
      type: String,
      enum: ['standard', 'tiered', 'category', 'provider', 'promotional'],
      required: [true, 'Commission rule type is required'],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceCategory',
      sparse: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
    },
    tiers: [commissionTierSchema],
    rate: {
      type: Number,
      min: [0, 'Rate cannot be negative'],
      max: [100, 'Rate cannot exceed 100%'],
    },
    commissionType: {
      type: String,
      enum: ['percentage', 'flat'],
      required: [true, 'Commission type is required'],
      default: 'percentage',
    },
    flatAmount: {
      type: Number,
      min: [0, 'Flat amount cannot be negative'],
    },
    appliesTo: {
      type: String,
      enum: ['gross', 'net'],
      default: 'net',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: Date,
    endDate: Date,
    priority: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Commission Record Schema
const commissionSchema = new Schema<ICommission>(
  {
    // Multi-tenant support
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },

    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
      index: true,
    },
    bookingNumber: {
      type: String,
      required: [true, 'Booking number is required'],
      index: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Provider ID is required'],
      index: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required'],
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'ServiceCategory',
    },
    grossAmount: {
      type: Number,
      required: [true, 'Gross amount is required'],
      min: [0, 'Gross amount cannot be negative'],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, 'Discount amount cannot be negative'],
    },
    netAmount: {
      type: Number,
      required: [true, 'Net amount is required'],
      min: [0, 'Net amount cannot be negative'],
    },
    commissionRate: {
      type: Number,
      required: [true, 'Commission rate is required'],
      min: [0, 'Commission rate cannot be negative'],
      max: [100, 'Commission rate cannot exceed 100%'],
    },
    commissionType: {
      type: String,
      enum: ['percentage', 'flat'],
      default: 'percentage',
    },
    commissionAmount: {
      type: Number,
      required: [true, 'Commission amount is required'],
      min: [0, 'Commission amount cannot be negative'],
    },
    platformFee: {
      type: Number,
      default: 0,
      min: [0, 'Platform fee cannot be negative'],
    },
    paymentProcessingFee: {
      type: Number,
      default: 0,
      min: [0, 'Payment processing fee cannot be negative'],
    },
    totalDeductions: {
      type: Number,
      required: [true, 'Total deductions is required'],
      min: [0, 'Total deductions cannot be negative'],
    },
    providerEarnings: {
      type: Number,
      required: [true, 'Provider earnings is required'],
      min: [0, 'Provider earnings cannot be negative'],
    },
    ruleId: {
      type: Schema.Types.ObjectId,
      ref: 'CommissionRule',
      required: [true, 'Rule ID is required'],
    },
    ruleName: {
      type: String,
      required: [true, 'Rule name is required'],
    },
    ruleType: {
      type: String,
      enum: ['standard', 'tiered', 'category', 'provider', 'promotional'],
      required: true,
    },
    tierApplied: {
      minAmount: Number,
      maxAmount: Number,
      rate: Number,
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, 'Tax amount cannot be negative'],
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, 'Tax rate cannot be negative'],
    },
    adjustment: {
      type: {
        type: String,
        enum: ['bonus', 'penalty', 'correction', 'promotion'],
      },
      amount: Number,
      reason: String,
      adjustedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      adjustedAt: Date,
    },
    status: {
      type: String,
      enum: ['calculated', 'pending', 'approved', 'paid', 'disputed', 'reversed'],
      default: 'calculated',
      index: true,
    },
    calculatedAt: {
      type: Date,
      default: Date.now,
    },
    approvedAt: Date,
    paidAt: Date,
    metadata: {
      customerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      serviceTitle: String,
      categoryName: String,
      providerName: String,
      bookingDate: Date,
      currency: {
        type: String,
        default: 'AED',
        enum: ['AED', 'USD', 'INR', 'EUR', 'GBP'],
      },
    },
  },
  {
    timestamps: true,
  }
);

// Commission History Schema
const commissionHistorySchema = new Schema<ICommissionHistory>(
  {
    commissionId: {
      type: Schema.Types.ObjectId,
      ref: 'Commission',
      required: true,
      index: true,
    },
    fieldChanged: {
      type: String,
      required: true,
    },
    previousStatus: {
      type: String,
      enum: ['calculated', 'pending', 'approved', 'paid', 'disputed', 'reversed'],
    },
    newStatus: {
      type: String,
      enum: ['calculated', 'pending', 'approved', 'paid', 'disputed', 'reversed'],
    },
    previousEarnings: Number,
    newEarnings: Number,
    previousValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    adjustment: {
      type: {
        type: String,
        enum: ['bonus', 'penalty', 'correction', 'promotion'],
      },
      amount: Number,
      reason: String,
    },
    changeReason: {
      type: String,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
    },
    adjustedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    adjustedByRole: {
      type: String,
      enum: ['system', 'admin', 'provider'],
      required: true,
    },
    adjustedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // We have manual timestamps
  }
);

// ============================================
// INDEXES
// ============================================

// Commission rule indexes
commissionRuleSchema.index({ type: 1, isActive: 1 });
commissionRuleSchema.index({ categoryId: 1, isActive: 1 });
commissionRuleSchema.index({ providerId: 1, isActive: 1 });
commissionRuleSchema.index({ priority: -1 });
commissionRuleSchema.index({ startDate: 1, endDate: 1 });

// Commission record indexes
commissionSchema.index({ providerId: 1, status: 1, calculatedAt: -1 });
commissionSchema.index({ providerId: 1, 'metadata.bookingDate': -1 });
commissionSchema.index({ providerId: 1, 'metadata.bookingDate': 1, status: 1 }); // PERFORMANCE: compound index for date-range queries with status
commissionSchema.index({ bookingId: 1 }, { unique: true });
commissionSchema.index({ ruleId: 1 });
commissionSchema.index({ status: 1, calculatedAt: -1 });
commissionSchema.index({ 'metadata.customerId': 1 });
commissionSchema.index({ providerId: 1, completedAt: -1 }); // Index for queries filtering by completedAt date range

// Tenant isolation indexes
commissionSchema.index({ tenantId: 1, providerId: 1 });
commissionSchema.index({ tenantId: 1, status: 1 });

// Commission history indexes
commissionHistorySchema.index({ commissionId: 1, changedAt: -1 });
commissionHistorySchema.index({ changedBy: 1, changedAt: -1 });

// ============================================
// INSTANCE METHODS
// ============================================

// Recalculate provider earnings after adjustment
commissionSchema.methods.recalculateEarnings = function (): void {
  const baseEarnings = this.netAmount - this.commissionAmount - this.platformFee - this.paymentProcessingFee;

  if (this.adjustment) {
    if (this.adjustment.type === 'penalty') {
      this.providerEarnings = Math.max(0, baseEarnings - Math.abs(this.adjustment.amount));
    } else {
      this.providerEarnings = baseEarnings + this.adjustment.amount;
    }
  } else {
    this.providerEarnings = baseEarnings;
  }

  // Ensure earnings don't go negative
  this.providerEarnings = Math.max(0, this.providerEarnings);
};

// Update status with audit trail
commissionSchema.methods.updateStatus = async function (
  newStatus: ICommission['status'],
  changedBy: mongoose.Types.ObjectId,
  changedByRole: 'system' | 'admin' | 'provider',
  reason?: string
): Promise<void> {
  const CommissionHistory = mongoose.model<ICommissionHistory>('CommissionHistory');

  const historyEntry = new CommissionHistory({
    commissionId: this._id,
    fieldChanged: 'status',
    previousStatus: this.status,
    newStatus: newStatus,
    changeReason: reason || `Status changed to ${newStatus}`,
    adjustedBy: changedBy,
    adjustedByRole: changedByRole,
    adjustedAt: new Date(),
  });

  this.status = newStatus;

  if (newStatus === 'approved') {
    this.approvedAt = new Date();
  } else if (newStatus === 'paid') {
    this.paidAt = new Date();
  }

  await Promise.all([this.save(), historyEntry.save()]);
};

// ============================================
// STATIC METHODS
// ============================================

// Get commissions for a provider within date range
commissionSchema.statics.findByProviderAndDateRange = function (
  providerId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date,
  filters: {
    status?: ICommission['status'];
    categoryId?: mongoose.Types.ObjectId;
  } = {}
) {
  const query: any = {
    providerId,
    'metadata.bookingDate': { $gte: startDate, $lte: endDate },
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.categoryId) {
    query.categoryId = filters.categoryId;
  }

  return this.find(query).sort({ 'metadata.bookingDate': -1 }).populate('bookingId serviceId categoryId');
};

// Get commission summary for provider
commissionSchema.statics.getProviderCommissionSummary = async function (
  providerId: mongoose.Types.ObjectId,
  startDate: Date,
  endDate: Date
) {
  const result = await this.aggregate([
    {
      $match: {
        providerId,
        'metadata.bookingDate': { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalGross: { $sum: '$grossAmount' },
        totalCommission: { $sum: '$commissionAmount' },
        totalPlatformFee: { $sum: '$platformFee' },
        totalPaymentProcessingFee: { $sum: '$paymentProcessingFee' },
        totalTax: { $sum: '$taxAmount' },
        totalEarnings: { $sum: '$providerEarnings' },
      },
    },
  ]);

  return result;
};

// Get top commission earners
commissionSchema.statics.getTopEarners = function (limit: number = 10, startDate: Date, endDate: Date) {
  return this.aggregate([
    {
      $match: {
        'metadata.bookingDate': { $gte: startDate, $lte: endDate },
        status: { $in: ['calculated', 'pending', 'approved', 'paid'] },
      },
    },
    {
      $group: {
        _id: '$providerId',
        totalEarnings: { $sum: '$providerEarnings' },
        totalCommission: { $sum: '$commissionAmount' },
        bookingCount: { $sum: 1 },
      },
    },
    { $sort: { totalEarnings: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'provider',
      },
    },
    { $unwind: '$provider' },
    {
      $project: {
        providerId: '$_id',
        providerName: { $concat: ['$provider.firstName', ' ', '$provider.lastName'] },
        totalEarnings: 1,
        totalCommission: 1,
        bookingCount: 1,
      },
    },
  ]);
};

// ============================================
// COMPILE MODELS
// ============================================

export const CommissionRule: Model<ICommissionRule> = mongoose.model<ICommissionRule>(
  'CommissionRule',
  commissionRuleSchema
);

export const Commission: Model<ICommission> = mongoose.model<ICommission>('Commission', commissionSchema);

export const CommissionHistory: Model<ICommissionHistory> = mongoose.model<ICommissionHistory>(
  'CommissionHistory',
  commissionHistorySchema
);

export default {
  CommissionRule,
  Commission,
  CommissionHistory,
};
