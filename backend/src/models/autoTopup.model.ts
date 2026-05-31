import mongoose, { Schema, Document } from 'mongoose';

// Auto-topup status
export type AutoTopupStatus = 'active' | 'paused' | 'disabled' | 'failed';

export interface IAutoTopup extends Document {
  // Multi-tenant
  tenantId?: mongoose.Types.ObjectId;

  userId: mongoose.Types.ObjectId;

  // Configuration
  enabled: boolean;
  status: AutoTopupStatus;

  // Threshold and amount settings
  thresholdAmount: number; // Trigger topup when balance falls below this
  topupAmount: number; // Amount to add when triggered

  // Payment method
  paymentMethodId: string;
  paymentMethodType: 'card' | 'bank_account' | 'wallet';
  paymentMethodLast4?: string;
  paymentMethodBrand?: string;

  // Limits
  maxAutoTopupsPerMonth: number;
  maxAutoTopupAmount: number;

  // Tracking
  autoTopupsThisMonth: number;
  lastAutoTopupAt?: Date;
  lastAutoTopupAmount?: number;
  lastAutoTopupStatus?: 'success' | 'failed';

  // Failure tracking
  consecutiveFailures: number;
  lastFailureReason?: string;

  // Next scheduled check
  nextCheckAt: Date;

  // Metadata
  metadata?: Record<string, unknown>;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
}

// Auto-topup transaction log
export interface IAutoTopupLog extends Document {
  // Multi-tenant
  tenantId?: mongoose.Types.ObjectId;

  autoTopupId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;

  triggerBalance: number;
  topupAmount: number;
  status: 'success' | 'failed' | 'skipped';

  // Transaction details
  transactionId?: string;
  paymentReference?: string;

  // Failure details
  failureReason?: string;

  // Timestamps
  triggeredAt: Date;
  completedAt?: Date;

  createdAt: Date;
}

const autoTopupSchema = new Schema<IAutoTopup>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'disabled', 'failed'],
      default: 'disabled',
      index: true,
    },
    thresholdAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    topupAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    paymentMethodId: {
      type: String,
      required: true,
    },
    paymentMethodType: {
      type: String,
      enum: ['card', 'bank_account', 'wallet'],
      default: 'card',
    },
    paymentMethodLast4: String,
    paymentMethodBrand: String,
    maxAutoTopupsPerMonth: {
      type: Number,
      default: 5,
      min: 1,
      max: 30,
    },
    maxAutoTopupAmount: {
      type: Number,
      default: 500,
      min: 10,
      max: 5000,
    },
    autoTopupsThisMonth: {
      type: Number,
      default: 0,
    },
    lastAutoTopupAt: Date,
    lastAutoTopupAmount: Number,
    lastAutoTopupStatus: {
      type: String,
      enum: ['success', 'failed'],
    },
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
    lastFailureReason: String,
    nextCheckAt: {
      type: Date,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
autoTopupSchema.index({ tenantId: 1, status: 1, enabled: 1 });
autoTopupSchema.index({ nextCheckAt: 1, status: 1, enabled: 1 });

const autoTopupLogSchema = new Schema<IAutoTopupLog>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    autoTopupId: {
      type: Schema.Types.ObjectId,
      ref: 'AutoTopup',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    triggerBalance: {
      type: Number,
      required: true,
    },
    topupAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'skipped'],
      required: true,
    },
    transactionId: String,
    paymentReference: String,
    failureReason: String,
    triggeredAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Indexes for logs
autoTopupLogSchema.index({ userId: 1, triggeredAt: -1 });
autoTopupLogSchema.index({ autoTopupId: 1, triggeredAt: -1 });
autoTopupLogSchema.index({ status: 1, triggeredAt: -1 });

const AutoTopup = mongoose.model<IAutoTopup>('AutoTopup', autoTopupSchema);
const AutoTopupLog = mongoose.model<IAutoTopupLog>('AutoTopupLog', autoTopupLogSchema);

export { AutoTopup, AutoTopupLog };
export default AutoTopup;
