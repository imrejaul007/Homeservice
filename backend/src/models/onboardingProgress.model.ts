import mongoose, { Schema, Document } from 'mongoose';

/**
 * Onboarding Progress Model
 *
 * Tracks user progress through onboarding tasks.
 */

export interface IOnboardingProgress extends Document {
  userId: mongoose.Types.ObjectId;
  taskId: string;
  taskKey: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completedAt?: Date;
  completedData?: Record<string, unknown>;
  skippedAt?: Date;
  skipReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const onboardingProgressSchema = new Schema<IOnboardingProgress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    taskId: {
      type: String,
      required: true
    },
    taskKey: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'skipped'],
      default: 'pending'
    },
    completedAt: {
      type: Date
    },
    completedData: {
      type: Schema.Types.Mixed
    },
    skippedAt: {
      type: Date
    },
    skipReason: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index to prevent duplicate progress entries
onboardingProgressSchema.index({ userId: 1, taskId: 1 }, { unique: true });
onboardingProgressSchema.index({ userId: 1, status: 1 });

// Method to mark task as completed
onboardingProgressSchema.methods.complete = function(data?: Record<string, unknown>) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.completedData = data;
  return this.save();
};

// Method to mark task as skipped
onboardingProgressSchema.methods.skip = function(reason?: string) {
  this.status = 'skipped';
  this.skippedAt = new Date();
  this.skipReason = reason;
  return this.save();
};

// Static method to get user progress
onboardingProgressSchema.statics.getUserProgress = async function(userId: string) {
  return this.find({ userId: new mongoose.Types.ObjectId(userId) }).lean();
};

// Static method to check if user completed all required tasks
onboardingProgressSchema.statics.isOnboardingComplete = async function(
  userId: string,
  requiredTasks: string[]
) {
  const completedCount = await this.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    status: 'completed',
    taskKey: { $in: requiredTasks }
  });
  return completedCount === requiredTasks.length;
};

const OnboardingProgress = mongoose.model<IOnboardingProgress>(
  'OnboardingProgress',
  onboardingProgressSchema
);

export default OnboardingProgress;
