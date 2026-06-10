/**
 * Auth Service Mock
 * Provides utilities for creating test users
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../../models/user.model';
import CustomerProfile from '../../models/customerProfile.model';
import ProviderProfile from '../../models/providerProfile.model';

// JWT secrets for testing
const TEST_JWT_SECRET = 'test-access-secret-for-jwt-testing';
const TEST_JWT_REFRESH_SECRET = 'test-refresh-secret-for-jwt-testing';

// Valid address coordinates for Dubai
const DUBAI_COORDS = {
  type: 'Point' as const,
  coordinates: [55.2708, 25.2048] as [number, number],
};

/**
 * Generate tokens for a user
 */
export const generateTokens = (user: any) => {
  const accessToken = jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      isEmailVerified: user.isEmailVerified,
      accountStatus: user.accountStatus,
    },
    TEST_JWT_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion || 0,
    },
    TEST_JWT_REFRESH_SECRET,
    { expiresIn: '30d' }
  );

  return { accessToken, refreshToken };
};

/**
 * Create a test customer user
 */
export const createTestCustomer = async (overrides = {}) => {
  const email = `customer_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
  const hashedPassword = await bcrypt.hash('SecurePass@123', 12);

  const userData = {
    firstName: 'Test',
    lastName: 'Customer',
    email,
    password: hashedPassword,
    phone: '+971501234567',
    role: 'customer' as const,
    address: {
      street: '123 Test St',
      city: 'Dubai',
      state: 'Dubai',
      country: 'UAE',
      zipCode: '12345',
      coordinates: DUBAI_COORDS,
    },
    loyaltySystem: {
      coins: 0,
      tier: 'bronze' as const,
      streakDays: 0,
      totalEarned: 0,
      totalSpent: 0,
      pointsHistory: [],
      referralCode: `CUS${Math.random().toString(36).substring(7).toUpperCase()}`,
    },
    isEmailVerified: false,
    accountStatus: 'active' as const,
    isActive: true,
    isDeleted: false,
    loginAttempts: 0,
    ...overrides,
  };

  const user = new User(userData);
  await user.save({ validateBeforeSave: false });

  const profile = new CustomerProfile({
    userId: user._id,
    preferences: {
      categories: [],
    },
    addresses: [],
    favoriteProviders: [],
    bookingHistory: {
      totalBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      totalSpent: 0,
    },
  });
  await profile.save();

  const tokens = generateTokens(user);

  return {
    user,
    profile,
    ...tokens,
  };
};

/**
 * Create a test provider user
 */
export const createTestProvider = async (overrides = {}) => {
  const email = `provider_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
  const hashedPassword = await bcrypt.hash('SecurePass@123', 12);

  const userData = {
    firstName: 'Test',
    lastName: 'Provider',
    email,
    password: hashedPassword,
    phone: '+971501234568',
    role: 'provider' as const,
    address: {
      street: '456 Provider Ave',
      city: 'Dubai',
      state: 'Dubai',
      country: 'UAE',
      zipCode: '54321',
      coordinates: DUBAI_COORDS,
    },
    isEmailVerified: false,
    accountStatus: 'active' as const,
    isActive: true,
    isDeleted: false,
    loginAttempts: 0,
    ...overrides,
  };

  const user = new User(userData);
  await user.save({ validateBeforeSave: false });

  const profile = new ProviderProfile({
    userId: user._id,
    businessInfo: {
      businessName: 'Test Cleaning Services',
      serviceTypes: ['cleaning'],
      description: 'Professional cleaning services',
      serviceRadius: 25,
    },
    services: [],
    availability: {
      schedule: {
        monday: { isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00', isActive: true }] },
        tuesday: { isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00', isActive: true }] },
        wednesday: { isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00', isActive: true }] },
        thursday: { isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00', isActive: true }] },
        friday: { isAvailable: true, timeSlots: [{ start: '09:00', end: '17:00', isActive: true }] },
        saturday: { isAvailable: false, timeSlots: [] },
        sunday: { isAvailable: false, timeSlots: [] },
      },
    },
    reviewsData: {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    verificationStatus: {
      overall: 'pending' as const,
      documents: [],
    },
    completionPercentage: 50,
    isActive: true,
    isDeleted: false,
  });
  await profile.save();

  const tokens = generateTokens(user);

  return {
    user,
    profile,
    ...tokens,
  };
};

/**
 * Create test admin user
 */
export const createTestAdmin = async (overrides = {}) => {
  const email = `admin_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
  const hashedPassword = await bcrypt.hash('SecurePass@123', 12);

  const userData = {
    firstName: 'Test',
    lastName: 'Admin',
    email,
    password: hashedPassword,
    phone: '+971501234569',
    role: 'admin' as const,
    isEmailVerified: false,
    accountStatus: 'active' as const,
    isActive: true,
    isDeleted: false,
    loginAttempts: 0,
    ...overrides,
  };

  const user = new User(userData);
  await user.save({ validateBeforeSave: false });

  const tokens = generateTokens(user);

  return {
    user,
    ...tokens,
  };
};

/**
 * Delete test user
 */
export const deleteTestUser = async (userId: mongoose.Types.ObjectId) => {
  await User.findByIdAndDelete(userId);
  await CustomerProfile.deleteOne({ userId });
  await ProviderProfile.deleteOne({ userId });
};

/**
 * Mock login function
 */
export const mockLogin = async (email: string, password: string) => {
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid) {
    throw new Error('Invalid email or password');
  }

  const tokens = generateTokens(user);

  return {
    user,
    ...tokens,
  };
};

export default {
  generateTokens,
  createTestCustomer,
  createTestProvider,
  createTestAdmin,
  deleteTestUser,
  mockLogin,
};
