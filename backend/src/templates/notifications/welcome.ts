/**
 * Welcome Notification Template
 * Sent when a new user registers on the platform
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const welcomeTemplate: NotificationTemplate = {
  id: 'welcome',
  name: 'Welcome',
  description: 'Welcome notification for new users',
  category: 'promotional',
  priority: 'normal',
  supportedChannels: ['email', 'push', 'in_app', 'whatsapp'],
  requiresUserConsent: false,
  templates: {
    customer: {
      email: {
        subject: 'Welcome to NILIN, {{userName}}!',
        title: 'Welcome to NILIN!',
        body: `Welcome to NILIN, {{userName}}!

We're thrilled to have you join our community of beauty and wellness enthusiasts.

What You Can Do on NILIN:
- Discover top-rated beauty professionals in your area
- Book services like hair styling, makeup, nails, skincare, and more
- Earn loyalty points with every booking
- Unlock exclusive member benefits and rewards
- Read and leave reviews to help others

Getting Started:
1. Set up your profile with your preferences
2. Browse services and providers
3. Book your first service
4. Start earning points!

{{#if referralCode}}
Your Referral Code: {{referralCode}}
Share with friends and both of you will earn bonus points!
{{/if}}

Need help? Our support team is always here for you at {{supportEmail}}.

Here's to your first booking!

Best regards,
The NILIN Team`,
        actionText: 'Explore Services',
        actionUrl: '/services',
      },
      push: {
        title: 'Welcome to NILIN!',
        body: 'Hi {{userName}}! Discover top beauty professionals near you. Start your first booking today!',
        actionText: 'Get Started',
        actionUrl: '/services',
      },
      in_app: {
        title: 'Welcome!',
        body: 'Welcome to NILIN, {{userName}}! Discover amazing beauty services and earn rewards with every booking.',
        actionText: 'Start Exploring',
        actionUrl: '/services',
      },
      whatsapp: {
        title: 'Welcome to NILIN!',
        body: `Hi {{userName}}!

Welcome to NILIN - your gateway to beauty and wellness services.

What awaits you:
- Top-rated professionals
- Easy booking
- Loyalty rewards
- Exclusive offers

Get {{welcomeBonus}} points on your first booking!

Explore now: {{appLink}}`,
      },
    },
    provider: {
      email: {
        subject: 'Welcome to NILIN as a Provider, {{userName}}!',
        title: 'Welcome to NILIN!',
        body: `Welcome, {{userName}}!

Thank you for joining NILIN as a service provider. We're excited to have you as part of our growing community of beauty and wellness professionals.

Getting Started:
1. Complete your profile - add a professional photo and bio
2. Add your services with descriptions and pricing
3. Set your service areas and availability
4. Upload required documents for verification

Your Benefits:
- Reach customers in your area
- Manage your own schedule
- Secure payments through our platform
- Build your reputation with reviews
- Grow your business with our marketing support

Resources:
- Provider Guide: {{providerGuideUrl}}
- Help Center: {{helpCenterUrl}}
- Contact Support: {{supportEmail}}

Questions? Our provider success team is here to help you succeed!

Best regards,
The NILIN Team`,
        actionText: 'Complete Your Profile',
        actionUrl: '/provider/profile',
      },
      push: {
        title: 'Welcome to NILIN!',
        body: 'Welcome, {{userName}}! Complete your profile to start accepting bookings and growing your business.',
        actionText: 'Get Started',
        actionUrl: '/provider/profile',
      },
      in_app: {
        title: 'Welcome!',
        body: 'Welcome to NILIN, {{userName}}! Complete your profile and start accepting bookings from customers.',
        actionText: 'Set Up Profile',
        actionUrl: '/provider/profile',
      },
      whatsapp: {
        title: 'Welcome to NILIN!',
        body: `Welcome, {{userName}}!

You're now part of NILIN's provider community.

Get started:
1. Complete your profile
2. Add your services
3. Set your availability
4. Start accepting bookings

Need help? We're here for you!

Welcome aboard!`,
      },
    },
  },
};

export function renderWelcomeTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'push' | 'in_app' | 'whatsapp',
  variables: TemplateVariables
) {
  const template = welcomeTemplate.templates[role]?.[channel];
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
