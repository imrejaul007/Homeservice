import mongoose, { Schema, Document } from 'mongoose';

export interface IProviderFunnelStages {
  impressions: number;
  uniqueImpressions: number;
  profileViews: number;
  uniqueProfileViews: number;
  serviceViews: number;
  bookingRequests: number;
  confirmed: number;
  completed: number;
}

export interface IProviderFunnelDaily extends Document {
  providerId: mongoose.Types.ObjectId;
  date: Date;
  stages: IProviderFunnelStages;
}

const funnelStagesSchema = new Schema<IProviderFunnelStages>(
  {
    impressions: { type: Number, default: 0, min: 0 },
    uniqueImpressions: { type: Number, default: 0, min: 0 },
    profileViews: { type: Number, default: 0, min: 0 },
    uniqueProfileViews: { type: Number, default: 0, min: 0 },
    serviceViews: { type: Number, default: 0, min: 0 },
    bookingRequests: { type: Number, default: 0, min: 0 },
    confirmed: { type: Number, default: 0, min: 0 },
    completed: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const providerFunnelDailySchema = new Schema<IProviderFunnelDaily>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    stages: {
      type: funnelStagesSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    collection: 'provider_funnel_daily',
  },
);

providerFunnelDailySchema.index({ providerId: 1, date: 1 }, { unique: true });
providerFunnelDailySchema.index({ date: -1 });

const ProviderFunnelDaily = mongoose.model<IProviderFunnelDaily>(
  'ProviderFunnelDaily',
  providerFunnelDailySchema,
);

export default ProviderFunnelDaily;
