import mongoose, { Document, Schema, Model } from 'mongoose';

// ============================================
// Provider Verification Model
// ============================================

export interface IProviderVerification extends Document {
  providerId: mongoose.Types.ObjectId;

  // Overall verification status
  status: 'pending' | 'in_progress' | 'verified' | 'rejected' | 'suspended';

  // KYC Information
  kycScore: number; // 0-100 score based on document verification
  kycLevel: 'basic' | 'standard' | 'enhanced';

  // Document tracking
  documents: Array<{
    _id?: mongoose.Types.ObjectId;
    type: 'id_card' | 'passport' | 'business_license' | 'address_proof' | 'tax_certificate' | 'insurance';
    url: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    uploadedAt: Date;
    verified: boolean;
    verifiedAt?: Date;
    verifiedBy?: mongoose.Types.ObjectId;
    rejectionReason?: string;
    ocrData?: {
      name?: string;
      documentNumber?: string;
      expiryDate?: Date;
      dob?: Date;
      address?: string;
      confidence?: number;
    };
  }>;

  // Background check status
  backgroundCheck: {
    status: 'pending' | 'in_progress' | 'passed' | 'failed';
    provider: string; // Third-party provider name (e.g., 'checkr', 'sterling')
    reportId?: string;
    initiatedAt?: Date;
    completedAt?: Date;
    result?: {
      criminalCheck: boolean;
      sexOffenderCheck: boolean;
      sanctionsCheck: boolean;
      notes?: string;
    };
  };

  // Fraud detection flags
  fraudFlags: Array<{
    _id?: mongoose.Types.ObjectId;
    type: 'duplicate_account' | 'suspicious_document' | 'unusual_pattern' | 'address_mismatch' | 'velocity_check_failed' | 'high_risk_country';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    detectedAt: Date;
    resolved: boolean;
    resolvedAt?: Date;
    resolvedBy?: mongoose.Types.ObjectId;
    resolution?: string;
  }>;

  // Admin review
  reviewHistory: Array<{
    _id?: mongoose.Types.ObjectId;
    action: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'suspended' | 'document_requested' | 'appeal_reviewed';
    performedBy: mongoose.Types.ObjectId;
    performedAt: Date;
    notes?: string;
    previousStatus?: string;
    newStatus?: string;
  }>;

  // Verification metadata
  metadata: {
    ipAddress?: string;
    deviceFingerprint?: string;
    browserInfo?: string;
    verificationAttempts: number;
    lastAttemptAt?: Date;
  };

  // Appeal information
  appeal?: {
    isAppealed: boolean;
    appealedAt?: Date;
    appealReason?: string;
    appealStatus?: 'pending' | 'approved' | 'rejected';
    appealReviewedAt?: Date;
    appealReviewedBy?: mongoose.Types.ObjectId;
    appealNotes?: string;
  };

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date; // For time-limited verifications
}

interface IProviderVerificationModel extends Model<IProviderVerification> {
  findByProviderId(providerId: string | mongoose.Types.ObjectId): Promise<IProviderVerification | null>;
  findPendingVerifications(options?: { limit?: number; skip?: number }): Promise<IProviderVerification[]>;
  findExpiringVerifications(daysThreshold?: number): Promise<IProviderVerification[]>;
}

// Schema definition
const providerVerificationSchema = new Schema<IProviderVerification>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['pending', 'in_progress', 'verified', 'rejected', 'suspended'],
      default: 'pending',
      index: true,
    },

    kycScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    kycLevel: {
      type: String,
      enum: ['basic', 'standard', 'enhanced'],
      default: 'basic',
    },

    documents: [{
      type: {
        type: String,
        enum: ['id_card', 'passport', 'business_license', 'address_proof', 'tax_certificate', 'insurance'],
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
      fileName: String,
      fileSize: Number,
      mimeType: String,
      uploadedAt: {
        type: Date,
        default: Date.now,
      },
      verified: {
        type: Boolean,
        default: false,
      },
      verifiedAt: Date,
      verifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      rejectionReason: String,
      ocrData: {
        name: String,
        documentNumber: String,
        expiryDate: Date,
        dob: Date,
        address: String,
        confidence: Number,
      },
    }],

    backgroundCheck: {
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'passed', 'failed'],
        default: 'pending',
      },
      provider: String,
      reportId: String,
      initiatedAt: Date,
      completedAt: Date,
      result: {
        criminalCheck: Boolean,
        sexOffenderCheck: Boolean,
        sanctionsCheck: Boolean,
        notes: String,
      },
    },

    fraudFlags: [{
      type: {
        type: String,
        enum: ['duplicate_account', 'suspicious_document', 'unusual_pattern', 'address_mismatch', 'velocity_check_failed', 'high_risk_country'],
        required: true,
      },
      severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        required: true,
        default: 'low',
      },
      description: {
        type: String,
        required: true,
      },
      detectedAt: {
        type: Date,
        default: Date.now,
      },
      resolved: {
        type: Boolean,
        default: false,
      },
      resolvedAt: Date,
      resolvedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      resolution: String,
    }],

    reviewHistory: [{
      action: {
        type: String,
        enum: ['submitted', 'under_review', 'approved', 'rejected', 'suspended', 'document_requested', 'appeal_reviewed'],
        required: true,
      },
      performedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      performedAt: {
        type: Date,
        default: Date.now,
      },
      notes: String,
      previousStatus: String,
      newStatus: String,
    }],

    metadata: {
      ipAddress: String,
      deviceFingerprint: String,
      browserInfo: String,
      verificationAttempts: {
        type: Number,
        default: 0,
      },
      lastAttemptAt: Date,
    },

    appeal: {
      isAppealed: {
        type: Boolean,
        default: false,
      },
      appealedAt: Date,
      appealReason: String,
      appealStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
      },
      appealReviewedAt: Date,
      appealReviewedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
      appealNotes: String,
    },

    expiresAt: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for performance
providerVerificationSchema.index({ status: 1, createdAt: -1 });
providerVerificationSchema.index({ 'fraudFlags.resolved': 1, 'fraudFlags.severity': 1 });
providerVerificationSchema.index({ 'backgroundCheck.status': 1 });
providerVerificationSchema.index({ expiresAt: 1 }, { sparse: true });
providerVerificationSchema.index({ 'documents.type': 1, 'documents.verified': 1 });

// Static methods
providerVerificationSchema.statics.findByProviderId = function(providerId: string | mongoose.Types.ObjectId) {
  return this.findOne({ providerId });
};

providerVerificationSchema.statics.findPendingVerifications = function(options?: { limit?: number; skip?: number }) {
  return this.find({ status: { $in: ['pending', 'in_progress'] } })
    .sort({ createdAt: 1 })
    .skip(options?.skip || 0)
    .limit(options?.limit || 50)
    .populate('providerId', 'firstName lastName email phone');
};

providerVerificationSchema.statics.findExpiringVerifications = function(daysThreshold: number = 30) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);
  return this.find({
    status: 'verified',
    expiresAt: { $lte: thresholdDate, $exists: true },
  });
};

// Pre-save middleware for any needed transformations
providerVerificationSchema.pre('save', function(next) {
  // Add any pre-save transformations here if needed
  // Note: Review history is handled in the service layer for proper audit trail
  next();
});

// Virtual for document verification completion
providerVerificationSchema.virtual('isDocumentVerificationComplete').get(function() {
  const requiredTypes = ['id_card', 'passport'];
  const uploadedTypes = this.documents.map(d => d.type);
  return requiredTypes.every(type => uploadedTypes.includes(type as any)) &&
         this.documents.filter(d => d.verified).length >= requiredTypes.length;
});

// Virtual for overall verification progress
providerVerificationSchema.virtual('verificationProgress').get(function() {
  let progress = 0;

  // Document verification (40%)
  const requiredDocs = ['id_card', 'passport'];
  const uploadedDocs = this.documents.filter(d => requiredDocs.includes(d.type)).length;
  const verifiedDocs = this.documents.filter(d => d.verified).length;
  progress += (uploadedDocs / requiredDocs.length) * 40;
  if (verifiedDocs === requiredDocs.length) {
    progress += 40;
  }

  // KYC Score (30%)
  progress += (this.kycScore / 100) * 30;

  // Background check (30%)
  if (this.backgroundCheck.status === 'passed') {
    progress += 30;
  } else if (this.backgroundCheck.status === 'in_progress') {
    progress += 15;
  }

  return Math.min(100, Math.round(progress));
});

const ProviderVerification: Model<IProviderVerification> & IProviderVerificationModel =
  mongoose.model<IProviderVerification, IProviderVerificationModel>('ProviderVerification', providerVerificationSchema);

export default ProviderVerification;
