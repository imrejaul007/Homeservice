import mongoose, { Schema, Document } from 'mongoose';

export interface ICoupon extends Document {
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
}

const couponSchema = new Schema<ICoupon>(
  {
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

const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);

export default Coupon;
