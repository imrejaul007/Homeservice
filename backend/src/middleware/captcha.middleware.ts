import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { cache } from '../config/redis';

// CAPTCHA configuration interface
interface CaptchaConfig {
  provider: 'hcaptcha' | 'recaptcha';
  siteKey: string;
  secretKey: string;
  enabled: boolean;
  scoreThreshold?: number; // For reCAPTCHA v3
  verifyUrl?: string;
}

// CAPTCHA verification result
interface CaptchaVerificationResult {
  success: boolean;
  score?: number;
  errorCodes?: string[];
}

// Get CAPTCHA configuration from environment
const getCaptchaConfig = (): CaptchaConfig => {
  const provider = (process.env.CAPTCHA_PROVIDER || 'hcaptcha') as 'hcaptcha' | 'recaptcha';
  const siteKey = provider === 'hcaptcha'
    ? process.env.HCAPTCHA_SITE_KEY || ''
    : process.env.RECAPTCHA_SITE_KEY || '';
  const secretKey = provider === 'hcaptcha'
    ? process.env.HCAPTCHA_SECRET_KEY || ''
    : process.env.RECAPTCHA_SECRET_KEY || '';
  const enabled = process.env.CAPTCHA_ENABLED === 'true' && secretKey.length > 0;

  return {
    provider,
    siteKey,
    secretKey,
    enabled,
    scoreThreshold: parseFloat(process.env.CAPTCHA_SCORE_THRESHOLD || '0.5'),
    verifyUrl: provider === 'hcaptcha'
      ? 'https://hcaptcha.com/siteverify'
      : 'https://www.google.com/recaptcha/api/siteverify',
  };
};

// In-memory rate limit tracking for CAPTCHA failures (production would use Redis)
const captchaFailureCache = new Map<string, { count: number; resetTime: number }>();
const CAPTCHA_FAILURE_WINDOW = 15 * 60 * 1000; // 15 minutes
const CAPTCHA_MAX_FAILURES = 5; // Block after 5 failures

/**
 * Check if client IP is rate limited for CAPTCHA verification
 */
const isCaptchaRateLimited = (ip: string): boolean => {
  const now = Date.now();
  const record = captchaFailureCache.get(ip);

  if (!record || record.resetTime < now) {
    captchaFailureCache.set(ip, { count: 1, resetTime: now + CAPTCHA_FAILURE_WINDOW });
    return false;
  }

  if (record.count >= CAPTCHA_MAX_FAILURES) {
    return true;
  }

  record.count++;
  return false;
};

/**
 * Verify CAPTCHA token with hCaptcha or reCAPTCHA
 */
const verifyCaptchaToken = async (
  token: string,
  remoteIp: string | undefined
): Promise<CaptchaVerificationResult> => {
  const config = getCaptchaConfig();

  if (!config.enabled) {
    // CAPTCHA disabled, skip verification
    logger.debug('CAPTCHA verification skipped (disabled)', {
      action: 'CAPTCHA_DISABLED',
    });
    return { success: true };
  }

  try {
    const params = new URLSearchParams();
    params.append('secret', config.secretKey);
    params.append('response', token);
    if (remoteIp) {
      params.append('remoteip', remoteIp);
    }

    const response = await axios.post(config.verifyUrl!, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000, // 10 second timeout
    });

    const data = response.data;

    if (config.provider === 'hcaptcha') {
      return {
        success: data.success === true,
        errorCodes: data['error-codes'],
      };
    } else {
      // reCAPTCHA v2/v3
      return {
        success: data.success === true && (data.score === undefined || data.score >= config.scoreThreshold!),
        score: data.score,
        errorCodes: data['error-codes'],
      };
    }
  } catch (error: any) {
    logger.error('CAPTCHA verification request failed', {
      error: error.message,
      provider: config.provider,
      action: 'CAPTCHA_VERIFY_ERROR',
    });

    // On network error, fail closed (block request) for high-security endpoints
    // But allow for registration to not block legitimate users on API issues
    return {
      success: false,
      errorCodes: ['verification-service-unavailable'],
    };
  }
};

/**
 * CAPTCHA verification middleware
 * Verifies the CAPTCHA token from request body or header
 *
 * Options:
 * - required: If true, CAPTCHA is mandatory. If false, CAPTCHA is optional but still verified if present.
 * - scoreThreshold: Minimum score for reCAPTCHA v3 (default: 0.5)
 * - skipIfDisabled: Skip verification if CAPTCHA is not configured (default: false)
 */
export interface CaptchaOptions {
  required?: boolean;
  skipIfDisabled?: boolean;
}

export const verifyCaptcha = (options: CaptchaOptions = {}) => {
  const { required = true, skipIfDisabled = false } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const config = getCaptchaConfig();
    const clientIp = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

    // Check rate limiting
    if (isCaptchaRateLimited(clientIp)) {
      logger.warn('CAPTCHA rate limit exceeded', {
        ip: clientIp,
        action: 'CAPTCHA_RATE_LIMITED',
      });
      throw new ApiError(429, 'Too many CAPTCHA verification failures. Please try again later.');
    }

    // If CAPTCHA is not enabled and skipIfDisabled is true, skip verification
    if (!config.enabled && skipIfDisabled) {
      return next();
    }

    // Extract CAPTCHA token from request
    const token = req.body?.captchaToken ||
                  req.body?.['g-recaptcha-response'] ||
                  req.headers['x-captcha-token'] as string;

    // If no token provided and CAPTCHA is not required, skip
    if (!token && !required) {
      return next();
    }

    // Token required but not provided
    if (!token) {
      logger.warn('CAPTCHA token missing', {
        ip: clientIp,
        path: req.path,
        action: 'CAPTCHA_MISSING',
      });
      throw new ApiError(400, 'CAPTCHA verification required. Please complete the CAPTCHA.');
    }

    // Verify the token
    const result = await verifyCaptchaToken(token, clientIp);

    if (!result.success) {
      logger.warn('CAPTCHA verification failed', {
        ip: clientIp,
        path: req.path,
        errorCodes: result.errorCodes,
        action: 'CAPTCHA_VERIFY_FAILED',
      });

      // Provide specific error message
      if (result.errorCodes?.includes('invalid-input-response')) {
        throw new ApiError(400, 'Invalid CAPTCHA token. Please try again.');
      }

      if (result.errorCodes?.includes('expired-input-response')) {
        throw new ApiError(400, 'CAPTCHA token has expired. Please refresh and try again.');
      }

      if (result.errorCodes?.includes('verification-service-unavailable')) {
        // Don't block on service issues - fail open for non-critical endpoints
        if (!required) {
          logger.warn('CAPTCHA service unavailable, proceeding without verification', {
            ip: clientIp,
            action: 'CAPTCHA_SERVICE_UNAVAILABLE_OPEN',
          });
          return next();
        }
        throw new ApiError(503, 'CAPTCHA verification service is temporarily unavailable. Please try again.');
      }

      throw new ApiError(400, 'CAPTCHA verification failed. Please try again.');
    }

    // For reCAPTCHA v3, check score if provided
    if (result.score !== undefined && config.provider === 'recaptcha') {
      const config2 = getCaptchaConfig();
      if (result.score < config2.scoreThreshold!) {
        logger.warn('CAPTCHA score too low', {
          ip: clientIp,
          score: result.score,
          threshold: config2.scoreThreshold,
          action: 'CAPTCHA_LOW_SCORE',
        });

        if (required) {
          throw new ApiError(403, 'Request flagged as suspicious. Please try again later.');
        }
      }
    }

    logger.debug('CAPTCHA verification successful', {
      ip: clientIp,
      score: result.score,
      action: 'CAPTCHA_VERIFY_SUCCESS',
    });

    // Attach verification info to request for downstream use
    (req as any).captchaVerified = true;
    (req as any).captchaScore = result.score;

    next();
  };
};

/**
 * Middleware to require CAPTCHA only after rate limit is triggered
 * This is an adaptive approach - CAPTCHA appears after suspicious activity
 */
export const adaptiveCaptcha = (rateLimitKey: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const config = getCaptchaConfig();

    // If CAPTCHA is not enabled, skip
    if (!config.enabled) {
      return next();
    }

    // Check if rate limit was triggered (you'd integrate this with your rate limiter)
    const rateLimitHit = await checkRateLimitTriggered(req, rateLimitKey);

    if (!rateLimitHit) {
      // Rate limit not hit yet, skip CAPTCHA
      return next();
    }

    // Rate limit was hit, require CAPTCHA verification
    return verifyCaptcha({ required: true })(req, res, next);
  };
};

/**
 * Check if a rate limit has been triggered for this request
 * Uses Redis for tracking failed attempts
 */
const checkRateLimitTriggered = async (req: Request, key: string): Promise<boolean> => {
  const clientIp = req.ip || 'unknown';
  const cacheKey = `captcha:ratelimit:${key}:${clientIp}`;

  try {
    const cached = await cache.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return data.triggered === true;
    }
  } catch (error) {
    logger.warn('Failed to check rate limit status for CAPTCHA', {
      error: (error as Error).message,
      action: 'CAPTCHA_RATELIMIT_CHECK_FAILED',
    });
  }

  return false;
};

/**
 * Get CAPTCHA site key for frontend
 * Returns the public site key for rendering the CAPTCHA widget
 */
export const getCaptchaSiteKey = (req: Request, res: Response) => {
  const config = getCaptchaConfig();

  res.json({
    enabled: config.enabled,
    provider: config.enabled ? config.provider : null,
    siteKey: config.siteKey || null,
  });
};

/**
 * Get CAPTCHA configuration (for testing/admin purposes)
 */
export const getCaptchaConfigInfo = () => {
  const config = getCaptchaConfig();

  return {
    enabled: config.enabled,
    provider: config.provider,
    hasSiteKey: config.siteKey.length > 0,
    hasSecretKey: config.secretKey.length > 0,
    scoreThreshold: config.scoreThreshold,
  };
};

export default {
  verifyCaptcha,
  adaptiveCaptcha,
  getCaptchaSiteKey,
  getCaptchaConfigInfo,
};
