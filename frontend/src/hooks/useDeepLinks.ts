import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

export interface DeepLinkEvent {
  url: string;
}

export interface DeepLinkData {
  path: string;
  params: Record<string, string>;
}

/**
 * Parse deep link URL into path and params
 * Examples:
 * - https://nilin.app/booking/123 -> { path: '/booking/123', params: {} }
 * - https://nilin.app/service?serviceId=456 -> { path: '/service', params: { serviceId: '456' } }
 */
export function parseDeepLink(url: string): DeepLinkData {
  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    const params: Record<string, string> = {};

    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return { path, params };
  } catch {
    return { path: '/', params: {} };
  }
}

/**
 * Map deep link paths to app routes
 */
const ROUTE_MAPPING: Record<string, string> = {
  '/': '/',
  '/home': '/',
  '/search': '/search',
  '/service': '/service/:id',
  '/booking': '/booking/:id',
  '/track': '/track/:id',
  '/provider': '/provider/:id',
  '/login': '/auth/login',
  '/register': '/auth/register',
};

/**
 * Convert deep link path to app route
 */
export function mapDeepLinkToRoute(deepLinkPath: string): string {
  // Direct match
  if (ROUTE_MAPPING[deepLinkPath]) {
    return ROUTE_MAPPING[deepLinkPath];
  }

  // Pattern matching for dynamic routes
  const segments = deepLinkPath.split('/').filter(Boolean);

  if (segments.length >= 1) {
    const base = '/' + segments[0];

    // Check if base route exists
    if (ROUTE_MAPPING[base]) {
      const routeTemplate = ROUTE_MAPPING[base];
      let route = routeTemplate;

      // Replace dynamic segments (e.g., :id)
      for (let i = 1; i < segments.length; i++) {
        route = route.replace(/:[a-zA-Z]+/, segments[i]);
      }

      return route;
    }
  }

  return deepLinkPath;
}

export function useDeepLinks() {
  const navigate = useNavigate();
  const handledUrlsRef = useRef<Set<string>>(new Set());

  const handleDeepLink = useCallback((event: CustomEvent<DeepLinkEvent>) => {
    const { url } = event.detail;

    // Avoid processing the same URL multiple times
    if (handledUrlsRef.current.has(url)) {
      return;
    }
    handledUrlsRef.current.add(url);

    console.log('[DeepLink] Received:', url);

    const { path, params } = parseDeepLink(url);
    const route = mapDeepLinkToRoute(path);

    console.log('[DeepLink] Navigating to:', route, params);

    // Navigate using React Router
    if (Object.keys(params).length > 0) {
      navigate({ pathname: route, search: new URLSearchParams(params).toString() });
    } else {
      navigate(route);
    }
  }, [navigate]);

  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('[DeepLink] Not running on native platform, skipping deep link handler');
      return;
    }

    // Listen for deep link events from native
    window.addEventListener('capacitor-deep-link', handleDeepLink as EventListener);

    // Also check for initial URL on app start (Android)
    const checkInitialUrl = async () => {
      try {
        // @ts-expect-error - Native method exposed via Capacitor
        const initialUrl = await window.Capacitor.Plugins.App?.getLaunchUrl();

        if (initialUrl?.url && !handledUrlsRef.current.has(initialUrl.url)) {
          const { path, params } = parseDeepLink(initialUrl.url);
          const route = mapDeepLinkToRoute(path);

          console.log('[DeepLink] Initial URL:', initialUrl.url);
          navigate(route);
        }
      } catch (error) {
        console.log('[DeepLink] Could not get initial URL:', error);
      }
    };

    checkInitialUrl();

    return () => {
      window.removeEventListener('capacitor-deep-link', handleDeepLink as EventListener);
    };
  }, [handleDeepLink, navigate]);

  return { handleDeepLink };
}

export default useDeepLinks;
