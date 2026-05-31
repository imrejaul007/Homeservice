/**
 * Birthday Notification Template
 * Sent to users on their birthday
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const birthdayTemplate: NotificationTemplate = {
  id: 'birthday',
  name: 'Birthday',
  description: 'Birthday greeting notification',
  category: 'promotional',
  priority: 'low',
  supportedChannels: ['email', 'push', 'in_app', 'whatsapp'],
  requiresUserConsent: false,
  templates: {
    customer: {
      email: {
        subject: 'Happy Birthday, {{userName}}! 🎂',
        title: 'Happy Birthday!',
        body: `Happy Birthday, {{userName}}!

Today is your special day, and we want to make it even more memorable!

As our gift to you, enjoy:
{{birthdayPerks}}

{{#if discountCode}}
Exclusive Birthday Discount: {{discountCode}}
{{discountPercentage}}% off your next booking!
Valid for {{validDays}} days.
{{/if}}

{{#if bonusPoints}}
Birthday Bonus: {{bonusPoints}} bonus loyalty points on your next booking!
{{/if}}

How to Redeem:
1. Book any service before {{expiryDate}}
2. Use your discount code at checkout
3. Enjoy your special treatment!

Thank you for being a valued member of NILIN. We hope you have an amazing birthday filled with joy and celebration!

Best wishes,
The NILIN Team`,
        actionText: 'Book Now',
        actionUrl: '/services?birthday=true',
      },
      push: {
        title: 'Happy Birthday! 🎂',
        body: 'Happy Birthday, {{userName}}! Enjoy {{birthdayPerks}} on us! Use code {{discountCode}} for {{discountPercentage}}% off.',
        actionText: 'Claim Offer',
        actionUrl: '/services?birthday=true',
      },
      in_app: {
        title: 'Happy Birthday!',
        body: 'Happy Birthday, {{userName}}! 🎂 Enjoy exclusive birthday perks and {{bonusPoints}} bonus points on your next booking!',
        actionText: 'Claim Birthday Offer',
        actionUrl: '/services?birthday=true',
      },
      whatsapp: {
        title: 'Happy Birthday! 🎂',
        body: `Happy Birthday, {{userName}}!

🎉 Wishing you an amazing day! 🎉

As our birthday gift to you:
{{birthdayPerks}}

{{#if discountCode}}
Use code: {{discountCode}}
{{discountPercentage}}% off (valid {{validDays}} days)

{{/if}}{{#if bonusPoints}}
Plus {{bonusPoints}} bonus loyalty points!
{{/if}}

Book now and celebrate with us!

NILIN 🎂`,
      },
    },
    provider: {
      email: {
        subject: 'Happy Birthday, {{userName}}! 🎂',
        title: 'Happy Birthday!',
        body: `Happy Birthday, {{userName}}!

Wishing you a wonderful birthday filled with joy and success!

As a token of our appreciation:
{{birthdayPerks}}

{{#if bonusEarnings}}
Birthday Bonus: {{bonusEarnings}}% extra earnings on all your bookings today!
{{/if}}

{{#if discountCode}}
Wellness Discount: {{discountCode}} - Take some time for yourself with {{discountPercentage}}% off any service.
{{/if}}

Thank you for being an amazing part of our provider community. Your dedication and service make a difference!

Here's to another great year!

Best wishes,
The NILIN Team`,
        actionText: 'View Offers',
        actionUrl: '/provider/offers',
      },
      push: {
        title: 'Happy Birthday! 🎂',
        body: 'Happy Birthday, {{userName}}! Enjoy {{birthdayPerks}} today. Thank you for being an amazing provider!',
        actionText: 'View Offers',
        actionUrl: '/provider/offers',
      },
      in_app: {
        title: 'Happy Birthday!',
        body: 'Happy Birthday, {{userName}}! 🎂 Enjoy {{birthdayPerks}} and {{bonusEarnings}}% extra earnings on bookings today!',
        actionText: 'View Offers',
        actionUrl: '/provider/offers',
      },
      whatsapp: {
        title: 'Happy Birthday! 🎂',
        body: `Happy Birthday, {{userName}}!

🎉 Wishing you a fantastic day! 🎉

As our birthday gift to you:
{{birthdayPerks}}

{{#if bonusEarnings}}
Today only: {{bonusEarnings}}% extra earnings on all your bookings!
{{/if}}

Thank you for being part of our amazing provider community!

Enjoy your special day! 🎂`,
      },
    },
  },
};

export function renderBirthdayTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'push' | 'in_app' | 'whatsapp',
  variables: TemplateVariables
) {
  const template = birthdayTemplate.templates[role]?.[channel];
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
