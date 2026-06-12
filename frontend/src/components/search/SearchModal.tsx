import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  Clock,
  TrendingUp,
  MapPin,
  ChevronRight,
  Loader2,
  Sparkles,
  ArrowRight,
  Star,
  User,
  Grid3X3,
} from 'lucide-react';
import { useSearchStore } from '@/stores/searchStore';
import { useLocationStore, SUPPORTED_CITIES } from '@/stores/locationStore';
import { cn } from '@/lib/utils';
import type { Suggestion } from '@/types/search';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
}

type TabType = 'all' | 'services' | 'providers' | 'locations';

const CATEGORIES = [
  { name: 'Hair', icon: '✂️', slug: 'hair' },
  { name: 'Spa', icon: '💆', slug: 'spa' },
  { name: 'Nails', icon: '💅', slug: 'nails' },
  { name: 'Makeup', icon: '💄', slug: 'makeup' },
  { name: 'Skincare', icon: '✨', slug: 'skincare' },
  { name: 'Massage', icon: '👐', slug: 'massage' },
];

const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  initialQuery = '',
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const {
    suggestions,
    isLoadingSuggestions,
    recentSearches,
    setFilters,
    getSearchSuggestions,
    addToSearchHistory,
  } = useSearchStore();

  const { selectedCity, setSelectedCity } = useLocationStore();

  const [query, setQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [locationQuery, setLocationQuery] = useState('');

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery(initialQuery);
      setSelectedIndex(-1);
      setActiveTab('all');
    }
  }, [isOpen, initialQuery]);

  // Debounced search suggestions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.length >= 2) {
        getSearchSuggestions(query);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, getSearchSuggestions]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const allItems = getAllItems();

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
          handleItemClick(item);
        } else if (query.trim()) {
          handleSearch();
        }
        break;
      case 'Escape':
        onClose();
        break;
      case '/':
        e.preventDefault();
        inputRef.current?.focus();
        break;
    }
  }, [query, selectedIndex, suggestions, recentSearches, onClose]);

  const getAllItems = useCallback(() => {
    const items: Array<{ type: string; data: unknown; label: string }> = [];

    if (query.length >= 2) {
      suggestions.slice(0, 6).forEach(s => {
        items.push({ type: 'suggestion', data: s, label: s.text });
      });
    }

    if (!query) {
      recentSearches.slice(0, 5).forEach(s => {
        items.push({ type: 'recent', data: s, label: s });
      });
    }

    return items;
  }, [query, suggestions, recentSearches]);

  const handleItemClick = (item: { type: string; data: unknown; label: string }) => {
    if (item.type === 'suggestion') {
      const text = (item.data as Suggestion).text;
      setQuery(text);
      addToSearchHistory(text);
      setFilters({ q: text, page: 1 });
      navigate(`/search?q=${encodeURIComponent(text)}`);
    } else if (item.type === 'recent') {
      const text = item.data as string;
      setQuery(text);
      addToSearchHistory(text);
      setFilters({ q: text, page: 1 });
      navigate(`/search?q=${encodeURIComponent(text)}`);
    }
    onClose();
  };

  const handleSearch = useCallback(() => {
    if (query.trim()) {
      addToSearchHistory(query.trim());
      setFilters({ q: query.trim(), page: 1 });
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      onClose();
    }
  }, [query, navigate, setFilters, addToSearchHistory, onClose]);

  const handleCategoryClick = (category: string) => {
    setFilters({ category, page: 1 });
    navigate(`/search?category=${category}`);
    onClose();
  };

  const handleLocationSelect = (cityName: string) => {
    const city = SUPPORTED_CITIES.find(c =>
      c.name.toLowerCase() === cityName.toLowerCase() ||
      c.id === cityName.toLowerCase()
    );
    if (city) {
      setSelectedCity(city);
    }
    setShowLocationPicker(false);
    setLocationQuery('');
  };

  const filteredCities = SUPPORTED_CITIES.filter(city =>
    city.name.toLowerCase().includes(locationQuery.toLowerCase()) ||
    city.id.includes(locationQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-nilin-cream/98 backdrop-blur-lg animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-nilin-border/30 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-nilin-warmGray" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search services, providers, locations..."
                className="w-full pl-12 pr-4 py-3 text-lg bg-nilin-blush/30 rounded-xl border-2 border-nilin-border/30 focus:border-nilin-coral focus:bg-white transition-all duration-200 outline-none"
                autoComplete="off"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-nilin-blush/50 transition-colors"
                >
                  <X className="w-4 h-4 text-nilin-warmGray" />
                </button>
              )}
            </div>

            {/* Location Button */}
            <button
              onClick={() => setShowLocationPicker(!showLocationPicker)}
              className="flex items-center gap-2 px-4 py-3 bg-nilin-blush/30 rounded-xl border-2 border-nilin-border/30 hover:border-nilin-coral/50 transition-colors"
            >
              <MapPin className="w-5 h-5 text-nilin-coral" />
              <span className="text-sm font-medium text-nilin-charcoal max-w-[100px] truncate">
                {selectedCity?.name || 'All Locations'}
              </span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-3 rounded-xl bg-nilin-blush/30 hover:bg-nilin-blush/50 transition-colors"
            >
              <X className="w-5 h-5 text-nilin-warmGray" />
            </button>
          </div>

          {/* Location Picker Dropdown */}
          {showLocationPicker && (
            <div className="absolute left-4 right-4 md:left-auto md:right-0 md:w-80 mt-2 bg-white rounded-xl shadow-2xl border border-nilin-border z-20 overflow-hidden">
              <div className="p-2 border-b border-nilin-border/50">
                <input
                  type="text"
                  placeholder="Search location..."
                  value={locationQuery}
                  onChange={(e) => setLocationQuery(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-nilin-border/50 rounded-lg focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
                  autoFocus
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

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-4 -mb-4">
            {(['all', 'services', 'providers', 'locations'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-t-lg transition-colors',
                  activeTab === tab
                    ? 'bg-nilin-cream text-nilin-coral border-t-2 border-x-2 border-nilin-coral'
                    : 'text-nilin-warmGray hover:text-nilin-charcoal'
                )}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={resultsRef} className="max-w-4xl mx-auto px-4 py-6">
        {/* Loading State */}
        {isLoadingSuggestions && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-nilin-coral" />
            <p className="mt-3 text-sm text-nilin-warmGray">Searching...</p>
          </div>
        )}

        {/* Suggestions */}
        {!isLoadingSuggestions && suggestions.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-nilin-warmGray" />
              <span className="text-sm font-medium text-nilin-warmGray">Suggestions</span>
            </div>
            <div className="space-y-1">
              {suggestions.slice(0, 8).map((suggestion, index) => (
                <button
                  key={`suggestion-${index}`}
                  onClick={() => handleItemClick({ type: 'suggestion', data: suggestion, label: suggestion.text })}
                  className={cn(
                    'w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all duration-200',
                    selectedIndex === index
                      ? 'bg-nilin-coral/10 text-nilin-coral shadow-sm'
                      : 'hover:bg-nilin-blush/50'
                  )}
                >
                  <Search className="w-5 h-5 text-nilin-warmGray flex-shrink-0" />
                  <span className="flex-1 font-medium">{suggestion.text}</span>
                  <span className="text-xs px-2 py-1 bg-nilin-blush/50 rounded-full capitalize">
                    {suggestion.type}
                  </span>
                  <ChevronRight className="w-4 h-4 text-nilin-warmGray" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Searches */}
        {!isLoadingSuggestions && !query && recentSearches.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-nilin-warmGray" />
                <span className="text-sm font-medium text-nilin-warmGray">Recent Searches</span>
              </div>
              <button
                onClick={() => useSearchStore.getState().clearSearchHistory()}
                className="text-xs text-nilin-coral hover:text-nilin-rose"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.slice(0, 6).map((term, index) => (
                <button
                  key={`recent-${index}`}
                  onClick={() => handleItemClick({ type: 'recent', data: term, label: term })}
                  className="flex items-center gap-2 px-4 py-2 bg-white rounded-full text-sm text-nilin-charcoal hover:bg-nilin-coral hover:text-white transition-colors shadow-sm"
                >
                  <Clock className="w-3.5 h-3.5" />
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Trending Searches */}
        {!isLoadingSuggestions && !query && suggestions.length === 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-nilin-coral" />
              <span className="text-sm font-medium text-nilin-warmGray">Trending Searches</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['Bridal Makeup', 'Swedish Massage', 'Gel Nails', 'Hair Coloring', 'Deep Tissue', 'Facial', 'Manicure', 'Haircut'].map((term, index) => (
                <button
                  key={`trending-${index}`}
                  onClick={() => handleItemClick({ type: 'suggestion', data: { text: term, type: 'service' }, label: term })}
                  className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl text-sm text-nilin-charcoal hover:bg-nilin-coral hover:text-white transition-colors shadow-sm group"
                >
                  <span className="w-6 h-6 flex items-center justify-center bg-nilin-coral/10 group-hover:bg-white/20 rounded-lg text-xs font-bold text-nilin-coral group-hover:text-white">
                    {index + 1}
                  </span>
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Categories */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Grid3X3 className="w-4 h-4 text-nilin-warmGray" />
            <span className="text-sm font-medium text-nilin-warmGray">Browse Categories</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {CATEGORIES.map((category) => (
              <button
                key={category.slug}
                onClick={() => handleCategoryClick(category.slug)}
                className="flex items-center gap-3 px-4 py-4 bg-white rounded-xl hover:bg-nilin-coral hover:text-white transition-all duration-300 shadow-sm group"
              >
                <span className="text-2xl">{category.icon}</span>
                <span className="font-medium text-nilin-charcoal group-hover:text-white">
                  {category.name}
                </span>
                <ArrowRight className="w-4 h-4 ml-auto text-nilin-warmGray group-hover:text-white group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>

        {/* No Results */}
        {!isLoadingSuggestions && query.length >= 2 && suggestions.length === 0 && recentSearches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="w-12 h-12 text-nilin-warmGray/50 mb-4" />
            <h3 className="text-lg font-medium text-nilin-charcoal mb-2">No results found</h3>
            <p className="text-sm text-nilin-warmGray mb-4">
              We couldn't find anything for "{query}"
            </p>
            <p className="text-sm text-nilin-warmGray">
              Try different keywords or browse categories above
            </p>
          </div>
        )}

        {/* Search Button (when there's a query) */}
        {query.trim() && (
          <div className="mt-6 pt-6 border-t border-nilin-border/30">
            <button
              onClick={handleSearch}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-nilin-coral text-white rounded-xl font-semibold hover:bg-nilin-rose transition-colors shadow-lg shadow-nilin-coral/30"
            >
              <Search className="w-5 h-5" />
              Search for "{query}"
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 text-xs text-nilin-warmGray">
        <span className="flex items-center gap-1">
          <kbd className="px-2 py-1 bg-white rounded border border-nilin-border/50">↑↓</kbd>
          Navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-2 py-1 bg-white rounded border border-nilin-border/50">Enter</kbd>
          Select
        </span>
        <span className="flex items-center gap-1">
          <kbd className="px-2 py-1 bg-white rounded border border-nilin-border/50">Esc</kbd>
          Close
        </span>
      </div>
    </div>
  );
};

export default SearchModal;