import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IBroadcastLog extends Document {
  _id: mongoose.Types.ObjectId;

  // FIX: Add multi-tenant support
  tenantId?: mongoose.Types.ObjectId;

  // Broadcast Classification
  type: 'all' | 'providers' | 'customers';

  // Channels used for this broadcast
  channels: Array<'in_app' | 'email' | 'push' | 'sms'>;

  // Content
  title: string;
  message: string;
  data?: Record<string, unknown>;

  // Delivery Statistics
  sentCount: number;
  failedCount: number;
  totalUsers: number;

  // Scheduling
  scheduledAt?: Date;
  sentAt?: Date;

  // Creator
  createdBy: mongoose.Types.ObjectId;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
}

interface IBroadcastLogModel extends Model<IBroadcastLog> {
  // Static methods for common queries
  findByDateRange(startDate: Date, endDate: Date, limit?: number): Promise<IBroadcastLog[]>;
  findByType(type: 'all' | 'providers' | 'customers', limit?: number): Promise<IBroadcastLog[]>;
  findByCreator(createdBy: mongoose.Types.ObjectId, limit?: number): Promise<IBroadcastLog[]>;
  getStats(startDate: Date, endDate: Date): Promise<{
    totalBroadcasts: number;
    totalSent: number;
    totalFailed: number;
    byType: Record<string, number>;
  }>;
}

const broadcastLogSchema = new Schema<IBroadcastLog>(
  {
    // Multi-tenant support
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    // Broadcast Classification
    type: {
      type: String,
      enum: ['all', 'providers', 'customers'],
      required: [true, 'Broadcast type is required'],
      index: true
    },

    // Channels used
    channels: [{
      type: String,
      enum: ['in_app', 'email', 'push', 'sms'],
      required: true
    }],

    // Content
    title: {
      type: String,
      required: [true, 'Title is required'],
      maxlength: [200, 'Title cannot exceed 200 characters']
    },

    message: {
      type: String,
      required: [true, 'Message is required'],
      maxlength: [2000, 'Message cannot exceed 2000 characters']
    },

    data: {
      type: Schema.Types.Mixed
    },

    // Delivery Statistics
    sentCount: {
      type: Number,
      default: 0,
      min: [0, 'Sent count cannot be negative']
    },

    failedCount: {
      type: Number,
      default: 0,
      min: [0, 'Failed count cannot be negative']
    },

    totalUsers: {
      type: Number,
      default: 0,
      min: [0, 'Total users cannot be negative']
    },

    // Scheduling
    scheduledAt: {
      type: Date,
      index: true
    },

    sentAt: {
      type: Date,
      default: Date.now
    },

    // Creator
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator is required'],
      index: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// ===================================
// INDEXES FOR PERFORMANCE
// ===================================

// Primary query patterns
broadcastLogSchema.index({ createdAt: -1 });
broadcastLogSchema.index({ type: 1, createdAt: -1 });
broadcastLogSchema.index({ createdBy: 1, createdAt: -1 });

// Compound indexes for analytics
broadcastLogSchema.index({ createdAt: -1, type: 1 });
broadcastLogSchema.index({ createdBy: 1, type: 1, createdAt: -1 });

// Tenant isolation indexes
broadcastLogSchema.index({ tenantId: 1, createdAt: -1 });
broadcastLogSchema.index({ tenantId: 1, type: 1 });

// ===================================
// STATIC METHODS
// ===================================

// Find broadcasts by date range
broadcastLogSchema.statics.findByDateRange = function(
  startDate: Date,
  endDate: Date,
  limit: number = 100
) {
  return this.find({
    createdAt: { $gte: startDate, $lte: endDate }
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Find broadcasts by type
broadcastLogSchema.statics.findByType = function(
  type: 'all' | 'providers' | 'customers',
  limit: number = 100
) {
  return this.find({ type })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Find broadcasts by creator
broadcastLogSchema.statics.findByCreator = function(
  createdBy: mongoose.Types.ObjectId,
  limit: number = 100
) {
  return this.find({ createdBy })
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Get statistics for a date range
broadcastLogSchema.statics.getStats = async function(startDate: Date, endDate: Date) {
  const stats = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: null,
        totalBroadcasts: { $sum: 1 },
        totalSent: { $sum: '$sentCount' },
        totalFailed: { $sum: '$failedCount' },
        byType: { $push: '$type' }
      }
    },
    {
      $project: {
        _id: 0,
        totalBroadcasts: 1,
        totalSent: 1,
        totalFailed: 1,
        byType: {
          all: {
            $size: {
              $filter: {
                input: '$byType',
                cond: { $eq: ['$$this', 'all'] }
              }
            }
          },
          providers: {
            $size: {
              $filter: {
                input: '$byType',
                cond: { $eq: ['$$this', 'providers'] }
              }
            }
          },
          customers: {
            $size: {
              $filter: {
                input: '$byType',
                cond: { $eq: ['$$this', 'customers'] }
              }
            }
          }
        }
      }
    }
  ]);

  return stats[0] || {
    totalBroadcasts: 0,
    totalSent: 0,
    totalFailed: 0,
    byType: { all: 0, providers: 0, customers: 0 }
  };
};

// ===================================
// PRE-SAVE MIDDLEWARE
// ===================================

// Set sentAt if not provided
broadcastLogSchema.pre('save', function(next) {
  if (this.isNew && !this.sentAt) {
    this.sentAt = new Date();
  }
  next();
});

const BroadcastLog: IBroadcastLogModel = mongoose.model<IBroadcastLog, IBroadcastLogModel>('BroadcastLog', broadcastLogSchema);

export default BroadcastLog;
