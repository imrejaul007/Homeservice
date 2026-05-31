/**
 * Booking Reminder Notification Template
 * Sent before a booking to remind customers and providers
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const bookingReminderTemplate: NotificationTemplate = {
  id: 'booking_reminder',
  name: 'Booking Reminder',
  description: 'Reminder notification sent before a scheduled booking',
  category: 'booking',
  priority: 'high',
  supportedChannels: ['email', 'sms', 'push', 'in_app', 'whatsapp'],
  requiresUserConsent: false,
  templates: {
    customer: {
      email: {
        subject: 'Reminder: Your Booking #{{bookingNumber}} is Tomorrow',
        title: 'Booking Reminder',
        body: `This is a friendly reminder about your upcoming booking.

Booking Details:
- Booking Number: {{bookingNumber}}
- Service: {{serviceName}}
- Provider: {{providerName}}
- Date & Time: {{scheduledDate}} at {{scheduledTime}}
- Location: {{serviceAddress}}

{{#if providerPhone}}
Provider Contact: {{providerPhone}}
{{/if}}

Please ensure you are available at the scheduled time. If you need to reschedule, please do so at least 24 hours in advance.

We look forward to seeing you!

Best regards,
The NILIN Team`,
        actionText: 'View Booking',
        actionUrl: '/customer/bookings/{{bookingId}}',
      },
      sms: {
        title: 'Booking Reminder',
        body: 'Reminder: Your booking #{{bookingNumber}} for {{serviceName}} is tomorrow at {{scheduledTime}}. Provider: {{providerName}}. Address: {{serviceAddress}}',
      },
      push: {
        title: 'Reminder: Booking Tomorrow',
        body: 'Your booking for {{serviceName}} with {{providerName}} is tomorrow at {{scheduledTime}}. Address: {{serviceAddress}}',
        actionText: 'View Details',
        actionUrl: '/customer/bookings/{{bookingId}}',
      },
      in_app: {
        title: 'Booking Reminder',
        body: 'Your booking for {{serviceName}} with {{providerName}} is tomorrow at {{scheduledTime}}. Location: {{serviceAddress}}',
        actionText: 'View Details',
        actionUrl: '/customer/bookings/{{bookingId}}',
      },
      whatsapp: {
        title: 'Booking Reminder',
        body: `Hi {{customerName}}!

Just a reminder about your booking tomorrow:

Service: {{serviceName}}
Time: {{scheduledTime}}
Provider: {{providerName}}
Address: {{serviceAddress}}

See you then!`,
      },
    },
    provider: {
      email: {
        subject: 'Reminder: You Have a Booking Tomorrow - #{{bookingNumber}}',
        title: 'Booking Reminder',
        body: `This is a reminder about your upcoming booking.

Booking Details:
- Booking Number: {{bookingNumber}}
- Customer: {{customerName}}
- Service: {{serviceName}}
- Date & Time: {{scheduledDate}} at {{scheduledTime}}
- Location: {{serviceAddress}}
- Your Earnings: {{currency}} {{providerEarnings}}

Please prepare your equipment and arrive on time.

Best regards,
The NILIN Team`,
        actionText: 'View Booking',
        actionUrl: '/provider/bookings/{{bookingId}}',
      },
      sms: {
        title: 'Booking Reminder',
        body: 'Reminder: Booking #{{bookingNumber}} tomorrow at {{scheduledTime}}. Customer: {{customerName}}, Address: {{serviceAddress}}. Earnings: {{currency}} {{providerEarnings}}',
      },
      push: {
        title: 'Booking Reminder',
        body: 'You have a booking tomorrow at {{scheduledTime}} with {{customerName}} for {{serviceName}}. Address: {{serviceAddress}}',
        actionText: 'View Details',
        actionUrl: '/provider/bookings/{{bookingId}}',
      },
      in_app: {
        title: 'Booking Tomorrow',
        body: 'Your booking with {{customerName}} for {{serviceName}} is tomorrow at {{scheduledTime}}. Location: {{serviceAddress}}',
        actionText: 'View Booking',
        actionUrl: '/provider/bookings/{{bookingId}}',
      },
      whatsapp: {
        title: 'Booking Reminder',
        body: `Reminder: You have a booking tomorrow!

Customer: {{customerName}}
Service: {{serviceName}}
Time: {{scheduledTime}}
Address: {{serviceAddress}}
Your Earnings: {{currency}} {{providerEarnings}}

Prepare your equipment and arrive on time!`,
      },
    },
  },
};

export function renderBookingReminderTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'sms' | 'push' | 'in_app' | 'whatsapp',
  variables: TemplateVariables
) {
  const template = bookingReminderTemplate.templates[role]?.[channel];
  if (!template) return null;

  return {
    channel,
    subject: template.subject ? renderTemplate(template.subject, variables) : undefined,
    title: renderTemplate(template.title, variables),
    body: renderTemplate(template.body, variables),
    actionText: template.actionText ? renderTemplate(template.actionText, variables) : undefined,
    actionUrl: template.actionUrl ? renderTemplate(template.actionUrl, variables) : undefined,
    metadata: variables,
  };
}
