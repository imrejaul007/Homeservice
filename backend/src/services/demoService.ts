import mongoose from 'mongoose';
import User from '../models/user.model';
import CustomerProfile from '../models/customerProfile.model';
import ProviderProfile from '../models/providerProfile.model';
import Service from '../models/service.model';
import Booking from '../models/booking.model';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import { sendWelcomeEmail } from './email.service';

// ============================================
// Types & Interfaces
// ============================================

export interface DemoConfig {
  enabled: boolean;
  maxDemoUsers: number;
  demoUserPrefix: string;
  sandboxMode: boolean;
  demoDataRetentionDays: number;
  allowRealPayments: boolean;
  simulateDelays: boolean;
  delayRangeMs: { min: number; max: number };
}

export interface DemoAccount {
  email: string;
  password: string;
  role: 'customer' | 'provider' | 'admin';
  businessName?: string;
  accessToken?: string;
  refreshToken?: string;
}

export interface DemoMetrics {
  totalDemoUsers: number;
  activeDemoSessions: number;
  totalBookingsCreated: number;
  totalRevenueSimulated: number;
  conversionRate: number;
  avgSessionDuration: number;
}

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  steps: DemoStep[];
  estimatedDuration: number; // in minutes
  targetAudience: 'investor' | 'enterprise' | 'press' | 'partner';
}

export interface DemoStep {
  order: number;
  title: string;
  description: string;
  action?: string;
  highlight?: string; // CSS selector or component name
  autoAdvance?: boolean;
  autoAdvanceDelay?: number; // in seconds
}

export interface LaunchReadiness {
  score: number; // 0-100
  categories: {
    technical: { score: number; items: ReadinessItem[] };
    business: { score: number; items: ReadinessItem[] };
    marketing: { score: number; items: ReadinessItem[] };
    operations: { score: number; items: ReadinessItem[] };
  };
  blockers: string[];
  recommendations: string[];
  estimatedLaunchDate?: string;
}

export interface ReadinessItem {
  id: string;
  name: string;
  status: 'complete' | 'in_progress' | 'pending' | 'blocked';
  description?: string;
  assignee?: string;
  dueDate?: string;
}

// ============================================
// Demo Service Class
// ============================================

export class DemoService {
  private static instance: DemoService;
  private config: DemoConfig;
  private activeSessions: Map<string, { userId: string; startedAt: Date; lastActivity: Date }>;

  private constructor() {
    this.config = {
      enabled: process.env.DEMO_MODE === 'true',
      maxDemoUsers: parseInt(process.env.DEMO_MAX_USERS || '50'),
      demoUserPrefix: 'demo_',
      sandboxMode: process.env.DEMO_SANDBOX === 'true',
      demoDataRetentionDays: parseInt(process.env.DEMO_RETENTION_DAYS || '7'),
      allowRealPayments: process.env.DEMO_ALLOW_REAL_PAYMENTS === 'true',
      simulateDelays: process.env.DEMO_SIMULATE_DELAYS !== 'false',
      delayRangeMs: {
        min: parseInt(process.env.DEMO_DELAY_MIN_MS || '100'),
        max: parseInt(process.env.DEMO_DELAY_MAX_MS || '500'),
      },
    };
    this.activeSessions = new Map();
  }

  static getInstance(): DemoService {
    if (!DemoService.instance) {
      DemoService.instance = new DemoService();
    }
    return DemoService.instance;
  }

  // ========================================
  // Configuration
  // ========================================

  getConfig(): DemoConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<DemoConfig>): DemoConfig {
    this.config = { ...this.config, ...updates };
    return this.getConfig();
  }

  isSandboxMode(): boolean {
    return this.config.sandboxMode;
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  // ========================================
  // Demo Account Generation
  // ========================================

  /**
   * Generate a demo account for the specified role
   */
  async generateDemoAccount(role: 'customer' | 'provider' | 'admin'): Promise<DemoAccount> {
    if (!this.config.enabled) {
      throw new ApiError(403, 'Demo mode is not enabled', [], ERROR_CODES.DEMO_DISABLED);
    }

    const demoCount = await this.getDemoUserCount();
    if (demoCount >= this.config.maxDemoUsers) {
      throw new ApiError(
        429,
        `Maximum demo users (${this.config.maxDemoUsers}) reached. Please try again later.`,
        [],
        ERROR_CODES.DEMO_LIMIT_REACHED
      );
    }

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const demoEmail = `${this.config.demoUserPrefix}${role}_${timestamp}_${randomSuffix}@demo.nilin.app`;
    const demoPassword = this.generateDemoPassword();

    let demoAccount: DemoAccount;

    try {
      switch (role) {
        case 'customer':
          demoAccount = await this.createDemoCustomer(demoEmail, demoPassword);
          break;
        case 'provider':
          demoAccount = await this.createDemoProvider(demoEmail, demoPassword);
          break;
        case 'admin':
          demoAccount = await this.createDemoAdmin(demoEmail, demoPassword);
          break;
        default:
          throw new ApiError(400, 'Invalid role specified');
      }

      // Track active session
      const sessionId = this.generateSessionId();
      this.activeSessions.set(sessionId, {
        userId: demoAccount.email,
        startedAt: new Date(),
        lastActivity: new Date(),
      });

      // Auto-expire session after max duration
      this.scheduleSessionExpiry(sessionId);

      return {
        ...demoAccount,
        email: demoEmail,
        password: demoPassword,
        role,
      };
    } catch (error) {
      console.error('Failed to create demo account:', error);
      throw new ApiError(500, 'Failed to generate demo account');
    }
  }

  /**
   * Create a demo customer account with sample data
   */
  private async createDemoCustomer(email: string, password: string): Promise<DemoAccount> {
    const userData = {
      firstName: 'Demo',
      lastName: 'Customer',
      email,
      password,
      phone: '+971500000001',
      role: 'customer' as const,
      isEmailVerified: true,
      accountStatus: 'active' as const,
      loyaltySystem: {
        coins: 500,
        tier: 'gold',
        streakDays: 5,
        totalEarned: 500,
        totalSpent: 250,
        pointsHistory: [],
      },
      communicationPreferences: {
        email: { marketing: true, bookingUpdates: true, reminders: true, newsletters: true, promotions: true },
        sms: { bookingUpdates: true, reminders: true, promotions: false },
        push: { bookingUpdates: true, reminders: true, newMessages: true, promotions: true },
        language: 'en',
        timezone: 'Asia/Dubai',
        currency: 'AED',
      },
      isDemoAccount: true,
      demoExpiresAt: new Date(Date.now() + this.config.demoDataRetentionDays * 24 * 60 * 60 * 1000),
    };

    const user = new User(userData);
    await user.save();

    const customerProfileData = {
      userId: user._id,
      preferences: {
        categories: ['Hair', 'Makeup', 'Skincare'],
        maxDistance: 25,
        priceRange: { min: 50, max: 500 },
        preferredDays: ['friday', 'saturday'],
        preferredTimeSlots: ['morning', 'evening'],
        locationPreference: 'both' as const,
      },
      addresses: [
        {
          label: 'Home',
          type: 'home' as const,
          street: '123 Demo Street',
          city: 'Dubai',
          state: 'Dubai',
          zipCode: '00000',
          country: 'AE',
          coordinates: { type: 'Point' as const, coordinates: [55.2708, 25.2048] },
          isDefault: true,
          createdAt: new Date(),
        },
      ],
      paymentMethods: [
        {
          type: 'card' as const,
          last4: '4242',
          brand: 'visa',
          expiryMonth: 12,
          expiryYear: 2027,
          isDefault: true,
          isVerified: true,
        },
      ],
      favoriteProviders: [],
      bookingHistory: {
        totalBookings: 12,
        completedBookings: 10,
        cancelledBookings: 2,
        totalSpent: 2500,
        averageRating: 4.8,
        favoriteCategories: ['Hair', 'Makeup'],
        seasonalPatterns: [],
      },
      socialActivity: {
        reviewsWritten: 8,
        helpfulVotes: 24,
        photosShared: 5,
        followersCount: 15,
        followingCount: 20,
        profileViews: 150,
        socialScore: 85,
      },
      communicationPreferences: {
        preferredContactMethod: 'push' as const,
        notificationSettings: {
          bookingConfirmation: true,
          bookingReminders: true,
          providerUpdates: true,
          promotionsAndOffers: true,
          loyaltyUpdates: true,
          socialActivity: true,
          weeklyDigest: true,
        },
        reminderTiming: {
          booking24Hours: true,
          booking2Hours: true,
          booking30Minutes: false,
        },
      },
      privacySettings: {
        profileVisibility: 'public' as const,
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

    const customerProfile = new CustomerProfile(customerProfileData);
    await customerProfile.save();

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken(true);

    return {
      email,
      password,
      role: 'customer',
      accessToken,
      refreshToken,
    };
  }

  /**
   * Create a demo provider account with services
   */
  private async createDemoProvider(email: string, password: string): Promise<DemoAccount> {
    const businessName = 'Glow Studio Dubai';

    const userData = {
      firstName: 'Demo',
      lastName: 'Provider',
      email,
      password,
      phone: '+971500000002',
      role: 'provider' as const,
      isEmailVerified: true,
      accountStatus: 'active' as const,
      loyaltySystem: {
        coins: 1000,
        tier: 'platinum',
        streakDays: 30,
        totalEarned: 5000,
        totalSpent: 500,
        pointsHistory: [],
      },
      communicationPreferences: {
        email: { marketing: false, bookingUpdates: true, reminders: true, newsletters: false, promotions: false },
        sms: { bookingUpdates: true, reminders: true, promotions: false },
        push: { bookingUpdates: true, reminders: true, newMessages: true, promotions: false },
        language: 'en',
        timezone: 'Asia/Dubai',
        currency: 'AED',
      },
      isDemoAccount: true,
      demoExpiresAt: new Date(Date.now() + this.config.demoDataRetentionDays * 24 * 60 * 60 * 1000),
    };

    const user = new User(userData);
    await user.save();

    const providerProfileData = {
      userId: user._id,
      tier: 'premium' as const,
      businessInfo: {
        businessName,
        businessType: 'salon' as const,
        description: 'Premium beauty salon offering expert hair, makeup, and skincare services in Dubai.',
        tagline: 'Where Beauty Meets Excellence',
        website: 'https://demo.glowstudio.ae',
        establishedDate: new Date('2020-01-01'),
        businessHours: {
          monday: { isOpen: true, openTime: '09:00', closeTime: '21:00' },
          tuesday: { isOpen: true, openTime: '09:00', closeTime: '21:00' },
          wednesday: { isOpen: true, openTime: '09:00', closeTime: '21:00' },
          thursday: { isOpen: true, openTime: '09:00', closeTime: '21:00' },
          friday: { isOpen: true, openTime: '10:00', closeTime: '22:00' },
          saturday: { isOpen: true, openTime: '10:00', closeTime: '22:00' },
          sunday: { isOpen: true, openTime: '12:00', closeTime: '18:00' },
        },
        serviceRadius: 15,
        instantBooking: true,
        advanceBookingDays: 30,
      },
      instagramStyleProfile: {
        profilePhoto: `https://ui-avatars.com/api/?name=${encodeURIComponent(businessName)}&background=random&size=300`,
        isVerified: true,
        verificationBadges: ['premium', 'top_rated'],
        bio: 'Premium beauty services in Dubai',
        highlights: [
          { title: 'Hours', cover: '', mediaType: 'image' },
          { title: 'Reviews', cover: '', mediaType: 'image' },
          { title: 'Services', cover: '', mediaType: 'image' },
        ],
        posts: [],
        followersCount: 2500,
        followingCount: 300,
        totalLikes: 15000,
        engagementRate: 5.2,
      },
      services: [
        {
          name: 'Signature Hair Styling',
          category: 'Hair',
          subcategory: 'Styling',
          description: 'Expert hair styling with premium products',
          duration: 60,
          price: { amount: 250, currency: 'AED', type: 'fixed' as const },
          images: [],
          isActive: true,
          isPopular: true,
          tags: ['styling', 'premium'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Bridal Makeup',
          category: 'Makeup',
          subcategory: 'Bridal',
          description: 'Complete bridal makeup with trial session',
          duration: 180,
          price: { amount: 1500, currency: 'AED', type: 'fixed' as const },
          images: [],
          isActive: true,
          isPopular: true,
          tags: ['bridal', 'premium'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          name: 'Luxury Facial',
          category: 'Skincare',
          subcategory: 'Facial',
          description: 'Deep cleansing and rejuvenation facial treatment',
          duration: 90,
          price: { amount: 450, currency: 'AED', type: 'fixed' as const },
          images: [],
          isActive: true,
          isPopular: false,
          tags: ['facial', 'skincare'],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      portfolio: {
        featured: [],
        certifications: [
          { name: 'International Beauty Certification', issuer: 'CIDESCO', year: 2019 },
          { name: 'Advanced Makeup Artistry', issuer: 'MAC Academy', year: 2020 },
        ],
        awards: [
          { title: 'Best Salon Dubai 2023', issuer: 'Beauty Awards', year: 2023 },
        ],
      },
      availability: {
        schedule: {
          monday: { isAvailable: true, timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'] },
          tuesday: { isAvailable: true, timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'] },
          wednesday: { isAvailable: true, timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'] },
          thursday: { isAvailable: true, timeSlots: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'] },
          friday: { isAvailable: true, timeSlots: ['10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'] },
          saturday: { isAvailable: true, timeSlots: ['10:00', '11:00', '12:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'] },
          sunday: { isAvailable: true, timeSlots: ['12:00', '13:00', '14:00', '15:00', '16:00', '17:00'] },
        },
        exceptions: [],
        bufferTime: 15,
        maxAdvanceBooking: 30,
        minNoticeTime: 24,
        autoAcceptBookings: true,
      },
      locationInfo: {
        primaryAddress: {
          street: '123 Beauty Avenue',
          city: 'Dubai',
          state: 'Dubai',
          zipCode: '00000',
          country: 'AE',
          coordinates: { type: 'Point' as const, coordinates: [55.2708, 25.2048] },
        },
        serviceAreas: [],
        travelFee: {
          baseFee: 0,
          perKmFee: 0,
          maxTravelDistance: 15,
        },
        mobileService: true,
        hasFixedLocation: true,
      },
      reviewsData: {
        averageRating: 4.9,
        totalReviews: 127,
        ratingDistribution: { 5: 110, 4: 12, 3: 3, 2: 1, 1: 1 },
        recentReviews: [],
        responseRate: 98,
        avgResponseTime: 30,
      },
      analytics: {
        profileViews: [],
        bookingStats: {
          totalBookings: 450,
          completedBookings: 432,
          cancelledBookings: 15,
          noShowBookings: 3,
          averageBookingValue: 350,
          repeatCustomerRate: 65,
        },
        revenueStats: {
          totalEarnings: 157500,
          currentMonthEarnings: 18500,
          averageMonthlyEarnings: 15000,
          topEarningServices: [],
        },
        customerMetrics: {
          totalCustomers: 280,
          repeatCustomers: 182,
          customerRetentionRate: 65,
          averageCustomerLifetimeValue: 1800,
        },
        performanceMetrics: {
          acceptanceRate: 95,
          responseTime: 30,
          completionRate: 96,
          punctualityScore: 98,
          qualityScore: 97,
        },
      },
      marketing: {
        promotions: [
          {
            id: 'demo_promo_1',
            title: 'First Visit Discount',
            description: '20% off your first booking',
            discountType: 'percentage',
            discountValue: 20,
            code: 'GLOW20',
            maxUses: 100,
            usedCount: 45,
            validFrom: new Date('2024-01-01'),
            validUntil: new Date('2024-12-31'),
            isActive: true,
            minOrderValue: 100,
            applicableServices: [],
          },
        ],
        happyHours: [],
        packages: [
          {
            id: 'demo_pkg_1',
            name: 'Bridal Package',
            description: 'Complete bridal beauty package',
            services: ['Bridal Makeup', 'Hair Styling', 'Manicure', 'Pedicure'],
            originalPrice: 2500,
            packagePrice: 1999,
            isActive: true,
          },
        ],
        referralProgram: {
          isActive: true,
          referrerReward: 100,
          refereeReward: 50,
        },
      },
      teamManagement: {
        teamMembers: [],
        departments: ['Hair', 'Makeup', 'Skincare', 'Nails'],
      },
      financials: {
        bankAccount: { isVerified: true },
        paymentMethods: {
          stripe: { isConnected: true, capabilities: ['card_payments', 'transfers'] },
          paypal: { isConnected: false },
        },
        taxInfo: { vatRegistered: true, vatNumber: '123456789000001' },
        payout: {
          frequency: 'weekly' as const,
          minimumAmount: 100,
          pendingAmount: 2500,
        },
      },
      verificationStatus: {
        overall: 'approved' as const,
        identity: { status: 'approved' as const, documents: [] },
        business: { status: 'approved' as const, documents: [] },
        background: { status: 'approved' as const },
      },
      settings: {
        autoAcceptBookings: true,
        instantBookingEnabled: true,
        requirePaymentUpfront: true,
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
          showExactLocation: true,
          showPhoneNumber: true,
          showEmail: false,
        },
      },
      isProfileComplete: true,
      completionPercentage: 95,
    };

    const providerProfile = new ProviderProfile(providerProfileData);
    await providerProfile.save();

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken(true);

    return {
      email,
      password,
      role: 'provider',
      businessName,
      accessToken,
      refreshToken,
    };
  }

  /**
   * Create a demo admin account
   */
  private async createDemoAdmin(email: string, password: string): Promise<DemoAccount> {
    const userData = {
      firstName: 'Demo',
      lastName: 'Admin',
      email,
      password,
      phone: '+971500000003',
      role: 'admin' as const,
      isEmailVerified: true,
      accountStatus: 'active' as const,
      loyaltySystem: {
        coins: 0,
        tier: 'platinum',
        streakDays: 0,
        totalEarned: 0,
        totalSpent: 0,
        pointsHistory: [],
      },
      communicationPreferences: {
        email: { marketing: false, bookingUpdates: true, reminders: true, newsletters: false, promotions: false },
        sms: { bookingUpdates: false, reminders: false, promotions: false },
        push: { bookingUpdates: true, reminders: true, newMessages: true, promotions: false },
        language: 'en',
        timezone: 'Asia/Dubai',
        currency: 'AED',
      },
      isDemoAccount: true,
      demoExpiresAt: new Date(Date.now() + this.config.demoDataRetentionDays * 24 * 60 * 60 * 1000),
    };

    const user = new User(userData);
    await user.save();

    // Generate tokens
    const accessToken = user.generateAuthToken();
    const refreshToken = user.generateRefreshToken(true);

    return {
      email,
      password,
      role: 'admin',
      accessToken,
      refreshToken,
    };
  }

  // ========================================
  // Demo Data Creation
  // ========================================

  /**
   * Create sample data for a demo account
   */
  async createDemoData(userId: string, role: string): Promise<{
    bookings?: any[];
    services?: any[];
    reviews?: any[];
  }> {
    const user = await User.findById(userId);
    if (!user || !user.isDemoAccount) {
      throw new ApiError(403, 'Not a demo account');
    }

    if (role === 'customer') {
      return this.createCustomerDemoData(userId);
    } else if (role === 'provider') {
      return this.createProviderDemoData(userId);
    }

    return {};
  }

  private async createCustomerDemoData(customerId: string): Promise<{ bookings: any[] }> {
    // Create sample bookings for demo customer
    const sampleBookings = [];
    const statuses = ['completed', 'completed', 'completed', 'confirmed', 'pending'];
    const dates = [
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
      new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ];

    for (let i = 0; i < 5; i++) {
      const booking = new Booking({
        customerId,
        service: null, // Would be populated with real service IDs in production
        provider: null, // Would be populated with real provider IDs in production
        scheduledDate: dates[i],
        scheduledTime: '10:00',
        status: statuses[i],
        pricing: {
          basePrice: 250,
          serviceFee: 25,
          tax: 27.5,
          discount: i === 0 ? 50 : 0,
          totalAmount: i === 0 ? 252.5 : 302.5,
          currency: 'AED',
        },
        location: {
          type: 'home',
          address: {
            street: '123 Demo Street',
            city: 'Dubai',
            state: 'Dubai',
            zipCode: '00000',
            country: 'AE',
          },
        },
        isDemoBooking: true,
        createdAt: dates[i],
      });

      await booking.save();
      sampleBookings.push(booking);
    }

    return { bookings: sampleBookings };
  }

  private async createProviderDemoData(providerId: string): Promise<{ services: any[] }> {
    // Get services created with the provider profile
    const services = await Service.find({ providerId });

    // Add some demo reviews to services
    for (const service of services) {
      service.rating = {
        average: 4.8 + Math.random() * 0.2,
        count: Math.floor(Math.random() * 50) + 20,
        distribution: { 5: 40, 4: 8, 3: 1, 2: 0, 1: 1 },
      };
      await service.save();
    }

    return { services };
  }

  // ========================================
  // Session Management
  // ========================================

  getActiveSessions(): Map<string, any> {
    return this.activeSessions;
  }

  updateSessionActivity(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  private generateSessionId(): string {
    return `demo_session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private scheduleSessionExpiry(sessionId: string): void {
    const maxDuration = this.config.demoDataRetentionDays * 24 * 60 * 60 * 1000;
    setTimeout(() => {
      this.cleanupSession(sessionId);
    }, maxDuration);
  }

  async cleanupSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      // Clean up demo user
      const email = session.userId;
      await User.deleteOne({ email });
      await CustomerProfile.deleteOne({ userId: email });
      await ProviderProfile.deleteOne({ userId: email });
      await Booking.deleteMany({ isDemoBooking: true });
      this.activeSessions.delete(sessionId);
    }
  }

  async cleanupExpiredDemoAccounts(): Promise<number> {
    const expiredAccounts = await User.find({
      isDemoAccount: true,
      demoExpiresAt: { $lt: new Date() },
    });

    let cleanedCount = 0;
    for (const user of expiredAccounts) {
      await User.deleteOne({ _id: user._id });
      await CustomerProfile.deleteOne({ userId: user._id });
      await ProviderProfile.deleteOne({ userId: user._id });
      await Booking.deleteMany({ isDemoBooking: true });
      cleanedCount++;
    }

    return cleanedCount;
  }

  // ========================================
  // Metrics & Analytics
  // ========================================

  async getDemoMetrics(): Promise<DemoMetrics> {
    const totalDemoUsers = await User.countDocuments({ isDemoAccount: true });
    const totalBookings = await Booking.countDocuments({ isDemoBooking: true });
    const totalRevenue = await Booking.aggregate([
      { $match: { isDemoBooking: true, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } },
    ]);

    const avgSessionDuration = this.calculateAverageSessionDuration();

    return {
      totalDemoUsers,
      activeDemoSessions: this.activeSessions.size,
      totalBookingsCreated: totalBookings,
      totalRevenueSimulated: totalRevenue[0]?.total || 0,
      conversionRate: totalDemoUsers > 0 ? (totalBookings / totalDemoUsers) * 100 : 0,
      avgSessionDuration,
    };
  }

  private calculateAverageSessionDuration(): number {
    if (this.activeSessions.size === 0) return 0;

    const now = Date.now();
    let totalDuration = 0;

    this.activeSessions.forEach((session) => {
      totalDuration += now - session.startedAt.getTime();
    });

    return totalDuration / this.activeSessions.size / 1000 / 60; // in minutes
  }

  private async getDemoUserCount(): Promise<number> {
    return User.countDocuments({ isDemoAccount: true });
  }

  // ========================================
  // Demo Scenarios
  // ========================================

  getDemoScenarios(): DemoScenario[] {
    return [
      {
        id: 'customer_journey',
        name: 'Customer Journey',
        description: 'Complete booking flow from search to review',
        estimatedDuration: 5,
        targetAudience: 'investor',
        steps: [
          {
            order: 1,
            title: 'Browse Services',
            description: 'Explore available beauty services',
            action: 'navigate:/search',
            autoAdvance: true,
            autoAdvanceDelay: 3,
          },
          {
            order: 2,
            title: 'Select Provider',
            description: 'Choose a verified service provider',
            action: 'click:.provider-card',
            highlight: '.provider-card',
          },
          {
            order: 3,
            title: 'Book Service',
            description: 'Select time slot and confirm booking',
            action: 'click:.book-now-button',
            highlight: '.book-now-button',
          },
          {
            order: 4,
            title: 'Complete Payment',
            description: 'Enter payment details (simulated)',
            action: 'click:.confirm-payment',
            highlight: '.payment-form',
          },
          {
            order: 5,
            title: 'Track Booking',
            description: 'Monitor booking status in real-time',
            action: 'navigate:/customer/bookings',
          },
          {
            order: 6,
            title: 'Leave Review',
            description: 'Rate and review the service',
            action: 'click:.write-review',
          },
        ],
      },
      {
        id: 'provider_dashboard',
        name: 'Provider Dashboard',
        description: 'Manage bookings, earnings, and analytics',
        estimatedDuration: 5,
        targetAudience: 'investor',
        steps: [
          {
            order: 1,
            title: 'View Dashboard',
            description: 'See overview of earnings and bookings',
            action: 'navigate:/provider/dashboard',
          },
          {
            order: 2,
            title: 'Manage Bookings',
            description: 'Accept/decline booking requests',
            action: 'navigate:/provider/bookings',
            highlight: '.booking-list',
          },
          {
            order: 3,
            title: 'Update Availability',
            description: 'Set working hours and time slots',
            action: 'navigate:/provider/availability',
            highlight: '.availability-calendar',
          },
          {
            order: 4,
            title: 'View Analytics',
            description: 'Analyze performance metrics',
            action: 'navigate:/provider/analytics',
            highlight: '.analytics-chart',
          },
          {
            order: 5,
            title: 'Track Earnings',
            description: 'Monitor revenue and payouts',
            action: 'navigate:/provider/earnings',
          },
        ],
      },
      {
        id: 'admin_operations',
        name: 'Admin Operations',
        description: 'Platform management and oversight',
        estimatedDuration: 7,
        targetAudience: 'enterprise',
        steps: [
          {
            order: 1,
            title: 'Platform Dashboard',
            description: 'View overall platform metrics',
            action: 'navigate:/admin/dashboard',
          },
          {
            order: 2,
            title: 'Verify Providers',
            description: 'Review and approve provider applications',
            action: 'navigate:/admin/providers',
            highlight: '.provider-list',
          },
          {
            order: 3,
            title: 'Monitor Anomalies',
            description: 'Track suspicious activities',
            action: 'navigate:/admin/anomalies',
            highlight: '.anomaly-list',
          },
          {
            order: 4,
            title: 'Manage Disputes',
            description: 'Handle customer-provider disputes',
            action: 'navigate:/admin/disputes',
          },
          {
            order: 5,
            title: 'Launch Dashboard',
            description: 'View launch readiness metrics',
            action: 'navigate:/admin/launch',
            highlight: '.launch-metrics',
          },
          {
            order: 6,
            title: 'Review Analytics',
            description: 'Analyze platform performance',
            action: 'navigate:/admin/reports',
          },
        ],
      },
      {
        id: 'ai_features',
        name: 'AI-Powered Features',
        description: 'Experience intelligent recommendations and predictions',
        estimatedDuration: 4,
        targetAudience: 'investor',
        steps: [
          {
            order: 1,
            title: 'Personalized Recommendations',
            description: 'AI-curated service suggestions',
            action: 'scroll:.recommendations',
            highlight: '.ai-recommendations',
          },
          {
            order: 2,
            title: 'Smart Pricing',
            description: 'Dynamic pricing based on demand',
            action: 'view:service-price',
            highlight: '.price-tag',
          },
          {
            order: 3,
            title: 'Provider Insights',
            description: 'AI-generated business insights',
            action: 'navigate:/provider/insights',
            highlight: '.insights-panel',
          },
          {
            order: 4,
            title: 'Cancellation Prediction',
            description: 'Predictive analytics for no-shows',
            action: 'view:cancellation-risk',
            highlight: '.risk-indicator',
          },
        ],
      },
    ];
  }

  // ========================================
  // Launch Readiness
  // ========================================

  async getLaunchReadiness(): Promise<LaunchReadiness> {
    // Gather data from various sources
    const [
      totalUsers,
      totalProviders,
      totalBookings,
      pendingProviders,
      pendingServices,
    ] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'provider' }),
      Booking.countDocuments(),
      ProviderProfile.countDocuments({ 'verificationStatus.overall': 'pending' }),
      Service.countDocuments({ status: 'pending_review' }),
    ]);

    const categories = {
      technical: {
        score: 85,
        items: [
          { id: 't1', name: 'API Endpoints', status: 'complete' as const },
          { id: 't2', name: 'Payment Integration', status: 'complete' as const },
          { id: 't3', name: 'Push Notifications', status: 'complete' as const },
          { id: 't4', name: 'Offline Mode', status: 'in_progress' as const, description: 'Final testing in progress' },
          { id: 't5', name: 'Performance Optimization', status: 'pending' as const, dueDate: '2024-03-15' },
        ],
      },
      business: {
        score: 78,
        items: [
          { id: 'b1', name: 'Provider Onboarding', status: 'complete' as const },
          { id: 'b2', name: 'Customer Acquisition', status: 'in_progress' as const, description: '500 target, 312 reached' },
          { id: 'b3', name: 'Payment Processing', status: 'complete' as const },
          { id: 'b4', name: 'Legal Compliance', status: 'in_progress' as const, description: 'VAT registration pending' },
          { id: 'b5', name: 'Insurance Coverage', status: 'pending' as const, dueDate: '2024-03-20' },
        ],
      },
      marketing: {
        score: 65,
        items: [
          { id: 'm1', name: 'Landing Page', status: 'complete' as const },
          { id: 'm2', name: 'Social Media Presence', status: 'in_progress' as const, description: 'Building following' },
          { id: 'm3', name: 'PR Campaign', status: 'pending' as const, dueDate: '2024-04-01' },
          { id: 'm4', name: 'Launch Event', status: 'pending' as const, dueDate: '2024-04-15' },
        ],
      },
      operations: {
        score: 72,
        items: [
          { id: 'o1', name: 'Support Team Training', status: 'complete' as const },
          { id: 'o2', name: 'SLA Documentation', status: 'complete' as const },
          { id: 'o3', name: 'Escalation Procedures', status: 'in_progress' as const },
          { id: 'o4', name: 'Backup Systems', status: 'pending' as const, dueDate: '2024-03-25' },
        ],
      },
    };

    const blockers = [
      'Insurance coverage not yet finalized',
      'VAT registration pending approval',
      'Offline mode testing incomplete',
    ];

    const recommendations = [
      'Accelerate customer acquisition to meet 500 target before launch',
      'Complete insurance procurement to unlock full feature set',
      'Schedule PR campaign for 2 weeks before launch date',
      'Conduct load testing with projected traffic',
    ];

    const overallScore = Math.round(
      (categories.technical.score +
        categories.business.score +
        categories.marketing.score +
        categories.operations.score) /
        4
    );

    return {
      score: overallScore,
      categories,
      blockers,
      recommendations,
      estimatedLaunchDate: '2024-04-15',
    };
  }

  // ========================================
  // Utilities
  // ========================================

  private generateDemoPassword(): string {
    const length = 12;
    const lowercase = 'abcdefghijkmnpqrstuvwxyz';
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const numbers = '23456789';
    const special = '!@#$%';
    const allChars = lowercase + uppercase + numbers + special;

    let password = '';
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  async simulateDelay(): Promise<void> {
    if (this.config.simulateDelays) {
      const delay =
        Math.random() * (this.config.delayRangeMs.max - this.config.delayRangeMs.min) +
        this.config.delayRangeMs.min;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// ============================================
// Export singleton instance
// ============================================

export const demoService = DemoService.getInstance();
