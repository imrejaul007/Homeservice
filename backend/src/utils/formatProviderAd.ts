/**
 * Normalize provider ad documents for API responses (list + detail).
 */
export function formatProviderAd(ad: Record<string, unknown>): Record<string, unknown> {
  const statistics = (ad.statistics || {}) as Record<string, number>;
  const budget = (ad.budget || {}) as Record<string, number>;

  const views = statistics.views || 0;
  const clicks = statistics.clicks || 0;
  const conversions = statistics.conversions || 0;
  const spent = Math.max(budget.spent || 0, statistics.totalSpent || 0);
  const total = budget.total || 0;

  const ctr =
    statistics.ctr ??
    (views > 0 ? Number(((clicks / views) * 100).toFixed(2)) : 0);
  const conversionRate =
    statistics.conversionRate ??
    (clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0);
  const costPerClick =
    statistics.costPerClick ??
    (clicks > 0 ? Number((spent / clicks).toFixed(2)) : 0);
  const costPerConversion =
    statistics.costPerConversion ??
    (conversions > 0 ? Number((spent / conversions).toFixed(2)) : 0);

  return {
    ...ad,
    _id: (ad._id as { toString?: () => string })?.toString?.() ?? ad._id,
    providerId:
      (ad.providerId as { toString?: () => string })?.toString?.() ?? ad.providerId,
    budget: {
      ...budget,
      spent,
      remaining: Math.max(0, total - spent),
    },
    statistics: {
      ...statistics,
      views,
      clicks,
      conversions,
      ctr,
      conversionRate,
      totalSpent: spent,
      costPerClick,
      costPerConversion,
      dailyStats: statistics.dailyStats || (ad.statistics as { dailyStats?: unknown[] })?.dailyStats || [],
    },
  };
}
