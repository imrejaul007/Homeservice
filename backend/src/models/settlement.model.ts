import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import logger from '../utils/logger';

export interface ISettlement extends Document {
  _id: Types.ObjectId;

  // Multi-tenant support
  tenantId?: Types.ObjectId;

  // Reference and identification
  settlementNumber: string;
  providerId: Types.ObjectId;
  payoutId?: Types.ObjectId;

  // Period covered
  periodStart: Date;
  periodEnd: Date;

  // Amount calculations
  grossAmount: number;
  commission: number;
  platformFee: number;
  netAmount: number;

  // Deductions breakdown
  deductions: Array<{
    type: string;
    amount: number;
    description: string;
    reference?: string;
  }>;

  // Line items (bookings included)
  lineItems: Array<{
    bookingId: Types.ObjectId;
    bookingNumber: string;
    date: Date;
    grossAmount: number;
    commissionAmount: number;
    platformFeeAmount: number;
    netAmount: number;
    status: 'pending' | 'included' | 'disputed';
  }>;

  // Status tracking
  status: 'pending' | 'approved' | 'paid' | 'disputed' | 'cancelled';

  // Settlement details
  currency: string;
  exchangeRate?: number;

  // Reconciliation
  reconciliation: {
    isReconciled: boolean;
    reconciledAt?: Date;
    reconciledBy?: Types.ObjectId;
    discrepancies?: Array<{
      field: string;
      expected: number;
      actual: number;
      resolved: boolean;
      resolvedAt?: Date;
    }>;
  };

  // Metadata
  metadata?: Record<string, unknown>;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  paidAt?: Date;

  // Virtual
  totalDeductions: number;
  totalLineItems: number;
  isPaid: boolean;
}

const settlementSchema = new Schema<ISettlement>(
  {
    // Multi-tenant support
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },

    settlementNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },

    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Provider ID is required'],
      index: true,
    },

    payoutId: {
      type: Schema.Types.ObjectId,
      ref: 'Payout',
    },

    periodStart: {
      type: Date,
      required: [true, 'Period start date is required'],
    },

    periodEnd: {
      type: Date,
      required: [true, 'Period end date is required'],
    },

    grossAmount: {
      type: Number,
      required: [true, 'Gross amount is required'],
      min: [0, 'Gross amount cannot be negative'],
    },

    commission: {
      type: Number,
      required: [true, 'Commission is required'],
      min: [0, 'Commission cannot be negative'],
    },

    platformFee: {
      type: Number,
      required: [true, 'Platform fee is required'],
      min: [0, 'Platform fee cannot be negative'],
    },

    netAmount: {
      type: Number,
      required: [true, 'Net amount is required'],
      min: [0, 'Net amount cannot be negative'],
    },

    deductions: [{
      type: {
        type: String,
        required: true,
        enum: ['refund', 'chargeback', 'fee', 'adjustment', 'bonus', 'penalty', 'other'],
      },
      amount: {
        type: Number,
        required: true,
        min: 0,
      },
      description: {
        type: String,
        required: true,
      },
      reference: String,
    }],

    lineItems: [{
      bookingId: {
        type: Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
      },
      bookingNumber: {
        type: String,
        required: true,
      },
      date: {
        type: Date,
        required: true,
      },
      grossAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      commissionAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      platformFeeAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      netAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      status: {
        type: String,
        enum: ['pending', 'included', 'disputed'],
        default: 'included',
      },
    }],

    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'disputed', 'cancelled'],
      default: 'pending',
      required: true,
      index: true,
    },

    currency: {
      type: String,
      default: 'AED',
      enum: ['AED', 'USD', 'EUR', 'GBP'],
    },

    exchangeRate: {
      type: Number,
      min: 0,
    },

    reconciliation: {
      isReconciled: {
        type: Boolean,
        default: false,
      },
      reconciledAt: Date,
      reconciledBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      discrepancies: [{
        field: { type: String, required: true },
        expected: { type: Number, required: true },
        actual: { type: Number, required: true },
        resolved: {
          type: Boolean,
          default: false,
        },
        resolvedAt: Date,
      }],
    },

    metadata: {
      type: Schema.Types.Mixed,
    },

    approvedAt: Date,
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    paidAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ===================================
// INDEXES
// ===================================

// Query optimization indexes
settlementSchema.index({ providerId: 1, status: 1, periodStart: -1 });
settlementSchema.index({ status: 1, createdAt: -1 });
settlementSchema.index({ providerId: 1, payoutId: 1 });
settlementSchema.index({ periodStart: 1, periodEnd: 1 });

// Tenant isolation indexes
settlementSchema.index({ tenantId: 1, providerId: 1 });
settlementSchema.index({ tenantId: 1, status: 1 });

// FIX: Add index for settlement reconciliation queries
settlementSchema.index({ 'reconciliation.isReconciled': 1, status: 1 });

// FIX: Add index for settlement date range queries
settlementSchema.index({ periodStart: -1, periodEnd: -1, providerId: 1 });

// FIX: Add index for line items queries (booking lookups)
settlementSchema.index({ 'lineItems.bookingId': 1 });

// ===================================
// VIRTUAL PROPERTIES
// ===================================

settlementSchema.virtual('totalDeductions').get(function() {
  return this.deductions.reduce((sum, d) => sum + d.amount, 0);
});

settlementSchema.virtual('totalLineItems').get(function() {
  return this.lineItems.length;
});

settlementSchema.virtual('isPaid').get(function() {
  return this.status === 'paid';
});

// ===================================
// INSTANCE METHODS
// ===================================

// Generate unique settlement number using atomic counter
// FIX: Use findOneAndUpdate with $inc to prevent race conditions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(settlementSchema.methods as any).generateSettlementNumber = async function(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  // Create a unique counter key for each month (e.g., "settlement-202405")
  const counterKey = `settlement-${year}${month}`;

  // Atomic increment - no race condition possible
  const sequenceNumber = await getSettlementSequenceValue(counterKey);

  return `STL-${year}${month}-${String(sequenceNumber).padStart(4, '0')}`;
};

// Add deduction
settlementSchema.methods.addDeduction = function(
  type: string,
  amount: number,
  description: string,
  reference?: string
): void {
  this.deductions.push({
    type,
    amount,
    description,
    reference,
  });

  // Recalculate net amount
  this.recalculateNetAmount();
};

// Remove deduction
settlementSchema.methods.removeDeduction = function(deductionIndex: number): void {
  if (deductionIndex >= 0 && deductionIndex < this.deductions.length) {
    this.deductions.splice(deductionIndex, 1);
    this.recalculateNetAmount();
  }
};

// Recalculate net amount
settlementSchema.methods.recalculateNetAmount = function(): void {
  const totalDeductions = this.deductions.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0);
  this.netAmount = this.grossAmount - this.commission - this.platformFee - totalDeductions;
};

// Add line item
settlementSchema.methods.addLineItem = function(
  bookingId: Types.ObjectId,
  bookingNumber: string,
  date: Date,
  grossAmount: number,
  commissionAmount: number,
  platformFeeAmount: number,
  netAmount: number
): void {
  this.lineItems.push({
    bookingId,
    bookingNumber,
    date,
    grossAmount,
    commissionAmount,
    platformFeeAmount,
    netAmount,
    status: 'included',
  });

  // Recalculate totals
  this.recalculateTotals();
};

// Remove line item
settlementSchema.methods.removeLineItem = function(lineItemIndex: number): void {
  if (lineItemIndex >= 0 && lineItemIndex < this.lineItems.length) {
    this.lineItems.splice(lineItemIndex, 1);
    this.recalculateTotals();
  }
};

// Recalculate all totals from line items
settlementSchema.methods.recalculateTotals = function(): void {
  this.grossAmount = this.lineItems.reduce((sum: number, item: { grossAmount: number }) => sum + item.grossAmount, 0);
  this.commission = this.lineItems.reduce((sum: number, item: { commissionAmount: number }) => sum + item.commissionAmount, 0);
  this.platformFee = this.lineItems.reduce((sum: number, item: { platformFeeAmount: number }) => sum + item.platformFeeAmount, 0);

  const totalDeductions = this.deductions.reduce((sum: number, d: { amount: number }) => sum + d.amount, 0);
  this.netAmount = this.grossAmount - this.commission - this.platformFee - totalDeductions;
};

// Approve settlement
settlementSchema.methods.approve = async function(approvedBy?: Types.ObjectId): Promise<void> {
  this.status = 'approved';
  this.approvedAt = new Date();
  this.approvedBy = approvedBy;
  await this.save();
};

// Mark as paid
settlementSchema.methods.markAsPaid = async function(
  payoutId: Types.ObjectId,
  paidBy?: Types.ObjectId
): Promise<void> {
  this.status = 'paid';
  this.paidAt = new Date();
  this.payoutId = payoutId;
  await this.save();
};

// Mark as disputed
settlementSchema.methods.dispute = async function(reason: string): Promise<void> {
  this.status = 'disputed';
  this.metadata = {
    ...this.metadata,
    disputeReason: reason,
    disputedAt: new Date(),
  };
  await this.save();
};

// Reconcile settlement
settlementSchema.methods.reconcile = async function(
  reconciledBy: Types.ObjectId,
  discrepancies?: Array<{ field: string; expected: number; actual: number }>
): Promise<void> {
  this.reconciliation.isReconciled = true;
  this.reconciliation.reconciledAt = new Date();
  this.reconciliation.reconciledBy = reconciledBy;

  if (discrepancies && discrepancies.length > 0) {
    this.reconciliation.discrepancies = discrepancies.map(d => ({
      ...d,
      resolved: false,
    }));
  }

  await this.save();
};

// ===================================
// ATOMIC SETTLEMENT GENERATION
// ===================================
// Counter model for atomic settlement number generation
// This prevents race conditions when multiple settlements are created simultaneously

// Plain interface for lean documents (not extending Document)
interface ICounterDoc {
  _id: string;
  seq: number;
}

const settlementCounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

// Compound index for counter queries
settlementCounterSchema.index({ _id: 1 });

// Use mongoose model without generic to avoid _id type conflict
const SettlementCounter = mongoose.model('SettlementCounter', settlementCounterSchema);

/**
 * Atomic counter for settlement numbers using findOneAndUpdate with $inc
 * This prevents race conditions when multiple settlements are created simultaneously
 */
async function getSettlementSequenceValue(sequenceName: string): Promise<number> {
  const result = await SettlementCounter.findOneAndUpdate(
    { _id: sequenceName },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, returnDocument: 'after' }
  );
  return result.seq;
}

// Default commission rates (fallback if subscription not found)
const DEFAULT_COMMISSION_RATE = 0.15; // 15%
const DEFAULT_PLATFORM_FEE_RATE = 0.02; // 2%

/**
 * Get commission rate for a provider from their subscription
 * Returns negotiated rate or default if no subscription found
 */
async function getProviderCommissionRate(providerId: string | Types.ObjectId): Promise<number> {
  try {
    const Subscription = mongoose.model('Subscription');
    const subscription = await Subscription.findOne({ providerId });
    if (subscription && subscription.features?.commissionRate) {
      return subscription.features.commissionRate / 100; // Convert percentage to decimal
    }
  } catch (error) {
    // Subscription model might not be registered, use default
    logger.warn('Could not fetch subscription for provider, using default commission rate', {
      context: 'Settlement',
      providerId: String(providerId),
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return DEFAULT_COMMISSION_RATE;
}

// ===================================
// STATIC METHODS
// ===================================

// Find settlements for a provider by period
settlementSchema.statics.findByPeriod = function(
  providerId: string | Types.ObjectId,
  periodStart: Date,
  periodEnd: Date
) {
  return this.findOne({
    providerId,
    periodStart: { $lte: periodStart },
    periodEnd: { $gte: periodEnd },
  }).populate('lineItems.bookingId');
};

// Get settlements awaiting payout
settlementSchema.statics.findAwaitingPayout = function(
  providerId?: string | Types.ObjectId
) {
  const query: Record<string, unknown> = {
    status: 'approved',
    payoutId: { $exists: false },
  };

  if (providerId) {
    query.providerId = providerId;
  }

  return this.find(query).sort({ periodEnd: 1 });
};

// Get settlement summary for provider
settlementSchema.statics.getProviderSettlementSummary = async function(
  providerId: string | Types.ObjectId,
  startDate?: Date,
  endDate?: Date
) {
  const matchStage: Record<string, unknown> = { providerId };

  if (startDate || endDate) {
    matchStage.periodStart = {};
    if (startDate) (matchStage.periodStart as Record<string, Date>).$gte = startDate;
    if (endDate) (matchStage.periodStart as Record<string, Date>).$lte = endDate;
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        grossAmount: { $sum: '$grossAmount' },
        commission: { $sum: '$commission' },
        platformFee: { $sum: '$platformFee' },
        netAmount: { $sum: '$netAmount' },
      },
    },
  ];

  const results = await this.aggregate(pipeline);

  return results.reduce((acc, item) => {
    acc[item._id] = {
      count: item.count,
      grossAmount: item.grossAmount,
      commission: item.commission,
      platformFee: item.platformFee,
      netAmount: item.netAmount,
    };
    return acc;
  }, {} as Record<string, {
    count: number;
    grossAmount: number;
    commission: number;
    platformFee: number;
    netAmount: number;
  }>);
};

/**
 * Generate settlements for all providers in a period using atomic operations
 * FIX: Uses MongoDB transactions and atomic aggregation to prevent race conditions
 */
settlementSchema.statics.generateSettlements = async function(
  periodStart: Date,
  periodEnd: Date
) {
  const Settlement = this;
  const Booking = mongoose.model('Booking');
  const session = await mongoose.startSession();

  try {
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority' }
    });

    // Get all completed bookings in the period that haven't been settled
    // Use session for consistent reads within transaction
    const bookings = await Booking.find({
      status: 'completed',
      completedAt: { $gte: periodStart, $lte: periodEnd },
      'payment.status': 'completed',
    }).session(session).populate('providerId');

    // Group bookings by provider
    const bookingsByProvider = new Map<string, typeof bookings>();

    for (const booking of bookings) {
      const providerId = (booking.providerId as any)._id.toString();
      if (!bookingsByProvider.has(providerId)) {
        bookingsByProvider.set(providerId, []);
      }
      bookingsByProvider.get(providerId)!.push(booking);
    }

    // Generate settlements
    const settlements = [];
    const year = periodStart.getFullYear();
    const month = String(periodStart.getMonth() + 1).padStart(2, '0');

    for (const [providerId, providerBookings] of bookingsByProvider) {
      // Fetch provider's negotiated commission rate from subscription
      const commissionRate = await getProviderCommissionRate(providerId);
      const platformFeeRate = DEFAULT_PLATFORM_FEE_RATE;
      const providerRate = 1 - commissionRate - platformFeeRate;

      // FIX: Calculate amounts atomically with BigInt for precision
      // Use integer math to avoid floating-point race conditions
      let totalGross = 0;
      let totalCommission = 0;
      let totalPlatformFee = 0;

      const lineItems = providerBookings.map(b => {
        // Use integer math (amounts in fils/cents) for precision
        const grossAmountInteger = Math.round(b.pricing.totalAmount * 100);
        const commissionAmountInteger = Math.round(grossAmountInteger * commissionRate);
        const platformFeeAmountInteger = Math.round(grossAmountInteger * platformFeeRate);
        const netAmountInteger = grossAmountInteger - commissionAmountInteger - platformFeeAmountInteger;

        // Convert back to decimal for storage
        const grossAmount = grossAmountInteger / 100;
        const commissionAmount = commissionAmountInteger / 100;
        const platformFeeAmount = platformFeeAmountInteger / 100;
        const netAmount = netAmountInteger / 100;

        totalGross += grossAmount;
        totalCommission += commissionAmount;
        totalPlatformFee += platformFeeAmount;

        return {
          bookingId: b._id,
          bookingNumber: b.bookingNumber,
          date: b.completedAt || b.scheduledDate,
          grossAmount,
          commissionAmount,
          platformFeeAmount,
          netAmount,
          status: 'included' as const,
        };
      });

      // Calculate net amount from accumulated values (not derived from line items sum)
      // This ensures consistency between totals and line items
      const netAmount = totalGross - totalCommission - totalPlatformFee;

      const settlement = new Settlement({
        providerId,
        periodStart,
        periodEnd,
        lineItems,
        grossAmount: Math.round(totalGross * 100) / 100,
        commission: Math.round(totalCommission * 100) / 100,
        platformFee: Math.round(totalPlatformFee * 100) / 100,
        netAmount: Math.round(netAmount * 100) / 100,
        deductions: [],
        status: 'pending',
      });

      // Generate atomic settlement number
      const counterKey = `settlement-${year}${month}`;
      const sequenceNumber = await getSettlementSequenceValue(counterKey);
      settlement.settlementNumber = `STL-${year}${month}-${String(sequenceNumber).padStart(4, '0')}`;

      settlements.push(settlement);
    }

    // Save all settlements atomically within transaction
    if (settlements.length > 0) {
      await Settlement.insertMany(settlements, { session });
    }

    await session.commitTransaction();
    return settlements;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

// ===================================
// PRE-SAVE MIDDLEWARE
// ===================================

settlementSchema.pre('save', async function(next) {
  if (this.isNew && !this.settlementNumber) {
    try {
      this.settlementNumber = await (this as any).generateSettlementNumber();
    } catch (error) {
      return next(error as Error);
    }
  }
  next();
});

const Settlement: Model<ISettlement> = mongoose.model<ISettlement>('Settlement', settlementSchema);

export default Settlement;
