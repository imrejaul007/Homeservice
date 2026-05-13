import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICustomerProfile extends Document {
  userId: mongoose.Types.ObjectId;
  
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

const customerProfileSchema = new Schema<ICustomerProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
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
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, default: 'US' },
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], required: true } // [longitude, latitude]
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

const CustomerProfile: Model<ICustomerProfile> = mongoose.model<ICustomerProfile>('CustomerProfile', customerProfileSchema);

export default CustomerProfile;