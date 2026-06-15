import { StrictMode } from 'react';
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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
