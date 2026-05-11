export const APP_CONSTANTS = {
  APP_NAME: 'Home Service Marketplace',
  API_VERSION: process.env.API_VERSION || 'v1',
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // User Roles
  USER_ROLES: {
    CUSTOMER: 'customer',
    PROVIDER: 'provider',
    ADMIN: 'admin'
  } as const,

  // Service Status
  SERVICE_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PENDING: 'pending',
    SUSPENDED: 'suspended'
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

export type UserRole = typeof APP_CONSTANTS.USER_ROLES[keyof typeof APP_CONSTANTS.USER_ROLES];
export type ServiceStatus = typeof APP_CONSTANTS.SERVICE_STATUS[keyof typeof APP_CONSTANTS.SERVICE_STATUS];
export type BookingStatus = typeof APP_CONSTANTS.BOOKING_STATUS[keyof typeof APP_CONSTANTS.BOOKING_STATUS];
export type PaymentStatus = typeof APP_CONSTANTS.PAYMENT_STATUS[keyof typeof APP_CONSTANTS.PAYMENT_STATUS];