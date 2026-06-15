import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Play } from 'lucide-react';
import { useTrendingFeed } from '../../hooks/useTrendingFeed';
import { useHorizontalCarousel } from '../../hooks/useHorizontalCarousel';
import TrendingFeedCard from './TrendingFeedCard';
import type { TrendingFeedItem } from '../../types/trendingFeed';
import { homeTrendingApi } from '../../services/homeTrendingApi';
import analytics from '../../services/product/AnalyticsService';
import { cn } from '@/lib/utils';

interface TrendingNowSectionProps {
  limit?: number;
  showViewAll?: boolean;
}

const SkeletonCard: React.FC = () => (
  <div
    data-carousel-card
    className="flex-shrink-0 w-[400px] md:w-[420px] h-[530px] rounded-3xl bg-nilin-blush/40 animate-pulse"
  />
);

export const TrendingNowSection: React.FC<TrendingNowSectionProps> = ({
  limit = 12,
  showViewAll = true,
}) => {
  const navigate = useNavigate();
  const { items, isLoading, error, refresh } = useTrendingFeed({ limit });
  const { scrollRef, scroll, pause, resume } = useHorizontalCarousel({ gap: 24 });

  const [isVisible, setIsVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [scrollStartX, setScrollStartX] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number>(-1);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setDragStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollStartX(scrollRef.current.scrollLeft);
    scrollRef.current.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - dragStartX) * 1.5;
    scrollRef.current.scrollLeft = scrollStartX - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (scrollRef.current) {
      scrollRef.current.style.cursor = 'grab';
    }
  };

  const handleCardClick = useCallback(
    async (item: TrendingFeedItem) => {
      if (isDragging) return; // Prevent click after drag
      if (item.type === 'curated') {
        homeTrendingApi.trackClick(item.id).catch(() => undefined);
      }
      if (item.link.startsWith('http')) {
        window.open(item.link, '_blank', 'noopener,noreferrer');
        return;
      }
      navigate(item.link);
    },
    [navigate, isDragging]
  );

  const handleNav = (direction: 'left' | 'right') => {
    analytics.track('trending_carousel_nav', { direction });
    scroll(direction);
  };

  if (!isLoading && !error && items.length === 0) {
    return null;
  }

  return (
    <section className="py-16 px-1 md:px-2 bg-gradient-to-b from-white to-nilin-cream/30 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-20 left-10 w-80 h-80 rounded-full bg-nilin-coral/5 blur-3xl" />
      <div className="absolute bottom-20 right-10 w-64 h-64 rounded-full bg-nilin-rose/5 blur-3xl" />

      <div className="max-w-[1500px] mx-auto relative">
        {/* Header - Like Curated Experiences */}
        <div className={cn(
          'mb-12 transition-all duration-700',
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        )}>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-nilin-coral/10 rounded-full mb-5">
                <Sparkles className="w-4 h-4 text-nilin-coral" />
                <span className="text-xs font-semibold text-nilin-coral uppercase tracking-wider">@NILIN.trending</span>
              </div>

              {/* Large Title */}
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-nilin-charcoal mb-3 leading-tight">
                Trending Now
              </h2>
              <p className="text-lg text-nilin-warmGray">
                Real results, real transformations
              </p>
            </div>

            {/* View All Button */}
            {showViewAll && (
              <button
                type="button"
                onClick={() => navigate('/trending')}
                className="group self-start lg:self-auto inline-flex items-center gap-2 px-8 py-4 rounded-full bg-nilin-charcoal text-white font-medium hover:bg-nilin-coral hover:shadow-lg hover:shadow-nilin-coral/30 hover:-translate-y-0.5 transition-all duration-300"
              >
                <span>View All</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-8 p-6 rounded-3xl bg-red-50/80 backdrop-blur-sm border border-red-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
              <p className="text-sm">Unable to load trending content.</p>
            </div>
            <button
              type="button"
              onClick={() => refresh()}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-red-700 text-sm font-medium border border-red-200 hover:bg-red-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {/* Carousel - Draggable with Hover Effects */}
        <div
          ref={scrollRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Trending now carousel"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { handleMouseUp(); resume(); }}
          onTouchStart={() => pause()}
          onTouchEnd={() => resume()}
          onMouseEnter={() => pause()}
          className={cn(
            'flex gap-4 overflow-x-auto py-8 scrollbar-hide select-none',
            'cursor-grab active:cursor-grabbing'
          )}
          style={{ scrollbarWidth: 'none' }}
        >
          {/* Drag Indicator */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none opacity-50">
            <div className="flex flex-col gap-1">
              <div className="w-1 h-1 rounded-full bg-nilin-charcoal/30" />
              <div className="w-1 h-1 rounded-full bg-nilin-charcoal/30" />
              <div className="w-1 h-1 rounded-full bg-nilin-charcoal/30" />
            </div>
          </div>

          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : items.map((item, index) => (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(-1)}
                  className="relative"
                  style={{
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'scale(1)' : 'scale(0.95)',
                    transition: `opacity 0.6s ease ${index * 80}ms, transform 0.6s ease ${index * 80}ms`,
                  }}
                >
                  <TrendingFeedCard
                    item={item}
                    onClick={handleCardClick}
                    isHovered={hoveredIndex === index}
                  />

                  {/* Hover Play Indicator for Video Content */}
                  {hoveredIndex === index && item.videoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div className="w-16 h-16 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </div>
                  )}
                </div>
              ))}
        </div>

        {/* Navigation Arrows - Below Cards */}
        {items.length > 4 && (
          <div className={cn(
            'flex justify-center gap-4 mt-8 transition-all duration-700 delay-300',
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          )}>
            <button
              type="button"
              onClick={() => handleNav('left')}
              aria-label="Previous trending items"
              className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl hover:-translate-y-1 hover:bg-nilin-blush/50 transition-all duration-300 group"
            >
              <ChevronLeft className="w-6 h-6 text-nilin-charcoal group-hover:text-nilin-coral transition-colors" />
            </button>
            <button
              type="button"
              onClick={() => handleNav('right')}
              aria-label="Next trending items"
              className="w-14 h-14 rounded-full bg-white shadow-lg flex items-center justify-center hover:shadow-xl hover:-translate-y-1 hover:bg-nilin-blush/50 transition-all duration-300 group"
            >
              <ChevronRight className="w-6 h-6 text-nilin-charcoal group-hover:text-nilin-coral transition-colors" />
            </button>
          </div>
        )}

        {/* Drag Hint Text */}
        <div className={cn(
          'text-center mt-6 transition-all duration-700 delay-500',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}>
          <p className="text-xs text-nilin-warmGray/60 flex items-center justify-center gap-2">
            <span className="w-4 h-4 rounded-full border border-nilin-warmGray/30 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-nilin-warmGray/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </span>
            Drag to explore more
          </p>
        </div>
      </div>
    </section>
  );
};

const CuratedReels = TrendingNowSection;

export default CuratedReels;