import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, TrendingUp } from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';
import { searchApi } from '@/services/searchApi';
import { cn } from '@/lib/utils';

interface TrendingSearchesProps {
  className?: string;
  title?: string;
  subtitle?: string;
  limit?: number;
  showViewAll?: boolean;
  variant?: 'default' | 'hero' | 'minimal' | 'modern';
  onSearch?: (query: string) => void;
}

const DEFAULT_TRENDING_SEARCHES = [
  { term: 'Bridal Makeup', emoji: '💄' },
  { term: 'Swedish Massage', emoji: '💆' },
  { term: 'Gel Nails', emoji: '💅' },
  { term: 'Hair Coloring', emoji: '🎨' },
  { term: 'Deep Tissue Massage', emoji: '🧘' },
  { term: 'Facial Treatment', emoji: '✨' },
  { term: 'Haircut & Styling', emoji: '✂️' },
  { term: 'Manicure & Pedicure', emoji: '💅' },
];

const TrendingSearches: React.FC<TrendingSearchesProps> = ({
  className,
  title = 'Trending searches',
  limit = 8,
  showViewAll = false,
  variant = 'modern',
  onSearch,
}) => {
  const navigate = useNavigate();
  const { addToSearchHistory, setFilters } = useSearchStore();
  const [isVisible, setIsVisible] = useState(false);
  const [trendingItems, setTrendingItems] = useState(DEFAULT_TRENDING_SEARCHES);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    searchApi.getTrendingServices('7d', limit, abortController.signal)
      .then((res) => {
        if (res.success && res.data.services?.length) {
          setTrendingItems(
            res.data.services.slice(0, limit).map((service) => ({
              term: service.name,
              emoji: '✨',
            }))
          );
        }
      })
      .catch(() => {
        // Keep default fallback on error
      });

    return () => abortController.abort();
  }, [limit]);

  const handleSearchClick = (term: string) => {
    if (onSearch) {
      onSearch(term);
    } else {
      addToSearchHistory(term);
      setFilters({ q: term, page: 1 });
      navigate(`/search?q=${encodeURIComponent(term)}`);
    }
  };

  return (
    <section className={cn('py-12 sm:py-16 md:py-20 px-0 bg-nilin-cream/50', className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header with glass effect */}
        <div className={cn(
          'mb-10 transition-all duration-700',
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        )}>
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full glass-nilin mb-5">
            <TrendingUp className="w-5 h-5 text-nilin-coral" />
            <span className="text-sm font-semibold text-nilin-charcoal uppercase tracking-wide">Hot right now</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-nilin-charcoal">
            {title}
          </h2>
        </div>

        {/* Trending Pills - Larger glassy layout */}
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {trendingItems.map((item, index) => (
            <button
              key={`trending-${item.term}-${index}`}
              onClick={() => handleSearchClick(item.term)}
              className={cn(
                'group flex items-center gap-2 sm:gap-4 pl-2 pr-4 sm:pr-6 py-2.5 sm:py-3 min-h-11 rounded-2xl',
                'bg-white/80 backdrop-blur-md',
                'border border-white/80',
                'shadow-md hover:shadow-xl',
                'transition-all duration-300 ease-out',
                'hover:-translate-y-1 hover:bg-white/95'
              )}
              style={{
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : `translateY(20px)`,
                transition: `opacity 0.5s ease ${index * 60}ms, transform 0.5s ease ${index * 60}ms, background-color 0.3s, box-shadow 0.3s`,
              }}
            >
              {/* Number Badge - Larger glassy circle */}
              <span className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center text-base font-bold',
                'bg-nilin-coral/20 text-nilin-coral',
                'group-hover:bg-nilin-coral group-hover:text-white',
                'group-hover:scale-110',
                'transition-all duration-300 shadow-sm'
              )}>
                {index + 1}
              </span>

              {/* Emoji */}
              <span className="text-2xl group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                {item.emoji}
              </span>

              {/* Text - Larger */}
              <span className="text-base font-medium text-nilin-charcoal group-hover:text-nilin-coral transition-colors">
                {item.term}
              </span>

              {/* Arrow on hover */}
              <ArrowRight className={cn(
                'w-5 h-5 text-nilin-coral/60',
                'opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0',
                'transition-all duration-300'
              )} />
            </button>
          ))}
        </div>

        {/* View All Button */}
        {showViewAll && (
          <div className={cn(
            'mt-12 transition-all duration-700 delay-300',
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          )}>
            <button
              onClick={() => navigate('/search?view=trending')}
              className={cn(
                'group flex items-center gap-2 px-8 py-4 rounded-full',
                'bg-white/80 backdrop-blur-md',
                'border border-nilin-coral/30',
                'text-nilin-charcoal font-medium text-base',
                'hover:bg-nilin-coral hover:text-white hover:border-nilin-coral',
                'hover:shadow-lg hover:shadow-nilin-coral/20',
                'hover:-translate-y-0.5',
                'transition-all duration-300'
              )}
            >
              <span>View all trending</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default TrendingSearches;