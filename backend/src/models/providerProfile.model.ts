import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IProviderProfile extends Document {
  userId: mongoose.Types.ObjectId;

  // Provider Tier Level (for display and sorting)
  tier: 'elite' | 'premium' | 'standard';

  // Business Information
  businessInfo: {
    businessName: string;
    businessType: 'individual' | 'small_business' | 'company' | 'franchise';
    description: string;
    tagline?: string;
    businessRegistrationNumber?: string;
    taxId?: string;
    website?: string;
    establishedDate?: Date;
    businessHours: {
      [key: string]: {
        isOpen: boolean;
        openTime?: string;
        closeTime?: string;
        breakStart?: string;
        breakEnd?: string;
      };
    };
    serviceRadius: number; // in kilometers
    instantBooking: boolean;
    advanceBookingDays: number;
  };
  
  // Instagram-style Profile Features
  instagramStyleProfile: {
    profilePhoto: string;
    coverPhoto?: string;
    isVerified: boolean;
    verificationBadges: Array<{
      type: 'identity' | 'business' | 'insurance' | 'certification' | 'background_check';
      verifiedAt: Date;
      expiresAt?: Date;
      verifier: string;
      documentUrl?: string;
    }>;
    bio: string;
    highlights: Array<{
      _id?: mongoose.Types.ObjectId;
      title: string;
      coverImage: string;
      stories: Array<{
        type: 'image' | 'video';
        url: string;
        caption?: string;
        timestamp: Date;
        views: number;
      }>;
      createdAt: Date;
    }>;
    posts: Array<{
      _id?: mongoose.Types.ObjectId;
      type: 'image' | 'video' | 'before_after' | 'story';
      media: Array<{
        url: string;
        type: 'image' | 'video';
        caption?: string;
        alt?: string;
      }>;
      caption: string;
      tags: string[];
      location?: {
        name: string;
        coordinates: {
          lat: number;
          lng: number;
        };
      };
      likes: Array<{
        userId: mongoose.Types.ObjectId;
        timestamp: Date;
      }>;
      comments: Array<{
        userId: mongoose.Types.ObjectId;
        text: string;
        timestamp: Date;
        replies?: Array<{
          userId: mongoose.Types.ObjectId;
          text: string;
          timestamp: Date;
        }>;
      }>;
      shares: number;
      views: number;
      isSponsored: boolean;
      isPinned: boolean;
      createdAt: Date;
    }>;
    followersCount: number;
    followingCount: number;
    totalLikes: number;
    engagementRate: number;
  };
  
  // Services offered
  services: Array<{
    _id?: mongoose.Types.ObjectId;
    name: string;
    category: string;
    subcategory?: string;
    description: string;
    duration: number; // in minutes
    price: {
      amount: number;
      currency: string;
      type: 'fixed' | 'hourly' | 'custom';
      discounts?: Array<{
        type: 'bulk' | 'seasonal' | 'loyalty' | 'first_time';
        percentage: number;
        minQuantity?: number;
        validFrom?: Date;
        validTo?: Date;
      }>;
    };
    images: string[];
    isActive: boolean;
    isPopular: boolean;
    tags: string[];
    requirements?: string[];
    includedItems?: string[];
    addOns?: Array<{
      name: string;
      price: number;
      description?: string;
    }>;
    createdAt: Date;
    updatedAt: Date;
  }>;
  
  // Portfolio/Gallery
  portfolio: {
    featured: Array<{
      _id?: mongoose.Types.ObjectId;
      title: string;
      description?: string;
      category: string;
      images: Array<{
        url: string;
        caption?: string;
        beforeAfter?: {
          before: string;
          after: string;
        };
      }>;
      tags: string[];
      clientTestimonial?: {
        text: string;
        clientName?: string;
        rating: number;
      };
      isVisible: boolean;
      createdAt: Date;
    }>;
    certifications: Array<{
      name: string;
      issuingOrganization: string;
      issueDate: Date;
      expiryDate?: Date;
      credentialId?: string;
      verificationUrl?: string;
      documentUrl?: string;
      isVerified: boolean;
    }>;
    awards: Array<{
      title: string;
      organization: string;
      year: number;
      description?: string;
      imageUrl?: string;
    }>;
  };
  
  // Availability management
  availability: {
    schedule: {
      [key: string]: {
        isAvailable: boolean;
        timeSlots: Array<{
          startTime: string;
          endTime: string;
          isBooked: boolean;
          maxBookings?: number;
          currentBookings: number;
        }>;
      };
    };
    exceptions: Array<{
      date: Date;
      type: 'unavailable' | 'custom_hours' | 'special_pricing';
      reason?: string;
      customHours?: {
        startTime: string;
        endTime: string;
      };
      specialPricing?: {
        multiplier: number;
        reason: string;
      };
    }>;
    bufferTime: number; // minutes between bookings
    maxAdvanceBooking: number; // days
    minNoticeTime: number; // hours
    autoAcceptBookings: boolean;
  };
  
  // Location and service areas
  locationInfo: {
    primaryAddress: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      coordinates: {
        lat: number;
        lng: number;
      };
    };
    serviceAreas: Array<{
      name: string;
      type: 'city' | 'zipcode' | 'radius';
      value: string | number;
      additionalFee?: number;
    }>;
    travelFee: {
      baseFee: number;
      perKmFee: number;
      maxTravelDistance: number;
    };
    mobileService: boolean;
    hasFixedLocation: boolean;
  };
  
  // Reviews and ratings
  reviewsData: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
    recentReviews: Array<{
      customerId: mongoose.Types.ObjectId;
      bookingId: mongoose.Types.ObjectId;
      rating: number;
      title?: string;
      comment: string;
      photos?: string[];
      isVerified: boolean;
      helpfulVotes: number;
      response?: {
        text: string;
        timestamp: Date;
      };
      createdAt: Date;
    }>;
    responseRate: number; // percentage of reviews responded to
    avgResponseTime: number; // hours
  };
  
  // Business analytics
  analytics: {
    profileViews: Array<{
      date: Date;
      views: number;
      uniqueViews: number;
    }>;
    bookingStats: {
      totalBookings: number;
      completedBookings: number;
      cancelledBookings: number;
      noShowBookings: number;
      averageBookingValue: number;
      repeatCustomerRate: number;
    };
    revenueStats: {
      totalEarnings: number;
      currentMonthEarnings: number;
      averageMonthlyEarnings: number;
      topEarningServices: Array<{
        serviceName: string;
        revenue: number;
        bookingCount: number;
      }>;
    };
    customerMetrics: {
      totalCustomers: number;
      repeatCustomers: number;
      customerRetentionRate: number;
      averageCustomerLifetimeValue: number;
    };
    performanceMetrics: {
      acceptanceRate: number;
      responseTime: number; // average in minutes
      completionRate: number;
      punctualityScore: number;
      qualityScore: number;
    };
  };
  
  // Marketing and promotion tools
  marketing: {
    promotions: Array<{
      _id?: mongoose.Types.ObjectId;
      title: string;
      description: string;
      discountType: 'percentage' | 'fixed_amount' | 'buy_one_get_one';
      discountValue: number;
      minimumSpend?: number;
      validFrom: Date;
      validTo: Date;
      usageLimit?: number;
      usedCount: number;
      applicableServices?: string[];
      isActive: boolean;
      createdAt: Date;
    }>;
    happyHours: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      discountPercentage: number;
      isActive: boolean;
    }>;
    packages: Array<{
      name: string;
      description: string;
      services: Array<{
        serviceId: mongoose.Types.ObjectId;
        quantity: number;
      }>;
      totalPrice: number;
      savings: number;
      validityDays: number;
      isActive: boolean;
    }>;
    referralProgram: {
      isActive: boolean;
      referrerReward: number;
      refereeReward: number;
      maxReferrals?: number;
    };
  };
  
  // Team management (for businesses with multiple staff)
  teamManagement: {
    teamMembers: Array<{
      _id?: mongoose.Types.ObjectId;
      name: string;
      role: string;
      email?: string;
      phone?: string;
      photo?: string;
      specializations: string[];
      isActive: boolean;
      joinedAt: Date;
      permissions: Array<{
        resource: string;
        actions: string[];
      }>;
    }>;
    departments: Array<{
      name: string;
      description?: string;
      memberIds: mongoose.Types.ObjectId[];
    }>;
  };
  
  // Financial information
  financials: {
    bankAccount: {
      accountHolderName?: string;
      accountNumber?: string; // encrypted
      routingNumber?: string; // encrypted
      bankName?: string;
      isVerified: boolean;
    };
    paymentMethods: {
      stripe?: {
        accountId: string;
        isConnected: boolean;
        capabilities: string[];
      };
      paypal?: {
        merchantId: string;
        isConnected: boolean;
      };
    };
    taxInfo: {
      taxId?: string; // encrypted
      businessLicense?: string;
      insurancePolicy?: {
        provider: string;
        policyNumber: string;
        expiryDate: Date;
        coverageAmount: number;
      };
    };
    payout: {
      frequency: 'daily' | 'weekly' | 'monthly';
      minimumAmount: number;
      lastPayoutDate?: Date;
      pendingAmount: number;
    };
  };
  
  // Verification status
  verificationStatus: {
    overall: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'suspended';
    identity: {
      status: 'pending' | 'approved' | 'rejected';
      submittedAt?: Date;
      reviewedAt?: Date;
      documents: Array<{
        type: 'id_front' | 'id_back' | 'selfie' | 'address_proof';
        url: string;
        status: 'pending' | 'approved' | 'rejected';
      }>;
    };
    business: {
      status: 'pending' | 'approved' | 'rejected';
      submittedAt?: Date;
      reviewedAt?: Date;
      documents: Array<{
        type: 'business_license' | 'tax_certificate' | 'insurance';
        url: string;
        status: 'pending' | 'approved' | 'rejected';
      }>;
    };
    background: {
      status: 'pending' | 'approved' | 'rejected';
      submittedAt?: Date;
      completedAt?: Date;
      provider: string;
    };
    adminNotes?: string;
  };
  
  // Settings and preferences
  settings: {
    autoAcceptBookings: boolean;
    instantBookingEnabled: boolean;
    requirePaymentUpfront: boolean;
    allowRescheduling: boolean;
    cancellationPolicy: {
      freeUntilHours: number;
      partialRefundUntilHours: number;
      noRefundAfterHours: number;
    };
    communicationPreferences: {
      bookingNotifications: boolean;
      reviewNotifications: boolean;
      marketingEmails: boolean;
      smsNotifications: boolean;
    };
    privacySettings: {
      showExactLocation: boolean;
      showPhoneNumber: boolean;
      showEmail: boolean;
    };
  };
  
  // Audit fields
  isProfileComplete: boolean;
  completionPercentage: number;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  isDeleted: boolean;
}

const providerProfileSchema = new Schema<IProviderProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    // Provider Tier Level - used for display badges and sorting
    tier: {
      type: String,
      enum: ['elite', 'premium', 'standard'],
      default: 'standard',
      index: true
    },

    businessInfo: {
      businessName: { 
        type: String, 
        required: true,
        maxlength: 100
      },
      businessType: {
        type: String,
        enum: ['individual', 'small_business', 'company', 'franchise'],
        default: 'individual'
      },
      description: { 
        type: String, 
        required: true,
        maxlength: 1000
      },
      tagline: { type: String, maxlength: 100 },
      businessRegistrationNumber: String,
      taxId: String, // Should be encrypted in production
      website: {
        type: String,
        validate: {
          validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
          message: 'Website must be a valid URL'
        }
      },
      establishedDate: Date,
      businessHours: {
        monday: { isOpen: Boolean, openTime: String, closeTime: String, breakStart: String, breakEnd: String },
        tuesday: { isOpen: Boolean, openTime: String, closeTime: String, breakStart: String, breakEnd: String },
        wednesday: { isOpen: Boolean, openTime: String, closeTime: String, breakStart: String, breakEnd: String },
        thursday: { isOpen: Boolean, openTime: String, closeTime: String, breakStart: String, breakEnd: String },
        friday: { isOpen: Boolean, openTime: String, closeTime: String, breakStart: String, breakEnd: String },
        saturday: { isOpen: Boolean, openTime: String, closeTime: String, breakStart: String, breakEnd: String },
        sunday: { isOpen: Boolean, openTime: String, closeTime: String, breakStart: String, breakEnd: String }
      },
      serviceRadius: { type: Number, default: 25, min: 1, max: 100 },
      instantBooking: { type: Boolean, default: false },
      advanceBookingDays: { type: Number, default: 30, min: 1, max: 365 }
    },
    
    instagramStyleProfile: {
      profilePhoto: {
        type: String,
        required: true,
        validate: {
          validator: (v: string) => /^https?:\/\/.+/.test(v),
          message: 'Profile photo must be a valid URL'
        }
      },
      coverPhoto: String,
      isVerified: { type: Boolean, default: false },
      verificationBadges: [{
        type: {
          type: String,
          enum: ['identity', 'business', 'insurance', 'certification', 'background_check'],
          required: true
        },
        verifiedAt: { type: Date, default: Date.now },
        expiresAt: Date,
        verifier: String,
        documentUrl: String
      }],
      bio: { type: String, maxlength: 500 },
      highlights: [{
        title: { type: String, required: true, maxlength: 50 },
        coverImage: { type: String, required: true },
        stories: [{
          type: { type: String, enum: ['image', 'video'], required: true },
          url: { type: String, required: true },
          caption: String,
          timestamp: { type: Date, default: Date.now },
          views: { type: Number, default: 0 }
        }],
        createdAt: { type: Date, default: Date.now }
      }],
      posts: [{
        type: { type: String, enum: ['image', 'video', 'before_after', 'story'], required: true },
        media: [{
          url: { type: String, required: true },
          type: { type: String, enum: ['image', 'video'], required: true },
          caption: String,
          alt: String
        }],
        caption: { type: String, maxlength: 1000 },
        tags: [String],
        location: {
          name: String,
          coordinates: {
            lat: { type: Number, min: -90, max: 90 },
            lng: { type: Number, min: -180, max: 180 }
          }
        },
        likes: [{
          userId: { type: Schema.Types.ObjectId, ref: 'User' },
          timestamp: { type: Date, default: Date.now }
        }],
        comments: [{
          userId: { type: Schema.Types.ObjectId, ref: 'User' },
          text: { type: String, maxlength: 500 },
          timestamp: { type: Date, default: Date.now },
          replies: [{
            userId: { type: Schema.Types.ObjectId, ref: 'User' },
            text: { type: String, maxlength: 500 },
            timestamp: { type: Date, default: Date.now }
          }]
        }],
        shares: { type: Number, default: 0 },
        views: { type: Number, default: 0 },
        isSponsored: { type: Boolean, default: false },
        isPinned: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
      }],
      followersCount: { type: Number, default: 0, min: 0 },
      followingCount: { type: Number, default: 0, min: 0 },
      totalLikes: { type: Number, default: 0, min: 0 },
      engagementRate: { type: Number, default: 0, min: 0, max: 100 }
    },
    
    services: [{
      name: { type: String, required: true, maxlength: 100 },
      category: { type: String, required: true },
      subcategory: String,
      description: { type: String, required: true, maxlength: 500 },
      duration: { type: Number, required: true, min: 15, max: 480 },
      price: {
        amount: { type: Number, required: true, min: 0 },
        currency: { type: String, default: 'AED' },
        type: { type: String, enum: ['fixed', 'hourly', 'custom'], default: 'fixed' },
        discounts: [{
          type: { type: String, enum: ['bulk', 'seasonal', 'loyalty', 'first_time'] },
          percentage: { type: Number, min: 1, max: 100 },
          minQuantity: Number,
          validFrom: Date,
          validTo: Date
        }]
      },
      images: [String],
      isActive: { type: Boolean, default: true },
      isPopular: { type: Boolean, default: false },
      tags: [String],
      requirements: [String],
      includedItems: [String],
      addOns: [{
        name: String,
        price: { type: Number, min: 0 },
        description: String
      }],
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now }
    }],
    
    portfolio: {
      featured: [{
        title: { type: String, required: true, maxlength: 100 },
        description: { type: String, maxlength: 500 },
        category: { type: String, required: true },
        images: [{
          url: { type: String, required: true },
          caption: String,
          beforeAfter: {
            before: String,
            after: String
          }
        }],
        tags: [String],
        clientTestimonial: {
          text: String,
          clientName: String,
          rating: { type: Number, min: 1, max: 5 }
        },
        isVisible: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
      }],
      certifications: [{
        name: { type: String, required: true },
        issuingOrganization: { type: String, required: true },
        issueDate: { type: Date, required: true },
        expiryDate: Date,
        credentialId: String,
        verificationUrl: String,
        documentUrl: String,
        isVerified: { type: Boolean, default: false }
      }],
      awards: [{
        title: { type: String, required: true },
        organization: { type: String, required: true },
        year: { type: Number, required: true },
        description: String,
        imageUrl: String
      }]
    },
    
    availability: {
      schedule: {
        monday: {
          isAvailable: { type: Boolean, default: true },
          timeSlots: [{
            startTime: String,
            endTime: String,
            isBooked: { type: Boolean, default: false },
            maxBookings: { type: Number, default: 1 },
            currentBookings: { type: Number, default: 0 }
          }]
        },
        tuesday: {
          isAvailable: { type: Boolean, default: true },
          timeSlots: [{
            startTime: String,
            endTime: String,
            isBooked: { type: Boolean, default: false },
            maxBookings: { type: Number, default: 1 },
            currentBookings: { type: Number, default: 0 }
          }]
        },
        wednesday: {
          isAvailable: { type: Boolean, default: true },
          timeSlots: [{
            startTime: String,
            endTime: String,
            isBooked: { type: Boolean, default: false },
            maxBookings: { type: Number, default: 1 },
            currentBookings: { type: Number, default: 0 }
          }]
        },
        thursday: {
          isAvailable: { type: Boolean, default: true },
          timeSlots: [{
            startTime: String,
            endTime: String,
            isBooked: { type: Boolean, default: false },
            maxBookings: { type: Number, default: 1 },
            currentBookings: { type: Number, default: 0 }
          }]
        },
        friday: {
          isAvailable: { type: Boolean, default: true },
          timeSlots: [{
            startTime: String,
            endTime: String,
            isBooked: { type: Boolean, default: false },
            maxBookings: { type: Number, default: 1 },
            currentBookings: { type: Number, default: 0 }
          }]
        },
        saturday: {
          isAvailable: { type: Boolean, default: true },
          timeSlots: [{
            startTime: String,
            endTime: String,
            isBooked: { type: Boolean, default: false },
            maxBookings: { type: Number, default: 1 },
            currentBookings: { type: Number, default: 0 }
          }]
        },
        sunday: {
          isAvailable: { type: Boolean, default: false },
          timeSlots: [{
            startTime: String,
            endTime: String,
            isBooked: { type: Boolean, default: false },
            maxBookings: { type: Number, default: 1 },
            currentBookings: { type: Number, default: 0 }
          }]
        }
      },
      exceptions: [{
        date: { type: Date, required: true },
        type: { type: String, enum: ['unavailable', 'custom_hours', 'special_pricing'], required: true },
        reason: String,
        customHours: {
          startTime: String,
          endTime: String
        },
        specialPricing: {
          multiplier: { type: Number, min: 0.1, max: 10 },
          reason: String
        }
      }],
      bufferTime: { type: Number, default: 15, min: 0, max: 120 },
      maxAdvanceBooking: { type: Number, default: 30, min: 1, max: 365 },
      minNoticeTime: { type: Number, default: 24, min: 1, max: 168 },
      autoAcceptBookings: { type: Boolean, default: false }
    },
    
    locationInfo: {
      primaryAddress: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        country: { type: String, default: 'AE' },
        coordinates: {
          lat: { type: Number, required: true, min: -90, max: 90 },
          lng: { type: Number, required: true, min: -180, max: 180 }
        }
      },
      serviceAreas: [{
        name: { type: String, required: true },
        type: { type: String, enum: ['city', 'zipcode', 'radius'], required: true },
        value: Schema.Types.Mixed, // string for city/zipcode, number for radius
        additionalFee: { type: Number, default: 0, min: 0 }
      }],
      travelFee: {
        baseFee: { type: Number, default: 0, min: 0 },
        perKmFee: { type: Number, default: 0, min: 0 },
        maxTravelDistance: { type: Number, default: 25, min: 1, max: 100 }
      },
      mobileService: { type: Boolean, default: true },
      hasFixedLocation: { type: Boolean, default: false }
    },
    
    reviewsData: {
      averageRating: { type: Number, default: 0, min: 0, max: 5 },
      totalReviews: { type: Number, default: 0, min: 0 },
      ratingDistribution: {
        5: { type: Number, default: 0 },
        4: { type: Number, default: 0 },
        3: { type: Number, default: 0 },
        2: { type: Number, default: 0 },
        1: { type: Number, default: 0 }
      },
      recentReviews: [{
        customerId: { type: Schema.Types.ObjectId, ref: 'User' },
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
        rating: { type: Number, required: true, min: 1, max: 5 },
        title: String,
        comment: { type: String, required: true },
        photos: [String],
        isVerified: { type: Boolean, default: false },
        helpfulVotes: { type: Number, default: 0 },
        response: {
          text: String,
          timestamp: Date
        },
        createdAt: { type: Date, default: Date.now }
      }],
      responseRate: { type: Number, default: 0, min: 0, max: 100 },
      avgResponseTime: { type: Number, default: 0, min: 0 }
    },
    
    analytics: {
      profileViews: [{
        date: { type: Date, required: true },
        views: { type: Number, default: 0 },
        uniqueViews: { type: Number, default: 0 }
      }],
      bookingStats: {
        totalBookings: { type: Number, default: 0 },
        completedBookings: { type: Number, default: 0 },
        cancelledBookings: { type: Number, default: 0 },
        noShowBookings: { type: Number, default: 0 },
        averageBookingValue: { type: Number, default: 0 },
        repeatCustomerRate: { type: Number, default: 0 }
      },
      revenueStats: {
        totalEarnings: { type: Number, default: 0 },
        currentMonthEarnings: { type: Number, default: 0 },
        averageMonthlyEarnings: { type: Number, default: 0 },
        topEarningServices: [{
          serviceName: String,
          revenue: { type: Number, default: 0 },
          bookingCount: { type: Number, default: 0 }
        }]
      },
      customerMetrics: {
        totalCustomers: { type: Number, default: 0 },
        repeatCustomers: { type: Number, default: 0 },
        customerRetentionRate: { type: Number, default: 0 },
        averageCustomerLifetimeValue: { type: Number, default: 0 }
      },
      performanceMetrics: {
        acceptanceRate: { type: Number, default: 0, min: 0, max: 100 },
        responseTime: { type: Number, default: 0 },
        completionRate: { type: Number, default: 0, min: 0, max: 100 },
        punctualityScore: { type: Number, default: 0, min: 0, max: 100 },
        qualityScore: { type: Number, default: 0, min: 0, max: 100 }
      }
    },
    
    marketing: {
      promotions: [{
        title: { type: String, required: true },
        description: { type: String, required: true },
        discountType: { type: String, enum: ['percentage', 'fixed_amount', 'buy_one_get_one'], required: true },
        discountValue: { type: Number, required: true, min: 0 },
        minimumSpend: { type: Number, min: 0 },
        validFrom: { type: Date, required: true },
        validTo: { type: Date, required: true },
        usageLimit: { type: Number, min: 1 },
        usedCount: { type: Number, default: 0 },
        applicableServices: [String],
        isActive: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now }
      }],
      happyHours: [{
        dayOfWeek: { type: Number, min: 0, max: 6 },
        startTime: String,
        endTime: String,
        discountPercentage: { type: Number, min: 1, max: 100 },
        isActive: { type: Boolean, default: true }
      }],
      packages: [{
        name: { type: String, required: true },
        description: { type: String, required: true },
        services: [{
          serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
          quantity: { type: Number, min: 1 }
        }],
        totalPrice: { type: Number, required: true, min: 0 },
        savings: { type: Number, min: 0 },
        validityDays: { type: Number, min: 1, max: 365 },
        isActive: { type: Boolean, default: true }
      }],
      referralProgram: {
        isActive: { type: Boolean, default: false },
        referrerReward: { type: Number, default: 0 },
        refereeReward: { type: Number, default: 0 },
        maxReferrals: Number
      }
    },
    
    teamManagement: {
      teamMembers: [{
        name: { type: String, required: true },
        role: { type: String, required: true },
        email: String,
        phone: String,
        photo: String,
        specializations: [String],
        isActive: { type: Boolean, default: true },
        joinedAt: { type: Date, default: Date.now },
        permissions: [{
          resource: String,
          actions: [String]
        }]
      }],
      departments: [{
        name: { type: String, required: true },
        description: String,
        memberIds: [{ type: Schema.Types.ObjectId }]
      }]
    },
    
    financials: {
      bankAccount: {
        accountHolderName: String,
        accountNumber: String, // Should be encrypted
        routingNumber: String, // Should be encrypted
        bankName: String,
        isVerified: { type: Boolean, default: false }
      },
      paymentMethods: {
        stripe: {
          accountId: String,
          isConnected: { type: Boolean, default: false },
          capabilities: [String]
        },
        paypal: {
          merchantId: String,
          isConnected: { type: Boolean, default: false }
        }
      },
      taxInfo: {
        taxId: String, // Should be encrypted
        businessLicense: String,
        insurancePolicy: {
          provider: String,
          policyNumber: String,
          expiryDate: Date,
          coverageAmount: Number
        }
      },
      payout: {
        frequency: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' },
        minimumAmount: { type: Number, default: 50, min: 10 },
        lastPayoutDate: Date,
        pendingAmount: { type: Number, default: 0, min: 0 }
      }
    },
    
    verificationStatus: {
      overall: {
        type: String,
        enum: ['pending', 'in_progress', 'approved', 'rejected', 'suspended'],
        default: 'pending'
      },
      identity: {
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        submittedAt: Date,
        reviewedAt: Date,
        documents: [{
          type: { type: String, enum: ['id_front', 'id_back', 'selfie', 'address_proof'] },
          url: String,
          status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
        }]
      },
      business: {
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        submittedAt: Date,
        reviewedAt: Date,
        documents: [{
          type: { type: String, enum: ['business_license', 'tax_certificate', 'insurance'] },
          url: String,
          status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
        }]
      },
      background: {
        status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
        submittedAt: Date,
        completedAt: Date,
        provider: String
      },
      adminNotes: String
    },
    
    settings: {
      autoAcceptBookings: { type: Boolean, default: false },
      instantBookingEnabled: { type: Boolean, default: false },
      requirePaymentUpfront: { type: Boolean, default: false },
      allowRescheduling: { type: Boolean, default: true },
      cancellationPolicy: {
        freeUntilHours: { type: Number, default: 24, min: 1 },
        partialRefundUntilHours: { type: Number, default: 12, min: 1 },
        noRefundAfterHours: { type: Number, default: 2, min: 0 }
      },
      communicationPreferences: {
        bookingNotifications: { type: Boolean, default: true },
        reviewNotifications: { type: Boolean, default: true },
        marketingEmails: { type: Boolean, default: false },
        smsNotifications: { type: Boolean, default: true }
      },
      privacySettings: {
        showExactLocation: { type: Boolean, default: false },
        showPhoneNumber: { type: Boolean, default: true },
        showEmail: { type: Boolean, default: false }
      }
    },
    
    isProfileComplete: { type: Boolean, default: false },
    completionPercentage: { type: Number, default: 0, min: 0, max: 100 },
    lastActiveAt: Date,
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Comprehensive Indexes for Performance
providerProfileSchema.index({ userId: 1 });
providerProfileSchema.index({ 'locationInfo.primaryAddress.coordinates': '2dsphere' });
providerProfileSchema.index({ 'services.category': 1 });
providerProfileSchema.index({ 'services.isActive': 1 });
providerProfileSchema.index({ 'reviewsData.averageRating': -1 });
providerProfileSchema.index({ 'reviewsData.totalReviews': -1 });
providerProfileSchema.index({ 'verificationStatus.overall': 1 });
providerProfileSchema.index({ 'instagramStyleProfile.isVerified': 1 });
providerProfileSchema.index({ 'businessInfo.serviceRadius': 1 });
providerProfileSchema.index({ isActive: 1, isDeleted: 1 });
providerProfileSchema.index({ completionPercentage: -1 });
providerProfileSchema.index({ 'analytics.performanceMetrics.qualityScore': -1 });
providerProfileSchema.index({ 'instagramStyleProfile.followersCount': -1 });
providerProfileSchema.index({ lastActiveAt: -1 });

// Virtual for overall score combining ratings, verification, and activity
providerProfileSchema.virtual('overallScore').get(function() {
  const ratingScore = (this.reviewsData.averageRating / 5) * 40;
  const verificationScore = this.instagramStyleProfile.isVerified ? 30 : 0;
  const activityScore = (this.completionPercentage / 100) * 30;
  return Math.round(ratingScore + verificationScore + activityScore);
});

// Virtual for service count
providerProfileSchema.virtual('activeServicesCount').get(function() {
  return this.services.filter((service: any) => service.isActive).length;
});

// Virtual for completion rate
providerProfileSchema.virtual('bookingCompletionRate').get(function() {
  const stats = this.analytics.bookingStats;
  if (stats.totalBookings === 0) return 0;
  return Math.round((stats.completedBookings / stats.totalBookings) * 100);
});

// Pre-save middleware to calculate completion percentage
providerProfileSchema.pre('save', function(next) {
  // Basic business info (30%)
  const requiredBusinessFields = ['businessName', 'description'];
  const businessScore = requiredBusinessFields.filter(field => 
    this.businessInfo[field as keyof typeof this.businessInfo] !== undefined &&
    this.businessInfo[field as keyof typeof this.businessInfo] !== ''
  ).length / requiredBusinessFields.length;
  
  // Profile completeness (25%)
  const profileScore = (
    (this.instagramStyleProfile.profilePhoto ? 1 : 0) +
    (this.instagramStyleProfile.bio ? 1 : 0) +
    (this.instagramStyleProfile.posts.length > 0 ? 1 : 0)
  ) / 3;
  
  // Services (25%)
  const servicesScore = this.services.filter(s => s.isActive).length > 0 ? 1 : 0;
  
  // Location info (10%)
  const locationScore = this.locationInfo.primaryAddress ? 1 : 0;
  
  // Verification (10%)
  const verificationScore = this.verificationStatus.overall === 'approved' ? 1 : 0;
  
  this.completionPercentage = Math.round(
    (businessScore * 30) +
    (profileScore * 25) +
    (servicesScore * 25) +
    (locationScore * 10) +
    (verificationScore * 10)
  );
  
  this.isProfileComplete = this.completionPercentage >= 80;
  
  next();
});

// Static methods
providerProfileSchema.statics.findByUserId = function(userId: string) {
  return this.findOne({ userId, isActive: true, isDeleted: false });
};

providerProfileSchema.statics.findVerifiedProviders = function() {
  return this.find({
    'verificationStatus.overall': 'approved',
    isActive: true,
    isDeleted: false
  });
};

providerProfileSchema.statics.findInServiceArea = function(lat: number, lng: number, maxDistance: number) {
  return this.find({
    'locationInfo.primaryAddress.coordinates': {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxDistance * 1000
      }
    },
    'verificationStatus.overall': 'approved',
    isActive: true,
    isDeleted: false
  });
};

const ProviderProfile: Model<IProviderProfile> = mongoose.model<IProviderProfile>('ProviderProfile', providerProfileSchema);

export default ProviderProfile;