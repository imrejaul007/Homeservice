import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IHeroSlide extends Document {
  image: string;
  badge: string;
  title: string;
  subtitle: string;
  cta: string;
  ctaLink: string;
  sortOrder: number;
  isActive: boolean;
  startsAt?: Date;
  endsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IHeroSlideModel extends Model<IHeroSlide> {
  findActiveSlides(limit?: number): Promise<IHeroSlide[]>;
}

const heroSlideSchema = new Schema<IHeroSlide>(
  {
    image: { type: String, required: true, trim: true },
    badge: { type: String, required: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    subtitle: { type: String, required: true, trim: true, maxlength: 200 },
    cta: { type: String, required: true, trim: true, maxlength: 60 },
    ctaLink: { type: String, required: true, trim: true },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    startsAt: { type: Date },
    endsAt: { type: Date },
  },
  { timestamps: true }
);

heroSlideSchema.index({ isActive: 1, sortOrder: 1 });

heroSlideSchema.statics.findActiveSlides = function findActiveSlides(limit = 10) {
  const now = new Date();
  return this.find({
    isActive: true,
    $or: [{ startsAt: { $exists: false } }, { startsAt: { $lte: now } }],
    $and: [
      { $or: [{ endsAt: { $exists: false } }, { endsAt: { $gte: now } }] },
    ],
  })
    .sort({ sortOrder: 1, createdAt: -1 })
    .limit(limit)
    .lean();
};

const HeroSlide =
  (mongoose.models.HeroSlide as IHeroSlideModel) ||
  mongoose.model<IHeroSlide, IHeroSlideModel>('HeroSlide', heroSlideSchema);

export default HeroSlide;
