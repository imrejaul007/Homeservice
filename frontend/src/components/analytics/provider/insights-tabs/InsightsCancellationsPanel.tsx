import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import type {
  ProviderCancellationStats,
  BookingCancellationPrediction,
  PreventionRecommendation,
} from '../../../../services/providerInsightsApi';
import {
  getInsightsRouteForPreventionType,
  getPreventionActionLabel,
} from '../../../../utils/aiTips';
import { InsightsStatCard, RiskCard, formatPercentage } from './insightsPanelUtils';

interface InsightsCancellationsPanelProps {
  cancellationStats: ProviderCancellationStats;
  upcomingCancellations: BookingCancellationPrediction[];
  preventionRecommendations: PreventionRecommendation[];
}

export const InsightsCancellationsPanel: React.FC<InsightsCancellationsPanelProps> = ({
  cancellationStats,
  upcomingCancellations,
  preventionRecommendations,
}) => {
  const navigate = useNavigate();
  const highRisk = upcomingCancellations.filter((c) => c.riskAssessment.riskLevel !== 'low');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <InsightsStatCard
          title="Cancellation Rate"
          value={formatPercentage(cancellationStats.cancellationRate)}
          subtitle={
            cancellationStats.cancellationRate <= 10
              ? 'Excellent'
              : cancellationStats.cancellationRate <= 20
                ? 'Acceptable'
                : 'Needs attention'
          }
          trend={{
            value: cancellationStats.cancellationRate,
            isPositive: cancellationStats.cancellationRate <= 15,
          }}
        />
        <InsightsStatCard
          title="Total Cancelled"
          value={cancellationStats.cancelledBookings}
          subtitle={`${cancellationStats.totalBookings} total bookings`}
        />
        <InsightsStatCard
          title="Customer-Initiated"
          value={cancellationStats.customerInitiatedCancellations}
          subtitle={`${formatPercentage(
            cancellationStats.cancelledBookings > 0
              ? (cancellationStats.customerInitiatedCancellations / cancellationStats.cancelledBookings) *
                  100
              : 0,
          )} of cancellations`}
        />
        <InsightsStatCard
          title="Trend"
          value={
            cancellationStats.trend === 'improving'
              ? 'Improving'
              : cancellationStats.trend === 'worsening'
                ? 'Worsening'
                : 'Stable'
          }
          subtitle={
            cancellationStats.trend === 'improving'
              ? 'Cancellation rate decreasing'
              : cancellationStats.trend === 'worsening'
                ? 'Cancellation rate increasing'
                : 'No significant change'
          }
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          High-Risk Cancellations
          {highRisk.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-sm">
              {highRisk.length} at risk
            </span>
          )}
        </h3>
        {highRisk.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {highRisk.slice(0, 6).map((prediction) => (
              <RiskCard key={prediction.bookingId} prediction={prediction} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No high-risk cancellations predicted. Great job!</p>
        )}
      </div>

      {cancellationStats.commonReasons.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Common Cancellation Reasons</h3>
          <div className="space-y-3">
            {cancellationStats.commonReasons.map((reason, idx) => (
              <div key={idx}>
                <div className="flex justify-between mb-1">
                  <span className="text-gray-700">{reason.reason}</span>
                  <span className="text-gray-500">
                    {reason.count} ({formatPercentage(reason.percentage)})
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-400 rounded-full"
                    style={{ width: `${reason.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {preventionRecommendations.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-3">Prevention Recommendations</h3>
          <div className="space-y-3">
            {preventionRecommendations.map((rec) => (
              <div
                key={rec.type}
                className="flex items-start gap-3 p-3 bg-white rounded-lg border border-green-200"
              >
                <div
                  className={`p-2 rounded-lg ${
                    rec.type === 'reminder'
                      ? 'bg-blue-100 text-blue-600'
                      : rec.type === 'confirmation'
                        ? 'bg-purple-100 text-purple-600'
                        : rec.type === 'deposit'
                          ? 'bg-orange-100 text-orange-600'
                          : 'bg-green-100 text-green-600'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{rec.message}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        rec.priority === 'high'
                          ? 'bg-red-100 text-red-700'
                          : rec.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {rec.priority}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Estimated impact: -{rec.estimatedImpact}% cancellations · {rec.confidence}%
                    confidence
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(getInsightsRouteForPreventionType(rec.type))}
                    className="mt-2 text-sm font-medium text-green-800 hover:text-green-950"
                  >
                    {getPreventionActionLabel(rec.type)} →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
