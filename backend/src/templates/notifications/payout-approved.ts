/**
 * Payout Approved Notification Template
 * Sent when a provider's payout is approved and processed
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const payoutApprovedTemplate: NotificationTemplate = {
  id: 'payout_approved',
  name: 'Payout Approved',
  description: 'Notification sent when a provider payout is approved and processed',
  category: 'payment',
  priority: 'high',
  supportedChannels: ['email', 'sms', 'push', 'in_app'],
  requiresUserConsent: false,
  templates: {
    customer: undefined, // Payouts are for providers only
    provider: {
      email: {
        subject: 'Payout Approved - {{currency}} {{amount}} on its way!',
        title: 'Payout Approved',
        body: `Great news! Your payout has been approved and is being processed.

Payout Details:
- Payout ID: {{payoutId}}
- Amount: {{currency}} {{amount}}
- Payout Method: {{payoutMethod}}
- Bank/Account: {{accountLast4}}
- Approved On: {{approvedDate}}

Earnings Summary for This Payout:
- Total Bookings: {{totalBookings}}
- Gross Earnings: {{currency}} {{grossEarnings}}
- Platform Fees: {{currency}} {{platformFees}}
- Adjustments: {{currency}} {{adjustments}}
- Net Payout: {{currency}} {{amount}}

Processing Time:
- {{payoutMethod}} typically arrives within 1-3 business days
- International transfers may take 3-5 business days

Track your payout in your dashboard.

Best regards,
The NILIN Team`,
        actionText: 'View Payout History',
        actionUrl: '/provider/payouts',
      },
      sms: {
        title: 'Payout Approved',
        body: 'Your payout of {{currency}} {{amount}} has been approved and will arrive in your {{payoutMethod}} within 1-3 business days. Payout ID: {{payoutId}}',
      },
      push: {
        title: 'Payout Approved!',
        body: 'Your payout of {{currency}} {{amount}} is on its way to your {{payoutMethod}}!',
        actionText: 'View Details',
        actionUrl: '/provider/payouts',
      },
      in_app: {
        title: 'Payout Approved',
        body: 'Payout #{{payoutId}} of {{currency}} {{amount}} approved. Arriving to your {{payoutMethod}} in 1-3 business days.',
        actionText: 'View Payouts',
        actionUrl: '/provider/payouts',
      },
    },
  },
};

export function renderPayoutApprovedTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'sms' | 'push' | 'in_app',
  variables: TemplateVariables
) {
  const template = payoutApprovedTemplate.templates[role]?.[channel];
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
