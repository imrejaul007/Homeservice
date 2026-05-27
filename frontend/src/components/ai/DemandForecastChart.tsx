// DemandForecastChart - AI demand forecasting visualization component
import React, { useMemo } from 'react';
import { DemandForecast, DemandPrediction } from '../../services/ai/demandClient';
import { useDemandForecast } from '../../hooks/useDemandForecast';

interface DemandForecastChartProps {
  serviceId?: string;
  providerId?: string;
  days?: number;
  showInsights?: boolean;
  compact?: boolean;
}

export const DemandForecastChart: React.FC<DemandForecastChartProps> = ({
  serviceId,
  providerId,
  days = 7,
  showInsights = true,
  compact = false,
}) => {
  const endDate = new Date();
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { forecast, isLoading, error } = useDemandForecast({
    serviceId,
    providerId,
    dateRange: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    },
    granularity: 'day',
    autoFetch: true,
  });

  const getDemandColor = (level: 'low' | 'medium' | 'high' | 'peak') => {
    switch (level) {
      case 'peak':
        return '#dc2626';
      case 'high':
        return '#f97316';
      case 'medium':
        return '#eab308';
      default:
        return '#22c55e';
    }
  };

  const maxDemand = useMemo(() => {
    if (!forecast?.predictions) return 100;
    return Math.max(...forecast.predictions.map((p) => p.predicted), 100);
  }, [forecast]);

  const chartData = useMemo(() => {
    if (!forecast?.predictions) return [];
    return forecast.predictions.map((p) => ({
      ...p,
      date: new Date(p.timestamp),
      barHeight: (p.predicted / maxDemand) * 100,
    }));
  }, [forecast, maxDemand]);

  if (isLoading) {
    return (
      <div className="demand-forecast-chart loading">
        <div className="chart-skeleton">
          <div className="skeleton-bars">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="skeleton-bar" style={{ height: `${Math.random() * 60 + 40}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !forecast) {
    return null;
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  return (
    <div className={`demand-forecast-chart ${compact ? 'compact' : ''}`}>
      <div className="chart-header">
        <div className="chart-title">
          <h4>Demand Forecast</h4>
          <span className="trend-badge">
            {forecast.insights.demandTrend === 'increasing' ? 'Trending Up' :
             forecast.insights.demandTrend === 'decreasing' ? 'Trending Down' : 'Stable'}
          </span>
        </div>
        {forecast.insights.seasonalityFactor !== 1 && (
          <div className="seasonality-indicator">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
            </svg>
            <span>{forecast.insights.seasonalityFactor > 1 ? '+' : ''}{((forecast.insights.seasonalityFactor - 1) * 100).toFixed(0)}% seasonal</span>
          </div>
        )}
      </div>

      <div className="chart-container">
        <div className="chart-bars">
          {chartData.map((day, index) => (
            <div key={index} className="bar-wrapper">
              <div className="bar-tooltip">
                <span className="tooltip-value">{day.predicted.toFixed(0)}%</span>
                <span className="tooltip-level">{day.demandLevel}</span>
              </div>
              <div
                className="demand-bar"
                style={{
                  height: `${day.barHeight}%`,
                  backgroundColor: getDemandColor(day.demandLevel),
                }}
              >
                {day.features.isHoliday && <div className="holiday-indicator" />}
              </div>
              <span className="bar-label">{formatDate(day.date)}</span>
            </div>
          ))}
        </div>

        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#22c55e' }} />
            <span>Low</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#eab308' }} />
            <span>Medium</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#f97316' }} />
            <span>High</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot" style={{ backgroundColor: '#dc2626' }} />
            <span>Peak</span>
          </div>
        </div>
      </div>

      {showInsights && (
        <div className="chart-insights">
          <div className="insight-section">
            <h5>Peak Hours</h5>
            <div className="time-chips">
              {forecast.insights.peakHours.map((hour, i) => (
                <span key={i} className="time-chip peak">{formatHour(hour)}</span>
              ))}
            </div>
          </div>

          <div className="insight-section">
            <h5>Best Booking Windows</h5>
            <div className="time-chips">
              {forecast.insights.bestBookingWindows.slice(0, 2).map((slot, i) => (
                <span key={i} className="time-chip best">{slot.start} - {slot.end}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {showInsights && forecast.insights.recommendations.length > 0 && (
        <div className="chart-recommendations">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p>{forecast.insights.recommendations[0]}</p>
        </div>
      )}

      <style>{`
        .demand-forecast-chart {
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .demand-forecast-chart.compact {
          padding: 12px;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .chart-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .chart-title h4 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .trend-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 12px;
          background: #f0fdf4;
          color: #16a34a;
        }

        .seasonality-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #f59e0b;
        }

        .chart-container {
          margin-bottom: 16px;
        }

        .chart-bars {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          height: 120px;
          padding-bottom: 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .bar-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          position: relative;
        }

        .bar-wrapper:hover .bar-tooltip {
          display: flex;
        }

        .bar-tooltip {
          display: none;
          position: absolute;
          top: -40px;
          flex-direction: column;
          align-items: center;
          background: #1f2937;
          color: white;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 12px;
          z-index: 10;
        }

        .tooltip-value {
          font-weight: 600;
        }

        .tooltip-level {
          font-size: 10px;
          opacity: 0.8;
          text-transform: capitalize;
        }

        .demand-bar {
          width: 24px;
          border-radius: 4px 4px 0 0;
          transition: height 0.3s;
          position: relative;
        }

        .holiday-indicator {
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          background: #8b5cf6;
          border-radius: 50%;
        }

        .bar-label {
          position: absolute;
          bottom: -20px;
          font-size: 10px;
          color: #6b7280;
        }

        .chart-legend {
          display: flex;
          justify-content: center;
          gap: 16px;
          margin-top: 8px;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #6b7280;
        }

        .legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .chart-insights {
          display: flex;
          gap: 16px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid #f3f4f6;
        }

        .insight-section {
          flex: 1;
        }

        .insight-section h5 {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
          margin: 0 0 8px;
        }

        .time-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .time-chip {
          font-size: 11px;
          font-weight: 500;
          padding: 4px 8px;
          border-radius: 6px;
          background: #f3f4f6;
          color: #374151;
        }

        .time-chip.peak {
          background: #fef2f2;
          color: #dc2626;
        }

        .time-chip.best {
          background: #f0fdf4;
          color: #16a34a;
        }

        .chart-recommendations {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-top: 16px;
          padding: 12px;
          background: #fefce8;
          border-radius: 8px;
          color: #854d0e;
        }

        .chart-recommendations svg {
          flex-shrink: 0;
          margin-top: 2px;
        }

        .chart-recommendations p {
          margin: 0;
          font-size: 13px;
          line-height: 1.4;
        }

        .chart-skeleton {
          height: 200px;
          display: flex;
          align-items: flex-end;
        }

        .skeleton-bars {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          width: 100%;
          height: 100%;
        }

        .skeleton-bar {
          width: 24px;
          background: #e5e7eb;
          border-radius: 4px 4px 0 0;
          animation: pulse 1.5s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default DemandForecastChart;
