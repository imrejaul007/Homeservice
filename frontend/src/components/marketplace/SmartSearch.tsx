
// Smart Search Component - AI-powered search with personalization
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Clock, TrendingUp, Sparkles, MapPin } from 'lucide-react';
import { useRetentionStore } from '../../services/product/RetentionService';
import { usePersonalizationStore } from '../../services/marketplace/HyperPersonalization';
import { recommendationEngine } from '../../services/marketplace/RecommendationEngine';

interface SmartSearchProps {
  onSearch: (query: string) => void;
  onSuggestionClick?: (suggestion: string) => void;
  placeholder?: string;
}

export function SmartSearch({
  onSearch,
  onSuggestionClick,
  placeholder = 'Search services...',
}: SmartSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { recentlyViewed } = useRetentionStore();
  const { profile } = usePersonalizationStore();

  // Generate suggestions based on query and context
  const generateSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      // Show recent searches and personalized suggestions when empty
      const recentSearches = recentlyViewed
        .filter((r) => r.type === 'service')
        .slice(0, 3)
        .map((r) => r.name);

      // Get trending searches
      const trending = ['Plumbing', 'Electrical', 'Cleaning', 'AC Service', 'Painting'];

      setSuggestions([...recentSearches, ...trending].slice(0, 6));
      return;
    }

    setIsLoading(true);

    // Update recommendation engine context
    recommendationEngine.updateContext({
      browsingHistory: recentlyViewed.map((r) => r.id),
      favorites: (profile as any).favoriteServices || [],
    });

    // Get personalized search suggestions
    const personalized = recommendationEngine.getSearchSuggestions(
      searchQuery,
      recentlyViewed.map((r) => r.name)
    );

    // Add trending matches
    const trendingMatches = ['Electrician near me', 'Home cleaning', 'Plumber 24/7']
      .filter((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    setSuggestions([...personalized, ...trendingMatches].slice(0, 6));
    setIsLoading(false);
  }, [recentlyViewed, profile]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      generateSuggestions(query);
    }, 200);

    return () => clearTimeout(timer);
  }, [query, generateSuggestions]);

  // Handle search submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      onSearch(query.trim());
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    onSuggestionClick?.(suggestion);
    onSearch(suggestion);
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          {/* Search icon */}
          <div className="absolute left-4 top-1/2 -translate-y-1/2">
            <Search className="w-5 h-5 text-nilin-warmGray" />
          </div>

          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={placeholder}
            className="w-full pl-12 pr-12 py-4 bg-white rounded-2xl shadow-aaa-card text-nilin-charcoal placeholder:text-nilin-warmGray focus:outline-none focus:ring-2 focus:ring-nilin-coral/30"
          />

          {/* Clear button */}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100"
            >
              <X className="w-5 h-5 text-nilin-warmGray" />
            </button>
          )}
        </div>
      </form>

      {/* Suggestions dropdown */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-aaa-float overflow-hidden z-50"
          >
            <div className="p-2">
              {/* Recent searches */}
              {!query && recentlyViewed.length > 0 && (
                <div className="mb-2">
                  <p className="px-3 py-2 text-xs font-medium text-nilin-warmGray uppercase tracking-wide">
                    Recent
                  </p>
                  {recentlyViewed.slice(0, 3).map((item, index) => (
                    <button
                      key={item.id}
                      onClick={() => handleSuggestionClick(item.name)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left"
                    >
                      <Clock className="w-4 h-4 text-nilin-warmGray" />
                      <span className="text-sm text-nilin-charcoal">{item.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Trending searches */}
              {query && (
                <div className="mb-2">
                  <p className="px-3 py-2 text-xs font-medium text-nilin-warmGray uppercase tracking-wide">
                    Suggestions
                  </p>
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left"
                    >
                      {index === 0 && <Sparkles className="w-4 h-4 text-nilin-coral" />}
                      {index > 0 && <Search className="w-4 h-4 text-nilin-warmGray" />}
                      <span className="text-sm text-nilin-charcoal">{suggestion}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Personalized quick actions */}
              {!query && (
                <div>
                  <p className="px-3 py-2 text-xs font-medium text-nilin-warmGray uppercase tracking-wide">
                    Quick Search
                  </p>
                  <div className="flex flex-wrap gap-2 px-3 pb-2">
                    {['Plumber', 'Electrician', 'Cleaning', 'AC Service'].map((quick) => (
                      <button
                        key={quick}
                        onClick={() => handleSuggestionClick(quick)}
                        className="px-3 py-1.5 bg-nilin-blush/50 text-nilin-coral text-sm rounded-full hover:bg-nilin-blush"
                      >
                        {quick}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSuggestions(false)}
            className="fixed inset-0 z-40"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default SmartSearch;
