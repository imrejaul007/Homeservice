import mongoose, { Schema, Document, Model, AnyObject } from 'mongoose';

export interface IProviderAd extends Document {
  // Basic Info
  name: string;
  description?: string;

  // Provider Reference
  providerId: mongoose.Types.ObjectId;

  // Status
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  isActive: boolean;

  // Budget Configuration
  budget: {
    daily?: number;
    monthly?: number;
    total: number;
    spent: number;
    remaining: number;
  };

  // Bidding
  bidAmount?: number;
  bidType: 'cpc' | 'cpm' | 'fixed';

  // Targeting
  targeting: {
    categories?: mongoose.Types.ObjectId[];
    locations?: Array<{
      type: 'city' | 'region' | 'radius';
      value: string;
      coordinates?: {
        lat: number;
        lng: number;
      };
      radiusKm?: number;
    }>;
    timeSchedule?: {
      daysOfWeek: number[]; // 0-6, Sunday to Saturday
      hoursStart: number; // 0-23
      hoursEnd: number; // 0-23
    };
    demographics?: {
      ageMin?: number;
      ageMax?: number;
    };
  };

  // Campaign Duration
  startDate: Date;
  endDate?: Date;

  // Statistics
  statistics: {
    views: number;
    clicks: number;
    conversions: number;
    ctr: number; // Click-through rate
    conversionRate: number;
    totalSpent: number;
    costPerClick: number;
    costPerConversion: number;
    dailyStats: Array<{
      date: Date;
      views: number;
      clicks: number;
      conversions: number;
      spent: number;
    }>;
  };

  // Performance Metrics
  performance: {
    roas?: number; // Return on Ad Spend
    impressionShare?: number;
    avgPosition?: number;
  };

  // Ad Content
  content: {
    title: string;
    description: string;
    imageUrl?: string;
    ctaText?: string;
    landingUrl?: string;
  };

  // Approval (for platform moderation)
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvalNotes?: string;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;

  // Scheduling
  scheduling: {
    runContinuously: boolean;
    scheduleType: 'immediate' | 'scheduled' | 'recurring';
    scheduledTimes?: Array<{
      startTime: Date;
      endTime: Date;
    }>;
  };

  // Priority
  priority: number; // Higher priority ads get shown first

  // Limits
  limits: {
    maxViewsPerDay?: number;
    maxClicksPerDay?: number;
    maxBudgetPerDay?: number;
  };

  // References
  relatedServiceIds?: mongoose.Types.ObjectId[];

  // Audit
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Schema Definition
const providerAdSchema = new Schema<IProviderAd>(
  {
    name: {
      type: String,
      required: [true, 'Ad campaign name is required'],
      trim: true,
      maxlength: [100, 'Ad name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Provider ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'completed', 'cancelled'],
      default: 'draft',
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    budget: {
      daily: {
        type: Number,
        min: 0,
        default: undefined,
      },
      monthly: {
        type: Number,
        min: 0,
        default: undefined,
      },
      total: {
        type: Number,
        required: [true, 'Total budget is required'],
        min: [1, 'Total budget must be at least 1'],
      },
      spent: {
        type: Number,
        default: 0,
        min: 0,
      },
      remaining: {
        type: Number,
        default: function(this: any) {
          return this.budget?.total - (this.budget?.spent || 0);
        },
      },
    },
    bidAmount: {
      type: Number,
      min: 0,
    },
    bidType: {
      type: String,
      enum: ['cpc', 'cpm', 'fixed'],
      default: 'cpc',
    },
    targeting: {
      categories: [{
        type: Schema.Types.ObjectId,
        ref: 'ServiceCategory',
      }],
      locations: [{
        type: {
          type: String,
          enum: ['city', 'region', 'radius'],
          required: true,
        },
        value: {
          type: String,
          required: true,
        },
        coordinates: {
          lat: Number,
          lng: Number,
        },
        radiusKm: Number,
      }],
      timeSchedule: {
        daysOfWeek: [{
          type: Number,
          min: 0,
          max: 6,
        }],
        hoursStart: {
          type: Number,
          min: 0,
          max: 23,
        },
        hoursEnd: {
          type: Number,
          min: 0,
          max: 23,
        },
      },
      demographics: {
        ageMin: {
          type: Number,
          min: 18,
          max: 100,
        },
        ageMax: {
          type: Number,
          min: 18,
          max: 100,
        },
      },
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    statistics: {
      views: {
        type: Number,
        default: 0,
        min: 0,
      },
      clicks: {
        type: Number,
        default: 0,
        min: 0,
      },
      conversions: {
        type: Number,
        default: 0,
        min: 0,
      },
      ctr: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      conversionRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      totalSpent: {
        type: Number,
        default: 0,
        min: 0,
      },
      costPerClick: {
        type: Number,
        default: 0,
        min: 0,
      },
      costPerConversion: {
        type: Number,
        default: 0,
        min: 0,
      },
      dailyStats: [{
        date: Date,
        views: Number,
        clicks: Number,
        conversions: Number,
        spent: Number,
      }],
    },
    performance: {
      roas: {
        type: Number,
        min: 0,
      },
      impressionShare: {
        type: Number,
        min: 0,
        max: 100,
      },
      avgPosition: {
        type: Number,
        min: 0,
      },
    },
    content: {
      title: {
        type: String,
        required: [true, 'Ad title is required'],
        trim: true,
        maxlength: [60, 'Title cannot exceed 60 characters'],
      },
      description: {
        type: String,
        required: [true, 'Ad description is required'],
        trim: true,
        maxlength: [200, 'Description cannot exceed 200 characters'],
      },
      imageUrl: {
        type: String,
        validate: {
          validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
          message: 'Image URL must be a valid URL',
        },
      },
      ctaText: {
        type: String,
        trim: true,
        maxlength: [20, 'CTA text cannot exceed 20 characters'],
        default: 'Book Now',
      },
      landingUrl: {
        type: String,
        trim: true,
      },
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvalNotes: {
      type: String,
      trim: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    scheduling: {
      runContinuously: {
        type: Boolean,
        default: true,
      },
      scheduleType: {
        type: String,
        enum: ['immediate', 'scheduled', 'recurring'],
        default: 'immediate',
      },
      scheduledTimes: [{
        startTime: Date,
        endTime: Date,
      }],
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    limits: {
      maxViewsPerDay: {
        type: Number,
        min: 0,
      },
      maxClicksPerDay: {
        type: Number,
        min: 0,
      },
      maxBudgetPerDay: {
        type: Number,
        min: 0,
      },
    },
    relatedServiceIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Service',
    }],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
providerAdSchema.index({ providerId: 1, status: 1 });
providerAdSchema.index({ providerId: 1, isActive: 1 });
providerAdSchema.index({ status: 1, isActive: 1 });
providerAdSchema.index({ approvalStatus: 1 });
providerAdSchema.index({ startDate: 1, endDate: 1 });
providerAdSchema.index({ 'budget.spent': 1, 'budget.total': 1 });
providerAdSchema.index({ createdAt: -1 });
providerAdSchema.index({ 'statistics.views': -1 });
providerAdSchema.index({ 'statistics.clicks': -1 });

// Compound indexes for common queries
providerAdSchema.index({ providerId: 1, createdAt: -1 });
providerAdSchema.index({ status: 1, approvalStatus: 1, isActive: 1 });

// Pre-save middleware to calculate CTR
providerAdSchema.pre('save', function(next) {
  // Calculate CTR
  if (this.statistics.views > 0) {
    this.statistics.ctr = Number(((this.statistics.clicks / this.statistics.views) * 100).toFixed(2));
  }

  // Calculate conversion rate
  if (this.statistics.clicks > 0) {
    this.statistics.conversionRate = Number(((this.statistics.conversions / this.statistics.clicks) * 100).toFixed(2));
  }

  // Calculate cost per click
  if (this.statistics.clicks > 0) {
    this.statistics.costPerClick = Number((this.statistics.totalSpent / this.statistics.clicks).toFixed(2));
  }

  // Calculate cost per conversion
  if (this.statistics.conversions > 0) {
    this.statistics.costPerConversion = Number((this.statistics.totalSpent / this.statistics.conversions).toFixed(2));
  }

  // Update remaining budget
  this.budget.remaining = this.budget.total - this.budget.spent;

  next();
});

// Instance method to pause ad
providerAdSchema.methods.pause = async function() {
  this.status = 'paused';
  this.isActive = false;
  await this.save();
  return this;
};

// Instance method to resume ad
providerAdSchema.methods.resume = async function() {
  this.status = 'active';
  this.isActive = true;
  await this.save();
  return this;
};

// Instance method to record a click
providerAdSchema.methods.recordClick = async function(bidAmount?: number): Promise<void> {
  this.statistics.clicks += 1;
  if (bidAmount) {
    this.statistics.totalSpent += bidAmount;
    this.budget.spent += bidAmount;
    this.budget.remaining = Math.max(0, this.budget.total - this.budget.spent);
  }
  await this.save();
};

// Instance method to record a conversion
providerAdSchema.methods.recordConversion = async function(): Promise<void> {
  this.statistics.conversions += 1;
  await this.save();
};

// Static method to get provider's ads
providerAdSchema.statics.findByProvider = function(
  providerId: string,
  options?: {
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }
) {
  const {
    status,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    order = 'desc',
  } = options || {};

  const query: any = { providerId };

  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;
  const sortOrder = order === 'asc' ? 1 : -1;
  const sortObj: any = {};
  sortObj[sortBy] = sortOrder;

  return this.find(query)
    .sort(sortObj)
    .skip(skip)
    .limit(limit)
    .lean();
};

// Static method to get ad statistics
providerAdSchema.statics.getProviderAdStats = async function(providerId: string) {
  const ads = await (this as any).find({ providerId }).lean() as Array<{
    status: string;
    isActive: boolean;
    statistics: { views: number; clicks: number; conversions: number; totalSpent: number };
  }>;

  const stats = {
    totalAds: ads.length,
    activeAds: ads.filter((a) => a.status === 'active' && a.isActive).length,
    pausedAds: ads.filter((a) => a.status === 'paused').length,
    draftAds: ads.filter((a) => a.status === 'draft').length,
    totalViews: ads.reduce((sum, a) => sum + a.statistics.views, 0),
    totalClicks: ads.reduce((sum, a) => sum + a.statistics.clicks, 0),
    totalConversions: ads.reduce((sum, a) => sum + a.statistics.conversions, 0),
    totalSpent: ads.reduce(
      (sum, a) => sum + Math.max(a.statistics?.totalSpent || 0, (a as any).budget?.spent || 0),
      0,
    ),
    averageCtr: 0,
    averageConversionRate: 0,
  };

  if (stats.totalViews > 0) {
    stats.averageCtr = Number(((stats.totalClicks / stats.totalViews) * 100).toFixed(2));
  }

  if (stats.totalClicks > 0) {
    stats.averageConversionRate = Number(((stats.totalConversions / stats.totalClicks) * 100).toFixed(2));
  }

  return stats;
};

// Create and export the model
const ProviderAd: Model<IProviderAd> = mongoose.model<IProviderAd>('ProviderAd', providerAdSchema);

export default ProviderAd;
