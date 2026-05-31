/**
 * Bundle Booking Model
 *
 * Tracks customer bookings of service bundles
 */

import mongoose, { Document, Schema } from 'mongoose';

// =============================================================================
// Interface
// =============================================================================

export interface IBundleBookingService {
  bookingId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  serviceName: string;
  quantity: number;
  originalPrice: number;
  scheduledDate: string;
  scheduledTime?: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  usedAt?: Date | null;
}

export interface IBundlePayment {
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'pending' | 'paid' | 'partial' | 'refunded';
  paymentMethod?: 'card' | 'wallet' | 'split';
  paidAt?: Date;
}

export interface IBundleBooking extends Document {
  // Tenant
  tenantId?: mongoose.Types.ObjectId;

  // Bundle Reference
  bundleId: mongoose.Types.ObjectId;
  bundleName: string;

  // Customer
  customerId: mongoose.Types.ObjectId;

  // Booking Details
  bookingNumber: string;
  addressId?: mongoose.Types.ObjectId;

  // Services
  services: IBundleBookingService[];

  // Payment
  payment: IBundlePayment;

  // Notes
  notes?: string;

  // Status
  status: 'confirmed' | 'partially_redeemed' | 'fully_redeemed' | 'completed' | 'cancelled';
  cancellationReason?: string;
  cancelledAt?: Date;

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

const bundleBookingServiceSchema = new Schema<IBundleBookingService>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
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
    scheduledDate: {
      type: String,
      required: true,
    },
    scheduledTime: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'],
      default: 'confirmed',
    },
    usedAt: {
      type: Date,
    },
  },
  { _id: false }
);

const bundlePaymentSchema = new Schema<IBundlePayment>(
  {
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    remainingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'partial', 'refunded'],
      default: 'pending',
    },
    paymentMethod: {
      type: String,
      enum: ['card', 'wallet', 'split'],
    },
    paidAt: {
      type: Date,
    },
  },
  { _id: false }
);

const bundleBookingSchema = new Schema<IBundleBooking>(
  {
    // Tenant support
    tenantId: {
      type: Schema.Types.ObjectId,
      index: true,
    },

    // Bundle Reference
    bundleId: {
      type: Schema.Types.ObjectId,
      ref: 'Bundle',
      required: true,
      index: true,
    },
    bundleName: {
      type: String,
      required: true,
    },

    // Customer
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Booking Details
    bookingNumber: {
      type: String,
      required: true,
      unique: true,
    },
    addressId: {
      type: Schema.Types.ObjectId,
      ref: 'Address',
    },

    // Services
    services: {
      type: [bundleBookingServiceSchema],
      default: [],
    },

    // Payment
    payment: {
      type: bundlePaymentSchema,
      required: true,
    },

    // Notes
    notes: {
      type: String,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },

    // Status
    status: {
      type: String,
      enum: ['confirmed', 'partially_redeemed', 'fully_redeemed', 'completed', 'cancelled'],
      default: 'confirmed',
      index: true,
    },
    cancellationReason: {
      type: String,
    },
    cancelledAt: {
      type: Date,
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

bundleBookingSchema.index({ tenantId: 1, customerId: 1, bundleId: 1 });
bundleBookingSchema.index({ tenantId: 1, customerId: 1, status: 1 });
bundleBookingSchema.index({ tenantId: 1, bundleId: 1, createdAt: -1 });
bundleBookingSchema.index({ bookingNumber: 1 }, { unique: true });

// =============================================================================
// Pre-save Hooks
// =============================================================================

bundleBookingSchema.pre('save', function (next) {
  // Update status based on services
  if (this.isModified('services')) {
    const completedCount = this.services.filter(
      (s) => s.status === 'completed'
    ).length;
    const totalCount = this.services.length;
    const cancelledCount = this.services.filter(
      (s) => s.status === 'cancelled'
    ).length;

    if (cancelledCount === totalCount) {
      this.status = 'cancelled';
    } else if (completedCount === totalCount) {
      this.status = 'completed';
    } else if (completedCount > 0 || cancelledCount > 0) {
      this.status = 'partially_redeemed';
    }
  }

  // Update payment remaining amount
  this.payment.remainingAmount = this.payment.totalAmount - this.payment.paidAmount;

  next();
});

// =============================================================================
// Instance Methods
// =============================================================================

bundleBookingSchema.methods.getCompletedServices = function (): IBundleBookingService[] {
  return this.services.filter((s: IBundleBookingService) => s.status === 'completed');
};

bundleBookingSchema.methods.getPendingServices = function (): IBundleBookingService[] {
  return this.services.filter(
    (s: IBundleBookingService) => ['pending', 'confirmed'].includes(s.status)
  );
};

bundleBookingSchema.methods.getRemainingValue = function (): number {
  return this.getPendingServices().reduce((total: number, service: IBundleBookingService) => {
    return total + service.originalPrice * service.quantity;
  }, 0);
};

bundleBookingSchema.methods.canCancel = function (): boolean {
  return !['completed', 'cancelled'].includes(this.status) &&
    this.getPendingServices().length === this.services.length;
};

// =============================================================================
// Static Methods
// =============================================================================

bundleBookingSchema.statics.findByCustomer = function (
  customerId: mongoose.Types.ObjectId,
  status?: IBundleBooking['status']
) {
  const query: Record<string, unknown> = { customerId };
  if (status) {
    query.status = status;
  }
  return this.find(query)
    .populate('bundleId')
    .populate('services.bookingId')
    .sort({ createdAt: -1 });
};

bundleBookingSchema.statics.findActiveByCustomer = function (
  customerId: mongoose.Types.ObjectId
) {
  return this.find({
    customerId,
    status: { $in: ['confirmed', 'partially_redeemed'] },
  })
    .populate('bundleId')
    .populate('services.bookingId')
    .sort({ createdAt: -1 });
};

bundleBookingSchema.statics.findByBookingNumber = function (
  bookingNumber: string
) {
  return this.findOne({ bookingNumber })
    .populate('bundleId')
    .populate('services.bookingId')
    .populate('customerId');
};

// =============================================================================
// Virtuals
// =============================================================================

bundleBookingSchema.virtual('completedServicesCount').get(function () {
  return this.services.filter((s) => s.status === 'completed').length;
});

bundleBookingSchema.virtual('pendingServicesCount').get(function () {
  return this.services.filter((s) =>
    ['pending', 'confirmed'].includes(s.status)
  ).length;
});

bundleBookingSchema.virtual('totalServicesCount').get(function () {
  return this.services.length;
});

bundleBookingSchema.virtual('completionPercentage').get(function (this: IBundleBooking) {
  if (this.services.length === 0) return 0;
  return Math.round(
    (this.services.filter((s) => s.status === 'completed').length / this.services.length) * 100
  );
});

bundleBookingSchema.virtual('canCancel').get(function () {
  return this.status === 'confirmed' && this.services.every((s: IBundleBookingService) =>
    ['pending', 'confirmed'].includes(s.status)
  );
});

// =============================================================================
// Export
// =============================================================================

const BundleBooking = mongoose.model<IBundleBooking>('BundleBooking', bundleBookingSchema);

export default BundleBooking;
