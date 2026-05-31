/**
 * Provider Approved Notification Template
 * Sent when a provider's application is approved
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const providerApprovedTemplate: NotificationTemplate = {
  id: 'provider_approved',
  name: 'Provider Approved',
  description: 'Notification sent when a provider application is approved',
  category: 'account',
  priority: 'urgent',
  supportedChannels: ['email', 'sms', 'push', 'in_app', 'whatsapp'],
  requiresUserConsent: false,
  templates: {
    customer: undefined, // This is for provider accounts only
    provider: {
      email: {
        subject: 'Congratulations! Your Provider Account is Approved!',
        title: 'Account Approved!',
        body: `Congratulations! Your provider account has been approved!

Welcome to the NILIN provider community! We're thrilled to have you on board.

What You Can Do Now:
- Create and manage your services
- Accept booking requests from customers
- Set your availability and schedule
- Track your earnings and payouts
- Build your profile and portfolio

Your Next Steps:
1. Complete your profile with a professional photo and bio
2. Add your services with descriptions and pricing
3. Set your service areas and availability
4. Upload any required documents if not already done

Getting Started Resources:
- Provider Guide: {{providerGuideUrl}}
- Video Tutorials: {{videoTutorialsUrl}}
- Support: {{supportEmail}}

If you have any questions, our provider success team is here to help!

Best regards,
The NILIN Team`,
        actionText: 'Set Up Your Profile',
        actionUrl: '/provider/profile',
      },
      sms: {
        title: 'Account Approved!',
        body: 'Congratulations! Your NILIN provider account is approved. Start accepting bookings today! Visit {{dashboardUrl}} to get started.',
      },
      push: {
        title: 'Account Approved!',
        body: 'Your provider account is approved! Start adding your services and accepting bookings.',
        actionText: 'Get Started',
        actionUrl: '/provider/dashboard',
      },
      in_app: {
        title: 'Congratulations!',
        body: 'Your provider account is approved! Start accepting bookings and growing your business.',
        actionText: 'Set Up Profile',
        actionUrl: '/provider/profile',
      },
      whatsapp: {
        title: 'Account Approved!',
        body: `Congratulations {{providerName}}!

Your NILIN provider account is now approved!

Start your journey:
- Add your services
- Set your availability
- Accept bookings
- Grow your business

Welcome aboard! We're here to support your success.

Reply HELP if you need assistance.`,
      },
    },
  },
};

export function renderProviderApprovedTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'sms' | 'push' | 'in_app' | 'whatsapp',
  variables: TemplateVariables
) {
  const template = providerApprovedTemplate.templates[role]?.[channel];
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
