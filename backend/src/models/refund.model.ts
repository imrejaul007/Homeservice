import mongoose, { Document, Schema, Model, Types } from 'mongoose';

/**
 * Refund Model
 *
 * Tracks refund requests and their statuses for analytics.
 * This is a simplified model for admin widget analytics.
 */

export interface IRefund extends Document {
  _id: Types.ObjectId;

  // Multi-tenant support
  tenantId?: Types.ObjectId;

  // Reference information
  refundNumber: string;
  bookingId: Types.ObjectId;
  bookingNumber: string;

  // Customer and provider
  customerId: Types.ObjectId;
  providerId: Types.ObjectId;

  // Amount details
  originalAmount: number;
  amount: number; // Alias for refundAmount, used in aggregations
  refundAmount: number;
  currency: string;

  // Status and reason
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'failed';
  reason: 'customer_request' | 'service_issue' | 'quality_issue' | 'cancellation' | 'duplicate' | 'other';
  description?: string;

  // Processing details
  processedBy?: Types.ObjectId;
  processedAt?: Date;
  failureReason?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const refundSchema = new Schema<IRefund>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    refundNumber: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true
    },
    bookingNumber: {
      type: String,
      required: true
    },

    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    originalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    refundAmount: {
      type: Number,
      required: true,
      min: 0
    },
    // Virtual field: amount (alias for refundAmount, used in aggregations)
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },

    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'processed', 'failed'],
      default: 'pending',
      index: true
    },
    reason: {
      type: String,
      enum: ['customer_request', 'service_issue', 'quality_issue', 'cancellation', 'duplicate', 'other'],
      required: true
    },
    description: {
      type: String
    },

    processedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    processedAt: {
      type: Date
    },
    failureReason: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Indexes for common queries
refundSchema.index({ createdAt: -1 });
refundSchema.index({ status: 1, createdAt: -1 });
refundSchema.index({ customerId: 1, createdAt: -1 });
refundSchema.index({ providerId: 1, createdAt: -1 });
refundSchema.index({ tenantId: 1, createdAt: -1 });

// Compound index for unique refund numbers per day
refundSchema.index({ createdAt: 1, refundNumber: 1 });

const Refund: Model<IRefund> = mongoose.model<IRefund>('Refund', refundSchema);

export default Refund;
