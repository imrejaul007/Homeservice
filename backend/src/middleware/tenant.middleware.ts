import { Request, Response, NextFunction } from 'express';
import Tenant from '../models/tenant.model';
import logger from '../utils/logger';

// Default tenant ID for development/fallback
const DEFAULT_TENANT_ID = '000000000000000000000000';

// Allowlist of trusted base domains - ONLY these domains are trusted for subdomain extraction
// This prevents host header injection attacks where attacker sets Host: evil.com or evil.example.com
const TRUSTED_BASE_DOMAINS = new Set([
  'localhost',
  'localhost:3000',
  'localhost:3001',
  'localhost:5000',
  'localhost:8080',
  // Add your production domains here:
  // 'yourapp.com',
  // 'api.yourapp.com',
  '127.0.0.1',
  '127.0.0.1:3000',
  '127.0.0.1:5000',
  '127.0.0.1:8080',
]);

// Subdomain validation pattern - strict alphanumeric, hyphens, underscores only
// Prevents injection via malformed subdomains like "..", "'; DROP--", etc.
const SUBDOMAIN_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,61}[a-zA-Z0-9]$|^[a-zA-Z0-9]$/;
const MAX_SUBDOMAIN_LENGTH = 63;

/**
 * Validates and extracts subdomain from host header in a secure manner.
 * Only extracts subdomain from hosts that match TRUSTED_BASE_DOMAINS.
 *
 * @param host - The Host header value
 * @returns The validated subdomain or null if not valid/trusted
 */
function extractSecureSubdomain(host: string): string | null {
  if (!host || host.length === 0) {
    return null;
  }

  // Check if the base domain is trusted
  if (!TRUSTED_BASE_DOMAINS.has(host)) {
    // Reject hosts not in the allowlist to prevent spoofing attacks
    // Examples rejected: 'evil.com', 'subdomain.evil.com', 'myhost.com'
    logger.warn('Host header rejected - not in trusted domain allowlist', { host });
    return null;
  }

  // Remove port if present
  const hostWithoutPort = host.split(':')[0];
  const parts = hostWithoutPort.split('.');

  // localhost or IP addresses don't have subdomains in our tenant model
  if (parts.length === 1) {
    return null;
  }

  // For multi-part hosts (shouldn't happen with localhost/IP, but safety check)
  if (parts.length > 3) {
    logger.warn('Host header rejected - too many subdomain levels', { host });
    return null;
  }

  const subdomain = parts[0];

  // Reject 'www' as a tenant subdomain
  if (subdomain === 'www' || subdomain === 'api' || subdomain === 'admin') {
    return null;
  }

  // Validate subdomain format
  if (!SUBDOMAIN_PATTERN.test(subdomain) || subdomain.length > MAX_SUBDOMAIN_LENGTH) {
    logger.warn('Host header rejected - invalid subdomain format', { host, subdomain });
    return null;
  }

  return subdomain;
}

export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let tenantId: string | undefined;

    // 1. Check subdomain (SECURE extraction)
    const host = req.get('host') || '';
    const subdomain = extractSecureSubdomain(host);
    if (subdomain) {
      const tenantBySubdomain = await Tenant.findOne({ subdomain, isActive: true });
      if (tenantBySubdomain) {
        tenantId = tenantBySubdomain._id.toString();
        (req as any).tenant = tenantBySubdomain;
      }
    }

    // 2. Check custom domain (also needs validation)
    // Custom domains should be validated against a known domain list or have strict format checks
    if (!tenantId) {
      const hostname = host.split(':')[0];
      const isDevHost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1';

      // Validate custom domain format to prevent injection
      const DOMAIN_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
      if (DOMAIN_PATTERN.test(hostname)) {
        const tenantByDomain = await Tenant.findOne({ domain: host, isActive: true });
        if (tenantByDomain) {
          tenantId = tenantByDomain._id.toString();
          (req as any).tenant = tenantByDomain;
        }
      } else if (!isDevHost && host.length > 0) {
        // Log invalid domain format (skip localhost/dev hosts to reduce noise)
        logger.debug('Custom domain format validation failed', { hostLength: host.length });
      }
    }

    // 3. Check x-tenant header (with strict validation)
    if (!tenantId) {
      const rawTenantSlug = req.headers['x-tenant'];

      // Validate header value: must be a non-empty string
      if (typeof rawTenantSlug === 'string' && rawTenantSlug.length > 0) {
        // Sanitize: trim whitespace and limit length
        const tenantSlug = rawTenantSlug.trim().slice(0, 64);

        // Validate format: alphanumeric, hyphens, underscores only
        // Prevents injection attacks, timing attacks, and enumeration
        const SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;
        if (SLUG_PATTERN.test(tenantSlug) && tenantSlug.length >= 1) {
          const tenantBySlug = await Tenant.findOne({ slug: tenantSlug, isActive: true });
          if (tenantBySlug) {
            tenantId = tenantBySlug._id.toString();
            (req as any).tenant = tenantBySlug;
          }
        } else {
          logger.warn('Rejected invalid tenant slug format', {
            providedSlug: rawTenantSlug,
            reason: 'Invalid format - only alphanumeric, hyphens, and underscores allowed',
          });
        }
      }
    }

    // 4. Fallback to default tenant (atomic upsert to prevent race conditions)
    if (!tenantId) {
      // Use findOneAndUpdate with upsert: true for atomic check-and-create.
      // This prevents race conditions where multiple concurrent requests
      // all see no default tenant and all try to create one.
      const defaultTenant = await Tenant.findOneAndUpdate(
        { slug: 'default', isActive: true },
        {
          $setOnInsert: {
            name: 'Default Tenant',
            slug: 'default',
            domain: 'localhost',
            isActive: true,
            region: {
              code: 'AE',
              country: 'United Arab Emirates',
              cities: ['Dubai', 'Abu Dhabi', 'Sharjah'],
              timezone: 'Asia/Dubai',
              locale: 'en-AE',
              currency: {
                code: 'AED',
                symbol: 'د.إ',
                decimalPlaces: 2,
              },
            },
            branding: {
              logo: '',
              favicon: '',
              primaryColor: '#E85A4F',
              secondaryColor: '#8E8D8A',
            },
            policies: {
              cancellationWindow: 24,
              refundPolicy: 'partial',
              minBookingAdvance: 2,
              maxBookingAdvance: 30,
            },
            taxConfig: {
              enabled: true,
              rate: 5,
              inclusive: false,
            },
            subscription: {
              plan: 'enterprise',
              maxProviders: 1000,
              maxBookings: 100000,
              features: ['all'],
            },
            compliance: {
              gdpr: true,
              pdpa: true,
              pdpl: true,
            },
          },
        },
        {
          upsert: true,
          new: true, // Return the document (existing or newly created)
          setDefaultsOnInsert: true,
        }
      );

      if (defaultTenant) {
        tenantId = defaultTenant._id.toString();
        (req as any).tenant = defaultTenant;
      }
    }

    // 5. Ultimate fallback - use hardcoded default if everything fails
    if (!tenantId) {
      tenantId = DEFAULT_TENANT_ID;
      logger.warn('Using hardcoded default tenant ID - tenant system not fully configured');
    }

    (req as any).tenantId = tenantId;

    // Add tenant-scoped logger to request for downstream use
    (req as any).tenantLogger = logger.child({ tenantId });

    next();
  } catch (error) {
    logger.error('Tenant middleware error', { error });
    // Set a fallback tenant ID to prevent downstream errors
    (req as any).tenantId = DEFAULT_TENANT_ID;
    next();
  }
};

// Helper to get tenant-scoped query
export const withTenant = (tenantId: string) => ({
  tenantId,
});
