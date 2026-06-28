/**
 * Comprehensive Validation Schemas for API Request Validation
 * Provides strict type validation for all API endpoints using Joi
 *
 * These schemas are used by the validation middleware to validate
 * incoming requests before they reach the controllers.
 */

import Joi from 'joi';

// ============================================
// COMMON PATTERNS
// ============================================

export const OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/;
export const PHONE_REGEX = /^\+?[\d\s\-\(\)]{10,20}$/;
export const TIME_REGEX = /^\d{2}:\d{2}$/;
export const IDEMPOTENCY_KEY_REGEX = /^[a-zA-Z0-9_-]{16,64}$/;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

/**
 * Standard location types for booking validation
 */
export const LOCATION_TYPES = ['at_home', 'at_provider', 'at_hotel', 'hotel', 'customer_address'];

/**
 * Booking status options
 */
export const BOOKING_STATUSES = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];

/**
 * Service status options
 */
export const SERVICE_STATUSES = ['draft', 'active', 'inactive', 'pending_review', 'rejected'];

// ============================================
// AUTH VALIDATION SCHEMAS
// ============================================

export const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .max(255)
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email cannot exceed 255 characters',
    }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
  }),
  rememberMe: Joi.boolean().default(false),
});

export const customerRegistrationSchema = Joi.object({
  firstName: Joi.string().min(1).max(100).trim().required().messages({
    'string.min': 'First name is required',
    'string.max': 'First name cannot exceed 100 characters',
  }),
  lastName: Joi.string().min(1).max(100).trim().required().messages({
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
      'string.min': 'Password must be at least 12 characters',
      'string.max': 'Password cannot exceed 128 characters',
      'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
    }),
  phone: Joi.string().pattern(PHONE_REGEX).required().messages({
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

export const providerRegistrationSchema = Joi.object({
  firstName: Joi.string().min(1).max(100).trim().required(),
  lastName: Joi.string().min(1).max(100).trim().required(),
  email: Joi.string().email().max(255).lowercase().trim().required(),
  password: Joi.string().min(12).max(128).required(),
  phone: Joi.string().pattern(PHONE_REGEX).required(),
  serviceCategories: Joi.array().items(Joi.string()).min(1).required(),
}).options({ stripUnknown: true });

export const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email()
    .max(255)
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please provide a valid email',
    }),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().min(1).required().messages({
    'string.empty': 'Reset token is required',
  }),
  password: Joi.string().min(12).max(128).pattern(PASSWORD_PATTERN).required().messages({
    'string.min': 'Password must be at least 12 characters',
    'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
  }),
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(1).required().messages({
    'any.required': 'Current password is required',
  }),
  newPassword: Joi.string().min(12).max(128).pattern(PASSWORD_PATTERN).required().messages({
    'string.min': 'Password must be at least 12 characters',
    'string.pattern.base': 'Password must contain uppercase, lowercase, number, and special character',
  }),
});

// ============================================
// BOOKING VALIDATION SCHEMAS
// ============================================

export const createBookingSchema = Joi.object({
  serviceId: Joi.string().pattern(OBJECT_ID_REGEX).required().messages({
    'string.pattern.base': 'Invalid service ID format',
  }),
  providerId: Joi.string().pattern(OBJECT_ID_REGEX).optional(),
  scheduledDate: Joi.string().isoDate().required().messages({
    'string.isoDate': 'Please provide a valid date',
  }),
  scheduledTime: Joi.string().pattern(TIME_REGEX).required().messages({
    'string.pattern.base': 'Please provide a valid time in HH:MM format',
  }),
  locationType: Joi.string().valid(...LOCATION_TYPES).optional(),
  selectedDuration: Joi.number().integer().min(15).max(480).optional(),
  genderPreference: Joi.string().valid('male', 'female', 'no_preference').default('no_preference'),
  experiencePreference: Joi.string().valid('no_preference', 'specific', 'any_experience').default('no_preference'),
  paymentMethod: Joi.string().allow('').optional(),
  specialRequests: Joi.string().max(1000).allow('').optional(),
  metadata: Joi.object({
    idempotencyKey: Joi.string().pattern(IDEMPOTENCY_KEY_REGEX).required().messages({
      'string.pattern.base': 'Idempotency key must be 16-64 alphanumeric characters',
    }),
    bookingSource: Joi.string().max(100).allow('').optional(),
    deviceType: Joi.string().max(50).allow('').optional(),
    sessionId: Joi.string().max(255).allow('').optional(),
  }).required(),
}).options({ stripUnknown: true });

export const bookingFiltersSchema = Joi.object({
  status: Joi.string().valid(...BOOKING_STATUSES).optional(),
  page: Joi.number().integer().min(1).max(10000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  sortBy: Joi.string()
    .valid('createdAt', 'scheduledDate', 'status', 'totalAmount', 'updatedAt')
    .default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().max(200).allow('').optional(),
});

export const updateBookingSchema = Joi.object({
  bookingId: Joi.string().pattern(OBJECT_ID_REGEX).required(),
  scheduledDate: Joi.string().isoDate().optional(),
  scheduledTime: Joi.string().pattern(TIME_REGEX).optional(),
  status: Joi.string().valid(...BOOKING_STATUSES).optional(),
  specialRequests: Joi.string().max(1000).optional(),
}).options({ stripUnknown: true });

// ============================================
// SERVICE VALIDATION SCHEMAS
// ============================================

export const createServiceSchema = Joi.object({
  name: Joi.string().min(3).max(200).trim().required().messages({
    'string.min': 'Service name must be at least 3 characters',
    'string.max': 'Service name cannot exceed 200 characters',
  }),
  category: Joi.string().min(1).max(100).trim().required(),
  subcategory: Joi.string().max(100).allow('').optional(),
  shortDescription: Joi.string().max(500).allow('').optional(),
  description: Joi.string().max(2000).allow('').optional(),
  duration: Joi.number().integer().min(15).max(480).required().messages({
    'number.min': 'Duration must be at least 15 minutes',
    'number.max': 'Duration cannot exceed 480 minutes',
  }),
  price: Joi.object({
    amount: Joi.number().min(0).max(1000000).required(),
    currency: Joi.string().default('AED'),
    type: Joi.string().valid('fixed', 'hourly', 'starting_from').default('fixed'),
  }).required(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  durationOptions: Joi.array().items(
    Joi.object({
      duration: Joi.number().integer().min(15).max(480).required(),
      priceAdjustment: Joi.number().required(),
      label: Joi.string().optional(),
    })
  ).max(10).optional(),
  addOns: Joi.array().items(
    Joi.object({
      name: Joi.string().min(1).max(100).required(),
      price: Joi.number().min(0).required(),
      description: Joi.string().max(500).optional(),
    })
  ).max(10).optional(),
  isFeatured: Joi.boolean().optional(),
  status: Joi.string().valid(...SERVICE_STATUSES).optional(),
  images: Joi.array().items(Joi.string().uri()).max(10).optional(),
}).options({ stripUnknown: true });

export const updateServiceSchema = Joi.object({
  serviceId: Joi.string().pattern(OBJECT_ID_REGEX).required(),
  name: Joi.string().min(3).max(200).trim().optional(),
  category: Joi.string().min(1).max(100).trim().optional(),
  subcategory: Joi.string().max(100).allow('').optional(),
  shortDescription: Joi.string().max(500).allow('').optional(),
  description: Joi.string().max(2000).allow('').optional(),
  duration: Joi.number().integer().min(15).max(480).optional(),
  price: Joi.object({
    amount: Joi.number().min(0).max(1000000).required(),
    currency: Joi.string().default('AED'),
    type: Joi.string().valid('fixed', 'hourly', 'starting_from').default('fixed'),
  }).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(20).optional(),
  durationOptions: Joi.array().items(
    Joi.object({
      duration: Joi.number().integer().min(15).max(480).required(),
      priceAdjustment: Joi.number().required(),
      label: Joi.string().optional(),
    })
  ).max(10).optional(),
  addOns: Joi.array().items(
    Joi.object({
      name: Joi.string().min(1).max(100).required(),
      price: Joi.number().min(0).required(),
      description: Joi.string().max(500).optional(),
    })
  ).max(10).optional(),
  isFeatured: Joi.boolean().optional(),
  status: Joi.string().valid(...SERVICE_STATUSES).optional(),
}).options({ stripUnknown: true });

export const serviceFiltersSchema = Joi.object({
  status: Joi.string().valid(...SERVICE_STATUSES).optional(),
  category: Joi.string().optional(),
  search: Joi.string().max(200).optional(),
  minPrice: Joi.number().min(0).optional(),
  maxPrice: Joi.number().min(0).optional(),
  minRating: Joi.number().min(0).max(5).optional(),
  featured: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sortBy: Joi.string().valid('createdAt', 'name', 'price', 'rating').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
});

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
});

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
// COUPON/REVIEW VALIDATION SCHEMAS
// ============================================

export const createCouponSchema = Joi.object({
  code: Joi.string().min(3).max(50).uppercase().trim().required(),
  discountType: Joi.string().valid('percentage', 'fixed').required(),
  discountValue: Joi.number().min(0).required(),
  minOrderAmount: Joi.number().min(0).optional(),
  maxDiscount: Joi.number().min(0).optional(),
  usageLimit: Joi.number().integer().min(1).optional(),
  usageCount: Joi.number().integer().min(0).default(0),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().required(),
  isActive: Joi.boolean().default(true),
  applicableServices: Joi.array().items(Joi.string().pattern(OBJECT_ID_REGEX)).optional(),
  applicableCategories: Joi.array().items(Joi.string()).optional(),
}).options({ stripUnknown: true });

export const createReviewSchema = Joi.object({
  bookingId: Joi.string().pattern(OBJECT_ID_REGEX).required(),
  rating: Joi.number().integer().min(1).max(5).required().messages({
    'number.min': 'Rating must be at least 1 star',
    'number.max': 'Rating cannot exceed 5 stars',
  }),
  title: Joi.string().max(200).optional(),
  comment: Joi.string().max(2000).optional(),
  photos: Joi.array().items(Joi.string().uri()).max(5).optional(),
  wouldRecommend: Joi.boolean().optional(),
}).options({ stripUnknown: true });

// ============================================
// USER/PROFILE VALIDATION SCHEMAS
// ============================================

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(1).max(100).trim().optional(),
  lastName: Joi.string().min(1).max(100).trim().optional(),
  phone: Joi.string().pattern(PHONE_REGEX).optional(),
  dateOfBirth: Joi.string().optional(),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
  bio: Joi.string().max(500).optional(),
  profilePicture: Joi.string().uri().optional(),
  notificationPreferences: Joi.object({
    email: Joi.boolean().optional(),
    sms: Joi.boolean().optional(),
    push: Joi.boolean().optional(),
  }).optional(),
}).options({ stripUnknown: true });

export const updateAddressSchema = Joi.object({
  addressId: Joi.string().pattern(OBJECT_ID_REGEX).optional(),
  label: Joi.string().max(50).optional(),
  street: Joi.string().max(200).optional(),
  city: Joi.string().max(100).optional(),
  state: Joi.string().max(100).optional(),
  postalCode: Joi.string().max(20).optional(),
  country: Joi.string().max(100).optional(),
  lat: Joi.number().min(-90).max(90).optional(),
  lng: Joi.number().min(-180).max(180).optional(),
  isDefault: Joi.boolean().optional(),
}).options({ stripUnknown: true });

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
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .slice(0, 10000);
};

/**
 * Validate and parse request body with a Joi schema
 */
export const validateBody = <T>(schema: Joi.ObjectSchema, data: unknown): { success: true; data: T } | { success: false; errors: Joi.ValidationErrorItem[] } => {
  const result = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (!result.error) {
    return { success: true, data: result.value as T };
  }
  return { success: false, errors: result.error.details };
};

/**
 * Validate and parse query params with a Joi schema
 */
export const validateQuery = <T>(schema: Joi.ObjectSchema, data: unknown): { success: true; data: T } | { success: false; errors: Joi.ValidationErrorItem[] } => {
  const result = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (!result.error) {
    return { success: true, data: result.value as T };
  }
  return { success: false, errors: result.error.details };
};

/**
 * Validate and parse params with a Joi schema
 */
export const validateParams = <T>(schema: Joi.ObjectSchema, data: unknown): { success: true; data: T } | { success: false; errors: Joi.ValidationErrorItem[] } => {
  const result = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (!result.error) {
    return { success: true, data: result.value as T };
  }
  return { success: false, errors: result.error.details };
};

// Export all schemas and helpers
export default {
  // Patterns
  OBJECT_ID_REGEX,
  PHONE_REGEX,
  TIME_REGEX,
  IDEMPOTENCY_KEY_REGEX,
  PASSWORD_PATTERN,
  LOCATION_TYPES,
  BOOKING_STATUSES,
  SERVICE_STATUSES,
  // Auth schemas
  loginSchema,
  customerRegistrationSchema,
  providerRegistrationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  // Booking schemas
  createBookingSchema,
  bookingFiltersSchema,
  updateBookingSchema,
  // Service schemas
  createServiceSchema,
  updateServiceSchema,
  serviceFiltersSchema,
  // Search schemas
  searchQuerySchema,
  paginationSchema,
  // Coupon/Review schemas
  createCouponSchema,
  createReviewSchema,
  // Profile schemas
  updateProfileSchema,
  updateAddressSchema,
  // Helpers
  sanitizeString,
  validateBody,
  validateQuery,
  validateParams,
};
