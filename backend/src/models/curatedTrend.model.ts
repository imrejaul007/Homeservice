import mongoose, { Document, Schema, Model } from 'mongoose';

export type CuratedTrendLinkType = 'service' | 'experience' | 'category' | 'external' | 'search';
export type CuratedTrendPlacement = 'homepage_trending';

export interface ICuratedTrend extends Document {
  title: string;
  subtitle: string;
  imageUrl: string;
  videoUrl?: string;
  linkType: CuratedTrendLinkType;
  linkTarget: string;
  categoryLabel: string;
  metricOverride?: string;
  sortOrder: number;
  isActive: boolean;
  isPinned: boolean;
  startsAt?: Date;
  endsAt?: Date;
  placement: CuratedTrendPlacement;
  clickCount: number;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  softDelete(): Promise<void>;
}

export interface ICuratedTrendModel extends Model<ICuratedTrend> {
  findActiveForPlacement(
    placement: CuratedTrendPlacement,
    limit?: number
  ): Promise<ICuratedTrend[]>;
}

const curatedTrendSchema = new Schema<ICuratedTrend>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: 100,
    },
    subtitle: {
      type: String,
      required: [true, 'Subtitle is required'],
      trim: true,
      maxlength: 200,
    },
    imageUrl: {
      type: String,
      required: [true, 'Image URL is required'],
      trim: true,
    },
    videoUrl: {
      type: String,
      trim: true,
    },
    linkType: {
      type: String,
      enum: ['service', 'experience', 'category', 'external', 'search'],
      required: true,
      default: 'category',
    },
    linkTarget: {
      type: String,
      required: [true, 'Link target is required'],
      trim: true,
    },
    categoryLabel: {
      type: String,
      required: [true, 'Category label is required'],
      trim: true,
      maxlength: 50,
    },
    metricOverride: {
      type: String,
      trim: true,
      maxlength: 30,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    startsAt: {
      type: Date,
    },
    endsAt: {
      type: Date,
    },
    placement: {
      type: String,
      enum: ['homepage_trending'],
      default: 'homepage_trending',
      index: true,
    },
    clickCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

curatedTrendSchema.index({ placement: 1, isActive: 1, isDeleted: 1, sortOrder: 1 });
curatedTrendSchema.index({ startsAt: 1, endsAt: 1 });

curatedTrendSchema.methods.softDelete = async function softDelete(): Promise<void> {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.isActive = false;
  await this.save();
};

curatedTrendSchema.statics.findActiveForPlacement = function findActiveForPlacement(
  placement: CuratedTrendPlacement,
  limit = 20
) {
  const now = new Date();
  return this.find({
    placement,
    isActive: true,
    isDeleted: false,
    $and: [
      { $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] },
      { $or: [{ endsAt: { $exists: false } }, { endsAt: null }, { endsAt: { $gte: now } }] },
    ],
  })
    .sort({ isPinned: -1, sortOrder: 1, createdAt: -1 })
    .limit(limit);
};

const CuratedTrend = mongoose.model<ICuratedTrend, ICuratedTrendModel>(
  'CuratedTrend',
  curatedTrendSchema
);

export default CuratedTrend;
