import twilio, { Twilio } from 'twilio';
import { Vonage } from '@vonage/server-sdk';
import type { IPlatformSettings } from '../models/settings.model';
import { getSettings } from './settings.service';
import { getPlatformPolicySync } from './platformSettingsPolicy.service';
import logger from '../utils/logger';

const MASKED_VALUES = new Set(['***MASKED***', '***HIDDEN***', '']);

// ============================================
// Transport Config Types
// ============================================

export interface TwilioTransportConfig {
  type: 'twilio';
  client: Twilio;
  phoneNumber: string;
  accountSid: string;
  authToken: string;
  source: 'db' | 'env';
}

export interface VonageTransportConfig {
  type: 'vonage';
  client: InstanceType<typeof Vonage>;
  from: string;
  apiKey: string;
  apiSecret: string;
  source: 'db' | 'env';
}

export interface Msg91TransportConfig {
  type: 'msg91';
  authKey: string;
  templateId: string;
  senderId: string;
  source: 'db' | 'env';
}

export type SmsTransportConfig = TwilioTransportConfig | VonageTransportConfig | Msg91TransportConfig | null;

export interface SmsTransportUnavailable {
  configured: false;
  reason: string;
}

export interface SmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// MSG91 Configuration
export interface Msg91Config {
  authKey: string;
  templateId: string;
  senderId: string;
}

function isMasked(value?: string | null): boolean {
  if (!value) return true;
  return MASKED_VALUES.has(value) || /^\*+$/.test(value);
}

let cachedTransport: { config: SmsTransportConfig; cachedAt: number } | null = null;
const SMS_CACHE_TTL_MS = 60_000;

export function invalidateSmsTransportCache(): void {
  cachedTransport = null;
  logger.debug('SMS transport cache invalidated', { action: 'SMS_TRANSPORT_CACHE_INVALIDATED' });
}

function buildTwilioFromEnv(): TwilioTransportConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !phoneNumber) {
    return null;
  }
  return {
    type: 'twilio',
    client: twilio(accountSid, authToken),
    phoneNumber,
    accountSid,
    authToken,
    source: 'env',
  };
}

function buildVonageFromEnv(): VonageTransportConfig | null {
  const apiKey = process.env.VONAGE_API_KEY;
  const apiSecret = process.env.VONAGE_API_SECRET;
  const from = process.env.VONAGE_FROM_NUMBER;
  if (!apiKey || !apiSecret || !from) {
    return null;
  }
  const client = new Vonage({
    apiKey,
    apiSecret,
  });
  return {
    type: 'vonage',
    client,
    from,
    apiKey,
    apiSecret,
    source: 'env',
  };
}

function buildFromEnv(): SmsTransportConfig {
  // Try Twilio first
  const twilioConfig = buildTwilioFromEnv();
  if (twilioConfig) return twilioConfig;

  // Try Vonage
  const vonageConfig = buildVonageFromEnv();
  if (vonageConfig) return vonageConfig;

  return null;
}

function buildFromSettings(settings: Partial<IPlatformSettings>): SmsTransportConfig {
  const sms = settings.smsConfig;
  if (!sms?.enabled) {
    return null;
  }

  const provider = sms.provider || 'twilio';

  // Handle MSG91 provider
  if (provider === 'msg91') {
    const msg91Cfg = sms.msg91;
    const authKey = !isMasked(msg91Cfg?.authKey) ? msg91Cfg?.authKey : process.env.MSG91_AUTH_KEY;
    const templateId = msg91Cfg?.templateId || process.env.MSG91_TEMPLATE_ID;
    const senderId = msg91Cfg?.senderId || process.env.MSG91_SENDER_ID;

    if (!authKey) {
      logger.warn('MSG91 auth key not configured', { action: 'MSG91_NOT_CONFIGURED' });
      return null;
    }

    return {
      type: 'msg91',
      authKey,
      templateId: templateId || '',
      senderId: senderId || '',
      source: 'db',
    };
  }

  // Handle Vonage provider
  if (provider === 'vonage' || provider === 'nexmo') {
    const vonageCfg = sms.vonage;
    const apiKey = !isMasked(vonageCfg?.apiKey) ? vonageCfg?.apiKey : process.env.VONAGE_API_KEY;
    const apiSecret = !isMasked(vonageCfg?.apiSecret) ? vonageCfg?.apiSecret : process.env.VONAGE_API_SECRET;
    const from = vonageCfg?.fromNumber || process.env.VONAGE_FROM_NUMBER;

    if (!apiKey || !apiSecret) {
      // Try env vars
      const envApiKey = process.env.VONAGE_API_KEY;
      const envApiSecret = process.env.VONAGE_API_SECRET;
      if (!envApiKey || !envApiSecret) {
        logger.warn('Vonage API credentials not configured', { action: 'VONAGE_NOT_CONFIGURED' });
        return null;
      }
      const client = new Vonage({ apiKey: envApiKey, apiSecret: envApiSecret });
      return {
        type: 'vonage',
        client,
        from: from || process.env.VONAGE_FROM_NUMBER || '',
        apiKey: envApiKey,
        apiSecret: envApiSecret,
        source: 'env',
      };
    }

    const client = new Vonage({ apiKey, apiSecret });
    return {
      type: 'vonage',
      client,
      from: from || '',
      apiKey,
      apiSecret,
      source: 'db',
    };
  }

  // Default to Twilio
  const twilioCfg = sms.twilio;
  const accountSid = twilioCfg?.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = !isMasked(twilioCfg?.authToken)
    ? twilioCfg?.authToken
    : process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = twilioCfg?.fromNumber || process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !phoneNumber) {
    return buildFromEnv();
  }

  return {
    type: 'twilio',
    client: twilio(accountSid, authToken),
    phoneNumber,
    accountSid,
    authToken,
    source: 'db',
  };
}

export async function getTwilioTransportConfig(
  settingsOverride?: Partial<IPlatformSettings>
): Promise<TwilioTransportConfig | null> {
  const config = await getSmsTransportConfig(settingsOverride);
  if (!config || config.type !== 'twilio') {
    return null;
  }
  return config;
}

/**
 * Get the active SMS transport configuration (Twilio, Vonage, or MSG91)
 */
export async function getSmsTransportConfig(
  settingsOverride?: Partial<IPlatformSettings>
): Promise<SmsTransportConfig> {
  const policy = getPlatformPolicySync();
  if (!policy.smsNotificationsEnabled) {
    return null;
  }

  const now = Date.now();
  if (cachedTransport && now - cachedTransport.cachedAt < SMS_CACHE_TTL_MS && !settingsOverride) {
    return cachedTransport.config;
  }

  const settings = settingsOverride ?? (await getSettings());
  const config = buildFromSettings(settings) ?? buildFromEnv();
  cachedTransport = { config, cachedAt: now };
  return config;
}

export async function isSmsTransportEnabled(settingsOverride?: Partial<IPlatformSettings>): Promise<boolean> {
  const config = await getSmsTransportConfig(settingsOverride);
  return config !== null;
}

export function getSmsProviderNotImplementedMessage(
  settings: Partial<IPlatformSettings>
): string | null {
  const provider = settings.smsConfig?.provider;
  // Vonage and MSG91 are now implemented
  if (provider === 'msg91') {
    // MSG91 implementation needs HTTP API call - may need review
    return null;
  }
  return null;
}

// ============================================
// MSG91 HTTP API Implementation
// ============================================

const MSG91_API_BASE = 'https://api.msg91.com/api/v5';

interface Msg91SendResponse {
  type?: string;
  message?: string;
  messageId?: string;
}

/**
 * Send SMS via MSG91 HTTP API
 * https://msg91.com/integrate/http
 */
export async function sendSmsViaMsg91(
  phoneNumber: string,
  message: string,
  config: Msg91TransportConfig
): Promise<SmsResult> {
  const cleanedPhone = phoneNumber.replace(/[^\d]/g, '');

  // Add country code if not present (default to 91 for India)
  let mobile = cleanedPhone;
  if (!cleanedPhone.startsWith('91') && !cleanedPhone.startsWith('+')) {
    mobile = '91' + cleanedPhone;
  } else if (cleanedPhone.startsWith('+')) {
    mobile = cleanedPhone.substring(1);
  }

  const payload = {
    authkey: config.authKey,
    mobiles: mobile,
    message: message,
    sender: config.senderId || 'NILINM',
    route: '4', // Transactional route
    country: '91', // India by default
    ...(config.templateId && { DLTTemplateId: config.templateId }),
  };

  try {
    logger.debug('Sending SMS via MSG91', {
      context: 'Msg91Transport',
      action: 'SMS_SEND',
      phone: maskPhoneForLog(phoneNumber),
    });

    const response = await fetch(`${MSG91_API_BASE}/sendhttp.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('MSG91 API error', {
        context: 'Msg91Transport',
        action: 'MSG91_API_ERROR',
        status: response.status,
        error: errorText,
      });
      return { success: false, error: `MSG91 API error: ${response.status}` };
    }

    const data = await response.json() as Msg91SendResponse;

    // MSG91 returns success with message ID or error with type
    if (data.type === 'error') {
      logger.error('MSG91 returned error', {
        context: 'Msg91Transport',
        action: 'MSG91_ERROR',
        message: data.message,
      });
      return { success: false, error: data.message || 'MSG91 send failed' };
    }

    logger.info('SMS sent via MSG91', {
      context: 'Msg91Transport',
      action: 'SMS_SUCCESS',
      messageId: data.messageId,
    });

    return { success: true, messageId: data.messageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('MSG91 send exception', {
      context: 'Msg91Transport',
      action: 'MSG91_EXCEPTION',
      error: errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * Mask phone number for logging (privacy)
 */
function maskPhoneForLog(phone: string): string {
  const cleaned = phone.replace(/[^\d]/g, '');
  if (cleaned.length < 4) return '****';
  return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
}

// ============================================
// Unified Send SMS Function
// ============================================

/**
 * Send SMS using the configured provider (Twilio, Vonage, or MSG91)
 */
export async function sendSms(
  to: string,
  message: string,
  settingsOverride?: Partial<IPlatformSettings>
): Promise<SmsResult> {
  const config = await getSmsTransportConfig(settingsOverride);

  if (!config) {
    return {
      success: false,
      error: 'SMS transport not configured',
    };
  }

  if (config.type === 'twilio') {
    return sendTwilioSms(config, to, message);
  }

  if (config.type === 'vonage') {
    return sendVonageSms(config, to, message);
  }

  if (config.type === 'msg91') {
    return sendSmsViaMsg91(to, message, config);
  }

  return {
    success: false,
    error: 'Unknown SMS provider type',
  };
}

async function sendTwilioSms(
  config: TwilioTransportConfig,
  to: string,
  message: string
): Promise<SmsResult> {
  try {
    const result = await config.client.messages.create({
      body: message,
      from: config.phoneNumber,
      to: normalizePhoneNumber(to),
    });
    logger.info('SMS sent via Twilio', {
      action: 'SMS_SENT',
      messageId: result.sid,
      to: maskPhoneForLog(to),
    });
    return {
      success: true,
      messageId: result.sid,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to send SMS via Twilio', {
      action: 'SMS_FAILED',
      error: errorMessage,
      to: maskPhoneForLog(to),
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

async function sendVonageSms(
  config: VonageTransportConfig,
  to: string,
  message: string
): Promise<SmsResult> {
  try {
    const normalizedTo = normalizePhoneNumber(to);

    // The new Vonage SDK returns a Promise
    const response = await config.client.sms.send({
      from: config.from,
      to: normalizedTo,
      text: message,
    });

    // Response is SMSMessages type - check for successful messages
    const messages = Array.isArray(response) ? response : [response];

    for (const msg of messages) {
      if (msg.success) {
        logger.info('SMS sent via Vonage', {
          action: 'SMS_SENT',
          messageId: msg.messageId,
          to: maskPhoneForLog(to),
        });
        return {
          success: true,
          messageId: msg.messageId,
        };
      }
    }

    // All messages failed
    const lastMsg = messages[messages.length - 1];
    const errorMsg = lastMsg.error || 'Unknown error';
    logger.error('Failed to send SMS via Vonage', {
      action: 'SMS_FAILED',
      error: errorMsg,
      to: maskPhoneForLog(to),
    });
    return {
      success: false,
      error: errorMsg,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to send SMS via Vonage', {
      action: 'SMS_FAILED',
      error: errorMessage,
      to: maskPhoneForLog(to),
    });
    return {
      success: false,
      error: errorMessage,
    };
  }
}

function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  let normalized = phone.trim();
  if (normalized.startsWith('+')) {
    return '+' + normalized.substring(1).replace(/\D/g, '');
  }
  return normalized.replace(/\D/g, '');
}
