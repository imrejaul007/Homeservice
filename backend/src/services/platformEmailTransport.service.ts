import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';
import sgMail from '@sendgrid/mail';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { Transporter } from 'nodemailer';
import type { IPlatformSettings } from '../models/settings.model';
import { getSettings } from './settings.service';
import logger from '../utils/logger';
import { ApiError } from '../utils/ApiError';

const MASKED_VALUES = new Set(['***MASKED***', '***HIDDEN***', '']);

export interface EmailTransportPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface ResolvedEmailFrom {
  fromEmail: string;
  fromName: string;
  replyTo?: string;
}

type TransportMode = 'smtp' | 'resend' | 'sendgrid' | 'ses' | 'none';

interface CachedTransport {
  mode: TransportMode;
  smtp?: Transporter | null;
  resend?: Resend | null;
  sendgridApiKey?: string | null;
  ses?: SESClient | null;
  from: ResolvedEmailFrom;
  provider: string;
  cachedAt: number;
}

let transportCache: CachedTransport | null = null;
const TRANSPORT_CACHE_TTL_MS = 60_000;

function isMasked(value?: string | null): boolean {
  if (!value) return true;
  return MASKED_VALUES.has(value) || /^\*+$/.test(value);
}

function resolveFrom(settings: Partial<IPlatformSettings>): ResolvedEmailFrom {
  const cfg = settings.emailConfig;
  return {
    fromEmail:
      cfg?.fromEmail ||
      process.env.FROM_EMAIL ||
      process.env.EMAIL_FROM ||
      'noreply@nilin.com',
    fromName:
      cfg?.fromName || process.env.FROM_NAME || process.env.APP_NAME || 'NILIN',
    replyTo: cfg?.replyToEmail || undefined,
  };
}

function resolveSmtpConfig(settings: Partial<IPlatformSettings>) {
  const smtp = settings.emailConfig?.smtp;
  const host = smtp?.host || process.env.SMTP_HOST;
  const port = smtp?.port || parseInt(process.env.SMTP_PORT || '587', 10);
  const user = smtp?.user || process.env.SMTP_USER;
  const pass = !isMasked(smtp?.pass) ? smtp?.pass : process.env.SMTP_PASS;
  const secure = smtp?.secure ?? port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return { host, port, user, pass, secure };
}

function resolveResendApiKey(settings: Partial<IPlatformSettings>): string | null {
  const dbKey = settings.emailConfig?.resend?.apiKey;
  if (!isMasked(dbKey) && dbKey) {
    return dbKey;
  }
  return process.env.RESEND_API_KEY || null;
}

function resolveSendGridApiKey(settings: Partial<IPlatformSettings>): string | null {
  const dbKey = settings.emailConfig?.sendgrid?.apiKey;
  if (!isMasked(dbKey) && dbKey) {
    return dbKey;
  }
  return process.env.SENDGRID_API_KEY || null;
}

export function getUnsupportedEmailProviderMessage(
  settings?: Partial<IPlatformSettings>
): string | null {
  // All supported providers now have implementations
  return null;
}

function resolveSesConfig(settings: Partial<IPlatformSettings>): { accessKeyId: string; secretAccessKey: string; region: string } | null {
  // Check settings first, then environment variables
  const sesSettings = settings.emailConfig?.ses;
  const accessKeyId = sesSettings?.accessKeyId || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = !isMasked(sesSettings?.secretAccessKey) ? sesSettings?.secretAccessKey : process.env.AWS_SECRET_ACCESS_KEY;
  const region = sesSettings?.region || process.env.AWS_REGION || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  return { accessKeyId, secretAccessKey, region };
}

export async function buildTransportCache(
  settingsOverride?: Partial<IPlatformSettings>
): Promise<CachedTransport> {
  const settings = settingsOverride ?? (await getSettings());
  const provider = settings.emailConfig?.provider || 'resend';
  const from = resolveFrom(settings);

  if (provider === 'smtp') {
    const smtpCfg = resolveSmtpConfig(settings);
    if (smtpCfg) {
      return {
        mode: 'smtp',
        smtp: nodemailer.createTransport({
          host: smtpCfg.host,
          port: smtpCfg.port,
          secure: smtpCfg.secure,
          auth: { user: smtpCfg.user, pass: smtpCfg.pass },
          tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
        }),
        from,
        provider: 'smtp',
        cachedAt: Date.now(),
      };
    }
  }

  if (provider === 'resend' || provider === 'smtp') {
    const apiKey = resolveResendApiKey(settings);
    if (apiKey) {
      return {
        mode: 'resend',
        resend: new Resend(apiKey),
        from,
        provider: 'resend',
        cachedAt: Date.now(),
      };
    }
  }

  if (provider === 'sendgrid') {
    const apiKey = resolveSendGridApiKey(settings);
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      return {
        mode: 'sendgrid',
        sendgridApiKey: apiKey,
        from,
        provider: 'sendgrid',
        cachedAt: Date.now(),
      };
    }
  }

  if (provider === 'ses') {
    const sesCfg = resolveSesConfig(settings);
    if (sesCfg) {
      const sesClient = new SESClient({
        region: sesCfg.region,
        credentials: {
          accessKeyId: sesCfg.accessKeyId,
          secretAccessKey: sesCfg.secretAccessKey,
        },
      });
      return {
        mode: 'ses',
        ses: sesClient,
        from,
        provider: 'ses',
        cachedAt: Date.now(),
      };
    }
  }

  // Env fallback chain
  const envSmtp = resolveSmtpConfig({});
  if (envSmtp) {
    return {
      mode: 'smtp',
      smtp: nodemailer.createTransport({
        host: envSmtp.host,
        port: envSmtp.port,
        secure: envSmtp.secure,
        auth: { user: envSmtp.user, pass: envSmtp.pass },
        tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
      }),
      from,
      provider: 'smtp-env',
      cachedAt: Date.now(),
    };
  }

  const envResendKey = process.env.RESEND_API_KEY;
  if (envResendKey) {
    return {
      mode: 'resend',
      resend: new Resend(envResendKey),
      from,
      provider: 'resend-env',
      cachedAt: Date.now(),
    };
  }

  const envSendGridKey = process.env.SENDGRID_API_KEY;
  if (envSendGridKey) {
    sgMail.setApiKey(envSendGridKey);
    return {
      mode: 'sendgrid',
      sendgridApiKey: envSendGridKey,
      from,
      provider: 'sendgrid-env',
      cachedAt: Date.now(),
    };
  }

  // SES env fallback
  const envSesCfg = resolveSesConfig({});
  if (envSesCfg) {
    const sesClient = new SESClient({
      region: envSesCfg.region,
      credentials: {
        accessKeyId: envSesCfg.accessKeyId,
        secretAccessKey: envSesCfg.secretAccessKey,
      },
    });
    return {
      mode: 'ses',
      ses: sesClient,
      from,
      provider: 'ses-env',
      cachedAt: Date.now(),
    };
  }

  return { mode: 'none', from, provider: 'none', cachedAt: Date.now() };
}

async function getCachedTransport(settingsOverride?: Partial<IPlatformSettings>): Promise<CachedTransport> {
  const now = Date.now();
  if (
    transportCache &&
    now - transportCache.cachedAt < TRANSPORT_CACHE_TTL_MS &&
    !settingsOverride
  ) {
    return transportCache;
  }
  transportCache = await buildTransportCache(settingsOverride);
  return transportCache;
}

export function invalidateEmailTransportCache(): void {
  transportCache = null;
  logger.debug('Email transport cache invalidated', { action: 'EMAIL_TRANSPORT_CACHE_INVALIDATED' });
}

export async function isEmailTransportConfigured(
  settingsOverride?: Partial<IPlatformSettings>
): Promise<boolean> {
  const cache = await getCachedTransport(settingsOverride);
  return cache.mode !== 'none';
}

export async function sendViaPlatformTransport(
  payload: EmailTransportPayload,
  options?: { forceSend?: boolean; settingsOverride?: Partial<IPlatformSettings> }
): Promise<{ messageId: string }> {
  const { to, subject, html, text } = payload;
  const forceSend = options?.forceSend ?? false;

  if (process.env.NODE_ENV !== 'production' && !forceSend) {
    logger.info('Email would be sent (dev mode)', {
      to,
      subject,
      preview: html.substring(0, 200),
      action: 'EMAIL_DEV_SKIP',
    });
    return { messageId: 'dev-mode' };
  }

  const unsupported = getUnsupportedEmailProviderMessage(
    options?.settingsOverride ?? (await getSettings())
  );
  if (unsupported && forceSend) {
    throw ApiError.badRequest(unsupported);
  }

  const cache = await getCachedTransport(options?.settingsOverride);
  const fromHeader = `"${cache.from.fromName}" <${cache.from.fromEmail}>`;
  const plainText = text || html.replace(/<[^>]*>/g, '');

  if (cache.mode === 'smtp' && cache.smtp) {
    const info = await cache.smtp.sendMail({
      from: fromHeader,
      to,
      subject,
      html,
      text: plainText,
      replyTo: cache.from.replyTo,
    });
    logger.info('Email sent via platform SMTP transport', {
      to,
      subject,
      emailTransportProvider: cache.provider,
      messageId: info.messageId,
      action: 'EMAIL_SENT',
    });
    return { messageId: info.messageId || 'unknown' };
  }

  if (cache.mode === 'resend' && cache.resend) {
    const result = await cache.resend.emails.send({
      from: `${cache.from.fromName} <${cache.from.fromEmail}>`,
      to: [to],
      subject,
      html,
      text: plainText,
      reply_to: cache.from.replyTo,
    });
    if (result.error) {
      throw ApiError.internal(result.error.message);
    }
    logger.info('Email sent via platform Resend transport', {
      to,
      subject,
      emailTransportProvider: cache.provider,
      messageId: result.data?.id,
      action: 'EMAIL_SENT',
    });
    return { messageId: result.data?.id || 'unknown' };
  }

  if (cache.mode === 'sendgrid' && cache.sendgridApiKey) {
    const result = await sgMail.send({
      to,
      from: {
        email: cache.from.fromEmail,
        name: cache.from.fromName,
      },
      subject,
      html,
      text: plainText,
      replyTo: cache.from.replyTo,
    });
    const sgResponse = Array.isArray(result) ? result[0] : result;
    const messageId = sgResponse?.headers?.['x-message-id'] || (sgResponse as unknown as { messageId?: string })?.messageId;
    logger.info('Email sent via platform SendGrid transport', {
      to,
      subject,
      emailTransportProvider: cache.provider,
      messageId,
      action: 'EMAIL_SENT',
    });
    return { messageId: messageId || 'unknown' };
  }

  if (cache.mode === 'ses' && cache.ses) {
    const sesCommand = new SendEmailCommand({
      Source: fromHeader,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: html,
            Charset: 'UTF-8',
          },
          Text: {
            Data: plainText,
            Charset: 'UTF-8',
          },
        },
      },
      ReplyToAddresses: cache.from.replyTo ? [cache.from.replyTo] : undefined,
    });
    const result = await cache.ses.send(sesCommand);
    logger.info('Email sent via platform SES transport', {
      to,
      subject,
      emailTransportProvider: cache.provider,
      messageId: result.MessageId,
      action: 'EMAIL_SENT',
    });
    return { messageId: result.MessageId || 'unknown' };
  }

  logger.warn('Email transport not configured', { to, subject, action: 'EMAIL_NOT_CONFIGURED' });
  return { messageId: 'not-configured' };
}
