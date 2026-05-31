/**
 * Booking Cancelled Notification Template
 * Sent when a booking is cancelled by customer or provider
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const bookingCancelledTemplate: NotificationTemplate = {
  id: 'booking_cancelled',
  name: 'Booking Cancelled',
  description: 'Notification sent when a booking is cancelled',
  category: 'booking',
  priority: 'high',
  supportedChannels: ['email', 'sms', 'push', 'in_app', 'whatsapp'],
  requiresUserConsent: false,
  templates: {
    customer: {
      email: {
        subject: 'Booking #{{bookingNumber}} Cancelled',
        title: 'Booking Cancelled',
        body: `Your booking has been cancelled.

Booking Details:
- Booking Number: {{bookingNumber}}
- Service: {{serviceName}}
- Provider: {{providerName}}
- Original Date: {{scheduledDate}} at {{scheduledTime}}

{{#if refundAmount}}
Refund Information:
- Refund Amount: {{currency}} {{refundAmount}}
- Refund Method: {{refundMethod}}
- Refund Status: {{refundStatus}}
{{else}}
Cancellation Policy: {{cancellationPolicy}}
{{/if}}

{{#if cancelledByProvider}}
The provider has cancelled this booking. If you have any concerns, please contact our support team.
{{else}}
If you need to rebook, you can do so from your dashboard.
{{/if}}

Thank you for your understanding.

Best regards,
The NILIN Team`,
        actionText: 'Book Again',
        actionUrl: '/customer/bookings/new?serviceId={{serviceId}}',
      },
      sms: {
        title: 'Booking Cancelled',
        body: 'Your booking #{{bookingNumber}} for {{serviceName}} has been cancelled. {{#if refundAmount}}Refund of {{currency}} {{refundAmount}} will be processed.{{/if}}',
      },
      push: {
        title: 'Booking Cancelled',
        body: 'Your booking #{{bookingNumber}} for {{serviceName}} on {{scheduledDate}} has been cancelled. {{#if refundAmount}}Refund: {{currency}} {{refundAmount}}{{/if}}',
        actionText: 'View Details',
        actionUrl: '/customer/bookings/{{bookingId}}',
      },
      in_app: {
        title: 'Booking Cancelled',
        body: 'Booking #{{bookingNumber}} for {{serviceName}} has been cancelled. {{#if refundAmount}}Refund: {{currency}} {{refundAmount}}{{/if}}',
        actionText: 'View Details',
        actionUrl: '/customer/bookings/{{bookingId}}',
      },
      whatsapp: {
        title: 'Booking Cancelled',
        body: `Hi {{customerName}},

Your booking has been cancelled.

Booking: #{{bookingNumber}}
Service: {{serviceName}}
Provider: {{providerName}}
Date: {{scheduledDate}}

{{#if refundAmount}}
Refund Amount: {{currency}} {{refundAmount}}
Refund Method: {{refundMethod}}
Refund will be processed within 5-7 business days.
{{/if}}

{{#if cancelledByProvider}}
The provider cancelled this booking. Please contact support if you have concerns.
{{/if}}`,
      },
    },
    provider: {
      email: {
        subject: 'Booking #{{bookingNumber}} Cancelled',
        title: 'Booking Cancelled',
        body: `Booking #{{bookingNumber}} has been cancelled.

Booking Details:
- Service: {{serviceName}}
- Customer: {{customerName}}
- Original Date: {{scheduledDate}} at {{scheduledTime}}
- Location: {{serviceAddress}}

{{#if cancellationReason}}
Cancellation Reason: {{cancellationReason}}
{{/if}}

{{#if penaltyAmount}}
Cancellation Policy Applied:
- Penalty Amount: {{currency}} {{penaltyAmount}}
- Penalty Reason: {{penaltyReason}}
{{/if}}

{{#unless penaltyAmount}}
No cancellation penalty has been applied.
{{/unless}}

Best regards,
The NILIN Team`,
        actionText: 'View Booking',
        actionUrl: '/provider/bookings/{{bookingId}}',
      },
      sms: {
        title: 'Booking Cancelled',
        body: 'Booking #{{bookingNumber}} cancelled. Customer: {{customerName}}, Service: {{serviceName}}. {{#if penaltyAmount}}Penalty: {{currency}} {{penaltyAmount}}{{/if}}',
      },
      push: {
        title: 'Booking Cancelled',
        body: 'Booking #{{bookingNumber}} for {{serviceName}} with {{customerName}} has been cancelled.',
        actionText: 'View Details',
        actionUrl: '/provider/bookings/{{bookingId}}',
      },
      in_app: {
        title: 'Booking Cancelled',
        body: 'Booking #{{bookingNumber}} with {{customerName}} has been cancelled. {{#if penaltyAmount}}Penalty: {{currency}} {{penaltyAmount}}{{/if}}',
        actionText: 'View Booking',
        actionUrl: '/provider/bookings/{{bookingId}}',
      },
      whatsapp: {
        title: 'Booking Cancelled',
        body: `Booking #{{bookingNumber}} cancelled.

Customer: {{customerName}}
Service: {{serviceName}}
Date: {{scheduledDate}}

{{#if cancellationReason}}
Reason: {{cancellationReason}}
{{/if}}

{{#if penaltyAmount}}
Penalty Applied: {{currency}} {{penaltyAmount}}
{{else}}
No penalty applied.
{{/if}}`,
      },
    },
  },
};

export function renderBookingCancelledTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'sms' | 'push' | 'in_app' | 'whatsapp',
  variables: TemplateVariables
) {
  const template = bookingCancelledTemplate.templates[role]?.[channel];
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
