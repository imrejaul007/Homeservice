import mongoose, { Schema, Document } from 'mongoose';

// Voucher type
export type VoucherType = 'percentage' | 'fixed' | 'free_service';
export type VoucherStatus = 'active' | 'used' | 'expired' | 'cancelled';
export type VoucherRecipient = 'all' | 'specific' | 'tier';

export interface IVoucher extends Document {
  // Multi-tenant
  tenantId?: mongoose.Types.ObjectId;

  // Soft delete support
  isDeleted: boolean;
  deletedAt?: Date;

  code: string;
  name: string;
  description?: string;
  type: VoucherType;

  // Discount details
  discountValue: number; // Percentage or fixed amount
  currency?: string;
  maxDiscount?: number; // Cap for percentage discounts

  // Validity
  validFrom: Date;
  validUntil: Date;

  // Usage limits
  totalUses: number;
  maxUses: number;
  perUserLimit: number; // Max uses per user

  // Targeting
  recipientType: VoucherRecipient;
  recipientUsers?: mongoose.Types.ObjectId[]; // For specific recipients
  recipientTiers?: string[]; // For tier-based recipients

  // Service restrictions
  applicableServices?: mongoose.Types.ObjectId[];
  applicableCategories?: mongoose.Types.ObjectId[];
  minimumOrderValue?: number;

  // Status
  status: VoucherStatus;

  // Metadata
  metadata?: Record<string, unknown>;

  // Audit
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// User voucher usage tracking
export interface IVoucherUsage extends Document {
  // Multi-tenant
  tenantId?: mongoose.Types.ObjectId;

  // Soft delete support
  isDeleted: boolean;
  deletedAt?: Date;

  voucherId: mongoose.Types.ObjectId;
  voucherCode: string;
  userId: mongoose.Types.ObjectId;

  usedAt: Date;
  bookingId?: mongoose.Types.ObjectId;
  discountApplied: number;

  createdAt: Date;
}

const voucherSchema = new Schema<IVoucher>(
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

    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: String,
    type: {
      type: String,
      enum: ['percentage', 'fixed', 'free_service'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'AED',
    },
    maxDiscount: {
      type: Number,
      min: 0,
    },
    validFrom: {
      type: Date,
      required: true,
      index: true,
    },
    validUntil: {
      type: Date,
      required: true,
      index: true,
    },
    totalUses: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxUses: {
      type: Number,
      required: true,
      min: 1,
    },
    perUserLimit: {
      type: Number,
      default: 1,
      min: 1,
    },
    recipientType: {
      type: String,
      enum: ['all', 'specific', 'tier'],
      default: 'all',
    },
    recipientUsers: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    recipientTiers: [String],
    applicableServices: [{
      type: Schema.Types.ObjectId,
      ref: 'Service',
    }],
    applicableCategories: [{
      type: Schema.Types.ObjectId,
      ref: 'ServiceCategory',
    }],
    minimumOrderValue: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: ['active', 'used', 'expired', 'cancelled'],
      default: 'active',
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
voucherSchema.index({ tenantId: 1, code: 1 });
voucherSchema.index({ tenantId: 1, status: 1, validUntil: 1 });
voucherSchema.index({ tenantId: 1, recipientType: 1, recipientTiers: 1 });
voucherSchema.index({ validFrom: 1, validUntil: 1, status: 1 });

// Soft delete indexes
voucherSchema.index({ isDeleted: 1, createdAt: -1 });
voucherSchema.index({ tenantId: 1, isDeleted: 1 });

// TTL index for automatic expiry
voucherSchema.index({ validUntil: 1 }, { expireAfterSeconds: 0 });

const voucherUsageSchema = new Schema<IVoucherUsage>(
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

    voucherId: {
      type: Schema.Types.ObjectId,
      ref: 'Voucher',
      required: true,
      index: true,
    },
    voucherCode: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    usedAt: {
      type: Date,
      default: Date.now,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
    },
    discountApplied: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes for usage tracking
// FIX: Add unique compound index to prevent duplicate voucher usage
voucherUsageSchema.index({ voucherId: 1, userId: 1 }, { unique: true });
voucherUsageSchema.index({ userId: 1, voucherCode: 1 });

// Soft delete indexes
voucherUsageSchema.index({ isDeleted: 1, createdAt: -1 });

const Voucher = mongoose.model<IVoucher>('Voucher', voucherSchema);
const VoucherUsage = mongoose.model<IVoucherUsage>('VoucherUsage', voucherUsageSchema);

export { Voucher, VoucherUsage };
export default Voucher;
