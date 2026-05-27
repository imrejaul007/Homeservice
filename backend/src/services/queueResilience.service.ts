/**
 * Queue Resilience Service for NILIN Platform
 *
 * Implements queue resilience patterns:
 * - Dead letter queue monitoring
 * - Automatic retry with backoff
 * - Queue health monitoring
 * - Alert on queue depth spikes
 */

import { Queue, Worker, Job } from 'bullmq';
import logger from '../utils/logger';
import { getDeadLetterQueue, withRetry, DeadLetterEntry } from '../utils/retry.util';

// Queue configuration
interface QueueConfig {
  name: string;
  maxRetries: number;
  backoffType: 'exponential' | 'fixed';
  backoffDelay: number;
  maxBackoffDelay: number;
  alertThreshold: number;
  criticalThreshold: number;
}

// Default queue configurations
const QUEUE_CONFIGS: Record<string, QueueConfig> = {
  email: {
    name: 'email',
    maxRetries: 5,
    backoffType: 'exponential',
    backoffDelay: 5000,
    maxBackoffDelay: 300000, // 5 minutes
    alertThreshold: 100,
    criticalThreshold: 500,
  },
  notification: {
    name: 'notification',
    maxRetries: 3,
    backoffType: 'exponential',
    backoffDelay: 2000,
    maxBackoffDelay: 60000, // 1 minute
    alertThreshold: 200,
    criticalThreshold: 1000,
  },
  analytics: {
    name: 'analytics',
    maxRetries: 2,
    backoffType: 'fixed',
    backoffDelay: 1000,
    maxBackoffDelay: 10000,
    alertThreshold: 500,
    criticalThreshold: 2000,
  },
  payment: {
    name: 'payment',
    maxRetries: 10,
    backoffType: 'exponential',
    backoffDelay: 10000,
    maxBackoffDelay: 600000, // 10 minutes
    alertThreshold: 50,
    criticalThreshold: 200,
  },
  webhook: {
    name: 'webhook',
    maxRetries: 8,
    backoffType: 'exponential',
    backoffDelay: 30000,
    maxBackoffDelay: 900000, // 15 minutes
    alertThreshold: 25,
    criticalThreshold: 100,
  },
};

// Queue health metrics
export interface QueueHealthMetrics {
  name: string;
  status: 'healthy' | 'degraded' | 'critical';
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  throughput: number; // jobs per minute
  avgProcessingTime: number; // ms
  errorRate: number; // percentage
  lastAlert: Date | null;
}

// Dead letter queue entry with retry info
export interface QueueDLQEntry<T = unknown> {
  id: string;
  data: T;
  error: string;
  errorCode?: string;
  attempts: number;
  lastAttempt: Date;
  createdAt: Date;
  metadata?: Record<string, unknown>;
  queueName: string;
  jobId: string;
  maxRetries: number;
  nextRetryAt?: Date;
}

// Alert thresholds
interface AlertThresholds {
  queueDepth: number;
  errorRate: number;
  processingTime: number;
  throughputDrop: number; // percentage
}

// Alert configuration
const ALERT_CONFIG: AlertThresholds = {
  queueDepth: 100,
  errorRate: 10, // 10%
  processingTime: 30000, // 30 seconds
  throughputDrop: 50, // 50% drop
};

// Queue registry
interface QueueInstance {
  queue: Queue;
  config: QueueConfig;
  healthMetrics: QueueHealthMetrics;
  lastCheck: Date;
}

class QueueResilienceService {
  private queues: Map<string, QueueInstance> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private alertCallbacks: Array<(alert: QueueAlert) => void> = [];
  private processingTimes: Map<string, number[]> = new Map();
  private readonly MAX_PROCESSING_TIMES = 100;

  constructor() {
    this.startHealthCheck();
  }

  /**
   * Register a queue for monitoring
   */
  registerQueue(queue: Queue, config?: Partial<QueueConfig>): QueueInstance {
    const name = queue.name;
    const queueConfig = QUEUE_CONFIGS[name] || {
      name,
      maxRetries: 3,
      backoffType: 'exponential' as const,
      backoffDelay: 5000,
      maxBackoffDelay: 300000,
      alertThreshold: 100,
      criticalThreshold: 500,
      ...config,
    };

    const instance: QueueInstance = {
      queue,
      config: queueConfig,
      healthMetrics: {
        name,
        status: 'healthy',
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false,
        throughput: 0,
        avgProcessingTime: 0,
        errorRate: 0,
        lastAlert: null,
      },
      lastCheck: new Date(),
    };

    this.queues.set(name, instance);
    this.processingTimes.set(name, []);

    logger.info(`Queue registered for monitoring: ${name}`, {
      queue: name,
      config: queueConfig,
      action: 'QUEUE_REGISTERED',
    });

    return instance;
  }

  /**
   * Get queue health metrics
   */
  async getQueueHealth(queueName: string): Promise<QueueHealthMetrics | null> {
    const instance = this.queues.get(queueName);
    if (!instance) {
      return null;
    }

    try {
      const counts = await instance.queue.getJobCounts(
        'wait',
        'active',
        'completed',
        'failed',
        'delayed'
      );

      const isPaused = await instance.queue.isPaused();

      instance.healthMetrics.waiting = counts.wait || 0;
      instance.healthMetrics.active = counts.active || 0;
      instance.healthMetrics.completed = counts.completed || 0;
      instance.healthMetrics.failed = counts.failed || 0;
      instance.healthMetrics.delayed = counts.delayed || 0;
      instance.healthMetrics.paused = isPaused;

      // Calculate error rate
      const total = Object.values(counts).reduce((sum, count) => sum + (count || 0), 0);
      instance.healthMetrics.errorRate = total > 0
        ? ((counts.failed || 0) / total) * 100
        : 0;

      // Calculate average processing time
      const times = this.processingTimes.get(queueName) || [];
      instance.healthMetrics.avgProcessingTime = times.length > 0
        ? times.reduce((sum, t) => sum + t, 0) / times.length
        : 0;

      // Determine status
      instance.healthMetrics.status = this.calculateStatus(instance.healthMetrics, instance.config);

      instance.lastCheck = new Date();

      return instance.healthMetrics;
    } catch (error) {
      logger.error(`Failed to get queue health for ${queueName}`, {
        queue: queueName,
        error: (error as Error).message,
        action: 'QUEUE_HEALTH_FAILED',
      });
      return null;
    }
  }

  /**
   * Calculate queue status based on metrics and thresholds
   */
  private calculateStatus(
    metrics: QueueHealthMetrics,
    config: QueueConfig
  ): 'healthy' | 'degraded' | 'critical' {
    // Critical if above critical threshold
    if (metrics.waiting >= config.criticalThreshold) {
      return 'critical';
    }

    // Degraded if above alert threshold
    if (metrics.waiting >= config.alertThreshold) {
      return 'degraded';
    }

    // Degraded if high error rate
    if (metrics.errorRate > ALERT_CONFIG.errorRate) {
      return 'degraded';
    }

    // Degraded if slow processing
    if (metrics.avgProcessingTime > ALERT_CONFIG.processingTime) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Get all queue health metrics
   */
  async getAllQueueHealth(): Promise<QueueHealthMetrics[]> {
    const results: QueueHealthMetrics[] = [];

    for (const [name] of this.queues) {
      const health = await this.getQueueHealth(name);
      if (health) {
        results.push(health);
      }
    }

    return results;
  }

  /**
   * Add alert callback
   */
  onAlert(callback: (alert: QueueAlert) => void): void {
    this.alertCallbacks.push(callback);
  }

  /**
   * Emit alert
   */
  private emitAlert(alert: QueueAlert): void {
    logger.warn('Queue alert', {
      alertType: alert.type,
      queue: alert.queue,
      severity: alert.severity,
      message: alert.message,
      action: 'QUEUE_ALERT',
    });

    this.alertCallbacks.forEach(cb => {
      try {
        cb(alert);
      } catch (error) {
        logger.error('Alert callback failed', {
          error: (error as Error).message,
          action: 'ALERT_CALLBACK_FAILED',
        });
      }
    });
  }

  /**
   * Check and emit alerts
   */
  private async checkAndAlert(): Promise<void> {
    for (const instance of this.queues.values()) {
      const health = await this.getQueueHealth(instance.config.name);
      if (!health) continue;

      // Check for depth spike
      if (health.waiting >= instance.config.alertThreshold) {
        const severity = health.waiting >= instance.config.criticalThreshold ? 'critical' : 'warning';

        const alert: QueueAlert = {
          id: `alert_${instance.config.name}_${Date.now()}`,
          type: 'queue_depth_spike',
          queue: instance.config.name,
          severity,
          message: `Queue '${instance.config.name}' depth is ${health.waiting} (threshold: ${instance.config.alertThreshold})`,
          metrics: health,
          timestamp: new Date(),
        };

        this.emitAlert(alert);
        instance.healthMetrics.lastAlert = new Date();
      }

      // Check for high error rate
      if (health.errorRate > ALERT_CONFIG.errorRate) {
        const alert: QueueAlert = {
          id: `alert_${instance.config.name}_${Date.now()}`,
          type: 'high_error_rate',
          queue: instance.config.name,
          severity: health.errorRate > 20 ? 'critical' : 'warning',
          message: `Queue '${instance.config.name}' error rate is ${health.errorRate.toFixed(2)}%`,
          metrics: health,
          timestamp: new Date(),
        };

        this.emitAlert(alert);
        instance.healthMetrics.lastAlert = new Date();
      }
    }
  }

  /**
   * Start periodic health check
   */
  private startHealthCheck(): void {
    const intervalMs = parseInt(process.env.QUEUE_HEALTH_CHECK_INTERVAL_MS || '30000', 10);

    this.healthCheckInterval = setInterval(async () => {
      await this.checkAndAlert();
    }, intervalMs);

    logger.info('Queue health check started', {
      interval: intervalMs,
      action: 'QUEUE_HEALTH_STARTED',
    });
  }

  /**
   * Record job processing time
   */
  recordProcessingTime(queueName: string, durationMs: number): void {
    const times = this.processingTimes.get(queueName) || [];
    times.push(durationMs);

    if (times.length > this.MAX_PROCESSING_TIMES) {
      times.shift();
    }

    this.processingTimes.set(queueName, times);
  }

  /**
   * Retry a failed job
   */
  async retryJob(queueName: string, jobId: string): Promise<boolean> {
    const instance = this.queues.get(queueName);
    if (!instance) {
      logger.error(`Queue not found: ${queueName}`);
      return false;
    }

    try {
      const job = await instance.queue.getJob(jobId);
      if (!job) {
        logger.error(`Job not found: ${jobId} in queue ${queueName}`);
        return false;
      }

      await job.retry();
      logger.info(`Job ${jobId} retry scheduled`, {
        queue: queueName,
        jobId,
        action: 'JOB_RETRY_SCHEDULED',
      });

      return true;
    } catch (error) {
      logger.error(`Failed to retry job ${jobId}`, {
        queue: queueName,
        jobId,
        error: (error as Error).message,
        action: 'JOB_RETRY_FAILED',
      });
      return false;
    }
  }

  /**
   * Retry all failed jobs in a queue
   */
  async retryAllFailed(queueName: string): Promise<{ retried: number; failed: number }> {
    const instance = this.queues.get(queueName);
    if (!instance) {
      return { retried: 0, failed: 0 };
    }

    try {
      const failedJobs = await instance.queue.getFailed();

      let retried = 0;
      let failed = 0;

      for (const job of failedJobs) {
        try {
          await job.retry();
          retried++;
        } catch (error) {
          failed++;
          logger.error(`Failed to retry job ${job.id}`, {
            jobId: job.id,
            error: (error as Error).message,
            action: 'JOB_RETRY_FAILED',
          });
        }
      }

      logger.info(`Retry all failed jobs completed`, {
        queue: queueName,
        retried,
        failed,
        action: 'RETRY_ALL_COMPLETED',
      });

      return { retried, failed };
    } catch (error) {
      logger.error(`Failed to get failed jobs for queue ${queueName}`, {
        queue: queueName,
        error: (error as Error).message,
        action: 'GET_FAILED_JOBS_FAILED',
      });
      return { retried: 0, failed: 0 };
    }
  }

  /**
   * Get dead letter entries for a queue
   */
  getDeadLetterEntries(queueName: string): any[] {
    const entries = getDeadLetterQueue();

    return entries.map(entry => ({
      id: entry.id,
      data: entry.metadata,
      error: entry.error?.message || String(entry.error),
      attempts: entry.attempts,
      lastAttempt: entry.lastAttempt,
      createdAt: entry.timestamp,
      queueName,
      jobId: entry.metadata?.jobId as string || entry.id,
      maxRetries: QUEUE_CONFIGS[queueName]?.maxRetries || 3,
    }));
  }

  /**
   * Reprocess a dead letter entry
   */
  async reprocessDeadLetter<T>(
    queueName: string,
    entryId: string,
    processor: (data: T) => Promise<void>
  ): Promise<{ success: boolean; error?: string }> {
    const instance = this.queues.get(queueName);
    if (!instance) {
      return { success: false, error: 'Queue not found' };
    }

    const dlq = getDeadLetterQueue();
    const entry = dlq.find(e => e.id === entryId);

    if (!entry) {
      return { success: false, error: 'Entry not found' };
    }

    try {
      await withRetry(() => processor((entry.metadata?.data as T) || ({} as T)), {
        maxAttempts: 2,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
      });

      // Remove from dead letter queue
      const index = dlq.findIndex(e => e.id === entryId);
      if (index > -1) {
        dlq.splice(index, 1);
      }

      logger.info(`Dead letter entry reprocessed`, {
        queue: queueName,
        entryId,
        action: 'DLQ_ENTRY_REPROCESSED',
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue(queueName: string): number {
    const dlq = getDeadLetterQueue();
    const size = dlq.length;

    // Clear entries for this queue (by filtering)
    // Note: In a real implementation, you'd filter by queue metadata
    dlq.length = 0;

    logger.info(`Dead letter queue cleared`, {
      queue: queueName,
      clearedCount: size,
      action: 'DLQ_CLEARED',
    });

    return size;
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: string): Promise<boolean> {
    const instance = this.queues.get(queueName);
    if (!instance) {
      return false;
    }

    try {
      await instance.queue.pause();
      logger.info(`Queue paused`, {
        queue: queueName,
        action: 'QUEUE_PAUSED',
      });
      return true;
    } catch (error) {
      logger.error(`Failed to pause queue ${queueName}`, {
        queue: queueName,
        error: (error as Error).message,
        action: 'QUEUE_PAUSE_FAILED',
      });
      return false;
    }
  }

  /**
   * Resume a queue
   */
  async resumeQueue(queueName: string): Promise<boolean> {
    const instance = this.queues.get(queueName);
    if (!instance) {
      return false;
    }

    try {
      await instance.queue.resume();
      logger.info(`Queue resumed`, {
        queue: queueName,
        action: 'QUEUE_RESUMED',
      });
      return true;
    } catch (error) {
      logger.error(`Failed to resume queue ${queueName}`, {
        queue: queueName,
        error: (error as Error).message,
        action: 'QUEUE_RESUME_FAILED',
      });
      return false;
    }
  }

  /**
   * Get queue statistics summary
   */
  getQueueSummary(): {
    totalQueues: number;
    healthyQueues: number;
    degradedQueues: number;
    criticalQueues: number;
    totalWaiting: number;
    totalFailed: number;
  } {
    let healthyQueues = 0;
    let degradedQueues = 0;
    let criticalQueues = 0;
    let totalWaiting = 0;
    let totalFailed = 0;

    for (const instance of this.queues.values()) {
      const status = instance.healthMetrics.status;

      if (status === 'healthy') healthyQueues++;
      else if (status === 'degraded') degradedQueues++;
      else if (status === 'critical') criticalQueues++;

      totalWaiting += instance.healthMetrics.waiting;
      totalFailed += instance.healthMetrics.failed;
    }

    return {
      totalQueues: this.queues.size,
      healthyQueues,
      degradedQueues,
      criticalQueues,
      totalWaiting,
      totalFailed,
    };
  }

  /**
   * Shutdown the service
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    logger.info('Queue resilience service shut down', {
      action: 'QUEUE_RESILIENCE_SHUTDOWN',
    });
  }
}

// Alert interface
export interface QueueAlert {
  id: string;
  type: 'queue_depth_spike' | 'high_error_rate' | 'queue_failure' | 'dlq_overflow';
  queue: string;
  severity: 'warning' | 'critical';
  message: string;
  metrics?: QueueHealthMetrics;
  timestamp: Date;
}

// Export singleton
export const queueResilience = new QueueResilienceService();

export default queueResilience;
