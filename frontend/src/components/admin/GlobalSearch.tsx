import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Users,
  UserCog,
  Calendar,
  Briefcase,
  AlertTriangle,
  Clock,
  ArrowRight,
  Command,
  X,
  Loader2,
} from 'lucide-react';
import { useGlobalSearch } from '@/hooks/useGlobalSearch';
import { useDebounce } from '@/hooks/useDebounce';
import type { SearchResultItem, QuickAction, SearchResultType } from '@/types/globalSearch';

// Re-export types for consumers
export type { SearchResultItem, QuickAction, SearchResultType } from '@/types/globalSearch';

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================
// CONSTANTS
// ============================================

const RESULT_TYPE_CONFIG: Record<SearchResultType, { label: string; icon: React.ReactNode; color: string }> = {
  customer: {
    label: 'Customers',
    icon: <Users className="w-4 h-4" />,
    color: 'text-blue-600 bg-blue-50',
  },
  provider: {
    label: 'Providers',
    icon: <UserCog className="w-4 h-4" />,
    color: 'text-purple-600 bg-purple-50',
  },
  booking: {
    label: 'Bookings',
    icon: <Calendar className="w-4 h-4" />,
    color: 'text-green-600 bg-green-50',
  },
  service: {
    label: 'Services',
    icon: <Briefcase className="w-4 h-4" />,
    color: 'text-amber-600 bg-amber-50',
  },
  dispute: {
    label: 'Disputes',
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-red-600 bg-red-50',
  },
};

const MAX_RECENT_SEARCHES = 5;
const RECENT_SEARCHES_KEY = 'admin_recent_searches';

// ============================================
// HELPER FUNCTIONS
// ============================================

const loadRecentSearches = (): SearchResultItem[] => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveRecentSearch = (item: SearchResultItem): void => {
  try {
    const recent = loadRecentSearches().filter((r) => r.id !== item.id);
    const updated = [item, ...recent].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    // Silently fail
  }
};

const removeRecentSearch = (id: string): void => {
  try {
    const recent = loadRecentSearches().filter((r) => r.id !== id);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
  } catch {
    // Silently fail
  }
};

const clearAllRecentSearches = (): void => {
  try {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  } catch {
    // Silently fail
  }
};

// ============================================
// SUB-COMPONENTS
// ============================================

const SearchResultGroup: React.FC<{
  type: SearchResultType;
  items: SearchResultItem[];
  selectedIndex: number;
  startIndex: number;
  onSelect: (item: SearchResultItem) => void;
}> = ({ type, items, selectedIndex, startIndex, onSelect }) => {
  const config = RESULT_TYPE_CONFIG[type];

  if (items.length === 0) return null;

  return (
    <div className="py-2">
      <div className="px-4 py-1.5 flex items-center gap-2">
        <span className={`p-1 rounded ${config.color}`}>{config.icon}</span>
        <span className="text-xs font-semibold text-nilin-charcoal uppercase tracking-wide">
          {config.label}
        </span>
        <span className="text-xs text-nilin-warmGray">{items.length} result{items.length !== 1 ? 's' : ''}</span>
      </div>
      <div role="listbox" aria-label={`${config.label} results`}>
        {items.map((item, index) => {
          const globalIndex = startIndex + index;
          const isSelected = selectedIndex === globalIndex;

          return (
            <button
              key={item.id}
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(item)}
              className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                isSelected
                  ? 'bg-nilin-coral/10 border-l-2 border-nilin-coral'
                  : 'hover:bg-nilin-blush/30 border-l-2 border-transparent'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-nilin-charcoal truncate">{item.title}</p>
                <p className="text-xs text-nilin-warmGray truncate">{item.subtitle}</p>
                {item.meta && (
                  <p className="text-xs text-nilin-warmGray/70 mt-0.5">{item.meta}</p>
                )}
              </div>
              <ArrowRight className={`w-4 h-4 flex-shrink-0 transition-transform ${isSelected ? 'translate-x-1 text-nilin-coral' : 'text-nilin-warmGray/50'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

const QuickActions: React.FC<{
  actions: QuickAction[];
  selectedIndex: number;
  startIndex: number;
  onSelect: (action: QuickAction) => void;
}> = ({ actions, selectedIndex, startIndex, onSelect }) => {
  if (actions.length === 0) return null;

  return (
    <div className="py-2 border-t border-nilin-border">
      <div className="px-4 py-1.5 flex items-center gap-2">
        <Command className="w-3.5 h-3.5 text-nilin-warmGray" />
        <span className="text-xs font-semibold text-nilin-charcoal uppercase tracking-wide">
          Quick Actions
        </span>
      </div>
      <div role="listbox" aria-label="Quick actions">
        {actions.map((action, index) => {
          const globalIndex = startIndex + index;
          const isSelected = selectedIndex === globalIndex;

          return (
            <button
              key={action.id}
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(action)}
              className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors ${
                isSelected
                  ? 'bg-nilin-coral/10 border-l-2 border-nilin-coral'
                  : 'hover:bg-nilin-blush/30 border-l-2 border-transparent'
              }`}
            >
              <span className="p-1.5 rounded bg-nilin-blush/50 text-nilin-charcoal">
                {action.icon}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-nilin-charcoal">{action.label}</p>
                <p className="text-xs text-nilin-warmGray">{action.description}</p>
              </div>
              <ArrowRight className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'translate-x-1 text-nilin-coral' : 'text-nilin-warmGray/50'}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

const RecentSearches: React.FC<{
  items: SearchResultItem[];
  selectedIndex: number;
  startIndex: number;
  onSelect: (item: SearchResultItem) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}> = ({ items, selectedIndex, startIndex, onSelect, onRemove, onClear }) => {
  if (items.length === 0) return null;

  return (
    <div className="py-2">
      <div className="px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-nilin-warmGray" />
          <span className="text-xs font-semibold text-nilin-charcoal uppercase tracking-wide">
            Recent
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-nilin-coral hover:underline"
        >
          Clear all
        </button>
      </div>
      <div role="listbox" aria-label="Recent searches">
        {items.map((item, index) => {
          const globalIndex = startIndex + index;
          const isSelected = selectedIndex === globalIndex;
          const typeConfig = RESULT_TYPE_CONFIG[item.type];

          return (
            <div
              key={item.id}
              role="option"
              aria-selected={isSelected}
              className={`w-full flex items-center gap-2 transition-colors ${
                isSelected ? 'bg-nilin-coral/10' : 'hover:bg-nilin-blush/30'
              }`}
            >
              <button
                onClick={() => onSelect(item)}
                className="flex-1 px-4 py-2.5 flex items-center gap-3 text-left"
              >
                <span className={`p-1 rounded ${typeConfig.color}`}>{typeConfig.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-nilin-charcoal truncate">{item.title}</p>
                  <p className="text-xs text-nilin-warmGray truncate">{item.subtitle}</p>
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                className="p-2 mr-2 text-nilin-warmGray hover:text-nilin-charcoal transition-colors"
                aria-label={`Remove ${item.title} from recent searches`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<SearchResultItem[]>([]);

  const debouncedQuery = useDebounce(query, 250);

  const {
    results,
    isLoading,
    error,
    quickActions,
    groupedResults,
    totalResults,
  } = useGlobalSearch(debouncedQuery);

  // Load recent searches on mount
  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(-1);
      setQuery('');
    }
  }, [isOpen]);

  // Calculate all navigable items for keyboard nav
  const allItems = useMemo(() => {
    const items: Array<{ type: 'result' | 'action' | 'recent'; item: SearchResultItem | QuickAction; original: SearchResultItem | QuickAction }> = [];

    if (!query) {
      // Show recent searches when no query
      recentSearches.forEach((item) => {
        items.push({ type: 'recent', item, original: item });
      });
    } else {
      // Show results grouped by type
      Object.entries(groupedResults).forEach(([type, typeResults]) => {
        typeResults.forEach((result) => {
          items.push({ type: 'result', item: result, original: result });
        });
      });

      // Show quick actions
      quickActions.forEach((action) => {
        items.push({ type: 'action', item: action, original: action });
      });
    }

    return items;
  }, [query, groupedResults, quickActions, recentSearches]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [debouncedQuery]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, allItems.length - 1));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, -1));
          break;

        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < allItems.length) {
            const selected = allItems[selectedIndex];
            if (selected.type === 'result' || selected.type === 'recent') {
              const result = selected.original as SearchResultItem;
              saveRecentSearch(result);
              navigate(result.href);
              onClose();
            } else if (selected.type === 'action') {
              const action = selected.original as QuickAction;
              action.action();
              onClose();
            }
          }
          break;

        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [allItems, selectedIndex, navigate, onClose]
  );

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && listRef.current) {
      const selectedElement = listRef.current.querySelector(`[aria-selected="true"]`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Handle result selection
  const handleSelectResult = useCallback(
    (item: SearchResultItem) => {
      saveRecentSearch(item);
      setRecentSearches(loadRecentSearches());
      navigate(item.href);
      onClose();
    },
    [navigate, onClose]
  );

  // Handle quick action selection
  const handleSelectAction = useCallback(
    (action: QuickAction) => {
      action.action();
      onClose();
    },
    [onClose]
  );

  // Handle recent search removal
  const handleRemoveRecent = useCallback((id: string) => {
    removeRecentSearch(id);
    setRecentSearches(loadRecentSearches());
  }, []);

  // Handle clear all recent
  const handleClearRecent = useCallback(() => {
    clearAllRecentSearches();
    setRecentSearches([]);
  }, []);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  // Calculate section start indices for grouped results
  let currentIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl animate-slide-up overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-nilin-border">
          <Search className="w-5 h-5 text-nilin-warmGray flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search customers, providers, bookings, services..."
            className="flex-1 text-base text-nilin-charcoal placeholder:text-nilin-warmGray/60 bg-transparent outline-none"
            aria-label="Search"
            aria-controls="search-results"
            aria-activedescendant={selectedIndex >= 0 ? `search-item-${selectedIndex}` : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          {isLoading && <Loader2 className="w-5 h-5 text-nilin-coral animate-spin flex-shrink-0" />}
          {query && !isLoading && (
            <button
              onClick={() => setQuery('')}
              className="p-1.5 rounded-lg hover:bg-nilin-blush/50 text-nilin-warmGray transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-0.5 px-2 py-1 text-xs font-medium text-nilin-warmGray bg-nilin-blush/50 rounded border border-nilin-border/50">
            <span>ESC</span>
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          id="search-results"
          className="max-h-[60vh] overflow-y-auto"
          role="listbox"
        >
          {error && (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-nilin-rose">{error}</p>
            </div>
          )}

          {!query && recentSearches.length > 0 && (
            <RecentSearches
              items={recentSearches}
              selectedIndex={selectedIndex}
              startIndex={0}
              onSelect={handleSelectResult}
              onRemove={handleRemoveRecent}
              onClear={handleClearRecent}
            />
          )}

          {!query && recentSearches.length === 0 && (
            <div className="px-4 py-8 text-center">
              <Search className="w-10 h-10 mx-auto text-nilin-warmGray/30 mb-3" />
              <p className="text-sm text-nilin-warmGray">Start typing to search...</p>
              <p className="text-xs text-nilin-warmGray/70 mt-1">
                Search customers, providers, bookings, services, and disputes
              </p>
            </div>
          )}

          {query && totalResults === 0 && !isLoading && (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-nilin-warmGray">No results found for "{query}"</p>
              <p className="text-xs text-nilin-warmGray/70 mt-1">
                Try searching with a different term or ID
              </p>
            </div>
          )}

          {query && totalResults > 0 && (
            <>
              {/* Results grouped by type */}
              {(Object.entries(groupedResults) as [SearchResultType, SearchResultItem[]][]).map(
                ([type, items]) => {
                  const sectionStart = currentIndex;
                  currentIndex += items.length;

                  return (
                    <SearchResultGroup
                      key={type}
                      type={type}
                      items={items}
                      selectedIndex={selectedIndex}
                      startIndex={sectionStart}
                      onSelect={handleSelectResult}
                    />
                  );
                }
              )}

              {/* Quick Actions */}
              {quickActions.length > 0 && (
                <QuickActions
                  actions={quickActions}
                  selectedIndex={selectedIndex}
                  startIndex={currentIndex}
                  onSelect={handleSelectAction}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-nilin-border bg-nilin-blush/20 flex items-center justify-between text-xs text-nilin-warmGray">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-nilin-border/50">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-nilin-border/50">↓</kbd>
              <span className="ml-1">to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-white rounded border border-nilin-border/50">↵</kbd>
              <span className="ml-1">to select</span>
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white rounded border border-nilin-border/50">Ctrl</kbd>
            <kbd className="px-1.5 py-0.5 bg-white rounded border border-nilin-border/50">K</kbd>
            <span className="ml-1">to toggle</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
