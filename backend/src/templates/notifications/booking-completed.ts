/**
 * Booking Completed Notification Template
 * Sent when a booking service is completed
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const bookingCompletedTemplate: NotificationTemplate = {
  id: 'booking_completed',
  name: 'Booking Completed',
  description: 'Notification sent when a service booking is completed',
  category: 'booking',
  priority: 'normal',
  supportedChannels: ['email', 'sms', 'push', 'in_app', 'whatsapp'],
  requiresUserConsent: false,
  templates: {
    customer: {
      email: {
        subject: 'Your Booking #{{bookingNumber}} is Complete - Leave a Review!',
        title: 'Service Completed',
        body: `Great news! Your service has been completed.

Booking Details:
- Booking Number: {{bookingNumber}}
- Service: {{serviceName}}
- Provider: {{providerName}}
- Completed On: {{completedDate}}
- Amount Paid: {{currency}} {{totalAmount}}

{{#if providerNotes}}
Provider Notes: {{providerNotes}}
{{/if}}

We hope you enjoyed your experience! Please take a moment to leave a review for {{providerName}}.

Your feedback helps other customers make informed decisions and helps providers improve their services.

As a thank you, you'll earn {{pointsEarned}} loyalty points for leaving a review!

Best regards,
The NILIN Team`,
        actionText: 'Leave a Review',
        actionUrl: '/customer/reviews/new?bookingId={{bookingId}}',
      },
      sms: {
        title: 'Service Completed',
        body: 'Your booking #{{bookingNumber}} for {{serviceName}} is complete! Leave a review for {{providerName}} and earn {{pointsEarned}} points. {{reviewLink}}',
      },
      push: {
        title: 'Service Completed!',
        body: 'Your booking for {{serviceName}} with {{providerName}} is complete. Leave a review to earn {{pointsEarned}} points!',
        actionText: 'Review Now',
        actionUrl: '/customer/reviews/new?bookingId={{bookingId}}',
      },
      in_app: {
        title: 'Service Completed!',
        body: 'Your booking for {{serviceName}} with {{providerName}} has been completed. Leave a review to earn {{pointsEarned}} loyalty points!',
        actionText: 'Leave Review',
        actionUrl: '/customer/reviews/new?bookingId={{bookingId}}',
      },
      whatsapp: {
        title: 'Service Completed!',
        body: `Hi {{customerName}}!

Your service is complete!

Service: {{serviceName}}
Provider: {{providerName}}
Completed: {{completedDate}}
Amount: {{currency}} {{totalAmount}}

We'd love to hear about your experience! Leave a review for {{providerName}} and earn {{pointsEarned}} loyalty points.

{{reviewLink}}`,
      },
    },
    provider: {
      email: {
        subject: 'Booking #{{bookingNumber}} Completed - Earnings Credited!',
        title: 'Service Completed',
        body: `You have successfully completed booking #{{bookingNumber}}.

Booking Details:
- Service: {{serviceName}}
- Customer: {{customerName}}
- Completed On: {{completedDate}}
- Location: {{serviceAddress}}

Earnings Summary:
- Service Amount: {{currency}} {{serviceAmount}}
- Platform Fee: {{currency}} {{platformFee}}
- Your Earnings: {{currency}} {{providerEarnings}}

Your earnings have been credited to your wallet and will be included in your next payout.

Thank you for providing excellent service!

Best regards,
The NILIN Team`,
        actionText: 'View Earnings',
        actionUrl: '/provider/earnings',
      },
      sms: {
        title: 'Booking Completed',
        body: 'Booking #{{bookingNumber}} completed. Earnings of {{currency}} {{providerEarnings}} credited to your wallet.',
      },
      push: {
        title: 'Booking Completed!',
        body: 'You completed booking #{{bookingNumber}} for {{serviceName}}. {{currency}} {{providerEarnings}} credited to your wallet.',
        actionText: 'View Earnings',
        actionUrl: '/provider/earnings',
      },
      in_app: {
        title: 'Service Completed',
        body: 'Booking #{{bookingNumber}} with {{customerName}} is complete. {{currency}} {{providerEarnings}} added to your wallet.',
        actionText: 'View Earnings',
        actionUrl: '/provider/earnings',
      },
      whatsapp: {
        title: 'Booking Completed!',
        body: `Great job! Booking #{{bookingNumber}} is complete.

Customer: {{customerName}}
Service: {{serviceName}}
Completed: {{completedDate}}

EARNINGS:
Service: {{currency}} {{serviceAmount}}
Your Earnings: {{currency}} {{providerEarnings}}

Funds credited to your wallet!`,
      },
    },
  },
};

export function renderBookingCompletedTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'sms' | 'push' | 'in_app' | 'whatsapp',
  variables: TemplateVariables
) {
  const template = bookingCompletedTemplate.templates[role]?.[channel];
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
