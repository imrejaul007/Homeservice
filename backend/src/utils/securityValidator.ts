/**
 * Security Configuration Validator
 * Ensures all security configurations are properly set for production
 */

interface SecurityValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validates all security configurations
 */
export function validateSecurityConfig(): SecurityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // JWT Configuration Validation
  if (!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET.length < 32) {
    errors.push('JWT_ACCESS_SECRET must be at least 32 characters long');
  }

  if (!process.env.JWT_REFRESH_SECRET || process.env.JWT_REFRESH_SECRET.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters long');
  }

  if (process.env.JWT_ACCESS_SECRET === process.env.JWT_REFRESH_SECRET) {
    errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }

  // Environment-specific validations
  if (process.env.NODE_ENV === 'production') {
    // Production-specific validations
    if (process.env.JWT_ACCESS_SECRET?.includes('change-this-in-production')) {
      errors.push('Default JWT secrets detected in production environment');
    }

    if (!process.env.MONGODB_URI?.startsWith('mongodb+srv://')) {
      warnings.push('Consider using MongoDB Atlas for production');
    }

    if (!process.env.CLIENT_URL?.startsWith('https://')) {
      warnings.push('CLIENT_URL should use HTTPS in production');
    }

    // Check for required production secrets
    const requiredProductionSecrets = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'CSRF_SECRET',
      'SESSION_SECRET'
    ];

    requiredProductionSecrets.forEach(secret => {
      if (!process.env[secret]) {
        errors.push(`${secret} is required in production`);
      }
    });
  }

  // Token expiration validation
  const accessExpire = process.env.JWT_ACCESS_EXPIRE || '15m';
  const refreshExpire = process.env.JWT_REFRESH_EXPIRE || '30d';

  if (!accessExpire.includes('m') && !accessExpire.includes('h')) {
    warnings.push('JWT_ACCESS_EXPIRE should be in minutes or hours (e.g., 15m, 1h)');
  }

  if (!refreshExpire.includes('d') && !refreshExpire.includes('h')) {
    warnings.push('JWT_REFRESH_EXPIRE should be in days or hours (e.g., 30d, 720h)');
  }

  // BCRYPT validation
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
  if (saltRounds < 10) {
    warnings.push('BCRYPT_SALT_ROUNDS should be at least 10 for security');
  }
  if (saltRounds > 15) {
    warnings.push('BCRYPT_SALT_ROUNDS above 15 may impact performance');
  }

  // Rate limiting validation
  const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
  if (rateLimitMax > 1000) {
    warnings.push('RATE_LIMIT_MAX_REQUESTS is quite high, consider lowering for security');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates JWT token structure and expiration
 */
export function validateJWTConfiguration(): boolean {
  try {
    const jwt = require('jsonwebtoken');

    // Test token generation with both secrets
    const testPayload = { test: true, iat: Math.floor(Date.now() / 1000) };

    const accessToken = jwt.sign(testPayload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRE || '15m'
    });

    const refreshToken = jwt.sign(testPayload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d'
    });

    // Verify tokens can be decoded
    jwt.verify(accessToken, process.env.JWT_ACCESS_SECRET);
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    return true;
  } catch (error) {
    console.error('JWT Configuration validation failed:', error);
    return false;
  }
}

/**
 * Validates database connection security
 */
export function validateDatabaseSecurity(): SecurityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is required');
    return { isValid: false, errors, warnings };
  }

  const uri = process.env.MONGODB_URI;

  // Check for authentication in connection string
  if (!uri.includes('@') && process.env.NODE_ENV === 'production') {
    warnings.push('Database connection should include authentication in production');
  }

  // Check for SSL/TLS
  if (process.env.NODE_ENV === 'production' && !uri.includes('ssl=true')) {
    warnings.push('Consider enabling SSL for database connection in production');
  }

  // Check for IP whitelisting reminder
  if (uri.includes('mongodb+srv://') && process.env.NODE_ENV === 'production') {
    warnings.push('Ensure MongoDB Atlas IP whitelist is properly configured');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates CORS configuration
 */
export function validateCORSConfiguration(): SecurityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!process.env.CLIENT_URL) {
    errors.push('CLIENT_URL is required for CORS configuration');
  }

  if (!process.env.ALLOWED_ORIGINS) {
    warnings.push('ALLOWED_ORIGINS should be specified for security');
  }

  // In production, ensure no wildcard origins
  if (process.env.NODE_ENV === 'production') {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

    if (allowedOrigins.includes('*')) {
      errors.push('Wildcard (*) CORS origins are not allowed in production');
    }

    // Check for HTTP origins in production
    allowedOrigins.forEach(origin => {
      if (origin.trim().startsWith('http://') && !origin.includes('localhost')) {
        warnings.push(`HTTP origin detected in production: ${origin.trim()}`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Comprehensive security validation
 */
export function performSecurityAudit(): void {
  console.log('🔒 Performing Security Configuration Audit...\n');

  const configValidation = validateSecurityConfig();
  const jwtValidation = validateJWTConfiguration();
  const dbValidation = validateDatabaseSecurity();
  const corsValidation = validateCORSConfiguration();

  // Report results
  let hasErrors = false;

  if (!configValidation.isValid) {
    hasErrors = true;
    console.log('❌ Security Configuration Errors:');
    configValidation.errors.forEach(error => console.log(`   • ${error}`));
    console.log('');
  }

  if (!jwtValidation) {
    hasErrors = true;
    console.log('❌ JWT Configuration Error: Unable to generate/verify tokens\n');
  }

  if (!dbValidation.isValid) {
    hasErrors = true;
    console.log('❌ Database Security Errors:');
    dbValidation.errors.forEach(error => console.log(`   • ${error}`));
    console.log('');
  }

  if (!corsValidation.isValid) {
    hasErrors = true;
    console.log('❌ CORS Configuration Errors:');
    corsValidation.errors.forEach(error => console.log(`   • ${error}`));
    console.log('');
  }

  // Show warnings
  const allWarnings = [
    ...configValidation.warnings,
    ...dbValidation.warnings,
    ...corsValidation.warnings
  ];

  if (allWarnings.length > 0) {
    console.log('⚠️  Security Warnings:');
    allWarnings.forEach(warning => console.log(`   • ${warning}`));
    console.log('');
  }

  // Final result
  if (hasErrors) {
    console.log('🚨 Security Audit Failed - Please fix the errors above before proceeding\n');
    if (process.env.NODE_ENV === 'production') {
      process.exit(1); // Exit in production if security issues found
    }
  } else {
    console.log('✅ Security Audit Passed - All critical security configurations are valid\n');
  }
}

export default {
  validateSecurityConfig,
  validateJWTConfiguration,
  validateDatabaseSecurity,
  validateCORSConfiguration,
  performSecurityAudit
};