
import { useState, useCallback, useMemo } from 'react';

// Validation patterns
export const validators = {
  email: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  phone: (v: string) => /^[6-9]\d{9}$/.test(v),
  name: (v: string) => v.length >= 2 && v.length <= 50,
  otp: (v: string) => /^\d{4,6}$/.test(v),
  pincode: (v: string) => /^\d{6}$/.test(v),
  required: (v: string) => v.trim().length > 0,
  minLength: (v: string, min: number) => v.length >= min,
  maxLength: (v: string, max: number) => v.length <= max,
  url: (v: string) => {
    try {
      new URL(v);
      return true;
    } catch {
      return false;
    }
  },
  alphanumeric: (v: string) => /^[a-zA-Z0-9]+$/.test(v),
};

// Error messages for validators
export const validationMessages = {
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid phone number (10 digits starting with 6-9)',
  name: 'Name must be between 2 and 50 characters',
  otp: 'Please enter a valid OTP (4-6 digits)',
  pincode: 'Please enter a valid 6-digit pincode',
  required: 'This field is required',
  minLength: (min: number) => `Must be at least ${min} characters`,
  maxLength: (max: number) => `Must be no more than ${max} characters`,
  url: 'Please enter a valid URL',
  alphanumeric: 'Only letters and numbers are allowed',
};

// Validation rules configuration
export interface ValidationRule {
  field: string;
  validator: keyof typeof validators | ((value: string) => boolean);
  message: string;
  params?: unknown[];
}

export interface ValidationConfig {
  [field: string]: Array<{
    validator: keyof typeof validators | ((value: string) => boolean);
    message: string;
    params?: unknown[];
  }>;
}

// Validate a single field
export const validateField = (
  field: string,
  value: string,
  rules?: Array<{
    validator: keyof typeof validators | ((value: string) => boolean);
    message: string;
    params?: unknown[];
  }>
): string | null => {
  // Check required first
  if (!value || value.trim() === '') {
    return validationMessages.required;
  }

  // If no rules provided, use default validation based on field name
  if (!rules) {
    const fieldLower = field.toLowerCase();

    if (fieldLower.includes('email')) {
      return validators.email(value) ? null : validationMessages.email;
    }
    if (fieldLower.includes('phone') || fieldLower.includes('mobile')) {
      return validators.phone(value) ? null : validationMessages.phone;
    }
    if (fieldLower.includes('name')) {
      return validators.name(value) ? null : validationMessages.name;
    }
    if (fieldLower.includes('pincode') || fieldLower.includes('zip')) {
      return validators.pincode(value) ? null : validationMessages.pincode;
    }
    return null;
  }

  // Apply custom rules
  for (const rule of rules) {
    let isValid: boolean;

    if (typeof rule.validator === 'function') {
      isValid = rule.validator(value);
    } else if (typeof rule.validator === 'string' && rule.params) {
      const validatorFn = validators[rule.validator];
      const params = rule.params;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      isValid = (validatorFn as any)(value, ...params);
    } else {
      isValid = (validators[rule.validator] as (v: string, ...args: unknown[]) => boolean)(value);
    }

    if (!isValid) {
      return rule.message;
    }
  }

  return null;
};

// Validate multiple fields at once
export const validateForm = (
  values: Record<string, string>,
  config?: ValidationConfig
): Record<string, string> => {
  const errors: Record<string, string> = {};

  for (const [field, value] of Object.entries(values)) {
    const rules = config?.[field];
    const error = validateField(field, value, rules);
    if (error) {
      errors[field] = error;
    }
  }

  return errors;
};

// Hook for form validation state management
export interface UseFormValidationReturn {
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  validate: (field: string, value: string, rules?: ValidationConfig[string]) => boolean;
  validateAll: (values: Record<string, string>, config?: ValidationConfig) => boolean;
  setError: (field: string, message: string) => void;
  clearError: (field: string) => void;
  clearAllErrors: () => void;
  setTouched: (field: string) => void;
  reset: () => void;
  hasErrors: boolean;
  isValid: boolean;
}

export const useFormValidation = (initialErrors: Record<string, string> = {}): UseFormValidationReturn => {
  const [errors, setErrors] = useState<Record<string, string>>(initialErrors);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const setError = useCallback((field: string, message: string) => {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const setTouchedField = useCallback((field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }, []);

  const validate = useCallback(
    (field: string, value: string, rules?: ValidationConfig[string]): boolean => {
      const error = validateField(field, value, rules);
      setErrors((prev) => {
        if (error) {
          return { ...prev, [field]: error };
        }
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
      setTouchedField(field);
      return !error;
    },
    [setTouchedField]
  );

  const validateAll = useCallback(
    (values: Record<string, string>, config?: ValidationConfig): boolean => {
      const newErrors = validateForm(values, config);
      setErrors(newErrors);

      // Mark all fields as touched
      const allTouched: Record<string, boolean> = {};
      Object.keys(values).forEach((field) => {
        allTouched[field] = true;
      });
      setTouched(allTouched);

      return Object.keys(newErrors).length === 0;
    },
    []
  );

  const reset = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);
  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  return {
    errors,
    touched,
    validate,
    validateAll,
    setError,
    clearError,
    clearAllErrors,
    setTouched: setTouchedField,
    reset,
    hasErrors,
    isValid,
  };
};

// Booking-specific validation helpers
export const bookingValidators = {
  // Validate date is in the future
  futureDate: (dateStr: string): boolean => {
    const selected = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return selected >= today;
  },

  // Validate time slot format (e.g., "09:00 AM")
  timeSlot: (time: string): boolean => {
    return /^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(time.trim());
  },

  // Validate address is complete
  completeAddress: (address: { street?: string; city?: string }): boolean => {
    return !!(address.street?.trim() && address.city?.trim());
  },

  // Validate guest info
  guestInfo: (info: { name?: string; email?: string; phone?: string }): boolean => {
    return !!(
      info.name?.trim() &&
      info.email?.trim() &&
      validators.email(info.email) &&
      info.phone?.trim() &&
      validators.phone(info.phone)
    );
  },
};

// Step validation helper for multi-step forms
export const validateBookingStep = (
  step: number,
  formData: Record<string, unknown>,
  validators: Record<string, (value: unknown) => boolean>
): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};

  switch (step) {
    case 1: // Date & Time Selection
      if (!formData.scheduledDate) {
        errors.scheduledDate = 'Please select a date';
      }
      if (!formData.scheduledTime) {
        errors.scheduledTime = 'Please select a time slot';
      }
      break;

    case 2: // Service Details
      if (formData.locationType === 'at_home') {
        if (!validators.address?.(formData)) {
          errors.address = 'Please complete your address';
        }
      }
      break;

    case 3: // Contact & Payment
      if (formData.guestMode) {
        if (!validators.guestName?.(formData.guestName)) {
          errors.guestName = 'Please enter your name';
        }
        if (!validators.guestEmail?.(formData.guestEmail)) {
          errors.guestEmail = 'Please enter a valid email';
        }
        if (!validators.guestPhone?.(formData.guestPhone)) {
          errors.guestPhone = 'Please enter a valid phone number';
        }
      }
      break;

    case 4: // Confirmation
      // Payment step - no validation needed
      break;

    default:
      break;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
