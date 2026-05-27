/**
 * MemoryManager.ts - Memory optimization and monitoring for NILIN app
 * Monitors memory usage, triggers cleanup under pressure, manages caches
 */

import { cacheManager } from './CacheManager';
import { requestBatcher } from './RequestBatcher';

export interface MemoryStatus {
  used: number;
  total: number;
  limit: number;
  percentage: number;
  isUnderPressure: boolean;
  pressureLevel: 'normal' | 'moderate' | 'high' | 'critical';
}

export interface MemoryThresholds {
  moderate: number; // Start warning (0-1)
  high: number; // Start cleanup (0-1)
  critical: number; // Force cleanup (0-1)
}

export interface MemoryEvent {
  type: 'cleanup' | 'pressure' | 'threshold' | 'warning';
  timestamp: number;
  details: Record<string, unknown>;
}

const DEFAULT_THRESHOLDS: MemoryThresholds = {
  moderate: 0.6, // 60%
  high: 0.75, // 75%
  critical: 0.9, // 90%
};

class MemoryManagerService {
  private static instance: MemoryManagerService;
  private thresholds: MemoryThresholds;
  private lastCheck: number = 0;
  private checkInterval: number = 5000; // Check every 5 seconds
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Map<string, (event: MemoryEvent) => void> = new Map();
  private recentEvents: MemoryEvent[] = [];
  private maxRecentEvents: number = 50;
  private isMonitoring: boolean = false;
  private cleanupCallbacks: Array<() => void | Promise<void>> = [];

  private constructor(thresholds?: Partial<MemoryThresholds>) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(thresholds?: Partial<MemoryThresholds>): MemoryManagerService {
    if (!MemoryManagerService.instance) {
      MemoryManagerService.instance = new MemoryManagerService(thresholds);
    }
    return MemoryManagerService.instance;
  }

  /**
   * Reset singleton instance
   */
  public static resetInstance(): void {
    if (MemoryManagerService.instance) {
      MemoryManagerService.instance.stopMonitoring();
      MemoryManagerService.instance = undefined as unknown as MemoryManagerService;
    }
  }

  /**
   * Get current memory status
   */
  public getMemoryUsage(): MemoryStatus {
    let used = 0;
    let total = 0;
    let limit = 0;

    // Check if Performance Memory API is available
    if ('memory' in performance) {
      const memory = (performance as Performance & {
        memory: {
          usedJSHeapSize: number;
          totalJSHeapSize: number;
          jsHeapSizeLimit: number;
        };
      }).memory;

      used = memory.usedJSHeapSize;
      total = memory.totalJSHeapSize;
      limit = memory.jsHeapSizeLimit;
    } else {
      // Fallback estimation
      used = this.estimateMemoryUsage();
      total = used;
      limit = this.getEstimatedLimit();
    }

    const percentage = limit > 0 ? used / limit : 0;
    const pressureLevel = this.getPressureLevel(percentage);

    return {
      used,
      total,
      limit,
      percentage,
      isUnderPressure: pressureLevel !== 'normal',
      pressureLevel,
    };
  }

  /**
   * Check if memory is under pressure
   */
  public isUnderPressure(): boolean {
    const status = this.getMemoryUsage();
    return status.isUnderPressure;
  }

  /**
   * Get current pressure level
   */
  public getPressureLevel(percentage?: number): MemoryStatus['pressureLevel'] {
    const status = percentage !== undefined
      ? { percentage }
      : this.getMemoryUsage();

    if (status.percentage >= this.thresholds.critical) {
      return 'critical';
    }
    if (status.percentage >= this.thresholds.high) {
      return 'high';
    }
    if (status.percentage >= this.thresholds.moderate) {
      return 'moderate';
    }
    return 'normal';
  }

  /**
   * Trigger cleanup
   */
  public async triggerCleanup(): Promise<void> {
    const status = this.getMemoryUsage();

    this.emitEvent({
      type: 'cleanup',
      timestamp: Date.now(),
      details: {
        before: status.used,
        pressureLevel: status.pressureLevel,
      },
    });

    // Clear caches
    this.clearCaches();

    // Clear request batcher deduplication
    requestBatcher.clearDeduplicationCache();

    // Run registered cleanup callbacks
    for (const callback of this.cleanupCallbacks) {
      try {
        await callback();
      } catch (error) {
        console.error('Cleanup callback error:', error);
      }
    }

    // Force garbage collection if available (rarely works)
    if (typeof window !== 'undefined' && 'gc' in window) {
      try {
        (window as Window & { gc?: () => void }).gc?.();
      } catch {
        // GC not available
      }
    }

    const afterStatus = this.getMemoryUsage();

    this.emitEvent({
      type: 'cleanup',
      timestamp: Date.now(),
      details: {
        after: afterStatus.used,
        freed: status.used - afterStatus.used,
        improvement: status.used > 0
          ? ((status.used - afterStatus.used) / status.used) * 100
          : 0,
      },
    });

    // Log if significant improvement
    if (afterStatus.used < status.used * 0.9) {
      console.log(
        `[MemoryManager] Cleaned up ${this.formatBytes(status.used - afterStatus.used)} ` +
        `(${((status.used - afterStatus.used) / status.used * 100).toFixed(1)}% reduction)`
      );
    }
  }

  /**
   * Clear all caches
   */
  public clearCaches(): void {
    // Clear image cache if exists
    this.clearImageCache();

    // Clear data cache
    cacheManager.clear();

    // Clear stale entries
    cacheManager.cleanExpired();
  }

  /**
   * Clear image cache (browser only)
   */
  private clearImageCache(): void {
    if (typeof document === 'undefined') return;

    // Revoke all object URLs
    const images = document.querySelectorAll('img[data-cache-id]');
    images.forEach((img) => {
      const src = img.getAttribute('src');
      if (src?.startsWith('blob:') || src?.startsWith('data:')) {
        URL.revokeObjectURL(src);
      }
    });
  }

  /**
   * Start monitoring memory
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;

    this.intervalId = setInterval(() => {
      this.checkMemory();
    }, this.checkInterval);

    // Initial check
    this.checkMemory();
  }

  /**
   * Stop monitoring memory
   */
  public stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isMonitoring = false;
  }

  /**
   * Check memory and trigger cleanup if needed
   */
  private checkMemory(): void {
    const status = this.getMemoryUsage();
    const previousLevel = this.getPressureLevel();

    this.lastCheck = Date.now();

    // Emit pressure event if level changed
    if (status.isUnderPressure && status.percentage >= this.thresholds.moderate) {
      this.emitEvent({
        type: 'pressure',
        timestamp: Date.now(),
        details: {
          level: status.pressureLevel,
          percentage: status.percentage * 100,
          used: status.used,
          limit: status.limit,
        },
      });
    }

    // Auto cleanup on high pressure
    if (status.percentage >= this.thresholds.high) {
      this.emitEvent({
        type: 'threshold',
        timestamp: Date.now(),
        details: {
          threshold: 'high',
          percentage: status.percentage * 100,
          triggeredCleanup: status.percentage >= this.thresholds.critical,
        },
      });

      // Trigger cleanup on critical
      if (status.percentage >= this.thresholds.critical) {
        this.triggerCleanup();
      }
    }

    // Emit warning on critical
    if (status.percentage >= this.thresholds.critical) {
      this.emitEvent({
        type: 'warning',
        timestamp: Date.now(),
        details: {
          message: 'Memory critical - cleanup triggered',
          percentage: status.percentage * 100,
          used: status.used,
          limit: status.limit,
        },
      });

      console.warn(
        `[MemoryManager] CRITICAL: Memory at ${(status.percentage * 100).toFixed(1)}% ` +
        `(${this.formatBytes(status.used)} / ${this.formatBytes(status.limit)})`
      );
    }
  }

  /**
   * Add cleanup callback
   */
  public addCleanupCallback(callback: () => void | Promise<void>): () => void {
    this.cleanupCallbacks.push(callback);
    return () => {
      const index = this.cleanupCallbacks.indexOf(callback);
      if (index !== -1) {
        this.cleanupCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Add event listener
   */
  public addEventListener(id: string, callback: (event: MemoryEvent) => void): void {
    this.listeners.set(id, callback);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(id: string): void {
    this.listeners.delete(id);
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: MemoryEvent): void {
    this.recentEvents.push(event);

    // Trim events
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }

    // Notify listeners
    for (const callback of Array.from(this.listeners.values())) {
      try {
        callback(event);
      } catch (error) {
        console.error('Memory event listener error:', error);
      }
    }
  }

  /**
   * Get recent events
   */
  public getRecentEvents(type?: MemoryEvent['type']): MemoryEvent[] {
    if (type) {
      return this.recentEvents.filter((e) => e.type === type);
    }
    return [...this.recentEvents];
  }

  /**
   * Estimate memory usage (fallback)
   */
  private estimateMemoryUsage(): number {
    // Rough estimate based on performance metrics
    if ('memory' in performance) {
      return (performance as Performance & { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize;
    }
    return 50 * 1024 * 1024; // 50MB default estimate
  }

  /**
   * Get estimated memory limit (fallback)
   */
  private getEstimatedLimit(): number {
    if ('memory' in performance) {
      return (performance as Performance & { memory: { jsHeapSizeLimit: number } }).memory.jsHeapSizeLimit;
    }

    // Estimate based on device
    const isLowEndDevice = this.isLowEndDevice();
    return isLowEndDevice ? 100 * 1024 * 1024 : 500 * 1024 * 1024;
  }

  /**
   * Check if device is low-end
   */
  private isLowEndDevice(): boolean {
    if (typeof navigator === 'undefined') return false;

    // Check device memory if available
    const nav = navigator as Navigator & { deviceMemory?: number };
    if (nav.deviceMemory && nav.deviceMemory < 4) {
      return true;
    }

    // Check hardware concurrency
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) {
      return true;
    }

    return false;
  }

  /**
   * Format bytes to human readable
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get memory info for debugging
   */
  public getInfo(): {
    status: MemoryStatus;
    thresholds: MemoryThresholds;
    isMonitoring: boolean;
    cleanupCallbackCount: number;
    eventListenerCount: number;
    recentEventCount: number;
  } {
    return {
      status: this.getMemoryUsage(),
      thresholds: { ...this.thresholds },
      isMonitoring: this.isMonitoring,
      cleanupCallbackCount: this.cleanupCallbacks.length,
      eventListenerCount: this.listeners.size,
      recentEventCount: this.recentEvents.length,
    };
  }

  /**
   * Update thresholds
   */
  public setThresholds(thresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Force immediate check and cleanup
   */
  public forceCheckAndCleanup(): Promise<void> {
    return this.triggerCleanup();
  }
}

// Export singleton instance
export const memoryManager = MemoryManagerService.getInstance();

// Export class
export { MemoryManagerService };

// Default export
export default memoryManager;
