import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/user.model';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from '../services/email.service';

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: {
    user: any;
    accessToken?: string;
    refreshToken?: string;
  };
}

// Helper function to generate tokens
const generateTokens = (user: any) => {
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken();
  return { accessToken, refreshToken };
};

// Helper function to set cookie options
const getCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge
});

// Customer Registration
export const registerCustomer = asyncHandler(async (req: Request, res: Response) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      dateOfBirth,
      gender,
      address,
      communicationPreferences,
      referralCode
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError(409, 'User with this email already exists');
    }

    // Handle referral code
    let referredBy;
    if (referralCode) {
      const referrer = await User.findOne({ 
        'loyaltySystem.referralCode': referralCode 
      });
      
      if (referrer) {
        referredBy = referrer._id;
      }
    }

      // Create user
      const userData = {
        firstName,
        lastName,
        email,
        password,
        phone,
        role: 'customer',
        dateOfBirth,
        gender,
        address,
        
        // Social profile initialization
        socialProfiles: {
          followers: [],
          following: [],
          isPublicProfile: true,
          profileViews: 0,
          lastActiveAt: new Date()
        },
        
        // Loyalty system initialization
        loyaltySystem: {
          coins: 0,
          tier: 'bronze',
          referredBy,
          streakDays: 0,
          totalEarned: 0,
          totalSpent: 0,
          pointsHistory: []
        },
        
        // Communication preferences
        communicationPreferences: {
          email: {
            marketing: communicationPreferences?.email?.marketing || false,
            bookingUpdates: communicationPreferences?.email?.bookingUpdates !== false,
            reminders: communicationPreferences?.email?.reminders !== false,
            newsletters: communicationPreferences?.email?.newsletters || false,
            promotions: communicationPreferences?.email?.promotions || false
          },
          sms: {
            bookingUpdates: communicationPreferences?.sms?.bookingUpdates !== false,
            reminders: communicationPreferences?.sms?.reminders !== false,
            promotions: communicationPreferences?.sms?.promotions || false
          },
          push: {
            bookingUpdates: communicationPreferences?.push?.bookingUpdates !== false,
            reminders: communicationPreferences?.push?.reminders !== false,
            newMessages: communicationPreferences?.push?.newMessages !== false,
            promotions: communicationPreferences?.push?.promotions || false
          },
          language: communicationPreferences?.language || 'en',
          timezone: communicationPreferences?.timezone || 'UTC',
          currency: communicationPreferences?.currency || 'AED'
        },
        
        // AI personalization initialization
        aiPersonalization: {
          preferences: {
            preferredServiceTypes: [],
            preferredProviders: [],
            preferredTimeSlots: [],
            preferredDays: [],
            locationPreference: 'both'
          },
          behaviorData: {
            searchHistory: [],
            bookingPatterns: {
              averageSpend: 0,
              bookingFrequency: 0,
              seasonalPreferences: [],
              timePreferences: []
            },
            interactionHistory: {
              profileViews: [],
              favoriteActions: []
            }
          },
          recommendations: {
            suggestedProviders: [],
            suggestedServices: [],
            personalizedOffers: []
          }
        }
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
          locationPreference: 'both'
        },
        addresses: address ? [{
          label: 'Home',
          type: 'home',
          street: address.street,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          country: address.country || 'AE',
          coordinates: address.coordinates,
          isDefault: true,
          createdAt: new Date()
        }] : [],
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
            nextTier: 'silver'
          },
          achievements: [],
          streakInfo: {
            currentStreak: 0,
            longestStreak: 0
          }
        },
        bookingHistory: {
          totalBookings: 0,
          completedBookings: 0,
          cancelledBookings: 0,
          totalSpent: 0,
          averageRating: 0,
          favoriteCategories: [],
          seasonalPatterns: []
        },
        socialActivity: {
          reviewsWritten: 0,
          helpfulVotes: 0,
          photosShared: 0,
          followersCount: 0,
          followingCount: 0,
          profileViews: 0,
          socialScore: 0
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
            weeklyDigest: false
          },
          reminderTiming: {
            booking24Hours: true,
            booking2Hours: true,
            booking30Minutes: false
          }
        },
        privacySettings: {
          profileVisibility: 'public',
          showBookingHistory: false,
          showReviews: true,
          showLocation: true,
          allowProviderContact: true,
          shareDataForRecommendations: true
        },
        accessibilityNeeds: {
          hasSpecialRequirements: false
        }
      });

      await customerProfile.save();

      // Award referral bonus
      if (referredBy) {
        const referrer = await User.findById(referredBy);
        if (referrer) {
          // Award 500 coins to referrer
          await referrer.addLoyaltyPoints(500, 'referral', `Referral bonus for ${user.firstName} ${user.lastName}`, undefined);
          
          // Award 250 welcome coins to new user
          await user.addLoyaltyPoints(250, 'referral', 'Welcome bonus for using referral code', undefined);
        }
      } else {
        // Award standard welcome bonus
        await user.addLoyaltyPoints(100, 'bonus', 'Welcome to the platform!', undefined);
      }

      // ✅ DISABLED EMAIL VERIFICATION FOR NOW
      // Generate verification token
      // const verificationToken = user.generateVerificationToken();
      // await user.save();

      // Send verification email
      // try {
      //   await sendVerificationEmail(user.email, user.firstName, verificationToken);
      // } catch (emailError) {
      //   console.error('Failed to send verification email:', emailError);
      //   // Don't fail registration if email fails
      // }

      // ✅ AUTO-VERIFY EMAIL FOR NOW (SKIP EMAIL VERIFICATION)
      user.isEmailVerified = true;
      await user.save();

      // Generate tokens for immediate login (optional - some apps require email verification first)
      const { accessToken, refreshToken } = generateTokens(user);

      // Set refresh token as HTTP-only cookie (30 days for persistent login)
      res.cookie('refreshToken', refreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000)); // 30 days

      res.status(201).json({
        success: true,
        message: 'Customer registration successful! Welcome to the platform!', // ✅ Updated message
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            accountStatus: user.accountStatus,
            loyaltyCoins: user.loyaltySystem.coins,
            tier: user.loyaltySystem.tier,
            referralCode: user.loyaltySystem.referralCode
          },
          tokens: {
            accessToken,
            refreshToken
          },
          requiresEmailVerification: false // ✅ Always false now
        }
      });
  } catch (error) {
    throw error;
  }
});

// Provider Registration
export const registerProvider = asyncHandler(async (req: Request, res: Response) => {
  try {
      console.log('🚀 [registerProvider] Starting provider registration');
      console.log('🔍 [registerProvider] Request body:', JSON.stringify(req.body, null, 2));
      console.log('🔍 [registerProvider] Request files:', req.files);

      const {
        firstName,
        lastName,
        email,
        password,
        phone,
        dateOfBirth,
        businessInfo,
        locationInfo,
        services
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new ApiError(409, 'User with this email already exists');
      }

      // Create provider user
      const userData = {
        firstName,
        lastName,
        email,
        password,
        phone,
        role: 'provider',
        dateOfBirth,
        
        // Social profile initialization for provider
        socialProfiles: {
          followers: [],
          following: [],
          isPublicProfile: true,
          profileViews: 0,
          lastActiveAt: new Date()
        },
        
        // Provider loyalty system
        loyaltySystem: {
          coins: 0,
          tier: 'bronze',
          streakDays: 0,
          totalEarned: 0,
          totalSpent: 0,
          pointsHistory: []
        },
        
        // Communication preferences
        communicationPreferences: {
          email: {
            marketing: false,
            bookingUpdates: true,
            reminders: true,
            newsletters: false,
            promotions: false
          },
          sms: {
            bookingUpdates: true,
            reminders: true,
            promotions: false
          },
          push: {
            bookingUpdates: true,
            reminders: true,
            newMessages: true,
            promotions: false
          },
          language: 'en',
          timezone: 'UTC',
          currency: 'AED'
        },

        // AI personalization (minimal for providers)
        aiPersonalization: {
          preferences: {
            preferredServiceTypes: services?.map((s: any) => s.category) || [],
            preferredProviders: [],
            preferredTimeSlots: [],
            preferredDays: [],
            locationPreference: 'both'
          },
          behaviorData: {
            searchHistory: [],
            bookingPatterns: {
              averageSpend: 0,
              bookingFrequency: 0,
              seasonalPreferences: [],
              timePreferences: []
            },
            interactionHistory: {
              profileViews: [],
              favoriteActions: []
            }
          },
          recommendations: {
            suggestedProviders: [],
            suggestedServices: [],
            personalizedOffers: []
          }
        }
      };

      const user = new User(userData);
      await user.save();

      // Create provider profile
      const providerProfile = new ProviderProfile({
        userId: user._id,

        // Provider tier - all new providers start as standard
        tier: 'standard',

        businessInfo: {
          businessName: businessInfo.businessName,
          businessType: businessInfo.businessType || 'individual',
          description: businessInfo.description,
          tagline: businessInfo.tagline,
          website: businessInfo.website,
          establishedDate: businessInfo.establishedDate,
          businessHours: {
            monday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
            tuesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
            wednesday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
            thursday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
            friday: { isOpen: true, openTime: '09:00', closeTime: '17:00' },
            saturday: { isOpen: true, openTime: '10:00', closeTime: '16:00' },
            sunday: { isOpen: false }
          },
          serviceRadius: businessInfo.serviceRadius || 25,
          instantBooking: false,
          advanceBookingDays: 30
        },
        
        instagramStyleProfile: {
          profilePhoto: `https://ui-avatars.com/api/?name=${firstName}+${lastName}&background=random&size=300`,
          isVerified: false,
          verificationBadges: [],
          bio: businessInfo.description || '',
          highlights: [],
          posts: [],
          followersCount: 0,
          followingCount: 0,
          totalLikes: 0,
          engagementRate: 0
        },
        
        services: services?.map((service: any) => ({
          name: service.name,
          category: service.category,
          subcategory: service.subcategory,
          description: service.description,
          duration: service.duration,
          price: {
            amount: service.price.amount,
            currency: service.price.currency || 'AED',
            type: service.price.type || 'fixed'
          },
          images: [],
          isActive: true,
          isPopular: false,
          tags: service.tags || [],
          createdAt: new Date(),
          updatedAt: new Date()
        })) || [],
        
        portfolio: {
          featured: [],
          certifications: [],
          awards: []
        },
        
        availability: {
          schedule: {
            monday: { isAvailable: true, timeSlots: [] },
            tuesday: { isAvailable: true, timeSlots: [] },
            wednesday: { isAvailable: true, timeSlots: [] },
            thursday: { isAvailable: true, timeSlots: [] },
            friday: { isAvailable: true, timeSlots: [] },
            saturday: { isAvailable: true, timeSlots: [] },
            sunday: { isAvailable: false, timeSlots: [] }
          },
          exceptions: [],
          bufferTime: 15,
          maxAdvanceBooking: 30,
          minNoticeTime: 24,
          autoAcceptBookings: false
        },
        
        locationInfo: {
          primaryAddress: {
            ...locationInfo.primaryAddress,
            coordinates: locationInfo.primaryAddress?.coordinates || {
              lat: 25.2048, // Default Dubai coordinates
              lng: 55.2708
            }
          },
          serviceAreas: [],
          travelFee: {
            baseFee: 0,
            perKmFee: 0,
            maxTravelDistance: businessInfo.serviceRadius || 25
          },
          mobileService: locationInfo.mobileService !== false,
          hasFixedLocation: locationInfo.hasFixedLocation || false
        },
        
        reviewsData: {
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
          recentReviews: [],
          responseRate: 0,
          avgResponseTime: 0
        },
        
        analytics: {
          profileViews: [],
          bookingStats: {
            totalBookings: 0,
            completedBookings: 0,
            cancelledBookings: 0,
            noShowBookings: 0,
            averageBookingValue: 0,
            repeatCustomerRate: 0
          },
          revenueStats: {
            totalEarnings: 0,
            currentMonthEarnings: 0,
            averageMonthlyEarnings: 0,
            topEarningServices: []
          },
          customerMetrics: {
            totalCustomers: 0,
            repeatCustomers: 0,
            customerRetentionRate: 0,
            averageCustomerLifetimeValue: 0
          },
          performanceMetrics: {
            acceptanceRate: 0,
            responseTime: 0,
            completionRate: 0,
            punctualityScore: 0,
            qualityScore: 0
          }
        },
        
        marketing: {
          promotions: [],
          happyHours: [],
          packages: [],
          referralProgram: {
            isActive: false,
            referrerReward: 0,
            refereeReward: 0
          }
        },
        
        teamManagement: {
          teamMembers: [],
          departments: []
        },
        
        financials: {
          bankAccount: {
            isVerified: false
          },
          paymentMethods: {
            stripe: { isConnected: false, capabilities: [] },
            paypal: { isConnected: false }
          },
          taxInfo: {},
          payout: {
            frequency: 'weekly',
            minimumAmount: 50,
            pendingAmount: 0
          }
        },
        
        verificationStatus: {
          overall: 'pending',
          identity: { status: 'pending', documents: [] },
          business: { status: 'pending', documents: [] },
          background: { status: 'pending' }
        },
        
        settings: {
          autoAcceptBookings: false,
          instantBookingEnabled: false,
          requirePaymentUpfront: false,
          allowRescheduling: true,
          cancellationPolicy: {
            freeUntilHours: 24,
            partialRefundUntilHours: 12,
            noRefundAfterHours: 2
          },
          communicationPreferences: {
            bookingNotifications: true,
            reviewNotifications: true,
            marketingEmails: false,
            smsNotifications: true
          },
          privacySettings: {
            showExactLocation: false,
            showPhoneNumber: true,
            showEmail: false
          }
        },
        
        isProfileComplete: false,
        completionPercentage: 0
      });

      await providerProfile.save();

      // Create Service documents in the services collection (single source of truth)
      // This ensures services appear in search results after admin approval
      const createdServices: any[] = [];
      if (services && services.length > 0) {
        console.log(`📦 [registerProvider] Creating ${services.length} services in services collection`);

        // Validate and normalize category/subcategory names against database (single source of truth)
        const allCategories = await ServiceCategory.find({ isActive: true }).lean();
        const categoryMap = new Map<string, { exactName: string; subcategoryMap: Map<string, string> }>();

        for (const cat of allCategories) {
          const subcatMap = new Map<string, string>();
          for (const sub of ((cat as any).subcategories || [])) {
            if (sub.isActive !== false) {
              subcatMap.set(sub.name.toLowerCase(), sub.name);
            }
          }
          categoryMap.set((cat as any).name.toLowerCase(), {
            exactName: (cat as any).name,
            subcategoryMap: subcatMap
          });
        }

        // Validate and normalize each service's category/subcategory
        for (const service of services) {
          const catLower = service.category?.toLowerCase();
          const catData = categoryMap.get(catLower);

          if (!catData) {
            const validCats = Array.from(categoryMap.values()).map(c => c.exactName);
            throw new ApiError(400,
              `Invalid category "${service.category}". Valid categories: ${validCats.join(', ')}`
            );
          }

          // Normalize category name to exact DB value
          service.category = catData.exactName;

          // Validate and normalize subcategory if provided
          if (service.subcategory) {
            const subLower = service.subcategory.toLowerCase();
            const exactSubcat = catData.subcategoryMap.get(subLower);

            if (!exactSubcat) {
              const validSubs = Array.from(catData.subcategoryMap.values());
              throw new ApiError(400,
                `Invalid subcategory "${service.subcategory}" for category "${catData.exactName}". Valid subcategories: ${validSubs.join(', ')}`
              );
            }

            // Normalize subcategory name to exact DB value
            service.subcategory = exactSubcat;
          }
        }

        console.log(`✅ [registerProvider] All services validated against database categories`);

        for (const service of services) {
          try {
            const newService = new Service({
              providerId: user._id,
              name: service.name,
              category: service.category,
              subcategory: service.subcategory || '',
              description: service.description,
              shortDescription: service.description?.substring(0, 100) || '',
              duration: service.duration,
              price: {
                amount: service.price.amount,
                currency: service.price.currency || 'AED',
                type: service.price.type || 'fixed'
              },
              location: {
                coordinates: {
                  type: 'Point',
                  coordinates: [
                    locationInfo.primaryAddress?.coordinates?.lng || 0,
                    locationInfo.primaryAddress?.coordinates?.lat || 0
                  ]
                },
                address: {
                  street: locationInfo.primaryAddress?.street || '',
                  city: locationInfo.primaryAddress?.city || '',
                  state: locationInfo.primaryAddress?.state || '',
                  zipCode: locationInfo.primaryAddress?.zipCode || '',
                  country: locationInfo.primaryAddress?.country || 'AE'
                }
              },
              availability: {
                schedule: {
                  monday: { isAvailable: true, timeSlots: [] },
                  tuesday: { isAvailable: true, timeSlots: [] },
                  wednesday: { isAvailable: true, timeSlots: [] },
                  thursday: { isAvailable: true, timeSlots: [] },
                  friday: { isAvailable: true, timeSlots: [] },
                  saturday: { isAvailable: true, timeSlots: [] },
                  sunday: { isAvailable: false, timeSlots: [] }
                },
                instantBooking: false,
                advanceBookingDays: 7
              },
              // IMPORTANT: Require admin approval (matching provider.controller.ts logic)
              status: 'pending_review',
              isActive: false,
              tags: service.tags || [],
              requirements: [],
              includedItems: [],
              rating: {
                average: 0,
                count: 0,
                distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
              },
              searchMetadata: {
                searchCount: 0,
                clickCount: 0,
                bookingCount: 0,
                popularityScore: 0,
                searchKeywords: [service.name, service.category, service.subcategory].filter(Boolean)
              }
            });

            const savedService = await newService.save();
            createdServices.push(savedService);
            console.log(`✅ [registerProvider] Created service: ${savedService.name} (ID: ${savedService._id})`);
          } catch (serviceError) {
            console.error(`❌ [registerProvider] Failed to create service ${service.name}:`, serviceError);
            // Continue with other services even if one fails
          }
        }

        console.log(`📦 [registerProvider] Successfully created ${createdServices.length}/${services.length} services`);
      }

      // Award provider welcome bonus
      await user.addLoyaltyPoints(500, 'bonus', 'Welcome to our provider community!', undefined);

      // ✅ DISABLED EMAIL VERIFICATION FOR NOW
      // Generate verification token
      // const verificationToken = user.generateVerificationToken();
      // await user.save();

      // Send verification email
      // try {
      //   await sendVerificationEmail(user.email, user.firstName, verificationToken);
      // } catch (emailError) {
      //   console.error('Failed to send verification email:', emailError);
      // }

      // ✅ AUTO-VERIFY EMAIL FOR NOW (SKIP EMAIL VERIFICATION)
      user.isEmailVerified = true;
      await user.save();

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user);

      // Set refresh token as HTTP-only cookie (30 days for persistent login)
      res.cookie('refreshToken', refreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000)); // 30 days

      res.status(201).json({
        success: true,
        message: 'Provider registration successful! Welcome to our provider community!', // ✅ Updated message - email verification disabled
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            role: user.role,
            isEmailVerified: user.isEmailVerified,
            accountStatus: user.accountStatus,
            loyaltyCoins: user.loyaltySystem.coins,
            tier: user.loyaltySystem.tier,
            referralCode: user.loyaltySystem.referralCode
          },
          providerProfile: {
            id: providerProfile._id,
            businessName: providerProfile.businessInfo.businessName,
            completionPercentage: providerProfile.completionPercentage,
            verificationStatus: providerProfile.verificationStatus,
            servicesCount: providerProfile.services.length
          },
          tokens: {
            accessToken,
            refreshToken
          },
          requiresEmailVerification: !user.isEmailVerified,
          requiresProfileCompletion: !providerProfile.isProfileComplete
        }
      });
  } catch (error) {
    throw error;
  }
});

// Admin Registration (restricted)
export const registerAdmin = asyncHandler(async (req: Request, res: Response) => {
  
  try {
      // Only existing admins can create new admin users
      if (!req.user || req.user.role !== 'admin') {
        throw new ApiError(403, 'Only existing administrators can create new admin accounts');
      }

      const {
        firstName,
        lastName,
        email,
        password,
        phone
      } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new ApiError(409, 'User with this email already exists');
      }

      // Create admin user
      const userData = {
        firstName,
        lastName,
        email,
        password,
        phone,
        role: 'admin',
        isEmailVerified: true, // Admins are auto-verified
        accountStatus: 'active',
        
        // Social profile initialization
        socialProfiles: {
          followers: [],
          following: [],
          isPublicProfile: false, // Admins have private profiles by default
          profileViews: 0,
          lastActiveAt: new Date()
        },
        
        // Admin gets platinum tier
        loyaltySystem: {
          coins: 0,
          tier: 'platinum',
          streakDays: 0,
          totalEarned: 0,
          totalSpent: 0,
          pointsHistory: []
        },
        
        // Minimal communication preferences for admin
        communicationPreferences: {
          email: {
            marketing: false,
            bookingUpdates: true,
            reminders: true,
            newsletters: false,
            promotions: false
          },
          sms: {
            bookingUpdates: true,
            reminders: false,
            promotions: false
          },
          push: {
            bookingUpdates: true,
            reminders: true,
            newMessages: true,
            promotions: false
          },
          language: 'en',
          timezone: 'UTC',
          currency: 'AED'
        },

        // Minimal AI personalization for admin
        aiPersonalization: {
          preferences: {
            preferredServiceTypes: [],
            preferredProviders: [],
            preferredTimeSlots: [],
            preferredDays: [],
            locationPreference: 'both'
          },
          behaviorData: {
            searchHistory: [],
            bookingPatterns: {
              averageSpend: 0,
              bookingFrequency: 0,
              seasonalPreferences: [],
              timePreferences: []
            },
            interactionHistory: {
              profileViews: [],
              favoriteActions: []
            }
          },
          recommendations: {
            suggestedProviders: [],
            suggestedServices: [],
            personalizedOffers: []
          }
        },
        
        createdBy: req.user._id
      };

      const admin = new User(userData);
      await admin.save();

      // Send welcome email to new admin
      try {
        await sendWelcomeEmail(admin.email, admin.firstName, 'admin');
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }

      res.status(201).json({
        success: true,
        message: 'Admin account created successfully',
        data: {
          user: {
            id: admin._id,
            firstName: admin.firstName,
            lastName: admin.lastName,
            email: admin.email,
            role: admin.role,
            isEmailVerified: admin.isEmailVerified,
            accountStatus: admin.accountStatus,
            tier: admin.loyaltySystem.tier,
            createdBy: req.user.firstName + ' ' + req.user.lastName
          }
        }
      });
  } catch (error) {
    throw error;
  }
});

// Login - Always use 30 days for refresh token
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

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
    // Increment login attempts
    await user.incLoginAttempts();
    throw new ApiError(401, 'Invalid email or password');
  }

  // Check email verification if enforcement is enabled
  if (!user.isEmailVerified && process.env.ENFORCE_EMAIL_VERIFICATION === 'true') {
    throw new ApiError(403, 'Please verify your email before logging in. Check your inbox for the verification link.');
  }

  // Reset login attempts on successful login
  if (user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  // Update last login
  await user.updateLastLogin(clientIP);

  // Generate tokens
  const { accessToken, refreshToken } = generateTokens(user);

  // Set refresh token cookie - always 30 days for seamless experience
  // User can manually logout if they want to end session
  const refreshTokenMaxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
  res.cookie('refreshToken', refreshToken, getCookieOptions(refreshTokenMaxAge));

  // Get role-specific data
  let roleSpecificData: any = {};
  
  if (user.role === 'customer') {
    const customerProfile = await CustomerProfile.findOne({ userId: user._id });
    roleSpecificData = {
      customerProfile: customerProfile ? {
        id: customerProfile._id,
        favoriteProvidersCount: customerProfile.favoriteProviders.length,
        totalBookings: customerProfile.bookingHistory.totalBookings,
        loyaltyPoints: customerProfile.loyaltyData.currentPoints,
        tier: customerProfile.loyaltyData.tier
      } : null
    };
  } else if (user.role === 'provider') {
    const providerProfile = await ProviderProfile.findOne({ userId: user._id });
    roleSpecificData = {
      providerProfile: providerProfile ? {
        id: providerProfile._id,
        businessName: providerProfile.businessInfo.businessName,
        completionPercentage: providerProfile.completionPercentage,
        verificationStatus: providerProfile.verificationStatus,
        servicesCount: providerProfile.services.length,
        averageRating: providerProfile.reviewsData.averageRating,
        totalEarnings: providerProfile.analytics.revenueStats.totalEarnings
      } : null
    };
  }

  // Determine redirect URL based on role and account status
  let redirectUrl = '/';
  if (user.role === 'customer') {
    redirectUrl = '/customer/dashboard';
  } else if (user.role === 'provider') {
    if (roleSpecificData.providerProfile?.completionPercentage < 80) {
      redirectUrl = '/provider/complete-profile';
    } else if (roleSpecificData.providerProfile?.verificationStatus !== 'approved') {
      redirectUrl = '/provider/verification-pending';
    } else {
      redirectUrl = '/provider/dashboard';
    }
  } else if (user.role === 'admin') {
    redirectUrl = '/admin/dashboard';
  }

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        accountStatus: user.accountStatus,
        avatar: user.avatar,
        loyaltyCoins: user.loyaltySystem.coins,
        tier: user.loyaltySystem.tier,
        referralCode: user.loyaltySystem.referralCode,
        lastLogin: user.lastLogin
      },
      ...roleSpecificData,
      tokens: {
        accessToken,
        refreshToken
      },
      redirectUrl,
      requiresEmailVerification: !user.isEmailVerified
    }
  });
});

// Refresh Token
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken: tokenFromBody } = req.body;
  const tokenFromCookie = req.cookies?.refreshToken;
  
  const refreshToken = tokenFromBody || tokenFromCookie;
  
  if (!refreshToken) {
    throw new ApiError(401, 'Refresh token is required');
  }

  try {
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as any;
    
    // Find user and check if refresh token exists in their tokens array
    const user = await User.findById(decoded.id);
    
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    // Check if user is still active
    if (!user.isActive || user.isDeleted || user.accountStatus === 'suspended') {
      throw new ApiError(401, 'User account is no longer active');
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);

    // Remove old refresh token and add new one
    user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
    await user.save({ validateBeforeSave: false });

    // Set new refresh token cookie (30 days for persistent login)
    res.cookie('refreshToken', newRefreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000)); // 30 days

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        tokens: {
          accessToken,
          refreshToken: newRefreshToken
        },
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          accountStatus: user.accountStatus
        }
      }
    });

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(401, 'Invalid refresh token');
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'Refresh token has expired');
    }
    throw error;
  }
});

// Logout
export const logout = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user; // May be null with optionalAuth
  const refreshToken = req.cookies?.refreshToken;

  // Only remove refresh token if user is authenticated
  if (user && refreshToken) {
    // Remove refresh token from user's tokens array
    user.refreshTokens = user.refreshTokens.filter(token => token !== refreshToken);
    await user.save({ validateBeforeSave: false });
  }

  // Always clear refresh token cookie (even if user is not authenticated)
  res.clearCookie('refreshToken');

  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Logout from all devices
export const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user; // May be null with optionalAuth

  // Only clear tokens if user is authenticated
  if (user) {
    // Clear all refresh tokens
    user.refreshTokens = [];
    await user.save({ validateBeforeSave: false });
  }

  // Always clear refresh token cookie (even if user is not authenticated)
  res.clearCookie('refreshToken');

  res.json({
    success: true,
    message: 'Logged out from all devices successfully'
  });
});

// Get current user
export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  
  // Get role-specific data
  let roleSpecificData: any = {};
  
  if (user.role === 'customer') {
    const customerProfile = await CustomerProfile.findOne({ userId: user._id });
    roleSpecificData = {
      customerProfile: customerProfile ? {
        id: customerProfile._id,
        addresses: customerProfile.addresses,
        favoriteProvidersCount: customerProfile.favoriteProviders.length,
        preferences: customerProfile.preferences,
        loyaltyData: customerProfile.loyaltyData,
        bookingHistory: customerProfile.bookingHistory,
        communicationPreferences: customerProfile.communicationPreferences
      } : null
    };
  } else if (user.role === 'provider') {
    const providerProfile = await ProviderProfile.findOne({ userId: user._id });
    roleSpecificData = {
      providerProfile: providerProfile ? {
        id: providerProfile._id,
        businessInfo: providerProfile.businessInfo,
        completionPercentage: providerProfile.completionPercentage,
        verificationStatus: providerProfile.verificationStatus,
        services: providerProfile.services,
        reviewsData: providerProfile.reviewsData,
        analytics: providerProfile.analytics
      } : null
    };
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        address: user.address,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        accountStatus: user.accountStatus,
        socialProfiles: user.socialProfiles,
        loyaltySystem: user.loyaltySystem,
        communicationPreferences: user.communicationPreferences,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      },
      ...roleSpecificData
    }
  });
});

// Forgot Password
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  
  if (!user) {
    // Don't reveal if email exists or not for security
    res.json({
      success: true,
      message: 'If an account with that email exists, we have sent a password reset link.'
    });
    return;
  }

  // Generate reset token
  const resetToken = user.generateResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    // Send password reset email
    await sendPasswordResetEmail(user.email, user.firstName, resetToken);

    res.json({
      success: true,
      message: 'Password reset instructions have been sent to your email address.'
    });
  } catch (error) {
    // Clear reset token if email fails
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save({ validateBeforeSave: false });

    throw new ApiError(500, 'Failed to send password reset email. Please try again.');
  }
});

// Reset Password
export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body;

  // Hash the token from URL to compare with stored hashed token
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: Date.now() }
  });

  if (!user) {
    throw new ApiError(400, 'Password reset token is invalid or has expired');
  }

  // Update password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  
  // Clear all refresh tokens for security
  user.refreshTokens = [];
  
  await user.save();

  // Generate new tokens
  const { accessToken, refreshToken } = generateTokens(user);

  // Set refresh token cookie (30 days for persistent login)
  res.cookie('refreshToken', refreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000)); // 30 days

  res.json({
    success: true,
    message: 'Password has been reset successfully',
    data: {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role
      },
      accessToken
    }
  });
});

// Change Password
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.user!;

  // Get user with password
  const userWithPassword = await User.findById(user._id).select('+password');
  
  if (!userWithPassword) {
    throw new ApiError(404, 'User not found');
  }

  // Verify current password
  const isCurrentPasswordValid = await userWithPassword.comparePassword(currentPassword);
  
  if (!isCurrentPasswordValid) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  // Update password
  userWithPassword.password = newPassword;
  
  // Clear all refresh tokens for security (user will need to login again on other devices)
  userWithPassword.refreshTokens = [];
  
  await userWithPassword.save();

  // Generate new tokens
  const { accessToken, refreshToken } = generateTokens(userWithPassword);

  // Set refresh token cookie (30 days for persistent login)
  res.cookie('refreshToken', refreshToken, getCookieOptions(30 * 24 * 60 * 60 * 1000)); // 30 days

  res.json({
    success: true,
    message: 'Password changed successfully',
    data: {
      accessToken
    }
  });
});

// Verify Email
export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body;

  try {
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
      res.json({
        success: true,
        message: 'Email is already verified'
      });
      return;
    }

    // Check if token matches and hasn't expired
    if (user.verificationToken !== token || 
        (user.verificationExpire && user.verificationExpire < new Date())) {
      throw new ApiError(400, 'Verification token is invalid or has expired');
    }

    // Mark email as verified
    user.isEmailVerified = true;
    user.verificationToken = undefined;
    user.verificationExpire = undefined;
    
    // Update account status if it was pending verification
    if (user.accountStatus === 'pending_verification') {
      user.accountStatus = 'active';
    }

    await user.save({ validateBeforeSave: false });

    // Send welcome email
    try {
      await sendWelcomeEmail(user.email, user.firstName, user.role);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
      // Don't fail verification if welcome email fails
    }

    // Award email verification bonus
    if (user.loyaltySystem.totalEarned === 0) {
      await user.addLoyaltyPoints(50, 'bonus', 'Email verification bonus', undefined);
    }

    res.json({
      success: true,
      message: 'Email verified successfully! Welcome to our platform.',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          accountStatus: user.accountStatus,
          loyaltyCoins: user.loyaltySystem.coins
        }
      }
    });

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(400, 'Invalid verification token');
    } else if (error instanceof jwt.TokenExpiredError) {
      throw new ApiError(400, 'Verification token has expired');
    }
    throw error;
  }
});

// Resend Verification Email
export const resendVerificationEmail = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  
  if (!user) {
    // Don't reveal if email exists or not for security
    res.json({
      success: true,
      message: 'If an account with that email exists and is not verified, we have sent a verification email.'
    });
    return;
  }

  // Check if email is already verified
  if (user.isEmailVerified) {
    res.json({
      success: true,
      message: 'Email is already verified'
    });
    return;
  }

  // Generate new verification token
  const verificationToken = user.generateVerificationToken();
  await user.save({ validateBeforeSave: false });

  try {
    // Send verification email
    await sendVerificationEmail(user.email, user.firstName, verificationToken);

    res.json({
      success: true,
      message: 'Verification email has been sent to your email address.'
    });
  } catch (error) {
    // Clear verification token if email fails
    user.verificationToken = undefined;
    user.verificationExpire = undefined;
    await user.save({ validateBeforeSave: false });

    throw new ApiError(500, 'Failed to send verification email. Please try again.');
  }
});

// Update Profile
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const allowedUpdates = [
    'firstName', 'lastName', 'phone', 'bio', 'dateOfBirth', 'gender', 
    'avatar', 'address', 'socialMediaLinks', 'communicationPreferences'
  ];

  const updates = Object.keys(req.body);
  const isValidUpdate = updates.every(update => allowedUpdates.includes(update));

  if (!isValidUpdate) {
    throw new ApiError(400, 'Invalid updates provided');
  }

  // Update user fields
  updates.forEach(update => {
    if (update === 'socialMediaLinks') {
      user.socialProfiles.socialMediaLinks = {
        ...user.socialProfiles.socialMediaLinks,
        ...req.body[update]
      };
    } else {
      (user as any)[update] = req.body[update];
    }
  });

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        address: user.address,
        socialProfiles: user.socialProfiles,
        communicationPreferences: user.communicationPreferences
      }
    }
  });
});

export default {
  registerCustomer,
  registerProvider,
  registerAdmin,
  login,
  refreshToken,
  logout,
  logoutAll,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  resendVerificationEmail,
  updateProfile
};