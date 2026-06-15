import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  startLoading: () => void;
  stopLoading: () => void;
  loadingMessage?: string;
  setLoadingMessage: (message?: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessageState] = useState<string | undefined>(undefined);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const setLoadingMessage = useCallback((message?: string) => {
    setLoadingMessageState(message);
  }, []);

  const startLoading = useCallback((message?: string) => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    setLoadingMessageState(message);
    setIsLoading(true);
  }, []);

  const stopLoading = useCallback(() => {
    // Add a small delay to prevent flash for quick loads
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false);
      setLoadingMessageState(undefined);
    }, 300);
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    if (loading) {
      startLoading();
    } else {
      stopLoading();
    }
  }, [startLoading, stopLoading]);

  useEffect(() => {
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        isLoading,
        setLoading,
        startLoading,
        stopLoading,
        loadingMessage,
        setLoadingMessage
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
}

// Hook for automatic route change detection
export function usePageLoading() {
  const { startLoading, stopLoading } = useLoading();
  const location = useLocation();
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Show loading on route change
    startLoading();

    // Hide loading after a small delay (allows for fast transitions)
    const timeout = setTimeout(() => {
      stopLoading();
    }, 100);

    return () => clearTimeout(timeout);
  }, [location.pathname, startLoading, stopLoading]);
}

export default LoadingContext;
