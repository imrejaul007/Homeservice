import mongoose, { Schema, Document } from 'mongoose';

// Beauty service types
export const SERVICE_TYPES = {
  SALON_VISIT: 'salon_visit',
  HOME_VISIT: 'home_visit',
  BOTH: 'both',
} as const;

export interface IBeautyService extends Document {
  serviceType: 'hair' | 'skincare' | 'makeup' | 'nail' | 'spa' | 'bridal' | 'other';
  types: string[];
  providerId: mongoose.Types.ObjectId;
  homeService: boolean;
  estimatedDuration: number;
  stylistOptions: boolean;
  beforeAfter: boolean;
  hygieneCertified: boolean;
  hygieneCertExpiry?: Date;
}

const beautyServiceSchema = new Schema({
  serviceType: {
    type: String,
    enum: Object.values(SERVICE_TYPES),
    default: 'hair',
  },
  types: [String],
  providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  homeService: { type: Boolean, default: false },
  estimatedDuration: { type: Number, default: 60 },
  stylistOptions: { type: Boolean, default: true },
  beforeAfter: { type: Boolean, default: false },
  hygieneCertified: { type: Boolean, default: false },
  hygieneCertExpiry: Date,
}, { _id: false });

// Indexes for query optimization
beautyServiceSchema.index({ serviceType: 1 });
beautyServiceSchema.index({ types: 1 });
beautyServiceSchema.index({ providerId: 1 });

export const BeautyService = mongoose.model('BeautyService', beautyServiceSchema);
export default BeautyService;
