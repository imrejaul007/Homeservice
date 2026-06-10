/**
 * Offer Expiry Email Templates
 * Email templates for offer expiry notifications
 */

import { NotificationTemplate, TemplateVariables, renderTemplate, NotificationEventType } from './types';

/**
 * Template data interface for offer expiry emails
 */
export interface OfferExpiryTemplateData {
  firstName?: string;
  offerCode?: string;
  offerTitle?: string;
  discountText?: string;
  expiresAt?: Date;
  daysRemaining?: number;
  daysUntilExpiry?: number;
  ctaUrl?: string;
  offers?: Array<{
    code: string;
    title?: string;
    displayTitle?: string;
    type?: 'percentage' | 'fixed';
    value?: number;
    remainingUses?: number;
    daysUntilExpiry?: number;
  }>;
  summary?: {
    totalOffers?: number;
    totalRemainingUses?: number;
  };
}

/**
 * Email template for offer expiry reminder (1-3 days before expiry)
 */
export const offerExpiryReminderTemplate: NotificationTemplate = {
  id: 'offer_expiry_reminder',
  name: 'Offer Expiry Reminder',
  description: 'Notification sent when a claimed offer is about to expire (1-3 days)',
  category: 'promotional',
  priority: 'high',
  supportedChannels: ['email'],
  requiresUserConsent: true,
  templates: {
    customer: {
      email: {
        subject: (() => {
          // This will be replaced with actual rendering
          return 'Your offer expires soon!';
        })() as unknown as string,
        title: 'Offer Expiring Soon',
        body: '',
        actionText: 'Book Now & Save',
        actionUrl: '/book',
      },
    },
  },
};

/**
 * Render the offer expiry reminder email with HTML
 */
export function renderOfferExpiryReminderEmail(variables: OfferExpiryTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const daysRemaining = variables.daysRemaining || variables.daysUntilExpiry || 1;
  const offerTitle = variables.offerTitle || 'promo';
  const offerCode = variables.offerCode || 'CODE';
  const discountText = variables.discountText || 'Special Offer';
  const ctaUrl = variables.ctaUrl || 'https://nilin.app/book';
  const firstName = variables.firstName || 'there';

  const subject = `Your ${offerTitle} offer expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}!`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offer Expiring Soon</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #ff6b6b 0%, #ffa06b 100%); color: white; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .content { padding: 32px; }
    .offer-card { background: linear-gradient(135deg, #fff5f5 0%, #fff0eb 100%); border: 2px solid #ff6b6b; border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center; }
    .offer-code { font-size: 28px; font-weight: bold; color: #ff6b6b; letter-spacing: 2px; margin: 12px 0; }
    .discount { font-size: 36px; font-weight: bold; color: #ff6b6b; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #ff6b6b 0%, #ffa06b 100%); color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .expiry-badge { background: #ff6b6b; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-size: 14px; font-weight: 600; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Don't miss out!</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      <p>Your claimed offer is about to expire. Don't let these savings go to waste!</p>

      <div class="offer-card">
        <p style="color: #666; margin: 0;">Use this code at checkout</p>
        <div class="offer-code">${offerCode}</div>
        <div class="discount">${discountText}</div>
        <p style="margin: 12px 0 0 0; color: #888;">${offerTitle}</p>
      </div>

      <p style="text-align: center;">
        <span class="expiry-badge">Expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</span>
      </p>

      <p style="text-align: center;">
        <a href="${ctaUrl}" class="cta-button">Book Now & Save</a>
      </p>

      <p style="color: #888; font-size: 14px; text-align: center;">
        Valid on any service. Minimum order may apply.
      </p>
    </div>
    <div class="footer">
      <p>NILIN Home Services | Questions? Contact us at support@nilin.app</p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Hi ${firstName},

Your ${offerTitle} offer (${offerCode}) expires in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}!

Use code: ${offerCode}
Discount: ${discountText}

Don't miss out on ${discountText}!

Book now: ${ctaUrl}

- NILIN Home Services
`;

  return { subject, html, text };
}

/**
 * Email template for expired offers
 */
export const offerExpiredTemplate: NotificationTemplate = {
  id: 'offer_expired',
  name: 'Offer Expired',
  description: 'Notification sent when a claimed offer has expired',
  category: 'promotional',
  priority: 'normal',
  supportedChannels: ['email'],
  requiresUserConsent: true,
  templates: {
    customer: {
      email: {
        subject: 'Your offer has expired',
        title: 'Offer Expired',
        body: '',
        actionText: 'Browse New Offers',
        actionUrl: '/offers',
      },
    },
  },
};

/**
 * Render the expired offer email with HTML
 */
export function renderOfferExpiredEmail(variables: OfferExpiryTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const offerCode = variables.offerCode || 'CODE';
  const ctaUrl = variables.ctaUrl || 'https://nilin.app/offers';
  const firstName = variables.firstName || 'there';

  const subject = 'Your offer has expired';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Offer Expired</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: #6b7280; color: white; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 32px; text-align: center; }
    .expired-badge { background: #fee2e2; color: #dc2626; padding: 12px 24px; border-radius: 8px; display: inline-block; font-size: 16px; font-weight: 600; }
    .cta-button { display: inline-block; background: #6366f1; color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Offer Expired</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      <p>Your offer (${offerCode}) has expired. Better luck next time!</p>

      <div style="margin: 30px 0;">
        <span class="expired-badge">EXPIRED</span>
      </div>

      <p>Don't worry - new offers are coming soon!</p>

      <p style="text-align: center;">
        <a href="${ctaUrl}" class="cta-button">Browse New Offers</a>
      </p>
    </div>
    <div class="footer">
      <p>NILIN Home Services | Questions? Contact us at support@nilin.app</p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Hi ${firstName},

Unfortunately, your offer (${offerCode}) has expired.

Don't worry - new offers are coming soon!

Browse new offers: ${ctaUrl}

- NILIN Home Services
`;

  return { subject, html, text };
}

/**
 * Email template for unused claim reminder (after 7 days)
 */
export const offerReminderUnusedTemplate: NotificationTemplate = {
  id: 'offer_reminder_unused',
  name: 'Unused Offer Reminder',
  description: 'Notification sent when user has an unused claim after 7 days',
  category: 'promotional',
  priority: 'normal',
  supportedChannels: ['email'],
  requiresUserConsent: true,
  templates: {
    customer: {
      email: {
        subject: (() => {
          return 'You haven\'t used your offer yet!';
        })() as unknown as string,
        title: 'Unused Offer Reminder',
        body: '',
        actionText: 'Use Your Offer Now',
        actionUrl: '/book',
      },
    },
  },
};

/**
 * Render the unused offer reminder email with HTML
 */
export function renderOfferReminderUnusedEmail(variables: OfferExpiryTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const daysUntilExpiry = variables.daysUntilExpiry || 30;
  const offerTitle = variables.offerTitle || 'offer';
  const offerCode = variables.offerCode || 'CODE';
  const ctaUrl = variables.ctaUrl || 'https://nilin.app/book';
  const firstName = variables.firstName || 'there';

  const subject = `You haven't used your ${offerTitle} yet!`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unused Offer Reminder</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); color: white; padding: 32px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 32px; }
    .offer-card { background: linear-gradient(135deg, #f3e8ff 0%, #ede9fe 100%); border: 2px solid #8b5cf6; border-radius: 12px; padding: 24px; margin: 20px 0; text-align: center; }
    .offer-code { font-size: 28px; font-weight: bold; color: #8b5cf6; letter-spacing: 2px; margin: 12px 0; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%); color: white; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .days-badge { background: #8b5cf6; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-size: 14px; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Don't forget this offer!</h1>
    </div>
    <div class="content">
      <p>Hi ${firstName},</p>
      <p>You claimed an offer a while ago but haven't used it yet. It's still valid - don't let it go to waste!</p>

      <div class="offer-card">
        <p style="color: #666; margin: 0;">Your claimed code</p>
        <div class="offer-code">${offerCode}</div>
        <p style="margin: 12px 0 0 0; color: #8b5cf6; font-weight: 600;">${offerTitle}</p>
      </div>

      <p style="text-align: center;">
        <span class="days-badge">Expires in ${daysUntilExpiry} days</span>
      </p>

      <p style="text-align: center;">
        <a href="${ctaUrl}" class="cta-button">Use Your Offer Now</a>
      </p>
    </div>
    <div class="footer">
      <p>NILIN Home Services | Questions? Contact us at support@nilin.app</p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
Hi ${firstName},

Don't forget about your claimed offer (${offerCode})!

You still have ${daysUntilExpiry} days to use it before it expires.

Use your code: ${offerCode}

Book now: ${ctaUrl}

- NILIN Home Services
`;

  return { subject, html, text };
}

/**
 * Admin email template for high-value expiring offers
 */
export const adminOfferExpiryAlertTemplate: NotificationTemplate = {
  id: 'admin_offer_expiry_alert',
  name: 'Admin Offer Expiry Alert',
  description: 'Admin notification for high-value expiring offers',
  category: 'promotional',
  priority: 'high',
  supportedChannels: ['email'],
  requiresUserConsent: false,
  templates: {
    customer: {
      // Using customer as placeholder - admin templates use different structure
      email: {
        subject: 'High-Value Offers Expiring Soon',
        title: 'Admin Alert',
        body: '',
        actionText: 'View All Offers',
        actionUrl: '/admin/offers',
      },
    },
  },
};

/**
 * Render the admin offer expiry alert email with HTML
 */
export function renderAdminOfferExpiryAlertEmail(variables: OfferExpiryTemplateData): {
  subject: string;
  html: string;
  text: string;
} {
  const offers = variables.offers || [];
  const summary = variables.summary || {};
  const ctaUrl = variables.ctaUrl || 'https://nilin.app/admin/offers';

  const totalOffers = summary.totalOffers || offers.length;
  const totalRemainingUses = summary.totalRemainingUses || offers.reduce((s, o) => s + (o.remainingUses || 0), 0);

  const subject = `High-Value Offers Expiring Soon - ${totalOffers} offers need attention`;

  const offersList = offers.map(offer => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${offer.code}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${offer.displayTitle || offer.title || 'N/A'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${offer.type === 'percentage' ? offer.value + '%' : 'AED ' + offer.value}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${offer.remainingUses || 0}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${offer.daysUntilExpiry || 0} days</td>
      </tr>
    `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin: Offer Expiry Alert</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { background: #1f2937; color: white; padding: 24px 32px; }
    .header h1 { margin: 0; font-size: 20px; }
    .content { padding: 32px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0; }
    .stat-card { background: #f3f4f6; padding: 16px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 24px; font-weight: bold; color: #1f2937; }
    .stat-label { font-size: 12px; color: #6b7280; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .cta-button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Offer Expiry Alert - ${totalOffers} offers expiring in 3 days</h1>
    </div>
    <div class="content">
      <p>Hello Admin,</p>
      <p>The following high-value offers are expiring soon and have low usage:</p>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalOffers}</div>
          <div class="stat-label">Offers Expiring</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalRemainingUses}</div>
          <div class="stat-label">Remaining Uses</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">3</div>
          <div class="stat-label">Days Until Expiry</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Code</th>
            <th>Title</th>
            <th>Value</th>
            <th>Remaining</th>
            <th>Days Left</th>
          </tr>
        </thead>
        <tbody>
          ${offersList}
        </tbody>
      </table>

      <p style="text-align: center;">
        <a href="${ctaUrl}" class="cta-button">View All Offers</a>
      </p>

      <p style="color: #888; font-size: 14px;">
        Consider extending these offers or creating new ones to maintain customer engagement.
      </p>
    </div>
    <div class="footer">
      <p>NILIN Admin Dashboard | This is an automated alert</p>
    </div>
  </div>
</body>
</html>
`;

  const text = `
ADMIN ALERT: ${totalOffers} high-value offers expiring in 3 days!

SUMMARY:
- Total Offers: ${totalOffers}
- Remaining Uses: ${totalRemainingUses}

OFFERS:
${offers.map(o => `- ${o.code}: ${o.displayTitle || o.title} (${o.type === 'percentage' ? o.value + '%' : 'AED ' + o.value}) - ${o.remainingUses || 0} uses remaining, ${o.daysUntilExpiry || 0} days left`).join('\n')}

View all offers: ${ctaUrl}
`;

  return { subject, html, text };
}
