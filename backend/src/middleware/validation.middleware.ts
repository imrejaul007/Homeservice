import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { 
  customerRegistrationSchema,
  providerRegistrationSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  emailVerificationSchema,
  resendVerificationSchema,
  refreshTokenSchema,
  updateProfileSchema
} from '../validation/auth.validation';
import { ApiError } from '../utils/ApiError';
import multer from 'multer';

// File upload configuration
const storage = multer.memoryStorage();

// File filter for allowed file types
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Define allowed file types for different purposes
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const allowedDocumentTypes = ['application/pdf', 'image/jpeg', 'image/png'];

  // Check file type based on field name
  if (file.fieldname === 'portfolio' || file.fieldname === 'avatar') {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Only JPEG, PNG, and WebP images are allowed for portfolio/avatar'));
    }
  } else if (file.fieldname === 'identityDocument' || file.fieldname === 'businessLicense' || file.fieldname === 'certifications') {
    if (allowedDocumentTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Only PDF and image files are allowed for documents'));
    }
  } else {
    cb(new ApiError(400, 'Invalid file field'));
  }
};

// Configure multer for file uploads
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files per request
  }
});

// File upload middleware configurations
export const uploadConfig = {
  // Provider registration files
  providerRegistration: upload.fields([
    { name: 'identityDocument', maxCount: 1 },
    { name: 'businessLicense', maxCount: 1 },
    { name: 'certifications', maxCount: 5 },
    { name: 'portfolio', maxCount: 10 },
    { name: 'avatar', maxCount: 1 }
  ]),
  
  // Profile update files
  profileUpdate: upload.fields([
    { name: 'avatar', maxCount: 1 }
  ]),
  
  // Portfolio upload
  portfolio: upload.array('portfolio', 10),
  
  // Single file upload
  single: (fieldName: string) => upload.single(fieldName)
};

// JSON parsing middleware for FormData
export const parseFormDataJSON = (fields: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    console.log('🔍 [parseFormDataJSON] Raw request body:', req.body);
    console.log('🔍 [parseFormDataJSON] Fields to parse:', fields);

    // Parse JSON strings in specified fields
    fields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        try {
          console.log(`🔍 [parseFormDataJSON] Parsing field "${field}":`, req.body[field]);
          req.body[field] = JSON.parse(req.body[field]);
          console.log(`✅ [parseFormDataJSON] Parsed field "${field}":`, req.body[field]);
        } catch (error) {
          console.log(`❌ [parseFormDataJSON] Failed to parse field "${field}":`, error);
          // Keep as string if parsing fails, let validation handle it
        }
      } else {
        console.log(`🔍 [parseFormDataJSON] Field "${field}" not found or not a string:`, req.body[field]);
      }
    });

    console.log('🔍 [parseFormDataJSON] Final parsed body:', req.body);
    next();
  };
};

// Generic validation middleware factory
const validate = (schema: Joi.ObjectSchema, options?: {
  validateParams?: boolean;
  validateQuery?: boolean;
  allowUnknown?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const validationOptions = {
      abortEarly: false,
      allowUnknown: options?.allowUnknown || false,
      stripUnknown: true,
      convert: true // Enable automatic type conversion (string "true" -> boolean true)
    };

    // Determine what to validate
    let dataToValidate = req.body;
    
    if (options?.validateParams && options?.validateQuery) {
      dataToValidate = { ...req.body, ...req.params, ...req.query };
    } else if (options?.validateParams) {
      dataToValidate = { ...req.body, ...req.params };
    } else if (options?.validateQuery) {
      dataToValidate = { ...req.body, ...req.query };
    }

    console.log('🔍 [validate] Data to validate:', JSON.stringify(dataToValidate, null, 2));
    console.log('🔍 [validate] Validation options:', validationOptions);

    const { error, value } = schema.validate(dataToValidate, validationOptions);

    if (error) {
      console.log('❌ [validate] Validation failed:', error.details);

      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      console.log('❌ [validate] Formatted validation errors:', validationErrors);

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: validationErrors
      });
    }

    console.log('✅ [validate] Validation successful, validated value:', JSON.stringify(value, null, 2));

    // Update request object with validated data
    if (options?.validateParams && options?.validateQuery) {
      Object.assign(req.body, value);
    } else {
      req.body = value;
    }

    next();
  };
};

// File validation middleware
export const validateFiles = (requiredFiles: string[] = []) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    const errors: string[] = [];

    // Check required files
    requiredFiles.forEach(fieldName => {
      if (!files || !files[fieldName] || files[fieldName].length === 0) {
        errors.push(`${fieldName} is required`);
      }
    });

    // Validate file sizes and types
    if (files) {
      Object.entries(files).forEach(([fieldName, fileArray]) => {
        fileArray.forEach((file, index) => {
          // Check file size (already handled by multer, but we can add custom logic)
          if (file.size === 0) {
            errors.push(`${fieldName}[${index}] is empty`);
          }

          // Check file name length
          if (file.originalname.length > 255) {
            errors.push(`${fieldName}[${index}] filename is too long`);
          }
        });
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'File validation error',
        errors: errors.map(error => ({ field: 'files', message: error }))
      });
    }

    next();
  };
};

// Exported validation middlewares for specific endpoints
export const validateCustomerRegistration = validate(customerRegistrationSchema);
export const validateProviderRegistration = validate(providerRegistrationSchema);
export const validateLogin = validate(loginSchema);
export const validateForgotPassword = validate(forgotPasswordSchema);
export const validateResetPassword = validate(resetPasswordSchema);
export const validateChangePassword = validate(changePasswordSchema);
export const validateEmailVerification = validate(emailVerificationSchema);
export const validateResendVerification = validate(resendVerificationSchema);
export const validateRefreshToken = validate(refreshTokenSchema);
export const validateUpdateProfile = validate(updateProfileSchema);

// Parameter validation schemas
const userIdParamSchema = Joi.object({
  userId: Joi.string().required().messages({
    'string.empty': 'User ID is required',
    'any.required': 'User ID is required'
  })
});

const tokenParamSchema = Joi.object({
  token: Joi.string().required().messages({
    'string.empty': 'Token is required',
    'any.required': 'Token is required'
  })
});

// Parameter validation middlewares
export const validateUserIdParam = validate(userIdParamSchema, { validateParams: true });
export const validateTokenParam = validate(tokenParamSchema, { validateParams: true });

// Query validation schemas
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid('createdAt', 'updatedAt', 'name', 'email').default('createdAt'),
  order: Joi.string().valid('asc', 'desc').default('desc')
});

const searchSchema = Joi.object({
  q: Joi.string().min(1).max(100).trim(),
  category: Joi.string(),
  location: Joi.string(),
  radius: Joi.number().min(1).max(100)
});

// Query validation middlewares
export const validatePagination = validate(paginationSchema, { validateQuery: true });
export const validateSearch = validate(searchSchema, { validateQuery: true, allowUnknown: true });

// Composite validation middleware for complex endpoints
export const validateProviderRegistrationWithFiles = [
  uploadConfig.providerRegistration,
  parseFormDataJSON(['businessInfo', 'locationInfo', 'services']),
  validateProviderRegistration,
  validateFiles(['identityDocument'])
];

// Provider registration without required files (for initial registration)
export const validateProviderRegistrationWithoutFiles = [
  uploadConfig.providerRegistration,
  parseFormDataJSON(['businessInfo', 'locationInfo', 'services']),
  validateProviderRegistration,
  validateFiles([]) // No required files for initial registration
];

export const validateProfileUpdateWithFiles = [
  uploadConfig.profileUpdate,
  validateUpdateProfile,
  validateFiles([])
];

// Error handling middleware for file upload errors
export const handleFileUploadError = (err: any, _req: Request, res: Response, next: NextFunction): void | Response => {
  if (err instanceof multer.MulterError) {
    let message = 'File upload error';
    
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        message = 'File size too large. Maximum size is 10MB';
        break;
      case 'LIMIT_FILE_COUNT':
        message = 'Too many files. Maximum 10 files allowed';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        message = `Unexpected file field: ${err.field}`;
        break;
      default:
        message = err.message;
    }

    return res.status(400).json({
      success: false,
      message,
      error: 'FILE_UPLOAD_ERROR'
    });
  }

  next(err);
};

// Rate limiting validation (can be combined with other validations)
export const validateRateLimitBypass = (req: Request, _res: Response, next: NextFunction) => {
  const bypassToken = req.headers['x-rate-limit-bypass'] as string;
  
  if (bypassToken && bypassToken === process.env.RATE_LIMIT_BYPASS_TOKEN) {
    req.skipRateLimit = true;
  }
  
  next();
};

// Custom validation for specific business logic
export const validateProviderStatus = (requiredStatus?: string) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
    try {
      const user = (req as any).user;
      
      if (user.role !== 'provider') {
        return res.status(403).json({
          success: false,
          message: 'Only providers can access this endpoint',
          error: 'INVALID_USER_ROLE'
        });
      }

      // Additional status checks could be added here
      if (requiredStatus && user.providerProfile?.verificationStatus !== requiredStatus) {
        return res.status(403).json({
          success: false,
          message: `Provider must be ${requiredStatus} to access this endpoint`,
          error: 'INVALID_PROVIDER_STATUS'
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Provider role validation middleware
export const validateProviderRole = (req: Request, res: Response, next: NextFunction): void | Response => {
  const user = (req as any).user;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'AUTHENTICATION_REQUIRED'
    });
  }
  
  if (user.role !== 'provider') {
    return res.status(403).json({
      success: false,
      message: 'Only providers can access this endpoint',
      error: 'INVALID_USER_ROLE'
    });
  }
  
  next();
};

// Export the base validate function for custom schemas
export { validate };

// TypeScript module augmentation for custom properties
declare global {
  namespace Express {
    interface Request {
      skipRateLimit?: boolean;
    }
  }
}