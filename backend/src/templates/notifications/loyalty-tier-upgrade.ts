/**
 * Loyalty Tier Upgrade Notification Template
 * Sent when a customer upgrades their loyalty tier
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const loyaltyTierUpgradeTemplate: NotificationTemplate = {
  id: 'loyalty_tier_upgrade',
  name: 'Loyalty Tier Upgrade',
  description: 'Notification sent when a customer upgrades their loyalty program tier',
  category: 'loyalty',
  priority: 'normal',
  supportedChannels: ['email', 'push', 'in_app'],
  requiresUserConsent: false,
  templates: {
    customer: {
      email: {
        subject: 'Congratulations! You\'ve Unlocked {{newTier}} Status!',
        title: 'Tier Upgraded!',
        body: `Congratulations on reaching {{newTier}} status!

You've just unlocked exclusive benefits and rewards!

Your Loyalty Progress:
- Previous Tier: {{previousTier}}
- New Tier: {{newTier}}
- Current Points: {{currentPoints}}
- Points to Next Tier: {{pointsToNextTier}}

{{newTier}} Benefits:
{{benefitsList}}

How to Enjoy Your Benefits:
1. Your new tier status is automatically applied
2. Show your membership card in the app at participating locations
3. Some benefits require booking minimums - check the details

Your points never expire as long as you remain active. Keep earning and enjoying rewards!

Thank you for being a valued customer!

Best regards,
The NILIN Team`,
        actionText: 'View My Rewards',
        actionUrl: '/customer/rewards',
      },
      push: {
        title: 'Tier Upgraded!',
        body: 'You\'ve unlocked {{newTier}} status! Enjoy exclusive benefits and more rewards. {{currentPoints}} points - {{pointsToNextTier}} to next tier.',
        actionText: 'View Benefits',
        actionUrl: '/customer/rewards',
      },
      in_app: {
        title: 'Congratulations!',
        body: 'You\'ve reached {{newTier}} status! Enjoy exclusive {{newTier}} benefits. {{currentPoints}} points earned.',
        actionText: 'View Rewards',
        actionUrl: '/customer/rewards',
      },
    },
    provider: undefined, // This is for customers only
  },
};

export function renderLoyaltyTierUpgradeTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'push' | 'in_app',
  variables: TemplateVariables
) {
  const template = loyaltyTierUpgradeTemplate.templates[role]?.[channel];
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
