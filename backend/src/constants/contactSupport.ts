import type { ContactDepartment, ContactSubject } from '../models/contactSubmission.model';
import type { TicketCategory, TicketPriority } from '../models/supportTicket.model';

export const SUPPORT_CONTACT = {
  emails: {
    general: process.env.SUPPORT_EMAIL_GENERAL || 'hello@nilin.com',
    clients: process.env.SUPPORT_EMAIL_CLIENTS || 'support@nilin.com',
    providers: process.env.SUPPORT_EMAIL_PROVIDERS || 'providers@nilin.com',
  },
  phone: process.env.SUPPORT_PHONE || '+971 4 123 4567',
  timezone: 'Asia/Dubai',
  address: {
    name: 'NILIN Headquarters',
    lines: ['Dubai Design District', 'Building 7, Office 301', 'Dubai, UAE'],
    mapsUrl: 'https://maps.google.com/?q=Dubai+Design+District+Building+7+Office+301',
    coordinates: { lat: 25.1851, lng: 55.2796 },
  },
  businessHours: {
    weekdays: { days: 'Sunday - Thursday', hours: '9:00 AM - 6:00 PM' },
    weekend: { days: 'Friday - Saturday', hours: 'Closed' },
    timezone: 'GST (UTC+4)',
  },
  social: [
    { name: 'Instagram', url: 'https://instagram.com/nilin', handle: '@nilin' },
    { name: 'Twitter', url: 'https://twitter.com/nilin', handle: '@nilin' },
    { name: 'LinkedIn', url: 'https://linkedin.com/company/nilin', handle: 'NILIN' },
    { name: 'TikTok', url: 'https://tiktok.com/@nilin', handle: '@nilin' },
  ],
  sla: {
    firstResponseHours: 24,
    resolutionHours: 72,
    urgentFirstResponseHours: 4,
  },
} as const;

export interface ContactRoutingRule {
  category: TicketCategory;
  priority: TicketPriority;
  department: ContactDepartment;
  team: string;
  routedEmail: string;
}

export const SUBJECT_LABELS: Record<ContactSubject, string> = {
  booking: 'Booking Issue',
  payment: 'Payment Inquiry',
  refund: 'Refund Request',
  provider: 'Provider Feedback',
  suggestion: 'Suggestion',
  other: 'General Inquiry',
};

export const SUBJECT_ROUTING: Record<ContactSubject, ContactRoutingRule> = {
  booking: {
    category: 'service',
    priority: 'high',
    department: 'client_support',
    team: 'Booking Team',
    routedEmail: SUPPORT_CONTACT.emails.clients,
  },
  payment: {
    category: 'billing',
    priority: 'medium',
    department: 'client_support',
    team: 'Refund Team',
    routedEmail: SUPPORT_CONTACT.emails.clients,
  },
  refund: {
    category: 'billing',
    priority: 'high',
    department: 'client_support',
    team: 'Refund Team',
    routedEmail: SUPPORT_CONTACT.emails.clients,
  },
  provider: {
    category: 'technical',
    priority: 'medium',
    department: 'provider_support',
    team: 'Provider Success Team',
    routedEmail: SUPPORT_CONTACT.emails.providers,
  },
  suggestion: {
    category: 'other',
    priority: 'low',
    department: 'general',
    team: 'Operations',
    routedEmail: SUPPORT_CONTACT.emails.general,
  },
  other: {
    category: 'other',
    priority: 'medium',
    department: 'general',
    team: 'Operations',
    routedEmail: SUPPORT_CONTACT.emails.general,
  },
};

export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  '10minutemail.com',
  'trashmail.com',
  'fakeinbox.com',
  'sharklasers.com',
]);

export const SPAM_KEYWORDS = [
  'viagra',
  'casino',
  'lottery winner',
  'crypto investment',
  'click here now',
  'buy followers',
];
