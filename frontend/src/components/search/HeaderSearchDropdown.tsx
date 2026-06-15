import React, { useState, useRef, useEffect, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Clock, TrendingUp, X, ChevronRight, Loader2, Sparkles, Scissors, Flower2, Palette } from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';
import { cn } from '@/lib/utils';

interface HeaderSearchDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  isHeroOverlay?: boolean;
}

// NILIN brand category definitions
const CATEGORIES = [
  { name: 'Hair', icon: Scissors, slug: 'hair' },
  { name: 'Spa', icon: Flower2, slug: 'spa' },
  { name: 'Nails', icon: Sparkles, slug: 'nails' },
  { name: 'Makeup', icon: Palette, slug: 'makeup' },
];

// NILIN brand category tokens
const CATEGORY_TOKENS: Record<string, { bg: string; text: string; glow: string }> = {
  hair: { bg: 'bg-nilin-cream', text: 'text-nilin-coral', glow: 'shadow-nilin-coral/20' },
  spa: { bg: 'bg-nilin-blush', text: 'text-nilin-rose', glow: 'shadow-nilin-rose/20' },
  nails: { bg: 'bg-nilin-peach', text: 'text-nilin-coral', glow: 'shadow-nilin-coral/20' },
  makeup: { bg: 'bg-nilin-blush', text: 'text-nilin-rose', glow: 'shadow-nilin-rose/20' },
};

// Trending searches
const TRENDING_SEARCHES = [
  { term: 'Manicure', category: 'Nails' },
  { term: 'Hair treatment', category: 'Hair' },
  { term: 'Hot stone massage', category: 'Spa' },
  { term: 'Bridal makeup', category: 'Makeup' },
  { term: 'Hair coloring', category: 'Hair' },
];

const HeaderSearchDropdown: React.FC<HeaderSearchDropdownProps> = ({
  isOpen,
  onClose,
  isHeroOverlay = false,
}) => {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId();

  const {
    suggestions,
    isLoadingSuggestions,
    recentSearches,
    setFilters,
    getSearchSuggestions,
    addToSearchHistory,
  } = useSearchStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Animation: fade in when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset state when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(-1);
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

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Build all navigable items
  const allItems = [
    ...suggestions.slice(0, 6).map((s, i) => ({ type: 'suggestion' as const, data: s, index: i })),
    ...recentSearches.slice(0, 5).map((s, i) => ({ type: 'recent' as const, data: s, index: suggestions.length + i })),
  ];

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
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
      case 'Tab':
        // Allow natural tab flow but close on shift+tab going backwards
        if (e.shiftKey) {
          onClose();
        }
        break;
    }
  }, [allItems, selectedIndex, query, onClose]);

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      addToSearchHistory(query.trim());
      setFilters({ q: query.trim(), page: 1 });
      setIsSearching(true);

      setTimeout(() => {
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
        onClose();
        setIsSearching(false);
      }, 600);
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

  const handleCategoryClick = useCallback((slug: string) => {
    setFilters({ category: slug, page: 1 });
    navigate(`/search?category=${slug}`);
    onClose();
  }, [setFilters, navigate, onClose]);

  const clearQuery = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      role="dialog"
      aria-label="Search services and providers"
      aria-modal="true"
      className={cn(
        'absolute top-full left-0 right-0 z-[60] overflow-hidden rounded-nilin-lg',
        'shadow-[0_8px_30px_rgba(45,45,45,0.12),0_2px_8px_rgba(45,45,45,0.06)]',
        'bg-white border border-nilin-border/30 backdrop-blur-sm',
        'transition-all duration-300 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      )}
    >
      {/* Search Input Area */}
      <div className="p-4 border-b border-nilin-border/20">
        <div className="relative flex items-center">
          {/* Search Icon */}
          <div className={cn(
            'absolute left-4 top-1/2 -translate-y-1/2 transition-all duration-200',
            isFocused && 'scale-110'
          )}>
            <Search className={cn(
              'w-5 h-5 transition-colors duration-200',
              isFocused ? 'text-nilin-coral' : 'text-nilin-warmGray'
            )} />
          </div>

          <input
            ref={inputRef}
            id={`search-input-${uniqueId}`}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search services, providers..."
            className={cn(
              'w-full pl-12 pr-10 py-3.5 rounded-xl text-sm outline-none transition-all duration-200',
              'bg-nilin-cream/70 border border-nilin-border/30',
              'focus:bg-white focus:border-nilin-coral/50 focus:shadow-[0_0_0_3px_rgba(232,180,168,0.15),0_2px_8px_rgba(232,180,168,0.1)]',
              'hover:border-nilin-coral/30',
              'text-nilin-charcoal placeholder:text-nilin-warmGray',
              'placeholder:transition-opacity duration-200',
              isFocused && 'placeholder:opacity-60'
            )}
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={`search-listbox-${uniqueId}`}
            aria-activedescendant={selectedIndex >= 0 ? `search-option-${uniqueId}-${selectedIndex}` : undefined}
          />

          {query && !isSearching && (
            <button
              onClick={clearQuery}
              className={cn(
                'absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-full',
                'hover:bg-nilin-blush/60 active:bg-nilin-blush/80',
                'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/50'
              )}
              aria-label="Clear search"
              tabIndex={0}
            >
              <X className="w-4 h-4 text-nilin-warmGray" />
            </button>
          )}

          {isSearching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <Loader2 className="w-4 h-4 text-nilin-coral animate-spin" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div
        ref={listRef}
        className="max-h-[480px] overflow-y-auto scrollbar-nilin"
        role="presentation"
      >
        {/* Loading State */}
        {isLoadingSuggestions && (
          <div
            className="px-4 py-8 text-center"
            role="status"
            aria-live="polite"
            aria-label="Searching..."
          >
            <div className="relative w-10 h-10 mx-auto">
              <div className="absolute inset-0 rounded-full bg-nilin-coral/10 animate-ping" />
              <div className="relative w-10 h-10 rounded-full bg-nilin-coral/20 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-nilin-coral animate-spin" />
              </div>
            </div>
            <p className="mt-3 text-sm text-nilin-warmGray">Searching...</p>
          </div>
        )}

        {/* Suggestions from API */}
        {!isLoadingSuggestions && suggestions.length > 0 && (
          <div className="p-3">
            <div
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-nilin-warmGray flex items-center gap-2"
              role="presentation"
            >
              <Search className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Suggestions</span>
            </div>
            <div
              role="listbox"
              id={`search-listbox-${uniqueId}`}
              aria-label="Search suggestions"
              className="space-y-1"
            >
              {suggestions.slice(0, 6).map((suggestion, index) => (
                <button
                  key={`suggestion-${index}`}
                  id={`search-option-${uniqueId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={selectedIndex === index}
                  onClick={() => {
                    handleSuggestionClick(suggestion.text);
                    setSelectedIndex(index);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-150',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/50 focus-visible:ring-offset-1',
                    selectedIndex === index
                      ? 'bg-nilin-coral/10 text-nilin-coral shadow-sm scale-[1.01]'
                      : 'hover:bg-nilin-blush/40 hover:scale-[1.005] active:scale-[1.0]'
                  )}
                >
                  <Search className="w-4 h-4 flex-shrink-0 text-nilin-warmGray" aria-hidden="true" />
                  <span className="flex-1 text-sm font-medium">{suggestion.text}</span>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-full font-medium transition-colors duration-150',
                      suggestion.type === 'service'
                        ? 'bg-nilin-coral/10 text-nilin-coral'
                        : 'bg-nilin-blush text-nilin-warmGray'
                    )}
                  >
                    {suggestion.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Searches - Only show when no query and have recent searches */}
        {!isLoadingSuggestions && query.length < 2 && recentSearches.length > 0 && (
          <div className="p-3">
            <div
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-nilin-warmGray flex items-center gap-2"
              role="presentation"
            >
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Recent Searches</span>
            </div>
            <div
              role="listbox"
              aria-label="Recent searches"
              className="space-y-1"
            >
              {recentSearches.slice(0, 5).map((search, index) => (
                <button
                  key={`recent-${index}`}
                  id={`search-option-${uniqueId}-${suggestions.length + index}`}
                  data-index={suggestions.length + index}
                  role="option"
                  aria-selected={selectedIndex === suggestions.length + index}
                  onClick={() => {
                    handleRecentSearchClick(search);
                    setSelectedIndex(suggestions.length + index);
                  }}
                  onMouseEnter={() => setSelectedIndex(suggestions.length + index)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-150',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/50 focus-visible:ring-offset-1',
                    selectedIndex === suggestions.length + index
                      ? 'bg-nilin-coral/10 text-nilin-coral shadow-sm scale-[1.01]'
                      : 'hover:bg-nilin-blush/40 hover:scale-[1.005] active:scale-[1.0]'
                  )}
                >
                  <Clock className="w-4 h-4 flex-shrink-0 text-nilin-warmGray" aria-hidden="true" />
                  <span className="flex-1 text-sm font-medium">{search}</span>
                  <ChevronRight className="w-4 h-4 text-nilin-lightGray transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Popular/Trending Section - Show when no query and no recent searches */}
        {!isLoadingSuggestions && query.length < 2 && recentSearches.length === 0 && (
          <div className="p-3">
            <div
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-nilin-warmGray flex items-center gap-2"
              role="presentation"
            >
              <TrendingUp className="w-3.5 h-3.5 text-nilin-coral" aria-hidden="true" />
              <span>Popular Searches</span>
            </div>
            <div className="space-y-1">
              {TRENDING_SEARCHES.map((item, index) => (
                <button
                  key={`trending-${index}`}
                  onClick={() => handleSuggestionClick(item.term)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-3 transition-all duration-150',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/50 focus-visible:ring-offset-1',
                    selectedIndex === index
                      ? 'bg-nilin-coral/10 text-nilin-coral shadow-sm scale-[1.01]'
                      : 'hover:bg-nilin-blush/40 hover:scale-[1.005] active:scale-[1.0]'
                  )}
                >
                  <TrendingUp className="w-4 h-4 flex-shrink-0 text-nilin-coral" aria-hidden="true" />
                  <span className="flex-1 text-sm font-medium">{item.term}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-nilin-blush/60 text-nilin-warmGray font-medium transition-colors duration-150">
                    {item.category}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!isLoadingSuggestions && query.length >= 2 && suggestions.length === 0 && (
          <div className="px-4 py-10 text-center" role="status" aria-live="polite">
            <div className="relative w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-nilin-blush/30 to-nilin-coral/10 flex items-center justify-center">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-nilin-blush/20 to-transparent" />
              <Search className="w-7 h-7 text-nilin-warmGray relative z-10" />
            </div>
            <p className="text-sm text-nilin-charcoal font-medium">No results found</p>
            <p className="text-xs text-nilin-warmGray mt-1">
              Try searching for something else
            </p>
          </div>
        )}

        {/* Categories Section - Always visible at bottom */}
        <div className="border-t border-nilin-border/20 bg-gradient-to-b from-nilin-cream/50 to-nilin-cream/30">
          <div className="px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-nilin-warmGray mb-3">
              Browse Categories
            </div>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.slug}
                    onClick={() => handleCategoryClick(category.slug)}
                    className={cn(
                      'group relative flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all duration-200',
                      'hover:shadow-md hover:-translate-y-1 active:translate-y-0',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-nilin-coral/50 focus-visible:ring-offset-1',
                      'overflow-hidden'
                    )}
                    aria-label={`Browse ${category.name} services`}
                  >
                    {/* Hover gradient overlay */}
                    <div className={cn(
                      'absolute inset-0 rounded-xl bg-gradient-to-br from-nilin-coral/5 to-transparent opacity-0',
                      'group-hover:opacity-100 transition-opacity duration-200'
                    )} />

                    {/* Icon container with glow effect */}
                    <div className={cn(
                      'relative w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200',
                      'group-hover:scale-110 group-hover:shadow-lg',
                      CATEGORY_TOKENS[category.slug]?.bg || 'bg-nilin-cream'
                    )}>
                      <Icon className="w-5 h-5 relative z-10" aria-hidden="true" />
                      {/* Subtle glow on hover */}
                      <div className={cn(
                        'absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                        'shadow-lg blur-sm',
                        CATEGORY_TOKENS[category.slug]?.glow || 'shadow-nilin-coral/20'
                      )} />
                    </div>

                    <span className="text-xs font-medium text-nilin-charcoal relative z-10 transition-colors duration-150 group-hover:text-nilin-coral">
                      {category.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard navigation hint */}
      <div className="px-4 py-2 bg-nilin-cream/30 border-t border-nilin-border/10">
        <p className="text-[10px] text-nilin-warmGray/70 flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white/60 rounded text-[9px] font-medium border border-nilin-border/20 shadow-sm">
              ↑↓
            </kbd>
            <span>Navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white/60 rounded text-[9px] font-medium border border-nilin-border/20 shadow-sm">
              ↵
            </kbd>
            <span>Select</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white/60 rounded text-[9px] font-medium border border-nilin-border/20 shadow-sm">
              Esc
            </kbd>
            <span>Close</span>
          </span>
        </p>
      </div>
    </div>
  );
};

export default HeaderSearchDropdown;
