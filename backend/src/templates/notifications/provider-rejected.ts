/**
 * Provider Rejected Notification Template
 * Sent when a provider's application is rejected
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const providerRejectedTemplate: NotificationTemplate = {
  id: 'provider_rejected',
  name: 'Provider Rejected',
  description: 'Notification sent when a provider application is rejected',
  category: 'account',
  priority: 'high',
  supportedChannels: ['email', 'push', 'in_app'],
  requiresUserConsent: false,
  templates: {
    customer: undefined, // This is for provider accounts only
    provider: {
      email: {
        subject: 'Application Update - Provider Account',
        title: 'Application Not Approved',
        body: `Thank you for your interest in becoming a NILIN provider.

After careful review, we regret to inform you that your provider application has not been approved at this time.

Application Details:
- Submitted On: {{submittedDate}}
- Reviewed On: {{reviewedDate}}

Reason for Decision:
{{rejectionReason}}

What You Can Do:
1. Review the feedback provided above
2. Address the issues mentioned
3. Update your application with corrections or additional information
4. Resubmit your application

Common Reasons for Rejection:
- Incomplete profile information
- Missing or unclear documents
- Services don't meet our quality standards
- Location outside service area
- Verification issues

If you believe this decision was made in error or have questions, please contact our support team at {{supportEmail}}.

We're committed to maintaining high standards for our provider community to ensure the best experience for customers.

Best regards,
The NILIN Team`,
        actionText: 'Update Application',
        actionUrl: '/provider/apply',
      },
      push: {
        title: 'Application Update',
        body: 'Your provider application was not approved. Review the feedback and consider resubmitting.',
        actionText: 'View Details',
        actionUrl: '/provider/apply',
      },
      in_app: {
        title: 'Application Not Approved',
        body: 'Your provider application was not approved at this time. Review the feedback to improve your resubmission.',
        actionText: 'View Feedback',
        actionUrl: '/provider/apply',
      },
    },
  },
};

export function renderProviderRejectedTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'push' | 'in_app',
  variables: TemplateVariables
) {
  const template = providerRejectedTemplate.templates[role]?.[channel];
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
