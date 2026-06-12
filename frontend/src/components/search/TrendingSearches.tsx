import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, Loader2, ChevronRight, Sparkles, Flame } from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';
import { cn } from '@/lib/utils';

interface TrendingSearchesProps {
  className?: string;
  title?: string;
  subtitle?: string;
  limit?: number;
  showViewAll?: boolean;
  variant?: 'default' | 'hero' | 'minimal';
  onSearch?: (query: string) => void;
}

const DEFAULT_TRENDING_SEARCHES = [
  { term: 'Bridal Makeup', category: 'beauty', icon: 'sparkles' },
  { term: 'Swedish Massage', category: 'spa', icon: 'sparkles' },
  { term: 'Gel Nails', category: 'nails', icon: 'sparkles' },
  { term: 'Hair Coloring', category: 'hair', icon: 'sparkles' },
  { term: 'Deep Tissue Massage', category: 'spa', icon: 'sparkles' },
  { term: 'Facial Treatment', category: 'skincare', icon: 'sparkles' },
  { term: 'Haircut & Styling', category: 'hair', icon: 'sparkles' },
  { term: 'Manicure & Pedicure', category: 'nails', icon: 'sparkles' },
];

const TrendingSearches: React.FC<TrendingSearchesProps> = ({
  className,
  title = 'Trending Searches',
  subtitle = 'Popular this week',
  limit = 8,
  showViewAll = false,
  variant = 'default',
  onSearch,
}) => {
  const navigate = useNavigate();
  const { recentSearches, addToSearchHistory, setFilters } = useSearchStore();
  const [isHovered, setIsHovered] = useState<number | null>(null);

  const handleSearchClick = (term: string) => {
    if (onSearch) {
      onSearch(term);
    } else {
      addToSearchHistory(term);
      setFilters({ q: term, page: 1 });
      navigate(`/search?q=${encodeURIComponent(term)}`);
    }
  };

  const isHeroVariant = variant === 'hero';
  const isMinimalVariant = variant === 'minimal';

  const containerClasses = cn(
    'w-full',
    isHeroVariant && 'bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10',
    isMinimalVariant && 'bg-nilin-blush/30 rounded-xl p-4',
    !isHeroVariant && !isMinimalVariant && 'bg-white rounded-2xl shadow-lg p-6',
    className
  );

  const titleColorClass = isHeroVariant ? 'text-white' : 'text-nilin-charcoal';
  const subtitleColorClass = isHeroVariant ? 'text-white/70' : 'text-nilin-warmGray';
  const itemHoverClass = isHeroVariant ? 'hover:bg-white/10' : 'hover:bg-nilin-blush/50';
  const itemTextClass = isHeroVariant ? 'text-white' : 'text-nilin-charcoal';

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex items-center justify-center w-10 h-10 rounded-xl',
            isHeroVariant ? 'bg-nilin-coral/20' : 'bg-nilin-coral/10'
          )}>
            <Flame className={cn('w-5 h-5', isHeroVariant ? 'text-white' : 'text-nilin-coral')} />
          </div>
          <div>
            <h3 className={cn('text-lg font-semibold', titleColorClass)}>{title}</h3>
            <p className={cn('text-sm', subtitleColorClass)}>{subtitle}</p>
          </div>
        </div>

        {showViewAll && (
          <button
            onClick={() => navigate('/search?view=trending')}
            className={cn(
              'flex items-center gap-1 text-sm font-medium transition-colors',
              isHeroVariant ? 'text-white/70 hover:text-white' : 'text-nilin-coral hover:text-nilin-rose'
            )}
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Trending Items Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {DEFAULT_TRENDING_SEARCHES.slice(0, limit).map((item, index) => (
          <button
            key={`trending-${index}`}
            onClick={() => handleSearchClick(item.term)}
            onMouseEnter={() => setIsHovered(index)}
            onMouseLeave={() => setIsHovered(null)}
            className={cn(
              'group relative flex items-center gap-3 p-3 rounded-xl transition-all duration-300',
              itemHoverClass,
              isHovered === index && (isHeroVariant ? 'bg-white/15 scale-[1.02]' : 'bg-nilin-peach/30 scale-[1.02]')
            )}
          >
            {/* Rank Badge */}
            <div className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold',
              isHeroVariant
                ? 'bg-white/10 text-white/80'
                : 'bg-nilin-coral/10 text-nilin-coral'
            )}>
              {index + 1}
            </div>

            {/* Content */}
            <div className="flex-1 text-left min-w-0">
              <span className={cn('block text-sm font-medium truncate', itemTextClass)}>
                {item.term}
              </span>
              <span className={cn(
                'block text-xs capitalize',
                isHeroVariant ? 'text-white/50' : 'text-nilin-warmGray'
              )}>
                {item.category}
              </span>
            </div>

            {/* Hover Icon */}
            <div className={cn(
              'w-6 h-6 flex items-center justify-center rounded-full transition-all duration-300',
              isHovered === index
                ? isHeroVariant ? 'bg-white/20' : 'bg-nilin-coral/20'
                : 'opacity-0',
              isHeroVariant ? 'text-white/60' : 'text-nilin-coral'
            )}>
              <Sparkles className="w-3 h-3" />
            </div>

            {/* Glow Effect on Hover */}
            {isHovered === index && (
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-nilin-coral/10 to-transparent opacity-50" />
            )}
          </button>
        ))}
      </div>

      {/* Recent Searches (if any) */}
      {recentSearches.length > 0 && !isMinimalVariant && (
        <div className="mt-6 pt-4 border-t border-nilin-border/30">
          <div className="flex items-center gap-2 mb-3">
            <Clock className={cn('w-4 h-4', subtitleColorClass)} />
            <span className={cn('text-sm font-medium', subtitleColorClass)}>Your recent searches</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.slice(0, 4).map((term, index) => (
              <button
                key={`recent-${index}`}
                onClick={() => handleSearchClick(term)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors',
                  isHeroVariant
                    ? 'bg-white/10 text-white/80 hover:bg-white/20'
                    : 'bg-nilin-blush/50 text-nilin-warmGray hover:bg-nilin-coral/10 hover:text-nilin-coral'
                )}
              >
                <Clock className="w-3 h-3" />
                {term}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TrendingSearches;