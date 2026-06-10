/**
 * AI Audit Logger - Structured audit logging for NILIN AI Chat
 *
 * Provides audit trail for AI interactions with correlation IDs,
 * user context, and action tracking for compliance and debugging.
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { getCorrelationId } from '../utils/logger';

// ============================================================
// TYPES
// ============================================================

export enum AuditAction {
  // Message actions
  MESSAGE_SENT = 'MESSAGE_SENT',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  MESSAGE_FAILED = 'MESSAGE_FAILED',

  // Conversation actions
  CONVERSATION_STARTED = 'CONVERSATION_STARTED',
  CONVERSATION_ENDED = 'CONVERSATION_ENDED',
  CONVERSATION_ABANDONED = 'CONVERSATION_ABANDONED',

  // AI actions
  AI_RESPONSE_GENERATED = 'AI_RESPONSE_GENERATED',
  AI_FALLBACK_USED = 'AI_FALLBACK_USED',
  AI_ERROR = 'AI_ERROR',
  AI_TIMEOUT = 'AI_TIMEOUT',
  AI_CIRCUIT_BREAKER_OPEN = 'AI_CIRCUIT_BREAKER_OPEN',

  // Escalation actions
  ESCALATION_REQUESTED = 'ESCALATION_REQUESTED',
  ESCALATION_COMPLETED = 'ESCALATION_COMPLETED',

  // Security actions
  IDOR_ATTEMPT = 'IDOR_ATTEMPT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',

  // System actions
  AGENT_SWITCHED = 'AGENT_SWITCHED',
  CONTEXT_UPDATED = 'CONTEXT_UPDATED',
}

export enum AuditSeverity {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface AuditLogEntry {
  timestamp: string;
  correlationId: string;
  userId?: string;
  conversationId?: string;
  action: AuditAction;
  severity: AuditSeverity;
  provider?: string;
  model?: string;
  latencyMs?: number;
  status: 'success' | 'failure' | 'pending';
  metadata?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  duration?: number;
}

// ============================================================
// AUDIT LOGGER SETUP
// ============================================================

// Create audit logs directory
const auditLogsDir = path.join(process.cwd(), 'logs', 'audit');
if (!fs.existsSync(auditLogsDir)) {
  fs.mkdirSync(auditLogsDir, { recursive: true });
}

// Create daily rotating file transport
const createDailyFileTransport = () => {
  const today = new Date().toISOString().split('T')[0];
  return new winston.transports.File({
    filename: path.join(auditLogsDir, `audit-${today}.log`),
    maxsize: 52428800, // 50MB per file
    maxFiles: 30, // Keep 30 days of logs
    tailable: true,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  });
};

// Create size-based rotating file transport for larger logs
const createSizeBasedTransport = () => {
  return new winston.transports.File({
    filename: path.join(auditLogsDir, 'audit.log'),
    maxsize: 104857600, // 100MB max file size
    maxFiles: 10,
    tailable: true,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
  });
};

// Create audit logger
const auditLogger = winston.createLogger({
  level: 'info',
  defaultMeta: { service: 'home-service-api', category: 'ai-audit' },
  transports: [
    createDailyFileTransport(),
    createSizeBasedTransport(),
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          const correlationId = getCorrelationId();
          return `${timestamp} [${level.toUpperCase()}] [AUDIT] [${correlationId}] ${message} ${Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''}`;
        })
      ),
    }),
  ],
});

// ============================================================
// AUDIT LOG FUNCTIONS
// ============================================================

/**
 * Log an AI chat interaction
 */
export function logAIInteraction(params: {
  action: AuditAction;
  userId?: string;
  conversationId?: string;
  message?: string;
  response?: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  status: 'success' | 'failure' | 'pending';
  metadata?: Record<string, unknown>;
  error?: Error;
}): void {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    correlationId: getCorrelationId(),
    userId: params.userId,
    conversationId: params.conversationId,
    action: params.action,
    severity: mapActionToSeverity(params.action),
    provider: params.provider,
    model: params.model,
    latencyMs: params.latencyMs,
    status: params.status,
    metadata: {
      messageLength: params.message?.length,
      responseLength: params.response?.length,
      ...params.metadata,
    },
    error: params.error ? {
      message: params.error.message,
      stack: params.error.stack,
    } : undefined,
  };

  const logMessage = buildAuditMessage(params.action, params);
  auditLogger.log(entry.severity, logMessage, entry);
}

/**
 * Log conversation events
 */
export function logConversationEvent(params: {
  action: AuditAction.CONVERSATION_STARTED | AuditAction.CONVERSATION_ENDED | AuditAction.CONVERSATION_ABANDONED;
  userId: string;
  conversationId: string;
  metadata?: Record<string, unknown>;
}): void {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    correlationId: getCorrelationId(),
    userId: params.userId,
    conversationId: params.conversationId,
    action: params.action,
    severity: AuditSeverity.INFO,
    status: 'success',
    metadata: params.metadata,
  };

  auditLogger.info(
    `Conversation ${params.action.replace('CONVERSATION_', '').toLowerCase()}: ${params.conversationId}`,
    entry
  );
}

/**
 * Log escalation events
 */
export function logEscalation(params: {
  userId: string;
  conversationId: string;
  reason: string;
  category?: string;
  metadata?: Record<string, unknown>;
}): void {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    correlationId: getCorrelationId(),
    userId: params.userId,
    conversationId: params.conversationId,
    action: AuditAction.ESCALATION_REQUESTED,
    severity: AuditSeverity.WARN,
    status: 'success',
    metadata: {
      reason: params.reason,
      category: params.category,
      ...params.metadata,
    },
  };

  auditLogger.warn(`Escalation requested: ${params.reason}`, entry);
}

/**
 * Log security events
 */
export function logSecurityEvent(params: {
  action: AuditAction.IDOR_ATTEMPT | AuditAction.RATE_LIMIT_EXCEEDED | AuditAction.UNAUTHORIZED_ACCESS;
  userId?: string;
  conversationId?: string;
  details: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}): void {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    correlationId: getCorrelationId(),
    userId: params.userId,
    conversationId: params.conversationId,
    action: params.action,
    severity: AuditSeverity.ERROR,
    status: 'failure',
    metadata: {
      ...params.details,
      ip: params.ip,
      userAgent: params.userAgent,
    },
  };

  auditLogger.error(`Security event: ${params.action}`, entry);
}

/**
 * Log AI errors with full context
 */
export function logAIError(params: {
  userId?: string;
  conversationId?: string;
  error: Error;
  provider?: string;
  context?: Record<string, unknown>;
}): void {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    correlationId: getCorrelationId(),
    userId: params.userId,
    conversationId: params.conversationId,
    action: AuditAction.AI_ERROR,
    severity: AuditSeverity.ERROR,
    provider: params.provider,
    status: 'failure',
    metadata: params.context,
    error: {
      message: params.error.message,
      stack: params.error.stack,
    },
  };

  auditLogger.error(`AI Error: ${params.error.message}`, entry);
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function mapActionToSeverity(action: AuditAction): AuditSeverity {
  switch (action) {
    case AuditAction.AI_ERROR:
    case AuditAction.AI_CIRCUIT_BREAKER_OPEN:
    case AuditAction.UNAUTHORIZED_ACCESS:
    case AuditAction.IDOR_ATTEMPT:
      return AuditSeverity.ERROR;
    case AuditAction.ESCALATION_REQUESTED:
    case AuditAction.RATE_LIMIT_EXCEEDED:
      return AuditSeverity.WARN;
    case AuditAction.AI_FALLBACK_USED:
    case AuditAction.AI_TIMEOUT:
      return AuditSeverity.WARN;
    default:
      return AuditSeverity.INFO;
  }
}

function buildAuditMessage(action: AuditAction, params: {
  userId?: string;
  conversationId?: string;
  message?: string;
  response?: string;
  provider?: string;
  latencyMs?: number;
}): string {
  const parts: string[] = [action];

  if (params.userId) {
    parts.push(`user=${params.userId}`);
  }
  if (params.conversationId) {
    parts.push(`conv=${params.conversationId}`);
  }
  if (params.provider) {
    parts.push(`provider=${params.provider}`);
  }
  if (params.latencyMs !== undefined) {
    parts.push(`latency=${params.latencyMs}ms`);
  }

  return parts.join(' | ');
}

// ============================================================
// EXPORT
// ============================================================

export const aiAuditLogger = auditLogger;

export default {
  AuditAction,
  AuditSeverity,
  logAIInteraction,
  logConversationEvent,
  logEscalation,
  logSecurityEvent,
  logAIError,
  aiAuditLogger,
};
