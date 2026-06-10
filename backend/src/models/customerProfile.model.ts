import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICustomerProfile extends Document {
  userId: mongoose.Types.ObjectId;

  // Stripe integration
  stripeCustomerId?: string;

  preferences: {
    categories: string[];
    maxDistance: number;
    priceRange: {
      min: number;
      max: number;
    };
    preferredDays: string[];
    preferredTimeSlots: string[];
    locationPreference: 'home' | 'provider_location' | 'both';
  };
  
  addresses: Array<{
    _id?: mongoose.Types.ObjectId;
    label: string;
    type: 'home' | 'work' | 'other';
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    coordinates: {
      type: 'Point';
      coordinates: [number, number]; // [longitude, latitude]
    };
    isDefault: boolean;
    instructions?: string;
    accessCodes?: {
      buildingCode?: string;
      apartmentNumber?: string;
      gateCode?: string;
    };
    createdAt: Date;
  }>;
  
  paymentMethods: Array<{
    _id?: mongoose.Types.ObjectId;
    type: 'card' | 'paypal' | 'wallet' | 'bank_transfer' | 'crypto';
    isDefault: boolean;
    nickname?: string;
    // Card specific fields
    last4?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    // Payment provider IDs
    stripePaymentMethodId?: string;
    paypalId?: string;
    walletId?: string;
    // Status
    isActive: boolean;
    createdAt: Date;
    lastUsed?: Date;
  }>;
  
  favoriteProviders: Array<{
    providerId: mongoose.Types.ObjectId;
    addedAt: Date;
    category?: string;
    notes?: string;
  }>;

  favoritePackages: Array<{
    packageId: mongoose.Types.ObjectId;
    packageName: string;
    packagePrice: number;
    providerId: mongoose.Types.ObjectId;
    providerName: string;
    addedAt: Date;
    category?: string;
    notes?: string;
  }>;

  // NOTE: Loyalty data is stored in the User model (loyaltySystem field).
  // Achievements are also stored in User model (achievements field).
  // This is the single source of truth for loyalty/points data.

  bookingHistory: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    totalSpent: number;
    averageRating: number;
    favoriteCategories: Array<{
      category: string;
      bookingCount: number;
      totalSpent: number;
    }>;
    seasonalPatterns: Array<{
      month: string;
      bookingCount: number;
      averageSpend: number;
    }>;
  };
  
  socialActivity: {
    reviewsWritten: number;
    helpfulVotes: number;
    photosShared: number;
    followersCount: number;
    followingCount: number;
    profileViews: number;
    socialScore: number;
  };
  
  communicationPreferences: {
    preferredContactMethod: 'email' | 'sms' | 'push' | 'whatsapp';
    notificationSettings: {
      bookingConfirmation: boolean;
      bookingReminders: boolean;
      providerUpdates: boolean;
      promotionsAndOffers: boolean;
      loyaltyUpdates: boolean;
      socialActivity: boolean;
      weeklyDigest: boolean;
    };
    reminderTiming: {
      booking24Hours: boolean;
      booking2Hours: boolean;
      booking30Minutes: boolean;
    };
  };
  
  privacySettings: {
    profileVisibility: 'public' | 'friends' | 'private';
    showBookingHistory: boolean;
    showReviews: boolean;
    showLocation: boolean;
    allowProviderContact: boolean;
    shareDataForRecommendations: boolean;
  };
  
  emergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
    address?: string;
  };
  
  accessibilityNeeds: {
    hasSpecialRequirements: boolean;
    requirements?: Array<{
      type: 'mobility' | 'visual' | 'hearing' | 'cognitive' | 'other';
      description: string;
      severity: 'mild' | 'moderate' | 'severe';
    }>;
    preferredCommunication?: string;
    assistiveDevices?: string[];
  };
  
  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isDeleted: boolean;
}

// Static methods interface
export interface ICustomerProfileModel extends Model<ICustomerProfile> {
  findByUserId(userId: string): Promise<ICustomerProfile | null>;
  findCustomersInArea(lat: number, lng: number, maxDistance: number): Promise<ICustomerProfile[]>;
  recalculateBookingHistory(userId: string | mongoose.Types.ObjectId): Promise<void>;
  recalculateSocialActivity(userId: string | mongoose.Types.ObjectId): Promise<void>;
  recalculateAllAnalytics(userId: string | mongoose.Types.ObjectId): Promise<void>;
}

const customerProfileSchema = new Schema<ICustomerProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    stripeCustomerId: {
      type: String,
      sparse: true,
      index: true
    },

    preferences: {
      categories: [String],
      maxDistance: { 
        type: Number, 
        default: 25,
        min: 1,
        max: 100
      },
      priceRange: {
        min: { type: Number, default: 0, min: 0 },
        max: { type: Number, default: 1000, min: 1 }
      },
      preferredDays: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }],
      preferredTimeSlots: [{
        type: String,
        enum: ['morning', 'afternoon', 'evening', 'night']
      }],
      locationPreference: {
        type: String,
        enum: ['home', 'provider_location', 'both'],
        default: 'both'
      }
    },
    
    addresses: [{
      label: {
        type: String,
        required: true,
        maxlength: 50
      },
      type: {
        type: String,
        enum: ['home', 'work', 'other'],
        default: 'home'
      },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, default: '' },
      zipCode: { type: String, default: '' },
      country: { type: String, default: 'US' },
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
      },
      isDefault: { type: Boolean, default: false },
      instructions: String,
      accessCodes: {
        buildingCode: String,
        apartmentNumber: String,
        gateCode: String
      },
      createdAt: { type: Date, default: Date.now }
    }],
    
    paymentMethods: [{
      type: {
        type: String,
        enum: ['card', 'paypal', 'wallet', 'bank_transfer', 'crypto'],
        required: true
      },
      isDefault: { type: Boolean, default: false },
      nickname: String,
      last4: String,
      brand: String,
      expiryMonth: {
        type: Number,
        min: 1,
        max: 12
      },
      expiryYear: {
        type: Number,
        min: new Date().getFullYear()
      },
      stripePaymentMethodId: String,
      paypalId: String,
      walletId: String,
      isActive: { type: Boolean, default: true },
      createdAt: { type: Date, default: Date.now },
      lastUsed: Date
    }],
    
    favoriteProviders: [{
      providerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      addedAt: { type: Date, default: Date.now },
      category: String,
      notes: String
    }],

    favoritePackages: [{
      packageId: {
        type: Schema.Types.ObjectId,
        ref: 'Service',
        required: true
      },
      packageName: {
        type: String,
        required: true
      },
      packagePrice: {
        type: Number,
        required: true
      },
      providerId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      providerName: {
        type: String,
        required: true
      },
      addedAt: { type: Date, default: Date.now },
      category: String,
      notes: String
    }],

    bookingHistory: {
      totalBookings: { type: Number, default: 0, min: 0 },
      completedBookings: { type: Number, default: 0, min: 0 },
      cancelledBookings: { type: Number, default: 0, min: 0 },
      totalSpent: { type: Number, default: 0, min: 0 },
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      favoriteCategories: [{
        category: String,
        bookingCount: { type: Number, default: 0 },
        totalSpent: { type: Number, default: 0 }
      }],
      seasonalPatterns: [{
        month: String,
        bookingCount: { type: Number, default: 0 },
        averageSpend: { type: Number, default: 0 }
      }]
    },
    
    socialActivity: {
      reviewsWritten: { type: Number, default: 0, min: 0 },
      helpfulVotes: { type: Number, default: 0, min: 0 },
      photosShared: { type: Number, default: 0, min: 0 },
      followersCount: { type: Number, default: 0, min: 0 },
      followingCount: { type: Number, default: 0, min: 0 },
      profileViews: { type: Number, default: 0, min: 0 },
      socialScore: { type: Number, default: 0, min: 0, max: 100 }
    },
    
    communicationPreferences: {
      preferredContactMethod: {
        type: String,
        enum: ['email', 'sms', 'push', 'whatsapp'],
        default: 'push'
      },
      notificationSettings: {
        bookingConfirmation: { type: Boolean, default: true },
        bookingReminders: { type: Boolean, default: true },
        providerUpdates: { type: Boolean, default: true },
        promotionsAndOffers: { type: Boolean, default: false },
        loyaltyUpdates: { type: Boolean, default: true },
        socialActivity: { type: Boolean, default: true },
        weeklyDigest: { type: Boolean, default: false }
      },
      reminderTiming: {
        booking24Hours: { type: Boolean, default: true },
        booking2Hours: { type: Boolean, default: true },
        booking30Minutes: { type: Boolean, default: false }
      }
    },
    
    privacySettings: {
      profileVisibility: {
        type: String,
        enum: ['public', 'friends', 'private'],
        default: 'public'
      },
      showBookingHistory: { type: Boolean, default: false },
      showReviews: { type: Boolean, default: true },
      showLocation: { type: Boolean, default: true },
      allowProviderContact: { type: Boolean, default: true },
      shareDataForRecommendations: { type: Boolean, default: true }
    },
    
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String,
      address: String
    },
    
    accessibilityNeeds: {
      hasSpecialRequirements: { type: Boolean, default: false },
      requirements: [{
        type: {
          type: String,
          enum: ['mobility', 'visual', 'hearing', 'cognitive', 'other']
        },
        description: String,
        severity: {
          type: String,
          enum: ['mild', 'moderate', 'severe']
        }
      }],
      preferredCommunication: String,
      assistiveDevices: [String]
    },
    
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance (userId already has index from unique: true)
customerProfileSchema.index({ 'addresses.coordinates': '2dsphere' });
customerProfileSchema.index({ 'favoriteProviders.providerId': 1 });
customerProfileSchema.index({ 'favoritePackages.packageId': 1 });
customerProfileSchema.index({ isActive: 1, isDeleted: 1 });
customerProfileSchema.index({ 'bookingHistory.totalBookings': -1 });
customerProfileSchema.index({ 'preferences.categories': 1 });

// Ensure only one default address
customerProfileSchema.pre('save', function(next) {
  if (this.isModified('addresses')) {
    const defaultAddresses = this.addresses.filter(addr => addr.isDefault);
    if (defaultAddresses.length > 1) {
      // Keep only the first default, set others to false
      this.addresses.forEach((addr, index) => {
        if (index > 0 && addr.isDefault) {
          addr.isDefault = false;
        }
      });
    }
  }
  next();
});

// Ensure only one default payment method
customerProfileSchema.pre('save', function(next) {
  if (this.isModified('paymentMethods')) {
    const defaultMethods = this.paymentMethods.filter(method => method.isDefault);
    if (defaultMethods.length > 1) {
      // Keep only the first default, set others to false
      this.paymentMethods.forEach((method, index) => {
        if (index > 0 && method.isDefault) {
          method.isDefault = false;
        }
      });
    }
  }
  next();
});

// NOTE: Virtual for loyalty tier progress percentage removed - loyalty data is now in User model

// Virtual for completion rate
customerProfileSchema.virtual('bookingHistory.completionRate').get(function() {
  const history = this.bookingHistory;
  if (history.totalBookings === 0) return 0;
  return Math.round((history.completedBookings / history.totalBookings) * 100);
});

// Virtual for default address
customerProfileSchema.virtual('defaultAddress').get(function() {
  return this.addresses.find(addr => addr.isDefault) || this.addresses[0];
});

// Virtual for default payment method
customerProfileSchema.virtual('defaultPaymentMethod').get(function() {
  return this.paymentMethods.find(method => method.isDefault) || this.paymentMethods[0];
});

// Static methods
customerProfileSchema.statics.findByUserId = function(userId: string) {
  return this.findOne({ userId, isActive: true, isDeleted: false });
};

customerProfileSchema.statics.findCustomersInArea = function(lat: number, lng: number, maxDistance: number) {
  return this.find({
    'addresses.coordinates': {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxDistance * 1000 // Convert km to meters
      }
    },
    isActive: true,
    isDeleted: false
  });
};

// NOTE: findByTier moved to User model since loyalty data is now in User

const CustomerProfile = mongoose.model<ICustomerProfile, ICustomerProfileModel>('CustomerProfile', customerProfileSchema);

// ===================================
// ANALYTICS UPDATE METHODS
// ===================================

/**
 * Recalculate and update denormalized booking history stats from actual Booking documents.
 * Call this after booking status changes (completed, cancelled, etc.)
 */
CustomerProfile.recalculateBookingHistory = async function(userId: string | mongoose.Types.ObjectId): Promise<void> {
  const Booking = mongoose.model('Booking');

  const userObjectId = new mongoose.Types.ObjectId(userId.toString());

  const completedBookings = await Booking.countDocuments({
    customerId: userObjectId,
    status: 'completed'
  });

  const cancelledBookings = await Booking.countDocuments({
    customerId: userObjectId,
    status: 'cancelled'
  });

  const totalBookings = await Booking.countDocuments({
    customerId: userObjectId
  });

  // Calculate total spent from completed bookings
  const spentAgg = await Booking.aggregate([
    { $match: { customerId: userObjectId, status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } }
  ]);
  const totalSpent = spentAgg[0]?.total || 0;

  // Calculate average rating given by customer
  const reviewsAgg = await Booking.aggregate([
    { $match: { customerId: userObjectId, status: 'completed' } },
    { $lookup: { from: 'reviews', localField: '_id', foreignField: 'bookingId', as: 'review' } },
    { $unwind: { path: '$review', preserveNullAndEmptyArrays: true } },
    { $match: { 'review.reviewerType': 'customer' } },
    { $group: { _id: null, avgRating: { $avg: '$review.rating' } } }
  ]);
  const averageRating = reviewsAgg[0]?.avgRating || 0;

  // Get favorite categories
  const categoryAgg = await Booking.aggregate([
    { $match: { customerId: userObjectId, status: 'completed' } },
    { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'service' } },
    { $unwind: { path: '$service', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: '$service.category',
        bookingCount: { $sum: 1 },
        totalSpent: { $sum: '$pricing.totalAmount' }
      }
    },
    { $sort: { bookingCount: -1 } },
    { $limit: 5 }
  ]);

  const favoriteCategories = categoryAgg.map(c => ({
    category: c._id || 'Unknown',
    bookingCount: c.bookingCount,
    totalSpent: c.totalSpent
  }));

  // Get seasonal patterns
  const seasonalAgg = await Booking.aggregate([
    { $match: { customerId: userObjectId, status: 'completed' } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$scheduledDate' } },
        bookingCount: { $sum: 1 },
        averageSpend: { $avg: '$pricing.totalAmount' }
      }
    },
    { $sort: { _id: 1 } },
    { $limit: 12 }
  ]);

  const seasonalPatterns = seasonalAgg.map(s => ({
    month: s._id,
    bookingCount: s.bookingCount,
    averageSpend: Math.round((s.averageSpend || 0) * 100) / 100
  }));

  await this.updateOne(
    { userId },
    {
      $set: {
        'bookingHistory.totalBookings': totalBookings,
        'bookingHistory.completedBookings': completedBookings,
        'bookingHistory.cancelledBookings': cancelledBookings,
        'bookingHistory.totalSpent': Math.round(totalSpent * 100) / 100,
        'bookingHistory.averageRating': Math.round((averageRating || 0) * 10) / 10,
        'bookingHistory.favoriteCategories': favoriteCategories,
        'bookingHistory.seasonalPatterns': seasonalPatterns
      }
    }
  );
};

/**
 * Recalculate and update social activity stats from actual Review documents.
 */
CustomerProfile.recalculateSocialActivity = async function(userId: string | mongoose.Types.ObjectId): Promise<void> {
  const Review = mongoose.model('Review');

  const reviewsWritten = await Review.countDocuments({
    reviewerId: userId,
    reviewerType: 'customer'
  });

  const helpfulVotesAgg = await Review.aggregate([
    { $match: { reviewerId: new mongoose.Types.ObjectId(userId.toString()), reviewerType: 'customer' } },
    { $group: { _id: null, totalVotes: { $sum: '$helpfulVotes' } } }
  ]);
  const helpfulVotes = helpfulVotesAgg[0]?.totalVotes || 0;

  // Count photos shared in reviews
  const photosAgg = await Review.aggregate([
    { $match: { reviewerId: new mongoose.Types.ObjectId(userId.toString()), reviewerType: 'customer' } },
    { $project: { photoCount: { $size: { $ifNull: ['$photos', []] } } } },
    { $group: { _id: null, totalPhotos: { $sum: '$photoCount' } } }
  ]);
  const photosShared = photosAgg[0]?.totalPhotos || 0;

  // Get social profile counts from User model
  const User = mongoose.model('User');
  const user = await User.findById(userId).select('socialProfiles');
  const followersCount = user?.socialProfiles?.followers?.length || 0;
  const followingCount = user?.socialProfiles?.following?.length || 0;
  const profileViews = user?.socialProfiles?.profileViews || 0;

  // Calculate social score (simple formula)
  const socialScore = Math.min(100, Math.round(
    (reviewsWritten * 5) +
    (helpfulVotes * 0.5) +
    (photosShared * 2) +
    (followersCount * 0.1)
  ));

  await this.updateOne(
    { userId },
    {
      $set: {
        'socialActivity.reviewsWritten': reviewsWritten,
        'socialActivity.helpfulVotes': helpfulVotes,
        'socialActivity.photosShared': photosShared,
        'socialActivity.followersCount': followersCount,
        'socialActivity.followingCount': followingCount,
        'socialActivity.profileViews': profileViews,
        'socialActivity.socialScore': socialScore
      }
    }
  );
};

/**
 * Recalculate all denormalized analytics for a customer.
 * Call this as a periodic job or after significant changes.
 */
CustomerProfile.recalculateAllAnalytics = async function(userId: string | mongoose.Types.ObjectId): Promise<void> {
  await this.recalculateBookingHistory(userId);
  await this.recalculateSocialActivity(userId);
};

export default CustomerProfile;