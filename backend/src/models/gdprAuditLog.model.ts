import mongoose, { Schema, Document } from 'mongoose';

export type GdprAction =
  | 'consent_given'
  | 'consent_withdrawn'
  | 'data_access_requested'
  | 'data_access_completed'
  | 'data_deletion_requested'
  | 'data_deletion_initiated'
  | 'data_deletion_completed'
  | 'data_portability_requested'
  | 'data_portability_completed'
  | 'data_rectification_requested'
  | 'data_rectification_completed'
  | 'privacy_policy_accepted'
  | 'terms_accepted'
  | 'marketing_opt_in'
  | 'marketing_opt_out'
  | 'cookie_preferences_updated'
  | 'data_export_downloaded'
  | 'account_anonymized'
  | 'right_to_be_informed';

export type GdprResource =
  | 'consent'
  | 'data_request'
  | 'user_profile'
  | 'booking'
  | 'payment'
  | 'review'
  | 'notification'
  | 'device'
  | 'session'
  | 'location_data'
  | 'preferences'
  | 'ai_personalization'
  | 'loyalty_data';

export interface IGdprAuditLog extends Document {
  userId?: mongoose.Types.ObjectId;
  action: GdprAction;
  resource: GdprResource;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;

  // GDPR specific fields
  legalBasis?: string;
  purpose?: string;
  dataCategory?: string[];
  retentionPeriod?: string;
  thirdParties?: Array<{
    name: string;
    purpose: string;
    legalBasis: string;
  }>;

  // Compliance tracking
  complianceId?: string;
  regulation?: 'gdpr' | 'ccpa' | 'both';
  jurisdiction?: string;
  proofOfConsent?: string;

  // Request tracking
  requestId?: mongoose.Types.ObjectId;
  requestType?: 'access' | 'deletion' | 'portability' | 'rectification';
  responseDeadline?: Date;
  responseSentAt?: Date;

  createdAt: Date;
}

const gdprAuditLogSchema = new Schema<IGdprAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    resource: {
      type: String,
      required: true,
      index: true,
    },
    resourceId: {
      type: String,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // GDPR specific fields
    legalBasis: {
      type: String,
    },
    purpose: {
      type: String,
    },
    dataCategory: {
      type: [String],
    },
    retentionPeriod: {
      type: String,
    },
    thirdParties: [{
      name: String,
      purpose: String,
      legalBasis: String,
    }],

    // Compliance tracking
    complianceId: {
      type: String,
    },
    regulation: {
      type: String,
      enum: ['gdpr', 'ccpa', 'both'],
      default: 'gdpr',
    },
    jurisdiction: {
      type: String,
    },
    proofOfConsent: {
      type: String,
    },

    // Request tracking
    requestId: {
      type: Schema.Types.ObjectId,
      ref: 'DataRequest',
      index: true,
    },
    requestType: {
      type: String,
      enum: ['access', 'deletion', 'portability', 'rectification'],
    },
    responseDeadline: {
      type: Date,
    },
    responseSentAt: {
      type: Date,
    },
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: false },
    toJSON: {
      virtuals: true,
      transform: function(_doc, ret) {
        delete (ret as any).__v;
        return ret;
      }
    }
  }
);

// Compound indexes for GDPR compliance queries
gdprAuditLogSchema.index({ userId: 1, timestamp: -1 });
gdprAuditLogSchema.index({ action: 1, timestamp: -1 });
gdprAuditLogSchema.index({ resource: 1, action: 1, timestamp: -1 });
gdprAuditLogSchema.index({ requestId: 1, timestamp: -1 });
gdprAuditLogSchema.index({ complianceId: 1 });
gdprAuditLogSchema.index({ responseDeadline: 1, status: 1 });

// TTL index for automatic cleanup after retention period (e.g., 7 years for GDPR)
gdprAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 7 }); // 7 years

const GdprAuditLog = mongoose.model<IGdprAuditLog>('GdprAuditLog', gdprAuditLogSchema);

export default GdprAuditLog;
