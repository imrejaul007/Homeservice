import mongoose, { Document, Schema, Model } from 'mongoose';
import { Types } from 'mongoose';

export interface IPayout extends Document {
  _id: Types.ObjectId;
  payoutNumber: string;
  providerId: Types.ObjectId;
  settlementId?: Types.ObjectId;

  // Amount information
  amount: number;
  currency: string;

  // Status tracking
  status: 'pending' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled';

  // Payout method
  method: 'bank_transfer' | 'wallet';

  // Bank account details (for bank transfers)
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    accountHolderName: string;
    iban?: string;
    swiftCode?: string;
    routingNumber?: string;
  };

  // Stripe payout reference
  stripePayoutId?: string;

  // Scheduling
  scheduledDate: Date;
  processedDate?: Date;

  // Failure tracking
  failures: Array<{
    reason: string;
    errorCode?: string;
    date: Date;
    retryAttempt: number;
  }>;

  // Retry configuration
  maxRetries: number;
  currentRetryCount: number;
  nextRetryDate?: Date;

  // Provider earnings breakdown at time of payout
  earningsBreakdown: {
    grossAmount: number;
    commission: number;
    platformFee: number;
    deductions: number;
    netAmount: number;
  };

  // Metadata
  metadata?: Record<string, unknown>;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: Types.ObjectId;
  processedBy?: Types.ObjectId;
  notes?: string;

  // Virtual
  isRetryable: boolean;
  canBeCancelled: boolean;

  // Instance methods
  generatePayoutNumber(): Promise<string>;
  addFailure(reason: string, errorCode?: string): Promise<void>;
  markAsProcessing(processedBy?: Types.ObjectId): Promise<void>;
  markAsCompleted(stripePayoutId?: string, processedBy?: Types.ObjectId): Promise<void>;
  cancel(reason: string, cancelledBy?: Types.ObjectId): Promise<void>;
}

// Extend the Model type to include static methods
export interface PayoutModel extends Model<IPayout> {
  findDuePayouts(batchSize?: number): Promise<IPayout[]>;
  findRetriablePayouts(batchSize?: number): Promise<IPayout[]>;
}

interface PayoutMethod {
  bank_transfer: 'bank_transfer';
  wallet: 'wallet';
}

const payoutSchema = new Schema<IPayout>(
  {
    payoutNumber: {
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

    settlementId: {
      type: Schema.Types.ObjectId,
      ref: 'Settlement',
      index: true,
    },

    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount cannot be negative'],
    },

    currency: {
      type: String,
      default: 'AED',
      enum: ['AED', 'USD', 'EUR', 'GBP'],
    },

    status: {
      type: String,
      enum: ['pending', 'scheduled', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      required: true,
      index: true,
    },

    method: {
      type: String,
      enum: ['bank_transfer', 'wallet'],
      default: 'bank_transfer',
      required: true,
    },

    bankDetails: {
      bankName: { type: String },
      accountNumber: { type: String },
      accountHolderName: { type: String },
      iban: { type: String },
      swiftCode: { type: String },
      routingNumber: { type: String },
    },

    stripePayoutId: {
      type: String,
      index: true,
    },

    scheduledDate: {
      type: Date,
      required: [true, 'Scheduled date is required'],
      index: true,
    },

    processedDate: {
      type: Date,
    },

    failures: [{
      reason: {
        type: String,
        required: true,
      },
      errorCode: String,
      date: {
        type: Date,
        default: Date.now,
      },
      retryAttempt: {
        type: Number,
        default: 0,
      },
    }],

    maxRetries: {
      type: Number,
      default: 3,
      min: 0,
      max: 5,
    },

    currentRetryCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    nextRetryDate: {
      type: Date,
    },

    earningsBreakdown: {
      grossAmount: {
        type: Number,
        required: true,
        min: 0,
      },
      commission: {
        type: Number,
        required: true,
        min: 0,
      },
      platformFee: {
        type: Number,
        required: true,
        min: 0,
      },
      deductions: {
        type: Number,
        required: true,
        min: 0,
      },
      netAmount: {
        type: Number,
        required: true,
        min: 0,
      },
    },

    metadata: {
      type: Schema.Types.Mixed,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },

    notes: String,
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
payoutSchema.index({ providerId: 1, status: 1, scheduledDate: 1 });
payoutSchema.index({ status: 1, scheduledDate: 1 });
payoutSchema.index({ providerId: 1, createdAt: -1 });

// Scheduled payout processing
payoutSchema.index({ status: 1, nextRetryDate: 1 });

// Provider payout history
payoutSchema.index({ providerId: 1, processedDate: -1 });

// ===================================
// VIRTUAL PROPERTIES
// ===================================

payoutSchema.virtual('isRetryable').get(function() {
  return (
    this.status === 'failed' &&
    this.currentRetryCount < this.maxRetries &&
    !!this.nextRetryDate &&
    new Date() >= this.nextRetryDate
  );
});

payoutSchema.virtual('canBeCancelled').get(function() {
  return ['pending', 'scheduled'].includes(this.status);
});

// ===================================
// INSTANCE METHODS
// ===================================

// Generate unique payout number
payoutSchema.methods.generatePayoutNumber = async function(): Promise<string> {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Count payouts for the day
  const startOfDay = new Date(year, date.getMonth(), date.getDate());
  const endOfDay = new Date(year, date.getMonth(), date.getDate() + 1);

  const todayPayoutsCount = await mongoose.model('Payout').countDocuments({
    createdAt: { $gte: startOfDay, $lt: endOfDay },
  });

  const sequenceNumber = String(todayPayoutsCount + 1).padStart(4, '0');
  return `PYT-${year}${month}${day}-${sequenceNumber}`;
};

// Add failure record
payoutSchema.methods.addFailure = async function(
  reason: string,
  errorCode?: string
): Promise<void> {
  this.currentRetryCount += 1;
  this.failures.push({
    reason,
    errorCode,
    date: new Date(),
    retryAttempt: this.currentRetryCount,
  });

  // Calculate next retry date with exponential backoff
  if (this.currentRetryCount < this.maxRetries) {
    const baseDelayHours = 24;
    const delayMultiplier = Math.pow(2, this.currentRetryCount - 1);
    const nextRetry = new Date();
    nextRetry.setHours(nextRetry.getHours() + baseDelayHours * delayMultiplier);
    this.nextRetryDate = nextRetry;
  }

  this.status = 'failed';
  await this.save();
};

// Mark as processing
payoutSchema.methods.markAsProcessing = async function(processedBy?: Types.ObjectId): Promise<void> {
  this.status = 'processing';
  this.processedBy = processedBy;
  await this.save();
};

// Mark as completed
payoutSchema.methods.markAsCompleted = async function(
  stripePayoutId?: string,
  processedBy?: Types.ObjectId
): Promise<void> {
  this.status = 'completed';
  this.processedDate = new Date();
  this.processedBy = processedBy;
  if (stripePayoutId) {
    this.stripePayoutId = stripePayoutId;
  }
  await this.save();
};

// Cancel payout
payoutSchema.methods.cancel = async function(reason: string, cancelledBy?: Types.ObjectId): Promise<void> {
  if (!this.canBeCancelled) {
    throw new Error('Payout cannot be cancelled in current status');
  }
  this.status = 'cancelled';
  this.notes = reason;
  this.processedBy = cancelledBy;
  await this.save();
};

// ===================================
// STATIC METHODS
// ===================================

// Find pending payouts due for processing
payoutSchema.statics.findDuePayouts = function(this: Model<IPayout>, batchSize: number = 100) {
  const now = new Date();
  return this.find({
    status: 'scheduled',
    scheduledDate: { $lte: now },
  })
    .sort({ scheduledDate: 1 })
    .limit(batchSize)
    .populate('providerId', 'email firstName lastName');
};

// Find failed payouts eligible for retry
payoutSchema.statics.findRetriablePayouts = function(this: Model<IPayout>, batchSize: number = 50) {
  const now = new Date();
  return this.find({
    status: 'failed',
    currentRetryCount: { $lt: 3 }, // maxRetries default is 3
    nextRetryDate: { $lte: now },
  })
    .sort({ nextRetryDate: 1 })
    .limit(batchSize)
    .populate('providerId', 'email firstName lastName');
};

// Get provider payout summary
payoutSchema.statics.getProviderPayoutSummary = async function(
  this: Model<IPayout>,
  providerId: string | Types.ObjectId,
  startDate?: Date,
  endDate?: Date
): Promise<Record<string, { count: number; totalAmount: number }>> {
  const matchStage: Record<string, unknown> = { providerId };

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) (matchStage.createdAt as Record<string, Date>).$gte = startDate;
    if (endDate) (matchStage.createdAt as Record<string, Date>).$lte = endDate;
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
      },
    },
  ];

  const results = await this.aggregate(pipeline);

  return results.reduce((acc, item) => {
    acc[item._id] = {
      count: item.count,
      totalAmount: item.totalAmount,
    };
    return acc;
  }, {} as Record<string, { count: number; totalAmount: number }>);
};

// ===================================
// PRE-SAVE MIDDLEWARE
// ===================================

payoutSchema.pre('save', async function(next) {
  if (this.isNew && !this.payoutNumber) {
    try {
      this.payoutNumber = await this.generatePayoutNumber();
    } catch (error) {
      return next(error as Error);
    }
  }
  next();
});

const Payout = mongoose.model('Payout', payoutSchema) as any;

export default Payout;
