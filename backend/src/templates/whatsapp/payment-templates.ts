/**
 * WhatsApp Payment Templates
 * Template definitions for WhatsApp Business API - Payment related
 */

import { WhatsAppTemplateDefinition, WhatsAppTemplateMetadata } from './types';

// Template: Payment Received
export const paymentReceivedTemplate: WhatsAppTemplateDefinition = {
  name: 'payment_received',
  category: 'PAYMENT_UPDATE',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Payment Confirmed',
      example: {
        header_text: ['Payment Confirmed'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nYour payment has been received!\n\nAmount: {{2}} {{3}}\nBooking #: {{4}}\nService: {{5}}\nTransaction ID: {{6}}\n\nThank you for your payment!',
      example: {
        body_text: [
          ['Sarah', '150', 'AED', 'BK123456', 'Hair Styling', 'TX789012'],
        ],
      },
    },
    {
      type: 'FOOTER',
      text: 'NILIN - Beauty & Wellness',
    },
  ],
  variables: [
    { name: '1', example: 'Customer Name' },
    { name: '2', example: 'Amount' },
    { name: '3', example: 'Currency' },
    { name: '4', example: 'Booking Number' },
    { name: '5', example: 'Service Name' },
    { name: '6', example: 'Transaction ID' },
  ],
  status: 'APPROVED',
};

// Template: Refund Processed
export const refundProcessedTemplate: WhatsAppTemplateDefinition = {
  name: 'refund_processed',
  category: 'PAYMENT_UPDATE',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Refund Processed',
      example: {
        header_text: ['Refund Processed'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nYour refund has been processed!\n\nAmount: {{2}} {{3}}\nMethod: {{4}}\nBooking #: {{5}}\n\nFunds will arrive in your account within 5-10 business days.',
      example: {
        body_text: [
          ['Sarah', '150', 'AED', 'Credit Card ****1234', 'BK123456'],
        ],
      },
    },
    {
      type: 'FOOTER',
      text: 'NILIN - Beauty & Wellness',
    },
  ],
  variables: [
    { name: '1', example: 'Customer Name' },
    { name: '2', example: 'Refund Amount' },
    { name: '3', example: 'Currency' },
    { name: '4', example: 'Refund Method' },
    { name: '5', example: 'Booking Number' },
  ],
  status: 'APPROVED',
};

// Template: Dispute Opened (Customer)
export const disputeOpenedCustomerTemplate: WhatsAppTemplateDefinition = {
  name: 'dispute_opened_customer',
  category: 'ISSUE_RESOLUTION',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Dispute Opened',
      example: {
        header_text: ['Dispute Opened'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nYour dispute has been submitted.\n\nDispute #: {{2}}\nBooking #: {{3}}\nReason: {{4}}\nClaimed: {{5}} {{6}}\n\nOur team will review and respond within {{7}} business days.',
      example: {
        body_text: [
          ['Sarah', 'DS001', 'BK123456', 'Service not as described', '150', 'AED', '5'],
        ],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: 'View Dispute', url: 'https://nilin.app/disputes/{{2}}' },
        { type: 'QUICK_REPLY', text: 'Need Urgent Help?' },
      ],
    },
  ],
  variables: [
    { name: '1', example: 'Customer Name' },
    { name: '2', example: 'Dispute ID' },
    { name: '3', example: 'Booking Number' },
    { name: '4', example: 'Dispute Reason' },
    { name: '5', example: 'Claimed Amount' },
    { name: '6', example: 'Currency' },
    { name: '7', example: 'Resolution Days' },
  ],
  status: 'APPROVED',
};

// Template: Dispute Opened (Provider)
export const disputeOpenedProviderTemplate: WhatsAppTemplateDefinition = {
  name: 'dispute_opened_provider',
  category: 'ISSUE_RESOLUTION',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Dispute Filed',
      example: {
        header_text: ['Dispute Filed'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nA dispute has been filed against your booking.\n\nDispute #: {{2}}\nBooking #: {{3}}\nReason: {{4}}\n\nPlease respond within {{5}} days to avoid automatic resolution.',
      example: {
        body_text: [
          ['John', 'DS001', 'BK123456', 'Service not as described', '3'],
        ],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: 'Respond Now', url: 'https://nilin.provider.app/disputes/{{2}}' },
        { type: 'QUICK_REPLY', text: 'Contact Support' },
      ],
    },
  ],
  variables: [
    { name: '1', example: 'Provider Name' },
    { name: '2', example: 'Dispute ID' },
    { name: '3', example: 'Booking Number' },
    { name: '4', example: 'Dispute Reason' },
    { name: '5', example: 'Response Days' },
  ],
  status: 'APPROVED',
};

// Template: Dispute Resolved
export const disputeResolvedTemplate: WhatsAppTemplateDefinition = {
  name: 'dispute_resolved',
  category: 'ISSUE_RESOLUTION',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Dispute Resolved',
      example: {
        header_text: ['Dispute Resolved'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nYour dispute has been resolved.\n\nDispute #: {{2}}\nDecision: {{3}}\n{{4}}\n\nIf you have questions, contact us within 7 days.',
      example: {
        body_text: [
          ['Sarah', 'DS001', 'Favourable to Customer', 'Awarded: 150 AED. Refund will be processed within 5-7 business days.'],
        ],
      },
    },
    {
      type: 'FOOTER',
      text: 'NILIN Support Team',
    },
  ],
  variables: [
    { name: '1', example: 'Name' },
    { name: '2', example: 'Dispute ID' },
    { name: '3', example: 'Decision Summary' },
    { name: '4', example: 'Additional Details' },
  ],
  status: 'APPROVED',
};

// Template: Review Received (Provider)
export const reviewReceivedTemplate: WhatsAppTemplateDefinition = {
  name: 'review_received',
  category: 'ACCOUNT_UPDATE',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'New Review! ⭐',
      example: {
        header_text: ['New Review! ⭐'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nYou received a new {{2}}-star review!\n\nCustomer: {{3}}\nService: {{4}}\n\n"{{5}}"\n\nYour average rating: {{6}} stars ({{7}} reviews)',
      example: {
        body_text: [
          ['John', '5', 'Sarah', 'Hair Styling', 'Amazing service! Very professional and friendly.', '4.8', '45'],
        ],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: 'Reply to Review', url: 'https://nilin.provider.app/reviews' },
        { type: 'QUICK_REPLY', text: 'View All Reviews' },
      ],
    },
  ],
  variables: [
    { name: '1', example: 'Provider Name' },
    { name: '2', example: 'Rating' },
    { name: '3', example: 'Customer Name' },
    { name: '4', example: 'Service Name' },
    { name: '5', example: 'Review Text' },
    { name: '6', example: 'Average Rating' },
    { name: '7', example: 'Total Reviews' },
  ],
  status: 'APPROVED',
};

// Metadata
export const paymentTemplateMetadata: WhatsAppTemplateMetadata[] = [
  {
    id: 'payment_received',
    eventType: 'payment_received',
    description: 'Confirmation when payment is received',
    applicableTo: 'customer',
    consentRequired: false,
  },
  {
    id: 'refund_processed',
    eventType: 'refund_processed',
    description: 'Notification when refund is processed',
    applicableTo: 'customer',
    consentRequired: false,
  },
  {
    id: 'dispute_opened_customer',
    eventType: 'dispute_opened',
    description: 'Confirmation when customer opens dispute',
    applicableTo: 'customer',
    consentRequired: false,
  },
  {
    id: 'dispute_opened_provider',
    eventType: 'dispute_opened',
    description: 'Notification when provider receives dispute',
    applicableTo: 'provider',
    consentRequired: false,
  },
  {
    id: 'dispute_resolved',
    eventType: 'dispute_resolved',
    description: 'Notification when dispute is resolved',
    applicableTo: 'both',
    consentRequired: false,
  },
  {
    id: 'review_received',
    eventType: 'review_submitted',
    description: 'Notification when provider receives review',
    applicableTo: 'provider',
    consentRequired: false,
  },
];
