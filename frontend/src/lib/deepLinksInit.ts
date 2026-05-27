
/**
 * Capacitor Deep Links Initialization
 *
 * This file initializes deep link handling for the native app.
 * Import this in your main entry point (main.tsx) to enable deep linking.
 */

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { parseDeepLink, deepLinkToRoute } from './deepLinks';
import { useNavigate } from 'react-router-dom';

export interface DeepLinkHandler {
  onDeepLink: (deepLink: ReturnType<typeof parseDeepLink>) => void;
}

/**
 * Initialize Capacitor deep links
 * Call this once at app startup (in main.tsx or App.tsx)
 */
export async function initializeDeepLinks(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('[DeepLinks] Running in web mode, skipping native deep link initialization');
    return;
  }

  try {
    // Listen for deep link events
    App.addListener('deepLink' as any, (data: { url: string }) => {
      console.log('[DeepLinks] Received deep link:', data.url);

      const parsed = parseDeepLink(data.url);
      if (parsed) {
        console.log('[DeepLinks] Parsed deep link:', parsed);

        // Dispatch custom event for React components to handle
        const event = new CustomEvent('capacitor-deep-link', {
          detail: { url: data.url, parsed },
        });
        window.dispatchEvent(event);
      }
    });

    // Get initial URL (app launched via deep link)
    const result = await App.getLaunchUrl();
    if (result?.url) {
      console.log('[DeepLinks] App launched with URL:', result.url);

      const parsed = parseDeepLink(result.url);
      if (parsed) {
        // Store initial deep link for later processing
        sessionStorage.setItem('initial_deep_link', result.url);
        sessionStorage.setItem('initial_deep_link_parsed', JSON.stringify(parsed));
      }
    }

    console.log('[DeepLinks] Successfully initialized');
  } catch (error) {
    console.error('[DeepLinks] Failed to initialize:', error);
  }
}

/**
 * Get the initial deep link that launched the app (if any)
 * Call this after the app has fully loaded to retrieve the launch URL
 */
export function getInitialDeepLink(): ReturnType<typeof parseDeepLink> | null {
  try {
    const stored = sessionStorage.getItem('initial_deep_link_parsed');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('[DeepLinks] Failed to get initial deep link:', error);
  }
  return null;
}

/**
 * Clear stored initial deep link (call after processing it)
 */
export function clearInitialDeepLink(): void {
  sessionStorage.removeItem('initial_deep_link');
  sessionStorage.removeItem('initial_deep_link_parsed');
}

/**
 * React hook to handle deep links reactively
 * Use this in a component that needs to react to deep link changes
 */
export function useDeepLinkNavigation() {
  const navigate = useNavigate();

  const handleDeepLinkEvent = (event: CustomEvent) => {
    const { parsed } = event.detail;
    if (parsed) {
      const route = deepLinkToRoute(parsed);
      console.log('[DeepLinks] Navigating to:', route);
      navigate(route);
    }
  };

  return { handleDeepLinkEvent };
}

export default initializeDeepLinks;
