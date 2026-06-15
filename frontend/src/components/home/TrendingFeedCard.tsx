import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Star, TrendingUp, Sparkles, Play } from 'lucide-react';
import type { TrendingFeedItem } from '../../types/trendingFeed';
import { CATEGORY_IMAGES } from '../../constants/images';
import analytics from '../../services/product/AnalyticsService';
import { cn } from '@/lib/utils';

interface TrendingFeedCardProps {
  item: TrendingFeedItem;
  onClick: (item: TrendingFeedItem) => void;
  isHovered?: boolean;
}

function optimizeImageUrl(url: string): string {
  if (!url) return url;
  if (url.includes('cloudinary.com') && url.includes('/upload/') && !url.includes('/upload/w_')) {
    return url.replace('/upload/', '/upload/w_640,q_80,f_auto/');
  }
  if (url.includes('images.unsplash.com')) {
    return url.includes('w=') ? url : `${url}${url.includes('?') ? '&' : '?'}w=640&q=80`;
  }
  return url;
}

function getFallbackImage(category: string): string {
  const slug = category.toLowerCase().replace(/\s+&\s+/g, '-').replace(/\s+/g, '-');
  return CATEGORY_IMAGES[slug]?.card || CATEGORY_IMAGES.hair.card;
}

function getTypeBadge(item: TrendingFeedItem): string {
  if (item.badge) return item.badge;
  switch (item.type) {
    case 'curated':
      return 'Featured';
    case 'experience':
      return 'Real Result';
    case 'service':
      return item.category;
    default:
      return item.category;
  }
}

const TrendingFeedCard: React.FC<TrendingFeedCardProps> = ({ item, onClick, isHovered = false }) => {
  const [imageSrc, setImageSrc] = useState(
    optimizeImageUrl(item.imageUrl) || getFallbackImage(item.category)
  );
  const cardRef = useRef<HTMLDivElement>(null);
  const hasTrackedImpression = useRef(false);

  useEffect(() => {
    setImageSrc(optimizeImageUrl(item.imageUrl) || getFallbackImage(item.category));
  }, [item.imageUrl, item.category]);

  useEffect(() => {
    const node = cardRef.current;
    if (!node || hasTrackedImpression.current) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedImpression.current) {
          hasTrackedImpression.current = true;
          analytics.track('trending_card_impression', {
            card_type: item.type,
            source_id: item.id,
          });
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [item.id, item.type]);

  const handleClick = () => {
    analytics.track('trending_card_click', {
      card_type: item.type,
      source_id: item.id,
      link: item.link,
    });
    onClick(item);
  };

  const metricIcon =
    item.metric.kind === 'rating' ? (
      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
    ) : item.metric.kind === 'bookings' || item.metric.kind === 'trend' ? (
      <TrendingUp className="w-4 h-4 text-nilin-coral" />
    ) : (
      <Sparkles className="w-4 h-4 text-nilin-coral" />
    );

  // Fixed dimensions - no intermediate size
  const baseWidth = 400;
  const baseHeight = 530;
  const hoverWidth = 430;
  const hoverHeight = 570;

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      className={cn(
        'relative flex-shrink-0 cursor-pointer transition-all duration-500 ease-out',
        isHovered ? 'z-30' : 'z-20'
      )}
      style={{
        width: isHovered ? `${hoverWidth}px` : `${baseWidth}px`,
        height: isHovered ? `${hoverHeight}px` : `${baseHeight}px`,
      }}
      aria-label={`${item.title} - ${item.category}`}
    >
      {/* 3D Card with smooth corners */}
      <div
        className={cn(
          'relative w-full h-full transition-all duration-500 ease-out',
          isHovered
            ? 'rounded-3xl shadow-2xl shadow-nilin-charcoal/30'
            : 'rounded-3xl shadow-xl shadow-nilin-charcoal/15',
          // Apply 3D transform at the same time as size
          isHovered && 'hover:shadow-2xl'
        )}
        style={{
          transform: isHovered
            ? 'perspective(1000px) rotateY(-4deg) rotateX(3deg) scale(1.02)'
            : 'perspective(1000px) rotateY(0deg) rotateX(0deg) scale(1)',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Image */}
        <img
          src={imageSrc}
          alt={`${item.title} - ${item.category}`}
          width={hoverWidth}
          height={hoverHeight}
          loading="lazy"
          className={cn(
            'w-full h-full object-cover transition-transform duration-700 ease-out rounded-3xl',
            'group-hover:scale-110',
            isHovered && 'scale-105'
          )}
          onError={() => setImageSrc(getFallbackImage(item.category))}
        />

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent rounded-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl" />

        {/* Badge - Top Left */}
        <div className="absolute top-6 left-6">
          <span className={cn(
            'rounded-full px-5 py-3 text-sm font-semibold backdrop-blur-md transition-all duration-300',
            'bg-white/95 text-nilin-charcoal shadow-lg'
          )}>
            {getTypeBadge(item)}
          </span>
        </div>

        {/* Metric Badge - Top Right */}
        <div className="absolute top-6 right-6">
          <span className={cn(
            'rounded-full px-4 py-3 flex items-center gap-2 backdrop-blur-md transition-all duration-300',
            'bg-white/95 text-nilin-charcoal shadow-lg'
          )}>
            {metricIcon}
            <span className="text-sm font-bold">{item.metric.value}</span>
          </span>
        </div>

        {/* Video Play Indicator */}
        {item.videoUrl && (
          <div className={cn(
            'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-300',
            'opacity-0 group-hover:opacity-100',
            isHovered && 'opacity-100'
          )}>
            <div className="w-24 h-24 rounded-full bg-white/40 backdrop-blur-md flex items-center justify-center shadow-2xl">
              <Play className="w-12 h-12 text-white fill-white ml-2" />
            </div>
          </div>
        )}

        {/* Content - Bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          {/* Title */}
          <h3 className="text-2xl font-bold text-white mb-2 leading-tight">
            {item.title}
          </h3>

          {/* Subtitle */}
          <p className="text-base text-white/80 mb-6 line-clamp-2">
            {item.subtitle}
          </p>

          {/* Explore CTA - Bottom Right */}
          <div className={cn(
            'flex items-center justify-end gap-2 text-white transition-all duration-500 ease-out',
            'translate-x-8 opacity-0 group-hover:translate-x-0 group-hover:opacity-100',
            isHovered && 'translate-x-0 opacity-100'
          )}>
            <span className="text-sm font-semibold">Explore</span>
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-2" />
          </div>
        </div>

        {/* Glow Effect on Hover */}
        {isHovered && (
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-t from-nilin-coral/15 via-transparent to-transparent pointer-events-none" />
        )}

        {/* 3D Border Effect */}
        {isHovered && (
          <div className="absolute inset-0 rounded-3xl border-2 border-nilin-coral/50 pointer-events-none" />
        )}
      </div>
    </div>
  );
};

export default TrendingFeedCard;