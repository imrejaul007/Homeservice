import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, X, Clock, ChevronRight, Loader2, TrendingUp } from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';
import { useLocationStore, useSupportedCities } from '@/stores/locationStore';
import { useTrendingSearchTerms } from '@/hooks/useTrendingSearchTerms';
import { cn } from '@/lib/utils';
import type { Suggestion } from '@/types/search';

interface HeroSearchBarProps {
  className?: string;
  variant?: 'hero' | 'minimal';
  placeholder?: string;
}

const HeroSearchBar: React.FC<HeroSearchBarProps> = ({
  className,
  variant = 'hero',
  placeholder = 'What service are you looking for?',
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const {
    suggestions,
    isLoadingSuggestions,
    recentSearches,
    setFilters,
    getSearchSuggestions,
    addToSearchHistory,
  } = useSearchStore();

  const { selectedCity } = useLocationStore();
  const supportedCities = useSupportedCities();
  const { terms: trendingTerms } = useTrendingSearchTerms(5);

  const [query, setQuery] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [locationQuery, setLocationQuery] = useState('');

  // Debounced search suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        getSearchSuggestions(query);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, getSearchSuggestions]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setShowLocationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
        setShowSuggestions(false);
        setShowLocationDropdown(false);
        setSelectedIndex(-1);
        break;
    }
  }, [suggestions, recentSearches, selectedIndex, query]);

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      addToSearchHistory(query.trim());
      setFilters({ q: query.trim(), page: 1 });
      setIsSearching(true);

      // Simulate search delay for animation
      setTimeout(() => {
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
        setShowSuggestions(false);
        setIsSearching(false);
      }, 600);
    }
  }, [query, navigate, setFilters, addToSearchHistory]);

  const handleSuggestionClick = useCallback((text: string) => {
    setQuery(text);
    addToSearchHistory(text);
    setFilters({ q: text, page: 1 });
    navigate(`/search?q=${encodeURIComponent(text)}`);
    setShowSuggestions(false);
  }, [navigate, setFilters, addToSearchHistory]);

  const handleRecentSearchClick = useCallback((text: string) => {
    setQuery(text);
    addToSearchHistory(text);
    setFilters({ q: text, page: 1 });
    navigate(`/search?q=${encodeURIComponent(text)}`);
    setShowSuggestions(false);
  }, [navigate, setFilters, addToSearchHistory]);

  const handleLocationSelect = useCallback((cityName: string) => {
    const city = supportedCities.find(c =>
      c.name.toLowerCase() === cityName.toLowerCase() ||
      c.id === cityName.toLowerCase()
    );
    if (city) {
      useLocationStore.getState().setSelectedCity(city);
    }
    setShowLocationDropdown(false);
    setLocationQuery('');
  }, []);

  const clearQuery = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  // Filter cities based on location query
  const filteredCities = supportedCities.filter(city =>
    city.name.toLowerCase().includes(locationQuery.toLowerCase()) ||
    city.id.includes(locationQuery.toLowerCase())
  );

  const isMinimal = variant === 'minimal';
  const showRecentAndSuggestions = showSuggestions && (query.length >= 2 || recentSearches.length > 0);

  return (
    <div className={cn('relative w-full', className)}>
      {/* Main Search Bar Container - Reference Design: Outer shadow + inset shadow */}
      <div
        className={cn(
          'relative flex items-stretch transition-all duration-300',
          isMinimal
            ? 'flex-row'
            : 'flex-col sm:flex-row',
          // Reference design: Outer container with soft shadow
          isMinimal
            ? 'bg-white rounded-nilin shadow-nilin border border-nilin-border/30'
            : 'bg-white rounded-nilin-lg border border-nilin-border/20',
          // Outer shadow effect (like reference design)
          !isMinimal && 'shadow-[9px_9px_16px_rgba(189,189,189,0.6),-9px_-9px_16px_rgba(255,255,255,0.5)]',
          isMinimal && 'shadow-nilin',
          // Focus ring
          isFocused && 'ring-2 ring-nilin-coral/40'
        )}
      >
        {/* Location Selector */}
        <div className="relative min-w-0">
          <button
            onClick={() => setShowLocationDropdown(!showLocationDropdown)}
            className={cn(
              'flex items-center gap-2 px-3 sm:px-4 py-3 transition-all w-full sm:w-auto',
              isMinimal
                ? 'border-r border-nilin-border/30'
                : 'border-b sm:border-b-0 sm:border-r border-nilin-border/30',
              'text-nilin-warmGray hover:text-nilin-charcoal'
            )}
          >
            <MapPin className="w-5 h-5 text-nilin-coral flex-shrink-0" />
            <span className="text-sm font-medium whitespace-nowrap max-w-[100px] sm:max-w-[120px] truncate text-nilin-charcoal">
              {selectedCity?.name || 'All Locations'}
            </span>
          </button>

          {/* Location Dropdown */}
          {showLocationDropdown && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-nilin shadow-xl border border-nilin-border z-50 overflow-hidden">
              <div className="p-2 border-b border-nilin-border">
                <input
                  type="text"
                  placeholder="Search location..."
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-nilin-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                />
              </div>
              <div className="max-h-64 overflow-y-auto">
                <button
                  onClick={() => handleLocationSelect('all')}
                  className="w-full px-4 py-2.5 text-left text-sm text-nilin-warmGray hover:bg-nilin-blush/50 flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  All Locations
                </button>
                {filteredCities.map((city) => (
                  <button
                    key={city.id}
                    onClick={() => handleLocationSelect(city.name)}
                    className={cn(
                      'w-full px-4 py-2.5 text-left text-sm hover:bg-nilin-blush/50 flex items-center gap-2 transition-colors',
                      selectedCity?.id === city.id && 'bg-nilin-coral/10 text-nilin-coral'
                    )}
                  >
                    <MapPin className="w-4 h-4 text-nilin-warmGray" />
                    {city.name}
                    <span className="text-xs text-nilin-warmGray ml-auto">{city.country}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search Input - Reference Design: Inset shadow effect */}
        <div
          className={cn(
            'flex-1 relative min-w-0',
            // Reference design: Inset shadow effect
            !isMinimal && 'mx-0 sm:mx-2',
            isMinimal && 'flex-1'
          )}
        >
          {/* Reference Design: Inner shadow container */}
          <div
            className={cn(
              'relative flex items-center h-full',
              !isMinimal && 'rounded-nilin',
              !isMinimal && 'shadow-[inset_10px_10px_15px_-10px_#c3c3c3,inset_-10px_-10px_15px_-10px_#ffffff]',
              !isMinimal && 'bg-nilin-cream/50'
            )}
          >
            {/* Reference Design: Morphing Search Icon (Magnifying Glass → Dot → Spinner) */}
            <div
              className={cn(
                'relative flex items-center justify-center w-10 h-10 flex-shrink-0',
                isSearching && 'animate-spin'
              )}
            >
              {/* Circle part of magnifying glass */}
              <div
                className={cn(
                  'absolute w-[18px] h-[18px] rounded-full border-[3px] transition-all duration-500 ease-out',
                  'top-1/2 left-2 -translate-y-1/2',
                  // Default: coral border (magnifying glass lens)
                  'border-nilin-coral bg-transparent',
                  // Focused: fills with coral, border expands (becomes dot)
                  isFocused && '!w-[14px] !h-[14px] !bg-nilin-coral !border-[10px] !border-nilin-blush !left-2.5',
                  // Searching: spinner effect
                  isSearching && '!w-[18px] !h-[18px] !border-nilin-coral !bg-transparent animate-pulse'
                )}
              />
              {/* Handle part of magnifying glass */}
              <div
                className={cn(
                  'absolute w-[4px] h-[14px] rounded-[4px] transition-all duration-500 ease-out',
                  'top-1/2 left-[26px]',
                  '-translate-y-[calc(50%-4px)] rotate-45 origin-top-left',
                  // Default: coral handle
                  'bg-nilin-coral',
                  // Focused: shrinks and fades (handle disappears)
                  isFocused && '!w-[4px] !h-[4px] !bg-nilin-blush !opacity-0',
                  // Searching: spinner effect
                  isSearching && '!w-[4px] !h-[14px] !bg-nilin-coral !opacity-100'
                )}
              />
            </div>

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setIsFocused(true);
                if (query.length >= 2 || recentSearches.length > 0) {
                  setShowSuggestions(true);
                }
              }}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              className={cn(
                'w-full border-none outline-none bg-transparent text-nilin-charcoal placeholder:text-nilin-warmGray',
                isMinimal ? 'pl-2 pr-4 py-3 text-sm' : 'pl-2 pr-4 py-4 text-base'
              )}
            />
            {query && !isSearching && (
              <button
                onClick={clearQuery}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors text-nilin-warmGray hover:text-nilin-charcoal hover:bg-nilin-blush/50"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search Button - Reference Design: Highlighted coral */}
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className={cn(
            'flex items-center justify-center transition-all flex-shrink-0',
            isMinimal
              ? 'm-1.5 px-5 py-2 bg-nilin-coral text-white rounded-lg font-medium text-sm hover:bg-nilin-rose'
              : 'm-0 sm:m-1.5 px-6 sm:px-8 py-3 bg-nilin-coral text-white rounded-none rounded-b-nilin-lg sm:rounded-nilin font-semibold hover:bg-nilin-rose shadow-lg w-full sm:w-auto',
            isSearching && 'opacity-70 cursor-wait'
          )}
        >
          {isSearching ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Search'
          )}
        </button>
      </div>

      {/* Suggestions Dropdown - Reference Design: Clean white card */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          role="listbox"
          aria-expanded={showSuggestions}
          className={cn(
            'absolute top-full left-0 right-0 z-50 overflow-hidden',
            isMinimal
              ? 'mt-1 bg-white rounded-nilin border border-nilin-border shadow-nilin'
              : 'mt-2 bg-white rounded-nilin-lg border border-nilin-border/20 shadow-[9px_9px_16px_rgba(189,189,189,0.3),-9px_-9px_16px_rgba(255,255,255,0.5)]'
          )}
        >
          {/* Loading State */}
          {isLoadingSuggestions && (
            <div className="px-4 py-6 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-nilin-coral mx-auto" />
              <p className="text-sm text-nilin-warmGray mt-2">Searching...</p>
            </div>
          )}

          {/* Suggestions from API */}
          {!isLoadingSuggestions && suggestions.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-nilin-warmGray uppercase tracking-wider flex items-center gap-2">
                <Search className="w-3.5 h-3.5" />
                Suggestions
              </div>
              {suggestions.slice(0, 6).map((suggestion, index) => (
                <button
                  key={`suggestion-${index}`}
                  role="option"
                  aria-selected={selectedIndex === index}
                  onClick={() => handleSuggestionClick(suggestion.text)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors',
                    selectedIndex === index
                      ? 'bg-nilin-coral/10 text-nilin-coral'
                      : 'hover:bg-nilin-blush/50'
                  )}
                >
                  <Search className="w-4 h-4 text-nilin-warmGray flex-shrink-0" />
                  <span className="flex-1 text-sm text-nilin-charcoal">{suggestion.text}</span>
                  <span className="text-xs text-nilin-warmGray capitalize bg-nilin-blush/50 px-2 py-0.5 rounded">
                    {suggestion.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {!isLoadingSuggestions && recentSearches.length > 0 && suggestions.length === 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-nilin-warmGray uppercase tracking-wider flex items-center gap-2">
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
                      ? 'bg-nilin-coral/10 text-nilin-coral'
                      : 'hover:bg-nilin-blush/50'
                  )}
                >
                  <Clock className="w-4 h-4 text-nilin-warmGray flex-shrink-0" />
                  <span className="flex-1 text-sm text-nilin-charcoal">{search}</span>
                  <ChevronRight className="w-4 h-4 text-nilin-warmGray" />
                </button>
              ))}
            </div>
          )}

          {/* Trending Searches (when no query) */}
          {!isLoadingSuggestions && !query && recentSearches.length === 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-semibold text-nilin-warmGray uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Popular Searches
              </div>
              {trendingTerms.map((term, index) => (
                <button
                  key={`trending-${term}-${index}`}
                  onClick={() => handleSuggestionClick(term)}
                  className={cn(
                    'w-full text-left min-h-11 px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors',
                    selectedIndex === index ? 'bg-nilin-coral/10 text-nilin-coral' : 'hover:bg-nilin-blush/50'
                  )}
                >
                  <TrendingUp className="w-4 h-4 text-nilin-coral flex-shrink-0" />
                  <span className="flex-1 text-sm text-nilin-charcoal">{term}</span>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {!isLoadingSuggestions && query.length >= 2 && suggestions.length === 0 && recentSearches.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Search className="w-8 h-8 text-nilin-warmGray mx-auto mb-2 opacity-50" />
              <p className="text-sm text-nilin-warmGray">No results found for "{query}"</p>
              <p className="text-xs text-nilin-warmGray mt-1">Try different keywords or browse categories</p>
            </div>
          )}

          {/* Footer with quick links - Reference Design: Subtle section */}
          <div className="border-t border-nilin-border/30 p-3 bg-nilin-cream/50">
            <div className="flex items-center justify-between text-xs">
              <span className="text-nilin-warmGray">Quick access:</span>
              <div className="flex gap-2">
                {['Hair', 'Spa', 'Nails', 'Makeup'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setFilters({ category: cat, page: 1 });
                      navigate(`/search?category=${cat.toLowerCase()}`);
                    }}
                    className="px-2.5 py-1 bg-white rounded-full text-nilin-charcoal hover:bg-nilin-coral hover:text-white transition-colors shadow-sm border border-nilin-border/20"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroSearchBar;