# 🛠️ Backend Authentication Implementation Guide

## 📋 Implementation Checklist
- [ ] **Database Models**: Extended user profiles for Customer & Provider
- [ ] **Auth Controllers**: Registration, login, password reset, email verification
- [ ] **Auth Middleware**: Token validation, role-based access, email verification
- [ ] **Route Setup**: Protected routes with proper middleware chains
- [ ] **Email Service**: Verification and password reset emails
- [ ] **File Upload**: Avatar and document handling for providers
- [ ] **Validation**: Input validation with Joi schemas
- [ ] **Testing**: Unit tests for all auth functionality

---

## 🗄️ Database Models Implementation

### **Step 1: Create CustomerProfile Model**
**File**: `backend/src/models/customerProfile.model.ts`

```typescript
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
  };
  addresses: Array<{
    _id?: mongoose.Types.ObjectId;
    label: string;
    street: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    isDefault: boolean;
  }>;
  paymentMethods: Array<{
    _id?: mongoose.Types.ObjectId;
    type: 'card' | 'paypal' | 'wallet';
    last4?: string;
    brand?: string;
    isDefault: boolean;
    stripePaymentMethodId?: string;
  }>;
  favoriteProviders: mongoose.Types.ObjectId[];
  loyaltyPoints: {
    total: number;
    available: number;
    history: Array<{
      amount: number;
      type: 'earned' | 'redeemed';
      description: string;
      date: Date;
    }>;
  };
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
    marketing: boolean;
  };
  stats: {
    totalBookings: number;
    totalSpent: number;
    memberSince: Date;
  };
}

const customerProfileSchema = new Schema<ICustomerProfile>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  preferences: {
    categories: [String],
    maxDistance: { type: Number, default: 25 },
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 1000 }
    }
  },
  addresses: [{
    label: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    isDefault: { type: Boolean, default: false }
  }],
  paymentMethods: [{
    type: { type: String, enum: ['card', 'paypal', 'wallet'], required: true },
    last4: String,
    brand: String,
    isDefault: { type: Boolean, default: false },
    stripePaymentMethodId: String
  }],
  favoriteProviders: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  loyaltyPoints: {
    total: { type: Number, default: 0 },
    available: { type: Number, default: 0 },
    history: [{
      amount: Number,
      type: { type: String, enum: ['earned', 'redeemed'] },
      description: String,
      date: { type: Date, default: Date.now }
    }]
  },
  notificationPreferences: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    push: { type: Boolean, default: true },
    marketing: { type: Boolean, default: false }
  },
  stats: {
    totalBookings: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    memberSince: { type: Date, default: Date.now }
  }
}, { timestamps: true });

// Indexes
customerProfileSchema.index({ userId: 1 });
customerProfileSchema.index({ 'addresses.coordinates': '2dsphere' });

const CustomerProfile: Model<ICustomerProfile> = mongoose.model<ICustomerProfile>('CustomerProfile', customerProfileSchema);
export default CustomerProfile;
```

### **Step 2: Create ProviderProfile Model**
**File**: `backend/src/models/providerProfile.model.ts`

```typescript
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IProviderProfile extends Document {
  userId: mongoose.Types.ObjectId;
  businessInfo: {
    businessName: string;
    businessType: 'individual' | 'company';
    description: string;
    yearsOfExperience: number;
    teamSize?: number;
  };
  services: {
    primaryCategory: string;
    subcategories: string[];
    specializations: string[];
    serviceRadius: number;
  };
  location: {
    businessAddress: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
    serviceAreas: string[];
    coordinates: {
      lat: number;
      lng: number;
    };
    isMobile: boolean;
  };
  verification: {
    status: 'pending' | 'verified' | 'rejected';
    submittedAt?: Date;
    reviewedAt?: Date;
    reviewedBy?: mongoose.Types.ObjectId;
    documents: {
      identityDocument?: {
        type: string;
        url: string;
        verified: boolean;
      };
      businessLicense?: {
        type: string;
        url: string;
        verified: boolean;
      };
      certifications?: Array<{
        name: string;
        type: string;
        url: string;
        verified: boolean;
      }>;
    };
    notes?: string;
  };
  portfolio: Array<{
    _id?: mongoose.Types.ObjectId;
    title: string;
    description?: string;
    imageUrl: string;
    category: string;
    isBeforeAfter: boolean;
    tags: string[];
    uploadedAt: Date;
  }>;
  ratings: {
    average: number;
    count: number;
    breakdown: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
  };
  earnings: {
    totalEarned: number;
    availableBalance: number;
    pendingBalance: number;
    lastPayout?: Date;
  };
  availability: {
    schedule: {
      monday: { isAvailable: boolean; slots: string[] };
      tuesday: { isAvailable: boolean; slots: string[] };
      wednesday: { isAvailable: boolean; slots: string[] };
      thursday: { isAvailable: boolean; slots: string[] };
      friday: { isAvailable: boolean; slots: string[] };
      saturday: { isAvailable: boolean; slots: string[] };
      sunday: { isAvailable: boolean; slots: string[] };
    };
    exceptions: Array<{
      date: Date;
      isAvailable: boolean;
      reason?: string;
    }>;
  };
  settings: {
    instantBooking: boolean;
    autoAcceptRegulars: boolean;
    advanceBookingDays: number;
    cancellationPolicy: string;
  };
  stats: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    responseTime: number; // in minutes
    memberSince: Date;
  };
}

const providerProfileSchema = new Schema<IProviderProfile>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  businessInfo: {
    businessName: { type: String, required: true },
    businessType: { type: String, enum: ['individual', 'company'], required: true },
    description: { type: String, required: true, maxlength: 1000 },
    yearsOfExperience: { type: Number, required: true, min: 0 },
    teamSize: { type: Number, min: 1 }
  },
  services: {
    primaryCategory: { type: String, required: true },
    subcategories: [String],
    specializations: [String],
    serviceRadius: { type: Number, default: 25 }
  },
  location: {
    businessAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, required: true }
    },
    serviceAreas: [String],
    coordinates: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true }
    },
    isMobile: { type: Boolean, default: false }
  },
  verification: {
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    submittedAt: Date,
    reviewedAt: Date,
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    documents: {
      identityDocument: {
        type: String,
        url: String,
        verified: { type: Boolean, default: false }
      },
      businessLicense: {
        type: String,
        url: String,
        verified: { type: Boolean, default: false }
      },
      certifications: [{
        name: String,
        type: String,
        url: String,
        verified: { type: Boolean, default: false }
      }]
    },
    notes: String
  },
  portfolio: [{
    title: { type: String, required: true },
    description: String,
    imageUrl: { type: String, required: true },
    category: { type: String, required: true },
    isBeforeAfter: { type: Boolean, default: false },
    tags: [String],
    uploadedAt: { type: Date, default: Date.now }
  }],
  ratings: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 },
    breakdown: {
      5: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      1: { type: Number, default: 0 }
    }
  },
  earnings: {
    totalEarned: { type: Number, default: 0 },
    availableBalance: { type: Number, default: 0 },
    pendingBalance: { type: Number, default: 0 },
    lastPayout: Date
  },
  availability: {
    schedule: {
      monday: { isAvailable: { type: Boolean, default: true }, slots: [String] },
      tuesday: { isAvailable: { type: Boolean, default: true }, slots: [String] },
      wednesday: { isAvailable: { type: Boolean, default: true }, slots: [String] },
      thursday: { isAvailable: { type: Boolean, default: true }, slots: [String] },
      friday: { isAvailable: { type: Boolean, default: true }, slots: [String] },
      saturday: { isAvailable: { type: Boolean, default: true }, slots: [String] },
      sunday: { isAvailable: { type: Boolean, default: false }, slots: [String] }
    },
    exceptions: [{
      date: { type: Date, required: true },
      isAvailable: { type: Boolean, required: true },
      reason: String
    }]
  },
  settings: {
    instantBooking: { type: Boolean, default: true },
    autoAcceptRegulars: { type: Boolean, default: false },
    advanceBookingDays: { type: Number, default: 30 },
    cancellationPolicy: { type: String, default: 'flexible' }
  },
  stats: {
    totalBookings: { type: Number, default: 0 },
    completedBookings: { type: Number, default: 0 },
    cancelledBookings: { type: Number, default: 0 },
    responseTime: { type: Number, default: 0 },
    memberSince: { type: Date, default: Date.now }
  }
}, { timestamps: true });

// Indexes
providerProfileSchema.index({ userId: 1 });
providerProfileSchema.index({ 'services.primaryCategory': 1 });
providerProfileSchema.index({ 'location.coordinates': '2dsphere' });
providerProfileSchema.index({ 'verification.status': 1 });
providerProfileSchema.index({ 'ratings.average': -1 });

const ProviderProfile: Model<IProviderProfile> = mongoose.model<IProviderProfile>('ProviderProfile', providerProfileSchema);
export default ProviderProfile;
```

### **Step 3: Create ServiceCategory Model**
**File**: `backend/src/models/serviceCategory.model.ts`

```typescript
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IServiceCategory extends Document {
  name: string;
  slug: string;
  description: string;
  icon: string;
  subcategories: Array<{
    _id?: mongoose.Types.ObjectId;
    name: string;
    slug: string;
    description: string;
    icon?: string;
    isActive: boolean;
  }>;
  isActive: boolean;
  sortOrder: number;
}

const serviceCategorySchema = new Schema<IServiceCategory>({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  icon: { type: String, required: true },
  subcategories: [{
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: { type: String, required: true },
    icon: String,
    isActive: { type: Boolean, default: true }
  }],
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true });

// Indexes
serviceCategorySchema.index({ slug: 1 });
serviceCategorySchema.index({ isActive: 1, sortOrder: 1 });

const ServiceCategory: Model<IServiceCategory> = mongoose.model<IServiceCategory>('ServiceCategory', serviceCategorySchema);
export default ServiceCategory;
```

---

## 🔐 Authentication Controllers

### **Step 4: Create Auth Controller**
**File**: `backend/src/controllers/auth.controller.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user.model';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/email.service';
import { uploadToCloudinary } from '../services/cloudinary.service';

export class AuthController {
  
  // Customer Registration
  static async registerCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        firstName,
        lastName,
        email,
        password,
        phone,
        preferences,
        notificationPreferences,
        agreeToTerms,
        agreeToPrivacy,
        marketingOptIn
      } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }

      // Create user
      const user = new User({
        firstName,
        lastName,
        email: email.toLowerCase(),
        password,
        phone,
        role: 'customer'
      });

      // Generate verification token
      const verificationToken = user.generateVerificationToken();
      await user.save();

      // Create customer profile
      const customerProfile = new CustomerProfile({
        userId: user._id,
        preferences: preferences || {},
        notificationPreferences: {
          email: notificationPreferences?.email ?? true,
          sms: notificationPreferences?.sms ?? true,
          push: notificationPreferences?.push ?? true,
          marketing: marketingOptIn ?? false
        }
      });
      await customerProfile.save();

      // Send verification email
      await sendVerificationEmail(user.email, user.firstName, verificationToken);

      // Generate auth token
      const authToken = user.generateAuthToken();

      res.status(201).json({
        message: 'Customer registered successfully. Please check your email for verification.',
        token: authToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // Provider Registration
  static async registerProvider(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        // Personal Info
        firstName,
        lastName,
        email,
        password,
        phone,
        
        // Business Info
        businessName,
        businessType,
        businessDescription,
        yearsOfExperience,
        
        // Services
        primaryCategory,
        subcategories,
        specializations,
        
        // Location
        businessAddress,
        serviceAreas,
        coordinates,
        isMobile,
        
        // Terms
        agreeToProviderTerms,
        agreeToCommissionStructure,
        agreeToBackgroundCheck
      } = req.body;

      // Check if user exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ error: 'User already exists with this email' });
      }

      // Create user
      const user = new User({
        firstName,
        lastName,
        email: email.toLowerCase(),
        password,
        phone,
        role: 'provider'
      });

      // Generate verification token
      const verificationToken = user.generateVerificationToken();
      await user.save();

      // Handle file uploads for documents and portfolio
      let documents = {};
      let portfolioImages = [];

      if (req.files) {
        const files = req.files as any;
        
        // Upload identity document
        if (files.identityDocument) {
          const identityResult = await uploadToCloudinary(files.identityDocument[0].path, 'provider-documents');
          documents.identityDocument = {
            type: files.identityDocument[0].mimetype,
            url: identityResult.secure_url,
            verified: false
          };
        }

        // Upload business license
        if (files.businessLicense) {
          const businessResult = await uploadToCloudinary(files.businessLicense[0].path, 'provider-documents');
          documents.businessLicense = {
            type: files.businessLicense[0].mimetype,
            url: businessResult.secure_url,
            verified: false
          };
        }

        // Upload portfolio images
        if (files.portfolioImages) {
          for (const file of files.portfolioImages) {
            const portfolioResult = await uploadToCloudinary(file.path, 'provider-portfolio');
            portfolioImages.push({
              title: `Portfolio Image`,
              imageUrl: portfolioResult.secure_url,
              category: primaryCategory,
              isBeforeAfter: false,
              tags: []
            });
          }
        }
      }

      // Create provider profile
      const providerProfile = new ProviderProfile({
        userId: user._id,
        businessInfo: {
          businessName,
          businessType,
          description: businessDescription,
          yearsOfExperience
        },
        services: {
          primaryCategory,
          subcategories: subcategories || [],
          specializations: specializations || []
        },
        location: {
          businessAddress,
          serviceAreas: serviceAreas || [],
          coordinates,
          isMobile: isMobile || false
        },
        verification: {
          status: 'pending',
          submittedAt: new Date(),
          documents
        },
        portfolio: portfolioImages
      });
      await providerProfile.save();

      // Send verification email
      await sendVerificationEmail(user.email, user.firstName, verificationToken);

      // Generate auth token
      const authToken = user.generateAuthToken();

      res.status(201).json({
        message: 'Provider registered successfully. Your profile is under review.',
        token: authToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        },
        verificationStatus: 'pending'
      });

    } catch (error) {
      next(error);
    }
  }

  // Login
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;

      // Find user and include password
      const user = await User.findOne({ 
        email: email.toLowerCase(),
        isDeleted: false 
      }).select('+password');

      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check if account is locked
      if (user.isLocked()) {
        return res.status(423).json({ 
          error: 'Account is locked due to too many failed login attempts. Please try again later.' 
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        await user.incLoginAttempts();
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Check if account is active
      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is deactivated. Please contact support.' });
      }

      // Reset login attempts and update last login
      await user.resetLoginAttempts();
      user.lastLogin = new Date();
      await user.save();

      // Generate auth token
      const token = user.generateAuthToken();

      // Set refresh token cookie
      const refreshToken = jwt.sign(
        { id: user._id, tokenVersion: user.tokenVersion || 0 },
        process.env.JWT_REFRESH_SECRET!,
        { expiresIn: '7d' }
      );

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      // Determine redirect path based on role
      let redirectPath = '/';
      switch (user.role) {
        case 'customer':
          redirectPath = '/customer/dashboard';
          break;
        case 'provider':
          // Check if profile is complete
          const providerProfile = await ProviderProfile.findOne({ userId: user._id });
          if (!providerProfile?.verification.status) {
            redirectPath = '/provider/complete-profile';
          } else if (providerProfile.verification.status === 'pending') {
            redirectPath = '/provider/verification-pending';
          } else {
            redirectPath = '/provider/dashboard';
          }
          break;
        case 'admin':
          redirectPath = '/admin/dashboard';
          break;
      }

      res.json({
        message: 'Login successful',
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          isActive: user.isActive,
          avatar: user.avatar
        },
        redirectPath
      });

    } catch (error) {
      next(error);
    }
  }

  // Get Current User
  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user as IUser;
      
      let profile = null;
      if (user.role === 'customer') {
        profile = await CustomerProfile.findOne({ userId: user._id });
      } else if (user.role === 'provider') {
        profile = await ProviderProfile.findOne({ userId: user._id });
      }

      res.json({
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          isActive: user.isActive,
          avatar: user.avatar,
          bio: user.bio,
          address: user.address,
          createdAt: user.createdAt
        },
        profile
      });
    } catch (error) {
      next(error);
    }
  }

  // Email Verification
  static async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      if (decoded.purpose !== 'email-verification') {
        return res.status(400).json({ error: 'Invalid verification token' });
      }

      // Find user
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if already verified
      if (user.isEmailVerified) {
        return res.status(200).json({ message: 'Email already verified' });
      }

      // Verify email
      user.isEmailVerified = true;
      user.verificationToken = undefined;
      user.verificationExpire = undefined;
      await user.save();

      res.json({
        message: 'Email verified successfully',
        user: {
          id: user._id,
          email: user.email,
          isEmailVerified: user.isEmailVerified
        }
      });

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(400).json({ error: 'Verification token has expired' });
      }
      next(error);
    }
  }

  // Resend Verification Email
  static async resendVerification(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ error: 'Email is already verified' });
      }

      // Generate new verification token
      const verificationToken = user.generateVerificationToken();
      await user.save();

      // Send verification email
      await sendVerificationEmail(user.email, user.firstName, verificationToken);

      res.json({ message: 'Verification email sent successfully' });

    } catch (error) {
      next(error);
    }
  }

  // Forgot Password
  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      const user = await User.findOne({ 
        email: email.toLowerCase(),
        isDeleted: false 
      });

      if (!user) {
        // Don't reveal if user exists or not
        return res.json({ message: 'If account exists, password reset email will be sent' });
      }

      // Generate reset token
      const resetToken = user.generateResetToken();
      await user.save();

      // Send password reset email
      await sendPasswordResetEmail(user.email, user.firstName, resetToken);

      res.json({ message: 'Password reset email sent successfully' });

    } catch (error) {
      next(error);
    }
  }

  // Reset Password
  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const { password } = req.body;

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      if (decoded.purpose !== 'password-reset') {
        return res.status(400).json({ error: 'Invalid reset token' });
      }

      // Find user
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Update password
      user.password = password;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      res.json({ message: 'Password reset successful' });

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(400).json({ error: 'Reset token has expired' });
      }
      next(error);
    }
  }

  // Change Password
  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user as IUser;
      const { currentPassword, newPassword } = req.body;

      // Get user with password
      const userWithPassword = await User.findById(user._id).select('+password');
      if (!userWithPassword) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Verify current password
      const isCurrentPasswordValid = await userWithPassword.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      // Update password
      userWithPassword.password = newPassword;
      await userWithPassword.save();

      res.json({ message: 'Password changed successfully' });

    } catch (error) {
      next(error);
    }
  }

  // Logout
  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // Clear refresh token cookie
      res.clearCookie('refreshToken');
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  }

  // Refresh Token
  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.cookies;

      if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token not provided' });
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;
      
      // Find user
      const user = await User.findById(decoded.id);
      if (!user || !user.isActive) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Generate new access token
      const accessToken = user.generateAuthToken();

      res.json({
        token: accessToken,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        }
      });

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        res.clearCookie('refreshToken');
        return res.status(401).json({ error: 'Refresh token expired' });
      }
      next(error);
    }
  }
}
```

---

## 🛡️ Authentication Middleware

### **Step 5: Create Auth Middleware**
**File**: `backend/src/middleware/auth.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/user.model';
import ProviderProfile from '../models/providerProfile.model';

// Extend Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  iat: number;
  exp: number;
}

// Authentication middleware
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    
    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user is active
    if (!user.isActive || user.isDeleted) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Role-based authorization middleware
export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as IUser;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ 
        error: 'Access denied',
        required: allowedRoles,
        current: user.role 
      });
    }

    next();
  };
};

// Email verification requirement
export const requireEmailVerified = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as IUser;
  
  if (!user.isEmailVerified) {
    return res.status(403).json({ 
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED' 
    });
  }

  next();
};

// Provider verification requirement
export const requireProviderApproval = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as IUser;
    
    if (user.role !== 'provider') {
      return res.status(403).json({ error: 'Provider access required' });
    }

    const providerProfile = await ProviderProfile.findOne({ userId: user._id });
    
    if (!providerProfile) {
      return res.status(403).json({ 
        error: 'Provider profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }

    if (providerProfile.verification.status !== 'verified') {
      return res.status(403).json({ 
        error: 'Provider verification required',
        code: 'PROVIDER_NOT_VERIFIED',
        status: providerProfile.verification.status
      });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Verification check failed' });
  }
};

// Check if user owns the resource
export const requireOwnership = (resourceType: 'booking' | 'service' | 'profile') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as IUser;
      const resourceId = req.params.id;

      // Skip ownership check for admins
      if (user.role === 'admin') {
        return next();
      }

      // Import models dynamically to avoid circular dependencies
      let resource;
      
      switch (resourceType) {
        case 'booking':
          const Booking = require('../models/booking.model').default;
          resource = await Booking.findById(resourceId);
          if (resource && (
            resource.customerId.toString() === user._id.toString() ||
            resource.providerId.toString() === user._id.toString()
          )) {
            return next();
          }
          break;
        
        case 'service':
          const Service = require('../models/service.model').default;
          resource = await Service.findById(resourceId);
          if (resource && resource.providerId.toString() === user._id.toString()) {
            return next();
          }
          break;
        
        case 'profile':
          if (user.role === 'customer') {
            const CustomerProfile = require('../models/customerProfile.model').default;
            resource = await CustomerProfile.findOne({ userId: user._id });
          } else if (user.role === 'provider') {
            const ProviderProfile = require('../models/providerProfile.model').default;
            resource = await ProviderProfile.findOne({ userId: user._id });
          }
          if (resource) {
            return next();
          }
          break;
      }

      return res.status(403).json({ 
        error: 'Access denied - insufficient permissions',
        code: 'OWNERSHIP_REQUIRED'
      });

    } catch (error) {
      res.status(500).json({ error: 'Ownership verification failed' });
    }
  };
};

// Rate limiting middleware (simple implementation)
const rateLimitStore = new Map();

export const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip;
    const now = Date.now();
    
    if (!rateLimitStore.has(key)) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const record = rateLimitStore.get(key);
    
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    record.count++;
    next();
  };
};

// Optional authentication - allows both authenticated and guest access
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(); // Continue without user
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const user = await User.findById(decoded.id);
    
    if (user && user.isActive && !user.isDeleted) {
      req.user = user;
    }
  } catch (error) {
    // Ignore auth errors for optional auth
  }
  
  next();
};
```

---

## 📧 Email Service Implementation

### **Step 6: Create Email Service**
**File**: `backend/src/services/email.service.ts`

```typescript
import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

interface EmailTemplate {
  subject: string;
  html: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransporter({
      service: 'gmail', // or your email service
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD // Use app password for Gmail
      }
    });
  }

  private async loadTemplate(templateName: string, variables: any): Promise<EmailTemplate> {
    const templatePath = path.join(__dirname, '../../templates/email', `${templateName}.hbs`);
    const templateContent = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);
    const html = template(variables);

    // Template-specific subjects
    const subjects = {
      'email-verification': 'Verify Your Email Address',
      'password-reset': 'Reset Your Password',
      'provider-approved': 'Your Provider Account Has Been Approved!',
      'provider-rejected': 'Provider Application Update',
      'booking-confirmation': 'Booking Confirmed',
      'booking-reminder': 'Booking Reminder'
    };

    return {
      subject: subjects[templateName] || 'Notification from Home Service Platform',
      html
    };
  }

  async sendEmail(to: string, templateName: string, variables: any) {
    try {
      const { subject, html } = await this.loadTemplate(templateName, variables);

      await this.transporter.sendMail({
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to,
        subject,
        html
      });

      console.log(`Email sent successfully to ${to}`);
    } catch (error) {
      console.error('Email send error:', error);
      throw error;
    }
  }
}

const emailService = new EmailService();

// Specific email functions
export const sendVerificationEmail = async (email: string, firstName: string, token: string) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${token}`;
  
  await emailService.sendEmail(email, 'email-verification', {
    firstName,
    verificationUrl,
    platformName: 'Home Service Platform'
  });
};

export const sendPasswordResetEmail = async (email: string, firstName: string, token: string) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  
  await emailService.sendEmail(email, 'password-reset', {
    firstName,
    resetUrl,
    platformName: 'Home Service Platform'
  });
};

export const sendProviderApprovalEmail = async (email: string, firstName: string, isApproved: boolean, notes?: string) => {
  const templateName = isApproved ? 'provider-approved' : 'provider-rejected';
  const loginUrl = `${process.env.FRONTEND_URL}/login`;
  
  await emailService.sendEmail(email, templateName, {
    firstName,
    loginUrl,
    notes,
    platformName: 'Home Service Platform'
  });
};

export default emailService;
```

---

## 📁 File Upload Service

### **Step 7: Create Cloudinary Service**
**File**: `backend/src/services/cloudinary.service.ts`

```typescript
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create storage instances for different upload types
const avatarStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' }
    ]
  } as any
});

const documentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'provider-documents',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    resource_type: 'auto'
  } as any
});

const portfolioStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'provider-portfolio',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [
      { width: 800, height: 600, crop: 'limit', quality: 'auto' }
    ]
  } as any
});

// Multer configurations
export const uploadAvatar = multer({ 
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export const uploadDocuments = multer({ 
  storage: documentStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export const uploadPortfolio = multer({ 
  storage: portfolioStorage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Multi-field upload for provider registration
export const uploadProviderFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Allow images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and PDFs are allowed.'), false);
    }
  }
}).fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'identityDocument', maxCount: 1 },
  { name: 'businessLicense', maxCount: 1 },
  { name: 'certifications', maxCount: 5 },
  { name: 'portfolioImages', maxCount: 10 }
]);

// Direct upload function
export const uploadToCloudinary = async (filePath: string, folder: string) => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: folder,
      resource_type: 'auto',
    });
    return result;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};

// Delete from Cloudinary
export const deleteFromCloudinary = async (publicId: string) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

export default cloudinary;
```

---

## 🛣️ Routes Implementation

### **Step 8: Create Auth Routes**
**File**: `backend/src/routes/auth.routes.ts`

```typescript
import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticate, requireRole, rateLimit } from '../middleware/auth.middleware';
import { validateRegistration, validateLogin } from '../middleware/validation.middleware';
import { uploadProviderFiles } from '../services/cloudinary.service';

const router = Router();

// Rate limiting for auth endpoints
const authRateLimit = rateLimit(5, 15 * 60 * 1000); // 5 requests per 15 minutes

// Registration routes
router.post('/register/customer', 
  authRateLimit,
  validateRegistration('customer'),
  AuthController.registerCustomer
);

router.post('/register/provider',
  authRateLimit,
  uploadProviderFiles,
  validateRegistration('provider'),
  AuthController.registerProvider
);

// Login & Authentication
router.post('/login', 
  authRateLimit,
  validateLogin,
  AuthController.login
);

router.post('/logout', AuthController.logout);

router.post('/refresh-token', AuthController.refreshToken);

router.get('/me', authenticate, AuthController.getMe);

// Email verification
router.get('/verify-email/:token', AuthController.verifyEmail);

router.post('/resend-verification', 
  authRateLimit,
  AuthController.resendVerification
);

// Password management
router.post('/forgot-password', 
  authRateLimit,
  AuthController.forgotPassword
);

router.post('/reset-password/:token', 
  authRateLimit,
  AuthController.resetPassword
);

router.post('/change-password', 
  authenticate,
  AuthController.changePassword
);

// Admin-only route to create admin users
router.post('/register/admin',
  authenticate,
  requireRole(['admin']),
  AuthController.registerCustomer // Reuse customer registration logic but set role to admin
);

export default router;
```

---

## ✅ Validation Middleware

### **Step 9: Create Validation Middleware**
**File**: `backend/src/middleware/validation.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

// Validation schemas
const customerRegistrationSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
    .messages({
      'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character'
    }),
  phone: Joi.string().pattern(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/).optional(),
  preferences: Joi.object({
    categories: Joi.array().items(Joi.string()).optional(),
    maxDistance: Joi.number().min(1).max(100).optional(),
    priceRange: Joi.object({
      min: Joi.number().min(0).optional(),
      max: Joi.number().min(1).optional()
    }).optional()
  }).optional(),
  notificationPreferences: Joi.object({
    email: Joi.boolean().optional(),
    sms: Joi.boolean().optional(),
    push: Joi.boolean().optional(),
    marketing: Joi.boolean().optional()
  }).optional(),
  agreeToTerms: Joi.boolean().valid(true).required(),
  agreeToPrivacy: Joi.boolean().valid(true).required(),
  marketingOptIn: Joi.boolean().optional()
});

const providerRegistrationSchema = Joi.object({
  // Personal Info
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  phone: Joi.string().pattern(/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/).required(),
  
  // Business Info
  businessName: Joi.string().min(2).max(100).required(),
  businessType: Joi.string().valid('individual', 'company').required(),
  businessDescription: Joi.string().min(50).max(1000).required(),
  yearsOfExperience: Joi.number().min(0).max(50).required(),
  
  // Services
  primaryCategory: Joi.string().required(),
  subcategories: Joi.array().items(Joi.string()).min(1).required(),
  specializations: Joi.array().items(Joi.string()).optional(),
  
  // Location
  businessAddress: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    zipCode: Joi.string().required(),
    country: Joi.string().default('US')
  }).required(),
  serviceAreas: Joi.array().items(Joi.string()).min(1).required(),
  coordinates: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required()
  }).required(),
  isMobile: Joi.boolean().optional(),
  
  // Terms
  agreeToProviderTerms: Joi.boolean().valid(true).required(),
  agreeToCommissionStructure: Joi.boolean().valid(true).required(),
  agreeToBackgroundCheck: Joi.boolean().valid(true).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

const resetPasswordSchema = Joi.object({
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required()
});

// Generic validation middleware
const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true 
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    req.body = value;
    next();
  };
};

// Exported validation middlewares
export const validateRegistration = (type: 'customer' | 'provider') => {
  const schema = type === 'customer' ? customerRegistrationSchema : providerRegistrationSchema;
  return validate(schema);
};

export const validateLogin = validate(loginSchema);
export const validateForgotPassword = validate(forgotPasswordSchema);
export const validateResetPassword = validate(resetPasswordSchema);
export const validateChangePassword = validate(changePasswordSchema);

// File validation for uploads
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.files) {
    return next();
  }

  const files = req.files as any;
  const errors: string[] = [];

  // Validate identity document
  if (files.identityDocument && files.identityDocument.length > 0) {
    const file = files.identityDocument[0];
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype)) {
      errors.push('Identity document must be a JPEG, PNG, or PDF file');
    }
  }

  // Validate business license
  if (files.businessLicense && files.businessLicense.length > 0) {
    const file = files.businessLicense[0];
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype)) {
      errors.push('Business license must be a JPEG, PNG, or PDF file');
    }
  }

  // Validate portfolio images
  if (files.portfolioImages && files.portfolioImages.length > 0) {
    files.portfolioImages.forEach((file: any, index: number) => {
      if (!file.mimetype.startsWith('image/')) {
        errors.push(`Portfolio image ${index + 1} must be an image file`);
      }
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'File validation failed',
      details: errors
    });
  }

  next();
};

export default {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword,
  validateFileUpload
};
```

---

## 🌱 Database Seeding

### **Step 10: Create Database Seeder**
**File**: `backend/src/seeders/categories.seeder.ts`

```typescript
import mongoose from 'mongoose';
import ServiceCategory from '../models/serviceCategory.model';
import { connectDB } from '../config/database';

const categories = [
  {
    name: 'Beauty',
    slug: 'beauty',
    description: 'Professional beauty and grooming services',
    icon: 'beauty-icon',
    sortOrder: 1,
    subcategories: [
      { name: 'Hair Styling', slug: 'hair-styling', description: 'Professional hair cutting, styling, and treatments' },
      { name: 'Makeup', slug: 'makeup', description: 'Professional makeup services for events and occasions' },
      { name: 'Facials', slug: 'facials', description: 'Professional facial treatments and skincare' },
      { name: 'Nails', slug: 'nails', description: 'Manicure, pedicure, and nail art services' },
      { name: 'Eyebrows & Lashes', slug: 'eyebrows-lashes', description: 'Eyebrow shaping and lash extensions' }
    ]
  },
  {
    name: 'Wellness',
    slug: 'wellness',
    description: 'Relaxation and wellness services',
    icon: 'wellness-icon',
    sortOrder: 2,
    subcategories: [
      { name: 'Massage', slug: 'massage', description: 'Therapeutic and relaxation massage services' },
      { name: 'Spa Treatments', slug: 'spa-treatments', description: 'Professional spa and relaxation treatments' },
      { name: 'Aromatherapy', slug: 'aromatherapy', description: 'Aromatherapy and essential oil treatments' },
      { name: 'Meditation', slug: 'meditation', description: 'Guided meditation and mindfulness sessions' }
    ]
  },
  {
    name: 'Fitness',
    slug: 'fitness',
    description: 'Health and fitness services',
    icon: 'fitness-icon',
    sortOrder: 3,
    subcategories: [
      { name: 'Personal Training', slug: 'personal-training', description: 'One-on-one fitness training sessions' },
      { name: 'Yoga', slug: 'yoga', description: 'Private and group yoga sessions' },
      { name: 'Pilates', slug: 'pilates', description: 'Pilates instruction and training' },
      { name: 'Nutrition', slug: 'nutrition', description: 'Nutritional counseling and meal planning' },
      { name: 'Dance', slug: 'dance', description: 'Dance lessons and choreography' }
    ]
  },
  {
    name: 'Home Care',
    slug: 'home-care',
    description: 'Home maintenance and care services',
    icon: 'home-care-icon',
    sortOrder: 4,
    subcategories: [
      { name: 'Cleaning', slug: 'cleaning', description: 'Residential cleaning services' },
      { name: 'Plumbing', slug: 'plumbing', description: 'Plumbing repair and installation' },
      { name: 'Electrical', slug: 'electrical', description: 'Electrical repair and installation' },
      { name: 'Gardening', slug: 'gardening', description: 'Garden maintenance and landscaping' },
      { name: 'Handyman', slug: 'handyman', description: 'General home repair and maintenance' }
    ]
  },
  {
    name: 'Tutoring',
    slug: 'tutoring',
    description: 'Educational and tutoring services',
    icon: 'education-icon',
    sortOrder: 5,
    subcategories: [
      { name: 'Academic Tutoring', slug: 'academic-tutoring', description: 'Subject-specific academic tutoring' },
      { name: 'Language Learning', slug: 'language-learning', description: 'Foreign language instruction' },
      { name: 'Music Lessons', slug: 'music-lessons', description: 'Private music instrument lessons' },
      { name: 'Art Classes', slug: 'art-classes', description: 'Art and drawing instruction' },
      { name: 'Test Prep', slug: 'test-prep', description: 'Standardized test preparation' }
    ]
  }
];

export const seedCategories = async () => {
  try {
    console.log('🌱 Seeding service categories...');

    // Clear existing categories
    await ServiceCategory.deleteMany({});

    // Insert new categories
    await ServiceCategory.insertMany(categories);

    console.log('✅ Service categories seeded successfully');
    console.log(`📊 Added ${categories.length} categories with ${categories.reduce((acc, cat) => acc + cat.subcategories.length, 0)} subcategories`);

  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    throw error;
  }
};

// Run seeder if called directly
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await seedCategories();
      process.exit(0);
    } catch (error) {
      console.error('Seeding failed:', error);
      process.exit(1);
    }
  })();
}
```

---

## 🧪 Testing Implementation

### **Step 11: Create Auth Tests**
**File**: `backend/src/__tests__/auth.test.ts`

```typescript
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';
import User from '../models/user.model';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';

describe('Authentication Endpoints', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await CustomerProfile.deleteMany({});
    await ProviderProfile.deleteMany({});
  });

  describe('POST /api/auth/register/customer', () => {
    it('should register a new customer successfully', async () => {
      const customerData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        phone: '1234567890',
        agreeToTerms: true,
        agreeToPrivacy: true
      };

      const response = await request(app)
        .post('/api/auth/register/customer')
        .send(customerData)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(customerData.email);
      expect(response.body.user.role).toBe('customer');

      // Check if customer profile was created
      const customerProfile = await CustomerProfile.findOne({ userId: response.body.user.id });
      expect(customerProfile).toBeTruthy();
    });

    it('should return error for duplicate email', async () => {
      const customerData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        agreeToTerms: true,
        agreeToPrivacy: true
      };

      // Register first user
      await request(app)
        .post('/api/auth/register/customer')
        .send(customerData)
        .expect(201);

      // Try to register with same email
      const response = await request(app)
        .post('/api/auth/register/customer')
        .send(customerData)
        .expect(400);

      expect(response.body.error).toBe('User already exists with this email');
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        firstName: 'J', // Too short
        lastName: '',    // Empty
        email: 'invalid-email', // Invalid format
        password: '123', // Too weak
        agreeToTerms: false // Must be true
      };

      const response = await request(app)
        .post('/api/auth/register/customer')
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toHaveLength(5);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create test user
      const user = new User({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password123!',
        role: 'customer',
        isEmailVerified: true
      });
      await user.save();
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(loginData.email);
      expect(response.body).toHaveProperty('redirectPath');
    });

    it('should return error for invalid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Invalid email or password');
    });

    it('should lock account after 5 failed attempts', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'WrongPassword123!'
      };

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(401);
      }

      // 6th attempt should return account locked error
      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(423);

      expect(response.body.error).toContain('Account is locked');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;
    let userId: string;

    beforeEach(async () => {
      // Create and login user
      const user = new User({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password123!',
        role: 'customer',
        isEmailVerified: true
      });
      await user.save();
      
      authToken = user.generateAuthToken();
      userId = user._id.toString();

      // Create customer profile
      const customerProfile = new CustomerProfile({ userId: user._id });
      await customerProfile.save();
    });

    it('should return user data for authenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.user.id).toBe(userId);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.profile).toBeTruthy();
    });

    it('should return error for unauthenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error).toBe('Access token required');
    });

    it('should return error for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });
  });

  describe('POST /api/auth/change-password', () => {
    let authToken: string;

    beforeEach(async () => {
      const user = new User({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password123!',
        role: 'customer',
        isEmailVerified: true
      });
      await user.save();
      
      authToken = user.generateAuthToken();
    });

    it('should change password successfully', async () => {
      const passwordData = {
        currentPassword: 'Password123!',
        newPassword: 'NewPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(200);

      expect(response.body.message).toBe('Password changed successfully');

      // Test login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'NewPassword123!'
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('token');
    });

    it('should return error for incorrect current password', async () => {
      const passwordData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(passwordData)
        .expect(400);

      expect(response.body.error).toBe('Current password is incorrect');
    });
  });
});
```

---

## 🚀 Implementation Commands

### **Step 12: NPM Scripts for Development**
**File**: Add to `backend/package.json`

```json
{
  "scripts": {
    "dev": "nodemon src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "seed:categories": "ts-node src/seeders/categories.seeder.ts",
    "db:setup": "npm run seed:categories"
  }
}
```

### **Step 13: Environment Variables**
**File**: `backend/.env.example`

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/home_service_marketplace

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=15m
JWT_REFRESH_SECRET=your-refresh-token-secret

# Bcrypt
BCRYPT_SALT_ROUNDS=10

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Email Templates
FROM_NAME=Home Service Platform
FROM_EMAIL=noreply@homeservice.com

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Stripe (Optional - for payments)
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_WEBHOOK_SECRET=your-webhook-secret
```

---

## ⚡ Quick Implementation Guide

### **Run These Commands:**

1. **Install Dependencies:**
```bash
cd backend
npm install bcryptjs @types/bcryptjs jsonwebtoken @types/jsonwebtoken
npm install joi @types/joi multer @types/multer cloudinary multer-storage-cloudinary
npm install nodemailer @types/nodemailer handlebars @types/handlebars
npm install jest @types/jest supertest @types/supertest mongodb-memory-server
```

2. **Create Email Templates Directory:**
```bash
mkdir -p src/templates/email
```

3. **Set Up Database:**
```bash
npm run db:setup
```

4. **Run Tests:**
```bash
npm run test
```

5. **Start Development Server:**
```bash
npm run dev
```

---

This implementation guide provides all the backend components needed for a complete authentication system with role-based access control, file uploads, email verification, and comprehensive testing.
