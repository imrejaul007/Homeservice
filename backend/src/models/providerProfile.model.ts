import mongoose, { Document, Schema, Model, ClientSession } from 'mongoose';
import { sanitizeProviderGeo } from '../utils/sanitizeProviderGeo';
import logger from '../utils/logger';

export interface IProviderProfile extends Document {
  // Multi-tenant support
  tenantId?: mongoose.Types.ObjectId;

  userId: mongoose.Types.ObjectId;

  // Optional media fields used by stock photo detection
  portfolioImages?: string[];
  profileImages?: string[];
  coverImage?: string;

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
          type: 'Point';
          coordinates: [number, number]; // [longitude, latitude]
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
        _id?: mongoose.Types.ObjectId;  // Add _id for image identification
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
    // FIX: Issue #2 - Per-Service Availability
    // Optional per-service schedules that override the global schedule
    serviceSchedules?: {
      [serviceId: string]: {
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
    };
    exceptions: Array<{
      _id?: mongoose.Types.ObjectId; // FIX: Issue #5 - Add unique ID for reliable removal
      date: Date;
      type: 'unavailable' | 'custom_hours' | 'special_pricing';
      reason?: string;
      notes?: string;
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
        type: 'Point';
        coordinates: [number, number]; // [longitude, latitude]
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
      _id: mongoose.Types.ObjectId;
      customerId: mongoose.Types.ObjectId;
      bookingId: mongoose.Types.ObjectId;
      serviceId?: mongoose.Types.ObjectId;
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
    profileViewSessions?: Array<{
      date: Date;
      sessionIds: string[];
    }>;
    listingImpressionSessions?: Array<{
      date: Date;
      sessionIds: string[];
    }>;
    listingImpressions?: Array<{
      date: Date;
      impressions: number;
      uniqueImpressions?: number;
    }>;
    providerMetricsDaily?: Array<{
      date: Date;
      bookingsCreated: number;
      bookingsCompleted: number;
      revenue: number;
      bySource: Record<string, { count: number; revenue: number }>;
      impressions?: number;
      uniqueImpressions?: number;
      funnelStages?: {
        impressions: number;
        uniqueImpressions: number;
        profileViews: number;
        uniqueProfileViews: number;
        bookingRequests: number;
        confirmed: number;
        completed: number;
      };
      byCity?: Array<{ city: string; bookings: number; revenue: number }>;
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
    overall: 'pending' | 'in_progress' | 'approved' | 'verified' | 'rejected' | 'suspended';
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
    reviewDisplaySettings?: {
      showPendingOnReviewsPage: boolean;
    };
    insightPreferences?: {
      dismissed: string[];
      read: string[];
      updatedAt?: Date;
    };
    analyticsPreferences?: {
      emailReports?: boolean;
      emailReportsFrequency?: 'weekly' | 'monthly';
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

// Static methods interface
export interface IProviderProfileModel extends Model<IProviderProfile> {
  findByUserId(userId: string): Promise<IProviderProfile | null>;
  findVerifiedProviders(): Promise<IProviderProfile[]>;
  findInServiceArea(lat: number, lng: number, maxDistance: number): Promise<IProviderProfile[]>;
  recalculateBookingStats(userId: string | mongoose.Types.ObjectId): Promise<void>;
  recalculateRevenueStats(userId: string | mongoose.Types.ObjectId): Promise<void>;
  recalculateReviewsData(userId: string | mongoose.Types.ObjectId, tenantId?: mongoose.Types.ObjectId): Promise<void>;
  recalculateAllAnalytics(userId: string | mongoose.Types.ObjectId): Promise<void>;
}

const providerProfileSchema = new Schema<IProviderProfile>(
  {
    // Multi-tenant support
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

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
        default: 'individual',
        index: true
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
            type: { type: String, enum: ['Point'], default: 'Point' },
            coordinates: { type: [Number], required: true } // [longitude, latitude]
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
          _id: { type: Schema.Types.ObjectId, auto: true },
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
      // FIX: Issue #2 - Per-Service Availability
      // Optional per-service schedules that override the global schedule
      serviceSchedules: {
        type: Map,
        of: {
          monday: {
            isAvailable: { type: Boolean, default: false },
            timeSlots: [{
              startTime: String,
              endTime: String,
              isBooked: { type: Boolean, default: false },
              maxBookings: { type: Number, default: 1 },
              currentBookings: { type: Number, default: 0 }
            }]
          },
          tuesday: {
            isAvailable: { type: Boolean, default: false },
            timeSlots: [{
              startTime: String,
              endTime: String,
              isBooked: { type: Boolean, default: false },
              maxBookings: { type: Number, default: 1 },
              currentBookings: { type: Number, default: 0 }
            }]
          },
          wednesday: {
            isAvailable: { type: Boolean, default: false },
            timeSlots: [{
              startTime: String,
              endTime: String,
              isBooked: { type: Boolean, default: false },
              maxBookings: { type: Number, default: 1 },
              currentBookings: { type: Number, default: 0 }
            }]
          },
          thursday: {
            isAvailable: { type: Boolean, default: false },
            timeSlots: [{
              startTime: String,
              endTime: String,
              isBooked: { type: Boolean, default: false },
              maxBookings: { type: Number, default: 1 },
              currentBookings: { type: Number, default: 0 }
            }]
          },
          friday: {
            isAvailable: { type: Boolean, default: false },
            timeSlots: [{
              startTime: String,
              endTime: String,
              isBooked: { type: Boolean, default: false },
              maxBookings: { type: Number, default: 1 },
              currentBookings: { type: Number, default: 0 }
            }]
          },
          saturday: {
            isAvailable: { type: Boolean, default: false },
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
        default: undefined
      },
      exceptions: [{
        _id: { type: Schema.Types.ObjectId, auto: true }, // FIX: Issue #5 - Unique ID for reliable removal
        date: { type: Date, required: true },
        type: { type: String, enum: ['unavailable', 'custom_hours', 'special_pricing'], required: true },
        reason: String,
        notes: String,
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
          type: { type: String, enum: ['Point'], default: 'Point' },
          coordinates: { type: [Number], required: true } // [longitude, latitude]
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
      // FIX: Limit recentReviews array to prevent unbounded document growth
      // Only store the 20 most recent reviews for quick access
      // NOTE: The limit is enforced in the recalculateReviewsData method
      recentReviews: [{
        customerId: { type: Schema.Types.ObjectId, ref: 'User' },
        bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
        serviceId: { type: Schema.Types.ObjectId, ref: 'Service' },
        rating: { type: Number, required: true, min: 1, max: 5 },
        title: String,
        comment: { type: String, required: true },
        photos: [String],
        isVerified: { type: Boolean, default: false },
        helpfulVotes: { type: Number, default: 0 },
        response: {
          content: String,
          createdAt: Date
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
      profileViewSessions: [{
        date: { type: Date, required: true },
        sessionIds: [{ type: String }]
      }],
      listingImpressionSessions: [{
        date: { type: Date, required: true },
        sessionIds: [{ type: String }]
      }],
      listingImpressions: [{
        date: { type: Date, required: true },
        impressions: { type: Number, default: 0 },
        uniqueImpressions: { type: Number, default: 0 }
      }],
      providerMetricsDaily: [{
        date: { type: Date, required: true },
        bookingsCreated: { type: Number, default: 0 },
        bookingsCompleted: { type: Number, default: 0 },
        revenue: { type: Number, default: 0 },
        bySource: { type: Schema.Types.Mixed, default: {} },
        impressions: { type: Number, default: 0 },
        uniqueImpressions: { type: Number, default: 0 },
        funnelStages: { type: Schema.Types.Mixed, default: {} },
        byCity: [{ city: String, bookings: Number, revenue: Number }],
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
        enum: ['pending', 'in_progress', 'approved', 'verified', 'rejected', 'suspended'],
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
      },
      reviewDisplaySettings: {
        showPendingOnReviewsPage: { type: Boolean, default: true }
      },
      insightPreferences: {
        dismissed: { type: [String], default: [] },
        read: { type: [String], default: [] },
        updatedAt: { type: Date }
      },
      analyticsPreferences: {
        emailReports: { type: Boolean, default: false },
        emailReportsFrequency: { type: String, enum: ['weekly', 'monthly'], default: 'weekly' }
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

// Comprehensive Indexes for Performance (userId already has index from unique: true)
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

// Tenant isolation indexes
providerProfileSchema.index({ tenantId: 1, 'verificationStatus.overall': 1 });
providerProfileSchema.index({ tenantId: 1, isActive: 1 });
providerProfileSchema.index({ tenantId: 1, 'services.isActive': 1 });
providerProfileSchema.index({ tenantId: 1, isActive: 1, 'verificationStatus.overall': 1 });

// FIX: Add index for booking analytics queries (completed bookings by date)
providerProfileSchema.index({ 'analytics.bookingStats.completedBookings': 1 });

// FIX: Add index for revenue analytics queries
providerProfileSchema.index({ 'analytics.revenueStats.totalEarnings': -1 });

// FIX: Add index for profile views analytics
providerProfileSchema.index({ 'analytics.profileViews.date': 1 });

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

// Sanitize invalid GeoJSON before 2dsphere index validation
providerProfileSchema.pre('save', function(next) {
  try {
    sanitizeProviderGeo(this);
  } catch (err) {
    return next(err as Error);
  }
  next();
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

// ===================================
// CASCADE DELETE HOOKS (CRITICAL)
// ===================================
// Clean up related documents when a provider profile is deleted

/**
 * Helper function to perform cascade cleanup when a provider profile is deleted
 * CRITICAL: Prevents orphan records across all related collections
 * NOTE: Financial records (Settlement, Payout, Commission) are intentionally NOT deleted
 * for compliance and audit trail purposes
 */
async function performProviderProfileCascadeDelete(providerProfileId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId): Promise<void> {
  const session: ClientSession = await mongoose.startSession();
  try {
    session.startTransaction();

    const Service = mongoose.model('Service');
    const Availability = mongoose.model('Availability');
    const Booking = mongoose.model('Booking');
    const ProviderVerification = mongoose.model('ProviderVerification');

    // Clean up services created by this provider (soft delete)
    await Service.updateMany(
      { providerId: userId },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
        }
      },
      { session }
    );

    // Clean up availability records for this provider
    await Availability.deleteMany({ providerId: userId }, { session });

    // FIX: Soft delete bookings for this provider (maintain audit trail)
    await Booking.updateMany(
      { providerId: userId },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
        }
      },
      { session }
    );

    // CRITICAL: Clean up provider verification records
    await ProviderVerification.deleteMany({ providerId: userId }, { session });

    await session.commitTransaction();

    logger.info('Cascade delete completed for provider profile', {
      context: 'ProviderProfileModel',
      action: 'CASCADE_DELETE',
      providerProfileId: providerProfileId.toString(),
      userId: userId.toString(),
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Cascade delete failed for provider profile', {
      context: 'ProviderProfileModel',
      action: 'CASCADE_DELETE_ERROR',
      providerProfileId: providerProfileId.toString(),
      userId: userId.toString(),
      error: (error as Error).message,
    });
    throw error;
  } finally {
    if (!session.hasEnded) {
      await session.endSession();
    }
  }
}

/**
 * FIX: Add method to limit profile views array to prevent unbounded document growth
 * Keeps the 90 most recent daily view records (approx 3 months)
 */
providerProfileSchema.methods.cleanupOldProfileViews = async function(): Promise<number> {
  const MAX_PROFILE_VIEWS = 90;

  if (!this.analytics.profileViews || this.analytics.profileViews.length <= MAX_PROFILE_VIEWS) {
    return 0;
  }

  // Sort by date descending and keep only the most recent
  const sortedViews = [...this.analytics.profileViews].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const viewsToKeep = sortedViews.slice(0, MAX_PROFILE_VIEWS);
  const removedCount = this.analytics.profileViews.length - viewsToKeep.length;

  this.analytics.profileViews = viewsToKeep;
  await this.save({ validateBeforeSave: false });

  return removedCount;
};

// Hook for soft delete (when isDeleted is set to true via findOneAndUpdate)
providerProfileSchema.pre('findOneAndUpdate', async function() {
  const update = this.getUpdate() as any;
  if (update && update.isDeleted === true) {
    const doc = await this.model.findOne(this.getQuery()).lean() as (mongoose.Document & { _id: mongoose.Types.ObjectId; userId: mongoose.Types.ObjectId; isDeleted?: boolean }) | null;
    if (doc && !doc.isDeleted) {
      // Provider profile is being soft-deleted, trigger cascade
      await performProviderProfileCascadeDelete(doc._id, doc.userId);
    }
  }
});

// Hook for direct deleteOne operations
providerProfileSchema.pre('deleteOne', { document: true, query: false }, async function() {
  const providerProfileId = this._id;
  const userId = (this as any).userId;
  await performProviderProfileCascadeDelete(providerProfileId, userId);
});

const ProviderProfile = mongoose.model<IProviderProfile, IProviderProfileModel>('ProviderProfile', providerProfileSchema) as IProviderProfileModel;

// ===================================
// ANALYTICS UPDATE METHODS
// ===================================

/**
 * FIX: Recalculate and update denormalized booking stats from actual Booking documents.
 * Call this after booking status changes (completed, cancelled, etc.)
 * Uses atomic aggregation to prevent race conditions
 */
ProviderProfile.recalculateBookingStats = async function(userId: string | mongoose.Types.ObjectId): Promise<void> {
  const Booking = mongoose.model('Booking');
  const userIdObj = new mongoose.Types.ObjectId(userId.toString());

  // FIX: Use aggregation pipeline for atomic calculation
  const [bookingStats, completedStats] = await Promise.all([
    // Get counts by status in single query
    Booking.aggregate([
      { $match: { providerId: userIdObj } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]),
    // Get completed booking stats (average value, customer metrics)
    Booking.aggregate([
      { $match: { providerId: userIdObj, status: 'completed' } },
      {
        $group: {
          _id: null,
          avgValue: { $avg: '$pricing.totalAmount' },
          totalRevenue: { $sum: '$pricing.totalAmount' },
          uniqueCustomers: { $addToSet: '$customerId' }
        }
      }
    ])
  ]);

  // Process booking counts
  const statusCounts = new Map(bookingStats.map(s => [s._id, s.count]));
  const totalBookings = Array.from(statusCounts.values()).reduce((a, b) => a + b, 0);
  const completedBookings = statusCounts.get('completed') || 0;
  const cancelledBookings = statusCounts.get('cancelled') || 0;
  const noShowBookings = statusCounts.get('no_show') || 0;

  // Process completed stats
  const completedData = completedStats[0] || { avgValue: 0, totalRevenue: 0, uniqueCustomers: [] };
  const averageBookingValue = completedData.avgValue || 0;
  const uniqueCustomersCount = completedData.uniqueCustomers?.filter(Boolean).length || 0;

  // Calculate repeat customer rate (customers with more than 1 booking)
  const repeatCustomersAgg = await Booking.aggregate([
    { $match: { providerId: userIdObj, status: 'completed', customerId: { $exists: true, $ne: null } } },
    { $group: { _id: '$customerId', bookingCount: { $sum: 1 } } },
    { $match: { bookingCount: { $gt: 1 } } }
  ]);
  const repeatCustomerRate = uniqueCustomersCount > 0
    ? (repeatCustomersAgg.length / uniqueCustomersCount) * 100
    : 0;

  // FIX: Use findOneAndUpdate with aggregation result for atomic update
  await this.findOneAndUpdate(
    { userId },
    {
      $set: {
        'analytics.bookingStats.totalBookings': totalBookings,
        'analytics.bookingStats.completedBookings': completedBookings,
        'analytics.bookingStats.cancelledBookings': cancelledBookings,
        'analytics.bookingStats.noShowBookings': noShowBookings,
        'analytics.bookingStats.averageBookingValue': Math.round(averageBookingValue * 100) / 100,
        'analytics.bookingStats.repeatCustomerRate': Math.round(repeatCustomerRate * 100) / 100,
        'analytics.revenueStats.totalEarnings': Math.round((completedData.totalRevenue || 0) * 100) / 100,
        'analytics.customerMetrics.totalCustomers': uniqueCustomersCount,
        'analytics.customerMetrics.repeatCustomers': repeatCustomersAgg.length,
        'analytics.customerMetrics.customerRetentionRate': Math.round(repeatCustomerRate * 100) / 100
      }
    }
  );
};

/**
 * Recalculate and update denormalized revenue stats from actual bookings.
 * Call this after settlements are generated or payouts are made.
 */
ProviderProfile.recalculateRevenueStats = async function(userId: string | mongoose.Types.ObjectId): Promise<void> {
  const Settlement = mongoose.model('Settlement');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // FIX: Count all completed settlements (both 'pending' and 'paid')
  // The wallet is credited immediately when booking completes, so earnings should reflect this
  // Only 'reversed' settlements should be excluded
  const totalEarningsAgg = await Settlement.aggregate([
    {
      $match: {
        providerId: new mongoose.Types.ObjectId(userId.toString()),
        status: { $in: ['pending', 'approved', 'paid'] }
      }
    },
    { $group: { _id: null, total: { $sum: '$netAmount' } } }
  ]);
  const totalEarnings = totalEarningsAgg[0]?.total || 0;

  // Current month earnings (include pending settlements)
  const monthEarningsAgg = await Settlement.aggregate([
    {
      $match: {
        providerId: new mongoose.Types.ObjectId(userId.toString()),
        status: { $in: ['pending', 'approved', 'paid'] },
        periodStart: { $gte: startOfMonth }
      }
    },
    { $group: { _id: null, total: { $sum: '$netAmount' } } }
  ]);
  const currentMonthEarnings = monthEarningsAgg[0]?.total || 0;

  // Calculate average monthly earnings from last 12 months
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  const monthlyEarnings = await Settlement.aggregate([
    {
      $match: {
        providerId: new mongoose.Types.ObjectId(userId.toString()),
        status: { $in: ['pending', 'approved', 'paid'] },
        periodStart: { $gte: twelveMonthsAgo }
      }
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
        total: { $sum: '$netAmount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const averageMonthlyEarnings = monthlyEarnings.length > 0
    ? monthlyEarnings.reduce((sum, m) => sum + m.total, 0) / monthlyEarnings.length
    : 0;

  await this.updateOne(
    { userId },
    {
      $set: {
        'analytics.revenueStats.totalEarnings': Math.round(totalEarnings * 100) / 100,
        'analytics.revenueStats.currentMonthEarnings': Math.round(currentMonthEarnings * 100) / 100,
        'analytics.revenueStats.averageMonthlyEarnings': Math.round(averageMonthlyEarnings * 100) / 100
      }
    }
  );
};

/**
 * Recalculate and update reviews data from actual Review documents.
 * Call this after reviews are created, updated, or deleted.
 * @param userId - The provider's user ID
 * @param tenantId - Optional tenant ID for multi-tenant isolation. If provided, only reviews from this tenant are counted.
 */
ProviderProfile.recalculateReviewsData = async function(userId: string | mongoose.Types.ObjectId, tenantId?: mongoose.Types.ObjectId): Promise<void> {
  const Review = mongoose.model('Review');

  // Match publicly visible reviews (same rules as storefront API)
  const matchConditions: Record<string, any> = {
    revieweeId: new mongoose.Types.ObjectId(userId.toString()),
    reviewerType: 'customer',
    isHidden: false,
    $or: [
      { moderationStatus: 'approved' },
      { moderationStatus: { $exists: false } },
    ],
    $nor: [{ reportCount: { $gte: 3 } }],
  };

  if (tenantId) {
    matchConditions.tenantId = tenantId;
  }

  const reviews = await Review.aggregate([
    {
      $match: matchConditions
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
        rating5: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
        rating4: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
        rating3: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
        rating2: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
        rating1: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
      }
    }
  ]);

  const stats = reviews[0] || {
    averageRating: 0,
    totalReviews: 0,
    rating5: 0,
    rating4: 0,
    rating3: 0,
    rating2: 0,
    rating1: 0
  };

  // Get recent reviews - limit to 20 max for pagination support
  // This prevents unbounded document growth from storing too many reviews
  const recentReviewQuery: Record<string, any> = {
    revieweeId: userId,
    reviewerType: 'customer',
    isHidden: false,
    $or: [
      { moderationStatus: 'approved' },
      { moderationStatus: { $exists: false } },
    ],
    $nor: [{ reportCount: { $gte: 3 } }],
  };

  if (tenantId) {
    recentReviewQuery.tenantId = tenantId;
  }

  const recentReviews = await Review.find(recentReviewQuery)
    .sort({ createdAt: -1 })
    .limit(20)
    .populate('reviewerId', 'firstName lastName avatar')
    .select('reviewerId bookingId rating title comment photos isVerified helpfulVotes response createdAt _id');

  await this.updateOne(
    { userId },
    {
      $set: {
        'reviewsData.averageRating': Math.round((stats.averageRating || 0) * 10) / 10,
        'reviewsData.totalReviews': stats.totalReviews,
        'reviewsData.ratingDistribution': {
          5: stats.rating5,
          4: stats.rating4,
          3: stats.rating3,
          2: stats.rating2,
          1: stats.rating1
        },
        'reviewsData.recentReviews': recentReviews.map(r => ({
          _id: r._id,
          customerId: r.reviewerId?._id || r.reviewerId,
          bookingId: r.bookingId,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          photos: r.photos,
          isVerified: r.isVerified,
          helpfulVotes: r.helpfulVotes,
          response: r.response,
          createdAt: r.createdAt
        }))
      }
    }
  );
};

/**
 * Recalculate all denormalized analytics for a provider.
 * Call this as a periodic job or after significant changes.
 */
ProviderProfile.recalculateAllAnalytics = async function(userId: string | mongoose.Types.ObjectId): Promise<void> {
  await this.recalculateBookingStats(userId);
  await this.recalculateRevenueStats(userId);
  await this.recalculateReviewsData(userId);
};

export default ProviderProfile;