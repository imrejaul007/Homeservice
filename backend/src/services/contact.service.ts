import mongoose from 'mongoose';
import ContactSubmission, {
  ContactSubject,
  IContactSubmission,
} from '../models/contactSubmission.model';
import SupportTicket, { UserType } from '../models/supportTicket.model';
import { eventBus, EVENT_TYPES } from '../event-bus';
import { crmWebhookService } from './crmWebhook.service';
import { queueSupportEmail } from './supportEmailQueue.service';
import { businessHoursService } from './businessHours.service';
import { contactConfigCache } from './contactConfigCache.service';
import logger from '../utils/logger';
import {
  DISPOSABLE_EMAIL_DOMAINS,
  SPAM_KEYWORDS,
  SUBJECT_LABELS,
  SUBJECT_ROUTING,
  SUPPORT_CONTACT,
} from '../constants/contactSupport';

export interface ContactFormInput {
  name: string;
  email: string;
  subject: ContactSubject;
  message: string;
  website?: string;
  userId?: mongoose.Types.ObjectId;
  userType?: UserType;
  userName?: string;
  tenantId?: mongoose.Types.ObjectId;
  ipAddress?: string;
  userAgent?: string;
  source?: string;
}

export interface ContactFormResult {
  submissionId: string;
  ticketNumber?: string;
  department: string;
  estimatedResponseHours: number;
  isDuplicate: boolean;
}

const RFC_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .trim();
}

function calculateSpamScore(input: ContactFormInput): number {
  let score = 0;

  if (input.website?.trim()) score += 100;
  if (input.message.length < 20) score += 20;

  const domain = input.email.split('@')[1]?.toLowerCase();
  if (domain && DISPOSABLE_EMAIL_DOMAINS.has(domain)) score += 50;

  const lowerMessage = input.message.toLowerCase();
  for (const keyword of SPAM_KEYWORDS) {
    if (lowerMessage.includes(keyword)) score += 15;
  }

  const urlCount = (input.message.match(/https?:\/\//gi) || []).length;
  if (urlCount > 3) score += 20;

  if (/(.)\1{10,}/.test(input.message)) score += 10;

  return score;
}

async function checkDuplicate(email: string, subjectCategory: ContactSubject): Promise<boolean> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const existing = await ContactSubmission.findOne({
    email: email.toLowerCase(),
    subjectCategory,
    createdAt: { $gte: fiveMinutesAgo },
    isSpam: false,
  }).lean();

  return !!existing;
}

async function sendAcknowledgementEmail(
  submission: IContactSubmission
): Promise<void> {
  const html = `
    <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; color: #2D2D2D;">
      <h2 style="color: #E8B4A8;">Thank you for contacting NILIN</h2>
      <p>Hi ${submission.name},</p>
      <p>We have received your message and assigned it to our <strong>${submission.routedTeam}</strong> team.</p>
      <p><strong>Reference:</strong> ${submission.submissionId}</p>
      <p><strong>Subject:</strong> ${submission.subject}</p>
      <p>We aim to respond within <strong>${SUPPORT_CONTACT.sla.firstResponseHours} hours</strong> during business hours.</p>
      <hr style="border: none; border-top: 1px solid #E8E8E8; margin: 24px 0;" />
      <p style="font-size: 12px; color: #888;">NILIN Home Service · ${SUPPORT_CONTACT.emails.clients}</p>
    </div>
  `;

  await queueSupportEmail({
    to: submission.email,
    type: 'contact_acknowledgement',
    subject: `We received your message — ${submission.submissionId}`,
    html,
    text: `Thank you for contacting NILIN. Reference: ${submission.submissionId}. We will respond within ${SUPPORT_CONTACT.sla.firstResponseHours} hours.`,
  });
}

async function sendTeamNotification(
  submission: IContactSubmission
): Promise<void> {
  const html = `
    <div style="font-family: sans-serif; max-width: 600px;">
      <h2>New Contact Submission — ${submission.submissionId}</h2>
      <p><strong>From:</strong> ${submission.name} &lt;${submission.email}&gt;</p>
      <p><strong>Department:</strong> ${submission.department} → ${submission.routedTeam}</p>
      <p><strong>Priority:</strong> ${submission.priority}</p>
      <p><strong>Category:</strong> ${submission.subjectCategory}</p>
      <p><strong>Subject:</strong> ${submission.subject}</p>
      <p><strong>Message:</strong></p>
      <blockquote style="border-left: 3px solid #E8B4A8; padding-left: 12px; color: #555;">
        ${submission.message.replace(/\n/g, '<br>')}
      </blockquote>
    </div>
  `;

  await queueSupportEmail({
    to: submission.routedEmail,
    type: 'contact_team_notification',
    subject: `[${submission.priority.toUpperCase()}] ${submission.subjectCategory}: ${submission.subject}`,
    html,
  });
}

async function createLinkedTicket(
  submission: IContactSubmission,
  userId: mongoose.Types.ObjectId,
  userType: UserType,
  userName: string
): Promise<string | undefined> {
  const routing = SUBJECT_ROUTING[submission.subjectCategory];

  const ticket = new SupportTicket({
    userId,
    userType,
    userName,
    userEmail: submission.email,
    category: routing.category,
    priority: routing.priority,
    subject: `[Contact] ${submission.subject}`,
    description: submission.message,
    metadata: {
      contactSubmissionId: submission._id,
      submissionId: submission.submissionId,
      source: 'contact_page',
    },
    messages: [
      {
        sender: userId,
        senderType: userType,
        senderName: userName,
        message: submission.message,
        createdAt: new Date(),
      },
    ],
  });

  await ticket.save();
  submission.ticketId = ticket._id;
  await submission.save();

  eventBus.emit(EVENT_TYPES.TICKET_CREATED, {
    ticketId: ticket._id,
    ticketNumber: ticket.ticketNumber,
    userId,
    category: routing.category,
    priority: routing.priority,
    source: 'contact_page',
  });

  return ticket.ticketNumber;
}

export const contactService = {
  validateInput(input: ContactFormInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const name = sanitizeText(input.name);
    if (!name || name.length < 2) errors.push('Name must be at least 2 characters');
    if (name.length > 100) errors.push('Name cannot exceed 100 characters');
    if (!/^[a-zA-ZÀ-ÿ\s'.-]+$/.test(name)) errors.push('Name contains invalid characters');

    const email = input.email.trim().toLowerCase();
    if (!email) errors.push('Email is required');
    else if (!RFC_EMAIL.test(email)) errors.push('Invalid email address');

    if (!input.subject || !SUBJECT_ROUTING[input.subject]) {
      errors.push('Invalid subject category');
    }

    const message = sanitizeText(input.message);
    if (!message || message.length < 20) errors.push('Message must be at least 20 characters');
    if (message.length > 5000) errors.push('Message cannot exceed 5000 characters');

    return { valid: errors.length === 0, errors };
  },

  buildPublicConfig(region?: string) {
    const hoursStatus = businessHoursService.getStatus();
    const regional = businessHoursService.resolveRegionalPhone(region);

    return {
      contact: {
        ...SUPPORT_CONTACT,
        phone: regional.phone,
        regionalLabel: regional.label,
        regionalHours: regional.hours,
      },
      isBusinessHoursOpen: hoursStatus.isOpen,
      businessHoursStatus: hoursStatus.message,
      upcomingHolidays: businessHoursService.getHolidays().slice(0, 3),
      subjectOptions: Object.entries(SUBJECT_ROUTING).map(([value, rule]) => ({
        value,
        label: SUBJECT_LABELS[value as ContactSubject],
        department: rule.department,
        team: rule.team,
      })),
      departments: [
        {
          title: 'For Clients',
          email: SUPPORT_CONTACT.emails.clients,
          description: 'Booking inquiries, service issues, refunds',
        },
        {
          title: 'For Providers',
          email: SUPPORT_CONTACT.emails.providers,
          description: 'Partnership opportunities, technical support',
        },
        {
          title: 'General Inquiries',
          email: SUPPORT_CONTACT.emails.general,
          description: 'Partnerships, press, media',
        },
      ],
    };
  },

  async getPublicConfig(region?: string) {
    if (!region) {
      const cached = await contactConfigCache.get<ReturnType<typeof contactService.buildPublicConfig>>();
      if (cached) return cached;
    }

    const config = this.buildPublicConfig(region);
    if (!region) {
      await contactConfigCache.set(config);
    }
    return config;
  },

  async submitContactForm(input: ContactFormInput): Promise<ContactFormResult> {
    const validation = this.validateInput(input);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    const isDuplicate = await checkDuplicate(input.email, input.subject);
    if (isDuplicate) {
      const recent = await ContactSubmission.findOne({
        email: input.email.toLowerCase(),
        subjectCategory: input.subject,
      })
        .sort({ createdAt: -1 })
        .lean();

      return {
        submissionId: recent?.submissionId || 'DUPLICATE',
        department: recent?.department || 'general',
        estimatedResponseHours: SUPPORT_CONTACT.sla.firstResponseHours,
        isDuplicate: true,
      };
    }

    const spamScore = calculateSpamScore(input);
    const isSpam = spamScore >= 50;
    const routing = SUBJECT_ROUTING[input.subject];
    const submissionId = await ContactSubmission.generateSubmissionId();

    const submission = await ContactSubmission.create({
      submissionId,
      name: sanitizeText(input.name),
      email: input.email.trim().toLowerCase(),
      subject: SUBJECT_LABELS[input.subject],
      subjectCategory: input.subject,
      message: sanitizeText(input.message),
      department: routing.department,
      routedTeam: routing.team,
      routedEmail: routing.routedEmail,
      priority: routing.priority,
      status: isSpam ? 'spam' : 'new',
      userId: input.userId,
      tenantId: input.tenantId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent?.slice(0, 500),
      source: input.source || 'contact_page',
      spamScore,
      isSpam,
      metadata: { subjectCategory: input.subject },
    });

    if (isSpam) {
      logger.warn('Contact submission flagged as spam', {
        submissionId,
        email: input.email,
        spamScore,
        action: 'CONTACT_SPAM_BLOCKED',
      });
      throw new Error('Your submission could not be processed. Please contact us directly by phone.');
    }

    let ticketNumber: string | undefined;
    if (input.userId && input.userType) {
      ticketNumber = await createLinkedTicket(
        submission,
        input.userId,
        input.userType,
        input.userName || sanitizeText(input.name)
      );
    }

    submission.acknowledgedAt = new Date();
    await submission.save();

    await Promise.allSettled([
      sendAcknowledgementEmail(submission),
      sendTeamNotification(submission),
    ]);

    eventBus.emit(EVENT_TYPES.CONTACT_SUBMISSION_CREATED, {
      submissionId: submission.submissionId,
      department: submission.department,
      priority: submission.priority,
      email: submission.email,
      ticketNumber,
    });

    crmWebhookService.contactSubmissionCreated({
      submissionId: submission.submissionId,
      name: submission.name,
      email: submission.email,
      department: submission.department,
      priority: submission.priority,
      subject: submission.subject,
      message: submission.message,
    }).catch(() => {});

    logger.info('Contact submission created', {
      submissionId: submission.submissionId,
      department: submission.department,
      priority: submission.priority,
      ticketNumber,
      action: 'CONTACT_SUBMISSION_CREATED',
    });

    const estimatedResponseHours =
      routing.priority === 'urgent' || routing.priority === 'high'
        ? SUPPORT_CONTACT.sla.urgentFirstResponseHours
        : SUPPORT_CONTACT.sla.firstResponseHours;

    return {
      submissionId: submission.submissionId,
      ticketNumber,
      department: submission.department,
      estimatedResponseHours,
      isDuplicate: false,
    };
  },
};
