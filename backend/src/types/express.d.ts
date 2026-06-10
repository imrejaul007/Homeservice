import type { IUser } from '../models/user.model';
import type { Logger } from 'winston';

/**
 * Augments the Express Request interface with application-specific properties.
 * These are attached by middleware after authentication and tenant resolution.
 */
declare global {
  namespace Express {
    interface Request {
      /** Authenticated user, populated by the authenticate middleware */
      user?: IUser;
      /** Tenant object, populated by tenant middleware */
      tenant?: any;
      /** Resolved tenant ID, populated by the tenant middleware (always set, even to default) */
      tenantId?: string;
      /** Tenant-scoped logger for downstream use */
      tenantLogger?: Logger;
    }
  }
}

export {};
