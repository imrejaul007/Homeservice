import React, { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin, Clock } from 'lucide-react';
import { useSearchStore } from '@/store/searchStore';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  showLocationFilter?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onSearch?: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  className,
  placeholder = "Search for services...",
  showLocationFilter = false,
  size = 'md',
  onSearch,
}) => {
  const {
    filters,
    suggestions,
    isLoadingSuggestions,
    recentSearches,
    setFilters,
    getSearchSuggestions,
    performSearch,
  } = useSearchStore();

  const [query, setQuery] = useState(filters.q || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [location, setLocation] = useState(filters.city || '');
  const [isExpanded, setIsExpanded] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const locationInputRef = useRef<HTMLInputElement>(null);
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
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = () => {
    if (query.trim()) {
      setFilters({
        q: query.trim(),
        city: location.trim() || undefined,
        page: 1,
      });
      performSearch();
      setShowSuggestions(false);
      onSearch?.(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
    if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestionText: string) => {
    setQuery(suggestionText);
    setShowSuggestions(false);
    setTimeout(() => {
      setFilters({
        q: suggestionText,
        city: location.trim() || undefined,
        page: 1,
      });
      performSearch();
      onSearch?.(suggestionText);
    }, 0);
  };

  const clearQuery = () => {
    setQuery('');
    searchInputRef.current?.focus();
  };

  const sizeClasses = {
    sm: {
      container: 'h-10',
      input: 'text-sm px-3',
      button: 'h-8 w-8',
      icon: 'h-4 w-4',
    },
    md: {
      container: 'h-12',
      input: 'text-base px-4',
      button: 'h-10 w-10',
      icon: 'h-5 w-5',
    },
    lg: {
      container: 'h-14',
      input: 'text-lg px-5',
      button: 'h-12 w-12',
      icon: 'h-6 w-6',
    },
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={cn('relative w-full max-w-4xl mx-auto', className)}>
      <div
        className={cn(
          'relative flex items-center bg-white border border-gray-300 rounded-lg shadow-sm transition-all duration-200',
          isExpanded && 'ring-2 ring-blue-500 border-blue-500',
          currentSize.container
        )}
      >
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className={cn('absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400', currentSize.icon)} />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              setIsExpanded(true);
              if (query.length >= 2) setShowSuggestions(true);
            }}
            onBlur={() => setIsExpanded(false)}
            placeholder={placeholder}
            className={cn(
              'w-full border-none outline-none bg-transparent pl-10 pr-8',
              currentSize.input
            )}
          />
          {query && (
            <button
              onClick={clearQuery}
              className={cn(
                'absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors',
                currentSize.icon
              )}
            >
              <X className={currentSize.icon} />
            </button>
          )}
        </div>

        {/* Location Input (Optional) */}
        {showLocationFilter && (
          <>
            <div className="w-px h-6 bg-gray-300" />
            <div className="flex-1 relative min-w-0">
              <MapPin className={cn('absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400', currentSize.icon)} />
              <input
                ref={locationInputRef}
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Location..."
                className={cn(
                  'w-full border-none outline-none bg-transparent pl-10 pr-3',
                  currentSize.input
                )}
              />
            </div>
          </>
        )}

        {/* Search Button */}
        <button
          onClick={handleSearch}
          className={cn(
            'bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg transition-colors flex items-center justify-center',
            currentSize.button
          )}
        >
          <Search className={currentSize.icon} />
        </button>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && (query.length >= 2 || recentSearches.length > 0) && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 mt-1 max-h-80 overflow-y-auto"
        >
          {/* Suggestions from API */}
          {suggestions.length > 0 && (
            <div className="p-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion.text)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2 transition-colors"
                >
                  <Search className="h-4 w-4 text-gray-400" />
                  <span className="flex-1">{suggestion.text}</span>
                  <span className="text-xs text-gray-500 capitalize">
                    {suggestion.type}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {recentSearches.length > 0 && suggestions.length === 0 && (
            <div className="p-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-3 py-2">
                Recent Searches
              </div>
              {recentSearches.slice(0, 5).map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(search)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded flex items-center gap-2 transition-colors"
                >
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="flex-1">{search}</span>
                </button>
              ))}
            </div>
          )}

          {/* Loading State */}
          {isLoadingSuggestions && (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-sm mt-2">Loading suggestions...</p>
            </div>
          )}

          {/* No Suggestions */}
          {!isLoadingSuggestions && suggestions.length === 0 && recentSearches.length === 0 && query.length >= 2 && (
            <div className="p-4 text-center text-gray-500">
              <Search className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No suggestions found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;