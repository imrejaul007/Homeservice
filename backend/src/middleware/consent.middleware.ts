import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ApiError } from '../utils/ApiError';
import consentService from '../services/consent.service';
import type { ConsentType } from '../models/consent.model';
import logger from '../utils/logger';

// Extend Express Request to include consent info
declare global {
  namespace Express {
    interface Request {
      hasConsents?: {
        terms: boolean;
        privacy: boolean;
        marketing: boolean;
        cookies: boolean;
        data_processing: boolean;
      };
      missingConsents?: ConsentType[];
      outdatedConsents?: ConsentType[];
      consentProofs?: Record<string, { valid: boolean; proof?: string }>;
    }
  }
}

/**
 * Middleware to check if user has all required consents
 * Required consents: terms, privacy, data_processing
 */
export const requireConsent = (requiredConsents?: ConsentType[]) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const consentsToCheck = requiredConsents || ['terms', 'privacy', 'data_processing'];
    const userId = req.user._id.toString();

    // Get current consent status
    const consentSummary = await consentService.getConsentSummary(userId);

    // Check each required consent
    const missingConsents: ConsentType[] = [];
    const outdatedConsents: ConsentType[] = [];

    for (const consentType of consentsToCheck) {
      switch (consentType) {
        case 'terms':
          if (!consentSummary.hasAcceptedTerms) missingConsents.push('terms');
          break;
        case 'privacy':
          if (!consentSummary.hasAcceptedPrivacy) missingConsents.push('privacy');
          break;
        case 'data_processing':
          if (!consentSummary.hasAcceptedDataProcessing) missingConsents.push('data_processing');
          break;
        case 'marketing':
          // Marketing consent is optional, no need to require it
          break;
        case 'cookies':
          // Cookie consent is handled separately
          break;
      }
    }

    // Check for outdated consents (granted but version is behind current policy)
    // Single query to check all consent types at once - O(1) instead of O(N)
    const allOutdated = await consentService.hasOutdatedConsents(userId, consentsToCheck);
    outdatedConsents.push(...allOutdated);

    // Attach consent info to request for later use
    req.hasConsents = {
      terms: consentSummary.hasAcceptedTerms,
      privacy: consentSummary.hasAcceptedPrivacy,
      marketing: consentSummary.hasOptedInMarketing,
      cookies: consentSummary.hasAcceptedCookies,
      data_processing: consentSummary.hasAcceptedDataProcessing,
    };
    req.missingConsents = missingConsents;
    req.outdatedConsents = outdatedConsents;

    // If any required consents are missing, block access
    if (missingConsents.length > 0) {
      throw new ApiError(
        403,
        `Required consents not provided: ${missingConsents.join(', ')}. Please accept the required terms and privacy policy.`,
        [],
        'CONSENT_REQUIRED'
      );
    }

    // If consents are outdated, allow access but flag for update
    if (outdatedConsents.length > 0) {
      // Log warning but allow access (user can update later)
      logger.warn('User has outdated consents', {
        context: 'ConsentMiddleware',
        action: 'OUTDATED_CONSENTS',
        userId,
        outdatedConsents,
      });
    }

    next();
  });
};

/**
 * Middleware to check marketing consent before sending marketing communications
 */
export const requireMarketingConsent = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required');
  }

  const userId = req.user._id.toString();
  const hasMarketingConsent = await consentService.hasMarketingConsent(userId);

  if (!hasMarketingConsent) {
    throw new ApiError(
      403,
      'Marketing consent required to send promotional communications',
      [],
      'MARKETING_CONSENT_REQUIRED'
    );
  }

  next();
});

/**
 * Middleware to check cookie consent before setting non-essential cookies
 * This is typically handled at the application level, but can be used for API tracking
 */
export const requireCookieConsent = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    // Allow non-authenticated users through (they might not have given cookie consent yet)
    return next();
  }

  const userId = req.user._id.toString();
  const hasCookieConsent = await consentService.hasCookieConsent(userId);

  if (!hasCookieConsent) {
    // Log but don't block - cookie consent is usually handled client-side
    logger.warn('User accessing protected route without cookie consent', {
      context: 'ConsentMiddleware',
      action: 'NO_COOKIE_CONSENT',
      userId,
    });
  }

  next();
});

/**
 * Optional consent check - attaches consent status without blocking
 */
export const checkConsentStatus = () => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      req.hasConsents = {
        terms: false,
        privacy: false,
        marketing: false,
        cookies: false,
        data_processing: false,
      };
      req.missingConsents = ['terms', 'privacy', 'data_processing'];
      req.outdatedConsents = [];
      return next();
    }

    const userId = req.user._id.toString();
    const consentSummary = await consentService.getConsentSummary(userId);

    req.hasConsents = {
      terms: consentSummary.hasAcceptedTerms,
      privacy: consentSummary.hasAcceptedPrivacy,
      marketing: consentSummary.hasOptedInMarketing,
      cookies: consentSummary.hasAcceptedCookies,
      data_processing: consentSummary.hasAcceptedDataProcessing,
    };

    // Check for missing and outdated consents
    const { missing, outdated } = await consentService.hasAllRequiredConsents(userId);
    req.missingConsents = missing;
    req.outdatedConsents = outdated;

    next();
  });
};

/**
 * Require consent for specific features
 */
export const requireFeatureConsent = (feature: 'marketing' | 'analytics' | 'personalization' | 'third_party_sharing') => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const userId = req.user._id.toString();

    switch (feature) {
      case 'marketing':
        const hasMarketing = await consentService.hasMarketingConsent(userId);
        if (!hasMarketing) {
          throw new ApiError(
            403,
            'Marketing consent required for this feature',
            [],
            'MARKETING_CONSENT_REQUIRED'
          );
        }
        break;

      case 'analytics':
        // Analytics usually requires cookie consent
        const hasCookies = await consentService.hasCookieConsent(userId);
        if (!hasCookies) {
          throw new ApiError(
            403,
            'Analytics consent required for this feature',
            [],
            'ANALYTICS_CONSENT_REQUIRED'
          );
        }
        break;

      case 'personalization':
        // Personalization uses AI data, requires data processing consent
        const hasDataProcessing = await consentService.hasValidConsent(userId, 'data_processing');
        if (!hasDataProcessing) {
          throw new ApiError(
            403,
            'Data processing consent required for personalization',
            [],
            'DATA_PROCESSING_CONSENT_REQUIRED'
          );
        }
        break;

      case 'third_party_sharing':
        // Third party sharing requires explicit consent
        const hasThirdPartyConsent = await consentService.hasValidConsent(userId, 'data_processing');
        if (!hasThirdPartyConsent) {
          throw new ApiError(
            403,
            'Data processing consent required for third-party sharing',
            [],
            'THIRD_PARTY_CONSENT_REQUIRED'
          );
        }
        break;
    }

    next();
  });
};

/**
 * Record consent middleware - automatically records consent when user accepts terms/privacy
 */
export const recordConsentOnAccept = (consentType: ConsentType) => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next();
    }

    // Only record if the request indicates consent is being given
    if (req.body && req.body.granted === true) {
      const userId = req.user._id.toString();
      const providedVersion = req.body.version;

      // Validate version exists and matches current policy version
      if (providedVersion === undefined || providedVersion === null || providedVersion === '') {
        throw new ApiError(
          400,
          `Missing required version for ${consentType} consent. Client must send current policy version.`,
          [],
          'CONSENT_VERSION_MISSING'
        );
      }

      const requiredVersion = consentService.getRequiredVersion(consentType);
      if (providedVersion !== requiredVersion) {
        logger.warn('Consent submitted with outdated version', {
          context: 'ConsentMiddleware',
          action: 'OUTDATED_CONSENT_VERSION',
          userId,
          consentType,
          providedVersion,
          requiredVersion,
        });
        throw new ApiError(
          400,
          `Policy version mismatch for ${consentType}. Expected '${requiredVersion}', got '${providedVersion}'. Please refresh and accept the latest policy.`,
          [],
          'CONSENT_VERSION_MISMATCH'
        );
      }

      await consentService.recordConsent(userId, consentType, true, {
        version: providedVersion,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        purpose: req.body.purpose,
        legalBasis: req.body.legalBasis,
        method: req.body.method,
        metadata: {
          acceptedAt: new Date().toISOString(),
          route: req.originalUrl,
        },
      });

      logger.info('Consent recorded', {
        context: 'ConsentMiddleware',
        action: 'CONSENT_RECORDED',
        userId,
        consentType,
        version: providedVersion,
      });
    }

    next();
  });
};

/**
 * Verify consent proof - used for compliance verification
 */
export const verifyConsentProof = () => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }

    const userId = req.user._id.toString();
    const consentTypes: ConsentType[] = ['terms', 'privacy', 'data_processing'];

    const proofs: Record<string, { valid: boolean; proof?: string }> = {};

    for (const type of consentTypes) {
      const result = await consentService.verifyConsentProof(userId, type);
      proofs[type] = {
        valid: result.valid,
        proof: result.proof,
      };
    }

    // Attach proofs to request for verification
    req.consentProofs = proofs;

    next();
  });
};

/**
 * GDPR data processing agreement middleware for API consumers
 *
 * SECURITY: DPA acceptance is validated server-side via the consent database.
 * Client headers cannot spoof DPA acceptance - only server-side consent records count.
 * This prevents: header spoofing, URL tampering, saved-link bypass attacks.
 */
export const requireDataProcessingAgreement = () => {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    // DPA acceptance MUST be tied to an authenticated user
    if (!req.user) {
      throw new ApiError(401, 'Authentication required for DPA verification');
    }

    const userId = req.user._id.toString();

    // Server-side verification: check the consent database, not client headers
    // The X-DPA-Accepted header is REMOVED from trust - clients cannot self-certify
    const hasValidDpaConsent = await consentService.hasValidConsent(userId, 'data_processing');

    if (!hasValidDpaConsent) {
      logger.warn('DPA acceptance required', {
        context: 'ConsentMiddleware',
        action: 'DPA_REQUIRED',
        userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      throw new ApiError(
        403,
        'Data Processing Agreement must be accepted. Please accept the DPA via the /api/consent endpoint.',
        [],
        'DPA_REQUIRED'
      );
    }

    // Attach DPA verification timestamp for audit trail
    (req as any).dpaVerifiedAt = new Date().toISOString();

    next();
  });
};

export default {
  requireConsent,
  requireMarketingConsent,
  requireCookieConsent,
  checkConsentStatus,
  requireFeatureConsent,
  recordConsentOnAccept,
  verifyConsentProof,
  requireDataProcessingAgreement,
};
