// RecommendationCarousel - AI-powered service recommendation carousel
import React, { useMemo } from 'react';
import { useRecommendations, ServiceRecommendation } from '../../hooks/useRecommendations';

interface RecommendationCarouselProps {
  type?: 'service' | 'provider';
  title?: string;
  subtitle?: string;
  limit?: number;
  autoFetch?: boolean;
  showReason?: boolean;
  onItemClick?: (item: ServiceRecommendation) => void;
  renderItem?: (item: ServiceRecommendation) => React.ReactNode;
}

export const RecommendationCarousel: React.FC<RecommendationCarouselProps> = ({
  type = 'service',
  title = 'Recommended for You',
  subtitle,
  limit = 10,
  autoFetch = true,
  showReason = true,
  onItemClick,
  renderItem,
}) => {
  const {
    recommendations,
    trendingRecommendations,
    isLoading,
    error,
  } = useRecommendations({
    limit,
    autoFetch,
  });

  // Get items based on type
  const items = useMemo(() => {
    if (type === 'provider') {
      return [];
    }
    return recommendations.slice(0, limit);
  }, [recommendations, type, limit]);

  // Get section-specific items
  const sectionItems = useMemo(() => {
    if (title.toLowerCase().includes('trending') || title.toLowerCase().includes('popular')) {
      return trendingRecommendations.slice(0, limit);
    }
    return items;
  }, [title, items, trendingRecommendations, limit]);

  if (isLoading) {
    return (
      <div className="recommendation-carousel">
        <div className="carousel-skeleton">
          <div className="skeleton-header">
            <div className="skeleton-title"></div>
            <div className="skeleton-subtitle"></div>
          </div>
          <div className="skeleton-items">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="skeleton-card"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || sectionItems.length === 0) {
    return null;
  }

  const handleItemClick = (item: ServiceRecommendation) => {
    onItemClick?.(item);
  };

  const getReasonBadge = (reasons: string[]) => {
    const badges: Record<string, { label: string; color: string }> = {
      personalized: { label: 'For You', color: '#3b82f6' },
      popular: { label: 'Popular', color: '#10b981' },
      trending: { label: 'Trending', color: '#f59e0b' },
      nearby: { label: 'Nearby', color: '#8b5cf6' },
      highly_rated: { label: 'Top Rated', color: '#ec4899' },
      reliable: { label: 'Reliable', color: '#06b6d4' },
      similar: { label: 'Similar', color: '#6366f1' },
      complementary: { label: 'Often Booked Together', color: '#14b8a6' },
      frequently_booked: { label: 'Also Booked', color: '#84cc16' },
    };

    const primaryReason = reasons[0] || 'personalized';
    const badge = badges[primaryReason] || { label: primaryReason, color: '#6b7280' };
    return (
      <span
        className="reason-badge"
        style={{ backgroundColor: `${badge.color}20`, color: badge.color }}
      >
        {badge.label}
      </span>
    );
  };

  const defaultRenderItem = (item: ServiceRecommendation) => (
    <div className="recommendation-card" onClick={() => handleItemClick(item)}>
      {item.service.images && item.service.images[0] && (
        <div className="card-image">
          <img src={item.service.images[0]} alt={item.service.name} />
        </div>
      )}
      <div className="card-content">
        {showReason && (
          <div className="card-reason">{getReasonBadge(item.reasons)}</div>
        )}
        <h4 className="card-title">{item.service.name}</h4>
        <div className="card-meta">
          {item.service.rating && (
            <span className="card-rating">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {item.service.rating.average.toFixed(1)}
            </span>
          )}
          {item.service.price && (
            <span className="card-price">
              AED {item.service.price.amount.toFixed(0)}
            </span>
          )}
        </div>
        <p className="card-explanation">{item.reasons.join(', ')}</p>
      </div>
    </div>
  );

  return (
    <div className="recommendation-carousel">
      <div className="carousel-header">
        <div className="carousel-title-section">
          <h3 className="carousel-title">{title}</h3>
          {subtitle && <p className="carousel-subtitle">{subtitle}</p>}
        </div>
        <span className="ai-badge">AI</span>
      </div>
      <div className="carousel-items">
        {sectionItems.slice(0, limit).map((item) => (
          renderItem ? renderItem(item) : defaultRenderItem(item)
        ))}
      </div>
      <style>{`
        .recommendation-carousel {
          padding: 16px 0;
        }

        .carousel-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          padding: 0 16px;
        }

        .carousel-title {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .carousel-subtitle {
          font-size: 14px;
          color: #6b7280;
          margin: 4px 0 0;
        }

        .ai-badge {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          font-size: 10px;
          font-weight: 700;
          padding: 4px 8px;
          border-radius: 12px;
          letter-spacing: 0.5px;
        }

        .carousel-items {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding: 0 16px;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
        }

        .carousel-items::-webkit-scrollbar {
          display: none;
        }

        .recommendation-card {
          flex: 0 0 200px;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          scroll-snap-align: start;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .recommendation-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .card-image {
          height: 120px;
          background: #f3f4f6;
        }

        .card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .card-content {
          padding: 12px;
        }

        .card-reason {
          margin-bottom: 6px;
        }

        .reason-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 10px;
        }

        .card-title {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 8px;
          line-height: 1.3;
        }

        .card-meta {
          display: flex;
          gap: 8px;
          font-size: 12px;
          color: #6b7280;
        }

        .card-rating {
          display: flex;
          align-items: center;
          gap: 2px;
          color: #f59e0b;
        }

        .card-price {
          font-weight: 600;
          color: #059669;
        }

        .card-distance {
          color: #9ca3af;
        }

        .card-explanation {
          font-size: 12px;
          color: #6b7280;
          margin: 8px 0 0;
          line-height: 1.4;
        }

        .skeleton-header {
          padding: 0 16px;
          margin-bottom: 12px;
        }

        .skeleton-title {
          width: 150px;
          height: 24px;
          background: #e5e7eb;
          border-radius: 4px;
          animation: pulse 1.5s infinite;
        }

        .skeleton-subtitle {
          width: 100px;
          height: 16px;
          background: #f3f4f6;
          border-radius: 4px;
          margin-top: 8px;
          animation: pulse 1.5s infinite;
        }

        .skeleton-items {
          display: flex;
          gap: 12px;
          padding: 0 16px;
        }

        .skeleton-card {
          flex: 0 0 200px;
          height: 220px;
          background: #f3f4f6;
          border-radius: 12px;
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

export default RecommendationCarousel;
