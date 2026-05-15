/**
 * App Routes
 *
 * Mobile app configuration and version endpoints
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();

// Read version from package.json at runtime
let APP_VERSION = '1.0.0';
try {
  const packageJsonPath = path.resolve(__dirname, '../../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  APP_VERSION = packageJson.version || '1.0.0';
} catch (error) {
  console.warn('Could not read version from package.json, using default');
}

// App configuration
const APP_CONFIG = {
  // Current app version (from package.json)
  latestVersion: {
    android: APP_VERSION,
    ios: APP_VERSION,
  },
  // Minimum supported version (can be overridden by environment)
  minimumVersion: {
    android: process.env.MIN_ANDROID_VERSION || '1.0.0',
    ios: process.env.MIN_IOS_VERSION || '1.0.0',
  },
  // Update URLs
  updateUrls: {
    android: 'https://play.google.com/store/apps/details?id=com.nilin.app',
    ios: 'https://apps.apple.com/app/nilin',
  },
  // Feature flags
  features: {
    loyaltyProgram: true,
    referralSystem: true,
    instantBooking: true,
    chatWithProvider: false,
    realTimeTracking: false,
  },
  // Support info
  support: {
    email: 'support@nilin.app',
    phone: '+971 50 123 4567',
    website: 'https://nilin.app/support',
  },
};

/**
 * GET /api/app/version
 * Get latest and minimum app versions
 */
router.get('/version', (req: Request, res: Response) => {
  const platform = (req.query.platform as string) || 'android';

  res.status(200).json({
    success: true,
    data: {
      latest: APP_CONFIG.latestVersion[platform as keyof typeof APP_CONFIG.latestVersion] || '1.0.0',
      minimum: APP_CONFIG.minimumVersion[platform as keyof typeof APP_CONFIG.minimumVersion] || '1.0.0',
      updateUrl: APP_CONFIG.updateUrls[platform as keyof typeof APP_CONFIG.updateUrls],
      forceUpdate: false,
      backendVersion: APP_VERSION,
    },
  });
});

/**
 * GET /api/app/config
 * Get app configuration
 */
router.get('/config', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      features: APP_CONFIG.features,
      support: APP_CONFIG.support,
      apiVersion: 'v1',
      backendVersion: APP_VERSION,
      environment: process.env.NODE_ENV || 'development',
    },
  });
});

/**
 * POST /api/app/check-update
 * Check if update is required
 */
router.post('/check-update', (req: Request, res: Response) => {
  const { version, platform } = req.body;

  if (!version || !platform) {
    res.status(400).json({
      success: false,
      message: 'Version and platform are required',
    });
    return;
  }

  const latestVersion = APP_CONFIG.latestVersion[platform as keyof typeof APP_CONFIG.latestVersion] || '1.0.0';
  const minimumVersion = APP_CONFIG.minimumVersion[platform as keyof typeof APP_CONFIG.minimumVersion] || '1.0.0';

  const isUpdateAvailable = compareVersions(version, latestVersion) < 0;
  const isForceUpdate = compareVersions(version, minimumVersion) < 0;

  res.status(200).json({
    success: true,
    data: {
      isUpdateAvailable,
      isForceUpdate,
      currentVersion: version,
      latestVersion,
      minimumVersion,
      updateUrl: APP_CONFIG.updateUrls[platform as keyof typeof APP_CONFIG.updateUrls],
    },
  });
});

// Helper function to compare versions
function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }

  return 0;
}

export default router;
