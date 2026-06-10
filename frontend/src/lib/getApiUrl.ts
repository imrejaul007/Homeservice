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
 * - Web (prod): Uses VITE_API_URL or relative path
 */
export function getApiUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;

  // If environment variable is set, use it
  if (envUrl) {
    return envUrl;
  }

  // Mobile/Capacitor fallback to deployed backend
  if (isCapacitor()) {
    // For mobile, use the deployed backend URL
    return 'https://homeservice-1.onrender.com/api';
  }

  // Web fallback
  return 'http://localhost:5000/api';
}

/**
 * Get WebSocket URL for Socket.IO
 * Removes /api suffix and uses appropriate protocol
 */
export function getSocketUrl(): string {
  const apiUrl = getApiUrl();
  // Remove /api suffix if present
  return apiUrl.replace(/\/api$/, '');
}

/**
 * Default export for convenience
 */
export default getApiUrl;