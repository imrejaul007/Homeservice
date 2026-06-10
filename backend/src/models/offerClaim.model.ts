import mongoose, { Schema, Document } from 'mongoose';

// FIX: Add multi-tenant support to offer claims
export interface IOfferClaim extends Document {
  // Multi-tenant
  tenantId?: mongoose.Types.ObjectId;

  userId: mongoose.Types.ObjectId;
  offerId: mongoose.Types.ObjectId;
  couponCode: string;
  claimedAt: Date;
  usedAt?: Date;
  usedInBookingId?: mongoose.Types.ObjectId;
  status: 'claimed' | 'applied' | 'expired';
  expiresAt: Date;
  // FIX: Add discountAmount for analytics tracking
  discountAmount?: number;

  // FIX: Add device fingerprinting for fraud detection
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;

  // FIX: Attribution tracking for marketing analytics
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;

  // FIX: Add lastReminderSentAt for notification tracking
  lastReminderSentAt?: Date;

  // FIX: Add soft delete support (data retention compliance)
  isDeleted: boolean;
  deletedAt?: Date;

  // FIX P0-3: Idempotency key for network retry protection
  idempotencyKey?: string;

  createdAt: Date;
  updatedAt: Date;
}

const offerClaimSchema = new Schema<IOfferClaim>(
  {
    // Multi-tenant
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    offerId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    couponCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    claimedAt: {
      type: Date,
      default: Date.now,
    },
    usedAt: {
      type: Date,
    },
    usedInBookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
    },
    status: {
      type: String,
      enum: ['claimed', 'applied', 'expired'],
      default: 'claimed',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },

    // FIX: Device fingerprinting fields for fraud detection
    deviceFingerprint: {
      type: String,
      index: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },

    // FIX: Attribution tracking fields for marketing analytics
    utmSource: {
      type: String,
    },
    utmMedium: {
      type: String,
    },
    utmCampaign: {
      type: String,
    },
    utmTerm: {
      type: String,
    },
    utmContent: {
      type: String,
    },
    referrer: {
      type: String,
    },

    // FIX: Add lastReminderSentAt field for notification tracking
    lastReminderSentAt: {
      type: Date,
    },

    // FIX: Add soft delete fields for data retention compliance
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },

    // FIX P0-3: Idempotency key for network retry protection
    idempotencyKey: {
      type: String,
      sparse: true, // Sparse index allows null values
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// FIX: Add default query to exclude soft-deleted records using middleware
offerClaimSchema.pre(['find', 'findOne', 'countDocuments'], function() {
  if (!this.getQuery().isDeleted) {
    this.where({ isDeleted: { $ne: true } });
  }
});

// One active claim per user+offer; multiple applied/expired rows allowed for multi-use offers
offerClaimSchema.index(
  { userId: 1, offerId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'claimed' },
  }
);

// Non-unique lookup by coupon code
offerClaimSchema.index({ userId: 1, couponCode: 1 });

// Compound index for user's claims on specific offer
offerClaimSchema.index({ userId: 1, offerId: 1 });

// Index for finding user's active claims
offerClaimSchema.index({ userId: 1, status: 1, expiresAt: 1 });

// FIX: Add TTL index for expired claims cleanup
// Claims will be automatically deleted after expiration
offerClaimSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 } // 30 days after expiration
);

// Tenant isolation indexes
offerClaimSchema.index({ tenantId: 1, userId: 1 });
offerClaimSchema.index({ tenantId: 1, status: 1 });
// FIX: Add compound index for common query pattern (tenant + user + status + expiresAt)
offerClaimSchema.index({ tenantId: 1, userId: 1, status: 1, expiresAt: 1 });

// FIX: Add device fingerprint indexes for fraud detection
offerClaimSchema.index({ deviceFingerprint: 1, offerId: 1 });
offerClaimSchema.index({ deviceFingerprint: 1, claimedAt: -1 });
offerClaimSchema.index({ ipAddress: 1, offerId: 1 });
offerClaimSchema.index({ ipAddress: 1, claimedAt: -1 });

// Check if claim is expired
offerClaimSchema.methods.isExpired = function(): boolean {
  return new Date() > this.expiresAt && this.status === 'claimed';
};

// Check if claim can be used
offerClaimSchema.methods.canBeUsed = function(): { canUse: boolean; reason?: string } {
  if (this.status === 'applied') {
    return { canUse: false, reason: 'Already used' };
  }
  if (this.status === 'expired' || new Date() > this.expiresAt) {
    return { canUse: false, reason: 'Offer expired' };
  }
  return { canUse: true };
};

export const OfferClaim = mongoose.model<IOfferClaim>('OfferClaim', offerClaimSchema);
export default OfferClaim;
