import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, MapPin, Clock, ChevronRight, Loader2, TrendingUp } from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';
import { useLocationStore, SUPPORTED_CITIES } from '@/stores/locationStore';
import { cn } from '@/lib/utils';
import type { Suggestion } from '@/types/search';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  showLocationFilter?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onSearch?: (query: string) => void;
  variant?: 'default' | 'minimal';
}

const CATEGORIES = [
  { name: 'Hair', icon: '✂️', slug: 'hair' },
  { name: 'Spa', icon: '💆', slug: 'spa' },
  { name: 'Nails', icon: '💅', slug: 'nails' },
  { name: 'Makeup', icon: '💄', slug: 'makeup' },
];

const SearchBar: React.FC<SearchBarProps> = ({
  className,
  placeholder = "Search for services...",
  showLocationFilter = false,
  size = 'md',
  onSearch,
  variant = 'default',
}) => {
  const navigate = useNavigate();
  const {
    filters,
    suggestions,
    isLoadingSuggestions,
    recentSearches,
    setFilters,
    getSearchSuggestions,
    addToSearchHistory,
    performSearch,
  } = useSearchStore();

  const { selectedCity, setSelectedCity } = useLocationStore();

  const [query, setQuery] = useState(filters.q || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [location, setLocation] = useState(filters.city || '');
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Debounced suggestions
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
        !searchInputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setShowLocationPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      addToSearchHistory(query.trim());
      setFilters({
        q: query.trim(),
        city: location.trim() || undefined,
        page: 1,
      });
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowSuggestions(false);
      onSearch?.(query);
    }
  }, [query, location, setFilters, navigate, onSearch, addToSearchHistory]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const allItems = [
      ...suggestions.slice(0, 6).map((s, i) => ({ type: 'suggestion' as const, data: s, index: i })),
      ...recentSearches.slice(0, 3).map((s, i) => ({ type: 'recent' as const, data: s, index: suggestions.length + i })),
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
            handleSuggestionClick((item.data as Suggestion).text);
          } else {
            handleSuggestionClick(item.data as string);
          }
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setShowLocationPicker(false);
        setSelectedIndex(-1);
        break;
    }
  }, [suggestions, recentSearches, selectedIndex, handleSearch]);

  const handleSuggestionClick = useCallback((suggestionText: string) => {
    setQuery(suggestionText);
    addToSearchHistory(suggestionText);
    setFilters({
      q: suggestionText,
      city: location.trim() || undefined,
      page: 1,
    });
    navigate(`/search?q=${encodeURIComponent(suggestionText)}`);
    setShowSuggestions(false);
    onSearch?.(suggestionText);
  }, [location, setFilters, navigate, onSearch, addToSearchHistory]);

  const handleLocationSelect = useCallback((cityName: string) => {
    const city = SUPPORTED_CITIES.find(c =>
      c.name.toLowerCase() === cityName.toLowerCase() ||
      c.id === cityName.toLowerCase()
    );
    if (city) {
      setSelectedCity(city);
      setLocation(city.name);
    }
    setShowLocationPicker(false);
    setLocationQuery('');
  }, [setSelectedCity]);

  const handleCategoryClick = useCallback((categorySlug: string) => {
    setFilters({ category: categorySlug, page: 1 });
    navigate(`/search?category=${categorySlug}`);
    setShowSuggestions(false);
  }, [setFilters, navigate]);

  const clearQuery = () => {
    setQuery('');
    searchInputRef.current?.focus();
  };

  const filteredCities = SUPPORTED_CITIES.filter(city =>
    city.name.toLowerCase().includes(locationQuery.toLowerCase()) ||
    city.id.includes(locationQuery.toLowerCase())
  );

  const sizeClasses = {
    sm: {
      container: 'h-10',
      input: 'text-sm pl-10 pr-4',
      button: 'px-3',
    },
    md: {
      container: 'h-12',
      input: 'text-base pl-11 pr-4',
      button: 'px-5',
    },
    lg: {
      container: 'h-14',
      input: 'text-lg pl-12 pr-4',
      button: 'px-6',
    },
  };

  const currentSize = sizeClasses[size];
  const isMinimal = variant === 'minimal';

  return (
    <div className={cn('relative w-full', className)}>
      {/* Main Search Bar */}
      <div
        className={cn(
          'relative flex items-center border rounded-xl transition-all duration-200',
          isMinimal
            ? 'bg-nilin-blush/30 border-transparent focus-within:border-nilin-coral/30'
            : 'bg-white border-nilin-border focus-within:border-nilin-coral focus-within:ring-2 focus-within:ring-nilin-coral/20',
          currentSize.container
        )}
      >
        {/* Search Icon */}
        <Search className={cn(
          'absolute left-4 top-1/2 -translate-y-1/2',
          isMinimal ? 'text-nilin-warmGray' : 'text-nilin-warmGray'
        )} size={20} />

        {/* Location Filter (optional) */}
        {showLocationFilter && (
          <div className="relative">
            <button
              onClick={() => setShowLocationPicker(!showLocationPicker)}
              className={cn(
                'flex items-center gap-1.5 px-3 h-full border-r transition-colors',
                isMinimal ? 'border-transparent/20 text-white/70' : 'border-nilin-border/50 text-nilin-warmGray hover:text-nilin-charcoal'
              )}
            >
              <MapPin size={16} />
              <span className="text-sm whitespace-nowrap max-w-[100px] truncate">
                {selectedCity?.name || 'Location'}
              </span>
            </button>

            {/* Location Picker Dropdown */}
            {showLocationPicker && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-2xl border border-nilin-border z-50 overflow-hidden">
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
                  {filteredCities.map((city) => (
                    <button
                      key={city.id}
                      onClick={() => handleLocationSelect(city.name)}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-nilin-blush/50 flex items-center gap-2 transition-colors"
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
        )}

        {/* Search Input */}
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsExpanded(true)}
          onBlur={() => setIsExpanded(false)}
          placeholder={placeholder}
          className={cn(
            'flex-1 bg-transparent outline-none text-nilin-charcoal placeholder:text-nilin-warmGray',
            currentSize.input
          )}
        />

        {/* Clear Button */}
        {query && (
          <button
            onClick={clearQuery}
            className="absolute right-20 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-nilin-blush/50 transition-colors"
          >
            <X size={16} className="text-nilin-warmGray" />
          </button>
        )}

        {/* Search Button */}
        <button
          onClick={handleSearch}
          className={cn(
            'flex items-center justify-center rounded-lg font-medium transition-colors',
            isMinimal
              ? 'bg-nilin-coral text-white hover:bg-nilin-rose'
              : 'bg-nilin-coral text-white hover:bg-nilin-rose shadow-md',
            currentSize.button
          )}
        >
          Search
        </button>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className={cn(
            'absolute top-full left-0 right-0 z-50 mt-2 rounded-xl shadow-2xl overflow-hidden',
            isMinimal
              ? 'bg-nilin-charcoal/95 backdrop-blur-lg border border-white/10'
              : 'bg-white border border-nilin-border'
          )}
        >
          {/* Loading State */}
          {isLoadingSuggestions && (
            <div className="px-4 py-6 text-center">
              <Loader2 className={cn('w-6 h-6 mx-auto animate-spin', isMinimal ? 'text-white/70' : 'text-nilin-coral')} />
            </div>
          )}

          {/* Suggestions */}
          {!isLoadingSuggestions && suggestions.length > 0 && (
            <div className="p-2">
              <div className={cn('px-3 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2', isMinimal ? 'text-white/60' : 'text-nilin-warmGray')}>
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
                      ? isMinimal ? 'bg-white/10 text-white' : 'bg-nilin-coral/10 text-nilin-coral'
                      : isMinimal ? 'hover:bg-white/5 text-white/80' : 'hover:bg-nilin-blush/50'
                  )}
                >
                  <Search className={cn('w-4 h-4 flex-shrink-0', isMinimal ? 'text-white/50' : 'text-nilin-warmGray')} />
                  <span className="flex-1 text-sm">{suggestion.text}</span>
                  <span className={cn('text-xs px-2 py-0.5 rounded capitalize', isMinimal ? 'bg-white/10 text-white/60' : 'bg-nilin-blush/50 text-nilin-warmGray')}>
                    {suggestion.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {!isLoadingSuggestions && query.length < 2 && recentSearches.length > 0 && (
            <div className="p-2">
              <div className={cn('px-3 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2', isMinimal ? 'text-white/60' : 'text-nilin-warmGray')}>
                <Clock className="w-3.5 h-3.5" />
                Recent Searches
              </div>
              {recentSearches.slice(0, 5).map((search, index) => (
                <button
                  key={`recent-${index}`}
                  onClick={() => handleSuggestionClick(search)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-3 transition-colors',
                    selectedIndex === suggestions.length + index
                      ? isMinimal ? 'bg-white/10 text-white' : 'bg-nilin-coral/10 text-nilin-coral'
                      : isMinimal ? 'hover:bg-white/5 text-white/80' : 'hover:bg-nilin-blush/50'
                  )}
                >
                  <Clock className={cn('w-4 h-4 flex-shrink-0', isMinimal ? 'text-white/50' : 'text-nilin-warmGray')} />
                  <span className="flex-1 text-sm">{search}</span>
                  <ChevronRight className={cn('w-4 h-4', isMinimal ? 'text-white/50' : 'text-nilin-warmGray')} />
                </button>
              ))}
            </div>
          )}

          {/* Quick Categories */}
          {!isLoadingSuggestions && (
            <div className={cn('border-t p-3', isMinimal ? 'border-white/10' : 'border-nilin-border/50')}>
              <div className="flex items-center justify-between mb-2">
                <span className={cn('text-xs font-medium', isMinimal ? 'text-white/60' : 'text-nilin-warmGray')}>
                  Quick access:
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => handleCategoryClick(cat.slug)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                      isMinimal
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-nilin-blush/50 text-nilin-charcoal hover:bg-nilin-coral hover:text-white'
                    )}
                  >
                    <span>{cat.icon}</span>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {!isLoadingSuggestions && query.length >= 2 && suggestions.length === 0 && recentSearches.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Search className={cn('w-8 h-8 mx-auto mb-2 opacity-50', isMinimal ? 'text-white/50' : 'text-nilin-warmGray')} />
              <p className={cn('text-sm', isMinimal ? 'text-white/70' : 'text-nilin-warmGray')}>
                No results for "{query}"
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;