import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';
import crypto from 'crypto';
import logger from '../../utils/logger';

// Configuration for TOTP
const TOTP_CONFIG = {
  // Time step in seconds (standard is 30)
  step: parseInt(process.env.TOTP_STEP || '30'),

  // Window of time variance allowed (standard is 1)
  // Allows for 1 step before and 1 step after
  window: parseInt(process.env.TOTP_WINDOW || '1'),

  // Algorithm (sha1 is standard, but sha256 and sha512 are also supported)
  algorithm: (process.env.TOTP_ALGORITHM || 'sha1') as 'sha1' | 'sha256' | 'sha512',

  // Digits (standard is 6, also supports 8)
  digits: parseInt(process.env.TOTP_DIGITS || '6') as 6 | 8,

  // Issuer name (appears in authenticator app)
  issuer: process.env.TOTP_ISSUER || 'NILIN Home Services',

  // Bcrypt rounds for hashing recovery codes
  bcryptRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12'),

  // Number of recovery codes to generate
  recoveryCodeCount: parseInt(process.env.TWO_FA_RECOVERY_CODE_COUNT || '10'),

  // Recovery code length (in bytes, becomes hex string)
  recoveryCodeLength: parseInt(process.env.TWO_FA_RECOVERY_CODE_LENGTH || '8'),
};

// Encryption configuration for storing secrets
const ENCRYPTION_CONFIG = {
  algorithm: 'aes-256-gcm',
  keyLength: 32,
  ivLength: 16,
  authTagLength: 16,
};

/**
 * Generate TOTP secret for a user
 * Creates a new secret that can be used with authenticator apps
 */
export async function generateSecret(userId: string): Promise<{
  secret: string;
  otpauthUrl: string;
  qrCodeUrl: string;
}> {
  // Validate userId
  if (!userId || typeof userId !== 'string') {
    throw new Error('Valid userId is required for 2FA secret generation');
  }

  // Generate a new secret
  const secret = speakeasy.generateSecret({
    name: `${TOTP_CONFIG.issuer}:${userId}`,
    length: 20, // 160-bit key
    otpauth_url: true,
  });

  // Generate the otpauth URL for QR code
  const otpauthUrl = secret.otpauth_url || '';

  // Generate QR code as data URL using qrcode library
  const qrCodeUrl = await QRCode.toDataURL(otpauthUrl);

  logger.info('2FA secret generated for user', { userId });

  return {
    secret: secret.base32 || '',
    otpauthUrl,
    qrCodeUrl,
  };
}

/**
 * Verify a TOTP token against a secret
 * Uses window to allow for clock drift between server and client
 */
export function verifyToken(secret: string, token: string): boolean {
  // Validate inputs
  if (!secret || typeof secret !== 'string') {
    logger.warn('2FA verification failed: Invalid secret');
    return false;
  }

  if (!token || typeof token !== 'string') {
    logger.warn('2FA verification failed: Invalid token');
    return false;
  }

  // Clean and validate token (should be numeric string)
  const cleanToken = token.replace(/\s/g, '');

  if (!/^\d+$/.test(cleanToken)) {
    logger.warn('2FA verification failed: Token must be numeric');
    return false;
  }

  try {
    // Verify the token using speakeasy
    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: cleanToken,
      step: TOTP_CONFIG.step,
      window: TOTP_CONFIG.window,
    });

    if (verified) {
      logger.debug('2FA token verified successfully');
    } else {
      logger.warn('2FA verification failed: Token mismatch');
    }

    return verified;
  } catch (error) {
    logger.error('2FA verification error', { error: (error as Error).message });
    return false;
  }
}

/**
 * Generate recovery codes for 2FA backup access
 * Returns raw codes that should be shown to user ONCE
 */
export function generateRecoveryCodes(count?: number): string[] {
  const codeCount = count || TOTP_CONFIG.recoveryCodeCount;
  const codes: string[] = [];

  for (let i = 0; i < codeCount; i++) {
    // Generate random bytes and convert to uppercase alphanumeric string
    const randomBytes = crypto.randomBytes(TOTP_CONFIG.recoveryCodeLength);
    const code = randomBytes
      .toString('hex')
      .toUpperCase()
      .match(/.{1,4}/g)
      ?.join('-') || '';

    codes.push(code);
  }

  logger.info('Recovery codes generated', { count: codes.length });

  return codes;
}

/**
 * Hash recovery codes for secure storage
 * Uses bcrypt with configured rounds
 */
export async function hashRecoveryCodes(codes: string[]): Promise<string[]> {
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    throw new Error('Valid codes array is required for hashing');
  }

  const hashedCodes: string[] = [];

  for (const code of codes) {
    // Normalize the code (uppercase, no spaces)
    const normalizedCode = code.toUpperCase().replace(/\s/g, '').replace(/-/g, '');
    const hash = await bcrypt.hash(normalizedCode, TOTP_CONFIG.bcryptRounds);
    hashedCodes.push(hash);
  }

  logger.debug('Recovery codes hashed', { count: codes.length });

  return hashedCodes;
}

/**
 * Verify a recovery code against hashed codes
 * Iterates through all hashed codes until a match is found
 */
export async function verifyRecoveryCode(
  hashedCodes: string[],
  token: string
): Promise<boolean> {
  if (!hashedCodes || !Array.isArray(hashedCodes) || hashedCodes.length === 0) {
    logger.warn('Recovery code verification failed: No hashed codes provided');
    return false;
  }

  if (!token || typeof token !== 'string') {
    logger.warn('Recovery code verification failed: Invalid token');
    return false;
  }

  // Normalize the token
  const normalizedToken = token.toUpperCase().replace(/\s/g, '').replace(/-/g, '');

  // Try to match against each hashed code
  // Using bcrypt.compare which is timing-safe
  for (let i = 0; i < hashedCodes.length; i++) {
    try {
      const isMatch = await bcrypt.compare(normalizedToken, hashedCodes[i]);
      if (isMatch) {
        logger.info('Recovery code verified successfully', { codeIndex: i });
        return true;
      }
    } catch (error) {
      // Continue checking other codes if one fails to compare
      logger.warn('Error comparing recovery code', { index: i, error: (error as Error).message });
    }
  }

  logger.warn('Recovery code verification failed: No match found');
  return false;
}

/**
 * Encrypt a 2FA secret for secure storage
 * Uses AES-256-GCM for authenticated encryption
 */
export function encryptSecret(secret: string): string {
  if (!secret) {
    throw new Error('Secret is required for encryption');
  }

  // Get encryption key from environment
  const encryptionKey = process.env.TWO_FA_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('TWO_FA_ENCRYPTION_KEY environment variable is not set');
  }

  // Derive a proper key from the environment variable
  const key = crypto.pbkdf2Sync(
    encryptionKey,
    '2fa-salt',
    100000,
    ENCRYPTION_CONFIG.keyLength,
    'sha256'
  );

  // Generate random IV
  const iv = crypto.randomBytes(ENCRYPTION_CONFIG.ivLength);

  // Create cipher with GCM mode for auth tag
  const cipher = crypto.createCipheriv(
    ENCRYPTION_CONFIG.algorithm as crypto.CipherGCMTypes,
    key,
    iv
  ) as crypto.CipherGCM;

  // Encrypt the secret
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  // Get auth tag for verification
  const authTag = cipher.getAuthTag();

  // Combine IV, encrypted data, and auth tag
  const combined = Buffer.concat([
    iv,
    Buffer.from(encrypted, 'hex'),
    authTag,
  ]);

  return combined.toString('base64');
}

/**
 * Decrypt a 2FA secret from storage
 */
export function decryptSecret(encryptedSecret: string): string {
  if (!encryptedSecret) {
    throw new Error('Encrypted secret is required for decryption');
  }

  // Get encryption key from environment
  const encryptionKey = process.env.TWO_FA_ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error('TWO_FA_ENCRYPTION_KEY environment variable is not set');
  }

  // Derive the same key
  const key = crypto.pbkdf2Sync(
    encryptionKey,
    '2fa-salt',
    100000,
    ENCRYPTION_CONFIG.keyLength,
    'sha256'
  );

  // Decode from base64
  const combined = Buffer.from(encryptedSecret, 'base64');

  // Extract IV, encrypted data, and auth tag
  const iv = combined.subarray(0, ENCRYPTION_CONFIG.ivLength);
  const authTag = combined.subarray(combined.length - ENCRYPTION_CONFIG.authTagLength);
  const encrypted = combined.subarray(
    ENCRYPTION_CONFIG.ivLength,
    combined.length - ENCRYPTION_CONFIG.authTagLength
  );

  // Create decipher with GCM mode for auth tag
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_CONFIG.algorithm as crypto.CipherGCMTypes,
    key,
    iv
  ) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);

  // Decrypt the secret
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate QR code as data URL for authenticator app setup
 */
export async function generateQRCode(otpauthUrl: string): Promise<string> {
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });

    return qrCodeDataUrl;
  } catch (error) {
    logger.error('Failed to generate QR code', { error: (error as Error).message });
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Check if 2FA is properly configured for a user
 */
export function is2FAConfigured(twoFactor: {
  enabled?: boolean;
  secret?: string;
}): boolean {
  return !!(twoFactor?.enabled && twoFactor?.secret);
}

/**
 * Validate recovery code format
 */
export function isValidRecoveryCodeFormat(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  // Remove dashes and spaces, convert to uppercase
  const normalized = code.toUpperCase().replace(/[\s-]/g, '');

  // Recovery codes should be 16 characters (8 bytes in hex)
  // Format: XXXX-XXXX-XXXX-XXXX
  if (normalized.length !== 16) {
    return false;
  }

  // Should be alphanumeric only
  if (!/^[A-Z0-9]+$/.test(normalized)) {
    return false;
  }

  return true;
}

/**
 * Validate TOTP token format
 */
export function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Remove spaces
  const cleanToken = token.replace(/\s/g, '');

  // Should be numeric only
  if (!/^\d+$/.test(cleanToken)) {
    return false;
  }

  // Should be 6 or 8 digits
  if (cleanToken.length !== 6 && cleanToken.length !== 8) {
    return false;
  }

  return true;
}

/**
 * Get 2FA configuration summary
 */
export function get2FAConfig(): Record<string, any> {
  return {
    issuer: TOTP_CONFIG.issuer,
    step: TOTP_CONFIG.step,
    window: TOTP_CONFIG.window,
    algorithm: TOTP_CONFIG.algorithm,
    digits: TOTP_CONFIG.digits,
    recoveryCodeCount: TOTP_CONFIG.recoveryCodeCount,
    recoveryCodeLength: TOTP_CONFIG.recoveryCodeLength,
  };
}

export default {
  generateSecret,
  verifyToken,
  generateRecoveryCodes,
  hashRecoveryCodes,
  verifyRecoveryCode,
  encryptSecret,
  decryptSecret,
  generateQRCode,
  is2FAConfigured,
  isValidRecoveryCodeFormat,
  isValidTokenFormat,
  get2FAConfig,
};
