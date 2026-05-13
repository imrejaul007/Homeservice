import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IExperience extends Document {
  // References
  userId: mongoose.Types.ObjectId;        // Customer who submitted
  bookingId: mongoose.Types.ObjectId;     // Must be completed booking
  serviceId: mongoose.Types.ObjectId;     // Service experienced
  providerId: mongoose.Types.ObjectId;    // Provider who delivered

  // Media (Cloudinary URLs)
  images: string[];                       // Max 10 images
  videoUrl?: string;                      // Optional video

  // Content
  title: string;                          // 5-100 chars
  description: string;                    // 20-2000 chars

  // Rating
  rating: number;                         // 1-5 stars

  // Workflow
  status: 'pending' | 'approved' | 'rejected';
  isFeatured: boolean;                    // For homepage curation
  adminNotes?: string;

  // Soft delete
  isDeleted: boolean;
  deletedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Instance methods
  softDelete(): Promise<void>;
}

export interface IExperienceModel extends Model<IExperience> {
  findByService(
    serviceId: mongoose.Types.ObjectId,
    options?: { page?: number; limit?: number }
  ): Promise<any[]>;
  findByProvider(
    providerId: mongoose.Types.ObjectId,
    options?: { page?: number; limit?: number }
  ): Promise<any[]>;
  findFeatured(limit?: number): Promise<any[]>;
  getStats(): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    featured: number;
    avgRating: number;
  }>;
}

const experienceSchema = new Schema<IExperience>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },

    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking ID is required'],
    },

    serviceId: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: [true, 'Service ID is required'],
      index: true,
    },

    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Provider ID is required'],
      index: true,
    },

    // Media
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function(v: string[]) {
          return v.length <= 10;
        },
        message: 'Maximum 10 images allowed',
      },
    },

    videoUrl: {
      type: String,
      default: undefined,
      validate: {
        validator: function(v: string) {
          if (!v) return true; // Optional field
          try {
            new URL(v);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Invalid video URL format',
      },
    },

    // Content
    title: {
      type: String,
      required: [true, 'Title is required'],
      minlength: [5, 'Title must be at least 5 characters'],
      maxlength: [100, 'Title cannot exceed 100 characters'],
      trim: true,
    },

    description: {
      type: String,
      required: [true, 'Description is required'],
      minlength: [20, 'Description must be at least 20 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      trim: true,
    },

    // Rating
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be a whole number',
      },
    },

    // Workflow
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },

    adminNotes: {
      type: String,
      maxlength: [500, 'Admin notes cannot exceed 500 characters'],
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: undefined,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ===================================
// INDEXES FOR PERFORMANCE
// ===================================

// Unique index on bookingId prevents duplicate experiences per booking
experienceSchema.index({ bookingId: 1 }, { unique: true });

// Compound index for efficient queries
experienceSchema.index({ status: 1, isFeatured: 1 });
experienceSchema.index({ status: 1, createdAt: -1 });
experienceSchema.index({ userId: 1, createdAt: -1 });
experienceSchema.index({ providerId: 1, createdAt: -1 });
experienceSchema.index({ serviceId: 1, createdAt: -1 });

// Index for soft-deleted filtering
experienceSchema.index({ isDeleted: 1, status: 1 });

// ===================================
// PRE-MIDDLEWARE
// ===================================

// Soft delete query middleware
experienceSchema.pre('find', function() {
  // Only exclude soft-deleted documents by default
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
});

experienceSchema.pre('findOne', function() {
  if (this.getQuery().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
});

// ===================================
// INSTANCE METHODS
// ===================================

// Mark as soft deleted
experienceSchema.methods.softDelete = async function(): Promise<void> {
  this.isDeleted = true;
  this.deletedAt = new Date();
  await this.save();
};

// ===================================
// STATIC METHODS
// ===================================

// Get approved experiences for a service
experienceSchema.statics.findByService = function(
  serviceId: mongoose.Types.ObjectId,
  options: { page?: number; limit?: number } = {}
) {
  const { page = 1, limit = 10 } = options;
  return this.find({
    serviceId,
    status: 'approved',
    isDeleted: false,
  })
    .populate('userId', 'firstName lastName avatar')
    .populate('bookingId', 'scheduledDate')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Get approved experiences for a provider
experienceSchema.statics.findByProvider = function(
  providerId: mongoose.Types.ObjectId,
  options: { page?: number; limit?: number } = {}
) {
  const { page = 1, limit = 10 } = options;
  return this.find({
    providerId,
    status: 'approved',
    isDeleted: false,
  })
    .populate('userId', 'firstName lastName avatar')
    .populate('serviceId', 'name category')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Get featured experiences for homepage
experienceSchema.statics.findFeatured = function(limit: number = 10) {
  return this.find({
    status: 'approved',
    isFeatured: true,
    isDeleted: false,
  })
    .populate('userId', 'firstName lastName avatar')
    .populate('serviceId', 'name category')
    .populate('providerId', 'firstName lastName avatar')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Get experience statistics
experienceSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    { $match: { isDeleted: false } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        pending: {
          $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] },
        },
        approved: {
          $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
        },
        rejected: {
          $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
        },
        featured: {
          $sum: { $cond: [{ $eq: ['$isFeatured', true] }, 1, 0] },
        },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  return stats[0] || {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    featured: 0,
    avgRating: 0,
  };
};

const Experience = mongoose.model<IExperience, IExperienceModel>('Experience', experienceSchema);

export default Experience;
