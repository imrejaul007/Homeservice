import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';
import crypto from 'crypto';
import { ApiError } from '../utils/ApiError';
import logger from '../utils/logger';
import { sendPlatformEmail } from './platformEmailTemplate.service';
import { sendViaPlatformTransport } from './platformEmailTransport.service';
import { withCircuitBreaker, createCircuitBreaker } from './circuitBreaker.service';
import { withRetry, retryConfigs } from '../utils/retry.util';
import User from '../models/user.model';

// Email templates
interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

// ============================================
// XSS Sanitization for Email Templates
// ============================================

/**
 * Escape HTML special characters for safe email template interpolation.
 * Prevents XSS when user-provided data is rendered in HTML emails.
 */
const escapeHtml = (str: string | undefined | null): string => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Sanitize a value for use in plain text email content.
 * Strips all HTML tags to prevent any injection.
 */
const sanitizeForText = (str: string | undefined | null): string => {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]*>/g, '')
    .replace(/&/g, ' and ')
    .replace(/[<>]/g, '');
};

// ============================================
// SMTP Configuration (Nodemailer)
// ============================================

// Initialize SMTP transporter if SMTP credentials are provided
const createSmtpTransporter = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
};

const smtpTransporter = createSmtpTransporter();

// ============================================
// Resend Configuration (Backup)
// ============================================

// Initialize Resend client only if API key exists
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

// ============================================
// Common Configuration
// ============================================

const FROM_EMAIL = process.env.FROM_EMAIL || process.env.EMAIL_FROM || 'noreply@nilin.com';
const FROM_NAME = process.env.FROM_NAME || process.env.APP_NAME || 'NILIN';
// Fail-fast: require FRONTEND_URL in production
const FRONTEND_URL = process.env.FRONTEND_URL;
if (!FRONTEND_URL && process.env.NODE_ENV === 'production') {
  const error = new Error('FRONTEND_URL environment variable is required in production');
  logger.error('Email service configuration error:', error.message);
  throw error;
}
// Use empty string as fallback only in development (will log warning when used)
const FRONTEND_URL_FALLBACK = FRONTEND_URL || '';

// Email circuit breaker
const emailCircuitBreaker = createCircuitBreaker('email-service', {
  failureThreshold: 10,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
});

// Email queue for failed emails with improved retry logic
interface QueuedEmail {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attempt: number;
  maxAttempts: number;
  lastAttempt: Date;
  nextRetry: Date;
  error?: string;
  priority: 'high' | 'normal' | 'low';
  metadata?: {
    userId?: string;
    bookingId?: string;
    type: string;
  };
}

const failedEmailQueue: QueuedEmail[] = [];
const EMAIL_QUEUE_MAX_SIZE = 1000;
const EMAIL_RETRY_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MAX_EMAIL_ATTEMPTS = 5;
const RETRY_DELAYS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000, 30 * 60 * 1000, 60 * 60 * 1000];

// FIX: Priority queue helpers
function getNextRetryDelay(attempt: number): number {
  return RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
}

function shouldRetry(email: QueuedEmail): boolean {
  return email.attempt < email.maxAttempts && Date.now() >= email.nextRetry.getTime();
}

function sortQueue(): void {
  failedEmailQueue.sort((a, b) => {
    const priorityOrder = { high: 0, normal: 1, low: 2 };
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.nextRetry.getTime() - b.nextRetry.getTime();
  });
}

// FIX: Improved email queue with deduplication and priority
export const queueFailedEmail = async (
  email: Omit<QueuedEmail, 'attempt' | 'lastAttempt' | 'nextRetry' | 'maxAttempts' | 'priority'>
): Promise<{ queued: boolean; position?: number }> => {
  // Check for duplicate email in queue (prevent duplicate sends)
  const existingIndex = failedEmailQueue.findIndex(q => q.to === email.to && q.subject === email.subject);
  if (existingIndex !== -1) {
    const existing = failedEmailQueue[existingIndex];
    if (existing.attempt < existing.maxAttempts) {
      existing.lastAttempt = new Date();
      existing.nextRetry = new Date(Date.now() + getNextRetryDelay(existing.attempt));
      sortQueue();
      return { queued: true, position: existingIndex + 1 };
    }
  }

  if (failedEmailQueue.length >= EMAIL_QUEUE_MAX_SIZE) {
    // Remove oldest low-priority email to make room
    const lowPriorityIndex = failedEmailQueue.findIndex(e => e.priority === 'low');
    if (lowPriorityIndex !== -1) {
      logger.warn('Email queue full, removing oldest low-priority email', {
        to: failedEmailQueue[lowPriorityIndex].to
      });
      failedEmailQueue.splice(lowPriorityIndex, 1);
    } else {
      logger.error('Email queue full, cannot add email', { to: email.to });
      return { queued: false };
    }
  }

  const queuedEmail: QueuedEmail = {
    ...email,
    attempt: 0,
    maxAttempts: MAX_EMAIL_ATTEMPTS,
    lastAttempt: new Date(),
    nextRetry: new Date(Date.now() + getNextRetryDelay(0)),
    priority: email.metadata?.type === 'booking' ? 'high' : 'normal'
  };

  failedEmailQueue.push(queuedEmail);
  sortQueue();

  const position = failedEmailQueue.findIndex(q => q === queuedEmail) + 1;
  logger.info('Email queued for retry', {
    to: email.to,
    position,
    total: failedEmailQueue.length
  });

  return { queued: true, position };
};

// FIX: Improved queue processing with exponential backoff
const processEmailQueue = async (): Promise<{ processed: number; succeeded: number; failed: number }> => {
  const stats = { processed: 0, succeeded: 0, failed: 0 };
  const now = Date.now();

  // Get emails that are ready to retry
  const readyEmails = failedEmailQueue.filter(e => e.nextRetry.getTime() <= now);
  // Process up to 10 emails per cycle
  const batch = readyEmails.slice(0, 10);

  for (const email of batch) {
    stats.processed++;

    try {
      const result = await withRetry(
        () => sendEmailInternal(email.to, email.subject, email.html, email.text),
        retryConfigs.quick
      );

      if (result.success) {
        const index = failedEmailQueue.indexOf(email);
        if (index !== -1) failedEmailQueue.splice(index, 1);
        stats.succeeded++;
        logger.info('Queued email sent successfully', {
          to: email.to,
          attempts: email.attempt + 1
        });
      } else {
        email.attempt++;
        email.lastAttempt = new Date();
        email.nextRetry = new Date(Date.now() + getNextRetryDelay(email.attempt));
        email.error = result.error?.message;

        if (email.attempt >= email.maxAttempts) {
          const index = failedEmailQueue.indexOf(email);
          if (index !== -1) failedEmailQueue.splice(index, 1);
          stats.failed++;
          logger.error('Email permanently failed after max attempts', {
            to: email.to,
            lastError: email.error
          });
        }
      }
    } catch (error) {
      email.attempt++;
      email.lastAttempt = new Date();
      email.nextRetry = new Date(Date.now() + getNextRetryDelay(email.attempt));
      email.error = error instanceof Error ? error.message : 'Unknown error';

      if (email.attempt >= email.maxAttempts) {
        const index = failedEmailQueue.indexOf(email);
        if (index !== -1) failedEmailQueue.splice(index, 1);
        stats.failed++;
      }

      logger.error('Failed to process queued email', { to: email.to, error: email.error });
    }
  }

  return stats;
};

// Process queue every 5 minutes
setInterval(async () => {
  try {
    const stats = await processEmailQueue();
    if (stats.processed > 0) {
      logger.info('Email queue processed', stats);
    }
  } catch (error) {
    logger.error('Email queue processing error', { error });
  }
}, EMAIL_RETRY_INTERVAL);

// Export queue stats for monitoring
export const getEmailQueueStats = (): {
  size: number;
  emailsReadyToRetry: number;
} => ({
  size: failedEmailQueue.length,
  emailsReadyToRetry: failedEmailQueue.filter(e => e.nextRetry.getTime() <= Date.now()).length
});

// NILIN Brand Colors
const BRAND_COLORS = {
  primary: '#E11D48',      // Rose/Rose-600 (coral theme)
  primaryDark: '#BE123C',  // Rose-700
  primaryLight: '#FCE7F3', // Rose-100
  secondary: '#F97316',    // Orange-500
  text: '#1F2937',         // Gray-800
  textLight: '#6B7280',    // Gray-500
  background: '#FFF1F2',   // Rose-50
  white: '#FFFFFF',
  success: '#10B981',      // Emerald-500
  warning: '#F59E0B',      // Amber-500
  error: '#EF4444',        // Red-500
  border: '#E5E7EB',       // Gray-200
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

// ============================================
// Unsubscribe Link Configuration
// ============================================

// HMAC key for signing unsubscribe tokens - should be set via environment variable
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.CSRF_SECRET || 'default-unsubscribe-secret';

/**
 * Generate an unsubscribe URL for marketing emails
 * FIX: Now uses HMAC signing to prevent token forgery
 * Attackers can no longer craft valid unsubscribe tokens for arbitrary users
 */
const generateUnsubscribeToken = (userId: string, emailType: string): string => {
  const timestamp = Date.now();
  const payload = JSON.stringify({ userId, emailType, timestamp });
  const payloadBase64 = Buffer.from(payload).toString('base64url');

  // Create HMAC signature to prevent token forgery
  const signature = crypto
    .createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  // Token format: payload.signature (both base64url encoded)
  return `${payloadBase64}.${signature}`;
};

/**
 * Validate an unsubscribe token and extract the user ID
 * Returns null if token is invalid or expired (24 hour validity)
 * @param token The unsubscribe token from URL
 * @returns Object with userId and emailType if valid, null otherwise
 */
const validateUnsubscribeToken = (token: string): { userId: string; emailType: string } | null => {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) {
      logger.warn('Invalid unsubscribe token format', { action: 'UNSUBSCRIBE_INVALID_FORMAT' });
      return null;
    }

    const [payloadBase64, providedSignature] = parts;

    // Verify HMAC signature to prevent token forgery
    const expectedSignature = crypto
      .createHmac('sha256', UNSUBSCRIBE_SECRET)
      .update(payloadBase64)
      .digest('base64url');

    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(providedSignature, 'base64url');
    const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

    if (signatureBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      logger.warn('Invalid unsubscribe token signature', { action: 'UNSUBSCRIBE_INVALID_SIGNATURE' });
      return null;
    }

    // Decode and validate payload
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());

    // Check expiration (24 hours)
    const TOKEN_VALIDITY_MS = 24 * 60 * 60 * 1000;
    if (Date.now() - payload.timestamp > TOKEN_VALIDITY_MS) {
      logger.warn('Expired unsubscribe token', {
        action: 'UNSUBSCRIBE_TOKEN_EXPIRED',
        age: Date.now() - payload.timestamp
      });
      return null;
    }

    return { userId: payload.userId, emailType: payload.emailType };
  } catch (error) {
    logger.error('Error validating unsubscribe token', {
      action: 'UNSUBSCRIBE_VALIDATION_ERROR',
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
};

/**
 * Get unsubscribe URL for a specific email type
 */
export const getUnsubscribeUrl = (userId: string, emailType: 'marketing' | 'promotions' | 'newsletters' = 'marketing'): string => {
  const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://nilin.com';
  const token = generateUnsubscribeToken(userId, emailType);
  return `${baseUrl}/unsubscribe?token=${token}&type=${emailType}`;
};

/**
 * Validate unsubscribe token - exported for use by unsubscribe API endpoint
 * @param token The token from unsubscribe URL
 * @returns User ID and email type if valid, null otherwise
 */
export const validateUnsubscribeTokenFromUrl = (token: string): { userId: string; emailType: string } | null => {
  return validateUnsubscribeToken(token);
};

/**
 * Generate standard email footer with unsubscribe link for marketing emails
 */
const getMarketingFooter = (userId: string): string => {
  const unsubscribeUrl = getUnsubscribeUrl(userId, 'marketing');
  return `
    <tr>
      <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
        <p style="margin: 0 0 8px; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
          &copy; ${new Date().getFullYear()} NILIN. All rights reserved.<br>
          <span style="color: ${BRAND_COLORS.primary};">Transforming home services, one booking at a time.</span>
        </p>
        <p style="margin: 16px 0 0; font-size: 12px;">
          <a href="${unsubscribeUrl}" style="color: ${BRAND_COLORS.textLight}; text-decoration: underline;">Unsubscribe from marketing emails</a>
          |
          <a href="${process.env.FRONTEND_URL || process.env.CLIENT_URL || ''}/preferences" style="color: ${BRAND_COLORS.textLight}; text-decoration: underline;">Manage preferences</a>
        </p>
      </td>
    </tr>
  `;
};

/**
 * Generate plain text unsubscribe footer
 */
const getMarketingFooterText = (userId: string): string => {
  const unsubscribeUrl = getUnsubscribeUrl(userId, 'marketing');
  return `
    &copy; ${new Date().getFullYear()} NILIN. All rights reserved.

    To unsubscribe from marketing emails: ${unsubscribeUrl}
    Manage your preferences: ${process.env.FRONTEND_URL || process.env.CLIENT_URL || ''}/preferences
  `;
};

// Batch email configuration
const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 1000;

// Email data interface for batch sending
interface BatchEmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// ============================================
// Simple send function for general use
// ============================================

export const send = async (to: string, subject: string, html: string): Promise<boolean> => {
  try {
    const result = await sendEmail(to, subject, html);
    return result.success;
  } catch (error) {
    logger.error('[Email] Send failed:', error);
    return false;
  }
};

// ============================================
// Batch Email Sending
// ============================================

/**
 * Send batch emails with rate limiting
 * Processes emails in batches of BATCH_SIZE with delay between batches
 */
export const sendBatch = async (emails: BatchEmailData[]): Promise<{ sent: number; failed: number }> => {
  let sent = 0;
  let failed = 0;

  logger.info('[Email] Starting batch send', {
    total: emails.length,
    batchSize: BATCH_SIZE,
    action: 'BATCH_SEND_START',
  });

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);

    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map(email => sendEmail(email.to, email.subject, email.html, email.text))
    );

    // Count results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        sent++;
        logger.debug('[Email] Batch item sent', {
          to: batch[index].to,
          subject: batch[index].subject,
          action: 'BATCH_ITEM_SENT',
        });
      } else if (result.status === 'fulfilled' && !result.value.success) {
        // Promise resolved but email sending failed (queued)
        failed++;
        logger.warn('[Email] Batch item failed or queued', {
          to: batch[index].to,
          subject: batch[index].subject,
          action: 'BATCH_ITEM_FAILED',
        });
      } else {
        failed++;
        const errorMsg = result.status === 'rejected' ? (result as PromiseRejectedResult).reason?.message : 'Unknown error';
        logger.warn('[Email] Batch item failed', {
          to: batch[index].to,
          subject: batch[index].subject,
          error: errorMsg,
          action: 'BATCH_ITEM_FAILED',
        });
      }
    });

    logger.info('[Email] Batch processed', {
      batchIndex: Math.floor(i / BATCH_SIZE) + 1,
      processedInBatch: batch.length,
      sent,
      failed,
      action: 'BATCH_PROCESSED',
    });

    // Rate limit delay between batches (but not after the last batch)
    if (i + BATCH_SIZE < emails.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  logger.info('[Email] Batch send complete', {
    total: emails.length,
    sent,
    failed,
    action: 'BATCH_SEND_COMPLETE',
  });

  return { sent, failed };
};

// ============================================
// Base email function with retry support and circuit breaker
// ============================================

// Internal email function — uses platform transport (DB config with env fallback)
const sendEmailInternal = async (
  to: string,
  subject: string,
  html: string,
  text?: string,
  options?: { forceSend?: boolean }
): Promise<{ messageId: string }> => {
  return sendViaPlatformTransport({ to, subject, html, text }, options);
};

// Public sendEmail function with circuit breaker and retry
export const sendEmail = async (
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; messageId?: string }> => {
  // Log email in development
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Email would be sent', { to, subject, preview: html.substring(0, 200) });
    return { success: true, messageId: 'dev-mode' };
  }

  // Wrap with circuit breaker
  return withCircuitBreaker(
    'email-service',
    async () => {
      const retryResult = await withRetry(
        () => sendEmailInternal(to, subject, html, text),
        retryConfigs.quick
      );

      if (retryResult.success) {
        return { success: true, messageId: retryResult.result?.messageId };
      } else {
        throw retryResult.error || new Error('Email send failed');
      }
    },
    async () => {
      // FALLBACK: Queue the email
      logger.warn('Email service unavailable, queueing email', { to, subject });
      await queueFailedEmail({ to, subject, html });
      return { success: true, messageId: 'queued' };
    }
  );
};

// Email verification template with NILIN branding
const getVerificationEmailTemplate = (firstName: string, verificationToken: string, to?: string): EmailTemplate => {
  const verificationUrl = `${FRONTEND_URL}/verify-email/${verificationToken}`;
  const safeFirstName = escapeHtml(firstName);

  return {
    subject: 'Verify Your Email Address - NILIN',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white}; letter-spacing: -0.5px;">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Home Services Marketplace</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 16px; color: ${BRAND_COLORS.text}; font-size: 24px;">Hi ${safeFirstName}!</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px; line-height: 1.6;">
                Thank you for joining NILIN! To complete your registration and start booking home services, please verify your email address.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${verificationUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">Verify Email Address</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0; color: ${BRAND_COLORS.textLight}; font-size: 14px; text-align: center;">or copy this link:</p>
              <p style="margin: 0; padding: 12px; background: ${BRAND_COLORS.background}; border-radius: 6px; font-size: 12px; color: ${BRAND_COLORS.textLight}; word-break: break-all;">${verificationUrl}</p>

              <div style="margin-top: 32px; padding: 16px; background: #FEF3C7; border-radius: 8px; border-left: 4px solid ${BRAND_COLORS.warning};">
                <p style="margin: 0; color: #92400E; font-size: 14px;">
                  <strong>Security Notice:</strong> This link expires in 24 hours. If you didn't create this account, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.<br>
                <span style="color: ${BRAND_COLORS.primary};">Transforming home services, one booking at a time.</span>
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `
      Hi ${firstName}!

      Welcome to NILIN!

      Please verify your email address by clicking this link: ${verificationUrl}

      This link will expire in 24 hours.

      If you didn't create this account, you can safely ignore this email.

      &copy; ${new Date().getFullYear()} NILIN
    `
  };
};

// Welcome email template
const getWelcomeEmailTemplate = (firstName: string, role: string, to?: string, userId?: string): EmailTemplate => {
  const dashboardUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/${role}/dashboard`;
  const safeFirstName = escapeHtml(firstName);
  const safeRole = escapeHtml(role);
  const unsubscribeSection = userId ? `
    <p style="margin: 16px 0 0; font-size: 12px; color: #666;">
      <a href="${getUnsubscribeUrl(userId, 'newsletters')}" style="color: #666;">Unsubscribe from newsletters</a>
    </p>
  ` : '';

  const roleSpecificContent = {
    customer: {
      title: 'Welcome to Your New Home Service Experience! 🎉',
      benefits: [
        '🔍 Browse thousands of verified service providers',
        '⚡ Book services instantly or schedule for later',
        '💰 Earn loyalty coins with every booking',
        '⭐ Read real reviews from other customers',
        '📱 Manage everything from your mobile device'
      ],
      cta: 'Start Exploring Services'
    },
    provider: {
      title: 'Welcome to the Provider Community! 💼',
      benefits: [
        '📈 Grow your business with new customers',
        '💳 Get paid quickly and securely',
        '📊 Track your performance with analytics',
        '⭐ Build your reputation with reviews',
        '🎯 Use marketing tools to attract clients'
      ],
      cta: 'Complete Your Profile'
    },
    admin: {
      title: 'Welcome to the Admin Panel! 🛠️',
      benefits: [
        '👥 Manage users and providers',
        '📊 Monitor platform analytics',
        '🔧 Configure platform settings',
        '🛡️ Ensure platform security',
        '📈 Drive platform growth'
      ],
      cta: 'Access Admin Dashboard'
    }
  };

  const content = roleSpecificContent[role as keyof typeof roleSpecificContent] || roleSpecificContent.customer;

  return {
    subject: `${content.title}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Home Service Platform</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 15px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 25px 0; }
          .benefits { background: white; padding: 20px; border-radius: 6px; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          .logo { font-size: 28px; font-weight: bold; }
          ul { padding-left: 0; }
          li { list-style: none; padding: 8px 0; font-size: 16px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="logo">🏠 Home Service Platform</div>
          <h1>${content.title}</h1>
        </div>
        <div class="content">
          <h2>Hi ${safeFirstName}! 🎉</h2>
          <p>Your email has been verified and your account is now active! We're thrilled to have you join our community.</p>

          <div class="benefits">
            <h3>Here's what you can do now:</h3>
            <ul>
              ${content.benefits.map(benefit => `<li>${benefit}</li>`).join('')}
            </ul>
          </div>

          <div style="text-align: center;">
            <a href="${dashboardUrl}" class="button">${content.cta}</a>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <h3>Need Help? 🤝</h3>
          <p>Our support team is here to help you get started:</p>
          <ul>
            <li>📧 Email: support@homeservice.com</li>
            <li>💬 Live chat on our website</li>
            <li>📞 Phone: 1-800-HOME-SVC</li>
            <li>📱 Download our mobile app for iOS and Android</li>
          </ul>

          <p>Welcome aboard! We can't wait to see what amazing experiences await you.</p>
          ${unsubscribeSection}
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Service Platform. All rights reserved.</p>
          <p>This email was sent to ${to || 'you'}</p>
        </div>
      </body>
      </html>
    `
  };
};

// Password reset email template
const getPasswordResetEmailTemplate = (firstName: string, resetToken: string, to?: string): EmailTemplate => {
  const resetUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/reset-password/${resetToken}`;
  
  return {
    subject: 'Reset Your Password',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #ff6b6b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .button { display: inline-block; background: #ff6b6b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; color: #856404; padding: 15px; border-radius: 4px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔒 Password Reset Request</h1>
        </div>
        <div class="content">
          <h2>Hi ${firstName},</h2>
          <p>We received a request to reset your password for your Home Service Platform account.</p>
          
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset My Password</a>
          </div>
          
          <p><strong>Or copy and paste this link:</strong></p>
          <p style="word-break: break-all; background: #eee; padding: 10px; border-radius: 4px;">${resetUrl}</p>
          
          <div class="warning">
            <strong>⚠️ Security Notice:</strong>
            <ul>
              <li>This link will expire in 1 hour</li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>Your password remains unchanged until you create a new one</li>
            </ul>
          </div>
          
          <p>For your security, we recommend choosing a strong password that includes:</p>
          <ul>
            <li>At least 8 characters</li>
            <li>One uppercase and one lowercase letter</li>
            <li>At least one number</li>
            <li>At least one special character (@$!%*?&)</li>
          </ul>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Service Platform. All rights reserved.</p>
          <p>This email was sent to ${to || 'you'}</p>
        </div>
      </body>
      </html>
    `
  };
};

// Public email service functions
export const sendVerificationEmail = async (
  email: string, 
  firstName: string, 
  verificationToken: string
): Promise<void> => {
  await sendPlatformEmail({
    templateKey: 'emailVerification',
    to: email,
    variables: { userName: firstName, firstName, verificationToken },
    fallbackHtmlBuilder: () => getVerificationEmailTemplate(firstName, verificationToken, email),
  });
};

export const sendWelcomeEmail = async (
  email: string,
  firstName: string,
  role: string,
  userId?: string
): Promise<void> => {
  await sendPlatformEmail({
    templateKey: 'welcomeEmail',
    to: email,
    variables: { userName: firstName, firstName, role },
    fallbackHtmlBuilder: () => getWelcomeEmailTemplate(firstName, role, email, userId),
  });
};

export const sendPasswordResetEmail = async (
  email: string, 
  firstName: string, 
  resetToken: string
): Promise<void> => {
  await sendPlatformEmail({
    templateKey: 'passwordReset',
    to: email,
    variables: { userName: firstName, firstName, resetToken },
    fallbackHtmlBuilder: () => getPasswordResetEmailTemplate(firstName, resetToken, email),
  });
};

// ===================================
// BOOKING EMAIL TEMPLATES
// ===================================

// Booking request submitted (Customer)
export const sendBookingRequestEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any
): Promise<void> => {
  const template = getBookingRequestTemplate(firstName, bookingDetails);
  await sendEmail(email, template.subject, template.html, template.text);
};

// Booking request notification (Provider)
export const sendNewBookingRequestEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any
): Promise<void> => {
  const template = getNewBookingRequestTemplate(firstName, bookingDetails);
  await sendEmail(email, template.subject, template.html, template.text);
};

// Booking confirmation email (Customer)
export const sendBookingConfirmationEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any
): Promise<void> => {
  await sendPlatformEmail({
    templateKey: 'bookingConfirmation',
    to: email,
    variables: {
      userName: firstName,
      customerName: firstName,
      bookingNumber: bookingDetails.bookingNumber,
      serviceName: bookingDetails.serviceName,
      scheduledDate: bookingDetails.scheduledDate,
      scheduledTime: bookingDetails.scheduledTime,
      providerName: bookingDetails.providerName,
      totalAmount: bookingDetails.totalAmount,
    },
    fallbackHtmlBuilder: () => getBookingConfirmationTemplate(firstName, bookingDetails),
  });
};

// Booking accepted notification (Provider)
export const sendBookingAcceptedEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any
): Promise<void> => {
  const template = getBookingAcceptedTemplate(firstName, bookingDetails);
  await sendEmail(email, template.subject, template.html, template.text);
};

// Booking cancelled email
export const sendBookingCancelledEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any,
  isProvider: boolean = false
): Promise<void> => {
  await sendPlatformEmail({
    templateKey: 'bookingCancellation',
    to: email,
    variables: {
      userName: firstName,
      bookingNumber: bookingDetails.bookingNumber,
      serviceName: bookingDetails.serviceName,
      cancellationReason: bookingDetails.cancellationReason,
    },
    fallbackHtmlBuilder: () => getBookingCancelledTemplate(firstName, bookingDetails, isProvider),
  });
};

// Booking rejected email (Customer)
export const sendBookingRejectedEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any
): Promise<void> => {
  const template = getBookingRejectedTemplate(firstName, bookingDetails);
  await sendEmail(email, template.subject, template.html, template.text);
};

// Booking completed email
export const sendBookingCompletedEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any,
  isProvider: boolean = false
): Promise<void> => {
  await sendPlatformEmail({
    templateKey: 'bookingCompletion',
    to: email,
    variables: {
      userName: firstName,
      bookingNumber: bookingDetails.bookingNumber,
      serviceName: bookingDetails.serviceName,
    },
    fallbackHtmlBuilder: () => getBookingCompletedTemplate(firstName, bookingDetails, isProvider),
  });
};

// Booking reminder email (hours from platform settings)
export const sendBookingReminderEmail = async (
  email: string,
  firstName: string,
  bookingDetails: any
): Promise<void> => {
  await sendPlatformEmail({
    templateKey: 'bookingReminder',
    to: email,
    variables: {
      userName: firstName,
      bookingNumber: bookingDetails.bookingNumber,
      serviceName: bookingDetails.serviceName,
      scheduledDate: bookingDetails.scheduledDate,
      scheduledTime: bookingDetails.scheduledTime,
      providerName: bookingDetails.providerName,
    },
    fallbackHtmlBuilder: () => getBookingReminderTemplate(firstName, bookingDetails),
  });
};

// ===================================
// BOOKING EMAIL TEMPLATE GENERATORS
// ===================================

const getBookingRequestTemplate = (firstName: string, booking: any): EmailTemplate => {
  const viewBookingUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/bookings/${booking.bookingNumber}`;

  return {
    subject: `Booking Request Submitted - ${booking.serviceName}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Request Submitted</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .booking-card { background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #4CAF50; margin: 20px 0; }
          .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          .status-badge { background: #e3f2fd; color: #1976d2; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📋 Booking Request Submitted</h1>
          <p>Your request has been sent to the provider</p>
        </div>
        <div class="content">
          <h2>Hi ${firstName}! 👋</h2>
          <p>Great news! Your booking request has been successfully submitted. The provider will review your request and respond within 24 hours.</p>

          <div class="booking-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3>Booking Details</h3>
              <span class="status-badge">Pending Approval</span>
            </div>
            <p><strong>📋 Booking #:</strong> ${booking.bookingNumber}</p>
            <p><strong>🏠 Service:</strong> ${booking.serviceName}</p>
            <p><strong>👤 Provider:</strong> ${booking.providerName}</p>
            <p><strong>📅 Date & Time:</strong> ${booking.scheduledDate} at ${booking.scheduledTime}</p>
            <p><strong>⏱️ Duration:</strong> ${booking.duration} minutes</p>
            <p><strong>📍 Location:</strong> ${booking.location}</p>
            <p><strong>💰 Total Cost:</strong> ${booking.currency} ${booking.totalAmount}</p>
          </div>

          <div style="text-align: center;">
            <a href="${viewBookingUrl}" class="button">View Booking Details</a>
          </div>

          <div style="background: #fff3e0; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h4>What happens next? 🔄</h4>
            <ul>
              <li>✅ The provider will review your request</li>
              <li>📧 You'll get an email when they respond</li>
              <li>💳 Payment will be processed upon confirmation</li>
              <li>📱 You can track everything in your dashboard</li>
            </ul>
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Service Platform. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${firstName}!

      Your booking request has been submitted successfully.

      Booking Details:
      - Booking #: ${booking.bookingNumber}
      - Service: ${booking.serviceName}
      - Provider: ${booking.providerName}
      - Date & Time: ${booking.scheduledDate} at ${booking.scheduledTime}
      - Total Cost: ${booking.currency} ${booking.totalAmount}

      The provider will respond within 24 hours. You'll receive an email notification when they accept or decline your request.

      View booking: ${viewBookingUrl}
    `
  };
};

const getNewBookingRequestTemplate = (firstName: string, booking: any): EmailTemplate => {
  const respondUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/provider/bookings/${booking.bookingNumber}`;

  return {
    subject: `New Booking Request - ${booking.serviceName}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Booking Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .booking-card { background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #2196F3; margin: 20px 0; }
          .action-buttons { text-align: center; margin: 25px 0; }
          .button { display: inline-block; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 0 10px; }
          .accept-btn { background: #4CAF50; }
          .decline-btn { background: #f44336; }
          .view-btn { background: #2196F3; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🔔 New Booking Request</h1>
          <p>A customer wants to book your service</p>
        </div>
        <div class="content">
          <h2>Hi ${firstName}! 💼</h2>
          <p>You have a new booking request! A customer is interested in your service and would like to schedule an appointment.</p>

          <div class="booking-card">
            <h3>Booking Request Details</h3>
            <p><strong>📋 Booking #:</strong> ${booking.bookingNumber}</p>
            <p><strong>🏠 Service:</strong> ${booking.serviceName}</p>
            <p><strong>👤 Customer:</strong> ${booking.customerName}</p>
            <p><strong>📞 Phone:</strong> ${booking.customerPhone}</p>
            <p><strong>📅 Requested Date & Time:</strong> ${booking.scheduledDate} at ${booking.scheduledTime}</p>
            <p><strong>⏱️ Duration:</strong> ${booking.duration} minutes</p>
            <p><strong>📍 Location:</strong> ${booking.location}</p>
            <p><strong>💰 Service Fee:</strong> ${booking.currency} ${booking.totalAmount}</p>
            ${booking.specialRequests ? `<p><strong>📝 Special Requests:</strong> ${booking.specialRequests}</p>` : ''}
          </div>

          <div class="action-buttons">
            <a href="${respondUrl}&action=accept" class="button accept-btn">✅ Accept Request</a>
            <a href="${respondUrl}&action=decline" class="button decline-btn">❌ Decline</a>
          </div>

          <div style="text-align: center;">
            <a href="${respondUrl}" class="button view-btn">View Full Details</a>
          </div>

          <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h4>⏰ Response Required</h4>
            <p>Please respond to this booking request within 24 hours to maintain your response rate and customer satisfaction.</p>
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Service Platform. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Hi ${firstName}!

      You have a new booking request for ${booking.serviceName}.

      Customer: ${booking.customerName}
      Date & Time: ${booking.scheduledDate} at ${booking.scheduledTime}
      Duration: ${booking.duration} minutes
      Service Fee: ${booking.currency} ${booking.totalAmount}

      Please respond within 24 hours: ${respondUrl}
    `
  };
};

const getBookingConfirmationTemplate = (firstName: string, booking: any): EmailTemplate => {
  const safeFirstName = escapeHtml(firstName);
  const safeServiceName = escapeHtml(booking?.serviceName || 'Service');
  const safeBookingNumber = escapeHtml(booking?.bookingNumber || '');
  const safeProviderName = escapeHtml(booking?.providerName || '');
  const safeScheduledDate = escapeHtml(booking?.scheduledDate || '');
  const safeScheduledTime = escapeHtml(booking?.scheduledTime || '');
  const safeLocation = escapeHtml(booking?.location || '');
  const safeProviderNotes = booking?.providerNotes ? escapeHtml(booking.providerNotes) : '';
  const viewBookingUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/bookings/${safeBookingNumber}`;

  return {
    subject: `Booking Confirmed! ${safeServiceName} on ${safeScheduledDate}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmed</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 25px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .booking-card { background: white; padding: 25px; border-radius: 8px; border-left: 4px solid #4CAF50; margin: 20px 0; }
          .button { display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
          .status-badge { background: #4CAF50; color: white; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🎉 Booking Confirmed!</h1>
          <p>Your appointment is all set</p>
        </div>
        <div class="content">
          <h2>Great news, ${safeFirstName}! ✨</h2>
          <p>Your booking has been confirmed by the provider. Your appointment is scheduled and ready to go!</p>

          <div class="booking-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3>Confirmed Appointment</h3>
              <span class="status-badge">✅ Confirmed</span>
            </div>
            <p><strong>📋 Booking #:</strong> ${safeBookingNumber}</p>
            <p><strong>🏠 Service:</strong> ${safeServiceName}</p>
            <p><strong>👤 Provider:</strong> ${safeProviderName}</p>
            <p><strong>📅 Date & Time:</strong> ${safeScheduledDate} at ${safeScheduledTime}</p>
            <p><strong>⏱️ Duration:</strong> ${escapeHtml(booking?.duration)} minutes</p>
            <p><strong>📍 Location:</strong> ${safeLocation}</p>
            <p><strong>💰 Total Cost:</strong> ${escapeHtml(booking?.currency)} ${escapeHtml(booking?.totalAmount)}</p>
            ${safeProviderNotes ? `<p><strong>📝 Provider Notes:</strong> ${safeProviderNotes}</p>` : ''}
          </div>

          <div style="text-align: center;">
            <a href="${viewBookingUrl}" class="button">View Booking Details</a>
          </div>

          <div style="background: #e8f5e8; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h4>📋 What to expect next:</h4>
            <ul>
              <li>📧 We'll send you a reminder 24 hours before your appointment</li>
              <li>📱 You can message your provider directly through the app</li>
              <li>💳 Payment will be processed after service completion</li>
              <li>⭐ You'll earn loyalty coins after the service</li>
            </ul>
          </div>

          <div style="background: #fff3e0; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h4>📞 Provider Contact</h4>
            <p>If you need to reach your provider directly:</p>
            <p><strong>📧 Email:</strong> ${booking.providerEmail}</p>
            <p><strong>📱 In-app messaging:</strong> Available in your booking details</p>
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Home Service Platform. All rights reserved.</p>
        </div>
      </body>
      </html>
    `,
    text: `
      Great news, ${firstName}! Your booking has been confirmed.

      Booking Details:
      - Booking #: ${booking.bookingNumber}
      - Service: ${booking.serviceName}
      - Provider: ${booking.providerName}
      - Date & Time: ${booking.scheduledDate} at ${booking.scheduledTime}
      - Total Cost: ${booking.currency} ${booking.totalAmount}

      We'll send you a reminder 24 hours before your appointment.

      View booking: ${viewBookingUrl}
    `
  };
};

// Loyalty points notification
export const sendLoyaltyPointsEmail = async (
  email: string,
  firstName: string,
  pointsEarned: number,
  totalPoints: number,
  reason: string,
  userId?: string
): Promise<void> => {
  const subject = `You earned ${pointsEarned} loyalty coins! 🪙`;
  const unsubscribeSection = userId ? `
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E5E7EB;">
      <p style="margin: 0; font-size: 12px; color: ${BRAND_COLORS.textLight};">
        <a href="${getUnsubscribeUrl(userId, 'marketing')}" style="color: ${BRAND_COLORS.textLight};">Unsubscribe from marketing emails</a>
      </p>
    </div>
  ` : '';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Loyalty Points</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <tr>
          <td style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%); padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white}; letter-spacing: -0.5px;">NILIN</h1>
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Loyalty Rewards</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 24px;">
            <h2 style="margin: 0 0 16px; color: ${BRAND_COLORS.text}; font-size: 24px;">Congratulations ${firstName}! 🎉</h2>
            <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px; line-height: 1.6;">
              You just earned <strong style="color: ${BRAND_COLORS.primary};">${pointsEarned} loyalty coins</strong> for: ${reason}
            </p>

            <div style="background: linear-gradient(135deg, ${BRAND_COLORS.primaryLight} 0%, ${BRAND_COLORS.background} 100%); padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center;">
              <h3 style="margin: 0 0 8px; color: ${BRAND_COLORS.text}; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Loyalty Balance</h3>
              <p style="margin: 0; font-size: 32px; color: ${BRAND_COLORS.primary}; font-weight: 700;">${totalPoints} coins</p>
            </div>

            <p style="margin: 0 0 24px; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">
              Use your coins to get discounts on future bookings!
            </p>

            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || ''}/loyalty" style="display: inline-block; padding: 14px 32px; background: ${BRAND_COLORS.primary}; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">View Your Rewards</a>
            </div>
            ${unsubscribeSection}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await sendEmail(email, subject, html);
};

// ============================================
// Payment Receipt Email
// ============================================

interface PaymentReceiptData {
  bookingId: string;
  bookingNumber: string;
  customerName: string;
  customerEmail: string;
  providerName: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  totalAmount: number;
  currency: string;
  transactionId: string;
  paidAt: Date;
}

/**
 * Send payment receipt email after successful payment
 */
export const sendPaymentReceiptEmail = async (data: PaymentReceiptData): Promise<void> => {
  const {
    bookingNumber,
    customerName,
    customerEmail,
    providerName,
    serviceName,
    scheduledDate,
    scheduledTime,
    totalAmount,
    currency,
    transactionId,
    paidAt,
  } = data;

  const formattedDate = new Date(scheduledDate).toLocaleDateString('en-AE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = scheduledTime;
  const formattedAmount = new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: currency,
  }).format(totalAmount);

  const formattedPaidAt = new Date(paidAt).toLocaleString('en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const viewBookingUrl = `${FRONTEND_URL_FALLBACK}/customer/bookings/${data.bookingId}`;

  const subject = `Payment Receipt - Booking #${bookingNumber}`;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Receipt</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <tr>
          <td style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%); padding: 32px 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white}; letter-spacing: -0.5px;">NILIN</h1>
            <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Payment Receipt</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 24px;">
            <p style="margin: 0 0 24px; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">
              Dear ${escapeHtml(customerName)},
            </p>
            <p style="margin: 0 0 24px; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">
              Thank you for your payment! Your booking has been confirmed.
            </p>

            <!-- Receipt Details -->
            <div style="background-color: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
              <h2 style="margin: 0 0 16px; color: ${BRAND_COLORS.text}; font-size: 18px; font-weight: 600;">Receipt Details</h2>

              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">Booking Number</td>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.text}; font-size: 14px; font-weight: 600; text-align: right;">#${escapeHtml(bookingNumber)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">Transaction ID</td>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.text}; font-size: 14px; text-align: right; font-family: monospace;">${escapeHtml(transactionId)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">Paid On</td>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.text}; font-size: 14px; text-align: right;">${escapeHtml(formattedPaidAt)}</td>
                </tr>
              </table>
            </div>

            <!-- Booking Details -->
            <div style="background-color: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
              <h2 style="margin: 0 0 16px; color: ${BRAND_COLORS.text}; font-size: 18px; font-weight: 600;">Booking Details</h2>

              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">Service</td>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.text}; font-size: 14px; font-weight: 600; text-align: right;">${escapeHtml(serviceName)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">Provider</td>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.text}; font-size: 14px; text-align: right;">${escapeHtml(providerName)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">Date</td>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.text}; font-size: 14px; text-align: right;">${escapeHtml(formattedDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">Time</td>
                  <td style="padding: 8px 0; color: ${BRAND_COLORS.text}; font-size: 14px; text-align: right;">${escapeHtml(formattedTime)}</td>
                </tr>
                <tr style="border-top: 1px solid ${BRAND_COLORS.border};">
                  <td style="padding: 16px 0 8px; color: ${BRAND_COLORS.text}; font-size: 16px; font-weight: 600;">Total Paid</td>
                  <td style="padding: 16px 0 8px; color: ${BRAND_COLORS.primary}; font-size: 20px; font-weight: 700; text-align: right;">${formattedAmount}</td>
                </tr>
              </table>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${viewBookingUrl}" style="display: inline-block; padding: 14px 32px; background: ${BRAND_COLORS.primary}; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">View Booking Details</a>
            </div>

            <p style="margin: 24px 0 0; color: ${BRAND_COLORS.textLight}; font-size: 14px; line-height: 1.6;">
              If you have any questions about your booking or payment, please contact our support team.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `
Payment Receipt - Booking #${bookingNumber}

Dear ${customerName},

Thank you for your payment! Your booking has been confirmed.

RECEIPT DETAILS
----------------
Booking Number: #${bookingNumber}
Transaction ID: ${transactionId}
Paid On: ${formattedPaidAt}

BOOKING DETAILS
---------------
Service: ${serviceName}
Provider: ${providerName}
Date: ${formattedDate}
Time: ${formattedTime}

Total Paid: ${formattedAmount}

View booking details: ${viewBookingUrl}

If you have any questions, please contact our support team.
  `;

  await sendPlatformEmail({
    templateKey: 'paymentReceipt',
    to: customerEmail,
    variables: {
      userName: customerName,
      customerName,
      bookingNumber,
      serviceName,
      providerName,
      scheduledDate: formattedDate,
      scheduledTime: formattedTime,
      totalAmount: formattedAmount,
      transactionId,
    },
    fallbackHtmlBuilder: () => ({ subject, html, text }),
  });
};

// Add the remaining template functions
const getBookingAcceptedTemplate = (firstName: string, booking: any): EmailTemplate => {
  const safeFirstName = escapeHtml(firstName);
  const safeServiceName = escapeHtml(booking?.serviceName || 'Service');
  return {
    subject: `Booking Accepted - ${safeServiceName}`,
    html: `<h2>Hi ${safeFirstName}!</h2><p>You have successfully accepted the booking request for ${safeServiceName}.</p>`,
    text: `Hi ${safeFirstName}! You have accepted the booking request for ${safeServiceName}.`
  };
};

const getBookingCancelledTemplate = (firstName: string, booking: any, isProvider: boolean = false): EmailTemplate => {
  const safeFirstName = escapeHtml(firstName);
  const safeServiceName = escapeHtml(booking?.serviceName || 'Service');
  const safeBookingNumber = escapeHtml(booking?.bookingNumber || '');
  const title = isProvider ? 'Booking Cancelled by Customer' : 'Booking Cancelled';
  return {
    subject: `${title} - ${safeServiceName}`,
    html: `<h2>Hi ${safeFirstName}!</h2><p>Booking ${safeBookingNumber} for ${safeServiceName} has been cancelled.</p>`,
    text: `Hi ${safeFirstName}! Booking ${safeBookingNumber} has been cancelled.`
  };
};

const getBookingRejectedTemplate = (firstName: string, booking: any): EmailTemplate => {
  const safeFirstName = escapeHtml(firstName);
  const safeServiceName = escapeHtml(booking?.serviceName || 'Service');
  return {
    subject: `Booking Request Declined - ${safeServiceName}`,
    html: `<h2>Hi ${safeFirstName}!</h2><p>Unfortunately, your booking request for ${safeServiceName} has been declined.</p>`,
    text: `Hi ${safeFirstName}! Your booking request for ${safeServiceName} has been declined.`
  };
};

const getBookingCompletedTemplate = (firstName: string, booking: any, isProvider: boolean = false): EmailTemplate => {
  const safeFirstName = escapeHtml(firstName);
  const safeServiceName = escapeHtml(booking?.serviceName || 'Service');
  const title = isProvider ? 'Service Completed Successfully' : 'Service Completed - Please Review';
  return {
    subject: `${title} - ${safeServiceName}`,
    html: `<h2>Hi ${safeFirstName}!</h2><p>The service ${safeServiceName} has been completed successfully.</p>`,
    text: `Hi ${safeFirstName}! The service ${safeServiceName} has been completed.`
  };
};

const getBookingReminderTemplate = (firstName: string, booking: any): EmailTemplate => {
  const safeFirstName = escapeHtml(firstName);
  const safeServiceName = escapeHtml(booking?.serviceName || 'Service');
  const safeBookingNumber = escapeHtml(booking?.bookingNumber || '');
  const viewBookingUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/bookings/${safeBookingNumber}`;

  return {
    subject: `Reminder: Your ${booking.serviceName} appointment is tomorrow!`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Reminder</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Appointment Reminder</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; width: 64px; height: 64px; background: ${BRAND_COLORS.primaryLight}; border-radius: 50%; line-height: 64px; font-size: 32px;">&#128276;</span>
              </div>

              <h2 style="margin: 0 0 16px; color: ${BRAND_COLORS.text}; font-size: 24px; text-align: center;">Don't forget your appointment!</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px; text-align: center;">
                Hi ${safeFirstName}, this is a friendly reminder about your upcoming appointment tomorrow.
              </p>

              <!-- Booking Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 16px; color: ${BRAND_COLORS.primary}; font-size: 18px;">${escapeHtml(booking.serviceName)}</h3>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Date</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${escapeHtml(booking.scheduledDate)}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Time</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${escapeHtml(booking.scheduledTime)}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Provider</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${escapeHtml(booking.providerName)}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: ${BRAND_COLORS.textLight};">Location</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${escapeHtml(booking.location)}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${viewBookingUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">View Booking Details</a>
                  </td>
                </tr>
              </table>

              <div style="margin-top: 24px; padding: 16px; background: #FEF3C7; border-radius: 8px; border-left: 4px solid ${BRAND_COLORS.warning};">
                <p style="margin: 0; color: #92400E; font-size: 14px;">
                  <strong>Tip:</strong> Please ensure you're at the location 10 minutes before your scheduled time.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hi ${firstName}! Reminder: ${booking.serviceName} tomorrow at ${booking.scheduledTime}. Location: ${booking.location}.`
  };
};

const getBookingReminderFullTemplate = (booking: BookingNotificationData, recipient: 'customer' | 'provider'): EmailTemplate => {
  const viewBookingUrl = `${FRONTEND_URL}/bookings/${booking.bookingNumber}`;
  const isCustomer = recipient === 'customer';
  const greeting = isCustomer ? booking.customerName : booking.providerName;
  const otherParty = isCustomer ? booking.providerName : booking.customerName;

  return {
    subject: `Reminder: Your ${booking.serviceName} appointment is tomorrow!`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Reminder</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Appointment Reminder</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; width: 64px; height: 64px; background: ${BRAND_COLORS.primaryLight}; border-radius: 50%; line-height: 64px; font-size: 32px;">&#128276;</span>
              </div>

              <h2 style="margin: 0 0 16px; color: ${BRAND_COLORS.text}; font-size: 24px; text-align: center;">Don't forget your appointment!</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px; text-align: center;">
                Hi ${greeting}, this is a friendly reminder about your upcoming appointment tomorrow.
              </p>

              <!-- Booking Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 16px; color: ${BRAND_COLORS.primary}; font-size: 18px;">${booking.serviceName}</h3>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Date</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.scheduledDate}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Time</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.scheduledTime}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">${isCustomer ? 'Provider' : 'Customer'}</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${otherParty}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: ${BRAND_COLORS.textLight};">Location</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.location}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${viewBookingUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">View Booking Details</a>
                  </td>
                </tr>
              </table>

              <div style="margin-top: 24px; padding: 16px; background: #FEF3C7; border-radius: 8px; border-left: 4px solid ${BRAND_COLORS.warning};">
                <p style="margin: 0; color: #92400E; font-size: 14px;">
                  <strong>Tip:</strong> Please ensure you're at the location 10 minutes before your scheduled time.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hi ${greeting}! Reminder: ${booking.serviceName} tomorrow at ${booking.scheduledTime}. Location: ${booking.location}.`
  };
};

// ============================================
// NEW BOOKING EMAIL FUNCTIONS
// ============================================

// Booking interface for notification functions
interface BookingNotificationData {
  bookingNumber: string;
  serviceName: string;
  providerName: string;
  providerEmail: string;
  customerName: string;
  customerEmail: string;
  scheduledDate: string;
  scheduledTime: string;
  duration: number;
  location: string;
  totalAmount: number;
  currency: string;
  status: string;
  specialRequests?: string;
  providerNotes?: string;
}

/**
 * Send booking confirmation email to both customer and provider
 */
export const sendBookingConfirmation = async (booking: BookingNotificationData): Promise<void> => {
  try {
    // Send to customer
    const customerTemplate = getBookingConfirmationFullTemplate(booking, 'customer');
    await sendEmail(booking.customerEmail, customerTemplate.subject, customerTemplate.html, customerTemplate.text);

    // Send to provider
    const providerTemplate = getBookingConfirmationFullTemplate(booking, 'provider');
    await sendEmail(booking.providerEmail, providerTemplate.subject, providerTemplate.html, providerTemplate.text);

    logger.info('Booking confirmation emails sent', {
      bookingNumber: booking.bookingNumber,
      customerEmail: booking.customerEmail,
      providerEmail: booking.providerEmail,
      action: 'BOOKING_CONFIRMATION_SENT',
    });
  } catch (error) {
    logger.error('Failed to send booking confirmation emails', {
      bookingNumber: booking.bookingNumber,
      error: error instanceof Error ? error.message : String(error),
      action: 'BOOKING_CONFIRMATION_FAILED',
    });
    // Don't throw - email failure should not break booking flow
  }
};

/**
 * Send booking reminder email (24h before appointment)
 */
export const sendBookingReminder = async (booking: BookingNotificationData): Promise<void> => {
  try {
    // Send to customer
    const customerTemplate = getBookingReminderFullTemplate(booking, 'customer');
    await sendEmail(booking.customerEmail, customerTemplate.subject, customerTemplate.html, customerTemplate.text);

    // Send to provider
    const providerTemplate = getBookingReminderFullTemplate(booking, 'provider');
    await sendEmail(booking.providerEmail, providerTemplate.subject, providerTemplate.html, providerTemplate.text);

    logger.info('Booking reminder emails sent', {
      bookingNumber: booking.bookingNumber,
      action: 'BOOKING_REMINDER_SENT',
    });
  } catch (error) {
    logger.error('Failed to send booking reminder emails', {
      bookingNumber: booking.bookingNumber,
      error: error instanceof Error ? error.message : String(error),
      action: 'BOOKING_REMINDER_FAILED',
    });
  }
};

/**
 * Send booking cancellation email to both parties
 */
export const sendBookingCancellation = async (
  booking: BookingNotificationData,
  cancelledBy: 'customer' | 'provider' | 'admin'
): Promise<void> => {
  try {
    const recipient = cancelledBy === 'customer' ? booking.providerEmail : booking.customerEmail;
    const cancellerName = cancelledBy === 'customer' ? booking.customerName : booking.providerName;

    const template = getBookingCancellationFullTemplate(booking, cancelledBy, cancellerName);
    await sendEmail(recipient, template.subject, template.html, template.text);

    logger.info('Booking cancellation email sent', {
      bookingNumber: booking.bookingNumber,
      cancelledBy,
      recipient,
      action: 'BOOKING_CANCELLATION_SENT',
    });
  } catch (error) {
    logger.error('Failed to send booking cancellation email', {
      bookingNumber: booking.bookingNumber,
      error: error instanceof Error ? error.message : String(error),
      action: 'BOOKING_CANCELLATION_FAILED',
    });
  }
};

/**
 * Send booking rescheduled email to both parties
 */
export const sendBookingRescheduled = async (
  booking: BookingNotificationData,
  oldDate: string,
  newDate: string
): Promise<void> => {
  try {
    // Send to customer
    const customerTemplate = getBookingRescheduledFullTemplate(booking, oldDate, newDate, 'customer');
    await sendEmail(booking.customerEmail, customerTemplate.subject, customerTemplate.html, customerTemplate.text);

    // Send to provider
    const providerTemplate = getBookingRescheduledFullTemplate(booking, oldDate, newDate, 'provider');
    await sendEmail(booking.providerEmail, providerTemplate.subject, providerTemplate.html, providerTemplate.text);

    logger.info('Booking rescheduled emails sent', {
      bookingNumber: booking.bookingNumber,
      oldDate,
      newDate,
      action: 'BOOKING_RESCHEDULED_SENT',
    });
  } catch (error) {
    logger.error('Failed to send booking rescheduled emails', {
      bookingNumber: booking.bookingNumber,
      error: error instanceof Error ? error.message : String(error),
      action: 'BOOKING_RESCHEDULED_FAILED',
    });
  }
};

/**
 * Send provider approval email (admin approval)
 */
export const sendProviderApproval = async (
  provider: {
    email: string;
    firstName: string;
    businessName: string;
  }
): Promise<void> => {
  try {
    const dashboardUrl = `${FRONTEND_URL}/provider/dashboard`;
    await sendPlatformEmail({
      templateKey: 'providerApproval',
      to: provider.email,
      variables: {
        userName: provider.firstName,
        businessName: provider.businessName,
        dashboardUrl,
      },
      fallbackHtmlBuilder: () => getProviderApprovalTemplate(provider, dashboardUrl),
    });

    logger.info('Provider approval email sent', {
      email: provider.email,
      businessName: provider.businessName,
      action: 'PROVIDER_APPROVAL_SENT',
    });
  } catch (error) {
    logger.error('Failed to send provider approval email', {
      email: provider.email,
      error: error instanceof Error ? error.message : String(error),
      action: 'PROVIDER_APPROVAL_FAILED',
    });
  }
};

/**
 * Send provider rejection email (admin rejection)
 */
export const sendProviderRejection = async (
  provider: {
    email: string;
    firstName: string;
    businessName: string;
  },
  reason: string
): Promise<void> => {
  try {
    const helpUrl = `${FRONTEND_URL}/support`;
    await sendPlatformEmail({
      templateKey: 'providerRejection',
      to: provider.email,
      variables: {
        userName: provider.firstName,
        businessName: provider.businessName,
        rejectionReason: reason,
        helpUrl,
      },
      fallbackHtmlBuilder: () => getProviderRejectionTemplate(provider, reason, helpUrl),
    });

    logger.info('Provider rejection email sent', {
      email: provider.email,
      businessName: provider.businessName,
      action: 'PROVIDER_REJECTION_SENT',
    });
  } catch (error) {
    logger.error('Failed to send provider rejection email', {
      email: provider.email,
      error: error instanceof Error ? error.message : String(error),
      action: 'PROVIDER_REJECTION_FAILED',
    });
  }
};

// ============================================
// FULL TEMPLATE GENERATORS
// ============================================

const getBookingConfirmationFullTemplate = (booking: BookingNotificationData, recipient: 'customer' | 'provider'): EmailTemplate => {
  const viewBookingUrl = `${FRONTEND_URL}/bookings/${booking.bookingNumber}`;
  const isCustomer = recipient === 'customer';
  const greeting = isCustomer ? `Great news, ${booking.customerName}!` : `Hello, ${booking.providerName}!`;
  const subtitle = isCustomer ? 'Your booking has been confirmed!' : 'You have confirmed a booking!';

  return {
    subject: `Booking Confirmed! - ${booking.bookingNumber}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.success} 0%, #059669 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Booking Confirmed</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 8px; color: ${BRAND_COLORS.text}; font-size: 24px;">${greeting}</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px;">${subtitle}</p>

              <!-- Booking Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td style="border-left: 4px solid ${BRAND_COLORS.success}; padding-left: 16px;">
                    <p style="margin: 0 0 4px; font-size: 12px; color: ${BRAND_COLORS.textLight}; text-transform: uppercase; letter-spacing: 0.5px;">Booking Number</p>
                    <p style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: ${BRAND_COLORS.text};">${booking.bookingNumber}</p>

                    <h3 style="margin: 0 0 16px; font-size: 18px; color: ${BRAND_COLORS.primary};">${booking.serviceName}</h3>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">${isCustomer ? 'Provider' : 'Customer'}</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${isCustomer ? booking.providerName : booking.customerName}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Date</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.scheduledDate}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Time</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.scheduledTime}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Duration</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.duration} minutes</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Location</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.location}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: ${BRAND_COLORS.textLight};">Total Amount</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.primary}; font-size: 18px;">${booking.currency} ${booking.totalAmount}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${viewBookingUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">View Booking Details</a>
                  </td>
                </tr>
              </table>

              ${booking.providerNotes ? `
              <div style="margin-top: 24px; padding: 16px; background: ${BRAND_COLORS.primaryLight}; border-radius: 8px;">
                <p style="margin: 0; color: ${BRAND_COLORS.primaryDark}; font-size: 14px;">
                  <strong>Provider Notes:</strong> ${booking.providerNotes}
                </p>
              </div>
              ` : ''}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.<br>
                Questions? Contact us at support@nilin.com
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `${greeting} Your booking ${booking.bookingNumber} for ${booking.serviceName} has been confirmed on ${booking.scheduledDate} at ${booking.scheduledTime}. ${booking.currency} ${booking.totalAmount}.`
  };
};

const getBookingCancellationFullTemplate = (
  booking: BookingNotificationData,
  cancelledBy: 'customer' | 'provider' | 'admin',
  cancellerName: string
): EmailTemplate => {
  const viewBookingUrl = `${FRONTEND_URL}/bookings/${booking.bookingNumber}`;

  return {
    subject: `Booking Cancelled - ${booking.bookingNumber}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Cancelled</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.error} 0%, #DC2626 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Booking Cancelled</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 16px; color: ${BRAND_COLORS.text}; font-size: 24px;">Booking Cancelled</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px;">
                The booking <strong>${booking.bookingNumber}</strong> for <strong>${booking.serviceName}</strong> has been cancelled by <strong>${cancellerName}</strong>.
              </p>

              <!-- Booking Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Service</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.serviceName}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Scheduled For</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${booking.scheduledDate} at ${booking.scheduledTime}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: ${BRAND_COLORS.textLight};">Cancelled By</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.error};">${cancellerName}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="margin-top: 24px; padding: 16px; background: #FEE2E2; border-radius: 8px; border-left: 4px solid ${BRAND_COLORS.error};">
                <p style="margin: 0; color: #991B1B; font-size: 14px;">
                  If you have any questions about this cancellation, please contact our support team.
                </p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Booking ${booking.bookingNumber} for ${booking.serviceName} has been cancelled by ${cancellerName}.`
  };
};

const getBookingRescheduledFullTemplate = (
  booking: BookingNotificationData,
  oldDate: string,
  newDate: string,
  recipient: 'customer' | 'provider'
): EmailTemplate => {
  const viewBookingUrl = `${FRONTEND_URL}/bookings/${booking.bookingNumber}`;
  const greeting = recipient === 'customer' ? booking.customerName : booking.providerName;

  return {
    subject: `Booking Rescheduled - ${booking.bookingNumber}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Rescheduled</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.secondary} 0%, #EA580C 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Booking Rescheduled</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 8px; color: ${BRAND_COLORS.text}; font-size: 24px;">Hi ${greeting}!</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px;">Your booking has been rescheduled to a new time.</p>

              <!-- Date Change Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: ${BRAND_COLORS.textLight};">Booking Number</p>
                    <p style="margin: 0 0 24px; font-size: 20px; font-weight: 700; color: ${BRAND_COLORS.text};">${booking.bookingNumber}</p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 16px; background: #FEE2E2; border-radius: 8px; text-align: center;">
                          <p style="margin: 0 0 4px; font-size: 12px; color: #991B1B; text-transform: uppercase;">Previous</p>
                          <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${BRAND_COLORS.error}; text-decoration: line-through;">${oldDate}</p>
                        </td>
                        <td style="width: 40px; text-align: center; vertical-align: middle;">
                          <span style="color: ${BRAND_COLORS.textLight}; font-size: 20px;">&rarr;</span>
                        </td>
                        <td style="padding: 16px; background: #D1FAE5; border-radius: 8px; text-align: center;">
                          <p style="margin: 0 0 4px; font-size: 12px; color: #065F46; text-transform: uppercase;">New</p>
                          <p style="margin: 0; font-size: 18px; font-weight: 600; color: ${BRAND_COLORS.success};">${newDate}</p>
                        </td>
                      </tr>
                    </table>

                    <h3 style="margin: 24px 0 8px; font-size: 16px; color: ${BRAND_COLORS.primary};">${booking.serviceName}</h3>
                    <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 14px;">at ${booking.scheduledTime}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${viewBookingUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">View Updated Booking</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hi ${greeting}! Your booking ${booking.bookingNumber} for ${booking.serviceName} has been rescheduled from ${oldDate} to ${newDate}.`
  };
};

const getProviderApprovalTemplate = (
  provider: { email: string; firstName: string; businessName: string },
  dashboardUrl: string
): EmailTemplate => {
  return {
    subject: 'Congratulations! Your NILIN Provider Account is Approved',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Provider Account Approved</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.success} 0%, #059669 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Provider Account Approved</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; width: 80px; height: 80px; background: ${BRAND_COLORS.primaryLight}; border-radius: 50%; line-height: 80px; font-size: 40px;">&#127881;</span>
              </div>

              <h2 style="margin: 0 0 8px; color: ${BRAND_COLORS.text}; font-size: 24px; text-align: center;">Congratulations, ${provider.firstName}!</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px; text-align: center;">
                Your provider account for <strong>${provider.businessName}</strong> has been approved.
              </p>

              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">
                Welcome to the NILIN provider community! You can now start listing your services and accepting bookings from customers.
              </p>

              <!-- Features List -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
                <tr>
                  <td>
                    ${['List and manage your services', 'Accept bookings from customers', 'Track your earnings and performance', 'Build your reputation with reviews'].map(
                      feature => `
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                        <tr>
                          <td style="width: 24px; vertical-align: top;">
                            <span style="color: ${BRAND_COLORS.success};">&#10003;</span>
                          </td>
                          <td style="color: ${BRAND_COLORS.text};">${feature}</td>
                        </tr>
                      </table>
                    `
                    ).join('')}
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">Go to Dashboard</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.<br>
                Questions? Contact us at support@nilin.com
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Congratulations, ${provider.firstName}! Your provider account for ${provider.businessName} has been approved. Go to your dashboard to start accepting bookings: ${dashboardUrl}`
  };
};

const getProviderRejectionTemplate = (
  provider: { email: string; firstName: string; businessName: string },
  reason: string,
  helpUrl: string
): EmailTemplate => {
  return {
    subject: 'Provider Application Update - NILIN',
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Provider Application Update</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.textLight} 0%, ${BRAND_COLORS.text} 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Application Update</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 8px; color: ${BRAND_COLORS.text}; font-size: 24px;">Hello ${provider.firstName},</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px;">
                Thank you for your interest in becoming a NILIN provider. After careful review, we're unable to approve your application for <strong>${provider.businessName}</strong> at this time.
              </p>

              <!-- Reason Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td>
                    <p style="margin: 0 0 8px; font-size: 14px; color: ${BRAND_COLORS.textLight}; text-transform: uppercase;">Reason for Decision</p>
                    <p style="margin: 0; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">${reason}</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.text}; font-size: 16px; line-height: 1.6;">
                If you believe this decision was made in error or if you'd like to address the concerns mentioned, please don't hesitate to reach out to our support team.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${helpUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">Contact Support</a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; color: ${BRAND_COLORS.textLight}; font-size: 14px; text-align: center;">
                We appreciate your interest in NILIN and hope to work with you in the future.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.<br>
                support@nilin.com
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hello ${provider.firstName}, thank you for your interest in becoming a NILIN provider. After careful review, we're unable to approve your application for ${provider.businessName} at this time. Reason: ${reason}. If you have questions, please contact our support team.`
  };
};

// ============================================
// Withdrawal/Payout Emails
// ============================================

export interface WithdrawalApprovedEmailData {
  to: string;
  providerName: string;
  amount: number;
  currency: string;
  payoutNumber: string;
}

/**
 * Send withdrawal/payout approved email to provider
 */
export const sendWithdrawalApproved = async (data: WithdrawalApprovedEmailData): Promise<void> => {
  const { to, providerName, amount, currency, payoutNumber } = data;
  const template = getWithdrawalApprovedTemplate(providerName, amount, currency, payoutNumber);
  await sendEmail(to, template.subject, template.html, template.text);
};

const getWithdrawalApprovedTemplate = (
  providerName: string,
  amount: number,
  currency: string,
  payoutNumber: string
): EmailTemplate => {
  const safeProviderName = escapeHtml(providerName);
  const formattedAmount = `${currency} ${amount.toFixed(2)}`;
  const viewPayoutUrl = `${FRONTEND_URL_FALLBACK || FRONTEND_URL}/provider/payouts/${payoutNumber}`;

  return {
    subject: `Withdrawal Approved - ${formattedAmount}`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Withdrawal Approved</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND_COLORS.success} 0%, #059669 100%); padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white};">NILIN</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Withdrawal Approved</p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px 24px;">
              <h2 style="margin: 0 0 16px; color: ${BRAND_COLORS.text}; font-size: 24px;">Congratulations, ${safeProviderName}!</h2>
              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 16px; line-height: 1.6;">
                Your withdrawal request has been approved and processed successfully.
              </p>

              <!-- Amount Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, ${BRAND_COLORS.success} 0%, #059669 100%); border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 14px; color: rgba(255,255,255,0.9); text-transform: uppercase; letter-spacing: 1px;">Amount Transferred</p>
                    <p style="margin: 0; font-size: 36px; font-weight: 700; color: ${BRAND_COLORS.white};">${formattedAmount}</p>
                  </td>
                </tr>
              </table>

              <!-- Details Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; padding: 24px; margin: 24px 0;">
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Payout Number</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${escapeHtml(payoutNumber)}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">
                          <span style="color: ${BRAND_COLORS.textLight};">Status</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right;">
                          <span style="color: ${BRAND_COLORS.success}; font-weight: 600;">Approved</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: ${BRAND_COLORS.textLight};">Date</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: ${BRAND_COLORS.text};">${new Date().toLocaleDateString()}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 14px;">
                The funds should appear in your account within 1-3 business days, depending on your bank's processing time.
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
                <tr>
                  <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
                    <a href="${viewPayoutUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px;">View Payout Details</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
              <p style="margin: 0; color: ${BRAND_COLORS.textLight}; font-size: 12px;">
                &copy; ${new Date().getFullYear()} NILIN. All rights reserved.<br>
                <span style="color: ${BRAND_COLORS.primary};">Transforming home services, one booking at a time.</span>
              </p>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `
      Congratulations, ${providerName}!

      Your withdrawal request has been approved and processed successfully.

      Amount: ${formattedAmount}
      Payout Number: ${payoutNumber}
      Date: ${new Date().toLocaleDateString()}

      The funds should appear in your account within 1-3 business days.

      View payout details: ${viewPayoutUrl}

      &copy; ${new Date().getFullYear()} NILIN
    `,
  };
};

// ============================================
// Unsubscribe Handler
// ============================================

interface UnsubscribePayload {
  userId: string;
  emailType: 'marketing' | 'promotions' | 'newsletters';
  timestamp: number;
}

/**
 * Process an unsubscribe token and update user preferences
 * Returns the userId if successful, null if invalid
 */
export const processUnsubscribeToken = async (token: string): Promise<{
  success: boolean;
  userId?: string;
  emailType?: string;
  error?: string;
}> => {
  try {
    // Decode the token
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const payload: UnsubscribePayload = JSON.parse(decoded);

    // Validate payload structure
    if (!payload.userId || !payload.emailType) {
      return { success: false, error: 'Invalid token format' };
    }

    // Check token age (max 7 days)
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    if (Date.now() - payload.timestamp > maxAge) {
      return { success: false, error: 'Token expired' };
    }

    // Update user preferences based on email type
    const user = await User.findById(payload.userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Set the appropriate preference to false
    const prefPath = `communicationPreferences.${payload.emailType}`;
    await User.findByIdAndUpdate(payload.userId, { $set: { [prefPath]: false } });

    logger.info('User unsubscribed from email type', {
      userId: payload.userId,
      emailType: payload.emailType,
      action: 'UNSUBSCRIBE_SUCCESS',
    });

    return {
      success: true,
      userId: payload.userId,
      emailType: payload.emailType,
    };
  } catch (error) {
    logger.error('Failed to process unsubscribe token', { error, token });
    return { success: false, error: 'Invalid or expired token' };
  }
};

export default {
  sendEmail,
  // Auth emails
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,

  // Booking emails
  sendBookingRequestEmail,
  sendNewBookingRequestEmail,
  sendBookingConfirmationEmail,
  sendBookingAcceptedEmail,
  sendBookingCancelledEmail,
  sendBookingRejectedEmail,
  sendBookingCompletedEmail,
  sendBookingReminderEmail,

  // New comprehensive booking emails
  sendBookingConfirmation,
  sendBookingReminder,
  sendBookingCancellation,
  sendBookingRescheduled,

  // Provider emails
  sendProviderApproval,
  sendProviderRejection,

  // Loyalty emails
  sendLoyaltyPointsEmail,

  // Payment emails
  sendPaymentReceiptEmail,

  // Withdrawal/Payout emails
  sendWithdrawalApproved,

  // Batch sending
  sendBatch,
};