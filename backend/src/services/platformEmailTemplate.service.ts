import type { IPlatformSettings } from '../models/settings.model';
import { renderTemplate, type TemplateVariables } from '../templates/notifications/types';
import { getSettings } from './settings.service';
import { getPlatformPolicySync, isChannelEnabledByPlatform } from './platformSettingsPolicy.service';
import { sendViaPlatformTransport } from './platformEmailTransport.service';
import logger from '../utils/logger';

export type PlatformEmailTemplateKey =
  | 'bookingConfirmation'
  | 'bookingReminder'
  | 'bookingCancellation'
  | 'bookingCompletion'
  | 'providerApproval'
  | 'providerRejection'
  | 'passwordReset'
  | 'emailVerification'
  | 'welcomeEmail'
  | 'paymentReceipt'
  | 'providerApplication';

/** Alias DB template variables to common senders */
export function normalizeTemplateVariables(
  variables: Record<string, string | number | boolean | Date | undefined>
): TemplateVariables {
  const normalized: TemplateVariables = { ...variables };
  if (normalized.userName === undefined && normalized.customerName !== undefined) {
    normalized.userName = String(normalized.customerName);
  }
  if (normalized.customerName === undefined && normalized.userName !== undefined) {
    normalized.customerName = String(normalized.userName);
  }
  if (normalized.firstName === undefined && normalized.userName !== undefined) {
    normalized.firstName = String(normalized.userName);
  }
  return normalized;
}

function wrapPlainTextAsHtml(body: string, includeUnsubscribe = false): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 12px;color:#444;line-height:1.6;">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('');

  const footer = includeUnsubscribe
    ? '<p style="margin-top:24px;font-size:12px;color:#888;">You received this email from the platform. Manage notification preferences in your account settings.</p>'
    : '';

  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">${paragraphs}${footer}</body></html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function isPlatformEmailTemplatesEnabled(): boolean {
  if (process.env.USE_PLATFORM_EMAIL_TEMPLATES === 'false') {
    return false;
  }
  return process.env.USE_PLATFORM_EMAIL_TEMPLATES !== 'false';
}

export async function resolveDbEmailTemplate(
  templateKey: PlatformEmailTemplateKey,
  variables: Record<string, string | number | boolean | Date | undefined>,
  settingsOverride?: Partial<IPlatformSettings>
): Promise<{ subject: string; html: string; source: 'db' } | null> {
  const settings = settingsOverride ?? (await getSettings());
  const template = settings.emailTemplates?.[templateKey];
  if (!template?.enabled || !template.subject || !template.body) {
    return null;
  }

  const vars = normalizeTemplateVariables(variables);
  const subject = renderTemplate(template.subject, vars);
  const bodyText = renderTemplate(template.body, vars);
  const html = wrapPlainTextAsHtml(bodyText, templateKey === 'welcomeEmail');

  return { subject, html, source: 'db' };
}

export interface SendPlatformEmailOptions {
  templateKey: PlatformEmailTemplateKey;
  to: string;
  variables: Record<string, string | number | boolean | Date | undefined>;
  fallbackHtmlBuilder: () => { subject: string; html: string; text?: string };
  settingsOverride?: Partial<IPlatformSettings>;
  forceSend?: boolean;
}

export async function sendPlatformEmail(options: SendPlatformEmailOptions): Promise<void> {
  const { templateKey, to, variables, fallbackHtmlBuilder, settingsOverride, forceSend } = options;

  if (!isChannelEnabledByPlatform('email', getPlatformPolicySync())) {
    logger.debug('Platform email notifications disabled — skipping', {
      templateKey,
      to,
      action: 'PLATFORM_EMAIL_SKIPPED',
    });
    return;
  }

  let subject: string;
  let html: string;
  let text: string | undefined;
  let templateSource: 'db' | 'fallback' = 'fallback';

  if (isPlatformEmailTemplatesEnabled()) {
    const dbTemplate = await resolveDbEmailTemplate(templateKey, variables, settingsOverride);
    if (dbTemplate) {
      subject = dbTemplate.subject;
      html = dbTemplate.html;
      templateSource = 'db';
    } else {
      const fallback = fallbackHtmlBuilder();
      subject = fallback.subject;
      html = fallback.html;
      text = fallback.text;
    }
  } else {
    const fallback = fallbackHtmlBuilder();
    subject = fallback.subject;
    html = fallback.html;
    text = fallback.text;
  }

  logger.info('Sending platform email', {
    templateKey,
    to,
    templateSource,
    emailTemplateSource: templateSource,
    action: 'PLATFORM_EMAIL_SEND',
  });

  await sendViaPlatformTransport({ to, subject, html, text }, { forceSend });
}

export function getBookingReminderHoursBefore(settings?: Partial<IPlatformSettings>): number {
  const hours = settings?.emailTemplates?.bookingReminder?.hoursBefore;
  if (typeof hours === 'number' && hours > 0) {
    return hours;
  }
  return 24;
}
