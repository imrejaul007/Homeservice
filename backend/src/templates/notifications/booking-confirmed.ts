/**
 * Booking Confirmed Notification Template
 * Sent when a booking is confirmed by the provider
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const bookingConfirmedTemplate: NotificationTemplate = {
  id: 'booking_confirmed',
  name: 'Booking Confirmed',
  description: 'Notification sent when a provider confirms a booking request',
  category: 'booking',
  priority: 'high',
  supportedChannels: ['email', 'sms', 'push', 'in_app', 'whatsapp'],
  requiresUserConsent: false,
  templates: {
    customer: {
      email: {
        subject: 'Your Booking #{{bookingNumber}} is Confirmed!',
        title: 'Booking Confirmed',
        body: `Great news! Your booking has been confirmed.

Booking Details:
- Booking Number: {{bookingNumber}}
- Service: {{serviceName}}
- Provider: {{providerName}}
- Date & Time: {{scheduledDate}} at {{scheduledTime}}
- Total Amount: {{currency}} {{totalAmount}}

{{#if notes}}
Provider Notes: {{notes}}
{{/if}}

Please arrive on time. If you need to make any changes, please contact your provider directly.

Thank you for choosing our platform!

Best regards,
The NILIN Team`,
        actionText: 'View Booking Details',
        actionUrl: '/customer/bookings/{{bookingId}}',
      },
      sms: {
        title: 'Booking Confirmed',
        body: 'Your booking #{{bookingNumber}} for {{serviceName}} is confirmed for {{scheduledDate}} at {{scheduledTime}}. Provider: {{providerName}}',
      },
      push: {
        title: 'Booking Confirmed!',
        body: 'Your booking for {{serviceName}} on {{scheduledDate}} has been confirmed by {{providerName}}.',
        actionText: 'View Details',
        actionUrl: '/customer/bookings/{{bookingId}}',
      },
      in_app: {
        title: 'Booking Confirmed!',
        body: 'Your booking for {{serviceName}} on {{scheduledDate}} at {{scheduledTime}} has been confirmed by {{providerName}}.',
        actionText: 'View Details',
        actionUrl: '/customer/bookings/{{bookingId}}',
      },
      whatsapp: {
        title: 'Booking Confirmed!',
        body: `Hi {{customerName}},

Your booking is confirmed!

Service: {{serviceName}}
Date: {{scheduledDate}} at {{scheduledTime}}
Provider: {{providerName}}
Amount: {{currency}} {{totalAmount}}

We'll send you a reminder before the appointment.`,
      },
    },
    provider: {
      email: {
        subject: 'Booking #{{bookingNumber}} Accepted - Customer Notified',
        title: 'Booking Accepted',
        body: `You have successfully accepted booking #{{bookingNumber}}.

Booking Details:
- Service: {{serviceName}}
- Customer: {{customerName}}
- Date & Time: {{scheduledDate}} at {{scheduledTime}}
- Location: {{serviceAddress}}
- Amount You'll Receive: {{currency}} {{providerEarnings}}

The customer has been notified of the confirmation. Please ensure you arrive on time.

Best regards,
The NILIN Team`,
        actionText: 'View Booking',
        actionUrl: '/provider/bookings/{{bookingId}}',
      },
      sms: {
        title: 'Booking Accepted',
        body: 'Booking #{{bookingNumber}} accepted. Customer: {{customerName}}, Date: {{scheduledDate}} at {{scheduledTime}}. Amount: {{currency}} {{providerEarnings}}',
      },
      push: {
        title: 'Booking Accepted!',
        body: 'You have accepted booking #{{bookingNumber}}. Customer: {{customerName}}. {{scheduledDate}} at {{scheduledTime}}.',
        actionText: 'View Details',
        actionUrl: '/provider/bookings/{{bookingId}}',
      },
      in_app: {
        title: 'Booking Accepted',
        body: 'Booking #{{bookingNumber}} accepted. Customer {{customerName}} will be notified. Scheduled for {{scheduledDate}} at {{scheduledTime}}.',
        actionText: 'View Booking',
        actionUrl: '/provider/bookings/{{bookingId}}',
      },
      whatsapp: {
        title: 'Booking Confirmed',
        body: `Booking #{{bookingNumber}} confirmed!

Customer: {{customerName}}
Service: {{serviceName}}
Date: {{scheduledDate}} at {{scheduledTime}}
Your Earnings: {{currency}} {{providerEarnings}}

Don't forget to prepare for the appointment!`,
      },
    },
  },
};

export function renderBookingConfirmedTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'sms' | 'push' | 'in_app' | 'whatsapp',
  variables: TemplateVariables
) {
  const template = bookingConfirmedTemplate.templates[role]?.[channel];
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
