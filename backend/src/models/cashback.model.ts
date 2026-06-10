import mongoose, { Schema, Document } from 'mongoose';

// Cashback source types
export type CashbackSource = 'booking' | 'referral' | 'promotion' | 'refund' | 'loyalty';

// Cashback status
export type CashbackStatus = 'earned' | 'pending' | 'available' | 'redeemed' | 'expired';

export interface ICashback extends Document {
  // Multi-tenant
  tenantId?: mongoose.Types.ObjectId;

  // Soft delete support
  isDeleted: boolean;
  deletedAt?: Date;

  userId: mongoose.Types.ObjectId;
  amount: number;
  currency: string;
  source: CashbackSource;
  status: CashbackStatus;

  // Source details
  sourceId?: string; // Booking ID, referral ID, promotion ID, etc.
  sourceDescription: string;

  // Earnings details
  originalAmount: number; // Original transaction amount
  percentage: number; // Cashback percentage applied

  // Expiration tracking (90 days default)
  earnedAt: Date;
  expiresAt: Date;
  expiredAt?: Date;

  // Redemption tracking
  redeemedAt?: Date;
  redeemedTo?: 'wallet' | 'booking' | 'voucher';
  redemptionReference?: string;

  // Metadata
  metadata?: Record<string, unknown>;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
}

const cashbackSchema = new Schema<ICashback>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    // Soft delete support
    isDeleted: {
      type: Boolean,
      default: false,
      select: false
    },
    deletedAt: Date,

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'AED',
    },
    source: {
      type: String,
      enum: ['booking', 'referral', 'promotion', 'refund', 'loyalty'],
      required: true,
    },
    status: {
      type: String,
      enum: ['earned', 'pending', 'available', 'redeemed', 'expired'],
      default: 'earned',
      index: true,
    },
    sourceId: {
      type: String,
      index: true,
    },
    sourceDescription: {
      type: String,
      required: true,
    },
    originalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    earnedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    expiredAt: Date,
    redeemedAt: Date,
    redeemedTo: {
      type: String,
      enum: ['wallet', 'booking', 'voucher'],
    },
    redemptionReference: String,
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
cashbackSchema.index({ userId: 1, status: 1 });
cashbackSchema.index({ userId: 1, source: 1 });
cashbackSchema.index({ userId: 1, expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-expiry
cashbackSchema.index({ tenantId: 1, userId: 1, status: 1 });
cashbackSchema.index({ userId: 1, earnedAt: -1 });
cashbackSchema.index(
  { userId: 1, source: 1, sourceId: 1 },
  { unique: true, sparse: true, partialFilterExpression: { sourceId: { $exists: true, $ne: null } } }
);

// Soft delete indexes
cashbackSchema.index({ isDeleted: 1, createdAt: -1 });
cashbackSchema.index({ tenantId: 1, isDeleted: 1 });

const Cashback = mongoose.model<ICashback>('Cashback', cashbackSchema);

export default Cashback;
