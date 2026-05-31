/**
 * Refund Processed Notification Template
 * Sent when a refund is successfully processed
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const refundProcessedTemplate: NotificationTemplate = {
  id: 'refund_processed',
  name: 'Refund Processed',
  description: 'Notification sent when a refund is successfully processed',
  category: 'payment',
  priority: 'high',
  supportedChannels: ['email', 'sms', 'push', 'in_app'],
  requiresUserConsent: false,
  templates: {
    customer: {
      email: {
        subject: 'Refund Processed - {{currency}} {{refundAmount}}',
        title: 'Refund Processed',
        body: `Your refund has been successfully processed.

Refund Details:
- Refund ID: {{refundId}}
- Original Booking: #{{bookingNumber}}
- Refund Amount: {{currency}} {{refundAmount}}
- Refund Method: {{refundMethod}}
- Processing Date: {{processedDate}}
- Estimated Arrival: {{estimatedArrival}}

{{#if refundReason}}
Reason: {{refundReason}}
{{/if}}

{{#if pointsReturned}}
Loyalty Points Returned: {{pointsReturned}} points
{{/if}}

The refund has been initiated to your original payment method. Depending on your bank or payment provider, it may take 5-10 business days to appear in your account.

If you have any questions about this refund, please contact our support team.

Best regards,
The NILIN Team`,
        actionText: 'View Refund Details',
        actionUrl: '/customer/refunds/{{refundId}}',
      },
      sms: {
        title: 'Refund Processed',
        body: 'Refund of {{currency}} {{refundAmount}} for booking #{{bookingNumber}} has been processed. It will arrive in your {{refundMethod}} within 5-10 business days.',
      },
      push: {
        title: 'Refund Processed!',
        body: 'Your refund of {{currency}} {{refundAmount}} for booking #{{bookingNumber}} has been processed. Arriving to your {{refundMethod}}.',
        actionText: 'View Details',
        actionUrl: '/customer/refunds/{{refundId}}',
      },
      in_app: {
        title: 'Refund Processed',
        body: 'Refund of {{currency}} {{refundAmount}} for booking #{{bookingNumber}} has been initiated. Will arrive in your {{refundMethod}} in 5-10 business days.',
        actionText: 'View Details',
        actionUrl: '/customer/refunds/{{refundId}}',
      },
    },
    provider: {
      email: {
        subject: 'Refund Issued for Booking #{{bookingNumber}}',
        title: 'Refund Processed',
        body: `A refund has been processed for a booking.

Booking Details:
- Booking Number: {{bookingNumber}}
- Customer: {{customerName}}
- Service: {{serviceName}}
- Original Amount: {{currency}} {{originalAmount}}

Refund Summary:
- Refund Amount: {{currency}} {{refundAmount}}
- Refund Reason: {{refundReason}}
- Processing Date: {{processedDate}}

Deduction from Wallet:
- Amount Deducted: {{currency}} {{deductedAmount}}
{{#if noPenalty}}
Note: No penalty was applied as the cancellation was within the allowed window.
{{/if}}

If you have any questions, please contact our support team.

Best regards,
The NILIN Team`,
        actionText: 'View Booking',
        actionUrl: '/provider/bookings/{{bookingId}}',
      },
      sms: {
        title: 'Refund Processed',
        body: 'Refund of {{currency}} {{refundAmount}} issued for booking #{{bookingNumber}}. {{currency}} {{deductedAmount}} deducted from wallet.',
      },
      push: {
        title: 'Refund Processed',
        body: 'Refund of {{currency}} {{refundAmount}} for booking #{{bookingNumber}}. {{currency}} {{deductedAmount}} deducted from wallet.',
        actionText: 'View Details',
        actionUrl: '/provider/bookings/{{bookingId}}',
      },
      in_app: {
        title: 'Refund Processed',
        body: 'Refund of {{currency}} {{refundAmount}} for booking #{{bookingNumber}}. {{currency}} {{deductedAmount}} deducted from wallet.',
        actionText: 'View Booking',
        actionUrl: '/provider/bookings/{{bookingId}}',
      },
    },
  },
};

export function renderRefundProcessedTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'sms' | 'push' | 'in_app',
  variables: TemplateVariables
) {
  const template = refundProcessedTemplate.templates[role]?.[channel];
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
