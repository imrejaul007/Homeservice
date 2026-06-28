/**
 * Validation Error Formatter
 *
 * Transforms Mongoose/MongoDB validation errors into user-friendly messages
 * with friendly field names and clear error explanations.
 */

import mongoose from 'mongoose';

const ValidationError = mongoose.Error.ValidationError;

// =============================================================================
// Type Definitions
// =============================================================================

export interface FormattedError {
  field: string;
  message: string;
  friendlyName: string;
  kind?: string;
  value?: unknown;
  properties?: Record<string, unknown>;
}

export interface ValidationErrorResult {
  success: boolean;
  message: string;
  errors: FormattedError[];
  fieldErrors: Record<string, string>; // For API compatibility: field -> message
}

/**
 * Map of field names to friendly display names
 */
const FRIENDLY_FIELD_NAMES: Record<string, string> = {
  // Common fields
  email: 'Email address',
  password: 'Password',
  name: 'Name',
  firstName: 'First name',
  lastName: 'Last name',
  phone: 'Phone number',
  phoneNumber: 'Phone number',

  // Address fields
  street: 'Street address',
  city: 'City',
  state: 'State/Province',
  country: 'Country',
  zipCode: 'ZIP/Postal code',
  zip: 'ZIP/Postal code',
  postalCode: 'ZIP/Postal code',
  address: 'Address',
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2',

  // Service fields
  serviceName: 'Service name',
  serviceNameAr: 'Service name (Arabic)',
  shortDescription: 'Short description',
  shortDescriptionAr: 'Short description (Arabic)',
  description: 'Description',
  descriptionAr: 'Description (Arabic)',
  category: 'Category',
  price: 'Price',
  duration: 'Duration',
  durationMinutes: 'Duration',
  tags: 'Tags',
  images: 'Images',
  thumbnail: 'Thumbnail image',

  // Booking fields
  bookingDate: 'Booking date',
  bookingTime: 'Booking time',
  scheduledDate: 'Scheduled date',
  scheduledTime: 'Scheduled time',
  serviceDate: 'Service date',
  serviceTime: 'Service time',
  notes: 'Notes',
  specialInstructions: 'Special instructions',

  // Payment fields
  cardNumber: 'Card number',
  cardHolder: 'Card holder name',
  expiryDate: 'Expiry date',
  cvv: 'CVV',
  paymentMethod: 'Payment method',

  // Profile fields
  bio: 'Bio',
  bioAr: 'Bio (Arabic)',
  profilePicture: 'Profile picture',
  avatar: 'Avatar',

  // Business fields
  businessName: 'Business name',
  businessNameAr: 'Business name (Arabic)',
  taxId: 'Tax ID',
  businessLicense: 'Business license',

  // Review fields
  rating: 'Rating',
  comment: 'Comment',
  reviewText: 'Review text',

  // Review fields
  title: 'Title',
  discount: 'Discount',
  maxUses: 'Maximum uses',
  expiresAt: 'Expiration date',
};

/**
 * Convert field name to friendly display name
 */
const toFriendlyName = (field: string): string => {
  // Check predefined mappings
  if (FRIENDLY_FIELD_NAMES[field]) {
    return FRIENDLY_FIELD_NAMES[field];
  }

  // Convert camelCase to Title Case with spaces
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/Id$/, ' ID')
    .trim();
};

/**
 * Format validation error kind to friendly message
 */
const formatKindError = (
  kind: string,
  friendlyName: string,
  properties?: Record<string, unknown>
): string => {
  switch (kind) {
    case 'required':
      return `${friendlyName} is required`;

    case 'minlength':
      const minLength = properties?.minlength as number;
      if (minLength !== undefined) {
        return `${friendlyName} must be at least ${minLength} characters`;
      }
      return `${friendlyName} is too short`;

    case 'maxlength':
      const maxLength = properties?.maxlength as number;
      if (maxLength !== undefined) {
        return `${friendlyName} must be at most ${maxLength} characters`;
      }
      return `${friendlyName} is too long`;

    case 'min':
      const minValue = properties?.min;
      if (minValue !== undefined) {
        return `${friendlyName} must be at least ${minValue}`;
      }
      return `${friendlyName} is too low`;

    case 'max':
      const maxValue = properties?.max;
      if (maxValue !== undefined) {
        return `${friendlyName} must be at most ${maxValue}`;
      }
      return `${friendlyName} is too high`;

    case 'enum':
      const enumValues = properties?.enumValues;
      if (Array.isArray(enumValues) && enumValues.length > 0) {
        return `${friendlyName} must be one of: ${enumValues.join(', ')}`;
      }
      return `${friendlyName} is invalid`;

    case 'pattern':
      return `${friendlyName} has an invalid format`;

    case 'user defined':
      const message = properties?.message as string;
      if (message) {
        // Make user-defined messages more friendly
        return message.replace(/%PATH%/g, friendlyName).replace(/%VALUE%/g, 'value');
      }
      return `${friendlyName} is invalid`;

    case 'castError':
      return `${friendlyName} has an invalid format`;

    default:
      return `${friendlyName} is invalid`;
  }
};

/**
 * Format a single validation error
 */
export const formatValidationError = (field: string, error: Record<string, unknown>): FormattedError => {
  const friendlyName = toFriendlyName(field);
  const kind = error.kind as string || 'unknown';
  const properties = error.properties as Record<string, unknown>;

  return {
    field,
    message: formatKindError(kind, friendlyName, properties),
    friendlyName,
    kind,
    value: error.value,
    properties,
  };
};

/**
 * Format Mongoose ValidationError to user-friendly format
 */
export const formatMongooseValidationError = (error: any): ValidationErrorResult => {
  const errors: FormattedError[] = [];
  const fieldErrors: Record<string, string> = {};

  for (const field in error.errors) {
    const err = error.errors[field];

    if (err) {
      const formatted = formatValidationError(field, {
        kind: err.kind,
        message: err.message,
        properties: err.properties,
        value: err.value,
      });

      errors.push(formatted);
      fieldErrors[field] = formatted.message;
    }
  }

  const message = errors.length === 1
    ? errors[0].message
    : `${errors.length} validation error(s)`;

  return {
    success: false,
    message,
    errors,
    fieldErrors,
  };
};

/**
 * Format a generic error object to friendly messages
 */
export const formatGenericError = (error: Record<string, unknown>): ValidationErrorResult => {
  const errors: FormattedError[] = [];
  const fieldErrors: Record<string, string> = {};

  // Handle errors object from validation
  if (error.errors && typeof error.errors === 'object') {
    const errorsObj = error.errors as Record<string, Record<string, unknown>>;

    for (const field in errorsObj) {
      const err = errorsObj[field];

      if (err) {
        const formatted = formatValidationError(field, {
          kind: err.kind as string,
          message: err.message as string,
          properties: err.properties as Record<string, unknown>,
          value: err.value,
        });

        errors.push(formatted);
        fieldErrors[field] = formatted.message;
      }
    }
  }

  // Handle single message error
  if (error.message && errors.length === 0) {
    const message = error.message as string;
    return {
      success: false,
      message,
      errors: [],
      fieldErrors: {},
    };
  }

  const combinedMessage = errors.length === 1
    ? errors[0].message
    : `${errors.length} validation error(s)`;

  return {
    success: false,
    message: combinedMessage,
    errors,
    fieldErrors,
  };
};

/**
 * Create a validation error response for API
 */
export const createValidationErrorResponse = (
  error: any | Record<string, unknown>
): ValidationErrorResult => {
  if (error instanceof ValidationError) {
    return formatMongooseValidationError(error);
  }
  return formatGenericError(error);
};

/**
 * Helper to check if an error is a validation error
 */
export const isValidationError = (error: unknown): boolean => {
  if (error instanceof ValidationError) {
    return true;
  }

  // Check for errors object pattern
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    return (
      'errors' in err &&
      typeof err.errors === 'object' &&
      err.errors !== null
    );
  }

  return false;
};

export default {
  formatValidationError,
  formatMongooseValidationError,
  formatGenericError,
  createValidationErrorResponse,
  isValidationError,
  toFriendlyName,
};
