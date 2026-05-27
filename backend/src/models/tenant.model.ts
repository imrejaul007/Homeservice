import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  domain?: string;
  subdomain?: string;
  region: {
    code: string;
    country: string;
    cities: string[];
    timezone: string;
    locale: string;
    currency: {
      code: string;
      symbol: string;
      decimalPlaces: number;
    };
  };
  branding: {
    logo?: string;
    favicon?: string;
    primaryColor?: string;
    secondaryColor?: string;
    customCss?: string;
  };
  policies: {
    cancellationWindow: number; // hours
    refundPolicy: 'full' | 'partial' | 'none';
    minBookingAdvance: number; // hours
    maxBookingAdvance: number; // days
  };
  taxConfig: {
    enabled: boolean;
    rate: number;
    inclusive: boolean; // true = prices include tax
  };
  subscription: {
    plan: 'starter' | 'growth' | 'enterprise';
    maxProviders: number;
    maxBookings: number;
    features: string[];
  };
  compliance: {
    gdpr: boolean;
    pdpa: boolean;
    pdpl: boolean;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const tenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    domain: { type: String, unique: true, sparse: true },
    subdomain: { type: String, unique: true, sparse: true },
    region: {
      code: { type: String, required: true },
      country: { type: String, required: true },
      cities: [{ type: String }],
      timezone: { type: String, required: true },
      locale: { type: String, required: true },
      currency: {
        code: { type: String, required: true },
        symbol: { type: String, required: true },
        decimalPlaces: { type: Number, default: 2 },
      },
    },
    branding: {
      logo: String,
      favicon: String,
      primaryColor: String,
      secondaryColor: String,
      customCss: String,
    },
    policies: {
      cancellationWindow: { type: Number, default: 24 },
      refundPolicy: { type: String, enum: ['full', 'partial', 'none'], default: 'partial' },
      minBookingAdvance: { type: Number, default: 2 },
      maxBookingAdvance: { type: Number, default: 30 },
    },
    taxConfig: {
      enabled: { type: Boolean, default: true },
      rate: { type: Number, default: 0 },
      inclusive: { type: Boolean, default: false },
    },
    subscription: {
      plan: { type: String, enum: ['starter', 'growth', 'enterprise'], default: 'starter' },
      maxProviders: { type: Number, default: 10 },
      maxBookings: { type: Number, default: 1000 },
      features: [{ type: String }],
    },
    compliance: {
      gdpr: { type: Boolean, default: false },
      pdpa: { type: Boolean, default: false },
      pdpl: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes (unique constraints already defined on fields)
// Compound index for region queries
tenantSchema.index({ 'region.code': 1 });

export default mongoose.model<ITenant>('Tenant', tenantSchema);
