import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Activity, Star, TrendingUp, Sparkles } from 'lucide-react';
import type {
  ProviderInsightsData,
  RevenueOptimizationTip,
  Period,
} from '../../../../services/providerInsightsApi';
import { CompetitivePosition } from '../CompetitivePosition';
import { ServiceProfitability } from '../ServiceProfitability';
import { PeakHoursRevenue } from '../PeakHoursRevenue';
import { PageErrorBoundary } from '../../../common/PageErrorBoundary';
import { RevenueTrendChart } from '../../../provider/RevenueTrendChart';
import { getInsightsRouteForRevenueCategory } from '../../../../utils/aiTips';
import { INSIGHTS_PERIOD_LABELS } from './periodMapping';
import {
  InsightsStatCard,
  InsightCard,
  formatCurrency,
  formatPercentage,
} from './insightsPanelUtils';

interface InsightsOverviewPanelProps {
  insights: ProviderInsightsData;
  optimizationTips: RevenueOptimizationTip[];
  providerId?: string;
  period: Period;
  analyticsTimeRange: '7d' | '30d' | '90d' | '1y';
}

export const InsightsOverviewPanel: React.FC<InsightsOverviewPanelProps> = ({
  insights,
  optimizationTips,
  providerId,
  period,
  analyticsTimeRange,
}) => {
  const navigate = useNavigate();
  const { performance, revenue, customerSatisfaction, insights: insightsList } = insights;

  const peakHoursRange =
    analyticsTimeRange === '1y' ? '90d' : analyticsTimeRange === '7d' ? '7d' : analyticsTimeRange;
  const serviceProfitabilityRange =
    analyticsTimeRange === '1y' ? '1y' : analyticsTimeRange === '7d' ? '7d' : analyticsTimeRange;

  return (
    <div className="space-y-6">
      <p className="text-xs text-nilin-warmGray">
        Metrics use net revenue after platform fees and commission.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <InsightsStatCard
          title="Total Revenue"
          value={formatCurrency(revenue.totalRevenue)}
          subtitle={`vs ${formatPercentage(Math.abs(revenue.revenueGrowth))} from last period`}
          trend={{ value: revenue.revenueGrowth, isPositive: revenue.revenueGrowth >= 0 }}
          icon={DollarSign}
        />
        <InsightsStatCard
          title="Completed Bookings"
          value={performance.completedBookings}
          subtitle={`${formatPercentage(performance.completionRate)} completion rate`}
          icon={Activity}
        />
        <InsightsStatCard
          title="Average Rating"
          value={customerSatisfaction.averageRating.toFixed(1)}
          subtitle={`${customerSatisfaction.totalReviews} reviews`}
          icon={Star}
        />
        <InsightsStatCard
          title="Repeat Customers"
          value={formatPercentage(performance.repeatCustomerRate)}
          subtitle="customer loyalty"
          icon={TrendingUp}
        />
      </div>

      <div>
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-nilin-coral" />
          AI-Generated Insights
        </h3>
        {insightsList.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insightsList.slice(0, 4).map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        ) : (
          <div className="bg-gray-50 rounded-lg p-8 text-center text-gray-500">
            No insights generated yet. Keep providing great service!
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Optimization Tips</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {optimizationTips.slice(0, 4).map((tip) => (
            <div
              key={tip.category}
              className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    tip.category === 'pricing'
                      ? 'bg-purple-100 text-purple-600'
                      : tip.category === 'volume'
                        ? 'bg-blue-100 text-blue-600'
                        : tip.category === 'efficiency'
                          ? 'bg-green-100 text-green-600'
                          : 'bg-orange-100 text-orange-600'
                  }`}
                >
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{tip.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{tip.description}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs text-gray-500">Potential: +{tip.potentialImpact}% revenue</span>
                    <span className="text-xs text-gray-500">{tip.confidence}% confidence</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        tip.difficulty === 'easy'
                          ? 'bg-green-100 text-green-700'
                          : tip.difficulty === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {tip.difficulty}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(getInsightsRouteForRevenueCategory(tip.category))}
                    className="mt-3 text-sm font-medium text-blue-700 hover:text-blue-900"
                  >
                    {tip.actionItems[0] || 'Take action'} →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PageErrorBoundary pageName="CompetitivePosition">
          <CompetitivePosition providerId={providerId} />
        </PageErrorBoundary>
        <PageErrorBoundary pageName="ServiceProfitability">
          <ServiceProfitability
            providerId={providerId}
            timeRange={serviceProfitabilityRange}
            hidePeriodSelector
          />
        </PageErrorBoundary>
      </div>

      <div className="glass-nilin rounded-nilin-lg p-4 sm:p-6">
        <h3 className="text-lg font-serif text-nilin-charcoal mb-4">Revenue Trend</h3>
        <RevenueTrendChart
          data={revenue.revenueByDay.map((day) => ({
            date: day.date,
            revenue: day.amount,
            bookings: day.count,
          }))}
          period={INSIGHTS_PERIOD_LABELS[period]}
          variant="area"
          height={280}
          currency="AED"
        />
      </div>

      <PageErrorBoundary pageName="PeakHoursRevenue">
        <PeakHoursRevenue
          providerId={providerId}
          timeRange={peakHoursRange}
          hidePeriodSelector
        />
      </PageErrorBoundary>
    </div>
  );
};
