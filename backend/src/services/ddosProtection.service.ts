import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';

// ============================================
// Type Definitions
// ============================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface IPBlock {
  ip: string;
  reason: string;
  blockedAt: Date;
  expiresAt?: Date;
  blockedBy: 'manual' | 'automatic' | 'geo';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RequestRecord {
  ip: string;
  path: string;
  method: string;
  userAgent: string;
  timestamp: Date;
  responseTime?: number;
  statusCode?: number;
}

export interface ThreatPattern {
  id: string;
  pattern: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  action: 'log' | 'warn' | 'block';
}

export interface GeoBlockingConfig {
  enabled: boolean;
  allowedCountries: string[];
  blockedCountries: string[];
}

export interface DDoSProtectionConfig {
  enabled: boolean;
  rateLimit: {
    global: RateLimitConfig;
    auth: RateLimitConfig;
    api: RateLimitConfig;
    upload: RateLimitConfig;
  };
  ipBlocking: {
    enabled: boolean;
    autoBlockThreshold: number;
    blockDuration: number;
    maxBlocksPerIP: number;
  };
  geoBlocking: GeoBlockingConfig;
  threatPatterns: ThreatPattern[];
  headersValidation: {
    checkUserAgent: boolean;
    checkReferer: boolean;
    requiredHeaders: string[];
    blockedHeaders: string[];
  };
  requestLimits: {
    maxBodySize: number;
    maxHeaderSize: number;
    maxUrlLength: number;
    maxQueryParams: number;
  };
}

// ============================================
// In-Memory Stores (use Redis in production)
// ============================================

class RateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  get(key: string): { count: number; resetTime: number } | undefined {
    const record = this.store.get(key);
    if (!record) return undefined;

    // Check if expired
    if (Date.now() > record.resetTime) {
      this.store.delete(key);
      return undefined;
    }

    return record;
  }

  set(key: string, count: number, windowMs: number): void {
    this.store.set(key, {
      count,
      resetTime: Date.now() + windowMs,
    });
  }

  increment(key: string, windowMs: number): number {
    const record = this.get(key);
    if (!record) {
      this.set(key, 1, windowMs);
      return 1;
    }

    record.count++;
    return record.count;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

class IPBlockStore {
  private blockedIPs: Map<string, IPBlock> = new Map();
  private requestCounts: Map<string, number[]> = new Map();
  private autoBlockTimers: Map<string, NodeJS.Timeout> = new Map();

  add(block: IPBlock): void {
    this.blockedIPs.set(block.ip, block);

    // Set up auto-unblock if expiresAt is specified
    if (block.expiresAt) {
      const timeout = block.expiresAt.getTime() - Date.now();
      if (timeout > 0) {
        const timer = setTimeout(() => this.unblock(block.ip), timeout);
        this.autoBlockTimers.set(block.ip, timer);
      }
    }
  }

  isBlocked(ip: string): boolean {
    const block = this.blockedIPs.get(ip);
    if (!block) return false;

    // Check if block has expired
    if (block.expiresAt && block.expiresAt < new Date()) {
      this.unblock(ip);
      return false;
    }

    return true;
  }

  getBlock(ip: string): IPBlock | undefined {
    return this.blockedIPs.get(ip);
  }

  unblock(ip: string): void {
    this.blockedIPs.delete(ip);
    const timer = this.autoBlockTimers.get(ip);
    if (timer) {
      clearTimeout(timer);
      this.autoBlockTimers.delete(ip);
    }
  }

  getAll(): IPBlock[] {
    return Array.from(this.blockedIPs.values());
  }

  recordRequest(ip: string): void {
    const now = Date.now();
    const records = this.requestCounts.get(ip) || [];
    // Keep only requests from the last minute
    const recentRecords = records.filter((t) => now - t < 60000);
    recentRecords.push(now);
    this.requestCounts.set(ip, recentRecords);
  }

  getRequestCount(ip: string): number {
    const records = this.requestCounts.get(ip);
    if (!records) return 0;

    const now = Date.now();
    return records.filter((t) => now - t < 60000).length;
  }

  clear(): void {
    for (const timer of this.autoBlockTimers.values()) {
      clearTimeout(timer);
    }
    this.autoBlockTimers.clear();
    this.blockedIPs.clear();
    this.requestCounts.clear();
  }
}

// ============================================
// Global Stores
// ============================================

const rateLimitStore = new RateLimitStore();
const ipBlockStore = new IPBlockStore();

// ============================================
// Threat Detection Patterns
// ============================================

const DEFAULT_THREAT_PATTERNS: ThreatPattern[] = [
  {
    id: 'sql_injection',
    pattern: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION)\b|--|\/\*|\*\/|;|'|"|\\)/i,
    severity: 'critical',
    description: 'SQL Injection attempt detected',
    action: 'block',
  },
  {
    id: 'xss',
    pattern: /<script|javascript:|on\w+\s*=|data:text\/html/i,
    severity: 'high',
    description: 'Cross-Site Scripting (XSS) attempt detected',
    action: 'block',
  },
  {
    id: 'path_traversal',
    pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|%2e%2e%5c)/i,
    severity: 'critical',
    description: 'Path traversal attempt detected',
    action: 'block',
  },
  {
    id: 'command_injection',
    pattern: /[;&|`$]/,
    severity: 'high',
    description: 'Command injection pattern detected',
    action: 'warn',
  },
  {
    id: 'rapid_requests',
    pattern: /./,
    severity: 'low',
    description: 'High frequency requests detected',
    action: 'log',
  },
];

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: DDoSProtectionConfig = {
  enabled: true,
  rateLimit: {
    global: { windowMs: 60000, maxRequests: 100, keyPrefix: 'global' },
    auth: { windowMs: 60000, maxRequests: 5, keyPrefix: 'auth' },
    api: { windowMs: 60000, maxRequests: 60, keyPrefix: 'api' },
    upload: { windowMs: 3600000, maxRequests: 10, keyPrefix: 'upload' },
  },
  ipBlocking: {
    enabled: true,
    autoBlockThreshold: 500,
    blockDuration: 3600000, // 1 hour
    maxBlocksPerIP: 3,
  },
  geoBlocking: {
    enabled: false,
    allowedCountries: [],
    blockedCountries: [],
  },
  threatPatterns: DEFAULT_THREAT_PATTERNS,
  headersValidation: {
    checkUserAgent: true,
    checkReferer: false,
    requiredHeaders: [],
    blockedHeaders: ['x-originating-ip', 'x-forwarded-for'],
  },
  requestLimits: {
    maxBodySize: 10 * 1024 * 1024, // 10MB
    maxHeaderSize: 8 * 1024, // 8KB
    maxUrlLength: 2048,
    maxQueryParams: 50,
  },
};

// ============================================
// DDoS Protection Service Class
// ============================================

export class DDoSProtectionService {
  private config: DDoSProtectionConfig;
  private requestLog: RequestRecord[] = [];
  private maxLogSize: number = 10000;

  constructor(config: Partial<DDoSProtectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ========================================
  // Configuration
  // ========================================

  getConfig(): DDoSProtectionConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<DDoSProtectionConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('DDoS protection config updated', { updates });
  }

  // ========================================
  // IP Blocking
  // ========================================

  /**
   * Manually block an IP address
   */
  blockIP(
    ip: string,
    reason: string,
    duration?: number,
    blockedBy: IPBlock['blockedBy'] = 'manual'
  ): void {
    const block: IPBlock = {
      ip,
      reason,
      blockedAt: new Date(),
      blockedBy,
      severity: 'medium',
      expiresAt: duration ? new Date(Date.now() + duration) : undefined,
    };

    ipBlockStore.add(block);

    logger.warn('IP blocked', { ip, reason, duration, blockedBy });

    // Also apply rate limit penalty
    rateLimitStore.set(`blocked:${ip}`, 999999, duration || 3600000);
  }

  /**
   * Unblock an IP address
   */
  unblockIP(ip: string): void {
    ipBlockStore.unblock(ip);
    logger.info('IP unblocked', { ip });
  }

  /**
   * Get all blocked IPs
   */
  getBlockedIPs(): IPBlock[] {
    return ipBlockStore.getAll();
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ip: string): boolean {
    return ipBlockStore.isBlocked(ip);
  }

  // ========================================
  // Rate Limiting
  // ========================================

  /**
   * Check rate limit for an IP
   */
  checkRateLimit(
    ip: string,
    config: RateLimitConfig,
    identifier?: string
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const key = `${config.keyPrefix || 'default'}:${identifier || ip}`;
    const now = Date.now();

    // Check if blocked
    if (ipBlockStore.isBlocked(ip)) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + 3600000,
      };
    }

    const record = rateLimitStore.get(key);
    const resetTime = record?.resetTime || now + config.windowMs;

    if (!record) {
      rateLimitStore.set(key, 1, config.windowMs);
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime,
      };
    }

    if (record.count >= config.maxRequests) {
      // Record this as a rate limit hit for auto-blocking
      this.recordRateLimitHit(ip);

      return {
        allowed: false,
        remaining: 0,
        resetTime,
      };
    }

    const newCount = rateLimitStore.increment(key, config.windowMs);

    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - newCount),
      resetTime,
    };
  }

  /**
   * Record a rate limit hit for auto-blocking decisions
   */
  private recordRateLimitHit(ip: string): void {
    ipBlockStore.recordRequest(ip);

    // Check if auto-block threshold is reached
    const requestCount = ipBlockStore.getRequestCount(ip);
    if (
      this.config.ipBlocking.enabled &&
      requestCount >= this.config.ipBlocking.autoBlockThreshold
    ) {
      const existingBlock = ipBlockStore.getBlock(ip);
      const blockCount = existingBlock ? 1 : 0;

      if (blockCount < this.config.ipBlocking.maxBlocksPerIP) {
        this.blockIP(
          ip,
          'Automatic block: excessive rate limit violations',
          this.config.ipBlocking.blockDuration,
          'automatic'
        );
      }
    }
  }

  // ========================================
  // Request Validation
  // ========================================

  /**
   * Validate incoming request
   */
  validateRequest(req: Request): { valid: boolean; error?: string; threat?: ThreatPattern } {
    const ip = this.getClientIP(req);

    // Check if IP is blocked
    if (ipBlockStore.isBlocked(ip)) {
      const block = ipBlockStore.getBlock(ip);
      return {
        valid: false,
        error: `Access denied: ${block?.reason || 'IP blocked'}`,
      };
    }

    // Check URL length
    if (req.url.length > this.config.requestLimits.maxUrlLength) {
      return {
        valid: false,
        error: 'URL too long',
      };
    }

    // Check query params count
    const queryParamCount = Object.keys(req.query).length;
    if (queryParamCount > this.config.requestLimits.maxQueryParams) {
      return {
        valid: false,
        error: 'Too many query parameters',
      };
    }

    // Check headers
    const headerValidation = this.validateHeaders(req);
    if (!headerValidation.valid) {
      return headerValidation;
    }

    // Check for threat patterns
    const threatDetection = this.detectThreats(req);
    if (!threatDetection.valid) {
      return threatDetection;
    }

    return { valid: true };
  }

  /**
   * Validate request headers
   */
  private validateHeaders(req: Request): { valid: boolean; error?: string } {
    const { headersValidation } = this.config;

    // Check required headers
    if (headersValidation.requiredHeaders.length > 0) {
      for (const header of headersValidation.requiredHeaders) {
        if (!req.headers[header.toLowerCase()]) {
          return {
            valid: false,
            error: `Missing required header: ${header}`,
          };
        }
      }
    }

    // Check blocked headers
    if (headersValidation.blockedHeaders.length > 0) {
      for (const header of headersValidation.blockedHeaders) {
        if (req.headers[header.toLowerCase()]) {
          return {
            valid: false,
            error: `Blocked header detected: ${header}`,
          };
        }
      }
    }

    // Check User-Agent
    if (headersValidation.checkUserAgent && !req.headers['user-agent']) {
      // Some APIs may not require user-agent, so we just warn
      logger.warn('Request without User-Agent', {
        ip: this.getClientIP(req),
        path: req.path,
      });
    }

    return { valid: true };
  }

  /**
   * Detect threats in request
   */
  private detectThreats(req: Request): { valid: boolean; error?: string; threat?: ThreatPattern } {
    const searchStrings = [
      req.url,
      req.path,
      JSON.stringify(req.query),
      req.body ? JSON.stringify(req.body) : '',
    ].filter(Boolean);

    for (const pattern of this.config.threatPatterns) {
      for (const searchStr of searchStrings) {
        if (pattern.pattern.test(searchStr)) {
          // Log the threat
          logger.warn('Threat detected', {
            patternId: pattern.id,
            severity: pattern.severity,
            description: pattern.description,
            ip: this.getClientIP(req),
            path: req.path,
          });

          // Take action based on pattern
          switch (pattern.action) {
            case 'block':
              return {
                valid: false,
                error: pattern.description,
                threat: pattern,
              };
            case 'warn':
              // Log warning but allow request
              break;
            case 'log':
              // Just log, allow request
              break;
          }
        }
      }
    }

    return { valid: true };
  }

  // ========================================
  // Client IP Detection
  // ========================================

  /**
   * Get the real client IP address
   */
  getClientIP(req: Request): string {
    // Check various headers for forwarded IPs
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      // Take the first IP in the chain
      const ips = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor.split(',')[0];
      return ips.trim();
    }

    const realIP = req.headers['x-real-ip'];
    if (realIP) {
      return Array.isArray(realIP) ? realIP[0] : realIP;
    }

    // Fall back to connection remote address
    return req.ip || req.socket?.remoteAddress || 'unknown';
  }

  // ========================================
  // Request Logging
  // ========================================

  /**
   * Log a request for analytics
   */
  logRequest(req: Request, res: Response, responseTime?: number): void {
    const record: RequestRecord = {
      ip: this.getClientIP(req),
      path: req.path,
      method: req.method,
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: new Date(),
      responseTime,
      statusCode: res.statusCode,
    };

    this.requestLog.push(record);

    // Trim log if too large
    if (this.requestLog.length > this.maxLogSize) {
      this.requestLog = this.requestLog.slice(-this.maxLogSize);
    }

    // Also record in IP store for rate limiting
    ipBlockStore.recordRequest(record.ip);
  }

  /**
   * Get recent request logs
   */
  getRequestLogs(limit: number = 100): RequestRecord[] {
    return this.requestLog.slice(-limit);
  }

  /**
   * Get request statistics
   */
  getStatistics(): {
    totalRequests: number;
    requestsByIP: Record<string, number>;
    requestsByPath: Record<string, number>;
    blockedIPs: number;
    averageResponseTime: number;
  } {
    const requestsByIP: Record<string, number> = {};
    const requestsByPath: Record<string, number> = {};
    let totalResponseTime = 0;
    let responseCount = 0;

    for (const record of this.requestLog) {
      requestsByIP[record.ip] = (requestsByIP[record.ip] || 0) + 1;
      requestsByPath[record.path] = (requestsByPath[record.path] || 0) + 1;

      if (record.responseTime) {
        totalResponseTime += record.responseTime;
        responseCount++;
      }
    }

    return {
      totalRequests: this.requestLog.length,
      requestsByIP,
      requestsByPath,
      blockedIPs: ipBlockStore.getAll().length,
      averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
    };
  }

  // ========================================
  // Cleanup
  // ========================================

  /**
   * Clear all rate limits (for testing/admin)
   */
  clearRateLimits(): void {
    rateLimitStore.clear();
    logger.info('Rate limits cleared');
  }

  /**
   * Clear all blocks (for testing/admin)
   */
  clearBlocks(): void {
    ipBlockStore.clear();
    logger.info('IP blocks cleared');
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    rateLimitStore.destroy();
    ipBlockStore.clear();
    this.requestLog = [];
  }
}

// ============================================
// Express Middleware Factory
// ============================================

export function createDDoSMiddleware(service: DDoSProtectionService) {
  return {
    /**
     * Global rate limiting middleware
     */
    globalRateLimit: (config?: Partial<RateLimitConfig>) => {
      return (req: Request, res: Response, next: NextFunction) => {
        const effectiveConfig = {
          ...service.getConfig().rateLimit.global,
          ...config,
        };

        const ip = service.getClientIP(req);
        const result = service.checkRateLimit(ip, effectiveConfig);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', effectiveConfig.maxRequests);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

        if (!result.allowed) {
          logger.warn('Rate limit exceeded', { ip, path: req.path });
          throw new ApiError(
            429,
            'Too many requests, please try again later',
            [],
            ERROR_CODES.RATE_LIMIT_EXCEEDED
          );
        }

        next();
      };
    },

    /**
     * Auth-specific rate limiting middleware
     */
    authRateLimit: () => {
      return (req: Request, res: Response, next: NextFunction) => {
        const effectiveConfig = service.getConfig().rateLimit.auth;
        const ip = service.getClientIP(req);
        const key = `auth:${req.path}`;

        const result = service.checkRateLimit(ip, effectiveConfig, key);

        res.setHeader('X-RateLimit-Limit', effectiveConfig.maxRequests);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

        if (!result.allowed) {
          logger.warn('Auth rate limit exceeded', { ip, path: req.path });
          throw new ApiError(
            429,
            'Too many authentication attempts, please try again later',
            [],
            ERROR_CODES.RATE_LIMIT_EXCEEDED
          );
        }

        next();
      };
    },

    /**
     * API rate limiting middleware
     */
    apiRateLimit: (config?: Partial<RateLimitConfig>) => {
      return (req: Request, res: Response, next: NextFunction) => {
        const effectiveConfig = {
          ...service.getConfig().rateLimit.api,
          ...config,
        };

        const ip = service.getClientIP(req);
        const key = `api:${req.path}`;

        const result = service.checkRateLimit(ip, effectiveConfig, key);

        res.setHeader('X-RateLimit-Limit', effectiveConfig.maxRequests);
        res.setHeader('X-RateLimit-Remaining', result.remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

        if (!result.allowed) {
          throw new ApiError(
            429,
            'API rate limit exceeded',
            [],
            ERROR_CODES.RATE_LIMIT_EXCEEDED
          );
        }

        next();
      };
    },

    /**
     * Request validation middleware
     */
    validateRequest: () => {
      return (req: Request, res: Response, next: NextFunction) => {
        const validation = service.validateRequest(req);

        if (!validation.valid) {
          if (validation.threat) {
            logger.warn('Request blocked due to threat', {
              threatId: validation.threat.id,
              ip: service.getClientIP(req),
              path: req.path,
            });
          }

          throw new ApiError(403, validation.error || 'Request rejected', [], ERROR_CODES.FORBIDDEN);
        }

        next();
      };
    },

    /**
     * Response time tracking middleware
     */
    trackResponseTime: () => {
      return (req: Request, res: Response, next: NextFunction) => {
        const startTime = Date.now();

        res.on('finish', () => {
          const responseTime = Date.now() - startTime;
          service.logRequest(req, res, responseTime);
        });

        next();
      };
    },
  };
}

// Export singleton instance
export const ddosProtectionService = new DDoSProtectionService();

export default ddosProtectionService;
