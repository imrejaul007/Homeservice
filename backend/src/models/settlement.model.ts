import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ISettlement extends Document {
  _id: Types.ObjectId;

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

// Generate unique settlement number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(settlementSchema.methods as any).generateSettlementNumber = async function(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  // Count settlements for the month
  const startOfMonth = new Date(year, date.getMonth(), 1);
  const endOfMonth = new Date(year, date.getMonth() + 1, 1);

  const monthSettlementsCount = await mongoose.model('Settlement').countDocuments({
    createdAt: { $gte: startOfMonth, $lt: endOfMonth },
  });

  const sequenceNumber = String(monthSettlementsCount + 1).padStart(4, '0');
  return `STL-${year}${month}-${sequenceNumber}`;
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

// Generate settlements for all providers in a period
settlementSchema.statics.generateSettlements = async function(
  periodStart: Date,
  periodEnd: Date
) {
  const Settlement = this;
  const Booking = mongoose.model('Booking');

  // Get all completed bookings in the period that haven't been settled
  const bookings = await Booking.find({
    status: 'completed',
    completedAt: { $gte: periodStart, $lte: periodEnd },
    'payment.status': 'completed',
  }).populate('providerId');

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
  for (const [providerId, providerBookings] of bookingsByProvider) {
    const settlement = new Settlement({
      providerId,
      periodStart,
      periodEnd,
      lineItems: providerBookings.map(b => ({
        bookingId: b._id,
        bookingNumber: b.bookingNumber,
        date: b.completedAt || b.scheduledDate,
        grossAmount: b.pricing.totalAmount,
        commissionAmount: b.pricing.totalAmount * 0.15, // 15% commission
        platformFeeAmount: b.pricing.totalAmount * 0.02, // 2% platform fee
        netAmount: b.pricing.totalAmount * 0.83, // 83% to provider
        status: 'included',
      })),
      grossAmount: providerBookings.reduce((sum, b) => sum + b.pricing.totalAmount, 0),
      commission: providerBookings.reduce((sum, b) => sum + (b.pricing.totalAmount * 0.15), 0),
      platformFee: providerBookings.reduce((sum, b) => sum + (b.pricing.totalAmount * 0.02), 0),
      netAmount: providerBookings.reduce((sum, b) => sum + (b.pricing.totalAmount * 0.83), 0),
      deductions: [],
      status: 'pending',
    });

    await (settlement as any).generateSettlementNumber();
    settlements.push(settlement);
  }

  // Save all settlements
  await Settlement.insertMany(settlements);

  return settlements;
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
