import mongoose, { Document, Schema, Model } from 'mongoose';

// ============================================
// Types
// ============================================

export type DigestFrequency = 'realtime' | 'hourly' | 'daily' | 'weekly';

export interface IDigestSchedule extends Document {
  _id: mongoose.Types.ObjectId;

  // User reference
  userId: mongoose.Types.ObjectId;

  // Schedule configuration
  frequency: DigestFrequency;

  // Timing
  nextRun: Date;
  lastRun?: Date;

  // State
  enabled: boolean;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface IDigestScheduleModel extends Model<IDigestSchedule> {
  findDueSchedules(batchSize?: number): Promise<IDigestSchedule[]>;
  findByUserId(userId: mongoose.Types.ObjectId | string): Promise<IDigestSchedule | null>;
  upsertSchedule(
    userId: mongoose.Types.ObjectId | string,
    updates: Partial<Pick<IDigestSchedule, 'frequency' | 'nextRun' | 'enabled' | 'lastRun'>>
  ): Promise<IDigestSchedule>;
  getStats(): Promise<{
    totalScheduled: number;
    enabledCount: number;
    realtimeCount: number;
    hourlyCount: number;
    dailyCount: number;
    weeklyCount: number;
    dueNow: number;
  }>;
}

// ============================================
// Schema
// ============================================

const digestScheduleSchema = new Schema<IDigestSchedule>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      unique: true, // One schedule per user
      index: true
    },

    frequency: {
      type: String,
      enum: ['realtime', 'hourly', 'daily', 'weekly'],
      required: [true, 'Frequency is required'],
      default: 'daily'
    },

    nextRun: {
      type: Date,
      required: [true, 'Next run time is required'],
      index: true
    },

    lastRun: {
      type: Date,
      default: null
    },

    enabled: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// ============================================
// Indexes for Performance
// ============================================

// Compound index for finding due digests efficiently
// Query: Find all enabled schedules where nextRun <= now
digestScheduleSchema.index({ enabled: 1, nextRun: 1 });

// Index for stats queries
digestScheduleSchema.index({ enabled: 1, frequency: 1 });

// Index for user lookup
digestScheduleSchema.index({ userId: 1, enabled: 1 });

// ============================================
// Static Methods
// ============================================

// Find schedules that are due for processing
digestScheduleSchema.statics.findDueSchedules = function(
  batchSize: number = 100
): Promise<IDigestSchedule[]> {
  const now = new Date();
  return this.find({
    enabled: true,
    nextRun: { $lte: now }
  })
    .sort({ nextRun: 1 })
    .limit(batchSize)
    .lean();
};

// Find schedules by user
digestScheduleSchema.statics.findByUserId = function(
  userId: mongoose.Types.ObjectId | string
): Promise<IDigestSchedule | null> {
  return this.findOne({ userId }).lean();
};

// Update or create schedule for a user (upsert)
digestScheduleSchema.statics.upsertSchedule = function(
  userId: mongoose.Types.ObjectId | string,
  updates: Partial<Pick<IDigestSchedule, 'frequency' | 'nextRun' | 'enabled'>>
): Promise<IDigestSchedule> {
  return this.findOneAndUpdate(
    { userId },
    {
      $set: {
        ...updates,
        userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId
      }
    },
    {
      upsert: true,
      new: true,
      lean: true
    }
  ) as Promise<IDigestSchedule>;
};

// Get schedule statistics
digestScheduleSchema.statics.getStats = async function(): Promise<{
  totalScheduled: number;
  enabledCount: number;
  realtimeCount: number;
  hourlyCount: number;
  dailyCount: number;
  weeklyCount: number;
  dueNow: number;
}> {
  const now = new Date();

  const [stats, dueCount] = await Promise.all([
    this.aggregate([
      {
        $group: {
          _id: {
            enabled: '$enabled',
            frequency: '$frequency'
          },
          count: { $sum: 1 }
        }
      }
    ]),
    this.countDocuments({
      enabled: true,
      nextRun: { $lte: now }
    })
  ]);

  let enabledCount = 0;
  let realtimeCount = 0;
  let hourlyCount = 0;
  let dailyCount = 0;
  let weeklyCount = 0;

  for (const stat of stats) {
    if (stat._id.enabled) {
      enabledCount += stat.count;
      switch (stat._id.frequency) {
        case 'realtime': realtimeCount += stat.count; break;
        case 'hourly': hourlyCount += stat.count; break;
        case 'daily': dailyCount += stat.count; break;
        case 'weekly': weeklyCount += stat.count; break;
      }
    }
  }

  return {
    totalScheduled: stats.reduce((sum, s) => sum + s.count, 0),
    enabledCount,
    realtimeCount,
    hourlyCount,
    dailyCount,
    weeklyCount,
    dueNow: dueCount
  };
};

// ============================================
// Model Export
// ============================================

const DigestScheduleModel: IDigestScheduleModel = mongoose.model<IDigestSchedule, IDigestScheduleModel>(
  'DigestSchedule',
  digestScheduleSchema
);

export default DigestScheduleModel;
