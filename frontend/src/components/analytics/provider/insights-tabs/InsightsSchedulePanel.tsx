import React from 'react';
import type { ScheduleOptimization } from '../../../../services/providerInsightsApi';
import { providerInsightsApi } from '../../../../services/providerInsightsApi';
import { InsightsStatCard, formatPercentage } from './insightsPanelUtils';

interface InsightsSchedulePanelProps {
  scheduleOptimization: ScheduleOptimization;
}

export const InsightsSchedulePanel: React.FC<InsightsSchedulePanelProps> = ({
  scheduleOptimization,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InsightsStatCard
          title="Calendar Utilization"
          value={formatPercentage(scheduleOptimization.currentUtilization)}
          subtitle={
            scheduleOptimization.currentUtilization >= 80
              ? 'Excellent utilization'
              : scheduleOptimization.currentUtilization >= 50
                ? 'Room for improvement'
                : 'Consider adding availability'
          }
        />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Peak Hours</div>
          <div className="flex flex-wrap gap-1">
            {scheduleOptimization.peakDemandHours.map((hour) => (
              <span key={hour} className="px-2 py-1 bg-red-100 text-red-700 rounded text-sm">
                {providerInsightsApi.formatHour(hour)}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="text-sm text-gray-500 mb-1">Off-Peak Hours</div>
          <div className="flex flex-wrap gap-1">
            {scheduleOptimization.offPeakHours.map((hour) => (
              <span key={hour} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                {providerInsightsApi.formatHour(hour)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
          Optimal Booking Slots
        </h3>
        {scheduleOptimization.optimalSlots.length > 0 ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="text-left text-xs sm:text-sm text-gray-500 border-b">
                  <th className="pb-2 px-2">Time</th>
                  <th className="pb-2 px-2">Demand</th>
                  <th className="pb-2 px-2">Fill Rate</th>
                  <th className="pb-2 px-2">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {scheduleOptimization.optimalSlots.map((slot, idx) => (
                  <tr key={idx} className="border-b border-gray-100">
                    <td className="py-2 sm:py-3 px-2 font-medium text-sm">{slot.time}</td>
                    <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm">{slot.demand}</td>
                    <td className="py-2 sm:py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 sm:w-20 h-1.5 sm:h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              slot.fillRate >= 80
                                ? 'bg-green-500'
                                : slot.fillRate >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-gray-400'
                            }`}
                            style={{ width: `${Math.min(slot.fillRate, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs sm:text-sm">{formatPercentage(slot.fillRate)}</span>
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 px-2 text-xs sm:text-sm text-gray-600">
                      {slot.recommendation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No optimal slots identified yet</p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Weekly Pattern</h3>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {scheduleOptimization.weeklyPattern.map((day) => (
            <div
              key={day.dayOfWeek}
              className={`text-center p-2 sm:p-3 rounded-lg ${
                day.isPeakDay
                  ? 'bg-red-50 border-2 border-red-200'
                  : day.demandLevel === 'high'
                    ? 'bg-orange-50 border border-orange-200'
                    : 'bg-gray-50'
              }`}
            >
              <div className="text-[10px] sm:text-xs text-gray-500">{day.dayName}</div>
              <div className="text-base sm:text-lg font-bold text-gray-900">{day.totalBookings}</div>
              <div className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">bookings</div>
              {day.isPeakDay && (
                <span className="text-[10px] sm:text-xs text-red-600 font-medium">Peak</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {scheduleOptimization.suggestions.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">Schedule Suggestions</h3>
          <ul className="space-y-2">
            {scheduleOptimization.suggestions.map((suggestion, idx) => (
              <li key={idx} className="flex items-start gap-2 text-blue-800">
                <span className="mt-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
