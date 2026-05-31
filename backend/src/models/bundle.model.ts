/**
 * Bundle Model
 *
 * Service bundles that combine multiple services at a discounted price
 */

import mongoose, { Document, Schema } from 'mongoose';

// =============================================================================
// Interface
// =============================================================================

export interface IBundleService {
  serviceId: mongoose.Types.ObjectId;
  serviceName: string;
  quantity: number;
  originalPrice: number;
  description?: string;
}

export interface IBundle extends Document {
  // Tenant
  tenantId?: mongoose.Types.ObjectId;

  // Bundle Info
  name: string;
  description: string;
  services: IBundleService[];
  categoryId?: mongoose.Types.ObjectId;

  // Pricing
  originalPrice: number;
  bundlePrice: number;
  savingsAmount: number;
  savingsPercentage: number;

  // Validity
  validFrom: Date;
  validUntil: Date;

  // Limits
  maxRedemptions?: number;
  redemptionsUsed: number;
  maxPurchasesPerCustomer?: number;

  // Status
  isActive: boolean;
  isFeatured: boolean;

  // Media
  image?: string;
  images?: string[];

  // Metadata
  tags?: string[];
  terms?: string;

  // Stats
  rating?: {
    average: number;
    count: number;
  };
  providerCount?: number;

  // Audit
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Schema
// =============================================================================

const bundleServiceSchema = new Schema<IBundleService>(
  {
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    serviceName: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
    },
  },
  { _id: false }
);

const bundleSchema = new Schema<IBundle>(
  {
    // Tenant support
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    // Bundle Info
    name: {
      type: String,
      required: [true, 'Bundle name is required'],
      trim: true,
      maxlength: [200, 'Bundle name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Bundle description is required'],
      trim: true,
      maxlength: [2000, 'Bundle description cannot exceed 2000 characters'],
    },
    services: {
      type: [bundleServiceSchema],
      required: true,
      validate: {
        validator: function (services: IBundleService[]) {
          return services && services.length > 0;
        },
        message: 'At least one service is required in a bundle',
      },
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
    },

    // Pricing
    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    bundlePrice: {
      type: Number,
      required: true,
      min: 0,
    },
    savingsAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    savingsPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },

    // Validity
    validFrom: {
      type: Date,
      required: [true, 'Valid from date is required'],
    },
    validUntil: {
      type: Date,
      required: [true, 'Valid until date is required'],
    },

    // Limits
    maxRedemptions: {
      type: Number,
      min: 1,
    },
    redemptionsUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxPurchasesPerCustomer: {
      type: Number,
      min: 1,
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },

    // Media
    image: {
      type: String,
    },
    images: {
      type: [String],
    },

    // Metadata
    tags: {
      type: [String],
      default: [],
    },
    terms: {
      type: String,
      maxlength: [1000, 'Terms cannot exceed 1000 characters'],
    },

    // Stats
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },
      count: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    providerCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Audit
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// =============================================================================
// Indexes
// =============================================================================

bundleSchema.index({ tenantId: 1, isActive: 1 });
bundleSchema.index({ tenantId: 1, categoryId: 1, isActive: 1 });
bundleSchema.index({ tenantId: 1, validFrom: 1, validUntil: 1 });
bundleSchema.index({ tenantId: 1, isFeatured: 1, isActive: 1 });
bundleSchema.index({ 'services.serviceId': 1 });

// Geospatial index for location-based queries (if needed)
// bundleSchema.index({ 'location.coordinates': '2dsphere' });

// =============================================================================
// Pre-save Hooks
// =============================================================================

bundleSchema.pre('save', function (next) {
  // Calculate original price and savings
  this.originalPrice = this.services.reduce(
    (total, service) => total + service.originalPrice * service.quantity,
    0
  );
  this.savingsAmount = this.originalPrice - this.bundlePrice;
  this.savingsPercentage =
    this.originalPrice > 0
      ? Math.round((this.savingsAmount / this.originalPrice) * 100)
      : 0;

  // Validate dates
  if (this.validFrom >= this.validUntil) {
    next(new Error('Valid from date must be before valid until date'));
    return;
  }

  // Validate bundle price
  if (this.bundlePrice > this.originalPrice) {
    next(new Error('Bundle price cannot exceed original price'));
    return;
  }

  next();
});

// =============================================================================
// Instance Methods
// =============================================================================

bundleSchema.methods.isValid = function (): boolean {
  const now = new Date();
  return (
    this.isActive &&
    this.redemptionsUsed < (this.maxRedemptions || Infinity) &&
    this.validFrom <= now &&
    this.validUntil >= now
  );
};

bundleSchema.methods.getRemainingRedemptions = function (): number {
  if (!this.maxRedemptions) return Infinity;
  return Math.max(0, this.maxRedemptions - this.redemptionsUsed);
};

bundleSchema.methods.calculateSavingsForCustomer = function (
  quantity: number = 1
): number {
  return this.savingsAmount * quantity;
};

// =============================================================================
// Static Methods
// =============================================================================

bundleSchema.statics.findActiveBundles = function (
  categoryId?: mongoose.Types.ObjectId
) {
  const now = new Date();
  const query: Record<string, unknown> = {
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
  };

  if (categoryId) {
    query.categoryId = categoryId;
  }

  return this.find(query).sort({ isFeatured: -1, savingsPercentage: -1 });
};

bundleSchema.statics.findFeaturedBundles = function (limit: number = 10) {
  const now = new Date();
  return this.find({
    isActive: true,
    isFeatured: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $expr: {
      $or: [
        { $eq: [{ $ifNull: ['$maxRedemptions', Infinity] }, Infinity] },
        { $lt: ['$redemptionsUsed', '$maxRedemptions'] },
      ],
    },
  })
    .sort({ savingsPercentage: -1 })
    .limit(limit);
};

bundleSchema.statics.incrementRedemptions = async function (
  bundleId: mongoose.Types.ObjectId,
  amount: number = 1
): Promise<IBundle | null> {
  return this.findByIdAndUpdate(
    bundleId,
    { $inc: { redemptionsUsed: amount } },
    { new: true }
  );
};

// =============================================================================
// Virtuals
// =============================================================================

bundleSchema.virtual('serviceCount').get(function () {
  return this.services.length;
});

bundleSchema.virtual('isExpired').get(function () {
  return new Date() > this.validUntil;
});

bundleSchema.virtual('isNotYetValid').get(function () {
  return new Date() < this.validFrom;
});

bundleSchema.virtual('isSoldOut').get(function () {
  return (
    this.maxRedemptions !== undefined &&
    this.redemptionsUsed >= this.maxRedemptions
  );
});

// =============================================================================
// Export
// =============================================================================

const Bundle = mongoose.model<IBundle>('Bundle', bundleSchema);

export default Bundle;
