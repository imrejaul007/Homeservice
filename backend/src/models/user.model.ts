import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export type UserRole = 'customer' | 'provider' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'pending_verification' | 'deactivated';

export interface IUser extends Document {
  // Basic Info
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone?: string;
  role: UserRole;
  
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
      lat: number;
      lng: number;
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
      relatedBooking?: mongoose.Types.ObjectId;
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
  
  // Tokens
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  verificationToken?: string;
  verificationExpire?: Date;
  refreshTokens: string[];
  tokenVersion?: number;
  
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
  generateRefreshToken(): string;
  generateResetToken(): string;
  generateVerificationToken(): string;
  isLocked(): boolean;
  incLoginAttempts(): Promise<any>;
  resetLoginAttempts(): Promise<any>;
  updateLastLogin(ip?: string): Promise<void>;
  generateReferralCode(): string;
  addLoyaltyPoints(amount: number, type: string, description: string, bookingId?: string): Promise<void>;
  spendLoyaltyPoints(amount: number, description: string, bookingId?: string): Promise<boolean>;
  updateTier(): Promise<void>;
  invalidateAllTokens(): Promise<any>;
  updateSecurityInfo(req: any): Promise<any>;
}

const userSchema = new Schema<IUser>(
  {
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
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
      validate: {
        validator: function(this: IUser, password: string) {
          if (this.isNew || this.isModified('password')) {
            return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password);
          }
          return true;
        },
        message: 'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character'
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
        lat: { type: Number, min: -90, max: 90 },
        lng: { type: Number, min: -180, max: 180 }
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
        relatedBooking: { type: Schema.Types.ObjectId, ref: 'Booking' }
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
    
    // Tokens
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    verificationToken: String,
    verificationExpire: Date,
    refreshTokens: [String],
    tokenVersion: { type: Number, default: 1 },
    
    // Audit
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
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
userSchema.index({ 'loyaltySystem.referralCode': 1 });
userSchema.index({ 'loyaltySystem.tier': 1 });
userSchema.index({ 'socialProfiles.followers': 1 });
userSchema.index({ 'socialProfiles.following': 1 });
userSchema.index({ 'aiPersonalization.preferences.preferredServiceTypes': 1 });

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
  
  // Generate referral code if new user and doesn't have one
  if (this.isNew && !this.loyaltySystem.referralCode) {
    this.loyaltySystem.referralCode = this.generateReferralCode();
  }
  
  // Update account status based on verification
  if (this.isModified('isEmailVerified') && this.isEmailVerified) {
    if (this.accountStatus === 'pending_verification') {
      this.accountStatus = 'active';
    }
  }
  
  next();
});

// Instance Methods
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

  return jwt.sign(
    payload,
    process.env.JWT_ACCESS_SECRET as string,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m',  // Short-lived access tokens
      issuer: 'home-service-platform'
    } as jwt.SignOptions
  );
};

userSchema.methods.generateRefreshToken = function(): string {
  const payload = {
    id: this._id.toString(),
    tokenVersion: this.tokenVersion || 1,
    deviceFingerprint: this.currentSession?.deviceFingerprint || 'unknown'
  };

  const secret = process.env.JWT_REFRESH_SECRET as string;
  const options = {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',  // Long-lived refresh tokens
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
  return !!(this.lockUntil && this.lockUntil > new Date());
};

userSchema.methods.incLoginAttempts = async function() {
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
  
  return this.updateOne(updateData);
};

userSchema.methods.generateReferralCode = function(): string {
  const randomStr = crypto.randomBytes(4).toString('hex').toUpperCase();
  const namePrefix = this.firstName.substring(0, 2).toUpperCase();
  return `${namePrefix}${randomStr}`;
};

userSchema.methods.addLoyaltyPoints = async function(amount: number, type: string, description: string, bookingId?: string) {
  const pointsEntry = {
    amount,
    type,
    description,
    date: new Date(),
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
  if (this.loyaltySystem.coins < amount) {
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

const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);

export default User;