import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * Automation Log Model
 *
 * Tracks execution history for all marketing and service automations.
 * Replaces mock data with real execution logs.
 */

export interface IAutomationLog extends Document {
  // Multi-tenant support
  tenantId?: mongoose.Types.ObjectId;

  // Job identification
  jobId: string;           // Unique job identifier
  jobName: string;          // Human-readable job name
  automationType: string;    // Type: welcome, review, winback, referral, etc.

  // Execution details
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  startTime: Date;
  endTime?: Date;
  duration?: number;        // Duration in milliseconds

  // Processing stats
  recordsProcessed: number;
  recordsSucceeded: number;
  recordsFailed: number;

  // Error tracking
  errorMessage?: string;
  errorStack?: string;
  failedRecords?: Array<{
    recordId: string;
    error: string;
    timestamp: Date;
  }>;

  // Context
  triggeredBy: 'scheduled' | 'manual' | 'webhook' | 'api';
  triggeredByUserId?: mongoose.Types.ObjectId;
  metadata?: Record<string, unknown>;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Methods
  markCompleted(succeeded: number, failed: number): this;
  markFailed(error: Error | string): this;
}

// Static methods interface
export interface IAutomationLogModel extends Model<IAutomationLog> {
  getRecentLogs(jobId: string, limit?: number): Promise<IAutomationLog[]>;
  getExecutionStats(jobId?: string, startDate?: Date, endDate?: Date): Promise<any>;
  getJobHealth(jobId: string): Promise<{ status: string; successRate?: number; message?: string }>;
}

const automationLogSchema = new Schema<IAutomationLog>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    jobId: {
      type: String,
      required: true,
      index: true
    },
    jobName: {
      type: String,
      required: true,
      index: true
    },
    automationType: {
      type: String,
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'partial'],
      required: true,
      default: 'pending',
      index: true
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number
    },

    recordsProcessed: {
      type: Number,
      default: 0
    },
    recordsSucceeded: {
      type: Number,
      default: 0
    },
    recordsFailed: {
      type: Number,
      default: 0
    },

    errorMessage: {
      type: String
    },
    errorStack: {
      type: String
    },
    failedRecords: [{
      recordId: String,
      error: String,
      timestamp: Date
    }],

    triggeredBy: {
      type: String,
      enum: ['scheduled', 'manual', 'webhook', 'api'],
      default: 'scheduled',
      index: true
    },
    triggeredByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for common queries
automationLogSchema.index({ jobId: 1, createdAt: -1 });
automationLogSchema.index({ jobName: 1, createdAt: -1 });
automationLogSchema.index({ automationType: 1, status: 1, createdAt: -1 });
automationLogSchema.index({ status: 1, createdAt: -1 });
automationLogSchema.index({ triggeredBy: 1, createdAt: -1 });
automationLogSchema.index({ createdAt: -1 });

// TTL index for automatic log expiration (90 days)
automationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

// Tenant isolation
automationLogSchema.index({ tenantId: 1, createdAt: -1 });

// Virtual for success rate
automationLogSchema.virtual('successRate').get(function() {
  if (this.recordsProcessed === 0) return 100;
  return Math.round((this.recordsSucceeded / this.recordsProcessed) * 100 * 10) / 10;
});

// Method to mark as completed
automationLogSchema.methods.markCompleted = function(this: IAutomationLog, succeeded: number, failed: number) {
  this.status = failed > 0 ? (succeeded > 0 ? 'partial' : 'failed') : 'completed';
  this.endTime = new Date();
  this.duration = this.endTime.getTime() - this.startTime.getTime();
  this.recordsSucceeded = succeeded;
  this.recordsFailed = failed;
  return this;
};

// Method to mark as failed
automationLogSchema.methods.markFailed = function(this: IAutomationLog, error: Error | string) {
  this.status = 'failed';
  this.endTime = new Date();
  this.duration = this.endTime.getTime() - this.startTime.getTime();
  this.errorMessage = error instanceof Error ? error.message : error;
  if (error instanceof Error) {
    this.errorStack = error.stack;
  }
  return this;
};

// Static method to get recent logs for a job
automationLogSchema.statics.getRecentLogs = async function(
  jobId: string,
  limit: number = 20
) {
  return this.find({ jobId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get execution stats
automationLogSchema.statics.getExecutionStats = async function(
  jobId?: string,
  startDate?: Date,
  endDate?: Date
) {
  const matchFilter: Record<string, unknown> = {};
  if (jobId) matchFilter.jobId = jobId;
  if (startDate || endDate) {
    matchFilter.createdAt = {};
    if (startDate) (matchFilter.createdAt as Record<string, Date>).$gte = startDate;
    if (endDate) (matchFilter.createdAt as Record<string, Date>).$lte = endDate;
  }

  const stats = await this.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: jobId ? '$jobId' : null,
        totalExecutions: { $sum: 1 },
        successfulExecutions: {
          $sum: { $cond: [{ $in: ['$status', ['completed', 'partial']] }, 1, 0] }
        },
        failedExecutions: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        totalRecordsProcessed: { $sum: '$recordsProcessed' },
        totalRecordsSucceeded: { $sum: '$recordsSucceeded' },
        totalRecordsFailed: { $sum: '$recordsFailed' },
        avgDuration: { $avg: '$duration' },
        lastExecution: { $max: '$startTime' }
      }
    }
  ]);

  return stats[0] || {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalRecordsProcessed: 0,
    totalRecordsSucceeded: 0,
    totalRecordsFailed: 0,
    avgDuration: 0,
    lastExecution: null
  };
};

// Static method to get job health
automationLogSchema.statics.getJobHealth = async function(jobId: string) {
  const recentLogs = await this.find({ jobId })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  if (recentLogs.length === 0) {
    return { status: 'no_runs', message: 'Job has never been executed' };
  }

  const successCount = recentLogs.filter((l: any) => l.status === 'completed' || l.status === 'partial').length;
  const successRate = (successCount / recentLogs.length) * 100;

  if (successRate >= 90) {
    return { status: 'healthy', successRate };
  } else if (successRate >= 70) {
    return { status: 'degraded', successRate };
  } else {
    return { status: 'unhealthy', successRate };
  }
};

const AutomationLog = mongoose.model<IAutomationLog, IAutomationLogModel>('AutomationLog', automationLogSchema);

export default AutomationLog;
