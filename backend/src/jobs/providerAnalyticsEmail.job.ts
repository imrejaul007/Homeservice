import ProviderProfile from '../models/providerProfile.model';
import logger from '../utils/logger';
import { getProviderDashboard } from '../services/providerDashboard.service';

/**
 * Weekly analytics email report for providers who opted in.
 * Sends a summary payload to the notification/email pipeline (stub logs for now).
 */
export async function runProviderAnalyticsEmailJob(): Promise<void> {
  logger.info('Starting provider analytics email job');

  const profiles = await ProviderProfile.find({
    'settings.analyticsPreferences.emailReports': true,
    isActive: true,
    isDeleted: { $ne: true },
  })
    .select('userId businessInfo.businessName settings.analyticsPreferences')
    .lean();

  let sent = 0;

  for (const profile of profiles) {
    const providerId = profile.userId?.toString();
    if (!providerId) continue;

    try {
      const dashboard = await getProviderDashboard(providerId, { period: '30d', revenue: 'net' });
      const earnings = dashboard.earnings as { thisMonth?: number };
      const overview = dashboard.overview as { bookingRequests?: number; profileViews?: number };

      logger.info('Provider analytics email report prepared', {
        providerId,
        businessName: profile.businessInfo?.businessName,
        netRevenue: earnings.thisMonth ?? 0,
        bookingRequests: overview.bookingRequests ?? 0,
        profileViews: overview.profileViews ?? 0,
      });

      // TODO: wire to notification.service / email template when product copy is finalized
      sent += 1;
    } catch (error) {
      logger.warn('Failed to prepare analytics email for provider', {
        providerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info('Provider analytics email job completed', { recipients: sent });
}

export default runProviderAnalyticsEmailJob;
