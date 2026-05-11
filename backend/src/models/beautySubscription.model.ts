import mongoose, { Schema, Document } from 'mongoose';

// Beauty provider subscription tiers
export const BEAUTY_PLANS = {
  FREE: 'beauty_free',
  PRO: 'beauty_pro',
  PREMIUM: 'beauty_premium',
} as const;

export const COMMISSION_RATES = {
  beauty_free: 20,
  beauty_pro: 15,
  beauty_premium: 10,
} as const;

export interface IStylist extends Document {
  providerId: mongoose.Types.ObjectId;
  portfolio: {
    images: string[];
    specialties: string[];
    certifications: string[];
    yearsExperience: number;
    bio: string;
  };
  services: {
    haircut: boolean;
    coloring: boolean;
    bridal: boolean;
    mensGrooming: boolean;
    skincare: boolean;
  };
  availability: {
    appointmentsPerDay: number;
    homeVisits: boolean;
    maxTravelDistance: number;
  };
}

const stylistSchema = new Schema({
  providerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  portfolio: {
    images: [String],
    specialties: [String],
    certifications: [String],
    yearsExperience: { type: Number, default: 0 },
    bio: String,
  },
  services: {
    haircut: { type: Boolean, default: false },
    coloring: { type: Boolean, default: false },
    bridal: { type: Boolean, default: false },
    mensGrooming: { type: Boolean, default: false },
    skincare: { type: Boolean, default: false },
  },
  availability: {
    appointmentsPerDay: { type: Number, default: 8 },
    homeVisits: { type: Boolean, default: false },
    maxTravelDistance: { type: Number, default: 10 },
  },
});

export const Stylist = mongoose.model<IStylist>('Stylist', stylistSchema);
export default Stylist;
