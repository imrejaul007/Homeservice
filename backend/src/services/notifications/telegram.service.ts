/**
 * Telegram Bot Service
 * Handles Telegram Bot API integration for the Home Services Marketplace
 *
 * Features:
 * - Telegram Bot API setup
 * - Send messages via bot
 * - Handle commands
 * - Inline keyboards
 */

import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
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

export interface TelegramConfig {
  botToken: string;
  apiUrl: string;
}

export interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2';
  disable_web_page_preview?: boolean;
  disable_notification?: boolean;
  reply_to_message_id?: number;
  reply_markup?: TelegramInlineKeyboard | TelegramReplyKeyboard | TelegramForceReply;
  caption?: string;
}

export interface TelegramInlineKeyboard {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  login_url?: {
    url: string;
    forward_text?: string;
    bot_username?: string;
  };
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  callback_game?: object;
  pay?: boolean;
}

export interface TelegramReplyKeyboard {
  keyboard: TelegramKeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  selective?: boolean;
}

export interface TelegramKeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
  request_poll?: {
    type?: 'quiz' | 'regular';
  };
}

export interface TelegramForceReply {
  force_reply: boolean;
  selective?: boolean;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramIncomingMessage;
  edited_message?: TelegramIncomingMessage;
  callback_query?: TelegramCallbackQuery;
  channel_post?: TelegramIncomingMessage;
  edited_channel_post?: TelegramIncomingMessage;
  inline_query?: TelegramInlineQuery;
  chosen_inline_result?: TelegramChosenInlineResult;
}

export interface TelegramIncomingMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  caption?: string;
  photo?: TelegramPhoto[];
  document?: TelegramDocument;
  location?: TelegramLocation;
  contact?: TelegramContact;
  entities?: TelegramMessageEntity[];
  reply_to_message?: TelegramIncomingMessage;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  chat_instance: string;
  data?: string;
  inline_message_id?: string;
  message?: TelegramIncomingMessage;
}

export interface TelegramInlineQuery {
  id: string;
  from: TelegramUser;
  query: string;
  offset: string;
}

export interface TelegramChosenInlineResult {
  result_id: string;
  from: TelegramUser;
  query: string;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramPhoto {
  file_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramLocation {
  longitude: number;
  latitude: number;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

export interface TelegramContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
  vcard?: string;
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
}

export interface TelegramBotCommand {
  command: string;
  description: string;
}

export interface TelegramWebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  ip_address?: string;
  last_error_date?: number;
  last_error_message?: string;
  last_synchronize_error_date?: number;
  max_connections?: number;
  protect_content?: boolean;
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    migrate_to_chat_id?: number;
    retry_after?: number;
  };
}

// ============================================
// Telegram Bot Configuration
// ============================================

const initializeTelegramBot = (): { client: AxiosInstance; config: TelegramConfig } | null => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    logger.info('Telegram Bot not configured - Telegram notifications will be skipped', {
      context: 'TelegramService',
      action: 'TELEGRAM_NOT_CONFIGURED',
    });
    return null;
  }

  const config: TelegramConfig = {
    botToken,
    apiUrl: `https://api.telegram.org/bot${botToken}`,
  };

  const client = axios.create({
    baseURL: config.apiUrl,
    timeout: 30000,
  });

  logger.info('Telegram Bot client initialized', {
    context: 'TelegramService',
    action: 'TELEGRAM_INIT_SUCCESS',
  });

  return { client, config };
};

const telegramConfig = initializeTelegramBot();

// Circuit breaker for Telegram API calls
const telegramCircuitBreaker = createCircuitBreaker(CIRCUIT_NAMES.NOTIFICATION || 'telegram', {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 2,
});

// Rate limiting
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_MESSAGES = 30;
const rateLimitCache = new Map<string, { count: number; windowStart: number }>();

// ============================================
// Helper Functions
// ============================================

/**
 * Check and update rate limit for a chat
 */
async function checkTelegramRateLimit(chatId: string): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  const cacheKey = `telegram:rate:${chatId}`;
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

      // Window expired - reset
      await redisClient.hmset(cacheKey, { count: '1', windowStart: now.toString() });
      await redisClient.expire(cacheKey, Math.ceil(RATE_LIMIT_WINDOW_MS / 1000) + 1);
      return { allowed: true, remaining: RATE_LIMIT_MAX_MESSAGES - 1, resetMs: RATE_LIMIT_WINDOW_MS };
    }
  } catch (error) {
    logger.warn('Redis Telegram rate limit check failed, using in-memory fallback', {
      context: 'TelegramService',
      action: 'RATE_LIMIT_FALLBACK',
      error: (error as Error).message,
    });
  }

  // Fallback to in-memory cache
  const entry = rateLimitCache.get(chatId);
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

  rateLimitCache.set(chatId, { count: 1, windowStart: now });
  return { allowed: true, remaining: RATE_LIMIT_MAX_MESSAGES - 1, resetMs: RATE_LIMIT_WINDOW_MS };
}

/**
 * Escape HTML for safe rendering
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape MarkdownV2 for safe rendering
 */
function escapeMarkdownV2(text: string): string {
  // Characters that need to be escaped in MarkdownV2
  const specialChars = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];
  let escaped = text;
  for (const char of specialChars) {
    escaped = escaped.split(char).join('\\' + char);
  }
  return escaped;
}

/**
 * Generate inline keyboard for booking actions
 */
function createBookingInlineKeyboard(
  bookingNumber: string,
  actions: Array<'view' | 'confirm' | 'cancel' | 'contact'> = ['view', 'confirm', 'cancel']
): TelegramInlineKeyboard {
  const buttons: TelegramInlineKeyboardButton[] = [];

  if (actions.includes('view')) {
    buttons.push({
      text: 'View Details',
      callback_data: `booking_view:${bookingNumber}`,
    });
  }
  if (actions.includes('confirm')) {
    buttons.push({
      text: 'Confirm',
      callback_data: `booking_confirm:${bookingNumber}`,
    });
  }
  if (actions.includes('cancel')) {
    buttons.push({
      text: 'Cancel',
      callback_data: `booking_cancel:${bookingNumber}`,
    });
  }
  if (actions.includes('contact')) {
    buttons.push({
      text: 'Contact Provider',
      callback_data: `booking_contact:${bookingNumber}`,
    });
  }

  return {
    inline_keyboard: [buttons],
  };
}

/**
 * Generate main menu inline keyboard
 */
function createMainMenuKeyboard(): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: 'My Bookings', callback_data: 'menu_bookings' },
        { text: 'Profile', callback_data: 'menu_profile' },
      ],
      [
        { text: 'Services', callback_data: 'menu_services' },
        { text: 'Help', callback_data: 'menu_help' },
      ],
      [
        { text: 'Settings', callback_data: 'menu_settings' },
      ],
    ],
  };
}

// ============================================
// Telegram Service Class
// ============================================

export class TelegramService {
  private readonly client: AxiosInstance | null;
  private readonly config: TelegramConfig | null;

  constructor() {
    this.client = telegramConfig?.client || null;
    this.config = telegramConfig?.config || null;
  }

  /**
   * Check if Telegram service is configured
   */
  isConfigured(): boolean {
    return this.client !== null && this.config !== null;
  }

  /**
   * Get bot info
   */
  async getMe(): Promise<TelegramUser | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await this.client!.get('/getMe');
      return response.data.result;
    } catch (error) {
      logger.error('Failed to get Telegram bot info', {
        context: 'TelegramService',
        action: 'GET_ME_ERROR',
        error: (error as Error).message,
      });
      return null;
    }
  }

  // ========================================
  // Message Sending
  // ========================================

  /**
   * Send a text message
   */
  async sendMessage(
    chatId: string | number,
    text: string,
    options?: {
      parseMode?: 'Markdown' | 'HTML' | 'MarkdownV2';
      disableWebPagePreview?: boolean;
      disableNotification?: boolean;
      replyToMessageId?: number;
      replyMarkup?: TelegramInlineKeyboard | TelegramReplyKeyboard | TelegramForceReply;
      notificationId?: string;
      userId?: string;
    }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Telegram not configured' };
    }

    // Check rate limit
    const rateCheck = await checkTelegramRateLimit(String(chatId));
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Rate limit exceeded. Retry in ${Math.ceil(rateCheck.resetMs / 1000)}s`,
      };
    }

    // Check user opt-out
    const optedOut = await this.checkOptOut(String(chatId));
    if (optedOut) {
      return { success: false, error: 'User has opted out of Telegram' };
    }

    // Execute with circuit breaker and retry
    return this.executeWithRetry(
      async () => {
        const message: TelegramMessage = {
          chat_id: chatId,
          text: text.substring(0, 4096), // Telegram message limit
          parse_mode: options?.parseMode,
          disable_web_page_preview: options?.disableWebPagePreview,
          disable_notification: options?.disableNotification,
          reply_to_message_id: options?.replyToMessageId,
          reply_markup: options?.replyMarkup,
        };

        const response = await this.client!.post('/sendMessage', message);
        const messageId = response.data.result.message_id;

        logger.info('Telegram message sent', {
          context: 'TelegramService',
          action: 'MESSAGE_SENT',
          chatId,
          messageId,
        });

        // Update notification record if provided
        if (options?.notificationId) {
          await this.updateNotificationTelegramStatus(options.notificationId, {
            sent: true,
            sentAt: new Date(),
            messageId: String(messageId),
            deliveryStatus: 'delivered',
          });
        }

        return { success: true, messageId };
      },
      options?.userId
    );
  }

  /**
   * Send a message with inline keyboard
   */
  async sendMessageWithKeyboard(
    chatId: string | number,
    text: string,
    keyboard: TelegramInlineKeyboard,
    options?: {
      parseMode?: 'Markdown' | 'HTML' | 'MarkdownV2';
      notificationId?: string;
      userId?: string;
    }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    return this.sendMessage(chatId, text, {
      ...options,
      replyMarkup: keyboard,
    });
  }

  /**
   * Send booking notification
   */
  async sendBookingNotification(
    chatId: string | number,
    bookingNumber: string,
    eventType: 'confirmed' | 'reminder' | 'cancelled' | 'completed' | 'started' | 'new_request',
    metadata?: {
      providerName?: string;
      serviceName?: string;
      scheduledDate?: string;
      totalAmount?: string;
      currency?: string;
    }
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    const formatOptions = { parseMode: 'HTML' as const };

    switch (eventType) {
      case 'confirmed':
        return this.sendMessageWithKeyboard(
          chatId,
          `<b>Booking Confirmed!</b>\n\n` +
          `Booking #: ${escapeHtml(bookingNumber)}\n` +
          `Service: ${escapeHtml(metadata?.serviceName || 'N/A')}\n` +
          `${metadata?.scheduledDate ? `Date: ${escapeHtml(metadata.scheduledDate)}\n` : ''}` +
          `${metadata?.totalAmount ? `Amount: ${escapeHtml(metadata.currency || '')} ${escapeHtml(metadata.totalAmount)}\n` : ''}`,
          createBookingInlineKeyboard(bookingNumber, ['view', 'contact']),
          { ...formatOptions, notificationId: metadata?.providerName ? undefined : undefined }
        );

      case 'reminder':
        return this.sendMessageWithKeyboard(
          chatId,
          `<b>Booking Reminder</b>\n\n` +
          `Booking #: ${escapeHtml(bookingNumber)}\n` +
          `${metadata?.scheduledDate ? `Scheduled: ${escapeHtml(metadata.scheduledDate)}\n` : ''}` +
          `${metadata?.providerName ? `Provider: ${escapeHtml(metadata.providerName)}\n` : ''}`,
          createBookingInlineKeyboard(bookingNumber, ['view']),
          { ...formatOptions }
        );

      case 'cancelled':
        return this.sendMessage(
          chatId,
          `<b>Booking Cancelled</b>\n\n` +
          `Booking #: ${escapeHtml(bookingNumber)}\n` +
          `This booking has been cancelled.`,
          { ...formatOptions }
        );

      case 'completed':
        return this.sendMessageWithKeyboard(
          chatId,
          `<b>Service Completed!</b>\n\n` +
          `Booking #: ${escapeHtml(bookingNumber)}\n` +
          `${metadata?.providerName ? `Provider: ${escapeHtml(metadata.providerName)}\n` : ''}` +
          `Thank you for using NILIN!`,
          createBookingInlineKeyboard(bookingNumber, ['view']),
          { ...formatOptions }
        );

      case 'started':
        return this.sendMessage(
          chatId,
          `<b>Service Started</b>\n\n` +
          `Booking #: ${escapeHtml(bookingNumber)}\n` +
          `${metadata?.providerName ? `Provider: ${escapeHtml(metadata.providerName)} is on the way!\n` : ''}`,
          { ...formatOptions }
        );

      case 'new_request':
        return this.sendMessageWithKeyboard(
          chatId,
          `<b>New Booking Request!</b>\n\n` +
          `Booking #: ${escapeHtml(bookingNumber)}\n` +
          `Service: ${escapeHtml(metadata?.serviceName || 'N/A')}\n` +
          `${metadata?.scheduledDate ? `Date: ${escapeHtml(metadata.scheduledDate)}\n` : ''}` +
          `${metadata?.totalAmount ? `Amount: ${escapeHtml(metadata.currency || '')} ${escapeHtml(metadata.totalAmount)}\n` : ''}`,
          createBookingInlineKeyboard(bookingNumber, ['confirm', 'cancel']),
          { ...formatOptions }
        );

      default:
        return { success: false, error: 'Unknown event type' };
    }
  }

  /**
   * Send main menu message
   */
  async sendMainMenu(chatId: string | number): Promise<{ success: boolean; messageId?: number; error?: string }> {
    return this.sendMessageWithKeyboard(
      chatId,
      `<b>Welcome to NILIN Home Services!</b>\n\n` +
      `What would you like to do?`,
      createMainMenuKeyboard(),
      { parseMode: 'HTML' }
    );
  }

  // ========================================
  // Command Handling
  // ========================================

  /**
   * Set bot commands
   */
  async setCommands(commands: TelegramBotCommand[]): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      await this.client!.post('/setMyCommands', { commands });
      logger.info('Telegram bot commands set', {
        context: 'TelegramService',
        action: 'SET_COMMANDS',
        commands: commands.map(c => c.command),
      });
      return true;
    } catch (error) {
      logger.error('Failed to set Telegram bot commands', {
        context: 'TelegramService',
        action: 'SET_COMMANDS_ERROR',
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Process incoming update (webhook handler)
   */
  async processUpdate(update: TelegramUpdate): Promise<void> {
    // Handle callback query
    if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
      return;
    }

    // Handle message
    if (update.message) {
      await this.handleMessage(update.message);
      return;
    }

    // Handle inline query
    if (update.inline_query) {
      await this.handleInlineQuery(update.inline_query);
      return;
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: TelegramIncomingMessage): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text?.trim().toLowerCase() || '';
    const from = message.from;

    if (!from || !text) return;

    logger.debug('Processing Telegram message', {
      context: 'TelegramService',
      action: 'INCOMING_MESSAGE',
      chatId,
      text,
    });

    // Handle commands
    if (text.startsWith('/')) {
      await this.handleCommand(message, text);
      return;
    }

    // Handle menu commands
    switch (text) {
      case 'menu':
      case 'start':
        await this.sendMainMenu(chatId);
        break;
      case 'help':
        await this.sendMessage(chatId,
          `<b>NILIN Help</b>\n\n` +
          `Commands:\n` +
          `/start - Open main menu\n` +
          `/bookings - View your bookings\n` +
          `/profile - View your profile\n` +
          `/help - Show this help\n` +
          `/settings - Manage settings\n` +
          `/stop - Unsubscribe from notifications`,
          { parseMode: 'HTML' }
        );
        break;
      case 'bookings':
        await this.sendMessage(chatId,
          `Use the NILIN app to view your bookings.\n` +
          `Download: https://nilin.com/app`,
          { disableWebPagePreview: true }
        );
        break;
      case 'profile':
        await this.sendMessage(chatId,
          `Use the NILIN app to view your profile.\n` +
          `Download: https://nilin.com/app`,
          { disableWebPagePreview: true }
        );
        break;
      case 'settings':
        await this.sendMessage(chatId,
          `Manage your notification settings in the NILIN app.\n` +
          `Download: https://nilin.com/app`,
          { disableWebPagePreview: true }
        );
        break;
      case 'stop':
        await this.optOutUser(String(chatId));
        await this.sendMessage(chatId,
          `You have been unsubscribed from NILIN notifications.\n` +
          `Send /start to resubscribe.`
        );
        break;
      default:
        await this.sendMessage(chatId,
          `I didn't understand that. Type /help for available commands.`
        );
    }
  }

  /**
   * Handle command messages
   */
  private async handleCommand(message: TelegramIncomingMessage, command: string): Promise<void> {
    const chatId = message.chat.id;
    const parts = command.slice(1).split('@');
    const cmd = parts[0].toLowerCase();
    const botUsername = parts[1];

    // Verify bot username if provided
    if (botUsername) {
      const botInfo = await this.getMe();
      if (botInfo && botInfo.username !== botUsername) {
        return; // Command not for this bot
      }
    }

    switch (cmd) {
      case 'start':
      case 'menu':
        await this.sendMainMenu(chatId);
        // If this is a deep link start, process it
        if (command.includes(' ')) {
          const payload = command.split(' ')[1];
          if (payload) {
            await this.handleDeepLink(chatId, payload);
          }
        }
        break;

      case 'help':
        await this.handleCommandHelp(chatId);
        break;

      case 'bookings':
        await this.handleCommandBookings(chatId);
        break;

      case 'profile':
        await this.handleCommandProfile(chatId);
        break;

      case 'settings':
        await this.handleCommandSettings(chatId);
        break;

      case 'stop':
      case 'unsubscribe':
        await this.optOutUser(String(chatId));
        await this.sendMessage(chatId,
          `You have been unsubscribed from NILIN notifications.\n` +
          `Send /start to resubscribe.`
        );
        break;

      case 'status':
        await this.handleCommandStatus(chatId, message.from);
        break;

      default:
        await this.sendMessage(chatId, `Unknown command: ${cmd}`);
    }
  }

  /**
   * Handle callback query (inline keyboard button clicks)
   */
  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const chatId = query.chat_instance;
    const data = query.data || '';

    logger.debug('Processing Telegram callback query', {
      context: 'TelegramService',
      action: 'CALLBACK_QUERY',
      data,
    });

    // Acknowledge callback query first
    if (this.client) {
      await this.client.post('/answerCallbackQuery', {
        callback_query_id: query.id,
      });
    }

    // Parse callback data
    const [action, ...params] = data.split(':');
    const param = params.join(':');

    switch (action) {
      case 'menu_bookings':
        await this.sendMessage(chatId, `Your bookings are in the NILIN app.`);
        break;

      case 'menu_profile':
        await this.sendMessage(chatId, `Your profile is in the NILIN app.`);
        break;

      case 'menu_services':
        await this.sendMessage(chatId, `Browse services at https://nilin.com/services.`);
        break;

      case 'menu_help':
        await this.handleCommandHelp(chatId);
        break;

      case 'menu_settings':
        await this.handleCommandSettings(chatId);
        break;

      case 'booking_view':
        await this.sendMessage(chatId,
          `View booking details in the NILIN app.\n` +
          `Booking: ${escapeHtml(param)}`,
          { parseMode: 'HTML' }
        );
        break;

      case 'booking_confirm':
        await this.sendMessage(chatId,
          `Booking ${escapeHtml(param)} confirmed via Telegram.`,
          { parseMode: 'HTML' }
        );
        // Here you would trigger the booking confirmation via API
        break;

      case 'booking_cancel':
        await this.sendMessage(chatId,
          `To cancel booking ${escapeHtml(param)}, please use the NILIN app.`,
          { parseMode: 'HTML' }
        );
        break;

      case 'booking_contact':
        await this.sendMessage(chatId,
          `Contact your provider via the NILIN app for booking ${escapeHtml(param)}.`,
          { parseMode: 'HTML' }
        );
        break;

      default:
        await this.sendMessage(chatId, `Unknown action: ${action}`);
    }
  }

  /**
   * Handle inline query
   */
  private async handleInlineQuery(query: TelegramInlineQuery): Promise<void> {
    // Could implement inline search for bookings here
    logger.debug('Inline query received', {
      context: 'TelegramService',
      action: 'INLINE_QUERY',
      query: query.query,
    });
  }

  /**
   * Handle deep link payloads
   */
  private async handleDeepLink(chatId: string | number, payload: string): Promise<void> {
    logger.debug('Processing deep link', {
      context: 'TelegramService',
      action: 'DEEP_LINK',
      payload,
    });

    // Parse payload (e.g., booking number, user verification)
    const [type, value] = payload.split('_');

    switch (type) {
      case 'booking':
        await this.sendMessageWithKeyboard(
          chatId,
          `<b>Booking Details</b>\n\n` +
          `Booking #: ${escapeHtml(value)}\n\n` +
          `View full details in the app.`,
          createBookingInlineKeyboard(value, ['view']),
          { parseMode: 'HTML' }
        );
        break;

      case 'verify':
        await this.sendMessage(
          chatId,
          `Verification code: ${escapeHtml(value)}\n\n` +
          `Enter this code in the NILIN app to verify your Telegram account.`,
          { parseMode: 'HTML' }
        );
        break;

      default:
        await this.sendMainMenu(chatId);
    }
  }

  // ========================================
  // Command Handlers
  // ========================================

  private async handleCommandHelp(chatId: string | number): Promise<void> {
    await this.sendMessage(chatId,
      `<b>NILIN Bot Commands</b>\n\n` +
      `/start - Open main menu\n` +
      `/bookings - View your bookings\n` +
      `/profile - View your profile\n` +
      `/settings - Manage settings\n` +
      `/status - Check notification status\n` +
      `/help - Show this help\n` +
      `/stop - Unsubscribe\n\n` +
      `<i>Tip: You can also tap buttons in the menu for quick actions.</i>`,
      { parseMode: 'HTML' }
    );
  }

  private async handleCommandBookings(chatId: string | number): Promise<void> {
    await this.sendMessage(chatId,
      `📋 <b>Your Bookings</b>\n\n` +
      `To view and manage your bookings, visit the NILIN app:\n` +
      `https://nilin.com/app\n\n` +
      `Download the app for:\n` +
      `• Real-time booking updates\n` +
      `• Live tracking\n` +
      `• Easy management`,
      { parseMode: 'HTML', disableWebPagePreview: true }
    );
  }

  private async handleCommandProfile(chatId: string | number): Promise<void> {
    await this.sendMessage(chatId,
      `👤 <b>Your Profile</b>\n\n` +
      `Manage your profile in the NILIN app:\n` +
      `https://nilin.com/profile`,
      { parseMode: 'HTML', disableWebPagePreview: true }
    );
  }

  private async handleCommandSettings(chatId: string | number): Promise<void> {
    await this.sendMessageWithKeyboard(
      chatId,
      `⚙️ <b>Settings</b>\n\n` +
      `Manage your notification preferences:\n\n` +
      `• Email notifications\n` +
      `• SMS notifications\n` +
      `• Push notifications\n` +
      `• WhatsApp notifications\n\n` +
      `Visit the NILIN app to configure.`,
      {
        inline_keyboard: [
          [
            { text: 'Open Settings', url: 'https://nilin.com/settings/notifications' },
          ],
          [
            { text: 'Unsubscribe', callback_data: 'menu_settings_unsubscribe' },
          ],
        ],
      },
      { parseMode: 'HTML' }
    );
  }

  private async handleCommandStatus(chatId: string | number, from?: TelegramUser): Promise<void> {
    if (!from) {
      await this.sendMessage(chatId, 'Unable to check status.');
      return;
    }

    // Find user by Telegram ID
    const user = await User.findOne({ telegramChatId: String(from.id) });

    if (!user) {
      await this.sendMessage(chatId,
        `Your Telegram account is not linked to NILIN.\n\n` +
        `Link your account in the NILIN app under Settings > Telegram.`
      );
      return;
    }

    const telegramEnabled = user.communicationPreferences?.telegram?.enabled ?? false;

    await this.sendMessage(chatId,
      `📱 <b>Notification Status</b>\n\n` +
      `Telegram: ${telegramEnabled ? '✅ Enabled' : '❌ Disabled'}\n\n` +
      `Manage settings: /settings`,
      { parseMode: 'HTML' }
    );
  }

  // ========================================
  // Webhook Management
  // ========================================

  /**
   * Set webhook URL
   */
  async setWebhook(url: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      await this.client!.post('/setWebhook', { url });
      logger.info('Telegram webhook set', {
        context: 'TelegramService',
        action: 'SET_WEBHOOK',
        url,
      });
      return true;
    } catch (error) {
      logger.error('Failed to set Telegram webhook', {
        context: 'TelegramService',
        action: 'SET_WEBHOOK_ERROR',
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Get webhook info
   */
  async getWebhookInfo(): Promise<TelegramWebhookInfo | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await this.client!.get('/getWebhookInfo');
      return response.data.result;
    } catch (error) {
      logger.error('Failed to get Telegram webhook info', {
        context: 'TelegramService',
        action: 'GET_WEBHOOK_ERROR',
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      await this.client!.post('/deleteWebhook');
      logger.info('Telegram webhook deleted', {
        context: 'TelegramService',
        action: 'DELETE_WEBHOOK',
      });
      return true;
    } catch (error) {
      logger.error('Failed to delete Telegram webhook', {
        context: 'TelegramService',
        action: 'DELETE_WEBHOOK_ERROR',
        error: (error as Error).message,
      });
      return false;
    }
  }

  // ========================================
  // User Management
  // ========================================

  /**
   * Check if user has opted out
   */
  private async checkOptOut(chatId: string): Promise<boolean> {
    const user = await User.findOne({ telegramChatId: chatId }).select('communicationPreferences');

    if (!user) {
      return false;
    }

    const prefs = user.communicationPreferences?.telegram;
    return prefs?.enabled === false;
  }

  /**
   * Link Telegram account to user
   */
  async linkAccount(userId: string, chatId: string, username?: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    user.telegramChatId = chatId;
    if (username) {
      user.telegramUsername = username;
    }
    user.communicationPreferences = user.communicationPreferences || {};
    user.communicationPreferences.telegram = {
      enabled: true,
      linkedAt: new Date(),
    };

    await user.save();

    logger.info('Telegram account linked', {
      context: 'TelegramService',
      action: 'ACCOUNT_LINKED',
      userId,
      chatId,
    });
  }

  /**
   * Unlink Telegram account from user
   */
  async unlinkAccount(userId: string): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    user.telegramChatId = undefined;
    user.telegramUsername = undefined;
    if (user.communicationPreferences?.telegram) {
      user.communicationPreferences.telegram.enabled = false;
    }

    await user.save();

    logger.info('Telegram account unlinked', {
      context: 'TelegramService',
      action: 'ACCOUNT_UNLINKED',
      userId,
    });
  }

  /**
   * Opt out user from Telegram
   */
  async optOutUser(chatId: string): Promise<void> {
    const user = await User.findOne({ telegramChatId: chatId });

    if (user) {
      user.communicationPreferences = user.communicationPreferences || {};
      user.communicationPreferences.telegram = {
        enabled: false,
        optedOutAt: new Date(),
      };
      await user.save();

      logger.info('User opted out of Telegram', {
        context: 'TelegramService',
        action: 'TELEGRAM_OPT_OUT',
        userId: user._id.toString(),
      });
    }
  }

  /**
   * Opt in user to Telegram
   */
  async optInUser(chatId: string): Promise<void> {
    const user = await User.findOne({ telegramChatId: chatId });

    if (user) {
      user.communicationPreferences = user.communicationPreferences || {};
      user.communicationPreferences.telegram = {
        enabled: true,
        optedInAt: new Date(),
      };
      await user.save();

      logger.info('User opted in to Telegram', {
        context: 'TelegramService',
        action: 'TELEGRAM_OPT_IN',
        userId: user._id.toString(),
      });
    }
  }

  // ========================================
  // Helper Methods
  // ========================================

  /**
   * Execute Telegram API call with circuit breaker and retry
   */
  private async executeWithRetry<T>(
    operation: () => Promise<{ success: boolean; messageId?: number; error?: string }>,
    userId?: string
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    return telegramCircuitBreaker.execute(
      async () => {
        const result = await withRetry(operation, retryConfigs.standard);

        if (!result.success) {
          throw result.error || new Error('Telegram API call failed');
        }

        return result.result!;
      },
      async () => {
        logger.warn('Telegram circuit breaker fallback', {
          context: 'TelegramService',
          action: 'CIRCUIT_BREAKER_FALLBACK',
          userId,
        });
        return { success: false, error: 'Service temporarily unavailable' };
      }
    );
  }

  /**
   * Update notification Telegram channel status
   */
  private async updateNotificationTelegramStatus(
    notificationId: string,
    updates: Partial<{
      sent: boolean;
      sentAt: Date;
      messageId: string;
      deliveryStatus: string;
    }>
  ): Promise<void> {
    try {
      await BookingNotification.findByIdAndUpdate(notificationId, {
        $set: {
          'channels.telegram': {
            ...updates,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to update notification Telegram status', {
        context: 'TelegramService',
        action: 'UPDATE_NOTIFICATION_FAILED',
        notificationId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Get opt-in status for a user
   */
  async getOptInStatus(userId: string): Promise<{ linked: boolean; enabled: boolean }> {
    const user = await User.findById(userId).select('telegramChatId communicationPreferences.telegram');

    if (!user) {
      throw ApiError.notFound('User not found', ERROR_CODES.USER_NOT_FOUND);
    }

    return {
      linked: !!user.telegramChatId,
      enabled: user.communicationPreferences?.telegram?.enabled ?? false,
    };
  }
}

// Export singleton instance
export const telegramService = new TelegramService();

