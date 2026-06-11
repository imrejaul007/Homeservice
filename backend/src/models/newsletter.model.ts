import mongoose, { Document, Schema, Model } from 'mongoose';

// ============================================
// Newsletter Subscription Interface
// ============================================

export type NewsletterStatus = 'active' | 'unsubscribed' | 'bounced' | 'complained';

export interface INewsletter extends Document {
  email: string;
  status: NewsletterStatus;
  source: string;
  ipAddress?: string;
  userAgent?: string;
  userId?: mongoose.Types.ObjectId;
  tenantId?: mongoose.Types.ObjectId;
  subscribedAt: Date;
  unsubscribedAt?: Date;
  lastEngagementAt?: Date;
  emailVerified: boolean;
  verificationToken?: string;
  metadata?: Record<string, unknown>;
}

export interface INewsletterModel extends Model<INewsletter> {
  findByEmail(email: string): Promise<INewsletter | null>;
  isSubscribed(email: string): Promise<boolean>;
}

// ============================================
// Newsletter Schema
// ============================================

const NewsletterSchema = new Schema<INewsletter>(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'unsubscribed', 'bounced', 'complained'],
      default: 'active',
      index: true,
    },
    source: {
      type: String,
      default: 'footer',
      index: true,
    },
    ipAddress: { type: String },
    userAgent: { type: String, maxlength: 500 },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
    },
    subscribedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    unsubscribedAt: { type: Date },
    lastEngagementAt: { type: Date },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// ============================================
// Indexes
// ============================================

NewsletterSchema.index({ email: 1, status: 1 });
NewsletterSchema.index({ status: 1, subscribedAt: -1 });
NewsletterSchema.index({ createdAt: -1 });

// ============================================
// Static Methods
// ============================================

NewsletterSchema.statics.findByEmail = async function (email: string): Promise<INewsletter | null> {
  return this.findOne({ email: email.toLowerCase() });
};

NewsletterSchema.statics.isSubscribed = async function (email: string): Promise<boolean> {
  const subscriber = await this.findOne({
    email: email.toLowerCase(),
    status: 'active',
  });
  return !!subscriber;
};

// ============================================
// Pre-save Hook
// ============================================

NewsletterSchema.pre('save', function (next) {
  // Auto-generate verification token for new subscriptions
  if (this.isNew && !this.verificationToken) {
    const crypto = require('crypto');
    this.verificationToken = crypto.randomBytes(32).toString('hex');
  }
  next();
});

// ============================================
// Model Export
// ============================================

const Newsletter = mongoose.model<INewsletter, INewsletterModel>('Newsletter', NewsletterSchema);

export default Newsletter;