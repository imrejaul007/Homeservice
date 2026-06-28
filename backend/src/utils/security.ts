/**
 * Security Utilities
 * Provides security-related utility functions for path sanitization,
 * regex escaping, and other security helpers
 */
import path from 'path';
import crypto from 'crypto';

/**
 * Sanitize a filename to prevent path traversal attacks
 * Removes or replaces dangerous characters
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return 'unnamed';

  // Remove null bytes and control characters
  let sanitized = filename.replace(/[\x00-\x1F\x7F]/g, '');

  // Remove path traversal sequences
  sanitized = sanitized
    .replace(/\.\./g, '')        // Remove ../
    .replace(/\\\\/g, '')       // Remove \\
    .replace(/\//g, '_')        // Replace / with _
    .replace(/\\/g, '_');        // Replace \ with _

  // Remove any remaining suspicious patterns
  sanitized = sanitized
    .replace(/[<>:"|?*]/g, '')  // Remove Windows-invalid chars
    .replace(/^\.+/, '')         // Remove leading dots
    .replace(/\.+$/, '');       // Remove trailing dots

  // Limit filename length
  const MAX_LENGTH = 255;
  if (sanitized.length > MAX_LENGTH) {
    const ext = path.extname(sanitized);
    const baseName = path.basename(sanitized, ext);
    const truncated = baseName.substring(0, MAX_LENGTH - ext.length - 1);
    sanitized = truncated + ext;
  }

  return sanitized || 'unnamed';
}

/**
 * Validate that a resolved path is within an allowed directory
 * Prevents path traversal attacks
 */
export function validatePathWithinDirectory(
  userPath: string,
  allowedDir: string
): { valid: boolean; resolvedPath: string; error?: string } {
  // Normalize the allowed directory
  const normalizedAllowed = path.normalize(allowedDir);

  // Resolve the user path relative to the allowed directory
  const resolvedPath = path.resolve(normalizedAllowed, userPath);

  // Check if the resolved path starts with the allowed directory
  // This ensures the path cannot escape via ../
  const isWithinDirectory = resolvedPath.startsWith(normalizedAllowed + path.sep) ||
                           resolvedPath === normalizedAllowed;

  if (!isWithinDirectory) {
    return {
      valid: false,
      resolvedPath,
      error: 'Path is outside the allowed directory',
    };
  }

  return { valid: true, resolvedPath };
}

/**
 * Escape special regex characters in a string
 * Prevents regex injection attacks
 */
export function escapeRegex(str: string): string {
  if (!str) return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a string with SHA-256
 */
export function sha256Hash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Validate that a string contains only safe characters for use in queries
 */
export function isAlphanumeric(str: string, allowSpaces: boolean = false): boolean {
  const pattern = allowSpaces ? /^[a-zA-Z0-9\s]+$/ : /^[a-zA-Z0-9]+$/;
  return pattern.test(str);
}

/**
 * Sanitize HTML to prevent XSS
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return str.replace(/[&<>"'/]/g, (char) => htmlEscapes[char] || char);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize MongoDB query operators from user input
 * Prevents NoSQL injection attacks
 */
export function sanitizeMongoQuery(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeMongoQuery(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    // Block dangerous operators that could be used for NoSQL injection
    if (key.startsWith('$') && !isAllowedOperator(key)) {
      continue;
    }
    sanitized[key] = sanitizeMongoQuery(value);
  }
  return sanitized;
}

/**
 * Allowed MongoDB operators in sanitized queries
 */
const ALLOWED_OPERATORS = new Set([
  '$eq', '$ne', '$gt', '$gte', '$lt', '$lte',
  '$in', '$nin', '$and', '$or', '$not', '$nor',
  '$exists', '$type', '$regex', '$where',
]);

function isAllowedOperator(op: string): boolean {
  return ALLOWED_OPERATORS.has(op);
}

export default {
  sanitizeFilename,
  validatePathWithinDirectory,
  escapeRegex,
  generateSecureToken,
  sha256Hash,
  secureCompare,
  isAlphanumeric,
  escapeHtml,
  isValidEmail,
  sanitizeMongoQuery,
};
