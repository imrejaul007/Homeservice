import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/user.model';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import ServiceCategory from '../models/serviceCategory.model';
import Booking from '../models/booking.model';
import CustomerMetrics from '../models/customerMetrics.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import { normalizeServiceAreas, sanitizeProviderGeo } from '../utils/sanitizeProviderGeo';
import { formatProviderProfileForClient } from '../utils/formatProviderProfileResponse';
import { sendVerificationEmail, sendWelcomeEmail, sendPasswordResetEmail } from './email.service';
import { uploadFileToCloudinary, deleteFromCloudinary, extractPublicIdFromUrl } from '../utils/cloudinary';
import fs from 'fs';
import { cache } from '../config/redis';
import logger from '../utils/logger';
import { createAuditLog } from './audit.service';
import { REFERRAL_REWARDS } from '../config/constants';
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

const generateTokens = (user: any, rememberMe: boolean = false): TokenPair => {
  const accessToken = user.generateAuthToken();
  const refreshToken = user.generateRefreshToken(rememberMe);
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
  gender: user.gender,
  dateOfBirth: user.dateOfBirth,
  address: user.address,
  lastLogin: user.lastLogin,
});

// ============================================
// Device Fingerprinting
// ============================================

/**
 * Generates a device fingerprint hash from request headers
 * Used for device tracking and session security
 */
export function generateDeviceFingerprint(userAgent: string, ip: string, acceptLanguage?: string): string {
  const fingerprintData = {
    ua: userAgent.toLowerCase().split(' ').slice(0, 3).join(' '), // First 3 parts of UA
    os: extractOS(userAgent),
    browser: extractBrowser(userAgent),
    ip: ip.substring(0, 7), // First 3 octets for geo privacy
    lang: acceptLanguage?.split(',')[0]?.substring(0, 5) || 'unknown',
  };

  const fingerprintString = JSON.stringify(fingerprintData);
  return crypto.createHash('sha256').update(fingerprintString).digest('hex').substring(0, 32);
}

/**
 * Extract OS from user agent string
 */
function extractOS(userAgent: string): string {
  if (userAgent.includes('Windows')) return 'windows';
  if (userAgent.includes('Mac OS') || userAgent.includes('Macintosh')) return 'macos';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'ios';
  if (userAgent.includes('Android')) return 'android';
  if (userAgent.includes('Linux')) return 'linux';
  return 'unknown';
}

/**
 * Extract browser from user agent string
 */
function extractBrowser(userAgent: string): string {
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'chrome';
  if (userAgent.includes('Firefox')) return 'firefox';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'safari';
  if (userAgent.includes('Edg')) return 'edge';
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'opera';
  return 'unknown';
}

/**
 * Get device type from user agent
 */
export function getDeviceType(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
  const ua = userAgent.toLowerCase();
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return 'mobile';
  }
  if (ua.includes('tablet') || ua.includes('ipad')) {
    return 'tablet';
  }
  return 'desktop';
}

// ============================================
// Fraud Detection Types
// ============================================

interface FraudCheckResult {
  isSuspicious: boolean;
  confidence: number;
  reasons: string[];
  shouldBlock: boolean;
  shouldFlag: boolean;
  flags?: string[];
}

interface ReferralFraudCheck {
  isFraud: boolean;
  confidence: number;
  fraudTypes: string[];
  details: string;
}

// ============================================
// AuthService Class
// ============================================

export class AuthService {
  // ========================================
  // Customer Registration
  // ========================================

  async registerCustomer(data: CustomerRegistrationDTO): Promise<AuthResult> {
    // Extract IP and userAgent from data or use defaults
    const registrationIP = data.ip || 'unknown';
    const userAgent = data.userAgent || 'unknown';
    const acceptLanguage = data.acceptLanguage;

    // Generate device fingerprint for fraud detection
    const deviceFingerprint = generateDeviceFingerprint(userAgent, registrationIP, acceptLanguage);

    // Check if user already exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new ApiError(409, 'User with this email already exists', [], ERROR_CODES.EMAIL_ALREADY_EXISTS);
    }

    // Handle referral code
    let referredBy;
    let referralFraudCheck: ReferralFraudCheck | undefined;

    if (data.referralCode) {
      // Prevent self-referral by checking if the referral code belongs to someone with the same email
      const referrer = await User.findOne({
        'loyaltySystem.referralCode': data.referralCode,
      });
      if (referrer) {
        // Check if the referrer has the same email (self-referral)
        if (referrer.email.toLowerCase() === data.email.toLowerCase()) {
          throw new ApiError(400, 'You cannot use your own referral code');
        }

        // FIX: Also check for device fingerprint and IP match to prevent bypass via phone/device
        const hasMatchingFingerprint = referrer.deviceFingerprints?.some(
          (df: any) => df.fingerprint === deviceFingerprint
        );
        if (hasMatchingFingerprint) {
          logger.warn('Self-referral detected via device fingerprint', {
            referrerId: referrer._id,
            newUserEmail: data.email,
            fingerprint: deviceFingerprint.substring(0, 8) + '...',
            action: 'SELF_REFERRAL_DEVICE_BLOCKED',
          });
          throw new ApiError(400, 'You cannot use your own referral code');
        }

        // Check if this IP has been used by the referrer for registration
        const hasMatchingIP = (referrer as any).registrationIPs?.includes(registrationIP);
        if (hasMatchingIP) {
          logger.warn('Self-referral detected via registration IP', {
            referrerId: referrer._id,
            newUserEmail: data.email,
            registrationIP,
            action: 'SELF_REFERRAL_IP_BLOCKED',
          });
          throw new ApiError(400, 'You cannot use your own referral code');
        }

        // Check for referral fraud patterns (IP correlation, device fingerprint, timestamp)
        referralFraudCheck = await this.checkReferralFraud(
          referrer._id,
          data.email,
          registrationIP,
          deviceFingerprint
        );

        if (referralFraudCheck.isFraud && referralFraudCheck.confidence >= 70) {
          logger.warn('Suspicious referral detected during registration', {
            referrerId: referrer._id,
            newUserEmail: data.email,
            fraudTypes: referralFraudCheck.fraudTypes,
            confidence: referralFraudCheck.confidence,
            action: 'SUSPICIOUS_REFERRAL_BLOCKED',
          });

          // Block high-confidence fraud
          throw new ApiError(403, 'Registration blocked due to suspicious activity. Please contact support.');
        }

        referredBy = referrer._id;
      }
    }

    // FRAUD DETECTION: Check device fingerprint for suspicious patterns
    const deviceFraudCheck = await this.checkDeviceFingerprint(registrationIP, userAgent, data.email);

    if (deviceFraudCheck.shouldBlock) {
      logger.warn('Registration blocked due to device fingerprint fraud', {
        email: data.email,
        fingerprint: deviceFingerprint.substring(0, 8) + '...',
        reasons: deviceFraudCheck.reasons,
        action: 'DEVICE_FRAUD_BLOCKED',
      });
      throw new ApiError(403, 'Registration blocked. Please contact support.');
    }

    // Log flagged registrations for review
    if (deviceFraudCheck.shouldFlag) {
      await createAuditLog({
        userId: 'SYSTEM',
        action: 'FRAUD_FLAGGED',
        resource: 'registration',
        resourceId: data.email,
        details: {
          type: 'device_fraud',
          fingerprint: deviceFingerprint.substring(0, 8) + '...',
          reasons: deviceFraudCheck.reasons,
          confidence: deviceFraudCheck.confidence,
          registrationIP,
        },
        status: 'success',
      });

      logger.info('Registration flagged for fraud review', {
        email: data.email,
        reasons: deviceFraudCheck.reasons,
        confidence: deviceFraudCheck.confidence,
      });
    }

    // Create user data with fraud detection fields
    // Sanitize address coordinates to ensure valid GeoJSON format
    let userAddress = data.address;
    if (userAddress?.coordinates) {
      const coords = userAddress.coordinates as any;
      let validCoords: { type: 'Point'; coordinates: [number, number] } | null = null;

      // Check for GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
      if (coords.type === 'Point' && Array.isArray(coords.coordinates) && coords.coordinates.length >= 2) {
        validCoords = { type: 'Point' as const, coordinates: [coords.coordinates[0], coords.coordinates[1]] };
      }
      // Check for simple format: { lng, lat }
      else if (typeof coords.lng === 'number' && typeof coords.lat === 'number') {
        validCoords = { type: 'Point' as const, coordinates: [coords.lng, coords.lat] };
      }
      // Check for simple format: { longitude, latitude }
      else if (typeof coords.longitude === 'number' && typeof coords.latitude === 'number') {
        validCoords = { type: 'Point' as const, coordinates: [coords.longitude, coords.latitude] };
      }

      if (validCoords) {
        userAddress = { ...userAddress, coordinates: validCoords };
      } else {
        // No valid coordinates - don't include address
        userAddress = undefined;
      }
    } else if (userAddress && !userAddress.coordinates) {
      // No coordinates provided - don't include address
      userAddress = undefined;
    }

    const userData = {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      phone: data.phone,
      role: 'customer',
      dateOfBirth: data.dateOfBirth,
      gender: data.gender,
      address: userAddress,
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
      // Fraud detection fields
      registrationIP,
      knownIPs: registrationIP !== 'unknown' ? [registrationIP] : [],
      deviceFingerprints: [{
        fingerprint: deviceFingerprint,
        userAgent,
        ip: registrationIP,
        firstSeen: new Date(),
        lastSeen: new Date(),
        isSuspicious: deviceFraudCheck.isSuspicious,
      }],
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
          promotions: data.communicationPreferences?.push?.promotions !== false,
        },
        language: data.communicationPreferences?.language || 'en',
        timezone: data.communicationPreferences?.timezone || 'Asia/Dubai',
        currency: data.communicationPreferences?.currency || 'AED',
      },
      digestPreferences: {
        enabled: true,
        frequency: 'daily',
        channels: {
          email: true,
          sms: false,
          push: true,
          whatsapp: false,
          telegram: false,
        },
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '08:00',
          timezone: data.communicationPreferences?.timezone || 'Asia/Dubai',
        },
        types: {
          bookingUpdates: true,
          reminders: true,
          promotions: false,
          messages: true,
          system: true,
        },
        scheduledTime: '09:00',
        scheduledDays: [1],
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

    // Customer profile data - use sanitized userAddress
    const customerProfileData = {
      userId: undefined as any, // Will be set after user creation
      preferences: {
        categories: [],
        maxDistance: 25,
        priceRange: { min: 0, max: 1000 },
        preferredDays: [],
        preferredTimeSlots: [],
        locationPreference: 'both',
      },
      addresses: userAddress
        ? [
            {
              label: 'Home',
              type: 'home',
              street: userAddress.street || '',
              city: userAddress.city || '',
              state: userAddress.state || '',
              zipCode: userAddress.zipCode || '',
              country: userAddress.country || 'AE',
              coordinates: userAddress.coordinates,
              isDefault: true,
              createdAt: new Date(),
            },
          ]
        : [],
      paymentMethods: [],
      favoriteProviders: [],
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
    };

    // Use transaction for atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Create user
      const user = new User(userData);
      await user.save({ session });

      // Set userId for profile
      customerProfileData.userId = user._id;

      // Create customer profile
      const customerProfile = new CustomerProfile(customerProfileData);
      await customerProfile.save({ session });

      // Award referral/welcome bonus (within transaction, passing fraud check for reduced bonus if suspicious)
      await this.awardCustomerWelcomeBonus(user, referredBy, referralFraudCheck);

      // Generate and save verification token (within transaction)
      const verificationToken = user.generateVerificationToken();
      user.verificationExpire = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save({ session });

      // Commit transaction
      await session.commitTransaction();

      try {
        const { notificationDigestService } = await import('./notifications/notificationDigest.service');
        await notificationDigestService.initializeForUser(
          user._id.toString(),
          data.communicationPreferences?.timezone || 'Asia/Dubai'
        );
      } catch (digestInitError) {
        logger.error('Failed to initialize digest schedule for new user', {
          userId: user._id,
          error: (digestInitError as Error).message,
        });
      }

      // Send verification email (non-blocking - outside transaction)
      try {
        await sendVerificationEmail(user.email, user.firstName, verificationToken);
      } catch (emailError) {
        logger.error('Failed to send verification email', { userId: user._id, error: (emailError as Error).message });
        // Continue - user can request a new verification email later
      }

      // Generate tokens
      const tokens = generateTokens(user);

      await this.linkGuestBookingsForCustomer(user);

      return {
        user: formatUserResponse(user),
        tokens,
        requiresEmailVerification: true,
      };
    } catch (error) {
      // Abort transaction on any error
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  private async awardCustomerWelcomeBonus(user: any, referredBy?: any, fraudCheck?: ReferralFraudCheck): Promise<void> {
    // FIX: Store pending rewards instead of awarding immediately
    // Per terms: "when they sign up AND complete their first booking"
    // Initialize loyalty system if not exists
    user.loyaltySystem = user.loyaltySystem || {
      coins: 0,
      totalEarned: 0,
      tier: 'bronze',
      points: 0,
      benefits: [],
      processedJobIds: [],
      pendingRewards: []
    };

    // Initialize pendingRewards array if needed
    if (!user.loyaltySystem.pendingRewards) {
      user.loyaltySystem.pendingRewards = [];
    }

    if (referredBy) {
      const referrer = await User.findById(referredBy);

      if (referrer) {
        // SECURITY FIX: Check referral count limit (max 50 referrals per user)
        const referralCount = await User.countDocuments({
          'loyaltySystem.referredBy': referrer._id,
          _id: { $ne: user._id }
        });

        if (referralCount >= REFERRAL_REWARDS.MAX_REFERRALS_PER_USER) {
          logger.warn('Referrer has reached maximum referral limit', {
            referrerId: referrer._id,
            referralCount,
            maxReferrals: REFERRAL_REWARDS.MAX_REFERRALS_PER_USER,
            action: 'REFERRAL_LIMIT_REACHED',
          });
          // Still add pending reward for new user
          user.loyaltySystem.pendingRewards.push({
            type: 'welcome_bonus',
            amount: REFERRAL_REWARDS.REFEREE_REWARD,
            description: 'Welcome bonus for using referral code',
            status: 'pending'
          });
          await user.save();
          return;
        }

        // Check if referral was flagged as suspicious
        if (fraudCheck?.isFraud) {
          logger.warn('Suspicious referral detected, storing reduced bonus as pending', {
            userId: user._id,
            referrerId: referrer._id,
            fraudTypes: fraudCheck.fraudTypes,
            action: 'SUSPICIOUS_REFERRAL_PENDING',
          });
          // Add reduced bonus as pending
          user.loyaltySystem.pendingRewards.push({
            type: 'referral_bonus',
            amount: REFERRAL_REWARDS.SUSPICIOUS_REFERRAL_BONUS,
            description: 'Welcome bonus for using referral code (reduced - flagged)',
            status: 'pending'
          });

          // Flag both users in metrics
          await this.flagUserForSuspiciousReferral(user._id, referrer._id, fraudCheck.fraudTypes);
          await user.save();
          return;
        }

        // Add pending rewards for legitimate referral
        // User will receive referee reward when first booking completes
        // Referrer will receive referrer reward when their referral completes first booking
        user.loyaltySystem.pendingRewards.push({
          type: 'referral_bonus',
          amount: REFERRAL_REWARDS.REFEREE_REWARD,
          description: 'Welcome bonus for using referral code',
          status: 'pending',
          referrerId: referredBy.toString()
        });

        await user.save();

        logger.info('Referral bonus pending until first booking completion', {
          userId: user._id,
          referrerId: referredBy,
          pendingAmount: REFERRAL_REWARDS.REFEREE_REWARD,
          action: 'PENDING_REFERRAL_REWARD',
        });
        return;
      }
    }

    // No referral - still add pending welcome bonus
    user.loyaltySystem.pendingRewards.push({
      type: 'welcome_bonus',
      amount: REFERRAL_REWARDS.WELCOME_BONUS,
      description: 'Welcome to the platform!',
      status: 'pending'
    });
    await user.save();

    logger.info('Welcome bonus pending until first booking completion', {
      userId: user._id,
      pendingAmount: REFERRAL_REWARDS.WELCOME_BONUS,
      action: 'PENDING_WELCOME_REWARD',
    });
  }

  // ========================================
  // Fraud Detection Methods
  // ========================================

  /**
   * Check for device fingerprint fraud during registration
   */
  async checkDeviceFingerprint(ip: string, userAgent: string, email: string): Promise<FraudCheckResult> {
    const result: FraudCheckResult = {
      isSuspicious: false,
      confidence: 0,
      reasons: [],
      shouldBlock: false,
      shouldFlag: false,
    };

    // Generate device fingerprint
    const fingerprint = generateDeviceFingerprint(userAgent, ip);

    // 1. Check if this device fingerprint has been used by multiple accounts
    const usersWithSameDevice = await User.find({
      'deviceFingerprints.fingerprint': fingerprint,
      email: { $ne: email },
    }).select('_id email deviceFingerprints');

    if (usersWithSameDevice.length > 0) {
      // Multiple accounts from same device
      if (usersWithSameDevice.length >= 3) {
        result.isSuspicious = true;
        result.confidence += 50;
        result.reasons.push(`Device used by ${usersWithSameDevice.length} other accounts`);
        result.shouldFlag = true;
      } else {
        result.confidence += 20;
        result.reasons.push(`Device used by ${usersWithSameDevice.length} other account(s)`);
      }
    }

    // 2. Check if this IP has been used for multiple registrations
    const usersWithSameIP = await User.find({
      $or: [
        { registrationIP: ip },
        { 'deviceFingerprints.ip': ip },
        { 'knownIPs': ip },
      ],
      email: { $ne: email },
    }).select('_id email registrationIP');

    if (usersWithSameIP.length > 0) {
      if (usersWithSameIP.length >= 3) {
        result.isSuspicious = true;
        result.confidence += 40;
        result.reasons.push(`IP used by ${usersWithSameIP.length} other accounts`);
        result.shouldFlag = true;
      } else {
        result.confidence += 15;
        result.reasons.push(`IP used by ${usersWithSameIP.length} other account(s)`);
      }
    }

    // 3. Check for VPN/Proxy indicators (simplified check)
    if (this.isLikelyVPN(ip)) {
      result.confidence += 20;
      result.reasons.push('Registration from VPN/Proxy detected');
    }

    // Determine if should block (very high confidence)
    result.shouldBlock = result.confidence >= 80;

    return result;
  }

  /**
   * Check for referral fraud patterns
   */
  async checkReferralFraud(
    referrerId: mongoose.Types.ObjectId,
    newUserEmail: string,
    newUserIP: string,
    newUserFingerprint: string
  ): Promise<ReferralFraudCheck> {
    const result: ReferralFraudCheck = {
      isFraud: false,
      confidence: 0,
      fraudTypes: [],
      details: '',
    };

    const referrer = await User.findById(referrerId).select('email registrationIP deviceFingerprints createdAt');
    if (!referrer) {
      return result;
    }

    // 1. Check IP correlation - referrer and referred from same IP
    if (referrer.registrationIP === newUserIP || referrer.knownIPs?.includes(newUserIP)) {
      result.isFraud = true;
      result.confidence += 40;
      result.fraudTypes.push('SAME_IP');
      result.details = 'Referrer and referred user registered from same IP';
    }

    // 2. Check device fingerprint correlation
    const referrerFingerprints = referrer.deviceFingerprints || [];
    const matchingFingerprint = referrerFingerprints.find(
      (d: any) => d.fingerprint === newUserFingerprint
    );
    if (matchingFingerprint) {
      result.isFraud = true;
      result.confidence += 50;
      result.fraudTypes.push('SAME_DEVICE');
      result.details = 'Referrer and referred user used same device';
    }

    // 3. Check timestamp correlation - signup within 1 minute of each other
    const referrerCreatedAt = referrer.createdAt.getTime();
    const now = Date.now();
    const timeDiff = now - referrerCreatedAt;

    // If referrer account was created very recently AND referred user is signing up
    if (timeDiff < 60 * 1000) { // Within 1 minute
      result.isFraud = true;
      result.confidence += 60;
      result.fraudTypes.push('RAPID_REFERRAL');
      result.details = `Referrer created ${Math.round(timeDiff / 1000)} seconds before referred signup`;
    }

    // 4. Check for same email domain patterns (potential coordinated fraud)
    const referrerDomain = referrer.email.split('@')[1];
    const newUserDomain = newUserEmail.split('@')[1];
    if (referrerDomain === newUserDomain && ['gmail.com', 'yahoo.com', 'hotmail.com'].includes(referrerDomain)) {
      result.confidence += 10;
      result.fraudTypes.push('SAME_EMAIL_DOMAIN');
    }

    // 5. Check referrer's referral velocity
    const recentReferralCount = await User.countDocuments({
      'loyaltySystem.referredBy': referrerId,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
    });

    if (recentReferralCount >= 10) {
      result.isFraud = true;
      result.confidence += 30;
      result.fraudTypes.push('HIGH_REFERRAL_VELOCITY');
      result.details = `Referrer made ${recentReferralCount} referrals in last 24 hours`;
    }

    return result;
  }

  /**
   * Simple VPN/Proxy detection (basic implementation)
   * In production, use a service like IPQualityScore or MaxMind
   */
  private isLikelyVPN(ip: string): boolean {
    // Common patterns that might indicate VPN/Proxy
    // This is a simplified check - real implementation would use a GeoIP service
    const vpnIndicators = [
      ip.startsWith('10.'),      // Private IP ranges
      ip.startsWith('172.16.'),  // Private IP ranges
      ip.startsWith('192.168.'), // Private IP ranges
      ip === '127.0.0.1',
      ip === 'localhost',
    ];

    // In production, add more sophisticated checks:
    // - Check against known VPN/proxy IP databases
    // - Use reverse DNS lookups
    // - Check for Tor exit nodes

    return vpnIndicators.some(Boolean);
  }

  /**
   * Flag users for suspicious referral activity
   */
  private async flagUserForSuspiciousReferral(
    referredUserId: mongoose.Types.ObjectId,
    referrerId: mongoose.Types.ObjectId,
    fraudTypes: string[]
  ): Promise<void> {
    try {
      const metrics = await CustomerMetrics.getOrCreateForUser(referredUserId);
      metrics.suspiciousReferrals += 1;
      metrics.trustScore = metrics.calculateTrustScore();
      const risk = metrics.assessRisk();
      metrics.riskLevel = risk.level;
      metrics.riskFactors = risk.factors;
      await metrics.save();

      // Also flag the referrer
      const referrerMetrics = await CustomerMetrics.getOrCreateForUser(referrerId);
      referrerMetrics.suspiciousReferrals += 1;
      referrerMetrics.trustScore = referrerMetrics.calculateTrustScore();
      const referrerRisk = referrerMetrics.assessRisk();
      referrerMetrics.riskLevel = referrerRisk.level;
      referrerMetrics.riskFactors = referrerRisk.factors;
      await referrerMetrics.save();

      // Create audit log
      await createAuditLog({
        userId: referrerId.toString(),
        action: 'FRAUD_DETECTED',
        resource: 'user',
        resourceId: referredUserId.toString(),
        details: {
          fraudTypes,
          referredUserId: referredUserId.toString(),
          detectedAt: new Date().toISOString(),
        },
        status: 'success',
      });

      logger.warn('Users flagged for suspicious referral activity', {
        referredUserId: referredUserId.toString(),
        referrerId: referrerId.toString(),
        fraudTypes,
      });
    } catch (error) {
      logger.error('Failed to flag users for suspicious referral', {
        referredUserId: referredUserId.toString(),
        referrerId: referrerId.toString(),
        error: (error as Error).message,
      });
    }
  }

  /**
   * Award conversion bonus when user completes first booking
   * This is called from booking service when a booking is completed
   */
  async awardConversionBonus(userId: string): Promise<{ success: boolean; bonusAmount: number }> {
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, bonusAmount: 0 };
    }

    // Check if user has already received a conversion bonus
    const hasConversionBonus = user.loyaltySystem.pointsHistory.some(
      (p: any) => p.description.includes('First booking') || p.description.includes('conversion')
    );

    if (hasConversionBonus) {
      return { success: false, bonusAmount: 0 };
    }

    // Award conversion bonus
    const bonusAmount = 100;
    await user.addLoyaltyPoints(bonusAmount, 'bonus', 'First booking conversion bonus!', undefined);

    // Also award referrer if user was referred
    if (user.loyaltySystem.referredBy) {
      const referrer = await User.findById(user.loyaltySystem.referredBy);
      if (referrer) {
        // Higher bonus for referrer when referral actually converts (completes booking)
        await referrer.addLoyaltyPoints(300, 'referral', `Referral conversion bonus - ${user.firstName} completed first booking`, userId);
      }
    }

    logger.info('Conversion bonus awarded', {
      userId,
      bonusAmount,
      hasReferrer: !!user.loyaltySystem.referredBy,
    });

    return { success: true, bonusAmount };
  }

  /**
   * Store device fingerprint for a user
   */
  async storeDeviceFingerprint(
    userId: string,
    fingerprint: string,
    userAgent: string,
    ip: string
  ): Promise<{ isNew: boolean; totalDevices: number }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Check if this fingerprint already exists
    const existingIndex = user.deviceFingerprints.findIndex(
      (d: any) => d.fingerprint === fingerprint
    );

    if (existingIndex >= 0) {
      // Update existing fingerprint
      user.deviceFingerprints[existingIndex].lastSeen = new Date();
      if (ip) {
        user.deviceFingerprints[existingIndex].ip = ip;
      }
      await user.save({ validateBeforeSave: false });
      return { isNew: false, totalDevices: user.deviceFingerprints.length };
    }

    // Add new fingerprint
    user.deviceFingerprints.push({
      fingerprint,
      userAgent: userAgent?.substring(0, 500) || 'unknown',
      ip,
      firstSeen: new Date(),
      lastSeen: new Date(),
      isSuspicious: false,
    });

    // Add IP to known IPs
    if (ip && !user.knownIPs.includes(ip)) {
      user.knownIPs.push(ip);
    }

    await user.save({ validateBeforeSave: false });

    logger.info('Device fingerprint stored', {
      userId,
      fingerprint: fingerprint.substring(0, 8) + '...',
      totalDevices: user.deviceFingerprints.length,
    });

    return { isNew: true, totalDevices: user.deviceFingerprints.length };
  }

  // ========================================
  // Provider Registration
  // ========================================

  async registerProvider(data: ProviderRegistrationDTO): Promise<AuthResult & { providerProfile?: any }> {
    logger.info('Starting provider registration', { email: data.email });

    // Check if user already exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new ApiError(409, 'User with this email already exists', [], ERROR_CODES.EMAIL_ALREADY_EXISTS);
    }

    // Create provider user data
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

    // Provider profile data
    const providerProfileData = {
      userId: undefined as any, // Will be set after user creation
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
            type: 'Point',
            coordinates: [55.2708, 25.2048] as [number, number], // [longitude, latitude]
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
    };

    // Use transaction for atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    let user: any;
    let providerProfile: any;

    try {
      // Create user
      user = new User(userData);
      await user.save({ session });

      // Set userId for profile
      providerProfileData.userId = user._id;

      // Create provider profile
      providerProfile = new ProviderProfile(providerProfileData);
      await providerProfile.save({ session });

      // Award provider welcome bonus (within transaction)
      await user.addLoyaltyPoints(500, 'bonus', 'Welcome to our provider community!', undefined);

      // Generate and save verification token (within transaction)
      const verificationToken = user.generateVerificationToken();
      user.verificationExpire = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save({ session });

      // Commit transaction
      await session.commitTransaction();

      // Create services in the services collection (outside transaction - these are independent)
      if (data.services && data.services.length > 0) {
        await this.createProviderServices(user._id, data.services, data.locationInfo);
      }

      // Send verification email (non-blocking - outside transaction)
      try {
        const verificationToken = user.generateVerificationToken();
        await sendVerificationEmail(user.email, user.firstName, verificationToken);
      } catch (emailError) {
        logger.error('Failed to send verification email', { userId: user._id, error: (emailError as Error).message });
        // Continue - user can request a new verification email later
      }

      // Generate tokens
      const tokens = generateTokens(user);

      return {
        user: formatUserResponse(user),
        tokens,
        requiresEmailVerification: true,
        providerProfile: {
          id: providerProfile._id,
          businessName: providerProfile.businessInfo.businessName,
          completionPercentage: providerProfile.completionPercentage,
          verificationStatus: providerProfile.verificationStatus,
          servicesCount: providerProfile.services.length,
        },
      };
    } catch (error) {
      // Abort transaction on any error
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
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
              coordinates: (() => {
                // Extract from GeoJSON format: { type: 'Point', coordinates: [lng, lat] }
                const coords = locationInfo.primaryAddress?.coordinates;
                if (coords?.coordinates && Array.isArray(coords.coordinates)) {
                  return coords.coordinates as [number, number];
                }
                // Handle legacy format { lat, lng } for backwards compatibility
                if (coords?.lat !== undefined && coords?.lng !== undefined) {
                  return [coords.lng, coords.lat] as [number, number];
                }
                return [0, 0] as [number, number];
              })(),
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
        logger.info('Service created', { serviceId: newService._id, serviceName: newService.name });
      } catch (serviceError) {
        logger.error('Failed to create service', { serviceName: service.name, error: (serviceError as Error).message });
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
      logger.error('Failed to send welcome email', { adminId: admin._id, error: (emailError as Error).message });
    }

    // Audit log: Admin account created
    logger.info('SECURITY_AUDIT: Admin account created', {
      action: 'ADMIN_ACCOUNT_CREATED',
      adminId: admin._id,
      adminEmail: admin.email,
      createdBy: creatorId,
      timestamp: new Date().toISOString()
    });

    return {
      user: formatUserResponse(admin),
      tokens: generateTokens(admin),
      requiresEmailVerification: false,
    };
  }

  // ========================================
  // Login
  // ========================================

  async login(email: string, password: string, ip?: string, rememberMe: boolean = false): Promise<LoginResult> {
    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      // Audit log: Failed login attempt (user not found)
      logger.warn('SECURITY_AUDIT: Failed login attempt - user not found', {
        action: 'LOGIN_FAILED',
        reason: 'USER_NOT_FOUND',
        email: email, // Email is not sensitive - it's the identifier
        ip: ip || 'unknown',
        timestamp: new Date().toISOString()
      });
      throw new ApiError(401, 'Invalid email or password');
    }

    // Check if account is locked
    if (user.isLocked()) {
      // Audit log: Login attempt on locked account
      logger.warn('SECURITY_AUDIT: Login attempt on locked account', {
        action: 'LOGIN_BLOCKED',
        reason: 'ACCOUNT_LOCKED',
        userId: user._id,
        email: email,
        ip: ip || 'unknown',
        lockExpiresAt: (user as any).lockUntil,
        timestamp: new Date().toISOString()
      });
      throw new ApiError(423, 'Account is temporarily locked due to too many failed attempts.');
    }

    // Check if account is active
    if (!user.isActive || user.isDeleted) {
      // Audit log: Login attempt on deactivated account
      logger.warn('SECURITY_AUDIT: Login attempt on deactivated account', {
        action: 'LOGIN_FAILED',
        reason: 'ACCOUNT_DEACTIVATED',
        userId: user._id,
        email: email,
        ip: ip || 'unknown',
        timestamp: new Date().toISOString()
      });
      throw new ApiError(401, 'Account has been deactivated');
    }

    // Check account status
    if (user.accountStatus === 'suspended') {
      // Audit log: Login attempt on suspended account
      logger.warn('SECURITY_AUDIT: Login attempt on suspended account', {
        action: 'LOGIN_FAILED',
        reason: 'ACCOUNT_SUSPENDED',
        userId: user._id,
        email: email,
        ip: ip || 'unknown',
        timestamp: new Date().toISOString()
      });
      throw new ApiError(403, 'Account has been suspended. Please contact support.');
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      await user.incLoginAttempts();
      // Audit log: Failed login attempt (invalid password)
      logger.warn('SECURITY_AUDIT: Failed login attempt - invalid password', {
        action: 'LOGIN_FAILED',
        reason: 'INVALID_PASSWORD',
        userId: user._id,
        email: email,
        ip: ip || 'unknown',
        loginAttempts: user.loginAttempts + 1,
        timestamp: new Date().toISOString()
      });
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

    // Generate tokens (pass rememberMe to control refresh token expiry)
    const tokens = generateTokens(user, rememberMe);

    // Get role-specific data
    const roleSpecificData = await this.getRoleSpecificData(user);

    // Determine redirect URL
    const redirectUrl = this.getRedirectUrl(user.role, roleSpecificData);

    await this.linkGuestBookingsForCustomer(user);

    return {
      user: formatUserResponse(user),
      tokens,
      requiresEmailVerification: !user.isEmailVerified,
      redirectUrl,
      roleSpecificData,
    };
  }

  /** Attach prior guest bookings (same email) to this customer account */
  private async linkGuestBookingsForCustomer(user: { _id: unknown; email: string; role: string }): Promise<void> {
    if (user.role !== 'customer' || !user.email) return;
    try {
      const { bookingService } = await import('./booking.service');
      await bookingService.linkGuestBookingsToCustomer(String(user._id), user.email);
    } catch (error) {
      logger.error('Failed to link guest bookings after auth', {
        userId: user._id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
              // Loyalty data is now read from User model's loyaltySystem
              loyaltyPoints: user.loyaltySystem?.coins || 0,
              tier: user.loyaltySystem?.tier || 'bronze',
            }
          : null,
      };
    } else if (user.role === 'provider') {
      const providerProfile = await ProviderProfile.findOne({ userId: user._id });
      if (!providerProfile) return { providerProfile: null };

      // Calculate pending earnings from incomplete bookings
      const pendingBookings = await Booking.find({
        providerId: user._id,
        status: { $in: ['confirmed', 'in_progress'] }
      });
      const pendingBalance = pendingBookings.reduce(
        (sum, b) => sum + (b.pricing?.totalAmount || 0), 0
      );

      return {
        providerProfile: formatProviderProfileForClient(providerProfile, pendingBalance),
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
      user.sessions = []; // Clear all sessions
      await user.save({ validateBeforeSave: false });
    }
  }

  // ========================================
  // Session Management with TTL
  // ========================================

  /**
   * Creates a new session for a user with automatic TTL (30 days)
   * Includes device fingerprinting for enhanced security
   */
  async createSession(userId: string, sessionData: {
    token: string;
    device: string;
    browser?: string;
    os?: string;
    ip?: string;
    location?: string;
    userAgent?: string;
    acceptLanguage?: string;
  }): Promise<string> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Generate unique session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Calculate expiry (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Generate device fingerprint
    const deviceFingerprint = generateDeviceFingerprint(
      sessionData.userAgent || 'unknown',
      sessionData.ip || 'unknown',
      sessionData.acceptLanguage
    );

    // Mark other sessions as not current
    user.sessions.forEach(s => s.isCurrent = false);

    // Add new session with device fingerprint
    user.sessions.push({
      sessionId,
      token: sessionData.token,
      device: sessionData.device,
      browser: sessionData.browser,
      os: sessionData.os,
      ip: sessionData.ip,
      location: sessionData.location,
      userAgent: sessionData.userAgent,
      lastActive: new Date(),
      createdAt: new Date(),
      expiresAt,
      isCurrent: true,
      deviceFingerprint, // Store device fingerprint hash
    });

    // Track device in device list
    await this.trackDevice(user, {
      fingerprint: deviceFingerprint,
      device: sessionData.device,
      browser: sessionData.browser,
      os: sessionData.os,
      ip: sessionData.ip,
    });

    // Limit total sessions per user (keep last 10)
    if (user.sessions.length > 10) {
      user.sessions = user.sessions
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, 10);
    }

    await user.save({ validateBeforeSave: false });

    // Also store in Redis for fast lookup (if available)
    try {
      await cache.set(
        `session:${sessionId}`,
        JSON.stringify({ userId: userId.toString(), deviceFingerprint, createdAt: new Date().toISOString() }),
        30 * 24 * 60 * 60 // 30 days in seconds
      );
    } catch (error) {
      logger.warn('Failed to store session in Redis, MongoDB TTL will handle cleanup', { userId, error });
    }

    return sessionId;
  }

  /**
   * Track a device for the user (for device list management)
   */
  private async trackDevice(
    user: any,
    deviceInfo: { fingerprint: string; device: string; browser?: string; os?: string; ip?: string }
  ): Promise<void> {
    // Initialize deviceList if it doesn't exist
    if (!user.deviceList) {
      user.deviceList = [];
    }

    // Check if device already exists
    const existingDeviceIndex = user.deviceList.findIndex(
      (d: any) => d.fingerprint === deviceInfo.fingerprint
    );

    if (existingDeviceIndex !== -1) {
      // Update existing device
      user.deviceList[existingDeviceIndex] = {
        ...user.deviceList[existingDeviceIndex],
        lastActive: new Date(),
        lastIp: deviceInfo.ip,
        loginCount: (user.deviceList[existingDeviceIndex].loginCount || 1) + 1,
      };
    } else {
      // Add new device
      user.deviceList.push({
        fingerprint: deviceInfo.fingerprint,
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        firstSeen: new Date(),
        lastActive: new Date(),
        lastIp: deviceInfo.ip,
        loginCount: 1,
        isTrusted: false,
      });

      // Keep only last 20 devices
      if (user.deviceList.length > 20) {
        user.deviceList = user.deviceList
          .sort((a: any, b: any) => b.lastActive.getTime() - a.lastActive.getTime())
          .slice(0, 20);
      }

      // Log new device detection for security monitoring
      logger.info('New device detected for user', {
        action: 'NEW_DEVICE_DETECTED',
        userId: user._id,
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        fingerprint: deviceInfo.fingerprint.substring(0, 8) + '...', // Log partial for privacy
      });
    }
  }

  /**
   * Get all devices for a user
   */
  async getUserDevices(userId: string): Promise<any[]> {
    const user = await User.findById(userId).select('deviceList');
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    return (user.deviceList || []).map((d: any) => ({
      fingerprint: d.fingerprint.substring(0, 8) + '...', // Mask for response
      device: d.device,
      browser: d.browser,
      os: d.os,
      firstSeen: d.firstSeen,
      lastActive: d.lastActive,
      loginCount: d.loginCount,
      isTrusted: d.isTrusted,
    }));
  }

  /**
   * Remove a device from user's device list
   */
  async removeDevice(userId: string, fingerprint: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Remove device from deviceList
    user.deviceList = (user.deviceList || []).filter(
      (d: any) => d.fingerprint !== fingerprint
    );

    // Also invalidate any sessions with this device fingerprint
    user.sessions = (user.sessions || []).filter(
      (s: any) => s.deviceFingerprint !== fingerprint
    );

    await user.save({ validateBeforeSave: false });

    logger.info('Device removed from user account', {
      action: 'DEVICE_REMOVED',
      userId,
      fingerprint: fingerprint.substring(0, 8) + '...',
    });
  }

  /**
   * Mark a device as trusted
   */
  async trustDevice(userId: string, fingerprint: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const device = (user.deviceList || []).find((d: any) => d.fingerprint === fingerprint);
    if (device) {
      device.isTrusted = true;
      device.trustedAt = new Date();
      await user.save({ validateBeforeSave: false });

      logger.info('Device marked as trusted', {
        action: 'DEVICE_TRUSTED',
        userId,
        fingerprint: fingerprint.substring(0, 8) + '...',
      });
    }
  }

  /**
   * Check if a device is recognized (new device detection)
   */
  async isDeviceRecognized(userId: string, userAgent: string, ip: string, acceptLanguage?: string): Promise<{
    isRecognized: boolean;
    fingerprint: string;
    isTrusted: boolean;
    device?: any;
  }> {
    const user = await User.findById(userId).select('deviceList');
    if (!user) {
      return { isRecognized: false, fingerprint: '', isTrusted: false };
    }

    const fingerprint = generateDeviceFingerprint(userAgent, ip, acceptLanguage);
    const device = (user.deviceList || []).find((d: any) => d.fingerprint === fingerprint);

    return {
      isRecognized: !!device,
      fingerprint,
      isTrusted: device?.isTrusted || false,
      device,
    };
  }

  /**
   * Updates session lastActive timestamp
   */
  async touchSession(userId: string, sessionId: string): Promise<void> {
    try {
      // Try Redis first for fast lookup
      const cachedSession = await cache.get(`session:${sessionId}`);
      if (cachedSession) {
        // Refresh Redis TTL on activity - set with new TTL
        await cache.set(`session:${sessionId}`, cachedSession, 30 * 24 * 60 * 60);
      }
    } catch (error) {
      // Redis unavailable, continue with MongoDB update
    }

    await User.updateOne(
      { _id: userId, 'sessions.sessionId': sessionId },
      { $set: { 'sessions.$.lastActive': new Date() } }
    );
  }

  /**
   * Invalidates a specific session
   */
  async invalidateSession(userId: string, sessionId: string): Promise<void> {
    // Remove from Redis
    try {
      await cache.del(`session:${sessionId}`);
    } catch (error) {
      logger.warn('Failed to remove session from Redis', { userId, sessionId, error });
    }

    // Remove from MongoDB
    await User.updateOne(
      { _id: userId },
      { $pull: { sessions: { sessionId } } }
    );
  }

  /**
   * Cleanup expired sessions from MongoDB (backup cleanup, TTL handles most cases)
   * This is a maintenance method that can be called periodically
   */
  async cleanupExpiredSessions(): Promise<{ deleted: number }> {
    const now = new Date();
    const result = await User.updateMany(
      { 'sessions.expiresAt': { $lt: now } },
      { $pull: { sessions: { expiresAt: { $lt: now } } } }
    );

    if (result.modifiedCount > 0) {
      logger.info('Cleaned up expired sessions', { modifiedCount: result.modifiedCount });
    }

    return { deleted: result.modifiedCount };
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<Array<{
    sessionId: string;
    device: string;
    browser?: string;
    os?: string;
    ip?: string;
    location?: string;
    lastActive: Date;
    createdAt: Date;
    isCurrent: boolean;
  }>> {
    const user = await User.findById(userId).select('sessions');
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const now = new Date();
    return user.sessions
      .filter(s => s.expiresAt > now) // Only return non-expired sessions
      .map(s => ({
        sessionId: s.sessionId,
        device: s.device,
        browser: s.browser,
        os: s.os,
        ip: s.ip,
        location: s.location,
        lastActive: s.lastActive,
        createdAt: s.createdAt,
        isCurrent: s.isCurrent,
      }));
  }

  /**
   * Validate a session from Redis (fast path) or MongoDB (slow path)
   */
  async validateSession(sessionId: string, userId: string): Promise<boolean> {
    // Fast path: Check Redis first
    try {
      const cached = await cache.get(`session:${sessionId}`);
      if (cached) {
        const sessionData = JSON.parse(cached);
        return sessionData.userId === userId;
      }
    } catch (error) {
      // Redis unavailable, fall back to MongoDB
    }

    // Slow path: Check MongoDB
    const user = await User.findOne({
      _id: userId,
      'sessions.sessionId': sessionId,
      'sessions.expiresAt': { $gt: new Date() }
    });

    return !!user;
  }

  // ========================================
  // Token Refresh
  // ========================================

  async refreshToken(token: string): Promise<{ tokens: TokenPair; user: UserResponse }> {
    // Verify refresh token
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET as string) as any;
    const userId = decoded.id;

    // Acquire Redis lock to prevent race conditions from concurrent refresh requests
    const lockKey = `refresh:lock:${userId}`;
    const lockTTL = 10; // 10 seconds lock timeout

    // Calculate base delay and max jitter for exponential backoff
    const baseDelay = 50; // 50ms base delay
    const maxJitter = 50; // 50ms max jitter
    const maxRetries = 5;
    const maxBaseDelay = 800; // Max 800ms total base delay

    // Helper function to calculate delay with exponential backoff and jitter
    const calculateBackoffDelay = (attempt: number): number => {
      // Exponential backoff: baseDelay * 2^attempt, capped
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxBaseDelay);
      // Add random jitter between 0 and maxJitter
      const jitter = Math.random() * maxJitter;
      return exponentialDelay + jitter;
    };

    // Try to acquire lock with exponential backoff and jitter
    let lockAcquired = false;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Use SET NX (set if not exists) to acquire lock
      const lockResult = await cache.client?.set(lockKey, '1', 'EX', lockTTL, 'NX');
      if (lockResult === 'OK') {
        lockAcquired = true;
        break;
      }

      if (attempt < maxRetries - 1) {
        // Calculate backoff delay for next attempt
        const delay = calculateBackoffDelay(attempt);
        logger.debug('Token refresh lock acquisition failed, retrying with backoff', {
          action: 'TOKEN_REFRESH_RETRY',
          userId,
          attempt: attempt + 1,
          maxRetries,
          delayMs: Math.round(delay),
        });
        // Wait before retrying with exponential backoff + jitter
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!lockAcquired) {
      // Return 409 Conflict - another refresh is in progress (semantically correct)
      throw new ApiError(409, 'Token refresh conflict. Another refresh request is being processed.');
    }

    try {
      // Find user and check if refresh token exists
      const user = await User.findById(userId);

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
    } finally {
      // Always release the lock
      await cache.del(lockKey);
    }
  }

  // ========================================
  // Password Management
  // ========================================

  async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });

    if (!user) {
      // Audit log: Password reset requested for non-existent account
      // We log this for security monitoring even though we don't reveal the user exists
      logger.info('SECURITY_AUDIT: Password reset requested for non-existent account', {
        action: 'PASSWORD_RESET_REQUESTED',
        reason: 'USER_NOT_FOUND',
        email: email,
        timestamp: new Date().toISOString()
      });
      // Don't reveal if email exists for security
      return;
    }

    // Generate reset token
    const resetToken = user.generateResetToken();
    await user.save({ validateBeforeSave: false });

    // Audit log: Password reset requested
    logger.info('SECURITY_AUDIT: Password reset requested', {
      action: 'PASSWORD_RESET_REQUESTED',
      userId: user._id,
      email: email,
      timestamp: new Date().toISOString()
    });

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, user.firstName, resetToken);
    } catch (error) {
      // Clear reset token if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      logger.error('Failed to send password reset email', { userId: user._id, error: (error as Error).message });
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
      // Audit log: Password reset attempted with invalid/expired token
      logger.warn('SECURITY_AUDIT: Password reset attempted with invalid token', {
        action: 'PASSWORD_RESET_FAILED',
        reason: 'INVALID_OR_EXPIRED_TOKEN',
        timestamp: new Date().toISOString()
      });
      throw new ApiError(400, 'Password reset token is invalid or has expired');
    }

    // FIX: Check password history to prevent reuse
    if (user.passwordHistory && user.passwordHistory.length > 0) {
      for (const oldHash of user.passwordHistory) {
        const isMatch = await bcrypt.compare(password, oldHash);
        if (isMatch) {
          throw new ApiError(400, 'Cannot reuse any of your last 5 passwords. Please choose a different password.');
        }
      }
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.refreshTokens = [];

    // FIX: Add old password to history before saving
    const currentHash = await bcrypt.hash(password, 10);
    user.passwordHistory = user.passwordHistory || [];
    user.passwordHistory.unshift(currentHash);
    // Keep only last 5 passwords
    if (user.passwordHistory.length > 5) {
      user.passwordHistory = user.passwordHistory.slice(0, 5);
    }

    await user.save();

    // Audit log: Password successfully reset
    logger.info('SECURITY_AUDIT: Password successfully reset', {
      action: 'PASSWORD_RESET_COMPLETED',
      userId: user._id,
      email: user.email,
      timestamp: new Date().toISOString()
    });

    // Generate new tokens
    const tokens = generateTokens(user);

    return {
      user: formatUserResponse(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
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
      logger.error('Failed to send welcome email', { userId: user._id, error: (emailError as Error).message });
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
      'avatar', 'address', 'socialMediaLinks',
      'yearsExperience', 'serviceAreas', 'serviceLocation',
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

    // Update ProviderProfile for providers
    if (user.role === 'provider') {
      const providerProfile = await ProviderProfile.findOne({ userId: user._id });
      if (providerProfile) {
        if (updates.bio !== undefined) {
          providerProfile.instagramStyleProfile.bio = updates.bio;
        }
        if (updates.yearsExperience !== undefined) {
          (providerProfile.businessInfo as any).yearsExperience = updates.yearsExperience;
        }
        if (updates.serviceAreas !== undefined) {
          providerProfile.locationInfo.serviceAreas = normalizeServiceAreas(updates.serviceAreas) as any;
        }
        if (updates.serviceLocation) {
          const loc = updates.serviceLocation;
          const lng = Number(loc.lng);
          const lat = Number(loc.lat);
          const areaLabel =
            loc.label || loc.city || loc.formattedAddress || 'Service area';

          if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
            providerProfile.locationInfo.primaryAddress = {
              street: loc.street || areaLabel,
              city: loc.city || areaLabel,
              state: loc.state || loc.city || 'Dubai',
              zipCode: loc.zipCode || '00000',
              country: loc.country || 'AE',
              coordinates: {
                type: 'Point',
                coordinates: [lng, lat],
              },
            } as any;
            providerProfile.locationInfo.serviceAreas = normalizeServiceAreas([areaLabel]) as any;
          }
        }
        if (!providerProfile.instagramStyleProfile) {
          (providerProfile as any).instagramStyleProfile = { bio: '' };
        }
        sanitizeProviderGeo(providerProfile);
        providerProfile.markModified('locationInfo');
        try {
          await providerProfile.save({ validateBeforeSave: false });
        } catch (err: any) {
          if (err?.name === 'MongoServerError' && String(err?.message || '').includes('geo')) {
            throw new ApiError(
              400,
              'Location coordinates are invalid. Please set your service address in profile settings.'
            );
          }
          throw err;
        }
      }
    }

    return this.getProfile(userId);
  }

  // ========================================
  // Profile Image Upload
  // ========================================

  async uploadProfileImage(userId: string, file: Express.Multer.File): Promise<{ avatar: string }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    if (!file.path) {
      throw new ApiError(400, 'Invalid file upload');
    }

    const previousAvatar = user.avatar;

    try {
      const uploadResult = await uploadFileToCloudinary(file.path, 'avatars');

      user.avatar = uploadResult.secureUrl;
      await user.save({ validateBeforeSave: false });

      if (previousAvatar && previousAvatar !== uploadResult.secureUrl) {
        const publicId = extractPublicIdFromUrl(previousAvatar);
        if (publicId) {
          try {
            await deleteFromCloudinary(publicId);
          } catch {
            // non-fatal — old asset cleanup
          }
        }
      }

      return { avatar: uploadResult.secureUrl };
    } finally {
      try {
        if (file.path && fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch {
        // non-fatal — stale-file sweeper handles leftovers
      }
    }
  }

  // ========================================
  // Export User Data
  // ========================================

  async exportUserData(userId: string): Promise<{
    user: any;
    customerProfile?: any;
    providerProfile?: any;
    bookings?: any[];
    services?: any[];
  }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    const result: any = {
      exportedAt: new Date().toISOString(),
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
        isEmailVerified: user.isEmailVerified,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        loyaltySystem: user.loyaltySystem,
        communicationPreferences: user.communicationPreferences,
      },
    };

    // Get customer profile if exists
    if (user.role === 'customer') {
      const customerProfile = await CustomerProfile.findOne({ userId: user._id });
      if (customerProfile) {
        result.customerProfile = {
          preferences: customerProfile.preferences,
          addresses: customerProfile.addresses,
          paymentMethods: customerProfile.paymentMethods,
          favoriteProviders: customerProfile.favoriteProviders,
          // NOTE: loyaltyData removed - loyalty is now stored in User model's loyaltySystem
          bookingHistory: customerProfile.bookingHistory,
          socialActivity: customerProfile.socialActivity,
          privacySettings: customerProfile.privacySettings,
        };

        // Get user's bookings
        const bookings = await Booking.find({ customerId: user._id })
          .populate('service', 'name category')
          .populate('provider', 'firstName lastName')
          .sort({ createdAt: -1 })
          .limit(100);

        result.bookings = bookings.map(b => ({
          id: b._id,
          service: b.service,
          provider: b.provider,
          scheduledDate: b.scheduledDate,
          scheduledTime: b.scheduledTime,
          status: b.status,
          totalPrice: b.pricing?.totalAmount,
          location: b.location,
          createdAt: b.createdAt,
        }));
      }
    }

    // Get provider profile if exists
    if (user.role === 'provider') {
      const providerProfile = await ProviderProfile.findOne({ userId: user._id });
      if (providerProfile) {
        result.providerProfile = {
          businessInfo: providerProfile.businessInfo,
          services: providerProfile.services,
          instagramStyleProfile: providerProfile.instagramStyleProfile,
          verificationStatus: providerProfile.verificationStatus,
          settings: providerProfile.settings,
          createdAt: providerProfile.createdAt,
        };

        // Get provider's services
        const services = await Service.find({ providerId: user._id })
          .sort({ createdAt: -1 })
          .limit(100);

        result.services = services.map(s => ({
          id: s._id,
          name: s.name,
          category: s.category,
          subcategory: s.subcategory,
          description: s.description,
          duration: s.duration,
          price: s.price,
          status: s.status,
          rating: s.rating,
          createdAt: s.createdAt,
        }));
      }
    }

    return result;
  }

  // ========================================
  // Delete Account
  // ========================================

  async deleteAccount(userId: string, password: string): Promise<{ message: string }> {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new ApiError(404, 'User not found');
    }

    // Verify password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      throw new ApiError(400, 'Incorrect password. Account deletion requires password verification.');
    }

    // Soft delete - mark as deleted
    user.isDeleted = true;
    user.isActive = false;
    user.accountStatus = 'deactivated';
    user.email = `deleted_${user._id}_${user.email}`;
    user.phone = undefined;
    user.refreshTokens = [];

    // Clear sensitive data
    if (user.address) {
      user.address = undefined;
    }

    await user.save({ validateBeforeSave: false });

    // If customer, anonymize related data
    if (user.role === 'customer') {
      await CustomerProfile.updateOne(
        { userId: user._id },
        {
          $set: {
            addresses: [],
            favoriteProviders: [],
            'paymentMethods': [],
          },
        }
      );
    }

    // If provider, deactivate services
    if (user.role === 'provider') {
      await Service.updateMany(
        { providerId: user._id },
        { $set: { isActive: false, status: 'deactivated' } }
      );
    }

    return {
      message: 'Your account has been permanently deleted. We\'re sorry to see you go.',
    };
  }
}

// Export singleton instance
export const authService = new AuthService();
