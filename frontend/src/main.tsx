import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import { initializeSentry } from './config/sentry';
import ErrorBoundary from './components/common/ErrorBoundary';
import { LoadingProvider } from './context/LoadingContext';

// Initialize Sentry for error tracking
initializeSentry();

// Network status detection hook
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Determine retry behavior based on error type
const shouldRetry = (failureCount: number, error: unknown): boolean => {
  // Don't retry if we've already tried 3 times
  if (failureCount >= 3) return false;

  // Don't retry on 4xx errors (except 429 Too Many Requests)
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status && status >= 400 && status < 500 && status !== 429) {
    return false;
  }

  // Retry on network errors (no response), 5xx errors, or 429
  return true;
};

// Exponential backoff delay (1s, 2s, 4s - capped at 30s)
const retryDelay = (attemptIndex: number): number => {
  return Math.min(1000 * Math.pow(2, attemptIndex), 30000);
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      // Keep unused data in cache for 30 minutes
      gcTime: 30 * 60 * 1000,
      // Retry failed requests with exponential backoff
      retry: shouldRetry,
      retryDelay,
      // Don't refetch on window focus (reduces API calls)
      refetchOnWindowFocus: false,
      // Don't refetch when regaining network connection
      refetchOnReconnect: 'conditional',
      // Show loading state for initial fetches only
      initialStale: true,
    },
    mutations: {
      // Retry mutations once on failure
      retry: 1,
      retryDelay: 1000,
    },
  },
});

// Online status context for components
export { useOnlineStatus };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <LoadingProvider>
            <App />
          </LoadingProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
