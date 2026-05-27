// ChurnRiskIndicator - AI churn prediction risk indicator component
import React from 'react';
import { ChurnRisk } from '../../services/ai/churnClient';

interface ChurnRiskIndicatorProps {
  churnRisk: ChurnRisk;
  compact?: boolean;
  showFactors?: boolean;
  showActions?: boolean;
  onActionClick?: (action: string) => void;
}

export const ChurnRiskIndicator: React.FC<ChurnRiskIndicatorProps> = ({
  churnRisk,
  compact = false,
  showFactors = true,
  showActions = true,
  onActionClick,
}) => {
  const getRiskStyles = (level: 'low' | 'medium' | 'high' | 'critical') => {
    switch (level) {
      case 'critical':
        return { bg: '#fef2f2', color: '#dc2626', label: 'Critical' };
      case 'high':
        return { bg: '#fff7ed', color: '#ea580c', label: 'High Risk' };
      case 'medium':
        return { bg: '#fefce8', color: '#ca8a04', label: 'Medium Risk' };
      default:
        return { bg: '#f0fdf4', color: '#16a34a', label: 'Low Risk' };
    }
  };

  const styles = getRiskStyles(churnRisk.riskLevel);

  const getEngagementColor = (score: number) => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#84cc16';
    if (score >= 40) return '#eab308';
    if (score >= 20) return '#f97316';
    return '#dc2626';
  };

  const topFactors = churnRisk.riskFactors
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 3);

  const priorityActions = churnRisk.recommendedActions
    .filter((a) => a.priority >= 7)
    .slice(0, 2);

  if (compact) {
    return (
      <div
        className="churn-risk-indicator compact"
        style={{ backgroundColor: styles.bg }}
      >
        <div className="risk-badge" style={{ color: styles.color }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <span>{styles.label}</span>
        </div>
        <div className="compact-score">
          <span className="score">{Math.round(churnRisk.riskScore * 100)}%</span>
        </div>
      </div>
    );
  }

  return (
    <div className="churn-risk-indicator" style={{ backgroundColor: styles.bg }}>
      <div className="indicator-header">
        <div className="risk-status">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={styles.color} strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          <div className="risk-info">
            <h4 style={{ color: styles.color, margin: 0 }}>{styles.label}</h4>
            <p className="risk-score">
              Risk Score: {(churnRisk.riskScore * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        <div className="engagement-section">
          <div className="engagement-label">Engagement</div>
          <div className="engagement-bar">
            <div
              className="engagement-fill"
              style={{
                width: `${churnRisk.engagementScore}%`,
                backgroundColor: getEngagementColor(churnRisk.engagementScore),
              }}
            />
          </div>
          <div className="engagement-value">{churnRisk.engagementScore.toFixed(0)}%</div>
        </div>
      </div>

      <div className="indicator-metrics">
        <div className="metric">
          <span className="metric-value">{churnRisk.daysSinceLastBooking}</span>
          <span className="metric-label">Days Since Booking</span>
        </div>
        <div className="metric">
          <span className="metric-value">AED {churnRisk.lifetimeValue.toFixed(0)}</span>
          <span className="metric-label">Lifetime Value</span>
        </div>
        <div className="metric">
          <span className="metric-value">
            {churnRisk.lastBookingDate
              ? new Date(churnRisk.lastBookingDate).toLocaleDateString()
              : 'Never'}
          </span>
          <span className="metric-label">Last Booking</span>
        </div>
      </div>

      {showFactors && topFactors.length > 0 && (
        <div className="risk-factors">
          <h5 className="factors-title">Top Risk Factors</h5>
          <div className="factors-list">
            {topFactors.map((factor, index) => (
              <div key={index} className="factor-item">
                <div className="factor-info">
                  <span className="factor-name">{factor.factor.replace(/_/g, ' ')}</span>
                  <span className="factor-description">{factor.description}</span>
                </div>
                <div
                  className="factor-impact"
                  style={{
                    backgroundColor: `${styles.color}20`,
                    color: styles.color,
                  }}
                >
                  {(factor.impact * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showActions && priorityActions.length > 0 && (
        <div className="recommended-actions">
          <h5 className="actions-title">Recommended Actions</h5>
          <div className="actions-list">
            {priorityActions.map((action, index) => (
              <button
                key={index}
                className="action-button"
                onClick={() => onActionClick?.(action.action)}
                style={{ borderColor: styles.color, color: styles.color }}
              >
                <span className="action-priority">P{action.priority}</span>
                <span className="action-name">{action.action.replace(/_/g, ' ')}</span>
                <span className="action-lift">+{action.expectedLift}% lift</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .churn-risk-indicator {
          padding: 16px;
          border-radius: 12px;
        }

        .churn-risk-indicator.compact {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
        }

        .risk-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-weight: 600;
          font-size: 14px;
        }

        .compact-score {
          font-weight: 700;
          font-size: 16px;
        }

        .indicator-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .risk-status {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .risk-info h4 {
          font-size: 18px;
          font-weight: 600;
        }

        .risk-score {
          font-size: 14px;
          opacity: 0.8;
          margin: 4px 0 0;
        }

        .engagement-section {
          text-align: right;
        }

        .engagement-label {
          font-size: 12px;
          font-weight: 500;
          margin-bottom: 4px;
          opacity: 0.7;
        }

        .engagement-bar {
          width: 100px;
          height: 8px;
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
          overflow: hidden;
        }

        .engagement-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s;
        }

        .engagement-value {
          font-size: 12px;
          font-weight: 600;
          margin-top: 4px;
        }

        .indicator-metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 16px;
        }

        .metric {
          text-align: center;
          padding: 8px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 8px;
        }

        .metric-value {
          display: block;
          font-size: 14px;
          font-weight: 600;
        }

        .metric-label {
          display: block;
          font-size: 11px;
          opacity: 0.7;
          margin-top: 2px;
        }

        .risk-factors,
        .recommended-actions {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }

        .factors-title,
        .actions-title {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          opacity: 0.7;
          margin: 0 0 12px;
        }

        .factors-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .factor-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.5);
          border-radius: 8px;
        }

        .factor-name {
          display: block;
          font-weight: 500;
          font-size: 13px;
          text-transform: capitalize;
        }

        .factor-description {
          display: block;
          font-size: 11px;
          opacity: 0.7;
        }

        .factor-impact {
          font-size: 12px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 12px;
        }

        .actions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .action-button {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 12px;
          background: white;
          border: 1px solid;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-button:hover {
          background: rgba(0, 0, 0, 0.02);
        }

        .action-priority {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(0, 0, 0, 0.1);
        }

        .action-name {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          text-align: left;
          text-transform: capitalize;
        }

        .action-lift {
          font-size: 11px;
          font-weight: 600;
          color: #22c55e;
        }
      `}</style>
    </div>
  );
};

export default ChurnRiskIndicator;
