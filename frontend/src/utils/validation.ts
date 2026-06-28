/**
 * Validation Utilities for NILIN Marketplace
 *
 * Shared validation functions for consistent input validation across the platform.
 * These functions return detailed error information for form feedback.
 *
 * @module utils/validation
 */

// =============================================================================
// Validation Result Types
// =============================================================================

/**
 * Single validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

/**
 * Validation result with success flag and errors
 */
export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
  errorCount: number;
}

/**
 * Schema definition for form validation
 */
export interface ValidationSchema {
  [field: string]: {
    required?: boolean;
    requiredMessage?: string;
    type?: 'string' | 'number' | 'email' | 'phone' | 'url' | 'date' | 'array' | 'object';
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    patternMessage?: string;
    custom?: (value: unknown) => ValidationError | null;
    customMessage?: string;
    transform?: (value: unknown) => unknown;
  };
}

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Strong password regex (min 8 chars, uppercase, lowercase, number, special char)
 */
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

/**
 * Phone number regex (stricter validation)
 * Validates: +1234567890, +123 456 7890, (123) 456-7890, 123-456-7890, 1234567890
 */
const PHONE_REGEX = /^(?:\+?[1-9]\d{0,2}[-\s.]?)?\(?\d{3}\)?[-\s.]?\d{3}[-\s.]?\d{4}$/;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate an email address
 *
 * @param email - Email to validate
 * @returns Validation result
 *
 * @example
 * validateEmail('test@example.com') // { success: true, errors: [] }
 * validateEmail('invalid') // { success: false, errors: [{ field: 'email', message: '...' }] }
 */
export function validateEmail(email: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!email || email.trim() === '') {
    errors.push({ field: 'email', message: 'Email is required', code: 'REQUIRED' });
  } else if (!EMAIL_REGEX.test(email)) {
    errors.push({ field: 'email', message: 'Please enter a valid email address', code: 'INVALID_FORMAT' });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate a password
 *
 * @param password - Password to validate
 * @param options - Validation options
 * @returns Validation result
 *
 * @options minLength - Minimum length (default: 8)
 * @options requireUppercase - Require uppercase letter (default: true)
 * @options requireLowercase - Require lowercase letter (default: true)
 * @options requireNumber - Require number (default: true)
 * @options requireSpecial - Require special character (default: true)
 *
 * @example
 * validatePassword('StrongPass123!') // { success: true, errors: [] }
 */
export function validatePassword(
  password: string,
  options: {
    minLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumber?: boolean;
    requireSpecial?: boolean;
  } = {}
): ValidationResult {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSpecial = true,
  } = options;

  const errors: ValidationError[] = [];

  if (!password) {
    errors.push({ field: 'password', message: 'Password is required', code: 'REQUIRED' });
    return { success: false, errors, errorCount: errors.length };
  }

  if (password.length < minLength) {
    errors.push({
      field: 'password',
      message: `Password must be at least ${minLength} characters long`,
      code: 'TOO_SHORT',
    });
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one uppercase letter',
      code: 'MISSING_UPPERCASE',
    });
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one lowercase letter',
      code: 'MISSING_LOWERCASE',
    });
  }

  if (requireNumber && !/\d/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one number',
      code: 'MISSING_NUMBER',
    });
  }

  if (requireSpecial && !/[@$!%*?&]/.test(password)) {
    errors.push({
      field: 'password',
      message: 'Password must contain at least one special character (@$!%*?&)',
      code: 'MISSING_SPECIAL',
    });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate password strength (returns numeric score)
 *
 * @param password - Password to check
 * @returns Strength score (0-100) and feedback
 *
 * @example
 * validatePasswordStrength('weak') // { score: 20, level: 'weak', feedback: [...] }
 */
export function validatePasswordStrength(password: string): {
  score: number;
  level: 'weak' | 'fair' | 'good' | 'strong';
  feedback: string[];
} {
  const feedback: string[] = [];
  let score = 0;

  if (!password) {
    return { score: 0, level: 'weak', feedback: ['Password is required'] };
  }

  // Length scoring
  if (password.length >= 8) score += 20;
  else feedback.push('Use at least 8 characters');

  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Complexity scoring
  if (/[a-z]/.test(password)) score += 15;
  else feedback.push('Add lowercase letters');

  if (/[A-Z]/.test(password)) score += 15;
  else feedback.push('Add uppercase letters');

  if (/\d/.test(password)) score += 15;
  else feedback.push('Add numbers');

  if (/[@$!%*?&]/.test(password)) score += 15;
  else feedback.push('Add special characters');

  // Determine level
  let level: 'weak' | 'fair' | 'good' | 'strong';
  if (score < 30) level = 'weak';
  else if (score < 60) level = 'fair';
  else if (score < 80) level = 'good';
  else level = 'strong';

  return { score: Math.min(100, score), level, feedback };
}

/**
 * Validate a phone number
 *
 * @param phone - Phone number to validate
 * @param country - Country code for validation (default: 'US')
 * @returns Validation result
 *
 * @example
 * validatePhone('1234567890', 'US') // { success: true, errors: [] }
 */
export function validatePhone(phone: string, country: string = 'US'): ValidationResult {
  const errors: ValidationError[] = [];

  if (!phone || phone.trim() === '') {
    errors.push({ field: 'phone', message: 'Phone number is required', code: 'REQUIRED' });
  } else if (!PHONE_REGEX.test(phone.replace(/\s/g, ''))) {
    errors.push({ field: 'phone', message: 'Please enter a valid phone number', code: 'INVALID_FORMAT' });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate required field
 *
 * @param value - Value to check
 * @param fieldName - Name of the field for error message
 * @returns Validation result
 */
export function validateRequired(value: unknown, fieldName: string = 'This field'): ValidationResult {
  const errors: ValidationError[] = [];

  if (value === undefined || value === null) {
    errors.push({ field: fieldName, message: `${fieldName} is required`, code: 'REQUIRED' });
  } else if (typeof value === 'string' && value.trim() === '') {
    errors.push({ field: fieldName, message: `${fieldName} is required`, code: 'REQUIRED' });
  } else if (Array.isArray(value) && value.length === 0) {
    errors.push({ field: fieldName, message: `${fieldName} is required`, code: 'REQUIRED' });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate string length
 *
 * @param value - String to validate
 * @param fieldName - Field name for error messages
 * @param min - Minimum length (optional)
 * @param max - Maximum length (optional)
 * @returns Validation result
 */
export function validateLength(
  value: string,
  fieldName: string,
  min?: number,
  max?: number
): ValidationResult {
  const errors: ValidationError[] = [];
  const length = value ? value.length : 0;

  if (min !== undefined && length < min) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be at least ${min} characters`,
      code: 'TOO_SHORT',
    });
  }

  if (max !== undefined && length > max) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be at most ${max} characters`,
      code: 'TOO_LONG',
    });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate number range
 *
 * @param value - Number to validate
 * @param fieldName - Field name for error messages
 * @param min - Minimum value (optional)
 * @param max - Maximum value (optional)
 * @returns Validation result
 */
export function validateRange(
  value: number,
  fieldName: string,
  min?: number,
  max?: number
): ValidationResult {
  const errors: ValidationError[] = [];

  if (min !== undefined && value < min) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be at least ${min}`,
      code: 'TOO_LOW',
    });
  }

  if (max !== undefined && value > max) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be at most ${max}`,
      code: 'TOO_HIGH',
    });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate URL
 *
 * @param url - URL to validate
 * @returns Validation result
 */
export function validateUrl(url: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!url || url.trim() === '') {
    errors.push({ field: 'url', message: 'URL is required', code: 'REQUIRED' });
  } else {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        errors.push({ field: 'url', message: 'URL must use http or https protocol', code: 'INVALID_PROTOCOL' });
      }
    } catch {
      errors.push({ field: 'url', message: 'Please enter a valid URL', code: 'INVALID_FORMAT' });
    }
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate date
 *
 * @param date - Date to validate
 * @param fieldName - Field name for error messages
 * @param options - Validation options
 * @returns Validation result
 *
 * @options minDate - Minimum allowed date
 * @options maxDate - Maximum allowed date
 * @options allowPast - Allow past dates (default: true)
 * @options allowFuture - Allow future dates (default: true)
 */
export function validateDate(
  date: string | Date,
  fieldName: string,
  options: {
    minDate?: Date;
    maxDate?: Date;
    allowPast?: boolean;
    allowFuture?: boolean;
  } = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  const { minDate, maxDate, allowPast = true, allowFuture = true } = options;

  if (!date) {
    errors.push({ field: fieldName, message: `${fieldName} is required`, code: 'REQUIRED' });
    return { success: false, errors, errorCount: errors.length };
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    errors.push({ field: fieldName, message: 'Please enter a valid date', code: 'INVALID_FORMAT' });
    return { success: false, errors, errorCount: errors.length };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!allowPast && dateObj < today) {
    errors.push({ field: fieldName, message: `${fieldName} cannot be in the past`, code: 'DATE_IN_PAST' });
  }

  if (!allowFuture && dateObj > today) {
    errors.push({ field: fieldName, message: `${fieldName} cannot be in the future`, code: 'DATE_IN_FUTURE' });
  }

  if (minDate && dateObj < minDate) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be after ${minDate.toLocaleDateString()}`,
      code: 'DATE_TOO_EARLY',
    });
  }

  if (maxDate && dateObj > maxDate) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be before ${maxDate.toLocaleDateString()}`,
      code: 'DATE_TOO_LATE',
    });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate time string (HH:mm format)
 *
 * @param time - Time string to validate
 * @param fieldName - Field name for error messages
 * @returns Validation result
 */
export function validateTime(time: string, fieldName: string): ValidationResult {
  const errors: ValidationError[] = [];
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

  if (!time || time.trim() === '') {
    errors.push({ field: fieldName, message: `${fieldName} is required`, code: 'REQUIRED' });
  } else if (!timeRegex.test(time)) {
    errors.push({ field: fieldName, message: 'Please enter a valid time (HH:MM)', code: 'INVALID_FORMAT' });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate credit card number (Luhn algorithm)
 *
 * @param cardNumber - Card number to validate
 * @returns Validation result
 */
export function validateCreditCard(cardNumber: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!cardNumber || cardNumber.trim() === '') {
    errors.push({ field: 'cardNumber', message: 'Card number is required', code: 'REQUIRED' });
    return { success: false, errors, errorCount: errors.length };
  }

  // Remove spaces and dashes
  const digits = cardNumber.replace(/[\s-]/g, '');

  // Check if all digits
  if (!/^\d+$/.test(digits)) {
    errors.push({ field: 'cardNumber', message: 'Card number must contain only digits', code: 'INVALID_FORMAT' });
    return { success: false, errors, errorCount: errors.length };
  }

  // Check length (13-19 digits)
  if (digits.length < 13 || digits.length > 19) {
    errors.push({ field: 'cardNumber', message: 'Card number must be 13-19 digits', code: 'INVALID_LENGTH' });
    return { success: false, errors, errorCount: errors.length };
  }

  // Luhn algorithm
  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    isEven = !isEven;
  }

  if (sum % 10 !== 0) {
    errors.push({ field: 'cardNumber', message: 'Invalid card number', code: 'INVALID_LUHN' });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate CVV/CVC
 *
 * @param cvv - CVV to validate
 * @param cardType - Card type for length validation (default: any 3-4 digits)
 * @returns Validation result
 */
export function validateCVV(cvv: string, cardType: 'amex' | 'default' = 'default'): ValidationResult {
  const errors: ValidationError[] = [];
  const expectedLength = cardType === 'amex' ? 4 : 3;

  if (!cvv || cvv.trim() === '') {
    errors.push({ field: 'cvv', message: 'CVV is required', code: 'REQUIRED' });
  } else if (!/^\d+$/.test(cvv) || cvv.length !== expectedLength) {
    errors.push({
      field: 'cvv',
      message: `CVV must be ${expectedLength} digits`,
      code: 'INVALID_LENGTH',
    });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate expiry date
 *
 * @param expiryMonth - Expiry month (1-12)
 * @param expiryYear - Expiry year (full year)
 * @returns Validation result
 */
export function validateExpiryDate(expiryMonth: number, expiryYear: number): ValidationResult {
  const errors: ValidationError[] = [];

  if (!expiryMonth || !expiryYear) {
    errors.push({ field: 'expiry', message: 'Expiry date is required', code: 'REQUIRED' });
    return { success: false, errors, errorCount: errors.length };
  }

  if (expiryMonth < 1 || expiryMonth > 12) {
    errors.push({ field: 'expiry', message: 'Invalid month', code: 'INVALID_MONTH' });
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (expiryYear < currentYear || (expiryYear === currentYear && expiryMonth < currentMonth)) {
    errors.push({ field: 'expiry', message: 'Card has expired', code: 'CARD_EXPIRED' });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate confirm password match
 *
 * @param password - Original password
 * @param confirmPassword - Confirmation password
 * @returns Validation result
 */
export function validateConfirmPassword(password: string, confirmPassword: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Please confirm your password', code: 'REQUIRED' });
  } else if (password !== confirmPassword) {
    errors.push({ field: 'confirmPassword', message: 'Passwords do not match', code: 'MISMATCH' });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate booking date (must be in future, within reasonable range)
 *
 * @param date - Booking date
 * @param maxAdvanceDays - Maximum days in advance (default: 90)
 * @returns Validation result
 */
export function validateBookingDate(date: string, maxAdvanceDays: number = 90): ValidationResult {
  const errors: ValidationError[] = [];

  if (!date) {
    errors.push({ field: 'date', message: 'Booking date is required', code: 'REQUIRED' });
    return { success: false, errors, errorCount: errors.length };
  }

  const bookingDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + maxAdvanceDays);

  if (bookingDate < today) {
    errors.push({ field: 'date', message: 'Booking date cannot be in the past', code: 'DATE_IN_PAST' });
  }

  if (bookingDate > maxDate) {
    errors.push({
      field: 'date',
      message: `Cannot book more than ${maxAdvanceDays} days in advance`,
      code: 'DATE_TOO_FAR',
    });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate address
 *
 * @param address - Address object
 * @returns Validation result
 */
export function validateAddress(address: {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (!address.street || address.street.trim() === '') {
    errors.push({ field: 'street', message: 'Street address is required', code: 'REQUIRED' });
  }

  if (!address.city || address.city.trim() === '') {
    errors.push({ field: 'city', message: 'City is required', code: 'REQUIRED' });
  }

  if (!address.country || address.country.trim() === '') {
    errors.push({ field: 'country', message: 'Country is required', code: 'REQUIRED' });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

/**
 * Validate coordinates
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Validation result
 */
export function validateCoordinates(lat: number, lng: number): ValidationResult {
  const errors: ValidationError[] = [];

  if (typeof lat !== 'number' || lat < -90 || lat > 90) {
    errors.push({ field: 'latitude', message: 'Latitude must be between -90 and 90', code: 'INVALID_RANGE' });
  }

  if (typeof lng !== 'number' || lng < -180 || lng > 180) {
    errors.push({ field: 'longitude', message: 'Longitude must be between -180 and 180', code: 'INVALID_RANGE' });
  }

  return {
    success: errors.length === 0,
    errors,
    errorCount: errors.length,
  };
}

// =============================================================================
// Schema-based Validation
// =============================================================================

/**
 * Validate an object against a schema
 *
 * @param data - Data object to validate
 * @param schema - Validation schema
 * @returns Validation result
 *
 * @example
 * validateSchema(
 *   { email: 'invalid', password: 'weak' },
 *   {
 *     email: { required: true, type: 'email' },
 *     password: { required: true, minLength: 8 }
 *   }
 * )
 */
export function validateSchema(data: Record<string, unknown>, schema: ValidationSchema): ValidationResult {
  const allErrors: ValidationError[] = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    // Apply transform if specified
    let processedValue = value;
    if (rules.transform) {
      processedValue = rules.transform(value);
    }

    // Required check
    if (rules.required) {
      const requiredResult = validateRequired(processedValue, field);
      if (!requiredResult.success) {
        allErrors.push({
          field,
          message: rules.requiredMessage || requiredResult.errors[0].message,
          code: requiredResult.errors[0].code,
        });
        continue;
      }
    }

    // Skip further validation if value is empty and not required
    if (processedValue === undefined || processedValue === null || processedValue === '') {
      continue;
    }

    // Type validation
    if (rules.type) {
      switch (rules.type) {
        case 'email':
          const emailResult = validateEmail(processedValue as string);
          if (!emailResult.success) {
            allErrors.push(...emailResult.errors.map((e) => ({ ...e, field })));
          }
          break;
        case 'phone':
          const phoneResult = validatePhone(processedValue as string);
          if (!phoneResult.success) {
            allErrors.push(...phoneResult.errors.map((e) => ({ ...e, field })));
          }
          break;
        case 'url':
          const urlResult = validateUrl(processedValue as string);
          if (!urlResult.success) {
            allErrors.push(...urlResult.errors.map((e) => ({ ...e, field })));
          }
          break;
        case 'date':
          const dateResult = validateDate(processedValue as string | Date, field);
          if (!dateResult.success) {
            allErrors.push(...dateResult.errors.map((e) => ({ ...e, field })));
          }
          break;
      }
    }

    // String length validation
    if (rules.minLength !== undefined || rules.maxLength !== undefined) {
      const lengthResult = validateLength(
        processedValue as string,
        field,
        rules.minLength,
        rules.maxLength
      );
      if (!lengthResult.success) {
        allErrors.push(...lengthResult.errors.map((e) => ({ ...e, field })));
      }
    }

    // Number range validation
    if (rules.min !== undefined || rules.max !== undefined) {
      const rangeResult = validateRange(processedValue as number, field, rules.min, rules.max);
      if (!rangeResult.success) {
        allErrors.push(...rangeResult.errors.map((e) => ({ ...e, field })));
      }
    }

    // Pattern validation
    if (rules.pattern && typeof processedValue === 'string' && !rules.pattern.test(processedValue)) {
      allErrors.push({
        field,
        message: rules.patternMessage || `Invalid format for ${field}`,
        code: 'INVALID_PATTERN',
      });
    }

    // Custom validation
    if (rules.custom) {
      const customResult = rules.custom(processedValue);
      if (customResult) {
        allErrors.push({ ...customResult, field });
      }
    }
  }

  return {
    success: allErrors.length === 0,
    errors: allErrors,
    errorCount: allErrors.length,
  };
}

/**
 * Get error message for a specific field
 *
 * @param result - Validation result
 * @param field - Field name
 * @returns Error message or undefined
 */
export function getFieldError(result: ValidationResult, field: string): string | undefined {
  const error = result.errors.find((e) => e.field === field);
  return error?.message;
}

/**
 * Check if field has error
 *
 * @param result - Validation result
 * @param field - Field name
 * @returns True if field has error
 */
export function hasFieldError(result: ValidationResult, field: string): boolean {
  return result.errors.some((e) => e.field === field);
}

// =============================================================================
// Export all functions
// =============================================================================

export const validation = {
  email: validateEmail,
  password: validatePassword,
  passwordStrength: validatePasswordStrength,
  phone: validatePhone,
  required: validateRequired,
  length: validateLength,
  range: validateRange,
  url: validateUrl,
  date: validateDate,
  time: validateTime,
  creditCard: validateCreditCard,
  cvv: validateCVV,
  expiryDate: validateExpiryDate,
  confirmPassword: validateConfirmPassword,
  bookingDate: validateBookingDate,
  address: validateAddress,
  coordinates: validateCoordinates,
  schema: validateSchema,
  getFieldError,
  hasFieldError,
};

export default validation;
