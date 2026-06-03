/**
 * Automation Admin Routes
 *
 * Handles automation status monitoring and management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { authenticate, requireRole } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { adminLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply rate limiting to all automation admin routes
router.use(adminLimiter);

// Mock job data for status dashboard
interface JobStatus {
  id: string;
  name: string;
  description: string;
  category: string;
  schedule: string;
  lastRun?: string;
  nextRun?: string;
  status: 'active' | 'paused' | 'error' | 'disabled';
  successRate: number;
  avgExecutionTime: number;
  totalExecutions: number;
  recentFailures: number;
}

// In-memory job registry (in production, this would be in Redis or database)
const jobRegistry: Map<string, JobStatus> = new Map([
  ['win_back', {
    id: 'win_back',
    name: 'Win-Back Campaign',
    description: 'Detect inactive users and run win-back campaigns',
    category: 'marketing',
    schedule: '0 * * * *', // Every hour
    status: 'active',
    successRate: 94.5,
    avgExecutionTime: 2340,
    totalExecutions: 1250,
    recentFailures: 12,
  }],
  ['birthday', {
    id: 'birthday',
    name: 'Birthday Rewards',
    description: 'Send birthday rewards and special offers',
    category: 'marketing',
    schedule: '0 9 * * *', // Daily at 9 AM
    status: 'active',
    successRate: 98.2,
    avgExecutionTime: 890,
    totalExecutions: 180,
    recentFailures: 0,
  }],
  ['tier_upgrade', {
    id: 'tier_upgrade',
    name: 'Tier Upgrades',
    description: 'Check and process tier upgrades',
    category: 'loyalty',
    schedule: '0 10 * * *', // Daily at 10 AM
    status: 'active',
    successRate: 99.1,
    avgExecutionTime: 456,
    totalExecutions: 365,
    recentFailures: 1,
  }],
  ['review_request', {
    id: 'review_request',
    name: 'Review Requests',
    description: 'Send review requests after bookings',
    category: 'marketing',
    schedule: '*/15 * * * *', // Every 15 minutes
    status: 'active',
    successRate: 91.3,
    avgExecutionTime: 1234,
    totalExecutions: 8640,
    recentFailures: 45,
  }],
  ['provider_training', {
    id: 'provider_training',
    name: 'Provider Training',
    description: 'Check provider training progress and send reminders',
    category: 'operations',
    schedule: '0 * * * *', // Every hour
    status: 'active',
    successRate: 96.7,
    avgExecutionTime: 1890,
    totalExecutions: 2480,
    recentFailures: 8,
  }],
  ['onboarding_checklist', {
    id: 'onboarding_checklist',
    name: 'Onboarding Checklist',
    description: 'Process onboarding checklists for new users',
    category: 'operations',
    schedule: '0 */6 * * *', // Every 6 hours
    status: 'active',
    successRate: 97.8,
    avgExecutionTime: 2340,
    totalExecutions: 620,
    recentFailures: 3,
  }],
  ['first_booking_discount', {
    id: 'first_booking_discount',
    name: 'First Booking Discount',
    description: 'Check and apply first booking discounts',
    category: 'marketing',
    schedule: '0 0 * * *', // Daily at midnight
    status: 'active',
    successRate: 98.9,
    avgExecutionTime: 678,
    totalExecutions: 365,
    recentFailures: 0,
  }],
  ['negative_review', {
    id: 'negative_review',
    name: 'Negative Review Recovery',
    description: 'Process and recover from negative reviews',
    category: 'operations',
    schedule: '*/30 * * * *', // Every 30 minutes
    status: 'active',
    successRate: 88.4,
    avgExecutionTime: 3456,
    totalExecutions: 4320,
    recentFailures: 28,
  }],
  ['auto_refund', {
    id: 'auto_refund',
    name: 'Auto Refund Threshold',
    description: 'Process automatic refunds based on threshold rules',
    category: 'operations',
    schedule: '0 * * * *', // Every hour
    status: 'active',
    successRate: 99.5,
    avgExecutionTime: 890,
    totalExecutions: 2480,
    recentFailures: 2,
  }],
  ['mediation', {
    id: 'mediation',
    name: 'Mediation Auto-Assign',
    description: 'Auto-assign unassigned mediation cases',
    category: 'operations',
    schedule: '0 */4 * * *', // Every 4 hours
    status: 'paused',
    successRate: 85.2,
    avgExecutionTime: 1567,
    totalExecutions: 310,
    recentFailures: 15,
  }],
  ['welcome_email', {
    id: 'welcome_email',
    name: 'Welcome Email Sequence',
    description: 'Send welcome email sequences to new users',
    category: 'email',
    schedule: '*/15 * * * *', // Every 15 minutes
    status: 'active',
    successRate: 95.1,
    avgExecutionTime: 2134,
    totalExecutions: 5760,
    recentFailures: 34,
  }],
  ['referral_gamification', {
    id: 'referral_gamification',
    name: 'Referral Gamification',
    description: 'Track referrals and award badges',
    category: 'loyalty',
    schedule: '0 * * * *', // Every hour
    status: 'error',
    successRate: 72.3,
    avgExecutionTime: 4567,
    totalExecutions: 1240,
    recentFailures: 89,
  }],
  ['off_peak_promotion', {
    id: 'off_peak_promotion',
    name: 'Off-Peak Promotion',
    description: 'Analyze demand patterns and generate promotion suggestions',
    category: 'marketing',
    schedule: '0 6 * * *', // Daily at 6 AM
    status: 'active',
    successRate: 0,
    avgExecutionTime: 0,
    totalExecutions: 30,
    recentFailures: 0,
  }],
]);

/**
 * GET /api/admin/automation/status
 * Get all automation jobs status
 */
router.get(
  '/status',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const jobs = Array.from(jobRegistry.values()).map(job => ({
        ...job,
        lastRun: job.totalExecutions > 0 ? new Date(Date.now() - Math.random() * 3600000).toISOString() : undefined,
        nextRun: job.status === 'active' ? new Date(Date.now() + Math.random() * 3600000).toISOString() : undefined,
      }));

      const activeJobs = jobs.filter(j => j.status === 'active').length;
      const pausedJobs = jobs.filter(j => j.status === 'paused').length;
      const errorJobs = jobs.filter(j => j.status === 'error').length;
      const totalExecutions = jobs.reduce((sum, j) => sum + j.totalExecutions, 0);
      const avgSuccessRate = jobs.reduce((sum, j) => sum + j.successRate, 0) / jobs.length;

      // Generate mock logs
      const logs = [];
      for (let i = 0; i < 20; i++) {
        const job = jobs[Math.floor(Math.random() * jobs.length)];
        logs.push({
          id: `log-${i}`,
          jobId: job.id,
          jobName: job.name,
          status: Math.random() > 0.1 ? 'success' : Math.random() > 0.5 ? 'failed' : 'partial',
          startTime: new Date(Date.now() - i * 30 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - i * 30 * 60 * 1000 + Math.random() * 5000).toISOString(),
          duration: Math.floor(Math.random() * 5000),
          recordsProcessed: Math.floor(Math.random() * 100),
          recordsFailed: Math.floor(Math.random() * 10),
          errorMessage: Math.random() > 0.7 ? 'Connection timeout after 30s' : undefined,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          jobs,
          logs,
          stats: {
            totalJobs: jobs.length,
            activeJobs,
            pausedJobs,
            errorJobs,
            totalExecutions,
            successfulExecutions: Math.floor(totalExecutions * (avgSuccessRate / 100)),
            failedExecutions: Math.floor(totalExecutions * ((100 - avgSuccessRate) / 100)),
            avgSuccessRate: Math.round(avgSuccessRate * 10) / 10,
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get automation status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/admin/automation/jobs/:jobId
 * Get specific job status
 */
router.get(
  '/jobs/:jobId',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const job = jobRegistry.get(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          message: 'Job not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          ...job,
          lastRun: job.totalExecutions > 0 ? new Date(Date.now() - Math.random() * 3600000).toISOString() : undefined,
          nextRun: job.status === 'active' ? new Date(Date.now() + Math.random() * 3600000).toISOString() : undefined,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get job status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * PATCH /api/admin/automation/jobs/:jobId/toggle
 * Toggle job status (pause/resume)
 */
router.patch(
  '/jobs/:jobId/toggle',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const job = jobRegistry.get(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          message: 'Job not found',
        });
        return;
      }

      if (job.status === 'error') {
        res.status(400).json({
          success: false,
          message: 'Cannot toggle error job. Fix the error first.',
        });
        return;
      }

      const newStatus = job.status === 'active' ? 'paused' : 'active';
      job.status = newStatus;
      jobRegistry.set(jobId, job);

      res.status(200).json({
        success: true,
        message: `Job ${newStatus === 'active' ? 'resumed' : 'paused'} successfully`,
        data: job,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to toggle job',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/admin/automation/jobs/:jobId/run
 * Manually trigger a job
 */
router.post(
  '/jobs/:jobId/run',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { jobId } = req.params;
      const job = jobRegistry.get(jobId);

      if (!job) {
        res.status(404).json({
          success: false,
          message: 'Job not found',
        });
        return;
      }

      // In production, this would queue the job for immediate execution
      job.totalExecutions += 1;
      job.lastRun = new Date().toISOString();
      jobRegistry.set(jobId, job);

      res.status(200).json({
        success: true,
        message: 'Job triggered successfully',
        data: {
          jobId: job.id,
          startedAt: job.lastRun,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to trigger job',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/admin/automation/jobs/:jobId/logs
 * Get job execution logs
 */
router.get(
  '/jobs/:jobId/logs',
  authenticate,
  requireRole(['admin']),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

      const { jobId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Generate mock logs for this job
      const logs = [];
      for (let i = 0; i < Math.min(Number(limit), 100); i++) {
        logs.push({
          id: `log-${jobId}-${i}`,
          jobId,
          jobName: jobRegistry.get(jobId)?.name || jobId,
          status: Math.random() > 0.1 ? 'success' : Math.random() > 0.5 ? 'failed' : 'partial',
          startTime: new Date(Date.now() - i * 30 * 60 * 1000).toISOString(),
          endTime: new Date(Date.now() - i * 30 * 60 * 1000 + Math.random() * 5000).toISOString(),
          duration: Math.floor(Math.random() * 5000),
          recordsProcessed: Math.floor(Math.random() * 100),
          recordsFailed: Math.floor(Math.random() * 10),
          errorMessage: Math.random() > 0.7 ? 'Connection timeout after 30s' : undefined,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          logs,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total: 100,
            pages: Math.ceil(100 / Number(limit)),
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get job logs',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/admin/automation/winback
 * Get win-back campaign data
 */
router.get(
  '/winback',
  authenticate,
  requireRole(['admin']),
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      res.status(200).json({
        success: true,
        data: {
          campaigns: [],
          stats: {
            totalCampaigns: 1247,
            byStatus: { pending: 234, engaged: 456, converted: 312, failed: 145, skipped: 100 },
            byType: {
              dormant_30: { total: 523, converted: 89, conversionRate: 17.0 },
              dormant_60: { total: 345, converted: 45, conversionRate: 13.0 },
              dormant_90: { total: 234, converted: 23, conversionRate: 9.8 },
              churn_risk: { total: 89, converted: 34, conversionRate: 38.2 },
              win_back: { total: 56, converted: 12, conversionRate: 21.4 },
            },
            averageConversionTime: 48,
            totalRevenue: 456789,
            roi: 3.5,
            campaignsTrend: [
              { date: 'Jan', sent: 180, converted: 28 },
              { date: 'Feb', sent: 195, converted: 32 },
              { date: 'Mar', sent: 210, converted: 38 },
              { date: 'Apr', sent: 225, converted: 42 },
              { date: 'May', sent: 198, converted: 35 },
              { date: 'Jun', sent: 239, converted: 45 },
            ],
            channelPerformance: [
              { channel: 'Email', sent: 1247, opened: 623, clicked: 187, rate: 50 },
              { channel: 'Push', sent: 1105, opened: 442, clicked: 89, rate: 40 },
              { channel: 'SMS', sent: 523, opened: 0, clicked: 45, rate: 8.6 },
            ],
          },
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to get win-back data',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

export default router;
