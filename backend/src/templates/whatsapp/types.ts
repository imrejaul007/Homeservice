/**
 * WhatsApp Message Template Types
 * Types for WhatsApp Business API templates
 */

export type WhatsAppTemplateCategory = 'ACCOUNT_UPDATE' | 'APPOINTMENT_UPDATE' | 'ISSUE_RESOLUTION' | 'PAYMENT_UPDATE' | 'SHIPPING_UPDATE' | 'RESERVATION_UPDATE' | 'TICKET_UPDATE' | 'TRANSPORTATION_UPDATE' | 'UTILITY' | 'AUTHENTICATION';

export type WhatsAppLanguage = 'en' | 'ar' | 'fr' | 'es' | 'de' | 'zh' | 'hi' | 'pt';

export interface WhatsAppTemplateVariable {
  name: string;
  example: string;
}

export interface WhatsAppTemplateButton {
  type: 'URL' | 'PHONE_NUMBER' | 'QUICK_REPLY';
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface WhatsAppTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
    footer_text?: string[];
  };
  buttons?: WhatsAppTemplateButton[];
}

export interface WhatsAppTemplateDefinition {
  name: string;
  category: WhatsAppTemplateCategory;
  language: WhatsAppLanguage;
  components: WhatsAppTemplateComponent[];
  variables?: WhatsAppTemplateVariable[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEPRECATED';
}

// Template metadata for the application
export interface WhatsAppTemplateMetadata {
  id: string;
  eventType: string;
  description: string;
  applicableTo: 'customer' | 'provider' | 'both';
  consentRequired: boolean;
}
