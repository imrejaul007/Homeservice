import { Router, Request, Response } from 'express';
import { authenticateAdminApiKey, requireApiKeyPermission } from '../middleware/apiKeyAuth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/**
 * Integration API — for external systems using admin-created API keys.
 * Authenticate with: Authorization: Bearer admin_<key>  OR  X-API-Key: admin_<key>
 */

router.get(
  '/health',
  authenticateAdminApiKey,
  requireApiKeyPermission('read'),
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'ok',
        keyName: req.adminApiKey?.name,
        permissions: req.adminApiKey?.permissions,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

router.get(
  '/me',
  authenticateAdminApiKey,
  requireApiKeyPermission('read'),
  asyncHandler(async (req: Request, res: Response) => {
    const key = req.adminApiKey!;
    res.json({
      success: true,
      data: {
        id: key._id,
        name: key.name,
        keyPrefix: key.keyPrefix,
        permissions: key.permissions,
        rateLimit: key.rateLimit,
        expiresAt: key.expiresAt,
        lastUsedAt: key.lastUsedAt,
      },
    });
  })
);

export default router;
