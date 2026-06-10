import ContactSubmission from '../models/contactSubmission.model';
import { SUBJECT_LABELS, SUBJECT_ROUTING } from '../constants/contactSupport';
import type { ContactSubject } from '../models/contactSubmission.model';
import { crmWebhookService } from './crmWebhook.service';
import logger from '../utils/logger';

export interface InboundEmailPayload {
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}

const SUBJECT_PATTERNS: Array<{ pattern: RegExp; category: ContactSubject }> = [
  { pattern: /refund|reimburse/i, category: 'refund' },
  { pattern: /booking|reschedule|cancel/i, category: 'booking' },
  { pattern: /payment|billing|invoice/i, category: 'payment' },
  { pattern: /provider|partner/i, category: 'provider' },
  { pattern: /suggest|feedback/i, category: 'suggestion' },
];

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
}

function extractName(raw: string, email: string): string {
  const name = raw.replace(/<[^>]+>/, '').trim();
  return name || email.split('@')[0];
}

function classifySubject(subject: string, body: string): ContactSubject {
  const combined = `${subject} ${body}`;
  for (const { pattern, category } of SUBJECT_PATTERNS) {
    if (pattern.test(combined)) return category;
  }
  return 'other';
}

function sanitizeBody(body: string): string {
  return body.replace(/<[^>]*>/g, '').trim().slice(0, 5000);
}

export const inboundEmailService = {
  async processInboundEmail(payload: InboundEmailPayload): Promise<{ submissionId: string }> {
    const email = extractEmailAddress(payload.from);
    const name = extractName(payload.fromName || payload.from, email);
    const message = sanitizeBody(payload.textBody || payload.htmlBody || '');
    const category = classifySubject(payload.subject, message);
    const routing = SUBJECT_ROUTING[category];
    const submissionId = await ContactSubmission.generateSubmissionId();

    if (message.length < 5) {
      throw new Error('Email body too short to process');
    }

    const submission = await ContactSubmission.create({
      submissionId,
      name,
      email,
      subject: payload.subject || SUBJECT_LABELS[category],
      subjectCategory: category,
      message,
      department: routing.department,
      routedTeam: routing.team,
      routedEmail: routing.routedEmail,
      priority: routing.priority,
      status: 'new',
      source: 'inbound_email',
      metadata: {
        messageId: payload.messageId,
        inReplyTo: payload.inReplyTo,
        references: payload.references,
        originalTo: payload.to,
      },
    });

    await crmWebhookService.contactSubmissionCreated({
      submissionId,
      name,
      email,
      department: routing.department,
      priority: routing.priority,
      subject: submission.subject,
      message,
    });

    logger.info('Inbound email processed as contact submission', {
      submissionId,
      email,
      category,
      action: 'INBOUND_EMAIL_PROCESSED',
    });

    return { submissionId };
  },
};
