import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface INPSSubmission extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  bookingId?: Types.ObjectId;
  score: number;
  feedback?: string;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface INPSSubmissionModel extends Model<INPSSubmission> {
  getPlatformStats(): Promise<{
    currentScore: number;
    responseCount: number;
    promoters: number;
    passives: number;
    detractors: number;
    averageScore: number;
    trend: number;
    responseRate: number;
  }>;
}

const npsSubmissionSchema = new Schema<INPSSubmission>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: false,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      index: true,
    },
    feedback: {
      type: String,
      maxlength: 2000,
    },
    submittedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

npsSubmissionSchema.index({ userId: 1, bookingId: 1 }, { unique: true, sparse: true });

npsSubmissionSchema.statics.getPlatformStats = async function getPlatformStats() {
  const submissions = await this.find().sort({ submittedAt: -1 }).lean() as Array<{ score: number; submittedAt: Date }>;
  const responseCount = submissions.length;

  if (responseCount === 0) {
    return {
      currentScore: 0,
      responseCount: 0,
      promoters: 0,
      passives: 0,
      detractors: 0,
      averageScore: 0,
      trend: 0,
      responseRate: 0,
    };
  }

  const promoters = submissions.filter((entry: { score: number }) => entry.score >= 9).length;
  const passives = submissions.filter((entry: { score: number }) => entry.score >= 7 && entry.score <= 8).length;
  const detractors = submissions.filter((entry: { score: number }) => entry.score <= 6).length;
  const averageScore = submissions.reduce((sum: number, entry: { score: number }) => sum + entry.score, 0) / responseCount;
  const currentScore = Math.round(((promoters - detractors) / responseCount) * 100);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const recent = submissions.filter((entry: { submittedAt: Date }) => new Date(entry.submittedAt) >= thirtyDaysAgo);
  const previous = submissions.filter(
    (entry: { submittedAt: Date }) => new Date(entry.submittedAt) >= sixtyDaysAgo && new Date(entry.submittedAt) < thirtyDaysAgo,
  );

  const recentScore = recent.length > 0
    ? Math.round(((recent.filter((entry: { score: number }) => entry.score >= 9).length - recent.filter((entry: { score: number }) => entry.score <= 6).length) / recent.length) * 100)
    : 0;
  const previousScore = previous.length > 0
    ? Math.round(((previous.filter((entry: { score: number }) => entry.score >= 9).length - previous.filter((entry: { score: number }) => entry.score <= 6).length) / previous.length) * 100)
    : 0;

  return {
    currentScore,
    responseCount,
    promoters,
    passives,
    detractors,
    averageScore: Math.round(averageScore * 10) / 10,
    trend: previousScore > 0 ? recentScore - previousScore : 0,
    responseRate: Math.min(100, Math.round((responseCount / 50) * 100)),
  };
};

const NPSSubmission = mongoose.model<INPSSubmission, INPSSubmissionModel>(
  'NPSSubmission',
  npsSubmissionSchema,
);

export default NPSSubmission;
