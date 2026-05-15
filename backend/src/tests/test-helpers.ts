/**
 * Test Helpers and Fixtures
 * Provides utilities for creating valid test data and mocking services
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Valid address coordinates for Dubai
const DUBAI_COORDS = {
  type: 'Point' as const,
  coordinates: [55.2708, 25.2048] as [number, number], // [lng, lat]
};

/**
 * Generate unique email for tests
 */
export const generateTestEmail = (prefix = 'test'): string => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`;
};

/**
 * Valid customer registration data
 */
export const validCustomerData = (overrides = {}) => ({
  firstName: 'Test',
  lastName: 'User',
  email: generateTestEmail('customer'),
  password: 'SecurePass@123',
  phone: '+971501234567',
  agreeToTerms: true,
  agreeToPrivacy: true,
  address: {
    street: '123 Test Street',
    city: 'Dubai',
    state: 'Dubai',
    country: 'UAE',
    zipCode: '12345',
    coordinates: DUBAI_COORDS,
  },
  ...overrides,
});

/**
 * Valid provider registration data
 */
export const validProviderData = (overrides = {}) => ({
  firstName: 'Provider',
  lastName: 'Service',
  email: generateTestEmail('provider'),
  password: 'SecurePass@123',
  phone: '+971501234568',
  agreeToTerms: true,
  agreeToPrivacy: true,
  address: {
    street: '456 Service Ave',
    city: 'Dubai',
    state: 'Dubai',
    country: 'UAE',
    zipCode: '54321',
    coordinates: DUBAI_COORDS,
  },
  serviceType: 'cleaning',
  ...overrides,
});

/**
 * Valid service data
 */
export const validServiceData = (providerId: string, overrides = {}) => ({
  providerId,
  name: 'Professional Cleaning Service',
  description: 'Deep cleaning for homes and offices',
  category: 'cleaning',
  basePrice: 150,
  pricing: {
    basePrice: 150,
    currency: 'AED',
  },
  duration: 120,
  isActive: true,
  location: {
    type: 'fixed',
    address: {
      street: '789 Provider Blvd',
      city: 'Dubai',
      state: 'Dubai',
      country: 'UAE',
      zipCode: '67890',
    },
    coordinates: DUBAI_COORDS,
  },
  ...overrides,
});

/**
 * Valid booking data
 */
export const validBookingData = (customerId: string, providerId: string, serviceId: string, overrides = {}) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return {
    customerId,
    providerId,
    serviceId,
    scheduledDate: tomorrow.toISOString().split('T')[0],
    scheduledTime: '10:00',
    location: {
      type: 'customer_address',
      address: {
        street: '321 Customer Lane',
        city: 'Dubai',
        state: 'Dubai',
        country: 'UAE',
        zipCode: '11111',
      },
      coordinates: DUBAI_COORDS,
    },
    notes: 'Test booking notes',
    ...overrides,
  };
};

/**
 * Create mock session for mongoose transactions
 */
export const createMockSession = () => {
  const session = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
    inTransaction: jest.fn(() => false),
  };
  return session;
};

/**
 * Mock mongoose startSession
 */
export const mockMongooseSession = () => {
  const mockSession = createMockSession();

  jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession as any);

  return mockSession;
};

/**
 * Wait for async operation with timeout
 */
export const waitFor = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Retry async operation
 */
export const retry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 100
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await waitFor(delay);
    return retry(fn, retries - 1, delay * 2);
  }
};

/**
 * Clear all mongoose collections
 */
export const clearCollections = async (): Promise<void> => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
};

/**
 * Create hashed password for test users
 */
export const hashPassword = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 12);
};

/**
 * Compare password with hash
 */
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};
