import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryType, BiometryError, BiometryErrorType, CheckBiometryResult } from '@aparajita/capacitor-biometric-auth';

// Storage keys
const BIOMETRIC_ENABLED_KEY = 'nilin_biometric_enabled';
const BIOMETRIC_EMAIL_KEY = 'nilin_biometric_email';
const BIOMETRIC_PASSWORD_HASH_KEY = 'nilin_biometric_password_hash';

// Result types for authentication operations
export interface BiometricAuthSuccess {
  success: true;
}

export interface BiometricAuthFailure {
  success: false;
  fallbackRequired: false;
  errorMessage?: string;
}

export interface BiometricFallbackRequired {
  success: false;
  fallbackRequired: true;
  reason: 'user_fallback';
}

export type BiometricAuthResult = BiometricAuthSuccess | BiometricAuthFailure | BiometricFallbackRequired;

export interface PasswordValidationResult {
  valid: boolean;
  error?: string;
}

// Error messages mapping
const ERROR_MESSAGES: Record<BiometryErrorType, string> = {
  [BiometryErrorType.none]: 'An unknown error occurred',
  [BiometryErrorType.biometryNotAvailable]: 'Biometric authentication is not available on this device',
  [BiometryErrorType.biometryNotEnrolled]: 'No biometrics enrolled. Please set up biometrics in device settings',
  [BiometryErrorType.biometryLockout]: 'Too many failed attempts. Please try again later',
  [BiometryErrorType.authenticationFailed]: 'Authentication failed. Please try again',
  [BiometryErrorType.appCancel]: 'Authentication was cancelled by the app',
  [BiometryErrorType.invalidContext]: 'Authentication context is invalid',
  [BiometryErrorType.notInteractive]: 'Authentication requires user interaction',
  [BiometryErrorType.passcodeNotSet]: 'Please set up a device PIN or pattern',
  [BiometryErrorType.systemCancel]: 'Authentication was cancelled by the system',
  [BiometryErrorType.userCancel]: 'Authentication was cancelled by the user',
  [BiometryErrorType.userFallback]: 'User chose to use fallback authentication',
  [BiometryErrorType.noDeviceCredential]: 'No device credential available',
};

export interface BiometricAvailability {
  isAvailable: boolean;
  biometryType: BiometryType | 'none';
  biometryTypeName: string;
  strongBiometryIsAvailable: boolean;
  deviceIsSecure: boolean;
  errorMessage?: string;
}

export interface UseBiometricAuthReturn {
  // State
  isAvailable: boolean;
  isEnabled: boolean;
  isChecking: boolean;
  biometryType: BiometryType;
  biometryTypeName: string;
  error: string | null;

  // Actions
  checkBiometricAvailability: () => Promise<BiometricAvailability>;
  authenticate: (reason?: string) => Promise<boolean>;
  authenticateWithPassword: (
    reason?: string,
    onFallbackRequired?: () => void
  ) => Promise<BiometricAuthResult>;
  validatePassword: (password: string) => Promise<PasswordValidationResult>;
  enable: (email: string, passwordHash?: string) => Promise<boolean>;
  disable: () => Promise<void>;
  getSavedEmail: () => string | null;
  isEnabledInStorage: () => boolean;
}

/**
 * Get a human-readable name for the biometry type
 */
function getBiometryTypeName(type: BiometryType): string {
  switch (type) {
    case BiometryType.touchId:
      return 'Touch ID';
    case BiometryType.faceId:
      return 'Face ID';
    case BiometryType.fingerprintAuthentication:
      return 'Fingerprint';
    case BiometryType.faceAuthentication:
      return 'Face Recognition';
    case BiometryType.irisAuthentication:
      return 'Iris';
    case BiometryType.none:
    default:
      return 'Biometric';
  }
}

/**
 * Hook for biometric authentication using @aparajita/capacitor-biometric-auth
 *
 * @example
 * ```tsx
 * const {
 *   isAvailable,
 *   isEnabled,
 *   biometryTypeName,
 *   checkBiometricAvailability,
 *   authenticate,
 *   authenticateWithPassword,
 *   validatePassword,
 *   enable,
 *   disable,
 * } = useBiometricAuth();
 *
 * // Check availability on mount
 * useEffect(() => {
 *   checkBiometricAvailability();
 * }, []);
 *
 * // Enable biometric login with password fallback
 * const handleEnable = async () => {
 *   // Hash the password for secure fallback storage
 *   const passwordHash = await hashPassword(password);
 *   const success = await enable(userEmail, passwordHash);
 *   if (success) {
 *     toast.success('Biometric login enabled');
 *   }
 * };
 *
 * // Authenticate with biometric and fallback handling
 * const handleAuth = async () => {
 *   const result = await authenticateWithPassword('Verify your identity', () => {
 *     // Show password input when fallback is triggered
 *     setShowPasswordInput(true);
 *   });
 *
 *   if (result.success) {
 *     // Proceed with login
 *   } else if (result.fallbackRequired) {
 *     // User needs to enter password - showPasswordInput already set by callback
 *   }
 * };
 *
 * // Validate password for fallback
 * const handlePasswordSubmit = async (password: string) => {
 *   const validation = await validatePassword(password);
 *   if (validation.valid) {
 *     // Password is correct, proceed with login
 *   } else {
 *     // Show error: validation.error
 *   }
 * };
 * ```
 */
export function useBiometricAuth(): UseBiometricAuthReturn {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [biometryType, setBiometryType] = useState<BiometryType>(BiometryType.none);
  const [error, setError] = useState<string | null>(null);

  // Initialize on mount
  useEffect(() => {
    // Load stored biometric state from sessionStorage for security
    // Note: Using sessionStorage prevents XSS theft of biometric settings
    // User will need to re-enable biometric on new sessions (acceptable security trade-off)
    let storedEnabled = false;
    try {
      storedEnabled = sessionStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
    } catch {
      console.warn('[BiometricAuth] sessionStorage unavailable, defaulting to disabled');
    }
    setIsEnabled(storedEnabled);

    // Initial availability check for native platforms
    if (Capacitor.isNativePlatform()) {
      checkBiometricAvailability();
    }
  }, []);

  const checkBiometricAvailability = useCallback(async (): Promise<BiometricAvailability> => {
    // On web or non-native platforms, return not available
    if (!Capacitor.isNativePlatform()) {
      return {
        isAvailable: false,
        biometryType: BiometryType.none,
        biometryTypeName: 'none',
        strongBiometryIsAvailable: false,
        deviceIsSecure: false,
        errorMessage: 'Biometric authentication is only available on mobile devices',
      };
    }

    setIsChecking(true);
    setError(null);

    try {
      const result: CheckBiometryResult = await BiometricAuth.checkBiometry();

      setIsAvailable(result.isAvailable);
      setBiometryType(result.biometryType);

      const typeName = getBiometryTypeName(result.biometryType);

      return {
        isAvailable: result.isAvailable,
        biometryType: result.biometryType,
        biometryTypeName: typeName,
        strongBiometryIsAvailable: result.strongBiometryIsAvailable,
        deviceIsSecure: result.deviceIsSecure,
        errorMessage: result.code ? ERROR_MESSAGES[result.code] || result.reason : undefined,
      };
    } catch (err) {
      let errorMessage = 'Failed to check biometric availability';

      if (err instanceof BiometryError) {
        errorMessage = ERROR_MESSAGES[err.code] || err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setIsAvailable(false);
      setBiometryType(BiometryType.none);

      return {
        isAvailable: false,
        biometryType: BiometryType.none,
        biometryTypeName: 'none',
        strongBiometryIsAvailable: false,
        deviceIsSecure: false,
        errorMessage,
      };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const authenticate = useCallback(async (reason?: string): Promise<boolean> => {
    // Check if biometric is enabled
    if (!isEnabled) {
      console.log('[BiometricAuth] Authentication failed: biometric is not enabled');
      return false;
    }

    // Check if biometric is available on the device
    if (!isAvailable) {
      console.warn('[BiometricAuth] Authentication failed: biometric is not available on this device');
      setError('Biometric authentication is not available on this device');
      return false;
    }

    setIsChecking(true);
    setError(null);

    try {
      await BiometricAuth.authenticate({
        reason: reason || 'Authenticate to access your account',
        allowDeviceCredential: false,
        androidConfirmationRequired: true,
      });

      // Authentication successful
      return true;
    } catch (err) {
      let errorMessage = 'Authentication failed';

      if (err instanceof BiometryError) {
        // Don't show error for user cancellation or app cancel
        if (err.code !== BiometryErrorType.userCancel && err.code !== BiometryErrorType.appCancel) {
          errorMessage = ERROR_MESSAGES[err.code] || err.message;
          setError(errorMessage);
        }
        // Log full error with stack trace for debugging
        // Cast to access properties that may exist on the runtime object
        const bioErr = err as BiometryError & { reason?: string; stack?: string };
        console.error(`[BiometricAuth] BiometryError occurred:`, {
          code: err.code,
          message: err.message,
          reason: bioErr.reason,
          stack: bioErr.stack || new Error().stack,
        });
      } else if (err instanceof Error) {
        errorMessage = err.message;
        setError(errorMessage);
        // Log full error with stack trace for debugging
        console.error(`[BiometricAuth] Unexpected error:`, {
          message: err.message,
          name: err.name,
          stack: err.stack,
        });
      } else {
        // Log unknown error type
        console.error(`[BiometricAuth] Unknown error type:`, {
          error: err,
          stack: new Error().stack,
        });
      }

      return false;
    } finally {
      setIsChecking(false);
    }
  }, [isEnabled, isAvailable]);

  /**
   * Authenticate with automatic fallback handling
   * Returns detailed result including when fallback is required
   */
  const authenticateWithPassword = useCallback(async (
    reason?: string,
    onFallbackRequired?: () => void
  ): Promise<BiometricAuthResult> => {
    // Check if biometric is enabled
    if (!isEnabled) {
      console.log('[BiometricAuth] authenticateWithPassword: biometric is not enabled');
      return { success: false, fallbackRequired: false };
    }

    // Check if biometric is available on the device
    if (!isAvailable) {
      console.warn('[BiometricAuth] authenticateWithPassword: biometric not available, requesting fallback');
      onFallbackRequired?.();
      return { success: false, fallbackRequired: true, reason: 'user_fallback' };
    }

    setIsChecking(true);
    setError(null);

    try {
      await BiometricAuth.authenticate({
        reason: reason || 'Authenticate to access your account',
        allowDeviceCredential: false,
        androidConfirmationRequired: true,
      });

      // Authentication successful
      return { success: true };
    } catch (err) {
      if (err instanceof BiometryError) {
        // Check if user requested fallback
        if (err.code === BiometryErrorType.userFallback) {
          console.log('[BiometricAuth] User requested password fallback');
          onFallbackRequired?.();
          return { success: false, fallbackRequired: true, reason: 'user_fallback' };
        }

        // Don't show error for user cancellation or app cancel
        if (err.code !== BiometryErrorType.userCancel && err.code !== BiometryErrorType.appCancel) {
          const errorMessage = ERROR_MESSAGES[err.code] || err.message;
          setError(errorMessage);
        }

        // Log full error with stack trace for debugging
        console.error(`[BiometricAuth] BiometryError:`, {
          code: err.code,
          message: err.message,
          reason: (err as any).reason,
          stack: (err as any).stack || new Error().stack,
        });
      } else if (err instanceof Error) {
        setError(err.message);
        console.error(`[BiometricAuth] Unexpected error:`, {
          message: err.message,
          name: err.name,
          stack: err.stack,
        });
      } else {
        console.error(`[BiometricAuth] Unknown error:`, {
          error: err,
          stack: new Error().stack,
        });
      }

      return { success: false, fallbackRequired: false };
    } finally {
      setIsChecking(false);
    }
  }, [isEnabled, isAvailable]);

  /**
   * Validate password against stored hash for biometric fallback
   * Uses Web Crypto API for secure comparison
   */
  const validatePassword = useCallback(async (password: string): Promise<PasswordValidationResult> => {
    // Input validation
    if (!password || typeof password !== 'string') {
      return { valid: false, error: 'Password is required' };
    }

    if (password.length < 1) {
      return { valid: false, error: 'Password cannot be empty' };
    }

    try {
      const storedHash = sessionStorage.getItem(BIOMETRIC_PASSWORD_HASH_KEY);

      if (!storedHash) {
        console.warn('[BiometricAuth] No password hash found for validation');
        return { valid: false, error: 'Password not configured for biometric fallback' };
      }

      // Hash the provided password using SHA-256
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Constant-time comparison to prevent timing attacks
      const isValid = timingSafeEqual(hashHex, storedHash);

      if (isValid) {
        console.log('[BiometricAuth] Password validation successful');
        return { valid: true };
      } else {
        console.warn('[BiometricAuth] Password validation failed: invalid credentials');
        return { valid: false, error: 'Invalid password' };
      }
    } catch (err) {
      console.error('[BiometricAuth] Password validation error:', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : new Error().stack,
      });
      return { valid: false, error: 'Password validation failed' };
    }
  }, []);

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  /**
   * Hash a password using SHA-256 for secure storage
   */
  async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const enable = useCallback(async (email: string, passwordHash?: string): Promise<boolean> => {
    // First verify biometric is available
    const availability = await checkBiometricAvailability();
    if (!availability.isAvailable) {
      setError(availability.errorMessage || 'Biometric authentication is not available');
      return false;
    }

    // Verify the user can authenticate
    const authenticated = await authenticate('Authenticate to enable biometric login');
    if (!authenticated) {
      return false;
    }

    // Save enabled state and email to sessionStorage for security
    // Using sessionStorage prevents XSS theft of biometric authentication data
    try {
      sessionStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      sessionStorage.setItem(BIOMETRIC_EMAIL_KEY, email);

      // Store password hash for fallback if provided
      if (passwordHash) {
        sessionStorage.setItem(BIOMETRIC_PASSWORD_HASH_KEY, passwordHash);
        console.log('[BiometricAuth] Password hash stored for fallback authentication');
      }
    } catch (error) {
      console.error('[BiometricAuth] Failed to save biometric settings:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : new Error().stack,
      });
      return false;
    }
    setIsEnabled(true);

    return true;
  }, [checkBiometricAvailability, authenticate]);

  const disable = useCallback(async (): Promise<void> => {
    // Clear sessionStorage (security: prevents XSS theft)
    try {
      sessionStorage.removeItem(BIOMETRIC_ENABLED_KEY);
      sessionStorage.removeItem(BIOMETRIC_EMAIL_KEY);
      sessionStorage.removeItem(BIOMETRIC_PASSWORD_HASH_KEY);
      console.log('[BiometricAuth] All biometric settings cleared');
    } catch (error) {
      console.error('[BiometricAuth] Failed to clear biometric settings:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : new Error().stack,
      });
    }
    setIsEnabled(false);
    setError(null);
  }, []);

  const getSavedEmail = useCallback((): string | null => {
    try {
      return sessionStorage.getItem(BIOMETRIC_EMAIL_KEY);
    } catch (error) {
      console.warn('[BiometricAuth] sessionStorage unavailable:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : new Error().stack,
      });
      return null;
    }
  }, []);

  const isEnabledInStorage = useCallback((): boolean => {
    try {
      return sessionStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
    } catch (error) {
      console.error('[BiometricAuth] Failed to check biometric status:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : new Error().stack,
      });
      return false;
    }
  }, []);

  return {
    isAvailable,
    isEnabled,
    isChecking,
    biometryType,
    biometryTypeName: getBiometryTypeName(biometryType),
    error,
    checkBiometricAvailability,
    authenticate,
    authenticateWithPassword,
    validatePassword,
    enable,
    disable,
    getSavedEmail,
    isEnabledInStorage,
  };
}

// Export types and utilities
export { BiometryType, BiometryError, BiometryErrorType };
export { getBiometryTypeName };

export default useBiometricAuth;
