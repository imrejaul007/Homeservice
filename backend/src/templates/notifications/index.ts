/**
 * Notification Templates Index
 * Central export for all notification templates
 */

export * from './types';
export * from './booking-confirmed';
export * from './booking-reminder';
export * from './booking-cancelled';
export * from './booking-completed';
export * from './payment-received';
export * from './refund-processed';
export * from './review-submitted';
export * from './dispute-opened';
export * from './dispute-resolved';
export * from './payout-approved';
export * from './provider-approved';
export * from './provider-rejected';
export * from './loyalty-tier-upgrade';
export * from './welcome';
export * from './birthday';

import { NotificationTemplate, NotificationEventType, UserRole, NotificationChannel, RenderedNotification, TemplateVariables } from './types';

// Import all templates
import { bookingConfirmedTemplate, renderBookingConfirmedTemplate } from './booking-confirmed';
import { bookingReminderTemplate, renderBookingReminderTemplate } from './booking-reminder';
import { bookingCancelledTemplate, renderBookingCancelledTemplate } from './booking-cancelled';
import { bookingCompletedTemplate, renderBookingCompletedTemplate } from './booking-completed';
import { paymentReceivedTemplate, renderPaymentReceivedTemplate } from './payment-received';
import { refundProcessedTemplate, renderRefundProcessedTemplate } from './refund-processed';
import { reviewSubmittedTemplate, renderReviewSubmittedTemplate } from './review-submitted';
import { disputeOpenedTemplate, renderDisputeOpenedTemplate } from './dispute-opened';
import { disputeResolvedTemplate, renderDisputeResolvedTemplate } from './dispute-resolved';
import { payoutApprovedTemplate, renderPayoutApprovedTemplate } from './payout-approved';
import { providerApprovedTemplate, renderProviderApprovedTemplate } from './provider-approved';
import { providerRejectedTemplate, renderProviderRejectedTemplate } from './provider-rejected';
import { loyaltyTierUpgradeTemplate, renderLoyaltyTierUpgradeTemplate } from './loyalty-tier-upgrade';
import { welcomeTemplate, renderWelcomeTemplate } from './welcome';
import { birthdayTemplate, renderBirthdayTemplate } from './birthday';

/**
 * Registry of all notification templates
 */
export const notificationTemplates: Record<NotificationEventType, NotificationTemplate> = {
  booking_confirmed: bookingConfirmedTemplate,
  booking_reminder: bookingReminderTemplate,
  booking_cancelled: bookingCancelledTemplate,
  booking_completed: bookingCompletedTemplate,
  payment_received: paymentReceivedTemplate,
  refund_processed: refundProcessedTemplate,
  review_submitted: reviewSubmittedTemplate,
  dispute_opened: disputeOpenedTemplate,
  dispute_resolved: disputeResolvedTemplate,
  payout_approved: payoutApprovedTemplate,
  provider_approved: providerApprovedTemplate,
  provider_rejected: providerRejectedTemplate,
  loyalty_tier_upgrade: loyaltyTierUpgradeTemplate,
  welcome: welcomeTemplate,
  birthday: birthdayTemplate,
};

/**
 * Render a notification template for a specific event, role, and channel
 */
export function renderNotification(
  eventType: NotificationEventType,
  role: UserRole,
  channel: NotificationChannel,
  variables: TemplateVariables
): RenderedNotification | null {
  const templateRole: 'customer' | 'provider' = role === 'provider' ? 'provider' : 'customer';

  switch (eventType) {
    case 'booking_confirmed':
      return renderBookingConfirmedTemplate(eventType, templateRole, channel as any, variables);
    case 'booking_reminder':
      return renderBookingReminderTemplate(eventType, templateRole, channel as any, variables);
    case 'booking_cancelled':
      return renderBookingCancelledTemplate(eventType, templateRole, channel as any, variables);
    case 'booking_completed':
      return renderBookingCompletedTemplate(eventType, templateRole, channel as any, variables);
    case 'payment_received':
      return renderPaymentReceivedTemplate(eventType, templateRole, channel as any, variables);
    case 'refund_processed':
      return renderRefundProcessedTemplate(eventType, templateRole, channel as any, variables);
    case 'review_submitted':
      return renderReviewSubmittedTemplate(eventType, templateRole, channel as any, variables);
    case 'dispute_opened':
      return renderDisputeOpenedTemplate(eventType, templateRole, channel as any, variables);
    case 'dispute_resolved':
      return renderDisputeResolvedTemplate(eventType, templateRole, channel as any, variables);
    case 'payout_approved':
      return renderPayoutApprovedTemplate(eventType, templateRole, channel as any, variables);
    case 'provider_approved':
      return renderProviderApprovedTemplate(eventType, templateRole, channel as any, variables);
    case 'provider_rejected':
      return renderProviderRejectedTemplate(eventType, templateRole, channel as any, variables);
    case 'loyalty_tier_upgrade':
      return renderLoyaltyTierUpgradeTemplate(eventType, templateRole, channel as any, variables);
    case 'welcome':
      return renderWelcomeTemplate(eventType, templateRole, channel as any, variables);
    case 'birthday':
      return renderBirthdayTemplate(eventType, templateRole, channel as any, variables);
    default:
      return null;
  }
}

/**
 * Get supported channels for a notification event
 */
export function getSupportedChannels(eventType: NotificationEventType): NotificationChannel[] {
  const template = notificationTemplates[eventType];
  return template?.supportedChannels || [];
}

/**
 * Check if a notification requires user consent
 */
export function requiresUserConsent(eventType: NotificationEventType): boolean {
  const template = notificationTemplates[eventType];
  return template?.requiresUserConsent || false;
}

/**
 * Get notification priority
 */
export function getNotificationPriority(eventType: NotificationEventType): 'low' | 'normal' | 'high' | 'urgent' {
  const template = notificationTemplates[eventType];
  return template?.priority || 'normal';
}

/**
 * Get notification category
 */
export function getNotificationCategory(eventType: NotificationEventType): 'booking' | 'payment' | 'review' | 'account' | 'loyalty' | 'promotional' {
  const template = notificationTemplates[eventType];
  return template?.category || 'account';
}
