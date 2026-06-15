import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoading } from '../context/LoadingContext';

/**
 * Hook that automatically shows loading overlay on route changes
 * Works globally across all pages
 */
export function usePageLoading() {
  const { startLoading, stopLoading } = useLoading();
  const location = useLocation();
  const isInitialMount = useRef(true);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Skip initial mount - don't show loading on first page load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Clear any existing timeout
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }

    // Show loading overlay immediately
    startLoading();

    // Hide loading overlay after a minimum display time
    // This ensures the animation is visible and page content has time to render
    loadingTimeoutRef.current = setTimeout(() => {
      stopLoading();
    }, 400);

    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [location.pathname, startLoading, stopLoading]);
}

/**
 * Hook for manual loading control
 * Use when you need to show loading during async operations
 */
export function useLoadingState() {
  const { startLoading, stopLoading, setLoadingMessage } = useLoading();

  const showLoading = (message?: string) => {
    if (message) {
      setLoadingMessage(message);
    }
    startLoading();
  };

  const hideLoading = () => {
    stopLoading();
  };

  return {
    showLoading,
    hideLoading,
    setMessage: setLoadingMessage,
  };
}

export default usePageLoading;