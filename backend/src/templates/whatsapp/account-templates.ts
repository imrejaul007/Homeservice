/**
 * WhatsApp Account Templates
 * Template definitions for WhatsApp Business API - Account related
 */

import { WhatsAppTemplateDefinition, WhatsAppTemplateMetadata } from './types';

// Template: Welcome Message
export const welcomeTemplate: WhatsAppTemplateDefinition = {
  name: 'welcome',
  category: 'UTILITY',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Welcome to NILIN!',
      example: {
        header_text: ['Welcome to NILIN!'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nWelcome to NILIN - your gateway to beauty & wellness!\n\nGet {{2}} bonus points on your first booking!\n\nExplore services and book your first appointment today.',
      example: {
        body_text: [
          ['Sarah', '100'],
        ],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: 'Explore Services', url: 'https://nilin.app/services' },
        { type: 'QUICK_REPLY', text: 'Need Help?' },
      ],
    },
  ],
  variables: [
    { name: '1', example: 'Customer Name' },
    { name: '2', example: 'Bonus Points' },
  ],
  status: 'APPROVED',
};

// Template: Provider Approved
export const providerApprovedTemplate: WhatsAppTemplateDefinition = {
  name: 'provider_approved',
  category: 'ACCOUNT_UPDATE',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Account Approved!',
      example: {
        header_text: ['Account Approved!'],
      },
    },
    {
      type: 'BODY',
      text: 'Congratulations {{1}}!\n\nYour NILIN provider account is now approved!\n\nStart adding your services and accept bookings from customers.\n\nWelcome to the NILIN provider community!',
      example: {
        body_text: [
          ['John'],
        ],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: 'Set Up Profile', url: 'https://nilin.provider.app/profile' },
        { type: 'QUICK_REPLY', text: 'Get Help' },
      ],
    },
  ],
  variables: [
    { name: '1', example: 'Provider Name' },
  ],
  status: 'APPROVED',
};

// Template: Provider Rejected
export const providerRejectedTemplate: WhatsAppTemplateDefinition = {
  name: 'provider_rejected',
  category: 'ACCOUNT_UPDATE',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Application Update',
      example: {
        header_text: ['Application Update'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}},\n\nThank you for applying to be a NILIN provider.\n\nUnfortunately, we\'re unable to approve your application at this time.\n\n{{2}}\n\nPlease review the feedback and consider resubmitting with updates.',
      example: {
        body_text: [
          ['John', 'Your profile information was incomplete.'],
        ],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: 'Update Application', url: 'https://nilin.provider.app/apply' },
        { type: 'QUICK_REPLY', text: 'Contact Support' },
      ],
    },
  ],
  variables: [
    { name: '1', example: 'Applicant Name' },
    { name: '2', example: 'Rejection Reason' },
  ],
  status: 'APPROVED',
};

// Template: Birthday Greeting
export const birthdayTemplate: WhatsAppTemplateDefinition = {
  name: 'birthday',
  category: 'UTILITY',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Happy Birthday! 🎂',
      example: {
        header_text: ['Happy Birthday! 🎂'],
      },
    },
    {
      type: 'BODY',
      text: 'Hi {{1}}!\n\nHappy Birthday from all of us at NILIN!\n\nAs our gift, enjoy {{2}} bonus points and {{3}}% off your next booking!\n\nUse code: {{4}}\n\nValid for {{5}} days.\n\nCheers to another amazing year!',
      example: {
        body_text: [
          ['Sarah', '100', '20', 'BDAY2024', '7'],
        ],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: 'Book Now', url: 'https://nilin.app/services?birthday=true' },
        { type: 'QUICK_REPLY', text: 'View Rewards' },
      ],
    },
  ],
  variables: [
    { name: '1', example: 'Name' },
    { name: '2', example: 'Points Amount' },
    { name: '3', example: 'Discount Percentage' },
    { name: '4', example: 'Discount Code' },
    { name: '5', example: 'Validity Days' },
  ],
  status: 'APPROVED',
};

// Template: Loyalty Tier Upgrade
export const loyaltyUpgradeTemplate: WhatsAppTemplateDefinition = {
  name: 'loyalty_upgrade',
  category: 'ACCOUNT_UPDATE',
  language: 'en',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Tier Upgraded! ⭐',
      example: {
        header_text: ['Tier Upgraded! ⭐'],
      },
    },
    {
      type: 'BODY',
      text: 'Congratulations {{1}}!\n\nYou\'ve unlocked {{2}} status!\n\nYour new benefits:\n{{3}}\n\nKeep earning points to reach the next tier!',
      example: {
        body_text: [
          ['Sarah', 'Gold', '10% off all bookings\nPriority customer support\nEarly access to new services'],
        ],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: 'View Benefits', url: 'https://nilin.app/rewards' },
        { type: 'QUICK_REPLY', text: 'Book Service' },
      ],
    },
  ],
  variables: [
    { name: '1', example: 'Customer Name' },
    { name: '2', example: 'New Tier Name' },
    { name: '3', example: 'Benefits List' },
  ],
  status: 'APPROVED',
};

// Metadata
export const accountTemplateMetadata: WhatsAppTemplateMetadata[] = [
  {
    id: 'welcome',
    eventType: 'welcome',
    description: 'Welcome message for new users',
    applicableTo: 'customer',
    consentRequired: false,
  },
  {
    id: 'provider_approved',
    eventType: 'provider_approved',
    description: 'Sent when provider account is approved',
    applicableTo: 'provider',
    consentRequired: false,
  },
  {
    id: 'provider_rejected',
    eventType: 'provider_rejected',
    description: 'Sent when provider application is rejected',
    applicableTo: 'provider',
    consentRequired: false,
  },
  {
    id: 'birthday',
    eventType: 'birthday',
    description: 'Birthday greeting with special offers',
    applicableTo: 'customer',
    consentRequired: true,
  },
  {
    id: 'loyalty_upgrade',
    eventType: 'loyalty_tier_upgrade',
    description: 'Notification when customer tier is upgraded',
    applicableTo: 'customer',
    consentRequired: false,
  },
];
