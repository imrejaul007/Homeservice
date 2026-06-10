/**
 * Offer Expiry Notification Script
 *
 * FIX: Automated alerts when offers are about to expire or nearly exhausted
 *
 * Run this script daily via cron job:
 * 0 9 * * * node dist/scripts/offerExpiryNotifications.js
 *
 * This script:
 * 1. Finds offers expiring within 7 days
 * 2. Finds nearly exhausted offers (less than 10% remaining)
 * 3. Sends notifications to admin via email/Slack
 * 4. Optionally auto-expires or pauses offers
 */

import mongoose from 'mongoose';
import Coupon from '../models/coupon.model';
import OfferClaim from '../models/offerClaim.model';
import AuditLog from '../models/auditLog.model';
import logger from '../utils/logger';
import { sendEmail } from '../services/email.service';

// Configuration
const CONFIG = {
  // Days before expiry to send warning
  EXPIRY_WARNING_DAYS: [7, 3, 1],
  // Percentage of remaining uses to trigger warning
  LOW_USAGE_THRESHOLD_PERCENT: 10,
  // Whether to auto-pause offers with low usage
  AUTO_PAUSE_LOW_USAGE: false,
  // Whether to auto-expire offers past their date
  AUTO_EXPIRE: true,
  // Admin email for notifications
  ADMIN_EMAIL: process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@example.com',
  // Notification types
  NOTIFY_VIA_EMAIL: process.env.NOTIFY_OFFER_EXPIRY_EMAIL === 'true',
  NOTIFY_VIA_AUDIT_LOG: true,
};

interface OfferAlert {
  offerId: string;
  code: string;
  title: string;
  daysRemaining?: number;
  remainingUses: number;
  maxUses: number;
  remainingPercent: number;
  alertType: 'expiring_soon' | 'nearly_exhausted' | 'expired';
}

interface NotificationReport {
  timestamp: Date;
  expiringOffers: OfferAlert[];
  nearlyExhaustedOffers: OfferAlert[];
  expiredOffers: OfferAlert[];
  actionsTaken: string[];
}

/**
 * Check offers and generate alert report
 */
async function checkOffers(): Promise<NotificationReport> {
  const now = new Date();
  const report: NotificationReport = {
    timestamp: now,
    expiringOffers: [],
    nearlyExhaustedOffers: [],
    expiredOffers: [],
    actionsTaken: [],
  };

  // Get all active offers
  const activeOffers = await Coupon.find({
    isActive: true,
    isDeleted: { $ne: true },
  }).lean();

  for (const offer of activeOffers) {
    const remainingUses = offer.maxUses - offer.currentUses;
    const remainingPercent = offer.maxUses > 0
      ? (remainingUses / offer.maxUses) * 100
      : 100;

    // Check if offer is expired (past validUntil)
    if (offer.validUntil && new Date(offer.validUntil) < now) {
      report.expiredOffers.push({
        offerId: offer._id.toString(),
        code: offer.code,
        title: offer.displayTitle || offer.title,
        remainingUses,
        maxUses: offer.maxUses,
        remainingPercent,
        alertType: 'expired',
      });

      // Auto-expire if configured
      if (CONFIG.AUTO_EXPIRE) {
        await Coupon.findByIdAndUpdate(offer._id, {
          isActive: false,
        });
        report.actionsTaken.push(`Auto-expired: ${offer.code}`);
      }
      continue;
    }

    // Calculate days remaining
    const daysRemaining = offer.validUntil
      ? Math.ceil((new Date(offer.validUntil).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 999;

    // Check for expiry warnings
    if (CONFIG.EXPIRY_WARNING_DAYS.includes(daysRemaining)) {
      report.expiringOffers.push({
        offerId: offer._id.toString(),
        code: offer.code,
        title: offer.displayTitle || offer.title,
        daysRemaining,
        remainingUses,
        maxUses: offer.maxUses,
        remainingPercent,
        alertType: 'expiring_soon',
      });
    }

    // Check for nearly exhausted
    if (remainingPercent <= CONFIG.LOW_USAGE_THRESHOLD_PERCENT && remainingUses > 0) {
      report.nearlyExhaustedOffers.push({
        offerId: offer._id.toString(),
        code: offer.code,
        title: offer.displayTitle || offer.title,
        remainingUses,
        maxUses: offer.maxUses,
        remainingPercent,
        alertType: 'nearly_exhausted',
      });

      // Auto-pause if configured
      if (CONFIG.AUTO_PAUSE_LOW_USAGE && remainingPercent <= 5) {
        await Coupon.findByIdAndUpdate(offer._id, {
          isActive: false,
        });
        report.actionsTaken.push(`Auto-paused (low usage): ${offer.code}`);
      }
    }
  }

  return report;
}

/**
 * Send email notification to admin
 */
async function sendEmailNotification(report: NotificationReport): Promise<void> {
  if (!CONFIG.NOTIFY_VIA_EMAIL) {
    logger.info('Email notifications disabled, skipping');
    return;
  }

  const totalAlerts = report.expiringOffers.length +
                      report.nearlyExhaustedOffers.length +
                      report.expiredOffers.length;

  if (totalAlerts === 0) {
    logger.info('No offer alerts to report');
    return;
  }

  const emailContent = `
    <h1>Offer System Alert Report</h1>
    <p>Generated: ${report.timestamp.toISOString()}</p>

    ${report.expiringOffers.length > 0 ? `
      <h2 style="color: orange;">⚠️ Expiring Soon</h2>
      <ul>
        ${report.expiringOffers.map(o => `
          <li>
            <strong>${o.code}</strong> - ${o.title}
            <br>Days remaining: ${o.daysRemaining}
            <br>Uses: ${o.remainingUses}/${o.maxUses}
            <br><a href="${process.env.ADMIN_BASE_URL || ''}/admin/offers/${o.offerId}/edit">Edit Offer</a>
          </li>
        `).join('')}
      </ul>
    ` : ''}

    ${report.nearlyExhaustedOffers.length > 0 ? `
      <h2 style="color: red;">🚨 Nearly Exhausted</h2>
      <ul>
        ${report.nearlyExhaustedOffers.map(o => `
          <li>
            <strong>${o.code}</strong> - ${o.title}
            <br>Remaining: ${o.remainingPercent.toFixed(1)}% (${o.remainingUses} uses)
            <br><a href="${process.env.ADMIN_BASE_URL || ''}/admin/offers/${o.offerId}/edit">Edit Offer</a>
          </li>
        `).join('')}
      </ul>
    ` : ''}

    ${report.expiredOffers.length > 0 ? `
      <h2 style="color: gray;">⏰ Expired</h2>
      <ul>
        ${report.expiredOffers.map(o => `
          <li>
            <strong>${o.code}</strong> - ${o.title}
            <br>Was: ${o.remainingUses}/${o.maxUses} uses
          </li>
        `).join('')}
      </ul>
    ` : ''}

    ${report.actionsTaken.length > 0 ? `
      <h2>Actions Taken</h2>
      <ul>
        ${report.actionsTaken.map(a => `<li>${a}</li>`).join('')}
      </ul>
    ` : ''}

    <hr>
    <p>This is an automated notification from the Offer System.</p>
  `;

  try {
    await sendEmail(
      CONFIG.ADMIN_EMAIL,
      `Offer System Alert: ${totalAlerts} offers need attention`,
      emailContent
    );
    logger.info('Offer expiry notification email sent', {
      to: CONFIG.ADMIN_EMAIL,
      expiringCount: report.expiringOffers.length,
      nearlyExhaustedCount: report.nearlyExhaustedOffers.length,
      expiredCount: report.expiredOffers.length,
    });
  } catch (error) {
    logger.error('Failed to send offer expiry notification email', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Log to audit log
 */
async function logToAuditLog(report: NotificationReport): Promise<void> {
  if (!CONFIG.NOTIFY_VIA_AUDIT_LOG) return;

  const totalAlerts = report.expiringOffers.length +
                      report.nearlyExhaustedOffers.length +
                      report.expiredOffers.length;

  if (totalAlerts === 0) return;

  try {
    await AuditLog.create({
      action: 'OFFER_EXPIRY_CHECK',
      resource: 'system',
      resourceId: 'scheduled_task',
      details: {
        expiringOffers: report.expiringOffers,
        nearlyExhaustedOffers: report.nearlyExhaustedOffers,
        expiredOffers: report.expiredOffers,
        actionsTaken: report.actionsTaken,
      },
      status: 'success',
    });
  } catch (error) {
    logger.error('Failed to create audit log', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Main execution
 */
async function main() {
  logger.info('Starting offer expiry notification check', {
    action: 'OFFER_EXPIRY_CHECK_START',
  });

  try {
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || '');
    logger.info('Connected to MongoDB');

    // Run checks
    const report = await checkOffers();

    // Log results
    logger.info('Offer expiry check completed', {
      expiringCount: report.expiringOffers.length,
      nearlyExhaustedCount: report.nearlyExhaustedOffers.length,
      expiredCount: report.expiredOffers.length,
      actionsTaken: report.actionsTaken.length,
    });

    // Send notifications
    await sendEmailNotification(report);
    await logToAuditLog(report);

    logger.info('Offer expiry notification process completed', {
      action: 'OFFER_EXPIRY_CHECK_COMPLETE',
    });
  } catch (error) {
    logger.error('Offer expiry notification check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      action: 'OFFER_EXPIRY_CHECK_ERROR',
    });
    throw error;
  } finally {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB');
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { checkOffers, sendEmailNotification, main };
