import { Request, Response, NextFunction } from 'express';
import Tenant from '../models/tenant.model';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      tenant?: typeof Tenant.prototype;
      tenantId?: string;
    }
  }
}

export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let tenantId: string | undefined;

    // 1. Check subdomain
    const host = req.get('host') || '';
    const subdomain = host.split('.')[0];
    if (subdomain && subdomain !== 'www') {
      const tenantBySubdomain = await Tenant.findOne({ subdomain, isActive: true });
      if (tenantBySubdomain) {
        tenantId = tenantBySubdomain._id.toString();
        req.tenant = tenantBySubdomain;
      }
    }

    // 2. Check custom domain
    if (!tenantId) {
      const tenantByDomain = await Tenant.findOne({ domain: host, isActive: true });
      if (tenantByDomain) {
        tenantId = tenantByDomain._id.toString();
        req.tenant = tenantByDomain;
      }
    }

    // 3. Check path header
    if (!tenantId) {
      const tenantSlug = req.headers['x-tenant'] as string;
      if (tenantSlug) {
        const tenantBySlug = await Tenant.findOne({ slug: tenantSlug, isActive: true });
        if (tenantBySlug) {
          tenantId = tenantBySlug._id.toString();
          req.tenant = tenantBySlug;
        }
      }
    }

    // 4. Fallback to default tenant
    if (!tenantId) {
      const defaultTenant = await Tenant.findOne({ slug: 'default', isActive: true });
      if (defaultTenant) {
        tenantId = defaultTenant._id.toString();
        req.tenant = defaultTenant;
      }
    }

    req.tenantId = tenantId;

    // Add tenant context to logs
    logger.child({ tenantId });

    next();
  } catch (error) {
    logger.error('Tenant middleware error', { error });
    next();
  }
};

// Helper to get tenant-scoped query
export const withTenant = (tenantId: string) => ({
  tenantId,
});
