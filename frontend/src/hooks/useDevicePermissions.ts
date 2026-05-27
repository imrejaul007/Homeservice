
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { useState, useEffect } from 'react';

/**
 * Permission states from the native layer
 */
export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * Supported permission types for the app
 */
export type PermissionType = 'camera' | 'photos' | 'location' | 'geolocation';

/**
 * Mapping of app permission types to native plugin permissions
 */
const PERMISSION_MAP: Record<PermissionType, string> = {
  camera: 'camera',
  photos: 'photos',
  location: 'geolocation',
  geolocation: 'geolocation',
};

/**
 * Hook for checking and requesting native device permissions.
 * Works on both native (Android/iOS) and web platforms.
 */
export function useDevicePermissions() {
  /**
   * Check if a permission is already granted without prompting the user.
   * @param permission - The permission type to check
   * @returns Promise resolving to true if granted, false otherwise
   */
  async function checkPermission(permission: PermissionType): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      // Web fallback: use browser permissions API
      return checkWebPermission(permission);
    }

    try {
      switch (permission) {
        case 'camera':
        case 'photos': {
          const status = await Camera.checkPermissions();
          return status.camera === 'granted' || status.photos === 'granted';
        }
        case 'location':
        case 'geolocation': {
          const status = await Geolocation.checkPermissions();
          return status.location === 'granted';
        }
        default:
          return false;
      }
    } catch (error) {
      console.error(`[useDevicePermissions] checkPermission failed for ${permission}:`, error);
      return false;
    }
  }

  /**
   * Request a permission from the user, showing the native prompt.
   * @param permission - The permission type to request
   * @returns Promise resolving to true if granted, false if denied
   */
  async function requestPermission(permission: PermissionType): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      // Web fallback: use browser permissions API
      return requestWebPermission(permission);
    }

    try {
      switch (permission) {
        case 'camera':
        case 'photos': {
          const status = await Camera.requestPermissions();
          return status.camera === 'granted' || status.photos === 'granted';
        }
        case 'location':
        case 'geolocation': {
          const status = await Geolocation.requestPermissions();
          return status.location === 'granted';
        }
        default:
          return false;
      }
    } catch (error) {
      console.error(`[useDevicePermissions] requestPermission failed for ${permission}:`, error);
      return false;
    }
  }

  /**
   * Check if camera permission is granted
   */
  async function checkCameraPermission(): Promise<boolean> {
    return checkPermission('camera');
  }

  /**
   * Request camera permission
   */
  async function requestCameraPermission(): Promise<boolean> {
    return requestPermission('camera');
  }

  /**
   * Check if photo library permission is granted
   */
  async function checkPhotosPermission(): Promise<boolean> {
    return checkPermission('photos');
  }

  /**
   * Request photo library permission
   */
  async function requestPhotosPermission(): Promise<boolean> {
    return requestPermission('photos');
  }

  /**
   * Check if location permission is granted
   */
  async function checkLocationPermission(): Promise<boolean> {
    return checkPermission('location');
  }

  /**
   * Request location permission
   */
  async function requestLocationPermission(): Promise<boolean> {
    return requestPermission('location');
  }

  /**
   * Check if geolocation permission is granted
   */
  async function checkGeolocationPermission(): Promise<boolean> {
    return checkPermission('geolocation');
  }

  /**
   * Request geolocation permission
   */
  async function requestGeolocationPermission(): Promise<boolean> {
    return requestPermission('geolocation');
  }

  /**
   * Ensure we have the required permission, requesting if necessary.
   * @param permission - The permission type to ensure
   * @returns Promise resolving to true if permission is granted, false otherwise
   */
  async function ensurePermission(permission: PermissionType): Promise<boolean> {
    const hasPermission = await checkPermission(permission);
    if (hasPermission) {
      return true;
    }
    return requestPermission(permission);
  }

  /**
   * Get the current permission status as a detailed state
   * @param permission - The permission type to check
   * @returns Promise resolving to the current permission state
   */
  async function getPermissionStatus(permission: PermissionType): Promise<PermissionState> {
    if (!Capacitor.isNativePlatform()) {
      return getWebPermissionStatus(permission);
    }

    try {
      switch (permission) {
        case 'camera':
        case 'photos': {
          const status = await Camera.checkPermissions();
          return status.camera as PermissionState || status.photos as PermissionState || 'unknown';
        }
        case 'location':
        case 'geolocation': {
          const status = await Geolocation.checkPermissions();
          return status.location as PermissionState || 'unknown';
        }
        default:
          return 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  return {
    checkPermission,
    requestPermission,
    checkCameraPermission,
    requestCameraPermission,
    checkPhotosPermission,
    requestPhotosPermission,
    checkLocationPermission,
    requestLocationPermission,
    checkGeolocationPermission,
    requestGeolocationPermission,
    ensurePermission,
    getPermissionStatus,
  };
}

// ============================================================================
// Web Platform Fallbacks
// ============================================================================

/**
 * Check permission status using the browser's Permissions API
 */
async function checkWebPermission(permission: PermissionType): Promise<boolean> {
  if (!navigator.permissions) {
    // Fallback for browsers without Permissions API
    return permission === 'camera';
  }

  try {
    const webPermission = PERMISSION_MAP[permission];
    const result = await navigator.permissions.query({ name: webPermission as PermissionName });
    return result.state === 'granted';
  } catch {
    return false;
  }
}

/**
 * Request permission using the browser's Permissions API
 */
async function requestWebPermission(permission: PermissionType): Promise<boolean> {
  if (!navigator.permissions) {
    return false;
  }

  try {
    const webPermission = PERMISSION_MAP[permission];
    const result = await navigator.permissions.query({ name: webPermission as PermissionName });

    if (result.state === 'granted') {
      return true;
    }

    if (result.state === 'prompt') {
      // Trigger the permission prompt by requesting the actual feature
      if (permission === 'camera' || permission === 'photos') {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach(track => track.stop());
          return true;
        } catch {
          return false;
        }
      }
      if (permission === 'location' || permission === 'geolocation') {
        return new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            () => resolve(false),
            { timeout: 10000 }
          );
        });
      }
    }

    return false; // Permission was denied or unavailable
  } catch {
    return false;
  }
}

/**
 * Get detailed permission status for web platform
 */
function getWebPermissionStatus(permission: PermissionType): PermissionState {
  if (!navigator.permissions) {
    return 'unknown';
  }

  const webPermission = PERMISSION_MAP[permission];
  // Sync check - just return unknown since we can't synchronously query
  // Actual status will be checked asynchronously
  return 'prompt';
}

// ============================================================================
// Standalone Export for Non-Hook Usage
// ============================================================================

export const devicePermissions = {
  checkPermission: async (permission: PermissionType): Promise<boolean> => {
    const hook = useDevicePermissions();
    return hook.checkPermission(permission);
  },
  requestPermission: async (permission: PermissionType): Promise<boolean> => {
    const hook = useDevicePermissions();
    return hook.requestPermission(permission);
  },
  ensurePermission: async (permission: PermissionType): Promise<boolean> => {
    const hook = useDevicePermissions();
    return hook.ensurePermission(permission);
  },
  checkCameraPermission: async (): Promise<boolean> => {
    const hook = useDevicePermissions();
    return hook.checkCameraPermission();
  },
  requestCameraPermission: async (): Promise<boolean> => {
    const hook = useDevicePermissions();
    return hook.requestCameraPermission();
  },
  checkLocationPermission: async (): Promise<boolean> => {
    const hook = useDevicePermissions();
    return hook.checkLocationPermission();
  },
  requestLocationPermission: async (): Promise<boolean> => {
    const hook = useDevicePermissions();
    return hook.requestLocationPermission();
  },
};

export default useDevicePermissions;

// ============================================================================
// Battery Optimization Hook
// ============================================================================

/**
 * Hook for checking and managing battery optimization status on Android.
 * Android may kill background tasks due to battery optimization, which can
 * affect WorkManager, background sync, and push notifications.
 */
export function useBatteryOptimization() {
  const [isIgnoring, setIsIgnoring] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkBatteryOptimization() {
      // Battery optimization is only applicable on Android native
      const isWebPlatform = !Capacitor.isNativePlatform();
      if (isWebPlatform) {
        setIsIgnoring(true);
        setIsLoading(false);
        return;
      }

      try {
        // On native Android, we would use PowerManager to check this
        // For Capacitor apps, this would be handled by the native plugin
        if (Capacitor.isNativePlatform()) {
          // Battery optimization check requires native plugin integration
          // Using @nickersoft/capacitor-power-management or similar
          // For now, check via native Intent (see checkNativeBatteryOptimization)
          const result = await checkNativeBatteryOptimization();
          setIsIgnoring(result);
        } else {
          // Web platform - not applicable
          setIsIgnoring(true);
        }
      } catch (error) {
        console.error('[useBatteryOptimization] Failed to check status:', error);
        setIsIgnoring(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkBatteryOptimization();
  }, []);

  /**
   * Request user to disable battery optimization for this app
   * This opens the system settings page where users can whitelist the app
   */
  const requestIgnoreBatteryOptimization = async (): Promise<boolean> => {
    // Battery optimization is only applicable on Android native
    if (!Capacitor.isNativePlatform()) {
      return true;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        // P0 FIX: Add @nickersoft/capacitor-power-management plugin for full support
        // Then use: await PowerManagement.requestIgnoreBatteryOptimization()
        //
        // Temporary workaround: Use native Intent via App plugin
        // Android: android.settings.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
        // This requires native bridge implementation in MainActivity
        //
        // For immediate fix, show user instructions to manually whitelist the app:
        // Settings > Apps > NILIN > Battery > Unrestricted
        console.warn(
          '[useBatteryOptimization] Native battery optimization request not implemented. ' +
          'User should manually whitelist app: Settings > Apps > NILIN > Battery > Unrestricted. ' +
          'Install @nickersoft/capacitor-power-management for automatic handling.'
        );
        return false;
      }
      return false;
    } catch (error) {
      console.error('[useBatteryOptimization] Failed to request exemption:', error);
      return false;
    }
  };

  return {
    isIgnoring,
    isLoading,
    requestIgnoreBatteryOptimization,
  };
}

/**
 * Check native battery optimization status via Capacitor plugin
 *
 * P0 FIX: This requires native plugin integration. Options:
 * 1. @nickersoft/capacitor-power-management (recommended)
 * 2. Custom native bridge via MainActivity
 *
 * Current implementation: Returns false (safer default) with console warning
 * to ensure users see battery optimization warnings until proper integration.
 */
async function checkNativeBatteryOptimization(): Promise<boolean> {
  // P0 FIX: Install @nickersoft/capacitor-power-management for full implementation:
  // npm install @nickersoft/capacitor-power-management
  // Then replace this function with:
  // import { PowerManagement } from '@nickersoft/capacitor-power-management';
  // const result = await PowerManagement.isIgnoringBatteryOptimizations();
  // return result.isIgnoring;

  // P0 FIX: Until plugin is installed, show warning that placeholder is active
  if (Capacitor.getPlatform() === 'android') {
    console.warn(
      '[useBatteryOptimization] Running in placeholder mode. ' +
      'Battery optimization status cannot be checked without @nickersoft/capacitor-power-management. ' +
      'Install: npm install @nickersoft/capacitor-power-management'
    );
  }

  // Return false (not ignoring) as safer default - shows warning to users
  // This ensures notifications and background sync are not unexpectedly blocked
  return false;
}
