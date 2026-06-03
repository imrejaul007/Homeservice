import mongoose, { Schema, Document, Model, Types } from 'mongoose';

// ============================================
// CES Submission Interface
// ============================================

export interface ICESSubmission extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  bookingId?: Types.ObjectId;
  serviceId?: Types.ObjectId;
  score: number; // 1-7 CES scale
  feedback?: string;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Static Methods Interface
// ============================================

export interface ICESSubmissionModel extends Model<ICESSubmission> {
  getSubmissionsByCustomer(
    userId: Types.ObjectId,
    options?: { limit?: number; startDate?: Date; endDate?: Date }
  ): Promise<ICESSubmission[]>;
  getAverageScore(userId: Types.ObjectId, periodDays?: number): Promise<number>;
  getScoreDistribution(userId: Types.ObjectId): Promise<Record<string, number>>;
}

// ============================================
// Schema Definition
// ============================================

const cesSubmissionSchema = new Schema<ICESSubmission>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: false,
      index: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: false,
      index: true,
    },
    score: {
      type: Number,
      required: [true, 'CES score is required'],
      min: [1, 'Score must be between 1 and 7'],
      max: [7, 'Score must be between 1 and 7'],
      index: true,
    },
    feedback: {
      type: String,
      required: false,
      maxlength: [2000, 'Feedback cannot exceed 2000 characters'],
    },
    submittedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ============================================
// Indexes
// ============================================

cesSubmissionSchema.index({ userId: 1, submittedAt: -1 });
cesSubmissionSchema.index({ userId: 1, score: 1 });
cesSubmissionSchema.index({ submittedAt: -1 });

// Compound unique index to prevent duplicate submissions for the same booking
cesSubmissionSchema.index(
  { userId: 1, bookingId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { bookingId: { $exists: true } },
  }
);

// ============================================
// Static Methods
// ============================================

/**
 * Get submissions for a customer
 */
cesSubmissionSchema.statics.getSubmissionsByCustomer = async function(
  userId: Types.ObjectId,
  options: { limit?: number; startDate?: Date; endDate?: Date } = {}
): Promise<ICESSubmission[]> {
  const { limit = 100, startDate, endDate } = options;

  const query: Record<string, unknown> = { userId };

  if (startDate || endDate) {
    query.submittedAt = {};
    if (startDate) (query.submittedAt as Record<string, Date>).$gte = startDate;
    if (endDate) (query.submittedAt as Record<string, Date>).$lte = endDate;
  }

  return this.find(query)
    .sort({ submittedAt: -1 })
    .limit(limit)
    .lean();
};

/**
 * Get average CES score for a customer
 */
cesSubmissionSchema.statics.getAverageScore = async function(
  userId: Types.ObjectId,
  periodDays: number = 90
): Promise<number> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - periodDays);

  const result = await this.aggregate([
    {
      $match: {
        userId: userId,
        submittedAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        averageScore: { $avg: '$score' },
      },
    },
  ]);

  return result[0]?.averageScore ?? 0;
};

/**
 * Get score distribution for a customer
 */
cesSubmissionSchema.statics.getScoreDistribution = async function(
  userId: Types.ObjectId
): Promise<Record<string, number>> {
  const submissions = await this.find({ userId }).lean();

  const distribution: Record<string, number> = {
    veryEasy: 0,     // 6-7
    easy: 0,         // 5
    neutral: 0,      // 4
    difficult: 0,    // 3
    veryDifficult: 0, // 1-2
  };

  submissions.forEach((sub: { score: number }) => {
    if (sub.score >= 6) distribution.veryEasy++;
    else if (sub.score === 5) distribution.easy++;
    else if (sub.score === 4) distribution.neutral++;
    else if (sub.score === 3) distribution.difficult++;
    else distribution.veryDifficult++;
  });

  return distribution;
};

// ============================================
// Export
// ============================================

const CESSubmission: Model<ICESSubmission> & ICESSubmissionModel = mongoose.model<ICESSubmission, ICESSubmissionModel>(
  'CESSubmission',
  cesSubmissionSchema
) as Model<ICESSubmission> & ICESSubmissionModel;

export type CESSubmissionModel = Model<ICESSubmission> & ICESSubmissionModel;

export default CESSubmission;
