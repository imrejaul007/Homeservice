import mongoose, { Schema, Document } from 'mongoose';

export interface ICoupon extends Document {
  // Multi-tenant support
  tenantId?: mongoose.Types.ObjectId;

  // Soft delete support
  isDeleted: boolean;
  deletedAt?: Date;

  code: string;
  type: 'percentage' | 'fixed' | 'free_service';
  value: number; // Percentage (0-100) or fixed amount
  maxDiscount?: number; // Cap for percentage discounts
  minOrderValue: number; // Minimum order value to apply
  currency?: string; // For fixed discounts

  // Usage limits
  maxUses: number;
  maxUsesPerUser: number;
  currentUses: number;

  // Validity
  validFrom: Date;
  validUntil: Date;
  isActive: boolean;

  // Targeting
  targetType?: 'all' | 'new_users' | 'specific_users' | 'specific_services' | 'first_booking';
  targetUsers?: mongoose.Types.ObjectId[];
  targetServices?: mongoose.Types.ObjectId[];
  targetCategories?: mongoose.Types.ObjectId[];

  // Description
  title: string;
  description?: string;

  // Homepage Display
  displayTitle?: string;
  displaySubtitle?: string;
  displayGradient?: string;
  displayBadge?: 'Limited Time' | 'New' | 'Popular' | 'Hot';
  imageUrl?: string;
  featured?: boolean;
  claimExpiresInDays?: number;

  // Tracking
  usedBy: Array<{
    userId: mongoose.Types.ObjectId;
    usedAt: Date;
    orderId: string;
  }>;

  // Limits
  applicableServices?: string[]; // Service IDs this coupon can be used for

  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;

  // Instance methods (defined in schema)
  isValid(): { valid: boolean; reason?: string };
  calculateDiscount(orderValue: number): number;
  getDiscountObject(orderValue: number): { code: string; amount: number; type: 'fixed' | 'percentage' };
}

const couponSchema = new Schema<ICoupon>(
  {
    // Multi-tenant support
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

    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['percentage', 'fixed', 'free_service'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscount: {
      type: Number,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'AED',
    },
    maxUses: {
      type: Number,
      default: 1,
      min: 1,
    },
    maxUsesPerUser: {
      type: Number,
      default: 1,
      min: 1,
    },
    currentUses: {
      type: Number,
      default: 0,
      min: 0,
    },
    validFrom: {
      type: Date,
      required: true,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    targetType: {
      type: String,
      enum: ['all', 'new_users', 'specific_users', 'specific_services', 'first_booking'],
      default: 'all',
    },
    targetUsers: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    targetServices: [{
      type: Schema.Types.ObjectId,
      ref: 'Service',
    }],
    targetCategories: [{
      type: Schema.Types.ObjectId,
      ref: 'ServiceCategory',
    }],
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Homepage Display (for Special Offers section)
    displayTitle: {
      type: String,
      trim: true,
    },
    displaySubtitle: {
      type: String,
      trim: true,
    },
    displayGradient: {
      type: String,
      default: 'from-nilin-rose to-nilin-coral',
    },
    displayBadge: {
      type: String,
      enum: ['Limited Time', 'New', 'Popular', 'Hot'],
    },
    imageUrl: {
      type: String,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    claimExpiresInDays: {
      type: Number,
      default: 30,
      min: 1,
    },
    usedBy: [{
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      usedAt: { type: Date, default: Date.now },
      orderId: String,
    }],
    applicableServices: [{
      type: String,
    }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Check if coupon is valid
couponSchema.methods.isValid = function(): { valid: boolean; reason?: string } {
  const now = new Date();

  if (!this.isActive) {
    return { valid: false, reason: 'Coupon is inactive' };
  }

  if (now < this.validFrom) {
    return { valid: false, reason: 'Coupon is not yet valid' };
  }

  if (now > this.validUntil) {
    return { valid: false, reason: 'Coupon has expired' };
  }

  if (this.currentUses >= this.maxUses) {
    return { valid: false, reason: 'Coupon usage limit reached' };
  }

  return { valid: true };
};

// Pre-save hook to sync currentUses from usedBy array length
// NOTE: This is only for manual saves. Atomic operations (findOneAndUpdate with $inc)
// should be used for production booking flows to prevent race conditions.
// See offer.service.ts markCouponAsUsed() for atomic implementation.
couponSchema.pre('save', function(next) {
  // Only sync currentUses if usedBy was directly modified (not via atomic $inc)
  // This prevents the hook from overriding atomic increments
  if (this.isModified('usedBy') && !this.isNew) {
    // Check if usedBy was modified via atomic push or direct assignment
    // Direct assignment will have isModified('usedBy') true but the array length
    // should match the atomic increment result
    this.currentUses = this.usedBy.length;
  } else if (this.isNew) {
    this.currentUses = this.usedBy.length;
  }
  next();
});

// Calculate discount
couponSchema.methods.calculateDiscount = function(orderValue: number): number {
  if (orderValue < this.minOrderValue) {
    return 0;
  }

  let discount = 0;

  switch (this.type) {
    case 'percentage':
      discount = (orderValue * this.value) / 100;
      if (this.maxDiscount && discount > this.maxDiscount) {
        discount = this.maxDiscount;
      }
      break;
    case 'fixed':
      discount = Math.min(this.value, orderValue);
      break;
    case 'free_service':
      discount = orderValue; // Full discount
      break;
  }

  return Math.round(discount * 100) / 100;
};

/**
 * Get discount object with code, amount, and type
 * Matches frontend BookingPricing.discounts interface: Array<{ code, amount, type }>
 */
couponSchema.methods.getDiscountObject = function(orderValue: number): { code: string; amount: number; type: 'fixed' | 'percentage' } {
  const amount = this.calculateDiscount(orderValue);

  // Map backend type to frontend type (frontend only supports 'fixed' | 'percentage')
  // 'free_service' is treated as percentage (full discount) on frontend
  let frontendType: 'fixed' | 'percentage' = this.type as 'fixed' | 'percentage';
  if (this.type === 'free_service') {
    frontendType = 'percentage';
  }

  return {
    code: this.code,
    amount,
    type: frontendType,
  };
};

// Indexes for query optimization
couponSchema.index({ isActive: 1, validUntil: 1 });
couponSchema.index({ isActive: 1, featured: 1 });
couponSchema.index({ targetType: 1, isActive: 1 });
couponSchema.index({ validFrom: 1, validUntil: 1 });
couponSchema.index({ currentUses: 1, maxUses: 1 });
couponSchema.index({ createdAt: -1 });

// Compound index for finding valid coupons
couponSchema.index({
  isActive: 1,
  validFrom: 1,
  validUntil: 1,
  currentUses: 1,
  maxUses: 1
});

// Tenant isolation indexes
couponSchema.index({ tenantId: 1, isActive: 1 });

// Soft delete indexes
couponSchema.index({ isDeleted: 1, createdAt: -1 });
couponSchema.index({ tenantId: 1, isDeleted: 1 });

// FIX: Add compound index for user coupon usage history queries
couponSchema.index({ 'usedBy.userId': 1, usedAt: -1 });

// FIX: Add index for target user coupons (specific users)
couponSchema.index({ targetUsers: 1, isActive: 1 });

// FIX: Add index for target service coupons
couponSchema.index({ targetServices: 1, isActive: 1 });

// FIX: Add index for featured coupons on homepage
couponSchema.index({ featured: 1, isActive: 1, validUntil: 1 });

// Partial index for active non-expired coupons (MongoDB 3.2+)
// Note: code already has index from field definition above

const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);

export default Coupon;
