/**
 * Get API URL for mobile/Capacitor apps
 * Handles environment detection and proper fallback for mobile devices
 */

/**
 * Check if running in Capacitor environment
 */
export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as unknown as { Capacitor?: object }).Capacitor;
}

/**
 * Get the appropriate API URL based on environment
 * - Mobile/Capacitor: Uses VITE_API_URL or falls back to deployed backend
 * - Web (dev): Uses VITE_API_URL or localhost:5000
 * - Web (prod): Uses VITE_API_URL or same-origin /api
 */
export function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;

  if (envUrl) {
    return envUrl;
  }

  if (import.meta.env.DEV) {
    console.warn(
      '[getApiUrl] VITE_API_URL is not set. Using development fallback http://localhost:5000/api'
    );
  }

  if (import.meta.env.PROD && typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }

  if (isCapacitor()) {
    return 'https://homeservice-1.onrender.com/api';
  }

  return 'http://localhost:5000/api';
}

/**
 * Get WebSocket URL for Socket.IO
 * Removes /api suffix and uses appropriate protocol
 */
export function getSocketUrl(): string {
  const apiUrl = getApiUrl();
  return apiUrl.replace(/\/api$/, '');
}

export default getApiUrl;
