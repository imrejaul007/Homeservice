/**
 * WhatsApp Booking Templates
 * Template definitions for WhatsApp Business API - Booking related
 */

import { WhatsAppTemplateDefinition, WhatsAppTemplateMetadata } from './types';

// Template: Booking Confirmation
export const bookingConfirmedTemplate: WhatsAppTemplateDefinition = {
  name: 'booking_confirmed',
  category: 'APPOINTMENT_UPDATE',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Booking Confirmed!',
      example: {
        header_text: ['Booking Confirmed!'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}}, your booking is confirmed!\n\nService: {{2}}\nDate: {{3}}\nTime: {{4}}\nProvider: {{5}}\n\nTotal: {{6}} {{7}}\n\nWe\'ll send you a reminder before your appointment.',
      example: {
        body_text: [
          ['Sarah', 'Hair Styling', 'Dec 15, 2024', '2:00 PM', 'John Smith', '150', 'AED'],
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
    { name: '2', example: 'Service Name' },
    { name: '3', example: 'Booking Date' },
    { name: '4', example: 'Booking Time' },
    { name: '5', example: 'Provider Name' },
    { name: '6', example: 'Amount' },
    { name: '7', example: 'Currency' },
  ],
  status: 'APPROVED',
};

// Template: Booking Reminder
export const bookingReminderTemplate: WhatsAppTemplateDefinition = {
  name: 'booking_reminder',
  category: 'APPOINTMENT_UPDATE',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Booking Reminder',
      example: {
        header_text: ['Booking Reminder'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nJust a reminder about your upcoming booking!\n\nService: {{2}}\nTomorrow at {{3}}\nProvider: {{4}}\n\nAddress: {{5}}\n\nSee you then!',
      example: {
        body_text: [
          ['Sarah', 'Hair Styling', '2:00 PM', 'John Smith', '123 Main St, Dubai'],
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
    { name: '2', example: 'Service Name' },
    { name: '3', example: 'Booking Time' },
    { name: '4', example: 'Provider Name' },
    { name: '5', example: 'Address' },
  ],
  status: 'APPROVED',
};

// Template: Booking Cancelled
export const bookingCancelledTemplate: WhatsAppTemplateDefinition = {
  name: 'booking_cancelled',
  category: 'APPOINTMENT_UPDATE',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Booking Cancelled',
      example: {
        header_text: ['Booking Cancelled'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nYour booking has been cancelled.\n\nBooking #: {{2}}\nService: {{3}}\n\n{{4}}\n\nIf you have any questions, please contact our support team.',
      example: {
        body_text: [
          ['Sarah', 'BK123456', 'Hair Styling', 'Your refund will be processed within 5-7 business days.'],
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
    { name: '2', example: 'Booking Number' },
    { name: '3', example: 'Service Name' },
    { name: '4', example: 'Additional Info (Refund)' },
  ],
  status: 'APPROVED',
};

// Template: Booking Completed
export const bookingCompletedTemplate: WhatsAppTemplateDefinition = {
  name: 'booking_completed',
  category: 'APPOINTMENT_UPDATE',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Service Completed!',
      example: {
        header_text: ['Service Completed!'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nYour {{2}} session with {{3}} is complete!\n\nThank you for choosing NILIN.\n\nLeave a review and earn {{4}} loyalty points!',
      example: {
        body_text: [
          ['Sarah', 'Hair Styling', 'John Smith', '50'],
        ],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: 'Leave Review', url: 'https://nilin.app/review/{{5}}' },
        { type: 'QUICK_REPLY', text: 'Book Again' },
      ],
    },
  ],
  variables: [
    { name: '1', example: 'Customer Name' },
    { name: '2', example: 'Service Name' },
    { name: '3', example: 'Provider Name' },
    { name: '4', example: 'Points Amount' },
    { name: '5', example: 'Booking ID' },
  ],
  status: 'APPROVED',
};

// Template: Provider Booking Request
export const providerBookingRequestTemplate: WhatsAppTemplateDefinition = {
  name: 'provider_booking_request',
  category: 'APPOINTMENT_UPDATE',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'New Booking Request',
      example: {
        header_text: ['New Booking Request'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nYou have a new booking request!\n\nCustomer: {{2}}\nService: {{3}}\nDate: {{4}}\nTime: {{5}}\nEarnings: {{6}} {{7}}\n\nPlease respond within 24 hours.',
      example: {
        body_text: [
          ['John', 'Sarah', 'Hair Styling', 'Dec 15, 2024', '2:00 PM', '120', 'AED'],
        ],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: 'View & Accept', url: 'https://nilin.provider.app/bookings/{{8}}' },
        { type: 'QUICK_REPLY', text: 'Decline' },
      ],
    },
  ],
  variables: [
    { name: '1', example: 'Provider Name' },
    { name: '2', example: 'Customer Name' },
    { name: '3', example: 'Service Name' },
    { name: '4', example: 'Date' },
    { name: '5', example: 'Time' },
    { name: '6', example: 'Earnings Amount' },
    { name: '7', example: 'Currency' },
    { name: '8', example: 'Booking ID' },
  ],
  status: 'APPROVED',
};

// Template: Provider Payout Approved
export const payoutApprovedTemplate: WhatsAppTemplateDefinition = {
  name: 'payout_approved',
  category: 'PAYMENT_UPDATE',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Payout Approved!',
      example: {
        header_text: ['Payout Approved!'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nGreat news! Your payout is on its way.\n\nAmount: {{2}} {{3}}\nMethod: {{4}}\n\nExpected arrival: 1-3 business days',
      example: {
        body_text: [
          ['John', '500', 'AED', 'Bank Transfer'],
        ],
      },
    },
    {
      type: 'FOOTER',
      text: 'NILIN Provider Portal',
    },
  ],
  variables: [
    { name: '1', example: 'Provider Name' },
    { name: '2', example: 'Amount' },
    { name: '3', example: 'Currency' },
    { name: '4', example: 'Payout Method' },
  ],
  status: 'APPROVED',
};

// Metadata for mapping to events
export const bookingTemplateMetadata: WhatsAppTemplateMetadata[] = [
  {
    id: 'booking_confirmed',
    eventType: 'booking_confirmed',
    description: 'Sent when a booking is confirmed by the provider',
    applicableTo: 'customer',
    consentRequired: false,
  },
  {
    id: 'booking_reminder',
    eventType: 'booking_reminder',
    description: 'Reminder sent before a scheduled booking',
    applicableTo: 'customer',
    consentRequired: false,
  },
  {
    id: 'booking_cancelled',
    eventType: 'booking_cancelled',
    description: 'Sent when a booking is cancelled',
    applicableTo: 'customer',
    consentRequired: false,
  },
  {
    id: 'booking_completed',
    eventType: 'booking_completed',
    description: 'Sent when a booking service is completed',
    applicableTo: 'customer',
    consentRequired: false,
  },
  {
    id: 'provider_booking_request',
    eventType: 'booking_request',
    description: 'Notification for provider about new booking requests',
    applicableTo: 'provider',
    consentRequired: false,
  },
  {
    id: 'payout_approved',
    eventType: 'payout_approved',
    description: 'Sent when a provider payout is approved',
    applicableTo: 'provider',
    consentRequired: false,
  },
];
