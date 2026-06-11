import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Star, TrendingUp, Sparkles } from 'lucide-react';
import type { TrendingFeedItem } from '../../types/trendingFeed';
import { CATEGORY_IMAGES } from '../../constants/images';
import analytics from '../../services/product/AnalyticsService';

interface TrendingFeedCardProps {
  item: TrendingFeedItem;
  onClick: (item: TrendingFeedItem) => void;
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

const TrendingFeedCard: React.FC<TrendingFeedCardProps> = ({ item, onClick }) => {
  const [imageSrc, setImageSrc] = useState(
    optimizeImageUrl(item.imageUrl) || getFallbackImage(item.category)
  );
  const cardRef = useRef<HTMLButtonElement>(null);
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
      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
    ) : item.metric.kind === 'bookings' || item.metric.kind === 'trend' ? (
      <TrendingUp className="w-3.5 h-3.5 text-nilin-coral" />
    ) : (
      <Sparkles className="w-3.5 h-3.5 text-nilin-coral" />
    );

  return (
    <button
      ref={cardRef}
      type="button"
      data-carousel-card
      onClick={handleClick}
      className="flex-shrink-0 group text-left"
      aria-label={`${item.title} - ${item.category}`}
    >
      <div className="relative w-[280px] md:w-[320px] aspect-[4/5] rounded-3xl overflow-hidden shadow-xl card-3d">
        <img
          src={imageSrc}
          alt={`${item.title} - ${item.category}`}
          width={320}
          height={400}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 motion-reduce:transition-none group-hover:scale-110 motion-reduce:group-hover:scale-100"
          onError={() => setImageSrc(getFallbackImage(item.category))}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        <div className="absolute top-4 left-4">
          <span className="glass rounded-full px-4 py-2 text-sm font-medium text-nilin-charcoal backdrop-blur-md">
            {getTypeBadge(item)}
          </span>
        </div>

        <div className="absolute top-4 right-4">
          <span className="glass rounded-full px-3 py-2 flex items-center gap-1.5 backdrop-blur-md">
            {metricIcon}
            <span className="text-sm font-semibold text-nilin-charcoal">{item.metric.value}</span>
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="text-xl font-medium text-white mb-1">{item.title}</h3>
          <p className="text-sm text-white/80 mb-4 line-clamp-2">{item.subtitle}</p>

          <div className="flex items-center gap-2 text-white/0 group-hover:text-white transition-all duration-300">
            <span className="text-sm font-medium">Explore</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
          </div>
        </div>
      </div>
    </button>
  );
};

export default TrendingFeedCard;
