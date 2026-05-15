// Standard error codes for consistent error handling across the application
export const ERROR_CODES = {
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Authentication errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_INVALID: 'TOKEN_INVALID',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // Authorization errors (403)
  FORBIDDEN: 'FORBIDDEN',
  ACCESS_DENIED: 'ACCESS_DENIED',

  // Not found errors (404)
  NOT_FOUND: 'NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',

  // Conflict errors (409)
  CONFLICT: 'CONFLICT',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Server errors (500)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Custom application errors
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  FILE_UPLOAD_ERROR: 'FILE_UPLOAD_ERROR',

  // Demo mode errors
  DEMO_DISABLED: 'DEMO_DISABLED',
  DEMO_LIMIT_REACHED: 'DEMO_LIMIT_REACHED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

class ApiError extends Error {
  statusCode: number;
  data: any;
  success: boolean;
  errors: any[];
  code: string;

  constructor(
    statusCode: number,
    message = "Something went wrong",
    errors: any[] = [],
    code: string = ERROR_CODES.INTERNAL_ERROR,
    stack = ""
  ) {
    super(message);
    this.statusCode = statusCode;
    this.data = null;
    this.message = message;
    this.success = false;
    this.errors = errors;
    this.code = code;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Helper methods for common error scenarios
  static badRequest(message: string, errors?: any[], code: string = ERROR_CODES.INVALID_INPUT): ApiError {
    return new ApiError(400, message, errors, code);
  }

  static unauthorized(message: string = 'Unauthorized', code: string = ERROR_CODES.UNAUTHORIZED): ApiError {
    return new ApiError(401, message, [], code);
  }

  static forbidden(message: string = 'Access denied', code: string = ERROR_CODES.FORBIDDEN): ApiError {
    return new ApiError(403, message, [], code);
  }

  static notFound(message: string = 'Resource not found', code: string = ERROR_CODES.NOT_FOUND): ApiError {
    return new ApiError(404, message, [], code);
  }

  static conflict(message: string, code: string = ERROR_CODES.CONFLICT): ApiError {
    return new ApiError(409, message, [], code);
  }

  static internal(message: string = 'Internal server error'): ApiError {
    return new ApiError(500, message, [], ERROR_CODES.INTERNAL_ERROR);
  }
}

export { ApiError };