/**
 * WhatsApp Templates Index
 * Central export for all WhatsApp templates
 */

export * from './types';
export * from './booking-templates';
export * from './account-templates';
export * from './payment-templates';

import { WhatsAppTemplateDefinition, WhatsAppTemplateMetadata } from './types';
import {
  bookingConfirmedTemplate,
  bookingReminderTemplate,
  bookingCancelledTemplate,
  bookingCompletedTemplate,
  providerBookingRequestTemplate,
  payoutApprovedTemplate,
  bookingTemplateMetadata,
} from './booking-templates';
import {
  welcomeTemplate,
  providerApprovedTemplate,
  providerRejectedTemplate,
  birthdayTemplate,
  loyaltyUpgradeTemplate,
  accountTemplateMetadata,
} from './account-templates';
import {
  paymentReceivedTemplate,
  refundProcessedTemplate,
  disputeOpenedCustomerTemplate,
  disputeOpenedProviderTemplate,
  disputeResolvedTemplate,
  reviewReceivedTemplate,
  paymentTemplateMetadata,
} from './payment-templates';

/**
 * Registry of all WhatsApp templates
 */
export const whatsappTemplates: Record<string, WhatsAppTemplateDefinition> = {
  // Booking templates
  'booking_confirmed': bookingConfirmedTemplate,
  'booking_reminder': bookingReminderTemplate,
  'booking_cancelled': bookingCancelledTemplate,
  'booking_completed': bookingCompletedTemplate,
  'provider_booking_request': providerBookingRequestTemplate,
  'payout_approved': payoutApprovedTemplate,

  // Account templates
  'welcome': welcomeTemplate,
  'provider_approved': providerApprovedTemplate,
  'provider_rejected': providerRejectedTemplate,
  'birthday': birthdayTemplate,
  'loyalty_upgrade': loyaltyUpgradeTemplate,

  // Payment templates
  'payment_received': paymentReceivedTemplate,
  'refund_processed': refundProcessedTemplate,
  'dispute_opened_customer': disputeOpenedCustomerTemplate,
  'dispute_opened_provider': disputeOpenedProviderTemplate,
  'dispute_resolved': disputeResolvedTemplate,
  'review_received': reviewReceivedTemplate,
};

/**
 * All WhatsApp template metadata
 */
export const allWhatsAppTemplateMetadata: WhatsAppTemplateMetadata[] = [
  ...bookingTemplateMetadata,
  ...accountTemplateMetadata,
  ...paymentTemplateMetadata,
];

/**
 * Get WhatsApp template by name
 */
export function getWhatsAppTemplate(name: string): WhatsAppTemplateDefinition | undefined {
  return whatsappTemplates[name];
}

/**
 * Get template metadata by event type
 */
export function getTemplateMetadataByEvent(eventType: string, applicableTo: 'customer' | 'provider' | 'both'): WhatsAppTemplateMetadata | undefined {
  return allWhatsAppTemplateMetadata.find(
    (m) => m.eventType === eventType && (m.applicableTo === 'both' || m.applicableTo === applicableTo)
  );
}

/**
 * Get all templates that require user consent
 */
export function getConsentRequiredTemplates(): WhatsAppTemplateMetadata[] {
  return allWhatsAppTemplateMetadata.filter((m) => m.consentRequired);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): WhatsAppTemplateMetadata[] {
  const templates: WhatsAppTemplateMetadata[] = [];
  for (const [name, template] of Object.entries(whatsappTemplates)) {
    if (template.category === category) {
      const metadata = allWhatsAppTemplateMetadata.find((m) => m.id === name);
      if (metadata) {
        templates.push(metadata);
      }
    }
  }
  return templates;
}
