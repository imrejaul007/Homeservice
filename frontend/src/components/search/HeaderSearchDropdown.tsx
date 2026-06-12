import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, TrendingUp, X, ChevronRight, Loader2, MapPin } from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';
import { useLocationStore, SUPPORTED_CITIES } from '@/stores/locationStore';
import { cn } from '@/lib/utils';
import type { Suggestion } from '@/types/search';

interface HeaderSearchDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  isHeroOverlay?: boolean;
}

const HeaderSearchDropdown: React.FC<HeaderSearchDropdownProps> = ({
  isOpen,
  onClose,
  isHeroOverlay = false,
}) => {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    suggestions,
    isLoadingSuggestions,
    recentSearches,
    setFilters,
    getSearchSuggestions,
    addToSearchHistory,
  } = useSearchStore();

  const { selectedCity } = useLocationStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Debounced search suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        getSearchSuggestions(query);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, getSearchSuggestions]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const allItems = [
      ...suggestions.map(s => ({ type: 'suggestion' as const, data: s })),
      ...recentSearches.slice(0, 3).map(s => ({ type: 'recent' as const, data: s })),
    ];

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < allItems.length) {
          const item = allItems[selectedIndex];
          if (item.type === 'suggestion') {
            handleSuggestionClick(item.data.text);
          } else {
            handleRecentSearchClick(item.data as string);
          }
        } else if (query.trim()) {
          handleSearch();
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [suggestions, recentSearches, selectedIndex, query, onClose]);

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      addToSearchHistory(query.trim());
      setFilters({ q: query.trim(), page: 1 });
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      onClose();
    }
  }, [query, navigate, setFilters, addToSearchHistory, onClose]);

  const handleSuggestionClick = useCallback((text: string) => {
    setQuery(text);
    addToSearchHistory(text);
    setFilters({ q: text, page: 1 });
    navigate(`/search?q=${encodeURIComponent(text)}`);
    onClose();
  }, [navigate, setFilters, addToSearchHistory, onClose]);

  const handleRecentSearchClick = useCallback((text: string) => {
    setQuery(text);
    addToSearchHistory(text);
    setFilters({ q: text, page: 1 });
    navigate(`/search?q=${encodeURIComponent(text)}`);
    onClose();
  }, [navigate, setFilters, addToSearchHistory, onClose]);

  const clearQuery = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const textColorClass = isHeroOverlay ? 'text-white' : 'text-nilin-charcoal';
  const inputBgClass = isHeroOverlay ? 'bg-white/10 border-white/20 text-white placeholder:text-white/60' : 'bg-white border-nilin-border text-nilin-charcoal placeholder:text-nilin-warmGray';
  const iconColorClass = isHeroOverlay ? 'text-white/70' : 'text-nilin-warmGray';

  const allItems = [
    ...suggestions.slice(0, 6).map(s => ({ type: 'suggestion' as const, data: s })),
    ...recentSearches.slice(0, 5).map(s => ({ type: 'recent' as const, data: s })),
  ];

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className={cn(
        'absolute top-full left-0 right-0 z-50 overflow-hidden shadow-2xl rounded-b-xl',
        isHeroOverlay ? 'bg-nilin-charcoal/95 backdrop-blur-lg border border-white/10' : 'bg-white border border-nilin-border'
      )}
    >
      {/* Search Input */}
      <div className={cn('p-4 border-b', isHeroOverlay ? 'border-white/10' : 'border-nilin-border/50')}>
        <div className="relative flex items-center">
          <Search className={cn('absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5', iconColorClass)} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search services, providers, locations..."
            className={cn(
              'w-full pl-12 pr-10 py-3 rounded-xl text-sm outline-none transition-all duration-200',
              inputBgClass
            )}
            autoComplete="off"
          />
          {query && (
            <button
              onClick={clearQuery}
              className={cn(
                'absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors',
                isHeroOverlay ? 'text-white/70 hover:text-white' : 'text-nilin-warmGray hover:text-nilin-charcoal'
              )}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results Area */}
      <div className="max-h-96 overflow-y-auto">
        {/* Loading State */}
        {isLoadingSuggestions && (
          <div className="px-4 py-6 text-center">
            <Loader2 className={cn('w-6 h-6 mx-auto animate-spin', isHeroOverlay ? 'text-white/70' : 'text-nilin-coral')} />
          </div>
        )}

        {/* Suggestions from API */}
        {!isLoadingSuggestions && suggestions.length > 0 && (
          <div className="p-2">
            <div className={cn('px-3 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2', isHeroOverlay ? 'text-white/60' : 'text-nilin-warmGray')}>
              <Search className="w-3.5 h-3.5" />
              Suggestions
            </div>
            {suggestions.slice(0, 6).map((suggestion, index) => (
              <button
                key={`suggestion-${index}`}
                onClick={() => handleSuggestionClick(suggestion.text)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors',
                  selectedIndex === index
                    ? isHeroOverlay ? 'bg-white/10 text-white' : 'bg-nilin-coral/10 text-nilin-coral'
                    : isHeroOverlay ? 'hover:bg-white/5 text-white/80' : 'hover:bg-nilin-blush/50'
                )}
              >
                <Search className={cn('w-4 h-4 flex-shrink-0', isHeroOverlay ? 'text-white/50' : 'text-nilin-warmGray')} />
                <span className="flex-1 text-sm">{suggestion.text}</span>
                <span className={cn('text-xs px-2 py-0.5 rounded capitalize', isHeroOverlay ? 'bg-white/10 text-white/60' : 'bg-nilin-blush/50 text-nilin-warmGray')}>
                  {suggestion.type}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Recent Searches */}
        {!isLoadingSuggestions && recentSearches.length > 0 && suggestions.length === 0 && (
          <div className="p-2">
            <div className={cn('px-3 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2', isHeroOverlay ? 'text-white/60' : 'text-nilin-warmGray')}>
              <Clock className="w-3.5 h-3.5" />
              Recent Searches
            </div>
            {recentSearches.slice(0, 5).map((search, index) => (
              <button
                key={`recent-${index}`}
                onClick={() => handleRecentSearchClick(search)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors',
                  selectedIndex === suggestions.length + index
                    ? isHeroOverlay ? 'bg-white/10 text-white' : 'bg-nilin-coral/10 text-nilin-coral'
                    : isHeroOverlay ? 'hover:bg-white/5 text-white/80' : 'hover:bg-nilin-blush/50'
                )}
              >
                <Clock className={cn('w-4 h-4 flex-shrink-0', isHeroOverlay ? 'text-white/50' : 'text-nilin-warmGray')} />
                <span className="flex-1 text-sm">{search}</span>
                <ChevronRight className={cn('w-4 h-4', isHeroOverlay ? 'text-white/50' : 'text-nilin-warmGray')} />
              </button>
            ))}
          </div>
        )}

        {/* Trending Searches (when no query) */}
        {!isLoadingSuggestions && !query && recentSearches.length === 0 && (
          <div className="p-2">
            <div className={cn('px-3 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2', isHeroOverlay ? 'text-white/60' : 'text-nilin-warmGray')}>
              <TrendingUp className="w-3.5 h-3.5" />
              Popular Searches
            </div>
            {['Bridal Makeup', 'Swedish Massage', 'Gel Nails', 'Hair Coloring', 'Facial'].map((term, index) => (
              <button
                key={`trending-${index}`}
                onClick={() => handleSuggestionClick(term)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors',
                  selectedIndex === index
                    ? isHeroOverlay ? 'bg-white/10 text-white' : 'bg-nilin-coral/10 text-nilin-coral'
                    : isHeroOverlay ? 'hover:bg-white/5 text-white/80' : 'hover:bg-nilin-blush/50'
                )}
              >
                <TrendingUp className={cn('w-4 h-4 flex-shrink-0', isHeroOverlay ? 'text-white/50' : 'text-nilin-coral')} />
                <span className="flex-1 text-sm">{term}</span>
              </button>
            ))}
          </div>
        )}

        {/* No Results */}
        {!isLoadingSuggestions && query.length >= 2 && suggestions.length === 0 && recentSearches.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Search className={cn('w-8 h-8 mx-auto mb-2 opacity-50', isHeroOverlay ? 'text-white/50' : 'text-nilin-warmGray')} />
            <p className={cn('text-sm', isHeroOverlay ? 'text-white/70' : 'text-nilin-warmGray')}>
              No results for "{query}"
            </p>
          </div>
        )}

        {/* Quick Categories */}
        <div className={cn('border-t p-3', isHeroOverlay ? 'border-white/10' : 'border-nilin-border/50')}>
          <div className="flex items-center justify-between">
            <span className={cn('text-xs', isHeroOverlay ? 'text-white/60' : 'text-nilin-warmGray')}>Quick access:</span>
            <div className="flex gap-2">
              {['Hair', 'Spa', 'Nails', 'Makeup'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setFilters({ category: cat.toLowerCase(), page: 1 });
                    navigate(`/search?category=${cat.toLowerCase()}`);
                    onClose();
                  }}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                    isHeroOverlay
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-nilin-blush/50 text-nilin-charcoal hover:bg-nilin-coral hover:text-white'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeaderSearchDropdown;