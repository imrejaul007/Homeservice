/**
 * Payment Received Notification Template
 * Sent when a payment is successfully processed
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const paymentReceivedTemplate: NotificationTemplate = {
  id: 'payment_received',
  name: 'Payment Received',
  description: 'Notification sent when a payment is successfully processed',
  category: 'payment',
  priority: 'high',
  supportedChannels: ['email', 'sms', 'push', 'in_app'],
  requiresUserConsent: false,
  templates: {
    customer: {
      email: {
        subject: 'Payment Confirmation - {{currency}} {{amount}}',
        title: 'Payment Received',
        body: `Your payment has been successfully processed.

Payment Details:
- Transaction ID: {{transactionId}}
- Amount: {{currency}} {{amount}}
- Payment Method: {{paymentMethod}}
- Date: {{paymentDate}}

For Booking: #{{bookingNumber}}
Service: {{serviceName}}

{{#if receiptUrl}}
Download your receipt: {{receiptUrl}}
{{/if}}

A confirmation has been sent to your email.

Thank you for your payment!

Best regards,
The NILIN Team`,
        actionText: 'View Receipt',
        actionUrl: '/customer/payments/{{transactionId}}',
      },
      sms: {
        title: 'Payment Confirmed',
        body: 'Payment of {{currency}} {{amount}} received for booking #{{bookingNumber}}. Transaction ID: {{transactionId}}. Thank you!',
      },
      push: {
        title: 'Payment Successful!',
        body: 'Your payment of {{currency}} {{amount}} for {{serviceName}} has been processed.',
        actionText: 'View Receipt',
        actionUrl: '/customer/payments/{{transactionId}}',
      },
      in_app: {
        title: 'Payment Received',
        body: 'Payment of {{currency}} {{amount}} received for booking #{{bookingNumber}}. Transaction: {{transactionId}}',
        actionText: 'View Details',
        actionUrl: '/customer/payments/{{transactionId}}',
      },
    },
    provider: {
      email: {
        subject: 'Payment Received for Booking #{{bookingNumber}}',
        title: 'Payment Processed',
        body: `A payment has been processed for your service.

Booking Details:
- Booking Number: {{bookingNumber}}
- Customer: {{customerName}}
- Service: {{serviceName}}
- Date: {{paymentDate}}

Payment Summary:
- Gross Amount: {{currency}} {{totalAmount}}
- Platform Fee: {{currency}} {{platformFee}}
- Your Earnings: {{currency}} {{providerEarnings}}

The earnings will be added to your wallet and included in your next payout.

Best regards,
The NILIN Team`,
        actionText: 'View Earnings',
        actionUrl: '/provider/earnings',
      },
      sms: {
        title: 'Payment Processed',
        body: 'Payment for booking #{{bookingNumber}} processed. Your earnings: {{currency}} {{providerEarnings}}',
      },
      push: {
        title: 'Payment Received!',
        body: 'Payment for {{serviceName}} received. {{currency}} {{providerEarnings}} added to your wallet.',
        actionText: 'View Earnings',
        actionUrl: '/provider/earnings',
      },
      in_app: {
        title: 'Payment Processed',
        body: 'Booking #{{bookingNumber}} payment processed. {{currency}} {{providerEarnings}} added to wallet.',
        actionText: 'View Earnings',
        actionUrl: '/provider/earnings',
      },
    },
  },
};

export function renderPaymentReceivedTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'sms' | 'push' | 'in_app',
  variables: TemplateVariables
) {
  const template = paymentReceivedTemplate.templates[role]?.[channel];
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
