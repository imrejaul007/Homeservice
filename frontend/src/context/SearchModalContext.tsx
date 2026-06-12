import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

/**
 * Search Modal Context
 * Provides global access to the search modal state
 * Allows any component to open/close the search modal
 */

interface SearchModalContextType {
  isOpen: boolean;
  initialQuery: string;
  open: (query?: string) => void;
  close: () => void;
  toggle: () => void;
}

const SearchModalContext = createContext<SearchModalContextType | undefined>(undefined);

export function SearchModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [initialQuery, setInitialQuery] = useState('');

  const open = useCallback((query: string = '') => {
    setInitialQuery(query);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  // Global keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open search with "/" key (when not in input)
      if (
        e.key === '/' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        open();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <SearchModalContext.Provider value={{ isOpen, initialQuery, open, close, toggle }}>
      {children}
    </SearchModalContext.Provider>
  );
}

export function useSearchModal() {
  const context = useContext(SearchModalContext);
  if (context === undefined) {
    throw new Error('useSearchModal must be used within a SearchModalProvider');
  }
  return context;
}

/**
 * Hook to open search modal from anywhere
 * Returns the open function directly without requiring context
 */
export function useOpenSearch() {
  const { open } = useSearchModal();
  return open;
}

export default SearchModalContext;