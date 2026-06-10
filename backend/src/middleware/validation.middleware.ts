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
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import multer from 'multer';
import logger from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Upload Configuration - Disk Storage with Size Limits
// =============================================================================

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const MAX_DIR_SIZE_BYTES = 500 * 1024 * 1024; // 500MB total storage limit
const MAX_FILE_AGE_HOURS = 24; // Delete files older than 24 hours
const STALE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check for stale files every hour

// Lazy-initialize upload directory
function ensureUploadDir(): void {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info('[upload] Created uploads directory', { path: UPLOAD_DIR });
  }
}

// Get current directory size in bytes
function getDirSize(): number {
  ensureUploadDir();
  let totalSize = 0;
  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    for (const file of files) {
      const filePath = path.join(UPLOAD_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        totalSize += stat.size;
      }
    }
  } catch (error) {
    logger.warn('[upload] Error calculating directory size', { error: (error as Error).message });
  }
  return totalSize;
}

// Delete stale files (older than MAX_FILE_AGE_HOURS)
async function cleanupStaleFiles(): Promise<number> {
  ensureUploadDir();
  const now = Date.now();
  const maxAgeMs = MAX_FILE_AGE_HOURS * 60 * 60 * 1000;
  let deletedCount = 0;
  let freedBytes = 0;

  try {
    const files = fs.readdirSync(UPLOAD_DIR);
    for (const file of files) {
      const filePath = path.join(UPLOAD_DIR, file);
      try {
        const stat = fs.statSync(filePath);
        if (stat.isFile() && (now - stat.mtimeMs) > maxAgeMs) {
          freedBytes += stat.size;
          fs.unlinkSync(filePath);
          deletedCount++;
          logger.debug('[upload] Deleted stale file', { file, age: `${Math.round((now - stat.mtimeMs) / 3600000)}h` });
        }
      } catch {
        // File might have been deleted by another process, skip
      }
    }
    if (deletedCount > 0) {
      logger.info('[upload] Cleaned up stale files', { deletedCount, freedMB: (freedBytes / 1024 / 1024).toFixed(2) });
    }
  } catch (error) {
    logger.error('[upload] Error during stale file cleanup', { error: (error as Error).message });
  }
  return deletedCount;
}

// Schedule periodic cleanup
let cleanupInterval: NodeJS.Timeout | null = null;

function scheduleStaleFileCleanup(): void {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    cleanupStaleFiles().catch(err => {
      logger.error('[upload] Scheduled cleanup failed', { error: (err as Error).message });
    });
  }, STALE_CHECK_INTERVAL_MS);
  cleanupInterval.unref();
}

// Initialize upload system on first use
let uploadSystemInitialized = false;

function initializeUploadSystem(): void {
  if (uploadSystemInitialized) return;
  uploadSystemInitialized = true;
  ensureUploadDir();
  scheduleStaleFileCleanup();
  cleanupStaleFiles().catch(err => {
    logger.warn('[upload] Initial cleanup skipped', { error: (err as Error).message });
  });
  logger.info('[upload] Upload system initialized', {
    uploadDir: UPLOAD_DIR,
    maxDirSizeMB: MAX_DIR_SIZE_BYTES / 1024 / 1024,
    maxFileAgeHours: MAX_FILE_AGE_HOURS
  });
}

// Get upload stats for monitoring
export function getUploadStats(): { uploadDir: string; currentSizeMB: number; maxSizeMB: number; usedPercent: number } {
  const currentSize = getDirSize();
  return {
    uploadDir: UPLOAD_DIR,
    currentSizeMB: parseFloat((currentSize / 1024 / 1024).toFixed(2)),
    maxSizeMB: MAX_DIR_SIZE_BYTES / 1024 / 1024,
    usedPercent: parseFloat(((currentSize / MAX_DIR_SIZE_BYTES) * 100).toFixed(1))
  };
}

// Read file buffer for magic bytes validation (disk storage compatible)
async function readFileBuffer(filePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = fs.createReadStream(filePath, { start: 0, end: 8191 }); // Read first 8KB for magic bytes
    stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// Disk storage factory with size limit enforcement
function createDiskStorage(): multer.StorageEngine {
  return multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
      initializeUploadSystem();

      const currentSize = getDirSize();
      if (currentSize >= MAX_DIR_SIZE_BYTES) {
        logger.warn('[upload] Storage limit reached, attempting cleanup', { currentSizeMB: (currentSize / 1024 / 1024).toFixed(2) });
        cleanupStaleFiles().then(() => {
          const newSize = getDirSize();
          if (newSize >= MAX_DIR_SIZE_BYTES) {
            cb(new Error('Upload storage limit reached. Please try again later.'), UPLOAD_DIR);
          } else {
            cb(null, UPLOAD_DIR);
          }
        }).catch(() => {
          cb(new Error('Upload storage temporarily unavailable.'), UPLOAD_DIR);
        });
        return;
      }
      cb(null, UPLOAD_DIR);
    },
    filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.tmp';
      const uniqueName = `${uuidv4()}${ext}`;
      cb(null, uniqueName);
    }
  });
}

// File storage configuration - uses disk storage with size limits (not memory)
const storage = createDiskStorage();

// Magic bytes (file signatures) for secure file content validation
// Prevents MIME type spoofing attacks where Content-Type header is faked
const MAGIC_BYTES: Record<string, { signatures: Buffer[]; offset?: number }> = {
  'image/jpeg': {
    signatures: [
      Buffer.from([0xFF, 0xD8, 0xFF, 0xDB]),
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]),
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE1]),
      Buffer.from([0xFF, 0xD8, 0xFF, 0xEE]),
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE2]),
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE3]),
      Buffer.from([0xFF, 0xD8, 0xFF, 0xE8]),
    ]
  },
  'image/png': {
    signatures: [
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
    ]
  },
  'image/webp': {
    signatures: [
      // RIFF....WEBP - bytes 4-7 are file size (variable), skip them
      Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])
    ]
  },
  'application/pdf': {
    signatures: [
      Buffer.from([0x25, 0x50, 0x44, 0x46]) // %PDF
    ]
  }
};

/**
 * Validates file content by checking magic bytes (file signatures).
 * This prevents MIME type spoofing attacks where Content-Type header is faked.
 * @param buffer - File buffer to check
 * @param expectedMimeType - Expected MIME type from validation
 * @returns true if magic bytes match expected type, false otherwise
 */
function validateMagicBytes(buffer: Buffer, expectedMimeType: string): boolean {
  const magicConfig = MAGIC_BYTES[expectedMimeType];
  if (!magicConfig) {
    return false;
  }

  const offset = magicConfig.offset || 0;

  for (const signature of magicConfig.signatures) {
    if (buffer.length >= offset + signature.length) {
      let match = true;
      for (let i = 0; i < signature.length; i++) {
        // For WebP RIFF header, bytes 4-7 are file size (not fixed)
        if (expectedMimeType === 'image/webp' && i >= 4 && i <= 7) {
          continue;
        }
        if (buffer[offset + i] !== signature[i]) {
          match = false;
          break;
        }
      }
      if (match) {
        return true;
      }
    }
  }

  return false;
}

// File filter for allowed file types (initial fast check before buffer is fully available)
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

// Allowed MIME types mapped to magic byte signatures for content validation
const ALLOWED_CONTENT_TYPES: Record<string, string[]> = {
  'portfolio': ['image/jpeg', 'image/png', 'image/webp'],
  'avatar': ['image/jpeg', 'image/png', 'image/webp'],
  'identityDocument': ['application/pdf', 'image/jpeg', 'image/png'],
  'businessLicense': ['application/pdf', 'image/jpeg', 'image/png'],
  'certifications': ['application/pdf', 'image/jpeg', 'image/png']
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
    logger.debug('[parseFormDataJSON] Processing FormData', { fields });

    // Parse JSON strings in specified fields
    fields.forEach(field => {
      if (req.body[field] && typeof req.body[field] === 'string') {
        try {
          req.body[field] = JSON.parse(req.body[field]);
          logger.debug('[parseFormDataJSON] Parsed field', { field });
        } catch (error) {
          logger.warn('[parseFormDataJSON] Failed to parse field, keeping as string', {
            field,
            error: (error as Error).message
          });
          // Keep as string if parsing fails, let validation handle it
        }
      }
    });

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

    const { error, value } = schema.validate(dataToValidate, validationOptions);

    if (error) {
      logger.debug('[validate] Validation failed', { errorCount: error.details.length });

      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        code: ERROR_CODES.VALIDATION_ERROR,
        errors: validationErrors
      });
    }

    logger.debug('[validate] Validation successful');

    // Update request object with validated data
    if (options?.validateParams && options?.validateQuery) {
      Object.assign(req.body, value);
    } else {
      req.body = value;
    }

    next();
  };
};

// File validation middleware - works with disk storage (reads file from path)
export const validateFiles = (requiredFiles: string[] = []) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void | Response> => {
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
      for (const [fieldName, fileArray] of Object.entries(files)) {
        for (let index = 0; index < fileArray.length; index++) {
          const file = fileArray[index];

          // Check file size (already handled by multer, but we can add custom logic)
          if (file.size === 0) {
            errors.push(`${fieldName}[${index}] is empty`);
          }

          // Check file name length
          if (file.originalname.length > 255) {
            errors.push(`${fieldName}[${index}] filename is too long`);
          }

          // Path traversal vulnerability check - reject files with path traversal patterns
          const filename = file.originalname;
          const pathTraversalPattern = /(\.\.[\\/])|([\\/]\.\.)|(^\.\.[\\/])/i;
          if (pathTraversalPattern.test(filename)) {
            errors.push(`${fieldName}[${index}] filename contains invalid path traversal characters`);
          }

          // SECURITY: Validate actual file content via magic bytes to prevent MIME spoofing
          const allowedTypes = ALLOWED_CONTENT_TYPES[fieldName];
          if (allowedTypes && file.path) {
            try {
              const fileBuffer = await readFileBuffer(file.path);
              let mimeValid = false;
              for (const allowedType of allowedTypes) {
                if (validateMagicBytes(fileBuffer, allowedType)) {
                  // Verify the declared MIME type matches the content
                  if (file.mimetype === allowedType) {
                    mimeValid = true;
                    break;
                  }
                }
              }

              if (!mimeValid) {
                logger.warn('[validateFiles] MIME type spoofing detected via magic bytes', {
                  filename: file.originalname,
                  fieldname: fieldName,
                  declaredMimeType: file.mimetype,
                  bufferHex: fileBuffer.slice(0, 16).toString('hex')
                });
                errors.push(`${fieldName}[${index}] file content does not match declared type`);
              }
            } catch (err) {
              logger.error('[validateFiles] Failed to read file for validation', {
                filename: file.originalname,
                error: (err as Error).message
              });
              errors.push(`${fieldName}[${index}] could not validate file content`);
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'File validation error',
        code: ERROR_CODES.VALIDATION_ERROR,
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
      code: ERROR_CODES.FILE_UPLOAD_ERROR
    });
  }

  // Handle storage limit errors from disk storage
  if (err.message && err.message.includes('storage limit')) {
    return res.status(507).json({
      success: false,
      message: err.message,
      code: ERROR_CODES.FILE_UPLOAD_ERROR
    });
  }

  next(err);
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
          code: ERROR_CODES.FORBIDDEN
        });
      }

      // Additional status checks could be added here
      if (requiredStatus && user.providerProfile?.verificationStatus !== requiredStatus) {
        return res.status(403).json({
          success: false,
          message: `Provider must be ${requiredStatus} to access this endpoint`,
          code: ERROR_CODES.FORBIDDEN
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
      code: ERROR_CODES.UNAUTHORIZED
    });
  }

  if (user.role !== 'provider') {
    return res.status(403).json({
      success: false,
      message: 'Only providers can access this endpoint',
      code: ERROR_CODES.FORBIDDEN
    });
  }

  next();
};

// Export the base validate function for custom schemas
export { validate };