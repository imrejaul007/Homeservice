import ProviderProfile from '../models/providerProfile.model';
import User from '../models/user.model';
import logger from '../utils/logger';
import { getProviderDashboard } from '../services/providerDashboard.service';
import { notificationService } from '../services/notification.service';

// Brand colors matching NILIN design system
const BRAND_COLORS = {
  primary: '#E11D48',      // Rose-600 (coral)
  primaryDark: '#BE123C',  // Rose-700
  primaryLight: '#FCE7F3', // Rose-100
  secondary: '#F97316',    // Orange-500
  text: '#1F2937',         // Gray-800
  textLight: '#6B7280',    // Gray-500
  background: '#FFF1F2',   // Rose-50
  white: '#FFFFFF',
  success: '#10B981',      // Emerald-500
  warning: '#F59E0B',      // Amber-500
  border: '#E5E7EB',       // Gray-200
};

/**
 * Generate the provider analytics digest email HTML template
 */
function generateAnalyticsDigestHtml(data: {
  firstName: string;
  businessName: string;
  avatarUrl?: string;
  periodLabel: string;
  completedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  totalEarnings: number;
  currency: string;
  averageRating: number;
  totalReviews: number;
  profileViews: number;
  upcomingBookings: Array<{
    serviceName: string;
    customerName: string;
    date: string;
    time: string;
    status: string;
  }>;
  analyticsUrl: string;
}): string {
  const {
    firstName,
    businessName,
    avatarUrl,
    periodLabel,
    completedBookings,
    pendingBookings,
    cancelledBookings,
    totalEarnings,
    currency,
    averageRating,
    totalReviews,
    profileViews,
    upcomingBookings,
    analyticsUrl,
  } = data;

  const formattedEarnings = new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: currency || 'AED',
  }).format(totalEarnings || 0);

  const initials = firstName ? firstName.charAt(0).toUpperCase() : 'P';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Analytics - NILIN</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${BRAND_COLORS.background};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: ${BRAND_COLORS.white}; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
    <!-- Header -->
    <tr>
      <td style="background: linear-gradient(135deg, ${BRAND_COLORS.primary} 0%, ${BRAND_COLORS.primaryDark} 100%); padding: 32px 24px; text-align: center;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto 16px;">
          <tr>
            <td style="width: 64px; height: 64px; border-radius: 50%; background: ${BRAND_COLORS.white}; text-align: center; vertical-align: middle; overflow: hidden;">
              ${avatarUrl
                ? `<img src="${avatarUrl}" alt="${businessName}" style="width: 64px; height: 64px; object-fit: cover;">`
                : `<span style="font-size: 24px; font-weight: 700; color: ${BRAND_COLORS.primary}; line-height: 64px;">${initials}</span>`
              }
            </td>
          </tr>
        </table>
        <h1 style="margin: 0 0 4px; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.white}; letter-spacing: -0.5px;">NILIN</h1>
        <p style="margin: 0; color: rgba(255,255,255,0.9); font-size: 14px;">Provider Analytics</p>
      </td>
    </tr>

    <!-- Greeting -->
    <tr>
      <td style="padding: 32px 24px 0;">
        <h2 style="margin: 0 0 8px; font-size: 24px; font-weight: 600; color: ${BRAND_COLORS.text};">
          Hi ${firstName}!
        </h2>
        <p style="margin: 0 0 8px; color: ${BRAND_COLORS.textLight}; font-size: 16px; line-height: 1.5;">
          Here's how your business performed this ${periodLabel}.
        </p>
        <p style="margin: 0 0 24px; color: ${BRAND_COLORS.textLight}; font-size: 14px;">
          ${businessName}
        </p>
      </td>
    </tr>

    <!-- Stats Grid -->
    <tr>
      <td style="padding: 0 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; overflow: hidden;">
          <tr>
            <!-- Earnings -->
            <td style="padding: 24px; text-align: center; border-right: 1px solid ${BRAND_COLORS.border}; width: 50%;">
              <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.textLight};">Net Earnings</p>
              <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.success};">${formattedEarnings}</p>
            </td>
            <!-- Completed Bookings -->
            <td style="padding: 24px; text-align: center; width: 50%;">
              <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.textLight};">Completed</p>
              <p style="margin: 0; font-size: 28px; font-weight: 700; color: ${BRAND_COLORS.text};">${completedBookings}</p>
            </td>
          </tr>
          <tr>
            <td colspan="2" style="border-top: 1px solid ${BRAND_COLORS.border};"></td>
          </tr>
          <tr>
            <!-- Pending -->
            <td style="padding: 24px; text-align: center; border-right: 1px solid ${BRAND_COLORS.border}; width: 50%;">
              <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.textLight};">Pending</p>
              <p style="margin: 0; font-size: 24px; font-weight: 600; color: ${BRAND_COLORS.warning};">${pendingBookings}</p>
            </td>
            <!-- Cancelled -->
            <td style="padding: 24px; text-align: center; width: 50%;">
              <p style="margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLORS.textLight};">Cancelled</p>
              <p style="margin: 0; font-size: 24px; font-weight: 600; color: ${BRAND_COLORS.primary};">${cancelledBookings}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Additional Stats -->
    <tr>
      <td style="padding: 24px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <!-- Rating -->
            <td style="padding: 16px; background: ${BRAND_COLORS.background}; border-radius: 8px; text-align: center; width: 33.33%;">
              <p style="margin: 0 0 4px; font-size: 24px; font-weight: 700; color: ${BRAND_COLORS.secondary};">${averageRating.toFixed(1)} / 5</p>
              <p style="margin: 0; font-size: 12px; color: ${BRAND_COLORS.textLight};">${totalReviews} reviews</p>
            </td>
            <td style="width: 8px;"></td>
            <!-- Profile Views -->
            <td style="padding: 16px; background: ${BRAND_COLORS.background}; border-radius: 8px; text-align: center; width: 33.33%;">
              <p style="margin: 0 0 4px; font-size: 24px; font-weight: 700; color: ${BRAND_COLORS.text};">${profileViews}</p>
              <p style="margin: 0; font-size: 12px; color: ${BRAND_COLORS.textLight};">Profile views</p>
            </td>
            <td style="width: 8px;"></td>
            <!-- Conversion -->
            <td style="padding: 16px; background: ${BRAND_COLORS.background}; border-radius: 8px; text-align: center; width: 33.33%;">
              <p style="margin: 0 0 4px; font-size: 24px; font-weight: 700; color: ${BRAND_COLORS.primary};">${completedBookings > 0 && (completedBookings + pendingBookings) > 0 ? ((completedBookings / (completedBookings + pendingBookings)) * 100).toFixed(0) : 0}%</p>
              <p style="margin: 0; font-size: 12px; color: ${BRAND_COLORS.textLight};">Accept rate</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Upcoming Bookings -->
    ${upcomingBookings.length > 0 ? `
    <tr>
      <td style="padding: 0 24px;">
        <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: ${BRAND_COLORS.text};">
          Upcoming Bookings
        </h3>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: ${BRAND_COLORS.background}; border-radius: 12px; overflow: hidden;">
          ${upcomingBookings.slice(0, 3).map(booking => `
          <tr>
            <td style="padding: 16px; border-bottom: 1px solid ${BRAND_COLORS.border};">
              <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: ${BRAND_COLORS.text};">${booking.serviceName}</p>
              <p style="margin: 0; font-size: 12px; color: ${BRAND_COLORS.textLight};">
                ${booking.customerName} - ${booking.date} at ${booking.time}
              </p>
            </td>
          </tr>
          `).join('')}
        </table>
        ${upcomingBookings.length > 3 ? `
        <p style="margin: 8px 0 0; font-size: 12px; color: ${BRAND_COLORS.textLight}; text-align: center;">
          + ${upcomingBookings.length - 3} more upcoming bookings
        </p>
        ` : ''}
      </td>
    </tr>
    ` : ''}

    <!-- CTA Button -->
    <tr>
      <td style="padding: 32px 24px; text-align: center;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 0 auto;">
          <tr>
            <td style="border-radius: 8px; background: ${BRAND_COLORS.primary}; text-align: center;">
              <a href="${analyticsUrl}" style="display: inline-block; padding: 14px 32px; color: ${BRAND_COLORS.white}; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                View Full Analytics
              </a>
            </td>
          </tr>
        </table>
        <p style="margin: 16px 0 0; font-size: 12px; color: ${BRAND_COLORS.textLight};">
          Track your performance, analyze trends, and grow your business.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 24px; background: ${BRAND_COLORS.background}; text-align: center;">
        <p style="margin: 0 0 8px; font-size: 12px; color: ${BRAND_COLORS.textLight};">
          &copy; ${new Date().getFullYear()} NILIN. All rights reserved.<br>
          <span style="color: ${BRAND_COLORS.primary};">Transforming home services, one booking at a time.</span>
        </p>
        <p style="margin: 0; font-size: 11px; color: ${BRAND_COLORS.textLight};">
          You're receiving this because you opted in to analytics emails.<br>
          <a href="#" style="color: ${BRAND_COLORS.textLight};">Manage preferences</a> - <a href="#" style="color: ${BRAND_COLORS.textLight};">Unsubscribe</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Weekly analytics email report for providers who opted in.
 * Sends a branded HTML digest with weekly stats, earnings, ratings, and upcoming bookings.
 */
export async function runProviderAnalyticsEmailJob(): Promise<void> {
  logger.info('Starting provider analytics email job');

  const profiles = await ProviderProfile.find({
    'settings.analyticsPreferences.emailReports': true,
    isActive: true,
    isDeleted: { $ne: true },
  })
    .select('userId businessInfo settings.analyticsPreferences')
    .lean();

  let sent = 0;
  let failed = 0;

  for (const profile of profiles) {
    const providerId = profile.userId?.toString();
    if (!providerId) continue;

    try {
      // Get user for email and first name
      const user = await User.findById(providerId).select('email firstName avatar').lean();
      if (!user?.email) {
        logger.warn('No email found for provider', { providerId });
        continue;
      }

      // Fetch dashboard data for the last 7 days
      const dashboard = await getProviderDashboard(providerId, { period: '7d', revenue: 'net' });
      const earnings = dashboard.earnings as { thisMonth?: number; thisWeek?: number; total?: number } || {};
      const overview = dashboard.overview as {
        bookingRequests?: number;
        completedBookings?: number;
        cancelledBookings?: number;
        profileViews?: number;
      } || {};
      const rating = dashboard.ratings as { average?: number; totalReviews?: number } || {};

      // Get upcoming bookings from the dashboard
      const upcomingBookings = ((dashboard as any).upcomingBookings || []).slice(0, 5).map((b: any) => ({
        serviceName: b.service?.name || 'Service',
        customerName: b.customer?.firstName || 'Customer',
        date: b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' }) : '',
        time: b.scheduledTime || '',
        status: b.status || '',
      }));

      const businessName = (profile as any).businessInfo?.businessName || 'Your Business';
      const currency = (profile as any).settings?.currency || 'AED';

      // Generate HTML email
      const html = generateAnalyticsDigestHtml({
        firstName: user.firstName || 'Provider',
        businessName,
        avatarUrl: user.avatar,
        periodLabel: 'week',
        completedBookings: overview.completedBookings || 0,
        pendingBookings: Math.max(0, (overview.bookingRequests || 0) - (overview.completedBookings || 0) - (overview.cancelledBookings || 0)),
        cancelledBookings: overview.cancelledBookings || 0,
        totalEarnings: earnings.thisWeek || earnings.thisMonth || earnings.total || 0,
        currency,
        averageRating: rating.average || 0,
        totalReviews: rating.totalReviews || 0,
        profileViews: overview.profileViews || 0,
        upcomingBookings,
        analyticsUrl: `${process.env.FRONTEND_URL || 'https://nilin.com'}/provider/analytics`,
      });

      // Send email via notification service
      await notificationService.sendEmail({
        to: user.email,
        subject: `Your ${businessName} Weekly Performance Report`,
        template: html,
        data: {
          providerId,
          businessName,
          period: '7d',
        },
      });

      sent++;
      logger.info('Provider analytics email sent', {
        providerId,
        businessName,
        email: user.email,
        completedBookings: overview.completedBookings || 0,
        earnings: earnings.thisWeek || earnings.thisMonth || 0,
      });
    } catch (error) {
      failed++;
      logger.warn('Failed to send analytics email for provider', {
        providerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('Provider analytics email job completed', { sent, failed });
}

export default runProviderAnalyticsEmailJob;
