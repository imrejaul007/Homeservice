/**
 * Comprehensive validation schemas for all API endpoints
 * Includes DoS prevention, input sanitization, and strict type validation
 */

import Joi from 'joi';

/**
 * Password complexity requirements
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

/**
 * Phone number pattern (international format)
 */
export const PHONE_PATTERN = /^\+?[\d\s\-\(\)]{10,20}$/;

/**
 * MongoDB ObjectId pattern
 */
export const OBJECT_ID_PATTERN = /^[a-fA-F0-9]{24}$/;

/**
 * Booking idempotency key pattern (alphanumeric with underscore/dash)
 */
export const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9_-]{16,64}$/;

// ============================================
// AUTH VALIDATION SCHEMAS
// ============================================

export const customerRegistrationSchema = Joi.object({
  firstName: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.min': 'First name is required',
      'string.max': 'First name cannot exceed 100 characters',
    }),

  lastName: Joi.string()
    .min(1)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.min': 'Last name is required',
      'string.max': 'Last name cannot exceed 100 characters',
    }),

  email: Joi.string()
    .email()
    .max(255)
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email cannot exceed 255 characters',
    }),

  password: Joi.string()
    .min(12)
    .max(128)
    .pattern(PASSWORD_PATTERN)
    .required()
    .messages({
      'string.min': 'Password must be at least 12 characters long',
      'string.max': 'Password cannot exceed 128 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    }),

  phone: Joi.string()
    .pattern(PHONE_PATTERN)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
    }),

  dateOfBirth: Joi.string().allow('').optional(),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
  referralCode: Joi.string().max(50).allow('').optional(),

  agreeToTermsAndPrivacy: Joi.alternatives()
    .try(Joi.boolean().valid(true), Joi.string().valid('true', '1'))
    .required()
    .messages({
      'any.required': 'You must agree to Terms of Service and Privacy Policy',
    }),
}).options({ stripUnknown: true });

export const loginSchema = Joi.object({
  email: Joi.string()
    .email()
    .max(255)
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
    }),

  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
  }),

  rememberMe: Joi.boolean().default(false),
}).options({ stripUnknown: true });

// ============================================
// BOOKING VALIDATION SCHEMAS
// ============================================

export const bookingInputSchema = Joi.object({
  serviceId: Joi.string()
    .pattern(OBJECT_ID_PATTERN)
    .required()
    .messages({
      'string.pattern.base': 'Invalid service ID format',
    }),

  providerId: Joi.string()
    .pattern(OBJECT_ID_PATTERN)
    .required()
    .messages({
      'string.pattern.base': 'Invalid provider ID format',
    }),

  scheduledDate: Joi.string()
    .isoDate()
    .required()
    .messages({
      'string.isoDate': 'Please provide a valid date',
    }),

  scheduledTime: Joi.string()
    .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid time in HH:MM format',
    }),

  locationType: Joi.string()
    .valid('at_home', 'at_provider', 'at_hotel')
    .optional(),

  selectedDuration: Joi.number().integer().min(15).max(480).optional(),
  genderPreference: Joi.string().valid('male', 'female', 'no_preference').default('no_preference'),
  experiencePreference: Joi.string().valid('no_preference', 'specific', 'any_experience').default('no_preference'),
  paymentMethod: Joi.string().allow('').optional(),
  specialRequests: Joi.string().max(1000).allow('').optional(),

  metadata: Joi.object({
    idempotencyKey: Joi.string()
      .pattern(IDEMPOTENCY_KEY_PATTERN)
      .required()
      .messages({
        'string.pattern.base': 'Idempotency key must be 16-64 alphanumeric characters',
        'any.required': 'Idempotency key is required to prevent duplicate bookings',
      }),
    bookingSource: Joi.string().max(100).allow('').optional(),
    deviceType: Joi.string().max(50).allow('').optional(),
    sessionId: Joi.string().max(255).allow('').optional(),
  }).required(),
}).options({ stripUnknown: true });

export const bookingFiltersSchema = Joi.object({
  status: Joi.string()
    .valid('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')
    .optional(),
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  sortBy: Joi.string()
    .valid('createdAt', 'scheduledDate', 'status', 'totalAmount', 'updatedAt')
    .default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().max(200).allow('').optional(),
}).options({ stripUnknown: true });

// ============================================
// SEARCH VALIDATION SCHEMAS
// ============================================

export const searchQuerySchema = Joi.object({
  q: Joi.string().max(200).allow('').optional(),
  category: Joi.string().max(100).allow('').optional(),
  subcategory: Joi.string().max(100).allow('').optional(),
  minPrice: Joi.number().min(0).max(1000000).optional(),
  maxPrice: Joi.number().min(0).max(1000000).optional(),
  minRating: Joi.number().min(0).max(5).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  radius: Joi.number().min(1).max(100).optional(),
  city: Joi.string().max(100).allow('').optional(),
  state: Joi.string().max(100).allow('').optional(),
  sortBy: Joi.string()
    .valid('popularity', 'price', 'price_desc', 'rating', 'distance', 'newest')
    .default('popularity'),
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
}).options({ stripUnknown: true });

export const serviceIdSchema = Joi.object({
  id: Joi.string()
    .pattern(OBJECT_ID_PATTERN)
    .required()
    .messages({
      'string.pattern.base': 'Invalid service ID format',
    }),
});

// ============================================
// PROVIDER VALIDATION SCHEMAS
// ============================================

export const serviceCreateSchema = Joi.object({
  name: Joi.string().min(3).max(200).trim().required(),
  category: Joi.string().min(1).max(100).trim().required(),
  subcategory: Joi.string().max(100).allow('').optional(),
  description: Joi.string().max(2000).allow('').optional(),
  duration: Joi.number().integer().min(15).max(480).required(),
  price: Joi.object({
    amount: Joi.number().min(0).max(1000000).required(),
    currency: Joi.string().default('AED'),
    type: Joi.string().valid('fixed', 'hourly', 'starting_from').default('fixed'),
  }).required(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
}).options({ stripUnknown: true });

// ============================================
// PAGINATION VALIDATION SCHEMAS
// ============================================

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string()
    .valid('createdAt', 'updatedAt', 'name', 'email', '_id', 'scheduledDate', 'status', 'totalAmount')
    .default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

// ============================================
// INPUT SANITIZATION HELPERS
// ============================================

/**
 * Sanitize a string by removing potentially dangerous characters
 */
export const sanitizeString = (input: string): string => {
  if (!input || typeof input !== 'string') return '';

  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .slice(0, 10000); // Limit length
};

/**
 * Validate and sanitize an array of strings
 */
export const sanitizeStringArray = (input: unknown): string[] => {
  if (!Array.isArray(input)) return [];

  return input
    .filter(item => typeof item === 'string')
    .map(sanitizeString)
    .filter(s => s.length > 0)
    .slice(0, 100); // Max 100 items
};

/**
 * Validate email format
 */
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
};

/**
 * Validate MongoDB ObjectId
 */
export const isValidObjectId = (id: string): boolean => {
  return OBJECT_ID_PATTERN.test(id);
};

/**
 * Validate idempotency key
 */
export const isValidIdempotencyKey = (key: string): boolean => {
  return IDEMPOTENCY_KEY_PATTERN.test(key);
};

export default {
  PASSWORD_PATTERN,
  PHONE_PATTERN,
  OBJECT_ID_PATTERN,
  IDEMPOTENCY_KEY_PATTERN,
  customerRegistrationSchema,
  loginSchema,
  bookingInputSchema,
  bookingFiltersSchema,
  searchQuerySchema,
  serviceIdSchema,
  serviceCreateSchema,
  paginationSchema,
  sanitizeString,
  sanitizeStringArray,
  isValidEmail,
  isValidObjectId,
  isValidIdempotencyKey,
};
