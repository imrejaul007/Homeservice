import Joi from 'joi';
import { getPlatformPolicySync } from '../services/platformSettingsPolicy.service';

/** Password rules driven by Admin → Settings → Security */
export const validatePasswordAgainstPolicy = (value: string, helpers: Joi.CustomHelpers) => {
  const policy = getPlatformPolicySync();

  if (!value || value.length < policy.passwordMinLength) {
    return helpers.error('any.custom', {
      message: `Password must be at least ${policy.passwordMinLength} characters long`,
    });
  }
  if (value.length > 128) {
    return helpers.error('any.custom', { message: 'Password cannot exceed 128 characters' });
  }
  if (policy.passwordRequireUppercase && !/[A-Z]/.test(value)) {
    return helpers.error('any.custom', { message: 'Password must contain an uppercase letter' });
  }
  if (policy.passwordRequireNumber && !/\d/.test(value)) {
    return helpers.error('any.custom', { message: 'Password must contain a number' });
  }
  if (policy.passwordRequireSpecialChar && !/[@$!%*?&]/.test(value)) {
    return helpers.error('any.custom', {
      message: 'Password must contain a special character (@$!%*?&)',
    });
  }
  if (!/[a-z]/.test(value)) {
    return helpers.error('any.custom', { message: 'Password must contain a lowercase letter' });
  }
  return value;
};

export const passwordSchema = Joi.string()
  .max(128)
  .required()
  .custom(validatePasswordAgainstPolicy)
  .messages({
    'any.required': 'Password is required',
  });

// Email validation schema
// FIX: Allow all valid TLDs - reject only invalid/non-existent TLDs
const emailSchema = Joi.string()
  .email({
    tlds: { allow: false },
    minDomainSegments: 2,
    maxDomainSegments: 4,
  })
  .lowercase()
  .max(254)
  .trim()
  .required()
  .messages({
    'string.email': 'Please provide a valid email address (e.g., user@example.com)',
    'string.max': 'Email cannot exceed 254 characters',
    'any.required': 'Email is required',
    'string.empty': 'Email cannot be empty'
  })
  .custom((value, helpers) => {
    // Additional sanitization - remove any invisible characters
    const sanitized = value.replace(/[​-‍﻿]/g, '');
    if (sanitized !== value) {
      return sanitized;
    }
    return value;
  });

// Phone validation schema
// FIX: Stricter phone validation to prevent typos and ensure consistency
const phoneSchema = Joi.string()
  .allow('', null)
  .optional()
  .custom((value, helpers) => {
    if (!value || value === '') return value; // Allow empty

    // Normalize phone number - remove common formatting characters
    const normalized = value.replace(/[\s\-\(\)\.]/g, '');

    // Check for valid phone patterns
    // Accepts: +1234567890, 1234567890, 001234567890 (country code variants)
    // Minimum 10 digits, maximum 15 digits (E.164 standard)
    const digitsOnly = normalized.replace(/[^\d]/g, '');

    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      return helpers.error('string.pattern.base');
    }

    // Check for invalid patterns (all same digit, too few unique digits, etc.)
    const uniqueDigits = new Set(digitsOnly).size;
    if (uniqueDigits < 3) {
      return helpers.error('string.pattern.base');
    }

    // Format to consistent pattern (E.164 if international, or national format)
    return digitsOnly.startsWith('+') ? digitsOnly : `+${digitsOnly}`;
  })
  .messages({
    'string.pattern.base': 'Please provide a valid phone number (10-15 digits, may include country code)'
  });

// Name validation schema
const nameSchema = Joi.string()
  .min(2)
  .max(50)
  .pattern(new RegExp('^[a-zA-Z\\s-\']+$'))
  .trim()
  .required()
  .messages({
    'string.min': 'Name must be at least 2 characters long',
    'string.max': 'Name cannot exceed 50 characters',
    'string.pattern.base': 'Name can only contain letters, spaces, hyphens, and apostrophes',
    'any.required': 'Name is required'
  });

// Customer registration validation
export const customerRegistrationSchema = Joi.object({
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  phone: Joi.string()
    .pattern(/^[\+]?[(]?[\d\s\-\(\)]{10,}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid phone number',
      'any.required': 'Phone number is required'
    }),
  dateOfBirth: Joi.date()
    .max('now')
    .min('1900-01-01')
    .optional()
    .messages({
      'date.max': 'Date of birth cannot be in the future',
      'date.min': 'Please provide a valid date of birth'
    }),
  gender: Joi.string()
    .valid('male', 'female', 'other', 'prefer_not_to_say')
    .optional(),
  address: Joi.object({
    street: Joi.string().max(200).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    country: Joi.string().max(100).default('US'),
    zipCode: Joi.string().max(20).optional(),
    // Accept coordinates in ANY format - service layer normalizes it
    coordinates: Joi.any().optional()
  }).optional(),
  communicationPreferences: Joi.object({
    email: Joi.object({
      marketing: Joi.boolean().default(false),
      bookingUpdates: Joi.boolean().default(true),
      reminders: Joi.boolean().default(true),
      newsletters: Joi.boolean().default(false),
      promotions: Joi.boolean().default(false)
    }).optional(),
    sms: Joi.object({
      bookingUpdates: Joi.boolean().default(true),
      reminders: Joi.boolean().default(true),
      promotions: Joi.boolean().default(false)
    }).optional(),
    push: Joi.object({
      bookingUpdates: Joi.boolean().default(true),
      reminders: Joi.boolean().default(true),
      newMessages: Joi.boolean().default(true),
      promotions: Joi.boolean().default(false)
    }).optional(),
    language: Joi.string().default('en'),
    timezone: Joi.string().default('UTC'),
    currency: Joi.string().default('USD')
  }).optional(),
  referralCode: Joi.string().optional(),
  agreeToTermsAndPrivacy: Joi.alternatives().try(
    Joi.boolean().valid(true),
    Joi.string().valid('true')
  ).required().messages({
    'any.only': 'You must agree to the terms and conditions and privacy policy'
  }),
});

// Provider registration validation
export const providerRegistrationSchema = Joi.object({
  // Personal information
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: Joi.string().optional(), // Allow confirmPassword but ignore it
  phone: Joi.string().allow('', null).optional(),
  dateOfBirth: Joi.alternatives().try(
    Joi.date().max('now').min('1900-01-01'),
    Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/)
  ).required().messages({
    'date.max': 'Date of birth cannot be in the future',
    'date.min': 'Please provide a valid date of birth',
    'any.required': 'Date of birth is required for providers'
  }),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
  
  // Business information
  businessInfo: Joi.alternatives().try(
    Joi.string(), // Handle JSON string from FormData
    Joi.object({
      businessName: Joi.string().min(2).max(100).required().messages({
        'string.min': 'Business name must be at least 2 characters long',
        'string.max': 'Business name cannot exceed 100 characters',
        'any.required': 'Business name is required'
      }),
      businessType: Joi.string()
        .valid('individual', 'small_business', 'company', 'franchise')
        .default('individual'),
      description: Joi.string().min(50).max(1000).required().messages({
        'string.min': 'Business description must be at least 50 characters long',
        'string.max': 'Business description cannot exceed 1000 characters',
        'any.required': 'Business description is required'
      }),
      tagline: Joi.string().max(100).allow('').optional(),
      website: Joi.string().uri().allow('').optional(),
      establishedDate: Joi.date().max('now').optional(),
      serviceRadius: Joi.number().min(1).max(100).default(25)
    })
  ).required(),
  
  // Location information
  locationInfo: Joi.alternatives().try(
    Joi.string(), // Handle JSON string from FormData
    Joi.object({
      primaryAddress: Joi.object({
        street: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        zipCode: Joi.string().required(),
        country: Joi.string().empty('').default('AE'),
        // Accept coordinates in ANY format - service layer normalizes it
        coordinates: Joi.any().optional()
      }).required(),
      mobileService: Joi.boolean().default(true),
      hasFixedLocation: Joi.boolean().default(false)
    })
  ).required(),
  
  // Services (at least one required)
  services: Joi.alternatives().try(
    Joi.string(), // Handle JSON string from FormData
    Joi.array().items(
      Joi.object({
        name: Joi.string().max(100).required(),
        category: Joi.string().required(),
        subcategory: Joi.string().optional(),
        description: Joi.string().max(500).required(),
        duration: Joi.number().min(15).max(480).required(),
        price: Joi.object({
          amount: Joi.number().min(0).required(),
          currency: Joi.string().default('AED'),
          type: Joi.string().valid('fixed', 'hourly', 'custom').default('fixed')
        }).required(),
        tags: Joi.array().items(Joi.string()).optional()
      })
    ).min(1)
  ).required().messages({
    'array.min': 'At least one service is required'
  }),
  
  // Agreements
  agreeToTermsAndPrivacy: Joi.alternatives().try(
    Joi.boolean().valid(true),
    Joi.string().valid('true')
  ).required().messages({
    'any.only': 'You must agree to the terms and conditions and privacy policy'
  }),
  agreeToBackground: Joi.alternatives().try(
    Joi.boolean().valid(true),
    Joi.string().valid('true')
  ).required().messages({
    'any.only': 'Background check agreement is required for providers'
  })
});

// Login validation
export const loginSchema = Joi.object({
  email: emailSchema,
  password: Joi.string().required().messages({
    'any.required': 'Password is required'
  }),
  rememberMe: Joi.boolean().default(false)
});

// Forgot password validation
export const forgotPasswordSchema = Joi.object({
  email: emailSchema
});

// Reset password validation
export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Reset token is required'
  }),
  password: passwordSchema,
  confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
    'any.only': 'Passwords do not match',
    'any.required': 'Password confirmation is required'
  })
});

// Change password validation
export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': 'Current password is required'
  }),
  newPassword: passwordSchema,
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Passwords do not match',
    'any.required': 'Password confirmation is required'
  })
});

// Email verification validation
export const emailVerificationSchema = Joi.object({
  token: Joi.string().required().messages({
    'any.required': 'Verification token is required'
  })
});

// Resend verification validation
export const resendVerificationSchema = Joi.object({
  email: emailSchema
});

// Refresh token validation
export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'any.required': 'Refresh token is required'
  })
});

// Profile update validation
export const updateProfileSchema = Joi.object({
  firstName: nameSchema.optional(),
  lastName: Joi.string()
    .min(1)
    .max(50)
    .pattern(new RegExp('^[a-zA-Z\\s-\']+$'))
    .trim()
    .optional()
    .messages({
      'string.min': 'Last name must be at least 1 character long',
      'string.max': 'Last name cannot exceed 50 characters',
      'string.pattern.base': 'Last name can only contain letters, spaces, hyphens, and apostrophes'
    }),
  phone: phoneSchema.optional(),
  bio: Joi.string().max(500).optional(),
  dateOfBirth: Joi.date().max('now').min('1900-01-01').optional(),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
  avatar: Joi.string().uri().optional(),
  address: Joi.object({
    street: Joi.string().max(200),
    city: Joi.string().max(100),
    state: Joi.string().max(100),
    country: Joi.string().max(100),
    zipCode: Joi.string().max(20),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90),
      lng: Joi.number().min(-180).max(180)
    })
  }).optional(),
  socialMediaLinks: Joi.object({
    instagram: Joi.string().uri().optional(),
    facebook: Joi.string().uri().optional(),
    twitter: Joi.string().uri().optional(),
    linkedin: Joi.string().uri().optional(),
    youtube: Joi.string().uri().optional(),
    tiktok: Joi.string().uri().optional()
  }).optional(),
  communicationPreferences: Joi.object({
    email: Joi.object({
      marketing: Joi.boolean(),
      bookingUpdates: Joi.boolean(),
      reminders: Joi.boolean(),
      newsletters: Joi.boolean(),
      promotions: Joi.boolean()
    }),
    sms: Joi.object({
      bookingUpdates: Joi.boolean(),
      reminders: Joi.boolean(),
      promotions: Joi.boolean()
    }),
    push: Joi.object({
      bookingUpdates: Joi.boolean(),
      reminders: Joi.boolean(),
      newMessages: Joi.boolean(),
      promotions: Joi.boolean()
    }),
    language: Joi.string(),
    timezone: Joi.string(),
    currency: Joi.string()
  }).optional(),
  yearsExperience: Joi.number().integer().min(0).max(50).optional(),
  serviceAreas: Joi.array().items(Joi.string().max(100)).optional(),
  serviceLocation: Joi.object({
    label: Joi.string().max(200).optional(),
    formattedAddress: Joi.string().max(500).optional(),
    street: Joi.string().max(200).optional(),
    city: Joi.string().max(100).optional(),
    state: Joi.string().max(100).optional(),
    zipCode: Joi.string().max(20).optional(),
    country: Joi.string().max(100).optional(),
    // Accept lat/lng in ANY format
    lat: Joi.any().optional(),
    lng: Joi.any().optional(),
  }).optional(),
});

