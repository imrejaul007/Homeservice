/**
 * Dispute Resolved Notification Template
 * Sent when a dispute has been resolved
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const disputeResolvedTemplate: NotificationTemplate = {
  id: 'dispute_resolved',
  name: 'Dispute Resolved',
  description: 'Notification sent when a dispute has been resolved',
  category: 'account',
  priority: 'high',
  supportedChannels: ['email', 'sms', 'push', 'in_app'],
  requiresUserConsent: false,
  templates: {
    customer: {
      email: {
        subject: 'Dispute #{{disputeId}} Resolved',
        title: 'Dispute Resolved',
        body: `Your dispute has been resolved.

Dispute Details:
- Dispute ID: {{disputeId}}
- Booking: #{{bookingNumber}}
- Service: {{serviceName}}
- Opened On: {{openedDate}}
- Resolved On: {{resolvedDate}}

Resolution:
- Decision: {{decision}}
- Amount Awarded: {{currency}} {{amountAwarded}}
- Refund Status: {{refundStatus}}

Resolution Notes:
{{resolutionNotes}}

{{#if amountAwarded}}
{{#if refundStatus}}
Your refund of {{currency}} {{amountAwarded}} will be processed within 5-10 business days.
{{else}}
The awarded amount will be credited to your wallet.
{{/if}}
{{/if}}

If you have any questions about this resolution, please contact our support team within 7 days.

Best regards,
The NILIN Team`,
        actionText: 'View Resolution',
        actionUrl: '/customer/disputes/{{disputeId}}',
      },
      sms: {
        title: 'Dispute Resolved',
        body: 'Dispute #{{disputeId}} for booking #{{bookingNumber}} has been resolved. Decision: {{decision}}. {{#if amountAwarded}}Amount awarded: {{currency}} {{amountAwarded}}{{/if}}',
      },
      push: {
        title: 'Dispute Resolved!',
        body: 'Your dispute #{{disputeId}} has been resolved. Decision: {{decision}}. {{#if amountAwarded}}Awarded: {{currency}} {{amountAwarded}}{{/if}}',
        actionText: 'View Details',
        actionUrl: '/customer/disputes/{{disputeId}}',
      },
      in_app: {
        title: 'Dispute Resolved',
        body: 'Dispute #{{disputeId}} resolved. Decision: {{decision}}. {{#if amountAwarded}}Awarded: {{currency}} {{amountAwarded}}{{/if}}',
        actionText: 'View Resolution',
        actionUrl: '/customer/disputes/{{disputeId}}',
      },
    },
    provider: {
      email: {
        subject: 'Dispute #{{disputeId}} Resolved',
        title: 'Dispute Resolved',
        body: `The dispute for booking #{{bookingNumber}} has been resolved.

Dispute Details:
- Dispute ID: {{disputeId}}
- Customer: {{customerName}}
- Service: {{serviceName}}
- Opened On: {{openedDate}}
- Resolved On: {{resolvedDate}}

Resolution:
- Decision: {{decision}}
- Amount Deducted: {{currency}} {{amountDeducted}}
- Refund to Customer: {{currency}} {{refundAmount}}

Resolution Notes:
{{resolutionNotes}}

{{#if amountDeducted}}
The amount of {{currency}} {{amountDeducted}} has been deducted from your wallet.
{{/if}}

If you have any questions about this resolution, please contact our support team within 7 days.

Best regards,
The NILIN Team`,
        actionText: 'View Resolution',
        actionUrl: '/provider/disputes/{{disputeId}}',
      },
      sms: {
        title: 'Dispute Resolved',
        body: 'Dispute #{{disputeId}} for booking #{{bookingNumber}} resolved. Decision: {{decision}}. {{#if amountDeducted}}Deducted: {{currency}} {{amountDeducted}}{{/if}}',
      },
      push: {
        title: 'Dispute Resolved',
        body: 'Dispute #{{disputeId}} resolved. Decision: {{decision}}. {{#if amountDeducted}}Deducted: {{currency}} {{amountDeducted}}{{/if}}',
        actionText: 'View Details',
        actionUrl: '/provider/disputes/{{disputeId}}',
      },
      in_app: {
        title: 'Dispute Resolved',
        body: 'Dispute #{{disputeId}} resolved. Decision: {{decision}}. {{#if amountDeducted}}Deducted: {{currency}} {{amountDeducted}}{{/if}}',
        actionText: 'View Resolution',
        actionUrl: '/provider/disputes/{{disputeId}}',
      },
    },
  },
};

export function renderDisputeResolvedTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'sms' | 'push' | 'in_app',
  variables: TemplateVariables
) {
  const template = disputeResolvedTemplate.templates[role]?.[channel];
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
