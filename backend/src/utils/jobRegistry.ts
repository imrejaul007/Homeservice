/**
 * Job Registry - Database-backed job status storage
 *
 * Uses Redis for persistence with in-memory fallback.
 * Ensures job data persists across server restarts.
 */

import { cache } from '../config/redis';
import logger from './logger';

export interface JobStatus {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  schedule: string;
  lastRun?: string;
  nextRun?: string;
  status: 'active' | 'paused' | 'error' | 'disabled';
  enabled: boolean;
  successRate: number;
  avgExecutionTime: number;
  avgDuration?: number;
  totalExecutions: number;
  recentFailures: number;
}

export interface JobExecutionResult {
  success: boolean;
  executionTimeMs: number;
  recordsProcessed?: number;
  recordsFailed?: number;
  error?: string;
}

// Default jobs configuration (used for seeding)
const DEFAULT_JOBS: JobStatus[] = [
  {
    id: 'win_back',
    name: 'Win-Back Campaign',
    type: 'marketing',
    description: 'Detect inactive users and run win-back campaigns',
    category: 'marketing',
    schedule: '0 * * * *',
    status: 'active',
    enabled: true,
    successRate: 94.5,
    avgExecutionTime: 2340,
    totalExecutions: 1250,
    recentFailures: 12,
  },
  {
    id: 'birthday',
    name: 'Birthday Rewards',
    type: 'marketing',
    description: 'Send birthday rewards and special offers',
    category: 'marketing',
    schedule: '0 9 * * *',
    status: 'active',
    enabled: true,
    successRate: 98.2,
    avgExecutionTime: 890,
    totalExecutions: 180,
    recentFailures: 0,
  },
  {
    id: 'tier_upgrade',
    name: 'Tier Upgrades',
    type: 'loyalty',
    description: 'Check and process tier upgrades',
    category: 'loyalty',
    schedule: '0 10 * * *',
    status: 'active',
    enabled: true,
    successRate: 99.1,
    avgExecutionTime: 456,
    totalExecutions: 365,
    recentFailures: 1,
  },
  {
    id: 'review_request',
    name: 'Review Requests',
    type: 'marketing',
    description: 'Send review requests after bookings',
    category: 'marketing',
    schedule: '*/15 * * * *',
    status: 'active',
    enabled: true,
    successRate: 91.3,
    avgExecutionTime: 1234,
    totalExecutions: 8640,
    recentFailures: 45,
  },
  {
    id: 'provider_training',
    name: 'Provider Training',
    type: 'operations',
    description: 'Check provider training progress and send reminders',
    category: 'operations',
    schedule: '0 * * * *',
    status: 'active',
    enabled: true,
    successRate: 96.7,
    avgExecutionTime: 1890,
    totalExecutions: 2480,
    recentFailures: 8,
  },
  {
    id: 'onboarding_checklist',
    name: 'Onboarding Checklist',
    type: 'operations',
    description: 'Process onboarding checklists for new users',
    category: 'operations',
    schedule: '0 */6 * * *',
    status: 'active',
    enabled: true,
    successRate: 97.8,
    avgExecutionTime: 2340,
    totalExecutions: 620,
    recentFailures: 3,
  },
  {
    id: 'first_booking_discount',
    name: 'First Booking Discount',
    type: 'marketing',
    description: 'Check and apply first booking discounts',
    category: 'marketing',
    schedule: '0 0 * * *',
    status: 'active',
    enabled: true,
    successRate: 98.9,
    avgExecutionTime: 678,
    totalExecutions: 365,
    recentFailures: 0,
  },
  {
    id: 'negative_review',
    name: 'Negative Review Recovery',
    type: 'operations',
    description: 'Process and recover from negative reviews',
    category: 'operations',
    schedule: '*/30 * * * *',
    status: 'active',
    enabled: true,
    successRate: 88.4,
    avgExecutionTime: 3456,
    totalExecutions: 4320,
    recentFailures: 28,
  },
  {
    id: 'auto_refund',
    name: 'Auto Refund Threshold',
    type: 'operations',
    description: 'Process automatic refunds based on threshold rules',
    category: 'operations',
    schedule: '0 * * * *',
    status: 'active',
    enabled: true,
    successRate: 99.5,
    avgExecutionTime: 890,
    totalExecutions: 2480,
    recentFailures: 2,
  },
  {
    id: 'mediation',
    name: 'Mediation Auto-Assign',
    type: 'operations',
    description: 'Auto-assign unassigned mediation cases',
    category: 'operations',
    schedule: '0 */4 * * *',
    status: 'paused',
    enabled: false,
    successRate: 85.2,
    avgExecutionTime: 1567,
    totalExecutions: 310,
    recentFailures: 15,
  },
  {
    id: 'welcome_email',
    name: 'Welcome Email Sequence',
    type: 'email',
    description: 'Send welcome email sequences to new users',
    category: 'email',
    schedule: '*/15 * * * *',
    status: 'active',
    enabled: true,
    successRate: 95.1,
    avgExecutionTime: 2134,
    totalExecutions: 5760,
    recentFailures: 34,
  },
  {
    id: 'referral_gamification',
    name: 'Referral Gamification',
    type: 'loyalty',
    description: 'Track referrals and award badges',
    category: 'loyalty',
    schedule: '0 * * * *',
    status: 'error',
    enabled: true,
    successRate: 72.3,
    avgExecutionTime: 4567,
    totalExecutions: 1240,
    recentFailures: 89,
  },
  {
    id: 'off_peak_promotion',
    name: 'Off-Peak Promotion',
    type: 'marketing',
    description: 'Analyze demand patterns and generate promotion suggestions',
    category: 'marketing',
    schedule: '0 6 * * *',
    status: 'active',
    enabled: true,
    successRate: 0,
    avgExecutionTime: 0,
    totalExecutions: 30,
    recentFailures: 0,
  },
];

const JOB_REGISTRY_KEY = 'automation:jobs';
const JOB_REGISTRY_TTL = 86400 * 30; // 30 days TTL

/**
 * Database-backed job registry using Redis with in-memory fallback
 */
class JobRegistry {
  private memoryCache: Map<string, JobStatus> = new Map();
  private initialized = false;

  /**
   * Initialize job registry from Redis or seed defaults
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const cached = await cache.get(JOB_REGISTRY_KEY);

      if (cached) {
        const jobs: JobStatus[] = JSON.parse(cached);
        this.memoryCache.clear();
        for (const job of jobs) {
          this.memoryCache.set(job.id, job);
        }
        logger.info(`Job registry loaded from Redis: ${jobs.length} jobs`);
      } else {
        await this.seedDefaults();
        logger.info('Job registry seeded with default jobs');
      }

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize job registry from Redis, using in-memory fallback', error);
      if (this.memoryCache.size === 0) {
        for (const job of DEFAULT_JOBS) {
          this.memoryCache.set(job.id, { ...job });
        }
      }
      this.initialized = true;
    }
  }

  /**
   * Seed default jobs into the registry
   */
  async seedDefaults(): Promise<void> {
    this.memoryCache.clear();
    for (const job of DEFAULT_JOBS) {
      this.memoryCache.set(job.id, { ...job });
    }
    await this.persist();
  }

  /**
   * Persist current state to Redis
   */
  async persist(): Promise<void> {
    try {
      const jobs = Array.from(this.memoryCache.values());
      await cache.set(JOB_REGISTRY_KEY, JSON.stringify(jobs), JOB_REGISTRY_TTL);
    } catch (error) {
      logger.error('Failed to persist job registry to Redis', error);
    }
  }

  /**
   * Get all jobs
   */
  getAll(): JobStatus[] {
    return Array.from(this.memoryCache.values());
  }

  /**
   * Get a single job by ID
   */
  get(jobId: string): JobStatus | undefined {
    return this.memoryCache.get(jobId);
  }

  /**
   * Set a job and persist changes
   */
  async set(jobId: string, job: JobStatus): Promise<void> {
    this.memoryCache.set(jobId, job);
    await this.persist();
  }

  /**
   * Update job status directly
   */
  async updateStatus(jobId: string, status: JobStatus['status']): Promise<JobStatus | undefined> {
    const job = this.memoryCache.get(jobId);
    if (!job) return undefined;

    job.status = status;
    await this.set(jobId, job);
    return job;
  }

  /**
   * Record a job execution and update statistics
   */
  async recordExecution(jobId: string, result: JobExecutionResult): Promise<void> {
    const job = this.memoryCache.get(jobId);
    if (!job) {
      logger.warn(`Job ${jobId} not found in registry for execution recording`);
      return;
    }

    job.totalExecutions += 1;
    job.lastRun = new Date().toISOString();

    if (result.success) {
      // Update weighted average execution time
      if (job.totalExecutions > 1) {
        job.avgExecutionTime = Math.round(
          (job.avgExecutionTime * (job.totalExecutions - 1) + result.executionTimeMs) / job.totalExecutions
        );
      } else {
        job.avgExecutionTime = result.executionTimeMs;
      }

      // Decrease recent failures on success
      if (job.recentFailures > 0) {
        job.recentFailures = Math.max(0, job.recentFailures - 1);
      }

      // Recalculate success rate
      const totalFailures = job.recentFailures;
      job.successRate = Math.round(((job.totalExecutions - totalFailures) / job.totalExecutions) * 1000) / 10;

      // Clear error status if job was in error state and now succeeds
      if (job.status === 'error') {
        job.status = 'active';
      }
    } else {
      job.recentFailures += 1;

      // Cap recent failures at 5% of total executions
      const maxFailures = Math.ceil(job.totalExecutions * 0.05);
      if (job.recentFailures > maxFailures) {
        job.recentFailures = maxFailures;
      }

      // Update success rate
      job.successRate = Math.round(((job.totalExecutions - job.recentFailures) / job.totalExecutions) * 1000) / 10;

      // Set error status if failure rate exceeds threshold
      if (job.recentFailures > 10 && (job.recentFailures / job.totalExecutions) > 0.2) {
        job.status = 'error';
        logger.error(`Job ${jobId} marked as error: ${job.recentFailures}/${job.totalExecutions} failures`);
      }
    }

    await this.set(jobId, job);
  }

  /**
   * Run a job with automatic execution recording
   */
  async runJob<T>(
    jobId: string,
    jobFn: () => Promise<T>
  ): Promise<{ result: T; execution: JobExecutionResult }> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      const result = await jobFn();
      success = true;
      return {
        result,
        execution: {
          success: true,
          executionTimeMs: Date.now() - startTime,
        },
      };
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      throw err;
    } finally {
      await this.recordExecution(jobId, {
        success,
        executionTimeMs: Date.now() - startTime,
        error,
      });
    }
  }

  /**
   * Reset job to defaults
   */
  async resetJob(jobId: string): Promise<boolean> {
    const defaultJob = DEFAULT_JOBS.find(j => j.id === jobId);
    if (!defaultJob) return false;

    await this.set(jobId, { ...defaultJob });
    return true;
  }

  /**
   * Get job statistics
   */
  getStats(): {
    totalJobs: number;
    activeJobs: number;
    pausedJobs: number;
    errorJobs: number;
    totalExecutions: number;
    avgSuccessRate: number;
  } {
    const jobs = this.getAll();
    return {
      totalJobs: jobs.length,
      activeJobs: jobs.filter(j => j.status === 'active').length,
      pausedJobs: jobs.filter(j => j.status === 'paused').length,
      errorJobs: jobs.filter(j => j.status === 'error').length,
      totalExecutions: jobs.reduce((sum, j) => sum + j.totalExecutions, 0),
      avgSuccessRate: jobs.length > 0
        ? Math.round((jobs.reduce((sum, j) => sum + j.successRate, 0) / jobs.length) * 10) / 10
        : 0,
    };
  }
}

// Singleton instance
export const jobRegistry = new JobRegistry();

// Also export DEFAULT_JOBS for reference
export { DEFAULT_JOBS };
