import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, ChevronLeft, ChevronRight, AlertCircle, RefreshCw } from 'lucide-react';
import { useTrendingFeed } from '../../hooks/useTrendingFeed';
import { useHorizontalCarousel } from '../../hooks/useHorizontalCarousel';
import TrendingFeedCard from './TrendingFeedCard';
import type { TrendingFeedItem } from '../../types/trendingFeed';
import { homeTrendingApi } from '../../services/homeTrendingApi';
import analytics from '../../services/product/AnalyticsService';

interface TrendingNowSectionProps {
  limit?: number;
  showViewAll?: boolean;
}

const SkeletonCard: React.FC = () => (
  <div
    data-carousel-card
    className="flex-shrink-0 w-[280px] md:w-[320px] aspect-[4/5] rounded-3xl bg-nilin-blush/40 animate-pulse"
  />
);

export const TrendingNowSection: React.FC<TrendingNowSectionProps> = ({
  limit = 8,
  showViewAll = true,
}) => {
  const navigate = useNavigate();
  const { items, isLoading, error, refresh } = useTrendingFeed({ limit });
  const { scrollRef, scroll, pause, resume } = useHorizontalCarousel({ gap: 20 });

  const handleCardClick = useCallback(
    async (item: TrendingFeedItem) => {
      if (item.type === 'curated') {
        homeTrendingApi.trackClick(item.id).catch(() => undefined);
      }
      if (item.link.startsWith('http')) {
        window.open(item.link, '_blank', 'noopener,noreferrer');
        return;
      }
      navigate(item.link);
    },
    [navigate]
  );

  const handleNav = (direction: 'left' | 'right') => {
    analytics.track('trending_carousel_nav', { direction });
    scroll(direction);
  };

  if (!isLoading && !error && items.length === 0) {
    return null;
  }

  return (
    <section className="py-16 px-4 bg-white relative overflow-hidden">
      <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-nilin-coral/10 blur-3xl" />
      <div className="absolute bottom-10 right-10 w-56 h-56 rounded-full bg-nilin-rose/10 blur-3xl" />

      <div className="max-w-7xl mx-auto relative">
        <div className="flex items-end justify-between mb-10">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full mb-4">
              <Sparkles className="w-4 h-4 text-nilin-coral" />
              <span className="text-sm text-nilin-charcoal">@NILIN.trending</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-serif text-nilin-charcoal mb-2">Trending Now</h2>
            <p className="text-nilin-warmGray">Real results, real transformations</p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleNav('left')}
              aria-label="Previous trending items"
              className="glass w-12 h-12 rounded-full flex items-center justify-center hover:shadow-lg transition-all"
            >
              <ChevronLeft className="w-5 h-5 text-nilin-charcoal" />
            </button>
            <button
              type="button"
              onClick={() => handleNav('right')}
              aria-label="Next trending items"
              className="glass w-12 h-12 rounded-full flex items-center justify-center hover:shadow-lg transition-all"
            >
              <ChevronRight className="w-5 h-5 text-nilin-charcoal" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">Unable to load trending content. Please try again.</p>
            </div>
            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-red-700 text-sm font-medium border border-red-200 hover:bg-red-50"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        <div
          ref={scrollRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Trending now carousel"
          className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide"
          style={{ scrollbarWidth: 'none' }}
          onMouseEnter={pause}
          onMouseLeave={resume}
          onFocus={pause}
          onBlur={resume}
          onTouchStart={pause}
          onTouchEnd={resume}
        >
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : items.map((item) => (
                <TrendingFeedCard key={item.id} item={item} onClick={handleCardClick} />
              ))}
        </div>

        {showViewAll && (
          <div className="text-center mt-8">
            <button
              type="button"
              onClick={() => navigate('/trending')}
              className="btn-3d inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-nilin-rose to-nilin-coral text-white"
            >
              View All
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

const CuratedReels = TrendingNowSection;

export default CuratedReels;
