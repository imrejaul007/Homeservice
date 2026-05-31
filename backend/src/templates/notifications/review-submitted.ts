/**
 * Review Submitted Notification Template
 * Sent when a review is submitted by a customer
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

export const reviewSubmittedTemplate: NotificationTemplate = {
  id: 'review_submitted',
  name: 'Review Submitted',
  description: 'Notification sent when a customer submits a review',
  category: 'review',
  priority: 'normal',
  supportedChannels: ['email', 'push', 'in_app'],
  requiresUserConsent: false,
  templates: {
    customer: {
      email: {
        subject: 'Thank You for Your Review!',
        title: 'Review Submitted',
        body: `Thank you for sharing your feedback!

You have submitted a review for:
- Service: {{serviceName}}
- Provider: {{providerName}}
- Your Rating: {{rating}} {{stars}}
- Date: {{reviewDate}}

{{#if reviewText}}
Your Review:
"{{reviewText}}"
{{/if}}

Points Earned: {{pointsEarned}} loyalty points

Your review helps other customers make informed decisions and helps providers improve their services.

Thank you for being part of our community!

Best regards,
The NILIN Team`,
        actionText: 'View Your Reviews',
        actionUrl: '/customer/reviews',
      },
      push: {
        title: 'Review Submitted!',
        body: 'Your {{rating}}-star review for {{serviceName}} has been posted. You earned {{pointsEarned}} points!',
        actionText: 'View Review',
        actionUrl: '/customer/reviews',
      },
      in_app: {
        title: 'Review Submitted!',
        body: 'Your {{rating}}-star review for {{providerName}} has been posted. {{pointsEarned}} loyalty points earned!',
        actionText: 'View Review',
        actionUrl: '/customer/reviews',
      },
    },
    provider: {
      email: {
        subject: 'New {{rating}}-Star Review from {{customerName}}!',
        title: 'New Review Received',
        body: `Great news! You have received a new review.

Review Details:
- Customer: {{customerName}}
- Service: {{serviceName}}
- Rating: {{rating}} {{stars}}
- Date: {{reviewDate}}

Customer Feedback:
"{{reviewText}}"

{{#if ownerReply}}
Your Previous Reply:
"{{ownerReply}}"
{{/if}}

Your Average Rating: {{newAverageRating}} ({{totalReviews}} reviews)

Positive reviews help attract more customers to your business. Keep up the excellent work!

Best regards,
The NILIN Team`,
        actionText: 'Reply to Review',
        actionUrl: '/provider/reviews',
      },
      push: {
        title: 'New Review!',
        body: '{{customerName}} gave you {{rating}} stars for {{serviceName}}! " {{reviewText}}"',
        actionText: 'View & Reply',
        actionUrl: '/provider/reviews',
      },
      in_app: {
        title: 'New Review Received',
        body: '{{customerName}} left a {{rating}}-star review for {{serviceName}}. Your new average: {{newAverageRating}}',
        actionText: 'View Review',
        actionUrl: '/provider/reviews',
      },
    },
  },
};

export function renderReviewSubmittedTemplate(
  eventType: NotificationEventType,
  role: 'customer' | 'provider',
  channel: 'email' | 'push' | 'in_app',
  variables: TemplateVariables
) {
  const template = reviewSubmittedTemplate.templates[role]?.[channel];
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
