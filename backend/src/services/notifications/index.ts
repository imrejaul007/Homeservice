/**
 * Notification Services Index
 * Re-exports all notification-related services
 */

export { whatsAppService, WhatsAppService } from './whatsapp.service';
export type {
  WhatsAppMessageStatus,
  WhatsAppTemplateStatus,
  WhatsAppConfig,
  WhatsAppMessage,
  WhatsAppTextContent,
  WhatsAppTemplateContent,
  WhatsAppTemplateComponent,
  WhatsAppImageContent,
  WhatsAppIncomingMessage,
  WhatsAppTemplate,
} from './whatsapp.service';

export { webPushService, WebPushService } from './webpush.service';
export type {
  PushSubscription,
  WebPushPayload,
  PushSubscriptionRecord,
} from './webpush.service';

export { telegramService, TelegramService } from './telegram.service';
export type {
  TelegramConfig,
  TelegramMessage,
  TelegramInlineKeyboard,
  TelegramInlineKeyboardButton,
  TelegramBotCommand,
  TelegramUpdate,
  TelegramCallbackQuery,
} from './telegram.service';

export { notificationDigestService, NotificationDigestService } from './notificationDigest.service';
export type {
  DigestFrequency,
  DigestPreferences,
  NotificationGroup,
  DigestContent,
  DigestSchedule,
} from './notificationDigest.service';
