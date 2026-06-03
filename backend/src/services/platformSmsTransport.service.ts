import twilio, { Twilio } from 'twilio';
import type { IPlatformSettings } from '../models/settings.model';
import { getSettings } from './settings.service';
import { getPlatformPolicySync } from './platformSettingsPolicy.service';
import logger from '../utils/logger';

const MASKED_VALUES = new Set(['***MASKED***', '***HIDDEN***', '']);

export interface TwilioTransportConfig {
  client: Twilio;
  phoneNumber: string;
  accountSid: string;
  authToken: string;
  source: 'db' | 'env';
}

export interface SmsTransportUnavailable {
  configured: false;
  reason: string;
}

function isMasked(value?: string | null): boolean {
  if (!value) return true;
  return MASKED_VALUES.has(value) || /^\*+$/.test(value);
}

let cachedTwilio: { config: TwilioTransportConfig | null; cachedAt: number } | null = null;
const SMS_CACHE_TTL_MS = 60_000;

export function invalidateSmsTransportCache(): void {
  cachedTwilio = null;
  logger.debug('SMS transport cache invalidated', { action: 'SMS_TRANSPORT_CACHE_INVALIDATED' });
}

function buildFromEnv(): TwilioTransportConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!accountSid || !authToken || !phoneNumber) {
    return null;
  }
  return {
    client: twilio(accountSid, authToken),
    phoneNumber,
    accountSid,
    authToken,
    source: 'env',
  };
}

function buildFromSettings(settings: Partial<IPlatformSettings>): TwilioTransportConfig | null {
  const sms = settings.smsConfig;
  if (!sms?.enabled) {
    return null;
  }

  const provider = sms.provider || 'twilio';
  if (provider === 'vonage' || provider === 'nexmo' || provider === 'msg91') {
    logger.warn('SMS provider not implemented', { provider, action: 'SMS_PROVIDER_NOT_IMPLEMENTED' });
    return null;
  }

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
  const policy = getPlatformPolicySync();
  if (!policy.smsNotificationsEnabled) {
    return null;
  }

  const now = Date.now();
  if (cachedTwilio && now - cachedTwilio.cachedAt < SMS_CACHE_TTL_MS && !settingsOverride) {
    return cachedTwilio.config;
  }

  const settings = settingsOverride ?? (await getSettings());
  const config = buildFromSettings(settings) ?? buildFromEnv();
  cachedTwilio = { config, cachedAt: now };
  return config;
}

export async function isSmsTransportEnabled(settingsOverride?: Partial<IPlatformSettings>): Promise<boolean> {
  const settings = settingsOverride ?? (await getSettings());
  if (!settings.smsConfig?.enabled) {
    return false;
  }
  return (await getTwilioTransportConfig(settings)) !== null;
}

export function getSmsProviderNotImplementedMessage(
  settings: Partial<IPlatformSettings>
): string | null {
  const provider = settings.smsConfig?.provider;
  if (provider === 'vonage' || provider === 'nexmo' || provider === 'msg91') {
    return `${provider} SMS is saved in settings but not yet implemented. Use Twilio.`;
  }
  return null;
}
