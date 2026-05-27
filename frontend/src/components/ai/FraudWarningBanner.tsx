// FraudWarningBanner - AI fraud detection warning component
import React from 'react';
import { FraudRisk } from '../../services/ai/fraudClient';

interface FraudWarningBannerProps {
  risk: FraudRisk;
  onDismiss?: () => void;
  onAction?: (action: 'allow' | 'review' | 'block') => void;
}

export const FraudWarningBanner: React.FC<FraudWarningBannerProps> = ({
  risk,
  onDismiss,
  onAction,
}) => {
  const getSeverityStyles = (severity: 'low' | 'medium' | 'high' | 'critical') => {
    switch (severity) {
      case 'critical':
        return {
          bg: '#fef2f2',
          border: '#dc2626',
          icon: '#dc2626',
          text: '#991b1b',
        };
      case 'high':
        return {
          bg: '#fff7ed',
          border: '#ea580c',
          icon: '#ea580c',
          text: '#9a3412',
        };
      case 'medium':
        return {
          bg: '#fefce8',
          border: '#ca8a04',
          icon: '#ca8a04',
          text: '#854d0e',
        };
      default:
        return {
          bg: '#f0fdf4',
          border: '#16a34a',
          icon: '#16a34a',
          text: '#166534',
        };
    }
  };

  const getActionStyles = (action: 'allow' | 'review' | 'block') => {
    switch (action) {
      case 'block':
        return { label: 'Block', color: '#dc2626' };
      case 'review':
        return { label: 'Review Required', color: '#f59e0b' };
      default:
        return { label: 'Allow', color: '#22c55e' };
    }
  };

  const styles = getSeverityStyles(risk.metadata.riskLevel);
  const action = getActionStyles(risk.action);

  const highSeveritySignals = risk.signals.filter((s) => s.severity === 'high');
  const mediumSeveritySignals = risk.signals.filter((s) => s.severity === 'medium');

  return (
    <div
      className="fraud-warning-banner"
      style={{
        backgroundColor: styles.bg,
        borderLeft: `4px solid ${styles.border}`,
      }}
    >
      <div className="banner-header">
        <div className="banner-icon" style={{ color: styles.icon }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div className="banner-content">
          <h4 className="banner-title" style={{ color: styles.text }}>
            Fraud Risk Detected
          </h4>
          <p className="banner-subtitle" style={{ color: styles.text }}>
            Risk Score: {(risk.score * 100).toFixed(0)}% - {action.label}
          </p>
        </div>
        <div className="banner-score">
          <div
            className="score-circle"
            style={{
              borderColor: styles.border,
              color: styles.text,
            }}
          >
            <span className="score-value">{Math.round(risk.score * 100)}</span>
            <span className="score-label">Risk</span>
          </div>
        </div>
      </div>

      {risk.signals.length > 0 && (
        <div className="banner-signals">
          <h5 className="signals-title">Risk Signals:</h5>
          <div className="signals-list">
            {risk.signals.slice(0, 3).map((signal, index) => (
              <div key={index} className="signal-item">
                <span
                  className="signal-dot"
                  style={{
                    backgroundColor:
                      signal.severity === 'high' ? '#dc2626' :
                      signal.severity === 'medium' ? '#f59e0b' : '#6b7280',
                  }}
                />
                <span className="signal-text">{signal.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="banner-actions">
        <button
          className="action-button secondary"
          onClick={onDismiss}
          style={{ color: styles.text }}
        >
          Dismiss
        </button>
        {risk.action !== 'allow' && (
          <button
            className="action-button primary"
            onClick={() => onAction?.(risk.action)}
            style={{ backgroundColor: action.color }}
          >
            {risk.action === 'block' ? 'Block Transaction' : 'Review Details'}
          </button>
        )}
      </div>

      <style>{`
        .fraud-warning-banner {
          padding: 16px;
          border-radius: 8px;
          margin: 16px 0;
        }

        .banner-header {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .banner-icon {
          flex-shrink: 0;
        }

        .banner-content {
          flex: 1;
        }

        .banner-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0;
        }

        .banner-subtitle {
          font-size: 14px;
          margin: 4px 0 0;
          opacity: 0.8;
        }

        .banner-score {
          flex-shrink: 0;
        }

        .score-circle {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 3px solid;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .score-value {
          font-size: 18px;
          font-weight: 700;
        }

        .score-label {
          font-size: 10px;
          text-transform: uppercase;
        }

        .banner-signals {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
        }

        .signals-title {
          font-size: 12px;
          font-weight: 600;
          margin: 0 0 8px;
          opacity: 0.7;
        }

        .signals-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .signal-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
        }

        .signal-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .signal-text {
          opacity: 0.9;
        }

        .banner-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
          justify-content: flex-end;
        }

        .action-button {
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: opacity 0.2s;
        }

        .action-button:hover {
          opacity: 0.9;
        }

        .action-button.secondary {
          background: transparent;
          border: 1px solid currentColor;
        }

        .action-button.primary {
          color: white;
        }
      `}</style>
    </div>
  );
};

export default FraudWarningBanner;
