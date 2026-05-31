import mongoose, { Document, Schema, Model, ClientSession } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import logger from '../utils/logger';

export type UserRole = 'customer' | 'provider' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'pending_verification' | 'deactivated';

export interface IUser extends Document {
  // Multi-tenant
  tenantId?: mongoose.Types.ObjectId;

  // Basic Info
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role: UserRole;

  // Admin Invite Tracking (Task #66)
  adminInviteAcceptedAt?: Date;
  invitedBy?: mongoose.Types.ObjectId;

  // Profile & Social Fields
  avatar?: string;
  bio?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  
  // Social Profile Fields
  socialProfiles: {
    followers: mongoose.Types.ObjectId[];
    following: mongoose.Types.ObjectId[];
    socialMediaLinks?: {
      instagram?: string;
      facebook?: string;
      twitter?: string;
      linkedin?: string;
      youtube?: string;
      tiktok?: string;
    };
    isPublicProfile: boolean;
    profileViews: number;
    lastActiveAt?: Date;
  };
  
  // Address
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    zipCode?: string;
    coordinates?: {
      type: 'Point';
      coordinates: [number, number]; // [longitude, latitude]
    };
  };
  
  // Loyalty System Fields
  loyaltySystem: {
    coins: number;
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    referralCode: string;
    referredBy?: mongoose.Types.ObjectId;
    streakDays: number;
    lastStreakDate?: Date;
    totalEarned: number;
    totalSpent: number;
    pointsHistory: Array<{
      amount: number;
      type: 'earned' | 'spent' | 'bonus' | 'referral';
      description: string;
      date: Date;
      expiresAt?: Date; // Points expire 24 months from earning
      relatedBooking?: mongoose.Types.ObjectId;
    }>;
    // Track processed job IDs to prevent duplicate awards (idempotency)
    processedJobIds: string[];
    // Track first booking bonus award status
    firstBookingAwarded: boolean;
    // FIX: Store pending rewards until first booking completion
    pendingRewards: Array<{
      type: 'welcome_bonus' | 'referral_bonus';
      amount: number;
      description?: string;
      status: 'pending' | 'awarded' | 'expired';
      referrerId?: mongoose.Types.ObjectId;
      createdAt: Date;
      awardedAt?: Date;
    }>;
  };
  
  // Communication Preferences
  communicationPreferences: {
    email: {
      marketing: boolean;
      bookingUpdates: boolean;
      reminders: boolean;
      newsletters: boolean;
      promotions: boolean;
    };
    sms: {
      bookingUpdates: boolean;
      reminders: boolean;
      promotions: boolean;
    };
    push: {
      bookingUpdates: boolean;
      reminders: boolean;
      newMessages: boolean;
      promotions: boolean;
    };
    telegram?: {
      enabled: boolean;
      linkedAt?: Date;
      optedOutAt?: Date;
      optedInAt?: Date;
    };
    whatsapp?: {
      enabled: boolean;
      linkedAt?: Date;
      optedOutAt?: Date;
      optedInAt?: Date;
    };
    quietHours: {
      enabled: boolean;
      startTime: string; // HH:mm format
      endTime: string;   // HH:mm format
      timezone: string;
    };
    language: string;
    timezone: string;
    currency: string;
  };
  
  // B2B Corporate Fields
  corporateInfo?: {
    companyName?: string;
    companySize?: 'startup' | 'small' | 'medium' | 'large' | 'enterprise';
    industry?: string;
    vatNumber?: string;
    billingAddress?: {
      street: string;
      city: string;
      state: string;
      country: string;
      zipCode: string;
    };
    purchaseOrderRequired: boolean;
    creditLimit?: number;
    paymentTerms?: number; // days
    corporateDiscount?: number; // percentage
  };
  
  // AI Personalization Fields
  aiPersonalization: {
    preferences: {
      preferredServiceTypes: string[];
      preferredProviders: mongoose.Types.ObjectId[];
      priceRangeMin?: number;
      priceRangeMax?: number;
      preferredTimeSlots: string[]; // morning, afternoon, evening
      preferredDays: string[]; // monday, tuesday, etc.
      locationPreference: 'home' | 'provider_location' | 'both';
    };
    behaviorData: {
      searchHistory: Array<{
        query: string;
        category?: string;
        location?: string;
        timestamp: Date;
      }>;
      bookingPatterns: {
        averageSpend: number;
        bookingFrequency: number; // per month
        seasonalPreferences: string[];
        timePreferences: string[];
      };
      interactionHistory: {
        profileViews: Array<{
          providerId: mongoose.Types.ObjectId;
          timestamp: Date;
        }>;
        favoriteActions: Array<{
          providerId: mongoose.Types.ObjectId;
          action: 'added' | 'removed';
          timestamp: Date;
        }>;
      };
    };
    recommendations: {
      lastUpdated?: Date;
      suggestedProviders: mongoose.Types.ObjectId[];
      suggestedServices: string[];
      personalizedOffers: Array<{
        offerId: string;
        validUntil: Date;
        discount: number;
        conditions?: string;
      }>;
    };
  };
  
  // Account Status
  accountStatus: AccountStatus;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isActive: boolean;
  isDeleted: boolean;
  
  // Security
  lastLogin?: Date;
  lastLoginIP?: string;
  loginAttempts: number;
  lockUntil?: Date;
  passwordChangedAt?: Date;
  // FIX: Password history for preventing reuse
  passwordHistory: string[];

  // Tokens
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  verificationToken?: string;
  verificationExpire?: Date;
  refreshTokens: string[];
  tokenVersion?: number;

  // Sessions (login history) - 30 day TTL
  sessions: Array<{
    sessionId: string;
    token: string;
    device: string;
    browser?: string;
    os?: string;
    ip?: string;
    location?: string;
    userAgent?: string;
    lastActive: Date;
    createdAt: Date;
    expiresAt: Date; // Required for TTL index
    isCurrent: boolean;
    deviceFingerprint?: string; // Device fingerprint hash for tracking
    biometricVerified?: boolean;
  }>;

  // Device list per user (for device management)
  deviceList?: Array<{
    fingerprint: string;
    device: string;
    browser?: string;
    os?: string;
    firstSeen: Date;
    lastActive: Date;
    lastIp?: string;
    loginCount: number;
    isTrusted: boolean;
    trustedAt?: Date;
  }>;

  // Two-Factor Authentication
  twoFactor: {
    enabled: boolean;
    secret?: string; // Encrypted TOTP secret
    recoveryCodes?: string[]; // Bcrypt hashed recovery codes
    backupEnabled: boolean;
    lastVerified?: Date;
    needsReenrollment?: boolean; // Set when all recovery codes are exhausted
    trustedDevices?: Array<{
      deviceId: string;
      deviceName: string;
      addedAt: Date;
      lastUsed?: Date;
    }>;
  };

  // Notifications
  notifications: Array<{
    _id: mongoose.Types.ObjectId;
    type: 'booking' | 'payment' | 'review' | 'system' | 'promotion';
    title: string;
    message: string;
    isRead: boolean;
    data?: Record<string, unknown>;
    createdAt: Date;
    readAt?: Date;
  }>;

  // Device tokens for push notifications
  deviceTokens: Array<{
    token: string;
    platform: 'ios' | 'android' | 'web';
    deviceId?: string;
    addedAt: Date;
    lastUsed?: Date;
    isActive: boolean;
  }>;

  // Demo Account Fields
  isDemoAccount?: boolean;
  demoExpiresAt?: Date;

  // GDPR Data Restriction Fields (Article 18 - Right to Restriction of Processing)
  processingRestricted?: boolean;
  restrictedAt?: Date;
  restrictionReason?: string;
  restrictionDetails?: {
    reason: string;
    requestedAt: Date;
    requestedBy: 'user' | 'admin';
    notes?: string;
    legalBasis?: string;
  };
  unrestrictedAt?: Date;

  // Fraud Detection Fields
  deviceFingerprints: Array<{
    fingerprint: string;
    userAgent: string;
    ip: string;
    firstSeen: Date;
    lastSeen: Date;
    isSuspicious: boolean;
    device?: string;
    deviceType?: 'mobile' | 'desktop' | 'tablet';
    browser?: string;
    os?: string;
    lastActive?: Date;
    lastIp?: string;
    isTrusted?: boolean;
    trustedAt?: Date;
    verified?: boolean;
    verifiedAt?: Date;
    verificationMethod?: string;
    deviceName?: string;
    loginCount?: number;
    suspiciousReasons?: string[];
  }>;
  registrationIP?: string;
  knownIPs: string[];
  loginIP?: string;
  stripeAccountId?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  twoFactorEnabled?: boolean;
  payoutAccounts?: Array<Record<string, unknown>>;
  instantPayoutStats?: Record<string, unknown>;
  behavioralMetrics?: Array<Record<string, unknown>>;
  behavioralProfile?: Record<string, unknown>;
  chargebackHistory?: Array<Record<string, unknown>>;
  deviceHistory?: Array<Record<string, unknown>>;
  knownLocations?: Array<Record<string, unknown>>;
  digestPreferences?: Record<string, unknown>;
  pushSubscriptions?: Array<Record<string, unknown>>;
  phoneHistory?: Array<Record<string, unknown>>;
  pendingDeviceVerification?: Record<string, unknown>;

  // Audit
  createdAt: Date;
  updatedAt: Date;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  
  // Virtual Properties
  fullName: string;
  age?: number;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  generateRefreshToken(rememberMe?: boolean): string;
  generateResetToken(): string;
  generateVerificationToken(): string;
  isLocked(): boolean;
  incLoginAttempts(): Promise<any>;
  resetLoginAttempts(): Promise<any>;
  updateLastLogin(ip?: string): Promise<void>;
  generateReferralCode(): string;
  cleanupExpiredSessions(): Promise<number>;
  addLoyaltyPoints(amount: number, type: string, description: string, bookingId?: string): Promise<void>;
  spendLoyaltyPoints(amount: number, description: string, bookingId?: string): Promise<boolean>;
  updateTier(): Promise<void>;
  invalidateAllTokens(): Promise<any>;
  updateSecurityInfo(req: any): Promise<any>;
}

// Static methods interface
export interface IUserModel extends Model<IUser> {
  findByTier(tier: string): Promise<IUser[]>;
  findByReferralCode(code: string): Promise<IUser | null>;
  cleanupExpiredSessions(batchSize?: number): Promise<number>;
}

const userSchema = new Schema<IUser>(
  {
    // Multi-tenant
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true
    },

    // Basic Info
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters'],
      validate: {
        validator: (v: string) => /^[a-zA-Z\s-']+$/.test(v),
        message: 'First name can only contain letters, spaces, hyphens, and apostrophes'
      }
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters'],
      validate: {
        validator: (v: string) => /^[a-zA-Z\s-']+$/.test(v),
        message: 'Last name can only contain letters, spaces, hyphens, and apostrophes'
      }
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Please provide a valid email address'
      }
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      // SECURITY FIX: Enforce minimum 12-character password length for stronger security
      // This aligns with NIST SP 800-63B guidelines and prevents weak passwords
      minlength: [12, 'Password must be at least 12 characters'],
      select: false,
      validate: {
        validator: function(this: IUser, password: string) {
          if (this.isNew || this.isModified('password')) {
            // Require: uppercase, lowercase, number, and special character
            return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/.test(password);
          }
          return true;
        },
        message: 'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character (@$!%*?&)'
      }
    },
    phone: {
      type: String,
      trim: true,
      validate: {
        validator: function(v: string) {
          return !v || /^[\+]?[(]?[\d\s\-\(\)]{10,}$/.test(v);
        },
        message: 'Please provide a valid phone number'
      }
    },
    role: {
      type: String,
      enum: {
        values: ['customer', 'provider', 'admin'],
        message: 'Role must be either customer, provider, or admin'
      },
      default: 'customer',
      index: true
    },

    // Admin Invite Tracking (Task #66)
    adminInviteAcceptedAt: {
      type: Date,
      default: null
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },

    // Profile & Social Fields
    avatar: {
      type: String,
      validate: {
        validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
        message: 'Avatar must be a valid URL'
      }
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot exceed 500 characters']
    },
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function(v: Date) {
          if (!v) return true;
          const today = new Date();
          const age = today.getFullYear() - v.getFullYear();
          return age >= 13 && age <= 120;
        },
        message: 'Age must be between 13 and 120 years'
      }
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say']
    },
    
    // Social Profile Fields
    socialProfiles: {
      followers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      following: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      socialMediaLinks: {
        instagram: String,
        facebook: String,
        twitter: String,
        linkedin: String,
        youtube: String,
        tiktok: String
      },
      isPublicProfile: { type: Boolean, default: true },
      profileViews: { type: Number, default: 0 },
      lastActiveAt: Date
    },
    
    // Address
    address: {
      street: String,
      city: String,
      state: String,
      country: { type: String, default: 'US' },
      zipCode: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number] } // [longitude, latitude]
      }
    },
    
    // Loyalty System Fields
    loyaltySystem: {
      coins: { type: Number, default: 0, min: 0 },
      tier: { 
        type: String, 
        enum: ['bronze', 'silver', 'gold', 'platinum'], 
        default: 'bronze' 
      },
      referralCode: {
        type: String,
        unique: true,
        sparse: true
      },
      referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
      streakDays: { type: Number, default: 0, min: 0 },
      lastStreakDate: Date,
      totalEarned: { type: Number, default: 0, min: 0 },
      totalSpent: { type: Number, default: 0, min: 0 },
      pointsHistory: [{
        amount: { type: Number, required: true },
        type: { type: String, enum: ['earned', 'spent', 'bonus', 'referral'], required: true },
        description: { type: String, required: true },
        date: { type: Date, default: Date.now },
        expiresAt: { type: Date }, // Points expire 24 months from earning
        relatedBooking: { type: Schema.Types.ObjectId, ref: 'Booking' }
      }],
      // Track processed job IDs to prevent duplicate awards (idempotency)
      processedJobIds: [{ type: String }],
      // Track first booking bonus award status
      firstBookingAwarded: { type: Boolean, default: false },
      // FIX: Store pending rewards until first booking completion
      // Per terms: rewards awarded "when they sign up AND complete their first booking"
      pendingRewards: [{
        type: { type: String, enum: ['welcome_bonus', 'referral_bonus'] },
        amount: { type: Number, required: true },
        description: { type: String },
        status: { type: String, enum: ['pending', 'awarded', 'expired'], default: 'pending' },
        referrerId: { type: Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now },
        awardedAt: { type: Date }
      }]
    },
    
    // Communication Preferences
    communicationPreferences: {
      email: {
        marketing: { type: Boolean, default: false },
        bookingUpdates: { type: Boolean, default: true },
        reminders: { type: Boolean, default: true },
        newsletters: { type: Boolean, default: false },
        promotions: { type: Boolean, default: false }
      },
      sms: {
        bookingUpdates: { type: Boolean, default: true },
        reminders: { type: Boolean, default: true },
        promotions: { type: Boolean, default: false }
      },
      push: {
        bookingUpdates: { type: Boolean, default: true },
        reminders: { type: Boolean, default: true },
        newMessages: { type: Boolean, default: true },
        promotions: { type: Boolean, default: false }
      },
      telegram: {
        enabled: { type: Boolean, default: false },
        linkedAt: { type: Date },
        optedOutAt: { type: Date },
        optedInAt: { type: Date },
      },
      whatsapp: {
        enabled: { type: Boolean, default: false },
        linkedAt: { type: Date },
        optedOutAt: { type: Date },
        optedInAt: { type: Date },
      },
      quietHours: {
        enabled: { type: Boolean, default: false },
        startTime: { type: String, default: '22:00' },
        endTime: { type: String, default: '08:00' },
        timezone: { type: String, default: 'UTC' }
      },
      language: { type: String, default: 'en' },
      timezone: { type: String, default: 'UTC' },
      currency: { type: String, default: 'USD' }
    },
    
    // B2B Corporate Fields
    corporateInfo: {
      companyName: String,
      companySize: { 
        type: String, 
        enum: ['startup', 'small', 'medium', 'large', 'enterprise'] 
      },
      industry: String,
      vatNumber: String,
      billingAddress: {
        street: String,
        city: String,
        state: String,
        country: String,
        zipCode: String
      },
      purchaseOrderRequired: { type: Boolean, default: false },
      creditLimit: { type: Number, min: 0 },
      paymentTerms: { type: Number, default: 30 },
      corporateDiscount: { type: Number, min: 0, max: 100 }
    },
    
    // AI Personalization Fields
    aiPersonalization: {
      preferences: {
        preferredServiceTypes: [String],
        preferredProviders: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        priceRangeMin: { type: Number, min: 0 },
        priceRangeMax: { type: Number, min: 0 },
        preferredTimeSlots: [{ type: String, enum: ['morning', 'afternoon', 'evening', 'night'] }],
        preferredDays: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }],
        locationPreference: { type: String, enum: ['home', 'provider_location', 'both'], default: 'both' }
      },
      behaviorData: {
        searchHistory: [{
          query: String,
          category: String,
          location: String,
          timestamp: { type: Date, default: Date.now }
        }],
        bookingPatterns: {
          averageSpend: { type: Number, default: 0 },
          bookingFrequency: { type: Number, default: 0 },
          seasonalPreferences: [String],
          timePreferences: [String]
        },
        interactionHistory: {
          profileViews: [{
            providerId: { type: Schema.Types.ObjectId, ref: 'User' },
            timestamp: { type: Date, default: Date.now }
          }],
          favoriteActions: [{
            providerId: { type: Schema.Types.ObjectId, ref: 'User' },
            action: { type: String, enum: ['added', 'removed'] },
            timestamp: { type: Date, default: Date.now }
          }]
        }
      },
      recommendations: {
        lastUpdated: Date,
        suggestedProviders: [{ type: Schema.Types.ObjectId, ref: 'User' }],
        suggestedServices: [String],
        personalizedOffers: [{
          offerId: String,
          validUntil: Date,
          discount: { type: Number, min: 0, max: 100 },
          conditions: String
        }]
      }
    },
    
    // Account Status
    accountStatus: {
      type: String,
      enum: ['active', 'suspended', 'pending_verification', 'deactivated'],
      default: 'pending_verification',
      index: true
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true
    },
    isPhoneVerified: {
      type: Boolean,
      default: false
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    
    // Security
    lastLogin: Date,
    lastLoginIP: String,
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: Date,
    passwordChangedAt: Date,
    // FIX: Password history for preventing reuse (last 5 passwords)
    passwordHistory: [{ type: String }],

    // Tokens
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    verificationToken: String,
    verificationExpire: Date,
    refreshTokens: [String],
    tokenVersion: { type: Number, default: 1 },

    // Sessions (login history) - 30 day TTL with MongoDB TTL index
    // FIX: Limit sessions array to max 20 entries to prevent unbounded document growth
    sessions: [{
      sessionId: { type: String, required: true },
      token: { type: String, select: false },
      device: String,
      browser: String,
      os: String,
      ip: String,
      location: String,
      userAgent: String,
      lastActive: { type: Date, default: Date.now },
      createdAt: { type: Date, default: Date.now },
      expiresAt: { type: Date, required: true }, // Required for TTL index
      isCurrent: { type: Boolean, default: false },
      deviceFingerprint: String, // Device fingerprint hash for tracking
    }],

    // Device list per user (for device management)
    deviceList: [{
      fingerprint: { type: String, required: true },
      device: String,
      browser: String,
      os: String,
      firstSeen: { type: Date, default: Date.now },
      lastActive: { type: Date, default: Date.now },
      lastIp: String,
      loginCount: { type: Number, default: 1 },
      isTrusted: { type: Boolean, default: false },
      trustedAt: Date,
    }],

    // Two-Factor Authentication
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false }, // Encrypted TOTP secret
      recoveryCodes: { type: [String], select: false }, // Bcrypt hashed recovery codes
      backupEnabled: { type: Boolean, default: true },
      lastVerified: Date,
      needsReenrollment: { type: Boolean, default: false }, // Set when all recovery codes exhausted
      trustedDevices: [{
        deviceId: { type: String, required: true },
        deviceName: { type: String },
        addedAt: { type: Date, default: Date.now },
        lastUsed: Date
      }]
    },

    // Notifications
    notifications: [{
      _id: { type: Schema.Types.ObjectId, auto: true },
      type: { type: String, enum: ['booking', 'payment', 'review', 'system', 'promotion'], default: 'system' },
      title: { type: String, required: true },
      message: { type: String, required: true },
      isRead: { type: Boolean, default: false },
      data: { type: Schema.Types.Mixed },
      createdAt: { type: Date, default: Date.now },
      readAt: Date,
    }],

    // Device tokens for push notifications
    deviceTokens: [{
      token: { type: String, required: true },
      platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
      deviceId: { type: String },
      addedAt: { type: Date, default: Date.now },
      lastUsed: { type: Date },
      isActive: { type: Boolean, default: true },
    }],

    // Demo Account Fields
    isDemoAccount: { type: Boolean, default: false },
    demoExpiresAt: { type: Date },

    // Fraud Detection Fields
    deviceFingerprints: [{
      fingerprint: { type: String, required: true },
      userAgent: { type: String },
      ip: { type: String },
      firstSeen: { type: Date, default: Date.now },
      lastSeen: { type: Date, default: Date.now },
      isSuspicious: { type: Boolean, default: false },
    }],
    registrationIP: { type: String },
    knownIPs: [{ type: String }],

    // GDPR Data Restriction Fields (Article 18 - Right to Restriction of Processing)
    processingRestricted: { type: Boolean, default: false },
    restrictedAt: { type: Date },
    restrictionReason: { type: String },
    restrictionDetails: {
      reason: String,
      requestedAt: Date,
      requestedBy: String,
      notes: String,
      legalBasis: String,
    },
    unrestrictedAt: { type: Date },

    // Audit
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    // SECURITY FIX: Mass Assignment Protection
    // strict: true ensures only defined schema fields can be set
    // This prevents attackers from injecting arbitrary fields via API requests
    strict: true,
    // Discriminator key for model inheritance if needed
    discriminatorKey: 'role',
    toJSON: {
      virtuals: true,
      transform: function(_doc, ret) {
        delete (ret as any).password;
        delete (ret as any).__v;
        delete (ret as any).resetPasswordToken;
        delete (ret as any).resetPasswordExpire;
        delete (ret as any).verificationToken;
        delete (ret as any).verificationExpire;
        delete (ret as any).refreshTokens;
        delete (ret as any).loginAttempts;
        delete (ret as any).lockUntil;
        delete (ret as any)['twoFactor.secret'];
        delete (ret as any)['twoFactor.recoveryCodes'];
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// Compound Indexes for Performance
userSchema.index({ email: 1, role: 1 });
userSchema.index({ isActive: 1, isDeleted: 1 });
userSchema.index({ accountStatus: 1, role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ 'address.coordinates': '2dsphere' }); // For geospatial queries

// FIX: Text search index for admin searches (improves regex search performance)
// Note: $regex with case-insensitive can still be slow without this index
userSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  'businessInfo.businessName': 'text'
}, {
  weights: {
    email: 10,
    'businessInfo.businessName': 5,
    firstName: 2,
    lastName: 2
  },
  name: 'user_text_search'
});
// Note: loyaltySystem.referralCode index created automatically by unique: true
userSchema.index({ 'loyaltySystem.tier': 1 });
userSchema.index({ 'socialProfiles.followers': 1 });
userSchema.index({ 'socialProfiles.following': 1 });
userSchema.index({ 'aiPersonalization.preferences.preferredServiceTypes': 1 });
// User analytics: get users by role sorted by creation date
// Supports queries like: find all providers/customers by registration date
userSchema.index({ role: 1, createdAt: -1 });

// TTL Index for Sessions - MongoDB auto-deletes documents where expiresAt < current time
// Sessions expire after 30 days (2592000 seconds)
// NOTE: TTL indexes on nested array fields have limitations in MongoDB
// The index triggers when the document is modified, not when individual array items expire.
// For reliable session cleanup, use the static cleanupExpiredSessions() method as a scheduled job.
// See: userSchema.statics.cleanupExpiredSessions
userSchema.index({ 'sessions.expiresAt': 1 }, { expireAfterSeconds: 0 });

// Index for efficient session cleanup queries
userSchema.index({ 'sessions.sessionId': 1 }, { unique: true, sparse: true });

// Fraud Detection Indexes
userSchema.index({ registrationIP: 1 });
userSchema.index({ 'deviceFingerprints.fingerprint': 1 });
userSchema.index({ knownIPs: 1 });

// FIX: Add unique index for referral codes (sparse for optional field)
userSchema.index({ 'loyaltySystem.referralCode': 1 }, { unique: true, sparse: true });

// FIX: Add index for loyalty points history queries (expired points cleanup)
userSchema.index({ 'loyaltySystem.pointsHistory.expiresAt': 1 });

// FIX: Add index for session device fingerprint queries (fraud detection)
userSchema.index({ 'sessions.deviceFingerprint': 1 }, { sparse: true });

// FIX: Add compound index for email login queries with soft delete
userSchema.index({ email: 1, isDeleted: 1 });

// NOTE: loyaltySystem.referralCode index created above with unique: true
// Removed duplicate index at line 944

// ===================================
// TENANT ISOLATION INDEXES (CRITICAL)
// ===================================
userSchema.index({ tenantId: 1, email: 1 }, { unique: true });
userSchema.index({ tenantId: 1, role: 1 });
userSchema.index({ tenantId: 1, accountStatus: 1 });

// Virtual Properties
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('age').get(function() {
  if (!this.dateOfBirth) return undefined;
  const today = new Date();
  const age = today.getFullYear() - this.dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - this.dateOfBirth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < this.dateOfBirth.getDate())) {
    return age - 1;
  }
  return age;
});

/**
 * Generate unique referral code atomically using counter.
 * Extracted so pre-save hook can call it without static `this` typing issues.
 */
async function generateUniqueReferralCode(firstName: string): Promise<string> {
  const namePrefix = (firstName || 'XX').substring(0, 2).toUpperCase();

  const ReferralCounter = mongoose.models.ReferralCounter || mongoose.model('ReferralCounter', new mongoose.Schema({
    _id: { type: String, required: true },
    sequence: { type: Number, default: 0 }
  }, { timestamps: true }));

  const counter = await ReferralCounter.findByIdAndUpdate(
    'referral_code',
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  );

  const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
  const sequencePart = String(counter.sequence).padStart(4, '0');

  return `${namePrefix}${randomPart}${sequencePart}`;
}

// Pre-save middleware
userSchema.pre('save', async function(next) {
  // Hash password if modified
  if (this.isModified('password')) {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    this.password = await bcrypt.hash(this.password, saltRounds);

    // ✅ FIX: Only set passwordChangedAt for existing users, not during initial registration
    if (!this.isNew) {
      this.passwordChangedAt = new Date();
    }
  }

  // FIX: Generate referral code atomically to prevent race condition duplicates
  if (this.isNew && !this.loyaltySystem.referralCode) {
    this.loyaltySystem.referralCode = await generateUniqueReferralCode(this.firstName);
  }

  // Update account status based on verification
  if (this.isModified('isEmailVerified') && this.isEmailVerified) {
    if (this.accountStatus === 'pending_verification') {
      this.accountStatus = 'active';
    }
  }

  next();
});

userSchema.statics.generateUniqueReferralCode = generateUniqueReferralCode;

// ===================================
// CASCADE DELETE HOOKS (CRITICAL)
// ===================================
// FIX: Add cascade delete hooks to clean up related data when user is deleted

// Note: Mongoose 'remove' hook is deprecated in v6+. Use deleteOne/deleteMany hooks instead.
// The cascade logic is triggered via the soft delete mechanism (findOneAndUpdate with isDeleted: true)

/**
 * Helper function to perform cascade cleanup when a user is deleted
 * CRITICAL: Prevents orphan records across all related collections
 */
async function performUserCascadeDelete(userId: mongoose.Types.ObjectId, userRole: string): Promise<void> {
  const session: ClientSession = await mongoose.startSession();
  try {
    session.startTransaction();

    const Booking = mongoose.model('Booking');
    const Review = mongoose.model('Review');
    const BookingNotification = mongoose.model('BookingNotification');
    const ProviderProfile = mongoose.model('ProviderProfile');
    const CustomerProfile = mongoose.model('CustomerProfile');
    const Address = mongoose.model('Address');
    const Consent = mongoose.model('Consent');
    const AuditLog = mongoose.model('AuditLog');
    const NotificationQueue = mongoose.model('NotificationQueue');

    // Clean up bookings where this user is the customer or provider
    // Soft delete to maintain booking history for auditing
    await Booking.updateMany(
      { $or: [{ customerId: userId }, { providerId: userId }] },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
        }
      },
      { session }
    );

    // Clean up reviews where this user is the reviewer or reviewee
    await Review.deleteMany(
      {
        $or: [{ reviewerId: userId }, { revieweeId: userId }]
      },
      { session }
    );

    // CRITICAL: Clean up customer profile (prevents orphan customer data)
    await CustomerProfile.deleteMany({ userId }, { session });

    // CRITICAL: Clean up all addresses for this user (prevents orphan addresses)
    await Address.deleteMany({ userId: userId.toString() }, { session });

    // CRITICAL: Clean up consent records (GDPR compliance - no orphan consent data)
    await Consent.deleteMany({ userId }, { session });

    // CRITICAL: Clean up audit logs for this user (optional - may want to keep for compliance)
    // Uncomment the following line to delete audit logs. Commented out by default for compliance:
    // await AuditLog.deleteMany({ userId }, { session });

    // CRITICAL: Clean up notifications for this user (prevents orphan notifications)
    await BookingNotification.deleteMany({ recipientId: userId }, { session });

    // CRITICAL: Clean up notification queue entries for this user
    await NotificationQueue.deleteMany({ recipientId: userId.toString() }, { session });

    // FIX: Remove this user from other users' followers/following lists
    // This prevents orphaned references in the social graph
    await User.updateMany(
      { 'socialProfiles.followers': userId },
      { $pull: { 'socialProfiles.followers': userId } },
      { session }
    );
    await User.updateMany(
      { 'socialProfiles.following': userId },
      { $pull: { 'socialProfiles.following': userId } },
      { session }
    );

    // FIX: Clean up other users' referralCode references if this user was referred
    await User.updateMany(
      { 'loyaltySystem.referredBy': userId },
      { $unset: { 'loyaltySystem.referredBy': 1 } },
      { session }
    );

    // FIX: Clean up favorite providers lists that reference this provider
    await User.updateMany(
      { 'aiPersonalization.preferences.preferredProviders': userId },
      { $pull: { 'aiPersonalization.preferences.preferredProviders': userId } },
      { session }
    );

    // If provider, clean up provider profile (this also cascades to services, availability)
    if (userRole === 'provider') {
      await ProviderProfile.deleteMany({ userId: userId }, { session });
    }

    await session.commitTransaction();

    logger.info('Cascade delete completed for user', {
      context: 'UserModel',
      action: 'CASCADE_DELETE',
      userId: userId.toString(),
      userRole,
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Cascade delete failed for user', {
      context: 'UserModel',
      action: 'CASCADE_DELETE_ERROR',
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

// Hook for soft delete (when isDeleted is set to true via findOneAndUpdate)
userSchema.pre('findOneAndUpdate', async function() {
  const update = this.getUpdate() as any;
  if (update && update.isDeleted === true && update.deletedAt) {
    const doc = await this.model.findOne(this.getQuery()).lean() as (mongoose.Document & { _id: mongoose.Types.ObjectId; role: string; isDeleted?: boolean }) | null;
    if (doc && !doc.isDeleted) {
      // User is being soft-deleted, trigger cascade
      await performUserCascadeDelete(doc._id, doc.role as string);
    }
  }
});

// Hook for direct deleteOne operations
userSchema.pre('deleteOne', { document: true, query: false }, async function() {
  const userId = this._id;
  const userRole = this.role;
  await performUserCascadeDelete(userId, userRole);
});

// Hook for deleteMany operations
userSchema.pre('deleteMany', { document: false, query: true }, async function() {
  const filter = this.getFilter();
  // Get the users being deleted to cascade
  const users = await mongoose.model('User').find(filter).select('_id role');
  for (const user of users) {
    await performUserCascadeDelete(user._id, user.role);
  }
});

// Instance Methods

/**
 * FIX: Limit unbounded sessions array to prevent document size growth
 * Call this method periodically or on login to maintain max 20 sessions
 */
userSchema.methods.cleanupOldSessions = async function(): Promise<number> {
  if (this.sessions.length <= 20) {
    return 0;
  }

  // Sort by lastActive descending and keep only the 20 most recent
  const sortedSessions = [...this.sessions].sort(
    (a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
  );
  const sessionsToKeep = sortedSessions.slice(0, 20);
  const removedCount = this.sessions.length - sessionsToKeep.length;

  this.sessions = sessionsToKeep;
  await this.save({ validateBeforeSave: false });

  return removedCount;
};

/**
 * FIX: Limit unbounded notifications array to prevent document size growth
 * Keeps the 100 most recent notifications
 */
userSchema.methods.cleanupOldNotifications = async function(): Promise<number> {
  const MAX_NOTIFICATIONS = 100;

  if (this.notifications.length <= MAX_NOTIFICATIONS) {
    return 0;
  }

  // Sort by createdAt descending and keep only the most recent
  const sortedNotifications = [...this.notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const notificationsToKeep = sortedNotifications.slice(0, MAX_NOTIFICATIONS);
  const removedCount = this.notifications.length - notificationsToKeep.length;

  this.notifications = notificationsToKeep;
  await this.save({ validateBeforeSave: false });

  return removedCount;
};

/**
 * FIX: Limit unbounded loyalty points history to prevent document size growth
 * Keeps the 500 most recent entries (old expired entries are cleaned up)
 */
userSchema.methods.cleanupOldPointsHistory = async function(): Promise<number> {
  const MAX_POINTS_HISTORY = 500;
  const now = new Date();

  if (this.loyaltySystem.pointsHistory.length <= MAX_POINTS_HISTORY) {
    return 0;
  }

  // Sort by date descending and keep only the most recent
  const sortedHistory = [...this.loyaltySystem.pointsHistory].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const historyToKeep = sortedHistory.slice(0, MAX_POINTS_HISTORY);
  const removedCount = this.loyaltySystem.pointsHistory.length - historyToKeep.length;

  this.loyaltySystem.pointsHistory = historyToKeep;
  await this.save({ validateBeforeSave: false });

  return removedCount;
};

userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

userSchema.methods.generateAuthToken = function(): string {
  const payload = {
    id: this._id.toString(),
    email: this.email,
    role: this.role,
    firstName: this.firstName,
    lastName: this.lastName,
    isEmailVerified: this.isEmailVerified,
    accountStatus: this.accountStatus,
    tokenVersion: this.tokenVersion || 1  // For token invalidation
  };

  // SECURITY FIX: Document algorithm mismatch with jwt.ts utility
  // This legacy method uses HS256 (symmetric) by default
  // The preferred jwtService in utils/jwt.ts uses RS256 (asymmetric)
  // For new code, use jwtService.generateAccessToken() instead
  return jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET as string,
    {
      algorithm: 'HS256', // Explicitly document HS256 is used here
      expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m',  // Short-lived access tokens
      issuer: 'home-service-platform'
    } as jwt.SignOptions
  );
};

userSchema.methods.generateRefreshToken = function(rememberMe: boolean = false): string {
  const payload = {
    id: this._id.toString(),
    tokenVersion: this.tokenVersion || 1,
    deviceFingerprint: this.currentSession?.deviceFingerprint || 'unknown',
    rememberMe
  };

  const secret = process.env.JWT_REFRESH_SECRET as string;

  // SECURITY FIX: Document algorithm mismatch - uses HS256 (symmetric) by default
  // The preferred jwtService uses RS256 (asymmetric) for better security

  // If rememberMe is true, issue a longer-lived token (30 days vs 7 days)
  let expiresIn = '7d';
  if (rememberMe) {
    expiresIn = process.env.JWT_REMEMBER_EXPIRE || '30d';
  } else {
    expiresIn = process.env.JWT_REFRESH_EXPIRE || '7d';
  }

  const options = {
    expiresIn,
    issuer: 'home-service-platform'
  } as jwt.SignOptions;

  const refreshToken = jwt.sign(payload, secret, options);

  // Implement token rotation if enabled
  if (process.env.JWT_REFRESH_ROTATE === 'true') {
    // Remove expired tokens
    this.refreshTokens = this.refreshTokens.filter((token: string) => {
      try {
        jwt.verify(token, process.env.JWT_REFRESH_SECRET as string);
        return true;
      } catch (error) {
        return false; // Remove expired tokens
      }
    });
  }

  // Store new refresh token
  this.refreshTokens.push(refreshToken);

  // Limit stored tokens per device (keep only last 5)
  if (this.refreshTokens.length > 5) {
    this.refreshTokens = this.refreshTokens.slice(-5);
  }

  return refreshToken;
};

userSchema.methods.generateResetToken = function(): string {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  return resetToken;
};

userSchema.methods.generateVerificationToken = function(): string {
  const verificationToken = jwt.sign(
    { id: this._id, purpose: 'email-verification' },
    process.env.JWT_SECRET as string,
    { expiresIn: '24h' }
  );

  this.verificationToken = verificationToken;
  this.verificationExpire = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  return verificationToken;
};

userSchema.methods.isLocked = function(): boolean {
  // Admin accounts are never locked out (ops access must remain available)
  if (this.role === 'admin') {
    return false;
  }
  return !!(this.lockUntil && this.lockUntil > new Date());
};

userSchema.methods.incLoginAttempts = async function() {
  // Admin accounts: no failed-attempt tracking or lockout
  if (this.role === 'admin') {
    if (this.lockUntil || this.loginAttempts > 0) {
      return this.updateOne({
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 },
      });
    }
    return;
  }

  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < new Date()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  const updates: any = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
  const lockTime = parseInt(process.env.LOCK_TIME_HOURS || '2') * 60 * 60 * 1000;
  
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTime) };
  }

  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

userSchema.methods.updateLastLogin = async function(ip?: string) {
  const updateData: any = {
    lastLogin: new Date(),
    'socialProfiles.lastActiveAt': new Date()
  };
  if (ip) updateData.lastLoginIP = ip;

  // Use a simple update without touching address to avoid geo index issues
  return User.updateOne(
    { _id: this._id },
    { $set: updateData }
  );
};

userSchema.methods.generateReferralCode = function(): string {
  const randomStr = crypto.randomBytes(4).toString('hex').toUpperCase();
  const namePrefix = this.firstName.substring(0, 2).toUpperCase();
  return `${namePrefix}${randomStr}`;
};

/**
 * Clean up expired sessions for this user only.
 * More efficient for real-time session validation.
 */
userSchema.methods.cleanupExpiredSessions = async function(): Promise<number> {
  const now = new Date();
  const initialCount = this.sessions.length;

  // Filter out expired sessions
  const validSessions = this.sessions.filter(
    (session: { expiresAt: Date }) => session.expiresAt >= now
  );

  const deletedCount = initialCount - validSessions.length;

  if (deletedCount > 0) {
    this.sessions = validSessions;
    await this.save({ validateBeforeSave: false });
  }

  return deletedCount;
};

userSchema.methods.addLoyaltyPoints = async function(amount: number, type: string, description: string, bookingId?: string) {
  // Points expire 24 months from earning
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 24);

  const pointsEntry = {
    amount,
    type,
    description,
    date: new Date(),
    expiresAt,
    relatedBooking: bookingId ? new mongoose.Types.ObjectId(bookingId) : undefined
  };

  const updates: any = {
    $inc: {
      'loyaltySystem.coins': amount,
      'loyaltySystem.totalEarned': amount
    },
    $push: { 'loyaltySystem.pointsHistory': pointsEntry }
  };

  await this.updateOne(updates);
  await this.updateTier();
};

userSchema.methods.spendLoyaltyPoints = async function(amount: number, description: string, bookingId?: string): Promise<boolean> {
  // Exclude expired points from balance calculation
  const now = new Date();
  const validPoints = this.loyaltySystem.pointsHistory
    .filter((entry: any) => entry.expiresAt === undefined || entry.expiresAt > now)
    .reduce((total: number, entry: any) => total + entry.amount, 0);

  if (validPoints < amount) {
    return false;
  }

  const pointsEntry = {
    amount: -amount,
    type: 'spent',
    description,
    date: new Date(),
    relatedBooking: bookingId ? new mongoose.Types.ObjectId(bookingId) : undefined
  };

  const updates: any = {
    $inc: {
      'loyaltySystem.coins': -amount,
      'loyaltySystem.totalSpent': amount
    },
    $push: { 'loyaltySystem.pointsHistory': pointsEntry }
  };

  await this.updateOne(updates);
  return true;
};

userSchema.methods.updateTier = async function() {
  const totalEarned = this.loyaltySystem.totalEarned;
  let newTier = 'bronze';

  if (totalEarned >= 10000) {
    newTier = 'platinum';
  } else if (totalEarned >= 5000) {
    newTier = 'gold';
  } else if (totalEarned >= 1000) {
    newTier = 'silver';
  }

  if (newTier !== this.loyaltySystem.tier) {
    await this.updateOne({ 'loyaltySystem.tier': newTier });
  }
};

// Security Methods
userSchema.methods.invalidateAllTokens = async function() {
  const currentVersion = this.tokenVersion || 1;
  await this.updateOne({
    tokenVersion: currentVersion + 1,
    refreshTokens: []  // Clear all refresh tokens
  });
};

userSchema.methods.updateSecurityInfo = async function(req: any) {
  const updates: any = {
    'socialProfiles.lastActiveAt': new Date()
  };

  // Track IP if available
  if (req.ip || req.connection?.remoteAddress) {
    updates.lastLoginIP = req.ip || req.connection.remoteAddress;
  }

  // Security audit trail (if enabled)
  if (process.env.SECURITY_AUDIT === 'true') {
    const userAgent = req.get('User-Agent') || 'unknown';
    updates.lastSecurityCheck = {
      timestamp: new Date(),
      ip: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: userAgent.substring(0, 200) // Limit length
    };
  }

  return this.updateOne(updates, { validateBeforeSave: false });
};

/**
 * Add or update a device fingerprint for fraud detection
 */
userSchema.methods.addDeviceFingerprint = async function(
  fingerprint: string,
  userAgent: string,
  ip: string
): Promise<{ isNew: boolean; isSuspicious: boolean }> {
  const existingIndex = this.deviceFingerprints.findIndex(
    (d: any) => d.fingerprint === fingerprint
  );

  if (existingIndex >= 0) {
    // Update existing fingerprint
    this.deviceFingerprints[existingIndex].lastSeen = new Date();
    if (ip) {
      this.deviceFingerprints[existingIndex].ip = ip;
    }
    await this.save({ validateBeforeSave: false });
    return { isNew: false, isSuspicious: this.deviceFingerprints[existingIndex].isSuspicious };
  }

  // Check if this is a new device (suspicious if more than 3 devices already)
  const isSuspicious = this.deviceFingerprints.length >= 3;

  // Add new fingerprint
  this.deviceFingerprints.push({
    fingerprint,
    userAgent: userAgent?.substring(0, 500) || 'unknown',
    ip,
    firstSeen: new Date(),
    lastSeen: new Date(),
    isSuspicious,
  });

  await this.save({ validateBeforeSave: false });
  return { isNew: true, isSuspicious };
};

/**
 * Get count of active devices
 */
userSchema.methods.getActiveDeviceCount = function(): number {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return this.deviceFingerprints.filter((d: any) =>
    d.lastSeen && d.lastSeen > thirtyDaysAgo
  ).length;
};

/**
 * Check if IP is already known
 */
userSchema.methods.isKnownIP = function(ip: string): boolean {
  return this.knownIPs.includes(ip) || this.registrationIP === ip;
};

// Static Methods
userSchema.statics.findByTier = function(tier: string) {
  return this.find({
    'loyaltySystem.tier': tier,
    isActive: true,
    isDeleted: false
  });
};

userSchema.statics.findByReferralCode = function(code: string) {
  return this.findOne({
    'loyaltySystem.referralCode': code,
    isActive: true,
    isDeleted: false
  });
};

/**
 * Clean up expired sessions from all users.
 * This is a more reliable alternative to the TTL index on nested arrays.
 * Should be called by a scheduled job (e.g., daily cron).
 * Note: MongoDB TTL indexes on nested array fields have limitations - they only
 * work when the array field itself exists and can have unpredictable behavior
 * with nested documents. This method provides reliable cleanup.
 */
userSchema.statics.cleanupExpiredSessions = async function(batchSize: number = 1000): Promise<number> {
  const now = new Date();
  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    // Find users with expired sessions
    const users = await this.find({
      'sessions.expiresAt': { $lt: now }
    }).select('_id sessions').limit(batchSize);

    if (users.length === 0) {
      hasMore = false;
      break;
    }

    let batchDeleted = 0;
    for (const user of users) {
      // Filter out expired sessions
      const validSessions = user.sessions.filter(
        (session: { expiresAt: Date }) => session.expiresAt >= now
      );

      if (validSessions.length !== user.sessions.length) {
        await this.updateOne(
          { _id: user._id },
          { $set: { sessions: validSessions } }
        );
        batchDeleted += user.sessions.length - validSessions.length;
      }
    }

    totalDeleted += batchDeleted;

    if (users.length < batchSize) {
      hasMore = false;
    }
  }

  return totalDeleted;
};

const User: Model<IUser> = mongoose.model<IUser, IUserModel>('User', userSchema);

export default User;