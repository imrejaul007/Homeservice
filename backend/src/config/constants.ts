import * as fs from 'fs';
import * as path from 'path';

// Read version from package.json at runtime
let APP_VERSION = '1.0.0';
try {
  const packageJsonPath = path.resolve(__dirname, '../../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  APP_VERSION = packageJson.version || '1.0.0';
} catch (error) {
  console.warn('Could not read version from package.json, using default');
}

export const APP_CONSTANTS = {
  APP_NAME: 'Home Service Marketplace',
  API_VERSION: process.env.API_VERSION || 'v1',
  APP_VERSION, // Dynamic version from package.json
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // User Roles
  USER_ROLES: {
    CUSTOMER: 'customer',
    PROVIDER: 'provider',
    ADMIN: 'admin'
  } as const,

  // Service Status (aligned with Service model)
  SERVICE_STATUS: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PENDING_REVIEW: 'pending_review',
  } as const,

  // Booking Status
  BOOKING_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded'
  } as const,

  // Payment Status
  PAYMENT_STATUS: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded'
  } as const,

  // File Upload
  FILE_UPLOAD: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.gif', '.webp']
  },

  // JWT
  JWT: {
    ACCESS_TOKEN_EXPIRE: '1d',
    REFRESH_TOKEN_EXPIRE: '7d',
    RESET_TOKEN_EXPIRE: '1h',
    VERIFY_TOKEN_EXPIRE: '24h'
  },

  // Email Templates
  EMAIL_TEMPLATES: {
    WELCOME: 'welcome',
    RESET_PASSWORD: 'reset-password',
    VERIFY_EMAIL: 'verify-email',
    BOOKING_CONFIRMATION: 'booking-confirmation',
    BOOKING_CANCELLATION: 'booking-cancellation',
    PAYMENT_SUCCESS: 'payment-success'
  },

  // Error Messages
  ERROR_MESSAGES: {
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden',
    NOT_FOUND: 'Resource not found',
    VALIDATION_ERROR: 'Validation error',
    INTERNAL_ERROR: 'Internal server error',
    DATABASE_ERROR: 'Database operation failed',
    INVALID_CREDENTIALS: 'Invalid email or password',
    EMAIL_EXISTS: 'Email already registered',
    TOKEN_EXPIRED: 'Token has expired',
    INVALID_TOKEN: 'Invalid token'
  },

  // Success Messages
  SUCCESS_MESSAGES: {
    LOGIN: 'Login successful',
    LOGOUT: 'Logout successful',
    REGISTER: 'Registration successful',
    PASSWORD_RESET: 'Password reset successful',
    EMAIL_SENT: 'Email sent successfully',
    PROFILE_UPDATED: 'Profile updated successfully',
    BOOKING_CREATED: 'Booking created successfully',
    PAYMENT_COMPLETED: 'Payment completed successfully'
  },

  // HTTP Status Codes
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  }
} as const;

// Referral Rewards Configuration
export const REFERRAL_REWARDS = {
  // Coins awarded to referrer when referral completes first booking
  REFERRER_REWARD: parseInt(process.env.REFERRER_REWARD_COINS || '500', 10),
  // Coins awarded to new user (referee) when using referral code
  REFEREE_REWARD: parseInt(process.env.REFEREE_REWARD_COINS || '250', 10),
  // Welcome bonus for users without referral code
  WELCOME_BONUS: parseInt(process.env.WELCOME_BONUS_COINS || '100', 10),
  // Reduced bonus for suspicious referrals (fraud penalty)
  SUSPICIOUS_REFERRAL_BONUS: parseInt(process.env.SUSPICIOUS_REFERRAL_BONUS_COINS || '50', 10),
  // Maximum referrals allowed per user
  MAX_REFERRALS_PER_USER: parseInt(process.env.MAX_REFERRALS_PER_USER || '50', 10),
} as const;

export type UserRole = typeof APP_CONSTANTS.USER_ROLES[keyof typeof APP_CONSTANTS.USER_ROLES];
export type ServiceStatus = typeof APP_CONSTANTS.SERVICE_STATUS[keyof typeof APP_CONSTANTS.SERVICE_STATUS];
export type BookingStatus = typeof APP_CONSTANTS.BOOKING_STATUS[keyof typeof APP_CONSTANTS.BOOKING_STATUS];
export type PaymentStatus = typeof APP_CONSTANTS.PAYMENT_STATUS[keyof typeof APP_CONSTANTS.PAYMENT_STATUS];

// FIX: Tax Configuration - Centralized tax rate for the platform
// UAE VAT rate is 5% as of 2018. This can be changed if tax laws change.
export const TAX_CONFIG = {
  // VAT/Tax rate (as decimal, e.g., 0.05 = 5%)
  RATE: parseFloat(process.env.TAX_RATE || '0.05'),
  // Tax rate as percentage (for display purposes)
  RATE_PERCENT: parseFloat(process.env.TAX_RATE || '0.05') * 100,
  // Whether tax is enabled
  ENABLED: process.env.TAX_ENABLED !== 'false',
  // Tax name for display
  NAME: process.env.TAX_NAME || 'VAT',
  // Currency for tax calculations
  CURRENCY: process.env.TAX_CURRENCY || 'AED',
} as const;

// FIX: Platform Timezone Configuration
// All offers and bookings use the platform timezone for consistency
// Default to Asia/Dubai (UAE timezone) as this is a UAE-based platform
export const PLATFORM_TIMEZONE = process.env.PLATFORM_TIMEZONE || 'Asia/Dubai';