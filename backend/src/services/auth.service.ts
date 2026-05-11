import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/user.model';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import { ApiError } from '../utils/ApiError';
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from './email.service';
import {
  CustomerRegistrationDTO,
  ProviderRegistrationDTO,
  AdminRegistrationDTO,
  AuthResult,
  LoginResult,
  PasswordResetResult,
  EmailVerificationResult,
  ProfileResult,
  TokenPair,
  UserResponse,
} from '../dto/auth.dto';

// ============================================
// Token Generation Helpers
// ============================================

const generateTokens = (user: any): TokenPair => {
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();
  return { accessToken, refreshToken };
};

const formatUserResponse = (user: any): UserResponse => ({
  id: user._id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
  accountStatus: user.accountStatus,
  loyaltyCoins: user.loyaltySystem?.coins,
  tier: user.loyaltySystem?.tier,
  referralCode: user.loyaltySystem?.referralCode,
  avatar: user.avatar,
  phone: user.phone,
  bio: user.bio,
  lastLogin: user.lastLogin,
});

// ============================================
// AuthService Class
// ============================================

export class AuthService {
  // ========================================
  // Customer Registration
  // ========================================

  async registerCustomer(data: CustomerRegistrationDTO): Promise<AuthResult> {
    // Check if user already exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new ApiError(409, 'User with this email already exists');
    }

    // Handle referral code
    let referredBy;
    if (data.referralCode) {
      const referrer = await User.findOne({
        'loyaltySystem.referralCode': data.referralCode,
      });
      if (referrer) {
        referredBy = referrer._id;
      }
    }

    // Create user
    const userData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      phone: data.phone,
      role: 'customer',
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      address: data.address,
      socialProfiles: {
        followers: [],
        following: [],
        isPublicProfile: true,
        profileViews: 0,
        lastActiveAt: new Date(),
      },
      loyaltySystem: {
        coins: 0,
        tier: 'bronze',
        referredBy,
        streakDays: 0,
        totalEarned: 0,
        totalSpent: 0,
        pointsHistory: [],
      },
      communicationPreferences: {
        email: {
          marketing: data.communicationPreferences?.email?.marketing || false,
          bookingUpdates: data.communicationPreferences?.email?.bookingUpdates !== false,
          reminders: data.communicationPreferences?.email?.reminders !== false,
          newsletters: data.communicationPreferences?.email?.newsletters || false,
          promotions: data.communicationPreferences?.email?.promotions || false,
        },
        sms: {
          bookingUpdates: data.communicationPreferences?.sms?.bookingUpdates !== false,
          reminders: data.communicationPreferences?.sms?.reminders !== false,
          promotions: data.communicationPreferences?.sms?.promotions || false,
        },
        push: {
          bookingUpdates: data.communicationPreferences?.push?.bookingUpdates !== false,
          reminders: data.communicationPreferences?.push?.reminders !== false,
          newMessages: data.communicationPreferences?.push?.newMessages !== false,
          promotions: data.communicationPreferences?.push?.promotions || false,
        },
        language: data.communicationPreferences?.language || 'en',
        timezone: data.communicationPreferences?.timezone || 'UTC',
        currency: data.communicationPreferences?.currency || 'AED',
      },
      aiPersonalization: {
        preferences: {
          preferredServiceTypes: [],
          preferredProviders: [],
          preferredTimeSlots: [],
          preferredDays: [],
          locationPreference: 'both',
        },
        behaviorData: {
          searchHistory: [],
          bookingPatterns: {
            averageSpend: 0,
            bookingFrequency: 0,
            seasonalPreferences: [],
            timePreferences: [],
          },
          interactionHistory: {
            profileViews: [],
            favoriteActions: [],
          },
        },
        recommendations: {
          suggestedProviders: [],
          suggestedServices: [],
          personalizedOffers: [],
        },
      },
    };

    const user = new User(userData);
    await user.save();

    // Create customer profile
    const customerProfile = new CustomerProfile({
      userId: user._id,
      preferences: {
        categories: [],
        maxDistance: 25,
        priceRange: { min: 0, max: 1000 },
        preferredDays: [],
        preferredTimeSlots: [],
        locationPreference: 'both',
      },
      addresses: data.address
        ? [
            {
              label: 'Home',
              type: 'home',
              street: data.address.street,
              city: data.address.city,
              state: data.address.state,
              zipCode: data.address.zipCode,
              country: data.address.country || 'AE',
              coordinates: data.address.coordinates,
              isDefault: true,
              createdAt: new Date(),
            },
          ]
        : [],
      paymentMethods: [],
      favoriteProviders: [],
      loyaltyData: {
        totalPointsEarned: 0,
        totalPointsSpent: 0,
        currentPoints: 0,
        tier: 'bronze',
        tierProgress: {
          currentTierPoints: 0,
          nextTierRequirement: 1000,
          nextTier: 'silver',
        },
        achievements: [],
        streakInfo: {
          currentStreak: 0,
          longestStreak: 0,
        },
      },
      bookingHistory: {
        totalBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        totalSpent: 0,
        averageRating: 0,
        favoriteCategories: [],
        seasonalPatterns: [],
      },
      socialActivity: {
        reviewsWritten: 0,
        helpfulVotes: 0,
        photosShared: 0,
        followersCount: 0,
        followingCount: 0,
        profileViews: 0,
        socialScore: 0,
      },
      communicationPreferences: {
        preferredContactMethod: 'push',
        notificationSettings: {
          bookingConfirmation: true,
          bookingReminders: true,
          providerUpdates: true,
          promotionsAndOffers: false,
          loyaltyUpdates: true,
          socialActivity: true,
          weeklyDigest: false,
        },
        reminderTiming: {
          booking24Hours: true,
          booking2Hours: true,
          booking30Minutes: false,
        },
      },
      privacySettings: {
        profileVisibility: 'public',
        showBookingHistory: false,
        showReviews: true,
        showLocation: true,
        allowProviderContact: true,
        shareDataForRecommendations: true,
      },
      accessibilityNeeds: {
        hasSpecialRequirements: false,
      },
    });

    await customerProfile.save();

    // Award referral/welcome bonus
    await this.awardCustomerWelcomeBonus(user, referredBy);

    // Auto-verify email (skip email verification)
    user.isEmailVerified = true;
    await user.save();

    // Generate tokens
    const tokens = generateTokens(user);

    return {
      user: formatUserResponse(user),
      tokens,
      requiresEmailVerification: false,
    };
  }

  private async awardCustomerWelcomeBonus(user: any, referredBy?: any): Promise<void> {
    if (referredBy) {
      const referrer = await User.findById(referredBy);
      if (referrer) {
        await referrer.addLoyaltyPoints(500, 'referral', `Referral bonus for ${user.firstName} ${user.lastName}`, undefined);
        await user.addLoyaltyPoints(250, 'referral', 'Welcome bonus for using referral code', undefined);
      }
    } else {
      await user.addLoyaltyPoints(100, 'bonus', 'Welcome to the platform!', undefined);
    }
  }

  // ========================================
  // Provider Registration
  // ========================================

  async registerProvider(data: ProviderRegistrationDTO): Promise<AuthResult & { providerProfile?: any }> {
    console.log('🚀 [AuthService] Starting provider registration');

    // Check if user already exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new ApiError(409, 'User with this email already exists');
    }

    // Create provider user
    const userData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      phone: data.phone,
      role: 'provider',
      dateOfBirth: data.dateOfBirth,
      socialProfiles: {
        followers: [],
        following: [],
        isPublicProfile: true,
        profileViews: 0,
        lastActiveAt: new Date(),
      },
      loyaltySystem: {
        coins: 0,
        tier: 'bronze',
        streakDays: 0,
        totalEarned: 0,
        totalSpent: 0,
        pointsHistory: [],
      },
      communicationPreferences: {
        email: {
          marketing: false,
          bookingUpdates: true,
          reminders: true,
          newsletters: false,
          promotions: false,
        },
        sms: {
          bookingUpdates: true,
          reminders: true,
          promotions: false,
        },
        push: {
          bookingUpdates: true,
          reminders: true,
          newMessages: true,
          promotions: false,
        },
        language: 'en',
        timezone: 'UTC',
        currency: 'AED',
      },
      aiPersonalization: {
        preferences: {
          preferredServiceTypes: data.services?.map((s) => s.category) || [],
          preferredProviders: [],
          preferredTimeSlots: [],
          preferredDays: [],
          locationPreference: 'both',
        },
        behaviorData: {
          searchHistory: [],
          bookingPatterns: {
            averageSpend: 0,
            bookingFrequency: 0,
            seasonalPreferences: [],
            timePreferences: [],
          },
          interactionHistory: {
            profileViews: [],
            favoriteActions: [],
          },
        },
        recommendations: {
          suggestedProviders: [],
          suggestedServices: [],
          personalizedOffers: [],
        },
      },
    };

    const user = new User(userData);
    await user.save();

    // Create provider profile
    const providerProfile = new ProviderProfile({
      userId: user._id,
      tier: 'standard',
      businessInfo: {
        businessName: data.businessInfo.businessName,
        businessType: data.businessInfo.businessType || 'individual',
        description: data.businessInfo.description,
        tagline: data.businessInfo.tagline,
        website: data.businessInfo.website,
        establishedDate: data.businessInfo.establishedDate,
        businessHours: {
          monday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          tuesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          wednesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          thursday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          friday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
          saturday: { isOpen: true, openTime: '10:00', closeTime: '16:00' },
          sunday: { isOpen: false },
        },
        serviceRadius: data.businessInfo.serviceRadius || 25,
        instantBooking: false,
        advanceBookingDays: 30,
      },
      instagramStyleProfile: {
        profilePhoto: `https://ui-avatars.com/api/?name=${data.firstName}+${data.lastName}&background=random&size=300`,
        isVerified: false,
        verificationBadges: [],
        bio: data.businessInfo.description || '',
        highlights: [],
        posts: [],
        followersCount: 0,
        followingCount: 0,
        totalLikes: 0,
        engagementRate: 0,
      },
      services: data.services?.map((service) => ({
        name: service.name,
        category: service.category,
        subcategory: service.subcategory,
        description: service.description,
        duration: service.duration,
        price: {
          amount: service.price.amount,
          currency: service.price.currency || 'AED',
          type: service.price.type || 'fixed',
        },
        images: [],
        isActive: true,
        isPopular: false,
        tags: service.tags || [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      portfolio: {
        featured: [],
        certifications: [],
        awards: [],
      },
      availability: {
        schedule: {
          monday: { isAvailable: true, timeSlots: [] },
          tuesday: { isAvailable: true, timeSlots: [] },
          wednesday: { isAvailable: true, timeSlots: [] },
          thursday: { isAvailable: true, timeSlots: [] },
          friday: { isAvailable: true, timeSlots: [] },
          saturday: { isAvailable: true, timeSlots: [] },
          sunday: { isAvailable: false, timeSlots: [] },
        },
        exceptions: [],
        bufferTime: 15,
        maxAdvanceBooking: 30,
        minNoticeTime: 24,
        autoAcceptBookings: false,
      },
      locationInfo: {
        primaryAddress: {
          ...data.locationInfo.primaryAddress,
          coordinates: data.locationInfo.primaryAddress?.coordinates || {
            lat: 25.2048,
            lng: 55.2708,
          },
        },
        serviceAreas: [],
        travelFee: {
          baseFee: 0,
          perKmFee: 0,
          maxTravelDistance: data.businessInfo.serviceRadius || 25,
        },
        mobileService: data.locationInfo.mobileService !== false,
        hasFixedLocation: data.locationInfo.hasFixedLocation || false,
      },
      reviewsData: {
        averageRating: 0,
        totalReviews: 0,
        ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        recentReviews: [],
        responseRate: 0,
        avgResponseTime: 0,
      },
      analytics: {
        profileViews: [],
        bookingStats: {
          totalBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          noShowBookings: 0,
          averageBookingValue: 0,
          repeatCustomerRate: 0,
        },
        revenueStats: {
          totalEarnings: 0,
          currentMonthEarnings: 0,
          averageMonthlyEarnings: 0,
          topEarningServices: [],
        },
        customerMetrics: {
          totalCustomers: 0,
          repeatCustomers: 0,
          customerRetentionRate: 0,
          averageCustomerLifetimeValue: 0,
        },
        performanceMetrics: {
          acceptanceRate: 0,
          responseTime: 0,
          completionRate: 0,
          punctualityScore: 0,
          qualityScore: 0,
        },
      },
      marketing: {
        promotions: [],
        happyHours: [],
        packages: [],
        referralProgram: {
          isActive: false,
          referrerReward: 0,
          refereeReward: 0,
        },
      },
      teamManagement: {
        teamMembers: [],
        departments: [],
      },
      financials: {
        bankAccount: {
          isVerified: false,
        },
        paymentMethods: {
          stripe: { isConnected: false, capabilities: [] },
          paypal: { isConnected: false },
        },
        taxInfo: {},
        payout: {
          frequency: 'weekly',
          minimumAmount: 50,
          pendingAmount: 0,
        },
      },
      verificationStatus: {
        overall: 'pending',
        identity: { status: 'pending', documents: [] },
        business: { status: 'pending', documents: [] },
        background: { status: 'pending' },
      },
      settings: {
        autoAcceptBookings: false,
        instantBookingEnabled: false,
        requirePaymentUpfront: false,
        allowRescheduling: true,
        cancellationPolicy: {
          freeUntilHours: 24,
          partialRefundUntilHours: 12,
          noRefundAfterHours: 2,
        },
        communicationPreferences: {
          bookingNotifications: true,
          reviewNotifications: true,
          marketingEmails: false,
          smsNotifications: true,
        },
        privacySettings: {
          showExactLocation: false,
          showPhoneNumber: true,
          showEmail: false,
        },
      },
      isProfileComplete: false,
      completionPercentage: 0,
    });

    await providerProfile.save();

    // Create services in the services collection
    if (data.services && data.services.length > 0) {
      await this.createProviderServices(user._id, data.services, data.locationInfo);
    }

    // Award provider welcome bonus
    await user.addLoyaltyPoints(500, 'bonus', 'Welcome to our provider community!', undefined);

    // Auto-verify email
    user.isEmailVerified = true;
    await user.save();

    // Generate tokens
    const tokens = generateTokens(user);

    return {
      user: formatUserResponse(user),
      tokens,
      requiresEmailVerification: false,
      providerProfile: {
        id: providerProfile._id,
        businessName: providerProfile.businessInfo.businessName,
        completionPercentage: providerProfile.completionPercentage,
        verificationStatus: providerProfile.verificationStatus,
        servicesCount: providerProfile.services.length,
      },
    };
  }

  private async createProviderServices(providerId: any, services: any[], locationInfo: any): Promise<void> {
    // Validate and normalize category/subcategory names against database
    const allCategories = await ServiceCategory.find({ isActive: true }).lean();
    const categoryMap = new Map<string, { exactName: string; subcategoryMap: Map<string, string> }>();

    for (const cat of allCategories) {
      const subcatMap = new Map<string, string>();
      for (const sub of (cat as any).subcategories || []) {
        if (sub.isActive !== false) {
          subcatMap.set(sub.name.toLowerCase(), sub.name);
        }
      }
      categoryMap.set((cat as any).name.toLowerCase(), {
        exactName: (cat as any).name,
        subcategoryMap: subcatMap,
      });
    }

    // Validate and normalize each service's category/subcategory
    for (const service of services) {
      const catLower = service.category?.toLowerCase();
      const catData = categoryMap.get(catLower);

      if (!catData) {
        const validCats = Array.from(categoryMap.values()).map((c) => c.exactName);
        throw new ApiError(400, `Invalid category "${service.category}". Valid categories: ${validCats.join(', ')}`);
      }

      service.category = catData.exactName;

      if (service.subcategory) {
        const subLower = service.subcategory.toLowerCase();
        const exactSubcat = catData.subcategoryMap.get(subLower);

        if (!exactSubcat) {
          const validSubs = Array.from(catData.subcategoryMap.values());
          throw new ApiError(
            400,
            `Invalid subcategory "${service.subcategory}" for category "${catData.exactName}". Valid subcategories: ${validSubs.join(', ')}`
          );
        }
        service.subcategory = exactSubcat;
      }
    }

    // Create service documents
    for (const service of services) {
      try {
        const newService = new Service({
          providerId: providerId,
          name: service.name,
          category: service.category,
          subcategory: service.subcategory || '',
          description: service.description,
          shortDescription: service.description?.substring(0, 100) || '',
          duration: service.duration,
          price: {
            amount: service.price.amount,
            currency: service.price.currency || 'AED',
            type: service.price.type || 'fixed',
          },
          location: {
            coordinates: {
              type: 'Point',
              coordinates: [
                locationInfo.primaryAddress?.coordinates?.lng || 0,
                locationInfo.primaryAddress?.coordinates?.lat || 0,
              ],
            },
            address: {
              street: locationInfo.primaryAddress?.street || '',
              city: locationInfo.primaryAddress?.city || '',
              state: locationInfo.primaryAddress?.state || '',
              zipCode: locationInfo.primaryAddress?.zipCode || '',
              country: locationInfo.primaryAddress?.country || 'AE',
            },
          },
          availability: {
            schedule: {
              monday: { isAvailable: true, timeSlots: [] },
              tuesday: { isAvailable: true, timeSlots: [] },
              wednesday: { isAvailable: true, timeSlots: [] },
              thursday: { isAvailable: true, timeSlots: [] },
              friday: { isAvailable: true, timeSlots: [] },
              saturday: { isAvailable: true, timeSlots: [] },
              sunday: { isAvailable: false, timeSlots: [] },
            },
            instantBooking: false,
            advanceBookingDays: 7,
          },
          status: 'pending_review',
          isActive: false,
          tags: service.tags || [],
          requirements: [],
          includedItems: [],
          rating: {
            average: 0,
            count: 0,
            distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          },
          searchMetadata: {
            searchCount: 0,
            clickCount: 0,
            bookingCount: 0,
            popularityScore: 0,
            searchKeywords: [service.name, service.category, service.subcategory].filter(Boolean),
          },
        });

        await newService.save();
        console.log(`✅ [AuthService] Created service: ${newService.name}`);
      } catch (serviceError) {
        console.error(`❌ [AuthService] Failed to create service ${service.name}:`, serviceError);
      }
    }
  }

  // ========================================
  // Admin Registration
  // ========================================

  async registerAdmin(data: AdminRegistrationDTO, creatorId: string): Promise<AuthResult> {
    // Only existing admins can create new admin users
    if (!creatorId) {
      throw new ApiError(403, 'Only existing administrators can create new admin accounts');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new ApiError(409, 'User with this email already exists');
    }

    // Create admin user
    const userData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      phone: data.phone,
      role: 'admin',
      isEmailVerified: true,
      accountStatus: 'active',
      socialProfiles: {
        followers: [],
        following: [],
        isPublicProfile: false,
        profileViews: 0,
        lastActiveAt: new Date(),
      },
      loyaltySystem: {
        coins: 0,
        tier: 'platinum',
        streakDays: 0,
        totalEarned: 0,
        totalSpent: 0,
        pointsHistory: [],
      },
      communicationPreferences: {
        email: {
          marketing: false,
          bookingUpdates: true,
          reminders: true,
          newsletters: false,
          promotions: false,
        },
        sms: {
          bookingUpdates: true,
          reminders: false,
          promotions: false,
        },
        push: {
          bookingUpdates: true,
          reminders: true,
          newMessages: true,
          promotions: false,
        },
        language: 'en',
        timezone: 'UTC',
        currency: 'AED',
      },
      aiPersonalization: {
        preferences: {
          preferredServiceTypes: [],
          preferredProviders: [],
          preferredTimeSlots: [],
          preferredDays: [],
          locationPreference: 'both',
        },
        behaviorData: {
          searchHistory: [],
          bookingPatterns: {
            averageSpend: 0,
            bookingFrequency: 0,
            seasonalPreferences: [],
            timePreferences: [],
          },
          interactionHistory: {
            profileViews: [],
            favoriteActions: [],
          },
        },
        recommendations: {
          suggestedProviders: [],
          suggestedServices: [],
          personalizedOffers: [],
        },
      },
      createdBy: creatorId,
    };

    const admin = new User(userData);
    await admin.save();

    // Send welcome email
    try {
      await sendWelcomeEmail(admin.email, admin.firstName, 'admin');
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    return {
      user: formatUserResponse(admin),
      tokens: generateTokens(admin),
      requiresEmailVerification: false,
    };
  }

  // ========================================
  // Login
  // ========================================

  async login(email: string, password: string, ip?: string): Promise<LoginResult> {
    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      throw new ApiError(401, 'Invalid email or password');
    }

    // Check if account is locked
    if (user.isLocked()) {
      const lockTimeRemaining = Math.ceil((user.lockUntil!.getTime() - Date.now()) / (1000 * 60));
      throw new ApiError(423, `Account is locked. Try again in ${lockTimeRemaining} minutes.`);
    }

    // Check if account is active
    if (!user.isActive || user.isDeleted) {
      throw new ApiError(401, 'Account has been deactivated');
    }

    // Check account status
    if (user.accountStatus === 'suspended') {
      throw new ApiError(403, 'Account has been suspended. Please contact support.');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await user.incLoginAttempts();
      throw new ApiError(401, 'Invalid email or password');
    }

    // Check email verification if enforcement is enabled
    if (!user.isEmailVerified && process.env.ENFORCE_EMAIL_VERIFICATION === 'true') {
      throw new ApiError(403, 'Please verify your email before logging in.');
    }

    // Reset login attempts on successful login
    if (user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    await user.updateLastLogin(ip);

    // Generate tokens
    const tokens = generateTokens(user);

    // Get role-specific data
    const roleSpecificData = await this.getRoleSpecificData(user);

    // Determine redirect URL
    const redirectUrl = this.getRedirectUrl(user.role, roleSpecificData);

    return {
      user: formatUserResponse(user),
      tokens,
      requiresEmailVerification: !user.isEmailVerified,
      redirectUrl,
      roleSpecificData,
    };
  }

  private async getRoleSpecificData(user: any): Promise<any> {
    if (user.role === 'customer') {
      const customerProfile = await CustomerProfile.findOne({ userId: user._id });
      return {
        customerProfile: customerProfile
          ? {
              id: customerProfile._id,
              favoriteProvidersCount: customerProfile.favoriteProviders.length,
              totalBookings: customerProfile.bookingHistory.totalBookings,
              loyaltyPoints: customerProfile.loyaltyData.currentPoints,
              tier: customerProfile.loyaltyData.tier,
            }
          : null,
      };
    } else if (user.role === 'provider') {
      const providerProfile = await ProviderProfile.findOne({ userId: user._id });
      return {
        providerProfile: providerProfile
          ? {
              id: providerProfile._id,
              businessName: providerProfile.businessInfo.businessName,
              completionPercentage: providerProfile.completionPercentage,
              verificationStatus: providerProfile.verificationStatus,
              servicesCount: providerProfile.services.length,
              averageRating: providerProfile.reviewsData.averageRating,
              totalEarnings: providerProfile.analytics.revenueStats.totalEarnings,
            }
          : null,
      };
    }
    return {};
  }

  private getRedirectUrl(role: string, roleData: any): string {
    if (role === 'customer') return '/customer/dashboard';
    if (role === 'provider') {
      if (roleData.providerProfile?.completionPercentage < 80) return '/provider/complete-profile';
      if (roleData.providerProfile?.verificationStatus?.overall !== 'approved') return '/provider/verification-pending';
      return '/provider/dashboard';
    }
    if (role === 'admin') return '/admin/dashboard';
    return '/';
  }

  // ========================================
  // Logout
  // ========================================

  async logout(userId: string, refreshToken: string): Promise<void> {
    const user = await User.findById(userId);
    if (user && refreshToken) {
      user.refreshTokens = user.refreshTokens.filter((token) => token !== refreshToken);
      await user.save({ validateBeforeSave: false });
    }
  }

  async logoutAll(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (user) {
      user.refreshTokens = [];
      await user.save({ validateBeforeSave: false });
    }
  }

  // ========================================
  // Token Refresh
  // ========================================

  async refreshToken(token: string): Promise<{ tokens: TokenPair; user: UserResponse }> {
    // Verify refresh token
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as any;

    // Find user and check if refresh token exists
    const user = await User.findById(decoded.id);

    if (!user || !user.refreshTokens.includes(token)) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    // Check if user is still active
    if (!user.isActive || user.isDeleted || user.accountStatus === 'suspended') {
      throw new ApiError(401, 'User account is no longer active');
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    // Remove old refresh token and add new one
    user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
    await user.save({ validateBeforeSave: false });

    return {
      tokens,
      user: formatUserResponse(user),
    };
  }

  // ========================================
  // Password Management
  // ========================================

  async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if email exists for security
      return;
    }

    // Generate reset token
    const resetToken = user.generateResetToken();
    await user.save({ validateBeforeSave: false });

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, user.firstName, resetToken);
    } catch (error) {
      // Clear reset token if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      throw new ApiError(500, 'Failed to send password reset email. Please try again.');
    }
  }

  async resetPassword(token: string, password: string): Promise<PasswordResetResult> {
    // Hash the token from URL to compare with stored hashed token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      throw new ApiError(400, 'Password reset token is invalid or has expired');
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.refreshTokens = [];

    await user.save();

    // Generate new tokens
    const tokens = generateTokens(user);

    return {
      user: formatUserResponse(user),
      accessToken: tokens.accessToken,
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ accessToken: string }> {
    const userWithPassword = await User.findById(userId).select('+password');

    if (!userWithPassword) {
      throw new ApiError(404, 'User not found');
    }

    // Verify current password
    const isValid = await userWithPassword.comparePassword(currentPassword);
    if (!isValid) {
      throw new ApiError(400, 'Current password is incorrect');
    }

    // Update password
    userWithPassword.password = newPassword;
    userWithPassword.refreshTokens = [];

    await userWithPassword.save();

    // Generate new access token
    const { accessToken } = generateTokens(userWithPassword);

    return { accessToken };
  }

  // ========================================
  // Email Verification
  // ========================================

  async verifyEmail(token: string): Promise<EmailVerificationResult> {
    // Verify the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;

    if (decoded.purpose !== 'email-verification') {
      throw new ApiError(400, 'Invalid verification token');
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      return { user: formatUserResponse(user) };
    }

    // Check if token matches and hasn't expired
    if (user.verificationToken !== token || (user.verificationExpire && user.verificationExpire < new Date())) {
      throw new ApiError(400, 'Verification token is invalid or has expired');
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationExpire = undefined;

    if (user.accountStatus === 'pending_verification') {
      user.accountStatus = 'active';
    }

    await user.save({ validateBeforeSave: false });

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.firstName, user.role);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    // Award email verification bonus
    if (user.loyaltySystem.totalEarned === 0) {
      await user.addLoyaltyPoints(50, 'bonus', 'Email verification bonus', undefined);
    }

    return { user: formatUserResponse(user) };
  }

  async resendVerificationEmail(email: string): Promise<void> {
    const user = await User.findOne({ email });

    if (!user || user.isEmailVerified) {
      // Don't reveal if email exists for security
      return;
    }

    // Generate new verification token
    const verificationToken = user.generateVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Send verification email
    try {
      await sendVerificationEmail(user.email, user.firstName, verificationToken);
    } catch (error) {
      user.verificationToken = undefined;
      user.verificationExpire = undefined;
      await user.save({ validateBeforeSave: false });
      throw new ApiError(500, 'Failed to send verification email. Please try again.');
    }
  }

  // ========================================
  // Profile Management
  // ========================================

  async getProfile(userId: string): Promise<ProfileResult> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const roleSpecificData = await this.getRoleSpecificData(user);

    return {
      user: formatUserResponse(user),
      ...roleSpecificData,
    };
  }

  async updateProfile(userId: string, updates: any): Promise<ProfileResult> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const allowedUpdates = [
      'firstName', 'lastName', 'phone', 'bio', 'dateOfBirth', 'gender',
      'avatar', 'address', 'socialMediaLinks', 'communicationPreferences',
    ];

    const updateKeys = Object.keys(updates);
    const isValidUpdate = updateKeys.every((update) => allowedUpdates.includes(update));

    if (!isValidUpdate) {
      throw new ApiError(400, 'Invalid updates provided');
    }

    // Update user fields
    updateKeys.forEach((update) => {
      if (update === 'socialMediaLinks') {
        user.socialProfiles.socialMediaLinks = {
          ...user.socialProfiles.socialMediaLinks,
          ...updates[update],
        };
      } else {
        (user as any)[update] = updates[update];
      }
    });

    await user.save();

    return this.getProfile(userId);
  }
}

// Export singleton instance
export const authService = new AuthService();
