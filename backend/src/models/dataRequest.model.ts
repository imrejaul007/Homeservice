import mongoose, { Schema, Document } from 'mongoose';

export type DataRequestType = 'export' | 'deletion' | 'rectification' | 'portability';
export type DataRequestStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface IDataRequest extends Document {
  userId: mongoose.Types.ObjectId;
  type: DataRequestType;
  status: DataRequestStatus;
  requestedAt: Date;
  processedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;
  ipAddress?: string;
  userAgent?: string;
  email?: string;
  verificationMethod?: 'email' | 'phone' | 'document';
  verificationCompletedAt?: Date;

  // Export specific fields
  exportFormat?: 'json' | 'csv' | 'pdf';
  exportDataTypes?: string[];
  downloadUrl?: string;
  downloadExpiry?: Date;
  downloadCount?: number;

  // Deletion specific fields
  deletionReason?: string;
  deletionConfirmed?: boolean;
  gracePeriodEnd?: Date;
  anonymizedData?: boolean;

  // Processing details
  progress?: number;
  currentStep?: string;
  steps?: Array<{
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    completedAt?: Date;
    error?: string;
  }>;

  // Admin review
  reviewedBy?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  reviewNotes?: string;

  // Error handling
  errorMessage?: string;
  retryCount?: number;
  lastRetryAt?: Date;

  // Metadata
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const dataRequestSchema = new Schema<IDataRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['export', 'deletion', 'rectification', 'portability'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    email: {
      type: String,
    },
    verificationMethod: {
      type: String,
      enum: ['email', 'phone', 'document'],
    },
    verificationCompletedAt: {
      type: Date,
    },

    // Export specific fields
    exportFormat: {
      type: String,
      enum: ['json', 'csv', 'pdf'],
      default: 'json',
    },
    exportDataTypes: {
      type: [String],
      default: ['profile', 'bookings', 'payments', 'reviews', 'preferences'],
    },
    downloadUrl: {
      type: String,
    },
    downloadExpiry: {
      type: Date,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },

    // Deletion specific fields
    deletionReason: {
      type: String,
    },
    deletionConfirmed: {
      type: Boolean,
      default: false,
    },
    gracePeriodEnd: {
      type: Date,
    },
    anonymizedData: {
      type: Boolean,
      default: false,
    },

    // Processing details
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    currentStep: {
      type: String,
    },
    steps: [{
      name: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
      },
      completedAt: {
        type: Date,
      },
      error: {
        type: String,
      },
    }],

    // Admin review
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
    },

    // Error handling
    errorMessage: {
      type: String,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastRetryAt: {
      type: Date,
    },

    // Metadata
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

// Compound indexes
dataRequestSchema.index({ userId: 1, type: 1, status: 1 });
dataRequestSchema.index({ status: 1, requestedAt: -1 });
dataRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
dataRequestSchema.index({ downloadExpiry: 1 }, { expireAfterSeconds: 0 });

const DataRequest = mongoose.model<IDataRequest>('DataRequest', dataRequestSchema);

export default DataRequest;
