/**
 * Device Fingerprinting Routes
 *
 * Handles device fingerprinting for fraud detection and security
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, query, validationResult } from 'express-validator';
import { asyncHandler } from '../utils/asyncHandler';
import { authenticate } from '../middleware/auth.middleware';
import { deviceFingerprintService } from '../services/deviceFingerprint.service';
import crypto from 'crypto';

const router = Router();

// Validation for fingerprint submission
const submitFingerprintValidation = [
  body('visitorId').isString().notEmpty().withMessage('Visitor ID is required'),
  body('fingerprints').isObject().withMessage('Fingerprints object is required'),
  body('fingerprints.canvas').optional().isString(),
  body('fingerprints.webgl').optional().isString(),
  body('fingerprints.audio').optional().isString(),
  body('fingerprints.font').optional().isArray(),
  body('fingerprints.screen').optional().isObject(),
  body('fingerprints.browser').optional().isObject(),
  body('fingerprints.timezone').optional().isString(),
  body('fingerprints.language').optional().isString(),
  body('fingerprints.platform').optional().isString(),
  body('ipAddress').optional().isString(),
  body('userAgent').optional().isString(),
];

/**
 * Generate fingerprint hash from data
 */
function generateFingerprintHash(data: any): string {
  const fingerprintData = JSON.stringify({
    visitorId: data.visitorId,
    fingerprints: data.fingerprints,
    timestamp: Date.now(),
  });
  return crypto.createHash('sha256').update(fingerprintData).digest('hex').substring(0, 32);
}

/**
 * POST /api/fingerprint
 * Submit device fingerprint
 */
router.post(
  '/',
  submitFingerprintValidation,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const {
        visitorId,
        fingerprints,
        ipAddress,
        userAgent,
      } = req.body;

      const user = req.user as any;
      const userId = user?._id;

      // Generate fingerprint hash
      const fingerprintHash = generateFingerprintHash({ visitorId, fingerprints });

      // If user is authenticated, store the fingerprint
      if (userId) {
        // Analyze the fingerprint for fraud indicators
        const analysis = await deviceFingerprintService.analyzeFingerprint(
          userId.toString(),
          fingerprintHash,
          ipAddress || req.ip || 'unknown',
          userAgent || req.headers['user-agent'] || 'unknown'
        );

        // Store the device if it's not already stored
        await deviceFingerprintService.storeDevice(userId.toString(), {
          fingerprint: fingerprintHash,
          userAgent: userAgent || req.headers['user-agent'] || 'unknown',
          ip: ipAddress || req.ip || 'unknown',
          isSuspicious: analysis.isSuspicious,
          suspiciousReasons: analysis.suspiciousReasons,
        });

        res.status(200).json({
          success: true,
          message: 'Fingerprint submitted successfully',
          data: {
            visitorId,
            fingerprintHash,
            isSuspicious: analysis.isSuspicious,
            riskScore: analysis.riskScore,
            shouldBlock: analysis.shouldBlock,
            submittedAt: new Date().toISOString(),
          },
        });
      } else {
        // Anonymous submission - just store for verification later
        res.status(200).json({
          success: true,
          message: 'Fingerprint submitted successfully',
          data: {
            visitorId,
            fingerprintHash,
            userId: null,
            submittedAt: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/fingerprint/verify
 * Verify device fingerprint
 */
router.get(
  '/verify',
  [
    query('visitorId').optional().isString().withMessage('Valid visitor ID required'),
    query('deviceId').optional().isString().withMessage('Valid device ID required'),
  ],
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
        return;
      }

      const { visitorId, deviceId } = req.query;
      const userId = (req.user as any)._id.toString();

      if (!visitorId && !deviceId) {
        res.status(400).json({
          success: false,
          message: 'Either visitorId or deviceId is required',
        });
        return;
      }

      // Get user's devices
      const devices = await deviceFingerprintService.getUserDevices(userId);

      // Find matching device
      const matchingDevice = devices.find((d: any) =>
        (visitorId && d.fingerprint?.includes(visitorId as string)) ||
        (deviceId && d.fingerprint === deviceId)
      );

      // Check if device is trusted
      const isTrusted = matchingDevice
        ? await deviceFingerprintService.isDeviceTrusted(userId, matchingDevice.fingerprint)
        : false;

      res.status(200).json({
        success: true,
        data: {
          verified: !!matchingDevice,
          visitorId,
          deviceId,
          isTrusted,
          matched: !!matchingDevice,
          lastSeen: matchingDevice?.lastSeen || null,
          confidence: matchingDevice ? 1.0 : 0,
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * GET /api/fingerprint/history
 * Get fingerprint history for a user
 */
router.get(
  '/history',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user as any)._id.toString();
      const { page = '1', limit = '20' } = req.query;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);

      // Get device history
      const history = await deviceFingerprintService.getDeviceHistory(userId, 100);

      // Paginate
      const total = history.length;
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedHistory = history.slice(startIndex, startIndex + limitNum);

      res.status(200).json({
        success: true,
        data: {
          history: paginatedHistory.map((h: any) => ({
            fingerprint: h.fingerprint,
            ip: h.ip,
            location: h.location,
            userAgent: h.userAgent,
            action: h.action,
            timestamp: h.timestamp,
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            pages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * DELETE /api/fingerprint/:fingerprint
 * Remove a device fingerprint
 */
router.delete(
  '/:fingerprint',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fingerprint } = req.params;
      const userId = (req.user as any)._id.toString();

      await deviceFingerprintService.removeDevice(userId, fingerprint);

      res.status(200).json({
        success: true,
        message: 'Device removed successfully',
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * POST /api/fingerprint/:fingerprint/trust
 * Mark a device as trusted
 */
router.post(
  '/:fingerprint/trust',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fingerprint } = req.params;
      const { trust = true } = req.body;
      const userId = (req.user as any)._id.toString();

      await deviceFingerprintService.trustDevice(userId, fingerprint, trust);

      res.status(200).json({
        success: true,
        message: trust ? 'Device marked as trusted' : 'Device unmarked as trusted',
      });
    } catch (error) {
      next(error);
    }
  })
);

export default router;
