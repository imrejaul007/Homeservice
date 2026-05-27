import { Request, Response, NextFunction } from 'express';
import { ApiError, ERROR_CODES } from '../utils/ApiError';
import logger from '../utils/logger';

interface ThreatEvent {
  type: string;
  userId?: string;
  ip?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  timestamp: Date;
}

// Threat signatures for request scanning
interface ThreatSignature {
  pattern: RegExp;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const THREAT_SIGNATURES: ThreatSignature[] = [
  // SQL Injection patterns
  { pattern: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b.*){2,}/i, type: 'SQL_INJECTION', severity: 'high' },
  { pattern: /('|(\\')|(--)|(\|\|)|(\&\&))/, type: 'SQL_INJECTION', severity: 'medium' },

  // NoSQL Injection patterns
  { pattern: /\$where|\$ne|\$gt|\$lt|\$regex|\$exists/i, type: 'NOSQL_INJECTION', severity: 'high' },
  { pattern: /\btrue\b.*\btrue\b/, type: 'NOSQL_INJECTION', severity: 'medium' },

  // XSS patterns
  { pattern: /<script|javascript:|onerror|onload|onclick/i, type: 'XSS', severity: 'high' },
  { pattern: /<iframe|<object|<embed/i, type: 'XSS', severity: 'medium' },

  // Command injection patterns
  { pattern: /[;&|`$](\s)*(cat|ls|dir|rm|wget|curl|nc|bash|sh)/i, type: 'COMMAND_INJECTION', severity: 'critical' },
  { pattern: /(\||;|&|\$\(|\\x)/, type: 'COMMAND_INJECTION', severity: 'high' },

  // Path traversal
  { pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.\%2f)/i, type: 'PATH_TRAVERSAL', severity: 'high' },

  // Log4j patterns (CVE-2021-44228)
  { pattern: /\$\{jndi:ldap|jndi:rmi|jndi:dns/i, type: 'LOG4J', severity: 'critical' },

  // Prototype pollution
  { pattern: /__proto__|constructor|prototype/, type: 'PROTOTYPE_POLLUTION', severity: 'high' },
];

interface ThreatRule {
  name: string;
  check: (event: ThreatEvent) => boolean;
  action: 'log' | 'alert' | 'block';
}

const THREAT_RULES: ThreatRule[] = [
  {
    name: 'rapid_auth_failures',
    check: (e) => e.type === 'auth_failure' && e.details.attempts >= 5,
    action: 'block',
  },
  {
    name: 'credential_stuffing',
    check: (e) =>
      e.type === 'auth_failure' && e.severity === 'high',
    action: 'alert',
  },
  {
    name: 'suspicious_location',
    check: (e) => e.type === 'location_anomaly',
    action: 'alert',
  },
  {
    name: 'api_abuse',
    check: (e) => e.type === 'rate_limit_exceeded',
    action: 'block',
  },
];

class ThreatDetection {
  private recentEvents = new Map<string, ThreatEvent[]>();
  private readonly RETENTION_MS = 60 * 60 * 1000; // 1 hour

  async analyze(event: ThreatEvent): Promise<void> {
    // Store event
    this.storeEvent(event);

    // Check rules
    for (const rule of THREAT_RULES) {
      if (rule.check(event)) {
        await this.executeAction(rule, event);
      }
    }
  }

  private storeEvent(event: ThreatEvent): void {
    const key = event.userId || event.ip || 'anonymous';
    const events = this.recentEvents.get(key) || [];

    events.push(event);

    // Clean old events
    const cutoff = Date.now() - this.RETENTION_MS;
    const recent = events.filter((e) => e.timestamp.getTime() > cutoff);

    this.recentEvents.set(key, recent);
  }

  private async executeAction(rule: ThreatRule, event: ThreatEvent): Promise<void> {
    const action = rule.action;

    if (action === 'log') {
      logger.warn('Threat detected', {
        rule: rule.name,
        event,
      });
    } else if (action === 'alert') {
      logger.error('SECURITY ALERT', {
        rule: rule.name,
        event,
      });
      // TODO: Send to PagerDuty / Slack
    } else if (action === 'block') {
      logger.error('SECURITY BLOCK', {
        rule: rule.name,
        event,
      });
      // Block will be handled by middleware
      throw ApiError.forbidden(`Threat detected: ${rule.name}`, ERROR_CODES.ACCESS_DENIED);
    }
  }

  getRecentEvents(userId: string): ThreatEvent[] {
    return this.recentEvents.get(userId) || [];
  }
}

export const threatDetection = new ThreatDetection();

/**
 * Detect threats in request parameters (for middleware use)
 */
const detectRequestThreats = (req: Request): { detected: boolean; type?: string; severity?: string } => {
  const searchStrings = [
    req.path,
    req.url,
    JSON.stringify(req.query),
    JSON.stringify(req.params),
    JSON.stringify(req.body),
  ];

  for (const str of searchStrings) {
    if (!str) continue;

    for (const signature of THREAT_SIGNATURES) {
      if (signature.pattern.test(str)) {
        return {
          detected: true,
          type: signature.type,
          severity: signature.severity,
        };
      }
    }
  }

  return { detected: false };
};

/**
 * Threat detection middleware
 * This is a function export that can be used in Express middleware chains
 */
export const threatDetectionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const result = detectRequestThreats(req);

  if (result.detected) {
    logger.warn('Threat detected in request', {
      type: result.type,
      severity: result.severity,
      ip: req.ip,
      path: req.path,
      method: req.method,
      action: 'THREAT_DETECTED',
    });

    // Block critical and high severity threats
    if (result.severity === 'critical' || result.severity === 'high') {
      res.status(403).json({
        error: 'Request blocked due to security policy',
        code: 'SECURITY_BLOCK',
      });
      return;
    }

    // Medium and low: warn but continue
    res.setHeader('X-Security-Warning', result.type || 'unknown');
  }

  next();
};
