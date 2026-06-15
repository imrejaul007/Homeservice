import mongoose, { Schema, Document } from 'mongoose';

export interface IServiceMetricsDaily extends Document {
  providerId: mongoose.Types.ObjectId;
  serviceId: mongoose.Types.ObjectId;
  date: Date;
  views: number;
  bookings: number;
  completed: number;
  revenue: number;
}

const serviceMetricsDailySchema = new Schema<IServiceMetricsDaily>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    views: { type: Number, default: 0, min: 0 },
    bookings: { type: Number, default: 0, min: 0 },
    completed: { type: Number, default: 0, min: 0 },
    revenue: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
    collection: 'service_metrics_daily',
  },
);

serviceMetricsDailySchema.index({ providerId: 1, serviceId: 1, date: 1 }, { unique: true });
serviceMetricsDailySchema.index({ providerId: 1, date: -1 });
serviceMetricsDailySchema.index({ serviceId: 1, date: -1 });

const ServiceMetricsDaily = mongoose.model<IServiceMetricsDaily>(
  'ServiceMetricsDaily',
  serviceMetricsDailySchema,
);

export default ServiceMetricsDaily;
