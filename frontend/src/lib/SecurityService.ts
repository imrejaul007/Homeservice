/**
 * SecurityService.ts - Security orchestrator for NILIN app
 * Runs all security checks on app start, logs events, and blocks access if critical issues detected
 */

import { Capacitor } from '@capacitor/core';
import { rootDetector } from './RootDetector';
import { tamperDetector } from './TamperDetector';
import { secureStorage } from './SecureStorage';
import logger from './logger';
import type { RootDetectionResult } from './RootDetector';
import type { TamperDetectionResult, TamperCheck } from './TamperDetector';

export type SecurityEventType =
  | 'security_check_start'
  | 'security_check_complete'
  | 'security_check_failed'
  | 'root_detected'
  | 'tamper_detected'
  | 'security_blocked'
  | 'security_warning';

export interface SecurityEvent {
  type: SecurityEventType;
  timestamp: number;
  details?: Record<string, unknown>;
  severity: 'info' | 'warning' | 'critical';
}

export interface SecurityStatus {
  isSecure: boolean;
  isRooted: boolean;
  isTampered: boolean;
  rootRisks: string[];
  tamperIssues: string[];
  lastCheck: number;
  blocked: boolean;
  blockReason?: string;
}

export interface SecurityCheckOptions {
  runOnStart: boolean;
  blockOnCritical: boolean;
  blockOnRoot: boolean;
  blockOnTamper: boolean;
  cacheResults: boolean;
  logEvents: boolean;
}

const DEFAULT_OPTIONS: SecurityCheckOptions = {
  runOnStart: true,
  blockOnCritical: true,
  blockOnRoot: true,
  blockOnTamper: true,
  cacheResults: true,
  logEvents: true,
};

class SecurityService {
  private static instance: SecurityService;
  private isInitialized: boolean = false;
  private isCapacitor: boolean;
  private options: SecurityCheckOptions;
  private events: SecurityEvent[] = [];
  private status: SecurityStatus;
  private listeners: Map<string, (event: SecurityEvent) => void> = new Map();
  private maxEvents: number = 100;

  private constructor(options: Partial<SecurityCheckOptions> = {}) {
    this.isCapacitor = Capacitor.isNativePlatform();
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.status = {
      isSecure: true,
      isRooted: false,
      isTampered: false,
      rootRisks: [],
      tamperIssues: [],
      lastCheck: 0,
      blocked: false,
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(options?: Partial<SecurityCheckOptions>): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService(options);
    }
    return SecurityService.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  public static resetInstance(): void {
    if (SecurityService.instance) {
      SecurityService.instance = undefined as unknown as SecurityService;
    }
  }

  /**
   * Initialize security service
   */
  public async initialize(): Promise<SecurityStatus> {
    if (this.isInitialized) {
      return this.status;
    }

    const log = logger.child({ service: 'SecurityService' });

    log.info('Initializing security service...');

    this.logEvent({
      type: 'security_check_start',
      timestamp: Date.now(),
      details: {
        platform: this.isCapacitor ? 'native' : 'web',
        options: this.options,
      },
      severity: 'info',
    });

    try {
      const result = await this.runSecurityChecks();

      if (this.options.runOnStart) {
        await this.evaluateAndBlock(result);
      }

      this.isInitialized = true;
      log.info('Security service initialized', {
        isSecure: this.status.isSecure,
        isRooted: this.status.isRooted,
        isTampered: this.status.isTampered,
      });

      return this.status;
    } catch (error) {
      log.error('Failed to initialize security service', { error });

      this.logEvent({
        type: 'security_check_failed',
        timestamp: Date.now(),
        details: { error: String(error) },
        severity: 'critical',
      });

      throw error;
    }
  }

  /**
   * Run all security checks
   */
  public async runSecurityChecks(): Promise<{
    root: RootDetectionResult;
    tamper: TamperDetectionResult;
  }> {
    const log = logger.child({ service: 'SecurityService' });
    const startTime = Date.now();

    log.info('Running security checks...');

    try {
      // Run root detection
      const rootResult = await rootDetector.detect();

      // Run tamper detection
      const tamperResult = await tamperDetector.detect();

      // Calculate overall security status
      const isSecure =
        !rootResult.isRooted &&
        !tamperResult.isTampered &&
        tamperResult.criticalIssues.length === 0;

      // Update status
      this.status = {
        isSecure,
        isRooted: rootResult.isRooted,
        isTampered: tamperResult.isTampered,
        rootRisks: rootResult.risks,
        tamperIssues: tamperResult.criticalIssues,
        lastCheck: Date.now(),
        blocked: this.status.blocked,
        blockReason: this.status.blockReason,
      };

      // Log results
      const duration = Date.now() - startTime;

      if (rootResult.isRooted) {
        this.logEvent({
          type: 'root_detected',
          timestamp: Date.now(),
          details: {
            risks: rootResult.risks,
            checks: rootResult.checks,
            duration,
          },
          severity: 'warning',
        });

        log.warn('Root detected', { risks: rootResult.risks });
      }

      if (tamperResult.isTampered) {
        this.logEvent({
          type: 'tamper_detected',
          timestamp: Date.now(),
          details: {
            issues: tamperResult.criticalIssues,
            checks: tamperResult.checks,
            duration,
          },
          severity: 'critical',
        });

        log.error('Tampering detected', {
          issues: tamperResult.criticalIssues,
        });
      }

      this.logEvent({
        type: 'security_check_complete',
        timestamp: Date.now(),
        details: {
          isSecure,
          isRooted: rootResult.isRooted,
          isTampered: tamperResult.isTampered,
          duration,
        },
        severity: isSecure ? 'info' : 'warning',
      });

      log.info('Security checks completed', {
        isSecure,
        duration,
      });

      return { root: rootResult, tamper: tamperResult };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logEvent({
        type: 'security_check_failed',
        timestamp: Date.now(),
        details: { error: errorMessage },
        severity: 'critical',
      });

      log.error('Security checks failed', { error: errorMessage });

      throw error;
    }
  }

  /**
   * Evaluate results and block if necessary
   */
  private async evaluateAndBlock(results: {
    root: RootDetectionResult;
    tamper: TamperDetectionResult;
  }): Promise<void> {
    const log = logger.child({ service: 'SecurityService' });

    let shouldBlock = false;
    let blockReason = '';

    // Check for root
    if (results.root.isRooted && this.options.blockOnRoot) {
      shouldBlock = true;
      blockReason = `Root detected: ${results.root.risks.join(', ')}`;

      this.logEvent({
        type: 'security_blocked',
        timestamp: Date.now(),
        details: { reason: blockReason },
        severity: 'critical',
      });

      log.warn('Blocking access due to root detection', {
        risks: results.root.risks,
      });
    }

    // Check for tampering
    if (results.tamper.isTampered && this.options.blockOnTamper) {
      shouldBlock = true;
      blockReason = `Tampering detected: ${results.tamper.criticalIssues.join(', ')}`;

      this.logEvent({
        type: 'security_blocked',
        timestamp: Date.now(),
        details: { reason: blockReason },
        severity: 'critical',
      });

      log.error('Blocking access due to tampering detection', {
        issues: results.tamper.criticalIssues,
      });
    }

    // Check for critical issues
    if (results.tamper.criticalIssues.length > 0 && this.options.blockOnCritical) {
      // Allow blocking even without explicit tampering
      // This is for other critical security issues
      const criticalUnrelatedToTamper = results.tamper.criticalIssues.every(
        (issue) =>
          !issue.toLowerCase().includes('tamper') &&
          !issue.toLowerCase().includes('root')
      );

      if (criticalUnrelatedToTamper) {
        shouldBlock = true;
        blockReason = `Critical security issues: ${results.tamper.criticalIssues.join(', ')}`;

        this.logEvent({
          type: 'security_blocked',
          timestamp: Date.now(),
          details: { reason: blockReason },
          severity: 'critical',
        });
      }
    }

    if (shouldBlock) {
      this.status.blocked = true;
      this.status.blockReason = blockReason;
      this.status.isSecure = false;

      // Store block event
      await this.storeSecurityEvent('blocked', blockReason);

      // In production, you might want to:
      // 1. Show a blocking screen
      // 2. Disable app functionality
      // 3. Report to backend
      if (import.meta.env.PROD) {
        this.notifyBackend();
      }
    }
  }

  /**
   * Get current security status
   */
  public getSecurityStatus(): SecurityStatus {
    return { ...this.status };
  }

  /**
   * Check if access is blocked
   */
  public isBlocked(): boolean {
    return this.status.blocked;
  }

  /**
   * Get block reason
   */
  public getBlockReason(): string | undefined {
    return this.status.blockReason;
  }

  /**
   * Check if device is secure
   */
  public isSecure(): boolean {
    return this.status.isSecure && !this.status.blocked;
  }

  /**
   * Get security events
   */
  public getEvents(): SecurityEvent[] {
    return [...this.events];
  }

  /**
   * Get events by type
   */
  public getEventsByType(type: SecurityEventType): SecurityEvent[] {
    return this.events.filter((event) => event.type === type);
  }

  /**
   * Get critical events
   */
  public getCriticalEvents(): SecurityEvent[] {
    return this.events.filter((event) => event.severity === 'critical');
  }

  /**
   * Log a security event
   */
  private logEvent(event: SecurityEvent): void {
    // Add to events array
    this.events.push(event);

    // Trim events if too many
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Notify listeners
    this.notifyListeners(event);

    // Log to console in development
    if (this.options.logEvents) {
      const log = logger.child({ service: 'SecurityService' });

      switch (event.severity) {
        case 'critical':
          log.error(`Security Event: ${event.type}`, event.details);
          break;
        case 'warning':
          log.warn(`Security Event: ${event.type}`, event.details);
          break;
        default:
          log.debug(`Security Event: ${event.type}`, event.details);
      }
    }
  }

  /**
   * Add event listener
   */
  public addEventListener(
    id: string,
    callback: (event: SecurityEvent) => void
  ): void {
    this.listeners.set(id, callback);
  }

  /**
   * Remove event listener
   */
  public removeEventListener(id: string): void {
    this.listeners.delete(id);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(event: SecurityEvent): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in security event listener:', error);
      }
    });
  }

  /**
   * Store security event for backend sync
   */
  private async storeSecurityEvent(type: string, details: string): Promise<void> {
    try {
      const event = {
        type,
        details,
        timestamp: Date.now(),
        platform: this.isCapacitor ? 'android' : 'web',
      };

      await secureStorage.setObject(`security_event_${Date.now()}`, event);
    } catch {
      // Ignore storage errors
    }
  }

  /**
   * Notify backend of security issues
   */
  private notifyBackend(): void {
    // In production, this would send a report to your backend
    // For now, we just log it
    const log = logger.child({ service: 'SecurityService' });

    log.info('Security violation report', {
      status: this.status,
      timestamp: Date.now(),
    });

    // Example: Send to backend
    // if (this.isCapacitor) {
    //   fetch('https://api.nilin.app/security/report', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       status: this.status,
    //       timestamp: Date.now(),
    //     }),
    //   }).catch(() => {
    //     // Ignore network errors
    //   });
    // }
  }

  /**
   * Get detailed root detection result
   */
  public async getRootDetectionResult(): Promise<RootDetectionResult> {
    return rootDetector.detect();
  }

  /**
   * Get detailed tamper detection result
   */
  public async getTamperDetectionResult(): Promise<TamperDetectionResult> {
    return tamperDetector.detect();
  }

  /**
   * Clear cached results
   */
  public clearCache(): void {
    rootDetector.clearCache();
    tamperDetector.clearCache();
    this.status.lastCheck = 0;
  }

  /**
   * Get summary for debugging
   */
  public getSummary(): {
    initialized: boolean;
    status: SecurityStatus;
    eventCount: number;
    criticalEventCount: number;
    listenerCount: number;
  } {
    return {
      initialized: this.isInitialized,
      status: this.status,
      eventCount: this.events.length,
      criticalEventCount: this.getCriticalEvents().length,
      listenerCount: this.listeners.size,
    };
  }

  /**
   * Force re-check security status
   */
  public async recheck(): Promise<SecurityStatus> {
    this.clearCache();
    await this.runSecurityChecks();
    return this.status;
  }
}

// Export singleton instance
export const securityService = SecurityService.getInstance();

// Export class
export { SecurityService };

// Default export
export default securityService;
