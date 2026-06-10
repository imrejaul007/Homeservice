/**
 * Error Tracking Routes - Backend endpoint for frontend error collection
 *
 * Receives error reports from the frontend error tracking system.
 */

import { Router, Request, Response } from 'express';
import logger from '../utils/logger';

const router = Router();

interface ErrorPayload {
  type: 'error' | 'warning' | 'info';
  name: string;
  message: string;
  stack?: string;
  context: {
    timestamp: string;
    userId?: string;
    sessionId?: string;
    conversationId?: string;
    userAgent?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  };
  tags?: Record<string, string>;
  level: 'error' | 'warning' | 'info';
}

interface ErrorBatchPayload {
  errors: ErrorPayload[];
  metrics?: {
    messagesSent: number;
    messagesReceived: number;
    errorsEncountered: number;
    averageResponseTime: number;
    sessionStartTime: string;
  };
}

// In-memory storage for recent errors (in production, use a proper store)
const recentErrors: ErrorPayload[] = [];
const MAX_RECENT_ERRORS = 100;

/**
 * POST /api/errors
 * Receive a single error report from frontend
 */
router.post('/api/errors', async (req: Request, res: Response) => {
  try {
    const payload = req.body as ErrorPayload;

    if (!payload || !payload.message) {
      res.status(400).json({
        success: false,
        error: 'Invalid error payload',
      });
      return;
    }

    // Store error for analysis
    recentErrors.push(payload);
    if (recentErrors.length > MAX_RECENT_ERRORS) {
      recentErrors.shift();
    }

    // Log the error
    const logLevel = payload.level === 'error' ? 'error' : payload.level === 'warning' ? 'warn' : 'info';
    logger[logLevel]('Frontend error reported', {
      source: 'frontend',
      errorName: payload.name,
      errorMessage: payload.message,
      userId: payload.context.userId,
      conversationId: payload.context.conversationId,
      url: payload.context.url,
      correlationId: req.headers['x-correlation-id'],
    });

    res.json({
      success: true,
      received: true,
      errorId: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
  } catch (error) {
    logger.error('Failed to process error report', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to process error',
    });
  }
});

/**
 * POST /api/errors/batch
 * Receive a batch of errors from frontend
 */
router.post('/api/errors/batch', async (req: Request, res: Response) => {
  try {
    const payload = req.body as ErrorBatchPayload;

    if (!payload || !Array.isArray(payload.errors)) {
      res.status(400).json({
        success: false,
        error: 'Invalid batch payload',
      });
      return;
    }

    // Store errors
    payload.errors.forEach(error => {
      recentErrors.push(error);
    });

    // Trim to max size
    while (recentErrors.length > MAX_RECENT_ERRORS) {
      recentErrors.shift();
    }

    // Log batch summary
    const errorCount = payload.errors.filter(e => e.level === 'error').length;
    const warningCount = payload.errors.filter(e => e.level === 'warning').length;
    const infoCount = payload.errors.filter(e => e.level === 'info').length;

    logger.info('Frontend error batch received', {
      source: 'frontend',
      totalErrors: payload.errors.length,
      errors: errorCount,
      warnings: warningCount,
      info: infoCount,
      correlationId: req.headers['x-correlation-id'],
    });

    // Log metrics if provided
    if (payload.metrics) {
      logger.debug('Frontend session metrics', {
        source: 'frontend',
        metrics: payload.metrics,
      });
    }

    res.json({
      success: true,
      received: payload.errors.length,
      batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    });
  } catch (error) {
    logger.error('Failed to process error batch', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({
      success: false,
      error: 'Failed to process batch',
    });
  }
});

/**
 * GET /api/errors/recent
 * Get recent errors (for admin/debugging)
 */
router.get('/api/errors/recent', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const errors = recentErrors.slice(-limit);

  res.json({
    success: true,
    count: errors.length,
    errors: errors.map(e => ({
      timestamp: e.context.timestamp,
      level: e.level,
      name: e.name,
      message: e.message,
      userId: e.context.userId,
      conversationId: e.context.conversationId,
      url: e.context.url,
    })),
  });
});

/**
 * GET /api/errors/stats
 * Get error statistics
 */
router.get('/api/errors/stats', (req: Request, res: Response) => {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const lastHour = recentErrors.filter(e => new Date(e.context.timestamp).getTime() > oneHourAgo);
  const lastDay = recentErrors.filter(e => new Date(e.context.timestamp).getTime() > oneDayAgo);

  const errorTypes: Record<string, number> = {};
  const errorUrls: Record<string, number> = {};

  recentErrors.forEach(e => {
    errorTypes[e.name] = (errorTypes[e.name] || 0) + 1;
    if (e.context.url) {
      const url = new URL(e.context.url, 'http://localhost').pathname;
      errorUrls[url] = (errorUrls[url] || 0) + 1;
    }
  });

  res.json({
    success: true,
    stats: {
      total: recentErrors.length,
      lastHour: {
        total: lastHour.length,
        errors: lastHour.filter(e => e.level === 'error').length,
        warnings: lastHour.filter(e => e.level === 'warning').length,
      },
      lastDay: {
        total: lastDay.length,
        errors: lastDay.filter(e => e.level === 'error').length,
        warnings: lastDay.filter(e => e.level === 'warning').length,
      },
      topErrors: Object.entries(errorTypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      topUrls: Object.entries(errorUrls)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([url, count]) => ({ url, count })),
    },
  });
});

/**
 * DELETE /api/errors
 * Clear recent errors (for testing/admin)
 */
router.delete('/api/errors', (req: Request, res: Response) => {
  const cleared = recentErrors.length;
  recentErrors.length = 0;

  logger.info('Frontend errors cleared', {
    source: 'frontend',
    clearedCount: cleared,
  });

  res.json({
    success: true,
    cleared,
  });
});

export default router;