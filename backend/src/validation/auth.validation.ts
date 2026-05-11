import Joi from 'joi';

// Password validation schema
const passwordSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]'))
  .required()
  .messages({
    'string.min': 'Password must be at least 8 characters long',
    'string.max': 'Password cannot exceed 128 characters',
    'string.pattern.base': 'Password must contain at least one lowercase letter, one uppercase letter, one digit, and one special character',
    'any.required': 'Password is required'
  });

// Email validation schema
const emailSchema = Joi.string()
  .email({ tlds: { allow: false } })
  .lowercase()
  .max(255)
  .required()
  .messages({
    'string.email': 'Please provide a valid email address',
    'string.max': 'Email cannot exceed 255 characters',
    'any.required': 'Email is required'
  });

// Phone validation schema
const phoneSchema = Joi.string()
  .pattern(new RegExp('^[\\+]?[(]?[\\d\\s\\-\\(\\)]{10,}$'))
  .messages({
    'string.pattern.base': 'Please provide a valid phone number'
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
  phone: phoneSchema.optional(),
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
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required()
    }).optional()
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
  agreeToTerms: Joi.alternatives().try(
    Joi.boolean().valid(true),
    Joi.string().valid('true')
  ).required().messages({
    'any.only': 'You must agree to the terms and conditions'
  }),
  agreeToPrivacy: Joi.alternatives().try(
    Joi.boolean().valid(true),
    Joi.string().valid('true')
  ).required().messages({
    'any.only': 'You must agree to the privacy policy'
  })
});

// Provider registration validation
export const providerRegistrationSchema = Joi.object({
  // Personal information
  firstName: nameSchema,
  lastName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: Joi.string().optional(), // Allow confirmPassword but ignore it
  phone: phoneSchema.required(),
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
        coordinates: Joi.object({
          lat: Joi.number().min(-90).max(90).required(),
          lng: Joi.number().min(-180).max(180).required()
        }).optional() // Make coordinates optional
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
  agreeToTerms: Joi.alternatives().try(
    Joi.boolean().valid(true),
    Joi.string().valid('true')
  ).required().messages({
    'any.only': 'You must agree to the terms and conditions'
  }),
  agreeToPrivacy: Joi.alternatives().try(
    Joi.boolean().valid(true),
    Joi.string().valid('true')
  ).required().messages({
    'any.only': 'You must agree to the privacy policy'
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
  }).optional()
});

// Validation middleware factory
export const validate = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const validationErrors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors
      });
    }

    req.body = value;
    next();
  };
};