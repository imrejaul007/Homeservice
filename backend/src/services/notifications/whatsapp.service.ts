/**
 * WhatsApp Business API Service
 * Handles WhatsApp messaging for the Home Services Marketplace
 *
 * Features:
 * - WhatsApp Business API client setup
 * - Template message sending
 * - Incoming message handling
 * - Template approval workflow
 * - Rate limiting per WhatsApp rules
 */

import axios, { AxiosInstance } from 'axios';
import User from '../../models/user.model';
import BookingNotification from '../../models/bookingNotification.model';
import { withRetry, retryConfigs } from '../../utils/retry.util';
import logger from '../../utils/logger';
import { ApiError, ERROR_CODES } from '../../utils/ApiError';
import { createCircuitBreaker, CIRCUIT_NAMES } from '../circuitBreaker.service';
import { cache } from '../../config/redis';

// ============================================
// Types
// ============================================

export type WhatsAppMessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'failed_permanently';

export type WhatsAppTemplateStatus = 'pending' | 'approved' | 'rejected' | 'disabled';

export interface WhatsAppConfig {
  apiVersion: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
}

export interface WhatsAppMessage {
  to: string;
  type: 'text' | 'template' | 'image' | 'document' | 'location';
  content: WhatsAppTextContent | WhatsAppTemplateContent | WhatsAppImageContent;
  webhookUrl?: string;
}

export interface WhatsAppTextContent {
  body: string;
  preview_url?: boolean;
}

export interface WhatsAppTemplateContent {
  name: string;
  language: {
    code: string;
    policy?: 'deterministic';
  };
  components?: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'footer' | 'buttons';
  format?: 'text' | 'image' | 'video' | 'document';
  text?: string;
  image?: { link: string };
  video?: { link: string };
  document?: { link: string; filename?: string };
  buttons?: WhatsAppButton[];
}

export interface WhatsAppButton {
  type: 'reply' | 'url' | 'otp' | 'copy';
  text: string;
  reply?: { id: string; title: string };
  url?: string;
  phone_number?: string;
}

export interface WhatsAppImageContent {
  link?: string;
  id?: string;
  caption?: string;
}

export interface WhatsAppIncomingMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: string;
  [key: string]: any;
}

export interface WhatsAppTemplate {
  name: string;
  status: WhatsAppTemplateStatus;
  category: string;
  language: string[];
  components: WhatsAppTemplateComponent[];
  createdAt: Date;
  approvedAt?: Date;
  rejectionReason?: string;
}

// ============================================
// Rate Limiting (WhatsApp Business API Limits)
// ============================================

// WhatsApp Business API rate limits:
// - 250 messages/minute per phone number
// - 1000 messages/24h for standard accounts
// - 10000 messages/24h for verified business accounts

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_MESSAGES = 250;
const DAILY_LIMIT_STANDARD = 1000;
const DAILY_LIMIT_VERIFIED = 10000;

// In-memory fallback cache
const rateLimitCache = new Map<string, { count: number; windowStart: number }>();
const dailyLimitCache = new Map<string, { count: number; date: string }>();

// ============================================
// WhatsApp Business API Configuration
// ============================================

const initializeWhatsAppClient = (): { client: AxiosInstance; config: WhatsAppConfig } | null => {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';

  if (!accessToken || !phoneNumberId) {
    logger.info('WhatsApp Business API not configured - WhatsApp notifications will be skipped', {
      context: 'WhatsAppService',
      action: 'WHATSAPP_NOT_CONFIGURED',
    });
    return null;
  }

  const config: WhatsAppConfig = {
    apiVersion,
    phoneNumberId,
    businessAccountId: businessAccountId || '',
    accessToken,
  };

  const client = axios.create({
    baseURL: `https://graph.facebook.com/${apiVersion}`,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  logger.info('WhatsApp Business API client initialized', {
    context: 'WhatsAppService',
    action: 'WHATSAPP_INIT_SUCCESS',
    phoneNumberId,
  });

  return { client, config };
};

const whatsappConfig = initializeWhatsAppClient();

// Circuit breaker for WhatsApp API calls
const whatsappCircuitBreaker = createCircuitBreaker(CIRCUIT_NAMES.NOTIFICATION || 'whatsapp', {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 2,
});

// ============================================
// Helper Functions
// ============================================

/**
 * Mask phone number for logging (privacy)
 */
function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 4) return '****';
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned.slice(0, -4).replace(/./g, '*') + cleaned.slice(-4);
}

/**
 * Clean and validate phone number for WhatsApp (must include country code)
 */
function cleanPhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // If doesn't start with +, add default country code
  if (!cleaned.startsWith('+')) {
    // Default to UAE (+971) if not specified
    if (cleaned.length === 9) {
      // Looks like UAE mobile without country code
      cleaned = '+971' + cleaned;
    } else if (cleaned.length === 10) {
      // US format without country code
      cleaned = '+1' + cleaned;
    } else {
      cleaned = '+' + cleaned;
    }
  }

  return cleaned;
}

/**
 * Check if phone number is valid for WhatsApp
 */
function isValidWhatsAppPhone(phone: string): boolean {
  const cleaned = cleanPhoneNumber(phone);
  // E.164 format validation
  const e164Pattern = /^\+[1-9]\d{7,14}$/;
  return e164Pattern.test(cleaned);
}

/**
 * Check and update rate limit for a phone number
 */
async function checkRateLimit(phoneNumberId: string): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const cacheKey = `whatsapp:rate:${phoneNumberId}`;
  const now = Date.now();

  // Try Redis first
  try {
    const redisClient = (cache as any).client;
    if (redisClient) {
      const data = await redisClient.hgetall(cacheKey);

      if (data && data.windowStart) {
        const windowStart = parseInt(data.windowStart, 10);
        const count = parseInt(data.count || '0', 10);

        if (now - windowStart < RATE_LIMIT_WINDOW_MS) {
          if (count >= RATE_LIMIT_MAX_MESSAGES) {
            return {
              allowed: false,
              remaining: 0,
              resetMs: RATE_LIMIT_WINDOW_MS - (now - windowStart),
            };
          }
          return {
            allowed: true,
            remaining: RATE_LIMIT_MAX_MESSAGES - count,
            resetMs: RATE_LIMIT_WINDOW_MS - (now - windowStart),
          };
        }
      }

      // Window expired or no data - reset
      await redisClient.hmset(cacheKey, { count: '1', windowStart: now.toString() });
      await redisClient.expire(cacheKey, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) + 1);
      return { allowed: true, remaining: RATE_LIMIT_MAX_MESSAGES - 1, resetMs: RATE_LIMIT_WINDOW_MS };
    }
  } catch (error) {
    logger.warn('Redis rate limit check failed, using in-memory fallback', {
      context: 'WhatsAppService',
      action: 'RATE_LIMIT_REDIS_FALLBACK',
      error: (error as Error).message,
    });
  }

  // Fallback to in-memory cache
  const entry = rateLimitCache.get(phoneNumberId);
  if (entry && now - entry.windowStart < RATE_LIMIT_WINDOW_MS) {
    if (entry.count >= RATE_LIMIT_MAX_MESSAGES) {
      return {
        allowed: false,
        remaining: 0,
        resetMs: RATE_LIMIT_WINDOW_MS - (now - entry.windowStart),
      };
    }
    entry.count++;
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX_MESSAGES - entry.count,
      resetMs: RATE_LIMIT_WINDOW_MS - (now - entry.windowStart),
    };
  }

  rateLimitCache.set(phoneNumberId, { count: 1, windowStart: now });
  return { allowed: true, remaining: RATE_LIMIT_MAX_MESSAGES - 1, resetMs: RATE_LIMIT_WINDOW_MS };
}

/**
 * Check daily limit for a business account
 */
async function checkDailyLimit(businessAccountId: string, isVerified: boolean = false): Promise<{ allowed: boolean; remaining: number; resetsAt: Date }> {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `whatsapp:daily:${businessAccountId}`;
  const limit = isVerified ? DAILY_LIMIT_VERIFIED : DAILY_LIMIT_STANDARD;
  const now = Date.now();

  // Try Redis first
  try {
    const redisClient = (cache as any).client;
    if (redisClient) {
      const data = await redisClient.hgetall(cacheKey);

      if (data && data.date === today) {
        const count = parseInt(data.count || '0', 10);
        if (count >= limit) {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return {
            allowed: false,
            remaining: 0,
            resetsAt: tomorrow,
          };
        }
        const nextReset = new Date(today);
        nextReset.setDate(nextReset.getDate() + 1);
        nextReset.setHours(0, 0, 0, 0);
        return {
          allowed: true,
          remaining: limit - count,
          resetsAt: nextReset,
        };
      }

      // New day - reset
      await redisClient.hmset(cacheKey, { count: '1', date: today });
      await redisClient.expire(cacheKey, 86400); // 24 hours
      return { allowed: true, remaining: limit - 1, resetsAt: new Date(today + 'T23:59:59Z') };
    }
  } catch (error) {
    logger.warn('Redis daily limit check failed, using in-memory fallback', {
      context: 'WhatsAppService',
      action: 'DAILY_LIMIT_REDIS_FALLBACK',
      error: (error as Error).message,
    });
  }

  // Fallback to in-memory cache
  const entry = dailyLimitCache.get(businessAccountId);
  if (entry && entry.date === today) {
    if (entry.count >= limit) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return { allowed: false, remaining: 0, resetsAt: tomorrow };
    }
    entry.count++;
    return { allowed: true, remaining: limit - entry.count, resetsAt: new Date(today + 'T23:59:59Z') };
  }

  dailyLimitCache.set(businessAccountId, { count: 1, date: today });
  return { allowed: true, remaining: limit - 1, resetsAt: new Date(today + 'T23:59:59Z') };
}

// ============================================
// WhatsApp Service Class
// ============================================

export class WhatsAppService {
  private readonly config: WhatsAppConfig | null;
  private readonly client: AxiosInstance | null;

  constructor() {
    this.config = whatsappConfig?.config || null;
    this.client = whatsappConfig?.client || null;
  }

  /**
   * Check if WhatsApp service is configured
   */
  isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  // ========================================
  // Send Message Methods
  // ========================================

  /**
   * Send a text message via WhatsApp
   */
  async sendTextMessage(
    phoneNumber: string,
    message: string,
    options?: {
      previewUrl?: boolean;
      notificationId?: string;
      userId?: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'WhatsApp not configured' };
    }

    const cleanedPhone = cleanPhoneNumber(phoneNumber);

    if (!isValidWhatsAppPhone(cleanedPhone)) {
      logger.warn('Invalid WhatsApp phone number', {
        context: 'WhatsAppService',
        action: 'INVALID_PHONE',
        phoneNumber: maskPhoneNumber(phoneNumber),
      });
      return { success: false, error: 'Invalid phone number format' };
    }

    // Check rate limits
    const rateCheck = await checkRateLimit(this.config!.phoneNumberId);
    if (!rateCheck.allowed) {
      logger.warn('WhatsApp rate limit exceeded', {
        context: 'WhatsAppService',
        action: 'RATE_LIMIT_EXCEEDED',
        remainingMs: rateCheck.resetMs,
      });
      return { success: false, error: `Rate limit exceeded. Retry in ${Math.ceil(rateCheck.resetMs / 1000)}s` };
    }

    // Check daily limit
    const dailyCheck = await checkDailyLimit(this.config!.businessAccountId);
    if (!dailyCheck.allowed) {
      logger.warn('WhatsApp daily limit exceeded', {
        context: 'WhatsAppService',
        action: 'DAILY_LIMIT_EXCEEDED',
        resetsAt: dailyCheck.resetsAt.toISOString(),
      });
      return { success: false, error: `Daily limit exceeded. Resets at ${dailyCheck.resetsAt.toISOString()}` };
    }

    // Check user opt-out
    const optedOut = await this.checkOptOut(cleanedPhone);
    if (optedOut) {
      logger.debug('WhatsApp message skipped - user opted out', {
        context: 'WhatsAppService',
        action: 'USER_OPTED_OUT',
        phoneNumber: maskPhoneNumber(cleanedPhone),
      });
      return { success: false, error: 'User has opted out of WhatsApp' };
    }

    // Execute with circuit breaker and retry
    return this.executeWithRetry(
      async () => {
        const response = await this.client!.post(`/${this.config!.phoneNumberId}/messages`, {
          messaging_product: 'whatsapp',
          to: cleanedPhone,
          type: 'text',
          text: {
            body: message.substring(0, 4096), // WhatsApp text limit
            preview_url: options?.previewUrl ?? false,
          },
        });

        const messageId = response.data.messages[0].id;

        logger.info('WhatsApp text message sent', {
          context: 'WhatsAppService',
          action: 'MESSAGE_SENT',
          messageId,
          to: maskPhoneNumber(cleanedPhone),
        });

        // Update notification record if provided
        if (options?.notificationId) {
          await this.updateNotificationWhatsAppStatus(options.notificationId, {
            sent: true,
            sentAt: new Date(),
            messageId,
            deliveryStatus: 'queued',
          });
        }

        return { success: true, messageId };
      },
      options?.userId
    );
  }

  /**
   * Send a template message via WhatsApp
   */
  async sendTemplateMessage(
    phoneNumber: string,
    templateName: string,
    languageCode: string = 'en',
    components?: WhatsAppTemplateComponent[],
    options?: {
      notificationId?: string;
      userId?: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'WhatsApp not configured' };
    }

    const cleanedPhone = cleanPhoneNumber(phoneNumber);

    if (!isValidWhatsAppPhone(cleanedPhone)) {
      return { success: false, error: 'Invalid phone number format' };
    }

    // Check rate limits
    const rateCheck = await checkRateLimit(this.config!.phoneNumberId);
    if (!rateCheck.allowed) {
      return { success: false, error: `Rate limit exceeded. Retry in ${Math.ceil(rateCheck.resetMs / 1000)}s` };
    }

    // Check daily limit
    const dailyCheck = await checkDailyLimit(this.config!.businessAccountId);
    if (!dailyCheck.allowed) {
      return { success: false, error: `Daily limit exceeded. Resets at ${dailyCheck.resetsAt.toISOString()}` };
    }

    // Check user opt-out
    const optedOut = await this.checkOptOut(cleanedPhone);
    if (optedOut) {
      return { success: false, error: 'User has opted out of WhatsApp' };
    }

    // Execute with circuit breaker and retry
    return this.executeWithRetry(
      async () => {
        const payload: any = {
          messaging_product: 'whatsapp',
          to: cleanedPhone,
          type: 'template',
          template: {
            name: templateName,
            language: {
              code: languageCode,
              policy: 'deterministic',
            },
          },
        };

        if (components && components.length > 0) {
          payload.template.components = components;
        }

        const response = await this.client!.post(`/${this.config!.phoneNumberId}/messages`, payload);
        const messageId = response.data.messages[0].id;

        logger.info('WhatsApp template message sent', {
          context: 'WhatsAppService',
          action: 'TEMPLATE_SENT',
          messageId,
          templateName,
          to: maskPhoneNumber(cleanedPhone),
        });

        // Update notification record if provided
        if (options?.notificationId) {
          await this.updateNotificationWhatsAppStatus(options.notificationId, {
            sent: true,
            sentAt: new Date(),
            messageId,
            deliveryStatus: 'queued',
          });
        }

        return { success: true, messageId };
      },
      options?.userId
    );
  }

  /**
   * Send booking-related WhatsApp notification
   */
  async sendBookingNotification(
    phoneNumber: string,
    bookingNumber: string,
    eventType: 'confirmed' | 'reminder' | 'cancelled' | 'completed' | 'started' | 'provider_assigned',
    metadata?: {
      providerName?: string;
      serviceName?: string;
      scheduledDate?: string;
      totalAmount?: string;
      currency?: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Map event types to template names
    const templateMap: Record<string, string> = {
      confirmed: 'booking_confirmed',
      reminder: 'booking_reminder',
      cancelled: 'booking_cancelled',
      completed: 'booking_completed',
      started: 'booking_started',
      provider_assigned: 'provider_assigned',
    };

    const templateName = templateMap[eventType];
    const components: WhatsAppTemplateComponent[] = [
      {
        type: 'body',
        text: `Booking #${bookingNumber}`,
      },
    ];

    // Add variable components based on metadata
    if (metadata) {
      let bodyText = `Booking #${bookingNumber}`;
      const variables: string[] = [];

      if (eventType === 'confirmed' && metadata.serviceName) {
        variables.push(metadata.serviceName);
      }
      if (eventType === 'reminder' && metadata.scheduledDate) {
        variables.push(metadata.scheduledDate);
      }
      if (metadata.providerName) {
        variables.push(metadata.providerName);
      }

      if (variables.length > 0) {
        bodyText += ` - ${variables.join(' | ')}`;
      }

      components[0].text = bodyText;
    }

    return this.sendTemplateMessage(phoneNumber, templateName, 'en', components);
  }

  /**
   * Send OTP via WhatsApp
   */
  async sendOtp(
    phoneNumber: string,
    otp: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // OTP templates typically need pre-approval from Meta
    // This uses the approved OTP template name
    return this.sendTemplateMessage(
      phoneNumber,
      'otp_verification',
      'en',
      [
        {
          type: 'body',
          text: otp,
        },
        {
          type: 'footer',
          text: 'This code expires in 10 minutes. Do not share it with anyone.',
        },
      ]
    );
  }

  // ========================================
  // Message Status Webhooks
  // ========================================

  /**
   * Process message status webhook from WhatsApp
   */
  async processStatusWebhook(payload: {
    statuses?: Array<{
      id: string;
      status: string;
      timestamp: string;
      recipient_id: string;
      error?: { code: string; title: string };
    }>;
  }): Promise<void> {
    if (!payload.statuses || payload.statuses.length === 0) {
      return;
    }

    for (const status of payload.statuses) {
      try {
        const deliveryStatus = this.mapWhatsAppStatus(status.status);

        logger.debug('Processing WhatsApp message status', {
          context: 'WhatsAppService',
          action: 'STATUS_WEBHOOK',
          messageId: status.id,
          status: status.status,
          mappedStatus: deliveryStatus,
        });

        // Update notification status
        await BookingNotification.findOneAndUpdate(
          { 'channels.whatsapp.messageId': status.id },
          {
            $set: {
              'channels.whatsapp.deliveryStatus': deliveryStatus,
              'channels.whatsapp.deliveredAt': deliveryStatus === 'delivered' ? new Date(Number(status.timestamp) * 1000) : undefined,
            },
          }
        );

        // Handle permanent failures
        if (status.error && ['131030', '131031', '131026'].includes(status.error.code)) {
          logger.warn('WhatsApp message permanently failed', {
            context: 'WhatsAppService',
            action: 'MESSAGE_FAILED_PERMANENTLY',
            messageId: status.id,
            errorCode: status.error.code,
            errorTitle: status.error.title,
          });

          await BookingNotification.findOneAndUpdate(
            { 'channels.whatsapp.messageId': status.id },
            {
              $set: {
                'channels.whatsapp.deliveryStatus': 'failed_permanently',
                'channels.whatsapp.errorMessage': `${status.error.code}: ${status.error.title}`,
              },
            }
          );
        }
      } catch (error) {
        logger.error('Failed to process WhatsApp status webhook', {
          context: 'WhatsAppService',
          action: 'STATUS_WEBHOOK_ERROR',
          messageId: status.id,
          error: (error as Error).message,
        });
      }
    }
  }

  /**
   * Process incoming message webhook from WhatsApp
   */
  async processIncomingMessage(payload: {
    messages?: Array<{
      from: string;
      id: string;
      timestamp: string;
      type: string;
      text?: { body: string };
      [key: string]: any;
    }>;
  }): Promise<{ processed: number; actions: Map<string, string> }> {
    const result = { processed: 0, actions: new Map<string, string>() };

    if (!payload.messages || payload.messages.length === 0) {
      return result;
    }

    for (const message of payload.messages) {
      try {
        const from = message.from;
        const cleanedPhone = cleanPhoneNumber(from);

        logger.debug('Processing incoming WhatsApp message', {
          context: 'WhatsAppService',
          action: 'INCOMING_MESSAGE',
          from: maskPhoneNumber(cleanedPhone),
          type: message.type,
        });

        result.processed++;

        // Handle different message types
        if (message.type === 'text') {
          const body = message.text?.body?.trim().toUpperCase() || '';

          // Handle STOP/UNSUBSCRIBE
          if (['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END'].includes(body)) {
            await this.optOutUser(cleanedPhone);
            result.actions.set(from, 'unsubscribed');
            logger.info('User opted out via WhatsApp', {
              context: 'WhatsAppService',
              action: 'WHATSAPP_OPT_OUT',
              phone: maskPhoneNumber(cleanedPhone),
            });
          }
          // Handle START
          else if (['START', 'YES', 'UNSTOP'].includes(body)) {
            await this.optInUser(cleanedPhone);
            result.actions.set(from, 'subscribed');
            logger.info('User opted in via WhatsApp', {
              context: 'WhatsAppService',
              action: 'WHATSAPP_OPT_IN',
              phone: maskPhoneNumber(cleanedPhone),
            });
          }
          // Handle HELP
          else if (['HELP', 'INFO', 'MENU'].includes(body)) {
            result.actions.set(from, 'help');
          }
        }

        // Auto-reply with help message for unrecognized commands
        if (result.actions.get(from) === 'help') {
          await this.sendTextMessage(
            from,
            'NILIN Home Services\n\nReply with:\n- STOP to unsubscribe\n- START to resubscribe\n- HELP for support at support@nilin.com',
            { previewUrl: false }
          );
        }
      } catch (error) {
        logger.error('Failed to process incoming WhatsApp message', {
          context: 'WhatsAppService',
          action: 'INCOMING_MESSAGE_ERROR',
          error: (error as Error).message,
        });
      }
    }

    return result;
  }

  // ========================================
  // Template Management
  // ========================================

  /**
   * Get list of approved templates
   */
  async getTemplates(): Promise<WhatsAppTemplate[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const response = await this.client!.get(
        `/${this.config!.businessAccountId}/message_templates`,
        {
          params: {
            fields: 'name,status,category,language,components,created_at,approved_at',
          },
        }
      );

      return response.data.data.map((template: any) => ({
        name: template.name,
        status: template.status,
        category: template.category,
        language: template.language_data?.languages || [template.language],
        components: template.components || [],
        createdAt: new Date(template.created_at * 1000),
        approvedAt: template.approved_at ? new Date(template.approved_at * 1000) : undefined,
        rejectionReason: template.rejection_reason,
      }));
    } catch (error) {
      logger.error('Failed to get WhatsApp templates', {
        context: 'WhatsAppService',
        action: 'GET_TEMPLATES_ERROR',
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Create a new template (for admin use)
   */
  async createTemplate(template: {
    name: string;
    category: string;
    language: string;
    components: WhatsAppTemplateComponent[];
  }): Promise<{ success: boolean; template?: WhatsAppTemplate; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'WhatsApp not configured' };
    }

    try {
      const response = await this.client!.post(
        `/${this.config!.businessAccountId}/message_templates`,
        {
          name: template.name,
          category: template.category,
          language: template.language,
          components: template.components,
        }
      );

      logger.info('WhatsApp template created', {
        context: 'WhatsAppService',
        action: 'TEMPLATE_CREATED',
        templateName: template.name,
      });

      return {
        success: true,
        template: {
          name: response.data.id,
          status: 'pending',
          category: template.category,
          language: [template.language],
          components: template.components,
          createdAt: new Date(),
        },
      };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.message;
      logger.error('Failed to create WhatsApp template', {
        context: 'WhatsAppService',
        action: 'CREATE_TEMPLATE_ERROR',
        error: errorMessage,
      });
      return { success: false, error: errorMessage };
    }
  }

  // ========================================
  // Opt-in/Opt-out Management
  // ========================================

  /**
   * Check if user has opted out of WhatsApp
   */
  private async checkOptOut(phoneNumber: string): Promise<boolean> {
    const cleanedPhone = cleanPhoneNumber(phoneNumber);
    const user = await User.findOne({ phone: cleanedPhone }).select('communicationPreferences');

    if (!user) {
      return false; // Allow if user not found
    }

    const prefs = user.communicationPreferences?.whatsapp;
    return prefs?.enabled === false;
  }

  /**
   * Opt out user from WhatsApp
   */
  async optOutUser(phoneNumber: string): Promise<void> {
    const cleanedPhone = cleanPhoneNumber(phoneNumber);
    const user = await User.findOne({ phone: cleanedPhone });

    if (user) {
      user.communicationPreferences = user.communicationPreferences || {};
      user.communicationPreferences.whatsapp = {
        enabled: false,
        optedOutAt: new Date(),
      };
      await user.save();

      logger.info('User opted out of WhatsApp', {
        context: 'WhatsAppService',
        action: 'WHATSAPP_OPT_OUT_USER',
        userId: user._id.toString(),
        phone: maskPhoneNumber(cleanedPhone),
      });
    }
  }

  /**
   * Opt in user to WhatsApp
   */
  async optInUser(phoneNumber: string): Promise<void> {
    const cleanedPhone = cleanPhoneNumber(phoneNumber);
    const user = await User.findOne({ phone: cleanedPhone });

    if (user) {
      user.communicationPreferences = user.communicationPreferences || {};
      user.communicationPreferences.whatsapp = {
        enabled: true,
        optedInAt: new Date(),
      };
      await user.save();

      logger.info('User opted in to WhatsApp', {
        context: 'WhatsAppService',
        action: 'WHATSAPP_OPT_IN_USER',
        userId: user._id.toString(),
        phone: maskPhoneNumber(cleanedPhone),
      });
    }
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Execute WhatsApp API call with circuit breaker and retry
   */
  private async executeWithRetry<T>(
    operation: () => Promise<{ success: boolean; messageId?: string; error?: string }>,
    userId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return whatsappCircuitBreaker.execute(
      async () => {
        const result = await withRetry(operation, retryConfigs.standard);

        if (!result.success) {
          throw result.error || new Error('WhatsApp API call failed');
        }

        return result.result!;
      },
      async () => {
        // Circuit breaker fallback
        logger.warn('WhatsApp circuit breaker fallback', {
          context: 'WhatsAppService',
          action: 'CIRCUIT_BREAKER_FALLBACK',
          userId,
        });
        return { success: false, error: 'Service temporarily unavailable' };
      }
    );
  }

  /**
   * Map WhatsApp status to internal status
   */
  private mapWhatsAppStatus(status: string): WhatsAppMessageStatus {
    const statusMap: Record<string, WhatsAppMessageStatus> = {
      queued: 'queued',
      sent: 'sent',
      delivered: 'delivered',
      read: 'read',
      failed: 'failed',
      'failed_permanently': 'failed_permanently',
    };
    return statusMap[status] || 'failed';
  }

  /**
   * Update notification WhatsApp channel status
   */
  private async updateNotificationWhatsAppStatus(
    notificationId: string,
    updates: Partial<{
      sent: boolean;
      sentAt: Date;
      messageId: string;
      errorMessage: string;
      deliveryStatus: WhatsAppMessageStatus;
    }>
  ): Promise<void> {
    try {
      await BookingNotification.findByIdAndUpdate(notificationId, {
        $set: {
          'channels.whatsapp': {
            ...updates,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to update notification WhatsApp status', {
        context: 'WhatsAppService',
        action: 'UPDATE_NOTIFICATION_FAILED',
        notificationId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get WhatsApp opt-in status for a user
   */
  async getOptInStatus(userId: string): Promise<{ enabled: boolean; optedOutAt?: Date; optedInAt?: Date }> {
    const user = await User.findById(userId).select('communicationPreferences.whatsapp');

    if (!user) {
      throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    const prefs = user.communicationPreferences?.whatsapp;
    return {
      enabled: prefs?.enabled ?? false,
      optedOutAt: prefs?.optedOutAt,
      optedInAt: prefs?.optedInAt,
    };
  }

  /**
   * Enable/disable WhatsApp for a user
   */
  async setOptInStatus(userId: string, enabled: boolean): Promise<void> {
    const user = await User.findById(userId);

    if (!user) {
      throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    user.communicationPreferences = user.communicationPreferences || {};
    user.communicationPreferences.whatsapp = {
      enabled,
      ...(enabled ? { optedInAt: new Date() } : { optedOutAt: new Date() }),
    };
    await user.save();

    logger.info('WhatsApp opt-in status updated', {
      context: 'WhatsAppService',
      action: 'OPT_IN_STATUS_UPDATED',
      userId,
      enabled,
    });
  }
}

// Export singleton instance
export const whatsAppService = new WhatsAppService();

