// SmartPricingBadge - AI smart pricing indicator component
import React from 'react';
import { SmartPricing } from '../../services/ai/demandClient';

interface SmartPricingBadgeProps {
  pricing: SmartPricing;
  originalPrice?: number;
  showFactors?: boolean;
  compact?: boolean;
}

export const SmartPricingBadge: React.FC<SmartPricingBadgeProps> = ({
  pricing,
  originalPrice,
  showFactors = false,
  compact = false,
}) => {
  const getSavingsPercentage = () => {
    if (!originalPrice) return 0;
    return Math.round(((originalPrice - pricing.suggestedPrice) / originalPrice) * 100);
  };

  const savings = originalPrice ? originalPrice - pricing.suggestedPrice : 0;
  const savingsPercent = getSavingsPercentage();

  const getDemandIndicator = () => {
    if (pricing.demandMultiplier > 1.2) return { label: 'High Demand', color: '#dc2626' };
    if (pricing.demandMultiplier > 1.05) return { label: 'Moderate', color: '#f59e0b' };
    if (pricing.demandMultiplier < 0.95) return { label: 'Low Demand', color: '#22c55e' };
    return { label: 'Normal', color: '#6b7280' };
  };

  const demand = getDemandIndicator();

  if (compact) {
    return (
      <div className="smart-pricing-badge compact">
        <div className="price-section">
          <span className="current-price">AED {pricing.suggestedPrice.toFixed(0)}</span>
          {originalPrice && originalPrice !== pricing.suggestedPrice && (
            <span className="original-price">AED {originalPrice.toFixed(0)}</span>
          )}
        </div>
        {savingsPercent > 0 && (
          <span className="savings-badge">Save {savingsPercent}%</span>
        )}
      </div>
    );
  }

  return (
    <div className="smart-pricing-badge">
      <div className="badge-header">
        <div className="badge-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <span>AI Price</span>
        </div>
        <div
          className="demand-indicator"
          style={{ backgroundColor: `${demand.color}20`, color: demand.color }}
        >
          {demand.label}
        </div>
      </div>

      <div className="price-display">
        <div className="price-main">
          <span className="currency">AED</span>
          <span className="amount">{pricing.suggestedPrice.toFixed(0)}</span>
        </div>
        {originalPrice && originalPrice !== pricing.suggestedPrice && (
          <div className="price-comparison">
            <span className="original-price">Was AED {originalPrice.toFixed(0)}</span>
            <span className="savings">Save AED {savings.toFixed(0)} ({savingsPercent}%)</span>
          </div>
        )}
      </div>

      {showFactors && pricing.factors.length > 0 && (
        <div className="pricing-factors">
          <h5>Price Factors</h5>
          <div className="factors-list">
            {pricing.factors.map((factor, index) => (
              <div key={index} className="factor-row">
                <div className="factor-info">
                  <span className="factor-icon">
                    {factor.type === 'demand' && 'M'}
                    {factor.type === 'seasonal' && 'S'}
                    {factor.type === 'competition' && 'C'}
                    {factor.type === 'urgency' && 'U'}
                    {factor.type === 'quality' && 'Q'}
                  </span>
                  <span className="factor-name">{factor.name}</span>
                </div>
                <div className={`factor-value ${factor.impact}`}>
                  {factor.impact === 'increase' && '+'}
                  {factor.impact === 'decrease' && '-'}
                  {Math.abs((factor.multiplier - 1) * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="price-range">
        <span className="range-label">Typical range:</span>
        <div className="range-bar">
          <div
            className="range-marker"
            style={{
              left: `${((pricing.priceRange.min / pricing.priceRange.max) * 100).toFixed(0)}%`,
              width: `${((pricing.suggestedPrice / pricing.priceRange.max) * 100).toFixed(0)}%`,
            }}
          />
        </div>
        <div className="range-values">
          <span>AED {pricing.priceRange.min.toFixed(0)}</span>
          <span>AED {pricing.priceRange.max.toFixed(0)}</span>
        </div>
      </div>

      <div className="confidence-indicator">
        <span className="confidence-label">AI Confidence</span>
        <div className="confidence-bar">
          <div
            className="confidence-fill"
            style={{ width: `${(pricing.confidence * 100).toFixed(0)}%` }}
          />
        </div>
        <span className="confidence-value">{(pricing.confidence * 100).toFixed(0)}%</span>
      </div>

      <div className="badge-footer">
        <span className="validity">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Valid for 15 minutes
        </span>
      </div>

      <style>{`
        .smart-pricing-badge {
          background: white;
          border-radius: 12px;
          padding: 16px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          max-width: 300px;
        }

        .smart-pricing-badge.compact {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
        }

        .badge-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .badge-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #667eea;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .demand-indicator {
          font-size: 10px;
          font-weight: 600;
          padding: 4px 8px;
          border-radius: 12px;
        }

        .price-display {
          text-align: center;
          margin-bottom: 16px;
        }

        .price-main {
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 4px;
        }

        .currency {
          font-size: 16px;
          font-weight: 500;
          color: #374151;
        }

        .amount {
          font-size: 32px;
          font-weight: 700;
          color: #111827;
        }

        .price-comparison {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 8px;
        }

        .original-price {
          font-size: 14px;
          color: #9ca3af;
          text-decoration: line-through;
        }

        .savings {
          font-size: 14px;
          font-weight: 600;
          color: #22c55e;
        }

        .pricing-factors {
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #f3f4f6;
        }

        .pricing-factors h5 {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #6b7280;
          margin: 0 0 8px;
        }

        .factors-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .factor-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
        }

        .factor-info {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .factor-icon {
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f3f4f6;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          color: #6b7280;
        }

        .factor-name {
          color: #374151;
        }

        .factor-value {
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .factor-value.increase {
          color: #dc2626;
          background: #fef2f2;
        }

        .factor-value.decrease {
          color: #22c55e;
          background: #f0fdf4;
        }

        .factor-value.neutral {
          color: #6b7280;
          background: #f3f4f6;
        }

        .price-range {
          margin-bottom: 16px;
        }

        .range-label {
          font-size: 11px;
          color: #6b7280;
        }

        .range-bar {
          height: 6px;
          background: #e5e7eb;
          border-radius: 3px;
          margin: 8px 0 4px;
          position: relative;
        }

        .range-marker {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: linear-gradient(90deg, #22c55e, #84cc16);
          border-radius: 3px;
        }

        .range-values {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #9ca3af;
        }

        .confidence-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
        }

        .confidence-label {
          font-size: 11px;
          color: #6b7280;
        }

        .confidence-bar {
          flex: 1;
          height: 4px;
          background: #e5e7eb;
          border-radius: 2px;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          background: linear-gradient(90deg, #667eea, #764ba2);
          border-radius: 2px;
        }

        .confidence-value {
          font-size: 11px;
          font-weight: 600;
          color: #667eea;
        }

        .badge-footer {
          text-align: center;
        }

        .validity {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: #9ca3af;
        }

        .smart-pricing-badge.compact .price-section {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .smart-pricing-badge.compact .current-price {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }

        .smart-pricing-badge.compact .original-price {
          font-size: 12px;
          color: #9ca3af;
          text-decoration: line-through;
        }

        .smart-pricing-badge.compact .savings-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 4px 8px;
          background: #f0fdf4;
          color: #22c55e;
          border-radius: 12px;
        }
      `}</style>
    </div>
  );
};

export default SmartPricingBadge;
