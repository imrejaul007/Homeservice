/**
 * Notification Template Types
 * Central type definitions for all notification templates
 */

export type NotificationEventType =
  | 'booking_confirmed'
  | 'booking_reminder'
  | 'booking_cancelled'
  | 'booking_completed'
  | 'payment_received'
  | 'refund_processed'
  | 'review_submitted'
  | 'dispute_opened'
  | 'dispute_resolved'
  | 'payout_approved'
  | 'provider_approved'
  | 'provider_rejected'
  | 'loyalty_tier_upgrade'
  | 'welcome'
  | 'birthday'
  | 'offer_expiry_reminder'
  | 'offer_expired'
  | 'offer_reminder_unused'
  | 'admin_offer_expiry_alert';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app' | 'whatsapp' | 'telegram';

export type UserRole = 'customer' | 'provider' | 'admin';

export interface TemplateVariables {
  [key: string]: string | number | boolean | Date | undefined;
}

export interface NotificationTemplate {
  id: NotificationEventType;
  name: string;
  description: string;
  category: 'booking' | 'payment' | 'review' | 'account' | 'loyalty' | 'promotional';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  supportedChannels: NotificationChannel[];
  requiresUserConsent: boolean;
  templates: {
    [K in UserRole]?: {
      [C in NotificationChannel]?: {
        subject?: string;
        title: string;
        body: string;
        actionText?: string;
        actionUrl?: string;
      };
    };
  };
}

export interface RenderedNotification {
  channel: NotificationChannel;
  subject?: string;
  title: string;
  body: string;
  actionText?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

// Template variable replacer function
export function renderTemplate(
  template: string,
  variables: TemplateVariables
): string {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    let replacement: string;

    if (value instanceof Date) {
      replacement = value.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } else if (typeof value === 'number') {
      replacement = value.toLocaleString();
    } else if (typeof value === 'boolean') {
      replacement = value ? 'Yes' : 'No';
    } else {
      replacement = String(value ?? '');
    }

    rendered = rendered.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), replacement);
  }
  return rendered;
}
