/**
 * Dispute Opened Notification Template
 * Sent when a dispute is opened for a booking
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const disputeOpenedTemplate: NotificationTemplate = {
  id: 'dispute_opened',
  name: 'Dispute Opened',
  description: 'Notification sent when a dispute is opened for a booking',
  category: 'account',
  priority: 'urgent',
  supportedChannels: ['email', 'sms', 'push', 'in_app'],
  requiresUserConsent: false,
  templates: {
    customer: {
      email: {
        subject: 'Dispute Opened - Booking #{{bookingNumber}}',
        title: 'Dispute Opened',
        body: `You have opened a dispute for booking #{{bookingNumber}}.

Dispute Details:
- Dispute ID: {{disputeId}}
- Booking: #{{bookingNumber}}
- Service: {{serviceName}}
- Provider: {{providerName}}
- Dispute Reason: {{disputeReason}}
- Claimed Amount: {{currency}} {{claimedAmount}}
- Opened On: {{openedDate}}

What happens next:
1. Our dispute resolution team will review the case
2. We may contact you for additional information
3. The provider will be notified and given a chance to respond
4. A decision will be made within {{resolutionDays}} business days

Please ensure you have all relevant documentation ready to support your claim.

Best regards,
The NILIN Team`,
        actionText: 'View Dispute',
        actionUrl: '/customer/disputes/{{disputeId}}',
      },
      sms: {
        title: 'Dispute Opened',
        body: 'Dispute #{{disputeId}} opened for booking #{{bookingNumber}}. Reason: {{disputeReason}}. Our team will review and contact you within {{resolutionDays}} days.',
      },
      push: {
        title: 'Dispute Opened',
        body: 'Your dispute for booking #{{bookingNumber}} has been opened. Our team will review and respond within {{resolutionDays}} business days.',
        actionText: 'View Details',
        actionUrl: '/customer/disputes/{{disputeId}}',
      },
      in_app: {
        title: 'Dispute Opened',
        body: 'Dispute #{{disputeId}} opened for booking #{{bookingNumber}}. Reason: {{disputeReason}}. Our team will review within {{resolutionDays}} business days.',
        actionText: 'View Dispute',
        actionUrl: '/customer/disputes/{{disputeId}}',
      },
    },
    provider: {
      email: {
        subject: 'Dispute Filed - Booking #{{bookingNumber}}',
        title: 'Dispute Filed',
        body: `A dispute has been filed against your booking.

Dispute Details:
- Dispute ID: {{disputeId}}
- Booking: #{{bookingNumber}}
- Customer: {{customerName}}
- Service: {{serviceName}}
- Dispute Reason: {{disputeReason}}
- Claimed Amount: {{currency}} {{claimedAmount}}
- Opened On: {{openedDate}}

What you need to do:
1. Review the dispute reason carefully
2. Provide your response and any supporting evidence
3. Submit your response within {{responseDays}} days to avoid automatic resolution

Failure to respond may result in the dispute being resolved against you.

Best regards,
The NILIN Team`,
        actionText: 'Respond to Dispute',
        actionUrl: '/provider/disputes/{{disputeId}}',
      },
      sms: {
        title: 'Dispute Filed',
        body: 'Dispute #{{disputeId}} filed for booking #{{bookingNumber}}. Reason: {{disputeReason}}. Please respond within {{responseDays}} days.',
      },
      push: {
        title: 'Dispute Filed!',
        body: 'A dispute has been filed for booking #{{bookingNumber}}. Reason: {{disputeReason}}. Please respond within {{responseDays}} days.',
        actionText: 'Respond Now',
        actionUrl: '/provider/disputes/{{disputeId}}',
      },
      in_app: {
        title: 'Dispute Filed',
        body: 'Customer {{customerName}} filed a dispute for booking #{{bookingNumber}}. Reason: {{disputeReason}}. Respond within {{responseDays}} days.',
        actionText: 'Respond to Dispute',
        actionUrl: '/provider/disputes/{{disputeId}}',
      },
    },
  },
};

export function renderDisputeOpenedTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'sms' | 'push' | 'in_app',
  variables: TemplateVariables
) {
  const template = disputeOpenedTemplate.templates[role]?.[channel];
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
