import mongoose, { Schema, Document } from 'mongoose';

export type ConsentType = 'terms' | 'privacy' | 'marketing' | 'cookies' | 'data_processing';

export interface IConsent extends Document {
  userId: mongoose.Types.ObjectId;
  type: ConsentType;
  granted: boolean;
  version: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  purpose?: string;
  method?: 'web' | 'mobile' | 'api' | 'written';
  legalBasis?: 'consent' | 'contract' | 'legal_obligation' | 'legitimate_interest' | 'vital_interest' | 'public_task';
  withdrawalDate?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const consentSchema = new Schema<IConsent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['terms', 'privacy', 'marketing', 'cookies', 'data_processing'],
      required: true,
      index: true,
    },
    granted: {
      type: Boolean,
      required: true,
      default: false,
    },
    version: {
      type: String,
      required: true,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    purpose: {
      type: String,
    },
    method: {
      type: String,
      enum: ['web', 'mobile', 'api', 'written'],
      default: 'web',
    },
    legalBasis: {
      type: String,
      enum: ['consent', 'contract', 'legal_obligation', 'legitimate_interest', 'vital_interest', 'public_task'],
      default: 'consent',
    },
    withdrawalDate: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function(_doc, ret) {
        delete (ret as any).__v;
        return ret;
      }
    }
  }
);

// Compound indexes for efficient queries
consentSchema.index({ userId: 1, type: 1 }, { unique: true });
consentSchema.index({ userId: 1, granted: 1 });
consentSchema.index({ type: 1, version: 1 });
consentSchema.index({ timestamp: -1 });
consentSchema.index({ withdrawalDate: 1 });

const Consent = mongoose.model<IConsent>('Consent', consentSchema);

export default Consent;
