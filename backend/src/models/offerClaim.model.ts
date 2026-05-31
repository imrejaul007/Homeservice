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
  },
  {
    timestamps: true,
  }
);

// FIX: Add compound unique index to prevent duplicate claims
offerClaimSchema.index({ userId: 1, couponCode: 1 }, { unique: true });

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
