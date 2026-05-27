/**
 * Field-Level Encryption Utility
 * 
 * GDPR Compliance: Article 32 - Security of Processing
 * Implements AES-256-GCM encryption for sensitive PII fields
 */

import crypto from 'crypto';
import logger from './logger';

// Environment configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Validate encryption key
 */
function validateEncryptionKey(): Buffer | null {
  if (!ENCRYPTION_KEY) {
    logger.warn('Encryption key not configured. Set ENCRYPTION_KEY environment variable.');
    return null;
  }
  
  // Key must be 32 bytes (256 bits) for AES-256
  const keyBuffer = Buffer.from(ENCRYPTION_KEY, 'hex');
  if (keyBuffer.length !== 32) {
    logger.error('Invalid encryption key length. Must be 32 bytes (64 hex characters).');
    return null;
  }
  
  return keyBuffer;
}

const key = validateEncryptionKey();

/**
 * Encrypt a string value
 */
export function encrypt(plaintext: string): string | null {
  if (!key) {
    logger.error('Cannot encrypt: encryption key not available');
    return null;
  }
  
  try {
    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);
    
    // Create cipher
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    
    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Return IV + AuthTag + Ciphertext
    return iv.toString('hex') + authTag.toString('hex') + encrypted;
  } catch (error) {
    logger.error('Encryption failed', { error });
    return null;
  }
}

/**
 * Decrypt a string value
 */
export function decrypt(ciphertext: string): string | null {
  if (!key) {
    logger.error('Cannot decrypt: encryption key not available');
    return null;
  }
  
  try {
    // Extract components
    const iv = Buffer.from(ciphertext.substring(0, IV_LENGTH * 2), 'hex');
    const authTag = Buffer.from(ciphertext.substring(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2), 'hex');
    const encrypted = ciphertext.substring((IV_LENGTH + AUTH_TAG_LENGTH) * 2);
    
    // Create decipher
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Decryption failed', { error });
    return null;
  }
}

/**
 * Encrypt an object (recursively encrypts string fields)
 */
export function encryptObject<T extends Record<string, any>>(
  obj: T,
  fieldsToEncrypt: string[]
): T {
  if (!key) {
    logger.warn('Cannot encrypt object: encryption key not available');
    return obj;
  }
  
  const encrypted: any = { ...obj };

  for (const field of fieldsToEncrypt) {
    if (field in encrypted && typeof encrypted[field] === 'string') {
      const encryptedValue = encrypt(encrypted[field]);
      if (encryptedValue) {
        encrypted[field] = encryptedValue;
      }
    }
  }

  return encrypted as T;
}

/**
 * Decrypt an object (recursively decrypts encrypted fields)
 */
export function decryptObject<T extends Record<string, any>>(
  obj: T,
  fieldsToDecrypt: string[]
): T {
  if (!key) {
    logger.warn('Cannot decrypt object: encryption key not available');
    return obj;
  }
  
  const decrypted: any = { ...obj };

  for (const field of fieldsToDecrypt) {
    if (field in decrypted && typeof decrypted[field] === 'string') {
      // Check if field appears to be encrypted (starts with hex IV)
      if (decrypted[field].length >= IV_LENGTH * 2 + AUTH_TAG_LENGTH * 2) {
        const decryptedValue = decrypt(decrypted[field]);
        if (decryptedValue) {
          decrypted[field] = decryptedValue;
        }
      }
    }
  }

  return decrypted as T;
}

/**
 * Hash a value (one-way, for comparison)
 */
export function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Mask sensitive data for display
 */
export function maskData(data: string, visibleChars: number = 4): string {
  if (!data || data.length <= visibleChars * 2) {
    return '***';
  }
  
  const start = data.substring(0, visibleChars);
  const end = data.substring(data.length - visibleChars);
  return `${start}***${end}`;
}

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) {
    return '***';
  }
  
  const [local, domain] = email.split('@');
  
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  
  return `${local.substring(0, 2)}***@${domain}`;
}

/**
 * Mask phone number
 */
export function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) {
    return '***';
  }
  
  const visible = phone.substring(phone.length - 4);
  return `***${visible}`;
}

// ============================================
// FIELD ENCRYPTION SCHEMA
// ============================================

/**
 * Define which user fields should be encrypted
 */
export const ENCRYPTED_USER_FIELDS = [
  'phone',
  'dateOfBirth',
  'bio',
];

/**
 * Define which address fields should be encrypted
 */
export const ENCRYPTED_ADDRESS_FIELDS = [
  'street',
  'city',
  'state',
  'zipCode',
];

/**
 * Define fields that should be masked in logs
 */
export const MASKED_FIELDS = [
  'password',
  'resetPasswordToken',
  'verificationToken',
  'refreshToken',
  'twoFactorSecret',
  'recoveryCode',
  'phone',
  'address.street',
];

/**
 * Mask object fields for safe logging
 */
export function maskSensitiveFields<T extends Record<string, any>>(obj: T): T {
  const masked: any = { ...obj };

  for (const field of MASKED_FIELDS) {
    if (field in masked) {
      if (typeof masked[field] === 'string') {
        masked[field] = '***REDACTED***';
      } else if (typeof masked[field] === 'object') {
        masked[field] = '***REDACTED***';
      }
    }

    // Handle nested fields (e.g., 'address.street')
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      if (parent in masked && typeof masked[parent] === 'object') {
        (masked[parent] as any)[child] = '***REDACTED***';
      }
    }
  }

  return masked as T;
}

// ============================================
// DATABASE HOOKS
// ============================================

/**
 * Mongoose pre-save hook for automatic encryption
 */
export function createEncryptionHook(fieldsToEncrypt: string[]) {
  return function encryptFields(this: any, next: () => void) {
    if (!key) {
      return next();
    }

    const doc = this;

    for (const field of fieldsToEncrypt) {
      if (doc.isModified(field) && doc[field]) {
        const encrypted = encrypt(doc[field]);
        if (encrypted) {
          doc[field] = encrypted;
        }
      }
    }

    next();
  };
}

/**
 * Mongoose post-init hook for automatic decryption
 */
export function createDecryptionHook(fieldsToDecrypt: string[]) {
  return function decryptFields(this: any) {
    if (!key) {
      return;
    }

    const doc = this;

    for (const field of fieldsToDecrypt) {
      if (doc[field] && typeof doc[field] === 'string') {
        const decrypted = decrypt(doc[field]);
        if (decrypted) {
          doc[field] = decrypted;
        }
      }
    }
  };
}

/**
 * Transform object for JSON serialization
 */
export function transformForJson<T extends Record<string, any>>(
  doc: T,
  encryptedFields: string[]
): T {
  const result = { ...doc };
  
  // Remove encrypted fields from JSON output
  for (const field of encryptedFields) {
    if (field in result) {
      delete result[field];
    }
  }
  
  return result;
}

/**
 * Check if field is encrypted
 */
export function isEncryptedField(value: any): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  
  // Encrypted fields start with hex IV (32 chars) + auth tag (32 chars)
  if (value.length < 64) {
    return false;
  }
  
  // Check if it looks like hex
  return /^[0-9a-f]+$/i.test(value.substring(0, 64));
}

export default {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  hash,
  generateSecureToken,
  maskData,
  maskEmail,
  maskPhone,
  ENCRYPTED_USER_FIELDS,
  ENCRYPTED_ADDRESS_FIELDS,
  MASKED_FIELDS,
  maskSensitiveFields,
  createEncryptionHook,
  createDecryptionHook,
  transformForJson,
  isEncryptedField,
};
