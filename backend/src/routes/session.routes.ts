/**
 * Session Management Routes
 *
 * Handles user session listing and revocation
 */

import { Router, Request, Response, NextFunction } from 'express';
import { param, query, validationResult } from 'express-validator';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import User from '../models/user.model';

const router = Router();

// Session interface for internal use
interface SessionInfo {
  sessionId: string;
  deviceType: string;
  os: string;
  browser: string;
  ip?: string;
  ipAddress: string;
  location: string;
  createdAt: Date;
  lastActive: Date;
  expiresAt: Date;
  isCurrent: boolean;
}

/**
 * Extract device info from user agent
 */
function parseUserAgent(userAgent: string): { deviceType: string; os: string; browser: string } {
  const ua = userAgent.toLowerCase();

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os') || ua.includes('macintosh')) os = 'macOS';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('linux')) os = 'Linux';

  // Detect device type
  let deviceType = 'desktop';
  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) deviceType = 'mobile';
  else if (ua.includes('tablet') || ua.includes('ipad')) deviceType = 'tablet';

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

  return { deviceType, os, browser };
}

/**
 * GET /api/sessions
 * List all active sessions for current user
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user as any)._id;
      const { page = '1', limit = '20' } = req.query;

      const user = await User.findById(userId).select('sessions');
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      const currentSessionId = (req.headers['x-session-id'] as string) || '';
      const sessions: SessionInfo[] = (user.sessions || []).map((session: any) => {
        const userAgent = session.userAgent || '';
        const { deviceType, os, browser } = parseUserAgent(userAgent);
        const now = new Date();
        const expiresAt = new Date(session.expiresAt || now.getTime() + 7 * 24 * 60 * 60 * 1000);

        return {
          sessionId: session.sessionId,
          deviceType,
          os,
          browser,
          ipAddress: session.ipAddress || 'Unknown',
          location: session.location || 'Unknown',
          createdAt: new Date(session.createdAt || now),
          lastActive: new Date(session.lastActive || now),
          expiresAt,
          isCurrent: session.sessionId === currentSessionId,
        };
      }).filter((s: SessionInfo) => s.expiresAt > new Date()); // Only active sessions

      // Sort: current session first, then by lastActive
      sessions.sort((a, b) => {
        if (a.isCurrent) return -1;
        if (b.isCurrent) return 1;
        return b.lastActive.getTime() - a.lastActive.getTime();
      });

      // Pagination
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const total = sessions.length;
      const startIndex = (pageNum - 1) * limitNum;
      const paginatedSessions = sessions.slice(startIndex, startIndex + limitNum);

      res.status(200).json({
        success: true,
        data: {
          sessions: paginatedSessions,
          currentSessionId,
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
 * GET /api/sessions/:id
 * Get session details
 */
router.get(
  '/:id',
  authenticate,
  param('id').isString().notEmpty().withMessage('Valid session ID required'),
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

      const { id } = req.params;
      const userId = (req.user as any)._id;
      const currentSessionId = (req.headers['x-session-id'] as string) || '';

      const user = await User.findById(userId).select('sessions');
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      const session = (user.sessions || []).find((s: any) => s.sessionId === id);
      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found',
        });
        return;
      }

      const userAgent = session.userAgent || '';
      const { deviceType, os, browser } = parseUserAgent(userAgent);
      const now = new Date();

      res.status(200).json({
        success: true,
        data: {
          sessionId: session.sessionId,
          userId: userId.toString(),
          device: {
            type: deviceType,
            os,
            browser,
          },
          ipAddress: (session as any).ipAddress || (session as any).ip || 'Unknown',
          location: session.location || 'Unknown',
          createdAt: new Date(session.createdAt || now).toISOString(),
          lastActive: new Date(session.lastActive || now).toISOString(),
          expiresAt: new Date(session.expiresAt || now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          isCurrent: session.sessionId === currentSessionId,
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * DELETE /api/sessions/:id
 * Revoke a specific session
 */
router.delete(
  '/:id',
  authenticate,
  param('id').isString().notEmpty().withMessage('Valid session ID required'),
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

      const { id } = req.params;
      const userId = (req.user as any)._id;
      const currentSessionId = (req.headers['x-session-id'] as string) || '';

      // Prevent revoking current session via this endpoint
      if (id === currentSessionId) {
        res.status(400).json({
          success: false,
          message: 'Cannot revoke current session. Use logout instead.',
        });
        return;
      }

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Remove the session
      const sessions = user.sessions || [];
      const sessionIndex = sessions.findIndex((s: any) => s.sessionId === id);

      if (sessionIndex === -1) {
        res.status(404).json({
          success: false,
          message: 'Session not found',
        });
        return;
      }

      sessions.splice(sessionIndex, 1);
      user.sessions = sessions;
      await user.save({ validateBeforeSave: false });

      res.status(200).json({
        success: true,
        message: 'Session revoked successfully',
        data: {
          sessionId: id,
          revokedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * DELETE /api/sessions
 * Revoke all sessions except current
 */
router.delete(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user as any)._id;
      const currentSessionId = (req.headers['x-session-id'] as string) || '';
      const { excludeCurrent = 'true' } = req.query;

      const excludeCurrentBool = excludeCurrent === 'true' || excludeCurrent === '1';

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      const sessions = user.sessions || [];
      const sessionsToRevoke = sessions.filter((s: any) =>
        excludeCurrentBool ? s.sessionId !== currentSessionId : true
      );

      const revokedCount = sessionsToRevoke.length;

      if (excludeCurrentBool) {
        // Keep only current session
        user.sessions = sessions.filter((s: any) => s.sessionId === currentSessionId);
      } else {
        // Revoke all sessions
        user.sessions = [];
      }

      await user.save({ validateBeforeSave: false });

      res.status(200).json({
        success: true,
        message: 'Sessions revoked successfully',
        data: {
          revokedCount,
          currentSessionPreserved: excludeCurrentBool,
          revokedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

/**
 * POST /api/sessions/refresh
 * Refresh session expiration
 */
router.post(
  '/refresh',
  authenticate,
  asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req.user as any)._id;
      const sessionId = (req.headers['x-session-id'] as string) || '';
      const now = new Date();
      const newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const user = await User.findById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      const sessions = user.sessions || [];
      const sessionIndex = sessions.findIndex((s: any) => s.sessionId === sessionId);

      if (sessionIndex === -1) {
        res.status(404).json({
          success: false,
          message: 'Session not found',
        });
        return;
      }

      // Update session expiration
      sessions[sessionIndex].lastActive = now;
      sessions[sessionIndex].expiresAt = newExpiresAt;
      user.sessions = sessions;
      await user.save({ validateBeforeSave: false });

      res.status(200).json({
        success: true,
        message: 'Session refreshed successfully',
        data: {
          sessionId,
          expiresAt: newExpiresAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  })
);

export default router;
