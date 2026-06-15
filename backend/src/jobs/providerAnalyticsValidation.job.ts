import mongoose from 'mongoose';
import Booking from '../models/booking.model';
import logger from '../utils/logger';
import { getProviderDashboard } from '../services/providerDashboard.service';
import { getGrossRevenueForPeriod, getProviderPeriodDates } from '../services/providerMetrics.shared';

const DRIFT_THRESHOLD_PERCENT = 5;

function pctDrift(dashboardValue: number, aggregateValue: number): number {
  if (aggregateValue === 0) {
    return dashboardValue === 0 ? 0 : 100;
  }
  return Math.abs(((dashboardValue - aggregateValue) / aggregateValue) * 100);
}

/**
 * Compare unified dashboard revenue against booking aggregates and log drift.
 */
export async function validateProviderAnalytics(providerId?: string): Promise<void> {
  const period: '7d' | '30d' | '90d' = '30d';
  const providerIds = providerId
    ? [providerId]
    : await Booking.distinct('providerId', {
      status: 'completed',
      completedAt: { $gte: getProviderPeriodDates(period).startDate },
    });

  for (const id of providerIds) {
    if (!mongoose.Types.ObjectId.isValid(String(id))) continue;

    const providerIdStr = String(id);
    const { now, startDate } = getProviderPeriodDates(period);
    const providerObjectId = new mongoose.Types.ObjectId(providerIdStr);

    const [dashboard, aggregate] = await Promise.all([
      getProviderDashboard(providerIdStr, { period, revenue: 'gross' }),
      getGrossRevenueForPeriod(providerObjectId, startDate, now),
    ]);

    const dashboardRevenue = Number((dashboard.earnings as { grossEarnings?: { thisMonth?: number } }).grossEarnings?.thisMonth || 0);
    const aggregateRevenue = aggregate.grossTotal;
    const drift = pctDrift(dashboardRevenue, aggregateRevenue);

    if (drift > DRIFT_THRESHOLD_PERCENT) {
      logger.warn('Provider analytics revenue drift detected', {
        providerId: providerIdStr,
        period,
        dashboardRevenue,
        aggregateRevenue,
        driftPercent: Math.round(drift * 100) / 100,
      });
    } else {
      logger.info('Provider analytics revenue validation passed', {
        providerId: providerIdStr,
        period,
        dashboardRevenue,
        aggregateRevenue,
        driftPercent: Math.round(drift * 100) / 100,
      });
    }
  }
}

export async function runProviderAnalyticsValidationJob(): Promise<void> {
  logger.info('Starting provider analytics validation job');
  await validateProviderAnalytics();
  logger.info('Provider analytics validation job completed');
}

export default runProviderAnalyticsValidationJob;
